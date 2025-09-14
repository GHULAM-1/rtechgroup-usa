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
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        {/* RTECHGROUP Header - 56px height, sticky */}
        <header className="sticky top-0 z-40 h-14 bg-background border-b border-border">
          <div className="flex items-center justify-between h-full px-6">
            <div className="flex-1 max-w-md">
              <SearchTrigger onClick={() => setSearchOpen(true)} />
            </div>
            <ThemeToggle />
          </div>
        </header>
        
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        
        {/* Main content with 24px padding */}
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
};