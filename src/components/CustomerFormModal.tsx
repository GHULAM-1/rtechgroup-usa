import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Users, Mail, Phone, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const customerSchema = z.object({
  type: z.enum(['Individual', 'Company']),
  customer_type: z.enum(['Individual', 'Company']),
  name: z.string()
    .min(1, "Name is required")
    .refine((val) => !/\d/.test(val), "Name cannot contain numbers"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string()
    .optional()
    .refine((val) => !val || /^[0-9\s\-\(\)\+]+$/.test(val), "Phone number can only contain numbers and formatting characters"),
  whatsapp_opt_in: z.boolean(),
  high_switcher: z.boolean(),
  status: z.enum(['Active', 'Inactive']),
  notes: z.string().optional(),
  // Next of Kin fields
  nok_full_name: z.string()
    .optional()
    .refine((val) => !val || !/\d/.test(val), "Name cannot contain numbers"),
  nok_relationship: z.string()
    .optional()
    .refine((val) => !val || /^[a-zA-Z\s]+$/.test(val), "Relationship can only contain letters"),
  nok_phone: z.string()
    .optional()
    .refine((val) => !val || /^[0-9\s\-\(\)\+]+$/.test(val), "Phone number can only contain numbers and formatting characters"),
  nok_email: z.string().email("Invalid email format").optional().or(z.literal("")),
  nok_address: z.string().optional(),
}).superRefine((data, ctx) => {
  if (!data.email && !data.phone) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either email or phone is required",
      path: ["email"],
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Either email or phone is required",
      path: ["phone"],
    });
  }
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  type: string;
  customer_type?: "Individual" | "Company";
  status: string;
  whatsapp_opt_in: boolean;
  high_switcher?: boolean;
  nok_full_name?: string;
  nok_relationship?: string;
  nok_phone?: string;
  nok_email?: string;
  nok_address?: string;
}

interface CustomerFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
}

