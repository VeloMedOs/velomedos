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
      admission_request: {
        Row: {
          admission_no: string | null
          admission_serial: string | null
          admission_source: string | null
          admitted_at: string | null
          anesthesia_fit: boolean | null
          anesthesia_fit_at: string | null
          bed_reserved_at: string | null
          beneficiary_id: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          class_id: string | null
          consent_captured_at: string | null
          consent_id: string | null
          coverage_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          discharge_stage: Database["public"]["Enums"]["discharge_stage"]
          discharged_at: string | null
          edd: string | null
          eligibility_ref: string | null
          encounter_id: string
          estimated_charges_minor: number | null
          id: string
          journey_state: string
          locked_at: string | null
          locked_by: string | null
          los_days: number | null
          mrp_id: string | null
          network_id: string | null
          pac_completed_at: string | null
          package_duration_days: number | null
          package_id: string | null
          paid_amount_minor: number
          payer_id: string | null
          policy_id: string | null
          reasons_triggered: Json
          request_type: Database["public"]["Enums"]["ip_request_type"]
          requested_deposit_minor: number
          room_type_entitled: string | null
          status: Database["public"]["Enums"]["admission_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_no?: string | null
          admission_serial?: string | null
          admission_source?: string | null
          admitted_at?: string | null
          anesthesia_fit?: boolean | null
          anesthesia_fit_at?: string | null
          bed_reserved_at?: string | null
          beneficiary_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          class_id?: string | null
          consent_captured_at?: string | null
          consent_id?: string | null
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discharge_stage?: Database["public"]["Enums"]["discharge_stage"]
          discharged_at?: string | null
          edd?: string | null
          eligibility_ref?: string | null
          encounter_id: string
          estimated_charges_minor?: number | null
          id?: string
          journey_state?: string
          locked_at?: string | null
          locked_by?: string | null
          los_days?: number | null
          mrp_id?: string | null
          network_id?: string | null
          pac_completed_at?: string | null
          package_duration_days?: number | null
          package_id?: string | null
          paid_amount_minor?: number
          payer_id?: string | null
          policy_id?: string | null
          reasons_triggered?: Json
          request_type?: Database["public"]["Enums"]["ip_request_type"]
          requested_deposit_minor?: number
          room_type_entitled?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_no?: string | null
          admission_serial?: string | null
          admission_source?: string | null
          admitted_at?: string | null
          anesthesia_fit?: boolean | null
          anesthesia_fit_at?: string | null
          bed_reserved_at?: string | null
          beneficiary_id?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          class_id?: string | null
          consent_captured_at?: string | null
          consent_id?: string | null
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discharge_stage?: Database["public"]["Enums"]["discharge_stage"]
          discharged_at?: string | null
          edd?: string | null
          eligibility_ref?: string | null
          encounter_id?: string
          estimated_charges_minor?: number | null
          id?: string
          journey_state?: string
          locked_at?: string | null
          locked_by?: string | null
          los_days?: number | null
          mrp_id?: string | null
          network_id?: string | null
          pac_completed_at?: string | null
          package_duration_days?: number | null
          package_id?: string | null
          paid_amount_minor?: number
          payer_id?: string | null
          policy_id?: string | null
          reasons_triggered?: Json
          request_type?: Database["public"]["Enums"]["ip_request_type"]
          requested_deposit_minor?: number
          room_type_entitled?: string | null
          status?: Database["public"]["Enums"]["admission_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admission_request_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "admission_request_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_eligibility_ref_fkey"
            columns: ["eligibility_ref"]
            isOneToOne: false
            referencedRelation: "visit_eligibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "admission_request_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "admission_request_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "network"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "ip_package"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admission_request_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
        ]
      }
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
      approval_rule: {
        Row: {
          active: boolean
          auto_decision: string | null
          class_id: string | null
          condition: Json
          created_at: string
          created_by: string | null
          default_valid_days: number | null
          id: string
          payer_id: string | null
          policy_id: string | null
          scope: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          auto_decision?: string | null
          class_id?: string | null
          condition?: Json
          created_at?: string
          created_by?: string | null
          default_valid_days?: number | null
          id?: string
          payer_id?: string | null
          policy_id?: string | null
          scope: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          auto_decision?: string | null
          class_id?: string | null
          condition?: Json
          created_at?: string
          created_by?: string | null
          default_valid_days?: number | null
          id?: string
          payer_id?: string | null
          policy_id?: string | null
          scope?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "approval_rule_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rule_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rule_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_rule_tenant_id_fkey"
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
      authorization_attachment: {
        Row: {
          authorization_request_id: string
          content_type: string | null
          created_at: string
          id: string
          kind: string
          size_bytes: number | null
          tenant_id: string
          title: string | null
          uploaded_by: string | null
          url: string
        }
        Insert: {
          authorization_request_id: string
          content_type?: string | null
          created_at?: string
          id?: string
          kind: string
          size_bytes?: number | null
          tenant_id: string
          title?: string | null
          uploaded_by?: string | null
          url: string
        }
        Update: {
          authorization_request_id?: string
          content_type?: string | null
          created_at?: string
          id?: string
          kind?: string
          size_bytes?: number | null
          tenant_id?: string
          title?: string | null
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorization_attachment_authorization_request_id_fkey"
            columns: ["authorization_request_id"]
            isOneToOne: false
            referencedRelation: "authorization_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_attachment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_communication: {
        Row: {
          author: string | null
          authorization_request_id: string
          body: string
          channel: string
          created_at: string
          direction: string
          id: string
          payload: Json | null
          read_at: string | null
          read_by: string | null
          tenant_id: string
        }
        Insert: {
          author?: string | null
          authorization_request_id: string
          body: string
          channel?: string
          created_at?: string
          direction: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          read_by?: string | null
          tenant_id: string
        }
        Update: {
          author?: string | null
          authorization_request_id?: string
          body?: string
          channel?: string
          created_at?: string
          direction?: string
          id?: string
          payload?: Json | null
          read_at?: string | null
          read_by?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "authorization_communication_authorization_request_id_fkey"
            columns: ["authorization_request_id"]
            isOneToOne: false
            referencedRelation: "authorization_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_communication_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_item: {
        Row: {
          approved_quantity: number | null
          authorization_request_id: string
          benefit_amount_minor: number | null
          charge_item_id: string | null
          created_at: string
          created_by: string | null
          currency: string | null
          decision: string | null
          drug_id: string | null
          id: string
          quantity: number
          quantity_code: string | null
          reason: string | null
          service_id: string | null
          source: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approved_quantity?: number | null
          authorization_request_id: string
          benefit_amount_minor?: number | null
          charge_item_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          decision?: string | null
          drug_id?: string | null
          id?: string
          quantity?: number
          quantity_code?: string | null
          reason?: string | null
          service_id?: string | null
          source: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approved_quantity?: number | null
          authorization_request_id?: string
          benefit_amount_minor?: number | null
          charge_item_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          decision?: string | null
          drug_id?: string | null
          id?: string
          quantity?: number
          quantity_code?: string | null
          reason?: string | null
          service_id?: string | null
          source?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorization_item_authorization_request_id_fkey"
            columns: ["authorization_request_id"]
            isOneToOne: false
            referencedRelation: "authorization_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_item_charge_item_id_fkey"
            columns: ["charge_item_id"]
            isOneToOne: false
            referencedRelation: "charge_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_item_charge_item_id_fkey"
            columns: ["charge_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_item_gate"
            referencedColumns: ["charge_item_id"]
          },
          {
            foreignKeyName: "authorization_item_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_item_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      authorization_request: {
        Row: {
          admission_request_id: string | null
          assigned_to: string | null
          auth_scope: Database["public"]["Enums"]["auth_scope"] | null
          beneficiary_id: string | null
          class_id: string | null
          coverage_id: string | null
          created_at: string
          created_by: string | null
          decision_at: string | null
          decision_reason: string | null
          eligibility_ref: string | null
          encounter_id: string | null
          gateway_message_id: string | null
          gateway_response: Json | null
          id: string
          locked_at: string | null
          locked_by: string | null
          notes: string | null
          payer_id: string | null
          policy_id: string | null
          preauth_ref: string | null
          priority: string
          reasons_triggered: Json
          requested_by: string | null
          status: Database["public"]["Enums"]["authorization_status"]
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          admission_request_id?: string | null
          assigned_to?: string | null
          auth_scope?: Database["public"]["Enums"]["auth_scope"] | null
          beneficiary_id?: string | null
          class_id?: string | null
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_at?: string | null
          decision_reason?: string | null
          eligibility_ref?: string | null
          encounter_id?: string | null
          gateway_message_id?: string | null
          gateway_response?: Json | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          payer_id?: string | null
          policy_id?: string | null
          preauth_ref?: string | null
          priority?: string
          reasons_triggered?: Json
          requested_by?: string | null
          status?: Database["public"]["Enums"]["authorization_status"]
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          admission_request_id?: string | null
          assigned_to?: string | null
          auth_scope?: Database["public"]["Enums"]["auth_scope"] | null
          beneficiary_id?: string | null
          class_id?: string | null
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          decision_at?: string | null
          decision_reason?: string | null
          eligibility_ref?: string | null
          encounter_id?: string | null
          gateway_message_id?: string | null
          gateway_response?: Json | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          notes?: string | null
          payer_id?: string | null
          policy_id?: string | null
          preauth_ref?: string | null
          priority?: string
          reasons_triggered?: Json
          requested_by?: string | null
          status?: Database["public"]["Enums"]["authorization_status"]
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "authorization_request_admission_request_id_fkey"
            columns: ["admission_request_id"]
            isOneToOne: false
            referencedRelation: "admission_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_request_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_request_eligibility_ref_fkey"
            columns: ["eligibility_ref"]
            isOneToOne: false
            referencedRelation: "visit_eligibility"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_request_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_request_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "authorization_request_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "authorization_request_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_request_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "authorization_request_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      bed_transfer: {
        Row: {
          admission_request_id: string
          authorization_request_id: string | null
          created_at: string
          created_by: string | null
          from_bed_type: string | null
          from_tier: number | null
          id: string
          reason: string | null
          requires_preauth: boolean
          status: Database["public"]["Enums"]["bed_transfer_status"]
          tenant_id: string
          to_bed_type: string
          to_tier: number | null
          transferred_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_request_id: string
          authorization_request_id?: string | null
          created_at?: string
          created_by?: string | null
          from_bed_type?: string | null
          from_tier?: number | null
          id?: string
          reason?: string | null
          requires_preauth?: boolean
          status?: Database["public"]["Enums"]["bed_transfer_status"]
          tenant_id: string
          to_bed_type: string
          to_tier?: number | null
          transferred_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_request_id?: string
          authorization_request_id?: string | null
          created_at?: string
          created_by?: string | null
          from_bed_type?: string | null
          from_tier?: number | null
          id?: string
          reason?: string | null
          requires_preauth?: boolean
          status?: Database["public"]["Enums"]["bed_transfer_status"]
          tenant_id?: string
          to_bed_type?: string
          to_tier?: number | null
          transferred_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bed_transfer_admission_request_id_fkey"
            columns: ["admission_request_id"]
            isOneToOne: false
            referencedRelation: "admission_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bed_transfer_authorization_request_id_fkey"
            columns: ["authorization_request_id"]
            isOneToOne: false
            referencedRelation: "authorization_request"
            referencedColumns: ["id"]
          },
        ]
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
          is_vip: boolean
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
          is_vip?: boolean
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
          is_vip?: boolean
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
          display_city: string | null
          display_consent: boolean
          display_consent_at: string | null
          display_consent_source: string | null
          display_name: string | null
          display_publicly: boolean
          display_type: string | null
          estimated_value_cents: number | null
          expected_seats: number | null
          featured_order: number | null
          fleet_size: number | null
          id: string
          legal_name: string | null
          logo_url: string | null
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
          display_city?: string | null
          display_consent?: boolean
          display_consent_at?: string | null
          display_consent_source?: string | null
          display_name?: string | null
          display_publicly?: boolean
          display_type?: string | null
          estimated_value_cents?: number | null
          expected_seats?: number | null
          featured_order?: number | null
          fleet_size?: number | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
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
          display_city?: string | null
          display_consent?: boolean
          display_consent_at?: string | null
          display_consent_source?: string | null
          display_name?: string | null
          display_publicly?: boolean
          display_type?: string | null
          estimated_value_cents?: number | null
          expected_seats?: number | null
          featured_order?: number | null
          fleet_size?: number | null
          id?: string
          legal_name?: string | null
          logo_url?: string | null
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
      cash_collection: {
        Row: {
          bank_ref: string | null
          bank_ref_attachment_url: string | null
          beneficiary_id: string | null
          cashier_id: string | null
          cheque_date: string | null
          cheque_no: string | null
          claim_id: string | null
          cn_applied_minor: number
          created_at: string
          created_by: string | null
          currency: string
          deposit_applied_minor: number
          encounter_id: string | null
          gross_minor: number
          id: string
          method: Database["public"]["Enums"]["cash_method"]
          net_collected_minor: number
          notes: string | null
          online_ref: string | null
          outstanding_after_minor: number
          pos_ref: string | null
          posted_at: string | null
          receipt_no: string | null
          rounding_minor: number
          session_id: string | null
          status: Database["public"]["Enums"]["cash_status"]
          tenant_id: string
          updated_at: string
          void_reason: string | null
          voided_at: string | null
          wallet_applied_minor: number
        }
        Insert: {
          bank_ref?: string | null
          bank_ref_attachment_url?: string | null
          beneficiary_id?: string | null
          cashier_id?: string | null
          cheque_date?: string | null
          cheque_no?: string | null
          claim_id?: string | null
          cn_applied_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_applied_minor?: number
          encounter_id?: string | null
          gross_minor?: number
          id?: string
          method: Database["public"]["Enums"]["cash_method"]
          net_collected_minor?: number
          notes?: string | null
          online_ref?: string | null
          outstanding_after_minor?: number
          pos_ref?: string | null
          posted_at?: string | null
          receipt_no?: string | null
          rounding_minor?: number
          session_id?: string | null
          status?: Database["public"]["Enums"]["cash_status"]
          tenant_id: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          wallet_applied_minor?: number
        }
        Update: {
          bank_ref?: string | null
          bank_ref_attachment_url?: string | null
          beneficiary_id?: string | null
          cashier_id?: string | null
          cheque_date?: string | null
          cheque_no?: string | null
          claim_id?: string | null
          cn_applied_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_applied_minor?: number
          encounter_id?: string | null
          gross_minor?: number
          id?: string
          method?: Database["public"]["Enums"]["cash_method"]
          net_collected_minor?: number
          notes?: string | null
          online_ref?: string | null
          outstanding_after_minor?: number
          pos_ref?: string | null
          posted_at?: string | null
          receipt_no?: string | null
          rounding_minor?: number
          session_id?: string | null
          status?: Database["public"]["Enums"]["cash_status"]
          tenant_id?: string
          updated_at?: string
          void_reason?: string | null
          voided_at?: string | null
          wallet_applied_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_collection_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_session"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_session: {
        Row: {
          cashier_id: string | null
          closed_at: string | null
          counted_minor: number | null
          created_at: string
          expected_minor: number
          id: string
          notes: string | null
          opened_at: string
          opening_float_minor: number
          session_no: string | null
          status: Database["public"]["Enums"]["cash_session_status"]
          tenant_id: string
          updated_at: string
          variance_minor: number | null
        }
        Insert: {
          cashier_id?: string | null
          closed_at?: string | null
          counted_minor?: number | null
          created_at?: string
          expected_minor?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float_minor?: number
          session_no?: string | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          tenant_id: string
          updated_at?: string
          variance_minor?: number | null
        }
        Update: {
          cashier_id?: string | null
          closed_at?: string | null
          counted_minor?: number | null
          created_at?: string
          expected_minor?: number
          id?: string
          notes?: string | null
          opened_at?: string
          opening_float_minor?: number
          session_no?: string | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          tenant_id?: string
          updated_at?: string
          variance_minor?: number | null
        }
        Relationships: []
      }
      cash_session_txn: {
        Row: {
          amount_minor: number
          cash_collection_id: string | null
          created_at: string
          direction: string
          id: string
          method: Database["public"]["Enums"]["cash_method"] | null
          refund_request_id: string | null
          session_id: string
          tenant_id: string
          txn_kind: string
        }
        Insert: {
          amount_minor?: number
          cash_collection_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          method?: Database["public"]["Enums"]["cash_method"] | null
          refund_request_id?: string | null
          session_id: string
          tenant_id: string
          txn_kind: string
        }
        Update: {
          amount_minor?: number
          cash_collection_id?: string | null
          created_at?: string
          direction?: string
          id?: string
          method?: Database["public"]["Enums"]["cash_method"] | null
          refund_request_id?: string | null
          session_id?: string
          tenant_id?: string
          txn_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_session_txn_cash_collection_id_fkey"
            columns: ["cash_collection_id"]
            isOneToOne: false
            referencedRelation: "cash_collection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_session_txn_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "cash_session"
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
      charge_item: {
        Row: {
          achi_code: string | null
          admission_request_id: string | null
          body_site: string | null
          cost_only: boolean
          created_at: string
          currency: string
          description: string | null
          discount_minor: number
          drug_id: string | null
          encounter_id: string
          factor: number
          gtin: string | null
          id: string
          in_network: boolean | null
          internal_code: string
          loinc_code: string | null
          mrid: string | null
          net_minor: number | null
          order_item_id: string
          order_item_table: string
          ordered_at: string
          ordered_by: string | null
          patient_share_minor: number
          payer_share_minor: number
          price_list_id: string | null
          pricing_mode: Database["public"]["Enums"]["charge_pricing_mode"]
          quantity: number
          quantity_code: string | null
          rule_trace: Json | null
          sbs_code: string | null
          service_id: string | null
          service_type: string | null
          source_type: string
          status: Database["public"]["Enums"]["charge_status"]
          tax_minor: number
          tenant_id: string
          unit_price_minor: number | null
          updated_at: string
        }
        Insert: {
          achi_code?: string | null
          admission_request_id?: string | null
          body_site?: string | null
          cost_only?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          discount_minor?: number
          drug_id?: string | null
          encounter_id: string
          factor?: number
          gtin?: string | null
          id?: string
          in_network?: boolean | null
          internal_code: string
          loinc_code?: string | null
          mrid?: string | null
          net_minor?: number | null
          order_item_id: string
          order_item_table: string
          ordered_at?: string
          ordered_by?: string | null
          patient_share_minor?: number
          payer_share_minor?: number
          price_list_id?: string | null
          pricing_mode: Database["public"]["Enums"]["charge_pricing_mode"]
          quantity?: number
          quantity_code?: string | null
          rule_trace?: Json | null
          sbs_code?: string | null
          service_id?: string | null
          service_type?: string | null
          source_type: string
          status?: Database["public"]["Enums"]["charge_status"]
          tax_minor?: number
          tenant_id: string
          unit_price_minor?: number | null
          updated_at?: string
        }
        Update: {
          achi_code?: string | null
          admission_request_id?: string | null
          body_site?: string | null
          cost_only?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          discount_minor?: number
          drug_id?: string | null
          encounter_id?: string
          factor?: number
          gtin?: string | null
          id?: string
          in_network?: boolean | null
          internal_code?: string
          loinc_code?: string | null
          mrid?: string | null
          net_minor?: number | null
          order_item_id?: string
          order_item_table?: string
          ordered_at?: string
          ordered_by?: string | null
          patient_share_minor?: number
          payer_share_minor?: number
          price_list_id?: string | null
          pricing_mode?: Database["public"]["Enums"]["charge_pricing_mode"]
          quantity?: number
          quantity_code?: string | null
          rule_trace?: Json | null
          sbs_code?: string | null
          service_id?: string | null
          service_type?: string | null
          source_type?: string
          status?: Database["public"]["Enums"]["charge_status"]
          tax_minor?: number
          tenant_id?: string
          unit_price_minor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_item_admission_request_id_fkey"
            columns: ["admission_request_id"]
            isOneToOne: false
            referencedRelation: "admission_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_item_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_item_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_item_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "charge_item_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "charge_item_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
        ]
      }
      chi_formulary: {
        Row: {
          active: boolean
          atc_code: string | null
          coverage_notes: string | null
          created_at: string
          created_by: string | null
          id: string
          indication_icd10am: string[]
          otc_flag: boolean
          pharmaceutical_form: string | null
          pharmaceutical_form_code_root: string | null
          prescribing_edits: string | null
          scientific_code_root: string
          scientific_name: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          atc_code?: string | null
          coverage_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          indication_icd10am?: string[]
          otc_flag?: boolean
          pharmaceutical_form?: string | null
          pharmaceutical_form_code_root?: string | null
          prescribing_edits?: string | null
          scientific_code_root: string
          scientific_name: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          atc_code?: string | null
          coverage_notes?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          indication_icd10am?: string[]
          otc_flag?: boolean
          pharmaceutical_form?: string | null
          pharmaceutical_form_code_root?: string | null
          prescribing_edits?: string | null
          scientific_code_root?: string
          scientific_name?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      chi_formulary_version: {
        Row: {
          active: boolean
          created_at: string
          id: string
          imported_at: string
          imported_by: string | null
          notes: string | null
          row_count: number
          tenant_id: string
          version_label: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number
          tenant_id: string
          version_label: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          row_count?: number
          tenant_id?: string
          version_label?: string
        }
        Relationships: []
      }
      claim: {
        Row: {
          adjudicated_at: string | null
          adjudication_outcome: string | null
          batch_id: string | null
          billing_model: string
          claim_sequence_no: string | null
          claim_subtype: string
          claim_type: string
          coverage_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          drg_assignment_id: string | null
          eligibility_checked_at: string | null
          eligibility_response: Json | null
          encounter_id: string
          esign_ref: string | null
          id: string
          idempotency_key: string | null
          invoice_no: string | null
          locked_at: string | null
          locked_by: string | null
          nphies_claim_id: string | null
          nphies_request: Json | null
          nphies_response: Json | null
          pricing_trace: Json | null
          provider_claim_no: string
          readiness_status:
            | Database["public"]["Enums"]["claim_readiness_status"]
            | null
          replaces_claim_id: string | null
          snapshot_locked_at: string | null
          status: string
          submitted_at: string | null
          tenant_id: string
          total_net_minor: number
          total_patient_share_minor: number
          total_payer_share_minor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adjudicated_at?: string | null
          adjudication_outcome?: string | null
          batch_id?: string | null
          billing_model: string
          claim_sequence_no?: string | null
          claim_subtype: string
          claim_type: string
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          drg_assignment_id?: string | null
          eligibility_checked_at?: string | null
          eligibility_response?: Json | null
          encounter_id: string
          esign_ref?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_no?: string | null
          locked_at?: string | null
          locked_by?: string | null
          nphies_claim_id?: string | null
          nphies_request?: Json | null
          nphies_response?: Json | null
          pricing_trace?: Json | null
          provider_claim_no: string
          readiness_status?:
            | Database["public"]["Enums"]["claim_readiness_status"]
            | null
          replaces_claim_id?: string | null
          snapshot_locked_at?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id: string
          total_net_minor?: number
          total_patient_share_minor?: number
          total_payer_share_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adjudicated_at?: string | null
          adjudication_outcome?: string | null
          batch_id?: string | null
          billing_model?: string
          claim_sequence_no?: string | null
          claim_subtype?: string
          claim_type?: string
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          drg_assignment_id?: string | null
          eligibility_checked_at?: string | null
          eligibility_response?: Json | null
          encounter_id?: string
          esign_ref?: string | null
          id?: string
          idempotency_key?: string | null
          invoice_no?: string | null
          locked_at?: string | null
          locked_by?: string | null
          nphies_claim_id?: string | null
          nphies_request?: Json | null
          nphies_response?: Json | null
          pricing_trace?: Json | null
          provider_claim_no?: string
          readiness_status?:
            | Database["public"]["Enums"]["claim_readiness_status"]
            | null
          replaces_claim_id?: string | null
          snapshot_locked_at?: string | null
          status?: string
          submitted_at?: string | null
          tenant_id?: string
          total_net_minor?: number
          total_patient_share_minor?: number
          total_payer_share_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "claim_batch"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_drg_assignment_id_fkey"
            columns: ["drg_assignment_id"]
            isOneToOne: false
            referencedRelation: "drg_assignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "claim_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "claim_replaces_claim_id_fkey"
            columns: ["replaces_claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_batch: {
        Row: {
          batch_no: string
          cancel_reason: string | null
          cancelled_at: string | null
          claim_count: number
          cover_letter_url: string | null
          created_at: string
          created_by: string | null
          esign_ref: string | null
          id: string
          integration_type: Database["public"]["Enums"]["batch_integration_type"]
          notes: string | null
          payer_id: string
          status: Database["public"]["Enums"]["batch_status"]
          submitted_at: string | null
          tenant_id: string
          total_amount_minor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          batch_no: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          claim_count?: number
          cover_letter_url?: string | null
          created_at?: string
          created_by?: string | null
          esign_ref?: string | null
          id?: string
          integration_type: Database["public"]["Enums"]["batch_integration_type"]
          notes?: string | null
          payer_id: string
          status?: Database["public"]["Enums"]["batch_status"]
          submitted_at?: string | null
          tenant_id: string
          total_amount_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          batch_no?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          claim_count?: number
          cover_letter_url?: string | null
          created_at?: string
          created_by?: string | null
          esign_ref?: string | null
          id?: string
          integration_type?: Database["public"]["Enums"]["batch_integration_type"]
          notes?: string | null
          payer_id?: string
          status?: Database["public"]["Enums"]["batch_status"]
          submitted_at?: string | null
          tenant_id?: string
          total_amount_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_batch_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_care_team: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          is_primary: boolean | null
          practitioner_user_id: string | null
          role: string | null
          sequence_no: number
          speciality: string | null
          tenant_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          practitioner_user_id?: string | null
          role?: string | null
          sequence_no: number
          speciality?: string | null
          tenant_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          is_primary?: boolean | null
          practitioner_user_id?: string | null
          role?: string | null
          sequence_no?: number
          speciality?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_care_team_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_diagnosis: {
        Row: {
          claim_id: string
          code: string
          code_system: string | null
          created_at: string
          display: string | null
          id: string
          present_on_admission: string | null
          role: string | null
          sequence_no: number
          tenant_id: string
        }
        Insert: {
          claim_id: string
          code: string
          code_system?: string | null
          created_at?: string
          display?: string | null
          id?: string
          present_on_admission?: string | null
          role?: string | null
          sequence_no: number
          tenant_id: string
        }
        Update: {
          claim_id?: string
          code?: string
          code_system?: string | null
          created_at?: string
          display?: string | null
          id?: string
          present_on_admission?: string | null
          role?: string | null
          sequence_no?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_diagnosis_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_item: {
        Row: {
          adjudicated_net_minor: number | null
          adjudicated_patient_share_minor: number | null
          adjudicated_payer_share_minor: number | null
          adjudication_reason: string | null
          body_site: string | null
          charge_item_id: string | null
          claim_id: string
          cost_only: boolean
          created_at: string
          description: string | null
          discount_minor: number
          factor: number
          id: string
          is_package: boolean
          net_minor: number
          non_standard_code: string | null
          patient_share_minor: number
          payer_share_minor: number
          quantity: number
          sequence_no: number
          service_code: string | null
          service_type: string | null
          sub_site: string | null
          tax_minor: number
          tenant_id: string
          unit_price_minor: number
        }
        Insert: {
          adjudicated_net_minor?: number | null
          adjudicated_patient_share_minor?: number | null
          adjudicated_payer_share_minor?: number | null
          adjudication_reason?: string | null
          body_site?: string | null
          charge_item_id?: string | null
          claim_id: string
          cost_only?: boolean
          created_at?: string
          description?: string | null
          discount_minor?: number
          factor?: number
          id?: string
          is_package?: boolean
          net_minor?: number
          non_standard_code?: string | null
          patient_share_minor?: number
          payer_share_minor?: number
          quantity?: number
          sequence_no: number
          service_code?: string | null
          service_type?: string | null
          sub_site?: string | null
          tax_minor?: number
          tenant_id: string
          unit_price_minor?: number
        }
        Update: {
          adjudicated_net_minor?: number | null
          adjudicated_patient_share_minor?: number | null
          adjudicated_payer_share_minor?: number | null
          adjudication_reason?: string | null
          body_site?: string | null
          charge_item_id?: string | null
          claim_id?: string
          cost_only?: boolean
          created_at?: string
          description?: string | null
          discount_minor?: number
          factor?: number
          id?: string
          is_package?: boolean
          net_minor?: number
          non_standard_code?: string | null
          patient_share_minor?: number
          payer_share_minor?: number
          quantity?: number
          sequence_no?: number
          service_code?: string | null
          service_type?: string | null
          sub_site?: string | null
          tax_minor?: number
          tenant_id?: string
          unit_price_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "claim_item_charge_item_id_fkey"
            columns: ["charge_item_id"]
            isOneToOne: false
            referencedRelation: "charge_item"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_item_charge_item_id_fkey"
            columns: ["charge_item_id"]
            isOneToOne: false
            referencedRelation: "v_order_item_gate"
            referencedColumns: ["charge_item_id"]
          },
          {
            foreignKeyName: "claim_item_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_item_link: {
        Row: {
          claim_id: string
          created_at: string
          id: string
          item_sequence_no: number
          link_type: string
          target_sequence_no: number
          tenant_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          id?: string
          item_sequence_no: number
          link_type: string
          target_sequence_no: number
          tenant_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          id?: string
          item_sequence_no?: number
          link_type?: string
          target_sequence_no?: number
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_item_link_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_lifecycle_event: {
        Row: {
          actor_id: string | null
          claim_id: string
          created_at: string
          from_status: string | null
          id: string
          payload: Json | null
          reason: string | null
          tenant_id: string
          to_status: string
        }
        Insert: {
          actor_id?: string | null
          claim_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          payload?: Json | null
          reason?: string | null
          tenant_id: string
          to_status: string
        }
        Update: {
          actor_id?: string | null
          claim_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          payload?: Json | null
          reason?: string | null
          tenant_id?: string
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_lifecycle_event_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_scrub_result: {
        Row: {
          actor_id: string | null
          blocker_count: number
          blockers: Json
          claim_id: string
          hash: string | null
          id: string
          run_at: string
          tenant_id: string
          warning_count: number
          warnings: Json
        }
        Insert: {
          actor_id?: string | null
          blocker_count?: number
          blockers?: Json
          claim_id: string
          hash?: string | null
          id?: string
          run_at?: string
          tenant_id: string
          warning_count?: number
          warnings?: Json
        }
        Update: {
          actor_id?: string | null
          blocker_count?: number
          blockers?: Json
          claim_id?: string
          hash?: string | null
          id?: string
          run_at?: string
          tenant_id?: string
          warning_count?: number
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "claim_scrub_result_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_submission_attempt: {
        Row: {
          actor_id: string | null
          attempt_no: number
          claim_id: string
          created_at: string
          error: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          idempotency_key: string | null
          outcome: string
          request_body: Json | null
          response_body: Json | null
          sandbox: boolean
          started_at: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          attempt_no: number
          claim_id: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          outcome: string
          request_body?: Json | null
          response_body?: Json | null
          sandbox?: boolean
          started_at?: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          attempt_no?: number
          claim_id?: string
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string | null
          outcome?: string
          request_body?: Json | null
          response_body?: Json | null
          sandbox?: boolean
          started_at?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_submission_attempt_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_supporting_info: {
        Row: {
          category: string
          claim_id: string
          code: string | null
          code_system: string | null
          created_at: string
          id: string
          sequence_no: number
          source_id: string | null
          source_table: string | null
          tenant_id: string
          timing: string | null
          unit: string | null
          value: string | null
        }
        Insert: {
          category: string
          claim_id: string
          code?: string | null
          code_system?: string | null
          created_at?: string
          id?: string
          sequence_no: number
          source_id?: string | null
          source_table?: string | null
          tenant_id: string
          timing?: string | null
          unit?: string | null
          value?: string | null
        }
        Update: {
          category?: string
          claim_id?: string
          code?: string | null
          code_system?: string | null
          created_at?: string
          id?: string
          sequence_no?: number
          source_id?: string | null
          source_table?: string | null
          tenant_id?: string
          timing?: string | null
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_supporting_info_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
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
          origin_encounter_id: string | null
          patient_id: string
          reason: string | null
          slot_at: string
          source: Database["public"]["Enums"]["visit_source"] | null
          status: Database["public"]["Enums"]["booking_status"]
        }
        Insert: {
          clinic_id: string
          created_at?: string
          id?: string
          kind?: string
          origin_encounter_id?: string | null
          patient_id: string
          reason?: string | null
          slot_at: string
          source?: Database["public"]["Enums"]["visit_source"] | null
          status?: Database["public"]["Enums"]["booking_status"]
        }
        Update: {
          clinic_id?: string
          created_at?: string
          id?: string
          kind?: string
          origin_encounter_id?: string | null
          patient_id?: string
          reason?: string | null
          slot_at?: string
          source?: Database["public"]["Enums"]["visit_source"] | null
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
          {
            foreignKeyName: "clinic_bookings_origin_encounter_id_fkey"
            columns: ["origin_encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinic_bookings_origin_encounter_id_fkey"
            columns: ["origin_encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "clinic_bookings_origin_encounter_id_fkey"
            columns: ["origin_encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
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
      clinical_coding: {
        Row: {
          coded_at: string | null
          coder_id: string | null
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          notes: string | null
          principal_diagnosis_id: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          coded_at?: string | null
          coder_id?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          notes?: string | null
          principal_diagnosis_id?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          coded_at?: string | null
          coder_id?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          notes?: string | null
          principal_diagnosis_id?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_coding_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_coding_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "clinical_coding_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "clinical_coding_principal_diagnosis_id_fkey"
            columns: ["principal_diagnosis_id"]
            isOneToOne: false
            referencedRelation: "encounter_diagnosis"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_form_instance: {
        Row: {
          addenda: Json
          admission_request_id: string | null
          answers: Json
          assigned_role: string | null
          cosign_pending_for: string | null
          cosigned_at: string | null
          cosigned_by: string | null
          created_at: string
          due_at: string | null
          encounter_id: string | null
          form_def_id: string
          id: string
          order_item_id: string | null
          order_item_table: string | null
          paste_ranges: Json
          status: string
          submitted_at: string | null
          submitted_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          addenda?: Json
          admission_request_id?: string | null
          answers?: Json
          assigned_role?: string | null
          cosign_pending_for?: string | null
          cosigned_at?: string | null
          cosigned_by?: string | null
          created_at?: string
          due_at?: string | null
          encounter_id?: string | null
          form_def_id: string
          id?: string
          order_item_id?: string | null
          order_item_table?: string | null
          paste_ranges?: Json
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          addenda?: Json
          admission_request_id?: string | null
          answers?: Json
          assigned_role?: string | null
          cosign_pending_for?: string | null
          cosigned_at?: string | null
          cosigned_by?: string | null
          created_at?: string
          due_at?: string | null
          encounter_id?: string | null
          form_def_id?: string
          id?: string
          order_item_id?: string | null
          order_item_table?: string | null
          paste_ranges?: Json
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_form_instance_form_def_id_fkey"
            columns: ["form_def_id"]
            isOneToOne: false
            referencedRelation: "form_def"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_supporting_info: {
        Row: {
          beneficiary_id: string
          category: string
          code_system: string | null
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          recorded_at: string
          recorded_by: string | null
          sequence: number | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          value_attachment_url: string | null
          value_code: string | null
          value_text: string | null
        }
        Insert: {
          beneficiary_id: string
          category: string
          code_system?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          sequence?: number | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          value_attachment_url?: string | null
          value_code?: string | null
          value_text?: string | null
        }
        Update: {
          beneficiary_id?: string
          category?: string
          code_system?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          recorded_at?: string
          recorded_by?: string | null
          sequence?: number | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          value_attachment_url?: string | null
          value_code?: string | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_supporting_info_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_supporting_info_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "clinical_supporting_info_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_supporting_info_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "clinical_supporting_info_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "clinical_supporting_info_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
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
          nphies_provider_id: string | null
          phone: string | null
          specialties: string[] | null
          tenant_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          nphies_provider_id?: string | null
          phone?: string | null
          specialties?: string[] | null
          tenant_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          nphies_provider_id?: string | null
          phone?: string | null
          specialties?: string[] | null
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinics_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      contract_change_request: {
        Row: {
          after: Json
          applied_at: string | null
          approved_at: string | null
          approved_by: string | null
          before: Json | null
          created_at: string
          created_by: string | null
          effective_date: string | null
          id: string
          reason: string | null
          requested_by: string | null
          status: string
          target_id: string
          target_table: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          after: Json
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          before?: Json | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          reason?: string | null
          requested_by?: string | null
          status?: string
          target_id: string
          target_table: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          after?: Json
          applied_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          before?: Json | null
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          id?: string
          reason?: string | null
          requested_by?: string | null
          status?: string
          target_id?: string
          target_table?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_change_request_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
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
          tpa_id: string | null
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
          tpa_id?: string | null
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
          tpa_id?: string | null
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
            foreignKeyName: "coverage_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "coverage_insurance_plan_fk"
            columns: ["insurance_plan_id"]
            isOneToOne: false
            referencedRelation: "insurance_plan"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_network_fk"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "network"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_payer_fk"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_policy_fk"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coverage_tpa_fk"
            columns: ["tpa_id"]
            isOneToOne: false
            referencedRelation: "tpa"
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
      credit_note: {
        Row: {
          amount_minor: number
          beneficiary_id: string
          cn_no: string | null
          created_at: string
          created_by: string | null
          encounter_id: string | null
          erp_posted_at: string | null
          erp_posting_ref: string | null
          id: string
          reason: string
          source_charge_ref: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          wallet_txn_id: string | null
        }
        Insert: {
          amount_minor: number
          beneficiary_id: string
          cn_no?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string | null
          erp_posted_at?: string | null
          erp_posting_ref?: string | null
          id?: string
          reason: string
          source_charge_ref?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          wallet_txn_id?: string | null
        }
        Update: {
          amount_minor?: number
          beneficiary_id?: string
          cn_no?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string | null
          erp_posted_at?: string | null
          erp_posting_ref?: string | null
          id?: string
          reason?: string
          source_charge_ref?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          wallet_txn_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "credit_note_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "credit_note_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_note_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "credit_note_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "credit_note_wallet_txn_id_fkey"
            columns: ["wallet_txn_id"]
            isOneToOne: false
            referencedRelation: "wallet_txn"
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
      demo_credential_secrets: {
        Row: {
          email: string
          password: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          email: string
          password: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          email?: string
          password?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demo_credential_secrets_email_fkey"
            columns: ["email"]
            isOneToOne: true
            referencedRelation: "demo_credentials"
            referencedColumns: ["email"]
          },
        ]
      }
      demo_credentials: {
        Row: {
          applied_at: string | null
          clinical_role: string | null
          email: string
          lands_on: string
          role_label: string
          sort_order: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          applied_at?: string | null
          clinical_role?: string | null
          email: string
          lands_on?: string
          role_label: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          applied_at?: string | null
          clinical_role?: string | null
          email?: string
          lands_on?: string
          role_label?: string
          sort_order?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      denial_case: {
        Row: {
          assigned_to: string | null
          claim_id: string
          claim_sequence_no: string
          created_at: string
          created_by: string | null
          denial_category: Database["public"]["Enums"]["denial_category"] | null
          denial_codes: Json
          disposed_at: string | null
          disposed_by: string | null
          disposition_amount_minor: number
          disposition_note: string | null
          finance_disposition: Database["public"]["Enums"]["denial_finance_disposition"]
          followup_no: number
          id: string
          item_level_reasons: Json
          last_comm_at: string | null
          replaces_claim_id: string | null
          status: Database["public"]["Enums"]["denial_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          assigned_to?: string | null
          claim_id: string
          claim_sequence_no: string
          created_at?: string
          created_by?: string | null
          denial_category?:
            | Database["public"]["Enums"]["denial_category"]
            | null
          denial_codes?: Json
          disposed_at?: string | null
          disposed_by?: string | null
          disposition_amount_minor?: number
          disposition_note?: string | null
          finance_disposition?: Database["public"]["Enums"]["denial_finance_disposition"]
          followup_no?: number
          id?: string
          item_level_reasons?: Json
          last_comm_at?: string | null
          replaces_claim_id?: string | null
          status?: Database["public"]["Enums"]["denial_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          assigned_to?: string | null
          claim_id?: string
          claim_sequence_no?: string
          created_at?: string
          created_by?: string | null
          denial_category?:
            | Database["public"]["Enums"]["denial_category"]
            | null
          denial_codes?: Json
          disposed_at?: string | null
          disposed_by?: string | null
          disposition_amount_minor?: number
          disposition_note?: string | null
          finance_disposition?: Database["public"]["Enums"]["denial_finance_disposition"]
          followup_no?: number
          id?: string
          item_level_reasons?: Json
          last_comm_at?: string | null
          replaces_claim_id?: string | null
          status?: Database["public"]["Enums"]["denial_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "denial_case_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "denial_case_replaces_claim_id_fkey"
            columns: ["replaces_claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
        ]
      }
      denial_communication: {
        Row: {
          actor_id: string | null
          attachments: Json
          body: string
          channel: string | null
          created_at: string
          denial_case_id: string
          direction: string
          id: string
          occurred_at: string
          read_at: string | null
          read_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          actor_id?: string | null
          attachments?: Json
          body: string
          channel?: string | null
          created_at?: string
          denial_case_id: string
          direction: string
          id?: string
          occurred_at?: string
          read_at?: string | null
          read_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          actor_id?: string | null
          attachments?: Json
          body?: string
          channel?: string | null
          created_at?: string
          denial_case_id?: string
          direction?: string
          id?: string
          occurred_at?: string
          read_at?: string | null
          read_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "denial_communication_denial_case_id_fkey"
            columns: ["denial_case_id"]
            isOneToOne: false
            referencedRelation: "denial_case"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit: {
        Row: {
          admission_request_id: string | null
          amount_minor: number
          applied_to_bill_id: string | null
          available_minor: number
          beneficiary_id: string | null
          collected_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          deposit_no: string | null
          deposit_type: Database["public"]["Enums"]["deposit_type"]
          encounter_id: string | null
          erp_posted_at: string | null
          erp_posting_ref: string | null
          id: string
          is_caution: boolean
          method: Database["public"]["Enums"]["deposit_method"]
          notes: string | null
          pos_reference: string | null
          received_at: string | null
          received_by: string | null
          reference_no: string | null
          requested_minor: number
          scope_ref_id: string | null
          status: Database["public"]["Enums"]["deposit_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_request_id?: string | null
          amount_minor?: number
          applied_to_bill_id?: string | null
          available_minor?: number
          beneficiary_id?: string | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_no?: string | null
          deposit_type?: Database["public"]["Enums"]["deposit_type"]
          encounter_id?: string | null
          erp_posted_at?: string | null
          erp_posting_ref?: string | null
          id?: string
          is_caution?: boolean
          method?: Database["public"]["Enums"]["deposit_method"]
          notes?: string | null
          pos_reference?: string | null
          received_at?: string | null
          received_by?: string | null
          reference_no?: string | null
          requested_minor?: number
          scope_ref_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_request_id?: string | null
          amount_minor?: number
          applied_to_bill_id?: string | null
          available_minor?: number
          beneficiary_id?: string | null
          collected_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          deposit_no?: string | null
          deposit_type?: Database["public"]["Enums"]["deposit_type"]
          encounter_id?: string | null
          erp_posted_at?: string | null
          erp_posting_ref?: string | null
          id?: string
          is_caution?: boolean
          method?: Database["public"]["Enums"]["deposit_method"]
          notes?: string | null
          pos_reference?: string | null
          received_at?: string | null
          received_by?: string | null
          reference_no?: string | null
          requested_minor?: number
          scope_ref_id?: string | null
          status?: Database["public"]["Enums"]["deposit_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deposit_admission_request_id_fkey"
            columns: ["admission_request_id"]
            isOneToOne: false
            referencedRelation: "admission_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "deposit_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "deposit_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      deposit_attachment: {
        Row: {
          created_at: string
          deposit_id: string
          id: string
          kind: string
          note: string | null
          tenant_id: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          deposit_id: string
          id?: string
          kind: string
          note?: string | null
          tenant_id: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          deposit_id?: string
          id?: string
          kind?: string
          note?: string | null
          tenant_id?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_attachment_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposit"
            referencedColumns: ["id"]
          },
        ]
      }
      deposit_transaction: {
        Row: {
          amount_minor: number
          applied_to_claim_id: string | null
          approved_by: string | null
          cash_collection_id: string | null
          created_at: string
          created_by: string | null
          credit_note_id: string | null
          deposit_id: string
          erp_posted_at: string | null
          erp_posting_ref: string | null
          id: string
          method: Database["public"]["Enums"]["deposit_method"] | null
          reason: string | null
          receipt_no: string | null
          refund_request_id: string | null
          tenant_id: string
          transferred_to_deposit_id: string | null
          txn_type: string
        }
        Insert: {
          amount_minor: number
          applied_to_claim_id?: string | null
          approved_by?: string | null
          cash_collection_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          deposit_id: string
          erp_posted_at?: string | null
          erp_posting_ref?: string | null
          id?: string
          method?: Database["public"]["Enums"]["deposit_method"] | null
          reason?: string | null
          receipt_no?: string | null
          refund_request_id?: string | null
          tenant_id: string
          transferred_to_deposit_id?: string | null
          txn_type: string
        }
        Update: {
          amount_minor?: number
          applied_to_claim_id?: string | null
          approved_by?: string | null
          cash_collection_id?: string | null
          created_at?: string
          created_by?: string | null
          credit_note_id?: string | null
          deposit_id?: string
          erp_posted_at?: string | null
          erp_posting_ref?: string | null
          id?: string
          method?: Database["public"]["Enums"]["deposit_method"] | null
          reason?: string | null
          receipt_no?: string | null
          refund_request_id?: string | null
          tenant_id?: string
          transferred_to_deposit_id?: string | null
          txn_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "deposit_transaction_cash_collection_id_fkey"
            columns: ["cash_collection_id"]
            isOneToOne: false
            referencedRelation: "cash_collection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_transaction_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deposit_transaction_transferred_to_deposit_id_fkey"
            columns: ["transferred_to_deposit_id"]
            isOneToOne: false
            referencedRelation: "deposit"
            referencedColumns: ["id"]
          },
        ]
      }
      drg: {
        Row: {
          active: boolean
          adrg: string | null
          avg_los: number | null
          code_system_id: string
          created_at: string
          drg_code: string
          drg_name: string | null
          high_trim_los: number | null
          id: string
          low_trim_los: number | null
          mdc: string | null
          partition: string | null
          relative_weight: number
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          adrg?: string | null
          avg_los?: number | null
          code_system_id: string
          created_at?: string
          drg_code: string
          drg_name?: string | null
          high_trim_los?: number | null
          id?: string
          low_trim_los?: number | null
          mdc?: string | null
          partition?: string | null
          relative_weight: number
          updated_at?: string
          version: string
        }
        Update: {
          active?: boolean
          adrg?: string | null
          avg_los?: number | null
          code_system_id?: string
          created_at?: string
          drg_code?: string
          drg_name?: string | null
          high_trim_los?: number | null
          id?: string
          low_trim_los?: number | null
          mdc?: string | null
          partition?: string | null
          relative_weight?: number
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "drg_code_system_id_fkey"
            columns: ["code_system_id"]
            isOneToOne: false
            referencedRelation: "code_system"
            referencedColumns: ["id"]
          },
        ]
      }
      drg_assignment: {
        Row: {
          adrg: string | null
          assigned_at: string
          complexity_score: number | null
          created_at: string
          created_by: string | null
          drg_code: string
          drg_id: string | null
          drg_version: string
          encounter_id: string
          grouper_name: string | null
          grouper_request: Json | null
          grouper_response: Json | null
          grouper_version: string | null
          id: string
          mdc: string | null
          partition: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adrg?: string | null
          assigned_at?: string
          complexity_score?: number | null
          created_at?: string
          created_by?: string | null
          drg_code: string
          drg_id?: string | null
          drg_version: string
          encounter_id: string
          grouper_name?: string | null
          grouper_request?: Json | null
          grouper_response?: Json | null
          grouper_version?: string | null
          id?: string
          mdc?: string | null
          partition?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adrg?: string | null
          assigned_at?: string
          complexity_score?: number | null
          created_at?: string
          created_by?: string | null
          drg_code?: string
          drg_id?: string | null
          drg_version?: string
          encounter_id?: string
          grouper_name?: string | null
          grouper_request?: Json | null
          grouper_response?: Json | null
          grouper_version?: string | null
          id?: string
          mdc?: string | null
          partition?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drg_assignment_drg_id_fkey"
            columns: ["drg_id"]
            isOneToOne: false
            referencedRelation: "drg"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drg_assignment_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drg_assignment_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "drg_assignment_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      drg_base_rate: {
        Row: {
          base_rate_minor: number
          created_at: string
          created_by: string | null
          currency: string
          drg_version: string
          effective_from: string | null
          effective_to: string | null
          id: string
          network_id: string | null
          payer_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_rate_minor: number
          created_at?: string
          created_by?: string | null
          currency?: string
          drg_version: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          network_id?: string | null
          payer_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_rate_minor?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          drg_version?: string
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          network_id?: string | null
          payer_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drg_base_rate_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "network"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drg_base_rate_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drg_base_rate_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      drg_price_adjustment: {
        Row: {
          active: boolean
          adj_type: string
          created_at: string
          created_by: string | null
          drg_version: string | null
          formula: Json | null
          id: string
          marginal_rate: number | null
          payer_id: string | null
          per_diem_minor: number | null
          priority: number
          tenant_id: string
          threshold: number | null
          trim_basis: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          adj_type: string
          created_at?: string
          created_by?: string | null
          drg_version?: string | null
          formula?: Json | null
          id?: string
          marginal_rate?: number | null
          payer_id?: string | null
          per_diem_minor?: number | null
          priority?: number
          tenant_id: string
          threshold?: number | null
          trim_basis?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          adj_type?: string
          created_at?: string
          created_by?: string | null
          drg_version?: string | null
          formula?: Json | null
          id?: string
          marginal_rate?: number | null
          payer_id?: string | null
          per_diem_minor?: number | null
          priority?: number
          tenant_id?: string
          threshold?: number | null
          trim_basis?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drg_price_adjustment_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drg_price_adjustment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      drug_indication_map: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          generic_name: string
          icd10_code: string
          icd10_description: string | null
          id: string
          internal_code: string | null
          severity: string
          sfda_sci_code: string | null
          source: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          generic_name: string
          icd10_code: string
          icd10_description?: string | null
          id?: string
          internal_code?: string | null
          severity?: string
          sfda_sci_code?: string | null
          source?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          generic_name?: string
          icd10_code?: string
          icd10_description?: string | null
          id?: string
          internal_code?: string | null
          severity?: string
          sfda_sci_code?: string | null
          source?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      drug_master: {
        Row: {
          active: boolean
          atc_code: string | null
          created_at: string
          created_by: string | null
          form: string | null
          generic_name: string
          gtin: string | null
          id: string
          internal_code: string
          mrid: string | null
          preauth_required: boolean
          route: string | null
          sfda_sci_code: string | null
          strength: string | null
          sub_category: string | null
          tenant_id: string
          trade_name: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          atc_code?: string | null
          created_at?: string
          created_by?: string | null
          form?: string | null
          generic_name: string
          gtin?: string | null
          id?: string
          internal_code: string
          mrid?: string | null
          preauth_required?: boolean
          route?: string | null
          sfda_sci_code?: string | null
          strength?: string | null
          sub_category?: string | null
          tenant_id: string
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          atc_code?: string | null
          created_at?: string
          created_by?: string | null
          form?: string | null
          generic_name?: string
          gtin?: string | null
          id?: string
          internal_code?: string
          mrid?: string | null
          preauth_required?: boolean
          route?: string | null
          sfda_sci_code?: string | null
          strength?: string | null
          sub_category?: string | null
          tenant_id?: string
          trade_name?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drug_master_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      electrophysiology_order: {
        Row: {
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          notes: string | null
          ordered_at: string
          ordered_by: string | null
          preauth_ref: string | null
          preauth_required: boolean
          preauth_status: Database["public"]["Enums"]["preauth_status"] | null
          priority: string | null
          status: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "electrophysiology_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "electrophysiology_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "electrophysiology_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      eligibility_exception: {
        Row: {
          birth_certificate_url: string | null
          created_at: string
          created_by: string | null
          ctas_level: number | null
          exception_type: string
          id: string
          mother_coverage_id: string | null
          mother_membership_no: string | null
          notes: string | null
          referral_date: string | null
          referral_letter_url: string | null
          referral_ref_no: string | null
          referred_provider: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          validity_from: string | null
          validity_to: string | null
          visit_eligibility_id: string
        }
        Insert: {
          birth_certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          ctas_level?: number | null
          exception_type: string
          id?: string
          mother_coverage_id?: string | null
          mother_membership_no?: string | null
          notes?: string | null
          referral_date?: string | null
          referral_letter_url?: string | null
          referral_ref_no?: string | null
          referred_provider?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          validity_from?: string | null
          validity_to?: string | null
          visit_eligibility_id: string
        }
        Update: {
          birth_certificate_url?: string | null
          created_at?: string
          created_by?: string | null
          ctas_level?: number | null
          exception_type?: string
          id?: string
          mother_coverage_id?: string | null
          mother_membership_no?: string | null
          notes?: string | null
          referral_date?: string | null
          referral_letter_url?: string | null
          referral_ref_no?: string | null
          referred_provider?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          validity_from?: string | null
          validity_to?: string | null
          visit_eligibility_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_exception_mother_coverage_id_fkey"
            columns: ["mother_coverage_id"]
            isOneToOne: false
            referencedRelation: "coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exception_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_exception_visit_eligibility_id_fkey"
            columns: ["visit_eligibility_id"]
            isOneToOne: false
            referencedRelation: "visit_eligibility"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter: {
        Row: {
          beneficiary_id: string
          cause_of_death: string | null
          chief_complaint: string | null
          class: string
          coverage_id: string | null
          created_at: string
          created_by: string | null
          dnr_flag: boolean
          encounter_number: string
          episode_of_care_id: string | null
          id: string
          isolation_precaution: string | null
          journey_state: string
          location_id: string | null
          mechanical_ventilation_hours: number | null
          period_end: string | null
          period_start: string
          priority: string | null
          reason_text: string | null
          reimbursement_model: string
          same_day: boolean | null
          separation_mode: string | null
          service_type: string | null
          status: string
          tenant_id: string
          type: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          beneficiary_id: string
          cause_of_death?: string | null
          chief_complaint?: string | null
          class: string
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          dnr_flag?: boolean
          encounter_number: string
          episode_of_care_id?: string | null
          id?: string
          isolation_precaution?: string | null
          journey_state?: string
          location_id?: string | null
          mechanical_ventilation_hours?: number | null
          period_end?: string | null
          period_start?: string
          priority?: string | null
          reason_text?: string | null
          reimbursement_model?: string
          same_day?: boolean | null
          separation_mode?: string | null
          service_type?: string | null
          status?: string
          tenant_id: string
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          beneficiary_id?: string
          cause_of_death?: string | null
          chief_complaint?: string | null
          class?: string
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          dnr_flag?: boolean
          encounter_number?: string
          episode_of_care_id?: string | null
          id?: string
          isolation_precaution?: string | null
          journey_state?: string
          location_id?: string | null
          mechanical_ventilation_hours?: number | null
          period_end?: string | null
          period_start?: string
          priority?: string | null
          reason_text?: string | null
          reimbursement_model?: string
          same_day?: boolean | null
          separation_mode?: string | null
          service_type?: string | null
          status?: string
          tenant_id?: string
          type?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "encounter_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "coverage"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_episode_of_care_id_fkey"
            columns: ["episode_of_care_id"]
            isOneToOne: false
            referencedRelation: "episode_of_care"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_location_fk"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_location_fk"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "clinics_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_care_team: {
        Row: {
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          is_primary: boolean | null
          period_end: string | null
          period_start: string | null
          practitioner_user_id: string
          role: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          is_primary?: boolean | null
          period_end?: string | null
          period_start?: string | null
          practitioner_user_id: string
          role: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          is_primary?: boolean | null
          period_end?: string | null
          period_start?: string | null
          practitioner_user_id?: string
          role?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_care_team_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_care_team_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_care_team_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_care_team_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_diagnosis: {
        Row: {
          code: string
          code_system: string
          created_at: string
          created_by: string | null
          display: string | null
          encounter_id: string
          id: string
          is_chronic: boolean | null
          onset_date: string | null
          present_on_admission: string | null
          rank: number | null
          recorded_by: string | null
          role: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          code_system?: string
          created_at?: string
          created_by?: string | null
          display?: string | null
          encounter_id: string
          id?: string
          is_chronic?: boolean | null
          onset_date?: string | null
          present_on_admission?: string | null
          rank?: number | null
          recorded_by?: string | null
          role?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          code_system?: string
          created_at?: string
          created_by?: string | null
          display?: string | null
          encounter_id?: string
          id?: string
          is_chronic?: boolean | null
          onset_date?: string | null
          present_on_admission?: string | null
          rank?: number | null
          recorded_by?: string | null
          role?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_diagnosis_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_diagnosis_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_diagnosis_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_diagnosis_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_emergency: {
        Row: {
          created_at: string
          created_by: string | null
          emergency_arrival_code: string | null
          emergency_department_disposition: string | null
          emergency_service_start: string | null
          encounter_id: string
          id: string
          tenant_id: string
          triage_category: string | null
          triage_date: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          emergency_arrival_code?: string | null
          emergency_department_disposition?: string | null
          emergency_service_start?: string | null
          encounter_id: string
          id?: string
          tenant_id: string
          triage_category?: string | null
          triage_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          emergency_arrival_code?: string | null
          emergency_department_disposition?: string | null
          emergency_service_start?: string | null
          encounter_id?: string
          id?: string
          tenant_id?: string
          triage_category?: string | null
          triage_date?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_emergency_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_emergency_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_emergency_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_emergency_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_hospitalization: {
        Row: {
          admission_source: string | null
          admission_specialty: string | null
          admitted_at: string | null
          created_at: string
          created_by: string | null
          discharge_disposition: string | null
          discharge_specialty: string | null
          discharged_at: string | null
          encounter_id: string
          id: string
          intended_length_of_stay: string | null
          length_of_stay_days: number | null
          origin: string | null
          re_admission: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_source?: string | null
          admission_specialty?: string | null
          admitted_at?: string | null
          created_at?: string
          created_by?: string | null
          discharge_disposition?: string | null
          discharge_specialty?: string | null
          discharged_at?: string | null
          encounter_id: string
          id?: string
          intended_length_of_stay?: string | null
          length_of_stay_days?: number | null
          origin?: string | null
          re_admission?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_source?: string | null
          admission_specialty?: string | null
          admitted_at?: string | null
          created_at?: string
          created_by?: string | null
          discharge_disposition?: string | null
          discharge_specialty?: string | null
          discharged_at?: string | null
          encounter_id?: string
          id?: string
          intended_length_of_stay?: string | null
          length_of_stay_days?: number | null
          origin?: string | null
          re_admission?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_hospitalization_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_hospitalization_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_hospitalization_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "encounter_hospitalization_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
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
      ep_order_item: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          interpretation: string | null
          order_id: string
          performed_at: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["charge_status"]
          study_type: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          interpretation?: string | null
          order_id: string
          performed_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          study_type?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          interpretation?: string | null
          order_id?: string
          performed_at?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          study_type?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ep_order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "electrophysiology_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ep_order_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
        ]
      }
      episode_of_care: {
        Row: {
          beneficiary_id: string
          care_type: string | null
          created_at: string
          created_by: string | null
          end_date: string | null
          id: string
          notes: string | null
          primary_practitioner_id: string | null
          start_date: string
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          beneficiary_id: string
          care_type?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          primary_practitioner_id?: string | null
          start_date?: string
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          beneficiary_id?: string
          care_type?: string | null
          created_at?: string
          created_by?: string | null
          end_date?: string | null
          id?: string
          notes?: string | null
          primary_practitioner_id?: string | null
          start_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_of_care_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episode_of_care_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "episode_of_care_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      erp_posting_queue: {
        Row: {
          attempt_count: number
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          last_error: string | null
          payload: Json
          posted_at: string | null
          posting_ref: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          last_error?: string | null
          payload?: Json
          posted_at?: string | null
          posting_ref?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          last_error?: string | null
          payload?: Json
          posted_at?: string | null
          posting_ref?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      event_posting_matrix: {
        Row: {
          active: boolean
          created_at: string
          event_type: string
          gl_account: string
          id: string
          notes: string | null
          reporting_box: Database["public"]["Enums"]["tax_reporting_box"] | null
          tenant_id: string
          updated_at: string
          vat_rate: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          event_type: string
          gl_account: string
          id?: string
          notes?: string | null
          reporting_box?:
            | Database["public"]["Enums"]["tax_reporting_box"]
            | null
          tenant_id: string
          updated_at?: string
          vat_rate?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          event_type?: string
          gl_account?: string
          id?: string
          notes?: string | null
          reporting_box?:
            | Database["public"]["Enums"]["tax_reporting_box"]
            | null
          tenant_id?: string
          updated_at?: string
          vat_rate?: number | null
        }
        Relationships: []
      }
      form_def: {
        Row: {
          active: boolean
          age_band: Json | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          schema: Json
          tenant_id: string
          title: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          active?: boolean
          age_band?: Json | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          schema: Json
          tenant_id: string
          title: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          active?: boolean
          age_band?: Json | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          schema?: Json
          tenant_id?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      form_workflow_binding: {
        Row: {
          active: boolean
          assignee_role: string | null
          classification: string | null
          cosign_required: boolean
          created_at: string
          due_window_minutes: number | null
          encounter_class: string | null
          form_def_id: string
          id: string
          mandatory: boolean
          module: string | null
          order_item_table: string | null
          service_id: string | null
          tenant_id: string
          trigger: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assignee_role?: string | null
          classification?: string | null
          cosign_required?: boolean
          created_at?: string
          due_window_minutes?: number | null
          encounter_class?: string | null
          form_def_id: string
          id?: string
          mandatory?: boolean
          module?: string | null
          order_item_table?: string | null
          service_id?: string | null
          tenant_id: string
          trigger: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assignee_role?: string | null
          classification?: string | null
          cosign_required?: boolean
          created_at?: string
          due_window_minutes?: number | null
          encounter_class?: string | null
          form_def_id?: string
          id?: string
          mandatory?: boolean
          module?: string | null
          order_item_table?: string | null
          service_id?: string | null
          tenant_id?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_workflow_binding_form_def_id_fkey"
            columns: ["form_def_id"]
            isOneToOne: false
            referencedRelation: "form_def"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_workflow_binding_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
        ]
      }
      him_communication: {
        Row: {
          author: string | null
          body: string
          channel: string | null
          coding_row_id: string | null
          created_at: string
          direction: string
          encounter_id: string
          form_instance_id: string | null
          id: string
          payload: Json | null
          read_at: string | null
          read_by: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          body: string
          channel?: string | null
          coding_row_id?: string | null
          created_at?: string
          direction: string
          encounter_id: string
          form_instance_id?: string | null
          id?: string
          payload?: Json | null
          read_at?: string | null
          read_by?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          body?: string
          channel?: string | null
          coding_row_id?: string | null
          created_at?: string
          direction?: string
          encounter_id?: string
          form_instance_id?: string | null
          id?: string
          payload?: Json | null
          read_at?: string | null
          read_by?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "him_communication_coding_row_id_fkey"
            columns: ["coding_row_id"]
            isOneToOne: false
            referencedRelation: "clinical_coding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "him_communication_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "him_communication_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "him_communication_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "him_communication_form_instance_id_fkey"
            columns: ["form_instance_id"]
            isOneToOne: false
            referencedRelation: "clinical_form_instance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "him_communication_form_instance_id_fkey"
            columns: ["form_instance_id"]
            isOneToOne: false
            referencedRelation: "v_clinical_forms_worklist"
            referencedColumns: ["instance_id"]
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
      insurance_class: {
        Row: {
          approval_limit_minor: number | null
          code: string
          created_at: string
          created_by: string | null
          deductible: Json | null
          id: string
          maximum_limit_minor: number | null
          name: string | null
          network_id: string | null
          policy_id: string
          room_type: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          approval_limit_minor?: number | null
          code: string
          created_at?: string
          created_by?: string | null
          deductible?: Json | null
          id?: string
          maximum_limit_minor?: number | null
          name?: string | null
          network_id?: string | null
          policy_id: string
          room_type?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          approval_limit_minor?: number | null
          code?: string
          created_at?: string
          created_by?: string | null
          deductible?: Json | null
          id?: string
          maximum_limit_minor?: number | null
          name?: string | null
          network_id?: string | null
          policy_id?: string
          room_type?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_class_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "network"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_class_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_class_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      insurance_plan: {
        Row: {
          annual_limit_minor: number | null
          class_id: string
          code: string
          copay_percent: number | null
          created_at: string
          created_by: string | null
          deductible_minor: number | null
          id: string
          name: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          annual_limit_minor?: number | null
          class_id: string
          code: string
          copay_percent?: number | null
          created_at?: string
          created_by?: string | null
          deductible_minor?: number | null
          id?: string
          name?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          annual_limit_minor?: number | null
          class_id?: string
          code?: string
          copay_percent?: number | null
          created_at?: string
          created_by?: string | null
          deductible_minor?: number | null
          id?: string
          name?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "insurance_plan_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "insurance_plan_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      interface_log: {
        Row: {
          acked_at: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          direction: Database["public"]["Enums"]["interface_direction"]
          id: string
          interface_name: string
          last_error: string | null
          payload: Json | null
          response: Json | null
          retry_count: number
          sent_at: string | null
          status: Database["public"]["Enums"]["interface_msg_status"]
          tenant_id: string
          trigger: string | null
          updated_at: string
        }
        Insert: {
          acked_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          direction: Database["public"]["Enums"]["interface_direction"]
          id?: string
          interface_name: string
          last_error?: string | null
          payload?: Json | null
          response?: Json | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["interface_msg_status"]
          tenant_id: string
          trigger?: string | null
          updated_at?: string
        }
        Update: {
          acked_at?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          direction?: Database["public"]["Enums"]["interface_direction"]
          id?: string
          interface_name?: string
          last_error?: string | null
          payload?: Json | null
          response?: Json | null
          retry_count?: number
          sent_at?: string | null
          status?: Database["public"]["Enums"]["interface_msg_status"]
          tenant_id?: string
          trigger?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      interface_mapping: {
        Row: {
          active: boolean
          created_at: string
          id: string
          mapping_type: Database["public"]["Enums"]["mapping_type"]
          notes: string | null
          payer_id: string | null
          source_code: string
          target_code: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          mapping_type: Database["public"]["Enums"]["mapping_type"]
          notes?: string | null
          payer_id?: string | null
          source_code: string
          target_code: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          mapping_type?: Database["public"]["Enums"]["mapping_type"]
          notes?: string | null
          payer_id?: string | null
          source_code?: string
          target_code?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ip_daily_charge_run: {
        Row: {
          admission_request_id: string
          charges_posted: number
          created_at: string
          created_by: string | null
          currency: string
          id: string
          notes: string | null
          run_date: string
          status: string
          tenant_id: string
          total_minor: number
        }
        Insert: {
          admission_request_id: string
          charges_posted?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          run_date: string
          status?: string
          tenant_id: string
          total_minor?: number
        }
        Update: {
          admission_request_id?: string
          charges_posted?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          id?: string
          notes?: string | null
          run_date?: string
          status?: string
          tenant_id?: string
          total_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "ip_daily_charge_run_admission_request_id_fkey"
            columns: ["admission_request_id"]
            isOneToOne: false
            referencedRelation: "admission_request"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_package: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          currency: string
          duration_days: number
          exclusions: Json
          id: string
          inclusions: Json
          name: string
          notes: string | null
          package_code: string
          package_type: string
          price_minor: number
          room_type: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          duration_days?: number
          exclusions?: Json
          id?: string
          inclusions?: Json
          name: string
          notes?: string | null
          package_code: string
          package_type?: string
          price_minor?: number
          room_type?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          duration_days?: number
          exclusions?: Json
          id?: string
          inclusions?: Json
          name?: string
          notes?: string | null
          package_code?: string
          package_type?: string
          price_minor?: number
          room_type?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      lab_order: {
        Row: {
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          notes: string | null
          ordered_at: string
          ordered_by: string | null
          preauth_ref: string | null
          preauth_required: boolean
          preauth_status: Database["public"]["Enums"]["preauth_status"] | null
          priority: string | null
          status: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "lab_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      lab_order_item: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          loinc_code: string | null
          order_id: string
          result_at: string | null
          result_status: string | null
          result_unit: string | null
          result_value: string | null
          service_id: string | null
          specimen: string | null
          status: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          loinc_code?: string | null
          order_id: string
          result_at?: string | null
          result_status?: string | null
          result_unit?: string | null
          result_value?: string | null
          service_id?: string | null
          specimen?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          loinc_code?: string | null
          order_id?: string
          result_at?: string | null
          result_status?: string | null
          result_unit?: string | null
          result_value?: string | null
          service_id?: string | null
          specimen?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "lab_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_order_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
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
      los_extension: {
        Row: {
          admission_request_id: string
          approved_at: string | null
          authorization_request_id: string | null
          created_at: string
          created_by: string | null
          id: string
          new_edd: string | null
          new_los_days: number
          prior_los_days: number | null
          reason: string | null
          status: Database["public"]["Enums"]["los_ext_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admission_request_id: string
          approved_at?: string | null
          authorization_request_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_edd?: string | null
          new_los_days: number
          prior_los_days?: number | null
          reason?: string | null
          status?: Database["public"]["Enums"]["los_ext_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admission_request_id?: string
          approved_at?: string | null
          authorization_request_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          new_edd?: string | null
          new_los_days?: number
          prior_los_days?: number | null
          reason?: string | null
          status?: Database["public"]["Enums"]["los_ext_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "los_extension_admission_request_id_fkey"
            columns: ["admission_request_id"]
            isOneToOne: false
            referencedRelation: "admission_request"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "los_extension_authorization_request_id_fkey"
            columns: ["authorization_request_id"]
            isOneToOne: false
            referencedRelation: "authorization_request"
            referencedColumns: ["id"]
          },
        ]
      }
      maternity_protocol: {
        Row: {
          active: boolean
          class_id: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          payer_id: string | null
          policy_id: string | null
          rules: Json
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          payer_id?: string | null
          policy_id?: string | null
          rules?: Json
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          payer_id?: string | null
          policy_id?: string | null
          rules?: Json
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maternity_protocol_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maternity_protocol_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maternity_protocol_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "maternity_protocol_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      need_approval_rule: {
        Row: {
          active: boolean
          class_id: string | null
          condition: Json
          created_at: string
          created_by: string | null
          id: string
          payer_id: string | null
          policy_id: string | null
          scope: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          class_id?: string | null
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          payer_id?: string | null
          policy_id?: string | null
          scope: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          class_id?: string | null
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          payer_id?: string | null
          policy_id?: string | null
          scope?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "need_approval_rule_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_approval_rule_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_approval_rule_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "need_approval_rule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      network: {
        Row: {
          active: boolean
          approval_limit_minor: number | null
          created_at: string
          created_by: string | null
          deductible: Json | null
          id: string
          maximum_limit_minor: number | null
          name: string
          payer_id: string
          room_type: string | null
          tenant_id: string
          tier: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          approval_limit_minor?: number | null
          created_at?: string
          created_by?: string | null
          deductible?: Json | null
          id?: string
          maximum_limit_minor?: number | null
          name: string
          payer_id: string
          room_type?: string | null
          tenant_id: string
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          approval_limit_minor?: number | null
          created_at?: string
          created_by?: string | null
          deductible?: Json | null
          id?: string
          maximum_limit_minor?: number | null
          name?: string
          payer_id?: string
          room_type?: string | null
          tenant_id?: string
          tier?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      network_membership: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          in_network: boolean
          network_id: string
          provider_facility_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          in_network?: boolean
          network_id: string
          provider_facility_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          in_network?: boolean
          network_id?: string
          provider_facility_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "network_membership_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "network"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_membership_provider_facility_id_fkey"
            columns: ["provider_facility_id"]
            isOneToOne: false
            referencedRelation: "clinics"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_membership_provider_facility_id_fkey"
            columns: ["provider_facility_id"]
            isOneToOne: false
            referencedRelation: "clinics_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_membership_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      not_covered_rule: {
        Row: {
          active: boolean
          class_id: string | null
          condition: Json
          created_at: string
          created_by: string | null
          id: string
          payer_id: string | null
          policy_id: string | null
          scope: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          class_id?: string | null
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          payer_id?: string | null
          policy_id?: string | null
          scope: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          class_id?: string | null
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          payer_id?: string | null
          policy_id?: string | null
          scope?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "not_covered_rule_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "not_covered_rule_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "not_covered_rule_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "not_covered_rule_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      nphies_message_log: {
        Row: {
          actor_id: string | null
          created_at: string
          error: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          idempotency_key: string
          message_type: string
          outcome: string
          request_body: Json | null
          response_body: Json | null
          sandbox: boolean
          started_at: string
          subject_id: string | null
          subject_table: string | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          idempotency_key: string
          message_type: string
          outcome: string
          request_body?: Json | null
          response_body?: Json | null
          sandbox?: boolean
          started_at?: string
          subject_id?: string | null
          subject_table?: string | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          error?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          idempotency_key?: string
          message_type?: string
          outcome?: string
          request_body?: Json | null
          response_body?: Json | null
          sandbox?: boolean
          started_at?: string
          subject_id?: string | null
          subject_table?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "nphies_message_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
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
      patient_wallet: {
        Row: {
          balance_minor: number
          beneficiary_id: string
          created_at: string
          currency: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          balance_minor?: number
          beneficiary_id: string
          created_at?: string
          currency?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          balance_minor?: number
          beneficiary_id?: string
          created_at?: string
          currency?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_wallet_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_wallet_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
        ]
      }
      payer: {
        Row: {
          active: boolean
          cchi_number: string | null
          created_at: string
          created_by: string | null
          id: string
          name: string
          nphies_payer_id: string
          payer_type: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          cchi_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          nphies_payer_id: string
          payer_type?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          cchi_number?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          nphies_payer_id?: string
          payer_type?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payer_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payer_agreement: {
        Row: {
          active: boolean
          agreement_no: string
          contract_end: string | null
          contract_start: string
          created_at: string
          created_by: string | null
          id: string
          payer_id: string
          prompt_payment_discount_percent: number | null
          settlement_terms_days: number
          tenant_id: string
          tpa_id: string | null
          updated_at: string
          updated_by: string | null
          vat_treatment: string
          volume_discount_rules: Json | null
        }
        Insert: {
          active?: boolean
          agreement_no: string
          contract_end?: string | null
          contract_start: string
          created_at?: string
          created_by?: string | null
          id?: string
          payer_id: string
          prompt_payment_discount_percent?: number | null
          settlement_terms_days?: number
          tenant_id: string
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_treatment?: string
          volume_discount_rules?: Json | null
        }
        Update: {
          active?: boolean
          agreement_no?: string
          contract_end?: string | null
          contract_start?: string
          created_at?: string
          created_by?: string | null
          id?: string
          payer_id?: string
          prompt_payment_discount_percent?: number | null
          settlement_terms_days?: number
          tenant_id?: string
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vat_treatment?: string
          volume_discount_rules?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "payer_agreement_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payer_agreement_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payer_agreement_tpa_id_fkey"
            columns: ["tpa_id"]
            isOneToOne: false
            referencedRelation: "tpa"
            referencedColumns: ["id"]
          },
        ]
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
      policy: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          effective_date: string | null
          expiry_date: string | null
          id: string
          internal_serial_number: string | null
          name: string | null
          payer_id: string
          policy_date_expiry: string | null
          policy_number: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          internal_serial_number?: string | null
          name?: string | null
          payer_id: string
          policy_date_expiry?: string | null
          policy_number: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          internal_serial_number?: string | null
          name?: string | null
          payer_id?: string
          policy_date_expiry?: string | null
          policy_number?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "policy_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_activation_request: {
        Row: {
          activated_at: string | null
          activated_by: string | null
          assigned_to: string | null
          class_code: string | null
          created_at: string
          created_by: string | null
          id: string
          is_ineligible_flag: boolean
          membership_no: string | null
          notes: string | null
          notify_reception_at: string | null
          payer_id: string | null
          policy_no: string | null
          requested_by: string | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          validity_from: string | null
          validity_to: string | null
          visit_eligibility_id: string
        }
        Insert: {
          activated_at?: string | null
          activated_by?: string | null
          assigned_to?: string | null
          class_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_ineligible_flag?: boolean
          membership_no?: string | null
          notes?: string | null
          notify_reception_at?: string | null
          payer_id?: string | null
          policy_no?: string | null
          requested_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          validity_from?: string | null
          validity_to?: string | null
          visit_eligibility_id: string
        }
        Update: {
          activated_at?: string | null
          activated_by?: string | null
          assigned_to?: string | null
          class_code?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_ineligible_flag?: boolean
          membership_no?: string | null
          notes?: string | null
          notify_reception_at?: string | null
          payer_id?: string | null
          policy_no?: string | null
          requested_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          validity_from?: string | null
          validity_to?: string | null
          visit_eligibility_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "policy_activation_request_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_activation_request_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "policy_activation_request_visit_eligibility_id_fkey"
            columns: ["visit_eligibility_id"]
            isOneToOne: false
            referencedRelation: "visit_eligibility"
            referencedColumns: ["id"]
          },
        ]
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
      prem_response: {
        Row: {
          answers: Json
          beneficiary_id: string
          collected_at: string
          created_at: string
          encounter_id: string | null
          id: string
          instrument_id: string
          instrument_version: string
          score: Json
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answers: Json
          beneficiary_id: string
          collected_at?: string
          created_at?: string
          encounter_id?: string | null
          id?: string
          instrument_id: string
          instrument_version: string
          score?: Json
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          beneficiary_id?: string
          collected_at?: string
          created_at?: string
          encounter_id?: string | null
          id?: string
          instrument_id?: string
          instrument_version?: string
          score?: Json
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prem_response_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prem_response_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "prem_response_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prem_response_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "prem_response_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "prem_response_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "prom_instrument"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prem_response_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription: {
        Row: {
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          notes: string | null
          ordered_at: string
          ordered_by: string | null
          preauth_ref: string | null
          preauth_required: boolean
          preauth_status: Database["public"]["Enums"]["preauth_status"] | null
          status: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "prescription_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      prescription_item: {
        Row: {
          created_at: string
          created_by: string | null
          dispense_status: string | null
          dispensed_at: string | null
          dispensed_by: string | null
          dose: string | null
          drug_id: string
          duration: string | null
          frequency: string | null
          id: string
          order_id: string
          quantity: number
          quantity_code: string | null
          selection_reason: string | null
          status: Database["public"]["Enums"]["charge_status"]
          substitute_drug_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispense_status?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          dose?: string | null
          drug_id: string
          duration?: string | null
          frequency?: string | null
          id?: string
          order_id: string
          quantity?: number
          quantity_code?: string | null
          selection_reason?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          substitute_drug_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispense_status?: string | null
          dispensed_at?: string | null
          dispensed_by?: string | null
          dose?: string | null
          drug_id?: string
          duration?: string | null
          frequency?: string | null
          id?: string
          order_id?: string
          quantity?: number
          quantity_code?: string | null
          selection_reason?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          substitute_drug_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_item_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "prescription"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_item_substitute_drug_id_fkey"
            columns: ["substitute_drug_id"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          currency: string
          derive_factor: number | null
          effective_date: string | null
          expiry_date: string | null
          id: string
          insurance_class_id: string | null
          is_cost_basis: boolean
          list_type: string
          name: string
          network_id: string | null
          parent_price_list_id: string | null
          payer_id: string | null
          policy_id: string | null
          scope_level: string
          tenant_id: string
          tpa_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          derive_factor?: number | null
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          insurance_class_id?: string | null
          is_cost_basis?: boolean
          list_type: string
          name: string
          network_id?: string | null
          parent_price_list_id?: string | null
          payer_id?: string | null
          policy_id?: string | null
          scope_level?: string
          tenant_id: string
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          derive_factor?: number | null
          effective_date?: string | null
          expiry_date?: string | null
          id?: string
          insurance_class_id?: string | null
          is_cost_basis?: boolean
          list_type?: string
          name?: string
          network_id?: string | null
          parent_price_list_id?: string | null
          payer_id?: string | null
          policy_id?: string | null
          scope_level?: string
          tenant_id?: string
          tpa_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_insurance_class_id_fkey"
            columns: ["insurance_class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "network"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_parent_price_list_id_fkey"
            columns: ["parent_price_list_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_tpa_id_fkey"
            columns: ["tpa_id"]
            isOneToOne: false
            referencedRelation: "tpa"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_item: {
        Row: {
          created_at: string
          created_by: string | null
          default_factor: number
          drug_id: string | null
          id: string
          is_package: boolean
          patient_share_percent: number | null
          price_list_id: string
          referral_status: string | null
          service_id: string | null
          tax_percent: number | null
          tenant_id: string
          time_band: string | null
          unit_price_minor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_factor?: number
          drug_id?: string | null
          id?: string
          is_package?: boolean
          patient_share_percent?: number | null
          price_list_id: string
          referral_status?: string | null
          service_id?: string | null
          tax_percent?: number | null
          tenant_id: string
          time_band?: string | null
          unit_price_minor: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_factor?: number
          drug_id?: string | null
          id?: string
          is_package?: boolean
          patient_share_percent?: number | null
          price_list_id?: string
          referral_status?: string | null
          service_id?: string | null
          tax_percent?: number | null
          tenant_id?: string
          time_band?: string | null
          unit_price_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "price_list_item_drug_id_fkey"
            columns: ["drug_id"]
            isOneToOne: false
            referencedRelation: "drug_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_item_price_list_id_fkey"
            columns: ["price_list_id"]
            isOneToOne: false
            referencedRelation: "price_list"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "price_list_item_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      price_list_item_version: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          default_factor: number
          effective_from: string
          effective_to: string | null
          id: string
          patient_share_percent: number | null
          price_list_item_id: string
          tax_percent: number | null
          tenant_id: string
          unit_price_minor: number
          updated_at: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          default_factor?: number
          effective_from: string
          effective_to?: string | null
          id?: string
          patient_share_percent?: number | null
          price_list_item_id: string
          tax_percent?: number | null
          tenant_id: string
          unit_price_minor: number
          updated_at?: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          default_factor?: number
          effective_from?: string
          effective_to?: string | null
          id?: string
          patient_share_percent?: number | null
          price_list_item_id?: string
          tax_percent?: number | null
          tenant_id?: string
          unit_price_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "price_list_item_version_price_list_item_id_fkey"
            columns: ["price_list_item_id"]
            isOneToOne: false
            referencedRelation: "price_list_item"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_rule: {
        Row: {
          action: Json
          active: boolean
          condition: Json
          created_at: string
          created_by: string | null
          id: string
          name: string
          priority: number
          scope: Database["public"]["Enums"]["pricing_rule_scope"]
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          action?: Json
          active?: boolean
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          priority?: number
          scope: Database["public"]["Enums"]["pricing_rule_scope"]
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          action?: Json
          active?: boolean
          condition?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          priority?: number
          scope?: Database["public"]["Enums"]["pricing_rule_scope"]
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_preference: string
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
          theme_preference: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          accent_preference?: string
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
          theme_preference?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          accent_preference?: string
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
          theme_preference?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      prom_assignment: {
        Row: {
          assigned_by: string | null
          beneficiary_id: string
          channel: string
          created_at: string
          due_at: string | null
          encounter_id: string | null
          episode_of_care_id: string | null
          id: string
          instrument_id: string
          last_reminder_at: string | null
          notes: string | null
          reminder_count: number
          status: string
          tenant_id: string
          trigger: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          beneficiary_id: string
          channel?: string
          created_at?: string
          due_at?: string | null
          encounter_id?: string | null
          episode_of_care_id?: string | null
          id?: string
          instrument_id: string
          last_reminder_at?: string | null
          notes?: string | null
          reminder_count?: number
          status?: string
          tenant_id: string
          trigger: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          beneficiary_id?: string
          channel?: string
          created_at?: string
          due_at?: string | null
          encounter_id?: string | null
          episode_of_care_id?: string | null
          id?: string
          instrument_id?: string
          last_reminder_at?: string | null
          notes?: string | null
          reminder_count?: number
          status?: string
          tenant_id?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prom_assignment_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prom_assignment_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "prom_assignment_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prom_assignment_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "prom_assignment_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "prom_assignment_episode_of_care_id_fkey"
            columns: ["episode_of_care_id"]
            isOneToOne: false
            referencedRelation: "episode_of_care"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prom_assignment_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "prom_instrument"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prom_assignment_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      prom_instrument: {
        Row: {
          active: boolean
          condition: string | null
          created_at: string
          description: string | null
          id: string
          key: string
          kind: string
          name: string
          schema: Json
          tenant_id: string | null
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key: string
          kind: string
          name: string
          schema?: Json
          tenant_id?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          condition?: string | null
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          kind?: string
          name?: string
          schema?: Json
          tenant_id?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "prom_instrument_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      prom_response: {
        Row: {
          answers: Json
          assignment_id: string
          collected_at: string
          created_at: string
          id: string
          instrument_version: string
          score: Json
          source: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          answers: Json
          assignment_id: string
          collected_at?: string
          created_at?: string
          id?: string
          instrument_version: string
          score?: Json
          source?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          answers?: Json
          assignment_id?: string
          collected_at?: string
          created_at?: string
          id?: string
          instrument_version?: string
          score?: Json
          source?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prom_response_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: true
            referencedRelation: "prom_assignment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prom_response_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      radiology_order: {
        Row: {
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          notes: string | null
          ordered_at: string
          ordered_by: string | null
          preauth_ref: string | null
          preauth_required: boolean
          preauth_status: Database["public"]["Enums"]["preauth_status"] | null
          priority: string | null
          status: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radiology_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "radiology_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      radiology_order_item: {
        Row: {
          body_site: string | null
          created_at: string
          created_by: string | null
          id: string
          modality: string | null
          order_id: string
          performed_at: string | null
          report_status: string | null
          report_text: string | null
          service_id: string | null
          status: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modality?: string | null
          order_id: string
          performed_at?: string | null
          report_status?: string | null
          report_text?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          modality?: string | null
          order_id?: string
          performed_at?: string | null
          report_status?: string | null
          report_text?: string | null
          service_id?: string | null
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "radiology_order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "radiology_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "radiology_order_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
        ]
      }
      rcm_admin_config: {
        Row: {
          created_at: string
          id: string
          key: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      rcm_admin_config_history: {
        Row: {
          actor_id: string | null
          changed_at: string
          id: string
          key: string
          new_value: Json | null
          old_value: Json | null
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          changed_at?: string
          id?: string
          key: string
          new_value?: Json | null
          old_value?: Json | null
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          changed_at?: string
          id?: string
          key?: string
          new_value?: Json | null
          old_value?: Json | null
          tenant_id?: string
        }
        Relationships: []
      }
      rcm_gate_exception: {
        Row: {
          admission_request_id: string | null
          charge_item_id: string | null
          closed_at: string | null
          closed_by: string | null
          created_at: string
          encounter_id: string | null
          exception_type: Database["public"]["Enums"]["rcm_gate_exception_type"]
          expires_at: string | null
          granted_by: string | null
          granted_role: string | null
          id: string
          manual_approved_minor: number | null
          nphies_approved_minor: number | null
          reason_code:
            | Database["public"]["Enums"]["rcm_gate_reason_code"]
            | null
          reason_text: string | null
          reconciled_at: string | null
          retrospective_auth_state: string | null
          tenant_id: string
          updated_at: string
          wallet_delta_minor: number | null
        }
        Insert: {
          admission_request_id?: string | null
          charge_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          encounter_id?: string | null
          exception_type: Database["public"]["Enums"]["rcm_gate_exception_type"]
          expires_at?: string | null
          granted_by?: string | null
          granted_role?: string | null
          id?: string
          manual_approved_minor?: number | null
          nphies_approved_minor?: number | null
          reason_code?:
            | Database["public"]["Enums"]["rcm_gate_reason_code"]
            | null
          reason_text?: string | null
          reconciled_at?: string | null
          retrospective_auth_state?: string | null
          tenant_id: string
          updated_at?: string
          wallet_delta_minor?: number | null
        }
        Update: {
          admission_request_id?: string | null
          charge_item_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          created_at?: string
          encounter_id?: string | null
          exception_type?: Database["public"]["Enums"]["rcm_gate_exception_type"]
          expires_at?: string | null
          granted_by?: string | null
          granted_role?: string | null
          id?: string
          manual_approved_minor?: number | null
          nphies_approved_minor?: number | null
          reason_code?:
            | Database["public"]["Enums"]["rcm_gate_reason_code"]
            | null
          reason_text?: string | null
          reconciled_at?: string | null
          retrospective_auth_state?: string | null
          tenant_id?: string
          updated_at?: string
          wallet_delta_minor?: number | null
        }
        Relationships: []
      }
      referral: {
        Row: {
          accepted_at: string | null
          beneficiary_id: string
          cancel_reason: string | null
          cancelled_at: string | null
          charge_mode: Database["public"]["Enums"]["charge_mode"] | null
          clinical_notes: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          discount_pct: number | null
          eligibility_check_required: boolean
          external_facility: string | null
          external_provider: string | null
          id: string
          no_charge_reason: string | null
          preauth_required: boolean
          priority: string | null
          reason: string | null
          referral_class: Database["public"]["Enums"]["referral_class"]
          referral_no: string
          series_id: string | null
          source_encounter_id: string | null
          source_provider_id: string | null
          source_specialty: string | null
          status: Database["public"]["Enums"]["referral_status"]
          submitted_at: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          accepted_at?: string | null
          beneficiary_id: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          charge_mode?: Database["public"]["Enums"]["charge_mode"] | null
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          eligibility_check_required?: boolean
          external_facility?: string | null
          external_provider?: string | null
          id?: string
          no_charge_reason?: string | null
          preauth_required?: boolean
          priority?: string | null
          reason?: string | null
          referral_class: Database["public"]["Enums"]["referral_class"]
          referral_no: string
          series_id?: string | null
          source_encounter_id?: string | null
          source_provider_id?: string | null
          source_specialty?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          submitted_at?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          accepted_at?: string | null
          beneficiary_id?: string
          cancel_reason?: string | null
          cancelled_at?: string | null
          charge_mode?: Database["public"]["Enums"]["charge_mode"] | null
          clinical_notes?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          discount_pct?: number | null
          eligibility_check_required?: boolean
          external_facility?: string | null
          external_provider?: string | null
          id?: string
          no_charge_reason?: string | null
          preauth_required?: boolean
          priority?: string | null
          reason?: string | null
          referral_class?: Database["public"]["Enums"]["referral_class"]
          referral_no?: string
          series_id?: string | null
          source_encounter_id?: string | null
          source_provider_id?: string | null
          source_specialty?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          submitted_at?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      referral_target: {
        Row: {
          booked_appointment_id: string | null
          created_at: string
          id: string
          notes: string | null
          referral_id: string
          status: Database["public"]["Enums"]["referral_status"]
          target_facility_id: string | null
          target_kind: Database["public"]["Enums"]["target_kind"]
          target_provider_id: string | null
          target_service_id: string | null
          target_specialty: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          booked_appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          referral_id: string
          status?: Database["public"]["Enums"]["referral_status"]
          target_facility_id?: string | null
          target_kind: Database["public"]["Enums"]["target_kind"]
          target_provider_id?: string | null
          target_service_id?: string | null
          target_specialty?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          booked_appointment_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          referral_id?: string
          status?: Database["public"]["Enums"]["referral_status"]
          target_facility_id?: string | null
          target_kind?: Database["public"]["Enums"]["target_kind"]
          target_provider_id?: string | null
          target_service_id?: string | null
          target_specialty?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_target_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "referral"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_request: {
        Row: {
          amount_minor: number
          approval_level: string | null
          approval_reason: string | null
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          deposit_id: string
          exception_override: boolean
          executed_at: string | null
          executed_by: string | null
          id: string
          original_method: Database["public"]["Enums"]["deposit_method"]
          reason: string
          receipt_no: string | null
          refund_method: string
          rejected_at: string | null
          status: string
          tax_credit_note_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          vat_reversal_minor: number
        }
        Insert: {
          amount_minor: number
          approval_level?: string | null
          approval_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deposit_id: string
          exception_override?: boolean
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          original_method: Database["public"]["Enums"]["deposit_method"]
          reason: string
          receipt_no?: string | null
          refund_method: string
          rejected_at?: string | null
          status?: string
          tax_credit_note_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          vat_reversal_minor?: number
        }
        Update: {
          amount_minor?: number
          approval_level?: string | null
          approval_reason?: string | null
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          deposit_id?: string
          exception_override?: boolean
          executed_at?: string | null
          executed_by?: string | null
          id?: string
          original_method?: Database["public"]["Enums"]["deposit_method"]
          reason?: string
          receipt_no?: string | null
          refund_method?: string
          rejected_at?: string | null
          status?: string
          tax_credit_note_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          vat_reversal_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "refund_request_deposit_id_fkey"
            columns: ["deposit_id"]
            isOneToOne: false
            referencedRelation: "deposit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "refund_request_tax_credit_note_id_fkey"
            columns: ["tax_credit_note_id"]
            isOneToOne: false
            referencedRelation: "tax_invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      refund_request_attachment: {
        Row: {
          created_at: string
          id: string
          kind: string
          note: string | null
          refund_request_id: string
          tenant_id: string
          uploaded_by: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          note?: string | null
          refund_request_id: string
          tenant_id: string
          uploaded_by?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          note?: string | null
          refund_request_id?: string
          tenant_id?: string
          uploaded_by?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "refund_request_attachment_refund_request_id_fkey"
            columns: ["refund_request_id"]
            isOneToOne: false
            referencedRelation: "refund_request"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          payer_id: string
          posted_at: string | null
          posted_by: string | null
          raw_payload: Json | null
          received_at: string
          remittance_ref: string
          source: Database["public"]["Enums"]["remittance_source"]
          status: Database["public"]["Enums"]["remittance_status"]
          tenant_id: string
          total_amount_minor: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payer_id: string
          posted_at?: string | null
          posted_by?: string | null
          raw_payload?: Json | null
          received_at?: string
          remittance_ref: string
          source: Database["public"]["Enums"]["remittance_source"]
          status?: Database["public"]["Enums"]["remittance_status"]
          tenant_id: string
          total_amount_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          payer_id?: string
          posted_at?: string | null
          posted_by?: string | null
          raw_payload?: Json | null
          received_at?: string
          remittance_ref?: string
          source?: Database["public"]["Enums"]["remittance_source"]
          status?: Database["public"]["Enums"]["remittance_status"]
          tenant_id?: string
          total_amount_minor?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "remittance_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_line: {
        Row: {
          adjustment_minor: number
          allocated_amount_minor: number
          bill_ref: string | null
          claim_id: string | null
          claim_sequence_no: string | null
          created_at: string
          id: string
          match_status: Database["public"]["Enums"]["remittance_match_status"]
          notes: string | null
          paid_amount_minor: number
          reason_code: string | null
          remittance_id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          adjustment_minor?: number
          allocated_amount_minor?: number
          bill_ref?: string | null
          claim_id?: string | null
          claim_sequence_no?: string | null
          created_at?: string
          id?: string
          match_status?: Database["public"]["Enums"]["remittance_match_status"]
          notes?: string | null
          paid_amount_minor?: number
          reason_code?: string | null
          remittance_id: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          adjustment_minor?: number
          allocated_amount_minor?: number
          bill_ref?: string | null
          claim_id?: string | null
          claim_sequence_no?: string | null
          created_at?: string
          id?: string
          match_status?: Database["public"]["Enums"]["remittance_match_status"]
          notes?: string | null
          paid_amount_minor?: number
          reason_code?: string | null
          remittance_id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "remittance_line_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claim"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "remittance_line_remittance_id_fkey"
            columns: ["remittance_id"]
            isOneToOne: false
            referencedRelation: "remittance"
            referencedColumns: ["id"]
          },
        ]
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
      room_board_entitlement: {
        Row: {
          active: boolean
          class_id: string
          covered: boolean
          created_at: string
          created_by: string | null
          currency: string
          daily_rate_minor: number
          id: string
          notes: string | null
          room_type: string
          tenant_id: string
          tier: number
          updated_at: string
          updated_by: string | null
          upgrade_allowed: boolean
        }
        Insert: {
          active?: boolean
          class_id: string
          covered?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          daily_rate_minor?: number
          id?: string
          notes?: string | null
          room_type: string
          tenant_id: string
          tier?: number
          updated_at?: string
          updated_by?: string | null
          upgrade_allowed?: boolean
        }
        Update: {
          active?: boolean
          class_id?: string
          covered?: boolean
          created_at?: string
          created_by?: string | null
          currency?: string
          daily_rate_minor?: number
          id?: string
          notes?: string | null
          room_type?: string
          tenant_id?: string
          tier?: number
          updated_at?: string
          updated_by?: string | null
          upgrade_allowed?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "room_board_entitlement_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
        ]
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
      scrub_rule: {
        Row: {
          category: string | null
          code: string
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          enabled: boolean
          id: string
          label: string
          params: Json
          severity: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          enabled?: boolean
          id?: string
          label: string
          params?: Json
          severity?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          enabled?: boolean
          id?: string
          label?: string
          params?: Json
          severity?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      service_code: {
        Row: {
          code: string
          code_system_id: string
          created_at: string
          created_by: string | null
          display: string | null
          id: string
          is_primary_billing: boolean
          payer_id: string | null
          service_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          code: string
          code_system_id: string
          created_at?: string
          created_by?: string | null
          display?: string | null
          id?: string
          is_primary_billing?: boolean
          payer_id?: string | null
          service_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          code?: string
          code_system_id?: string
          created_at?: string
          created_by?: string | null
          display?: string | null
          id?: string
          is_primary_billing?: boolean
          payer_id?: string | null
          service_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_code_code_system_id_fkey"
            columns: ["code_system_id"]
            isOneToOne: false
            referencedRelation: "code_system"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_code_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_code_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_code_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_master: {
        Row: {
          active: boolean
          age_rule: Json | null
          approx_perform_minutes: number | null
          body_site: string | null
          cannot_combine_service_ids: string[] | null
          category: string | null
          claim_type: string | null
          created_at: string
          created_by: string | null
          description: string | null
          execution_venue: string | null
          gender_rule: string | null
          general_comments: string | null
          has_report: boolean | null
          id: string
          internal_code: string
          is_package: boolean
          is_service_flag: boolean | null
          max_qty_per_billing: number | null
          max_qty_per_episode: number | null
          max_qty_per_policy_year: number | null
          max_qty_per_visit: number | null
          modality: string | null
          name: string
          not_available_category: string | null
          nphies_map_payer_ref: string | null
          ordering_specialty_rule: Json | null
          performer_role: string | null
          performing_specialty_rule: Json | null
          preauth_required: boolean
          pregnancy_rule: string | null
          repeat_block_window_days: number | null
          service_block: boolean | null
          service_consent_form_id: string | null
          service_type: string
          stat_flag: boolean | null
          sub_category: string | null
          tat_minutes: number | null
          temporary_unavailable: boolean | null
          tenant_id: string
          tooth_number: string | null
          updated_at: string
          updated_by: string | null
          validity_end: string | null
          validity_start: string | null
          visit_type: string | null
        }
        Insert: {
          active?: boolean
          age_rule?: Json | null
          approx_perform_minutes?: number | null
          body_site?: string | null
          cannot_combine_service_ids?: string[] | null
          category?: string | null
          claim_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_venue?: string | null
          gender_rule?: string | null
          general_comments?: string | null
          has_report?: boolean | null
          id?: string
          internal_code: string
          is_package?: boolean
          is_service_flag?: boolean | null
          max_qty_per_billing?: number | null
          max_qty_per_episode?: number | null
          max_qty_per_policy_year?: number | null
          max_qty_per_visit?: number | null
          modality?: string | null
          name: string
          not_available_category?: string | null
          nphies_map_payer_ref?: string | null
          ordering_specialty_rule?: Json | null
          performer_role?: string | null
          performing_specialty_rule?: Json | null
          preauth_required?: boolean
          pregnancy_rule?: string | null
          repeat_block_window_days?: number | null
          service_block?: boolean | null
          service_consent_form_id?: string | null
          service_type: string
          stat_flag?: boolean | null
          sub_category?: string | null
          tat_minutes?: number | null
          temporary_unavailable?: boolean | null
          tenant_id: string
          tooth_number?: string | null
          updated_at?: string
          updated_by?: string | null
          validity_end?: string | null
          validity_start?: string | null
          visit_type?: string | null
        }
        Update: {
          active?: boolean
          age_rule?: Json | null
          approx_perform_minutes?: number | null
          body_site?: string | null
          cannot_combine_service_ids?: string[] | null
          category?: string | null
          claim_type?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          execution_venue?: string | null
          gender_rule?: string | null
          general_comments?: string | null
          has_report?: boolean | null
          id?: string
          internal_code?: string
          is_package?: boolean
          is_service_flag?: boolean | null
          max_qty_per_billing?: number | null
          max_qty_per_episode?: number | null
          max_qty_per_policy_year?: number | null
          max_qty_per_visit?: number | null
          modality?: string | null
          name?: string
          not_available_category?: string | null
          nphies_map_payer_ref?: string | null
          ordering_specialty_rule?: Json | null
          performer_role?: string | null
          performing_specialty_rule?: Json | null
          preauth_required?: boolean
          pregnancy_rule?: string | null
          repeat_block_window_days?: number | null
          service_block?: boolean | null
          service_consent_form_id?: string | null
          service_type?: string
          stat_flag?: boolean | null
          sub_category?: string | null
          tat_minutes?: number | null
          temporary_unavailable?: boolean | null
          tenant_id?: string
          tooth_number?: string | null
          updated_at?: string
          updated_by?: string | null
          validity_end?: string | null
          validity_start?: string | null
          visit_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_master_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      service_order: {
        Row: {
          created_at: string
          created_by: string | null
          encounter_id: string
          id: string
          notes: string | null
          ordered_at: string
          ordered_by: string | null
          preauth_ref: string | null
          preauth_required: boolean
          preauth_status: Database["public"]["Enums"]["preauth_status"] | null
          priority: string | null
          status: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encounter_id: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encounter_id?: string
          id?: string
          notes?: string | null
          ordered_at?: string
          ordered_by?: string | null
          preauth_ref?: string | null
          preauth_required?: boolean
          preauth_status?: Database["public"]["Enums"]["preauth_status"] | null
          priority?: string | null
          status?: Database["public"]["Enums"]["clinical_order_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "service_order_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      service_order_item: {
        Row: {
          body_site: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          order_id: string
          performed_at: string | null
          quantity: number
          service_id: string
          status: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id: string
          performed_at?: string | null
          quantity?: number
          service_id: string
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          performed_at?: string | null
          quantity?: number
          service_id?: string
          status?: Database["public"]["Enums"]["charge_status"]
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_order_item_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "service_order"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_order_item_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "service_master"
            referencedColumns: ["id"]
          },
        ]
      }
      site_content: {
        Row: {
          created_at: string
          draft_value: Json | null
          key: string
          locale: string
          published_at: string | null
          published_by: string | null
          published_value: Json | null
          status: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          draft_value?: Json | null
          key: string
          locale?: string
          published_at?: string | null
          published_by?: string | null
          published_value?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          draft_value?: Json | null
          key?: string
          locale?: string
          published_at?: string | null
          published_by?: string | null
          published_value?: Json | null
          status?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      site_content_version: {
        Row: {
          bumped_at: string
          bumped_by: string | null
          id: number
          version: number
        }
        Insert: {
          bumped_at?: string
          bumped_by?: string | null
          id?: number
          version?: number
        }
        Update: {
          bumped_at?: string
          bumped_by?: string | null
          id?: number
          version?: number
        }
        Relationships: []
      }
      submission_channel: {
        Row: {
          active: boolean
          channel_kind: string
          config: Json
          created_at: string
          created_by: string | null
          endpoint: string | null
          id: string
          label: string
          payer_id: string | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          channel_kind?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          endpoint?: string | null
          id?: string
          label: string
          payer_id?: string | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          channel_kind?: string
          config?: Json
          created_at?: string
          created_by?: string | null
          endpoint?: string | null
          id?: string
          label?: string
          payer_id?: string | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      tax_invoice: {
        Row: {
          cash_collection_id: string | null
          claim_id: string | null
          counterparty_id: string | null
          counterparty_type: string
          created_at: string
          created_by: string | null
          currency: string
          discount_minor: number
          gross_minor: number
          id: string
          invoice_no: string | null
          invoice_type: Database["public"]["Enums"]["tax_invoice_type"]
          irn: string | null
          issued_at: string | null
          parent_invoice_id: string | null
          reporting_box: Database["public"]["Enums"]["tax_reporting_box"]
          taxable_base_minor: number
          tenant_id: string
          total_minor: number
          updated_at: string
          vat_minor: number
          vat_rate: number
          zatca_hash: string | null
          zatca_last_error: string | null
          zatca_prev_hash: string | null
          zatca_qr: string | null
          zatca_signed_xml: string | null
          zatca_status: Database["public"]["Enums"]["zatca_status"]
          zatca_uuid: string | null
        }
        Insert: {
          cash_collection_id?: string | null
          claim_id?: string | null
          counterparty_id?: string | null
          counterparty_type: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_minor?: number
          gross_minor?: number
          id?: string
          invoice_no?: string | null
          invoice_type: Database["public"]["Enums"]["tax_invoice_type"]
          irn?: string | null
          issued_at?: string | null
          parent_invoice_id?: string | null
          reporting_box: Database["public"]["Enums"]["tax_reporting_box"]
          taxable_base_minor?: number
          tenant_id: string
          total_minor?: number
          updated_at?: string
          vat_minor?: number
          vat_rate?: number
          zatca_hash?: string | null
          zatca_last_error?: string | null
          zatca_prev_hash?: string | null
          zatca_qr?: string | null
          zatca_signed_xml?: string | null
          zatca_status?: Database["public"]["Enums"]["zatca_status"]
          zatca_uuid?: string | null
        }
        Update: {
          cash_collection_id?: string | null
          claim_id?: string | null
          counterparty_id?: string | null
          counterparty_type?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_minor?: number
          gross_minor?: number
          id?: string
          invoice_no?: string | null
          invoice_type?: Database["public"]["Enums"]["tax_invoice_type"]
          irn?: string | null
          issued_at?: string | null
          parent_invoice_id?: string | null
          reporting_box?: Database["public"]["Enums"]["tax_reporting_box"]
          taxable_base_minor?: number
          tenant_id?: string
          total_minor?: number
          updated_at?: string
          vat_minor?: number
          vat_rate?: number
          zatca_hash?: string | null
          zatca_last_error?: string | null
          zatca_prev_hash?: string | null
          zatca_qr?: string | null
          zatca_signed_xml?: string | null
          zatca_status?: Database["public"]["Enums"]["zatca_status"]
          zatca_uuid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_invoice_cash_collection_id_fkey"
            columns: ["cash_collection_id"]
            isOneToOne: false
            referencedRelation: "cash_collection"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tax_invoice_parent_invoice_id_fkey"
            columns: ["parent_invoice_id"]
            isOneToOne: false
            referencedRelation: "tax_invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_invoice_line: {
        Row: {
          created_at: string
          description: string | null
          discount_minor: number
          id: string
          invoice_id: string
          qty: number
          reporting_code: string | null
          seq: number
          service_code: string | null
          taxable_minor: number
          tenant_id: string
          unit_price_minor: number
          vat_minor: number
          vat_rate: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_minor?: number
          id?: string
          invoice_id: string
          qty?: number
          reporting_code?: string | null
          seq?: number
          service_code?: string | null
          taxable_minor?: number
          tenant_id: string
          unit_price_minor?: number
          vat_minor?: number
          vat_rate?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_minor?: number
          id?: string
          invoice_id?: string
          qty?: number
          reporting_code?: string | null
          seq?: number
          service_code?: string | null
          taxable_minor?: number
          tenant_id?: string
          unit_price_minor?: number
          vat_minor?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_invoice_line_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "tax_invoice"
            referencedColumns: ["id"]
          },
        ]
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
      tpa: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          id: string
          name: string
          nphies_tpa_id: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          nphies_tpa_id: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          nphies_tpa_id?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tpa_tenant_id_fkey"
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
      visit_eligibility: {
        Row: {
          beneficiary_id: string
          checked_at: string | null
          class_id: string | null
          created_at: string
          created_by: string | null
          eligibility_ref_no: string | null
          eligibility_type: string
          encounter_id: string | null
          financial_type: string
          id: string
          membership_id: string | null
          network_id: string | null
          override_reason: string | null
          payer_id: string | null
          policy_id: string | null
          reason: string | null
          result_payload: Json | null
          status: string
          tenant_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          beneficiary_id: string
          checked_at?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          eligibility_ref_no?: string | null
          eligibility_type?: string
          encounter_id?: string | null
          financial_type?: string
          id?: string
          membership_id?: string | null
          network_id?: string | null
          override_reason?: string | null
          payer_id?: string | null
          policy_id?: string | null
          reason?: string | null
          result_payload?: Json | null
          status?: string
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          beneficiary_id?: string
          checked_at?: string | null
          class_id?: string | null
          created_at?: string
          created_by?: string | null
          eligibility_ref_no?: string | null
          eligibility_type?: string
          encounter_id?: string | null
          financial_type?: string
          id?: string
          membership_id?: string | null
          network_id?: string | null
          override_reason?: string | null
          payer_id?: string | null
          policy_id?: string | null
          reason?: string | null
          result_payload?: Json | null
          status?: string
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "visit_eligibility_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_eligibility_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "visit_eligibility_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "insurance_class"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_eligibility_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_eligibility_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "visit_eligibility_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "visit_eligibility_network_id_fkey"
            columns: ["network_id"]
            isOneToOne: false
            referencedRelation: "network"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_eligibility_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payer"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_eligibility_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "policy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "visit_eligibility_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      vitals_observation: {
        Row: {
          beneficiary_id: string
          bmi: number | null
          body_position: string | null
          body_site: string | null
          created_at: string
          created_by: string | null
          diastolic_mmhg: number | null
          encounter_id: string
          glucose_mmol_l: number | null
          heart_rate_bpm: number | null
          height_cm: number | null
          id: string
          news2_score: number | null
          notes: string | null
          pain_score: number | null
          recorded_at: string
          recorded_by: string | null
          respiratory_rate_bpm: number | null
          spo2_pct: number | null
          systolic_mmhg: number | null
          temperature_c: number | null
          tenant_id: string
          updated_at: string
          updated_by: string | null
          weight_kg: number | null
        }
        Insert: {
          beneficiary_id: string
          bmi?: number | null
          body_position?: string | null
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          diastolic_mmhg?: number | null
          encounter_id: string
          glucose_mmol_l?: number | null
          heart_rate_bpm?: number | null
          height_cm?: number | null
          id?: string
          news2_score?: number | null
          notes?: string | null
          pain_score?: number | null
          recorded_at?: string
          recorded_by?: string | null
          respiratory_rate_bpm?: number | null
          spo2_pct?: number | null
          systolic_mmhg?: number | null
          temperature_c?: number | null
          tenant_id: string
          updated_at?: string
          updated_by?: string | null
          weight_kg?: number | null
        }
        Update: {
          beneficiary_id?: string
          bmi?: number | null
          body_position?: string | null
          body_site?: string | null
          created_at?: string
          created_by?: string | null
          diastolic_mmhg?: number | null
          encounter_id?: string
          glucose_mmol_l?: number | null
          heart_rate_bpm?: number | null
          height_cm?: number | null
          id?: string
          news2_score?: number | null
          notes?: string | null
          pain_score?: number | null
          recorded_at?: string
          recorded_by?: string | null
          respiratory_rate_bpm?: number | null
          spo2_pct?: number | null
          systolic_mmhg?: number | null
          temperature_c?: number | null
          tenant_id?: string
          updated_at?: string
          updated_by?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vitals_observation_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_observation_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["beneficiary_id"]
          },
          {
            foreignKeyName: "vitals_observation_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vitals_observation_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "vitals_observation_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "vitals_observation_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_txn: {
        Row: {
          amount_minor: number
          created_at: string
          created_by: string | null
          direction: string
          id: string
          reason: string | null
          related_exception_id: string | null
          source: string
          source_ref_id: string | null
          tenant_id: string
          wallet_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          reason?: string | null
          related_exception_id?: string | null
          source: string
          source_ref_id?: string | null
          tenant_id: string
          wallet_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          reason?: string | null
          related_exception_id?: string | null
          source?: string
          source_ref_id?: string | null
          tenant_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_txn_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "patient_wallet"
            referencedColumns: ["id"]
          },
        ]
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
          hashed_secret: string | null
          id: string
          owner_id: string
          secret_prefix: string | null
          url: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          events?: string[]
          hashed_secret?: string | null
          id?: string
          owner_id: string
          secret_prefix?: string | null
          url: string
        }
        Update: {
          active?: boolean
          created_at?: string
          events?: string[]
          hashed_secret?: string | null
          id?: string
          owner_id?: string
          secret_prefix?: string | null
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
      public_partners: {
        Row: {
          city: string | null
          featured_order: number | null
          logo_url: string | null
          name: string | null
          type: string | null
        }
        Insert: {
          city?: string | null
          featured_order?: never
          logo_url?: string | null
          name?: never
          type?: string | null
        }
        Update: {
          city?: string | null
          featured_order?: never
          logo_url?: string | null
          name?: never
          type?: string | null
        }
        Relationships: []
      }
      v_clinical_forms_worklist: {
        Row: {
          assigned_role: string | null
          class: string | null
          classification: string | null
          code: string | null
          cosign_required: boolean | null
          cosigned_at: string | null
          created_at: string | null
          due_at: string | null
          encounter_id: string | null
          form_def_id: string | null
          gate_type: string | null
          instance_id: string | null
          is_overdue: boolean | null
          mandatory: boolean | null
          overdue_days: number | null
          status: string | null
          submitted_at: string | null
          tenant_id: string | null
          title: string | null
          trigger_type: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clinical_form_instance_form_def_id_fkey"
            columns: ["form_def_id"]
            isOneToOne: false
            referencedRelation: "form_def"
            referencedColumns: ["id"]
          },
        ]
      }
      v_doctor_worklist: {
        Row: {
          age: number | null
          attending_physician: string | null
          beneficiary_id: string | null
          billed_orders: number | null
          class: string | null
          discharge_disposition: string | null
          dnr_flag: boolean | null
          ems_status: string | null
          encounter_id: string | null
          encounter_number: string | null
          gender: string | null
          is_vip: boolean | null
          isolation_precaution: string | null
          journey_state: string | null
          locked_orders: number | null
          mrn: string | null
          name: string | null
          pending_authorizations: number | null
          period_start: string | null
          released_orders: number | null
          status: string | null
          tenant_id: string | null
          token: string | null
          unread_rcm_comms: number | null
          waiting_seconds: number | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_him_comm_thread: {
        Row: {
          author: string | null
          author_name: string | null
          body: string | null
          channel: string | null
          coding_row_id: string | null
          created_at: string | null
          direction: string | null
          encounter_id: string | null
          form_instance_id: string | null
          id: string | null
          is_read_by_me: boolean | null
          payload: Json | null
          read_at: string | null
          read_by: string | null
          tenant_id: string | null
          unread: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "him_communication_coding_row_id_fkey"
            columns: ["coding_row_id"]
            isOneToOne: false
            referencedRelation: "clinical_coding"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "him_communication_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "him_communication_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "him_communication_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "him_communication_form_instance_id_fkey"
            columns: ["form_instance_id"]
            isOneToOne: false
            referencedRelation: "clinical_form_instance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "him_communication_form_instance_id_fkey"
            columns: ["form_instance_id"]
            isOneToOne: false
            referencedRelation: "v_clinical_forms_worklist"
            referencedColumns: ["instance_id"]
          },
        ]
      }
      v_nursing_workbench: {
        Row: {
          assessments_due: number | null
          bed: string | null
          care_tasks_open: number | null
          class: string | null
          emar_due: number | null
          encounter_id: string | null
          encounter_number: string | null
          latest_vitals_at: string | null
          mrn: string | null
          name: string | null
          tenant_id: string | null
          unread_rcm_comms: number | null
          vitals_due: number | null
          ward: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "corporate_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_order_item_gate: {
        Row: {
          charge_item_id: string | null
          encounter_id: string | null
          exception_id: string | null
          gate_state: Database["public"]["Enums"]["rcm_gate_state"] | null
          net_minor: number | null
          order_item_id: string | null
          order_item_table: string | null
          pricing_mode:
            | Database["public"]["Enums"]["charge_pricing_mode"]
            | null
          reason_code:
            | Database["public"]["Enums"]["rcm_gate_reason_code"]
            | null
          tenant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charge_item_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounter"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charge_item_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_doctor_worklist"
            referencedColumns: ["encounter_id"]
          },
          {
            foreignKeyName: "charge_item_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "v_nursing_workbench"
            referencedColumns: ["encounter_id"]
          },
        ]
      }
      v_rcm_comm_thread: {
        Row: {
          author_role: string | null
          created_at: string | null
          direction: string | null
          encounter_id: string | null
          id: string | null
          kind: string | null
          message: string | null
          order_item_ref: string | null
          status_pushed: string | null
          tenant_id: string | null
          unread: boolean | null
        }
        Relationships: []
      }
    }
    Functions: {
      _order_item_encounter: {
        Args: { _order_id: string; _tbl: string }
        Returns: string
      }
      _order_item_preauth_required: {
        Args: { _id: string; _tbl: string }
        Returns: boolean
      }
      admission_gate_open: { Args: { _admission_id: string }; Returns: boolean }
      bump_site_content_version: { Args: { _actor?: string }; Returns: number }
      charge_is_billed: {
        Args: { _id: string; _tbl: string }
        Returns: boolean
      }
      encounter_advance_journey: {
        Args: { _enc_id: string; _to: string }
        Returns: undefined
      }
      encounter_journey_rank: { Args: { _state: string }; Returns: number }
      encounter_maybe_advance_documented: {
        Args: { _enc_id: string }
        Returns: undefined
      }
      forms_gate_open: {
        Args: {
          _encounter_id: string
          _order_item_id?: string
          _order_item_table?: string
        }
        Returns: boolean
      }
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
      is_tenant_admin: {
        Args: { _tenant: string; _user_id: string }
        Returns: boolean
      }
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
      rcm_admin_config_get: {
        Args: { _default?: Json; _key: string; _tenant: string }
        Returns: Json
      }
      wallet_apply_txn: {
        Args: { _delta_minor: number; _wallet_id: string }
        Returns: number
      }
    }
    Enums: {
      admission_status:
        | "requested"
        | "authorized"
        | "lounge"
        | "admitted"
        | "discharged"
        | "cancelled"
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
      auth_scope:
        | "package"
        | "blood"
        | "room_board"
        | "transfer"
        | "los_extension"
        | "order"
        | "prescription"
      authorization_status:
        | "new"
        | "scrubbing"
        | "ready_to_submit"
        | "submitted"
        | "queued_at_payer"
        | "in_review"
        | "more_info_requested"
        | "approved"
        | "partially_approved"
        | "rejected"
        | "expired"
        | "cancelled"
        | "appealed"
        | "appeal_approved"
        | "appeal_rejected"
        | "converted_to_self_pay"
        | "closed"
      batch_integration_type: "moh" | "gosi" | "cchi" | "direct" | "self_pay"
      batch_status: "open" | "submitting" | "submitted" | "closed" | "cancelled"
      bed_transfer_status:
        | "requested"
        | "preauth_pending"
        | "approved"
        | "rejected"
        | "executed"
        | "cancelled"
      booking_source:
        | "opd"
        | "referral"
        | "follow_up"
        | "call_center"
        | "portal"
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
      cash_method: "cash" | "pos" | "bank_transfer" | "cheque" | "online"
      cash_session_status: "open" | "closed" | "reconciled"
      cash_status: "draft" | "posted" | "voided"
      charge_mode: "new_consult" | "follow_up" | "series" | "no_charge"
      charge_pricing_mode: "cash" | "insured" | "drg_bundled"
      charge_status:
        | "ordered"
        | "collected"
        | "in_progress"
        | "resulted"
        | "dispensed"
        | "cancelled"
      claim_readiness_status: "ready" | "needs_correction" | "hold"
      clinical_order_status:
        | "ordered"
        | "in_progress"
        | "completed"
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
        | "biller"
        | "front_office"
        | "rcm"
        | "approval_officer"
        | "claims_officer"
        | "finance"
        | "lab_doctor"
        | "bb_technician"
        | "bb_physician"
        | "rad_technician"
        | "or_nurse"
        | "cath_nurse"
        | "anesthetist"
        | "labour_nurse"
        | "nursery_nurse"
        | "injection_staff"
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
      denial_category: "technical" | "medical"
      denial_finance_disposition: "none" | "write_off" | "adjustment"
      denial_status:
        | "pending_action"
        | "in_correction"
        | "accepted"
        | "resubmitted"
        | "resolved"
        | "disposed"
      deposit_method: "cash" | "card" | "bank_transfer" | "wallet" | "insurance"
      deposit_status:
        | "requested"
        | "collected"
        | "applied"
        | "refunded"
        | "cancelled"
        | "held"
        | "partially_applied"
        | "transferred"
      deposit_type:
        | "general"
        | "encounter"
        | "department"
        | "billing_group"
        | "order_item"
        | "caution"
      discharge_stage:
        | "none"
        | "discharge_advice"
        | "discharge_order"
        | "medical_discharge"
        | "financial_discharge"
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
      interface_direction: "inbound" | "outbound" | "bidirectional"
      interface_msg_status:
        | "queued"
        | "sent"
        | "ack"
        | "failed"
        | "retrying"
        | "dead"
      ip_request_type: "surgery" | "procedure" | "cath" | "medical" | "day_case"
      legal_locale: "en" | "ar"
      legal_slug:
        | "privacy-home"
        | "terms-of-service"
        | "hipaa"
        | "patient-rights"
      legal_status: "draft" | "in_review" | "published" | "archived"
      los_ext_status:
        | "requested"
        | "approved"
        | "rejected"
        | "extended"
        | "cancelled"
      mapping_type:
        | "dept_nphies"
        | "cost_erp"
        | "kayan_ext"
        | "order_tariff_payer"
      portal_role:
        | "superadmin"
        | "finance"
        | "call_center"
        | "developer"
        | "analyst"
      preauth_status: "not_required" | "pending" | "approved" | "rejected"
      pricing_rule_scope:
        | "eligibility"
        | "share"
        | "package"
        | "substitution"
        | "drg_outlier"
        | "out_of_network"
        | "referral"
        | "pbm"
      rcm_gate_exception_type:
        | "emergency_override"
        | "partial_deposit_override"
        | "installment_override"
        | "clinical_urgency"
        | "mrp_verbal_order"
        | "newborn_inherit"
        | "ineligibility_workflow"
        | "config_no_auth"
        | "indication_override"
        | "admin_override"
      rcm_gate_reason_code:
        | "ctas_1_2"
        | "ipd_partial_deposit"
        | "er_criticality"
        | "installment_plan"
        | "stat_order"
        | "mrp_unavailable"
        | "newborn_mother_coverage"
        | "referral_pending"
        | "newborn_pending"
        | "emergency_pending"
        | "in_network_no_auth"
        | "pbm_indication_missing"
        | "ip_deposit_below_threshold"
        | "admin_manual"
      rcm_gate_state: "locked" | "released_by_exception" | "billed"
      referral_class: "intra" | "inter_company" | "external" | "cross_encounter"
      referral_status:
        | "draft"
        | "submitted"
        | "accepted"
        | "declined"
        | "completed"
        | "cancelled"
      remittance_match_status: "unmatched" | "matched" | "mismatch" | "manual"
      remittance_source: "interface" | "file_upload"
      remittance_status:
        | "staged"
        | "matching"
        | "matched"
        | "posted"
        | "reconciliation"
        | "closed"
      screening_order_status:
        | "booked"
        | "sample_collected"
        | "results_ready"
        | "certified"
        | "cancelled"
      slot_status: "open" | "held" | "booked" | "blocked" | "cancelled"
      target_kind: "specialty" | "provider" | "facility" | "service"
      tax_invoice_type:
        | "b2b_insurance"
        | "b2c_patient"
        | "direct_company"
        | "credit_note"
        | "debit_note"
      tax_reporting_box:
        | "insurance_output"
        | "patient_output"
        | "direct_output"
        | "refund_adjustment"
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
      visit_source: "walk_in" | "scheduled" | "er_referral" | "ip_followup"
      visit_type:
        | "new_consult"
        | "follow_up"
        | "series"
        | "no_charge"
        | "procedure"
      work_order_status: "open" | "in_progress" | "closed" | "cancelled"
      work_order_type: "preventive" | "corrective"
      zatca_status: "pending" | "cleared" | "reported" | "failed"
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
      admission_status: [
        "requested",
        "authorized",
        "lounge",
        "admitted",
        "discharged",
        "cancelled",
      ],
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
      auth_scope: [
        "package",
        "blood",
        "room_board",
        "transfer",
        "los_extension",
        "order",
        "prescription",
      ],
      authorization_status: [
        "new",
        "scrubbing",
        "ready_to_submit",
        "submitted",
        "queued_at_payer",
        "in_review",
        "more_info_requested",
        "approved",
        "partially_approved",
        "rejected",
        "expired",
        "cancelled",
        "appealed",
        "appeal_approved",
        "appeal_rejected",
        "converted_to_self_pay",
        "closed",
      ],
      batch_integration_type: ["moh", "gosi", "cchi", "direct", "self_pay"],
      batch_status: ["open", "submitting", "submitted", "closed", "cancelled"],
      bed_transfer_status: [
        "requested",
        "preauth_pending",
        "approved",
        "rejected",
        "executed",
        "cancelled",
      ],
      booking_source: ["opd", "referral", "follow_up", "call_center", "portal"],
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
      cash_method: ["cash", "pos", "bank_transfer", "cheque", "online"],
      cash_session_status: ["open", "closed", "reconciled"],
      cash_status: ["draft", "posted", "voided"],
      charge_mode: ["new_consult", "follow_up", "series", "no_charge"],
      charge_pricing_mode: ["cash", "insured", "drg_bundled"],
      charge_status: [
        "ordered",
        "collected",
        "in_progress",
        "resulted",
        "dispensed",
        "cancelled",
      ],
      claim_readiness_status: ["ready", "needs_correction", "hold"],
      clinical_order_status: [
        "ordered",
        "in_progress",
        "completed",
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
        "biller",
        "front_office",
        "rcm",
        "approval_officer",
        "claims_officer",
        "finance",
        "lab_doctor",
        "bb_technician",
        "bb_physician",
        "rad_technician",
        "or_nurse",
        "cath_nurse",
        "anesthetist",
        "labour_nurse",
        "nursery_nurse",
        "injection_staff",
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
      denial_category: ["technical", "medical"],
      denial_finance_disposition: ["none", "write_off", "adjustment"],
      denial_status: [
        "pending_action",
        "in_correction",
        "accepted",
        "resubmitted",
        "resolved",
        "disposed",
      ],
      deposit_method: ["cash", "card", "bank_transfer", "wallet", "insurance"],
      deposit_status: [
        "requested",
        "collected",
        "applied",
        "refunded",
        "cancelled",
        "held",
        "partially_applied",
        "transferred",
      ],
      deposit_type: [
        "general",
        "encounter",
        "department",
        "billing_group",
        "order_item",
        "caution",
      ],
      discharge_stage: [
        "none",
        "discharge_advice",
        "discharge_order",
        "medical_discharge",
        "financial_discharge",
      ],
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
      interface_direction: ["inbound", "outbound", "bidirectional"],
      interface_msg_status: [
        "queued",
        "sent",
        "ack",
        "failed",
        "retrying",
        "dead",
      ],
      ip_request_type: ["surgery", "procedure", "cath", "medical", "day_case"],
      legal_locale: ["en", "ar"],
      legal_slug: [
        "privacy-home",
        "terms-of-service",
        "hipaa",
        "patient-rights",
      ],
      legal_status: ["draft", "in_review", "published", "archived"],
      los_ext_status: [
        "requested",
        "approved",
        "rejected",
        "extended",
        "cancelled",
      ],
      mapping_type: [
        "dept_nphies",
        "cost_erp",
        "kayan_ext",
        "order_tariff_payer",
      ],
      portal_role: [
        "superadmin",
        "finance",
        "call_center",
        "developer",
        "analyst",
      ],
      preauth_status: ["not_required", "pending", "approved", "rejected"],
      pricing_rule_scope: [
        "eligibility",
        "share",
        "package",
        "substitution",
        "drg_outlier",
        "out_of_network",
        "referral",
        "pbm",
      ],
      rcm_gate_exception_type: [
        "emergency_override",
        "partial_deposit_override",
        "installment_override",
        "clinical_urgency",
        "mrp_verbal_order",
        "newborn_inherit",
        "ineligibility_workflow",
        "config_no_auth",
        "indication_override",
        "admin_override",
      ],
      rcm_gate_reason_code: [
        "ctas_1_2",
        "ipd_partial_deposit",
        "er_criticality",
        "installment_plan",
        "stat_order",
        "mrp_unavailable",
        "newborn_mother_coverage",
        "referral_pending",
        "newborn_pending",
        "emergency_pending",
        "in_network_no_auth",
        "pbm_indication_missing",
        "ip_deposit_below_threshold",
        "admin_manual",
      ],
      rcm_gate_state: ["locked", "released_by_exception", "billed"],
      referral_class: ["intra", "inter_company", "external", "cross_encounter"],
      referral_status: [
        "draft",
        "submitted",
        "accepted",
        "declined",
        "completed",
        "cancelled",
      ],
      remittance_match_status: ["unmatched", "matched", "mismatch", "manual"],
      remittance_source: ["interface", "file_upload"],
      remittance_status: [
        "staged",
        "matching",
        "matched",
        "posted",
        "reconciliation",
        "closed",
      ],
      screening_order_status: [
        "booked",
        "sample_collected",
        "results_ready",
        "certified",
        "cancelled",
      ],
      slot_status: ["open", "held", "booked", "blocked", "cancelled"],
      target_kind: ["specialty", "provider", "facility", "service"],
      tax_invoice_type: [
        "b2b_insurance",
        "b2c_patient",
        "direct_company",
        "credit_note",
        "debit_note",
      ],
      tax_reporting_box: [
        "insurance_output",
        "patient_output",
        "direct_output",
        "refund_adjustment",
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
      visit_source: ["walk_in", "scheduled", "er_referral", "ip_followup"],
      visit_type: [
        "new_consult",
        "follow_up",
        "series",
        "no_charge",
        "procedure",
      ],
      work_order_status: ["open", "in_progress", "closed", "cancelled"],
      work_order_type: ["preventive", "corrective"],
      zatca_status: ["pending", "cleared", "reported", "failed"],
    },
  },
} as const
