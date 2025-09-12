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
  TestTube,
  Bell,
  BarChart3,
  Settings
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, permission: "view_all" },
  { name: "Vehicles", href: "/vehicles", icon: Car, permission: "manage_vehicles" },
  { name: "Customers", href: "/customers", icon: Users, permission: "manage_customers" },
  { name: "Rentals", href: "/rentals", icon: FileText, permission: "manage_rentals" },
  { name: "Payments", href: "/payments", icon: CreditCard, permission: "manage_payments" },
  { name: "Reminders", href: "/reminders", icon: Bell, permission: "manage_payments" },
  { name: "Reports", href: "/reports", icon: BarChart3, permission: "view_all" },
];

const settingsNavigation = [
  { name: "Users & Roles", href: "/settings/users", icon: Users, permission: "manage_users" },
  { name: "Reminders", href: "/settings/reminders", icon: Bell, permission: "manage_payments" },
  { name: "Tests", href: "/test", icon: TestTube, permission: "manage_settings" },
];

export const Sidebar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const location = useLocation();
  const { hasPermission } = useAuth();

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <>
      {/* Mobile menu button */}
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
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r transform transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          isMobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Brand */}
          <div className="flex h-16 items-center justify-center border-b px-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <Car className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="text-lg font-semibold">Fleet Manager</span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 p-4">
            {/* Main Navigation */}
            {navigation.map((item) => {
              if (!hasPermission(item.permission)) return null;
              
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
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </NavLink>
              );
            })}

            {/* Settings Section */}
            {settingsNavigation.some(item => hasPermission(item.permission)) && (
              <>
                <div className="pt-4">
                  <button
                    onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                      "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                    <X className={cn(
                      "ml-auto h-3 w-3 transition-transform duration-200",
                      isSettingsOpen ? "rotate-45" : "rotate-0"
                    )} />
                  </button>
                </div>
                
                {isSettingsOpen && (
                  <div className="ml-4 space-y-1">
                    {settingsNavigation.map((item) => {
                      if (!hasPermission(item.permission)) return null;
                      
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
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.name}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="text-xs text-muted-foreground">
              RTECHGROUP UK Fleet Management
            </div>
          </div>
        </div>
      </div>

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