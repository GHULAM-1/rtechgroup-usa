import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const appealFormSchema = z.object({
  action: z.enum(["appeal_submitted", "appeal_successful", "appeal_rejected", "waive"]),
});

type AppealFormValues = z.infer<typeof appealFormSchema>;

interface FineAppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fineId: string | null;
}

export const FineAppealDialog = ({ open, onOpenChange, fineId }: FineAppealDialogProps) => {
  const queryClient = useQueryClient();

  const form = useForm<AppealFormValues>({
    resolver: zodResolver(appealFormSchema),
  });

  // Get fine details
  const { data: fine } = useQuery({
    queryKey: ["fine", fineId],
    queryFn: async () => {
      if (!fineId) return null;
      const { data, error } = await supabase
        .from("fines")
        .select("*")
        .eq("id", fineId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!fineId,
  });

  const appealMutation = useMutation({
    mutationFn: async (values: AppealFormValues) => {
      if (!fineId) throw new Error("No fine selected");

      let newStatus = "";
      switch (values.action) {
        case "appeal_submitted":
          newStatus = "Appeal Submitted";
          break;
        case "appeal_successful":
          newStatus = "Appeal Successful";
          break;
        case "appeal_rejected":
          newStatus = "Appeal Rejected";
          break;
        case "waive":
          newStatus = "Waived";
          break;
      }

      // Update fine status
      const { error } = await supabase
        .from("fines")
        .update({ status: newStatus })
        .eq("id", fineId);

      if (error) throw error;

      // If appeal successful or waived, void the charge
      if (values.action === "appeal_successful" || values.action === "waive") {
        await supabase.rpc("fine_void_charge", { f_id: fineId });
      }

      return { status: newStatus };
    },
    onSuccess: () => {
      toast.success("Fine status updated successfully");
      queryClient.invalidateQueries({ queryKey: ["fines"] });
      queryClient.invalidateQueries({ queryKey: ["fine", fineId] });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      console.error("Error updating fine:", error);
      toast.error("Failed to update fine status");
    },
  });

  const onSubmit = (values: AppealFormValues) => {
    appealMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update Fine Status</DialogTitle>
          <DialogDescription>
            Change the status of this fine for appeal processing or waiving
          </DialogDescription>
        </DialogHeader>

        {fine && (
          <div className="mb-4 p-3 bg-muted rounded-lg">
            <p><strong>Type:</strong> {fine.type}</p>
            <p><strong>Amount:</strong> £{fine.amount}</p>
            <p><strong>Reference:</strong> {fine.reference_no || "N/A"}</p>
            <p><strong>Current Status:</strong> {fine.status}</p>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select action" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="appeal_submitted">Mark Appeal Submitted</SelectItem>
                      <SelectItem value="appeal_successful">Mark Appeal Successful</SelectItem>
                      <SelectItem value="appeal_rejected">Mark Appeal Rejected</SelectItem>
                      <SelectItem value="waive">Waive Fine</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={appealMutation.isPending}>
                {appealMutation.isPending ? "Updating..." : "Update Status"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};