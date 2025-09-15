import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, TrendingUp, TrendingDown, PoundSterling, Car, Calendar, Download, ArrowUpDown, ArrowUp, ArrowDown, BarChart3 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useToast } from '@/hooks/use-toast';

interface PLSummary {
  total_revenue: number;
  total_costs: number;
  net_profit: number;
  vehicles_tracked: number;
}

interface VehiclePL {
  vehicle_id: string;
  vehicle_reg: string;
  make_model: string;
  revenue_rental: number;
  revenue_fees: number;
  cost_acquisition: number;
  cost_service: number;
  cost_fines: number;
  cost_other: number;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
  is_disposed?: boolean;
  disposal_date?: string;
}

interface MonthlyPL {
  month: string;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
  vehicle_count: number;
}

type SortField = keyof VehiclePL | 'none';
type SortDirection = 'asc' | 'desc';

const PLDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for filters and sorting - initialize from URL params
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>(() => {
    const dateRangeParam = searchParams.get('dateRange');
    if (dateRangeParam) {
      const [start, end] = dateRangeParam.split(',');
      return {
        from: start ? new Date(start) : startOfMonth(subMonths(new Date(), 11)),
        to: end ? new Date(end) : endOfMonth(new Date()),
      };
    }
    return {
      from: startOfMonth(subMonths(new Date(), 11)),
      to: endOfMonth(new Date()),
    };
  });
  const [groupByMonth, setGroupByMonth] = useState(() => searchParams.get('groupByMonth') === 'true');
  const [sortField, setSortField] = useState<SortField>('net_profit');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showChart, setShowChart] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (dateRange?.from && dateRange?.to) {
      params.set('dateRange', `${dateRange.from.toISOString()},${dateRange.to.toISOString()}`);
    }
    if (groupByMonth) {
      params.set('groupByMonth', 'true');
    }
    setSearchParams(params, { replace: true });
  }, [dateRange, groupByMonth, setSearchParams]);

  // Fetch P&L summary data
  const { data: plSummary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['pl-summary', dateRange],
    queryFn: async (): Promise<PLSummary> => {
      const { data, error } = await supabase
        .from('view_pl_consolidated')
        .select('*')
        .single();

      if (error) throw error;

      return {
        total_revenue: data.total_revenue || 0,
        total_costs: data.total_costs || 0,
        net_profit: data.net_profit || 0,
        vehicles_tracked: 0, // Will be fetched separately
      };
    },
  });

  // Fetch vehicle count
  const { data: vehicleCount } = useQuery({
    queryKey: ['vehicle-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('vehicles')
        .select('*', { count: 'exact', head: true });

      if (error) throw error;
      return count || 0;
    },
  });

  // Fetch vehicle P&L data
  const { data: vehiclePLData, isLoading: isVehicleLoading } = useQuery({
    queryKey: ['vehicle-pl', dateRange, groupByMonth],
    queryFn: async (): Promise<VehiclePL[]> => {
      const { data, error } = await supabase
        .from('view_pl_by_vehicle')
        .select(`
          vehicle_id,
          vehicle_reg,
          make_model,
          revenue_rental,
          revenue_fees,
          cost_acquisition,
          cost_service,
          cost_fines,
          cost_other,
          total_revenue,
          total_costs,
          net_profit
        `);

      if (error) throw error;

      // Fetch vehicle disposal info separately
      const { data: vehiclesData, error: vehiclesError } = await supabase
        .from('vehicles')
        .select('id, is_disposed, disposal_date');

      if (vehiclesError) throw vehiclesError;

      // Merge the data
      return (data || []).map(plItem => {
        const vehicleInfo = vehiclesData?.find(v => v.id === plItem.vehicle_id);
        return {
          ...plItem,
          is_disposed: vehicleInfo?.is_disposed || false,
          disposal_date: vehicleInfo?.disposal_date || null,
        };
      });
    },
  });

  // Fetch monthly P&L data when grouping by month
  const { data: monthlyPLData } = useQuery({
    queryKey: ['monthly-pl', dateRange],
    queryFn: async (): Promise<MonthlyPL[]> => {
      // This would be a more complex query to group P&L entries by month
      // For now, we'll return mock data structure
      const { data, error } = await supabase
        .from('pnl_entries')
        .select('entry_date, amount, side')
        .gte('entry_date', format(dateRange.from, 'yyyy-MM-dd'))
        .lte('entry_date', format(dateRange.to, 'yyyy-MM-dd'))
        .order('entry_date');

      if (error) throw error;

      // Group by month
      const monthlyData: { [key: string]: MonthlyPL } = {};
      
      data?.forEach((entry) => {
        const monthKey = format(new Date(entry.entry_date), 'yyyy-MM');
        
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = {
            month: format(new Date(entry.entry_date), 'MMM yyyy'),
            total_revenue: 0,
            total_costs: 0,
            net_profit: 0,
            vehicle_count: 0,
          };
        }

        if (entry.side === 'Revenue') {
          monthlyData[monthKey].total_revenue += entry.amount;
        } else if (entry.side === 'Cost') {
          monthlyData[monthKey].total_costs += entry.amount;
        }
      });

      // Calculate net profit for each month
      Object.values(monthlyData).forEach((month) => {
        month.net_profit = month.total_revenue - month.total_costs;
      });

      return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
    },
    enabled: groupByMonth,
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: 'GBP',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedVehicleData = useMemo(() => {
    if (!vehiclePLData || sortField === 'none') return vehiclePLData;
    
    return [...vehiclePLData].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      // Handle number comparison
      const aNum = typeof aValue === 'number' ? aValue : 0;
      const bNum = typeof bValue === 'number' ? bValue : 0;
      
      return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
    });
  }, [vehiclePLData, sortField, sortDirection]);

  const categoryTotals = useMemo(() => {
    if (!vehiclePLData) return null;
    
    return vehiclePLData.reduce((acc, vehicle) => ({
      revenue_rental: acc.revenue_rental + (vehicle.revenue_rental || 0),
      revenue_fees: acc.revenue_fees + (vehicle.revenue_fees || 0),
      cost_acquisition: acc.cost_acquisition + (vehicle.cost_acquisition || 0),
      cost_service: acc.cost_service + (vehicle.cost_service || 0),
      cost_fines: acc.cost_fines + (vehicle.cost_fines || 0),
      cost_other: acc.cost_other + (vehicle.cost_other || 0),
      total_revenue: acc.total_revenue + (vehicle.total_revenue || 0),
      total_costs: acc.total_costs + (vehicle.total_costs || 0),
      net_profit: acc.net_profit + (vehicle.net_profit || 0),
    }), {
      revenue_rental: 0,
      revenue_fees: 0,
      cost_acquisition: 0,
      cost_service: 0,
      cost_fines: 0,
      cost_other: 0,
      total_revenue: 0,
      total_costs: 0,
      net_profit: 0,
    });
  }, [vehiclePLData]);

  const exportToCSV = () => {
    try {
      const dataToExport = groupByMonth ? monthlyPLData : sortedVehicleData;
      if (!dataToExport?.length) {
        toast({
          title: "No Data",
          description: "No data available to export.",
          variant: "destructive",
        });
        return;
      }

      const headers = groupByMonth 
        ? ['Month', 'Revenue', 'Costs', 'Net Profit', 'Vehicles']
        : ['Vehicle', 'Make/Model', 'Revenue', 'Initial Fees', 'Services', 'Fines', 'Other', 'Total Costs', 'Net Profit'];
      
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => {
          if (groupByMonth) {
            const monthRow = row as MonthlyPL;
            return [
              monthRow.month,
              monthRow.total_revenue,
              monthRow.total_costs,
              monthRow.net_profit,
              monthRow.vehicle_count,
            ].join(',');
          } else {
            const vehicleRow = row as VehiclePL;
            return [
              `"${vehicleRow.vehicle_reg}"`,
              `"${vehicleRow.make_model}"`,
              vehicleRow.revenue_rental || 0,
              vehicleRow.revenue_fees || 0,
              vehicleRow.cost_service || 0,
              vehicleRow.cost_fines || 0,
              vehicleRow.cost_other || 0,
              vehicleRow.total_costs || 0,
              vehicleRow.net_profit || 0,
            ].join(',');
          }
        })
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `pl-dashboard-${groupByMonth ? 'monthly' : 'vehicle'}-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: "Export Successful",
        description: "P&L data has been exported to CSV.",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      className="h-auto p-0 font-medium hover:bg-transparent"
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center gap-1">
        {children}
        {sortField === field ? (
          sortDirection === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-50" />
        )}
      </div>
    </Button>
  );

  const getStatusBadge = (vehicle: VehiclePL) => {
    // Show disposal status first if vehicle is disposed
    if (vehicle.is_disposed) {
      return <Badge variant="secondary" className="bg-muted text-muted-foreground">Disposed</Badge>;
    }
    
    // Otherwise show profit/loss status
    const netProfit = vehicle.net_profit || 0;
    if (netProfit > 0) {
      return <Badge className="bg-success text-success-foreground">Profitable</Badge>;
    } else if (netProfit < 0) {
      return <Badge className="bg-destructive text-destructive-foreground">Loss</Badge>;
    } else {
      return <Badge variant="secondary">Break Even</Badge>;
    }
  };

  const getTotalsBadge = (netProfit: number) => {
    if (netProfit > 0) {
      return <Badge className="bg-success text-success-foreground">Profitable</Badge>;
    } else if (netProfit < 0) {
      return <Badge className="bg-destructive text-destructive-foreground">Loss</Badge>;
    } else {
      return <Badge variant="secondary">Break Even</Badge>;
    }
  };

  const handleMonthClick = (monthData: MonthlyPL) => {
    const params = new URLSearchParams();
    if (dateRange?.from && dateRange?.to) {
      params.set('from', `${dateRange.from.toISOString()},${dateRange.to.toISOString()}`);
    }
    if (groupByMonth) {
      params.set('groupByMonth', 'true');
    }
    const monthDate = new Date(`${monthData.month} 1, ${new Date().getFullYear()}`);
    const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
    navigate(`/pl-dashboard/monthly/${monthStr}?${params.toString()}`);
  };

  const handleVehicleClick = (vehicleData: VehiclePL) => {
    const params = new URLSearchParams({ tab: 'pl' });
    if (dateRange?.from && dateRange?.to) {
      params.set('dateRange', `${dateRange.from.toISOString()},${dateRange.to.toISOString()}`);
    }
    navigate(`/vehicles/${vehicleData.vehicle_id}?${params.toString()}`);
  };

  const summaryCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(plSummary?.total_revenue || 0),
      icon: TrendingUp,
      trend: 'positive' as const,
    },
    {
      title: 'Total Costs',
      value: formatCurrency(plSummary?.total_costs || 0),
      icon: TrendingDown,
      trend: 'negative' as const,
    },
    {
      title: 'Net Profit',
      value: formatCurrency(plSummary?.net_profit || 0),
      icon: PoundSterling,
      trend: (plSummary?.net_profit || 0) > 0 ? 'positive' : (plSummary?.net_profit || 0) < 0 ? 'negative' : 'neutral' as const,
    },
    {
      title: 'Vehicles Tracked',
      value: vehicleCount?.toString() || '0',
      icon: Car,
      trend: 'neutral' as const,
    },
  ];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Global P&L Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track profitability across your entire fleet
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 items-end sm:items-center">
          <Button
            variant="outline"
            onClick={exportToCSV}
            className="flex items-center gap-2"
            disabled={(!vehiclePLData?.length && !monthlyPLData?.length)}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
          
          {groupByMonth && (
            <Button
              variant="outline"
              onClick={() => setShowChart(!showChart)}
              className="flex items-center gap-2"
            >
              <BarChart3 className="h-4 w-4" />
              {showChart ? 'Show Table' : 'Show Chart'}
            </Button>
          )}
          
          <Button
            variant={groupByMonth ? "default" : "outline"}
            onClick={() => {
              setGroupByMonth(!groupByMonth);
              setShowChart(false);
            }}
            className="flex items-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            Group by Month
          </Button>
          
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[280px] justify-start text-left font-normal",
                  !dateRange && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {dateRange?.from ? (
                  dateRange.to ? (
                    <>
                      {format(dateRange.from, "LLL dd, y")} -{" "}
                      {format(dateRange.to, "LLL dd, y")}
                    </>
                  ) : (
                    format(dateRange.from, "LLL dd, y")
                  )
                ) : (
                  <span>Pick a date range</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                initialFocus
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {summaryCards.map((card, index) => (
          <Card key={index} className={cn(
            "shadow-sm transition-all duration-200 cursor-pointer hover:shadow-md",
            card.title === 'Revenue' ? "bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40" :
            card.title === 'Costs' ? "bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20 hover:border-warning/40" :
            card.title === 'Net Profit' && card.trend === 'positive' ? "bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40" :
            card.title === 'Net Profit' && card.trend === 'negative' ? "bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 hover:border-destructive/40" :
            "bg-card hover:bg-accent/50 border"
          )}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={cn(
                "h-4 w-4",
                card.title === 'Revenue' ? "text-success" :
                card.title === 'Costs' ? "text-warning" :
                card.title === 'Net Profit' && card.trend === 'positive' ? "text-success" :
                card.title === 'Net Profit' && card.trend === 'negative' ? "text-destructive" :
                "text-muted-foreground"
              )} />
            </CardHeader>
            <CardContent>
              <div className={cn(
                "text-2xl font-bold",
                card.title === 'Net Profit' && card.trend === 'positive' ? "text-success" :
                card.title === 'Net Profit' && card.trend === 'negative' ? "text-destructive" :
                ""
              )}>
                {card.value}
              </div>
              <div className="flex items-center mt-2 text-xs text-muted-foreground">
                {card.trend === 'positive' && (
                  <>
                    <TrendingUp className="h-3 w-3 text-success mr-1" />
                    <span>Positive</span>
                  </>
                )}
                {card.trend === 'negative' && (
                  <>
                    <TrendingDown className="h-3 w-3 text-destructive mr-1" />
                    <span>Negative</span>
                  </>
                )}
                {card.trend === 'neutral' && (
                  <span>—</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vehicle Profitability Table or Monthly View */}
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {groupByMonth ? 'Monthly Profitability' : 'Vehicle Profitability'}
          </CardTitle>
          <CardDescription>
            {groupByMonth 
              ? 'Profitability breakdown by month'
              : 'Click on a vehicle row to view detailed P&L tab'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupByMonth ? (
            showChart ? (
              // Monthly chart view
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                   <LineChart 
                     data={monthlyPLData}
                     onClick={(data) => {
                       if (data && data.activeLabel) {
                         // Convert month name to YYYY-MM format
                         const monthDate = new Date(`${data.activeLabel} 1, ${new Date().getFullYear()}`);
                         const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
                         navigate(`/pl-dashboard/monthly/${monthStr}`);
                       }
                     }}
                   >
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" tickFormatter={(value) => `£${(value / 1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                      labelClassName="text-foreground"
                      contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}
                    />
                     <Line 
                       type="monotone" 
                       dataKey="total_revenue" 
                       stroke="hsl(var(--success))" 
                       strokeWidth={2} 
                       name="Revenue"
                       className="cursor-pointer"
                     />
                     <Line 
                       type="monotone" 
                       dataKey="total_costs" 
                       stroke="hsl(var(--destructive))" 
                       strokeWidth={2} 
                       name="Costs"
                       className="cursor-pointer"
                     />
                     <Line 
                       type="monotone" 
                       dataKey="net_profit" 
                       stroke="hsl(var(--primary))" 
                       strokeWidth={2} 
                       name="Net Profit"
                       className="cursor-pointer"
                     />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              // Monthly table view
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Costs</TableHead>
                      <TableHead className="text-right">Net Profit</TableHead>
                      <TableHead className="text-right">Vehicles</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                     {monthlyPLData?.map((month, index) => (
                        <TableRow 
                          key={index} 
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleMonthClick(month)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleMonthClick(month)}
                        >
                         <TableCell className="font-medium">{month.month}</TableCell>
                        <TableCell className="text-right">{formatCurrency(month.total_revenue)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(month.total_costs)}</TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={cn(
                            month.net_profit > 0 ? 'text-success' : 
                            month.net_profit < 0 ? 'text-destructive' : ''
                          )}>
                            {formatCurrency(month.net_profit)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{month.vehicle_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )
          ) : (
            // Vehicle view
            <div className="space-y-4">
              <div className="relative overflow-x-auto">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
                    <TableRow>
                      <TableHead>
                        <SortButton field="vehicle_reg">Vehicle</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="revenue_rental">Revenue</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="revenue_fees">Initial Fees</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="cost_service">Services</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="cost_fines">Fines</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="cost_other">Other</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="total_costs">Total Costs</SortButton>
                      </TableHead>
                      <TableHead className="text-right">
                        <SortButton field="net_profit">Net</SortButton>
                      </TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedVehicleData?.map((vehicle) => (
                        <TableRow 
                          key={vehicle.vehicle_id} 
                          className="hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleVehicleClick(vehicle)}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleVehicleClick(vehicle)}
                        >
                        <TableCell>
                          <div>
                            <div className="font-medium">{vehicle.vehicle_reg}</div>
                            <div className="text-xs text-muted-foreground">{vehicle.make_model}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vehicle.revenue_rental || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vehicle.revenue_fees || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vehicle.cost_service || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vehicle.cost_fines || 0)}</TableCell>
                        <TableCell className="text-right font-mono">{formatCurrency(vehicle.cost_other || 0)}</TableCell>
                        <TableCell className="text-right font-mono font-medium">{formatCurrency(vehicle.total_costs || 0)}</TableCell>
                        <TableCell className="text-right font-mono font-bold">
                          <span className={cn(
                            (vehicle.net_profit || 0) > 0 ? 'text-success' : 
                            (vehicle.net_profit || 0) < 0 ? 'text-destructive' : ''
                          )}>
                            {formatCurrency(vehicle.net_profit || 0)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(vehicle)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              
              {/* Category Totals */}
              {categoryTotals && (
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-2">Category Totals</h3>
                  <div className="bg-muted/30 rounded-lg p-4">
                    <Table>
                      <TableBody>
                        <TableRow>
                          <TableCell className="font-medium">Totals</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(categoryTotals.revenue_rental)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(categoryTotals.revenue_fees)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(categoryTotals.cost_service)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(categoryTotals.cost_fines)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(categoryTotals.cost_other)}</TableCell>
                          <TableCell className="text-right font-mono font-bold">{formatCurrency(categoryTotals.total_costs)}</TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            <span className={cn(
                              categoryTotals.net_profit > 0 ? 'text-success' : 
                              categoryTotals.net_profit < 0 ? 'text-destructive' : ''
                            )}>
                              {formatCurrency(categoryTotals.net_profit)}
                            </span>
                          </TableCell>
                          <TableCell>{getTotalsBadge(categoryTotals.net_profit)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PLDashboard;