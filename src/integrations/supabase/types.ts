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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ambulance_locations: {
        Row: {
          ambulance_id: string
          heading: number | null
          id: number
          lat: number
          lng: number
          recorded_at: string
          speed: number | null
        }
        Insert: {
          ambulance_id: string
          heading?: number | null
          id?: number
          lat: number
          lng: number
          recorded_at?: string
          speed?: number | null
        }
        Update: {
          ambulance_id?: string
          heading?: number | null
          id?: number
          lat?: number
          lng?: number
          recorded_at?: string
          speed?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ambulance_locations_ambulance_id_fkey"
            columns: ["ambulance_id"]
            isOneToOne: false
            referencedRelation: "ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
      ambulances: {
        Row: {
          available_for_rent: boolean
          code: string
          created_at: string
          current_lat: number | null
          current_lng: number | null
          daily_rate: number | null
          driver_id: string | null
          home_base: string | null
          id: string
          last_ping_at: string | null
          status: Database["public"]["Enums"]["ambulance_status"]
          type: Database["public"]["Enums"]["ambulance_type"]
        }
        Insert: {
          available_for_rent?: boolean
          code: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          daily_rate?: number | null
          driver_id?: string | null
          home_base?: string | null
          id?: string
          last_ping_at?: string | null
          status?: Database["public"]["Enums"]["ambulance_status"]
          type?: Database["public"]["Enums"]["ambulance_type"]
        }
        Update: {
          available_for_rent?: boolean
          code?: string
          created_at?: string
          current_lat?: number | null
          current_lng?: number | null
          daily_rate?: number | null
          driver_id?: string | null
          home_base?: string | null
          id?: string
          last_ping_at?: string | null
          status?: Database["public"]["Enums"]["ambulance_status"]
          type?: Database["public"]["Enums"]["ambulance_type"]
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          hashed_key: string
          id: string
          last_used_at: string | null
          name: string
          owner_id: string
          prefix: string
        }
        Insert: {
          created_at?: string
          hashed_key: string
          id?: string
          last_used_at?: string | null
          name: string
          owner_id: string
          prefix: string
        }
        Update: {
          created_at?: string
          hashed_key?: string
          id?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          prefix?: string
        }
        Relationships: []
      }
      certificates: {
        Row: {
          code: string
          enrollment_id: string
          id: string
          issued_at: string
        }
        Insert: {
          code?: string
          enrollment_id: string
          id?: string
          issued_at?: string
        }
        Update: {
          code?: string
          enrollment_id?: string
          id?: string
          issued_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificates_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      clinic_bookings: {
        Row: {
          clinic_id: string
          created_at: string
          id: string
          patient_id: string
          reason: string | null
          slot_at: string
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          patient_id: string
          reason?: string | null
          slot_at: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          patient_id?: string
          reason?: string | null
          slot_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Relationships: [
          {
            foreignKeyName: "clinic_bookings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
        ]
      }
      clinics: {
        Row: {
          address: string | null
          created_at: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          specialties: string[] | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          specialties?: string[] | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          specialties?: string[] | null
        }
        Relationships: []
      }
      course_modules: {
        Row: {
          content: string | null
          course_id: string
          id: string
          idx: number
          title: string
        }
        Insert: {
          content?: string | null
          course_id: string
          id?: string
          idx: number
          title: string
        }
        Update: {
          content?: string | null
          course_id?: string
          id?: string
          idx?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          duration_hours: number | null
          id: string
          level: string | null
          price: number | null
          summary: string | null
          title: string
        }
        Insert: {
          created_at?: string
          duration_hours?: number | null
          id?: string
          level?: string | null
          price?: number | null
          summary?: string | null
          title: string
        }
        Update: {
          created_at?: string
          duration_hours?: number | null
          id?: string
          level?: string | null
          price?: number | null
          summary?: string | null
          title?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          completed_at: string | null
          course_id: string
          created_at: string
          id: string
          progress: number
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          course_id: string
          created_at?: string
          id?: string
          progress?: number
          user_id: string
        }
        Update: {
          completed_at?: string | null
          course_id?: string
          created_at?: string
          id?: string
          progress?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_events: {
        Row: {
          actor_id: string | null
          at: string
          event_type: string
          id: number
          incident_id: string
          payload: Json | null
        }
        Insert: {
          actor_id?: string | null
          at?: string
          event_type: string
          id?: number
          incident_id: string
          payload?: Json | null
        }
        Update: {
          actor_id?: string | null
          at?: string
          event_type?: string
          id?: number
          incident_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "incident_events_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
            referencedColumns: ["id"]
          },
        ]
      }
      incidents: {
        Row: {
          address: string | null
          assigned_ambulance_id: string | null
          caller_name: string | null
          caller_phone: string | null
          code: string
          created_at: string
          id: string
          notes: string | null
          patient_name: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          requested_by: string | null
          severity: Database["public"]["Enums"]["incident_severity"]
          sla_target_at: string | null
          status: Database["public"]["Enums"]["incident_status"]
          symptoms: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          assigned_ambulance_id?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_name?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          requested_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          sla_target_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          symptoms?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          assigned_ambulance_id?: string | null
          caller_name?: string | null
          caller_phone?: string | null
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          patient_name?: string | null
          pickup_lat?: number | null
          pickup_lng?: number | null
          requested_by?: string | null
          severity?: Database["public"]["Enums"]["incident_severity"]
          sla_target_at?: string | null
          status?: Database["public"]["Enums"]["incident_status"]
          symptoms?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incidents_assigned_ambulance_id_fkey"
            columns: ["assigned_ambulance_id"]
            isOneToOne: false
            referencedRelation: "ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          default_role: Database["public"]["Enums"]["app_role"]
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      rentals: {
        Row: {
          ambulance_id: string
          created_at: string
          customer_id: string
          daily_rate: number
          end_at: string
          id: string
          notes: string | null
          start_at: string
          status: Database["public"]["Enums"]["booking_status"]
          total_amount: number | null
        }
        Insert: {
          ambulance_id: string
          created_at?: string
          customer_id: string
          daily_rate: number
          end_at: string
          id?: string
          notes?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
        }
        Update: {
          ambulance_id?: string
          created_at?: string
          customer_id?: string
          daily_rate?: number
          end_at?: string
          id?: string
          notes?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["booking_status"]
          total_amount?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rentals_ambulance_id_fkey"
            columns: ["ambulance_id"]
            isOneToOne: false
            referencedRelation: "ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      ambulance_status:
        | "available"
        | "en_route"
        | "on_scene"
        | "transporting"
        | "out_of_service"
      ambulance_type: "BLS" | "ALS" | "ICU" | "NEONATAL"
      app_role:
        | "admin"
        | "dispatcher"
        | "paramedic"
        | "driver"
        | "patient"
        | "developer"
      booking_status: "requested" | "confirmed" | "completed" | "cancelled"
      incident_severity: "code_red" | "code_yellow" | "routine"
      incident_status:
        | "pending"
        | "assigned"
        | "en_route"
        | "on_scene"
        | "transporting"
        | "completed"
        | "cancelled"
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
      ambulance_status: [
        "available",
        "en_route",
        "on_scene",
        "transporting",
        "out_of_service",
      ],
      ambulance_type: ["BLS", "ALS", "ICU", "NEONATAL"],
      app_role: [
        "admin",
        "dispatcher",
        "paramedic",
        "driver",
        "patient",
        "developer",
      ],
      booking_status: ["requested", "confirmed", "completed", "cancelled"],
      incident_severity: ["code_red", "code_yellow", "routine"],
      incident_status: [
        "pending",
        "assigned",
        "en_route",
        "on_scene",
        "transporting",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
