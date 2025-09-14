import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, TrendingUp, TrendingDown } from "lucide-react";

interface Vehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  colour: string;
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
    Available: "badge-status bg-success-light text-success border-success",
    Rented: "badge-status bg-primary-light text-primary border-primary",
    Sold: "badge-status bg-muted text-muted-foreground border-border",
    Disposed: "badge-status bg-muted text-muted-foreground border-border"
  };
  
  return (
    <Badge variant="outline" className={variants[status as keyof typeof variants] || variants.Available}>
      {status}
    </Badge>
  );
};

const VehicleCard = ({ vehicle, pl }: { vehicle: Vehicle; pl?: VehiclePL }) => {
  const netProfit = pl ? Number(pl.total_revenue) - Number(pl.total_costs) : 0;
  const isProfit = netProfit > 0;

  return (
    <Card className="card-hover shadow-card transition-all duration-300 hover:scale-102 cursor-pointer">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <Car className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg font-semibold">{vehicle.reg}</CardTitle>
              <CardDescription className="text-metadata">{vehicle.make} {vehicle.model}</CardDescription>
            </div>
          </div>
          <StatusBadge status={vehicle.status} />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-metadata text-muted-foreground">Acquisition</span>
          <span className="font-medium">£{(vehicle.purchase_price || 0).toLocaleString()}</span>
        </div>
        {pl && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-metadata text-muted-foreground">Revenue</span>
              <span className="font-medium text-green-600">£{Number(pl.total_revenue).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-metadata text-muted-foreground">Net P&L</span>
              <div className="flex items-center gap-1">
                {isProfit ? (
                  <TrendingUp className="h-3 w-3 text-green-600" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-600" />
                )}
                <span className={`font-medium ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                  £{Math.abs(netProfit).toLocaleString()}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export const FleetOverview = () => {
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
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
    queryKey: ["vehicle-pl"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pnl_entries")
        .select("vehicle_id, side, amount")
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      
      // Aggregate P&L by vehicle
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
      
      // Calculate net profit
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
    <Card className="shadow-card rounded-lg">
      <CardHeader>
        <div>
          <CardTitle className="text-xl font-semibold">Fleet Overview</CardTitle>
          <CardDescription>Monitor vehicle performance and P&L</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {vehicles && vehicles.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => (
              <VehicleCard 
                key={vehicle.id} 
                vehicle={vehicle} 
                pl={vehiclePL?.[vehicle.id]}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Car className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No vehicles in fleet</h3>
            <p className="text-muted-foreground mb-4">Add your first vehicle to get started</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};