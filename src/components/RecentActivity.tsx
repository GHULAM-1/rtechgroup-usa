import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Activity, PoundSterling, Car, User } from "lucide-react";

interface ActivityItem {
  id: string;
  type: "payment" | "rental" | "vehicle";
  description: string;
  amount?: number;
  customer?: string;
  time: string;
  status: "success" | "pending" | "warning";
}

const mockActivities: ActivityItem[] = [
  {
    id: "1",
    type: "payment",
    description: "Monthly payment received",
    amount: 1200,
    customer: "John Smith",
    time: "2 hours ago",
    status: "success"
  },
  {
    id: "2", 
    type: "rental",
    description: "New rental agreement signed",
    customer: "Sarah Johnson",
    time: "5 hours ago",
    status: "success"
  },
  {
    id: "3",
    type: "vehicle",
    description: "Audi A4 returned from rental",
    time: "1 day ago",
    status: "pending"
  },
  {
    id: "4",
    type: "payment",
    description: "Payment overdue",
    amount: 950,
    customer: "Mike Wilson",
    time: "2 days ago",
    status: "warning"
  }
];

const ActivityIcon = ({ type }: { type: string }) => {
  const icons = {
    payment: PoundSterling,
    rental: User,
    vehicle: Car
  };
  
  const Icon = icons[type as keyof typeof icons];
  return <Icon className="h-4 w-4" />;
};

const StatusBadge = ({ status }: { status: string }) => {
  const variants = {
    success: "badge-status bg-success-light text-success border-success",
    pending: "badge-status bg-warning-light text-warning border-warning",
    warning: "badge-status bg-destructive-light text-destructive border-destructive"
  };
  
  return (
    <Badge variant="outline" className={variants[status as keyof typeof variants]}>
      {status}
    </Badge>
  );
};

export const RecentActivity = () => {
  return (
    <Card className="shadow-card rounded-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {mockActivities.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4 p-3 rounded-lg hover:bg-muted/50 transition-all duration-200">
              <div className="p-2 bg-gradient-subtle rounded-full">
                <ActivityIcon type={activity.type} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{activity.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  {activity.customer && (
                    <span className="text-metadata text-muted-foreground">{activity.customer}</span>
                  )}
                  {activity.amount && (
                    <span className="text-metadata font-semibold text-success">£{activity.amount}</span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <StatusBadge status={activity.status} />
                <p className="text-metadata text-muted-foreground mt-1">{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};