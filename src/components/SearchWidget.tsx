import { useState, useEffect } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { GlobalSearch } from "./GlobalSearch";

export const SearchWidget = () => {
  const [searchOpen, setSearchOpen] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen(true);
        setPopoverOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50">
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              size="lg"
              className="h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
              onClick={() => setPopoverOpen(!popoverOpen)}
            >
              <Search className="h-5 w-5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" className="w-80 p-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">Quick Search</span>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSearchOpen(true);
                  setPopoverOpen(false);
                }}
                className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
              >
                <Search className="h-4 w-4" />
                <span>Search everything...</span>
                <span className="ml-auto text-xs bg-muted px-1.5 py-0.5 rounded">⌘K</span>
              </Button>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Search across:</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span>👤 Customers</span>
                  <span>🚗 Vehicles</span>
                  <span>📄 Rentals</span>
                  <span>⚠️ Fines</span>
                  <span>💷 Payments</span>
                  <span>🛡️ Insurance</span>
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </>
  );
};