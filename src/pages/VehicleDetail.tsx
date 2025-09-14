import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Car, FileText, DollarSign, Wrench, Calendar, TrendingUp, TrendingDown, Plus } from "lucide-react";
import { format } from "date-fns";
import { AcquisitionBadge } from "@/components/AcquisitionBadge";
import { MOTTaxStatusChip } from "@/components/MOTTaxStatusChip";
import { useVehicleServices } from "@/hooks/useVehicleServices";
import { AddServiceRecordDialog } from "@/components/AddServiceRecordDialog";
import { ServiceHistoryTable } from "@/components/ServiceHistoryTable";
import { LastServiceCard } from "@/components/LastServiceCard";

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

const StatusBadge = ({ status }: { status: string }) => {
  const variants = {
    Available: 'default',
    Rented: 'secondary',
    Maintenance: 'destructive',
    Sold: 'outline'
  };

  return (
    <Badge variant={variants[status as keyof typeof variants] as any} className="badge-status">
      {status}
    </Badge>
  );
};

export default function VehicleDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  // Fetch P&L entries
  const { data: plEntries } = useQuery({
    queryKey: ["plEntries", id],
    queryFn: async () => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("pnl_entries")
        .select("*")
        .eq("vehicle_id", id)
        .order("entry_date", { ascending: false });
      
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
        if (entry.category === 'Other') acc.revenue_other += amount;
      } else if (entry.side === 'Cost') {
        acc.totalCosts += amount;
        if (entry.category === 'Acquisition') acc.cost_acquisition += amount;
        if (entry.category === 'Finance') acc.cost_finance += amount;
        if (entry.category === 'Service') acc.cost_service += amount;
        if (entry.category === 'Fines') acc.cost_fines += amount;
        if (entry.category === 'Other') acc.cost_other += amount;
      }
      return acc;
    },
    {
      totalRevenue: 0,
      revenue_rental: 0,
      revenue_initial_fees: 0,
      revenue_other: 0,
      totalCosts: 0,
      cost_acquisition: 0,
      cost_finance: 0,
      cost_service: 0,
      cost_fines: 0,
      cost_other: 0,
    }
  ) || {
    totalRevenue: 0,
    revenue_rental: 0,
    revenue_initial_fees: 0,
    revenue_other: 0,
    totalCosts: 0,
    cost_acquisition: 0,
    cost_finance: 0,
    cost_service: 0,
    cost_fines: 0,
    cost_other: 0,
  };

  const netProfit = plSummary.totalRevenue - plSummary.totalCosts;

  if (vehicleLoading) {
    return <div>Loading vehicle details...</div>;
  }

  if (!vehicle) {
    return <div>Vehicle not found</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" onClick={() => navigate("/vehicles")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vehicles
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{vehicle.reg}</h1>
            <p className="text-muted-foreground">
              {vehicle.make} {vehicle.model} • {vehicle.colour}
            </p>
          </div>
        </div>
        <StatusBadge status={vehicle.status} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="fines">Fines</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="pl">P&L</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Vehicle Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5" />
                  Vehicle Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div><strong>Registration:</strong> {vehicle.reg}</div>
                <div><strong>Make:</strong> {vehicle.make}</div>
                <div><strong>Model:</strong> {vehicle.model}</div>
                <div><strong>Colour:</strong> {vehicle.colour}</div>
                <div><strong>Status:</strong> <StatusBadge status={vehicle.status} /></div>
                <div><strong>Acquisition:</strong> <AcquisitionBadge acquisitionType={vehicle.acquisition_type} /></div>
                <div><strong>{vehicle.acquisition_type === 'Finance' ? 'Contract Total' : 'Purchase Price'}:</strong> £{
                  vehicle.acquisition_type === 'Finance' && vehicle.monthly_payment && vehicle.term_months
                    ? ((vehicle.initial_payment || 0) + (vehicle.monthly_payment * vehicle.term_months) + (vehicle.balloon || 0)).toLocaleString()
                    : Number(vehicle.purchase_price).toLocaleString()
                }</div>
                <div><strong>Acquired:</strong> {format(new Date(vehicle.acquisition_date), "dd/MM/yyyy")}</div>
                
                {/* MOT & TAX Status */}
                <div className="mt-4 pt-4 border-t">
                  <div className="text-sm font-medium mb-2">Compliance Status</div>
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
              </CardContent>
            </Card>

            {/* Finance Info Card - Only show for financed vehicles */}
            {vehicle.acquisition_type === 'Finance' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Finance Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {vehicle.monthly_payment && (
                    <div><strong>Monthly Payment:</strong> £{Number(vehicle.monthly_payment).toLocaleString()}</div>
                  )}
                  {vehicle.initial_payment && vehicle.initial_payment > 0 && (
                    <div><strong>Initial Payment:</strong> £{Number(vehicle.initial_payment).toLocaleString()}</div>
                  )}
                  {vehicle.term_months && (
                    <div><strong>Term:</strong> {vehicle.term_months} months</div>
                  )}
                  {vehicle.balloon && vehicle.balloon > 0 && (
                    <div><strong>Balloon Payment:</strong> £{Number(vehicle.balloon).toLocaleString()}</div>
                  )}
                  {vehicle.finance_start_date && (
                    <div><strong>Finance Start:</strong> {format(new Date(vehicle.finance_start_date), "dd/MM/yyyy")}</div>
                  )}
                  
                  {/* Contract Total */}
                  {vehicle.monthly_payment && vehicle.term_months && (
                    <div className="pt-2 border-t">
                      <div><strong>Contract Total:</strong> £{(
                        (vehicle.initial_payment || 0) + 
                        (vehicle.monthly_payment * vehicle.term_months) + 
                        (vehicle.balloon || 0)
                      ).toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Finance costs are recorded upfront in P&L when vehicle is added
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* P&L Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5" />
                  P&L Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex justify-between">
                  <span>Total Revenue:</span>
                  <span className="font-medium text-green-600">£{plSummary.totalRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Total Costs:</span>
                  <span className="font-medium text-red-600">£{plSummary.totalCosts.toLocaleString()}</span>
                </div>
                <hr />
                <div className="flex justify-between items-center">
                  <span className="font-medium">Net Profit:</span>
                  <div className={`flex items-center gap-1 font-medium ${
                    netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {netProfit >= 0 ? (
                      <TrendingUp className="h-4 w-4" />
                    ) : (
                      <TrendingDown className="h-4 w-4" />
                    )}
                    £{Math.abs(netProfit).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rental Status */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Rental Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rentals && rentals.length > 0 ? (
                  <div className="space-y-2">
                    <div><strong>Active Rentals:</strong> {rentals.filter(r => r.status === 'Active').length}</div>
                    <div><strong>Total Rentals:</strong> {rentals.length}</div>
                    <div><strong>Fines:</strong> {fines?.length || 0} 
                      {fines && fines.length > 0 && (
                        <span className="text-red-600 ml-1">
                          (£{fines.filter(f => f.status === 'Open').reduce((sum, f) => sum + f.amount, 0).toLocaleString()} outstanding)
                        </span>
                      )}
                    </div>
                    {rentals.filter(r => r.status === 'Active').map(rental => (
                      <div key={rental.id} className="p-2 bg-muted rounded">
                        <div className="text-sm font-medium">{rental.customers.name}</div>
                        <div className="text-xs text-muted-foreground">
                          £{rental.monthly_amount}/month
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-muted-foreground">No active rentals</div>
                )}
              </CardContent>
            </Card>
            
            <LastServiceCard vehicle={vehicle} />
          </div>
        </TabsContent>

        <TabsContent value="pl" className="mt-6">
          <div className="space-y-6">
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
                      <span className="text-sm">Cost (Fines)</span>
                      <span className="text-sm font-medium text-red-600">
                        -£{(plSummary.cost_fines || 0).toFixed(2)}
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
                <CardDescription>Detailed profit and loss entries for this vehicle</CardDescription>
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
            <CardHeader>
              <CardTitle>Rental History</CardTitle>
              <CardDescription>All rental agreements for this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              {rentals && rentals.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Monthly Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((rental) => (
                        <TableRow key={rental.id}>
                          <TableCell className="font-medium">{rental.customers.name}</TableCell>
                          <TableCell>{format(new Date(rental.start_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>
                            {rental.end_date ? format(new Date(rental.end_date), "dd/MM/yyyy") : "Ongoing"}
                          </TableCell>
                          <TableCell>£{rental.monthly_amount.toLocaleString()}</TableCell>
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
                <div className="text-center py-8 text-muted-foreground">
                  <p>No rental history found</p>
                </div>
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
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fines.map((fine) => (
                        <TableRow key={fine.id}>
                          <TableCell>{format(new Date(fine.issue_date), "dd/MM/yyyy")}</TableCell>
                          <TableCell>{fine.type}</TableCell>
                          <TableCell>£{fine.amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={fine.status === 'Open' ? 'destructive' : 'outline'}>
                              {fine.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{format(new Date(fine.due_date), "dd/MM/yyyy")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No fines found</p>
                </div>
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

        <TabsContent value="history" className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Vehicle history will be displayed here</p>
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Vehicle expenses will be displayed here</p>
          </div>
        </TabsContent>

        <TabsContent value="files" className="space-y-4">
          <div className="text-center py-8 text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Vehicle files will be displayed here</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}