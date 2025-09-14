import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerRental {
  id: string;
  start_date: string;
  end_date: string | null;
  monthly_amount: number;
  status: string;
  schedule: string;
  created_at: string;
  vehicle: {
    id: string;
    reg: string;
    make: string;
    model: string;
  };
}

export const useCustomerRentals = (customerId: string) => {
  return useQuery({
    queryKey: ["customer-rentals", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select(`
          id,
          start_date,
          end_date,
          monthly_amount,
          status,
          schedule,
          created_at,
          vehicles!inner(id, reg, make, model)
        `)
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      
      return data.map(rental => ({
        ...rental,
        vehicle: rental.vehicles as any
      })) as CustomerRental[];
    },
    enabled: !!customerId,
  });
};