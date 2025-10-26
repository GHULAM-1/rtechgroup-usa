import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { CalendarIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useToast } from "@/hooks/use-toast";
import { useCustomerVehicleRental } from "@/hooks/useCustomerVehicleRental";
import { cn } from "@/lib/utils";


const paymentSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  vehicle_id: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_date: z.date({
    required_error: "Payment date is required",
  }),
  method: z.string().optional(),
  notes: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer_id?: string;
  vehicle_id?: string;
}

export const AddPaymentDialog = ({ 
  open, 
  onOpenChange, 
  customer_id, 
  vehicle_id 
}: AddPaymentDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customer_id: customer_id || "",
      vehicle_id: vehicle_id || "",
      amount: 0,
      payment_date: toZonedTime(new Date(), 'America/New_York'),
      method: "",
      notes: "",
    },
  });

  const selectedCustomerId = form.watch("customer_id") || customer_id;
  const selectedVehicleId = form.watch("vehicle_id") || vehicle_id;

  // Auto-infer rental ID for the selected customer+vehicle combination
  const { data: rentalId } = useCustomerVehicleRental(selectedCustomerId, selectedVehicleId);

  // Simplified vehicle lookup for the selected customer
  const { data: activeRentals } = useQuery({
    queryKey: ["active-rentals", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      
      const { data, error } = await supabase
        .from("rentals")
        .select("vehicle_id, vehicles(id, reg)")
        .eq("status", "Active")
        .eq("customer_id", selectedCustomerId);
      
      if (error) throw error;
      return data?.map(r => r.vehicles).filter(Boolean) || [];
    },
    enabled: !!selectedCustomerId,
  });

  const { data: customers } = useQuery({
    queryKey: ["customers-for-payment"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("id, name");
      if (error) throw error;
      return data;
    },
  });

  // Auto-infer vehicle from active rental when customer is selected
  const customerVehicles = activeRentals || [];

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      const finalCustomerId = data.customer_id || customer_id;
      const finalVehicleId = data.vehicle_id || vehicle_id;

      // Create generic payment record - FIFO allocation will be handled by edge function
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: finalCustomerId,
          vehicle_id: finalVehicleId,
          rental_id: rentalId, // Auto-inferred rental ID
          amount: data.amount,
          payment_date: formatInTimeZone(data.payment_date, 'America/New_York', 'yyyy-MM-dd'),
          method: data.method,
          payment_type: 'Payment', // All customer payments are generic
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Apply payment using edge function
      const { data: applyResult, error: applyError } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: payment.id }
      });

      if (applyError) {
        console.error('Payment application error:', applyError);
        // Delete the payment record since processing failed
        await supabase.from('payments').delete().eq('id', payment.id);
        
        throw new Error(applyError.message || 'Payment processing failed');
      }

      if (!applyResult?.ok) {
        // Delete the payment record since processing failed
        await supabase.from('payments').delete().eq('id', payment.id);
        throw new Error(applyResult?.error || applyResult?.detail || 'Payment processing failed');
      }

      toast({
        title: "Payment Recorded",
        description: `Payment of $${data.amount} has been recorded and applied.`,
      });

      form.reset();
      onOpenChange(false);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['payments-data'] });
      queryClient.invalidateQueries({ queryKey: ['payment-summary'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['pnl'] });
      
      // Additional specific queries  
      if (finalCustomerId) {
        queryClient.invalidateQueries({ queryKey: ["customer-balance", finalCustomerId] });
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to add payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Add Payment</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {!customer_id && (
              <FormField
                control={form.control}
                name="customer_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {!vehicle_id && (
              <FormField
                control={form.control}
                name="vehicle_id" 
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select vehicle" />
                        </SelectTrigger>
                      </FormControl>
                       <SelectContent>
                         {selectedCustomerId ? (
                           customerVehicles?.length > 0 ? (
                             customerVehicles.map((vehicle) => (
                               <SelectItem key={vehicle.id} value={vehicle.id}>
                                 {vehicle.reg}
                               </SelectItem>
                             ))
                           ) : (
                             <div className="px-3 py-2 text-sm text-muted-foreground">
                               No vehicles found for this customer
                             </div>
                           )
                         ) : (
                           <div className="px-3 py-2 text-sm text-muted-foreground">
                             Select customer first
                           </div>
                         )}
                       </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}


            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Amount ($)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Enter amount"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Date *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                        >
                          {field.value ? (
                            formatInTimeZone(field.value, 'America/New_York', "MM/dd/yyyy")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        fromYear={new Date().getFullYear() - 5}
                        toYear={new Date().getFullYear() + 1}
                        captionLayout="dropdown-buttons"
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription className="text-sm text-muted-foreground">
                    Payments are automatically applied to outstanding charges. Any remaining credit will auto-apply to the next due charges.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="method"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="e.g., Cash, Card, Bank Transfer" 
                      {...field}
                    />
                  </FormControl>
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
                    <Input 
                      placeholder="Payment reference or notes" 
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />


            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Recording..." : "Record Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};