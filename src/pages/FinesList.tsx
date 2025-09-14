import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, Plus, Eye, Filter, MoreVertical, CreditCard, Ban, Receipt, Scale, ArrowUpDown } from "lucide-react";
import { FineStatusBadge } from "@/components/FineStatusBadge";
import { FineKPIs } from "@/components/FineKPIs";
import { FineFilters, FineFilterState } from "@/components/FineFilters";
import { BulkActionBar } from "@/components/BulkActionBar";
import { AuthorityPaymentDialog } from "@/components/AuthorityPaymentDialog";
import { useFinesData, EnhancedFine } from "@/hooks/useFinesData";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const FinesList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for filtering, sorting, and selection
  const [filters, setFilters] = useState<FineFilterState>({
    status: [],
    liability: [],
    vehicleSearch: '',
    customerSearch: '',
  });
  
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedTab, setSelectedTab] = useState('all');
  const [selectedFines, setSelectedFines] = useState<string[]>([]);
  
  // Authority payment dialog state
  const [authorityPaymentDialog, setAuthorityPaymentDialog] = useState<{
    open: boolean;
    fineId?: string;
    amount?: number;
    reference?: string;
  }>({ open: false });

  // Fetch fines data with current filters
  const { data: finesData, isLoading, error } = useFinesData({
    filters,
    sortBy,
    sortOrder,
  });

  // Filter fines by tab
  const filteredFines = useMemo(() => {
    if (!finesData?.fines) return [];
    
    switch (selectedTab) {
      case 'pcn':
        return finesData.fines.filter(fine => fine.type === 'PCN');
      case 'speeding':
        return finesData.fines.filter(fine => fine.type === 'Speeding');
      case 'other':
        return finesData.fines.filter(fine => fine.type === 'Other');
      default:
        return finesData.fines;
    }
  }, [finesData?.fines, selectedTab]);

  // Get selected fine objects for bulk actions
  const selectedFineObjects = filteredFines.filter(fine => selectedFines.includes(fine.id));

  // Handle individual fine actions
  const chargeFineAction = useMutation({
    mutationFn: async (fineId: string) => {
      const { data, error } = await supabase.functions.invoke('apply-fine', {
        body: { fineId, action: 'charge' }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to charge fine');
      return data;
    },
    onSuccess: () => {
      toast({ title: "Fine charged to customer account successfully" });
      queryClient.invalidateQueries({ queryKey: ["fines-enhanced"] });
      queryClient.invalidateQueries({ queryKey: ["fines-kpis"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to charge fine",
        variant: "destructive",
      });
    },
  });

  const waiveFineAction = useMutation({
    mutationFn: async (fineId: string) => {
      const { data, error } = await supabase.functions.invoke('apply-fine', {
        body: { fineId, action: 'waive' }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to waive fine');
      return data;
    },
    onSuccess: () => {
      toast({ title: "Fine waived successfully" });
      queryClient.invalidateQueries({ queryKey: ["fines-enhanced"] });
      queryClient.invalidateQueries({ queryKey: ["fines-kpis"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to waive fine",
        variant: "destructive",
      });
    },
  });

  const appealFineAction = useMutation({
    mutationFn: async (fineId: string) => {
      const { data, error } = await supabase.functions.invoke('apply-fine', {
        body: { fineId, action: 'appeal' }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to mark as appealed');
      return data;
    },
    onSuccess: () => {
      toast({ title: "Fine marked as appealed" });
      queryClient.invalidateQueries({ queryKey: ["fines-enhanced"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to mark fine as appealed",
        variant: "destructive",
      });
    },
  });

  // Handle sorting
  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
  };

  // Handle row selection
  const handleSelectFine = (fineId: string, checked: boolean) => {
    setSelectedFines(prev =>
      checked 
        ? [...prev, fineId]
        : prev.filter(id => id !== fineId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedFines(checked ? filteredFines.map(f => f.id) : []);
  };

  // Render individual fine row
  const renderFineRow = (fine: EnhancedFine) => {
    const canCharge = fine.liability === 'Customer' && (fine.status === 'Open' || fine.status === 'Appealed');
    const canWaive = fine.status === 'Open' || fine.status === 'Appealed';
    const canAppeal = fine.status === 'Open';

    return (
      <TableRow 
        key={fine.id} 
        className={cn(
          "hover:bg-muted/50",
          fine.isOverdue && "border-l-4 border-l-destructive",
          selectedFines.includes(fine.id) && "bg-primary/5"
        )}
      >
        <TableCell className="w-12">
          <Checkbox
            checked={selectedFines.includes(fine.id)}
            onCheckedChange={(checked) => handleSelectFine(fine.id, checked as boolean)}
          />
        </TableCell>
        
        <TableCell className="font-medium">
          {fine.reference_no || fine.id.slice(0, 8)}
        </TableCell>
        
        <TableCell>
          {fine.vehicles.reg} • {fine.vehicles.make} {fine.vehicles.model}
        </TableCell>
        
        <TableCell>
          {fine.customers?.name || '-'}
        </TableCell>
        
        <TableCell>
          {new Date(fine.issue_date).toLocaleDateString()}
        </TableCell>
        
        <TableCell className={cn(fine.isOverdue && "text-destructive font-medium")}>
          {new Date(fine.due_date).toLocaleDateString()}
          {fine.isOverdue && (
            <Badge variant="destructive" className="ml-2 text-xs">
              {Math.abs(fine.daysUntilDue)} days overdue
            </Badge>
          )}
        </TableCell>
        
        <TableCell>
          <Badge variant={fine.liability === 'Customer' ? 'default' : 'secondary'}>
            {fine.liability}
          </Badge>
        </TableCell>
        
        <TableCell>
          <FineStatusBadge 
            status={fine.status}
            dueDate={fine.due_date}
            remainingAmount={fine.amount}
          />
        </TableCell>
        
        <TableCell className="text-right font-medium">
          £{Number(fine.amount).toLocaleString()}
        </TableCell>
        
        <TableCell className="text-right">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/fines/${fine.id}`)}
            >
              <Eye className="h-4 w-4 mr-1" />
              View
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canCharge && (
                  <DropdownMenuItem 
                    onClick={() => chargeFineAction.mutate(fine.id)}
                    disabled={chargeFineAction.isPending}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Charge to Customer
                  </DropdownMenuItem>
                )}
                
                <DropdownMenuItem 
                  onClick={() => setAuthorityPaymentDialog({
                    open: true,
                    fineId: fine.id,
                    amount: fine.amount,
                    reference: fine.reference_no || undefined,
                  })}
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Record Authority Payment
                </DropdownMenuItem>
                
                {canAppeal && (
                  <DropdownMenuItem 
                    onClick={() => appealFineAction.mutate(fine.id)}
                    disabled={appealFineAction.isPending}
                  >
                    <Scale className="h-4 w-4 mr-2" />
                    Mark as Appealed
                  </DropdownMenuItem>
                )}
                
                {canWaive && (
                  <DropdownMenuItem 
                    onClick={() => waiveFineAction.mutate(fine.id)}
                    disabled={waiveFineAction.isPending}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Waive Fine
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </TableCell>
      </TableRow>
    );
  };

  // Render fines table
  const renderFinesTable = (fines: EnhancedFine[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12">
              <Checkbox
                checked={selectedFines.length === fines.length && fines.length > 0}
                onCheckedChange={handleSelectAll}
              />
            </TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Vehicle</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Issue Date</TableHead>
            <TableHead 
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('due_date')}
            >
              <div className="flex items-center gap-1">
                Due Date
                <ArrowUpDown className="h-4 w-4" />
              </div>
            </TableHead>
            <TableHead>Liability</TableHead>
            <TableHead>Status</TableHead>
            <TableHead 
              className="text-right cursor-pointer hover:bg-muted/50"
              onClick={() => handleSort('amount')}
            >
              <div className="flex items-center justify-end gap-1">
                Amount
                <ArrowUpDown className="h-4 w-4" />
              </div>
            </TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fines.length > 0 ? (
            fines.map(renderFineRow)
          ) : (
            <TableRow>
              <TableCell colSpan={10} className="text-center py-8">
                <div className="flex flex-col items-center space-y-2">
                  <AlertTriangle className="h-12 w-12 text-muted-foreground" />
                  <p className="text-lg font-medium">No fines found</p>
                  <p className="text-muted-foreground">
                    {filters.status.length > 0 || filters.liability.length > 0 || filters.vehicleSearch || filters.customerSearch
                      ? "Try adjusting your filters"
                      : "Get started by adding your first fine"
                    }
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Failed to load fines</h2>
          <p className="text-muted-foreground">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  const pcnFines = filteredFines.filter(fine => fine.type === 'PCN');
  const speedingFines = filteredFines.filter(fine => fine.type === 'Speeding');
  const otherFines = filteredFines.filter(fine => fine.type === 'Other');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fines Management</h1>
          <p className="text-muted-foreground">
            Track and manage traffic fines and penalties
          </p>
        </div>
        <Button 
          onClick={() => navigate("/fines/new")}
          className="bg-gradient-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Fine
        </Button>
      </div>

      {/* KPIs */}
      <FineKPIs />

      {/* Filters */}
      <FineFilters onFiltersChange={setFilters} />

      {/* Bulk Action Bar */}
      {selectedFines.length > 0 && (
        <BulkActionBar 
          selectedFines={selectedFineObjects}
          onClearSelection={() => setSelectedFines([])}
        />
      )}

      {/* Fines Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            Fines & Penalties
          </CardTitle>
          <CardDescription>
            View and manage fines by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">
                All ({filteredFines.length})
              </TabsTrigger>
              <TabsTrigger value="pcn">
                PCN ({pcnFines.length})
              </TabsTrigger>
              <TabsTrigger value="speeding">
                Speeding ({speedingFines.length})
              </TabsTrigger>
              <TabsTrigger value="other">
                Other ({otherFines.length})
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="all" className="mt-6">
              {isLoading ? (
                <div className="text-center py-8">Loading fines...</div>
              ) : (
                renderFinesTable(filteredFines)
              )}
            </TabsContent>
            
            <TabsContent value="pcn" className="mt-6">
              {isLoading ? (
                <div className="text-center py-8">Loading PCN fines...</div>
              ) : (
                renderFinesTable(pcnFines)
              )}
            </TabsContent>
            
            <TabsContent value="speeding" className="mt-6">
              {isLoading ? (
                <div className="text-center py-8">Loading speeding fines...</div>
              ) : (
                renderFinesTable(speedingFines)
              )}
            </TabsContent>
            
            <TabsContent value="other" className="mt-6">
              {isLoading ? (
                <div className="text-center py-8">Loading other fines...</div>
              ) : (
                renderFinesTable(otherFines)
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Authority Payment Dialog */}
      <AuthorityPaymentDialog
        open={authorityPaymentDialog.open}
        onOpenChange={(open) => setAuthorityPaymentDialog(prev => ({ ...prev, open }))}
        fineId={authorityPaymentDialog.fineId || ''}
        fineAmount={authorityPaymentDialog.amount || 0}
        fineReference={authorityPaymentDialog.reference}
      />
    </div>
  );
};

export default FinesList;