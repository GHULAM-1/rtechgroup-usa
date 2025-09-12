import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Plus } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";

interface Payment {
  id: string;
  customer_id: string;
  rental_id: string;
  vehicle_id: string;
  amount: number;
  payment_date: string;
  method: string;
  payment_type: string;
  customers: {
    name: string;
  };
  vehicles: {
    reg: string;
  };
}

const PaymentTypeBadge = ({ type }: { type: string }) => {
  const getVariant = () => {
    switch (type) {
      case 'InitialFee':
        return 'default';
      case 'Rental':
        return 'secondary';
      case 'Fine':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Badge variant={getVariant() as any} className="badge-status">
      {type === 'InitialFee' ? 'Initial Fee' : type}
    </Badge>
  );
};

export const PaymentManagement = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select(`
          *,
          customers(name),
          vehicles(reg)
        `)
        .order("payment_date", { ascending: false });
      
      if (error) throw error;
      return data as Payment[];
    },
  });

  if (isLoading) {
    return <div>Loading payments...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-xl font-semibold">Payment Management</CardTitle>
            <CardDescription>Track all payments and receipts</CardDescription>
          </div>
          <Button 
            onClick={() => setShowAddDialog(true)}
            className="bg-gradient-primary hover:opacity-90 transition-opacity rounded-lg"
          >
            <Plus className="h-4 w-4 mr-2" />
            Record Payment
          </Button>
        </div>
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
                  <TableHead>Type</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">
                      {format(new Date(payment.payment_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{payment.customers?.name}</TableCell>
                    <TableCell>{payment.vehicles?.reg}</TableCell>
                    <TableCell>
                      <PaymentTypeBadge type={payment.payment_type} />
                    </TableCell>
                    <TableCell>{payment.method || 'Cash'}</TableCell>
                    <TableCell className="text-right font-medium">
                      £{Number(payment.amount).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No payments recorded</h3>
            <p className="text-muted-foreground mb-4">Start recording payments to track your cash flow</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};