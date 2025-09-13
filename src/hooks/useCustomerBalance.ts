import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomerBalance = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-balance", customerId],
    queryFn: async () => {
      if (!customerId) return 0;
      
      // Get outstanding charges for this customer
      const { data: charges, error: chargesError } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("customer_id", customerId)
        .eq("type", "Charge")
        .eq("category", "Rental");
      
      if (chargesError) throw chargesError;
      
      // Get unapplied credits (payments not yet applied to future charges)
      const { data: credits, error: creditError } = await supabase
        .from("payments")
        .select("remaining_amount")
        .eq("customer_id", customerId)
        .in("status", ["Credit", "Partial"]);
      
      if (creditError) throw creditError;
      
      const totalOutstanding = charges?.reduce((sum, c) => sum + Number(c.remaining_amount), 0) || 0;
      const totalCredit = credits?.reduce((sum, c) => sum + Number(c.remaining_amount), 0) || 0;
      
      return totalOutstanding - totalCredit;
    },
    enabled: !!customerId,
  });
};

export const useRentalBalance = (rentalId: string | undefined, customerId: string | undefined) => {
  return useQuery({
    queryKey: ["rental-balance", rentalId],
    queryFn: async () => {
      if (!rentalId || !customerId) return 0;
      
      // Get outstanding charges for this rental
      const { data: charges, error: chargesError } = await supabase
        .from("ledger_entries")
        .select("remaining_amount")
        .eq("rental_id", rentalId)
        .eq("type", "Charge")
        .eq("category", "Rental");
      
      if (chargesError) throw chargesError;
      
      // Get customer's total unapplied credits (can be applied to any rental)
      const { data: credits, error: creditError } = await supabase
        .from("payments")
        .select("remaining_amount")
        .eq("customer_id", customerId)
        .in("status", ["Credit", "Partial"]);
      
      if (creditError) throw creditError;
      
      const totalOutstanding = charges?.reduce((sum, c) => sum + Number(c.remaining_amount), 0) || 0;
      const totalCredit = credits?.reduce((sum, c) => sum + Number(c.remaining_amount), 0) || 0;
      
      return totalOutstanding - totalCredit;
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