import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FineFilterState } from "@/components/FineFilters";

export interface EnhancedFine {
  id: string;
  type: string;
  reference_no: string | null;
  issue_date: string;
  due_date: string;
  amount: number;
  liability: string;
  status: string;
  notes: string | null;
  customer_id: string | null;
  vehicle_id: string;
  created_at: string;
  customers: { 
    name: string; 
    email?: string; 
    phone?: string; 
  } | null;
  vehicles: { 
    reg: string; 
    make: string; 
    model: string; 
  };
  // Computed fields
  isOverdue: boolean;
  daysUntilDue: number;
}

interface UseFinesDataParams {
  filters?: FineFilterState;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export const useFinesData = ({ 
  filters = {
    status: [],
    liability: [],
    vehicleSearch: '',
    customerSearch: '',
  },
  sortBy = 'due_date',
  sortOrder = 'asc',
  page = 1,
  pageSize = 25 
}: UseFinesDataParams = {}) => {
  return useQuery({
    queryKey: ["fines-enhanced", filters, sortBy, sortOrder, page, pageSize],
    queryFn: async () => {
      let query = supabase
        .from("fines")
        .select(`
          *,
          customers(name, email, phone),
          vehicles(reg, make, model)
        `, { count: 'exact' });

      // Apply filters
      if (filters.status && filters.status.length > 0) {
        query = query.in('status', filters.status);
      }

      if (filters.liability && filters.liability.length > 0) {
        query = query.in('liability', filters.liability);
      }

      if (filters.vehicleSearch && filters.vehicleSearch.trim()) {
        const search = filters.vehicleSearch.trim();
        query = query.or(`vehicles.reg.ilike.%${search}%,vehicles.make.ilike.%${search}%,vehicles.model.ilike.%${search}%`);
      }

      if (filters.customerSearch && filters.customerSearch.trim()) {
        const search = filters.customerSearch.trim();
        query = query.or(`customers.name.ilike.%${search}%,customers.email.ilike.%${search}%,customers.phone.ilike.%${search}%`);
      }

      // Date range filters
      if (filters.issueDateFrom) {
        query = query.gte('issue_date', filters.issueDateFrom.toISOString().split('T')[0]);
      }

      if (filters.issueDateTo) {
        query = query.lte('issue_date', filters.issueDateTo.toISOString().split('T')[0]);
      }

      if (filters.dueDateFrom) {
        query = query.gte('due_date', filters.dueDateFrom.toISOString().split('T')[0]);
      }

      if (filters.dueDateTo) {
        query = query.lte('due_date', filters.dueDateTo.toISOString().split('T')[0]);
      }

      // Quick filters
      if (filters.quickFilter === 'due-next-7') {
        const today = new Date();
        const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
        query = query
          .gte('due_date', today.toISOString().split('T')[0])
          .lte('due_date', nextWeek.toISOString().split('T')[0])
          .in('status', ['Open', 'Charged']);
      }

      if (filters.quickFilter === 'overdue') {
        const today = new Date();
        query = query
          .lt('due_date', today.toISOString().split('T')[0])
          .in('status', ['Open', 'Charged']);
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' });

      // Apply pagination
      const startIndex = (page - 1) * pageSize;
      const endIndex = startIndex + pageSize - 1;
      query = query.range(startIndex, endIndex);

      const { data, error, count } = await query;
      
      if (error) throw error;

      // Enhance the data with computed fields
      const today = new Date();
      const enhancedFines: EnhancedFine[] = (data || []).map(fine => {
        const dueDate = new Date(fine.due_date);
        const isOverdue = dueDate < today && (fine.status === 'Open' || fine.status === 'Charged');
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

        return {
          ...fine,
          customers: fine.customers as any,
          vehicles: fine.vehicles as any,
          isOverdue,
          daysUntilDue,
        };
      });

      return {
        fines: enhancedFines,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize),
        currentPage: page,
        hasNextPage: page * pageSize < (count || 0),
        hasPreviousPage: page > 1,
      };
    },
  });
};