import { Badge } from "@/components/ui/badge";

interface FineStatusBadgeProps {
  status: string;
  dueDate: string;
  remainingAmount: number;
}

export const FineStatusBadge = ({ status, dueDate, remainingAmount }: FineStatusBadgeProps) => {
  const getVariant = () => {
    if (status === 'Paid') return 'default';
    if (status === 'Appeal Successful' || status === 'Waived') return 'secondary';
    if (status === 'Appeal Rejected') return 'destructive';
    if (status === 'Appeal Submitted') return 'outline';
    
    // Check if overdue
    const due = new Date(dueDate);
    const today = new Date();
    const isOverdue = due < today && remainingAmount > 0;
    
    if (isOverdue) return 'destructive';
    if (status === 'Partially Paid') return 'secondary';
    
    return 'outline';
  };

  const getDisplayText = () => {
    const due = new Date(dueDate);
    const today = new Date();
    const isOverdue = due < today && remainingAmount > 0;
    
    if (status === 'Appeal Successful') return 'Appeal Successful';
    if (status === 'Appeal Rejected') return 'Appeal Rejected';
    if (status === 'Appeal Submitted') return 'Appeal Submitted';
    if (status === 'Waived') return 'Waived';
    if (status === 'Paid') return 'Paid';
    if (status === 'Partially Paid') return 'Partially Paid';
    
    if (isOverdue) return 'Overdue';
    return 'Open';
  };

  return (
    <Badge variant={getVariant() as any} className="badge-status">
      {getDisplayText()}
    </Badge>
  );
};