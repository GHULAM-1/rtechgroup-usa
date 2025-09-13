import { Badge } from "@/components/ui/badge";

interface PaymentStatusBadgeProps {
  applied: number;
  amount: number;
}

export const PaymentStatusBadge = ({ applied, amount }: PaymentStatusBadgeProps) => {
  if (applied === 0) {
    return (
      <Badge variant="outline" className="text-xs">
        Unapplied
      </Badge>
    );
  } else if (applied >= amount) {
    return (
      <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-700">
        Applied
      </Badge>
    );
  } else {
    return (
      <Badge variant="secondary" className="text-xs">
        Part-applied
      </Badge>
    );
  }
};