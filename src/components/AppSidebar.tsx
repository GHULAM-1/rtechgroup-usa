import { NavLink, useLocation } from "react-router-dom";
import { 
  Car, 
  Users, 
  FileText, 
  CreditCard, 
  LayoutDashboard,
  Bell,
  BarChart3,
  AlertCircle,
  Bookmark,
  TrendingUp,
  Settings,
  Shield
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useReminderStats } from "@/hooks/useReminders";

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const { data: reminderStats } = useReminderStats();

  // Main navigation items
  const mainNavigation = [
    { name: "Dashboard", href: "/", icon: LayoutDashboard },
    { name: "Vehicles", href: "/vehicles", icon: Car },
    { name: "Customers", href: "/customers", icon: Users },
    { name: "Rentals", href: "/rentals", icon: FileText },
    { name: "Payments", href: "/payments", icon: CreditCard },
    { name: "Fines", href: "/fines", icon: AlertCircle },
  ];

  // Operations navigation items
  const operationsNavigation = [
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
  ];

  // Settings navigation
  const settingsNavigation = [
    { name: "Settings", href: "/settings", icon: Settings },
  ];

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="flex h-14 items-center justify-center px-4 border-b">
        {!collapsed ? (
          <span className="text-lg font-bold text-primary">RTECHGROUP UK</span>
        ) : (
          <span className="text-lg font-bold text-primary">RT</span>
        )}
      </SidebarHeader>

      <SidebarContent>
        {/* Main Navigation */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Main</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.href)}
                    tooltip={collapsed ? item.name : undefined}
                  >
                    <NavLink to={item.href}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className={collapsed ? "sr-only" : ""}>{item.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Operations Navigation */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Operations</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {operationsNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.href)}
                    tooltip={collapsed ? item.name : undefined}
                  >
                    <NavLink to={item.href} className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2 min-w-0">
                        <item.icon className="h-4 w-4 shrink-0" />
                        <span className={collapsed ? "sr-only" : "truncate"}>{item.name}</span>
                      </div>
                      {!collapsed && item.badge !== undefined && item.badge > 0 && (
                        <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-destructive rounded-full shrink-0">
                          {item.badge}
                        </span>
                      )}
                      {collapsed && item.badge !== undefined && item.badge > 0 && (
                        <span className="absolute -top-1 -right-1 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold leading-none text-white bg-destructive rounded-full">
                          {item.badge > 9 ? '9+' : item.badge}
                        </span>
                      )}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Settings Navigation */}
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>System</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsNavigation.map((item) => (
                <SidebarMenuItem key={item.name}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={isActive(item.href)}
                    tooltip={collapsed ? item.name : undefined}
                  >
                    <NavLink to={item.href}>
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className={collapsed ? "sr-only" : ""}>{item.name}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t">
        <div className="p-4">
          {!collapsed ? (
            <div className="text-xs text-muted-foreground">
              RTECHGROUP UK Fleet Management
            </div>
          ) : (
            <div className="text-xs text-muted-foreground text-center">
              RT
            </div>
          )}
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}