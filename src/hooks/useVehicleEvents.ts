import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VehicleEvent {
  id: string;
  vehicle_id: string;
  event_type: string;
  event_date: string;
  summary: string;
  reference_id?: string;
  reference_table?: string;
  created_at: string;
}

export function useVehicleEvents(vehicleId: string) {
  // Fetch events for a vehicle
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['vehicleEvents', vehicleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicle_events')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      return data as VehicleEvent[];
    },
    enabled: !!vehicleId,
  });

  return {
    events,
    isLoading,
  };
}