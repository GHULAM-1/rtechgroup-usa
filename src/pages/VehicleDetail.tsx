import { useState, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Car, FileText, DollarSign, Wrench, Calendar, TrendingUp, TrendingDown, Plus, Shield, Clock, Trash2, History, Receipt, Users, Eye, EyeOff } from "lucide-react";
import { format } from "date-fns";
import { startOfMonth, endOfMonth, parseISO } from "date-fns";
import { AcquisitionBadge } from "@/components/AcquisitionBadge";
import { MOTTaxStatusChip } from "@/components/MOTTaxStatusChip";
import { MetricCard, MetricItem, MetricDivider } from "@/components/MetricCard";
import { VehicleStatusBadge } from "@/components/VehicleStatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { TruncatedCell } from "@/components/TruncatedCell";
import { useVehicleServices } from "@/hooks/useVehicleServices";
import { useVehicleExpenses } from "@/hooks/useVehicleExpenses";
import { useVehicleFiles } from "@/hooks/useVehicleFiles";
import { useVehicleEvents } from "@/hooks/useVehicleEvents";
import { AddServiceRecordDialog } from "@/components/AddServiceRecordDialog";
import { ServiceHistoryTable } from "@/components/ServiceHistoryTable";
import { LastServiceCard } from "@/components/LastServiceCard";
import { EnhancedVehiclePlatesPanel } from "@/components/EnhancedVehiclePlatesPanel";
import { EditVehicleDialog } from "@/components/EditVehicleDialog";
import { VehicleExpenseDialog } from "@/components/VehicleExpenseDialog";
import { VehicleFileUpload } from "@/components/VehicleFileUpload";
import { VehicleCompliancePanel } from "@/components/VehicleCompliancePanel";
import { VehicleDisposalDialog } from "@/components/VehicleDisposalDialog";
import { VehicleUndoDisposalDialog } from "@/components/VehicleUndoDisposalDialog";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { PLBreadcrumb } from "@/components/PLBreadcrumb";
import { VehiclePhotoUpload } from "@/components/VehiclePhotoUpload";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Vehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  colour: string;
  status: string;
  purchase_price: number;
  acquisition_date: string;
  acquisition_type: string;
  created_at: string;
  // Finance fields
  monthly_payment?: number;
  initial_payment?: number;
  term_months?: number;
  balloon?: number;
  finance_start_date?: string;
  // MOT & TAX fields
  mot_due_date?: string;
  tax_due_date?: string;
  // Service fields
  last_service_date?: string;
  last_service_mileage?: number;
  // Security fields
  has_ghost?: boolean;
  ghost_code?: string;
  has_tracker?: boolean;
  has_remote_immobiliser?: boolean;
  security_notes?: string;
  // Disposal fields
  is_disposed?: boolean;
  disposal_date?: string;
  sale_proceeds?: number;
  disposal_buyer?: string;
  disposal_notes?: string;
  // Photo field
  photo_url?: string;
}

interface PLEntry {
  id: string;
  entry_date: string;
  side: string;
  category: string;
  amount: number;
  source_ref: string;
}

interface Rental {
  id: string;
  customer_id: string;
  start_date: string;
  end_date: string;
  monthly_amount: number;
  status: string;
  customers: {
    name: string;
  };
}

