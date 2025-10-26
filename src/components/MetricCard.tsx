import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LucideIcon, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
  badge?: {
    text: string;
    variant?: "default" | "secondary" | "destructive" | "outline";
  };
}

interface MetricItemProps {
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  isAmount?: boolean;
  className?: string;
}

export function MetricCard({ title, icon: Icon, children, className, badge }: MetricCardProps) {
  return (
    <Card className={cn(
      "min-h-[180px] flex flex-col bg-card hover:bg-accent/50 border transition-all duration-200 cursor-pointer hover:shadow-md",
      className
    )}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4" />}
          {title}
        </CardTitle>
        {badge && (
          <Badge variant={badge.variant || "outline"} className="text-xs">
            {badge.text}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        {children}
      </CardContent>
    </Card>
  );
}

export function MetricItem({ label, value, trend, isAmount, className }: MetricItemProps) {
  const getValueColor = () => {
    if (!trend || trend === "neutral") return "";
    return trend === "up" ? "text-success" : "text-destructive";
  };

  const formatValue = (val: string | number) => {
    if (isAmount && typeof val === "number") {
      return `$${Math.abs(val).toLocaleString()}`;
    }
    return val;
  };

  return (
    <div className={cn("flex justify-between items-center", className)}>
      <span className="text-sm text-muted-foreground">{label}:</span>
      <div className={cn("flex items-center gap-1 font-medium", getValueColor())}>
        {trend === "up" && <TrendingUp className="h-3 w-3" />}
        {trend === "down" && <TrendingDown className="h-3 w-3" />}
        <span>{formatValue(value)}</span>
      </div>
    </div>
  );
}

export function MetricDivider() {
  return <div className="border-t border-border my-2" />;
}