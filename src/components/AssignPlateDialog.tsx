import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const assignSchema = z.object({
  vehicle_id: z.string().min(1, "Please select a vehicle"),
});

type AssignFormData = z.infer<typeof assignSchema>;

interface AssignPlateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plateId: string;
}

export const AssignPlateDialog = ({ open, onOpenChange, plateId }: AssignPlateDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: plate } = useQuery({
    queryKey: ["plate", plateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plates")
        .select("*")
        .eq("id", plateId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!plateId,
  });

  const { data: availableVehicles } = useQuery({
    queryKey: ["available-vehicles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vehicles")
        .select("id, reg, make, model")
        .order("reg");
      
      if (error) throw error;
      return data;
    },
  });

  const form = useForm<AssignFormData>({
    resolver: zodResolver(assignSchema),
    defaultValues: {
      vehicle_id: "",
    },
  });

  const onSubmit = async (data: AssignFormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("plates")
        .update({ assigned_vehicle_id: data.vehicle_id })
        .eq("id", plateId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "License plate assigned successfully",
      });

      form.reset();
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["plates"] });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to assign license plate",
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
          <DialogTitle>Assign License Plate</DialogTitle>
          <DialogDescription>
            Assign plate {plate?.plate_number} to a vehicle.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="vehicle_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Select Vehicle</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a vehicle to assign the plate to" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableVehicles?.map((vehicle) => (
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

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Assigning..." : "Assign Plate"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};