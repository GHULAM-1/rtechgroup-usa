import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Car, AlertTriangle, Wrench, X, Archive } from "lucide-react";

interface VehicleStatusBadgeProps {
  status: string;
  showTooltip?: boolean;
  compact?: boolean;
}

const getStatusConfig = (status: string) => {
  switch (status.toLowerCase()) {
    case 'available':
      return {
        variant: 'default' as const,
        icon: Car,
        color: 'text-success',
        tooltip: 'Vehicle is available for rental'
      };
    case 'rented':
      return {
        variant: 'secondary' as const,
        icon: Car,
        color: 'text-primary',
        tooltip: 'Vehicle is currently rented out'
      };
    case 'maintenance':
      return {
        variant: 'destructive' as const,
        icon: Wrench,
        color: 'text-warning',
        tooltip: 'Vehicle is in maintenance'
      };
    case 'disposed':
      return {
        variant: 'destructive' as const,
        icon: Archive,
        color: 'text-destructive',
        tooltip: 'Vehicle has been disposed of'
      };
    case 'sold':
      return {
        variant: 'outline' as const,
        icon: X,
        color: 'text-muted-foreground',
        tooltip: 'Vehicle has been sold'
      };
    default:
      return {
        variant: 'outline' as const,
        icon: AlertTriangle,
        color: 'text-muted-foreground',
        tooltip: `Status: ${status}`
      };
  }
};

export function VehicleStatusBadge({ status, showTooltip = true, compact = false }: VehicleStatusBadgeProps) {
  const config = getStatusConfig(status);
  const Icon = config.icon;

  const badge = (
    <Badge variant={config.variant} className="flex items-center gap-1">
      <Icon className="h-3 w-3" />
      {!compact && <span className="capitalize">{status}</span>}
    </Badge>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent>
          <p>{config.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}