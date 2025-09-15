import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building, UserCheck, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  customer_type?: "Individual" | "Company";
  status: string;
  whatsapp_opt_in: boolean;
  high_switcher?: boolean;
}

interface CustomerSummaryCardsProps {
  customers: Customer[];
}

export const CustomerSummaryCards = ({ customers }: CustomerSummaryCardsProps) => {
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'Active').length;
  const inactiveCustomers = customers.filter(c => c.status === 'Inactive').length;
  const highSwitchers = customers.filter(c => c.high_switcher).length;
  const companies = customers.filter(c => (c.customer_type || c.type) === 'Company').length;

  const cards = [
    {
      title: "Total Customers",
      value: totalCustomers,
      icon: Users,
      description: "All customers in database"
    },
    {
      title: "Active",
      value: activeCustomers,
      icon: UserCheck,
      description: "Currently active customers"
    },
    {
      title: "Companies",
      value: companies,
      icon: Building,
      description: "Business customers"
    },
    {
      title: "High Switchers",
      value: highSwitchers,
      icon: TrendingUp,
      description: "Frequent car changers"
    }
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title} className={cn(
            "transition-all duration-200 cursor-pointer hover:shadow-md",
            card.title === "Active" ? "bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40" :
            card.title === "High Switchers" ? "bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40" :
            "bg-card hover:bg-accent/50 border"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
              <Icon className={cn(
                "h-4 w-4",
                card.title === "Active" ? "text-success" :
                card.title === "High Switchers" ? "text-warning" :
                "text-primary"
              )} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground">
                {card.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};