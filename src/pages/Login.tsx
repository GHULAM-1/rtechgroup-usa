import { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuthValidation } from '@/hooks/useAuthValidation';
import { useRateLimiting } from '@/hooks/useRateLimiting';
import { supabase } from '@/integrations/supabase/client';
import { ThemeToggle } from '@/components/ThemeToggle';
import { EnhancedSignInCard } from '@/components/ui/sign-in-card-enhanced';


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
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  
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

  const handleSubmit = async (email: string, password: string, rememberMe: boolean) => {
    setError('');
    
    // Validate form
    const validationErrors = validateForm({ email, password });
    if (validationErrors.length > 0) {
      validationErrors.forEach(error => setFieldTouched(error.field));
      return;
    }

    // Check rate limiting
    const rateLimitCheck = await checkRateLimit(email);
    if (!rateLimitCheck.allowed) {
      setError(getRateLimitMessage() || 'Too many failed attempts. Please try again later.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error: signInError } = await signIn(email, password);
      
      if (signInError) {
        // Record failed attempt
        await recordLoginAttempt(email, false);
        
        // Log audit event
        try {
          await supabase.from('audit_logs').insert({
            action: 'login_failed',
            details: { 
              email: email,
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

        const updatedRateLimit = await recordLoginAttempt(email, false);
        if (updatedRateLimit.attemptsRemaining <= 2 && updatedRateLimit.attemptsRemaining > 0) {
          toast({
            title: "Security Notice",
            description: `${updatedRateLimit.attemptsRemaining} attempt${updatedRateLimit.attemptsRemaining > 1 ? 's' : ''} remaining before temporary lockout.`,
            variant: "destructive",
          });
        }
      } else {
        // Record successful attempt
        await recordLoginAttempt(email, true);
        
        // Log successful login
        try {
          await supabase.from('audit_logs').insert({
            action: 'login_success',
            details: { 
              email: email,
              remember_me: rememberMe,
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
            email: email,
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

  const handleForgotPassword = async (email: string) => {
    if (!email) {
      setError('Please enter your email address first.');
      return;
    }

    if (validateField('email', email)) {
      setError('Please enter a valid email address.');
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      setShowPasswordReset(true);
      
      // Log password reset request
      try {
        await supabase.from('audit_logs').insert({
          action: 'password_reset_requested',
          details: { email: email }
        });
      } catch (auditError) {
        console.error('Failed to log audit event:', auditError);
      }
    } catch (error) {
      console.error('Password reset error:', error);
      // Always show success message for security (don't reveal if email exists)
      setShowPasswordReset(true);
    }
  };

  return (
    <div className="relative">
      <div className="absolute top-4 right-4 z-50">
        <ThemeToggle />
      </div>
      
      <EnhancedSignInCard
        onSubmit={handleSubmit}
        onForgotPassword={handleForgotPassword}
        isLoading={isSubmitting}
        error={error}
        rateLimitMessage={rateLimitStatus.attemptsRemaining < 5 && rateLimitStatus.attemptsRemaining > 0 ? 
          `${rateLimitStatus.attemptsRemaining} attempt${rateLimitStatus.attemptsRemaining !== 1 ? 's' : ''} remaining` : 
          undefined
        }
        showPasswordReset={showPasswordReset}
        email={formData.email}
        password={formData.password}
        rememberMe={formData.rememberMe}
        onEmailChange={(email) => {
          setFormData(prev => ({ ...prev, email }));
          setFieldTouched('email');
          if (error) setError('');
        }}
        onPasswordChange={(password) => {
          setFormData(prev => ({ ...prev, password }));
          setFieldTouched('password');
          if (error) setError('');
        }}
        onRememberMeChange={(rememberMe) => 
          setFormData(prev => ({ ...prev, rememberMe }))
        }
        emailError={getFieldError('email')}
        passwordError={getFieldError('password')}
      />
    </div>
  );
}