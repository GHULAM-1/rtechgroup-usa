import { Badge } from "@/components/ui/badge";
import { getInsuranceStatusInfo, type InsurancePolicyStatus } from "@/lib/insuranceUtils";

interface InsurancePolicyStatusChipProps {
  status: InsurancePolicyStatus;
  expiryDate: string;
  className?: string;
}

export function InsurancePolicyStatusChip({ 
  status, 
  expiryDate, 
  className 
}: InsurancePolicyStatusChipProps) {
  const statusInfo = getInsuranceStatusInfo(status, expiryDate);

  const getVariant = () => {
    switch (statusInfo.level) {
      case "ok":
        return "default";
      case "due_soon":
        return "secondary";
      case "expired":
      case "suspended":
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <Badge variant={getVariant()} className={className}>
      {statusInfo.label}
    </Badge>
  );
}