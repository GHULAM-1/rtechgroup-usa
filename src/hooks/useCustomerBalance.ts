import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Single source of truth: Customer balance calculation from ledger_entries only
export const useCustomerBalance = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-balance", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      // Calculate balance from ledger_entries - only include currently due charges
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("amount, type, due_date, payment_id")
        .eq("customer_id", customerId);
      
      if (error) throw error;
      
      // Get payment types to exclude Initial Fee payments from customer debt
      const paymentIds = data
        .filter(entry => entry.payment_id)
        .map(entry => entry.payment_id);
      
      let initialFeePaymentIds: string[] = [];
      if (paymentIds.length > 0) {
        const { data: payments } = await supabase
          .from("payments")
          .select("id")
          .in("id", paymentIds)
          .eq("payment_type", "InitialFee");
        
        initialFeePaymentIds = payments?.map(p => p.id) || [];
      }
      
      // Sum amounts with proper filtering
      const balance = data.reduce((sum, entry) => {
        // Skip Initial Fee payment entries (they're company revenue, not customer debt)
        if (entry.payment_id && initialFeePaymentIds.includes(entry.payment_id)) {
          return sum;
        }
        
        // For charges, only include if currently due
        if (entry.type === 'Charge' && entry.due_date && new Date(entry.due_date) > new Date()) {
          return sum;
        }
        
        return sum + entry.amount;
      }, 0);
      
      return balance;
    },
    enabled: !!customerId,
  });
};

// Enhanced customer balance with status information from ledger_entries
export const useCustomerBalanceWithStatus = (customerId: string | undefined) => {
  return useQuery({
    queryKey: ["customer-balance-status", customerId],
    queryFn: async () => {
      if (!customerId) return null;
      
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("type, amount, due_date, payment_id")
        .eq("customer_id", customerId);
      
      if (error) throw error;
      
      // Get payment types to exclude Initial Fee payments from customer debt
      const paymentIds = data
        .filter(entry => entry.payment_id)
        .map(entry => entry.payment_id);
      
      let initialFeePaymentIds: string[] = [];
      if (paymentIds.length > 0) {
        const { data: payments } = await supabase
          .from("payments")
          .select("id")
          .in("id", paymentIds)
          .eq("payment_type", "InitialFee");
        
        initialFeePaymentIds = payments?.map(p => p.id) || [];
      }
      
      // Calculate totals by type with proper filtering
      let totalCharges = 0;
      let totalPayments = 0;
      let balance = 0;
      
      data.forEach(entry => {
        // Skip Initial Fee payment entries (they're company revenue, not customer debt)
        if (entry.payment_id && initialFeePaymentIds.includes(entry.payment_id)) {
          return;
        }
        
        // For charges, only include if currently due
        if (entry.type === 'Charge' && entry.due_date && new Date(entry.due_date) > new Date()) {
          return;
        }
        
        balance += entry.amount;
        
        if (entry.type === 'Charge') {
          totalCharges += entry.amount;
        } else if (entry.type === 'Payment') {
          totalPayments += Math.abs(entry.amount); // Show payments as positive for display
        }
      });
      
      // Determine status
      let status: 'In Credit' | 'Settled' | 'In Debt';
      if (balance === 0) {
        status = 'Settled';
      } else if (balance > 0) {
        status = 'In Debt';
      } else {
        status = 'In Credit';
      }
      
      return {
        balance: Math.abs(balance), // Always return positive for display
        status,
        totalCharges,
        totalPayments
      };
    },
    enabled: !!customerId,
  });
};

export const useRentalBalance = (rentalId: string | undefined, customerId: string | undefined) => {
  return useQuery({
    queryKey: ["rental-balance", rentalId, customerId],
    queryFn: async () => {
      if (!rentalId) return 0;
      
      const { data, error } = await supabase
        .from("ledger_entries")
        .select("amount")
        .eq("rental_id", rentalId);
      
      if (error) throw error;
      
      const total = data.reduce((sum, entry) => sum + entry.amount, 0);
      return total;
    },
    enabled: !!rentalId,
  });
};

// Rental charges and payments breakdown - pure ledger calculation
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

// Helper function to determine balance status with consistent ledger-based logic
export const getBalanceStatus = (balance: number | undefined, status?: 'In Credit' | 'Settled' | 'In Debt') => {
  if (balance === undefined) return { text: 'Unknown', type: 'secondary' };
  if (balance === 0 || status === 'Settled') return { text: 'Settled', type: 'secondary' };
  if (status === 'In Debt') return { text: `In Debt £${balance.toFixed(2)}`, type: 'destructive' };
  if (status === 'In Credit') return { text: `In Credit £${balance.toFixed(2)}`, type: 'success' };
  
  // Fallback to old logic if status not provided
  if (balance > 0) return { text: `In Debt £${balance.toFixed(2)}`, type: 'destructive' };
  return { text: `In Credit £${Math.abs(balance).toFixed(2)}`, type: 'success' };
};