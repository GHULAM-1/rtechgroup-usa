import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  Search, 
  User, 
  Car, 
  Calendar, 
  AlertTriangle, 
  CreditCard, 
  Hash, 
  Shield,
  Loader2,
  Filter
} from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SearchResult } from "@/lib/searchService";

// Entity emojis as requested
const getEntityEmoji = (category: string): string => {
  switch (category) {
    case "Customers":
      return "👤";
    case "Vehicles":
      return "🚗";
    case "Rentals":
      return "📄";
    case "Payments":
      return "💷";
    case "Fines":
      return "⚠️";
    case "Insurance":
      return "🛡️";
    case "Plates":
      return "🔖";
    default:
      return "🔍";
  }
};

const getIcon = (iconName: string) => {
  switch (iconName) {
    case "user":
      return User;
    case "car":
      return Car;
    case "calendar":
      return Calendar;
    case "alert-triangle":
      return AlertTriangle;
    case "credit-card":
      return CreditCard;
    case "hash":
      return Hash;
    case "shield":
      return Shield;
    default:
      return Search;
  }
};

interface SearchTriggerProps {
  onClick: () => void;
}

export const SearchTrigger = ({ onClick }: SearchTriggerProps) => {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors w-full justify-start"
    >
      <Search className="h-4 w-4" />
      <span className="text-sm">Search everything...</span>
      <CommandShortcut className="ml-auto">⌘K</CommandShortcut>
    </Button>
  );
};

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GlobalSearch = ({ open, onOpenChange }: GlobalSearchProps) => {
  const navigate = useNavigate();
  const {
    query,
    setQuery,
    results,
    isLoading,
    totalResults,
    hasQuery,
    entityFilter,
    setEntityFilter,
    selectedIndex,
    navigateUp,
    navigateDown,
    getSelectedResult,
  } = useGlobalSearch();

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp") {
        e.preventDefault();
        navigateUp();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        navigateDown();
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = getSelectedResult();
        if (selected) {
          handleSelect(selected);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, navigateUp, navigateDown, getSelectedResult, onOpenChange]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    onOpenChange(false);
  };

  const renderGroup = (title: string, items: SearchResult[], emoji: string) => {
    if (items.length === 0) return null;

    return (
      <CommandGroup heading={
        <div className="flex items-center gap-2">
          <span className="text-base">{emoji}</span>
          <span>{title}</span>
          <span className="text-xs text-muted-foreground">({items.length}{items.length === 5 ? '+' : ''})</span>
        </div>
      }>
        {items.map((item, index) => {
          const IconComponent = getIcon(item.icon || "search");
          const globalIndex = Object.values(results)
            .slice(0, Object.keys(results).indexOf(item.category.toLowerCase()))
            .flat().length + index;
          
          return (
            <CommandItem
              key={`${item.category}-${item.id}`}
              onSelect={() => handleSelect(item)}
              className={`flex items-center gap-3 p-3 cursor-pointer ${
                globalIndex === selectedIndex ? 'bg-muted' : ''
              }`}
            >
              <IconComponent className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm truncate">{item.title}</div>
                <div className="text-xs text-muted-foreground truncate">{item.subtitle}</div>
              </div>
            </CommandItem>
          );
        })}
      </CommandGroup>
    );
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <Command shouldFilter={false}>
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 opacity-50" />
          <CommandInput
            placeholder="Search customers, vehicles, rentals, fines, payments, insurance, plates..."
            value={query}
            onValueChange={setQuery}
            className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          />
          <div className="flex items-center gap-2 ml-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="vehicles">Vehicles</SelectItem>
                <SelectItem value="rentals">Rentals</SelectItem>
                <SelectItem value="fines">Fines</SelectItem>
                <SelectItem value="payments">Payments</SelectItem>
                <SelectItem value="insurance">Insurance</SelectItem>
                <SelectItem value="plates">Plates</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <CommandList className="max-h-[400px]">
          {isLoading && hasQuery && (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
            </div>
          )}

          {!isLoading && hasQuery && totalResults === 0 && (
            <CommandEmpty>
              <div className="text-center p-6">
                <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No results found for "{query}"</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Try different search terms or check your spelling. Search supports partial matches and typos.
                </p>
              </div>
            </CommandEmpty>
          )}

          {!hasQuery && (
            <div className="p-6 text-center">
              <Search className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Search across all your fleet management data
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Find customers, vehicles, rentals, fines, payments, insurance, and plates
              </p>
              <div className="mt-4 text-xs text-muted-foreground">
                <p>💡 <strong>Tips:</strong></p>
                <p>• Use ↑/↓ arrows to navigate • Enter to select • Esc to close</p>
                <p>• Supports fuzzy matching for typos (e.g., "merceds" finds "Mercedes")</p>
              </div>
            </div>
          )}

          {hasQuery && !isLoading && totalResults > 0 && (
            <>
              {renderGroup("Customers", results.customers, "👤")}
              {renderGroup("Vehicles", results.vehicles, "🚗")}
              {renderGroup("Rentals", results.rentals, "📄")}
              {renderGroup("Fines", results.fines, "⚠️")}
              {renderGroup("Payments", results.payments, "💷")}
              {renderGroup("Insurance", results.insurance, "🛡️")}
              {renderGroup("Plates", results.plates, "🔖")}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};