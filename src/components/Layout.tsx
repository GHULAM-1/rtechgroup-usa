import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { SearchWidget } from "./SearchWidget";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="app-shell">
      {/* Global header spanning full width */}
      <header className="app-header">
        <div className="flex items-center justify-end h-full px-6 w-full">
          <ThemeToggle />
        </div>
      </header>
      
      {/* Floating search widget */}
      <SearchWidget />
      
      {/* App body with sidebar and main content */}
      <div className="app-body">
        <Sidebar />
        <main className="app-main p-6">
          {children}
        </main>
      </div>
    </div>
  );
};