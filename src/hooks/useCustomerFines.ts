import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerFine {
  id: string;
  type: string;
  reference_no: string | null;
  amount: number;
  issue_date: string;
  due_date: string;
  status: string;
  liability: string;
  notes: string | null;
  created_at: string;
  vehicle: {
    id: string;
    reg: string;
    make: string;
    model: string;
  };
}

export const useCustomerFines = (customerId: string) => {
  return useQuery({
    queryKey: ["customer-fines", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select(`
          id,
          type,
          reference_no,
          amount,
          issue_date,
          due_date,
          status,
          liability,
          notes,
          created_at,
          vehicles!inner(id, reg, make, model)
        `)
        .eq("customer_id", customerId)
        .order("issue_date", { ascending: false });
      
      if (error) throw error;
      
      return data.map(fine => ({
        ...fine,
        vehicle: fine.vehicles as any
      })) as CustomerFine[];
    },
    enabled: !!customerId,
  });
};

export const useCustomerFineStats = (customerId: string) => {
  return useQuery({
    queryKey: ["customer-fine-stats", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("fines")
        .select("amount, status")
        .eq("customer_id", customerId);
      
      if (error) throw error;
      
      const openFines = data.filter(fine => fine.status === 'Open');
      const totalFines = data.length;
      const openFineAmount = openFines.reduce((sum, fine) => sum + Number(fine.amount), 0);
      
      return {
        totalFines,
        openFines: openFines.length,
        openFineAmount
      };
    },
    enabled: !!customerId,
  });
};