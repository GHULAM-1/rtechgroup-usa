import { useState, useEffect } from 'react';
import { Navigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, Shield } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuthValidation } from '@/hooks/useAuthValidation';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { supabase } from '@/integrations/supabase/client';

export default function Login() {
  const { user, signIn, loading, appUser } = useAuth();
  const location = useLocation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    rememberMe: false
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  
  const { 
    validateField, 
    validateForm, 
    setFieldTouched, 
    getFieldError, 
    clearErrors 
  } = useAuthValidation();
  
  const { 
    rateLimitStatus, 
    checkRateLimit, 
    recordLoginAttempt, 
    getRateLimitMessage, 
    isLocked 
  } = useRateLimiting();

  // Role-based redirect logic
  const getRedirectPath = (): string => {
    if (appUser?.role === 'head_admin' || appUser?.role === 'admin') {
      return '/dashboard';
    }
    if (appUser?.role === 'ops') {
      return '/vehicles';
    }
    if (appUser?.role === 'viewer') {
      return '/reports';
    }
    return '/dashboard'; // Default fallback
  };

  const from = location.state?.from?.pathname || getRedirectPath();

  // If already authenticated, redirect to dashboard
  if (user && !loading) {
    return <Navigate to={from} replace />;
  }

  // Show loading screen while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex items-center gap-2">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    const validationErrors = validateForm(formData);
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => setFieldTouched(error.field));
      return;
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(formData.email);
    if (!rateLimitCheck.allowed) {
      setError(getRateLimitMessage() || 'Too many failed attempts. Please try again later.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: signInError } = await signIn(formData.email, formData.password);
      
      if (signInError) {
        // Record failed attempt
        await recordLoginAttempt(formData.email, false);
        
        // Log audit event
        try {
          await supabase.from('audit_logs').insert({
            action: 'login_failed',
            details: { 
              email: formData.email,
              error_type: signInError.message.includes('Invalid login credentials') ? 'invalid_credentials' : 'other',
              user_agent: navigator.userAgent
            }
          });
        } catch (auditError) {
          console.error('Failed to log audit event:', auditError);
        }
        
        // Security-safe error messages
        if (signInError.message.includes('Invalid login credentials')) {
          setError('Invalid credentials. Please check your email and password and try again.');
        } else if (signInError.message.includes('Email not confirmed')) {
          setError('Please confirm your email address before signing in.');
        } else if (signInError.message.includes('Too many requests')) {
          setError('Too many login attempts. Please wait before trying again.');
        } else if (signInError.message.includes('deactivated') || signInError.message.includes('inactive')) {
          setError('Your account has been deactivated. Please contact your system administrator.');
        } else {
          setError('Unable to sign in. Please check your credentials and try again.');
        }

        const updatedRateLimit = await recordLoginAttempt(formData.email, false);
        if (updatedRateLimit.attemptsRemaining <= 2 && updatedRateLimit.attemptsRemaining > 0) {
          toast({
            title: "Security Notice",
            description: `${updatedRateLimit.attemptsRemaining} attempt${updatedRateLimit.attemptsRemaining > 1 ? 's' : ''} remaining before temporary lockout.`,
            variant: "destructive",
          });
        }
      } else {
        // Record successful attempt
        await recordLoginAttempt(formData.email, true);
        
        // Log successful login
        try {
          await supabase.from('audit_logs').insert({
            action: 'login_success',
            details: { 
              email: formData.email,
              remember_me: formData.rememberMe,
              user_agent: navigator.userAgent
            }
          });
        } catch (auditError) {
          console.error('Failed to log audit event:', auditError);
        }
        
        // Clear any validation errors
        clearErrors();
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred. Please try again.');
      
      // Log unexpected errors
      try {
        await supabase.from('audit_logs').insert({
          action: 'login_error',
          details: { 
            email: formData.email,
            error: error instanceof Error ? error.message : 'Unknown error',
            user_agent: navigator.userAgent
          }
        });
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!formData.email) {
      setError('Please enter your email address first.');
      return;
    }

    if (validateField('email', formData.email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(formData.email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      setShowForgotPassword(true);
      
      // Log password reset request
      try {
        await supabase.from('audit_logs').insert({
          action: 'password_reset_requested',
          details: { email: formData.email }
        });
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      // Always show success message for security (don't reveal if email exists)
      setShowForgotPassword(true);
    }
  };

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (error) setError('');
    
    // Clear field-specific validation error when user starts typing
    if (typeof value === 'string' && value.length > 0) {
      setFieldTouched(field);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img 
              src="/rtechgroup-logo.png" 
              alt="RTECHGROUP UK Logo" 
              className="h-24 w-auto object-contain"
            />
          </div>
          <CardTitle className="text-2xl font-bold">Sign In</CardTitle>
          <CardDescription>
            Enter your email and password to access the fleet management system
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showForgotPassword ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <Shield className="h-12 w-12 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Password Reset Sent</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  If an account exists with that email address, you will receive password reset instructions.
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setShowForgotPassword(false)}
                className="w-full"
              >
                Back to Sign In
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              {getRateLimitMessage() && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{getRateLimitMessage()}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  onBlur={() => setFieldTouched('email')}
                  required
                  disabled={isSubmitting || isLocked}
                  autoComplete="email"
                  autoFocus
                  aria-invalid={!!getFieldError('email')}
                  aria-describedby={getFieldError('email') ? 'email-error' : undefined}
                />
                {getFieldError('email') && (
                  <p id="email-error" className="text-sm text-destructive">
                    {getFieldError('email')}
                  </p>
                )}
              </div>
              
              <div className="space-y-2 relative">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={(e) => handleInputChange('password', e.target.value)}
                  onBlur={() => setFieldTouched('password')}
                  required
                  disabled={isSubmitting || isLocked}
                  autoComplete="current-password"
                  aria-invalid={!!getFieldError('password')}
                  aria-describedby={getFieldError('password') ? 'password-error' : undefined}
                />
                {getFieldError('password') && (
                  <p id="password-error" className="text-sm text-destructive">
                    {getFieldError('password')}
                  </p>
                )}
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="rememberMe"
                    checked={formData.rememberMe}
                    onCheckedChange={(checked) => handleInputChange('rememberMe', checked as boolean)}
                    disabled={isSubmitting || isLocked}
                  />
                  <Label 
                    htmlFor="rememberMe" 
                    className="text-sm font-normal cursor-pointer"
                  >
                    Keep me signed in
                  </Label>
                </div>
                <Button
                  type="button"
                  variant="link"
                  className="px-0 text-sm"
                  onClick={handleForgotPassword}
                  disabled={isSubmitting}
                >
                  Forgot password?
                </Button>
              </div>
              
              <Button 
                type="submit" 
                className="w-full"
                disabled={isSubmitting || isLocked || !formData.email || !formData.password}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
              
              {rateLimitStatus.attemptsRemaining < 5 && rateLimitStatus.attemptsRemaining > 0 && (
                <div className="text-center text-sm text-amber-600">
                  {rateLimitStatus.attemptsRemaining} attempt{rateLimitStatus.attemptsRemaining > 1 ? 's' : ''} remaining
                </div>
              )}
            </form>
          )}
          
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Need help? Contact your system administrator.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}