import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateDurationInMonths, getRentalStatus } from "@/lib/rentalUtils";

export interface RentalFilters {
  search?: string;
  status?: string;
  customerType?: string;
  duration?: string;
  initialPayment?: string;
  startDateFrom?: Date;
  startDateTo?: Date;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface EnhancedRental {
  id: string;
  rental_number: string;
  start_date: string;
  end_date: string | null;
  monthly_amount: number;
  status: string;
  computed_status: string;
  duration_months: number;
  initial_payment: number | null;
  customer: {
    id: string;
    name: string;
    customer_type: string;
  };
  vehicle: {
    id: string;
    reg: string;
    make: string;
    model: string;
  };
}

export interface RentalStats {
  total: number;
  active: number;
  closed: number;
  upcoming: number;
  avgDuration: number;
}

const ITEMS_PER_PAGE = 25;

export const useEnhancedRentals = (filters: RentalFilters = {}) => {
  const {
    search = "",
    status = "all",
    customerType = "all", 
    duration = "all",
    initialPayment = "all",
    startDateFrom,
    startDateTo,
    sortBy = "start_date",
    sortOrder = "desc",
    page = 1,
    pageSize = ITEMS_PER_PAGE
  } = filters;

  return useQuery({
    queryKey: ["enhanced-rentals", filters],
    queryFn: async () => {
      let query = supabase
        .from("rentals")
        .select(`
          id,
          rental_number,
          start_date,
          end_date,
          monthly_amount,
          status,
          customers!inner(id, name, customer_type),
          vehicles!inner(id, reg, make, model)
        `);

      // Apply search filter
      if (search) {
        query = query.or(`
          rental_number.ilike.%${search}%,
          customers.name.ilike.%${search}%,
          vehicles.reg.ilike.%${search}%
        `);
      }

      // Apply customer type filter
      if (customerType !== "all") {
        query = query.eq("customers.customer_type", customerType);
      }

      // Apply date range filters
      if (startDateFrom) {
        query = query.gte("start_date", startDateFrom.toISOString().split('T')[0]);
      }
      if (startDateTo) {
        query = query.lte("start_date", startDateTo.toISOString().split('T')[0]);
      }

      // Apply sorting
      const ascending = sortOrder === "asc";
      if (sortBy === "rental_number") {
        query = query.order("rental_number", { ascending });
      } else if (sortBy === "monthly_amount") {
        query = query.order("monthly_amount", { ascending });
      } else if (sortBy === "end_date") {
        query = query.order("end_date", { ascending, nullsFirst: !ascending });
      } else {
        query = query.order(sortBy as any, { ascending });
      }

      const { data: rentalsData, error, count } = await query
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (error) throw error;

      // Get initial payments for these rentals
      const rentalIds = rentalsData?.map(r => r.id) || [];
      const { data: initialPayments } = await supabase
        .from("payments")
        .select("rental_id, amount")
        .in("rental_id", rentalIds)
        .eq("payment_type", "InitialFee");

      const initialPaymentMap = new Map(
        initialPayments?.map(p => [p.rental_id, p.amount]) || []
      );

      // Transform and filter data
      const enhancedRentals: EnhancedRental[] = (rentalsData || [])
        .map(rental => {
          const durationMonths = calculateDurationInMonths(rental.start_date, rental.end_date);
          const computedStatus = getRentalStatus(rental.start_date, rental.end_date, rental.status);
          const initialPaymentAmount = initialPaymentMap.get(rental.id) || null;

          return {
            id: rental.id,
            rental_number: rental.rental_number,
            start_date: rental.start_date,
            end_date: rental.end_date,
            monthly_amount: rental.monthly_amount,
            status: rental.status,
            computed_status: computedStatus,
            duration_months: durationMonths,
            initial_payment: initialPaymentAmount,
            customer: rental.customers as any,
            vehicle: rental.vehicles as any,
          };
        })
        .filter(rental => {
          // Apply status filter
          if (status !== "all") {
            if (status !== rental.computed_status.toLowerCase()) return false;
          }

          // Apply duration filter
          if (duration !== "all") {
            const months = rental.duration_months;
            if (duration === "≤12 mo" && months > 12) return false;
            if (duration === "13–24 mo" && (months <= 12 || months > 24)) return false;
            if (duration === ">24 mo" && months <= 24) return false;
          }

          // Apply initial payment filter
          if (initialPayment !== "all") {
            if (initialPayment === "set" && !rental.initial_payment) return false;
            if (initialPayment === "missing" && rental.initial_payment) return false;
          }

          return true;
        });

      // Calculate stats
      const stats: RentalStats = {
        total: enhancedRentals.length,
        active: enhancedRentals.filter(r => r.computed_status === "Active").length,
        closed: enhancedRentals.filter(r => r.computed_status === "Closed").length,
        upcoming: enhancedRentals.filter(r => r.computed_status === "Upcoming").length,
        avgDuration: enhancedRentals.length > 0 
          ? Math.round(enhancedRentals.reduce((sum, r) => sum + r.duration_months, 0) / enhancedRentals.length)
          : 0
      };

      return {
        rentals: enhancedRentals,
        stats,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      };
    },
  });
};