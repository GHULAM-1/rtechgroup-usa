import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, ArrowLeft, PoundSterling, Plus, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { AddPaymentDialog } from "@/components/AddPaymentDialog";
import { useToast } from "@/hooks/use-toast";
import { useRentalTotals } from "@/hooks/useRentalLedgerData";
import { useRentalInitialFee } from "@/hooks/useRentalInitialFee";
import { RentalLedger } from "@/components/RentalLedger";
import { ComplianceStatusPanel } from "@/components/ComplianceStatusPanel";

interface Rental {
  id: string;
  start_date: string;
  end_date: string;
  monthly_amount: number;
  status: string;
  customers: { id: string; name: string };
  vehicles: { id: string; reg: string; make: string; model: string };
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

  const { data: rentalTotals } = useRentalTotals(id);
  const { data: initialFee } = useRentalInitialFee(id);

  if (isLoading) {
    return <div>Loading rental details...</div>;
  }

  if (!rental) {
    return <div>Rental not found</div>;
  }

  // Use the new totals from allocation-based calculations
  const totalCharges = rentalTotals?.totalCharges || 0;
  const totalPayments = rentalTotals?.totalPayments || 0;
  const outstandingBalance = rentalTotals?.outstanding || 0;


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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
            <div>
              <p className="text-sm text-muted-foreground">Initial Fee</p>
              <p className="font-medium">
                {initialFee ? `£${Number(initialFee.amount).toLocaleString()}` : 'No Initial Fee'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Ledger */}
      {id && <RentalLedger rentalId={id} />}

      {/* Payment Status Compliance */}
      {id && (
        <ComplianceStatusPanel 
          objectType="Rental" 
          objectId={id} 
          title="Payment Reminders" 
        />
      )}

      {/* Add Payment Dialog */}
      {rental && (
        <AddPaymentDialog
          open={showAddPayment}
          onOpenChange={setShowAddPayment}
          customer_id={rental.customers?.id}
          vehicle_id={rental.vehicles?.id}
        />
      )}
    </div>
  );
};

export default RentalDetail;