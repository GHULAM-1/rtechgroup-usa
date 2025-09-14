import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { 
  CreditCard, 
  Plus, 
  ExternalLink, 
  MoreHorizontal, 
  Eye, 
  FileText, 
  Download, 
  ChevronLeft,
  ChevronRight 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatInTimeZone } from "date-fns-tz";
import { PaymentSummaryCards } from "@/components/PaymentSummaryCards";
import { PaymentFilters, PaymentFilters as IPaymentFilters } from "@/components/PaymentFilters";
import { PaymentAllocationDrawer } from "@/components/PaymentAllocationDrawer";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { usePaymentsData, exportPaymentsCSV } from "@/hooks/usePaymentsData";

// Helper function to display user-friendly payment type names
const getPaymentTypeDisplay = (paymentType: string): string => {
  switch (paymentType) {
    case 'InitialFee':
      return 'Initial Fee';
    case 'Payment':
      return 'Customer Payment';
    default:
      return paymentType;
  }
};

const PaymentsList = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [showAllocationDrawer, setShowAllocationDrawer] = useState(false);
  
  // Filter and pagination state
  const [filters, setFilters] = useState<IPaymentFilters>({
    customerSearch: '',
    vehicleSearch: '',
    method: 'all',
    dateFrom: undefined,
    dateTo: undefined,
    quickFilter: 'thisMonth',
  });
  
  const [sortBy, setSortBy] = useState('payment_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(1);
  const pageSize = 25;

  // Apply default date filter for "thisMonth"
  if (filters.quickFilter === 'thisMonth' && !filters.dateFrom) {
    const today = new Date();
    setFilters(prev => ({
      ...prev,
      dateFrom: new Date(today.getFullYear(), today.getMonth(), 1),
      dateTo: today
    }));
  }

  const { data: paymentsData, isLoading } = usePaymentsData({
    filters,
    sortBy,
    sortOrder,
    page,
    pageSize
  });

  const handleSort = (column: string) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setPage(1);
  };

  const handleViewAllocations = (paymentId: string) => {
    setSelectedPaymentId(paymentId);
    setShowAllocationDrawer(true);
  };

  const handleViewLedger = (payment: any) => {
    if (payment.rentals?.id) {
      navigate(`/rentals/${payment.rentals.id}?tab=ledger`);
    } else if (payment.customers?.id) {
      navigate(`/customers/${payment.customers.id}?tab=ledger`);
    }
  };

  const handleExportCSV = async () => {
    try {
      await exportPaymentsCSV(filters);
      toast({
        title: "Export Complete",
        description: "Payments data has been exported to CSV",
      });
    } catch (error) {
      toast({
        title: "Export Failed",
        description: "Failed to export data. Please try again.",
        variant: "destructive",
      });
    }
  };

  const payments = paymentsData?.payments || [];
  const totalCount = paymentsData?.totalCount || 0;
  const totalPages = paymentsData?.totalPages || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
          <p className="text-muted-foreground">
            Record customer payments — automatically allocated to outstanding charges using FIFO
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <AddPaymentDialog 
            open={showAddDialog} 
            onOpenChange={setShowAddDialog}
          />
          <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-primary">
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <PaymentSummaryCards />

      {/* Filters */}
      <PaymentFilters onFiltersChange={(newFilters) => {
        setFilters(newFilters);
        setPage(1);
      }} />

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment History
          </CardTitle>
          <CardDescription>
            Complete record of all payments received
          </CardDescription>
        </CardHeader>
        <CardContent>
          {payments && payments.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                 <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead>Rental</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                 </TableHeader>
                <TableBody>
                   {payments.map((payment) => (
                     <TableRow key={payment.id} className="hover:bg-muted/50">
                       <TableCell>{formatInTimeZone(new Date(payment.payment_date), 'Europe/London', 'dd/MM/yyyy')}</TableCell>
                       <TableCell>{payment.customers?.name}</TableCell>
                       <TableCell>{payment.vehicles?.reg || '-'}</TableCell>
                       <TableCell>
                         {payment.rentals ? (
                           <Badge variant="outline" className="text-xs">
                             Rental #{payment.rentals.id.slice(0, 8)}
                           </Badge>
                         ) : (
                           '-'
                         )}
                       </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                               <Badge variant="default">
                                 {getPaymentTypeDisplay(payment.payment_type)}
                               </Badge>
                             </div>
                           </TableCell>
                          <TableCell>Cash</TableCell>
                        <TableCell className="text-right font-medium">
                          £{Math.abs(Number(payment.amount)).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                     </TableRow>
                   ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-8">
              <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No payments found</h3>
              <p className="text-muted-foreground mb-4">
                {Object.values(filters).some(f => f && f !== 'all' && f !== 'thisMonth') ? 
                  "No payments match your current filters" : 
                  "Start recording payments to track your cash flow"
                }
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsList;