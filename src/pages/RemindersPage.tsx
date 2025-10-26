import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, Pause, X, ExternalLink, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface ReminderEvent {
  id: string;
  charge_id: string;
  customer_id: string;
  rental_id: string;
  vehicle_id: string;
  reminder_type: string;
  status: string;
  message_preview: string;
  created_at: string;
  delivered_at: string;
  snoozed_until: string;
  customers: { name: string };
  vehicles: { reg: string };
  ledger_entries: { amount: number; remaining_amount: number; due_date: string };
}

export default function RemindersPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch reminders with related data
  const { data: reminders = [], isLoading, refetch } = useQuery({
    queryKey: ["reminder-events", statusFilter, typeFilter, customerSearch],
    queryFn: async () => {
      let query = supabase
        .from("reminder_events")
        .select(`
          *,
          customers(name),
          vehicles(reg),
          ledger_entries(amount, remaining_amount, due_date)
        `)
        .order("created_at", { ascending: false });

      if (statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }
      if (typeFilter !== "all") {
        query = query.eq("reminder_type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Filter by customer search if provided
      if (customerSearch) {
        return data.filter(reminder => 
          reminder.customers?.name.toLowerCase().includes(customerSearch.toLowerCase())
        );
      }

      return data;
    },
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });

  // Get reminder counts by status
  const statusCounts = reminders.reduce((acc, reminder) => {
    acc[reminder.status] = (acc[reminder.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Update reminder status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ ids, status, snoozedUntil }: { ids: string[]; status: string; snoozedUntil?: string }) => {
      const updates: any = { status };
      if (snoozedUntil) {
        updates.snoozed_until = snoozedUntil;
      }

      const { error } = await supabase
        .from("reminder_events")
        .update(updates)
        .in("id", ids);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reminder-events"] });
      setSelectedIds([]);
      toast({ title: "Reminders updated successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Error updating reminders", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const handleSnooze = (ids: string[], days: number) => {
    const snoozedUntil = new Date();
    snoozedUntil.setDate(snoozedUntil.getDate() + days);
    updateStatusMutation.mutate({ 
      ids, 
      status: "Snoozed", 
      snoozedUntil: snoozedUntil.toISOString() 
    });
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      "Queued": "secondary",
      "Delivered": "default",
      "Snoozed": "outline",
      "Dismissed": "secondary",
      "Done": "default"
    } as const;
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || "secondary"}>
        {status}
      </Badge>
    );
  };

  const getTypeColor = (type: string) => {
    if (type === "Upcoming") return "text-blue-600";
    if (type === "Due") return "text-orange-600";
    if (type.startsWith("Overdue")) return "text-red-600";
    return "text-gray-600";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reminders</h1>
          <p className="text-muted-foreground">
            In-app reminders for due payments and charges
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Status Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.Delivered || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Snoozed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.Snoozed || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Done</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{statusCounts.Done || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reminders.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="Delivered">Delivered</SelectItem>
                  <SelectItem value="Snoozed">Snoozed</SelectItem>
                  <SelectItem value="Done">Done</SelectItem>
                  <SelectItem value="Dismissed">Dismissed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Upcoming">Upcoming</SelectItem>
                  <SelectItem value="Due">Due</SelectItem>
                  <SelectItem value="Overdue1">Overdue (1 day)</SelectItem>
                  <SelectItem value="Overdue2">Overdue (1 week)</SelectItem>
                  <SelectItem value="Overdue3">Overdue (2 weeks)</SelectItem>
                  <SelectItem value="Overdue4">Overdue (3 weeks)</SelectItem>
                  <SelectItem value="Overdue5">Overdue (4 weeks)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Customer</label>
              <Input
                placeholder="Search customers..."
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedIds.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-2">
              <Button
                onClick={() => updateStatusMutation.mutate({ ids: selectedIds, status: "Done" })}
                size="sm"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Done ({selectedIds.length})
              </Button>
              <Button
                onClick={() => handleSnooze(selectedIds, 1)}
                variant="outline"
                size="sm"
              >
                Snooze 1 Day
              </Button>
              <Button
                onClick={() => handleSnooze(selectedIds, 7)}
                variant="outline"
                size="sm"
              >
                Snooze 7 Days
              </Button>
              <Button
                onClick={() => updateStatusMutation.mutate({ ids: selectedIds, status: "Dismissed" })}
                variant="outline"
                size="sm"
              >
                <X className="h-4 w-4 mr-2" />
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reminders Table */}
      <Card>
        <CardHeader>
          <CardTitle>Reminder Events</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading reminders...</div>
          ) : reminders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No reminders found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === reminders.length}
                      onChange={(e) => {
                        setSelectedIds(e.target.checked ? reminders.map(r => r.id) : []);
                      }}
                      className="rounded"
                    />
                  </TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Message Preview</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reminders.map((reminder) => (
                  <TableRow key={reminder.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(reminder.id)}
                        onChange={(e) => {
                          setSelectedIds(e.target.checked 
                            ? [...selectedIds, reminder.id]
                            : selectedIds.filter(id => id !== reminder.id)
                          );
                        }}
                        className="rounded"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      {reminder.customers?.name}
                    </TableCell>
                    <TableCell>{reminder.vehicles?.reg}</TableCell>
                    <TableCell>
                      <span className={getTypeColor(reminder.reminder_type)}>
                        {reminder.reminder_type}
                      </span>
                    </TableCell>
                    <TableCell>
                      ${reminder.ledger_entries?.remaining_amount || reminder.ledger_entries?.amount}
                    </TableCell>
                    <TableCell>
                      {new Date(reminder.ledger_entries?.due_date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(reminder.status)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {reminder.message_preview}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          onClick={() => navigate(`/rentals/${reminder.rental_id}`)}
                          variant="ghost"
                          size="sm"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        {reminder.status !== "Done" && (
                          <>
                            <Button
                              onClick={() => updateStatusMutation.mutate({ ids: [reminder.id], status: "Done" })}
                              variant="ghost"
                              size="sm"
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              onClick={() => handleSnooze([reminder.id], 1)}
                              variant="ghost"
                              size="sm"
                            >
                              <Pause className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}