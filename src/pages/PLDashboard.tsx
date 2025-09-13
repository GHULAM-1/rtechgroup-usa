import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarIcon, TrendingUp, TrendingDown, DollarSign, Car, Calendar } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';

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
  cost_finance: number;
  cost_service: number;
  cost_fines: number;
  cost_other: number;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
}

interface MonthlyPL {
  month: string;
  total_revenue: number;
  total_costs: number;
  net_profit: number;
  vehicle_count: number;
}

const PLDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: startOfMonth(subMonths(new Date(), 11)),
    to: endOfMonth(new Date()),
  });
  const [groupByMonth, setGroupByMonth] = useState(false);

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
      if (groupByMonth) {
        // When grouping by month, we'll aggregate data differently
        // For now, return the vehicle data as is
        const { data, error } = await supabase
          .from('view_pl_by_vehicle')
          .select('*');

        if (error) throw error;
        return data || [];
      } else {
        const { data, error } = await supabase
          .from('view_pl_by_vehicle')
          .select('*');

        if (error) throw error;
        return data || [];
      }
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
    }).format(amount);
  };

  const getStatusBadge = (netProfit: number) => {
    if (netProfit > 0) {
      return <Badge className="bg-success text-success-foreground">Profitable</Badge>;
    } else if (netProfit < 0) {
      return <Badge className="bg-destructive text-destructive-foreground">Loss</Badge>;
    } else {
      return <Badge variant="secondary">Break Even</Badge>;
    }
  };

  const summaryCards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(plSummary?.total_revenue || 0),
      icon: TrendingUp,
      trend: plSummary?.total_revenue > 0 ? 'positive' : 'neutral',
    },
    {
      title: 'Total Costs',
      value: formatCurrency(plSummary?.total_costs || 0),
      icon: TrendingDown,
      trend: 'negative',
    },
    {
      title: 'Net Profit',
      value: formatCurrency(plSummary?.net_profit || 0),
      icon: DollarSign,
      trend: (plSummary?.net_profit || 0) > 0 ? 'positive' : 'negative',
    },
    {
      title: 'Vehicles Tracked',
      value: vehicleCount?.toString() || '0',
      icon: Car,
      trend: 'neutral',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-foreground">Global P&L Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Track profitability across your entire fleet
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant={groupByMonth ? "default" : "outline"}
            onClick={() => setGroupByMonth(!groupByMonth)}
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
          <Card key={index} className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <div className="flex items-center mt-2">
                {card.trend === 'positive' && (
                  <TrendingUp className="h-4 w-4 text-success mr-1" />
                )}
                {card.trend === 'negative' && (
                  <TrendingDown className="h-4 w-4 text-destructive mr-1" />
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Vehicle Profitability Table or Monthly View */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {groupByMonth ? 'Monthly Profitability' : 'Vehicle Profitability'}
          </CardTitle>
          <CardDescription>
            {groupByMonth 
              ? 'Profitability breakdown by month'
              : 'Click on a vehicle row to view detailed P&L'
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {groupByMonth ? (
            // Monthly view
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Costs</TableHead>
                  <TableHead className="text-right">Net Profit</TableHead>
                  <TableHead className="text-right">Vehicles</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyPLData?.map((month, index) => (
                  <TableRow key={index} className="table-row">
                    <TableCell className="font-medium">{month.month}</TableCell>
                    <TableCell className="text-right">{formatCurrency(month.total_revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(month.total_costs)}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cn(
                        month.net_profit > 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {formatCurrency(month.net_profit)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{month.vehicle_count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            // Vehicle view
            <Table>
              <TableHeader>
                <TableRow className="table-header">
                  <TableHead>Vehicle</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Initial Fees</TableHead>
                  <TableHead className="text-right">Finance</TableHead>
                  <TableHead className="text-right">Services</TableHead>
                  <TableHead className="text-right">Fines</TableHead>
                  <TableHead className="text-right">Other</TableHead>
                  <TableHead className="text-right">Total Costs</TableHead>
                  <TableHead className="text-right">Net</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehiclePLData?.map((vehicle) => (
                  <TableRow 
                    key={vehicle.vehicle_id} 
                    className="table-row cursor-pointer"
                    onClick={() => navigate(`/vehicles/${vehicle.vehicle_id}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{vehicle.vehicle_reg}</div>
                        <div className="text-xs text-muted-foreground">{vehicle.make_model}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(vehicle.revenue_rental || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vehicle.revenue_fees || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vehicle.cost_finance || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vehicle.cost_service || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vehicle.cost_fines || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vehicle.cost_other || 0)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(vehicle.total_costs || 0)}</TableCell>
                    <TableCell className="text-right font-medium">
                      <span className={cn(
                        (vehicle.net_profit || 0) > 0 ? 'text-success' : 'text-destructive'
                      )}>
                        {formatCurrency(vehicle.net_profit || 0)}
                      </span>
                    </TableCell>
                    <TableCell>{getStatusBadge(vehicle.net_profit || 0)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PLDashboard;