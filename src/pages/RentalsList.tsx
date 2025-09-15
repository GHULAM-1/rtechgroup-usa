import { useState, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Plus, Eye, CreditCard, XCircle, Download } from "lucide-react";
import { useEnhancedRentals, RentalFilters } from "@/hooks/useEnhancedRentals";
import { RentalsFilters } from "@/components/RentalsFilters";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { CloseRentalDialog } from "@/components/CloseRentalDialog";
import { formatDuration } from "@/lib/rentalUtils";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

const RentalsList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [closeRentalDialogOpen, setCloseRentalDialogOpen] = useState(false);
  const [selectedRental, setSelectedRental] = useState<any>(null);

  // Parse filters from URL
  const filters: RentalFilters = useMemo(() => ({
    search: searchParams.get('search') || '',
    status: searchParams.get('status') || 'all',
    customerType: searchParams.get('customerType') || 'all',
    duration: searchParams.get('duration') || 'all',
    initialPayment: searchParams.get('initialPayment') || 'all',
    startDateFrom: searchParams.get('startDateFrom') ? new Date(searchParams.get('startDateFrom')!) : undefined,
    startDateTo: searchParams.get('startDateTo') ? new Date(searchParams.get('startDateTo')!) : undefined,
    sortBy: searchParams.get('sortBy') || 'start_date',
    sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    page: parseInt(searchParams.get('page') || '1'),
  }), [searchParams]);

  const { data, isLoading } = useEnhancedRentals(filters);

  const handleFiltersChange = (newFilters: RentalFilters) => {
    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value && value !== 'all' && value !== '' && value !== 1) {
        if (value instanceof Date) {
          params.set(key, value.toISOString().split('T')[0]);
        } else {
          params.set(key, value.toString());
        }
      }
    });
    setSearchParams(params);
  };

  const handleClearFilters = () => {
    setSearchParams(new URLSearchParams());
  };

  const handlePageChange = (page: number) => {
    handleFiltersChange({ ...filters, page });
  };

  const handleExportCSV = () => {
    if (!data?.rentals) return;
    
    const csvContent = [
      ['Rental #', 'Customer', 'Vehicle', 'Start Date', 'End Date', 'Duration', 'Initial Payment', 'Monthly Amount', 'Status'].join(','),
      ...data.rentals.map(rental => [
        rental.rental_number,
        rental.customer.name,
        `${rental.vehicle.reg} (${rental.vehicle.make} ${rental.vehicle.model})`,
        rental.start_date,
        rental.end_date || '',
        formatDuration(rental.duration_months),
        rental.initial_payment ? `£${rental.initial_payment}` : '—',
        `£${rental.monthly_amount}`,
        rental.computed_status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'rentals-export.csv';
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const handleMakePayment = (rental: any) => {
    setSelectedRental(rental);
    setPaymentDialogOpen(true);
  };

  const handleCloseRental = (rental: any) => {
    setSelectedRental(rental);
    setCloseRentalDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-muted animate-pulse rounded"></div>
        <div className="h-96 bg-muted animate-pulse rounded"></div>
      </div>
    );
  }

  const { rentals, stats, totalCount, totalPages } = data || { rentals: [], stats: null, totalCount: 0, totalPages: 0 };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Rentals</h1>
          <p className="text-muted-foreground">
            Manage rental agreements and contracts
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExportCSV} disabled={!rentals.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button 
            onClick={() => navigate("/rentals/new")}
            className="bg-gradient-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Rental
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card className="bg-card hover:bg-accent/50 border transition-all duration-200 cursor-pointer hover:shadow-md">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.total}</div>
              <p className="text-sm text-muted-foreground">Total Rentals</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20 hover:border-success/40 transition-all duration-200 cursor-pointer hover:shadow-md">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-success">{stats.active}</div>
              <p className="text-sm text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card className="bg-card hover:bg-accent/50 border transition-all duration-200 cursor-pointer hover:shadow-md">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-muted-foreground">{stats.closed}</div>
              <p className="text-sm text-muted-foreground">Closed</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 hover:border-primary/40 transition-all duration-200 cursor-pointer hover:shadow-md">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-primary">{stats.upcoming}</div>
              <p className="text-sm text-muted-foreground">Upcoming</p>
            </CardContent>
          </Card>
          <Card className="bg-card hover:bg-accent/50 border transition-all duration-200 cursor-pointer hover:shadow-md">
            <CardContent className="p-4">
              <div className="text-2xl font-bold">{stats.avgDuration}</div>
              <p className="text-sm text-muted-foreground">Avg Duration (mo)</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      <RentalsFilters 
        filters={filters}
        onFiltersChange={handleFiltersChange}
        onClearFilters={handleClearFilters}
      />

      {/* Rentals Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Rental Agreements
          </CardTitle>
          <CardDescription>
            Showing {rentals.length} of {totalCount} rentals
          </CardDescription>
        </CardHeader>
        <CardContent>
          {rentals.length > 0 ? (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rental #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Vehicle</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead className="text-right">Initial Payment</TableHead>
                      <TableHead className="text-right">Monthly Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rentals.map((rental) => (
                      <TableRow key={rental.id} className="hover:bg-muted/50">
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-medium text-primary"
                            onClick={() => navigate(`/rentals/${rental.id}`)}
                          >
                            {rental.rental_number}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-medium"
                            onClick={() => navigate(`/customers/${rental.customer.id}`)}
                          >
                            {rental.customer.name}
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={() => navigate(`/vehicles/${rental.vehicle.id}`)}
                          >
                            {rental.vehicle.reg} ({rental.vehicle.make} {rental.vehicle.model})
                          </Button>
                        </TableCell>
                        <TableCell>{new Date(rental.start_date).toLocaleDateString()}</TableCell>
                        <TableCell>{rental.end_date ? new Date(rental.end_date).toLocaleDateString() : '—'}</TableCell>
                        <TableCell>{formatDuration(rental.duration_months)}</TableCell>
                        <TableCell className="text-right">
                          {rental.initial_payment ? `£${Number(rental.initial_payment).toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          £{Number(rental.monthly_amount).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={
                              rental.computed_status === 'Active' ? 'default' : 
                              rental.computed_status === 'Closed' ? 'secondary' : 
                              'outline'
                            }
                          >
                            {rental.computed_status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/rentals/${rental.id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                            {rental.computed_status === 'Active' && (
                              <>
                                <Button
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleMakePayment(rental)}
                                >
                                  <CreditCard className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm" 
                                  onClick={() => handleCloseRental(rental)}
                                >
                                  <XCircle className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center mt-6">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious 
                          onClick={() => handlePageChange(Math.max(1, filters.page! - 1))}
                          className={filters.page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        const pageNum = Math.max(1, Math.min(totalPages - 4, filters.page! - 2)) + i;
                        return (
                          <PaginationItem key={pageNum}>
                            <PaginationLink
                              onClick={() => handlePageChange(pageNum)}
                              isActive={pageNum === filters.page}
                              className="cursor-pointer"
                            >
                              {pageNum}
                            </PaginationLink>
                          </PaginationItem>
                        );
                      })}
                      
                      <PaginationItem>
                        <PaginationNext 
                          onClick={() => handlePageChange(Math.min(totalPages, filters.page! + 1))}
                          className={filters.page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No rentals found</h3>
              <p className="text-muted-foreground mb-4">
                No rentals match your current filters
              </p>
              <Button onClick={handleClearFilters}>
                Clear Filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <AddPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        customer_id={selectedRental?.customer?.id}
        vehicle_id={selectedRental?.vehicle?.id}
      />

      {/* Close Rental Dialog */}
      <CloseRentalDialog
        open={closeRentalDialogOpen}
        onOpenChange={setCloseRentalDialogOpen}
        rental={selectedRental}
      />
    </div>
  );
};

export default RentalsList;