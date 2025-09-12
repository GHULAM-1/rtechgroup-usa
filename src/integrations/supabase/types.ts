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
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
          type: string
          whatsapp_opt_in: boolean | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
          type: string
          whatsapp_opt_in?: boolean | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
          type?: string
          whatsapp_opt_in?: boolean | null
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          amount: number
          category: string
          customer_id: string | null
          due_date: string | null
          entry_date: string
          id: string
          remaining_amount: number
          rental_id: string | null
          type: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: string
          customer_id?: string | null
          due_date?: string | null
          entry_date: string
          id?: string
          remaining_amount?: number
          rental_id?: string | null
          type: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          customer_id?: string | null
          due_date?: string | null
          entry_date?: string
          id?: string
          remaining_amount?: number
          rental_id?: string | null
          type?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_applications: {
        Row: {
          amount_applied: number
          charge_entry_id: string | null
          id: string
          payment_id: string | null
        }
        Insert: {
          amount_applied: number
          charge_entry_id?: string | null
          id?: string
          payment_id?: string | null
        }
        Update: {
          amount_applied?: number
          charge_entry_id?: string | null
          id?: string
          payment_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payment_applications_charge_entry_id_fkey"
            columns: ["charge_entry_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          customer_id: string
          id: string
          method: string | null
          payment_date: string
          payment_type: string
          rental_id: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          customer_id: string
          id?: string
          method?: string | null
          payment_date: string
          payment_type: string
          rental_id?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          customer_id?: string
          id?: string
          method?: string | null
          payment_date?: string
          payment_type?: string
          rental_id?: string | null
          vehicle_id?: string | null
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
      pnl_entries: {
        Row: {
          amount: number
          category: string | null
          entry_date: string
          id: string
          side: string
          source_ref: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          entry_date: string
          id?: string
          side: string
          source_ref?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          entry_date?: string
          id?: string
          side?: string
          source_ref?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pnl_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      reminder_logs: {
        Row: {
          amount: number
          channel: string
          charge_id: string
          created_at: string
          customer_id: string
          due_date: string
          id: string
          reminder_type: string
          rental_id: string
          sent_at: string
        }
        Insert: {
          amount: number
          channel: string
          charge_id: string
          created_at?: string
          customer_id: string
          due_date: string
          id?: string
          reminder_type: string
          rental_id: string
          sent_at?: string
        }
        Update: {
          amount?: number
          channel?: string
          charge_id?: string
          created_at?: string
          customer_id?: string
          due_date?: string
          id?: string
          reminder_type?: string
          rental_id?: string
          sent_at?: string
        }
        Relationships: []
      }
      reminder_settings: {
        Row: {
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          id?: string
          setting_key: string
          setting_value: Json
          updated_at?: string
        }
        Update: {
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      rentals: {
        Row: {
          created_at: string | null
          customer_id: string | null
          end_date: string | null
          id: string
          monthly_amount: number
          schedule: string | null
          start_date: string
          status: string | null
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          end_date?: string | null
          id?: string
          monthly_amount: number
          schedule?: string | null
          start_date: string
          status?: string | null
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          end_date?: string | null
          id?: string
          monthly_amount?: number
          schedule?: string | null
          start_date?: string
          status?: string | null
          vehicle_id?: string | null
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
          acquisition_date: string | null
          acquisition_type: string | null
          colour: string | null
          created_at: string | null
          id: string
          make: string | null
          model: string | null
          purchase_price: number | null
          reg: string
          status: string | null
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_type?: string | null
          colour?: string | null
          created_at?: string | null
          id?: string
          make?: string | null
          model?: string | null
          purchase_price?: number | null
          reg: string
          status?: string | null
        }
        Update: {
          acquisition_date?: string | null
          acquisition_type?: string | null
          colour?: string | null
          created_at?: string | null
          id?: string
          make?: string | null
          model?: string | null
          purchase_price?: number | null
          reg?: string
          status?: string | null
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
      generate_rental_charges: {
        Args: { r_id: string }
        Returns: undefined
      }
      get_pending_charges_for_reminders: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          charge_id: string
          customer_balance: number
          customer_email: string
          customer_id: string
          customer_name: string
          customer_phone: string
          days_overdue: number
          days_until_due: number
          due_date: string
          remaining_amount: number
          rental_id: string
          vehicle_id: string
          vehicle_reg: string
          whatsapp_opt_in: boolean
        }[]
      }
      payment_apply_fifo: {
        Args: { p_id: string }
        Returns: undefined
      }
      pnl_post_acquisition: {
        Args: { v_id: string }
        Returns: undefined
      }
      recalculate_vehicle_pl: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      rental_create_charge: {
        Args: { amt: number; due: string; r_id: string }
        Returns: string
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
