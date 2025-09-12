import { Car, Users, CreditCard, BarChart3, Home, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Fleet", href: "/fleet", icon: Car },
  { name: "Customers", href: "/customers", icon: Users },
  { name: "Payments", href: "/payments", icon: CreditCard },
  { name: "P&L Reports", href: "/reports", icon: BarChart3 },
];

export const Sidebar = () => {
  return (
    <div className="flex flex-col w-64 bg-sidebar border-r border-sidebar-border">
      <div className="flex items-center justify-center h-16 px-4 border-b border-sidebar-border">
        <h1 className="text-xl font-bold text-sidebar-primary">FleetFlow</h1>
      </div>
      
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <Button
              key={item.name}
              variant="ghost"
              className={cn(
                "w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground rounded-lg",
                "h-10 px-3 font-medium transition-all duration-200"
              )}
            >
              <Icon className="mr-3 h-4 w-4" />
              {item.name}
            </Button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <Button className="w-full bg-gradient-primary text-primary-foreground hover:opacity-90 transition-all duration-200 rounded-lg focus:ring-2 focus:ring-primary">
          <PlusCircle className="mr-2 h-4 w-4" />
          Quick Add
        </Button>
      </div>
    </div>
  );
};