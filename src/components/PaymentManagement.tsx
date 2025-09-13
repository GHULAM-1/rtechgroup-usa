import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, Plus } from "lucide-react";
import { formatInTimeZone } from "date-fns-tz";
import { useState } from "react";
import { AddPaymentDialog } from "./AddPaymentDialog";

interface PaymentEntry {
  id: string;
  customer_id: string;
  rental_id: string;
  vehicle_id: string;
  amount: number;
  entry_date: string;
  category: string;
  reference?: string;
  customers: {
    name: string;
  };
  vehicles: {
    reg: string;
  };
}

const PaymentTypeBadge = ({ category }: { category: string }) => {
  const getVariant = () => {
    switch (category) {
      case 'Initial Fees':
        return 'secondary';
      case 'Rental':
        return 'default';
      case 'Fine':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  return (
    <Badge variant={getVariant() as any} className="badge-status">
      {category === 'Initial Fees' ? 'Initial Fee' : category}
    </Badge>
  );
};

export const PaymentManagement = () => {
  const [showAddDialog, setShowAddDialog] = useState(false);

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select(`
          *,
          customers(name),
          vehicles(reg)
        `)
        .eq("type", "Payment")
        .order("entry_date", { ascending: false });
      
      if (error) throw error;
      return data as PaymentEntry[];
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
                      {formatInTimeZone(new Date(payment.entry_date), 'Europe/London', "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{payment.customers?.name}</TableCell>
                    <TableCell>{payment.vehicles?.reg}</TableCell>
                    <TableCell>
                      <PaymentTypeBadge category={payment.category} />
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
            <h3 className="text-lg font-medium mb-2">No payments recorded</h3>
            <p className="text-muted-foreground mb-4">Start recording payments to track your cash flow</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Record Payment
            </Button>
          </div>
        )}
      </CardContent>
      <AddPaymentDialog 
        open={showAddDialog} 
        onOpenChange={setShowAddDialog}
        rental_id=""
        customer_id=""
        vehicle_id=""
      />
    </Card>
  );
};