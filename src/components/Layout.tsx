import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* RTECHGROUP Header - 56px height, sticky */}
        <header className="sticky top-0 z-40 h-14 bg-background border-b border-border">
          <div className="flex items-center justify-between h-full px-6">
            <div className="text-sm text-muted-foreground">
              Fleet Management System
            </div>
            <ThemeToggle />
          </div>
        </header>
        
        {/* Main content with 24px padding */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};