export const CustomerFormModal = ({ open, onOpenChange, customer }: CustomerFormModalProps) => {
  const [loading, setLoading] = useState(false);
  const [showNextOfKin, setShowNextOfKin] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!customer;

  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      type: "Individual",
      customer_type: "Individual",
      name: "",
      email: "",
      phone: "",
      whatsapp_opt_in: false,
      high_switcher: false,
      status: "Active",
      notes: "",
      nok_full_name: "",
      nok_relationship: "",
      nok_phone: "",
      nok_email: "",
      nok_address: "",
    },
  });

  const customerType = form.watch("customer_type");

  // Update form when customer changes
  useEffect(() => {
    if (customer) {
      const hasNextOfKin = customer.nok_full_name || customer.nok_relationship || 
                          customer.nok_phone || customer.nok_email || customer.nok_address;
      setShowNextOfKin(!!hasNextOfKin);
      
      form.reset({
        type: customer.type as "Individual" | "Company",
        customer_type: customer.customer_type || "Individual",
        name: customer.name,
        email: customer.email || "",
        phone: customer.phone || "",
        whatsapp_opt_in: customer.whatsapp_opt_in,
        high_switcher: customer.high_switcher || false,
        status: customer.status as "Active" | "Inactive",
        notes: "",
        nok_full_name: customer.nok_full_name || "",
        nok_relationship: customer.nok_relationship || "",
        nok_phone: customer.nok_phone || "",
        nok_email: customer.nok_email || "",
        nok_address: customer.nok_address || "",
      });
    } else {
      setShowNextOfKin(false);
      form.reset({
        type: "Individual",
        customer_type: "Individual",
        name: "",
        email: "",
        phone: "",
        whatsapp_opt_in: false,
        high_switcher: false,
        status: "Active",
        notes: "",
        nok_full_name: "",
        nok_relationship: "",
        nok_phone: "",
        nok_email: "",
        nok_address: "",
      });
    }
  }, [customer, form]);

  const onSubmit = async (data: CustomerFormData) => {
    setLoading(true);

    try {
      const payload = {
        type: data.type,
        customer_type: data.customer_type,
        name: data.name,
        email: data.email || null,
        phone: data.phone || null,
        whatsapp_opt_in: data.whatsapp_opt_in,
        high_switcher: data.high_switcher,
        status: data.status,
        nok_full_name: data.nok_full_name || null,
        nok_relationship: data.nok_relationship || null,
        nok_phone: data.nok_phone || null,
        nok_email: data.nok_email || null,
        nok_address: data.nok_address || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("customers")
          .update(payload)
          .eq("id", customer.id);

        if (error) throw error;

        toast({
          title: "Customer Updated",
          description: `${data.name} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase
          .from("customers")
          .insert(payload);

        if (error) throw error;

        toast({
          title: "Customer Added",
          description: `${data.name} has been added to your customer database.`,
        });
      }

      // Refresh the customers list
      queryClient.invalidateQueries({ queryKey: ["customers-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-balances-list"] });
      queryClient.invalidateQueries({ queryKey: ["customer-balances-enhanced"] });

      // Close modal and reset form
      onOpenChange(false);
      if (!isEditing) {
        form.reset();
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'add'} customer. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      form.handleSubmit(onSubmit)();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {isEditing ? 'Edit Customer' : 'Add New Customer'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Legacy Type *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-focus">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Individual">Individual</SelectItem>
                        <SelectItem value="Company">Company</SelectItem>
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
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-focus">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="Active">Active</SelectItem>
                        <SelectItem value="Inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="customer_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer Type *</FormLabel>
                  <FormControl>
                    <div className="flex gap-6">
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          value="Individual"
                          checked={field.value === "Individual"}
                          onChange={() => field.onChange("Individual")}
                          className="w-4 h-4 text-primary"
                        />
                        <span>Individual</span>
                      </label>
                      <label className="flex items-center space-x-2 cursor-pointer">
                        <input
                          type="radio"
                          value="Company"
                          checked={field.value === "Company"}
                          onChange={() => field.onChange("Company")}
                          className="w-4 h-4 text-primary"
                        />
                        <span>Company (can have multiple active rentals)</span>
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="high_switcher"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">High Switcher</FormLabel>
                    <div className="text-sm text-muted-foreground">
                      Customer frequently changes cars
                    </div>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    {customerType === "Company" ? "Company Name *" : "Name *"}
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder={customerType === "Company" ? "Enter company name" : "Enter customer name"}
                      {...field}
                      className="input-focus"
                      autoFocus
                      onChange={(e) => {
                        const value = e.target.value.replace(/\d/g, "");
                        field.onChange(value);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      Email *
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        {...field}
                        className="input-focus"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Phone *
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(555) 123-4567"
                        {...field}
                        className="input-focus"
                        onChange={(e) => {
                          const value = e.target.value.replace(/[^0-9\s\-\(\)\+]/g, "");
                          field.onChange(value);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="whatsapp_opt_in"
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
                      WhatsApp Opt-In
                    </FormLabel>
                    <p className="text-sm text-muted-foreground">
                      Customer has opted in to receive WhatsApp notifications
                    </p>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Optional notes about this customer..." 
                      {...field}
                      className="input-focus resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Next of Kin Section */}
            <Collapsible open={showNextOfKin} onOpenChange={setShowNextOfKin}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" className="w-full">
                  <div className="flex items-center justify-between w-full">
                    <span>Next of Kin / Emergency Contact</span>
                    {showNextOfKin ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="nok_full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter full name"
                              {...field}
                              className="input-focus"
                              onChange={(e) => {
                                const value = e.target.value.replace(/\d/g, "");
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nok_relationship"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Relationship</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Spouse, Parent, Friend"
                              {...field}
                              className="input-focus"
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^a-zA-Z\s]/g, "");
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nok_phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="(555) 123-4567"
                              {...field}
                              className="input-focus"
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9\s\-\(\)\+]/g, "");
                                field.onChange(value);
                              }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="nok_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="Enter email address" {...field} className="input-focus" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="nok_address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Address</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Enter full address..."
                            {...field}
                            className="input-focus resize-none"
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="flex justify-end gap-2 pt-4">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={loading} 
                className="bg-gradient-primary rounded-lg transition-all duration-200 focus:ring-2 focus:ring-primary"
              >
                {loading ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Customer" : "Add Customer")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};