// Remove old StatusBadge - replaced with VehicleStatusBadge component

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [showGhostCode, setShowGhostCode] = useState(false);
  
  // Get tab and date filtering from URL params
  const activeTab = searchParams.get('tab') || 'overview';
  const monthParam = searchParams.get('month');
  const selectedMonth = monthParam;
  const fromMonthlyDrilldown = searchParams.get('from') === 'monthly';
  
  // Parse month parameter if present (format: YYYY-MM)
  const dateFilter = useMemo(() => {
    if (monthParam) {
      const monthDate = parseISO(`${monthParam}-01`);
      return {
        startDate: startOfMonth(monthDate),
        endDate: endOfMonth(monthDate)
      };
    }
    return null;
  }, [monthParam]);

  // Service management hook
  const {
    serviceRecords,
    isLoading: isLoadingServices,
    addService,
    editService,
    deleteService,
    isAdding: isAddingService,
    isEditing: isEditingService,
    isDeleting: isDeletingService,
  } = useVehicleServices(id!);

  // Expenses management hook
  const {
    expenses,
    isLoading: isLoadingExpenses,
    addExpense,
    deleteExpense,
    isAdding: isAddingExpense,
    isDeleting: isDeletingExpense,
  } = useVehicleExpenses(id!);

  // Files management hook  
  const {
    files,
    isLoading: isLoadingFiles,
    uploadFile,
    deleteFile,
    downloadFile,
    isUploading: isUploadingFile,
    isDeleting: isDeletingFile,
  } = useVehicleFiles(id!);

  // Events/history hook
  const {
    events,
    isLoading: isLoadingEvents,
  } = useVehicleEvents(id!);

  // Fetch vehicle details
  const { data: vehicle, isLoading: vehicleLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
      if (!id) throw new Error("Vehicle ID required");
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Vehicle;
    },
    enabled: !!id,
  });

  // Fetch P&L entries with optional date filtering
  const { data: plEntries } = useQuery({
    queryKey: ["plEntries", id, dateFilter?.startDate, dateFilter?.endDate],
    queryFn: async () => {
      if (!id) return [];
      
      let query = supabase
        .from("pnl_entries")
        .select("*")
        .eq("vehicle_id", id);
      
      // Apply date filtering if present
      if (dateFilter?.startDate) {
        query = query.gte("entry_date", dateFilter.startDate.toISOString().split('T')[0]);
      }
      if (dateFilter?.endDate) {
        query = query.lte("entry_date", dateFilter.endDate.toISOString().split('T')[0]);
      }
      
      const { data, error } = await query.order("entry_date", { ascending: false });
      
      if (error) throw error;
      return data as PLEntry[];
    },
    enabled: !!id,
  });

  // Fetch rentals
  const { data: rentals } = useQuery({
    queryKey: ["vehicle-rentals", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          *,
          customers(name)
        `)
        .eq("vehicle_id", id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Rental[];
    },
    enabled: !!id,
  });

  // Fetch fines
  const { data: fines } = useQuery({
    queryKey: ["vehicle-fines", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("fines")
        .select(`
          *,
          customers(name)
        `)
        .eq("vehicle_id", id)
        .order("issue_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Calculate P&L summary
  const plSummary = plEntries?.reduce(
    (acc, entry) => {
      const amount = Number(entry.amount);
      if (entry.side === 'Revenue') {
        acc.totalRevenue += amount;
        if (entry.category === 'Rental') acc.revenue_rental += amount;
        if (entry.category === 'Initial Fees') acc.revenue_initial_fees += amount;
        if (entry.category === 'Disposal') acc.revenue_disposal += amount;
        if (entry.category === 'Other') acc.revenue_other += amount;
      } else if (entry.side === 'Cost') {
        acc.totalCosts += amount;
        if (entry.category === 'Acquisition') acc.cost_acquisition += amount;
        if (entry.category === 'Finance') acc.cost_finance += amount;
        if (entry.category === 'Service') acc.cost_service += amount;
        if (entry.category === 'Fines') acc.cost_fines += amount;
        if (entry.category === 'Plates') acc.cost_plates += amount;
        if (entry.category === 'Disposal') acc.cost_disposal += amount;
        if (entry.category === 'Other') acc.cost_other += amount;
      }
      return acc;
    },
    {
      totalRevenue: 0,
      revenue_rental: 0,
      revenue_initial_fees: 0,
      revenue_disposal: 0,
      revenue_other: 0,
      totalCosts: 0,
      cost_acquisition: 0,
      cost_finance: 0,
      cost_service: 0,
      cost_plates: 0,
      cost_fines: 0,
      cost_disposal: 0,
      cost_other: 0,
    }
  ) || {
    totalRevenue: 0,
    revenue_rental: 0,
    revenue_initial_fees: 0,
    revenue_disposal: 0,
    revenue_other: 0,
    totalCosts: 0,
    cost_acquisition: 0,
    cost_finance: 0,
    cost_service: 0,
    cost_plates: 0,
    cost_fines: 0,
    cost_disposal: 0,
    cost_other: 0,
  };

  const netProfit = plSummary.totalRevenue - plSummary.totalCosts;

  // Context-aware back navigation
  const getBackLink = () => {
    if (selectedMonth && fromMonthlyDrilldown) {
      return `/pl-dashboard/monthly/${selectedMonth}`;
    }
    if (selectedMonth) {
      return `/pl-dashboard/monthly/${selectedMonth}`;
    }
    return '/vehicles';
  };

  const getBackLabel = () => {
    if (selectedMonth && fromMonthlyDrilldown) {
      return `Back to ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}`;
    }
    if (selectedMonth) {
      return `Back to ${format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}`;
    }
    return 'Back to Vehicles';
  };

  // Breadcrumb items
  const getBreadcrumbItems = () => {
    const items = [];
    
    if (selectedMonth) {
      items.push(
        { label: "Global P&L Dashboard", href: "/pl-dashboard" },
        { label: format(new Date(selectedMonth + '-01'), 'MMMM yyyy'), href: `/pl-dashboard/monthly/${selectedMonth}` }
      );
    }
    
    items.push({
      label: `${vehicle?.reg} (${vehicle?.make} ${vehicle?.model})`,
      current: true
    });
    
    return items;
  };

  if (vehicleLoading) {
    return <div>Loading vehicle details...</div>;
  }

  if (!vehicle) {
    return <div>Vehicle not found</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {selectedMonth && <PLBreadcrumb items={getBreadcrumbItems()} />}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(getBackLink())}>
            <ChevronLeft className="h-4 w-4 mr-2" />
            {getBackLabel()}
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{vehicle.reg}</h1>
            <p className="text-muted-foreground">
              {vehicle.make} {vehicle.model} • {vehicle.colour}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EditVehicleDialog vehicle={vehicle} />
          <VehicleStatusBadge status={vehicle.status} showTooltip />
        </div>
      </div>

      {/* Tabs with Sticky Navigation */}
      <Tabs value={activeTab} onValueChange={(value) => {
        const newParams = new URLSearchParams(searchParams);
        newParams.set('tab', value);
        setSearchParams(newParams);
      }} className="w-full">
        <TabsList variant="sticky-evenly-spaced" className="mb-6">
          <TabsTrigger variant="evenly-spaced" value="overview">Overview</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="history">History</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="expenses">Expenses</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="rentals">Rentals</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="fines">Fines</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="services">Services</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="plates">Plates</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="pl">P&L</TabsTrigger>
          <TabsTrigger variant="evenly-spaced" value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          {/* Vehicle Photo Upload Section */}
          <div className="mb-6">
            <VehiclePhotoUpload 
              vehicleId={vehicle.id}
              vehicleReg={vehicle.reg}
              currentPhotoUrl={vehicle.photo_url}
            />
          </div>

          {/* Vehicle Compliance Status Panel */}
          {vehicle && <VehicleCompliancePanel vehicle={vehicle} />}
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {/* Vehicle Details */}
            <MetricCard 
              title="Vehicle Details"
              icon={Car}
              badge={{ text: vehicle.status, variant: vehicle.status === 'Available' ? 'default' : 'secondary' }}
            >
              <div className="space-y-3">
                <MetricItem label="Registration" value={vehicle.reg} />
                <MetricItem label="Make" value={vehicle.make} />
                <MetricItem label="Model" value={vehicle.model} />
                <MetricItem label="Colour" value={vehicle.colour} />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <VehicleStatusBadge status={vehicle.status} showTooltip />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Acquisition:</span>
                  <AcquisitionBadge acquisitionType={vehicle.acquisition_type} />
                </div>
                <MetricDivider />
                <MetricItem 
                  label={vehicle.acquisition_type === 'Finance' ? 'Contract Total' : 'Purchase Price'}
                  value={vehicle.acquisition_type === 'Finance' && vehicle.monthly_payment && vehicle.term_months
                    ? (vehicle.initial_payment || 0) + (vehicle.monthly_payment * vehicle.term_months) + (vehicle.balloon || 0)
                    : Number(vehicle.purchase_price)
                  }
                  isAmount
                />
                <MetricItem label="Acquired" value={format(new Date(vehicle.acquisition_date), "dd/MM/yyyy")} />
                
                {/* Compliance Status */}
                <MetricDivider />
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Compliance Status</div>
                  <div className="flex flex-wrap gap-2">
                    <MOTTaxStatusChip 
                      dueDate={vehicle.mot_due_date}
                      type="MOT"
                    />
                    <MOTTaxStatusChip 
                      dueDate={vehicle.tax_due_date}
                      type="TAX"
                    />
                  </div>
                </div>
              </div>
            </MetricCard>

            {/* Finance Information Card - Only show for financed vehicles */}
            {vehicle.acquisition_type === 'Finance' && (
              <MetricCard 
                title="Finance Information"
                icon={DollarSign}
                badge={{ text: "Financed", variant: "outline" }}
              >
                <div className="space-y-3">
                  {vehicle.monthly_payment && (
                    <MetricItem label="Monthly Payment" value={Number(vehicle.monthly_payment)} isAmount />
                  )}
                  {vehicle.initial_payment && vehicle.initial_payment > 0 && (
                    <MetricItem label="Initial Payment" value={Number(vehicle.initial_payment)} isAmount />
                  )}
                  {vehicle.term_months && (
                    <MetricItem label="Term" value={`${vehicle.term_months} months`} />
                  )}
                  {vehicle.balloon && vehicle.balloon > 0 && (
                    <MetricItem label="Balloon Payment" value={Number(vehicle.balloon)} isAmount />
                  )}
                  {vehicle.finance_start_date && (
                    <MetricItem label="Finance Start" value={format(new Date(vehicle.finance_start_date), "dd/MM/yyyy")} />
                  )}
                  
                  {/* Contract Total */}
                  {vehicle.monthly_payment && vehicle.term_months && (
                    <>
                      <MetricDivider />
                      <MetricItem 
                        label="Contract Total" 
                        value={(vehicle.initial_payment || 0) + (vehicle.monthly_payment * vehicle.term_months) + (vehicle.balloon || 0)}
                        isAmount
                      />
                      <div className="text-xs text-muted-foreground mt-2">
                        Finance costs are recorded upfront in P&L when vehicle is added
                      </div>
                    </>
                  )}
                </div>
              </MetricCard>
            )}

            {/* P&L Summary */}
            <MetricCard 
              title="P&L Summary"
              icon={TrendingUp}
              badge={{ 
                text: netProfit >= 0 ? "Profitable" : "Loss", 
                variant: netProfit >= 0 ? "default" : "destructive" 
              }}
            >
              <div className="space-y-3">
                <MetricItem 
                  label="Total Revenue" 
                  value={plSummary.totalRevenue} 
                  isAmount 
                  trend={plSummary.totalRevenue > 0 ? "up" : "neutral"}
                />
                <MetricItem 
                  label="Total Costs" 
                  value={plSummary.totalCosts} 
                  isAmount 
                  trend={plSummary.totalCosts > 0 ? "down" : "neutral"}
                />
                <MetricDivider />
                <MetricItem 
                  label="Net Profit" 
                  value={Math.abs(netProfit)} 
                  isAmount 
                  trend={netProfit >= 0 ? "up" : "down"}
                  className="font-semibold"
                />
              </div>
            </MetricCard>

            {/* Vehicle Actions */}
            {vehicle && (
              <MetricCard 
                title="Vehicle Actions"
                icon={Shield}
                badge={{ 
                  text: vehicle.is_disposed ? "Disposed" : "Active", 
                  variant: vehicle.is_disposed ? "destructive" : "default" 
                }}
              >
                {vehicle.is_disposed ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <div className="text-sm">
                        <div className="font-medium text-destructive mb-2">Vehicle Disposed</div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          {vehicle.disposal_date && (
                            <MetricItem label="Date" value={format(new Date(vehicle.disposal_date), "dd/MM/yyyy")} />
                          )}
                          {vehicle.sale_proceeds && (
                            <MetricItem label="Sale Proceeds" value={Number(vehicle.sale_proceeds)} isAmount />
                          )}
                          {vehicle.disposal_buyer && (
                            <MetricItem label="Buyer" value={vehicle.disposal_buyer} />
                          )}
                        </div>
                      </div>
                    </div>
                    <VehicleUndoDisposalDialog vehicle={vehicle} />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Administrative actions for this vehicle
                    </p>
                    <VehicleDisposalDialog vehicle={vehicle} />
                  </div>
                )}
              </MetricCard>
            )}

            {/* Rental Status */}
            <MetricCard 
              title="Rental Status"
              icon={Users}
              badge={{ 
                text: rentals?.filter(r => r.status === 'Active').length ? "Active" : "Idle", 
                variant: rentals?.filter(r => r.status === 'Active').length ? "default" : "secondary" 
              }}
            >
              {rentals && rentals.length > 0 ? (
                <div className="space-y-3">
                  <MetricItem label="Active Rentals" value={rentals.filter(r => r.status === 'Active').length} />
                  <MetricItem label="Total Rentals" value={rentals.length} />
                  <MetricItem 
                    label="Outstanding Fines" 
                    value={fines?.filter(f => f.status === 'Open').reduce((sum, f) => sum + f.amount, 0) || 0} 
                    isAmount 
                    trend={fines?.filter(f => f.status === 'Open').length ? "down" : "neutral"}
                  />
                  {rentals.filter(r => r.status === 'Active').map(rental => (
                    <div key={rental.id} className="p-2 bg-muted/50 rounded-md border">
                      <div className="text-sm font-medium">{rental.customers.name}</div>
                      <div className="text-xs text-muted-foreground">
                        £{rental.monthly_amount.toLocaleString()}/month
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No active rentals</p>
                </div>
              )}
            </MetricCard>
            
            <LastServiceCard vehicle={vehicle} />

            {/* Security Features */}
            {(vehicle.has_ghost || vehicle.has_tracker || vehicle.has_remote_immobiliser || vehicle.security_notes) && (
              <MetricCard 
                title="Security Features"
                icon={Shield}
                badge={{ 
                  text: [vehicle.has_ghost, vehicle.has_tracker, vehicle.has_remote_immobiliser].filter(Boolean).length > 0 ? "Secured" : "Basic", 
                  variant: [vehicle.has_ghost, vehicle.has_tracker, vehicle.has_remote_immobiliser].filter(Boolean).length > 0 ? "default" : "secondary" 
                }}
              >
                <div className="space-y-3">
                  {vehicle.has_ghost && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md border">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Ghost Immobiliser</span>
                      </div>
                      {vehicle.ghost_code && (
                        <div className="flex items-center gap-2">
                          <div className="text-xs text-muted-foreground">
                            Code: {showGhostCode ? vehicle.ghost_code : '*'.repeat(vehicle.ghost_code.length)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => setShowGhostCode(!showGhostCode)}
                          >
                            {showGhostCode ? (
                              <EyeOff className="h-3 w-3" />
                            ) : (
                              <Eye className="h-3 w-3" />
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                  {vehicle.has_tracker && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md border">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">GPS Tracker</span>
                      </div>
                    </div>
                  )}
                  {vehicle.has_remote_immobiliser && (
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md border">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium">Remote Immobiliser</span>
                      </div>
                    </div>
                  )}
                  {vehicle.security_notes && (
                    <>
                      <MetricDivider />
                      <div className="text-xs text-muted-foreground">
                        <span className="font-medium">Notes:</span> {vehicle.security_notes}
                      </div>
                    </>
                  )}
                  {!vehicle.has_ghost && !vehicle.has_tracker && !vehicle.has_remote_immobiliser && !vehicle.security_notes && (
                    <div className="text-center text-muted-foreground py-4">
                      <Shield className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No security features configured</p>
                    </div>
                  )}
                </div>
              </MetricCard>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pl" className="mt-6">
          <div className="space-y-6">
            {/* Date Filter */}
            {monthParam && (
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-medium">P&L for {format(parseISO(`${monthParam}-01`), 'MMMM yyyy')}</h3>
                  <p className="text-sm text-muted-foreground">Filtered view for the selected month</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    const newParams = new URLSearchParams(searchParams);
                    newParams.delete('month');
                    setSearchParams(newParams);
                  }}
                >
                  View Full History
                </Button>
              </div>
            )}
            
            {/* P&L Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-green-600">Revenue</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm">Revenue (Rental)</span>
                      <span className="text-sm font-medium">
                        £{(plSummary.revenue_rental || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Revenue (Initial Fees)</span>
                      <span className="text-sm font-medium">
                        £{(plSummary.revenue_initial_fees || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Revenue (Other)</span>
                      <span className="text-sm font-medium">
                        £{(plSummary.revenue_other || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cost (Acquisition)</span>
                      <span className="text-sm font-medium text-red-600">
                        -£{(plSummary.cost_acquisition || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cost (Finance)</span>
                      <span className="text-sm font-medium text-red-600">
                        -£{(plSummary.cost_finance || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cost (Service)</span>
                      <span className="text-sm font-medium text-red-600">
                        -£{(plSummary.cost_service || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cost (Plates)</span>
                      <span className="text-sm font-medium text-red-600">
                        -£{(plSummary.cost_plates || 0).toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Cost (Fines)</span>
                      <span className="text-sm font-medium text-red-600">
                        -£{(plSummary.cost_fines || 0).toFixed(2)}
                      </span>
                    </div>
                     <div className="flex justify-between">
                       <span className="text-sm">Cost (Disposal)</span>
                       <span className="text-sm font-medium text-red-600">
                         -£{(plSummary.cost_disposal || 0).toFixed(2)}
                       </span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-sm">Revenue (Disposal)</span>
                       <span className="text-sm font-medium">
                         £{(plSummary.revenue_disposal || 0).toFixed(2)}
                       </span>
                     </div>
                     <div className="flex justify-between">
                       <span className="text-sm">Cost (Other)</span>
                       <span className="text-sm font-medium text-red-600">
                         -£{(plSummary.cost_other || 0).toFixed(2)}
                       </span>
                     </div>
                  </div>
                  <hr />
                  <div className="flex justify-between font-medium">
                    <span>Total Revenue:</span>
                    <span>£{plSummary.totalRevenue.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-red-600">Costs</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between">
                    <span>Acquisition:</span>
                    <span>£{(plSummary.cost_acquisition || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Finance:</span>
                    <span>£{(plSummary.cost_finance || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Service:</span>
                    <span>£{(plSummary.cost_service || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fines:</span>
                    <span>£{(plSummary.cost_fines || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Other:</span>
                    <span>£{(plSummary.cost_other || 0).toLocaleString()}</span>
                  </div>
                  <hr />
                  <div className="flex justify-between font-medium">
                    <span>Total Costs:</span>
                    <span>£{plSummary.totalCosts.toLocaleString()}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Net Profit Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Net Profit
                  <div className={`flex items-center gap-1 ${
                    netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {netProfit >= 0 ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                    £{Math.abs(netProfit).toLocaleString()}
                  </div>
                </CardTitle>
              </CardHeader>
            </Card>

            {/* P&L Entries Table */}
            <Card>
              <CardHeader>
                <CardTitle>P&L Entries</CardTitle>
                <CardDescription>Detailed profit and loss entries for this vehicle{monthParam ? ` (${format(parseISO(`${monthParam}-01`), 'MMMM yyyy')})` : ''}</CardDescription>
              </CardHeader>
              <CardContent>
                {plEntries && plEntries.length > 0 ? (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Side</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Reference</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {plEntries.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell>{format(new Date(entry.entry_date), "dd/MM/yyyy")}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {entry.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={entry.side === 'Revenue' ? 'default' : 'secondary'}>
                                {entry.side}
                              </Badge>
                            </TableCell>
                            <TableCell className={`text-right font-medium ${
                              entry.side === 'Revenue' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              £{Number(entry.amount).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {entry.source_ref || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>No P&L entries found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="rentals" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Rental History</CardTitle>
                <CardDescription>All rental agreements for this vehicle</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {rentals && rentals.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rental #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Monthly Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((rental) => (
                        <TableRow key={rental.id} className="hover:bg-muted/50">
                          <TableCell className="font-mono text-sm">
                            <TruncatedCell content={rental.id.slice(0, 8)} maxLength={8} />
                          </TableCell>
                          <TableCell className="font-medium">
                            <TruncatedCell content={rental.customers.name} maxLength={20} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(rental.start_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {rental.end_date ? format(new Date(rental.end_date), "dd/MM/yyyy") : "Ongoing"}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            £{rental.monthly_amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={rental.status === 'Active' ? 'default' : 'secondary'}>
                              {rental.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Users}
                  title="No rental history found"
                  description="Rental agreements will appear here when customers rent this vehicle"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fines" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fine History</CardTitle>
              <CardDescription>All fines associated with this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              {fines && fines.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fines.map((fine) => (
                        <TableRow key={fine.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(fine.issue_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <TruncatedCell content={fine.type} maxLength={20} />
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            £{fine.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={fine.status === 'Open' ? 'destructive' : 'outline'}>
                              {fine.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(fine.due_date), "dd/MM/yyyy")}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No fines found"
                  description="Traffic fines and penalties will appear here when recorded"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold">Service History</h3>
              <p className="text-sm text-muted-foreground">
                Track maintenance and service records for this vehicle
              </p>
            </div>
            <AddServiceRecordDialog
              onSubmit={addService}
              isLoading={isAddingService}
            />
          </div>

          {isLoadingServices ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Loading service records...</p>
            </div>
          ) : (
            <ServiceHistoryTable
              serviceRecords={serviceRecords}
              onEdit={editService}
              onDelete={deleteService}
              isEditing={isEditingService}
              isDeleting={isDeletingService}
            />
          )}
        </TabsContent>

        <TabsContent value="plates" className="mt-6">
          <EnhancedVehiclePlatesPanel vehicleId={id!} vehicleReg={vehicle.reg} />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Vehicle History
              </CardTitle>
              <CardDescription>
                Timeline of events and activities for this vehicle
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingEvents ? (
                <div className="text-center py-8 text-muted-foreground">Loading events...</div>
              ) : events.length > 0 ? (
                <div className="space-y-3">
                  {events.map((event) => (
                    <div key={event.id} className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2"></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm">
                              <TruncatedCell content={event.summary} maxLength={50} />
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {format(new Date(event.event_date), "MMM d, yyyy 'at' HH:mm")}
                            </p>
                          </div>
                          <Badge variant="outline" className="flex-shrink-0 text-xs">
                            {event.event_type.replace('_', ' ')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={History}
                  title="No events recorded yet"
                  description="Uploads, plate changes, rentals, services will appear here as they occur"
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Vehicle Expenses
                </CardTitle>
                <CardDescription>
                  Track repairs, services, and other vehicle costs
                </CardDescription>
              </div>
              <VehicleExpenseDialog onSubmit={addExpense} isLoading={isAddingExpense} />
            </CardHeader>
            <CardContent>
              {isLoadingExpenses ? (
                <div className="text-center py-8 text-muted-foreground">Loading expenses...</div>
              ) : expenses.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-20">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {expenses.map((expense) => (
                        <TableRow key={expense.id} className="hover:bg-muted/50">
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(expense.expense_date), "dd/MM/yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{expense.category}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-destructive">
                            £{expense.amount.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <TruncatedCell content={expense.reference || '-'} maxLength={20} />
                          </TableCell>
                          <TableCell>
                            <TruncatedCell content={expense.notes || '-'} maxLength={30} />
                          </TableCell>
                          <TableCell>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={isDeletingExpense}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Expense</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure? This will also remove the P&L entry.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteExpense(expense.id)}>
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <EmptyState
                  icon={Receipt}
                  title="No expenses recorded yet"
                  description="Vehicle repairs, services, and other costs will appear here"
                  actionLabel="Add Expense"
                  onAction={() => {/* TODO: Open expense dialog */}}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Documents & Files {files.length > 0 && `(${files.length})`}
                </CardTitle>
                <CardDescription>
                  Upload and manage documents for this vehicle
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <VehicleFileUpload
                files={files}
                onUpload={uploadFile}
                onDelete={deleteFile}
                onDownload={downloadFile}
                isUploading={isUploadingFile}
                isDeleting={isDeletingFile}
                canUpload={true}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}