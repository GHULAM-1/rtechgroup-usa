import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Car, Plus, TrendingUp, TrendingDown, Eye, Filter, X } from "lucide-react";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";
import { AcquisitionBadge } from "@/components/AcquisitionBadge";
import { MOTTaxStatusChip } from "@/components/MOTTaxStatusChip";

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
  mot_due_date?: string;
  tax_due_date?: string;
  last_service_date?: string;
  last_service_mileage?: number;
}

interface VehiclePL {
  vehicle_id: string;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
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

const PLPill = ({ netProfit }: { netProfit: number }) => {
  const isPositive = netProfit >= 0;
  
  return (
    <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
      isPositive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
    }`}>
      {isPositive ? (
        <TrendingUp className="h-3 w-3" />
      ) : (
        <TrendingDown className="h-3 w-3" />
      )}
      ${Math.abs(netProfit).toLocaleString()}
    </div>
  );
};

const VehiclesList = () => {
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [makeFilter, setMakeFilter] = useState<string>("all");
  const [acquisitionFilter, setAcquisitionFilter] = useState<string>("all");
  const [plFilter, setPlFilter] = useState<string>("all");

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, reg, make, model, colour, status, purchase_price, acquisition_date, acquisition_type, mot_due_date, tax_due_date, last_service_date, last_service_mileage")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Vehicle[];
    },
  });

  const { data: vehiclePL } = useQuery({
    queryKey: ["vehicles-pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pnl_entries")
        .select("vehicle_id, side, amount");
      
      if (error) throw error;
      
      const plByVehicle: Record<string, VehiclePL> = {};
      
      data?.forEach((entry) => {
        if (!plByVehicle[entry.vehicle_id]) {
          plByVehicle[entry.vehicle_id] = {
            vehicle_id: entry.vehicle_id,
            total_revenue: 0,
            total_costs: 0,
            net_profit: 0,
          };
        }
        
        const amount = Number(entry.amount);
        if (entry.side === 'Revenue') {
          plByVehicle[entry.vehicle_id].total_revenue += amount;
        } else if (entry.side === 'Cost') {
          plByVehicle[entry.vehicle_id].total_costs += amount;
        }
      });
      
      Object.values(plByVehicle).forEach((pl) => {
        pl.net_profit = pl.total_revenue - pl.total_costs;
      });
      
      return plByVehicle;
    },
  });

  // Clear all filters function
  const clearFilters = () => {
    setStatusFilter("all");
    setMakeFilter("all");
    setAcquisitionFilter("all");
    setPlFilter("all");
  };

  // Filter vehicles based on current filter values
  const filteredVehicles = useMemo(() => {
    if (!vehicles) return [];

    return vehicles.filter((vehicle) => {
      // Status filter
      if (statusFilter !== "all" && vehicle.status !== statusFilter) {
        return false;
      }

      // Make filter
      if (makeFilter !== "all" && vehicle.make !== makeFilter) {
        return false;
      }

      // Acquisition type filter
      if (acquisitionFilter !== "all" && vehicle.acquisition_type !== acquisitionFilter) {
        return false;
      }

      // P&L Performance filter
      if (plFilter !== "all") {
        const pl = vehiclePL?.[vehicle.id];
        const netProfit = pl ? pl.net_profit : -Number(vehicle.purchase_price || 0);
        
        if (plFilter === "profitable" && netProfit <= 0) return false;
        if (plFilter === "loss" && netProfit >= 0) return false;
        if (plFilter === "breakeven" && netProfit !== 0) return false;
      }

      return true;
    });
  }, [vehicles, vehiclePL, statusFilter, makeFilter, acquisitionFilter, plFilter]);

  // Get unique values for filter options
  const uniqueStatuses = useMemo(() => {
    if (!vehicles) return [];
    return [...new Set(vehicles.map(v => v.status))].filter(Boolean);
  }, [vehicles]);

  const uniqueMakes = useMemo(() => {
    if (!vehicles) return [];
    return [...new Set(vehicles.map(v => v.make))].filter(Boolean);
  }, [vehicles]);

  const uniqueAcquisitionTypes = useMemo(() => {
    if (!vehicles) return [];
    return [...new Set(vehicles.map(v => v.acquisition_type))].filter(Boolean);
  }, [vehicles]);

  // Check if any filters are active
  const hasActiveFilters = statusFilter !== "all" || makeFilter !== "all" || 
                          acquisitionFilter !== "all" || plFilter !== "all";

  if (isLoading) {
    return <div>Loading vehicles...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Vehicles</h1>
          <p className="text-muted-foreground">Manage your fleet vehicles and view P&L performance</p>
        </div>
        <Button 
          onClick={() => setShowAddDialog(true)}
          className="bg-gradient-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Vehicle
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="h-4 w-4" />
              Filters:
            </div>
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {uniqueStatuses.map(status => (
                  <SelectItem key={status} value={status}>{status}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={makeFilter} onValueChange={setMakeFilter}>
              <SelectTrigger className="w-[130px]">
                <SelectValue placeholder="All Makes" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Makes</SelectItem>
                {uniqueMakes.map(make => (
                  <SelectItem key={make} value={make}>{make}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={acquisitionFilter} onValueChange={setAcquisitionFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {uniqueAcquisitionTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={plFilter} onValueChange={setPlFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="All Performance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Performance</SelectItem>
                <SelectItem value="profitable">Profitable</SelectItem>
                <SelectItem value="loss">Loss-making</SelectItem>
                <SelectItem value="breakeven">Break-even</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" />
                Clear Filters
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Vehicles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Fleet Overview
          </CardTitle>
          <CardDescription>
            {vehicles && filteredVehicles ? 
              `Showing ${filteredVehicles.length} of ${vehicles.length} vehicles` :
              "View all vehicles with registration, status, and P&L performance"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredVehicles && filteredVehicles.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Acquisition</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Inspection Due</TableHead>
                    <TableHead>Registration Due</TableHead>
                    <TableHead className="text-right">Net P&L</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredVehicles.map((vehicle) => {
                    const pl = vehiclePL?.[vehicle.id];
                    const netProfit = pl ? pl.net_profit : -Number(vehicle.purchase_price || 0);
                    
                    return (
                      <TableRow key={vehicle.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{vehicle.reg}</TableCell>
                        <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                        <TableCell>{vehicle.colour}</TableCell>
                        <TableCell>
                          <AcquisitionBadge acquisitionType={vehicle.acquisition_type} />
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={vehicle.status} />
                        </TableCell>
                        <TableCell>
                          <MOTTaxStatusChip dueDate={vehicle.mot_due_date} type="MOT" compact />
                        </TableCell>
                        <TableCell>
                          <MOTTaxStatusChip dueDate={vehicle.tax_due_date} type="TAX" compact />
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {vehicle.last_service_date 
                              ? new Date(vehicle.last_service_date).toLocaleDateString('en-US')
                              : "—"
                            }
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <PLPill netProfit={netProfit} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/vehicles/${vehicle.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {!vehicles || vehicles.length === 0 
                  ? "No vehicles found" 
                  : "No vehicles match your filters"}
              </h3>
              <p className="text-muted-foreground mb-4">
                {!vehicles || vehicles.length === 0 
                  ? "Add your first vehicle to get started"
                  : "Try adjusting your filters or add a new vehicle"}
              </p>
              {(!vehicles || vehicles.length === 0) ? (
                <Button onClick={() => setShowAddDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Vehicle
                </Button>
              ) : (
                <div className="space-x-2">
                  <Button variant="outline" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Clear Filters
                  </Button>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Vehicle
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <AddVehicleDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
};

export default VehiclesList;