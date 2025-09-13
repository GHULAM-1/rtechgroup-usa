import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

const appealSchema = z.object({
  action: z.enum(['appeal_successful', 'waive']),
});

type AppealFormData = z.infer<typeof appealSchema>;

interface FineAppealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fineId: string;
  fineAmount: number;
  customerId?: string;
}

export const FineAppealDialog = ({ 
  open, 
  onOpenChange, 
  fineId, 
  fineAmount, 
  customerId 
}: FineAppealDialogProps) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<AppealFormData>({
    resolver: zodResolver(appealSchema),
    defaultValues: {
      action: "appeal_successful",
    },
  });

  const handleAppealSuccessful = async () => {
    if (!customerId) return;

    // Get current remaining amount for this customer's fine charges
    const { data: charges } = await supabase
      .from("ledger_entries")
      .select("remaining_amount")
      .eq("customer_id", customerId)
      .eq("category", "Fine")
      .eq("type", "Charge")
      .gt("remaining_amount", 0);

    const totalRemaining = charges?.reduce((sum, charge) => sum + Number(charge.remaining_amount), 0) || 0;
    const totalPaid = fineAmount - totalRemaining;

    // Void remaining charges via negative adjustment
    if (totalRemaining > 0) {
      await supabase
        .from("ledger_entries")
        .insert({
          customer_id: customerId,
          entry_date: new Date().toISOString().split('T')[0],
          type: "Adjustment",
          category: "Fine",
          amount: -totalRemaining,
          remaining_amount: 0
        });

      // Clear remaining amounts on existing charges
      await supabase
        .from("ledger_entries")
        .update({ remaining_amount: 0 })
        .eq("customer_id", customerId)
        .eq("category", "Fine")
        .eq("type", "Charge")
        .gt("remaining_amount", 0);
    }

    // If amount was already paid, create customer credit
    if (totalPaid > 0) {
      await supabase
        .from("ledger_entries")
        .insert({
          customer_id: customerId,
          entry_date: new Date().toISOString().split('T')[0],
          type: "Credit",
          category: "Fine",
          amount: totalPaid,
          remaining_amount: totalPaid  // Unapplied credit
        });
    }

    // Update fine status
    await supabase
      .from("fines")
      .update({ status: "Appeal Successful" })
      .eq("id", fineId);
  };

  const handleWaive = async () => {
    if (!customerId) return;

    // Clear unpaid remainder with negative adjustment
    const { data: charges } = await supabase
      .from("ledger_entries")
      .select("remaining_amount")
      .eq("customer_id", customerId)
      .eq("category", "Fine")
      .eq("type", "Charge")
      .gt("remaining_amount", 0);

    const totalRemaining = charges?.reduce((sum, charge) => sum + Number(charge.remaining_amount), 0) || 0;

    if (totalRemaining > 0) {
      await supabase
        .from("ledger_entries")
        .insert({
          customer_id: customerId,
          entry_date: new Date().toISOString().split('T')[0],
          type: "Adjustment",
          category: "Fine",
          amount: -totalRemaining,
          remaining_amount: 0
        });

      // Clear remaining amounts on existing charges
      await supabase
        .from("ledger_entries")
        .update({ remaining_amount: 0 })
        .eq("customer_id", customerId)
        .eq("category", "Fine")
        .eq("type", "Charge")
        .gt("remaining_amount", 0);
    }

    // Update fine status
    await supabase
      .from("fines")
      .update({ status: "Waived" })
      .eq("id", fineId);
  };

  const onSubmit = async (data: AppealFormData) => {
    setLoading(true);
    try {
      if (data.action === 'appeal_successful') {
        await handleAppealSuccessful();
        toast({
          title: "Appeal Successful",
          description: "Fine has been successfully appealed. Unpaid remainder voided and customer credited for paid amount.",
        });
      } else {
        await handleWaive();
        toast({
          title: "Fine Waived",
          description: "Fine has been waived and unpaid remainder cleared.",
        });
      }

      onOpenChange(false);
      
      // Refresh queries
      queryClient.invalidateQueries({ queryKey: ["fine", fineId] });
      queryClient.invalidateQueries({ queryKey: ["fine-ledger", fineId] });
      queryClient.invalidateQueries({ queryKey: ["fines-list"] });
    } catch (error) {
      console.error("Error processing appeal:", error);
      toast({
        title: "Error",
        description: "Failed to process request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Fine Appeal/Waiver</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Action</FormLabel>
                  <FormControl>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="appeal"
                          value="appeal_successful"
                          checked={field.value === "appeal_successful"}
                          onChange={() => field.onChange("appeal_successful")}
                        />
                        <label htmlFor="appeal" className="text-sm">
                          Appeal Successful - Void remainder + credit if paid
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="radio"
                          id="waive"
                          value="waive"
                          checked={field.value === "waive"}
                          onChange={() => field.onChange("waive")}
                        />
                        <label htmlFor="waive" className="text-sm">
                          Waive Fine - Clear unpaid remainder only
                        </label>
                      </div>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Processing..." : "Confirm"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};