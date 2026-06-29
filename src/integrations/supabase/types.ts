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
          {
            foreignKeyName: "ambulance_locations_ambulance_id_fkey"
            columns: ["ambulance_id"]
            isOneToOne: false
            referencedRelation: "dispatchable_ambulances"
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
          rate_limit_per_min: number
          scopes: string[]
          tenant_id: string | null
        }
        Insert: {
          created_at?: string
          hashed_key: string
          id?: string
          last_used_at?: string | null
          name: string
          owner_id: string
          prefix: string
          rate_limit_per_min?: number
          scopes?: string[]
          tenant_id?: string | null
        }
        Update: {
          created_at?: string
          hashed_key?: string
          id?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          prefix?: string
          rate_limit_per_min?: number
          scopes?: string[]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_keys_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity: string
          entity_id: string | null
          id: string
          payload: Json | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          payload?: Json | null
        }
        Relationships: []
      }
      beneficiary: {
        Row: {
          address_city: string | null
          address_country: string | null
          address_district: string | null
          address_line: string | null
          address_postal_code: string | null
          address_state: string | null
          address_street: string | null
          birth_weight_grams: number | null
          blood_group: string | null
          contact_number: string | null
          created_at: string
          created_by: string | null
          dob: string
          document_id: string
          document_type: string
          ehealth_id: string | null
          email: string | null
          first_name: string | null
          full_name: string
          gender: string
          id: string
          journey_state: string
          last_name: string | null
          marital_status: string | null
          middle_name: string | null
          nationality: string | null
          occupation: string | null
          patient_file_no: string | null
          patient_user_id: string | null
          preferred_language: string | null
          religion: string | null
          residency_type: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address_city?: string | null
          address_country?: string | null
          address_district?: string | null
          address_line?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          birth_weight_grams?: number | null
          blood_group?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          dob: string
          document_id: string
          document_type: string
          ehealth_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name: string
          gender: string
          id?: string
          journey_state?: string
          last_name?: string | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          occupation?: string | null
          patient_file_no?: string | null
          patient_user_id?: string | null
          preferred_language?: string | null
          religion?: string | null
          residency_type?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address_city?: string | null
          address_country?: string | null
          address_district?: string | null
          address_line?: string | null
          address_postal_code?: string | null
          address_state?: string | null
          address_street?: string | null
          birth_weight_grams?: number | null
          blood_group?: string | null
          contact_number?: string | null
          created_at?: string
          created_by?: string | null
          dob?: string
          document_id?: string
          document_type?: string
          ehealth_id?: string | null
          email?: string | null
          first_name?: string | null
          full_name?: string
          gender?: string
          id?: string
          journey_state?: string
          last_name?: string | null
          marital_status?: string | null
          middle_name?: string | null
          nationality?: string | null
          occupation?: string | null
          patient_file_no?: string | null
          patient_user_id?: string | null
          preferred_language?: string | null
          religion?: string | null
          residency_type?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beneficiary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      business_request_events: {
        Row: {
          actor_id: string | null
          created_at: string
          from_stage:
            | Database["public"]["Enums"]["business_request_stage"]
            | null
          id: string
          kind: string
          note: string | null
          payload: Json | null
          request_id: string
          to_stage: Database["public"]["Enums"]["business_request_stage"] | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          from_stage?:
            | Database["public"]["Enums"]["business_request_stage"]
            | null
          id?: string
          kind: string
          note?: string | null
          payload?: Json | null
          request_id: string
          to_stage?:
            | Database["public"]["Enums"]["business_request_stage"]
            | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          from_stage?:
            | Database["public"]["Enums"]["business_request_stage"]
            | null
          id?: string
          kind?: string
          note?: string | null
          payload?: Json | null
          request_id?: string
          to_stage?:
            | Database["public"]["Enums"]["business_request_stage"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "business_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "business_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      business_requests: {
        Row: {
          address_line: string | null
          assigned_to: string | null
          city: string | null
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone: string | null
          converted_tenant_id: string | null
          country: string | null
          cr_number: string | null
          created_at: string
          created_by: string | null
          currency: string
          estimated_value_cents: number | null
          expected_seats: number | null
          fleet_size: number | null
          id: string
          legal_name: string | null
          nick_name: string | null
          notes: string | null
          postal_code: string | null
          region: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source: Database["public"]["Enums"]["business_request_source"]
          source_detail: string | null
          stage: Database["public"]["Enums"]["business_request_stage"]
          status: string
          updated_at: string
          use_case: string | null
          vat_number: string | null
          website_url: string | null
        }
        Insert: {
          address_line?: string | null
          assigned_to?: string | null
          city?: string | null
          company_name: string
          contact_email: string
          contact_name: string
          contact_phone?: string | null
          converted_tenant_id?: string | null
          country?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          estimated_value_cents?: number | null
          expected_seats?: number | null
          fleet_size?: number | null
          id?: string
          legal_name?: string | null
          nick_name?: string | null
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["business_request_source"]
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["business_request_stage"]
          status?: string
          updated_at?: string
          use_case?: string | null
          vat_number?: string | null
          website_url?: string | null
        }
        Update: {
          address_line?: string | null
          assigned_to?: string | null
          city?: string | null
          company_name?: string
          contact_email?: string
          contact_name?: string
          contact_phone?: string | null
          converted_tenant_id?: string | null
          country?: string | null
          cr_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          estimated_value_cents?: number | null
          expected_seats?: number | null
          fleet_size?: number | null
          id?: string
          legal_name?: string | null
          nick_name?: string | null
          notes?: string | null
          postal_code?: string | null
          region?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: Database["public"]["Enums"]["business_request_source"]
          source_detail?: string | null
          stage?: Database["public"]["Enums"]["business_request_stage"]
          status?: string
          updated_at?: string
          use_case?: string | null
          vat_number?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "business_requests_converted_tenant_id_fkey"
            columns: ["converted_tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plan_tasks: {
        Row: {
          care_plan_id: string
          id: string
          instructions: string | null
          requires_vitals: boolean
          title: string
        }
        Insert: {
          care_plan_id: string
          id?: string
          instructions?: string | null
          requires_vitals?: boolean
          title: string
        }
        Update: {
          care_plan_id?: string
          id?: string
          instructions?: string | null
          requires_vitals?: boolean
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plan_tasks_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      care_plans: {
        Row: {
          assigned_team_id: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          frequency: Database["public"]["Enums"]["visit_frequency"]
          id: string
          notes: string | null
          plan_type: Database["public"]["Enums"]["care_plan_type"]
          recipient_id: string
          required_skills: string[]
          start_date: string
          status: string
          tenant_id: string
        }
        Insert: {
          assigned_team_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency: Database["public"]["Enums"]["visit_frequency"]
          id?: string
          notes?: string | null
          plan_type: Database["public"]["Enums"]["care_plan_type"]
          recipient_id: string
          required_skills?: string[]
          start_date: string
          status?: string
          tenant_id: string
        }
        Update: {
          assigned_team_id?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          frequency?: Database["public"]["Enums"]["visit_frequency"]
          id?: string
          notes?: string | null
          plan_type?: Database["public"]["Enums"]["care_plan_type"]
          recipient_id?: string
          required_skills?: string[]
          start_date?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_plans_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_recipients: {
        Row: {
          address: string | null
          created_at: string
          dob: string | null
          emergency_contact: string | null
          full_name: string
          gender: string | null
          geofence_radius_m: number
          id: string
          lat: number | null
          lng: number | null
          medical_summary: string | null
          patient_id: string | null
          phone: string | null
          tenant_id: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact?: string | null
          full_name: string
          gender?: string | null
          geofence_radius_m?: number
          id?: string
          lat?: number | null
          lng?: number | null
          medical_summary?: string | null
          patient_id?: string | null
          phone?: string | null
          tenant_id: string
        }
        Update: {
          address?: string | null
          created_at?: string
          dob?: string | null
          emergency_contact?: string | null
          full_name?: string
          gender?: string | null
          geofence_radius_m?: number
          id?: string
          lat?: number | null
          lng?: number | null
          medical_summary?: string | null
          patient_id?: string | null
          phone?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_recipients_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      care_visit_tasks: {
        Row: {
          care_visit_id: string
          completed: boolean
          completed_at: string | null
          id: string
          plan_task_id: string | null
          title: string
        }
        Insert: {
          care_visit_id: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          plan_task_id?: string | null
          title: string
        }
        Update: {
          care_visit_id?: string
          completed?: boolean
          completed_at?: string | null
          id?: string
          plan_task_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_visit_tasks_care_visit_id_fkey"
            columns: ["care_visit_id"]
            isOneToOne: false
            referencedRelation: "care_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_visit_tasks_plan_task_id_fkey"
            columns: ["plan_task_id"]
            isOneToOne: false
            referencedRelation: "care_plan_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      care_visit_vitals: {
        Row: {
          care_visit_id: string
          id: string
          recorded_at: string
          type: string
          unit: string | null
          value: string
        }
        Insert: {
          care_visit_id: string
          id?: string
          recorded_at?: string
          type: string
          unit?: string | null
          value: string
        }
        Update: {
          care_visit_id?: string
          id?: string
          recorded_at?: string
          type?: string
          unit?: string | null
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_visit_vitals_care_visit_id_fkey"
            columns: ["care_visit_id"]
            isOneToOne: false
            referencedRelation: "care_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      care_visits: {
        Row: {
          care_plan_id: string
          caregiver_id: string | null
          check_in_at: string | null
          check_in_distance_m: number | null
          check_in_lat: number | null
          check_in_lng: number | null
          check_out_at: string | null
          check_out_lat: number | null
          check_out_lng: number | null
          created_at: string
          evv_exception: string | null
          evv_verified: boolean
          id: string
          notes: string | null
          recipient_id: string
          scheduled_end: string
          scheduled_start: string
          status: Database["public"]["Enums"]["care_visit_status"]
          tenant_id: string
        }
        Insert: {
          care_plan_id: string
          caregiver_id?: string | null
          check_in_at?: string | null
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          evv_exception?: string | null
          evv_verified?: boolean
          id?: string
          notes?: string | null
          recipient_id: string
          scheduled_end: string
          scheduled_start: string
          status?: Database["public"]["Enums"]["care_visit_status"]
          tenant_id: string
        }
        Update: {
          care_plan_id?: string
          caregiver_id?: string | null
          check_in_at?: string | null
          check_in_distance_m?: number | null
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_out_at?: string | null
          check_out_lat?: number | null
          check_out_lng?: number | null
          created_at?: string
          evv_exception?: string | null
          evv_verified?: boolean
          id?: string
          notes?: string | null
          recipient_id?: string
          scheduled_end?: string
          scheduled_start?: string
          status?: Database["public"]["Enums"]["care_visit_status"]
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_visits_care_plan_id_fkey"
            columns: ["care_plan_id"]
            isOneToOne: false
            referencedRelation: "care_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_visits_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "care_recipients"
            referencedColumns: ["id"]
          },
        ]
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
          kind: string
          patient_id: string
          reason: string | null
          slot_at: string
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          kind?: string
          patient_id: string
          reason?: string | null
          slot_at: string
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: string
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
          {
            foreignKeyName: "clinic_bookings_clinic_id_fkey"
            columns: ["clinic_id"]
            isOneToOne: false
            referencedRelation: "clinics_public"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target: string | null
          target_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
          target_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
          target_id?: string | null
          tenant_id?: string
        }
        Relationships: []
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
      code_system: {
        Row: {
          created_at: string
          edition: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_current: boolean
          key: string
          kind: Database["public"]["Enums"]["code_system_kind"]
          name: string
          oid: string | null
          source_authority: string | null
          updated_at: string
          version: string | null
        }
        Insert: {
          created_at?: string
          edition?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_current?: boolean
          key: string
          kind: Database["public"]["Enums"]["code_system_kind"]
          name: string
          oid?: string | null
          source_authority?: string | null
          updated_at?: string
          version?: string | null
        }
        Update: {
          created_at?: string
          edition?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_current?: boolean
          key?: string
          kind?: Database["public"]["Enums"]["code_system_kind"]
          name?: string
          oid?: string | null
          source_authority?: string | null
          updated_at?: string
          version?: string | null
        }
        Relationships: []
      }
      code_value: {
        Row: {
          active: boolean
          attributes: Json | null
          code: string
          code_system_id: string
          created_at: string
          display: string | null
          id: string
          parent_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          attributes?: Json | null
          code: string
          code_system_id: string
          created_at?: string
          display?: string | null
          id?: string
          parent_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          attributes?: Json | null
          code?: string
          code_system_id?: string
          created_at?: string
          display?: string | null
          id?: string
          parent_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "code_value_code_system_id_fkey"
            columns: ["code_system_id"]
            isOneToOne: false
            referencedRelation: "code_system"
            referencedColumns: ["id"]
          },
        ]
      }
      corporate_accounts: {
        Row: {
          accent_color: string | null
          billing_ref: string | null
          company_name: string
          contact_email: string | null
          contact_phone: string | null
          country: string | null
          created_at: string
          id: string
          logo_url: string | null
          owner_user_id: string | null
          plan_tier: string
          primary_color: string | null
          slug: string | null
          status: string
        }
        Insert: {
          accent_color?: string | null
          billing_ref?: string | null
          company_name: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          owner_user_id?: string | null
          plan_tier?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
        }
        Update: {
          accent_color?: string | null
          billing_ref?: string | null
          company_name?: string
          contact_email?: string | null
          contact_phone?: string | null
          country?: string | null
          created_at?: string
          id?: string
          logo_url?: string | null
          owner_user_id?: string | null
          plan_tier?: string
          primary_color?: string | null
          slug?: string | null
          status?: string
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
      coverage: {
        Row: {
          beneficiary_id: string
          coverage_type: string
          created_at: string
          created_by: string | null
          expiry_date: string | null
          id: string
          insurance_plan_id: string | null
          member_id: string
          network_id: string | null
          payer_id: string | null
          payer_nphies_id: string
          policy_holder: string
          policy_id: string | null
          policy_number: string | null
          relation_with_subscriber: string
          status: string
          tenant_id: string
          tpa_nphies_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          beneficiary_id: string
          coverage_type: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          insurance_plan_id?: string | null
          member_id: string
          network_id?: string | null
          payer_id?: string | null
          payer_nphies_id: string
          policy_holder: string
          policy_id?: string | null
          policy_number?: string | null
          relation_with_subscriber: string
          status?: string
          tenant_id: string
          tpa_nphies_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          beneficiary_id?: string
          coverage_type?: string
          created_at?: string
          created_by?: string | null
          expiry_date?: string | null
          id?: string
          insurance_plan_id?: string | null
          member_id?: string
          network_id?: string | null
          payer_id?: string | null
          payer_nphies_id?: string
          policy_holder?: string
          policy_id?: string | null
          policy_number?: string | null
          relation_with_subscriber?: string
          status?: string
          tenant_id?: string
          tpa_nphies_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coverage_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_class: {
        Row: {
          coverage_id: string
          created_at: string
          display_name: string | null
          id: string
          tenant_id: string
          type: string
          updated_at: string
          value: string
        }
        Insert: {
          coverage_id: string
          created_at?: string
          display_name?: string | null
          id?: string
          tenant_id: string
          type: string
          updated_at?: string
          value: string
        }
        Update: {
          coverage_id?: string
          created_at?: string
          display_name?: string | null
          id?: string
          tenant_id?: string
          type?: string
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "coverage_class_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_class_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      credentials: {
        Row: {
          created_at: string
          document_url: string | null
          expires_on: string
          id: string
          issued_on: string | null
          issuer: string | null
          kind: Database["public"]["Enums"]["credential_kind"]
          notes: string | null
          reference: string
          subject_ambulance_id: string | null
          subject_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          document_url?: string | null
          expires_on: string
          id?: string
          issued_on?: string | null
          issuer?: string | null
          kind: Database["public"]["Enums"]["credential_kind"]
          notes?: string | null
          reference: string
          subject_ambulance_id?: string | null
          subject_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          document_url?: string | null
          expires_on?: string
          id?: string
          issued_on?: string | null
          issuer?: string | null
          kind?: Database["public"]["Enums"]["credential_kind"]
          notes?: string | null
          reference?: string
          subject_ambulance_id?: string | null
          subject_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credentials_subject_ambulance_id_fkey"
            columns: ["subject_ambulance_id"]
            isOneToOne: false
            referencedRelation: "ambulances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credentials_subject_ambulance_id_fkey"
            columns: ["subject_ambulance_id"]
            isOneToOne: false
            referencedRelation: "dispatchable_ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
      debug_events: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          message: string | null
          payload: Json
          route: string | null
          severity: string
          source: string
          tenant_id: string | null
          viewport: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          message?: string | null
          payload?: Json
          route?: string | null
          severity?: string
          source: string
          tenant_id?: string | null
          viewport?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          message?: string | null
          payload?: Json
          route?: string | null
          severity?: string
          source?: string
          tenant_id?: string | null
          viewport?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debug_events_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      defects: {
        Row: {
          blocks_service: boolean
          created_at: string
          description: string
          id: string
          reported_by: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["defect_severity"]
          vehicle_id: string
        }
        Insert: {
          blocks_service?: boolean
          created_at?: string
          description: string
          id?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["defect_severity"]
          vehicle_id: string
        }
        Update: {
          blocks_service?: boolean
          created_at?: string
          description?: string
          id?: string
          reported_by?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["defect_severity"]
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "defects_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "ambulances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "defects_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "dispatchable_ambulances"
            referencedColumns: ["id"]
          },
        ]
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
          source: string
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
          source?: string
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
          source?: string
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
          {
            foreignKeyName: "incidents_assigned_ambulance_id_fkey"
            columns: ["assigned_ambulance_id"]
            isOneToOne: false
            referencedRelation: "dispatchable_ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_acceptances: {
        Row: {
          accepted_at: string
          id: string
          ip_hash: string | null
          locale: Database["public"]["Enums"]["legal_locale"]
          slug: Database["public"]["Enums"]["legal_slug"]
          subject_email: string | null
          subject_id: string | null
          user_agent: string | null
          version: number
        }
        Insert: {
          accepted_at?: string
          id?: string
          ip_hash?: string | null
          locale: Database["public"]["Enums"]["legal_locale"]
          slug: Database["public"]["Enums"]["legal_slug"]
          subject_email?: string | null
          subject_id?: string | null
          user_agent?: string | null
          version: number
        }
        Update: {
          accepted_at?: string
          id?: string
          ip_hash?: string | null
          locale?: Database["public"]["Enums"]["legal_locale"]
          slug?: Database["public"]["Enums"]["legal_slug"]
          subject_email?: string | null
          subject_id?: string | null
          user_agent?: string | null
          version?: number
        }
        Relationships: []
      }
      legal_document_versions: {
        Row: {
          actor_id: string | null
          body_html: string | null
          body_md: string
          change_note: string | null
          document_id: string
          effective_date: string | null
          id: string
          locale: Database["public"]["Enums"]["legal_locale"]
          slug: Database["public"]["Enums"]["legal_slug"]
          snapshot_at: string
          status: Database["public"]["Enums"]["legal_status"]
          summary: string | null
          title: string
          version: number
        }
        Insert: {
          actor_id?: string | null
          body_html?: string | null
          body_md: string
          change_note?: string | null
          document_id: string
          effective_date?: string | null
          id?: string
          locale: Database["public"]["Enums"]["legal_locale"]
          slug: Database["public"]["Enums"]["legal_slug"]
          snapshot_at?: string
          status: Database["public"]["Enums"]["legal_status"]
          summary?: string | null
          title: string
          version: number
        }
        Update: {
          actor_id?: string | null
          body_html?: string | null
          body_md?: string
          change_note?: string | null
          document_id?: string
          effective_date?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["legal_locale"]
          slug?: Database["public"]["Enums"]["legal_slug"]
          snapshot_at?: string
          status?: Database["public"]["Enums"]["legal_status"]
          summary?: string | null
          title?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "legal_document_versions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "legal_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      legal_documents: {
        Row: {
          body_html: string | null
          body_md: string
          created_at: string
          effective_date: string | null
          id: string
          locale: Database["public"]["Enums"]["legal_locale"]
          published_at: string | null
          published_by: string | null
          slug: Database["public"]["Enums"]["legal_slug"]
          status: Database["public"]["Enums"]["legal_status"]
          subtitle: string | null
          summary: string | null
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          body_html?: string | null
          body_md?: string
          created_at?: string
          effective_date?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["legal_locale"]
          published_at?: string | null
          published_by?: string | null
          slug: Database["public"]["Enums"]["legal_slug"]
          status?: Database["public"]["Enums"]["legal_status"]
          subtitle?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          body_html?: string | null
          body_md?: string
          created_at?: string
          effective_date?: string | null
          id?: string
          locale?: Database["public"]["Enums"]["legal_locale"]
          published_at?: string | null
          published_by?: string | null
          slug?: Database["public"]["Enums"]["legal_slug"]
          status?: Database["public"]["Enums"]["legal_status"]
          subtitle?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      medication_administrations: {
        Row: {
          administered_at: string | null
          administered_by: string | null
          care_visit_id: string
          dose: string | null
          drug_name: string
          id: string
          route: string | null
          scheduled_at: string | null
          status: string
        }
        Insert: {
          administered_at?: string | null
          administered_by?: string | null
          care_visit_id: string
          dose?: string | null
          drug_name: string
          id?: string
          route?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Update: {
          administered_at?: string | null
          administered_by?: string | null
          care_visit_id?: string
          dose?: string | null
          drug_name?: string
          id?: string
          route?: string | null
          scheduled_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_administrations_care_visit_id_fkey"
            columns: ["care_visit_id"]
            isOneToOne: false
            referencedRelation: "care_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      nav_events: {
        Row: {
          event_name: string
          id: string
          locale: string | null
          occurred_at: string
          referrer: string | null
          surface: string
          target_path: string
          user_agent_hash: string | null
        }
        Insert: {
          event_name: string
          id?: string
          locale?: string | null
          occurred_at?: string
          referrer?: string | null
          surface: string
          target_path: string
          user_agent_hash?: string | null
        }
        Update: {
          event_name?: string
          id?: string
          locale?: string | null
          occurred_at?: string
          referrer?: string | null
          surface?: string
          target_path?: string
          user_agent_hash?: string | null
        }
        Relationships: []
      }
      oauth_events: {
        Row: {
          attempt_id: string | null
          code: string | null
          created_at: string
          email: string | null
          id: string
          intended_role: string | null
          ip: string | null
          metadata: Json | null
          outcome: string
          provider: string
          resolved_role: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempt_id?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          intended_role?: string | null
          ip?: string | null
          metadata?: Json | null
          outcome: string
          provider?: string
          resolved_role?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempt_id?: string | null
          code?: string | null
          created_at?: string
          email?: string | null
          id?: string
          intended_role?: string | null
          ip?: string | null
          metadata?: Json | null
          outcome?: string
          provider?: string
          resolved_role?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      ops_automations: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          last_message: string | null
          last_run_at: string | null
          last_status: string | null
          name: string
          schedule: string | null
          target_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_message?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name: string
          schedule?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          last_message?: string | null
          last_run_at?: string | null
          last_status?: string | null
          name?: string
          schedule?: string | null
          target_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ops_chat_filters: {
        Row: {
          action: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          kind: string
          notes: string | null
          pattern: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          notes?: string | null
          pattern: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          notes?: string | null
          pattern?: string
          updated_at?: string
        }
        Relationships: []
      }
      ops_notification_reads: {
        Row: {
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "ops_notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_notifications: {
        Row: {
          audience: string
          audience_tenant_id: string | null
          audience_user_id: string | null
          body: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          link_to: string | null
          severity: string
          title: string
        }
        Insert: {
          audience: string
          audience_tenant_id?: string | null
          audience_user_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          link_to?: string | null
          severity?: string
          title: string
        }
        Update: {
          audience?: string
          audience_tenant_id?: string | null
          audience_user_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          link_to?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "ops_notifications_audience_tenant_id_fkey"
            columns: ["audience_tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_refunds: {
        Row: {
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          external_ref: string | null
          id: string
          payment_id: string | null
          processed_at: string | null
          reason: string | null
          status: string
          subscriber_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          external_ref?: string | null
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          reason?: string | null
          status?: string
          subscriber_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          external_ref?: string | null
          id?: string
          payment_id?: string | null
          processed_at?: string | null
          reason?: string | null
          status?: string
          subscriber_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_refunds_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "portal_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_releases: {
        Row: {
          channel: string
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          published_at: string | null
          status: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          published_at?: string | null
          status?: string
          title: string
          updated_at?: string
          version: string
        }
        Update: {
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          published_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      ops_reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          moderated_at: string | null
          moderated_by: string | null
          patient_id: string | null
          rating: number
          status: string
          tenant_id: string | null
          trip_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          patient_id?: string | null
          rating: number
          status?: string
          tenant_id?: string | null
          trip_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          moderated_at?: string | null
          moderated_by?: string | null
          patient_id?: string | null
          rating?: number
          status?: string
          tenant_id?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ops_reviews_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ops_reviews_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      ops_security_settings: {
        Row: {
          id: string
          ip_allowlist: string[]
          mfa_required_roles: string[]
          password_min_length: number
          password_require_number: boolean
          password_require_symbol: boolean
          session_ttl_minutes: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          ip_allowlist?: string[]
          mfa_required_roles?: string[]
          password_min_length?: number
          password_require_number?: boolean
          password_require_symbol?: boolean
          session_ttl_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          ip_allowlist?: string[]
          mfa_required_roles?: string[]
          password_min_length?: number
          password_require_number?: boolean
          password_require_symbol?: boolean
          session_ttl_minutes?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ops_smoke_reports: {
        Row: {
          checked_at: string
          http_status: number | null
          id: string
          latency_ms: number | null
          message: string | null
          status: string
          target: string
        }
        Insert: {
          checked_at?: string
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          status?: string
          target: string
        }
        Update: {
          checked_at?: string
          http_status?: number | null
          id?: string
          latency_ms?: number | null
          message?: string | null
          status?: string
          target?: string
        }
        Relationships: []
      }
      ops_test_runs: {
        Row: {
          branch: string | null
          commit_sha: string | null
          duration_ms: number
          failed: number
          finished_at: string | null
          id: string
          passed: number
          report_url: string | null
          started_at: string
          status: string
          suite: string
          total: number
        }
        Insert: {
          branch?: string | null
          commit_sha?: string | null
          duration_ms?: number
          failed?: number
          finished_at?: string | null
          id?: string
          passed?: number
          report_url?: string | null
          started_at?: string
          status?: string
          suite: string
          total?: number
        }
        Update: {
          branch?: string | null
          commit_sha?: string | null
          duration_ms?: number
          failed?: number
          finished_at?: string | null
          id?: string
          passed?: number
          report_url?: string | null
          started_at?: string
          status?: string
          suite?: string
          total?: number
        }
        Relationships: []
      }
      ops_workspace_settings: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      patient_allergies: {
        Row: {
          created_at: string
          id: string
          label: string
          reaction: string | null
          severity: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          reaction?: string | null
          severity?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          reaction?: string | null
          severity?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patient_conditions: {
        Row: {
          created_at: string
          id: string
          label: string
          notes: string | null
          severity: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          notes?: string | null
          severity?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          notes?: string | null
          severity?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patient_connections: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          peer_id: string | null
          peer_label: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          peer_id?: string | null
          peer_label?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          peer_id?: string | null
          peer_label?: string | null
          status?: string
        }
        Relationships: []
      }
      patient_emergency_contacts: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          name: string
          phone: string
          relation: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name: string
          phone: string
          relation?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string
          relation?: string | null
          user_id?: string
        }
        Relationships: []
      }
      patient_insurance: {
        Row: {
          created_at: string
          id: string
          payer: string
          policy_no: string | null
          status: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          payer: string
          policy_no?: string | null
          status?: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          payer?: string
          policy_no?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      portal_api_keys: {
        Row: {
          created_at: string
          hashed_key: string
          id: string
          last_used_at: string | null
          name: string
          owner_id: string
          prefix: string
          rate_limit_per_min: number
          revoked_at: string | null
          scopes: string[]
        }
        Insert: {
          created_at?: string
          hashed_key: string
          id?: string
          last_used_at?: string | null
          name: string
          owner_id: string
          prefix: string
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
        }
        Update: {
          created_at?: string
          hashed_key?: string
          id?: string
          last_used_at?: string | null
          name?: string
          owner_id?: string
          prefix?: string
          rate_limit_per_min?: number
          revoked_at?: string | null
          scopes?: string[]
        }
        Relationships: []
      }
      portal_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          id: string
          payload: Json | null
          target: string | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          id?: string
          payload?: Json | null
          target?: string | null
          target_id?: string | null
        }
        Relationships: []
      }
      portal_bugs: {
        Row: {
          assignee_id: string | null
          count: number
          created_at: string
          external_ref: string | null
          id: string
          last_seen_at: string
          severity: string
          source: string
          stack_url: string | null
          status: string
          subscriber_id: string | null
          title: string
        }
        Insert: {
          assignee_id?: string | null
          count?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          last_seen_at?: string
          severity?: string
          source?: string
          stack_url?: string | null
          status?: string
          subscriber_id?: string | null
          title: string
        }
        Update: {
          assignee_id?: string | null
          count?: number
          created_at?: string
          external_ref?: string | null
          id?: string
          last_seen_at?: string
          severity?: string
          source?: string
          stack_url?: string | null
          status?: string
          subscriber_id?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_bugs_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_config_base: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      portal_config_overrides: {
        Row: {
          id: string
          key: string
          subscriber_id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          subscriber_id: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          id?: string
          key?: string
          subscriber_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "portal_config_overrides_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_credits: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          granted_by: string | null
          id: string
          reason: string | null
          subscriber_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          subscriber_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          granted_by?: string | null
          id?: string
          reason?: string | null
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_credits_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_invoices: {
        Row: {
          amount_cents: number
          currency: string
          gateway_invoice_id: string | null
          id: string
          issued_at: string
          number: string
          pdf_url: string | null
          status: string
          subscriber_id: string
        }
        Insert: {
          amount_cents: number
          currency?: string
          gateway_invoice_id?: string | null
          id?: string
          issued_at?: string
          number: string
          pdf_url?: string | null
          status?: string
          subscriber_id: string
        }
        Update: {
          amount_cents?: number
          currency?: string
          gateway_invoice_id?: string | null
          id?: string
          issued_at?: string
          number?: string
          pdf_url?: string | null
          status?: string
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_invoices_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          method: string
          receipt_url: string | null
          status: string
          subscriber_id: string
          subscription_id: string | null
          txn_ref: string | null
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          receipt_url?: string | null
          status?: string
          subscriber_id: string
          subscription_id?: string | null
          txn_ref?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          receipt_url?: string | null
          status?: string
          subscriber_id?: string
          subscription_id?: string | null
          txn_ref?: string | null
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "portal_payments_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "portal_payments_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "portal_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_promotions: {
        Row: {
          code: string
          created_at: string
          id: string
          notes: string | null
          type: string
          valid_until: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          notes?: string | null
          type: string
          valid_until?: string | null
          value: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          notes?: string | null
          type?: string
          valid_until?: string | null
          value?: number
        }
        Relationships: []
      }
      portal_role_assignments: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          role: Database["public"]["Enums"]["portal_role"]
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["portal_role"]
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["portal_role"]
          user_id?: string
        }
        Relationships: []
      }
      portal_role_privileges: {
        Row: {
          can_manage: boolean
          can_view: boolean
          module: string
          role: Database["public"]["Enums"]["portal_role"]
          updated_at: string
        }
        Insert: {
          can_manage?: boolean
          can_view?: boolean
          module: string
          role: Database["public"]["Enums"]["portal_role"]
          updated_at?: string
        }
        Update: {
          can_manage?: boolean
          can_view?: boolean
          module?: string
          role?: Database["public"]["Enums"]["portal_role"]
          updated_at?: string
        }
        Relationships: []
      }
      portal_subscriptions: {
        Row: {
          created_at: string
          currency: string
          cycle: string
          gateway_ref: string | null
          id: string
          plan: string
          price_cents: number
          renews_at: string | null
          seats: number
          started_at: string
          status: string
          subscriber_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          cycle?: string
          gateway_ref?: string | null
          id?: string
          plan: string
          price_cents?: number
          renews_at?: string | null
          seats?: number
          started_at?: string
          status?: string
          subscriber_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          cycle?: string
          gateway_ref?: string | null
          id?: string
          plan?: string
          price_cents?: number
          renews_at?: string | null
          seats?: number
          started_at?: string
          status?: string
          subscriber_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_subscriptions_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_ticket_events: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_ticket_events_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "portal_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_tickets: {
        Row: {
          assignee_id: string | null
          body: string | null
          created_at: string
          created_by: string | null
          id: string
          priority: string
          status: string
          subject: string
          subscriber_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: string
          subject: string
          subscriber_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          body?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          priority?: string
          status?: string
          subject?: string
          subscriber_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_tickets_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      portal_usage_daily: {
        Row: {
          active_branches: number
          active_teams: number
          api_calls: number
          day: string
          incidents: number
          subscriber_id: string
        }
        Insert: {
          active_branches?: number
          active_teams?: number
          api_calls?: number
          day: string
          incidents?: number
          subscriber_id: string
        }
        Update: {
          active_branches?: number
          active_teams?: number
          api_calls?: number
          day?: string
          incidents?: number
          subscriber_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "portal_usage_daily_subscriber_id_fkey"
            columns: ["subscriber_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          blood_type: string | null
          created_at: string
          default_role: Database["public"]["Enums"]["app_role"]
          display_name: string | null
          dob: string | null
          email: string | null
          full_name: string | null
          gender: string | null
          id: string
          member_code: string | null
          national_id_last4: string | null
          nationality: string | null
          passport_number: string | null
          phone: string | null
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          blood_type?: string | null
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          display_name?: string | null
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id: string
          member_code?: string | null
          national_id_last4?: string | null
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          blood_type?: string | null
          created_at?: string
          default_role?: Database["public"]["Enums"]["app_role"]
          display_name?: string | null
          dob?: string | null
          email?: string | null
          full_name?: string | null
          gender?: string | null
          id?: string
          member_code?: string | null
          national_id_last4?: string | null
          nationality?: string | null
          passport_number?: string | null
          phone?: string | null
          updated_at?: string
          verified_at?: string | null
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
          {
            foreignKeyName: "rentals_ambulance_id_fkey"
            columns: ["ambulance_id"]
            isOneToOne: false
            referencedRelation: "dispatchable_ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
      resource_locations: {
        Row: {
          accuracy_m: number | null
          heading: number | null
          id: string
          lat: number
          lng: number
          recorded_at: string
          resource_id: string
          resource_kind: string
          speed_kmh: number | null
        }
        Insert: {
          accuracy_m?: number | null
          heading?: number | null
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          resource_id: string
          resource_kind: string
          speed_kmh?: number | null
        }
        Update: {
          accuracy_m?: number | null
          heading?: number | null
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          resource_id?: string
          resource_kind?: string
          speed_kmh?: number | null
        }
        Relationships: []
      }
      screening_orders: {
        Row: {
          appointment_at: string | null
          candidate_id_ref: string | null
          candidate_name: string
          corporate_account_id: string
          created_at: string
          id: string
          package_id: string
          status: Database["public"]["Enums"]["screening_order_status"]
          updated_at: string
        }
        Insert: {
          appointment_at?: string | null
          candidate_id_ref?: string | null
          candidate_name: string
          corporate_account_id: string
          created_at?: string
          id?: string
          package_id: string
          status?: Database["public"]["Enums"]["screening_order_status"]
          updated_at?: string
        }
        Update: {
          appointment_at?: string | null
          candidate_id_ref?: string | null
          candidate_name?: string
          corporate_account_id?: string
          created_at?: string
          id?: string
          package_id?: string
          status?: Database["public"]["Enums"]["screening_order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screening_orders_corporate_account_id_fkey"
            columns: ["corporate_account_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screening_orders_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "screening_packages"
            referencedColumns: ["id"]
          },
        ]
      }
      screening_packages: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          panel_tests: string[]
          price: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name: string
          panel_tests?: string[]
          price?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          panel_tests?: string[]
          price?: number
        }
        Relationships: []
      }
      screening_results: {
        Row: {
          certificate_url: string | null
          created_at: string
          fitness_status: Database["public"]["Enums"]["fitness_status"]
          id: string
          order_id: string
          outcome: string | null
          recorded_by: string | null
          test: string
          value: string | null
        }
        Insert: {
          certificate_url?: string | null
          created_at?: string
          fitness_status?: Database["public"]["Enums"]["fitness_status"]
          id?: string
          order_id: string
          outcome?: string | null
          recorded_by?: string | null
          test: string
          value?: string | null
        }
        Update: {
          certificate_url?: string | null
          created_at?: string
          fitness_status?: Database["public"]["Enums"]["fitness_status"]
          id?: string
          order_id?: string
          outcome?: string | null
          recorded_by?: string | null
          test?: string
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "screening_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "screening_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_addons: {
        Row: {
          code: string
          created_at: string
          description: string | null
          icon: string | null
          id: string
          is_active: boolean
          name: string
          price_cents: number | null
          price_display: string | null
          sort_order: number
          unit_label: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          price_cents?: number | null
          price_display?: string | null
          sort_order?: number
          unit_label: string
          unit_type?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          price_cents?: number | null
          price_display?: string | null
          sort_order?: number
          unit_label?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      subscription_plans: {
        Row: {
          api_label: string | null
          billing_period: string
          code: string
          created_at: string
          cta_label: string | null
          cta_to: string | null
          currency: string
          description: string | null
          eyebrow: string | null
          features: Json
          highlight: boolean
          id: string
          included_seats: number
          is_active: boolean
          is_public: boolean
          name: string
          price_cents: number
          seats_label: string | null
          sort_order: number
          tagline: string | null
          units_label: string | null
          updated_at: string
        }
        Insert: {
          api_label?: string | null
          billing_period?: string
          code: string
          created_at?: string
          cta_label?: string | null
          cta_to?: string | null
          currency?: string
          description?: string | null
          eyebrow?: string | null
          features?: Json
          highlight?: boolean
          id?: string
          included_seats?: number
          is_active?: boolean
          is_public?: boolean
          name: string
          price_cents?: number
          seats_label?: string | null
          sort_order?: number
          tagline?: string | null
          units_label?: string | null
          updated_at?: string
        }
        Update: {
          api_label?: string | null
          billing_period?: string
          code?: string
          created_at?: string
          cta_label?: string | null
          cta_to?: string | null
          currency?: string
          description?: string | null
          eyebrow?: string | null
          features?: Json
          highlight?: boolean
          id?: string
          included_seats?: number
          is_active?: boolean
          is_public?: boolean
          name?: string
          price_cents?: number
          seats_label?: string | null
          sort_order?: number
          tagline?: string | null
          units_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      telehealth_sessions: {
        Row: {
          booking_id: string
          created_at: string
          ended_at: string | null
          id: string
          notes: string | null
          provider_user_id: string | null
          room_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["telehealth_status"]
          updated_at: string
        }
        Insert: {
          booking_id: string
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          provider_user_id?: string | null
          room_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["telehealth_status"]
          updated_at?: string
        }
        Update: {
          booking_id?: string
          created_at?: string
          ended_at?: string | null
          id?: string
          notes?: string | null
          provider_user_id?: string | null
          room_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["telehealth_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "telehealth_sessions_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "clinic_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          clinical_role: Database["public"]["Enums"]["clinical_role"] | null
          created_at: string
          id: string
          role: string
          tenant_id: string
          user_id: string
        }
        Insert: {
          clinical_role?: Database["public"]["Enums"]["clinical_role"] | null
          created_at?: string
          id?: string
          role?: string
          tenant_id: string
          user_id: string
        }
        Update: {
          clinical_role?: Database["public"]["Enums"]["clinical_role"] | null
          created_at?: string
          id?: string
          role?: string
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_subscriptions: {
        Row: {
          assigned_by: string | null
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          current_period_start: string
          id: string
          notes: string | null
          plan_id: string
          seats: number
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          notes?: string | null
          plan_id: string
          seats?: number
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string
          id?: string
          notes?: string | null
          plan_id?: string
          seats?: number
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_subscriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_shares: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          revoked_at: string | null
          token: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at: string
          id?: string
          revoked_at?: string | null
          token: string
          trip_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          revoked_at?: string | null
          token?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_shares_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          avg_speed_kmh: number | null
          created_at: string
          distance_km: number | null
          duration_seconds: number | null
          ended_at: string | null
          id: string
          incident_id: string | null
          max_speed_kmh: number | null
          polyline: string | null
          resource_id: string
          resource_kind: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          avg_speed_kmh?: number | null
          created_at?: string
          distance_km?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          incident_id?: string | null
          max_speed_kmh?: number | null
          polyline?: string | null
          resource_id: string
          resource_kind: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          avg_speed_kmh?: number | null
          created_at?: string
          distance_km?: number | null
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          incident_id?: string | null
          max_speed_kmh?: number | null
          polyline?: string | null
          resource_id?: string
          resource_kind?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_incident_id_fkey"
            columns: ["incident_id"]
            isOneToOne: false
            referencedRelation: "incidents"
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
      web_leads: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          id: string
          kind: string
          message: string | null
          name: string
          payload: Json
          phone: string | null
          reference_code: string
          service: string | null
          status: string
          updated_at: string
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind: string
          message?: string | null
          name: string
          payload?: Json
          phone?: string | null
          reference_code: string
          service?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          kind?: string
          message?: string | null
          name?: string
          payload?: Json
          phone?: string | null
          reference_code?: string
          service?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          attempts: number
          created_at: string
          delivered_at: string | null
          event: string
          id: string
          last_error: string | null
          payload: Json
          status: number | null
          subscription_id: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event: string
          id?: string
          last_error?: string | null
          payload: Json
          status?: number | null
          subscription_id: string
        }
        Update: {
          attempts?: number
          created_at?: string
          delivered_at?: string | null
          event?: string
          id?: string
          last_error?: string | null
          payload?: Json
          status?: number | null
          subscription_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "webhook_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      webhook_subscriptions: {
        Row: {
          active: boolean
          created_at: string
          events: string[]
          id: string
          owner_id: string
          secret: string
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          owner_id: string
          secret: string
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          id?: string
          owner_id?: string
          secret?: string
          url?: string
        }
        Relationships: []
      }
      work_order_items: {
        Row: {
          cost: number | null
          created_at: string
          description: string
          id: string
          part_no: string | null
          work_order_id: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          description: string
          id?: string
          part_no?: string | null
          work_order_id: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          description?: string
          id?: string
          part_no?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_order_items_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          closed_at: string | null
          created_at: string
          downtime_minutes: number | null
          id: string
          notes: string | null
          odometer_km: number | null
          opened_at: string
          status: Database["public"]["Enums"]["work_order_status"]
          type: Database["public"]["Enums"]["work_order_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          downtime_minutes?: number | null
          id?: string
          notes?: string | null
          odometer_km?: number | null
          opened_at?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          type?: Database["public"]["Enums"]["work_order_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          downtime_minutes?: number | null
          id?: string
          notes?: string | null
          odometer_km?: number | null
          opened_at?: string
          status?: Database["public"]["Enums"]["work_order_status"]
          type?: Database["public"]["Enums"]["work_order_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "ambulances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "dispatchable_ambulances"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      clinics_public: {
        Row: {
          address: string | null
          id: string | null
          lat: number | null
          lng: number | null
          name: string | null
          specialties: string[] | null
        }
        Insert: {
          address?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          specialties?: string[] | null
        }
        Update: {
          address?: string | null
          id?: string | null
          lat?: number | null
          lng?: number | null
          name?: string | null
          specialties?: string[] | null
        }
        Relationships: []
      }
      dispatchable_ambulances: {
        Row: {
          available_for_rent: boolean | null
          code: string | null
          created_at: string | null
          current_lat: number | null
          current_lng: number | null
          daily_rate: number | null
          driver_id: string | null
          home_base: string | null
          id: string | null
          last_ping_at: string | null
          status: Database["public"]["Enums"]["ambulance_status"] | null
          type: Database["public"]["Enums"]["ambulance_type"] | null
        }
        Insert: {
          available_for_rent?: boolean | null
          code?: string | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          daily_rate?: number | null
          driver_id?: string | null
          home_base?: string | null
          id?: string | null
          last_ping_at?: string | null
          status?: Database["public"]["Enums"]["ambulance_status"] | null
          type?: Database["public"]["Enums"]["ambulance_type"] | null
        }
        Update: {
          available_for_rent?: boolean | null
          code?: string | null
          created_at?: string | null
          current_lat?: number | null
          current_lng?: number | null
          daily_rate?: number | null
          driver_id?: string | null
          home_base?: string | null
          id?: string | null
          last_ping_at?: string | null
          status?: Database["public"]["Enums"]["ambulance_status"] | null
          type?: Database["public"]["Enums"]["ambulance_type"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_member_code: { Args: never; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_portal_role: {
        Args: {
          _role: Database["public"]["Enums"]["portal_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      haversine_m: {
        Args: { lat1: number; lat2: number; lng1: number; lng2: number }
        Returns: number
      }
      is_portal_staff: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
      portal_effective_config: {
        Args: { _subscriber: string }
        Returns: {
          key: string
          source: string
          updated_at: string
          value: Json
        }[]
      }
      profile_completeness: { Args: { _user_id: string }; Returns: number }
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
        | "superadmin"
        | "business_admin"
        | "home_nurse"
        | "caregiver"
      booking_status: "requested" | "confirmed" | "completed" | "cancelled"
      business_request_source:
        | "website"
        | "call_center"
        | "partner"
        | "referral"
        | "event"
        | "other"
      business_request_stage:
        | "request"
        | "contacted"
        | "demo"
        | "prospect"
        | "lead"
        | "negotiation"
        | "subscribed"
        | "rejected"
        | "archived"
      care_plan_type:
        | "general_nursing"
        | "wound_care"
        | "chronic_disease"
        | "post_op"
        | "palliative"
        | "elderly_care"
        | "maternal_newborn"
        | "medication_mgmt"
        | "physiotherapy"
      care_visit_status:
        | "scheduled"
        | "en_route"
        | "checked_in"
        | "in_progress"
        | "completed"
        | "missed"
        | "cancelled"
      clinical_role:
        | "registrar"
        | "physician"
        | "nurse"
        | "lab_tech"
        | "radiologist"
        | "pharmacist"
        | "coder"
        | "case_manager"
        | "cashier"
        | "tenant_admin"
        | "read_only"
      code_system_kind:
        | "diagnosis"
        | "procedure"
        | "billing"
        | "drg"
        | "drug"
        | "lab"
        | "coding_standard"
        | "lov"
      credential_kind:
        | "paramedic_license"
        | "driver_license"
        | "vehicle_registration"
        | "operating_permit"
        | "provider_license"
      defect_severity: "minor" | "major" | "critical"
      fitness_status: "fit" | "fit_with_restrictions" | "unfit" | "pending"
      incident_severity: "code_red" | "code_yellow" | "routine"
      incident_status:
        | "pending"
        | "assigned"
        | "en_route"
        | "on_scene"
        | "transporting"
        | "completed"
        | "cancelled"
      legal_locale: "en" | "ar"
      legal_slug:
        | "privacy-home"
        | "terms-of-service"
        | "hipaa"
        | "patient-rights"
      legal_status: "draft" | "in_review" | "published" | "archived"
      portal_role:
        | "superadmin"
        | "finance"
        | "call_center"
        | "developer"
        | "analyst"
      screening_order_status:
        | "booked"
        | "sample_collected"
        | "results_ready"
        | "certified"
        | "cancelled"
      telehealth_status:
        | "scheduled"
        | "live"
        | "completed"
        | "cancelled"
        | "no_show"
      visit_frequency:
        | "one_off"
        | "daily"
        | "weekly"
        | "biweekly"
        | "monthly"
        | "custom"
      work_order_status: "open" | "in_progress" | "closed" | "cancelled"
      work_order_type: "preventive" | "corrective"
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
        "superadmin",
        "business_admin",
        "home_nurse",
        "caregiver",
      ],
      booking_status: ["requested", "confirmed", "completed", "cancelled"],
      business_request_source: [
        "website",
        "call_center",
        "partner",
        "referral",
        "event",
        "other",
      ],
      business_request_stage: [
        "request",
        "contacted",
        "demo",
        "prospect",
        "lead",
        "negotiation",
        "subscribed",
        "rejected",
        "archived",
      ],
      care_plan_type: [
        "general_nursing",
        "wound_care",
        "chronic_disease",
        "post_op",
        "palliative",
        "elderly_care",
        "maternal_newborn",
        "medication_mgmt",
        "physiotherapy",
      ],
      care_visit_status: [
        "scheduled",
        "en_route",
        "checked_in",
        "in_progress",
        "completed",
        "missed",
        "cancelled",
      ],
      clinical_role: [
        "registrar",
        "physician",
        "nurse",
        "lab_tech",
        "radiologist",
        "pharmacist",
        "coder",
        "case_manager",
        "cashier",
        "tenant_admin",
        "read_only",
      ],
      code_system_kind: [
        "diagnosis",
        "procedure",
        "billing",
        "drg",
        "drug",
        "lab",
        "coding_standard",
        "lov",
      ],
      credential_kind: [
        "paramedic_license",
        "driver_license",
        "vehicle_registration",
        "operating_permit",
        "provider_license",
      ],
      defect_severity: ["minor", "major", "critical"],
      fitness_status: ["fit", "fit_with_restrictions", "unfit", "pending"],
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
      legal_locale: ["en", "ar"],
      legal_slug: [
        "privacy-home",
        "terms-of-service",
        "hipaa",
        "patient-rights",
      ],
      legal_status: ["draft", "in_review", "published", "archived"],
      portal_role: [
        "superadmin",
        "finance",
        "call_center",
        "developer",
        "analyst",
      ],
      screening_order_status: [
        "booked",
        "sample_collected",
        "results_ready",
        "certified",
        "cancelled",
      ],
      telehealth_status: [
        "scheduled",
        "live",
        "completed",
        "cancelled",
        "no_show",
      ],
      visit_frequency: [
        "one_off",
        "daily",
        "weekly",
        "biweekly",
        "monthly",
        "custom",
      ],
      work_order_status: ["open", "in_progress", "closed", "cancelled"],
      work_order_type: ["preventive", "corrective"],
    },
  },
} as const
