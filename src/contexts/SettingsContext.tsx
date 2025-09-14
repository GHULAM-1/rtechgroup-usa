import React, { createContext, useContext, ReactNode } from 'react';
import { useOrgSettings, OrgSettings } from '@/hooks/useOrgSettings';

interface SettingsContextType {
  settings: OrgSettings | undefined;
  isLoading: boolean;
  error: Error | null;
  updateSettings: (updates: Partial<OrgSettings>) => void;
  updateCompanyProfile: (profile: {
    company_name: string;
    timezone: string;
    currency_code: string;
    date_format: string;
    logo_url?: string;
  }) => void;
  updateReminderSettings: (reminders: {
    reminder_due_today?: boolean;
    reminder_overdue_1d?: boolean;
    reminder_overdue_multi?: boolean;
    reminder_due_soon_2d?: boolean;
  }) => void;
  toggleReminder: (reminderType: keyof Pick<OrgSettings, 'reminder_due_today' | 'reminder_overdue_1d' | 'reminder_overdue_multi' | 'reminder_due_soon_2d'>) => void;
  isUpdating: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    settings,
    isLoading,
    error,
    updateSettings,
    updateCompanyProfile,
    updateReminderSettings,
    toggleReminder,
    isUpdating,
  } = useOrgSettings();

  const value: SettingsContextType = {
    settings,
    isLoading,
    error,
    updateSettings,
    updateCompanyProfile,
    updateReminderSettings,
    toggleReminder,
    isUpdating,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};