import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requirePermission?: string;
}

export function ProtectedRoute({ children, requirePermission }: ProtectedRouteProps) {
  const { user, isLoading, hasPermission } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.requirePasswordChange) {
    return <Navigate to="/change-password" replace />;
  }

  if (requirePermission && !hasPermission(requirePermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}