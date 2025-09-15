import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Plus } from "lucide-react";
import { DashboardKPICards } from "@/components/DashboardKPICards";
import { RecentActivity } from "@/components/RecentActivity";
import { FleetOverview } from "@/components/FleetOverview";
import { ComplianceOverviewCard } from "@/components/ComplianceOverviewCard";
import { useDashboardKPIs } from "@/hooks/useDashboardKPIs";
import { format, startOfMonth, endOfMonth, startOfYear, endOfYear, subMonths } from "date-fns";

interface DateRange {
  from: string;
  to: string;
  label: string;
}

const getDateRanges = (): DateRange[] => {
  const now = new Date();
  return [
    {
      from: format(startOfMonth(now), 'yyyy-MM-dd'),
      to: format(endOfMonth(now), 'yyyy-MM-dd'),
      label: 'This Month'
    },
    {
      from: format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
      to: format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd'),
      label: 'Last Month'
    },
    {
      from: format(startOfYear(now), 'yyyy-MM-dd'),
      to: format(endOfYear(now), 'yyyy-MM-dd'),
      label: 'This Year'
    }
  ];
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get date range from URL or default to "This Month"
  const dateRanges = getDateRanges();
  const defaultRange = dateRanges[0]; // This Month
  const selectedRangeLabel = searchParams.get('range') || 'This Month';
  const selectedRange = dateRanges.find(r => r.label === selectedRangeLabel) || defaultRange;
  
  // Use custom from/to if provided in URL, otherwise use selected range
  const from = searchParams.get('from') || selectedRange.from;
  const to = searchParams.get('to') || selectedRange.to;

  // Fetch dashboard KPIs
  const { data: kpis, isLoading, error } = useDashboardKPIs({
    from,
    to,
    timezone: 'Europe/London'
  });

  const handleDateRangeChange = (value: string) => {
    const range = dateRanges.find(r => r.label === value);
    if (range) {
      const newParams = new URLSearchParams(searchParams);
      newParams.set('range', range.label);
      newParams.set('from', range.from);
      newParams.set('to', range.to);
      setSearchParams(newParams);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header with Date Range Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Fleet Dashboard</h1>
          <p className="text-muted-foreground">
            One-glance control room for fleet operations
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedRangeLabel} onValueChange={handleDateRangeChange}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRanges.map((range) => (
                  <SelectItem key={range.label} value={range.label}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => navigate("/rentals/new")}>
            <Plus className="h-4 w-4 mr-2" />
            New Rental
          </Button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <DashboardKPICards data={kpis} isLoading={isLoading} error={error} />
      
      {/* Compliance and Fleet Overview */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        <div className="md:col-span-1">
          <ComplianceOverviewCard />
        </div>
        <div className="md:col-span-1 lg:col-span-2">
          <FleetOverview />
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6">
        <RecentActivity />
      </div>
    </div>
  );
};

export default Dashboard;