import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./GlobalSearch";

export const HeaderSearch = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setSearchOpen(true)}
        className="gap-2 text-muted-foreground hover:text-foreground border-muted-foreground/20 hover:border-muted-foreground/40"
      >
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search...</span>
        <span className="hidden md:inline text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</span>
      </Button>
      
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};