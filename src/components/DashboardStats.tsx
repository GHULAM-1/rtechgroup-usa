import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Car, Users, AlertTriangle, DollarSign } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface StatCardProps {
  title: string;
  value: string;
  change?: string;
  trend?: "up" | "down";
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "destructive";
}

const StatCard = ({ title, value, change, trend, icon: Icon, variant = "default" }: StatCardProps) => {
  const variants = {
    default: "bg-card shadow-card card-hover rounded-lg",
    success: "bg-gradient-success text-success-foreground shadow-hover card-hover rounded-lg",
    warning: "bg-gradient-warning text-warning-foreground shadow-hover card-hover rounded-lg", 
    destructive: "bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground shadow-hover card-hover rounded-lg"
  };

  return (
    <Card className={variants[variant]}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary opacity-80" />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        {change && (
          <div className="flex items-center text-metadata opacity-80 mt-1">
            {trend === "up" ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {change}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const DashboardStats = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <StatCard
        title="Total Fleet"
        value="24"
        change="+2 this month"
        trend="up"
        icon={Car}
      />
      <StatCard
        title="Active Rentals"
        value="18"
        change="+3 this week"
        trend="up"
        icon={Users}
        variant="success"
      />
      <StatCard
        title="Monthly Revenue"
        value="£18,450"
        change="+12% vs last month"
        trend="up"
        icon={DollarSign}
        variant="success"
      />
      <StatCard
        title="Overdue Payments"
        value="3"
        change="2 critical"
        trend="down"
        icon={AlertTriangle}
        variant="warning"
      />
    </div>
  );
};