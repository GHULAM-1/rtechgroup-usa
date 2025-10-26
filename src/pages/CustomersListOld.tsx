import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Plus, Mail, Phone, Eye, Edit, Search } from "lucide-react";
import { CustomerFormModal } from "@/components/CustomerFormModal";

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
}

interface CustomerBalance {
  customer_id: string;
  balance: number;
  status: 'In Credit' | 'Settled' | 'In Debt';
}

const BalancePill = ({ balance, status }: { balance: number; status: string }) => {
  const getVariant = () => {
    if (status === 'In Credit') return 'default';
    if (status === 'Settled') return 'secondary';
    return 'destructive';
  };

  return (
    <Badge variant={getVariant() as any} className="badge-status">
      {status} {balance !== 0 && `($${Math.abs(balance).toLocaleString()})`}
    </Badge>
  );
};

const CustomersList = () => {
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [highSwitcherFilter, setHighSwitcherFilter] = useState<string>("all");

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, email, phone, type, customer_type, status, whatsapp_opt_in, high_switcher")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: balances } = useQuery({
    queryKey: ["customer-balances-list"],
    queryFn: async () => {
      if (!customers?.length) return {};
      
      const balanceMap: Record<string, CustomerBalance> = {};
      
      // Get balance for each customer from ledger_entries with proper filtering
      for (const customer of customers) {
        const { data, error } = await supabase
          .from("ledger_entries")
          .select("amount, type, due_date, payment_id, category")
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
        
        // Calculate balance with proper filtering
        const balance = data.reduce((sum, entry) => {
          // Skip Initial Fee payment entries (they're company revenue, not customer debt)
          if (entry.payment_id && initialFeePaymentIds.includes(entry.payment_id)) {
            return sum;
          }
          
          // For rental charges, only include if currently due
          // For fine charges, include all (they're immediate debt once charged)
          if (entry.type === 'Charge' && entry.category === 'Rental' && entry.due_date && new Date(entry.due_date) > new Date()) {
            return sum;
          }
          
          return sum + entry.amount;
        }, 0);
        
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
          customer_id: customer.id,
          balance: Math.abs(balance), // Always positive for display
          status,
        };
      }
      
      return balanceMap;
    },
    enabled: !!customers?.length,
  });

  // Query active rentals to determine customer status
  const { data: activeRentals } = useQuery({
    queryKey: ["active-rentals-status"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("customer_id")
        .eq("status", "Active");
      
      if (error) throw error;
      
      // Create a Set of customer IDs with active rentals
      return new Set(data.map(rental => rental.customer_id));
    },
  });

  // Function to determine display status based on active rentals
  const getCustomerDisplayStatus = (customerId: string) => {
    return activeRentals?.has(customerId) ? "Active" : "Inactive";
  };

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        handleAddCustomer();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setIsModalOpen(true);
  };

  // Filter customers based on search term and filters
  const filteredCustomers = customers?.filter(customer => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
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
    
    // High switcher filter
    if (highSwitcherFilter !== "all") {
      const isHighSwitcher = customer.high_switcher || false;
      if (highSwitcherFilter === "yes" && !isHighSwitcher) return false;
      if (highSwitcherFilter === "no" && isHighSwitcher) return false;
    }
    
    return true;
  });

  if (isLoading) {
    return <div>Loading customers...</div>;
  }

  return (
    <div className="space-y-6">
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

      {/* Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Customer Database
          </CardTitle>
          <CardDescription>
            View all customers with contact information and account balances
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="mb-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search customers by name, email, or phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="flex gap-4">
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
            </div>
          </div>
          
          {filteredCustomers && filteredCustomers.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map((customer) => {
                    const balance = balances?.[customer.id];
                    
                    return (
                      <TableRow key={customer.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {customer.name}
                            {customer.high_switcher && (
                              <Badge variant="secondary" className="text-xs">
                                High Switcher
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {customer.customer_type || customer.type}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            {customer.email && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {customer.email}
                              </div>
                            )}
                            {customer.phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3 w-3" />
                                {customer.phone}
                                {customer.whatsapp_opt_in && (
                                  <Badge variant="outline" className="ml-1 text-xs">WhatsApp</Badge>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {(() => {
                            const displayStatus = getCustomerDisplayStatus(customer.id);
                            return (
                              <Badge variant={displayStatus === 'Active' ? 'default' : 'secondary'}>
                                {displayStatus}
                              </Badge>
                            );
                          })()}
                        </TableCell>
                        <TableCell className="text-right">
                          {balance ? (
                            <BalancePill 
                              balance={balance.balance} 
                              status={balance.status} 
                            />
                          ) : (
                            <BalancePill balance={0} status="Settled" />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEditCustomer(customer)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/customers/${customer.id}`)}
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
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No customers found</h3>
              <p className="text-muted-foreground mb-4">Add your first customer to get started</p>
              <Button onClick={handleAddCustomer}>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
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