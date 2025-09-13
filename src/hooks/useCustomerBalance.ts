import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Customer balance calculation with proper credit status
export const useCustomerBalance = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-balance", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      // Use the new balance function that properly handles credits
      const { data, error } = await supabase
        .rpc('get_customer_balance_with_status', { 
          customer_id_param: customerId 
        })
        .single();
      
      if (error) throw error;
      return data.balance;
    },
    enabled: !!customerId,
  });
};

// Enhanced customer balance with status information
export const useCustomerBalanceWithStatus = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-balance-status", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .rpc('get_customer_balance_with_status', { 
          customer_id_param: customerId 
        })
        .single();
      
      if (error) throw error;
      return {
        balance: data.balance,
        status: data.status,
        totalCharges: data.total_charges,
        totalPayments: data.total_payments
      };
    },
    enabled: !!customerId,
  });
};

export const useRentalBalance = (rentalId: string | undefined, customerId: string | undefined) => {
  return useQuery({
    queryKey: ["rental-balance", rentalId, customerId],
    queryFn: async () => {
      if (!rentalId || !customerId) return 0;
      
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("amount")
        .eq("rental_id", rentalId);
      
      if (error) throw error;
      
      const total = data.reduce((sum, entry) => sum + entry.amount, 0);
      return total;
    },
    enabled: !!rentalId && !!customerId,
  });
};

// Rental charges and payments breakdown
export const useRentalChargesAndPayments = (rentalId: string | undefined) => {
  return useQuery({
    queryKey: ["rental-charges-payments", rentalId],
    queryFn: async () => {
      if (!rentalId) return { charges: 0, payments: 0, outstanding: 0 };
      
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("type, amount, remaining_amount")
        .eq("rental_id", rentalId);
      
      if (error) throw error;
      
      const charges = data
        .filter(entry => entry.type === 'Charge')
        .reduce((sum, entry) => sum + entry.amount, 0);
      
      const payments = Math.abs(data
        .filter(entry => entry.type === 'Payment')
        .reduce((sum, entry) => sum + entry.amount, 0));
      
      const outstanding = data
        .filter(entry => entry.type === 'Charge')
        .reduce((sum, entry) => sum + entry.remaining_amount, 0);
      
      return { charges, payments, outstanding };
    },
    enabled: !!rentalId,
  });
};

// Helper function to determine balance status
export const getBalanceStatus = (balance: number | undefined) => {
  if (balance === undefined) return { text: 'Unknown', type: 'secondary' };
  if (balance === 0) return { text: 'Settled', type: 'secondary' };
  if (balance > 0) return { text: `In Debt £${balance.toFixed(2)}`, type: 'destructive' };
  return { text: `In Credit £${Math.abs(balance).toFixed(2)}`, type: 'success' };
};