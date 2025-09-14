import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { addMonths, isAfter, isBefore, subYears, startOfDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowLeft, FileText, Save, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useCustomerActiveRentals } from "@/hooks/useCustomerActiveRentals";
import { PAYMENT_TYPES } from "@/lib/constants";
import { ContractSummary } from "@/components/ContractSummary";
import { DatePickerInput } from "@/components/DatePickerInput";
import { CurrencyInput } from "@/components/CurrencyInput";

const rentalSchema = z.object({
  customer_id: z.string().min(1, "Customer is required"),
  vehicle_id: z.string().min(1, "Vehicle is required"),
  start_date: z.date(),
  end_date: z.date(),
  monthly_amount: z.number().min(1, "Monthly amount must be at least £1"),
  initial_fee: z.number().min(0, "Initial fee cannot be negative").optional(),
}).refine((data) => {
  const monthAfterStart = addMonths(data.start_date, 1);
  return isAfter(data.end_date, monthAfterStart) || data.end_date.getTime() === monthAfterStart.getTime();
}, {
  message: "End date must be at least 1 month after start date",
  path: ["end_date"],
});

type RentalFormData = z.infer<typeof rentalSchema>;

const CreateRental = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string>("");

  const today = new Date();
  const todayAtMidnight = startOfDay(today);
  const defaultEndDate = addMonths(today, 12); // 12 months from today

  const form = useForm<RentalFormData>({
    resolver: zodResolver(rentalSchema),
    defaultValues: {
      customer_id: "",
      vehicle_id: "",
      start_date: today,
      end_date: defaultEndDate,
      monthly_amount: undefined,
      initial_fee: undefined,
    },
    mode: "onBlur", // Validate on blur for better UX
  });

  // Watch form values for live updates
  const watchedValues = form.watch();
  const selectedCustomerId = watchedValues.customer_id;
  const selectedVehicleId = watchedValues.vehicle_id;

  // Get customers and available vehicles
  const { data: customers } = useQuery({
    queryKey: ["customers-for-rental"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, customer_type, type, email, phone")
        .eq("status", "Active");
      if (error) throw error;
      return data;
    },
  });

  // Get active rentals count for selected customer to enforce rules
  const { data: activeRentalsCount } = useCustomerActiveRentals(selectedCustomerId);

  const { data: vehicles } = useQuery({
    queryKey: ["vehicles-for-rental"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, reg, make, model")
        .eq("status", "Available");
      if (error) throw error;
      return data;
    },
  });

  const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
  const selectedVehicle = vehicles?.find(v => v.id === selectedVehicleId);

  const onSubmit = async (data: RentalFormData) => {
    setLoading(true);
    setSubmitError("");
    try {
      // Validate form data
      if (!data.customer_id || !data.vehicle_id) {
        throw new Error("Customer and Vehicle must be selected");
      }
      
      if (data.monthly_amount <= 0) {
        throw new Error("Monthly amount must be greater than 0");
      }
      
      if (data.initial_fee && data.initial_fee < 0) {
        throw new Error("Initial fee cannot be negative");
      }

      // Enforce rental rules based on customer type
      const customerType = selectedCustomer?.customer_type || selectedCustomer?.type;
      if (customerType === "Individual" && activeRentalsCount && activeRentalsCount > 0) {
        throw new Error("This customer already has an active rental. Individuals can only have one active rental at a time.");
      }
      
      // Create rental
      const { data: rental, error: rentalError } = await supabase
        .from("rentals")
        .insert({
          customer_id: data.customer_id,
          vehicle_id: data.vehicle_id,
          start_date: data.start_date.toISOString().split('T')[0],
          end_date: data.end_date.toISOString().split('T')[0],
          monthly_amount: data.monthly_amount,
          status: "Active",
        })
        .select()
        .single();

      if (rentalError) throw rentalError;

      // Charges are automatically generated by database trigger
      // No need to manually call rental_create_charge here

      // If there's an initial fee, create payment record and process via existing pipeline
      if (data.initial_fee && data.initial_fee > 0) {
        const { data: initialPayment, error: paymentError } = await supabase
          .from("payments")
          .insert({
            customer_id: data.customer_id,
            rental_id: rental.id,
            vehicle_id: data.vehicle_id,
            amount: data.initial_fee,
            payment_date: data.start_date.toISOString().split('T')[0], // Use rental start_date
            payment_type: PAYMENT_TYPES.INITIAL_FEE,
            method: "System", // System-generated payment
          })
          .select()
          .single();

        if (paymentError) throw paymentError;

        // Process payment via existing apply-payment pipeline
        console.log('Processing initial fee payment:', initialPayment.id);
        const { data: paymentResult, error: processError } = await supabase.functions.invoke('apply-payment', {
          body: { paymentId: initialPayment.id }
        });

        if (processError) {
          console.error('Initial fee payment processing error:', processError);
          throw new Error(`Failed to process initial fee payment: ${processError.message}`);
        }

        if (paymentResult && !paymentResult.ok) {
          console.error('Initial fee payment processing failed:', paymentResult);
          throw new Error(`Initial fee payment processing failed: ${paymentResult.error || 'Unknown error'}`);
        }

        console.log('Initial fee payment processed successfully:', paymentResult);
      }

      // Update vehicle status to Rented
      await supabase
        .from("vehicles")
        .update({ status: "Rented" })
        .eq("id", data.vehicle_id);

      // Generate only first month's charge (subsequent charges created monthly)
      await supabase.rpc("backfill_rental_charges_first_month_only");

      const customerName = selectedCustomer?.name || "Customer";
      const vehicleReg = selectedVehicle?.reg || "Vehicle";
      
      toast({
        title: "Rental Created",
        description: `Rental created for ${customerName} • ${vehicleReg}`,
      });

      // Refresh queries and navigate
      queryClient.invalidateQueries({ queryKey: ["rentals-list"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-rentals"] });
      queryClient.invalidateQueries({ queryKey: ["customer-net-position"] });
      navigate(`/rentals/${rental.id}`);
    } catch (error: any) {
      console.error("Error creating rental:", error);
      
      // Surface full Postgres error
      const errorMessage = error?.message || "Failed to create rental agreement. Please try again.";
      const errorDetails = error?.details || error?.hint || "";
      const fullError = errorDetails ? `${errorMessage}\n\nDetails: ${errorDetails}` : errorMessage;
      
      console.error("Full rental creation error:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        error
      });
      
      setSubmitError(fullError);
      toast({
        title: "Error Creating Rental",
        description: fullError,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Form validation state
  const isFormValid = form.formState.isValid && !form.formState.isValidating;
  const yearAgo = subYears(new Date(), 1);
  
  // Check if start date is in the past
  const isPastStartDate = watchedValues.start_date && isBefore(watchedValues.start_date, todayAtMidnight);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate("/rentals")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Rentals
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Create New Rental</h1>
          <p className="text-muted-foreground">Set up a new rental agreement</p>
        </div>
      </div>

      {/* Two-column layout: Form + Contract Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Form */}
        <div className="xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Rental Agreement Details
              </CardTitle>
              <CardDescription>
                Fill in the details to create a new rental agreement. Monthly charges will be automatically generated.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Submit Error Alert */}
              {submitError && (
                <Alert variant="destructive" className="mb-6">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{submitError}</AlertDescription>
                </Alert>
              )}

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Customer and Vehicle Selection */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="customer_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Customer *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={form.formState.errors.customer_id ? "border-destructive" : ""}>
                                <SelectValue placeholder="Select customer" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {customers?.map((customer) => {
                                const customerType = customer.customer_type || customer.type;
                                const contact = customer.email || customer.phone;
                                return (
                                  <SelectItem key={customer.id} value={customer.id}>
                                    {customer.name} • {contact || customerType}
                                  </SelectItem>
                                );
                              })}
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
                          <FormLabel>Vehicle *</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className={form.formState.errors.vehicle_id ? "border-destructive" : ""}>
                                <SelectValue placeholder="Select vehicle" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {vehicles?.map((vehicle) => (
                                <SelectItem key={vehicle.id} value={vehicle.id}>
                                  {vehicle.reg} • {vehicle.make} {vehicle.model}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                          <FormDescription>
                            Only available vehicles are shown
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Dates */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="start_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Start Date *</FormLabel>
                          <FormControl>
                            <DatePickerInput
                              date={field.value}
                              onSelect={field.onChange}
                              placeholder="Select start date"
                              disabled={(date) => isBefore(date, yearAgo)}
                              error={!!form.formState.errors.start_date}
                              className="w-full"
                            />
                          </FormControl>
                          {isPastStartDate && (
                            <div className="flex items-center gap-1 text-amber-600 text-sm">
                              <AlertTriangle className="h-3 w-3" />
                              Warning: Start date is in the past
                            </div>
                          )}
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="end_date"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>End Date *</FormLabel>
                          <FormControl>
                            <DatePickerInput
                              date={field.value}
                              onSelect={field.onChange}
                              placeholder="Select end date"
                              disabled={(date) => 
                                watchedValues.start_date 
                                  ? isBefore(date, addMonths(watchedValues.start_date, 1))
                                  : false
                              }
                              error={!!form.formState.errors.end_date}
                              className="w-full"
                            />
                          </FormControl>
                          <FormMessage />
                          <FormDescription>
                            Must be at least 1 month after start date
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Financial Details */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="monthly_amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Amount *</FormLabel>
                          <FormControl>
                            <CurrencyInput
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Monthly rental amount"
                              min={1}
                              step={1}
                              error={!!form.formState.errors.monthly_amount}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="initial_fee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Initial Fee (Optional)</FormLabel>
                          <FormControl>
                            <CurrencyInput
                              value={field.value}
                              onChange={field.onChange}
                              placeholder="Initial fee amount"
                              min={0}
                              step={1}
                              error={!!form.formState.errors.initial_fee}
                            />
                          </FormControl>
                          <FormMessage />
                          <FormDescription>
                            Initial fee is recorded as a payment on the start date and will show in Payments & P&L (Initial Fees)
                          </FormDescription>
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Helper Info */}
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">
                      <strong>Note:</strong> Monthly charges will be generated automatically from the start date to the end date. 
                      Payments are applied automatically to outstanding charges.
                    </p>
                  </div>

                  {/* Submit */}
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => navigate("/rentals")}>
                      Cancel
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={loading || !isFormValid}
                      className="bg-gradient-primary"
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {loading ? "Creating..." : "Create Rental"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Contract Summary Panel */}
        <div className="xl:col-span-1">
          <ContractSummary
            customer={selectedCustomer}
            vehicle={selectedVehicle}
            startDate={watchedValues.start_date}
            endDate={watchedValues.end_date}
            monthlyAmount={watchedValues.monthly_amount}
            initialFee={watchedValues.initial_fee}
          />
        </div>
      </div>
    </div>
  );
};

export default CreateRental;