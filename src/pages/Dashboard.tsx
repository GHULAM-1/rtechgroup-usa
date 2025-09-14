import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, Users, FileText, AlertTriangle, Calendar, DollarSign, Plus, Bell, Clock, TestTube } from "lucide-react";
import { DashboardStats } from "@/components/DashboardStats";
import { RecentActivity } from "@/components/RecentActivity";
import { FleetOverview } from "@/components/FleetOverview";
import { ComplianceOverviewCard } from "@/components/ComplianceOverviewCard";
import { RentalAcceptanceTest } from "@/components/RentalAcceptanceTest";
import { FinanceAcceptanceTest } from "@/components/FinanceAcceptanceTest";

interface DashboardWidget {
  title: string;
  value: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  href: string;
}

const DashboardCard = ({ widget, onClick }: { widget: DashboardWidget; onClick: () => void }) => (
  <Card 
    className="card-hover cursor-pointer transition-all duration-200" 
    onClick={onClick}
  >
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium">{widget.title}</CardTitle>
      <widget.icon className={`h-4 w-4 ${widget.color}`} />
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{widget.value}</div>
      <p className="text-xs text-muted-foreground">{widget.description}</p>
    </CardContent>
  </Card>
);

const Dashboard = () => {
  const navigate = useNavigate();

  // Dashboard metrics queries
  const { data: overduePayments } = useQuery({
    queryKey: ["overdue-payments"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("type", "Charge")
        .gt("remaining_amount", 0)
        .lt("due_date", today);
      
      return data?.reduce((sum, entry) => sum + Number(entry.remaining_amount), 0) || 0;
    },
  });

  const { data: vehicleCount } = useQuery({
    queryKey: ["vehicle-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("vehicles")
        .select("*", { count: "exact", head: true })
        .eq("is_disposed", false);
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: customerCount } = useQuery({
    queryKey: ["customer-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: activeRentalsCount } = useQuery({
    queryKey: ["active-rentals-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("rentals")
        .select("*", { count: "exact", head: true })
        .eq("status", "Active");
      
      if (error) throw error;
      return count || 0;
    },
  });

  const { data: pendingFines } = useQuery({
    queryKey: ["pending-fines"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("fines")
        .select("*", { count: "exact", head: true })
        .in("status", ["Open", "Appealed"]);
      
      if (error) throw error;
      return count || 0;
    },
  });

  const widgets: DashboardWidget[] = [
    {
      title: "Total Vehicles",
      value: vehicleCount?.toString() || "0",
      description: "Active fleet vehicles",
      icon: Car,
      color: "text-blue-600",
      href: "/vehicles"
    },
    {
      title: "Total Customers",
      value: customerCount?.toString() || "0",
      description: "Registered customers",
      icon: Users,
      color: "text-green-600",
      href: "/customers"
    },
    {
      title: "Active Rentals",
      value: activeRentalsCount?.toString() || "0",
      description: "Currently active rentals",
      icon: FileText,
      color: "text-purple-600",
      href: "/rentals"
    },
    {
      title: "Overdue Amount",
      value: `£${(overduePayments || 0).toLocaleString()}`,
      description: "Outstanding overdue payments",
      icon: AlertTriangle,
      color: "text-red-600",
      href: "/payments"
    }
  ];

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Fleet management overview and key metrics
          </p>
        </div>
        <Button onClick={() => navigate("/rentals/new")}>
          <Plus className="h-4 w-4 mr-2" />
          New Rental
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <DashboardStats />
      </div>
      
      {/* Compliance and Fleet Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ComplianceOverviewCard />
        <div className="md:col-span-2">
          <FleetOverview />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <div className="col-span-7">
          <RecentActivity />
        </div>
      </div>

      {/* Acceptance Tests */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              System Tests
            </CardTitle>
            <CardDescription>
              Run automated tests to verify system functionality
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RentalAcceptanceTest />
            <FinanceAcceptanceTest />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;