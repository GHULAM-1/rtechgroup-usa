import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface OrgSettings {
  id?: string;
  org_id: string;
  company_name: string;
  timezone: string;
  currency_code: string;
  date_format: string;
  logo_url?: string;
  reminder_due_today: boolean;
  reminder_overdue_1d: boolean;
  reminder_overdue_multi: boolean;
  reminder_due_soon_2d: boolean;
  tests_last_run_dashboard?: string;
  tests_last_result_dashboard?: any;
  tests_last_run_rental?: string;
  tests_last_result_rental?: any;
  tests_last_run_finance?: string;
  tests_last_result_finance?: any;
  created_at?: string;
  updated_at?: string;
}

// Custom hook for organisation settings
export const useOrgSettings = () => {
  const queryClient = useQueryClient();

  // Fetch settings query with fallback defaults
  const {
    data: settings,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['org-settings'],
    queryFn: async (): Promise<OrgSettings> => {
      console.log('Fetching org settings...');
      
      try {
        const { data, error } = await supabase.functions.invoke('settings', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (error) {
          console.error('Settings edge function error:', error);
          throw new Error(`Settings API error: ${error.message}`);
        }

        if (!data) {
          console.error('No data returned from settings function');
          throw new Error('No settings data received');
        }

        console.log('Settings loaded successfully:', data);
        return data;
      } catch (err) {
        console.error('Settings fetch failed:', err);
        throw err;
      }
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: false, // Disable auto-refetch to avoid spam
    retry: (failureCount, error) => {
      console.log(`Settings fetch retry ${failureCount}:`, error);
      return failureCount < 2; // Only retry twice
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
    // Add fallback default settings if fetch fails
    placeholderData: {
      org_id: 'placeholder',
      company_name: 'Fleet Management System',
      timezone: 'America/New_York',
      currency_code: 'USD',
      date_format: 'MM/DD/YYYY',
      reminder_due_today: true,
      reminder_overdue_1d: true,
      reminder_overdue_multi: true,
      reminder_due_soon_2d: false,
    } as OrgSettings,
  });

  // Update settings mutation
  const updateSettingsMutation = useMutation({
    mutationFn: async (updates: Partial<OrgSettings>): Promise<OrgSettings> => {
      const { data, error } = await supabase.functions.invoke('settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: updates,
      });

      if (error) {
        console.error('Settings update error:', error);
        throw new Error(`Failed to update settings: ${error.message}`);
      }

      return data;
    },
    onSuccess: (data) => {
      // Update the cache with new data
      queryClient.setQueryData(['org-settings'], data);
      
      // Invalidate related queries that might depend on settings
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      
      toast({
        title: "Settings Updated",
        description: "Organisation settings have been updated successfully.",
      });
    },
    onError: (error: Error) => {
      console.error('Settings update error:', error);
      toast({
        title: "Error",
        description: `Failed to update settings: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Convenience methods for specific updates
  const updateCompanyProfile = (profile: {
    company_name: string;
    timezone: string;
    currency_code: string;
    date_format: string;
    logo_url?: string;
  }) => {
    return updateSettingsMutation.mutate(profile);
  };

  const updateReminderSettings = (reminders: {
    reminder_due_today?: boolean;
    reminder_overdue_1d?: boolean;
    reminder_overdue_multi?: boolean;
    reminder_due_soon_2d?: boolean;
  }) => {
    return updateSettingsMutation.mutate(reminders);
  };

  const toggleReminder = (reminderType: keyof Pick<OrgSettings, 'reminder_due_today' | 'reminder_overdue_1d' | 'reminder_overdue_multi' | 'reminder_due_soon_2d'>) => {
    if (!settings) return;
    
    return updateSettingsMutation.mutate({
      [reminderType]: !settings[reminderType]
    });
  };

  return {
    settings,
    isLoading,
    error,
    refetch,
    updateSettings: updateSettingsMutation.mutate,
    updateCompanyProfile,
    updateReminderSettings,
    toggleReminder,
    isUpdating: updateSettingsMutation.isPending,
  };
};