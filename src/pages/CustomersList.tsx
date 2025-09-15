import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Plus, Mail, Phone, Eye, Edit, Search, Shield, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { CustomerFormModal } from "@/components/CustomerFormModal";
import { CustomerBalanceChip } from "@/components/CustomerBalanceChip";
import { CustomerSummaryCards } from "@/components/CustomerSummaryCards";
import { useDebounce } from "@/hooks/useDebounce";
import { toast } from "sonner";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  customer_type?: "Individual" | "Company";
  status: string;
  whatsapp_opt_in: boolean;
  high_switcher?: boolean;
  nok_full_name?: string;
  nok_relationship?: string;
  nok_phone?: string;
  nok_email?: string;
  nok_address?: string;
}

type SortField = 'name' | 'status' | 'type' | 'balance';
type SortOrder = 'asc' | 'desc';

const CustomersList = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State from URL params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [highSwitcherFilter, setHighSwitcherFilter] = useState(searchParams.get('highSwitcher') || 'all');
  const [sortField, setSortField] = useState<SortField>((searchParams.get('sortBy') as SortField) || 'name');
  const [sortOrder, setSortOrder] = useState<SortOrder>((searchParams.get('sortOrder') as SortOrder) || 'asc');
  const [currentPage, setCurrentPage] = useState(parseInt(searchParams.get('page') || '1'));
  const [pageSize, setPageSize] = useState(parseInt(searchParams.get('pageSize') || '25'));
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  // Debounce search term
  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Update URL params when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearchTerm) params.set('search', debouncedSearchTerm);
    if (typeFilter !== 'all') params.set('type', typeFilter);
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (highSwitcherFilter !== 'all') params.set('highSwitcher', highSwitcherFilter);
    if (sortField !== 'name') params.set('sortBy', sortField);
    if (sortOrder !== 'asc') params.set('sortOrder', sortOrder);
    if (currentPage !== 1) params.set('page', currentPage.toString());
    if (pageSize !== 25) params.set('pageSize', pageSize.toString());
    
    setSearchParams(params);
  }, [debouncedSearchTerm, typeFilter, statusFilter, highSwitcherFilter, sortField, sortOrder, currentPage, pageSize, setSearchParams]);

  // Fetch customers
  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select(`
          id, name, email, phone, type, customer_type, status, whatsapp_opt_in, high_switcher,
          nok_full_name, nok_relationship, nok_phone, nok_email, nok_address
        `)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  // Fetch customer balances using individual queries for each customer
  const customerBalanceQueries = useQuery({
    queryKey: ["customer-balances-enhanced"],
    queryFn: async () => {
      if (!customers?.length) return {};
      
      const balanceMap: Record<string, any> = {};
      
      // Use the same logic as useCustomerBalanceWithStatus for each customer
      for (const customer of customers) {
        try {
          const { data, error } = await supabase
            .from("ledger_entries")
            .select("type, amount, due_date, payment_id, category")
            .eq("customer_id", customer.id);
          
          if (error) {
            console.error('Error fetching balance for customer:', customer.id, error);
            continue;
          }
          
          // Get payment types to exclude Initial Fee payments from customer debt
          const paymentIds = data
            .filter(entry => entry.payment_id)
            .map(entry => entry.payment_id);
          
          let initialFeePaymentIds: string[] = [];
          if (paymentIds.length > 0) {
            const { data: payments } = await supabase
              .from("payments")
              .select("id")
              .in("id", paymentIds)
              .eq("payment_type", "InitialFee");
            
            initialFeePaymentIds = payments?.map(p => p.id) || [];
          }
          
          // Calculate totals by type with proper filtering
          let totalCharges = 0;
          let totalPayments = 0;
          let balance = 0;
          
          data.forEach(entry => {
            // Skip Initial Fee payment entries (they're company revenue, not customer debt)
            if (entry.payment_id && initialFeePaymentIds.includes(entry.payment_id)) {
              return;
            }
            
            // For rental charges, only include if currently due
            // For fine charges, include all (they're immediate debt once charged)
            if (entry.type === 'Charge' && entry.category === 'Rental' && entry.due_date && new Date(entry.due_date) > new Date()) {
              return;
            }
            
            balance += entry.amount;
            
            if (entry.type === 'Charge') {
              totalCharges += entry.amount;
            } else if (entry.type === 'Payment') {
              totalPayments += Math.abs(entry.amount); // Show payments as positive for display
            }
          });
          
          // Determine status
          let status: 'In Credit' | 'Settled' | 'In Debt';
          if (balance === 0) {
            status = 'Settled';
          } else if (balance > 0) {
            status = 'In Debt';
          } else {
            status = 'In Credit';
          }
          
          balanceMap[customer.id] = {
            balance: Math.abs(balance), // Always return positive for display
            status,
            totalCharges,
            totalPayments
          };
        } catch (error) {
          console.error('Error processing balance for customer:', customer.id, error);
        }
      }
      
      return balanceMap;
    },
    enabled: !!customers?.length,
  });

  const customerBalances = customerBalanceQueries.data || {};

  // Filter and sort customers
  const filteredAndSortedCustomers = useMemo(() => {
    if (!customers) return [];

    let filtered = customers.filter(customer => {
      // Search filter
      if (debouncedSearchTerm) {
        const search = debouncedSearchTerm.toLowerCase();
        const matchesSearch = (
          customer.name.toLowerCase().includes(search) ||
          customer.email?.toLowerCase().includes(search) ||
          customer.phone?.toLowerCase().includes(search)
        );
        if (!matchesSearch) return false;
      }
      
      // Type filter
      if (typeFilter !== "all") {
        const customerType = customer.customer_type || customer.type;
        if (customerType !== typeFilter) return false;
      }
      
      // Status filter
      if (statusFilter !== "all") {
        if (customer.status !== statusFilter) return false;
      }
      
      // High switcher filter
      if (highSwitcherFilter !== "all") {
        const isHighSwitcher = customer.high_switcher || false;
        if (highSwitcherFilter === "yes" && !isHighSwitcher) return false;
        if (highSwitcherFilter === "no" && isHighSwitcher) return false;
      }
      
      return true;
    });

    // Sort customers
    filtered.sort((a, b) => {
      let aValue, bValue;
      
      switch (sortField) {
        case 'name':
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'type':
          aValue = a.customer_type || a.type;
          bValue = b.customer_type || b.type;
          break;
        case 'balance':
          aValue = customerBalances[a.id]?.balance || 0;
          bValue = customerBalances[b.id]?.balance || 0;
          break;
        default:
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    return filtered;
  }, [customers, debouncedSearchTerm, typeFilter, statusFilter, highSwitcherFilter, sortField, sortOrder, customerBalances]);

  // Pagination
  const totalCustomers = filteredAndSortedCustomers.length;
  const totalPages = Math.ceil(totalCustomers / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalCustomers);
  const paginatedCustomers = filteredAndSortedCustomers.slice(startIndex, endIndex);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm, typeFilter, statusFilter, highSwitcherFilter]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleAddCustomer();
      }
      if (e.key === 'Escape' && isModalOpen) {
        setIsModalOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen]);

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('all');
    setStatusFilter('all');
    setHighSwitcherFilter('all');
    setSortField('name');
    setSortOrder('asc');
    setCurrentPage(1);
    toast.success('Filters cleared');
  };

  const hasActiveFilters = debouncedSearchTerm || typeFilter !== 'all' || statusFilter !== 'all' || highSwitcherFilter !== 'all';

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-4 w-4 text-muted-foreground" />;
    return sortOrder === 'asc' ? <ArrowUp className="h-4 w-4 text-primary" /> : <ArrowDown className="h-4 w-4 text-primary" />;
  };

  const hasNextOfKin = (customer: Customer) => {
    return !!(customer.nok_full_name || customer.nok_relationship || customer.nok_phone || customer.nok_email);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customers</h1>
          <p className="text-muted-foreground">Manage customer accounts and view balance status</p>
        </div>
        <Button className="bg-gradient-primary" onClick={handleAddCustomer}>
          <Plus className="h-4 w-4 mr-2" />
          Add Customer
        </Button>
      </div>

      {/* Summary Cards */}
      {customers && <CustomerSummaryCards customers={customers} />}

      {/* Main Content */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Customer Database
            <Badge variant="outline" className="ml-2">
              {totalCustomers} {totalCustomers === 1 ? 'customer' : 'customers'}
            </Badge>
          </CardTitle>
          <CardDescription>
            View and manage all customers with contact information and account balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="Individual">Individual</SelectItem>
                  <SelectItem value="Company">Company</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={highSwitcherFilter} onValueChange={setHighSwitcherFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by high switcher" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="yes">High Switchers</SelectItem>
                  <SelectItem value="no">Regular Customers</SelectItem>
                </SelectContent>
              </Select>

              <Select value={pageSize.toString()} onValueChange={(value) => setPageSize(parseInt(value))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
          
          {/* Results info */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Showing {startIndex + 1}-{endIndex} of {totalCustomers} customers
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
            </div>
          </div>
          
          {paginatedCustomers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-2">
                        Name
                        <SortIcon field="name" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('type')}
                    >
                      <div className="flex items-center gap-2">
                        Type
                        <SortIcon field="type" />
                      </div>
                    </TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center gap-2">
                        Status
                        <SortIcon field="status" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="text-right cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort('balance')}
                    >
                      <div className="flex items-center justify-end gap-2">
                        Balance
                        <SortIcon field="balance" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCustomers.map((customer) => {
                    const balanceData = customerBalances[customer.id];
                    
                    return (
                      <TableRow key={customer.id} className="table-row">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/customers/${customer.id}`)}
                              className="font-bold text-primary hover:underline text-left"
                            >
                              {customer.name}
                            </button>
                            <div className="flex items-center gap-1">
                              {customer.high_switcher && (
                                <Badge variant="secondary" className="text-xs bg-gray-800 text-white">
                                  High Switcher
                                </Badge>
                              )}
                              {hasNextOfKin(customer) && (
                                <div title="Emergency contact on file">
                                  <Shield className="h-3 w-3 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {customer.customer_type || customer.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1 max-w-[200px]">
                            {customer.email && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground truncate">
                                <Mail className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate" title={customer.email}>{customer.email}</span>
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3 flex-shrink-0" />
                                <span>{customer.phone}</span>
                                {customer.whatsapp_opt_in && (
                                  <Badge variant="outline" className="ml-1 text-xs">WhatsApp</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={customer.status === 'Active' ? 'default' : 'secondary'}
                            className={customer.status === 'Active' ? 'bg-pink-100 text-pink-800' : 'bg-gray-100 text-gray-800'}
                          >
                            {customer.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {balanceData ? (
                            <CustomerBalanceChip 
                              balance={balanceData.balance} 
                              status={balanceData.status} 
                              totalCharges={balanceData.totalCharges}
                              totalPayments={balanceData.totalPayments}
                              size="small"
                            />
                          ) : (
                            <CustomerBalanceChip balance={0} status="Settled" size="small" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCustomer(customer)}
                              aria-label={`Edit ${customer.name}`}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/customers/${customer.id}`)}
                              aria-label={`View ${customer.name} details`}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {hasActiveFilters ? 'No customers match your filters' : 'No customers yet'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {hasActiveFilters 
                  ? 'Try adjusting your search or filter criteria'
                  : 'Add your first customer to get started'
                }
              </p>
              {hasActiveFilters ? (
                <Button variant="outline" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear Filters
                </Button>
              ) : (
                <Button onClick={handleAddCustomer}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Customer
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <CustomerFormModal 
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        customer={editingCustomer}
      />
    </div>
  );
};

export default CustomersList;