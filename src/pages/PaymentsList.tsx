import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Plus, Filter, CalendarIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { formatInTimeZone, toZonedTime } from "date-fns-tz";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface PaymentEntry {
  id: string;
  amount: number;
  entry_date: string;
  category: string;
  customers: { name: string };
  vehicles: { reg: string } | null;
  rentals: { id: string } | null;
}

const paymentSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  vehicle_id: z.string().min(1, "Vehicle is required"),
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  method: z.string().optional(),
  payment_date: z.date(),
});

type PaymentFormData = z.infer<typeof paymentSchema>;

const PaymentsList = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filter = searchParams.get('filter');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [loading, setLoading] = useState(false);

  const form = useForm<PaymentFormData>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      customer_id: "",
      vehicle_id: "",
      amount: 0,
      method: "",
      payment_date: toZonedTime(new Date(), 'Europe/London'),
    },
  });

  const selectedCustomerId = form.watch("customer_id");

  // Get customers and vehicles for form dropdowns
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


  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments-list", filter],
    queryFn: async () => {
      // Query payments table directly for authoritative data
      const { data, error } = await supabase
        .from("payments")
        .select(`
          id,
          amount,
          payment_date,
          payment_type,
          customers(name),
          vehicles(reg),
          rentals(id)
        `)
        .order("payment_date", { ascending: false });

      if (error) throw error;
      
      // Transform to match expected interface
      return data.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        entry_date: payment.payment_date,
        category: 'Customer Payment', // Show all as generic customer payments
        customers: payment.customers,
        vehicles: payment.vehicles,
        rentals: payment.rentals
      })) as PaymentEntry[];
    },
  });

  const onSubmit = async (data: PaymentFormData) => {
    setLoading(true);
    try {
      // Insert generic payment - FIFO allocation will be handled by edge function
      const { data: payment, error: paymentError } = await supabase
        .from("payments")
        .insert({
          customer_id: data.customer_id,
          vehicle_id: data.vehicle_id,
          amount: data.amount,
          payment_date: formatInTimeZone(data.payment_date, 'Europe/London', 'yyyy-MM-dd'),
          method: data.method || null,
          payment_type: 'Payment', // All customer payments are generic
        })
        .select()
        .single();

      if (paymentError) throw paymentError;

      // Apply payment using centralized service
      const { data: applyResult, error: applyError } = await supabase.functions.invoke('apply-payment', {
        body: { paymentId: payment.id }
      });

      if (applyError) {
        console.error('Apply payment error:', applyError);
        throw new Error('Failed to process payment');
      }
      
      if (!applyResult.ok) {
        throw new Error(applyResult.error || applyResult.detail || 'Payment processing failed');
      }

      toast({
        title: "Payment Recorded",
        description: `Payment of £${data.amount} has been recorded and applied.`,
      });

      form.reset({
        customer_id: "",
        vehicle_id: "",
        amount: 0,
        method: "",
        payment_date: toZonedTime(new Date(), 'Europe/London'),
      });
      setShowAddDialog(false);
      queryClient.invalidateQueries({ queryKey: ["payments-list"] });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to record payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading payments...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Payments</h1>
                          <p className="text-muted-foreground">
            Record customer payments - automatically allocated to outstanding charges using FIFO
            {filter && ` - ${filter.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase())}`}
          </p>
        </div>
        <div className="flex gap-2">
          {filter && (
            <Button variant="outline" onClick={() => navigate("/payments")}>
              <Filter className="h-4 w-4 mr-2" />
              Clear Filter
            </Button>
          )}
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-primary">
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Record New Payment</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer</FormLabel>
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
                    <FormField
                      control={form.control}
                      name="vehicle_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Vehicle</FormLabel>
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
                  </div>


                  <div className="grid grid-cols-2 gap-4">
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
                              placeholder="0.00"
                              {...field}
                              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                   <div className="grid grid-cols-2 gap-4">
                     <FormField
                       control={form.control}
                       name="method"
                       render={({ field }) => (
                         <FormItem>
                           <FormLabel>Payment Method (Optional)</FormLabel>
                           <FormControl>
                             <Input placeholder="e.g., Cash, Bank Transfer" {...field} />
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
                     </div>

                    <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setShowAddDialog(false)}>
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
        </div>
      </div>

      {/* Payments Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Payment History
          </CardTitle>
          <CardDescription>
            Complete record of all payments received
          </CardDescription>
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
                    <TableHead>Rental</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                 </TableHeader>
                <TableBody>
                   {payments.map((payment) => (
                     <TableRow key={payment.id} className="hover:bg-muted/50">
                       <TableCell>{formatInTimeZone(new Date(payment.entry_date), 'Europe/London', 'dd/MM/yyyy')}</TableCell>
                       <TableCell>{payment.customers?.name}</TableCell>
                       <TableCell>{payment.vehicles?.reg || '-'}</TableCell>
                       <TableCell>
                         {payment.rentals ? (
                           <Badge variant="outline" className="text-xs">
                             Rental #{payment.rentals.id.slice(0, 8)}
                           </Badge>
                         ) : (
                           '-'
                         )}
                       </TableCell>
                         <TableCell>
                           <div className="flex gap-1">
                              <Badge variant="default">
                                {payment.category}
                              </Badge>
                            </div>
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
              <h3 className="text-lg font-medium mb-2">No payments found</h3>
              <p className="text-muted-foreground mb-4">
                {filter ? "No payments match the current filter" : "No payments recorded yet"}
              </p>
              <Button onClick={() => setShowAddDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Record Payment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentsList;