import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import { BarChart3, Download, FileText, TrendingUp, Users, Car, Calendar, CreditCard, Clock, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FilterSidebar } from '@/components/reports/FilterSidebar';
import { ReportCard } from '@/components/reports/ReportCard';
import { DataTable } from '@/components/reports/DataTable';
import { ExportButtons } from '@/components/reports/ExportButtons';
import { ReportPreviewModal } from '@/components/reports/ReportPreviewModal';
import { AgingReceivablesDetail } from '@/components/reports/AgingReceivablesDetail';
import { EmptyStateIllustration } from '@/components/reports/EmptyStateIllustration';
import { useToast } from '@/hooks/use-toast';

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
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewReportId, setPreviewReportId] = useState<string>('');
  const [showAgingDetail, setShowAgingDetail] = useState(false);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const clearAllFilters = () => {
    setFilters({
      fromDate: subDays(new Date(), 30),
      toDate: new Date(),
      customers: [],
      vehicles: [],
      rentals: [],
      paymentTypes: [],
      statuses: []
    });
  };

  const handleExport = async (reportType: string, exportFormat: 'csv' | 'xlsx' | 'pdf') => {
    try {
      const exportData = {
        reportType,
        exportType: exportFormat,
        filters: {
          ...filters,
          fromDate: format(filters.fromDate, 'yyyy-MM-dd'),
          toDate: format(filters.toDate, 'yyyy-MM-dd')
        }
      };

      const { data, error } = await supabase.functions.invoke('generate-export', {
        body: exportData
      });

      if (error) throw error;

      // Create download with proper file naming
      const fromDateStr = format(filters.fromDate, 'yyyy-MM-dd');
      const toDateStr = format(filters.toDate, 'yyyy-MM-dd');
      const filename = `${reportType}_${fromDateStr}_${toDateStr}.${exportFormat}`;

      const blob = new Blob([data.content], { 
        type: exportFormat === 'pdf' ? 'application/pdf' : 
              exportFormat === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' :
              'text/csv'
      });
      
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: 'Export successful',
        description: `${reportType.replace('-', ' ')} exported as ${exportFormat.toUpperCase()}`
      });

    } catch (error) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: 'There was an error generating the export. Please try again.',
        variant: 'destructive'
      });
    }
  };

  const openPreviewModal = (reportId: string) => {
    setPreviewReportId(reportId);
    setPreviewModalOpen(true);
  };

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

      // Get fines data
      const { data: fines } = await supabase
        .from('view_fines_export')
        .select('fine_id, amount, remaining_amount')
        .gte('issue_date', fromDate)
        .lte('issue_date', toDate);

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
        fines: {
          count: fines?.length || 0,
          totalOutstanding: fines?.reduce((sum, f) => sum + Number(f.remaining_amount), 0) || 0
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
      description: 'Applied/unapplied payment analysis (CSV/XLSX)',
      icon: CreditCard,
      value: `£${reportStats?.payments.totalAmount?.toLocaleString() || '0'}`,
      subtitle: `${reportStats?.payments.count || 0} payments`,
      metadata: `Applied: £${reportStats?.payments.appliedAmount?.toLocaleString() || '0'}`
    },
    {
      id: 'pl-report',
      title: 'P&L Report',
      description: 'Vehicle & consolidated profit/loss (CSV/XLSX)',
      icon: TrendingUp,
      value: `£${reportStats?.pl.net_profit?.toLocaleString() || '0'}`,
      subtitle: 'Net Profit',
      metadata: `Revenue: £${reportStats?.pl.total_revenue?.toLocaleString() || '0'}`
    },
    {
      id: 'customer-statements',
      title: 'Customer Statements',
      description: 'Ledger-based with running balance (PDF/CSV/XLSX)',
      icon: FileText,
      value: `${reportStats?.aging.count || 0}`,
      subtitle: 'Customers with balances',
      metadata: `Total Due: £${reportStats?.aging.totalDue?.toLocaleString() || '0'}`
    },
    {
      id: 'rentals',
      title: 'Rentals Export',
      description: 'Active rentals with computed balance (CSV/XLSX)',
      icon: Car,
      value: `${reportStats?.rentals.count || 0}`,
      subtitle: 'Active rentals',
      metadata: `Outstanding: £${reportStats?.rentals.totalBalance?.toLocaleString() || '0'}`
    },
    {
      id: 'fines',
      title: 'Fines Export',
      description: 'Comprehensive fine data with status (CSV/XLSX)',
      icon: AlertTriangle,
      value: `${reportStats?.fines?.count || 0}`,
      subtitle: 'Total fines',
      metadata: `Outstanding: £${reportStats?.fines?.totalOutstanding?.toLocaleString() || '0'}`
    },
    {
      id: 'aging',
      title: 'Aging Receivables',
      description: 'Age buckets 0-30/31-60/61-90/90+ days (CSV/XLSX)',
      icon: Clock,
      value: `£${reportStats?.aging.totalDue?.toLocaleString() || '0'}`,
      subtitle: 'Total overdue',
      metadata: `${reportStats?.aging.count || 0} customers`
    }
  ];

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <BarChart3 className="h-5 w-5" />
              <h1 className="text-xl font-semibold">Reports & Exports</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Generate detailed reports and export data across your fleet
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 h-full">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse h-48">
              <CardHeader>
                <div className="h-4 bg-muted rounded w-3/4"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded w-1/3 mb-2"></div>
                <div className="h-3 bg-muted rounded w-2/3"></div>
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
        <div>
          <div className="flex items-center space-x-2 mb-2">
            <BarChart3 className="h-5 w-5" />
            <h1 className="text-3xl font-bold">Reports & Exports</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Generate detailed reports and export data across your fleet
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={clearAllFilters}
          className="text-sm cursor-pointer"
          title="Click to modify date range"
        >
          <Calendar className="h-4 w-4 mr-2" />
          {format(filters.fromDate, 'dd/MM/yyyy')} - {format(filters.toDate, 'dd/MM/yyyy')}
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Filters Sidebar */}
        <div className="w-full lg:w-80 lg:flex-shrink-0">
          <FilterSidebar filters={filters} onFiltersChange={setFilters} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {!selectedReport ? (
            <>
              {showAgingDetail ? (
                <div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAgingDetail(false)}
                    className="mb-4"
                  >
                    ← Back to Reports
                  </Button>
                  <AgingReceivablesDetail isOpen={showAgingDetail} />
                </div>
              ) : reportStats && (reportStats.payments.count === 0 && reportStats.rentals.count === 0) ? (
                <EmptyStateIllustration 
                  title="No data found"
                  description="No reports are available for the selected date range and filters. Try adjusting your criteria to see available data."
                  onClearFilters={clearAllFilters}
                />
              ) : (
                <>
                  <div className="mb-6">
                    <h2 className="text-lg font-medium mb-2">Available Reports</h2>
                    <p className="text-muted-foreground text-sm">
                      Click on a report card to preview data or use export icons for direct downloads. 
                      All amounts shown in GBP with Europe/London timezone.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                    {reportCards.map((report) => (
                      <ReportCard
                        key={report.id}
                        {...report}
                        onClick={() => {
                          if (report.id === 'aging') {
                            setShowAgingDetail(true);
                          } else {
                            openPreviewModal(report.id);
                          }
                        }}
                        onExport={(exportFormat) => handleExport(report.id, exportFormat)}
                      />
                    ))}
                  </div>
                </>
              )}
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

      {/* Report Preview Modal */}
      <ReportPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        reportId={previewReportId}
        reportTitle={reportCards.find(r => r.id === previewReportId)?.title || ''}
        filters={filters}
        onExport={(exportFormat) => handleExport(previewReportId, exportFormat)}
      />
    </div>
  );
};

export default Reports;