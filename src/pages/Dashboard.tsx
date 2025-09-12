import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Car, Users, FileText, AlertTriangle, Calendar, DollarSign, Plus } from "lucide-react";

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
    queryKey: ["overdue-count"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from("ledger_entries")
        .select("*", { count: "exact", head: true })
        .eq("type", "Charge")
        .gt("remaining_amount", 0)
        .lt("due_date", today);
      return count || 0;
    },
  });

  const { data: dueToday } = useQuery({
    queryKey: ["due-today-count"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from("ledger_entries")
        .select("*", { count: "exact", head: true })
        .eq("type", "Charge")
        .gt("remaining_amount", 0)
        .eq("due_date", today);
      return count || 0;
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["upcoming-count"],
    queryFn: async () => {
      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const { count } = await supabase
        .from("ledger_entries")
        .select("*", { count: "exact", head: true })
        .eq("type", "Charge")
        .gt("remaining_amount", 0)
        .gt("due_date", today.toISOString().split('T')[0])
        .lte("due_date", nextWeek.toISOString().split('T')[0]);
      return count || 0;
    },
  });

  const { data: activeRentals } = useQuery({
    queryKey: ["active-rentals-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("rentals")
        .select("*", { count: "exact", head: true })
        .eq("status", "Active");
      return count || 0;
    },
  });

  const widgets: DashboardWidget[] = [
    {
      title: "Overdue Payments",
      value: overduePayments?.toString() || "0",
      description: "Payments past due date",
      icon: AlertTriangle,
      color: "text-red-500",
      href: "/payments?filter=overdue"
    },
    {
      title: "Due Today",
      value: dueToday?.toString() || "0",
      description: "Payments due today",
      icon: Calendar,
      color: "text-yellow-500",
      href: "/payments?filter=due-today"
    },
    {
      title: "Upcoming (7 days)",
      value: upcoming?.toString() || "0",
      description: "Payments due within 7 days",
      icon: DollarSign,
      color: "text-blue-500",
      href: "/payments?filter=upcoming"
    },
    {
      title: "Active Rentals",
      value: activeRentals?.toString() || "0",
      description: "Currently active rentals",
      icon: FileText,
      color: "text-green-500",
      href: "/rentals?filter=active"
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Fleet Dashboard</h1>
          <p className="text-muted-foreground">Monitor your fleet performance and financial metrics</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => navigate("/rentals/new")} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            New Rental
          </Button>
        </div>
      </div>

      {/* Dashboard Widgets */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {widgets.map((widget) => (
          <DashboardCard
            key={widget.title}
            widget={widget}
            onClick={() => navigate(widget.href)}
          />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="card-hover cursor-pointer" onClick={() => navigate("/vehicles")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-primary" />
              Vehicle Management
            </CardTitle>
            <CardDescription>View and manage your fleet vehicles</CardDescription>
          </CardHeader>
        </Card>

        <Card className="card-hover cursor-pointer" onClick={() => navigate("/customers")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Customer Management
            </CardTitle>
            <CardDescription>Manage customer accounts and balances</CardDescription>
          </CardHeader>
        </Card>

        <Card className="card-hover cursor-pointer" onClick={() => navigate("/payments")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-primary" />
              Payment Processing
            </CardTitle>
            <CardDescription>Process payments and view history</CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;