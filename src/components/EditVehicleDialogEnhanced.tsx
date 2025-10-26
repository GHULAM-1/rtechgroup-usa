import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Edit, Car, PoundSterling, CalendarIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getContractTotal } from "@/lib/vehicleUtils";

const vehicleSchema = z.object({
  reg: z.string().min(1, "Registration number is required"),
  make: z.string().min(1, "Make is required"),
  model: z.string().min(1, "Model is required"),
  colour: z.string().min(1, "Colour is required"),
  purchase_price: z.number().min(0, "Price must be positive").optional(),
  contract_total: z.number().min(0, "Contract total must be positive").optional(),
  acquisition_date: z.date(),
  acquisition_type: z.enum(['Purchase', 'Finance']),
  // MOT & TAX fields
  mot_due_date: z.date().optional(),
  tax_due_date: z.date().optional(),
  // Warranty fields  
  warranty_start_date: z.date().optional(),
  warranty_end_date: z.date().optional(),
  // Logbook field
  has_logbook: z.boolean().default(false),
  // Service plan and spare key fields
  has_service_plan: z.boolean().default(false),
  has_spare_key: z.boolean().default(false),
  spare_key_holder: z.enum(["Company", "Customer"]).optional(),
  spare_key_notes: z.string().optional(),
  // Security fields
  has_ghost: z.boolean().default(false),
  has_tracker: z.boolean().default(false),
  has_remote_immobiliser: z.boolean().default(false),
  ghost_code: z.string().optional(),
  security_notes: z.string().optional(),
}).refine(
  (data) => {
    if (data.acquisition_type === 'Finance' && !data.contract_total) {
      return false;
    }
    if (data.acquisition_type === 'Purchase' && !data.purchase_price) {
      return false;
    }
    return true;
  },
  {
    message: "Contract total is required for financed vehicles",
    path: ["contract_total"],
  }
).refine((data) => {
  if (data.has_spare_key) {
    return data.spare_key_holder !== undefined;
  }
  return true;
}, {
  message: "Spare key holder is required when spare key exists",
  path: ["spare_key_holder"],
});

type VehicleFormData = z.infer<typeof vehicleSchema>;

interface Vehicle {
  id: string;
  reg: string;
  make: string;
  model: string;
  colour: string;
  purchase_price?: number;
  acquisition_date: string;
  acquisition_type: string;
  // Finance fields for backward compatibility
  monthly_payment?: number;
  initial_payment?: number;
  term_months?: number;
  balloon?: number;
  mot_due_date?: string;
  tax_due_date?: string;
  warranty_start_date?: string;
  warranty_end_date?: string;
  has_logbook?: boolean;
  has_service_plan?: boolean;
  has_spare_key?: boolean;
  spare_key_holder?: string | null;
  spare_key_notes?: string | null;
  has_ghost?: boolean;
  has_tracker?: boolean;
  has_remote_immobiliser?: boolean;
  ghost_code?: string | null;
  security_notes?: string | null;
}

