import { Badge } from "@/components/ui/badge";
import { CreditCard, ShoppingCart } from "lucide-react";

interface AcquisitionBadgeProps {
  acquisitionType: string;
}

export const AcquisitionBadge = ({ acquisitionType }: AcquisitionBadgeProps) => {
  const config = {
    Purchase: {
      variant: 'default' as const,
      icon: ShoppingCart,
      className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
    },
    Finance: {
      variant: 'secondary' as const,
      icon: CreditCard,
      className: "bg-blue-100 text-blue-700 hover:bg-blue-200"
    }
  };

  const { variant, icon: Icon, className } = config[acquisitionType as keyof typeof config] || config.Purchase;

  return (
    <Badge variant={variant} className={`flex items-center gap-1 ${className}`}>
      <Icon className="h-3 w-3" />
      {acquisitionType}
    </Badge>
  );
};