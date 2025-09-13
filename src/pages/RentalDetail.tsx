import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, ArrowLeft, DollarSign, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { useToast } from "@/hooks/use-toast";

interface Rental {
  id: string;
  start_date: string;
  end_date: string;
  monthly_amount: number;
  status: string;
  customers: { id: string; name: string };
  vehicles: { id: string; reg: string; make: string; model: string };
}

interface LedgerEntry {
  id: string;
  entry_date: string;
  due_date: string | null;
  amount: number;
  remaining_amount: number;
  type: string;
  category: string;
}

const RentalDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddPayment, setShowAddPayment] = useState(false);

  const { data: rental, isLoading } = useQuery({
    queryKey: ["rental", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          *,
          customers(id, name),
          vehicles(id, reg, make, model)
        `)
        .eq("id", id)
        .single();
      
      if (error) throw error;
      return data as Rental;
    },
    enabled: !!id,
  });

  const { data: ledgerEntries } = useQuery({
    queryKey: ["rental-ledger", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("*")
        .eq("rental_id", id)
        .order("entry_date", { ascending: true });
      
      if (error) throw error;
      return data as LedgerEntry[];
    },
    enabled: !!id,
  });

  const { data: paymentApplications } = useQuery({
    queryKey: ["rental-payment-applications", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_applications")
        .select(`
          *,
          payments(amount, payment_date, method),
          ledger_entries!charge_entry_id(amount, due_date, category)
        `)
        .in("charge_entry_id", ledgerEntries?.map(e => e.id) || []);
      
      if (error) throw error;
      return data;
    },
    enabled: !!ledgerEntries?.length,
  });

  if (isLoading) {
    return <div>Loading rental details...</div>;
  }

  if (!rental) {
    return <div>Rental not found</div>;
  }

  // Calculate running balance
  let runningBalance = 0;
  const entriesWithBalance = ledgerEntries?.map(entry => {
    if (entry.type === 'Charge') {
      runningBalance += Number(entry.amount);
    } else if (entry.type === 'Payment') {
      runningBalance -= Number(entry.amount);
    }
    return { ...entry, runningBalance };
  }) || [];

  const totalCharges = ledgerEntries?.filter(e => e.type === 'Charge').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const totalPayments = ledgerEntries?.filter(e => e.type === 'Payment').reduce((sum, e) => sum + Number(e.amount), 0) || 0;
  const outstandingBalance = ledgerEntries?.filter(e => e.type === 'Charge').reduce((sum, e) => sum + Number(e.remaining_amount), 0) || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate("/rentals")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Rentals
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Rental Agreement</h1>
            <p className="text-muted-foreground">
              {rental.customers?.name} • {rental.vehicles?.reg}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowAddPayment(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Payment
          </Button>
          <Button 
            variant="outline" 
            onClick={async () => {
              try {
                await supabase
                  .from("rentals")
                  .update({ status: "Closed" })
                  .eq("id", id);
                
                await supabase
                  .from("vehicles")
                  .update({ status: "Available" })
                  .eq("id", rental.vehicles?.id);
                
                toast({
                  title: "Rental Closed",
                  description: "Rental has been closed and vehicle is now available.",
                });
                
                queryClient.invalidateQueries({ queryKey: ["rental", id] });
                queryClient.invalidateQueries({ queryKey: ["rentals-list"] });
                queryClient.invalidateQueries({ queryKey: ["vehicles-list"] });
              } catch (error) {
                toast({
                  title: "Error",
                  description: "Failed to close rental.",
                  variant: "destructive",
                });
              }
            }}
          >
            <X className="h-4 w-4 mr-2" />
            Close Rental
          </Button>
        </div>
      </div>

      {/* Rental Summary */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Charges</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              £{totalCharges.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Total Payments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              £{totalPayments.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${outstandingBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>
              £{outstandingBalance.toLocaleString()}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={rental.status === 'Active' ? 'default' : 'secondary'} className="text-lg px-3 py-1">
              {rental.status}
            </Badge>
          </CardContent>
        </Card>
      </div>

      {/* Rental Details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Rental Information
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Customer</p>
              <p className="font-medium">{rental.customers?.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Vehicle</p>
              <p className="font-medium">
                {rental.vehicles?.reg} ({rental.vehicles?.make} {rental.vehicles?.model})
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p className="font-medium">{new Date(rental.start_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p className="font-medium">{new Date(rental.end_date).toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monthly Amount</p>
              <p className="font-medium">£{Number(rental.monthly_amount).toLocaleString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Ledger (Charges & Payments)
          </CardTitle>
          <CardDescription>Complete transaction history with running balance</CardDescription>
        </CardHeader>
        <CardContent>
          {entriesWithBalance && entriesWithBalance.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                 <TableHeader>
                   <TableRow>
                     <TableHead>Date</TableHead>
                     <TableHead>Type</TableHead>
                     <TableHead>Category</TableHead>
                     <TableHead>Due Date</TableHead>
                     <TableHead className="text-right">Amount</TableHead>
                     <TableHead className="text-right">Remaining</TableHead>
                     <TableHead className="text-right">Allocations</TableHead>
                     <TableHead className="text-right">Running Balance</TableHead>
                   </TableRow>
                 </TableHeader>
                <TableBody>
                  {entriesWithBalance.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{new Date(entry.entry_date).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Badge variant={entry.type === 'Charge' ? 'destructive' : 'default'}>
                          {entry.type}
                        </Badge>
                      </TableCell>
                      <TableCell>{entry.category}</TableCell>
                      <TableCell>
                        {entry.due_date ? new Date(entry.due_date).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className={`text-right ${entry.type === 'Charge' ? 'text-red-600' : 'text-green-600'}`}>
                        {entry.type === 'Charge' ? '+' : '-'}£{Number(entry.amount).toLocaleString()}
                      </TableCell>
                       <TableCell className="text-right">
                         £{Number(entry.remaining_amount).toLocaleString()}
                       </TableCell>
                       <TableCell className="text-right text-sm">
                         {paymentApplications?.filter(app => app.charge_entry_id === entry.id).map(app => (
                           <div key={app.id} className="text-blue-600">
                             £{Number(app.amount_applied).toLocaleString()} from payment
                           </div>
                         )) || '-'}
                       </TableCell>
                       <TableCell className={`text-right font-medium ${entry.runningBalance > 0 ? 'text-red-600' : entry.runningBalance < 0 ? 'text-green-600' : 'text-gray-600'}`}>
                         £{Math.abs(entry.runningBalance).toLocaleString()}
                       </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">No ledger entries found</p>
          )}
        </CardContent>
      </Card>

      {/* Add Payment Dialog */}
      {rental && (
        <AddPaymentDialog
          open={showAddPayment}
          onOpenChange={setShowAddPayment}
          rental_id={rental.id}
          customer_id={rental.customers?.id}
          vehicle_id={rental.vehicles?.id}
        />
      )}
    </div>
  );
};

export default RentalDetail;