import { useState, useMemo, useEffect as React_useEffect } from "react";
import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Plus, Mail, Phone, Edit, Search, Building2, TrendingUp, ArrowUpDown, UserPlus } from "lucide-react";
import { AddLeadDialog } from "@/components/AddLeadDialog";
import { TruncatedCell } from "@/components/TruncatedCell";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  expected_value: number | null;
  follow_up_date: string | null;
  created_at: string;
  updated_at: string;
}

export default function Pipeline() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<keyof Lead>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [localLeads, setLocalLeads] = useState<Lead[]>([]);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Fetch leads
  const { data: leads, isLoading, error } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Lead[];
    },
  });

  // Sync local state with fetched data
  React_useEffect(() => {
    if (leads) {
      setLocalLeads(leads);
    }
  }, [leads]);

  // Update lead status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ leadId, newStatus }: { leadId: string; newStatus: string }) => {
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;
    },
    onSuccess: (_, { leadId, newStatus }) => {
      // Update local state immediately
      setLocalLeads(prevLeads =>
        prevLeads.map(lead =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );

      toast({
        title: "Status updated",
        description: "Lead status has been updated successfully.",
      });

      setUpdatingLeadId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setUpdatingLeadId(null);
    },
  });


  const handleStatusChange = async (leadId: string, newStatus: string) => {
    const lead = localLeads.find(l => l.id === leadId);
    if (!lead) return;

    const currentStatus = lead.status;

    // Validate status transitions
    const invalidTransitions: Record<string, string[]> = {
      'Declined': ['New', 'In Progress'], // Can't go back from Declined
      'Completed': ['New', 'In Progress'], // Can't go back from Completed
    };

    if (invalidTransitions[currentStatus]?.includes(newStatus)) {
      toast({
        title: "Invalid Status Change",
        description: `Cannot change status from ${currentStatus} to ${newStatus}. Create a new lead instead.`,
        variant: "destructive",
      });
      return;
    }

    setUpdatingLeadId(leadId);

    try {
      // Update in database
      const { error } = await supabase
        .from("leads")
        .update({ status: newStatus })
        .eq("id", leadId);

      if (error) throw error;

      // Update local state
      setLocalLeads(prevLeads =>
        prevLeads.map(lead =>
          lead.id === leadId ? { ...lead, status: newStatus } : lead
        )
      );

      toast({
        title: "Status updated",
        description: "Lead status has been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    setIsAddDialogOpen(true);
  };

  const handleAddCustomer = async (lead: Lead) => {
    try {
      // Check if customer with same email or phone already exists
      let duplicateQuery = supabase.from("customers").select("id, name, email, phone");
      
      if (lead.email) {
        duplicateQuery = duplicateQuery.eq("email", lead.email);
      } else if (lead.phone) {
        duplicateQuery = duplicateQuery.eq("phone", lead.phone);
      }

      const { data: duplicates, error: duplicateError } = await duplicateQuery;

      if (duplicateError) {
        console.error('Error checking duplicates:', duplicateError);
      } else if (duplicates && duplicates.length > 0) {
        const duplicate = duplicates[0];
        toast({
          title: "Customer Already Exists",
          description: `A customer with this contact info already exists: ${duplicate.name}`,
          variant: "destructive",
        });
        return;
      }

      // Prepare customer data from lead
      const customerData = {
        type: lead.company ? "Company" : "Individual",
        customer_type: lead.company ? "Company" : "Individual",
        name: lead.name,
        email: lead.email || null,
        phone: lead.phone || null,
        whatsapp_opt_in: false,
        high_switcher: false,
        status: "Active",
      };

      // Insert customer
      const { data: newCustomer, error } = await supabase
        .from("customers")
        .insert(customerData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Customer Created",
        description: `${lead.name} has been added as a customer successfully.`,
      });

      // Refresh customers list if needed
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-balances-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-balances-enhanced"] });

    } catch (error: any) {
      console.error('Error creating customer:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create customer. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSort = (column: keyof Lead) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      'New': {
        backgroundColor: '#3B82F6',
        color: 'white',
        hoverColor: '#2563EB'
      },
      'In Progress': {
        backgroundColor: '#F59E0B',
        color: 'white',
        hoverColor: '#D97706'
      },
      'Completed': {
        backgroundColor: '#10B981',
        color: 'white',
        hoverColor: '#059669'
      },
      'Declined': {
        backgroundColor: '#EF4444',
        color: 'white',
        hoverColor: '#DC2626'
      },
    };

    const style = statusStyles[status as keyof typeof statusStyles] || statusStyles['New'];

    return (
      <Badge
        className="whitespace-nowrap"
        style={{
          backgroundColor: style.backgroundColor,
          color: style.color,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.8';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '1';
        }}
      >
        {status}
      </Badge>
    );
  };

  // Filter and sort leads
  const filteredAndSortedLeads = useMemo(() => {
    let filtered = localLeads || [];

    // Apply status filter
    if (filterStatus !== "all") {
      filtered = filtered.filter(lead => lead.status === filterStatus);
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      filtered = filtered.filter(lead =>
        lead.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        lead.email?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        lead.phone?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        lead.company?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        lead.source?.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      const aValue = a[sortColumn];
      const bValue = b[sortColumn];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [localLeads, filterStatus, debouncedSearchTerm, sortColumn, sortDirection]);

  // Calculate statistics
  const stats = useMemo(() => {
    const total = localLeads.length;
    const byStatus = localLeads.reduce((acc, lead) => {
      acc[lead.status] = (acc[lead.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const totalValue = localLeads.reduce((sum, lead) => sum + (lead.expected_value || 0), 0);

    return {
      total,
      new: byStatus['New'] || 0,
      inProgress: byStatus['In Progress'] || 0,
      completed: byStatus['Completed'] || 0,
      declined: byStatus['Declined'] || 0,
      totalValue,
      conversionRate: total > 0 ? ((byStatus['Completed'] || 0) / total * 100).toFixed(1) : '0',
    };
  }, [localLeads]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Error loading leads: {(error as Error).message}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pipeline</h1>
          <p className="text-muted-foreground">Manage your sales pipeline and track leads</p>
        </div>
        <Button onClick={() => {
          setEditingLead(null);
          setIsAddDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Lead
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Leads</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Leads</CardTitle>
            <Plus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.new}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalValue.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conversion Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.conversionRate}%</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="New">New</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Declined">Declined</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="w-full overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table style={{ tableLayout: 'fixed', minWidth: '1400px' }}>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 w-[150px]"
                  onClick={() => handleSort("name")}
                >
                  Name {sortColumn === "name" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="w-[250px]">Contact</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 w-[150px]"
                  onClick={() => handleSort("company")}
                >
                  Company {sortColumn === "company" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 w-[150px]"
                  onClick={() => handleSort("status")}
                >
                  Status {sortColumn === "status" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="w-[120px]">Source</TableHead>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50 w-[100px]"
                  onClick={() => handleSort("expected_value")}
                >
                  Value {sortColumn === "expected_value" && (sortDirection === "asc" ? "↑" : "↓")}
                </TableHead>
                <TableHead className="w-[130px]">Follow-up</TableHead>
                <TableHead className="w-[350px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                // Loading skeletons
                Array.from({ length: 5 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell className="w-[150px]"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="w-[250px]"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="w-[150px]"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="w-[150px]"><Skeleton className="h-6 w-24" /></TableCell>
                    <TableCell className="w-[120px]"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="w-[100px]"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="w-[130px]"><Skeleton className="h-4 w-full" /></TableCell>
                    <TableCell className="w-[350px]"><Skeleton className="h-8 w-32" /></TableCell>
                  </TableRow>
                ))
              ) : filteredAndSortedLeads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                filteredAndSortedLeads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell className="font-medium w-[150px]">
                      <TruncatedCell content={lead.name} maxLength={20} />
                    </TableCell>
                    <TableCell className="w-[250px]">
                      <div className="space-y-1">
                        {lead.email && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <TruncatedCell content={lead.email} maxLength={25} />
                          </div>
                        )}
                        {lead.phone && (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <Phone className="h-3 w-3 shrink-0" />
                            <TruncatedCell content={lead.phone} maxLength={15} />
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="w-[150px]">
                      {lead.company && (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                          <TruncatedCell content={lead.company} maxLength={20} />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="w-[150px]">
                      {getStatusBadge(lead.status)}
                    </TableCell>
                    <TableCell className="w-[120px]">
                      <TruncatedCell content={lead.source} maxLength={15} />
                    </TableCell>
                    <TableCell className="w-[100px] whitespace-nowrap">
                      {lead.expected_value && `$${lead.expected_value.toLocaleString()}`}
                    </TableCell>
                    <TableCell className="w-[130px] whitespace-nowrap">
                      {lead.follow_up_date && format(new Date(lead.follow_up_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="w-[350px]">
                      <div className="flex items-center gap-2 flex-nowrap">
                        <Select
                          value={lead.status}
                          onValueChange={(value) => handleStatusChange(lead.id, value)}
                          disabled={updatingLeadId === lead.id}
                        >
                          <SelectTrigger className="h-8 w-[130px] shrink-0" onClick={(e) => e.stopPropagation()}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent onClick={(e) => e.stopPropagation()}>
                            <SelectItem value="New">New</SelectItem>
                            <SelectItem value="In Progress">In Progress</SelectItem>
                            <SelectItem value="Completed">Completed</SelectItem>
                            <SelectItem value="Declined">Declined</SelectItem>
                          </SelectContent>
                        </Select>
                        {lead.status === "Completed" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleAddCustomer(lead)}
                            className="bg-gradient-primary whitespace-nowrap shrink-0"
                          >
                            <UserPlus className="h-4 w-4 mr-1" />
                            Add Customer
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(lead)}
                          className="shrink-0"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <AddLeadDialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) setEditingLead(null);
        }}
        lead={editingLead}
      />
    </div>
  );
}