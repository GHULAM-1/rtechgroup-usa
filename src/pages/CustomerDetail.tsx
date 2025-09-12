import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, ArrowLeft, Edit, Mail, Phone, FileText, CreditCard } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  whatsapp_opt_in: boolean;
}

interface Rental {
  id: string;
  start_date: string;
  end_date: string;
  monthly_amount: number;
  status: string;
  vehicles: { reg: string; make: string; model: string };
}

interface Payment {
  id: string;
  amount: number;
  payment_date: string;
  payment_type: string;
  vehicles: { reg: string };
}

const CustomerDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: customer, isLoading } = useQuery({
    queryKey: ["customer", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Customer;
    },
    enabled: !!id,
  });

  const { data: rentals } = useQuery({
    queryKey: ["customer-rentals", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          *,
          vehicles(reg, make, model)
        `)
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Rental[];
    },
    enabled: !!id,
  });

  const { data: payments } = useQuery({
    queryKey: ["customer-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          vehicles(reg)
        `)
        .eq("customer_id", id)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!id,
  });

  const { data: balance } = useQuery({
    queryKey: ["customer-balance", id],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("customer_id", id)
        .eq("type", "Charge")
        .lte("due_date", today)
        .gt("remaining_amount", 0);
      
      if (error) throw error;
      
      const totalDue = data?.reduce((sum, entry) => sum + Number(entry.remaining_amount), 0) || 0;
      
      let status = 'Settled';
      if (totalDue > 0) status = 'In Debt';
      else if (totalDue < 0) status = 'In Credit';
      
      return { balance: totalDue, status };
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div>Loading customer details...</div>;
  }

  if (!customer) {
    return <div>Customer not found</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/customers")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Customers
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{customer.name}</h1>
            <p className="text-muted-foreground">{customer.type} Customer</p>
          </div>
        </div>
        <Button>
          <Edit className="h-4 w-4 mr-2" />
          Edit Customer
        </Button>
      </div>

      {/* Customer Info Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Contact Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{customer.email || 'No email'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{customer.phone || 'No phone'}</span>
              {customer.whatsapp_opt_in && (
                <Badge variant="outline" className="ml-1">WhatsApp</Badge>
              )}
            </div>
            <div>
              <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'}>
                {customer.status}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
          </CardHeader>
          <CardContent>
            {balance && (
              <div className={`text-2xl font-bold ${
                balance.status === 'In Debt' ? 'text-red-600' :
                balance.status === 'In Credit' ? 'text-blue-600' : 'text-green-600'
              }`}>
                {balance.status}
                {balance.balance !== 0 && (
                  <div className="text-lg">£{Math.abs(balance.balance).toLocaleString()}</div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quick Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Active Rentals</span>
              <span className="font-medium">
                {rentals?.filter(r => r.status === 'Active').length || 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Total Payments</span>
              <span className="font-medium">{payments?.length || 0}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rentals">
        <TabsList>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="rentals">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Rental History
              </CardTitle>
              <CardDescription>All rentals for this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {rentals && rentals.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead className="text-right">Monthly Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rentals.map((rental) => (
                        <TableRow key={rental.id}>
                          <TableCell className="font-medium">
                            {rental.vehicles?.reg} ({rental.vehicles?.make} {rental.vehicles?.model})
                          </TableCell>
                          <TableCell>{new Date(rental.start_date).toLocaleDateString()}</TableCell>
                          <TableCell>{new Date(rental.end_date).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">£{Number(rental.monthly_amount).toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant={rental.status === 'Active' ? 'default' : 'secondary'}>
                              {rental.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/rentals/${rental.id}`)}
                            >
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No rentals found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-primary" />
                Payment History
              </CardTitle>
              <CardDescription>All payments made by this customer</CardDescription>
            </CardHeader>
            <CardContent>
              {payments && payments.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Vehicle</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>{new Date(payment.payment_date).toLocaleDateString()}</TableCell>
                          <TableCell>{payment.vehicles?.reg}</TableCell>
                          <TableCell>
                            <Badge variant={payment.payment_type === 'Rental' ? 'default' : 'secondary'}>
                              {payment.payment_type === 'InitialFee' ? 'Initial Fee' : payment.payment_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">£{Number(payment.amount).toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-center py-8 text-muted-foreground">No payments found</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle>Documents</CardTitle>
              <CardDescription>Customer documents and contracts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center py-8 text-muted-foreground">
                Document management feature coming soon
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CustomerDetail;