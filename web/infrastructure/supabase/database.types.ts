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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      agreement_versions: {
        Row: {
          agreement_id: string
          created_at: string
          id: string
          org_id: string
          snapshot: Json
          version_no: number
        }
        Insert: {
          agreement_id: string
          created_at?: string
          id?: string
          org_id: string
          snapshot?: Json
          version_no: number
        }
        Update: {
          agreement_id?: string
          created_at?: string
          id?: string
          org_id?: string
          snapshot?: Json
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "agreement_versions_agreement_id_org_id_fkey"
            columns: ["agreement_id", "org_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "agreement_versions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      agreements: {
        Row: {
          created_at: string
          id: string
          number: string | null
          org_id: string
          site_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          number?: string | null
          org_id: string
          site_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          number?: string | null
          org_id?: string
          site_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agreements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agreements_site_id_org_id_fkey"
            columns: ["site_id", "org_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      asset_type_tasks: {
        Row: {
          asset_type_id: string
          created_at: string
          description: string
          id: string
          org_id: string
          position: number
        }
        Insert: {
          asset_type_id: string
          created_at?: string
          description: string
          id?: string
          org_id: string
          position?: number
        }
        Update: {
          asset_type_id?: string
          created_at?: string
          description?: string
          id?: string
          org_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "asset_type_tasks_asset_type_id_org_id_fkey"
            columns: ["asset_type_id", "org_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "asset_type_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      asset_types: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "asset_types_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          asset_type_id: string
          created_at: string
          id: string
          location: string | null
          org_id: string
          site_id: string
          source: string
          type_model: string | null
          unit_no: string | null
        }
        Insert: {
          asset_type_id: string
          created_at?: string
          id?: string
          location?: string | null
          org_id: string
          site_id: string
          source?: string
          type_model?: string | null
          unit_no?: string | null
        }
        Update: {
          asset_type_id?: string
          created_at?: string
          id?: string
          location?: string | null
          org_id?: string
          site_id?: string
          source?: string
          type_model?: string | null
          unit_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assets_asset_type_id_org_id_fkey"
            columns: ["asset_type_id", "org_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_site_id_org_id_fkey"
            columns: ["site_id", "org_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      contacts: {
        Row: {
          created_at: string
          customer_id: string
          email: string | null
          id: string
          name: string
          org_id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          email?: string | null
          id?: string
          name: string
          org_id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          email?: string | null
          id?: string
          name?: string
          org_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contacts_customer_id_org_id_fkey"
            columns: ["customer_id", "org_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contacts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          agreement_version_id: string
          created_at: string
          id: string
          org_id: string
          status: string
        }
        Insert: {
          agreement_version_id: string
          created_at?: string
          id?: string
          org_id: string
          status?: string
        }
        Update: {
          agreement_version_id?: string
          created_at?: string
          id?: string
          org_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "contracts_agreement_version_id_org_id_fkey"
            columns: ["agreement_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "contracts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          actor_id: string | null
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          n8n_execution_id: string | null
          org_id: string
          payload: Json
          type: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          n8n_execution_id?: string | null
          org_id: string
          payload?: Json
          type: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          n8n_execution_id?: string | null
          org_id?: string
          payload?: Json
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      import_jobs: {
        Row: {
          content_type: string
          committed_at: string | null
          committed_by: string | null
          committed_count: number | null
          created_at: string
          created_by: string | null
          created_by_email: string | null
          extract_cursor: number | null
          extract_total: number | null
          extracted_at: string | null
          id: string
          org_id: string
          original_name: string
          read_at: string | null
          read_error: string | null
          row_count: number | null
          site_id: string
          size_bytes: number
          status: string
          table_count: number | null
          updated_at: string
        }
        Insert: {
          content_type: string
          committed_at?: string | null
          committed_by?: string | null
          committed_count?: number | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          extract_cursor?: number | null
          extract_total?: number | null
          extracted_at?: string | null
          id?: string
          org_id: string
          original_name: string
          read_at?: string | null
          read_error?: string | null
          row_count?: number | null
          site_id: string
          size_bytes: number
          status?: string
          table_count?: number | null
          updated_at?: string
        }
        Update: {
          content_type?: string
          committed_at?: string | null
          committed_by?: string | null
          committed_count?: number | null
          created_at?: string
          created_by?: string | null
          created_by_email?: string | null
          extract_cursor?: number | null
          extract_total?: number | null
          extracted_at?: string | null
          id?: string
          org_id?: string
          original_name?: string
          read_at?: string | null
          read_error?: string | null
          row_count?: number | null
          site_id?: string
          size_bytes?: number
          status?: string
          table_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_jobs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_jobs_site_id_org_id_fkey"
            columns: ["site_id", "org_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      import_rows: {
        Row: {
          asset_type_id: string | null
          asset_id: string | null
          asset_type_raw: string | null
          confidence: string
          id: string
          job_id: string
          location: string | null
          org_id: string
          position: number
          skipped: boolean
          source_ref: string | null
          type_model: string | null
          unit_no: string | null
        }
        Insert: {
          asset_type_id?: string | null
          asset_id?: string | null
          asset_type_raw?: string | null
          confidence: string
          id?: string
          job_id: string
          location?: string | null
          org_id: string
          position: number
          skipped?: boolean
          source_ref?: string | null
          type_model?: string | null
          unit_no?: string | null
        }
        Update: {
          asset_type_id?: string | null
          asset_id?: string | null
          asset_type_raw?: string | null
          confidence?: string
          id?: string
          job_id?: string
          location?: string | null
          org_id?: string
          position?: number
          skipped?: boolean
          source_ref?: string | null
          type_model?: string | null
          unit_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_asset_fkey"
            columns: ["asset_id", "org_id"]
            isOneToOne: false
            referencedRelation: "assets"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "import_rows_asset_type_id_org_id_fkey"
            columns: ["asset_type_id", "org_id"]
            isOneToOne: false
            referencedRelation: "asset_types"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "import_rows_job_id_org_id_fkey"
            columns: ["job_id", "org_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "import_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      org_settings: {
        Row: {
          accent_color: string | null
          address: string | null
          cancellation_notice_days: number | null
          cpi_cap_pct: number
          governing_province: string | null
          legal_name: string
          logo_path: string | null
          org_id: string
          payment_days: number | null
          phone: string | null
          repair_discount_pct: number
          tax_note: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          address?: string | null
          cancellation_notice_days?: number | null
          cpi_cap_pct?: number
          governing_province?: string | null
          legal_name: string
          logo_path?: string | null
          org_id: string
          payment_days?: number | null
          phone?: string | null
          repair_discount_pct?: number
          tax_note?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          address?: string | null
          cancellation_notice_days?: number | null
          cpi_cap_pct?: number
          governing_province?: string | null
          legal_name?: string
          logo_path?: string | null
          org_id?: string
          payment_days?: number | null
          phone?: string | null
          repair_discount_pct?: number
          tax_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      orgs: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      outbox: {
        Row: {
          attempts: number
          available_at: string
          created_at: string
          event_id: string
          id: string
          last_error: string | null
          org_id: string
          sent_at: string | null
          status: string
        }
        Insert: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_id: string
          id?: string
          last_error?: string | null
          org_id: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          attempts?: number
          available_at?: string
          created_at?: string
          event_id?: string
          id?: string
          last_error?: string | null
          org_id?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_event_id_org_id_fkey"
            columns: ["event_id", "org_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      service_lines: {
        Row: {
          agreement_version_id: string
          cost_per_visit_cents: number
          created_at: string
          description: string
          id: string
          org_id: string
          position: number
          visits_per_year: number
        }
        Insert: {
          agreement_version_id: string
          cost_per_visit_cents: number
          created_at?: string
          description: string
          id?: string
          org_id: string
          position?: number
          visits_per_year: number
        }
        Update: {
          agreement_version_id?: string
          cost_per_visit_cents?: number
          created_at?: string
          description?: string
          id?: string
          org_id?: string
          position?: number
          visits_per_year?: number
        }
        Relationships: [
          {
            foreignKeyName: "service_lines_agreement_version_id_org_id_fkey"
            columns: ["agreement_version_id", "org_id"]
            isOneToOne: false
            referencedRelation: "agreement_versions"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "service_lines_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
      sites: {
        Row: {
          address: string | null
          created_at: string
          customer_id: string
          id: string
          name: string
          org_id: string
          site_contact_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          customer_id: string
          id?: string
          name: string
          org_id: string
          site_contact_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          name?: string
          org_id?: string
          site_contact_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sites_customer_id_org_id_fkey"
            columns: ["customer_id", "org_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "sites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sites_site_contact_id_customer_id_fkey"
            columns: ["site_contact_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id", "customer_id"]
          },
        ]
      }
    }
    Views: {
      import_row_counts: {
        Row: {
          job_id: string | null
          org_id: string | null
          rows: number | null
          unmatched: number | null
        }
        Relationships: [
          {
            foreignKeyName: "import_rows_job_id_org_id_fkey"
            columns: ["job_id", "org_id"]
            isOneToOne: false
            referencedRelation: "import_jobs"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "import_rows_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "orgs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      apply_agreement_transition: {
        Args: {
          p_agreement_id: string
          p_event_type: string
          p_expected_status: string
          p_payload: Json
          p_to_status: string
        }
        Returns: string
      }
      commit_import: { Args: { p_job_id: string }; Returns: number }
      record_extraction_chunk: {
        Args: {
          p_expected_cursor: number
          p_job_id: string
          p_rows: Json
          p_total: number
        }
        Returns: number
      }
      apply_contract_transition: {
        Args: {
          p_contract_id: string
          p_event_type: string
          p_expected_status: string
          p_payload: Json
          p_to_status: string
        }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