interface EditVehicleDialogProps {
  vehicle: Vehicle;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export const EditVehicleDialogEnhanced = ({ vehicle, open, onOpenChange }: EditVehicleDialogProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Calculate contract total for existing finance vehicles
  const existingContractTotal = vehicle.acquisition_type === 'Finance' 
    ? getContractTotal(vehicle)
    : undefined;
  
  const form = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleSchema),
    defaultValues: {
      reg: vehicle.reg,
      make: vehicle.make,
      model: vehicle.model,
      colour: vehicle.colour,
      purchase_price: vehicle.purchase_price,
      contract_total: existingContractTotal,
      acquisition_date: new Date(vehicle.acquisition_date),
      acquisition_type: vehicle.acquisition_type as 'Purchase' | 'Finance',
      mot_due_date: vehicle.mot_due_date ? new Date(vehicle.mot_due_date) : undefined,
      tax_due_date: vehicle.tax_due_date ? new Date(vehicle.tax_due_date) : undefined,
      warranty_start_date: vehicle.warranty_start_date ? new Date(vehicle.warranty_start_date) : undefined,
      warranty_end_date: vehicle.warranty_end_date ? new Date(vehicle.warranty_end_date) : undefined,
      has_logbook: vehicle.has_logbook || false,
      has_service_plan: vehicle.has_service_plan || false,
      has_spare_key: vehicle.has_spare_key || false,
      spare_key_holder: vehicle.spare_key_holder as 'Company' | 'Customer' | undefined,
      spare_key_notes: vehicle.spare_key_notes || "",
      has_ghost: vehicle.has_ghost || false,
      has_tracker: vehicle.has_tracker || false,
      has_remote_immobiliser: vehicle.has_remote_immobiliser || false,
      ghost_code: vehicle.ghost_code || "",
      security_notes: vehicle.security_notes || "",
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
      // Normalize registration
      const normalizedReg = data.reg.toUpperCase().trim();
      
      const vehicleData: any = {
        reg: normalizedReg,
        make: data.make,
        model: data.model,
        colour: data.colour,
        acquisition_type: data.acquisition_type,
        acquisition_date: data.acquisition_date.toISOString().split('T')[0],
        mot_due_date: data.mot_due_date?.toISOString().split('T')[0],
        tax_due_date: data.tax_due_date?.toISOString().split('T')[0],
        warranty_start_date: data.warranty_start_date?.toISOString().split('T')[0],
        warranty_end_date: data.warranty_end_date?.toISOString().split('T')[0],
        has_logbook: data.has_logbook,
        has_service_plan: data.has_service_plan,
        has_spare_key: data.has_spare_key,
        spare_key_holder: data.has_spare_key ? data.spare_key_holder : null,
        spare_key_notes: data.has_spare_key ? data.spare_key_notes : null,
        has_ghost: data.has_ghost,
        has_tracker: data.has_tracker,
        has_remote_immobiliser: data.has_remote_immobiliser,
        ghost_code: data.has_ghost ? data.ghost_code : null,
        security_notes: data.security_notes || null,
      };

      // Add type-specific fields
      if (data.acquisition_type === 'Purchase') {
        vehicleData.purchase_price = data.purchase_price;
        // Clear finance fields
        vehicleData.monthly_payment = null;
        vehicleData.initial_payment = null;
        vehicleData.term_months = null;
        vehicleData.balloon = null;
      } else if (data.acquisition_type === 'Finance') {
        // For finance vehicles, convert contract total to the structure expected by triggers
        vehicleData.initial_payment = data.contract_total;
        vehicleData.monthly_payment = 1; // Dummy value to satisfy constraints
        vehicleData.term_months = 1; // Dummy value
        vehicleData.balloon = 0;
        // Clear purchase price
        vehicleData.purchase_price = null;
      }

      const { error } = await supabase
        .from("vehicles")
        .update(vehicleData)
        .eq('id', vehicle.id);

      if (error) throw error;

      toast({
        title: "Vehicle Updated",
        description: `${data.make} ${data.model} (${normalizedReg}) has been updated successfully.`,
      });

      handleOpenChange(false);
      
      // Refresh the vehicle data and P&L data
      queryClient.invalidateQueries({ queryKey: ["vehicle", vehicle.id] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-list"] });
      queryClient.invalidateQueries({ queryKey: ["vehicles-pl"] });
    } catch (error: any) {
      let errorMessage = "Failed to update vehicle. Please try again.";
      
      if (error?.code === '23505' && error?.details?.includes('vehicles_reg_key')) {
        errorMessage = `A vehicle with registration '${data.reg}' already exists. Please use a different registration number.`;
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
        <Button variant="outline" size="sm">
          <Edit className="h-4 w-4 mr-2" />
          Edit Vehicle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            Edit Vehicle: {vehicle.reg}
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
                    <FormLabel>License Plate Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. AB12 CDE"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      />
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
                      <Input placeholder="e.g. Ford" {...field} />
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
                      <Input placeholder="e.g. Transit" {...field} />
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
                    <FormLabel>Color</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. White" {...field} />
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
                      <FormLabel>Purchase Price ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter amount"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
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
                      <SelectTrigger>
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

            {/* Finance Section */}
            {form.watch("acquisition_type") === "Finance" && (
              <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-2 mb-3">
                  <PoundSterling className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold text-sm">Finance Information</h3>
                </div>
                
                <FormField
                  control={form.control}
                  name="contract_total"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contract Total ($) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Enter total contract value"
                          {...field}
                          onChange={(e) => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="text-xs bg-blue-50 text-blue-800 p-3 rounded border border-blue-200">
                  <strong>Finance P&L Approach:</strong> We track total finance cost only (no monthly breakdown). 
                  The full contract value is posted upfront as an Acquisition cost for accurate P&L reporting.
                </div>
              </div>
            )}

            {/* MOT & TAX Due Dates */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="mot_due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>MOT Due Date</FormLabel>
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
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick MOT due date</span>
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
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="tax_due_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>TAX Due Date</FormLabel>
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
                              format(field.value, "PPP")
                            ) : (
                              <span>Pick TAX due date</span>
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
                          initialFocus
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Compliance Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Compliance</h3>
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Has Logbook</label>
                  <div className="text-sm text-muted-foreground">
                    Vehicle has a physical logbook
                  </div>
                </div>
                <Switch
                  checked={form.watch("has_logbook")}
                  onCheckedChange={(checked) => form.setValue("has_logbook", checked)}
                />
              </div>
            </div>

            {/* Ownership & Security Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Ownership & Security</h3>
              
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Service Plan</label>
                  <div className="text-sm text-muted-foreground">
                    Vehicle has an active service plan (for admin visibility only)
                  </div>
                </div>
                <Switch
                  checked={form.watch("has_service_plan")}
                  onCheckedChange={(checked) => form.setValue("has_service_plan", checked)}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Spare Key</label>
                  <div className="text-sm text-muted-foreground">
                    Spare key exists for this vehicle
                  </div>
                </div>
                <Switch
                  checked={form.watch("has_spare_key")}
                  onCheckedChange={(checked) => {
                    form.setValue("has_spare_key", checked);
                    if (!checked) {
                      form.setValue("spare_key_holder", undefined);
                      form.setValue("spare_key_notes", "");
                    } else {
                      form.setValue("spare_key_holder", "Company");
                    }
                  }}
                />
              </div>

              {form.watch("has_spare_key") && (
                <div className="space-y-4 ml-4 border-l-2 border-muted pl-4">
                  <div className="space-y-3">
                    <label className="text-sm font-medium">Spare Key Holder</label>
                    <RadioGroup
                      value={form.watch("spare_key_holder")}
                      onValueChange={(value) => form.setValue("spare_key_holder", value as "Company" | "Customer")}
                      className="flex flex-col space-y-2"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Company" id="edit-company" />
                        <label htmlFor="edit-company" className="text-sm">Company</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="Customer" id="edit-customer" />
                        <label htmlFor="edit-customer" className="text-sm">Customer</label>
                      </div>
                    </RadioGroup>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Notes (Optional)</label>
                    <Textarea
                      placeholder="e.g., with John - locker A3"
                      value={form.watch("spare_key_notes") || ""}
                      onChange={(e) => form.setValue("spare_key_notes", e.target.value)}
                      rows={2}
                    />
                    <div className="text-sm text-muted-foreground">
                      Additional context about the spare key location or holder
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Security Features Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Security Features</h3>
              
              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Ghost Immobilizer</label>
                  <div className="text-sm text-muted-foreground">
                    Vehicle has a Ghost immobilizer installed
                  </div>
                </div>
                <Switch
                  checked={form.watch("has_ghost")}
                  onCheckedChange={(checked) => {
                    form.setValue("has_ghost", checked);
                    if (!checked) {
                      form.setValue("ghost_code", "");
                    }
                  }}
                />
              </div>

              {form.watch("has_ghost") && (
                <div className="ml-4 border-l-2 border-muted pl-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Ghost Code</label>
                    <Input
                      placeholder="Enter Ghost immobiliser code"
                      value={form.watch("ghost_code") || ""}
                      onChange={(e) => form.setValue("ghost_code", e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">GPS Tracker</label>
                  <div className="text-sm text-muted-foreground">
                    Vehicle has a GPS tracker installed
                  </div>
                </div>
                <Switch
                  checked={form.watch("has_tracker")}
                  onCheckedChange={(checked) => form.setValue("has_tracker", checked)}
                />
              </div>

              <div className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                <div className="space-y-0.5">
                  <label className="text-sm font-medium">Remote Immobilizer</label>
                  <div className="text-sm text-muted-foreground">
                    Vehicle has a remote immobilizer system
                  </div>
                </div>
                <Switch
                  checked={form.watch("has_remote_immobiliser")}
                  onCheckedChange={(checked) => form.setValue("has_remote_immobiliser", checked)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Security Notes (Optional)</label>
                <Textarea
                  placeholder="Additional security information..."
                  value={form.watch("security_notes") || ""}
                  onChange={(e) => form.setValue("security_notes", e.target.value)}
                  rows={2}
                />
                <div className="text-sm text-muted-foreground">
                  Any additional security-related information or notes
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};