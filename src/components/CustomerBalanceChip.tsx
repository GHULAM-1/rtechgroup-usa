import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface CustomerBalanceChipProps {
  balance: number;
  status: 'In Credit' | 'Settled' | 'In Debt';
  totalCharges?: number;
  totalPayments?: number;
  className?: string;
}

export const CustomerBalanceChip = ({ 
  balance, 
  status, 
  totalCharges, 
  totalPayments,
  className = "" 
}: CustomerBalanceChipProps) => {
  const getVariant = () => {
    switch (status) {
      case 'In Credit':
        return 'default';
      case 'Settled':
        return 'secondary';
      case 'In Debt':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getBadgeClasses = () => {
    switch (status) {
      case 'In Credit':
        return 'bg-success text-success-foreground hover:bg-success/80';
      case 'Settled':
        return 'bg-muted text-muted-foreground hover:bg-muted/80';
      case 'In Debt':
        return 'bg-destructive text-destructive-foreground hover:bg-destructive/80';
      default:
        return '';
    }
  };

  const formatCurrency = (amount: number) => `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayText = balance === 0 
    ? 'Settled' 
    : `${status} (${formatCurrency(balance)})`;

  const tooltipContent = totalCharges !== undefined && totalPayments !== undefined
    ? `Charges ${formatCurrency(totalCharges)} • Payments ${formatCurrency(totalPayments)}`
    : displayText;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge 
            variant={getVariant() as any}
            className={`badge-status ${getBadgeClasses()} text-right justify-end min-w-0 ${className}`}
          >
            {displayText}
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};