import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Car, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const vehicleSchema = z.object({
  reg: z.string().min(1, "Registration number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  colour: z.string().min(1, "Colour is required"),
  purchase_price: z.number().min(0, "Price must be positive").optional(),
  acquisition_date: z.date(),
  acquisition_type: z.enum(['Purchase', 'Finance']),
  // Finance fields (only required when acquisition_type is 'Finance')
  monthly_payment: z.number().min(0).optional(),
  initial_payment: z.number().min(0).default(0),
  term_months: z.number().int().min(1).optional(),
  balloon: z.number().min(0).optional(),
  finance_start_date: z.date().optional(),
}).refine(
  (data) => {
    if (data.acquisition_type === 'Finance' && !data.monthly_payment) {
      return false;
    }
    if (data.acquisition_type === 'Purchase' && !data.purchase_price) {
      return false;
    }
    return true;
  },
  {
    message: "Monthly payment is required for financed vehicles",
    path: ["monthly_payment"],
  }
).refine(
  (data) => {
    if (data.acquisition_type === 'Purchase' && !data.purchase_price) {
      return false;
    }
    return true;
  },
  {
    message: "Purchase price is required for purchased vehicles",
    path: ["purchase_price"],
  }
);

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface AddVehicleDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const AddVehicleDialog = ({ open, onOpenChange }: AddVehicleDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      reg: "",
      make: "",
      model: "",
      colour: "",
      purchase_price: 0,
      acquisition_date: new Date(),
      acquisition_type: "Purchase",
      monthly_payment: 0,
      initial_payment: 0,
      term_months: undefined,
      balloon: 0,
      finance_start_date: undefined,
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

  const onSubmit = async (data: VehicleFormData) => {
    setLoading(true);

    try {
      const { data: vehicle, error } = await supabase
        .from("vehicles")
        .insert({
          reg: data.reg,
          make: data.make,
          model: data.model,
          colour: data.colour,
          acquisition_type: data.acquisition_type,
          acquisition_date: data.acquisition_date.toISOString().split('T')[0],
          status: "Available",
          // Include purchase price only for purchased vehicles
          ...(data.acquisition_type === 'Purchase' && { purchase_price: data.purchase_price }),
          // Add finance fields only if acquisition type is Finance
          ...(data.acquisition_type === 'Finance' && {
            monthly_payment: data.monthly_payment,
            initial_payment: data.initial_payment,
            term_months: data.term_months,
            balloon: data.balloon,
            finance_start_date: data.finance_start_date?.toISOString().split('T')[0],
          }),
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Vehicle Added",
        description: `${data.make} ${data.model} (${data.reg}) has been added to your fleet.`,
      });

      form.reset();
      handleOpenChange(false);
      
      // Refresh the vehicles list and P&L data
      queryClient.invalidateQueries({ queryKey: ["vehicles-list"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-pl"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-count"] });
      queryClient.invalidateQueries({ queryKey: ["vehicle-pl-entries"] });
    } catch (error: any) {
      let errorMessage = "Failed to add vehicle. Please try again.";
      
      // Check for unique constraint violation on registration number
      if (error?.code === '23505' && error?.details?.includes('vehicles_reg_key')) {
        errorMessage = `A vehicle with registration '${data.reg}' already exists. Please use a different registration number.`;
      } else if (error?.code === '23505') {
        errorMessage = "This vehicle registration number is already in use. Please check and try again.";
      } else if (error?.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={currentOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary text-primary-foreground hover:opacity-90 transition-all duration-200 rounded-lg focus:ring-2 focus:ring-primary">
          <Plus className="mr-2 h-4 w-4" />
          Add Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Add New Vehicle
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Registration Number</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. AB12 CDE" {...field} className="input-focus" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="acquisition_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Acquisition Date</FormLabel>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="make"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Make</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Ford" {...field} className="input-focus" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="model"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Model</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Transit" {...field} className="input-focus" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className={`grid gap-4 ${form.watch("acquisition_type") === "Purchase" ? "grid-cols-2" : "grid-cols-1"}`}>
              <FormField
                control={form.control}
                name="colour"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Colour</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. White" {...field} className="input-focus" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {form.watch("acquisition_type") === "Purchase" && (
                <FormField
                  control={form.control}
                  name="purchase_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Purchase Price (£)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
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
              )}
            </div>

            <FormField
              control={form.control}
              name="acquisition_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Acquisition Type</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger className="input-focus">
                        <SelectValue placeholder="Select acquisition type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Purchase">Purchase</SelectItem>
                      <SelectItem value="Finance">Finance</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Finance Section - Only show when acquisition type is Finance */}
            {form.watch("acquisition_type") === "Finance" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <DollarSign className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Finance Information</h3>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthly_payment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly Payment (£) *</FormLabel>
                        <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Balloon amount" 
                        {...field}
                        onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        className="input-focus"
                      />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="initial_payment"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Initial Payment (£)</FormLabel>
                        <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Monthly payment" 
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

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="term_months"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Term (Months)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="36" 
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || undefined)}
                            className="input-focus"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="balloon"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Balloon Payment (£)</FormLabel>
                        <FormControl>
                      <Input 
                        type="number" 
                        placeholder="Balloon amount" 
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
                  name="finance_start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Finance Start Date</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field}
                          value={field.value ? field.value.toISOString().split('T')[0] : ''}
                          onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : undefined)}
                          className="input-focus"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Contract Total Display */}
                {form.watch("monthly_payment") && (
                  <div className="p-3 bg-primary/10 rounded border">
                    <div className="text-sm font-medium text-primary">Contract Total (Upfront P&L Accounting)</div>
                    <div className="text-lg font-bold">
                      £{(
                        (form.watch("initial_payment") || 0) + 
                        ((form.watch("monthly_payment") || 0) * (form.watch("term_months") || 0)) + 
                        (form.watch("balloon") || 0)
                      ).toLocaleString()}
                    </div>
                    <div className="text-xs text-muted-foreground mb-2">
                      Initial: £{(form.watch("initial_payment") || 0).toLocaleString()} + 
                      Monthly: £{((form.watch("monthly_payment") || 0) * (form.watch("term_months") || 0)).toLocaleString()} + 
                      Balloon: £{(form.watch("balloon") || 0).toLocaleString()}
                    </div>
                    <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border-l-2 border-amber-300">
                      <strong>Note:</strong> This financed vehicle's full contract total is posted immediately as an Acquisition cost for P&L reporting. 
                      Ongoing finance payments won't affect P&L (to prevent double-counting).
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading} className="bg-gradient-primary rounded-lg transition-all duration-200 focus:ring-2 focus:ring-primary">
                {loading ? "Adding..." : "Add Vehicle"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};