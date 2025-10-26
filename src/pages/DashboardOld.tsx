import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Car, Users, FileText, AlertTriangle, Calendar, PoundSterling, Plus, Bell, Clock, TestTube } from "lucide-react";
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
      
      const count = data?.length || 0;
      const sum = data?.reduce((acc, item) => acc + Number(item.remaining_amount), 0) || 0;
      return { count, sum };
    },
  });

  // Fetch finance costs for P&L
  const { data: financeCosts } = useQuery({
    queryKey: ["finance-costs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pnl_entries")
        .select("amount")
        .eq("side", "Cost")
        .eq("category", "Finance");
      
      return data?.reduce((acc, item) => acc + Number(item.amount), 0) || 0;
    },
  });

  const { data: dueToday } = useQuery({
    queryKey: ["due-today"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("type", "Charge")
        .gt("remaining_amount", 0)
        .eq("due_date", today);
      
      const count = data?.length || 0;
      const sum = data?.reduce((acc, item) => acc + Number(item.remaining_amount), 0) || 0;
      return { count, sum };
    },
  });

  const { data: upcoming } = useQuery({
    queryKey: ["upcoming-payments"],
    queryFn: async () => {
      const today = new Date();
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
      
      const { data } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("type", "Charge")
        .gt("remaining_amount", 0)
        .gte("due_date", tomorrow.toISOString().split('T')[0])
        .lte("due_date", nextWeek.toISOString().split('T')[0]);
      
      const count = data?.length || 0;
      const sum = data?.reduce((acc, item) => acc + Number(item.remaining_amount), 0) || 0;
      return { count, sum };
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

  const { data: openFines } = useQuery({
    queryKey: ["open-fines"],
    queryFn: async () => {
      // Get customer-liability fines with remaining amounts from view_fines_export
      const { data } = await supabase
        .from("view_fines_export")
        .select("remaining_amount, due_date")
        .eq("liability", "Customer")
        .gt("remaining_amount", 0);
      
      const today = new Date().toISOString().split('T')[0];
      const totalCount = data?.length || 0;
      const overdueCount = data?.filter(fine => fine.due_date < today).length || 0;
      const totalAmount = data?.reduce((acc, fine) => acc + Number(fine.remaining_amount), 0) || 0;
      
      return { totalCount, overdueCount, totalAmount };
    },
  });

  // Reminder counts for badges  
  const { data: dueReminders } = useQuery({
    queryKey: ["due-reminders-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("reminder_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "Delivered")
        .eq("reminder_type", "Due");
      return count || 0;
    },
  });

  const { data: overdueReminders } = useQuery({
    queryKey: ["overdue-reminders-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("reminder_events")
        .select("*", { count: "exact", head: true })
        .eq("status", "Delivered")
        .in("reminder_type", ["Overdue1", "OverdueN"]);
      return count || 0;
    },
  });

  const { data: activeReminders } = useQuery({
    queryKey: ["active-reminders"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reminder_events")
        .select("id, reminder_type, status")
        .eq("status", "Delivered");
      
      const due = data?.filter(r => r.reminder_type === "Due").length || 0;
      const overdue = data?.filter(r => r.reminder_type.startsWith("Overdue")).length || 0;
      const upcoming = data?.filter(r => r.reminder_type === "Upcoming").length || 0;
      const total = data?.length || 0;
      
      return { due, overdue, upcoming, total };
    },
  });

  const widgets: DashboardWidget[] = [
    {
      title: "Overdue Payments",
      value: `${overduePayments?.count || 0}`,
      description: `$${(overduePayments?.sum || 0).toLocaleString()} past due`,
      icon: AlertTriangle,
      color: "text-red-500",
      href: "/charges?filter=overdue"
    },
    {
      title: "Due Today",
      value: `${dueToday?.count || 0}`, 
      description: dueReminders && dueReminders > 0 
        ? `$${(dueToday?.sum || 0).toLocaleString()} due (${dueReminders} reminders)` 
        : `$${(dueToday?.sum || 0).toLocaleString()} due today`,
      icon: Calendar,
      color: "text-yellow-500",
      href: "/charges?filter=due-today"
    },
    {
      title: "Upcoming (7 days)",
      value: `${upcoming?.count || 0}`,
      description: `$${(upcoming?.sum || 0).toLocaleString()} due within 7 days`,
      icon: PoundSterling,
      color: "text-blue-500",
      href: "/charges?filter=upcoming"
    },
    {
      title: "Active Rentals",
      value: activeRentals?.toString() || "0",
      description: "Currently active rentals",
      icon: FileText,
      color: "text-green-500",
      href: "/rentals?filter=active"
    },
    {
      title: "Open Fines",
      value: `${openFines?.totalCount || 0}`,
      description: openFines?.overdueCount && openFines.overdueCount > 0 
        ? `$${(openFines?.totalAmount || 0).toLocaleString()} outstanding (${openFines?.overdueCount} overdue)`
        : `$${(openFines?.totalAmount || 0).toLocaleString()} outstanding`,
      icon: AlertTriangle,
      color: openFines?.overdueCount && openFines.overdueCount > 0 ? "text-red-500" : "text-orange-500",
      href: "/fines?filter=open"
    },
    {
      title: "Finance Costs",
      value: `$${(financeCosts || 0).toLocaleString()}`,
      description: "Total finance payments recorded",
      icon: PoundSterling,
      color: "text-purple-500",
      href: "/vehicles"
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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
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
              <PoundSterling className="h-5 w-5 text-primary" />
              Payment Processing
            </CardTitle>
            <CardDescription>Process payments and view history</CardDescription>
          </CardHeader>
        </Card>

        <Card className="card-hover cursor-pointer" onClick={() => navigate("/reminders-new")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Reminders
              {(overdueReminders || 0) > 0 && (
                <Badge variant="destructive" className="ml-2">{overdueReminders}</Badge>
              )}
            </CardTitle>
            <CardDescription>View in-app payment reminders and notifications</CardDescription>
          </CardHeader>
        </Card>
      </div>

      {/* Acceptance Tests */}
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">System Tests</h2>
        <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
          <RentalAcceptanceTest />
          <FinanceAcceptanceTest />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;