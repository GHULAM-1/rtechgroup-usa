import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Check, Clock, X, Eye, Filter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ReminderEvent {
  id: string;
  charge_id: string;
  customer_id: string;
  rental_id: string | null;
  vehicle_id: string;
  reminder_type: string;
  status: string;
  message_preview: string;
  created_at: string;
  delivered_at: string | null;
  snoozed_until: string | null;
  customers: { name: string };
  vehicles: { reg: string };
}

const RemindersPage = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = searchParams.get('filter') || 'all';
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: reminders, isLoading } = useQuery({
    queryKey: ["reminders-list", filter],
    queryFn: async () => {
      let query = supabase
        .from("reminder_events")
        .select(`
          *,
          customers(name),
          vehicles(reg)
        `)
        .order("created_at", { ascending: false });

      // Apply filters
      if (filter === 'delivered') {
        query = query.eq('status', 'Delivered');
      } else if (filter === 'done') {
        query = query.eq('status', 'Done');
      } else if (filter === 'snoozed') {
        query = query.eq('status', 'Snoozed');
      } else if (filter === 'dismissed') {
        query = query.eq('status', 'Dismissed');
      } else if (filter === 'overdue') {
        query = query.in('reminder_type', ['Overdue1', 'OverdueN']);
      } else if (filter === 'due') {
        query = query.eq('reminder_type', 'Due');
      } else if (filter === 'upcoming') {
        query = query.eq('reminder_type', 'Upcoming');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as ReminderEvent[];
    },
  });

  const updateReminderStatus = useMutation({
    mutationFn: async ({ id, status, snoozeDays }: { id: string; status: string; snoozeDays?: number }) => {
      const updateData: any = { status };
      
      if (snoozeDays && status === 'Snoozed') {
        const snoozeDate = new Date();
        snoozeDate.setDate(snoozeDate.getDate() + snoozeDays);
        updateData.snoozed_until = snoozeDate.toISOString();
      }

      const { error } = await supabase
        .from("reminder_events")
        .update(updateData)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminders-list"] });
      toast({
        title: "Reminder Updated",
        description: "Reminder status has been updated successfully.",
      });
    },
    onError: (error) => {
      console.error("Error updating reminder:", error);
      toast({
        title: "Error",
        description: "Failed to update reminder. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleOpenRental = (reminder: ReminderEvent) => {
    if (reminder.rental_id) {
      navigate(`/rentals/${reminder.rental_id}`);
    } else {
      // Check if it's a fine charge by looking at ledger entry
      navigate(`/charges?filter=outstanding`);
    }
  };

  const handleSnooze = (id: string, days: number) => {
    updateReminderStatus.mutate({ id, status: 'Snoozed', snoozeDays: days });
  };

  const deliveredReminders = reminders?.filter(r => r.status === 'Delivered') || [];
  const doneReminders = reminders?.filter(r => r.status === 'Done') || [];
  const snoozedReminders = reminders?.filter(r => r.status === 'Snoozed') || [];
  const overdueReminders = reminders?.filter(r => r.reminder_type.startsWith('Overdue')) || [];

  const renderRemindersTable = (remindersData: ReminderEvent[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Type</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {remindersData.map((reminder) => (
            <TableRow key={reminder.id} className="hover:bg-muted/50">
              <TableCell>
                <Badge 
                  variant={
                    reminder.reminder_type === 'Due' ? 'destructive' :
                    reminder.reminder_type === 'Upcoming' ? 'secondary' :
                    reminder.reminder_type.startsWith('Overdue') ? 'destructive' : 'outline'
                  }
                >
                  {reminder.reminder_type}
                </Badge>
              </TableCell>
              <TableCell className="font-medium">{reminder.customers?.name}</TableCell>
              <TableCell>{reminder.vehicles?.reg}</TableCell>
              <TableCell className="max-w-xs truncate">{reminder.message_preview}</TableCell>
              <TableCell>{new Date(reminder.created_at).toLocaleDateString()}</TableCell>
              <TableCell>
                <Badge variant={reminder.status === 'Done' ? 'default' : 'secondary'}>
                  {reminder.status}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenRental(reminder)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Open
                  </Button>
                  
                  {reminder.status === 'Delivered' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateReminderStatus.mutate({ id: reminder.id, status: 'Done' })}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Done
                      </Button>
                      
                      <Select onValueChange={(value) => handleSnooze(reminder.id, parseInt(value))}>
                        <SelectTrigger className="w-20 h-8">
                          <Clock className="h-4 w-4" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1d</SelectItem>
                          <SelectItem value="3">3d</SelectItem>
                          <SelectItem value="7">7d</SelectItem>
                        </SelectContent>
                      </Select>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateReminderStatus.mutate({ id: reminder.id, status: 'Dismissed' })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  if (isLoading) {
    return <div>Loading reminders...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reminders</h1>
          <p className="text-muted-foreground">
            Manage payment reminders and notifications
            {filter !== 'all' && ` - ${filter.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}`}
          </p>
        </div>
        <div className="flex gap-2">
          {filter !== 'all' && (
            <Button variant="outline" onClick={() => setSearchParams({})}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filter
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40 transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Due Today</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {reminders?.filter(r => r.reminder_type === 'Due' && r.status === 'Delivered').length || 0}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40 transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Overdue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {overdueReminders.filter(r => r.status === 'Delivered').length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40 transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Snoozed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {snoozedReminders.length}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40 transition-all duration-200 cursor-pointer hover:shadow-md">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {doneReminders.length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reminders Tabs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            Payment Reminders
          </CardTitle>
          <CardDescription>
            View and manage payment reminders by status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="delivered" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="delivered">
                Active ({deliveredReminders.length})
              </TabsTrigger>
              <TabsTrigger value="overdue">
                Overdue ({overdueReminders.filter(r => r.status === 'Delivered').length})
              </TabsTrigger>
              <TabsTrigger value="snoozed">
                Snoozed ({snoozedReminders.length})
              </TabsTrigger>
              <TabsTrigger value="done">
                Done ({doneReminders.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="delivered" className="mt-6">
              {deliveredReminders.length > 0 ? (
                renderRemindersTable(deliveredReminders)
              ) : (
                <div className="text-center py-8">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No active reminders</h3>
                  <p className="text-muted-foreground">All reminders have been handled</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="overdue" className="mt-6">
              {overdueReminders.filter(r => r.status === 'Delivered').length > 0 ? (
                renderRemindersTable(overdueReminders.filter(r => r.status === 'Delivered'))
              ) : (
                <div className="text-center py-8">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No overdue reminders</h3>
                  <p className="text-muted-foreground">No overdue payment reminders found</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="snoozed" className="mt-6">
              {snoozedReminders.length > 0 ? (
                renderRemindersTable(snoozedReminders)
              ) : (
                <div className="text-center py-8">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No snoozed reminders</h3>
                  <p className="text-muted-foreground">No reminders are currently snoozed</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="done" className="mt-6">
              {doneReminders.length > 0 ? (
                renderRemindersTable(doneReminders)
              ) : (
                <div className="text-center py-8">
                  <Check className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No completed reminders</h3>
                  <p className="text-muted-foreground">No reminders have been marked as done</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default RemindersPage;