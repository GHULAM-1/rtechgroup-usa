import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const financePaymentSchema = z.object({
  payment_date: z.date(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  component: z.enum(['Deposit', 'Monthly', 'Balloon', 'Fees']),
  notes: z.string().optional(),
});

type FinancePaymentFormData = z.infer<typeof financePaymentSchema>;

interface RecordFinancePaymentDialogProps {
  vehicleId: string;
  vehicleReg: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const RecordFinancePaymentDialog = ({ 
  vehicleId, 
  vehicleReg, 
  open, 
  onOpenChange 
}: RecordFinancePaymentDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<FinancePaymentFormData>({
    resolver: zodResolver(financePaymentSchema),
    defaultValues: {
      payment_date: new Date(),
      amount: 0,
      component: "Monthly",
      notes: "",
    },
  });

  const handleOpenChange = (newOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(newOpen);
    } else {
      setIsOpen(newOpen);
    }
  };

  const currentOpen = open !== undefined ? open : isOpen;

  const onSubmit = async (data: FinancePaymentFormData) => {
    setLoading(true);

    try {
      const dateStr = data.payment_date.toISOString().split('T')[0];
      // Create stable reference for idempotency
      const reference = `FINPAY:${vehicleId}:${data.component}:${dateStr}:${data.amount}`;

      // Check if vehicle has upfront finance P&L entry (prevents double-counting)
      const { data: upfrontEntry } = await supabase
        .from("pnl_entries")
        .select("id")
        .eq("vehicle_id", vehicleId)
        .eq("category", "Acquisition")
        .eq("source_ref", `FIN-UPFRONT:${vehicleId}`)
        .single();

      const hasUpfrontEntry = !!upfrontEntry;

      // Insert payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          payment_type: 'Finance',
          vehicle_id: vehicleId,
          payment_date: dateStr,
          amount: data.amount,
          method: reference, // Using method field for reference (idempotency)
          customer_id: null, // Finance payments don't belong to customers
          rental_id: null,
          status: 'Applied',
          remaining_amount: 0,
        })
        .select()
        .single();

      if (paymentError) {
        // If duplicate, skip silently (idempotent)
        if (paymentError.code === '23505') {
          toast({
            title: "Payment Already Recorded",
            description: `This finance payment has already been recorded for ${vehicleReg}.`,
          });
          form.reset();
          handleOpenChange(false);
          return;
        }
        throw paymentError;
      }

      // Insert ledger entry (Cost) - always record for cash flow tracking
      const { error: ledgerError } = await supabase
        .from("ledger_entries")
        .insert({
          vehicle_id: vehicleId,
          entry_date: dateStr,
          type: 'Cost',
          category: 'Finance',
          amount: data.amount,
          due_date: dateStr,
          remaining_amount: 0,
          reference: reference,
          payment_id: payment.id,
        });

      if (ledgerError && ledgerError.code !== '23505') {
        throw ledgerError;
      }

      // Only insert P&L entry if NO upfront entry exists (prevents double-counting)
      if (!hasUpfrontEntry) {
        const { error: plError } = await supabase
          .from("pnl_entries")
          .insert({
            vehicle_id: vehicleId,
            entry_date: dateStr,
            side: 'Cost',
            category: 'Finance',
            amount: data.amount,
            reference: reference,
            source_ref: reference,
            payment_id: payment.id,
          });

        if (plError && plError.code !== '23505') {
          throw plError;
        }
      }

      const plNote = hasUpfrontEntry ? " (P&L already includes upfront contract cost)" : "";
      toast({
        title: "Finance Payment Recorded",
        description: `${data.component} payment of £${data.amount.toLocaleString()} recorded for ${vehicleReg}.${plNote}`,
      });

      form.reset();
      handleOpenChange(false);
      
      // Refresh relevant queries
      queryClient.invalidateQueries({ queryKey: ["vehicle-pl"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicleId] });
      queryClient.invalidateQueries({ queryKey: ["pnl-entries"] });

    } catch (error: any) {
      console.error("Finance payment error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to record finance payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <DollarSign className="h-4 w-4" />
          Record Finance Payment
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Record Finance Payment - {vehicleReg}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="payment_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input 
                        type="date" 
                        {...field}
                        value={field.value ? field.value.toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(new Date(e.target.value))}
                        className="input-focus"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount (£)</FormLabel>
                    <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          placeholder="Enter amount" 
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                          className="input-focus"
                        />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="component"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Component</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-focus">
                        <SelectValue placeholder="Select component" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Deposit">Deposit</SelectItem>
                      <SelectItem value="Monthly">Monthly Payment</SelectItem>
                      <SelectItem value="Balloon">Balloon Payment</SelectItem>
                      <SelectItem value="Fees">Fees</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Additional notes about this payment..."
                      {...field}
                      className="input-focus"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-primary">
                {loading ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};