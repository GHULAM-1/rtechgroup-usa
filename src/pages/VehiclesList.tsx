import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, Plus, TrendingUp, TrendingDown, Eye } from "lucide-react";
import { AddVehicleDialog } from "@/components/AddVehicleDialog";

interface Vehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  status: string;
  purchase_price: number;
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
      £{Math.abs(netProfit).toLocaleString()}
    </div>
  );
};

const VehiclesList = () => {
  const navigate = useNavigate();
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("*")
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

      {/* Vehicles Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Fleet Overview
          </CardTitle>
          <CardDescription>
            View all vehicles with registration, status, and P&L performance
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vehicles && vehicles.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Registration</TableHead>
                    <TableHead>Make/Model</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acquisition Cost</TableHead>
                    <TableHead className="text-right">Net P&L</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {vehicles.map((vehicle) => {
                    const pl = vehiclePL?.[vehicle.id];
                    const netProfit = pl ? pl.net_profit : -Number(vehicle.purchase_price || 0);
                    
                    return (
                      <TableRow key={vehicle.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{vehicle.reg}</TableCell>
                        <TableCell>{vehicle.make} {vehicle.model}</TableCell>
                        <TableCell>
                          <StatusBadge status={vehicle.status} />
                        </TableCell>
                        <TableCell className="text-right">
                          £{Number(vehicle.purchase_price || 0).toLocaleString()}
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
              <h3 className="text-lg font-medium mb-2">No vehicles found</h3>
              <p className="text-muted-foreground mb-4">Add your first vehicle to get started</p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Vehicle
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <AddVehicleDialog open={showAddDialog} onOpenChange={setShowAddDialog} />
    </div>
  );
};

export default VehiclesList;