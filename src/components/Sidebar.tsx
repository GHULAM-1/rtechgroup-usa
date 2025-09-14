import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { 
  Car, 
  Users, 
  FileText, 
  CreditCard, 
  LayoutDashboard,
  Menu,
  X,
  Bell,
  BarChart3,
  AlertCircle,
  Bookmark,
  TrendingUp,
  Settings,
  Shield
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReminderStats } from "@/hooks/useReminders";

export const Sidebar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { data: reminderStats } = useReminderStats();

  const navigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Vehicles", href: "/vehicles", icon: Car },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Rentals", href: "/rentals", icon: FileText },
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Fines", href: "/fines", icon: AlertCircle },
    { name: "Insurance", href: "/insurance", icon: Shield },
    { name: "Plates", href: "/plates", icon: Bookmark },
    { name: "P&L Dashboard", href: "/pl-dashboard", icon: TrendingUp },
    { 
      name: "Reminders", 
      href: "/reminders", 
      icon: Bell,
      badge: reminderStats?.due || 0
    },
    { name: "Reports", href: "/reports", icon: BarChart3 },
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  // Helper function to determine if item should have spacing after it
  const getSectionSpacing = (index: number) => {
    // Add spacing after Fines (index 5) and Reports (index 10) for section grouping
    return index === 5 || index === 10 ? "mb-2" : "";
  };

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile menu button - only shown on mobile */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="bg-background"
        >
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "app-sidebar",
          isMobileOpen && "mobile-open"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Brand header - aligned with app header height */}
          <div className="flex items-center justify-center px-4" style={{ height: 'var(--header-height)' }}>
            <span className="text-lg font-bold text-primary">RTECHGROUP UK</span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item, index) => {
              const active = isActive(item.href);
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  onClick={() => setIsMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    getSectionSpacing(index)
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-destructive rounded-full">
                      {item.badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="text-xs text-muted-foreground">
              RTECHGROUP UK Fleet Management
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}
    </>
  );
};