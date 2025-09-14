import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Settings as SettingsIcon, Building2, Bell, Zap, Upload, Save, Loader2, Database, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useOrgSettings } from '@/hooks/useOrgSettings';
import { CompanyLogoUpload } from '@/components/CompanyLogoUpload';
import { TestingCards } from '@/components/TestingCards';

const Settings = () => {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('company');
  const [isBackfilling, setIsBackfilling] = useState(false);
  
  // Handle URL tab parameter
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['company', 'reminders', 'maintenance', 'testing', 'integrations'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);
  
  // Use the new centralized settings hook
  const {
    settings,
    isLoading,
    error,
    updateCompanyProfile,
    toggleReminder,
    isUpdating
  } = useOrgSettings();

  // Maintenance run tracking
  const { data: maintenanceRuns } = useQuery({
    queryKey: ['maintenance-runs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('maintenance_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const handleCompanyProfileSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const profile = {
      company_name: formData.get('company_name') as string,
      timezone: formData.get('timezone') as string,
      currency_code: formData.get('currency') as string,
      date_format: formData.get('date_format') as string,
      logo_url: settings?.logo_url || undefined,
    };

    updateCompanyProfile(profile);
  };

  const handleBackfillPayments = async () => {
    setIsBackfilling(true);
    try {
      // Record maintenance run start
      const { data: runRecord, error: insertError } = await supabase
        .from('maintenance_runs')
        .insert({
          operation_type: 'payment_reapplication',
          status: 'running',
          started_by: 'settings_manual'
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const startTime = Date.now();
      const { data, error } = await supabase.rpc("reapply_all_payments_v2");
      const duration = Math.floor((Date.now() - startTime) / 1000);
      
      if (error) {
        // Update run record with error
        await supabase
          .from('maintenance_runs')
          .update({
            status: 'failed',
            error_message: error.message,
            duration_seconds: duration,
            completed_at: new Date().toISOString()
          })
          .eq('id', runRecord.id);
        
        throw error;
      }

      // Update run record with success
      await supabase
        .from('maintenance_runs')
        .update({
          status: 'completed',
          payments_processed: data[0]?.payments_processed || 0,
          customers_affected: data[0]?.customers_affected || 0,
          revenue_recalculated: data[0]?.total_credit_applied || 0,
          duration_seconds: duration,
          completed_at: new Date().toISOString()
        })
        .eq('id', runRecord.id);
      
      toast({
        title: "Maintenance Complete",
        description: `Processed ${data[0]?.payments_processed || 0} payments, affected ${data[0]?.customers_affected || 0} customers, applied £${data[0]?.total_credit_applied?.toFixed(2) || '0.00'} in credit. Duration: ${duration}s`,
      });
      
      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-balance"] });
      queryClient.invalidateQueries({ queryKey: ["maintenance-runs"] });
      
    } catch (error: any) {
      console.error("Backfill error:", error);
      toast({
        title: "Maintenance Failed",
        description: `Failed to reapply payments: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsBackfilling(false);
    }
  };

  // Show error state with fallback
  if (error && !settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure your fleet management system
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <div>
                <h3 className="font-medium">Failed to load settings</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {error.message || 'Unable to connect to settings service'}
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => window.location.reload()}
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading && !settings) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Configure your fleet management system
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="p-6 flex items-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Loading settings...</span>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
            <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your fleet management system
          </p>
        </div>
      </div>

      {/* Settings Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="company" className="flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Company Profile
          </TabsTrigger>
          <TabsTrigger value="reminders" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Reminders
          </TabsTrigger>
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            Maintenance
          </TabsTrigger>
          <TabsTrigger value="testing" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Testing
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
                      defaultValue={settings?.company_name}
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select name="timezone" defaultValue={settings?.timezone}>
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
                    <Select name="currency" defaultValue={settings?.currency_code}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">British Pound (GBP)</SelectItem>
                        <SelectItem value="EUR">Euro (EUR)</SelectItem>
                        
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="date_format">Date Format</Label>
                    <Select name="date_format" defaultValue={settings?.date_format}>
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
                  <Button type="submit" disabled={isUpdating}>
                    <Save className="h-4 w-4 mr-2" />
                    {isUpdating ? 'Saving...' : 'Save Changes'}
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
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Payment Due Today</h4>
                      <Badge variant="secondary" className="text-xs">In-App Only</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send reminders for payments due today
                    </p>
                  </div>
                  <Switch
                    checked={settings?.reminder_due_today ?? true}
                    onCheckedChange={() => toggleReminder('reminder_due_today')}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Payment Overdue (1 Day)</h4>
                      <Badge variant="secondary" className="text-xs">In-App Only</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send reminders 1 day after payment due date
                    </p>
                  </div>
                  <Switch
                    checked={settings?.reminder_overdue_1d ?? true}
                    onCheckedChange={() => toggleReminder('reminder_overdue_1d')}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Payment Overdue (Multiple Days)</h4>
                      <Badge variant="secondary" className="text-xs">In-App Only</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send reminders for payments overdue by multiple days
                    </p>
                  </div>
                  <Switch
                    checked={settings?.reminder_overdue_multi ?? true}
                    onCheckedChange={() => toggleReminder('reminder_overdue_multi')}
                    disabled={isUpdating}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">Payment Due Soon (2 Days)</h4>
                      <Badge variant="secondary" className="text-xs">In-App Only</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Send reminders 2 days before payment due date
                    </p>
                  </div>
                  <Switch
                    checked={settings?.reminder_due_soon_2d ?? false}
                    onCheckedChange={() => toggleReminder('reminder_due_soon_2d')}
                    disabled={isUpdating}
                  />
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Delivery Mode</h4>
                <p className="text-sm text-muted-foreground">
                  Currently set to "In-App Only". Email and WhatsApp delivery options will be available in future updates.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Maintenance Tab */}
        <TabsContent value="maintenance">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Payment Maintenance
              </CardTitle>
              <CardDescription>
                Tools to maintain payment data integrity and recompute balances.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Re-apply Credits & Recompute Balances</h4>
                  <p className="text-sm text-muted-foreground">
                    This will reprocess all payments using the latest auto-credit logic, 
                    recompute customer balances, rental totals, and vehicle P&L revenue. This is a safe operation that can be run multiple times.
                  </p>
                </div>
                
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" disabled={isBackfilling}>
                      {isBackfilling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isBackfilling ? 'Running...' : 'Run Maintenance'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-orange-500" />
                        Confirm Maintenance Operation
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        This will reprocess all payments and recompute balances. The operation is safe and can be run multiple times, but may take several minutes to complete.
                        
                        <div className="mt-3 p-3 bg-muted rounded text-sm">
                          <strong>What this does:</strong>
                          <ul className="list-disc list-inside mt-1 space-y-1">
                            <li>Resets all payment applications and P&L revenue entries</li>
                            <li>Reapplies all payments in chronological order using FIFO logic</li>
                            <li>Updates payment status (Applied/Credit/Partial) based on allocation</li>
                            <li>Recalculates customer balances and rental totals</li>
                          </ul>
                        </div>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleBackfillPayments}>
                        Run Maintenance
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                {maintenanceRuns && maintenanceRuns.length > 0 && (
                  <div className="mt-4">
                    <h5 className="font-medium mb-2">Recent Runs</h5>
                    <div className="space-y-2">
                      {maintenanceRuns.map((run) => (
                        <div key={run.id} className="text-xs p-2 bg-muted rounded flex justify-between">
                          <span>
                            {new Date(run.started_at).toLocaleString()} - {run.operation_type}
                          </span>
                          <Badge variant={
                            run.status === 'completed' ? 'default' : 
                            run.status === 'failed' ? 'destructive' : 'secondary'
                          } className="text-xs">
                            {run.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Testing Tab */}
        <TabsContent value="testing">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">System Tests</h2>
              <p className="text-muted-foreground">
                Run comprehensive tests to verify system integrity and calculations
              </p>
            </div>
            
            <TestingCards />
          </div>
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

export { Settings };
export default Settings;