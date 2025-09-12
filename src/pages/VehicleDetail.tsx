import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, ArrowLeft, Edit, TrendingUp, TrendingDown, DollarSign } from "lucide-react";
import { useNavigate } from "react-router-dom";

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
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  due_date: string | null;
  amount: number;
  remaining_amount: number;
  type: string;
  category: string;
}

interface PLEntry {
  entry_date: string;
  side: string;
  category: string;
  amount: number;
  source_ref: string;
}

const VehicleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vehicle, isLoading } = useQuery({
    queryKey: ["vehicle", id],
    queryFn: async () => {
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

  const { data: ledgerEntries } = useQuery({
    queryKey: ["vehicle-ledger", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("vehicle_id", id)
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      return data as LedgerEntry[];
    },
    enabled: !!id,
  });

  const { data: plEntries } = useQuery({
    queryKey: ["vehicle-pl", id],
    queryFn: async () => {
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

  if (isLoading) {
    return <div>Loading vehicle details...</div>;
  }

  if (!vehicle) {
    return <div>Vehicle not found</div>;
  }

  const totalRevenue = plEntries?.filter(entry => entry.side === 'Revenue').reduce((sum, entry) => sum + Number(entry.amount), 0) || 0;
  const totalCosts = plEntries?.filter(entry => entry.side === 'Cost').reduce((sum, entry) => sum + Number(entry.amount), 0) || 0;
  const netProfit = totalRevenue - totalCosts;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/vehicles")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Vehicles
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{vehicle.reg}</h1>
            <p className="text-muted-foreground">{vehicle.make} {vehicle.model} - {vehicle.colour}</p>
          </div>
        </div>
        <Button>
          <Edit className="h-4 w-4 mr-2" />
          Edit Vehicle
        </Button>
      </div>

      {/* Vehicle Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Vehicle Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge>{vehicle.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Acquisition Type</p>
              <p className="font-medium">{vehicle.acquisition_type}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Acquisition Date</p>
              <p className="font-medium">{new Date(vehicle.acquisition_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Purchase Price</p>
              <p className="font-medium">£{Number(vehicle.purchase_price).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="pl">P&L</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-green-600" />
                  Total Revenue
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  £{totalRevenue.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-red-600" />
                  Total Costs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  £{totalCosts.toLocaleString()}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {netProfit >= 0 ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  Net P&L
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  £{Math.abs(netProfit).toLocaleString()}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card>
            <CardHeader>
              <CardTitle>Vehicle Ledger</CardTitle>
              <CardDescription>All charges and payments for this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              {ledgerEntries && ledgerEntries.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Remaining</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ledgerEntries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={entry.type === 'Charge' ? 'destructive' : 'default'}>
                              {entry.type}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.category}</TableCell>
                          <TableCell>
                            {entry.due_date ? new Date(entry.due_date).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell className="text-right">£{Number(entry.amount).toLocaleString()}</TableCell>
                          <TableCell className="text-right">£{Number(entry.remaining_amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No ledger entries found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pl">
          <Card>
            <CardHeader>
              <CardTitle>Profit & Loss Statement</CardTitle>
              <CardDescription>Revenue and cost breakdown for this vehicle</CardDescription>
            </CardHeader>
            <CardContent>
              {plEntries && plEntries.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Side</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {plEntries.map((entry, index) => (
                        <TableRow key={index}>
                          <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant={entry.side === 'Revenue' ? 'default' : 'destructive'}>
                              {entry.side}
                            </Badge>
                          </TableCell>
                          <TableCell>{entry.category}</TableCell>
                          <TableCell className={`text-right ${entry.side === 'Revenue' ? 'text-green-600' : 'text-red-600'}`}>
                            £{Number(entry.amount).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{entry.source_ref}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No P&L entries found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default VehicleDetail;