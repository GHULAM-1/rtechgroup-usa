import { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { HeaderSearch } from "./HeaderSearch";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  return (
    <div className="app-shell">
      {/* Global header spanning full width */}
      <header className="app-header">
        <div className="flex items-center justify-between h-full px-6 w-full">
          <HeaderSearch />
          <ThemeToggle />
        </div>
      </header>
      
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