import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface RateLimitStatus {
  allowed: boolean;
  attemptsRemaining: number;
  lockoutMinutes: number;
  nextAttemptAt?: string;
}

export function useRateLimiting() {
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus>({
    allowed: true,
    attemptsRemaining: 5,
    lockoutMinutes: 0
  });

  const checkRateLimit = useCallback(async (email: string): Promise<RateLimitStatus> => {
    try {
      const { data, error } = await supabase.functions.invoke('auth-rate-limit', {
        method: 'GET',
        body: new URLSearchParams({ email: email.toLowerCase() })
      });

      if (error) throw error;

      const status = data as RateLimitStatus;
      setRateLimitStatus(status);
      return status;
    } catch (error) {
      console.error('Rate limit check failed:', error);
      // Fail open - allow login attempt
      const fallbackStatus: RateLimitStatus = {
        allowed: true,
        attemptsRemaining: 5,
        lockoutMinutes: 0
      };
      setRateLimitStatus(fallbackStatus);
      return fallbackStatus;
    }
  }, []);

  const recordLoginAttempt = useCallback(async (email: string, success: boolean): Promise<RateLimitStatus> => {
    try {
      const { data, error } = await supabase.functions.invoke('auth-rate-limit', {
        body: {
          email: email.toLowerCase(),
          ipAddress: '', // Will be determined server-side
          success
        }
      });

      if (error) throw error;

      const status = data as RateLimitStatus;
      setRateLimitStatus(status);
      return status;
    } catch (error) {
      console.error('Failed to record login attempt:', error);
      // Return current status on error
      return rateLimitStatus;
    }
  }, [rateLimitStatus]);

  const getRateLimitMessage = useCallback((): string | null => {
    if (!rateLimitStatus.allowed && rateLimitStatus.lockoutMinutes > 0) {
      return `Too many failed attempts. Please try again in ${rateLimitStatus.lockoutMinutes} minute${rateLimitStatus.lockoutMinutes > 1 ? 's' : ''}`;
    }
    if (rateLimitStatus.attemptsRemaining <= 2 && rateLimitStatus.attemptsRemaining > 0) {
      return `${rateLimitStatus.attemptsRemaining} attempt${rateLimitStatus.attemptsRemaining > 1 ? 's' : ''} remaining before temporary lockout`;
    }
    return null;
  }, [rateLimitStatus]);

  return {
    rateLimitStatus,
    checkRateLimit,
    recordLoginAttempt,
    getRateLimitMessage,
    isLocked: !rateLimitStatus.allowed && rateLimitStatus.lockoutMinutes > 0
  };
}