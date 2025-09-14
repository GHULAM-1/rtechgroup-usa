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
import { cn } from "@/lib/utils";
import { PAYMENT_TYPES } from "@/lib/constants";

const paymentSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  vehicle_id: z.string().min(1, "Vehicle is required"),
  rental_id: z.string().optional(),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_date: z.date({
    required_error: "Payment date is required",
  }),
  method: z.string().min(1, "Payment method is required"),
  payment_type: z.enum(['Rental', 'InitialFee', 'Fine', 'Other']).default('Rental'),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental_id?: string;
  customer_id?: string;
  vehicle_id?: string;
}

export const AddPaymentDialog = ({ 
  open, 
  onOpenChange, 
  rental_id, 
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
      rental_id: rental_id || "",
      amount: 0,
      payment_date: toZonedTime(new Date(), 'Europe/London'),
      method: "Card",
      payment_type: "Rental",
    },
  });

  const selectedCustomerId = form.watch("customer_id") || customer_id;
  const selectedVehicleId = form.watch("vehicle_id") || vehicle_id;

  const { data: activeRentals } = useQuery({
    queryKey: ["active-rentals", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          id,
          customer_id,
          vehicle_id,
          start_date,
          end_date,
          monthly_amount,
          customers(name),
          vehicles(reg)
        `)
        .eq("status", "Active")
        .eq("customer_id", selectedCustomerId)
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data;
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

  const { data: customerVehicles } = useQuery({
    queryKey: ["customer-vehicles", selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      
      const { data, error } = await supabase
        .from("rentals")
        .select("vehicles(id, reg)")
        .eq("customer_id", selectedCustomerId);
      
      if (error) throw error;
      
      // Extract unique vehicles and flatten the structure
      const vehicles = data
        ?.map(rental => rental.vehicles)
        .filter(Boolean)
        .reduce((unique, vehicle) => {
          if (!unique.find(v => v.id === vehicle.id)) {
            unique.push(vehicle);
          }
          return unique;
        }, [])
        .sort((a, b) => a.reg.localeCompare(b.reg));
      
      return vehicles || [];
    },
    enabled: !!selectedCustomerId,
  });

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      const finalCustomerId = data.customer_id || customer_id;
      const finalVehicleId = data.vehicle_id || vehicle_id;
      let finalRentalId = data.rental_id || rental_id;

      // For Rental payments, ensure rental context is resolved
      if (data.payment_type === 'Rental') {
        if (!finalRentalId && finalCustomerId) {
          const customerRentals = activeRentals?.filter(r => r.customer_id === finalCustomerId);
          
          if (customerRentals?.length === 1) {
            finalRentalId = customerRentals[0].id;
          } else if (customerRentals?.length === 0) {
            toast({
              title: "Error",
              description: "No active rental found for this customer.",
              variant: "destructive",
            });
            return;
          } else if (customerRentals && customerRentals.length > 1) {
            toast({
              title: "Error", 
              description: "Customer has multiple active rentals. Please select a rental.",
              variant: "destructive",
            });
            return;
          }
        }

        if (!finalRentalId) {
          toast({
            title: "Error",
            description: "Rental must be specified for rental payments.",
            variant: "destructive",
          });
          return;
        }
      }

      // Create payment record - auto-application will be handled by centralized service
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: finalCustomerId,
          rental_id: finalRentalId || null,
          vehicle_id: finalVehicleId,
          amount: data.amount,
          payment_date: formatInTimeZone(data.payment_date, 'Europe/London', 'yyyy-MM-dd'),
          method: data.method,
          payment_type: data.payment_type,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Apply payment using edge function
      const { error: applyError } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: payment.id }
      });

      if (applyError) {
        console.error('Payment application error:', applyError);
        // Delete the payment record since processing failed
        await supabase.from('payments').delete().eq('id', payment.id);
        
        throw new Error(applyError.message || 'Payment processing failed');
      }

      toast({
        title: "Success",
        description: "Payment recorded and processed successfully",
      });

      form.reset();
      onOpenChange(false);
      
      // Invalidate queries to refresh the data
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['rentals'] });
      queryClient.invalidateQueries({ queryKey: ['pnl'] });
      
      // Additional specific queries  
      if (finalRentalId) {
        queryClient.invalidateQueries({ queryKey: ["rental-ledger", finalRentalId] });
        queryClient.invalidateQueries({ queryKey: ["rental-payment-applications", finalRentalId] });
        queryClient.invalidateQueries({ queryKey: ["rental", finalRentalId] });
        queryClient.invalidateQueries({ queryKey: ["rental-balance", finalRentalId] });
      }
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
                          customerVehicles?.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.reg}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="" disabled>
                            Select customer first
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {activeRentals && activeRentals.length > 1 && (
              <FormField
                control={form.control}
                name="rental_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rental Agreement *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || rental_id}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rental" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeRentals?.map((rental) => (
                          <SelectItem key={rental.id} value={rental.id}>
                            {rental.vehicles?.reg} - {formatInTimeZone(new Date(rental.start_date), 'Europe/London', 'dd/MM/yyyy')}
                          </SelectItem>
                        ))}
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
                  <FormLabel>Payment Amount (£)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...field}
                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                            formatInTimeZone(field.value, 'Europe/London', "dd/MM/yyyy")
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
                    Payments are automatically applied to outstanding charges. Future payments apply to next due charges.
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
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Card">Card</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="Cheque">Cheque</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="payment_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                    </FormControl>
                     <SelectContent>
                       <SelectItem value="Rental">Rental Payment</SelectItem>
                       <SelectItem value="InitialFee">Initial Fee</SelectItem>
                       <SelectItem value="Fine">Fine Payment</SelectItem>
                       <SelectItem value="Other">Other</SelectItem>
                     </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Processing..." : "Add Payment"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};