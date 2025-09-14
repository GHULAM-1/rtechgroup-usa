import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DashboardKPIs {
  overdue: { count: number; amount: number };
  dueToday: { count: number; amount: number };
  upcoming7d: { count: number; amount: number };
  activeRentals: { count: number };
  finesOpen: { count: number; amount: number; dueSoonCount: number };
  financeCosts: { amount: number };
  remindersDue: { count: number };
  generatedAt: string;
  timezone: string;
}

interface UseDashboardKPIsParams {
  from?: string;
  to?: string;
  timezone?: string;
}

export const useDashboardKPIs = ({ from, to, timezone = 'Europe/London' }: UseDashboardKPIsParams = {}) => {
  return useQuery({
    queryKey: ['dashboard-kpis', from, to, timezone],
    queryFn: async (): Promise<DashboardKPIs> => {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (timezone) params.append('tz', timezone);

      const { data, error } = await supabase.functions.invoke('dashboard-kpis', {
        method: 'GET',
        body: null,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (error) {
        console.error('Dashboard KPIs function error:', error);
        throw new Error(`Failed to fetch dashboard KPIs: ${error.message}`);
      }

      return data;
    },
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });
};