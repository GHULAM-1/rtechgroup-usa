import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "./use-toast";

export interface Reminder {
  id: string;
  rule_code: string;
  object_type: 'Vehicle' | 'Rental' | 'Customer' | 'Fine' | 'Document';
  object_id: string;
  title: string;
  message: string;
  due_on: string;
  remind_on: string;
  severity: 'info' | 'warning' | 'critical';
  status: 'pending' | 'sent' | 'snoozed' | 'done' | 'dismissed' | 'expired';
  snooze_until?: string;
  last_sent_at?: string;
  context: any;
  created_at: string;
  updated_at: string;
}

export interface ReminderFilters {
  status?: string[];
  severity?: string[];
  object_type?: string[];
  rule_code?: string[];
  date_from?: string;
  date_to?: string;
}

export function useReminders(filters?: ReminderFilters) {
  return useQuery({
    queryKey: ['reminders', filters],
    queryFn: async () => {
      let query = supabase
        .from('reminders')
        .select('*')
        .order('severity', { ascending: false })
        .order('due_on', { ascending: true })
        .order('remind_on', { ascending: true });

      // If no status filter is applied, default to showing active reminders
      if (filters?.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      } else {
        // Default to showing active reminders (pending, sent, snoozed)
        query = query.in('status', ['pending', 'sent', 'snoozed']);
      }

      if (filters?.severity && filters.severity.length > 0) {
        query = query.in('severity', filters.severity);
      }

      if (filters?.object_type && filters.object_type.length > 0) {
        query = query.in('object_type', filters.object_type);
      }

      if (filters?.rule_code && filters.rule_code.length > 0) {
        query = query.in('rule_code', filters.rule_code);
      }

      if (filters?.date_from) {
        query = query.gte('due_on', filters.date_from);
      }

      if (filters?.date_to) {
        query = query.lte('due_on', filters.date_to);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching reminders:', error);
        throw new Error('Failed to fetch reminders');
      }

      return data as Reminder[];
    },
  });
}

export function useRemindersByObject(objectType: string, objectId: string) {
  return useQuery({
    queryKey: ['reminders', 'object', objectType, objectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reminders')
        .select('*')
        .eq('object_type', objectType)
        .eq('object_id', objectId)
        .in('status', ['pending', 'sent', 'snoozed'])
        .order('severity', { ascending: false })
        .order('due_on', { ascending: true });

      if (error) {
        console.error('Error fetching object reminders:', error);
        throw new Error('Failed to fetch reminders');
      }

      return data as Reminder[];
    },
  });
}

export function useReminderStats() {
  return useQuery({
    queryKey: ['reminder-stats'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Get counts for different reminder states
      const { data: pendingCount, error: pendingError } = await supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lte('remind_on', today);

      const { data: snoozedDueCount, error: snoozedError } = await supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'snoozed')
        .lte('snooze_until', today);

      const { data: criticalCount, error: criticalError } = await supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .eq('severity', 'critical')
        .in('status', ['pending', 'sent'])
        .lte('remind_on', today);

      const { data: totalActiveCount, error: totalError } = await supabase
        .from('reminders')
        .select('id', { count: 'exact', head: true })
        .in('status', ['pending', 'sent', 'snoozed']);

      if (pendingError || snoozedError || criticalError || totalError) {
        console.error('Error fetching reminder stats');
        throw new Error('Failed to fetch reminder stats');
      }

      const pendingDue = (pendingCount?.length || 0);
      const snoozedDue = (snoozedDueCount?.length || 0);
      const due = pendingDue + snoozedDue;

      return {
        total: totalActiveCount?.length || 0,
        due: due,
        critical: criticalCount?.length || 0,
        pending: pendingDue,
        snoozed: snoozedDue
      };
    },
  });
}

export function useReminderActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const updateReminderStatus = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      snoozeUntil, 
      note 
    }: { 
      id: string; 
      status: string; 
      snoozeUntil?: string; 
      note?: string;
    }) => {
      const updateData: any = { status };
      if (snoozeUntil) {
        updateData.snooze_until = snoozeUntil;
      }

      const { error } = await supabase
        .from('reminders')
        .update(updateData)
        .eq('id', id);

      if (error) {
        throw new Error('Failed to update reminder');
      }

      // Log the action
      await supabase
        .from('reminder_actions')
        .insert({
          reminder_id: id,
          action: status,
          note: note || `Reminder marked as ${status}`
        });

      return { id, status };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminder-stats'] });
      toast({
        title: "Success",
        description: "Reminder updated successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const markDone = (id: string, note?: string) => {
    return updateReminderStatus.mutate({ id, status: 'done', note });
  };

  const dismiss = (id: string, note?: string) => {
    return updateReminderStatus.mutate({ id, status: 'dismissed', note });
  };

  const snooze = (id: string, days: number, note?: string) => {
    const snoozeUntil = new Date();
    snoozeUntil.setDate(snoozeUntil.getDate() + days);
    const snoozeUntilStr = snoozeUntil.toISOString().split('T')[0];
    
    return updateReminderStatus.mutate({ 
      id, 
      status: 'snoozed', 
      snoozeUntil: snoozeUntilStr,
      note: note || `Snoozed for ${days} days`
    });
  };

  const bulkUpdate = useMutation({
    mutationFn: async ({ 
      ids, 
      action,
      snoozeUntil,
      note 
    }: { 
      ids: string[]; 
      action: string;
      snoozeUntil?: string;
      note?: string;
    }) => {
      const updateData: any = { status: action };
      if (snoozeUntil) {
        updateData.snooze_until = snoozeUntil;
      }

      const { error } = await supabase
        .from('reminders')
        .update(updateData)
        .in('id', ids);

      if (error) {
        throw new Error('Failed to update reminders');
      }

      // Log actions for each reminder
      const actions = ids.map(id => ({
        reminder_id: id,
        action: action,
        note: note || `Bulk ${action} operation`
      }));

      await supabase
        .from('reminder_actions')
        .insert(actions);

      return { ids, action };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminder-stats'] });
      toast({
        title: "Success",
        description: `Updated ${data.ids.length} reminders`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    markDone,
    dismiss,
    snooze,
    bulkUpdate,
    isLoading: updateReminderStatus.isPending || bulkUpdate.isPending
  };
}

export function useReminderGeneration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('reminders-generate');

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] });
      queryClient.invalidateQueries({ queryKey: ['reminder-stats'] });
      toast({
        title: "Success",
        description: `Generated ${data.generated} new reminders, expired ${data.expired} old ones`,
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
}