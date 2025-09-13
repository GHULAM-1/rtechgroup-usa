import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const plateSchema = z.object({
  plate_number: z.string().min(1, "Plate number is required").max(10, "Plate number too long"),
  retention_doc_reference: z.string().optional(),
  notes: z.string().optional(),
});

type PlateFormData = z.infer<typeof plateSchema>;

interface AddPlateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const AddPlateDialog = ({
  open,
  onOpenChange,
  onSuccess,
}: AddPlateDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<PlateFormData>({
    resolver: zodResolver(plateSchema),
    defaultValues: {
      plate_number: "",
      retention_doc_reference: "",
      notes: "",
    },
  });

  const onSubmit = async (data: PlateFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("plates")
        .insert({
          plate_number: data.plate_number.toUpperCase(),
          retention_doc_reference: data.retention_doc_reference || null,
          notes: data.notes || null,
        });

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          throw new Error("Plate number already exists");
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "Plate added successfully",
      });

      form.reset();
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to add plate",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Plate</DialogTitle>
          <DialogDescription>
            Add a new license plate to the system.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="plate_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plate Number *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., ABC123"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                      className="uppercase"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="retention_doc_reference"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Retention Document Reference</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter retention document reference" />
                  </FormControl>
                  <FormMessage />
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
                    <Textarea {...field} placeholder="Additional notes about this plate..." />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Plate"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};