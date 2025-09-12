import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: string;
  username: string;
  role: 'admin' | 'ops' | 'viewer';
  requirePasswordChange: boolean;
}

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string; requirePasswordChange?: boolean }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PERMISSIONS = {
  admin: ['view_all', 'manage_users', 'manage_settings', 'export_reports', 'manage_vehicles', 'manage_customers', 'manage_rentals', 'manage_payments'],
  ops: ['view_all', 'manage_vehicles', 'manage_customers', 'manage_rentals', 'manage_payments', 'limited_reports'],
  viewer: ['view_all']
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on app load
    const sessionToken = localStorage.getItem('sessionToken');
    if (sessionToken) {
      try {
        const sessionData = JSON.parse(atob(sessionToken));
        if (sessionData.exp > Date.now()) {
          setUser({
            id: sessionData.userId,
            username: sessionData.username,
            role: sessionData.role,
            requirePasswordChange: false
          });
        } else {
          localStorage.removeItem('sessionToken');
        }
      } catch {
        localStorage.removeItem('sessionToken');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch('https://wrogevjpvhvputrjhvvg.supabase.co/functions/v1/auth-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        localStorage.setItem('sessionToken', data.sessionToken);
        setUser(data.user);
        return { 
          success: true, 
          requirePasswordChange: data.user.requirePasswordChange 
        };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    try {
      const sessionToken = localStorage.getItem('sessionToken');
      if (!sessionToken) {
        return { success: false, error: 'No active session' };
      }

      const response = await fetch('https://wrogevjpvhvputrjhvvg.supabase.co/functions/v1/auth-change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ currentPassword, newPassword, sessionToken }),
      });

      const data = await response.json();

      if (data.success && user) {
        // Update user state to clear requirePasswordChange flag
        setUser({ ...user, requirePasswordChange: false });
        return { success: true };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('sessionToken');
    setUser(null);
  };

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    return PERMISSIONS[user.role]?.includes(permission) || false;
  };

  return (
    <AuthContext.Provider value={{
      user,
      login,
      changePassword,
      logout,
      isLoading,
      hasPermission
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}