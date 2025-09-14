import { useState, useEffect } from "react";
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

  // Apply default date filter for "thisMonth" in useEffect to avoid infinite re-renders
  useEffect(() => {
    if (filters.quickFilter === 'thisMonth' && !filters.dateFrom) {
      const today = new Date();
      setFilters(prev => ({
        ...prev,
        dateFrom: new Date(today.getFullYear(), today.getMonth(), 1),
        dateTo: today
      }));
    }
  }, [filters.quickFilter, filters.dateFrom]);

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
    <div className="container mx-auto p-6 space-y-6">
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Payment Records</CardTitle>
            </div>
            {totalCount > 0 && (
              <div className="text-sm text-muted-foreground">
                Showing {((page - 1) * pageSize) + 1}-{Math.min(page * pageSize, totalCount)} of {totalCount} payments
              </div>
            )}
          </div>
          <CardDescription>
            Complete record of all payments received with allocation details
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="animate-pulse flex space-x-4">
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4"></div>
                    <div className="h-4 bg-muted rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : payments && payments.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('payment_date')}
                      >
                        Date {sortBy === 'payment_date' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('customer')}
                      >
                        Customer {sortBy === 'customer' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Rental</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead 
                        className="text-right cursor-pointer hover:bg-muted/50"
                        onClick={() => handleSort('amount')}
                      >
                        Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '↑' : '↓')}
                      </TableHead>
                      <TableHead>Allocation</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => {
                      const allocatedAmount = payment.amount - (payment.remaining_amount || 0);
                      const hasCredit = (payment.remaining_amount || 0) > 0;
                      
                      return (
                        <TableRow key={payment.id} className="hover:bg-muted/50">
                          <TableCell className="font-medium">
                            {formatInTimeZone(new Date(payment.payment_date), 'Europe/London', 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => navigate(`/customers/${payment.customers.id}`)}
                              className="text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {payment.customers.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            {payment.vehicles ? (
                              <button
                                onClick={() => navigate(`/vehicles/${payment.vehicles!.id}`)}
                                className="text-blue-600 hover:text-blue-800 hover:underline"
                              >
                                {payment.vehicles.reg}
                                {payment.vehicles.make && payment.vehicles.model && 
                                  <span className="text-muted-foreground"> • {payment.vehicles.make} {payment.vehicles.model}</span>
                                }
                              </button>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {payment.rentals ? (
                              <Badge variant="outline" className="text-xs cursor-pointer" 
                                onClick={() => navigate(`/rentals/${payment.rentals!.id}`)}>
                                {payment.rentals.rental_number || `#${payment.rentals.id.slice(0, 8)}`}
                              </Badge>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>{payment.method || '-'}</TableCell>
                          <TableCell className="text-right font-medium">
                            £{payment.amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell>
                            {allocatedAmount === payment.amount ? (
                              <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                                Applied
                              </Badge>
                            ) : hasCredit ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge variant="secondary" className="bg-blue-100 text-blue-800 cursor-help">
                                      Credit £{payment.remaining_amount?.toFixed(2)}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div>
                                      <p>Applied £{allocatedAmount.toFixed(2)} to charges</p>
                                      <p>Remaining £{payment.remaining_amount?.toFixed(2)} credit will auto-apply to next charge</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Badge variant="outline">Pending</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleViewAllocations(payment.id)}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Allocations
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleViewLedger(payment)}>
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Ledger
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(page + 1)}
                      disabled={page === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12">
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

      {/* Allocation Drawer */}
      <PaymentAllocationDrawer
        open={showAllocationDrawer}
        onOpenChange={setShowAllocationDrawer}
        paymentId={selectedPaymentId}
      />
    </div>
  );
};

export default PaymentsList;