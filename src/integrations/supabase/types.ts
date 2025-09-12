export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      customers: {
        Row: {
          balance: number | null
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string
          status: Database["public"]["Enums"]["customer_status"] | null
          type: Database["public"]["Enums"]["customer_type"]
        }
        Insert: {
          balance?: number | null
          created_at?: string | null
          email: string
          id?: string
          name: string
          phone: string
          status?: Database["public"]["Enums"]["customer_status"] | null
          type: Database["public"]["Enums"]["customer_type"]
        }
        Update: {
          balance?: number | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string
          status?: Database["public"]["Enums"]["customer_status"] | null
          type?: Database["public"]["Enums"]["customer_type"]
        }
        Relationships: []
      }
      ledger: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string | null
          description: string
          entry_type: Database["public"]["Enums"]["entry_type"]
          id: string
          rental_id: string | null
          status: Database["public"]["Enums"]["ledger_status"] | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id?: string | null
          description: string
          entry_type: Database["public"]["Enums"]["entry_type"]
          id?: string
          rental_id?: string | null
          status?: Database["public"]["Enums"]["ledger_status"] | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string | null
          description?: string
          entry_type?: Database["public"]["Enums"]["entry_type"]
          id?: string
          rental_id?: string | null
          status?: Database["public"]["Enums"]["ledger_status"] | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      p_l: {
        Row: {
          id: string
          net_profit: number | null
          total_costs: number | null
          total_revenue: number | null
          updated_at: string | null
          vehicle_id: string
        }
        Insert: {
          id?: string
          net_profit?: number | null
          total_costs?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          vehicle_id: string
        }
        Update: {
          id?: string
          net_profit?: number | null
          total_costs?: number | null
          total_revenue?: number | null
          updated_at?: string | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "p_l_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: true
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string | null
          customer_id: string
          due_date: string
          id: string
          paid_date: string | null
          rental_id: string
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          vehicle_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          customer_id: string
          due_date: string
          id?: string
          paid_date?: string | null
          rental_id: string
          status: Database["public"]["Enums"]["payment_status"]
          type: Database["public"]["Enums"]["payment_type"]
          vehicle_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          customer_id?: string
          due_date?: string
          id?: string
          paid_date?: string | null
          rental_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          type?: Database["public"]["Enums"]["payment_type"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      rentals: {
        Row: {
          created_at: string | null
          customer_id: string
          duration_months: number
          end_date: string
          id: string
          initial_payment: number
          monthly_payment: number
          start_date: string
          status: Database["public"]["Enums"]["rental_status"] | null
          vehicle_id: string
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          duration_months: number
          end_date: string
          id?: string
          initial_payment: number
          monthly_payment: number
          start_date: string
          status?: Database["public"]["Enums"]["rental_status"] | null
          vehicle_id: string
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          duration_months?: number
          end_date?: string
          id?: string
          initial_payment?: number
          monthly_payment?: number
          start_date?: string
          status?: Database["public"]["Enums"]["rental_status"] | null
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          acquisition_date: string
          acquisition_price: number
          acquisition_type: Database["public"]["Enums"]["acquisition_type"]
          colour: string
          created_at: string | null
          dealer_source: string | null
          id: string
          make: string
          model: string
          reg_number: string
          status: Database["public"]["Enums"]["vehicle_status"] | null
        }
        Insert: {
          acquisition_date: string
          acquisition_price: number
          acquisition_type: Database["public"]["Enums"]["acquisition_type"]
          colour: string
          created_at?: string | null
          dealer_source?: string | null
          id?: string
          make: string
          model: string
          reg_number: string
          status?: Database["public"]["Enums"]["vehicle_status"] | null
        }
        Update: {
          acquisition_date?: string
          acquisition_price?: number
          acquisition_type?: Database["public"]["Enums"]["acquisition_type"]
          colour?: string
          created_at?: string | null
          dealer_source?: string | null
          id?: string
          make?: string
          model?: string
          reg_number?: string
          status?: Database["public"]["Enums"]["vehicle_status"] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_payment: {
        Args: { payment_id: string }
        Returns: undefined
      }
      generate_monthly_charges: {
        Args: { rental_id: string }
        Returns: undefined
      }
      recalculate_vehicle_pl: {
        Args: { vehicle_id: string }
        Returns: undefined
      }
      update_customer_balance: {
        Args: { customer_id: string }
        Returns: undefined
      }
    }
    Enums: {
      acquisition_type: "purchase" | "finance" | "lease"
      customer_status: "active" | "inactive"
      customer_type: "individual" | "company"
      entry_type: "charge" | "payment" | "adjustment"
      ledger_status: "pending" | "applied"
      payment_status: "paid" | "due" | "overdue" | "void"
      payment_type: "initial_fee" | "monthly" | "fine" | "service" | "other"
      rental_status: "active" | "completed" | "cancelled"
      vehicle_status: "available" | "rented" | "sold"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      acquisition_type: ["purchase", "finance", "lease"],
      customer_status: ["active", "inactive"],
      customer_type: ["individual", "company"],
      entry_type: ["charge", "payment", "adjustment"],
      ledger_status: ["pending", "applied"],
      payment_status: ["paid", "due", "overdue", "void"],
      payment_type: ["initial_fee", "monthly", "fine", "service", "other"],
      rental_status: ["active", "completed", "cancelled"],
      vehicle_status: ["available", "rented", "sold"],
    },
  },
} as const
