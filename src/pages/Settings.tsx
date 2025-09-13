import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Settings as SettingsIcon, Building2, Bell, Zap, Upload, Save } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface CompanyProfile {
  company_name: string;
  logo_url: string | null;
  timezone: string;
  currency: string;
  date_format: string;
}

interface ReminderSetting {
  reminder_type: string;
  enabled: boolean;
  delivery_mode: string;
}

const Settings = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('company');

  // Company Profile Settings
  const { data: companyProfile, isLoading: loadingProfile } = useQuery({
    queryKey: ['company-profile'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('setting_key', 'company_profile')
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      return (data?.setting_value as unknown as CompanyProfile) || {
        company_name: 'RTECHGROUP UK Fleet Management',
        logo_url: null,
        timezone: 'Europe/London',
        currency: 'GBP',
        date_format: 'DD/MM/YYYY'
      };
    },
  });

  // Reminder Settings
  const { data: reminderSettings, isLoading: loadingReminders } = useQuery({
    queryKey: ['reminder-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminder_settings')
        .select('*')
        .eq('setting_key', 'reminder_types');

      if (error && error.code !== 'PGRST116') throw error;
      
      return (data?.[0]?.setting_value as unknown as ReminderSetting[]) || [
        { reminder_type: 'Due', enabled: true, delivery_mode: 'In-App Only' },
        { reminder_type: 'Overdue1', enabled: true, delivery_mode: 'In-App Only' },
        { reminder_type: 'OverdueN', enabled: true, delivery_mode: 'In-App Only' },
        { reminder_type: 'Upcoming', enabled: false, delivery_mode: 'In-App Only' },
      ];
    },
  });

  // Update Company Profile
  const updateCompanyProfile = useMutation({
    mutationFn: async (profile: CompanyProfile) => {
      const { data, error } = await supabase
        .from('reminder_settings')
        .upsert({
          setting_key: 'company_profile',
          setting_value: profile as any,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-profile'] });
      toast({
        title: "Settings Updated",
        description: "Company profile has been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update company profile.",
        variant: "destructive",
      });
    },
  });

  // Update Reminder Settings
  const updateReminderSettings = useMutation({
    mutationFn: async (settings: ReminderSetting[]) => {
      const { data, error } = await supabase
        .from('reminder_settings')
        .upsert({
          setting_key: 'reminder_types',
          setting_value: settings as any,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminder-settings'] });
      toast({
        title: "Settings Updated",
        description: "Reminder settings have been updated successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to update reminder settings.",
        variant: "destructive",
      });
    },
  });

  const handleCompanyProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const profile: CompanyProfile = {
      company_name: formData.get('company_name') as string,
      logo_url: companyProfile?.logo_url || null,
      timezone: formData.get('timezone') as string,
      currency: formData.get('currency') as string,
      date_format: formData.get('date_format') as string,
    };

    updateCompanyProfile.mutate(profile);
  };

  const handleReminderToggle = (reminderType: string, enabled: boolean) => {
    if (!reminderSettings) return;
    
    const updatedSettings = reminderSettings.map(setting =>
      setting.reminder_type === reminderType
        ? { ...setting, enabled }
        : setting
    );
    
    updateReminderSettings.mutate(updatedSettings);
  };

  if (loadingProfile || loadingReminders) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your fleet management system
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Profile
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Reminders
          </TabsTrigger>
          <TabsTrigger value="integrations" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Integrations
          </TabsTrigger>
        </TabsList>

        {/* Company Profile Tab */}
        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Company Profile
              </CardTitle>
              <CardDescription>
                Configure your company information and regional settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCompanyProfileSubmit} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name</Label>
                    <Input
                      id="company_name"
                      name="company_name"
                      defaultValue={companyProfile?.company_name}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select name="timezone" defaultValue={companyProfile?.timezone}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                        <SelectItem value="Europe/Paris">Europe/Paris (CET)</SelectItem>
                        <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                        <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select name="currency" defaultValue={companyProfile?.currency}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                        <SelectItem value="USD">US Dollar (USD)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_format">Date Format</Label>
                    <Select name="date_format" defaultValue={companyProfile?.date_format}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select date format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                        <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div>
                    <Label htmlFor="logo">Company Logo</Label>
                    <p className="text-sm text-muted-foreground mb-3">
                      Upload your company logo (coming soon)
                    </p>
                    <Button type="button" variant="outline" disabled>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button type="submit" disabled={updateCompanyProfile.isPending}>
                    <Save className="h-4 w-4 mr-2" />
                    {updateCompanyProfile.isPending ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reminders Tab */}
        <TabsContent value="reminders">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Reminder Settings
              </CardTitle>
              <CardDescription>
                Configure when and how payment reminders are sent
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {reminderSettings?.map((setting) => (
                <div key={setting.reminder_type} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">
                        {setting.reminder_type === 'Due' && 'Payment Due Today'}
                        {setting.reminder_type === 'Overdue1' && 'Payment Overdue (1 Day)'}
                        {setting.reminder_type === 'OverdueN' && 'Payment Overdue (Multiple Days)'}
                        {setting.reminder_type === 'Upcoming' && 'Payment Due Soon (2 Days)'}
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        {setting.delivery_mode}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {setting.reminder_type === 'Due' && 'Send reminders for payments due today'}
                      {setting.reminder_type === 'Overdue1' && 'Send reminders 1 day after payment due date'}
                      {setting.reminder_type === 'OverdueN' && 'Send reminders for payments overdue by multiple days'}
                      {setting.reminder_type === 'Upcoming' && 'Send reminders 2 days before payment due date'}
                    </p>
                  </div>
                  <Switch
                    checked={setting.enabled}
                    onCheckedChange={(enabled) => handleReminderToggle(setting.reminder_type, enabled)}
                  />
                </div>
              ))}

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Delivery Mode</h4>
                <p className="text-sm text-muted-foreground">
                  Currently set to "In-App Only". Email and WhatsApp delivery options will be available in future updates.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Integrations Tab */}
        <TabsContent value="integrations">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  Integrations
                </CardTitle>
                <CardDescription>
                  Connect external services to enhance your fleet management
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* WhatsApp Business */}
                <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-bold">W</span>
                      </div>
                      <div>
                        <h4 className="font-medium">WhatsApp Business</h4>
                        <p className="text-sm text-muted-foreground">
                          Send payment reminders via WhatsApp
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Coming Soon</Badge>
                    <Button variant="outline" disabled>
                      Configure
                    </Button>
                  </div>
                </div>

                {/* Email */}
                <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-bold">@</span>
                      </div>
                      <div>
                        <h4 className="font-medium">Email Notifications</h4>
                        <p className="text-sm text-muted-foreground">
                          Send payment reminders and receipts via email
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">Coming Soon</Badge>
                    <Button variant="outline" disabled>
                      Configure
                    </Button>
                  </div>
                </div>

                <div className="bg-muted/50 p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Integration Roadmap</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• WhatsApp Business API integration</li>
                    <li>• Email automation with templates</li>
                    <li>• SMS notifications</li>
                    <li>• Accounting software integration</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;