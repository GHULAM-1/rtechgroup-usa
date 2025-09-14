import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomerActiveRentals = (customerId: string) => {
  return useQuery({
    queryKey: ["customer-active-rentals", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rentals")
        .select("id")
        .eq("customer_id", customerId)
        .eq("status", "Active")
        .lte("start_date", new Date().toISOString().split('T')[0])
        .or(`end_date.is.null,end_date.gte.${new Date().toISOString().split('T')[0]}`);
      
      if (error) throw error;
      
      return data.length;
    },
    enabled: !!customerId,
  });
};