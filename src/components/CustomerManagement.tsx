import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { User, Plus, Phone, Mail } from "lucide-react";
import { useState } from "react";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  whatsapp_opt_in: boolean;
  created_at: string;
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
      {status} {balance !== 0 && `(£${Math.abs(balance).toLocaleString()})`}
    </Badge>
  );
};

const CustomerCard = ({ customer, balance }: { customer: Customer; balance?: CustomerBalance }) => (
  <Card className="card-hover shadow-card transition-all duration-300 hover:scale-102 cursor-pointer">
    <CardHeader className="pb-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg font-semibold">{customer.name}</CardTitle>
            <CardDescription className="text-metadata">{customer.type}</CardDescription>
          </div>
        </div>
        {balance && <BalancePill balance={balance.balance} status={balance.status} />}
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      <div className="flex items-center gap-2 text-metadata text-muted-foreground">
        <Mail className="h-3 w-3" />
        <span className="text-sm">{customer.email || 'No email'}</span>
      </div>
      <div className="flex items-center gap-2 text-metadata text-muted-foreground">
        <Phone className="h-3 w-3" />
        <span className="text-sm">{customer.phone || 'No phone'}</span>
        {customer.whatsapp_opt_in && (
          <Badge variant="outline" className="text-xs">WhatsApp</Badge>
        )}
      </div>
    </CardContent>
  </Card>
);

export const CustomerManagement = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Customer[];
    },
  });

  const { data: balances } = useQuery({
    queryKey: ["customer-balances"],
    queryFn: async () => {
      if (!customers?.length) return {};
      
      const balanceMap: Record<string, CustomerBalance> = {};
      
      // Get balance status for each customer using the corrected database function
      for (const customer of customers) {
        const { data, error } = await supabase
          .rpc('get_customer_balance_with_status', { 
            customer_id_param: customer.id 
          })
          .single();
        
        if (error) {
          console.error('Error fetching balance for customer:', customer.id, error);
          continue;
        }
        
        balanceMap[customer.id] = {
          customer_id: customer.id,
          balance: data.balance,
          status: data.status as 'In Credit' | 'Settled' | 'In Debt',
        };
      }
      
      return balanceMap;
    },
    enabled: !!customers?.length,
  });

  if (isLoading) {
    return <div>Loading customers...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Customer Management</CardTitle>
            <CardDescription>Manage your customer database and account balances</CardDescription>
          </div>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-primary hover:opacity-90 transition-opacity rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Customer
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {customers && customers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {customers.map((customer) => (
              <CustomerCard 
                key={customer.id} 
                customer={customer} 
                balance={balances?.[customer.id]}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <User className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No customers yet</h3>
            <p className="text-muted-foreground mb-4">Add your first customer to get started</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};