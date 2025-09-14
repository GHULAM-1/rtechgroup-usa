import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const policySchema = z.object({
  policy_number: z.string().min(3, "Policy number must be at least 3 characters"),
  provider: z.string().optional(),
  start_date: z.date({
    required_error: "Start date is required",
  }),
  expiry_date: z.date({
    required_error: "Expiry date is required",
  }),
  vehicle_id: z.string().optional(),
  status: z.enum(["Active", "Expired", "Suspended", "Cancelled"]),
  notes: z.string().optional(),
}).refine(
  (data) => data.expiry_date > data.start_date,
  {
    message: "Expiry date must be after start date",
    path: ["expiry_date"],
  }
);

type PolicyFormData = z.infer<typeof policySchema>;

interface InsurancePolicyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  policyId?: string;
}

export function InsurancePolicyDialog({
  open,
  onOpenChange,
  customerId,
  policyId
}: InsurancePolicyDialogProps) {
  const queryClient = useQueryClient();
  const isEditing = Boolean(policyId);

  const form = useForm<PolicyFormData>({
    resolver: zodResolver(policySchema),
    defaultValues: {
      policy_number: "",
      provider: "",
      start_date: new Date(),
      expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Default to 1 year from now
      vehicle_id: "none",
      status: "Active",
      notes: "",
    },
  });

  // Fetch existing policy data if editing
  const { data: existingPolicy } = useQuery({
    queryKey: ["insurance-policy", policyId],
    queryFn: async () => {
      if (!policyId) return null;
      const { data, error } = await supabase
        .from("insurance_policies")
        .select("*")
        .eq("id", policyId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: isEditing && open,
  });

  // Fetch vehicles for the customer
  const { data: vehicles } = useQuery({
    queryKey: ["customer-vehicles", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          vehicle_id,
          vehicles!inner(
            id,
            reg,
            make,
            model
          )
        `)
        .eq("customer_id", customerId)
        .eq("status", "Active");
      
      if (error) throw error;
      return data.map(r => r.vehicles).filter(Boolean);
    },
    enabled: open,
  });

  // Reset form when policy data loads
  useEffect(() => {
    if (existingPolicy && open) {
      form.reset({
        policy_number: existingPolicy.policy_number,
        provider: existingPolicy.provider || "",
        start_date: new Date(existingPolicy.start_date),
        expiry_date: new Date(existingPolicy.expiry_date),
        vehicle_id: existingPolicy.vehicle_id || "none",
        status: existingPolicy.status as PolicyFormData["status"],
        notes: existingPolicy.notes || "",
      });
    } else if (open && !isEditing) {
      // Reset to defaults when opening for new policy
      form.reset({
        policy_number: "",
        provider: "",
        start_date: new Date(),
        expiry_date: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        vehicle_id: "none",
        status: "Active",
        notes: "",
      });
    }
  }, [existingPolicy, open, form, isEditing]);

  const savePolicyMutation = useMutation({
    mutationFn: async (data: PolicyFormData) => {
      const policyData = {
        customer_id: customerId,
        policy_number: data.policy_number,
        provider: data.provider || null,
        start_date: format(data.start_date, "yyyy-MM-dd"),
        expiry_date: format(data.expiry_date, "yyyy-MM-dd"),
        vehicle_id: data.vehicle_id === "none" ? null : data.vehicle_id || null,
        status: data.status,
        notes: data.notes || null,
      };

      if (isEditing) {
        const { data: result, error } = await supabase
          .from("insurance_policies")
          .update(policyData)
          .eq("id", policyId)
          .select()
          .single();
        if (error) throw error;
        return result;
      } else {
        const { data: result, error } = await supabase
          .from("insurance_policies")
          .insert(policyData)
          .select()
          .single();
        if (error) throw error;
        return result;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customer-insurance", customerId] });
      queryClient.invalidateQueries({ queryKey: ["insurance-policies"] });
      toast.success(isEditing ? "Policy updated successfully" : "Policy created successfully");
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error saving policy:", error);
      toast.error("Failed to save policy");
    },
  });

  const onSubmit = (data: PolicyFormData) => {
    savePolicyMutation.mutate(data);
  };

  const handleClose = () => {
    onOpenChange(false);
    form.reset();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Edit Insurance Policy" : "Add Insurance Policy"}
          </DialogTitle>
          <DialogDescription>
            {isEditing 
              ? "Update the insurance policy details below."
              : "Enter the insurance policy details below."
            }
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="policy_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Policy Number *</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter policy number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Provider</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Aviva, AXA" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Start Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
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
                name="expiry_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Expiry Date *</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full pl-3 text-left font-normal",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value ? (
                              format(field.value, "PPP")
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

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a vehicle" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No vehicle assigned</SelectItem>
                        {vehicles?.map((vehicle) => (
                          <SelectItem key={vehicle.id} value={vehicle.id}>
                            {vehicle.reg} - {vehicle.make} {vehicle.model}
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Expired">Expired</SelectItem>
                        <SelectItem value="Suspended">Suspended</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Any additional notes about this policy..."
                      className="min-h-[80px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={savePolicyMutation.isPending}
              >
                {savePolicyMutation.isPending 
                  ? (isEditing ? "Updating..." : "Creating...") 
                  : (isEditing ? "Update Policy" : "Create Policy")
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}