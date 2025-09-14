import { ReactNode, useState, useEffect } from "react";
import { Sidebar } from "./Sidebar";
import { ThemeToggle } from "./ThemeToggle";
import { GlobalSearch, SearchTrigger } from "./GlobalSearch";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [searchOpen, setSearchOpen] = useState(false);

  // Listen for global search keyboard shortcut
  useEffect(() => {
    const handleOpenSearch = () => setSearchOpen(true);
    window.addEventListener("open-global-search", handleOpenSearch);
    return () => window.removeEventListener("open-global-search", handleOpenSearch);
  }, []);

  return (
    <div className="app-shell">
      {/* Global header spanning full width */}
      <header className="app-header">
        <div className="flex items-center justify-between h-full px-6 w-full">
          <div className="flex-1 max-w-md">
            <SearchTrigger onClick={() => setSearchOpen(true)} />
          </div>
          <ThemeToggle />
        </div>
      </header>
      
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
      
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