import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, MoreHorizontal, Calendar, PoundSterling } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AddVehicleDialog } from "./AddVehicleDialog";

interface Vehicle {
  id: string;
  reg_number: string;
  make: string;
  model: string;
  colour: string;
  status: string;
  acquisition_price: number;
}

const StatusBadge = ({ status }: { status: string }) => {
  const variants = {
    available: "badge-status bg-success-light text-success border-success",
    rented: "badge-status bg-primary-light text-primary border-primary",
    sold: "badge-status bg-muted text-muted-foreground border-border"
  };
  
  return (
    <Badge variant="outline" className={variants[status as keyof typeof variants]}>
      {status}
    </Badge>
  );
};

const VehicleCard = ({ vehicle }: { vehicle: Vehicle }) => {
  return (
    <Card className="group card-hover transition-all duration-200 cursor-pointer rounded-lg">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Car className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold">{vehicle.reg_number}</CardTitle>
            <p className="text-metadata text-muted-foreground">{vehicle.make} {vehicle.model}</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100 transition-all duration-200 rounded-lg">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <StatusBadge status={vehicle.status} />
          <div className="text-right">
            <p className="text-metadata text-muted-foreground">Acquisition</p>
            <p className="text-sm font-semibold">£{vehicle.acquisition_price.toLocaleString()}</p>
          </div>
        </div>
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
        .order("created_at", { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data as Vehicle[];
    }
  });

  return (
    <Card className="shadow-card rounded-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Fleet Overview
          </CardTitle>
          <AddVehicleDialog />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : vehicles && vehicles.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((vehicle) => (
              <VehicleCard key={vehicle.id} vehicle={vehicle} />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Car className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No vehicles in fleet yet</p>
            <AddVehicleDialog />
          </div>
        )}
      </CardContent>
    </Card>
  );
};