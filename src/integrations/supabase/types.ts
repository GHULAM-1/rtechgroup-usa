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
      authority_payments: {
        Row: {
          amount: number
          created_at: string | null
          fine_id: string
          id: string
          notes: string | null
          payment_date: string
          payment_method: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          fine_id: string
          id?: string
          notes?: string | null
          payment_date: string
          payment_method?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          fine_id?: string
          id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authority_payments_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "fines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authority_payments_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "view_fines_export"
            referencedColumns: ["fine_id"]
          },
        ]
      }
      customer_documents: {
        Row: {
          created_at: string | null
          customer_id: string
          document_name: string
          document_type: string
          file_name: string | null
          file_url: string | null
          id: string
          insurance_provider: string | null
          notes: string | null
          policy_end_date: string | null
          policy_number: string | null
          policy_start_date: string | null
          uploaded_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          document_name: string
          document_type: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          insurance_provider?: string | null
          notes?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          uploaded_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          document_name?: string
          document_type?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          insurance_provider?: string | null
          notes?: string | null
          policy_end_date?: string | null
          policy_number?: string | null
          policy_start_date?: string | null
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "customer_documents_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
          type: string
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
          whatsapp_opt_in?: boolean | null
        }
        Relationships: []
      }
      fine_files: {
        Row: {
          file_name: string | null
          file_url: string
          fine_id: string | null
          id: string
          uploaded_at: string | null
        }
        Insert: {
          file_name?: string | null
          file_url: string
          fine_id?: string | null
          id?: string
          uploaded_at?: string | null
        }
        Update: {
          file_name?: string | null
          file_url?: string
          fine_id?: string | null
          id?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fine_files_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "fines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fine_files_fine_id_fkey"
            columns: ["fine_id"]
            isOneToOne: false
            referencedRelation: "view_fines_export"
            referencedColumns: ["fine_id"]
          },
        ]
      }
      fines: {
        Row: {
          amount: number
          appealed_at: string | null
          charged_at: string | null
          created_at: string | null
          customer_id: string | null
          due_date: string
          id: string
          issue_date: string
          liability: string | null
          notes: string | null
          reference_no: string | null
          resolved_at: string | null
          status: string | null
          type: string
          vehicle_id: string
          waived_at: string | null
        }
        Insert: {
          amount: number
          appealed_at?: string | null
          charged_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date: string
          id?: string
          issue_date: string
          liability?: string | null
          notes?: string | null
          reference_no?: string | null
          resolved_at?: string | null
          status?: string | null
          type: string
          vehicle_id: string
          waived_at?: string | null
        }
        Update: {
          amount?: number
          appealed_at?: string | null
          charged_at?: string | null
          created_at?: string | null
          customer_id?: string | null
          due_date?: string
          id?: string
          issue_date?: string
          liability?: string | null
          notes?: string | null
          reference_no?: string | null
          resolved_at?: string | null
          status?: string | null
          type?: string
          vehicle_id?: string
          waived_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fines_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "fines_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "fines_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          amount: number
          category: string
          created_at: string
          customer_id: string | null
          due_date: string | null
          entry_date: string
          id: string
          payment_id: string | null
          reference: string | null
          remaining_amount: number
          rental_id: string | null
          type: string
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          entry_date: string
          id?: string
          payment_id?: string | null
          reference?: string | null
          remaining_amount?: number
          rental_id?: string | null
          type: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          customer_id?: string | null
          due_date?: string | null
          entry_date?: string
          id?: string
          payment_id?: string | null
          reference?: string | null
          remaining_amount?: number
          rental_id?: string | null
          type?: string
          updated_at?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ledger_entries_payment_id"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ledger_entries_payment_id"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_remaining"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "fk_ledger_entries_payment_id"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "view_payments_export"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ledger_entries_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_rental_credit"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "ledger_entries_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "view_rentals_export"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "ledger_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "ledger_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      login_attempts: {
        Row: {
          attempted_at: string | null
          id: string
          ip_address: string | null
          success: boolean
          username: string
        }
        Insert: {
          attempted_at?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          username: string
        }
        Update: {
          attempted_at?: string | null
          id?: string
          ip_address?: string | null
          success?: boolean
          username?: string
        }
        Relationships: []
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
            foreignKeyName: "payment_applications_charge_entry_id_fkey"
            columns: ["charge_entry_id"]
            isOneToOne: false
            referencedRelation: "view_customer_statements"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "v_payment_remaining"
            referencedColumns: ["payment_id"]
          },
          {
            foreignKeyName: "payment_applications_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "view_payments_export"
            referencedColumns: ["payment_id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          apply_from_date: string | null
          created_at: string
          customer_id: string
          id: string
          is_early: boolean
          method: string | null
          payment_date: string
          payment_type: string
          remaining_amount: number | null
          rental_id: string | null
          status: string | null
          updated_at: string
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          apply_from_date?: string | null
          created_at?: string
          customer_id: string
          id?: string
          is_early?: boolean
          method?: string | null
          payment_date?: string
          payment_type?: string
          remaining_amount?: number | null
          rental_id?: string | null
          status?: string | null
          updated_at?: string
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          apply_from_date?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          is_early?: boolean
          method?: string | null
          payment_date?: string
          payment_type?: string
          remaining_amount?: number | null
          rental_id?: string | null
          status?: string | null
          updated_at?: string
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
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_rental_credit"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "view_rentals_export"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      plates: {
        Row: {
          assigned_vehicle_id: string | null
          created_at: string | null
          document_name: string | null
          document_url: string | null
          id: string
          notes: string | null
          plate_number: string
          retention_doc_reference: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_vehicle_id?: string | null
          created_at?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          plate_number: string
          retention_doc_reference?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_vehicle_id?: string | null
          created_at?: string | null
          document_name?: string | null
          document_url?: string | null
          id?: string
          notes?: string | null
          plate_number?: string
          retention_doc_reference?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plates_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "plates_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plates_assigned_vehicle_id_fkey"
            columns: ["assigned_vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      pnl_entries: {
        Row: {
          amount: number
          category: string | null
          customer_id: string | null
          entry_date: string
          id: string
          payment_id: string | null
          reference: string | null
          rental_id: string | null
          side: string
          source_ref: string | null
          vehicle_id: string | null
        }
        Insert: {
          amount: number
          category?: string | null
          customer_id?: string | null
          entry_date: string
          id?: string
          payment_id?: string | null
          reference?: string | null
          rental_id?: string | null
          side: string
          source_ref?: string | null
          vehicle_id?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          customer_id?: string | null
          entry_date?: string
          id?: string
          payment_id?: string | null
          reference?: string | null
          rental_id?: string | null
          side?: string
          source_ref?: string | null
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pnl_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "pnl_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pnl_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      reminder_events: {
        Row: {
          charge_id: string
          created_at: string
          customer_id: string
          delivered_at: string | null
          delivered_to: string
          id: string
          message_preview: string
          reminder_type: string
          rental_id: string
          snoozed_until: string | null
          status: string
          vehicle_id: string
        }
        Insert: {
          charge_id: string
          created_at?: string
          customer_id: string
          delivered_at?: string | null
          delivered_to?: string
          id?: string
          message_preview: string
          reminder_type: string
          rental_id: string
          snoozed_until?: string | null
          status?: string
          vehicle_id: string
        }
        Update: {
          charge_id?: string
          created_at?: string
          customer_id?: string
          delivered_at?: string | null
          delivered_to?: string
          id?: string
          message_preview?: string
          reminder_type?: string
          rental_id?: string
          snoozed_until?: string | null
          status?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminder_events_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_events_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "view_customer_statements"
            referencedColumns: ["entry_id"]
          },
          {
            foreignKeyName: "reminder_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "reminder_events_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "reminder_events_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_events_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_rental_credit"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "reminder_events_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "view_rentals_export"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "reminder_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "reminder_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminder_events_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
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
          updated_at: string
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
          updated_at?: string
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
          updated_at?: string
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
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "rentals_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rentals_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          id: string
          last_login: string | null
          password_hash: string
          require_password_change: boolean
          role: string
          status: string
          username: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_login?: string | null
          password_hash: string
          require_password_change?: boolean
          role?: string
          status?: string
          username: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_login?: string | null
          password_hash?: string
          require_password_change?: boolean
          role?: string
          status?: string
          username?: string
        }
        Relationships: []
      }
      vehicles: {
        Row: {
          acquisition_date: string | null
          acquisition_type: string | null
          balloon: number | null
          color: string | null
          colour: string | null
          created_at: string | null
          finance_start_date: string | null
          id: string
          initial_payment: number | null
          make: string | null
          model: string | null
          monthly_payment: number | null
          purchase_price: number | null
          reg: string
          status: string | null
          term_months: number | null
          updated_at: string
        }
        Insert: {
          acquisition_date?: string | null
          acquisition_type?: string | null
          balloon?: number | null
          color?: string | null
          colour?: string | null
          created_at?: string | null
          finance_start_date?: string | null
          id?: string
          initial_payment?: number | null
          make?: string | null
          model?: string | null
          monthly_payment?: number | null
          purchase_price?: number | null
          reg: string
          status?: string | null
          term_months?: number | null
          updated_at?: string
        }
        Update: {
          acquisition_date?: string | null
          acquisition_type?: string | null
          balloon?: number | null
          color?: string | null
          colour?: string | null
          created_at?: string | null
          finance_start_date?: string | null
          id?: string
          initial_payment?: number | null
          make?: string | null
          model?: string | null
          monthly_payment?: number | null
          purchase_price?: number | null
          reg?: string
          status?: string | null
          term_months?: number | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      v_customer_credit: {
        Row: {
          credit_available: number | null
          customer_id: string | null
        }
        Insert: {
          credit_available?: never
          customer_id?: string | null
        }
        Update: {
          credit_available?: never
          customer_id?: string | null
        }
        Relationships: []
      }
      v_payment_remaining: {
        Row: {
          customer_id: string | null
          payment_id: string | null
          remaining: number | null
          rental_id: string | null
        }
        Insert: {
          customer_id?: string | null
          payment_id?: string | null
          remaining?: never
          rental_id?: string | null
        }
        Update: {
          customer_id?: string | null
          payment_id?: string | null
          remaining?: never
          rental_id?: string | null
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
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_rental_credit"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "view_rentals_export"
            referencedColumns: ["rental_id"]
          },
        ]
      }
      v_rental_credit: {
        Row: {
          credit_available: number | null
          rental_id: string | null
        }
        Insert: {
          credit_available?: never
          rental_id?: string | null
        }
        Update: {
          credit_available?: never
          rental_id?: string | null
        }
        Relationships: []
      }
      vehicle_pnl_rollup: {
        Row: {
          cost_acquisition: number | null
          cost_finance: number | null
          cost_fines: number | null
          cost_other: number | null
          cost_service: number | null
          cost_total: number | null
          entry_date: string | null
          make: string | null
          model: string | null
          reg: string | null
          revenue_initial_fees: number | null
          revenue_other: number | null
          revenue_rental: number | null
          vehicle_id: string | null
        }
        Relationships: []
      }
      view_aging_receivables: {
        Row: {
          bucket_0_30: number | null
          bucket_31_60: number | null
          bucket_61_90: number | null
          bucket_90_plus: number | null
          customer_id: string | null
          customer_name: string | null
          total_due: number | null
        }
        Relationships: []
      }
      view_customer_statements: {
        Row: {
          amount: number | null
          category: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          due_date: string | null
          entry_date: string | null
          entry_id: string | null
          remaining_amount: number | null
          rental_id: string | null
          running_balance: number | null
          transaction_amount: number | null
          type: string | null
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
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
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ledger_entries_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "ledger_entries_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_rental_credit"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "ledger_entries_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "view_rentals_export"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "ledger_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "ledger_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      view_fines_export: {
        Row: {
          amount: number | null
          appeal_status: string | null
          customer_email: string | null
          customer_name: string | null
          customer_phone: string | null
          due_date: string | null
          fine_id: string | null
          issue_date: string | null
          liability: string | null
          notes: string | null
          reference_no: string | null
          remaining_amount: number | null
          status: string | null
          type: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
        }
        Relationships: []
      }
      view_payments_export: {
        Row: {
          allocations_json: Json | null
          amount: number | null
          applied_amount: number | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          method: string | null
          payment_date: string | null
          payment_id: string | null
          payment_type: string | null
          rental_id: string | null
          unapplied_amount: number | null
          vehicle_id: string | null
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_reg: string | null
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
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_credit"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "view_aging_receivables"
            referencedColumns: ["customer_id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "rentals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "v_rental_credit"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "payments_rental_id_fkey"
            columns: ["rental_id"]
            isOneToOne: false
            referencedRelation: "view_rentals_export"
            referencedColumns: ["rental_id"]
          },
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicle_pnl_rollup"
            referencedColumns: ["vehicle_id"]
          },
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "view_pl_by_vehicle"
            referencedColumns: ["vehicle_id"]
          },
        ]
      }
      view_pl_by_vehicle: {
        Row: {
          cost_acquisition: number | null
          cost_finance: number | null
          cost_fines: number | null
          cost_other: number | null
          cost_service: number | null
          make_model: string | null
          net_profit: number | null
          revenue_fees: number | null
          revenue_other: number | null
          revenue_rental: number | null
          total_costs: number | null
          total_revenue: number | null
          vehicle_id: string | null
          vehicle_reg: string | null
        }
        Relationships: []
      }
      view_pl_consolidated: {
        Row: {
          cost_acquisition: number | null
          cost_finance: number | null
          cost_fines: number | null
          cost_other: number | null
          cost_service: number | null
          net_profit: number | null
          revenue_fees: number | null
          revenue_other: number | null
          revenue_rental: number | null
          total_costs: number | null
          total_revenue: number | null
          view_type: string | null
        }
        Relationships: []
      }
      view_rentals_export: {
        Row: {
          balance: number | null
          customer_name: string | null
          end_date: string | null
          initial_fee_amount: number | null
          monthly_amount: number | null
          rental_id: string | null
          schedule: string | null
          start_date: string | null
          status: string | null
          vehicle_reg: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      app_login: {
        Args: { p_password: string; p_username: string }
        Returns: {
          id: string
          require_password_change: boolean
          role: string
          username: string
        }[]
      }
      apply_payment: {
        Args: { payment_id: string }
        Returns: undefined
      }
      apply_payment_fully: {
        Args: { p_payment_id: string }
        Returns: undefined
      }
      apply_payments_to_charges: {
        Args: { p_rental_id?: string }
        Returns: undefined
      }
      attach_payments_to_rentals: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      backfill_rental_charges_first_month_only: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      backfill_rental_charges_full: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      fine_void_charge: {
        Args: { f_id: string }
        Returns: undefined
      }
      generate_daily_reminders: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      generate_monthly_charges: {
        Args: { rental_id: string }
        Returns: undefined
      }
      generate_next_rental_charge: {
        Args: { r_id: string }
        Returns: undefined
      }
      generate_rental_charges: {
        Args: { r_id: string }
        Returns: undefined
      }
      get_customer_balance_with_status: {
        Args: { customer_id_param: string }
        Returns: {
          balance: number
          status: string
          total_charges: number
          total_payments: number
        }[]
      }
      get_customer_credit: {
        Args: { customer_id_param: string }
        Returns: number
      }
      get_customer_net_position: {
        Args: { customer_id_param: string }
        Returns: number
      }
      get_customer_statement: {
        Args: { p_customer_id: string; p_from_date: string; p_to_date: string }
        Returns: {
          credit: number
          debit: number
          description: string
          rental_id: string
          running_balance: number
          transaction_date: string
          type: string
          vehicle_reg: string
        }[]
      }
      get_payment_remaining: {
        Args: { payment_id_param: string }
        Returns: number
      }
      get_pending_charges_for_reminders: {
        Args: Record<PropertyKey, never>
        Returns: {
          amount: number
          charge_id: string
          charge_type: string
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
      get_rental_credit: {
        Args: { rental_id_param: string }
        Returns: number
      }
      has_upfront_finance_entry: {
        Args: { v_id: string }
        Returns: boolean
      }
      hash_password: {
        Args: { password: string }
        Returns: string
      }
      payment_apply_fifo: {
        Args: { p_id: string }
        Returns: undefined
      }
      payment_apply_fifo_v2: {
        Args: { p_id: string }
        Returns: undefined
      }
      payment_auto_apply_due_credit: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      pnl_post_acquisition: {
        Args: { v_id: string }
        Returns: undefined
      }
      process_payment_transaction: {
        Args:
          | {
              p_amount: number
              p_customer_id: string
              p_payment_date: string
              p_payment_id: string
              p_payment_type: string
              p_rental_id: string
              p_vehicle_id: string
            }
          | { p_payment_id: string }
        Returns: Json
      }
      reapply_all_payments: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      reapply_all_payments_v2: {
        Args: Record<PropertyKey, never>
        Returns: {
          customers_affected: number
          payments_processed: number
          total_credit_applied: number
        }[]
      }
      recalculate_vehicle_pl: {
        Args: { p_vehicle_id: string }
        Returns: undefined
      }
      record_payment: {
        Args: {
          p_amount: number
          p_customer: string
          p_method: string
          p_payment_date: string
          p_rental: string
          p_type: string
          p_vehicle: string
        }
        Returns: string
      }
      rental_create_charge: {
        Args: { amt: number; due: string; r_id: string }
        Returns: string
      }
      update_customer_balance: {
        Args: { customer_id: string }
        Returns: undefined
      }
      verify_password: {
        Args: { provided_password: string; stored_hash: string }
        Returns: boolean
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
