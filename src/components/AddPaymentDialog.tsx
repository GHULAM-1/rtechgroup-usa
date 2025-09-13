import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { format, subYears, addYears } from "date-fns";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";
import { CalendarIcon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
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
  }).refine((date) => date <= new Date(), {
    message: "Payment date cannot be in the future",
  }),
  method: z.string().min(1, "Payment method is required"),
  payment_type: z.enum(['Rental', 'Fine']).default('Rental'),
  is_early: z.boolean().default(false),
  apply_from_date: z.date().optional(),
}).refine((data) => {
  if (data.is_early && !data.apply_from_date) {
    return false;
  }
  if (data.is_early && data.apply_from_date && data.apply_from_date < data.payment_date) {
    return false;
  }
  return true;
}, {
  message: "Apply from date must be provided and cannot be before payment date",
  path: ["apply_from_date"],
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rental_id: string;
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
      is_early: false,
      apply_from_date: undefined,
    },
  });

  const isEarly = form.watch("is_early");

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      // Create payment record
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: customer_id,
          rental_id: rental_id,
          vehicle_id: vehicle_id,
          amount: data.amount,
          payment_date: formatInTimeZone(data.payment_date, 'Europe/London', 'yyyy-MM-dd'),
          method: data.method,
          payment_type: data.payment_type,
          is_early: data.is_early,
          apply_from_date: data.apply_from_date ? formatInTimeZone(data.apply_from_date, 'Europe/London', 'yyyy-MM-dd') : null,
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Apply payment using FIFO allocation
      const { error: applyError } = await supabase.rpc('payment_apply_fifo', {
        p_id: payment.id
      });

      if (applyError) throw applyError;

      toast({
        title: "Payment Added",
        description: `Payment of £${data.amount} has been applied successfully.`,
      });

      form.reset();
      onOpenChange(false);
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["rental-ledger", rental_id] });
      queryClient.invalidateQueries({ queryKey: ["rental-payment-applications", rental_id] });
      queryClient.invalidateQueries({ queryKey: ["rental", rental_id] });
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
                        disabled={(date) => date > new Date()}
                        fromYear={new Date().getFullYear() - 5}
                        toYear={new Date().getFullYear()}
                        captionLayout="dropdown-buttons"
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_early"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>
                      Mark as early payment (hold as credit until next due)
                    </FormLabel>
                  </div>
                </FormItem>
              )}
            />

            {isEarly && (
              <FormField
                control={form.control}
                name="apply_from_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Apply From Date *</FormLabel>
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
                          disabled={(date) => date < form.getValues("payment_date")}
                          fromYear={new Date().getFullYear()}
                          toYear={new Date().getFullYear() + 2}
                          captionLayout="dropdown-buttons"
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription>
                      Credit will auto-apply from this date to due charges.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                      <SelectItem value="Rental">Rental</SelectItem>
                      <SelectItem value="Fine">Fine</SelectItem>
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