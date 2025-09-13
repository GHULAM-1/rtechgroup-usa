import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useCustomerBalance = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-balance", customerId],
    queryFn: async () => {
      if (!customerId) return 0;
      
      // Single source of truth: ledger_entries only
      // Sum all entries: charges are positive, payments are negative
      const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("amount")
        .eq("customer_id", customerId);
      
      if (error) throw error;
      
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
      
      // Single source of truth: ledger_entries only
      // Total Charges and Total Payments for this rental
      const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("type, amount, due_date")
        .eq("rental_id", rentalId);
      
      if (error) throw error;
      
      const total = entries?.reduce((sum, entry) => {
        return sum + Number(entry.amount);
      }, 0) || 0;
      
      return total;
    },
    enabled: !!rentalId && !!customerId,
  });
};

// Get rental charges and payments separately for detailed view
export const useRentalChargesAndPayments = (rentalId: string | undefined) => {
  return useQuery({
    queryKey: ["rental-charges-payments", rentalId],
    queryFn: async () => {
      if (!rentalId) return { charges: 0, payments: 0, outstanding: 0 };
      
      const { data: entries, error } = await supabase
        .from("ledger_entries")
        .select("type, amount, due_date")
        .eq("rental_id", rentalId);
      
      if (error) throw error;
      
      const today = new Date().toISOString().split('T')[0];
      
      let totalCharges = 0;
      let totalPayments = 0;
      
      entries?.forEach(entry => {
        if (entry.type === 'Charge') {
          totalCharges += Number(entry.amount);
        } else if (entry.type === 'Payment') {
          totalPayments += Math.abs(Number(entry.amount)); // Show as positive in UI
        }
      });
      
      return {
        charges: totalCharges,
        payments: totalPayments,
        outstanding: totalCharges - totalPayments
      };
    },
    enabled: !!rentalId,
  });
};

// Helper to get balance status text (single source of truth)
export const getBalanceStatus = (balance: number | undefined) => {
  if (balance === undefined || balance === null) return null;
  
  if (balance === 0) {
    return { text: "Settled", type: "settled" as const };
  } else if (balance > 0) {
    return { text: `In Debt £${balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, type: "debt" as const };
  } else {
    return { text: `In Credit £${Math.abs(balance).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, type: "credit" as const };
  }
};