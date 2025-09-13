import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
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
}

export const AddPlateDialog = ({ open, onOpenChange }: AddPlateDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          toast({
            title: "Error",
            description: "This plate number already exists",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      toast({
        title: "Success",
        description: "License plate added successfully",
      });

      form.reset();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["plates"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add license plate",
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
          <DialogTitle>Add License Plate</DialogTitle>
          <DialogDescription>
            Add a new license plate to the database. You can assign it to a vehicle later.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="plate_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Plate Number</FormLabel>
                  <FormControl>
                    <Input 
                      {...field} 
                      placeholder="e.g. ABC123, AB12 CDE"
                      className="font-mono text-lg"
                      onChange={(e) => field.onChange(e.target.value.toUpperCase())}
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
                    <Input {...field} placeholder="Enter document reference" />
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