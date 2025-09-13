import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, subYears, addYears } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const paymentSchema = z.object({
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  payment_date: z.date({
    required_error: "Payment date is required",
  }),
  method: z.string().min(1, "Payment method is required"),
  payment_type: z.enum(['Rental', 'InitialFee', 'Other']).default('Rental'),
  rental_id: z.string().optional(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental_id?: string;
  customer_id: string;
  vehicle_id: string;
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
      amount: 0,
      payment_date: toZonedTime(new Date(), 'Europe/London'),
      method: "Card",
      payment_type: "Rental",
    },
  });

  const { data: activeRentals } = useQuery({
    queryKey: ["active-rentals", customer_id],
    queryFn: async () => {
      if (!customer_id) return [];
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          *,
          customers(name),
          vehicles(reg)
        `)
        .eq("customer_id", customer_id)
        .eq("status", "Active")
        .order("start_date", { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!customer_id,
  });

  

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      // Determine rental to use
      let resolvedRentalId = data.rental_id || rental_id;
      
      // For Rental payments, enforce rental context
      if (data.payment_type === 'Rental') {
        if (!resolvedRentalId) {
          const customerRentals = activeRentals || [];
          
          if (customerRentals.length === 0) {
            toast({
              title: "Error",
              description: "No active rental found for this customer.",
              variant: "destructive",
            });
            return;
          } else if (customerRentals.length === 1) {
            resolvedRentalId = customerRentals[0].id;
          } else {
            toast({
              title: "Error",
              description: "Please select a rental - customer has multiple active rentals.",
              variant: "destructive",
            });
            return;
          }
        }
      }

      // Create payment record - auto-application handled by database triggers
      const { error: paymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: customer_id,
          rental_id: resolvedRentalId,
          vehicle_id: vehicle_id,
          amount: data.amount,
          payment_date: formatInTimeZone(data.payment_date, 'Europe/London', 'yyyy-MM-dd'),
          method: data.method,
          payment_type: data.payment_type,
        });

      if (paymentError) throw paymentError;

      toast({
        title: "Payment Added",
        description: `Payment of £${data.amount} has been recorded and automatically applied.`,
      });

      form.reset();
      onOpenChange(false);
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      queryClient.invalidateQueries({ queryKey: ["customer-net-position"] });
      if (resolvedRentalId) {
        queryClient.invalidateQueries({ queryKey: ["rental", resolvedRentalId] });
      }
    } catch (error) {
      console.error("Error adding payment:", error);
      toast({
        title: "Error",
        description: "Failed to add payment. Please try again.",
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
                        toYear={new Date().getFullYear() + 2}
                        captionLayout="dropdown-buttons"
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormDescription className="text-sm text-muted-foreground">
                    Payments are automatically applied to charges. Future payments are allowed as accounting entries.
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
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Show rental selector for Rental payments when customer has multiple active rentals */}
            {form.watch("payment_type") === "Rental" && activeRentals && activeRentals.length > 1 && (
              <FormField
                control={form.control}
                name="rental_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rental Agreement *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select rental" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {activeRentals.map((rental) => (
                          <SelectItem key={rental.id} value={rental.id}>
                            {rental.vehicles?.reg} - Started {format(new Date(rental.start_date), 'dd/MM/yyyy')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Customer has multiple active rentals - please select which rental this payment is for.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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