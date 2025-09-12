import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart3, Download, FileText, TrendingUp, Users, Car, Calendar, CreditCard, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterSidebar } from '@/components/reports/FilterSidebar';
import { ReportCard } from '@/components/reports/ReportCard';
import { DataTable } from '@/components/reports/DataTable';
import { ExportButtons } from '@/components/reports/ExportButtons';

export interface ReportFilters {
  fromDate: Date;
  toDate: Date;
  customers: string[];
  vehicles: string[];
  rentals: string[];
  paymentTypes: string[];
  statuses: string[];
}

const Reports = () => {
  const [filters, setFilters] = useState<ReportFilters>({
    fromDate: subDays(new Date(), 30),
    toDate: new Date(),
    customers: [],
    vehicles: [],
    rentals: [],
    paymentTypes: [],
    statuses: []
  });

  const [selectedReport, setSelectedReport] = useState<string | null>(null);

  // Fetch summary statistics for report cards
  const { data: reportStats, isLoading } = useQuery({
    queryKey: ['report-stats', filters],
    queryFn: async () => {
      const fromDate = format(filters.fromDate, 'yyyy-MM-dd');
      const toDate = format(filters.toDate, 'yyyy-MM-dd');

      // Get payments count and total
      const { data: payments } = await supabase
        .from('view_payments_export')
        .select('amount, applied_amount, unapplied_amount')
        .gte('payment_date', fromDate)
        .lte('payment_date', toDate);

      // Get P&L totals
      const { data: plData } = await supabase
        .from('view_pl_consolidated')
        .select('*')
        .single();

      // Get rentals count
      const { data: rentals } = await supabase
        .from('view_rentals_export')
        .select('rental_id, balance')
        .gte('start_date', fromDate)
        .lte('start_date', toDate);

      // Get aging receivables
      const { data: aging } = await supabase
        .from('view_aging_receivables')
        .select('*');

      return {
        payments: {
          count: payments?.length || 0,
          totalAmount: payments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0,
          appliedAmount: payments?.reduce((sum, p) => sum + Number(p.applied_amount), 0) || 0,
          unappliedAmount: payments?.reduce((sum, p) => sum + Number(p.unapplied_amount), 0) || 0
        },
        pl: plData || {
          net_profit: 0,
          total_revenue: 0,
          total_costs: 0
        },
        rentals: {
          count: rentals?.length || 0,
          totalBalance: rentals?.reduce((sum, r) => sum + Number(r.balance), 0) || 0
        },
        aging: {
          count: aging?.length || 0,
          totalDue: aging?.reduce((sum, a) => sum + Number(a.total_due), 0) || 0
        }
      };
    }
  });

  const reportCards = [
    {
      id: 'payments',
      title: 'Payments Export',
      description: 'Applied/unapplied payment analysis',
      icon: CreditCard,
      value: `£${reportStats?.payments.totalAmount?.toLocaleString() || '0'}`,
      subtitle: `${reportStats?.payments.count || 0} payments`,
      metadata: `Applied: £${reportStats?.payments.appliedAmount?.toLocaleString() || '0'}`
    },
    {
      id: 'pl-report',
      title: 'P&L Report',
      description: 'Vehicle & consolidated profit/loss',
      icon: TrendingUp,
      value: `£${reportStats?.pl.net_profit?.toLocaleString() || '0'}`,
      subtitle: 'Net Profit',
      metadata: `Revenue: £${reportStats?.pl.total_revenue?.toLocaleString() || '0'}`
    },
    {
      id: 'customer-statements',
      title: 'Customer Statements',
      description: 'Individual customer transaction history',
      icon: FileText,
      value: `${reportStats?.aging.count || 0}`,
      subtitle: 'Customers with balances',
      metadata: `Total Due: £${reportStats?.aging.totalDue?.toLocaleString() || '0'}`
    },
    {
      id: 'rentals',
      title: 'Rentals Export',
      description: 'Active rental agreements & balances',
      icon: Car,
      value: `${reportStats?.rentals.count || 0}`,
      subtitle: 'Active rentals',
      metadata: `Outstanding: £${reportStats?.rentals.totalBalance?.toLocaleString() || '0'}`
    },
    {
      id: 'aging',
      title: 'Aging Report',
      description: 'Receivables by age buckets',
      icon: Clock,
      value: `£${reportStats?.aging.totalDue?.toLocaleString() || '0'}`,
      subtitle: 'Total overdue',
      metadata: `${reportStats?.aging.count || 0} customers`
    }
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center space-x-2 mb-6">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Reports & Exports</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-6 w-6" />
          <h1 className="text-2xl font-semibold">Reports & Exports</h1>
        </div>
        <Badge variant="outline" className="text-sm">
          {format(filters.fromDate, 'dd/MM/yyyy')} - {format(filters.toDate, 'dd/MM/yyyy')}
        </Badge>
      </div>

      <div className="flex gap-6">
        {/* Filters Sidebar */}
        <div className="w-80 flex-shrink-0">
          <FilterSidebar filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {!selectedReport ? (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-medium mb-2">Report Overview</h2>
                <p className="text-muted-foreground">
                  Select a report below to view detailed data and export options. 
                  All amounts shown in GBP with Europe/London timezone.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportCards.map((report) => (
                  <ReportCard
                    key={report.id}
                    {...report}
                    onClick={() => setSelectedReport(report.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-6">
                <Button
                  variant="outline"
                  onClick={() => setSelectedReport(null)}
                >
                  ← Back to Reports
                </Button>
                <ExportButtons
                  reportType={selectedReport}
                  filters={filters}
                />
              </div>

              <DataTable
                reportType={selectedReport}
                filters={filters}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;