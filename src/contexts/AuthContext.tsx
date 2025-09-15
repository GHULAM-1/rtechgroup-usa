import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface AppUser {
  id: string;
  auth_user_id: string;
  email: string;
  name: string | null;
  role: 'head_admin' | 'admin' | 'ops' | 'viewer';
  is_active: boolean;
  must_change_password: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  appUser: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  hasRole: (role: string | string[]) => boolean;
  isAdmin: () => boolean;
  refetchAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAppUser = async (authUser: User): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single();

      if (error) {
        console.error('Error fetching app user:', error);
        return null;
      }

      return data as AppUser;
    } catch (error) {
      console.error('Error in fetchAppUser:', error);
      return null;
    }
  };

  const refetchAppUser = async () => {
    if (user) {
      const userData = await fetchAppUser(user);
      setAppUser(userData);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        console.error('Sign in error:', error);
        return { error };
      }

      if (data.user) {
        const userData = await fetchAppUser(data.user);
        
        if (!userData) {
          await supabase.auth.signOut();
          return { error: { message: 'User profile not found' } };
        }

        if (!userData.is_active) {
          await supabase.auth.signOut();
          return { error: { message: 'Account has been deactivated' } };
        }

        setAppUser(userData);
        
        // Show password change reminder if needed
        if (userData.must_change_password) {
          toast({
            title: "Password Change Required",
            description: "Please change your password using the user menu.",
            variant: "default",
          });
        }
      }

      return { error: null };
    } catch (error) {
      console.error('Unexpected sign in error:', error);
      return { error: { message: 'An unexpected error occurred' } };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setAppUser(null);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) {
        return { error };
      }

      // Update the must_change_password flag
      if (appUser && user) {
        await supabase
          .from('app_users')
          .update({ must_change_password: false })
          .eq('auth_user_id', user.id);
        
        setAppUser(prev => prev ? { ...prev, must_change_password: false } : null);
      }

      return { error: null };
    } catch (error) {
      console.error('Password update error:', error);
      return { error: { message: 'An unexpected error occurred' } };
    }
  };

  const hasRole = (role: string | string[]) => {
    if (!appUser || !appUser.is_active) return false;
    
    if (Array.isArray(role)) {
      return role.includes(appUser.role);
    }
    
    return appUser.role === role;
  };

  const isAdmin = () => {
    return hasRole(['head_admin', 'admin']);
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Defer fetchAppUser to prevent deadlock during password updates
          setTimeout(async () => {
            try {
              const userData = await fetchAppUser(session.user);
              setAppUser(userData);
            } catch (error) {
              console.error('Error fetching app user in auth state change:', error);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setAppUser(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Use consistent deferred approach for initial session
        setTimeout(async () => {
          try {
            const userData = await fetchAppUser(session.user);
            setAppUser(userData);
          } catch (error) {
            console.error('Error fetching app user in initial session:', error);
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    user,
    session,
    appUser,
    loading,
    signIn,
    signOut,
    updatePassword,
    hasRole,
    isAdmin,
    refetchAppUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};