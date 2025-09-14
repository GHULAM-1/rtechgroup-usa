import { useState } from "react";
import { Search, Filter, Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { RentalFilters } from "@/hooks/useEnhancedRentals";

interface RentalsFiltersProps {
  filters: RentalFilters;
  onFiltersChange: (filters: RentalFilters) => void;
  onClearFilters: () => void;
}

export const RentalsFilters = ({ filters, onFiltersChange, onClearFilters }: RentalsFiltersProps) => {
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  const updateFilter = (key: keyof RentalFilters, value: any) => {
    onFiltersChange({ ...filters, [key]: value, page: 1 });
  };

  const hasActiveFilters = Object.values(filters).some(value => 
    value && value !== "all" && value !== "" && value !== 1
  );

  return (
    <div className="space-y-4">
      {/* Search and main filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="relative flex-1 min-w-[300px]">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by customer, vehicle reg, or rental #..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={filters.status || "all"} onValueChange={(value) => updateFilter("status", value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.customerType || "all"} onValueChange={(value) => updateFilter("customerType", value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Customer Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="Individual">Individual</SelectItem>
            <SelectItem value="Company">Company</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.duration || "all"} onValueChange={(value) => updateFilter("duration", value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Duration" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Durations</SelectItem>
            <SelectItem value="≤12 mo">≤12 months</SelectItem>
            <SelectItem value="13–24 mo">13–24 months</SelectItem>
            <SelectItem value=">24 mo">&gt;24 months</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.initialPayment || "all"} onValueChange={(value) => updateFilter("initialPayment", value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Initial Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="set">Set</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Advanced filters */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">Start Date:</span>
          
          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[120px] justify-start text-left font-normal",
                  !filters.startDateFrom && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {filters.startDateFrom ? format(filters.startDateFrom, "MMM dd") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.startDateFrom}
                onSelect={(date) => {
                  updateFilter("startDateFrom", date);
                  setStartDateOpen(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[120px] justify-start text-left font-normal",
                  !filters.startDateTo && "text-muted-foreground"
                )}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {filters.startDateTo ? format(filters.startDateTo, "MMM dd") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={filters.startDateTo}
                onSelect={(date) => {
                  updateFilter("startDateTo", date);
                  setEndDateOpen(false);
                }}
                initialFocus
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <Select value={filters.sortBy || "start_date"} onValueChange={(value) => updateFilter("sortBy", value)}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="start_date">Start Date</SelectItem>
            <SelectItem value="end_date">End Date</SelectItem>
            <SelectItem value="monthly_amount">Monthly Amount</SelectItem>
            <SelectItem value="rental_number">Rental #</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filters.sortOrder || "desc"} onValueChange={(value) => updateFilter("sortOrder", value)}>
          <SelectTrigger className="w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="desc">Desc</SelectItem>
            <SelectItem value="asc">Asc</SelectItem>
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button variant="outline" onClick={onClearFilters} className="gap-2">
            <X className="h-4 w-4" />
            Clear Filters
          </Button>
        )}
      </div>
    </div>
  );
};