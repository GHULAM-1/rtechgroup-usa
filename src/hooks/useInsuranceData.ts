import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type InsurancePolicyStatus } from "@/lib/insuranceUtils";

export interface InsurancePolicy {
  id: string;
  customer_id: string;
  vehicle_id: string | null;
  policy_number: string;
  provider: string | null;
  start_date: string;
  expiry_date: string;
  status: InsurancePolicyStatus;
  notes: string | null;
  docs_count: number;
  created_at: string;
  updated_at: string;
  customers: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  };
  vehicles: {
    id: string;
    reg: string;
    make: string;
    model: string;
  } | null;
}

export interface InsuranceFilters {
  search: string;
  status: string;
  dateRange: {
    from?: Date;
    to?: Date;
  };
}

export interface InsuranceStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  inactive: number;
}

export function useInsuranceData(filters: InsuranceFilters) {
  const { data: policies = [], isLoading, error } = useQuery({
    queryKey: ["insurance-policies", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("insurance_policies")
        .select(`
          *,
          customers!inner(id, name, email, phone),
          vehicles(id, reg, make, model)
        `)
        .order("expiry_date", { ascending: true });

      if (error) throw error;
      return data as InsurancePolicy[];
    },
  });

  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      // Search filter
      const searchMatch = 
        policy.policy_number.toLowerCase().includes(filters.search.toLowerCase()) ||
        policy.provider?.toLowerCase().includes(filters.search.toLowerCase()) ||
        policy.customers.name.toLowerCase().includes(filters.search.toLowerCase()) ||
        policy.vehicles?.reg.toLowerCase().includes(filters.search.toLowerCase()) ||
        policy.vehicles?.make.toLowerCase().includes(filters.search.toLowerCase()) ||
        policy.vehicles?.model.toLowerCase().includes(filters.search.toLowerCase());

      // Status filter
      const statusMatch = filters.status === "all" || policy.status === filters.status;

      // Date range filter (by expiry date)
      let dateMatch = true;
      if (filters.dateRange.from || filters.dateRange.to) {
        const expiryDate = new Date(policy.expiry_date);
        if (filters.dateRange.from && expiryDate < filters.dateRange.from) {
          dateMatch = false;
        }
        if (filters.dateRange.to && expiryDate > filters.dateRange.to) {
          dateMatch = false;
        }
      }

      return searchMatch && statusMatch && dateMatch;
    });
  }, [policies, filters]);

  const stats = useMemo((): InsuranceStats => {
    const filtered = filteredPolicies;
    const today = new Date();
    
    return {
      total: filtered.length,
      active: filtered.filter(p => p.status === "Active").length,
      expiringSoon: filtered.filter(p => {
        const daysUntil = Math.ceil((new Date(p.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return (p.status === "Active" || p.status === "ExpiringSoon") && daysUntil <= 30 && daysUntil >= 0;
      }).length,
      expired: filtered.filter(p => p.status === "Expired").length,
      inactive: filtered.filter(p => p.status === "Inactive").length,
    };
  }, [filteredPolicies]);

  return {
    policies: filteredPolicies,
    stats,
    isLoading,
    error,
    allPolicies: policies,
  };
}

export function useInsuranceValidation() {
  const checkPolicyOverlap = async (
    customerId: string,
    vehicleId: string | null,
    startDate: Date,
    expiryDate: Date,
    excludePolicyId?: string
  ) => {
    const { data, error } = await supabase.rpc('check_policy_overlap', {
      p_customer_id: customerId,
      p_vehicle_id: vehicleId,
      p_start_date: startDate.toISOString().split('T')[0],
      p_expiry_date: expiryDate.toISOString().split('T')[0],
      p_policy_id: excludePolicyId || null,
    });

    if (error) throw error;
    return data;
  };

  const checkPolicyNumberUnique = async (
    customerId: string,
    policyNumber: string,
    excludePolicyId?: string
  ) => {
    const query = supabase
      .from('insurance_policies')
      .select('id')
      .eq('customer_id', customerId)
      .eq('policy_number', policyNumber);

    if (excludePolicyId) {
      query.neq('id', excludePolicyId);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    return data.length === 0;
  };

  return {
    checkPolicyOverlap,
    checkPolicyNumberUnique,
  };
}