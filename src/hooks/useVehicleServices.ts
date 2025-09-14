import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface ServiceRecord {
  id: string;
  vehicle_id: string;
  service_date: string;
  mileage?: number;
  description?: string;
  cost: number;
  created_at: string;
}

export interface ServiceFormData {
  service_date: string;
  mileage?: number;
  description?: string;
  cost: number;
}

export function useVehicleServices(vehicleId: string) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch service records for a vehicle
  const { data: serviceRecords = [], isLoading } = useQuery({
    queryKey: ['serviceRecords', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_records')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('service_date', { ascending: false });

      if (error) throw error;
      return data as ServiceRecord[];
    },
    enabled: !!vehicleId,
  });

  // Add service record mutation
  const addServiceMutation = useMutation({
    mutationFn: async (formData: ServiceFormData) => {
      const { data, error } = await supabase
        .from('service_records')
        .insert({
          vehicle_id: vehicleId,
          service_date: formData.service_date,
          mileage: formData.mileage,
          description: formData.description,
          cost: formData.cost,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRecords', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['plEntries', vehicleId] });
      toast({
        title: "Service Record Added",
        description: "Service record has been added successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add service record",
        variant: "destructive",
      });
    },
  });

  // Edit service record mutation
  const editServiceMutation = useMutation({
    mutationFn: async ({ id, ...formData }: ServiceFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('service_records')
        .update({
          service_date: formData.service_date,
          mileage: formData.mileage,
          description: formData.description,
          cost: formData.cost,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRecords', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['plEntries', vehicleId] });
      toast({
        title: "Service Record Updated",
        description: "Service record has been updated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update service record",
        variant: "destructive",
      });
    },
  });

  // Delete service record mutation
  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('service_records')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['serviceRecords', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['vehicle', vehicleId] });
      queryClient.invalidateQueries({ queryKey: ['plEntries', vehicleId] });
      toast({
        title: "Service Record Deleted",
        description: "Service record has been deleted successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete service record",
        variant: "destructive",
      });
    },
  });

  return {
    serviceRecords,
    isLoading,
    addService: addServiceMutation.mutate,
    editService: editServiceMutation.mutate,
    deleteService: deleteServiceMutation.mutate,
    isAdding: addServiceMutation.isPending,
    isEditing: editServiceMutation.isPending,
    isDeleting: deleteServiceMutation.isPending,
  };
}