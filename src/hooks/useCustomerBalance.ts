import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomerBalance = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-balance", customerId],
    queryFn: async () => {
      if (!customerId) return 0;
      
      // Get all ledger entries for this customer
      const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("type, amount")
        .eq("customer_id", customerId);
      
      if (error) throw error;
      
      // Calculate total: charges are positive, payments are negative
      const total = entries?.reduce((sum, entry) => {
        return sum + Number(entry.amount);
      }, 0) || 0;
      
      return total;
    },
    enabled: !!customerId,
  });
};

export const useRentalBalance = (rentalId: string | undefined, customerId: string | undefined) => {
  return useQuery({
    queryKey: ["rental-balance", rentalId],
    queryFn: async () => {
      if (!rentalId || !customerId) return 0;
      
      // Get all ledger entries for this rental
      const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("type, amount")
        .eq("rental_id", rentalId);
      
      if (error) throw error;
      
      // Calculate total: charges are positive, payments are negative  
      const total = entries?.reduce((sum, entry) => {
        return sum + Number(entry.amount);
      }, 0) || 0;
      
      return total;
    },
    enabled: !!rentalId && !!customerId,
  });
};

// Helper to get balance status text
export const getBalanceStatus = (balance: number | undefined) => {
  if (balance === undefined || balance === null) return null;
  
  if (balance === 0) {
    return { text: "Settled", type: "settled" as const };
  } else if (balance > 0) {
    return { text: `In Debt £${Math.abs(balance).toLocaleString()}`, type: "debt" as const };
  } else {
    return { text: `In Credit £${Math.abs(balance).toLocaleString()}`, type: "credit" as const };
  }
};