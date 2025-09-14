import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children, requiredRoles }) => {
  const { user, appUser, loading } = useAuth();
  const location = useLocation();

  // Show loading skeleton while checking auth
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex h-16 items-center justify-between px-6 border-b">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <div className="p-6 space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-lg border p-6">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-24" />
              </div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(2)].map((_, i) => (
              <div key={i} className="rounded-lg border p-6">
                <Skeleton className="h-6 w-32 mb-4" />
                <div className="space-y-2">
                  {[...Array(5)].map((_, j) => (
                    <Skeleton key={j} className="h-4 w-full" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!user || !appUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Account deactivated - sign out and redirect
  if (!appUser.is_active) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check role requirements
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.includes(appUser.role);
    
    if (!hasRequiredRole) {
      // Redirect to dashboard with error message
      return <Navigate to="/dashboard" state={{ error: 'Access denied: Insufficient privileges' }} replace />;
    }
  }

  return <>{children}</>;
};