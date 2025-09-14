// Enhanced search service with insurance policies
import { supabase } from "@/integrations/supabase/client";

export interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  url: string;
  icon?: string;
}

export interface SearchResults {
  customers: SearchResult[];
  vehicles: SearchResult[];
  rentals: SearchResult[];
  fines: SearchResult[];
  payments: SearchResult[];
  plates: SearchResult[];
  insurance: SearchResult[];
}

export const searchService = {
  async searchAll(query: string): Promise<SearchResults> {
    if (!query.trim()) {
      return {
        customers: [],
        vehicles: [],
        rentals: [],
        fines: [],
        payments: [],
        plates: [],
        insurance: [],
      };
    }

    const searchTerm = `%${query.trim()}%`;

    // Search customers
    const { data: customers } = await supabase
      .from("customers")
      .select("id, name, email, phone, type")
      .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},phone.ilike.${searchTerm}`)
      .limit(8);

    // Search vehicles
    const { data: vehicles } = await supabase
      .from("vehicles")
      .select("id, reg, make, model, status")
      .or(`reg.ilike.${searchTerm},make.ilike.${searchTerm},model.ilike.${searchTerm}`)
      .limit(8);

    // Search rentals with customer and vehicle info
    const { data: rentals } = await supabase
      .from("rentals")
      .select(`
        id, 
        start_date, 
        end_date, 
        status,
        customers!inner(name),
        vehicles!inner(reg, make, model)
      `)
      .or(`customers.name.ilike.${searchTerm},vehicles.reg.ilike.${searchTerm}`)
      .limit(8);

    // Search fines
    const { data: fines } = await supabase
      .from("fines")
      .select(`
        id, 
        reference_no, 
        type, 
        amount, 
        status,
        customers(name),
        vehicles!inner(reg)
      `)
      .or(`reference_no.ilike.${searchTerm},type.ilike.${searchTerm},vehicles.reg.ilike.${searchTerm}`)
      .limit(8);

    // Search payments
    const { data: payments } = await supabase
      .from("payments")
      .select(`
        id, 
        amount, 
        payment_date, 
        method, 
        payment_type,
        customers!inner(name)
      `)
      .or(`customers.name.ilike.${searchTerm},method.ilike.${searchTerm}`)
      .limit(8);

    // Search plates
    const { data: plates } = await supabase
      .from("plates")
      .select(`
        id, 
        plate_number, 
        retention_doc_reference,
        vehicles(reg, make, model)
      `)
      .ilike("plate_number", searchTerm)
      .limit(8);

    // Search insurance policies
    const { data: insurance } = await supabase
      .from("insurance_policies")
      .select(`
        id,
        policy_number,
        provider,
        status,
        expiry_date,
        customers!inner(name),
        vehicles(reg, make, model)
      `)
      .or(`policy_number.ilike.${searchTerm},provider.ilike.${searchTerm},customers.name.ilike.${searchTerm}`)
      .limit(8);

    return {
      customers: (customers || []).map(customer => ({
        id: customer.id,
        title: customer.name,
        subtitle: customer.email || customer.phone || customer.type,
        category: "Customers",
        url: `/customers/${customer.id}`,
        icon: "user",
      })),
      vehicles: (vehicles || []).map(vehicle => ({
        id: vehicle.id,
        title: `${vehicle.reg}`,
        subtitle: `${vehicle.make} ${vehicle.model} • ${vehicle.status}`,
        category: "Vehicles",
        url: `/vehicles/${vehicle.id}`,
        icon: "car",
      })),
      rentals: (rentals || []).map(rental => ({
        id: rental.id,
        title: (rental.customers as any)?.name || "Unknown Customer",
        subtitle: `${(rental.vehicles as any)?.reg} • ${rental.status}`,
        category: "Rentals",
        url: `/rentals/${rental.id}`,
        icon: "calendar",
      })),
      fines: (fines || []).map(fine => ({
        id: fine.id,
        title: fine.reference_no || `${fine.type} Fine`,
        subtitle: `£${fine.amount} • ${(fine.vehicles as any)?.reg} • ${fine.status}`,
        category: "Fines",
        url: `/fines/${fine.id}`,
        icon: "alert-triangle",
      })),
      payments: (payments || []).map(payment => ({
        id: payment.id,
        title: `£${payment.amount} ${payment.payment_type}`,
        subtitle: `${(payment.customers as any)?.name} • ${payment.method}`,
        category: "Payments",
        url: `/payments/${payment.id}`,
        icon: "credit-card",
      })),
      plates: (plates || []).map(plate => ({
        id: plate.id,
        title: plate.plate_number,
        subtitle: plate.vehicles ? `${(plate.vehicles as any).reg} • ${(plate.vehicles as any).make} ${(plate.vehicles as any).model}` : "Unassigned",
        category: "Plates",
        url: `/plates/${plate.id}`,
        icon: "hash",
      })),
      insurance: (insurance || []).map(policy => ({
        id: policy.id,
        title: `Policy ${policy.policy_number}`,
        subtitle: `${(policy.customers as any)?.name} • ${policy.provider || 'No provider'} • ${policy.status}`,
        category: "Insurance",
        url: `/insurance?policy=${policy.id}`,
        icon: "shield",
      })),
    };
  },
};