import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PaymentFilters } from "@/components/PaymentFilters";

export interface PaymentRow {
  id: string;
  amount: number;
  payment_date: string;
  method: string | null;
  payment_type: string;
  status: string;
  remaining_amount: number;
  
  customers: {
    id: string;
    name: string;
  };
  vehicles: {
    id: string;
    reg: string;
    make: string | null;
    model: string | null;
  } | null;
  rentals: {
    id: string;
    rental_number: string | null;
  } | null;
}

interface UsePaymentsDataOptions {
  filters: PaymentFilters;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export const usePaymentsData = ({ 
  filters, 
  sortBy, 
  sortOrder, 
  page, 
  pageSize 
}: UsePaymentsDataOptions) => {
  return useQuery({
    queryKey: ["payments-data", filters, sortBy, sortOrder, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("payments")
        .select(`
          *,
          customers!inner(id, name),
          vehicles(id, reg, make, model),
          rentals(id, rental_number)
        `, { count: 'exact' });

      // Apply filters
      if (filters.customerSearch) {
        query = query.ilike("customers.name", `%${filters.customerSearch}%`);
      }

      if (filters.vehicleSearch) {
        query = query.or(`vehicles.reg.ilike.%${filters.vehicleSearch}%,vehicles.make.ilike.%${filters.vehicleSearch}%,vehicles.model.ilike.%${filters.vehicleSearch}%`);
      }

      if (filters.method && filters.method !== 'all') {
        query = query.eq("method", filters.method);
      }

      if (filters.dateFrom) {
        query = query.gte("payment_date", filters.dateFrom.toISOString().split('T')[0]);
      }

      if (filters.dateTo) {
        query = query.lte("payment_date", filters.dateTo.toISOString().split('T')[0]);
      }

      // Apply sorting
      const sortColumn = sortBy === 'customer' ? 'customers.name' : 
                        sortBy === 'vehicle' ? 'vehicles.reg' :
                        sortBy;
      
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;
      query = query.range(start, end);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        payments: data as PaymentRow[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
  });
};

// Export CSV function
export const exportPaymentsCSV = async (filters: PaymentFilters) => {
  let query = supabase
    .from("payments")
    .select(`
      payment_date,
      customers(name),
      vehicles(reg),
      rentals(rental_number),
      payment_type,
      method,
      amount,
      status,
      remaining_amount
    `);

  // Apply same filters as the main query
  if (filters.customerSearch) {
    query = query.ilike("customers.name", `%${filters.customerSearch}%`);
  }

  if (filters.vehicleSearch) {
    query = query.or(`vehicles.reg.ilike.%${filters.vehicleSearch}%,vehicles.make.ilike.%${filters.vehicleSearch}%,vehicles.model.ilike.%${filters.vehicleSearch}%`);
  }

  if (filters.method && filters.method !== 'all') {
    query = query.eq("method", filters.method);
  }

  if (filters.dateFrom) {
    query = query.gte("payment_date", filters.dateFrom.toISOString().split('T')[0]);
  }

  if (filters.dateTo) {
    query = query.lte("payment_date", filters.dateTo.toISOString().split('T')[0]);
  }

  query = query.order("payment_date", { ascending: false });

  const { data, error } = await query;
  if (error) throw error;

  // Convert to CSV
  const headers = ['Date', 'Customer', 'Vehicle', 'Rental Ref', 'Type', 'Method', 'Amount', 'Applied', 'Credit Remaining'];
  
  const getPaymentTypeDisplay = (paymentType: string): string => {
    switch (paymentType) {
      case 'InitialFee':
        return 'Initial Fee';
      case 'Payment':
        return 'Customer Payment';
      default:
        return paymentType;
    }
  };

  const rows = data.map(payment => [
    payment.payment_date,
    payment.customers?.name || '',
    payment.vehicles?.reg || '',
    payment.rentals?.rental_number || '',
    getPaymentTypeDisplay(payment.payment_type),
    payment.method || '',
    payment.amount.toFixed(2),
    (payment.amount - (payment.remaining_amount || 0)).toFixed(2),
    (payment.remaining_amount || 0).toFixed(2)
  ]);

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  // Download CSV
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `payments-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};