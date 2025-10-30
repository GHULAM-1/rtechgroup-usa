import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Users, Mail, Phone, Building2, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const leadSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Invalid email format").optional().or(z.literal("")),
  phone: z.string()
    .optional()
    .refine((val) => !val || val.length >= 10, "Phone number must be at least 10 digits"),
  company: z.string().max(100, "Company name must be less than 100 characters").optional(),
  status: z.enum(['New', 'In Progress', 'Completed', 'Declined']),
  source: z.string().max(50, "Source must be less than 50 characters").optional(),
  notes: z.string().max(500, "Notes must be less than 500 characters").optional(),
  expected_value: z.string()
    .optional()
    .refine((val) => !val || parseFloat(val) >= 0, "Expected value must be a positive number"),
  follow_up_date: z.string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const selectedDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return selectedDate >= today;
    }, "Follow-up date cannot be in the past"),
}).refine((data) => data.email || data.phone, {
  message: "Either email or phone is required",
  path: ["email"],
});

type LeadFormData = z.infer<typeof leadSchema>;

interface Lead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  status: string;
  source: string | null;
  notes: string | null;
  expected_value: number | null;
  follow_up_date: string | null;
}

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
}

export const AddLeadDialog = ({ open, onOpenChange, lead }: AddLeadDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEditing = !!lead;

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      company: "",
      status: "New",
      source: "",
      notes: "",
      expected_value: "",
      follow_up_date: "",
    },
  });

  // Reset form when lead changes
  useEffect(() => {
    if (lead) {
      form.reset({
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        company: lead.company || "",
        status: lead.status as any,
        source: lead.source || "",
        notes: lead.notes || "",
        expected_value: lead.expected_value?.toString() || "",
        follow_up_date: lead.follow_up_date || "",
      });
    } else {
      form.reset({
        name: "",
        email: "",
        phone: "",
        company: "",
        status: "New",
        source: "",
        notes: "",
        expected_value: "",
        follow_up_date: "",
      });
    }
  }, [lead, open, form]);

  const onSubmit = async (data: LeadFormData) => {
    setLoading(true);

    try {
      // Check for duplicate email or phone (excluding current lead if editing)
      if (data.email || data.phone) {
        let duplicateQuery = supabase
          .from("leads")
          .select("id, name, email, phone");

        if (data.email) {
          duplicateQuery = duplicateQuery.eq("email", data.email);
        } else if (data.phone) {
          duplicateQuery = duplicateQuery.eq("phone", data.phone);
        }

        if (isEditing) {
          duplicateQuery = duplicateQuery.neq("id", lead.id);
        }

        const { data: duplicates, error: duplicateError } = await duplicateQuery;

        if (duplicateError) {
          console.error('Error checking duplicates:', duplicateError);
        } else if (duplicates && duplicates.length > 0) {
          const duplicate = duplicates[0];
          const matchField = data.email && duplicate.email === data.email ? "email" : "phone";
          toast({
            title: "Duplicate Lead",
            description: `A lead with this ${matchField} already exists: ${duplicate.name}`,
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      const payload = {
        name: data.name.trim(),
        email: data.email?.trim() || null,
        phone: data.phone?.trim() || null,
        company: data.company?.trim() || null,
        status: data.status,
        source: data.source?.trim() || null,
        notes: data.notes?.trim() || null,
        expected_value: data.expected_value ? parseFloat(data.expected_value) : null,
        follow_up_date: data.follow_up_date || null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from("leads")
          .update(payload)
          .eq("id", lead.id);

        if (error) throw error;

        toast({
          title: "Lead Updated",
          description: `${data.name} has been updated successfully.`,
        });
      } else {
        const { error } = await supabase
          .from("leads")
          .insert(payload);

        if (error) throw error;

        toast({
          title: "Lead Added",
          description: `${data.name} has been added to your pipeline.`,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      onOpenChange(false);

      if (!isEditing) {
        form.reset();
      }
    } catch (error) {
      console.error('Error saving lead:', error);
      toast({
        title: "Error",
        description: `Failed to ${isEditing ? 'update' : 'add'} lead. Please try again.`,
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
            {isEditing ? 'Edit Lead' : 'Add New Lead'}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Enter lead name"
                      {...field}
                      className="input-focus"
                      autoFocus
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
                      Email
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
                      Phone
                    </FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(555) 123-4567"
                        {...field}
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
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Company
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Company name"
                      {...field}
                      className="input-focus"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="input-focus">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="New">New</SelectItem>
                        <SelectItem value="In Progress">In Progress</SelectItem>
                        <SelectItem value="Completed">Completed</SelectItem>
                        <SelectItem value="Declined">Declined</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="source"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Source</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., Referral, Website"
                        {...field}
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
                name="expected_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expected Value ($)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
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
                name="follow_up_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Follow-up Date
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        {...field}
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this lead..."
                      {...field}
                      className="input-focus resize-none"
                      rows={3}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {loading ? (isEditing ? "Updating..." : "Adding...") : (isEditing ? "Update Lead" : "Add Lead")}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};