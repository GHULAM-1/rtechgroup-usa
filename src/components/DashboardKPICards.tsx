import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  AlertTriangle, 
  Calendar, 
  PoundSterling, 
  Users, 
  Bell, 
  Info,
  ExternalLink,
  DollarSign
} from "lucide-react";
import { DashboardKPIs } from "@/hooks/useDashboardKPIs";

interface DashboardKPICardsProps {
  data?: DashboardKPIs;
  isLoading: boolean;
  error?: Error | null;
}

const formatCurrency = (amount: number) => `$${amount.toLocaleString()}`;

const KPICard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant = "default",
  onClick,
  tooltip,
  badge,
  isEmpty = false,
  emptyMessage
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ComponentType<any>;
  variant?: "default" | "success" | "warning" | "danger";
  onClick?: () => void;
  tooltip?: string;
  badge?: string;
  isEmpty?: boolean;
  emptyMessage?: string;
}) => {
  const variants = {
    default: "bg-card hover:bg-accent/50 border shadow-sm",
    success: "bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40",
    warning: "bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40",
    danger: "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40"
  };

  const iconVariants = {
    default: "text-muted-foreground",
    success: "text-success",
    warning: "text-warning", 
    danger: "text-destructive"
  };

  const content = (
    <Card 
      className={`${variants[variant]} transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-md' : ''}`}
      onClick={onClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {tooltip && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs">{tooltip}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {badge && (
            <Badge variant="secondary" className="h-4 text-xs px-1">
              {badge}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Icon className={`h-4 w-4 ${iconVariants[variant]}`} />
          {onClick && <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
      </CardHeader>
      <CardContent>
        {isEmpty && emptyMessage ? (
          <div className="text-sm text-muted-foreground">{emptyMessage}</div>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {subtitle && (
              <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  return content;
};

const LoadingSkeleton = () => (
  <Card className="bg-card border shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-4 rounded" />
    </CardHeader>
    <CardContent>
      <Skeleton className="h-8 w-16 mb-2" />
      <Skeleton className="h-3 w-20" />
    </CardContent>
  </Card>
);

export const DashboardKPICards = ({ data, isLoading, error }: DashboardKPICardsProps) => {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <LoadingSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="col-span-full bg-destructive/5 border-destructive/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">Failed to load dashboard data</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Overdue Payments */}
      <KPICard
        title="Overdue Payments"
        value={data.overdue.count}
        subtitle={data.overdue.count > 0 ? formatCurrency(data.overdue.amount) : undefined}
        icon={AlertTriangle}
        variant={data.overdue.count > 0 ? "danger" : "default"}
        tooltip="Rental charges past due date with remaining balance"
        onClick={() => navigate('/payments?filter=overdue')}
        isEmpty={data.overdue.count === 0}
        emptyMessage="No overdue payments"
      />

      {/* Due Today */}
      <KPICard
        title="Due Today"
        value={data.dueToday.count}
        subtitle={data.dueToday.count > 0 ? formatCurrency(data.dueToday.amount) : undefined}
        icon={Calendar}
        variant={data.dueToday.count > 0 ? "warning" : "default"}
        tooltip="Charges due today (unpaid)"
        onClick={() => navigate('/payments?filter=due-today')}
        isEmpty={data.dueToday.count === 0}
        emptyMessage="Nothing due today"
      />

      {/* Upcoming 7 Days */}
      <KPICard
        title="Upcoming (7d)"
        value={data.upcoming7d.count}
        subtitle={data.upcoming7d.count > 0 ? formatCurrency(data.upcoming7d.amount) : undefined}
        icon={Calendar}
        variant={data.upcoming7d.count > 0 ? "warning" : "default"}
        tooltip="Charges approaching in next 7 days"
        onClick={() => navigate('/payments?filter=upcoming-7d')}
        isEmpty={data.upcoming7d.count === 0}
        emptyMessage="No upcoming charges"
      />

      {/* Active Rentals */}
      <KPICard
        title="Active Rentals"
        value={data.activeRentals.count}
        subtitle="Currently active rentals"
        icon={Users}
        variant="success"
        onClick={() => navigate('/rentals?status=Active')}
        isEmpty={data.activeRentals.count === 0}
        emptyMessage="No active rentals"
      />

      {/* Open Fines */}
      <KPICard
        title="Open Fines"
        value={data.finesOpen.count}
        subtitle={data.finesOpen.count > 0 ? formatCurrency(data.finesOpen.amount) : undefined}
        icon={AlertTriangle}
        variant={data.finesOpen.count > 0 ? "warning" : "default"}
        badge={data.finesOpen.dueSoonCount > 0 ? `${data.finesOpen.dueSoonCount} due soon` : undefined}
        onClick={() => navigate('/fines?status=open')}
        isEmpty={data.finesOpen.count === 0}
        emptyMessage="No open fines"
      />

      {/* Finance Costs */}
      <KPICard
        title="Finance Costs"
        value={formatCurrency(data.financeCosts.amount)}
        subtitle="Selected period"
        icon={DollarSign}
        variant="default"
        onClick={() => navigate('/pl-dashboard?category=Finance')}
        tooltip="Finance-related costs for the selected date range"
      />

      {/* Reminders */}
      <KPICard
        title="Reminders"
        value={data.remindersDue.count}
        subtitle="View in-app reminders and notifications"
        icon={Bell}
        variant={data.remindersDue.count > 0 ? "warning" : "default"}
        onClick={() => navigate('/reminders')}
        isEmpty={data.remindersDue.count === 0}
        emptyMessage="No active reminders"
      />

      {/* Navigation Tile - Vehicle Management */}
      <KPICard
        title="Vehicle Management"
        value="Manage"
        subtitle="Fleet overview and operations"
        icon={Users}
        variant="default"
        onClick={() => navigate('/vehicles')}
      />
    </div>
  );
};