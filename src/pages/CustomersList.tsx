import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, Plus, Mail, Phone, Eye } from "lucide-react";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  type: string;
  status: string;
  whatsapp_opt_in: boolean;
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

  const getBgColor = () => {
    if (status === 'In Credit') return 'bg-blue-100 text-blue-700';
    if (status === 'Settled') return 'bg-green-100 text-green-700';
    return 'bg-red-100 text-red-700';
  };

  return (
    <div className={`px-2 py-1 rounded-full text-xs font-medium ${getBgColor()}`}>
      {status} {balance !== 0 && `(£${Math.abs(balance).toLocaleString()})`}
    </div>
  );
};

const CustomersList = () => {
  const navigate = useNavigate();

  const { data: customers, isLoading } = useQuery({
    queryKey: ["customers-list"],
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
    queryKey: ["customer-balances-list"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("customer_id, amount, remaining_amount, type, due_date")
        .eq("type", "Charge");
      
      if (error) throw error;
      
      const balanceMap: Record<string, CustomerBalance> = {};
      
      data?.forEach((entry) => {
        if (entry.due_date && entry.due_date <= today && entry.remaining_amount > 0) {
          if (!balanceMap[entry.customer_id]) {
            balanceMap[entry.customer_id] = {
              customer_id: entry.customer_id,
              balance: 0,
              status: 'Settled',
            };
          }
          balanceMap[entry.customer_id].balance += Number(entry.remaining_amount);
        }
      });
      
      Object.values(balanceMap).forEach((balance) => {
        if (balance.balance > 0) {
          balance.status = 'In Debt';
        } else if (balance.balance < 0) {
          balance.status = 'In Credit';
        } else {
          balance.status = 'Settled';
        }
      });
      
      return balanceMap;
    },
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
        <Button className="bg-gradient-primary">
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
          {customers && customers.length > 0 ? (
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
                  {customers.map((customer) => {
                    const balance = balances?.[customer.id];
                    
                    return (
                      <TableRow key={customer.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{customer.type}</Badge>
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
                          <Badge variant={customer.status === 'Active' ? 'default' : 'secondary'}>
                            {customer.status}
                          </Badge>
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/customers/${customer.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Button>
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
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Customer
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomersList;