import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, User, Car, Calendar, AlertTriangle, CreditCard, Hash, Loader2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { useGlobalSearch } from "@/hooks/useGlobalSearch";
import { SearchResult } from "@/lib/searchService";

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
  } = useGlobalSearch();

  const handleSelect = (result: SearchResult) => {
    navigate(result.url);
    onOpenChange(false);
  };

  const renderGroup = (title: string, items: SearchResult[]) => {
    if (items.length === 0) return null;

    return (
      <CommandGroup heading={title}>
        {items.map((item) => {
          const IconComponent = getIcon(item.icon || "search");
          return (
            <CommandItem
              key={`${item.category}-${item.id}`}
              onSelect={() => handleSelect(item)}
              className="flex items-center gap-3 p-3 cursor-pointer"
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
        <CommandInput
          placeholder="Search for customers, vehicles, rentals, fines..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
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
                  Try searching for customer names, vehicle registrations, or fine references.
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
                Find customers, vehicles, rentals, fines, payments, and plates
              </p>
            </div>
          )}

          {hasQuery && !isLoading && (
            <>
              {renderGroup("Customers", results.customers)}
              {renderGroup("Vehicles", results.vehicles)}
              {renderGroup("Rentals", results.rentals)}
              {renderGroup("Fines", results.fines)}
              {renderGroup("Payments", results.payments)}
              {renderGroup("Plates", results.plates)}
            </>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
};