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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      achievement_unlocks: {
        Row: {
          achievement_id: string
          id: string
          metadata: Json | null
          notified: boolean | null
          progress: number | null
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          metadata?: Json | null
          notified?: boolean | null
          progress?: number | null
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          metadata?: Json | null
          notified?: boolean | null
          progress?: number | null
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "achievement_unlocks_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      achievements: {
        Row: {
          category: string
          created_at: string
          description: string
          icon: string
          id: string
          is_active: boolean | null
          is_hidden: boolean | null
          name: string
          points: number
          requirement_meta: Json | null
          requirement_type: string
          requirement_value: number | null
          sort_order: number | null
          tier: string
        }
        Insert: {
          category: string
          created_at?: string
          description: string
          icon?: string
          id: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          name: string
          points?: number
          requirement_meta?: Json | null
          requirement_type: string
          requirement_value?: number | null
          sort_order?: number | null
          tier?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          icon?: string
          id?: string
          is_active?: boolean | null
          is_hidden?: boolean | null
          name?: string
          points?: number
          requirement_meta?: Json | null
          requirement_type?: string
          requirement_value?: number | null
          sort_order?: number | null
          tier?: string
        }
        Relationships: []
      }
      activities: {
        Row: {
          accessibility_info: Json | null
          best_times: Json | null
          booking_required: boolean | null
          booking_url: string | null
          category: string | null
          coordinates: Json | null
          created_at: string
          crowd_levels: string | null
          description: string | null
          destination_id: string
          duration_minutes: number | null
          id: string
          image_url: string | null
          name: string
          price_range: Json | null
          tags: string | null
          updated_at: string
        }
        Insert: {
          accessibility_info?: Json | null
          best_times?: Json | null
          booking_required?: boolean | null
          booking_url?: string | null
          category?: string | null
          coordinates?: Json | null
          created_at?: string
          crowd_levels?: string | null
          description?: string | null
          destination_id: string
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          name: string
          price_range?: Json | null
          tags?: string | null
          updated_at?: string
        }
        Update: {
          accessibility_info?: Json | null
          best_times?: Json | null
          booking_required?: boolean | null
          booking_url?: string | null
          category?: string | null
          coordinates?: Json | null
          created_at?: string
          crowd_levels?: string | null
          description?: string | null
          destination_id?: string
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          name?: string
          price_range?: Json | null
          tags?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      activity_catalog: {
        Row: {
          ai_generated: boolean | null
          category: string | null
          cost_usd: number | null
          created_at: string
          description: string | null
          destination_id: string | null
          estimated_duration_hours: number | null
          id: string
          location: Json | null
          source: string | null
          title: string
          updated_at: string
        }
        Insert: {
          ai_generated?: boolean | null
          category?: string | null
          cost_usd?: number | null
          created_at?: string
          description?: string | null
          destination_id?: string | null
          estimated_duration_hours?: number | null
          id?: string
          location?: Json | null
          source?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          ai_generated?: boolean | null
          category?: string | null
          cost_usd?: number | null
          created_at?: string
          description?: string | null
          destination_id?: string | null
          estimated_duration_hours?: number | null
          id?: string
          location?: Json | null
          source?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_costs: {
        Row: {
          activity_id: string
          category: string
          confidence: string | null
          cost_per_person_local: number | null
          cost_per_person_usd: number
          cost_reference_id: string | null
          created_at: string | null
          day_number: number
          id: string
          is_paid: boolean | null
          local_currency: string | null
          notes: string | null
          num_travelers: number
          paid_amount_usd: number | null
          paid_at: string | null
          source: string
          total_cost_usd: number | null
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          activity_id: string
          category: string
          confidence?: string | null
          cost_per_person_local?: number | null
          cost_per_person_usd: number
          cost_reference_id?: string | null
          created_at?: string | null
          day_number: number
          id?: string
          is_paid?: boolean | null
          local_currency?: string | null
          notes?: string | null
          num_travelers?: number
          paid_amount_usd?: number | null
          paid_at?: string | null
          source?: string
          total_cost_usd?: number | null
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          activity_id?: string
          category?: string
          confidence?: string | null
          cost_per_person_local?: number | null
          cost_per_person_usd?: number
          cost_reference_id?: string | null
          created_at?: string | null
          day_number?: number
          id?: string
          is_paid?: boolean | null
          local_currency?: string | null
          notes?: string | null
          num_travelers?: number
          paid_amount_usd?: number | null
          paid_at?: string | null
          source?: string
          total_cost_usd?: number | null
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_costs_cost_reference_id_fkey"
            columns: ["cost_reference_id"]
            isOneToOne: false
            referencedRelation: "cost_reference"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_feedback: {
        Row: {
          activity_category: string | null
          activity_id: string
          activity_type: string | null
          created_at: string
          destination: string | null
          feedback_tags: string[] | null
          feedback_text: string | null
          id: string
          personalization_tags: string[] | null
          rating: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_category?: string | null
          activity_id: string
          activity_type?: string | null
          created_at?: string
          destination?: string | null
          feedback_tags?: string[] | null
          feedback_text?: string | null
          id?: string
          personalization_tags?: string[] | null
          rating: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_category?: string | null
          activity_id?: string
          activity_type?: string | null
          created_at?: string
          destination?: string | null
          feedback_tags?: string[] | null
          feedback_text?: string | null
          id?: string
          personalization_tags?: string[] | null
          rating?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "activity_feedback_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_quality_scores: {
        Row: {
          activity_id: string | null
          archetype_breakdown: Json
          average_rating: number | null
          category: string | null
          common_tips: string[] | null
          created_at: string
          destination: string
          id: string
          last_updated_at: string
          rating_distribution: Json
          total_ratings: number
          venue_id: string | null
          venue_name: string
          worth_price_score: number | null
        }
        Insert: {
          activity_id?: string | null
          archetype_breakdown?: Json
          average_rating?: number | null
          category?: string | null
          common_tips?: string[] | null
          created_at?: string
          destination: string
          id?: string
          last_updated_at?: string
          rating_distribution?: Json
          total_ratings?: number
          venue_id?: string | null
          venue_name: string
          worth_price_score?: number | null
        }
        Update: {
          activity_id?: string | null
          archetype_breakdown?: Json
          average_rating?: number | null
          category?: string | null
          common_tips?: string[] | null
          created_at?: string
          destination?: string
          id?: string
          last_updated_at?: string
          rating_distribution?: Json
          total_ratings?: number
          venue_id?: string | null
          venue_name?: string
          worth_price_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_quality_scores_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_accounts: {
        Row: {
          account_type: Database["public"]["Enums"]["agency_account_type"]
          agent_id: string
          billing_address: Json | null
          billing_email: string | null
          billing_phone: string | null
          company_name: string | null
          created_at: string
          id: string
          intake_enabled: boolean | null
          intake_token: string | null
          lifetime_value_cents: number | null
          name: string
          notes: string | null
          referral_source: string | null
          tags: string[] | null
          total_revenue_cents: number | null
          total_trips: number | null
          updated_at: string
        }
        Insert: {
          account_type?: Database["public"]["Enums"]["agency_account_type"]
          agent_id: string
          billing_address?: Json | null
          billing_email?: string | null
          billing_phone?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          intake_enabled?: boolean | null
          intake_token?: string | null
          lifetime_value_cents?: number | null
          name: string
          notes?: string | null
          referral_source?: string | null
          tags?: string[] | null
          total_revenue_cents?: number | null
          total_trips?: number | null
          updated_at?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["agency_account_type"]
          agent_id?: string
          billing_address?: Json | null
          billing_email?: string | null
          billing_phone?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          intake_enabled?: boolean | null
          intake_token?: string | null
          lifetime_value_cents?: number | null
          name?: string
          notes?: string | null
          referral_source?: string | null
          tags?: string[] | null
          total_revenue_cents?: number | null
          total_trips?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      agency_booking_segments: {
        Row: {
          agent_id: string
          aircraft_type: string | null
          arc_report_number: string | null
          arc_settlement_date: string | null
          arc_submission_date: string | null
          baggage_allowance: string | null
          booking_reference: string | null
          booking_source: Database["public"]["Enums"]["booking_source"] | null
          cabin_class: string | null
          cancellation_deadline: string | null
          cancellation_policy: string | null
          check_in_time: string | null
          check_out_time: string | null
          commission_cents: number | null
          commission_expected_cents: number | null
          commission_rate: number | null
          commission_received_at: string | null
          commission_received_cents: number | null
          confirmation_number: string | null
          created_at: string
          currency: string | null
          destination: string | null
          destination_code: string | null
          end_date: string | null
          end_time: string | null
          flight_number: string | null
          id: string
          is_informational_only: boolean | null
          is_refundable: boolean | null
          net_cost_cents: number | null
          notes: string | null
          origin: string | null
          origin_code: string | null
          payment_deadline: string | null
          penalty_amount_cents: number | null
          room_count: number | null
          room_type: string | null
          segment_details: Json | null
          segment_type: Database["public"]["Enums"]["booking_segment_type"]
          sell_price_cents: number | null
          settlement_type:
            | Database["public"]["Enums"]["booking_settlement_type"]
            | null
          start_date: string | null
          start_time: string | null
          supplier_contact: string | null
          supplier_id: string | null
          supplier_paid_at: string | null
          supplier_paid_cents: number | null
          support_instructions: string | null
          terminal_info: Json | null
          ticketing_deadline: string | null
          timezone_info: string | null
          travelers_on_segment: string[] | null
          trip_id: string
          updated_at: string
          vendor_code: string | null
          vendor_name: string | null
        }
        Insert: {
          agent_id: string
          aircraft_type?: string | null
          arc_report_number?: string | null
          arc_settlement_date?: string | null
          arc_submission_date?: string | null
          baggage_allowance?: string | null
          booking_reference?: string | null
          booking_source?: Database["public"]["Enums"]["booking_source"] | null
          cabin_class?: string | null
          cancellation_deadline?: string | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          commission_cents?: number | null
          commission_expected_cents?: number | null
          commission_rate?: number | null
          commission_received_at?: string | null
          commission_received_cents?: number | null
          confirmation_number?: string | null
          created_at?: string
          currency?: string | null
          destination?: string | null
          destination_code?: string | null
          end_date?: string | null
          end_time?: string | null
          flight_number?: string | null
          id?: string
          is_informational_only?: boolean | null
          is_refundable?: boolean | null
          net_cost_cents?: number | null
          notes?: string | null
          origin?: string | null
          origin_code?: string | null
          payment_deadline?: string | null
          penalty_amount_cents?: number | null
          room_count?: number | null
          room_type?: string | null
          segment_details?: Json | null
          segment_type: Database["public"]["Enums"]["booking_segment_type"]
          sell_price_cents?: number | null
          settlement_type?:
            | Database["public"]["Enums"]["booking_settlement_type"]
            | null
          start_date?: string | null
          start_time?: string | null
          supplier_contact?: string | null
          supplier_id?: string | null
          supplier_paid_at?: string | null
          supplier_paid_cents?: number | null
          support_instructions?: string | null
          terminal_info?: Json | null
          ticketing_deadline?: string | null
          timezone_info?: string | null
          travelers_on_segment?: string[] | null
          trip_id: string
          updated_at?: string
          vendor_code?: string | null
          vendor_name?: string | null
        }
        Update: {
          agent_id?: string
          aircraft_type?: string | null
          arc_report_number?: string | null
          arc_settlement_date?: string | null
          arc_submission_date?: string | null
          baggage_allowance?: string | null
          booking_reference?: string | null
          booking_source?: Database["public"]["Enums"]["booking_source"] | null
          cabin_class?: string | null
          cancellation_deadline?: string | null
          cancellation_policy?: string | null
          check_in_time?: string | null
          check_out_time?: string | null
          commission_cents?: number | null
          commission_expected_cents?: number | null
          commission_rate?: number | null
          commission_received_at?: string | null
          commission_received_cents?: number | null
          confirmation_number?: string | null
          created_at?: string
          currency?: string | null
          destination?: string | null
          destination_code?: string | null
          end_date?: string | null
          end_time?: string | null
          flight_number?: string | null
          id?: string
          is_informational_only?: boolean | null
          is_refundable?: boolean | null
          net_cost_cents?: number | null
          notes?: string | null
          origin?: string | null
          origin_code?: string | null
          payment_deadline?: string | null
          penalty_amount_cents?: number | null
          room_count?: number | null
          room_type?: string | null
          segment_details?: Json | null
          segment_type?: Database["public"]["Enums"]["booking_segment_type"]
          sell_price_cents?: number | null
          settlement_type?:
            | Database["public"]["Enums"]["booking_settlement_type"]
            | null
          start_date?: string | null
          start_time?: string | null
          supplier_contact?: string | null
          supplier_id?: string | null
          supplier_paid_at?: string | null
          supplier_paid_cents?: number | null
          support_instructions?: string | null
          terminal_info?: Json | null
          ticketing_deadline?: string | null
          timezone_info?: string | null
          travelers_on_segment?: string[] | null
          trip_id?: string
          updated_at?: string
          vendor_code?: string | null
          vendor_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_booking_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_booking_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_communications: {
        Row: {
          account_id: string | null
          agent_id: string
          approval_response: string | null
          approved_item_reference: string | null
          attachments: Json | null
          body: string | null
          cc_addresses: string[] | null
          communication_type: Database["public"]["Enums"]["communication_type"]
          created_at: string
          external_message_id: string | null
          from_address: string | null
          id: string
          is_approval: boolean | null
          is_incoming: boolean | null
          sent_at: string | null
          subject: string | null
          template_used: string | null
          to_addresses: string[] | null
          traveler_id: string | null
          trip_id: string | null
        }
        Insert: {
          account_id?: string | null
          agent_id: string
          approval_response?: string | null
          approved_item_reference?: string | null
          attachments?: Json | null
          body?: string | null
          cc_addresses?: string[] | null
          communication_type: Database["public"]["Enums"]["communication_type"]
          created_at?: string
          external_message_id?: string | null
          from_address?: string | null
          id?: string
          is_approval?: boolean | null
          is_incoming?: boolean | null
          sent_at?: string | null
          subject?: string | null
          template_used?: string | null
          to_addresses?: string[] | null
          traveler_id?: string | null
          trip_id?: string | null
        }
        Update: {
          account_id?: string | null
          agent_id?: string
          approval_response?: string | null
          approved_item_reference?: string | null
          attachments?: Json | null
          body?: string | null
          cc_addresses?: string[] | null
          communication_type?: Database["public"]["Enums"]["communication_type"]
          created_at?: string
          external_message_id?: string | null
          from_address?: string | null
          id?: string
          is_approval?: boolean | null
          is_incoming?: boolean | null
          sent_at?: string | null
          subject?: string | null
          template_used?: string | null
          to_addresses?: string[] | null
          traveler_id?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_communications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_communications_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_communications_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "agency_travelers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_communications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_communications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_documents: {
        Row: {
          account_id: string | null
          agent_id: string
          created_at: string
          description: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          expires_at: string | null
          file_name: string | null
          file_size_bytes: number | null
          file_url: string
          id: string
          is_client_visible: boolean | null
          mime_type: string | null
          name: string
          traveler_id: string | null
          trip_id: string | null
          uploaded_at: string
        }
        Insert: {
          account_id?: string | null
          agent_id: string
          created_at?: string
          description?: string | null
          document_type: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url: string
          id?: string
          is_client_visible?: boolean | null
          mime_type?: string | null
          name: string
          traveler_id?: string | null
          trip_id?: string | null
          uploaded_at?: string
        }
        Update: {
          account_id?: string | null
          agent_id?: string
          created_at?: string
          description?: string | null
          document_type?: Database["public"]["Enums"]["document_type"]
          expires_at?: string | null
          file_name?: string | null
          file_size_bytes?: number | null
          file_url?: string
          id?: string
          is_client_visible?: boolean | null
          mime_type?: string | null
          name?: string
          traveler_id?: string | null
          trip_id?: string | null
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_documents_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_documents_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "agency_travelers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_documents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_invoices: {
        Row: {
          account_id: string
          agency_fee_cents: number | null
          agent_id: string
          amount_paid_cents: number | null
          balance_due_cents: number | null
          created_at: string
          currency: string | null
          discount_cents: number | null
          due_date: string
          id: string
          internal_notes: string | null
          invoice_number: string
          issue_date: string
          line_items: Json | null
          notes: string | null
          paid_date: string | null
          payment_instructions: string | null
          quote_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id: string | null
          subtotal_cents: number | null
          tax_cents: number | null
          total_cents: number | null
          trip_id: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          account_id: string
          agency_fee_cents?: number | null
          agent_id: string
          amount_paid_cents?: number | null
          balance_due_cents?: number | null
          created_at?: string
          currency?: string | null
          discount_cents?: number | null
          due_date: string
          id?: string
          internal_notes?: string | null
          invoice_number: string
          issue_date?: string
          line_items?: Json | null
          notes?: string | null
          paid_date?: string | null
          payment_instructions?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number | null
          trip_id: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          account_id?: string
          agency_fee_cents?: number | null
          agent_id?: string
          amount_paid_cents?: number | null
          balance_due_cents?: number | null
          created_at?: string
          currency?: string | null
          discount_cents?: number | null
          due_date?: string
          id?: string
          internal_notes?: string | null
          invoice_number?: string
          issue_date?: string
          line_items?: Json | null
          notes?: string | null
          paid_date?: string | null
          payment_instructions?: string | null
          quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"] | null
          stripe_invoice_id?: string | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          total_cents?: number | null
          trip_id?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invoices_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invoices_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "agency_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invoices_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_invoices_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_payment_schedules: {
        Row: {
          agent_id: string
          amount_cents: number
          created_at: string
          description: string
          due_date: string
          id: string
          invoice_id: string | null
          is_paid: boolean | null
          notes: string | null
          paid_at: string | null
          payment_id: string | null
          reminder_count: number | null
          reminder_sent_at: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount_cents: number
          created_at?: string
          description: string
          due_date: string
          id?: string
          invoice_id?: string | null
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount_cents?: number
          created_at?: string
          description?: string
          due_date?: string
          id?: string
          invoice_id?: string | null
          is_paid?: boolean | null
          notes?: string | null
          paid_at?: string | null
          payment_id?: string | null
          reminder_count?: number | null
          reminder_sent_at?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_payment_schedules_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "agency_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payment_schedules_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "agency_payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payment_schedules_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payment_schedules_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_payments: {
        Row: {
          agent_id: string
          amount_cents: number
          created_at: string
          currency: string | null
          id: string
          invoice_id: string
          notes: string | null
          payment_date: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url: string | null
          refund_amount_cents: number | null
          refunded_at: string | null
          status: string | null
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          transaction_reference: string | null
          trip_id: string
        }
        Insert: {
          agent_id: string
          amount_cents: number
          created_at?: string
          currency?: string | null
          id?: string
          invoice_id: string
          notes?: string | null
          payment_date?: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_reference?: string | null
          trip_id: string
        }
        Update: {
          agent_id?: string
          amount_cents?: number
          created_at?: string
          currency?: string | null
          id?: string
          invoice_id?: string
          notes?: string | null
          payment_date?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_url?: string | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          status?: string | null
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          transaction_reference?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "agency_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_quotes: {
        Row: {
          agency_fee_cents: number | null
          agent_id: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          currency: string | null
          description: string | null
          discount_cents: number | null
          expires_at: string | null
          id: string
          internal_notes: string | null
          is_current_version: boolean | null
          line_items: Json | null
          name: string | null
          notes: string | null
          parent_quote_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["quote_status"] | null
          subtotal_cents: number | null
          tax_cents: number | null
          terms_and_conditions: string | null
          total_cents: number | null
          trip_id: string
          updated_at: string
          version_number: number
          viewed_at: string | null
        }
        Insert: {
          agency_fee_cents?: number | null
          agent_id: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_cents?: number | null
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          is_current_version?: boolean | null
          line_items?: Json | null
          name?: string | null
          notes?: string | null
          parent_quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          terms_and_conditions?: string | null
          total_cents?: number | null
          trip_id: string
          updated_at?: string
          version_number?: number
          viewed_at?: string | null
        }
        Update: {
          agency_fee_cents?: number | null
          agent_id?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          currency?: string | null
          description?: string | null
          discount_cents?: number | null
          expires_at?: string | null
          id?: string
          internal_notes?: string | null
          is_current_version?: boolean | null
          line_items?: Json | null
          name?: string | null
          notes?: string | null
          parent_quote_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["quote_status"] | null
          subtotal_cents?: number | null
          tax_cents?: number | null
          terms_and_conditions?: string | null
          total_cents?: number | null
          trip_id?: string
          updated_at?: string
          version_number?: number
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_quotes_parent_quote_id_fkey"
            columns: ["parent_quote_id"]
            isOneToOne: false
            referencedRelation: "agency_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_suppliers: {
        Row: {
          agent_id: string
          code: string | null
          created_at: string
          default_commission_rate: number | null
          id: string
          is_preferred: boolean | null
          name: string
          notes: string | null
          payment_terms: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          supplier_type: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          agent_id: string
          code?: string | null
          created_at?: string
          default_commission_rate?: number | null
          id?: string
          is_preferred?: boolean | null
          name: string
          notes?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          supplier_type?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          agent_id?: string
          code?: string | null
          created_at?: string
          default_commission_rate?: number | null
          id?: string
          is_preferred?: boolean | null
          name?: string
          notes?: string | null
          payment_terms?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          supplier_type?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      agency_tasks: {
        Row: {
          account_id: string | null
          agent_id: string
          booking_segment_id: string | null
          completed_at: string | null
          created_at: string
          description: string | null
          due_date: string | null
          due_time: string | null
          id: string
          is_system_generated: boolean | null
          priority: Database["public"]["Enums"]["task_priority"] | null
          reminder_date: string | null
          reminder_sent: boolean | null
          status: Database["public"]["Enums"]["task_status"] | null
          task_type: string | null
          title: string
          traveler_id: string | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          account_id?: string | null
          agent_id: string
          booking_segment_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_system_generated?: boolean | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          reminder_date?: string | null
          reminder_sent?: boolean | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string | null
          title: string
          traveler_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string | null
          agent_id?: string
          booking_segment_id?: string | null
          completed_at?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          due_time?: string | null
          id?: string
          is_system_generated?: boolean | null
          priority?: Database["public"]["Enums"]["task_priority"] | null
          reminder_date?: string | null
          reminder_sent?: boolean | null
          status?: Database["public"]["Enums"]["task_status"] | null
          task_type?: string | null
          title?: string
          traveler_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tasks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tasks_booking_segment_id_fkey"
            columns: ["booking_segment_id"]
            isOneToOne: false
            referencedRelation: "agency_booking_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tasks_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "agency_travelers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_tasks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_travelers: {
        Row: {
          account_id: string
          agent_id: string
          airline_loyalty: Json | null
          allergies: string[] | null
          created_at: string
          date_of_birth: string | null
          dietary_restrictions: string[] | null
          email: string | null
          emergency_contact: Json | null
          gender: string | null
          global_entry_number: string | null
          hotel_loyalty: Json | null
          hotel_preferences: Json | null
          id: string
          is_primary_contact: boolean | null
          known_traveler_number: string | null
          legal_first_name: string
          legal_last_name: string
          legal_middle_name: string | null
          meal_preference: string | null
          medical_notes: string | null
          mobility_needs: string | null
          notes: string | null
          passport_country: string | null
          passport_expiry: string | null
          passport_number: string | null
          phone: string | null
          preferred_name: string | null
          redress_number: string | null
          seat_preference: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          agent_id: string
          airline_loyalty?: Json | null
          allergies?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          dietary_restrictions?: string[] | null
          email?: string | null
          emergency_contact?: Json | null
          gender?: string | null
          global_entry_number?: string | null
          hotel_loyalty?: Json | null
          hotel_preferences?: Json | null
          id?: string
          is_primary_contact?: boolean | null
          known_traveler_number?: string | null
          legal_first_name: string
          legal_last_name: string
          legal_middle_name?: string | null
          meal_preference?: string | null
          medical_notes?: string | null
          mobility_needs?: string | null
          notes?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          preferred_name?: string | null
          redress_number?: string | null
          seat_preference?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          agent_id?: string
          airline_loyalty?: Json | null
          allergies?: string[] | null
          created_at?: string
          date_of_birth?: string | null
          dietary_restrictions?: string[] | null
          email?: string | null
          emergency_contact?: Json | null
          gender?: string | null
          global_entry_number?: string | null
          hotel_loyalty?: Json | null
          hotel_preferences?: Json | null
          id?: string
          is_primary_contact?: boolean | null
          known_traveler_number?: string | null
          legal_first_name?: string
          legal_last_name?: string
          legal_middle_name?: string | null
          meal_preference?: string | null
          medical_notes?: string | null
          mobility_needs?: string | null
          notes?: string | null
          passport_country?: string | null
          passport_expiry?: string | null
          passport_number?: string | null
          phone?: string | null
          preferred_name?: string | null
          redress_number?: string | null
          seat_preference?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_travelers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_travelers_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts_intake"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_trip_travelers: {
        Row: {
          created_at: string
          id: string
          is_lead_traveler: boolean | null
          traveler_id: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_lead_traveler?: boolean | null
          traveler_id: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_lead_traveler?: boolean | null
          traveler_id?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_trip_travelers_traveler_id_fkey"
            columns: ["traveler_id"]
            isOneToOne: false
            referencedRelation: "agency_travelers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_trip_travelers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_trip_travelers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      agency_trips: {
        Row: {
          account_id: string
          agent_id: string
          created_at: string
          currency: string | null
          description: string | null
          destination: string | null
          destinations: Json | null
          end_date: string | null
          id: string
          internal_notes: string | null
          itinerary_data: Json | null
          linked_trip_id: string | null
          name: string
          notes: string | null
          pipeline_stage: number | null
          share_enabled: boolean | null
          share_token: string | null
          start_date: string | null
          status: string | null
          tags: string[] | null
          total_commission_cents: number | null
          total_cost_cents: number | null
          total_paid_cents: number | null
          traveler_count: number | null
          trip_type: string | null
          updated_at: string
        }
        Insert: {
          account_id: string
          agent_id: string
          created_at?: string
          currency?: string | null
          description?: string | null
          destination?: string | null
          destinations?: Json | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          itinerary_data?: Json | null
          linked_trip_id?: string | null
          name: string
          notes?: string | null
          pipeline_stage?: number | null
          share_enabled?: boolean | null
          share_token?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          total_commission_cents?: number | null
          total_cost_cents?: number | null
          total_paid_cents?: number | null
          traveler_count?: number | null
          trip_type?: string | null
          updated_at?: string
        }
        Update: {
          account_id?: string
          agent_id?: string
          created_at?: string
          currency?: string | null
          description?: string | null
          destination?: string | null
          destinations?: Json | null
          end_date?: string | null
          id?: string
          internal_notes?: string | null
          itinerary_data?: Json | null
          linked_trip_id?: string | null
          name?: string
          notes?: string | null
          pipeline_stage?: number | null
          share_enabled?: boolean | null
          share_token?: string | null
          start_date?: string | null
          status?: string | null
          tags?: string[] | null
          total_commission_cents?: number | null
          total_cost_cents?: number | null
          total_paid_cents?: number | null
          traveler_count?: number | null
          trip_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_trips_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_trips_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "agency_accounts_intake"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_trips_linked_trip_id_fkey"
            columns: ["linked_trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "agency_trips_linked_trip_id_fkey"
            columns: ["linked_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_clients: {
        Row: {
          agent_id: string
          created_at: string | null
          email: string | null
          first_name: string
          id: string
          last_name: string
          last_trip_date: string | null
          notes: string | null
          phone: string | null
          tags: string[] | null
          total_revenue_cents: number | null
          total_trips: number | null
          travel_preferences: Json | null
          updated_at: string | null
        }
        Insert: {
          agent_id: string
          created_at?: string | null
          email?: string | null
          first_name: string
          id?: string
          last_name: string
          last_trip_date?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          total_revenue_cents?: number | null
          total_trips?: number | null
          travel_preferences?: Json | null
          updated_at?: string | null
        }
        Update: {
          agent_id?: string
          created_at?: string | null
          email?: string | null
          first_name?: string
          id?: string
          last_name?: string
          last_trip_date?: string | null
          notes?: string | null
          phone?: string | null
          tags?: string[] | null
          total_revenue_cents?: number | null
          total_trips?: number | null
          travel_preferences?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      agent_itinerary_library: {
        Row: {
          agent_id: string
          content: Json
          created_at: string
          description: string | null
          destination_hint: string | null
          id: string
          item_type: string
          name: string
          tags: string[] | null
          updated_at: string
          usage_count: number | null
        }
        Insert: {
          agent_id: string
          content: Json
          created_at?: string
          description?: string | null
          destination_hint?: string | null
          id?: string
          item_type: string
          name: string
          tags?: string[] | null
          updated_at?: string
          usage_count?: number | null
        }
        Update: {
          agent_id?: string
          content?: Json
          created_at?: string
          description?: string | null
          destination_hint?: string | null
          id?: string
          item_type?: string
          name?: string
          tags?: string[] | null
          updated_at?: string
          usage_count?: number | null
        }
        Relationships: []
      }
      airport_transfer_fares: {
        Row: {
          airport_code: string | null
          airport_name: string | null
          bus_cost: number | null
          bus_duration_max: number | null
          bus_duration_min: number | null
          bus_notes: string | null
          city: string
          confidence_score: number | null
          created_at: string
          currency: string
          currency_symbol: string
          destination_zone: string | null
          id: string
          last_verified_at: string
          source: string | null
          taxi_cost_max: number | null
          taxi_cost_min: number | null
          taxi_duration_max: number | null
          taxi_duration_min: number | null
          taxi_is_fixed_price: boolean | null
          taxi_notes: string | null
          train_cost: number | null
          train_duration_max: number | null
          train_duration_min: number | null
          train_line: string | null
          train_notes: string | null
          updated_at: string
        }
        Insert: {
          airport_code?: string | null
          airport_name?: string | null
          bus_cost?: number | null
          bus_duration_max?: number | null
          bus_duration_min?: number | null
          bus_notes?: string | null
          city: string
          confidence_score?: number | null
          created_at?: string
          currency?: string
          currency_symbol?: string
          destination_zone?: string | null
          id?: string
          last_verified_at?: string
          source?: string | null
          taxi_cost_max?: number | null
          taxi_cost_min?: number | null
          taxi_duration_max?: number | null
          taxi_duration_min?: number | null
          taxi_is_fixed_price?: boolean | null
          taxi_notes?: string | null
          train_cost?: number | null
          train_duration_max?: number | null
          train_duration_min?: number | null
          train_line?: string | null
          train_notes?: string | null
          updated_at?: string
        }
        Update: {
          airport_code?: string | null
          airport_name?: string | null
          bus_cost?: number | null
          bus_duration_max?: number | null
          bus_duration_min?: number | null
          bus_notes?: string | null
          city?: string
          confidence_score?: number | null
          created_at?: string
          currency?: string
          currency_symbol?: string
          destination_zone?: string | null
          id?: string
          last_verified_at?: string
          source?: string | null
          taxi_cost_max?: number | null
          taxi_cost_min?: number | null
          taxi_duration_max?: number | null
          taxi_duration_min?: number | null
          taxi_is_fixed_price?: boolean | null
          taxi_notes?: string | null
          train_cost?: number | null
          train_duration_max?: number | null
          train_duration_min?: number | null
          train_line?: string | null
          train_notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      airports: {
        Row: {
          city: string | null
          code: string
          country: string | null
          created_at: string
          distance_km: number | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          type: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          code: string
          country?: string | null
          created_at?: string
          distance_km?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          type?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          code?: string
          country?: string | null
          created_at?: string
          distance_km?: number | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      archetype_destination_guides: {
        Row: {
          archetype: string
          created_at: string | null
          destination_id: string
          expires_at: string | null
          generated_at: string | null
          guide: Json
          id: string
          usage_count: number | null
        }
        Insert: {
          archetype: string
          created_at?: string | null
          destination_id: string
          expires_at?: string | null
          generated_at?: string | null
          guide: Json
          id?: string
          usage_count?: number | null
        }
        Update: {
          archetype?: string
          created_at?: string | null
          destination_id?: string
          expires_at?: string | null
          generated_at?: string | null
          guide?: Json
          id?: string
          usage_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "archetype_destination_guides_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
        ]
      }
      archetype_pacing_stats: {
        Row: {
          archetype: string
          created_at: string
          id: string
          last_calculated_at: string
          pacing_distribution: Json
          recommended_adjustment: number | null
          sample_size_threshold: number | null
          total_responses: number
          trip_type: string | null
        }
        Insert: {
          archetype: string
          created_at?: string
          id?: string
          last_calculated_at?: string
          pacing_distribution?: Json
          recommended_adjustment?: number | null
          sample_size_threshold?: number | null
          total_responses?: number
          trip_type?: string | null
        }
        Update: {
          archetype?: string
          created_at?: string
          id?: string
          last_calculated_at?: string
          pacing_distribution?: Json
          recommended_adjustment?: number | null
          sample_size_threshold?: number | null
          total_responses?: number
          trip_type?: string | null
        }
        Relationships: []
      }
      attractions: {
        Row: {
          address: string | null
          average_rating: number | null
          best_time_of_day: string[] | null
          budget_level: string | null
          category: string | null
          created_at: string
          crowd_level: string | null
          crowd_patterns: Json | null
          description: string | null
          destination_id: string | null
          enriched_at: string | null
          experience_categories: string[] | null
          family_friendly: boolean | null
          group_friendly: boolean | null
          id: string
          image_url: string | null
          indoor_outdoor: string | null
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          peak_hours: Json | null
          physical_intensity: string | null
          price_range: Json | null
          requires_reservation: boolean | null
          romantic: boolean | null
          solo_friendly: boolean | null
          subcategory: string | null
          tags: Json | null
          typical_duration_minutes: number | null
          updated_at: string
          vibe: string[] | null
          visit_duration_mins: number | null
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          best_time_of_day?: string[] | null
          budget_level?: string | null
          category?: string | null
          created_at?: string
          crowd_level?: string | null
          crowd_patterns?: Json | null
          description?: string | null
          destination_id?: string | null
          enriched_at?: string | null
          experience_categories?: string[] | null
          family_friendly?: boolean | null
          group_friendly?: boolean | null
          id?: string
          image_url?: string | null
          indoor_outdoor?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          peak_hours?: Json | null
          physical_intensity?: string | null
          price_range?: Json | null
          requires_reservation?: boolean | null
          romantic?: boolean | null
          solo_friendly?: boolean | null
          subcategory?: string | null
          tags?: Json | null
          typical_duration_minutes?: number | null
          updated_at?: string
          vibe?: string[] | null
          visit_duration_mins?: number | null
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          best_time_of_day?: string[] | null
          budget_level?: string | null
          category?: string | null
          created_at?: string
          crowd_level?: string | null
          crowd_patterns?: Json | null
          description?: string | null
          destination_id?: string | null
          enriched_at?: string | null
          experience_categories?: string[] | null
          family_friendly?: boolean | null
          group_friendly?: boolean | null
          id?: string
          image_url?: string | null
          indoor_outdoor?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          peak_hours?: Json | null
          physical_intensity?: string | null
          price_range?: Json | null
          requires_reservation?: boolean | null
          romantic?: boolean | null
          solo_friendly?: boolean | null
          subcategory?: string | null
          tags?: Json | null
          typical_duration_minutes?: number | null
          updated_at?: string
          vibe?: string[] | null
          visit_duration_mins?: number | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          action_type: string | null
          actor: string | null
          created_at: string
          id: string
          metadata: Json | null
          target: string | null
          target_id: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          action_type?: string | null
          actor?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target?: string | null
          target_id?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          action_type?: string | null
          actor?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          target?: string | null
          target_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      city_landmarks_cache: {
        Row: {
          city: string
          country: string | null
          created_at: string
          expires_at: string
          id: string
          landmarks: Json
        }
        Insert: {
          city: string
          country?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          landmarks?: Json
        }
        Update: {
          city?: string
          country?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          landmarks?: Json
        }
        Relationships: []
      }
      client_errors: {
        Row: {
          component_name: string | null
          created_at: string | null
          error_message: string
          id: string
          metadata: Json | null
          page_path: string | null
          session_id: string | null
          stack_trace: string | null
          user_id: string | null
        }
        Insert: {
          component_name?: string | null
          created_at?: string | null
          error_message: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Update: {
          component_name?: string | null
          created_at?: string | null
          error_message?: string
          id?: string
          metadata?: Json | null
          page_path?: string | null
          session_id?: string | null
          stack_trace?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      community_guides: {
        Row: {
          content: Json | null
          cover_image_url: string | null
          created_at: string
          description: string | null
          destination: string | null
          destination_country: string | null
          editorial_content: Json | null
          editorial_generated_at: string | null
          editorial_version: number | null
          id: string
          like_count: number | null
          moderation_status: string | null
          published_at: string | null
          slug: string | null
          status: string
          tags: string[] | null
          title: string
          trip_id: string
          updated_at: string
          user_id: string
          view_count: number | null
        }
        Insert: {
          content?: Json | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          destination?: string | null
          destination_country?: string | null
          editorial_content?: Json | null
          editorial_generated_at?: string | null
          editorial_version?: number | null
          id?: string
          like_count?: number | null
          moderation_status?: string | null
          published_at?: string | null
          slug?: string | null
          status?: string
          tags?: string[] | null
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
          view_count?: number | null
        }
        Update: {
          content?: Json | null
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          destination?: string | null
          destination_country?: string | null
          editorial_content?: Json | null
          editorial_generated_at?: string | null
          editorial_version?: number | null
          id?: string
          like_count?: number | null
          moderation_status?: string | null
          published_at?: string | null
          slug?: string | null
          status?: string
          tags?: string[] | null
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "community_guides_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "community_guides_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          consent_type: string
          consent_version: string
          consented_at: string
          created_at: string
          id: string
          ip_hash: string | null
          preferences: Json | null
          revoked_at: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          consent_type: string
          consent_version: string
          consented_at?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          preferences?: Json | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          consent_type?: string
          consent_version?: string
          consented_at?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          preferences?: Json | null
          revoked_at?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      cost_reference: {
        Row: {
          category: string
          confidence: string
          cost_high_local: number | null
          cost_high_usd: number
          cost_low_local: number | null
          cost_low_usd: number
          cost_mid_local: number | null
          cost_mid_usd: number
          destination_city: string
          destination_country: string
          exchange_rate: number | null
          id: string
          item_name: string | null
          last_updated: string | null
          local_currency: string | null
          notes: string | null
          source: string
          subcategory: string | null
        }
        Insert: {
          category: string
          confidence?: string
          cost_high_local?: number | null
          cost_high_usd: number
          cost_low_local?: number | null
          cost_low_usd: number
          cost_mid_local?: number | null
          cost_mid_usd: number
          destination_city: string
          destination_country: string
          exchange_rate?: number | null
          id?: string
          item_name?: string | null
          last_updated?: string | null
          local_currency?: string | null
          notes?: string | null
          source?: string
          subcategory?: string | null
        }
        Update: {
          category?: string
          confidence?: string
          cost_high_local?: number | null
          cost_high_usd?: number
          cost_low_local?: number | null
          cost_low_usd?: number
          cost_mid_local?: number | null
          cost_mid_usd?: number
          destination_city?: string
          destination_country?: string
          exchange_rate?: number | null
          id?: string
          item_name?: string | null
          last_updated?: string | null
          local_currency?: string | null
          notes?: string | null
          source?: string
          subcategory?: string | null
        }
        Relationships: []
      }
      creator_follows: {
        Row: {
          created_at: string
          creator_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
      credit_balances: {
        Row: {
          created_at: string
          free_credits: number
          free_credits_expires_at: string | null
          id: string
          last_free_credit_at: string | null
          purchased_credits: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_credits?: number
          free_credits_expires_at?: string | null
          id?: string
          last_free_credit_at?: string | null
          purchased_credits?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_credits?: number
          free_credits_expires_at?: string | null
          id?: string
          last_free_credit_at?: string | null
          purchased_credits?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          action_type: string | null
          activity_id: string | null
          amount_cents: number | null
          created_at: string
          credits_delta: number
          id: string
          is_free_credit: boolean
          metadata: Json | null
          notes: string | null
          price_id: string | null
          stripe_product_id: string | null
          stripe_session_id: string | null
          transaction_type: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          action_type?: string | null
          activity_id?: string | null
          amount_cents?: number | null
          created_at?: string
          credits_delta: number
          id?: string
          is_free_credit?: boolean
          metadata?: Json | null
          notes?: string | null
          price_id?: string | null
          stripe_product_id?: string | null
          stripe_session_id?: string | null
          transaction_type: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          action_type?: string | null
          activity_id?: string | null
          amount_cents?: number | null
          created_at?: string
          credits_delta?: number
          id?: string
          is_free_credit?: boolean
          metadata?: Json | null
          notes?: string | null
          price_id?: string | null
          stripe_product_id?: string | null
          stripe_session_id?: string | null
          transaction_type?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      credit_purchases: {
        Row: {
          amount: number
          club_tier: string | null
          created_at: string
          credit_type: string
          expires_at: string | null
          id: string
          remaining: number
          source: string | null
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          club_tier?: string | null
          created_at?: string
          credit_type: string
          expires_at?: string | null
          id?: string
          remaining: number
          source?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          club_tier?: string | null
          created_at?: string
          credit_type?: string
          expires_at?: string | null
          id?: string
          remaining?: number
          source?: string | null
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_transactions: {
        Row: {
          action_key: string | null
          amount_cents: number
          created_at: string
          id: string
          metadata: Json | null
          type: string
          user_id: string
        }
        Insert: {
          action_key?: string | null
          amount_cents: number
          created_at?: string
          id?: string
          metadata?: Json | null
          type: string
          user_id: string
        }
        Update: {
          action_key?: string | null
          amount_cents?: number
          created_at?: string
          id?: string
          metadata?: Json | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      curated_images: {
        Row: {
          alt_text: string | null
          attribution: string | null
          created_at: string | null
          destination: string | null
          entity_key: string
          entity_type: string
          expires_at: string | null
          id: string
          image_url: string
          is_blacklisted: boolean | null
          metadata: Json | null
          photo_reference: string | null
          place_id: string | null
          quality_score: number | null
          source: string
          thumbnail_url: string | null
          updated_at: string | null
          vote_count: number | null
          vote_score: number | null
        }
        Insert: {
          alt_text?: string | null
          attribution?: string | null
          created_at?: string | null
          destination?: string | null
          entity_key: string
          entity_type: string
          expires_at?: string | null
          id?: string
          image_url: string
          is_blacklisted?: boolean | null
          metadata?: Json | null
          photo_reference?: string | null
          place_id?: string | null
          quality_score?: number | null
          source: string
          thumbnail_url?: string | null
          updated_at?: string | null
          vote_count?: number | null
          vote_score?: number | null
        }
        Update: {
          alt_text?: string | null
          attribution?: string | null
          created_at?: string | null
          destination?: string | null
          entity_key?: string
          entity_type?: string
          expires_at?: string | null
          id?: string
          image_url?: string
          is_blacklisted?: boolean | null
          metadata?: Json | null
          photo_reference?: string | null
          place_id?: string | null
          quality_score?: number | null
          source?: string
          thumbnail_url?: string | null
          updated_at?: string | null
          vote_count?: number | null
          vote_score?: number | null
        }
        Relationships: []
      }
      customer_reviews: {
        Row: {
          archetype: string | null
          created_at: string
          email: string | null
          id: string
          is_approved: boolean | null
          is_featured: boolean | null
          name: string
          photo_consent: boolean | null
          rating: number
          review_text: string
          trip_destination: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          archetype?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          name: string
          photo_consent?: boolean | null
          rating: number
          review_text: string
          trip_destination?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          archetype?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          name?: string
          photo_consent?: boolean | null
          rating?: number
          review_text?: string
          trip_destination?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      daily_usage: {
        Row: {
          action_type: string
          count: number
          created_at: string
          id: string
          updated_at: string
          usage_date: string
          user_id: string
        }
        Insert: {
          action_type: string
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          user_id: string
        }
        Update: {
          action_type?: string
          count?: number
          created_at?: string
          id?: string
          updated_at?: string
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      day_balances: {
        Row: {
          active_tier: string | null
          created_at: string
          free_days: number
          free_days_expires_at: string | null
          id: string
          last_free_day_earned_at: string | null
          monthly_regenerates_used: number
          monthly_reset_at: string
          monthly_swaps_used: number
          purchased_days: number
          regenerates_remaining: number | null
          swaps_remaining: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active_tier?: string | null
          created_at?: string
          free_days?: number
          free_days_expires_at?: string | null
          id?: string
          last_free_day_earned_at?: string | null
          monthly_regenerates_used?: number
          monthly_reset_at?: string
          monthly_swaps_used?: number
          purchased_days?: number
          regenerates_remaining?: number | null
          swaps_remaining?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active_tier?: string | null
          created_at?: string
          free_days?: number
          free_days_expires_at?: string | null
          id?: string
          last_free_day_earned_at?: string | null
          monthly_regenerates_used?: number
          monthly_reset_at?: string
          monthly_swaps_used?: number
          purchased_days?: number
          regenerates_remaining?: number | null
          swaps_remaining?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      day_ledger: {
        Row: {
          amount_cents: number | null
          created_at: string
          days_delta: number
          id: string
          is_free_day: boolean
          notes: string | null
          package_days: number | null
          package_tier: string | null
          price_id: string | null
          stripe_product_id: string | null
          stripe_session_id: string | null
          transaction_type: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          days_delta: number
          id?: string
          is_free_day?: boolean
          notes?: string | null
          package_days?: number | null
          package_tier?: string | null
          price_id?: string | null
          stripe_product_id?: string | null
          stripe_session_id?: string | null
          transaction_type: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          days_delta?: number
          id?: string
          is_free_day?: boolean
          notes?: string | null
          package_days?: number | null
          package_tier?: string | null
          price_id?: string | null
          stripe_product_id?: string | null
          stripe_session_id?: string | null
          transaction_type?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      destination_cost_index: {
        Row: {
          activity_base_usd: number | null
          breakfast_base_usd: number | null
          city: string
          coffee_base_usd: number | null
          confidence_score: number | null
          cost_multiplier: number
          country: string
          created_at: string
          dinner_base_usd: number | null
          id: string
          last_verified_at: string | null
          lunch_base_usd: number | null
          museum_base_usd: number | null
          source: string | null
          tax_tip_buffer: number | null
          tour_base_usd: number | null
          transport_base_usd: number | null
          updated_at: string
        }
        Insert: {
          activity_base_usd?: number | null
          breakfast_base_usd?: number | null
          city: string
          coffee_base_usd?: number | null
          confidence_score?: number | null
          cost_multiplier?: number
          country: string
          created_at?: string
          dinner_base_usd?: number | null
          id?: string
          last_verified_at?: string | null
          lunch_base_usd?: number | null
          museum_base_usd?: number | null
          source?: string | null
          tax_tip_buffer?: number | null
          tour_base_usd?: number | null
          transport_base_usd?: number | null
          updated_at?: string
        }
        Update: {
          activity_base_usd?: number | null
          breakfast_base_usd?: number | null
          city?: string
          coffee_base_usd?: number | null
          confidence_score?: number | null
          cost_multiplier?: number
          country?: string
          created_at?: string
          dinner_base_usd?: number | null
          id?: string
          last_verified_at?: string | null
          lunch_base_usd?: number | null
          museum_base_usd?: number | null
          source?: string | null
          tax_tip_buffer?: number | null
          tour_base_usd?: number | null
          transport_base_usd?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      destination_fallbacks: {
        Row: {
          created_at: string
          description: string
          destination_key: string
          display_name: string
          id: string
          preview_days: Json
          tagline: string
        }
        Insert: {
          created_at?: string
          description: string
          destination_key: string
          display_name: string
          id?: string
          preview_days?: Json
          tagline: string
        }
        Update: {
          created_at?: string
          description?: string
          destination_key?: string
          display_name?: string
          id?: string
          preview_days?: Json
          tagline?: string
        }
        Relationships: []
      }
      destination_image_cache: {
        Row: {
          created_at: string
          destination_slug: string
          expires_at: string
          id: string
          image_type: string
          original_url: string
          storage_path: string
          storage_url: string
        }
        Insert: {
          created_at?: string
          destination_slug: string
          expires_at?: string
          id?: string
          image_type?: string
          original_url: string
          storage_path: string
          storage_url: string
        }
        Update: {
          created_at?: string
          destination_slug?: string
          expires_at?: string
          id?: string
          image_type?: string
          original_url?: string
          storage_path?: string
          storage_url?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          airport_codes: Json | null
          airport_lookup_codes: string | null
          airport_transfer_minutes: number | null
          alternative_names: Json | null
          best_neighborhoods: Json | null
          best_time_to_visit: string | null
          city: string
          common_scams: Json | null
          coordinates: Json | null
          cost_tier: string | null
          country: string
          created_at: string
          currency_code: string | null
          currency_data: Json | null
          default_transport_modes: Json | null
          description: string | null
          dress_code: string | null
          dynamic_currency_conversion: Json | null
          dynamic_weather: Json | null
          emergency_numbers: Json | null
          enriched_at: string | null
          enrichment_priority: number | null
          enrichment_status: Json | null
          featured: boolean | null
          food_scene: string | null
          getting_around: string | null
          google_place_id: string | null
          hero_image_url: string | null
          id: string
          known_for: Json | null
          last_content_update: string | null
          last_currency_update: string | null
          last_enriched: string | null
          last_local_knowledge_update: string | null
          last_weather_update: string | null
          local_tips: Json | null
          nightlife_info: string | null
          points_of_interest: Json | null
          population: number | null
          region: string | null
          safe_search_keywords: Json | null
          safety_tips: Json | null
          seasonal_events: Json | null
          seasonality: string | null
          stock_image_url: string | null
          tags: Json | null
          temperature_range: string | null
          tier: number | null
          timezone: string | null
          tipping_custom: string | null
          updated_at: string
          weather_data: Json | null
        }
        Insert: {
          airport_codes?: Json | null
          airport_lookup_codes?: string | null
          airport_transfer_minutes?: number | null
          alternative_names?: Json | null
          best_neighborhoods?: Json | null
          best_time_to_visit?: string | null
          city: string
          common_scams?: Json | null
          coordinates?: Json | null
          cost_tier?: string | null
          country: string
          created_at?: string
          currency_code?: string | null
          currency_data?: Json | null
          default_transport_modes?: Json | null
          description?: string | null
          dress_code?: string | null
          dynamic_currency_conversion?: Json | null
          dynamic_weather?: Json | null
          emergency_numbers?: Json | null
          enriched_at?: string | null
          enrichment_priority?: number | null
          enrichment_status?: Json | null
          featured?: boolean | null
          food_scene?: string | null
          getting_around?: string | null
          google_place_id?: string | null
          hero_image_url?: string | null
          id?: string
          known_for?: Json | null
          last_content_update?: string | null
          last_currency_update?: string | null
          last_enriched?: string | null
          last_local_knowledge_update?: string | null
          last_weather_update?: string | null
          local_tips?: Json | null
          nightlife_info?: string | null
          points_of_interest?: Json | null
          population?: number | null
          region?: string | null
          safe_search_keywords?: Json | null
          safety_tips?: Json | null
          seasonal_events?: Json | null
          seasonality?: string | null
          stock_image_url?: string | null
          tags?: Json | null
          temperature_range?: string | null
          tier?: number | null
          timezone?: string | null
          tipping_custom?: string | null
          updated_at?: string
          weather_data?: Json | null
        }
        Update: {
          airport_codes?: Json | null
          airport_lookup_codes?: string | null
          airport_transfer_minutes?: number | null
          alternative_names?: Json | null
          best_neighborhoods?: Json | null
          best_time_to_visit?: string | null
          city?: string
          common_scams?: Json | null
          coordinates?: Json | null
          cost_tier?: string | null
          country?: string
          created_at?: string
          currency_code?: string | null
          currency_data?: Json | null
          default_transport_modes?: Json | null
          description?: string | null
          dress_code?: string | null
          dynamic_currency_conversion?: Json | null
          dynamic_weather?: Json | null
          emergency_numbers?: Json | null
          enriched_at?: string | null
          enrichment_priority?: number | null
          enrichment_status?: Json | null
          featured?: boolean | null
          food_scene?: string | null
          getting_around?: string | null
          google_place_id?: string | null
          hero_image_url?: string | null
          id?: string
          known_for?: Json | null
          last_content_update?: string | null
          last_currency_update?: string | null
          last_enriched?: string | null
          last_local_knowledge_update?: string | null
          last_weather_update?: string | null
          local_tips?: Json | null
          nightlife_info?: string | null
          points_of_interest?: Json | null
          population?: number | null
          region?: string | null
          safe_search_keywords?: Json | null
          safety_tips?: Json | null
          seasonal_events?: Json | null
          seasonality?: string | null
          stock_image_url?: string | null
          tags?: Json | null
          temperature_range?: string | null
          tier?: number | null
          timezone?: string | null
          tipping_custom?: string | null
          updated_at?: string
          weather_data?: Json | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          currency_code: string
          last_updated: string | null
          rate_to_usd: number
        }
        Insert: {
          currency_code: string
          last_updated?: string | null
          rate_to_usd: number
        }
        Update: {
          currency_code?: string
          last_updated?: string | null
          rate_to_usd?: number
        }
        Relationships: []
      }
      expense_splits: {
        Row: {
          amount: number
          created_at: string
          expense_id: string
          id: string
          is_paid: boolean
          member_id: string
          paid_at: string | null
          percentage: number | null
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          expense_id: string
          id?: string
          is_paid?: boolean
          member_id: string
          paid_at?: string | null
          percentage?: number | null
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string
          id?: string
          is_paid?: boolean
          member_id?: string
          paid_at?: string | null
          percentage?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_splits_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "trip_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_splits_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "trip_members_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          category: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          value_type: string
        }
        Insert: {
          category: string
          created_at?: string | null
          description?: string | null
          id: string
          name: string
          value_type?: string
        }
        Update: {
          category?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          value_type?: string
        }
        Relationships: []
      }
      feedback_prompt_log: {
        Row: {
          action: string
          activity_id: string | null
          created_at: string
          day_number: number | null
          id: string
          prompt_id: string | null
          prompt_type: Database["public"]["Enums"]["feedback_prompt_type"]
          shown_at: string
          trip_id: string
          user_id: string
        }
        Insert: {
          action: string
          activity_id?: string | null
          created_at?: string
          day_number?: number | null
          id?: string
          prompt_id?: string | null
          prompt_type: Database["public"]["Enums"]["feedback_prompt_type"]
          shown_at?: string
          trip_id: string
          user_id: string
        }
        Update: {
          action?: string
          activity_id?: string | null
          created_at?: string
          day_number?: number | null
          id?: string
          prompt_id?: string | null
          prompt_type?: Database["public"]["Enums"]["feedback_prompt_type"]
          shown_at?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_prompt_log_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_prompt_log_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "feedback_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_prompt_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "feedback_prompt_log_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_prompts: {
        Row: {
          archetype_relevance: string[] | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: number
          prompt_type: Database["public"]["Enums"]["feedback_prompt_type"]
          questions: Json
          trigger_config: Json
          updated_at: string
        }
        Insert: {
          archetype_relevance?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number
          prompt_type: Database["public"]["Enums"]["feedback_prompt_type"]
          questions?: Json
          trigger_config?: Json
          updated_at?: string
        }
        Update: {
          archetype_relevance?: string[] | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number
          prompt_type?: Database["public"]["Enums"]["feedback_prompt_type"]
          questions?: Json
          trigger_config?: Json
          updated_at?: string
        }
        Relationships: []
      }
      finance_commission_imports: {
        Row: {
          agent_id: string
          created_at: string
          currency: string
          error_message: string | null
          file_name: string | null
          file_url: string | null
          id: string
          line_count: number
          matched_count: number
          metadata: Json | null
          processed_at: string | null
          raw_data: Json | null
          source: string
          source_reference: string | null
          status: string
          total_amount_cents: number
          unmatched_count: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          currency?: string
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          line_count?: number
          matched_count?: number
          metadata?: Json | null
          processed_at?: string | null
          raw_data?: Json | null
          source: string
          source_reference?: string | null
          status?: string
          total_amount_cents?: number
          unmatched_count?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          currency?: string
          error_message?: string | null
          file_name?: string | null
          file_url?: string | null
          id?: string
          line_count?: number
          matched_count?: number
          metadata?: Json | null
          processed_at?: string | null
          raw_data?: Json | null
          source?: string
          source_reference?: string | null
          status?: string
          total_amount_cents?: number
          unmatched_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      finance_ledger_entries: {
        Row: {
          agent_id: string
          amount_cents: number
          created_at: string
          currency: string
          description: string
          effective_date: string
          entry_source: Database["public"]["Enums"]["finance_entry_source"]
          entry_type: Database["public"]["Enums"]["finance_entry_type"]
          external_reference: string | null
          id: string
          invoice_id: string | null
          memo: string | null
          metadata: Json | null
          posted_at: string
          segment_id: string | null
          stripe_charge_id: string | null
          stripe_dispute_id: string | null
          stripe_payment_intent_id: string | null
          stripe_payout_id: string | null
          stripe_refund_id: string | null
          stripe_transfer_id: string | null
          trip_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          amount_cents: number
          created_at?: string
          currency?: string
          description: string
          effective_date?: string
          entry_source?: Database["public"]["Enums"]["finance_entry_source"]
          entry_type: Database["public"]["Enums"]["finance_entry_type"]
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          memo?: string | null
          metadata?: Json | null
          posted_at?: string
          segment_id?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string
          effective_date?: string
          entry_source?: Database["public"]["Enums"]["finance_entry_source"]
          entry_type?: Database["public"]["Enums"]["finance_entry_type"]
          external_reference?: string | null
          id?: string
          invoice_id?: string | null
          memo?: string | null
          metadata?: Json | null
          posted_at?: string
          segment_id?: string | null
          stripe_charge_id?: string | null
          stripe_dispute_id?: string | null
          stripe_payment_intent_id?: string | null
          stripe_payout_id?: string | null
          stripe_refund_id?: string | null
          stripe_transfer_id?: string | null
          trip_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_ledger_entries_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "agency_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_ledger_entries_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "agency_booking_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_ledger_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_ledger_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      finance_payout_lines: {
        Row: {
          agent_id: string
          amount_cents: number
          created_at: string
          currency: string
          description: string
          id: string
          ledger_entry_id: string | null
          payout_run_id: string | null
          segment_id: string | null
          source_reference: string | null
          source_type: string | null
          trip_id: string | null
        }
        Insert: {
          agent_id: string
          amount_cents: number
          created_at?: string
          currency?: string
          description: string
          id?: string
          ledger_entry_id?: string | null
          payout_run_id?: string | null
          segment_id?: string | null
          source_reference?: string | null
          source_type?: string | null
          trip_id?: string | null
        }
        Update: {
          agent_id?: string
          amount_cents?: number
          created_at?: string
          currency?: string
          description?: string
          id?: string
          ledger_entry_id?: string | null
          payout_run_id?: string | null
          segment_id?: string | null
          source_reference?: string | null
          source_type?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "finance_payout_lines_ledger_entry_id_fkey"
            columns: ["ledger_entry_id"]
            isOneToOne: false
            referencedRelation: "finance_ledger_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payout_lines_payout_run_id_fkey"
            columns: ["payout_run_id"]
            isOneToOne: false
            referencedRelation: "finance_payout_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payout_lines_segment_id_fkey"
            columns: ["segment_id"]
            isOneToOne: false
            referencedRelation: "agency_booking_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payout_lines_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_payout_lines_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      finance_payout_runs: {
        Row: {
          agent_id: string
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          initiated_at: string | null
          line_count: number
          metadata: Json | null
          notes: string | null
          scheduled_for: string | null
          status: string
          stripe_payout_id: string | null
          stripe_transfer_id: string | null
          total_amount_cents: number
          updated_at: string
        }
        Insert: {
          agent_id: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          initiated_at?: string | null
          line_count?: number
          metadata?: Json | null
          notes?: string | null
          scheduled_for?: string | null
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          total_amount_cents?: number
          updated_at?: string
        }
        Update: {
          agent_id?: string
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          initiated_at?: string | null
          line_count?: number
          metadata?: Json | null
          notes?: string | null
          scheduled_for?: string | null
          status?: string
          stripe_payout_id?: string | null
          stripe_transfer_id?: string | null
          total_amount_cents?: number
          updated_at?: string
        }
        Relationships: []
      }
      founding_member_tracker: {
        Row: {
          awarded_at: string
          id: string
          purchase_number: number
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          id?: string
          purchase_number: number
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          id?: string
          purchase_number?: number
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      free_tier_status: {
        Row: {
          created_at: string
          free_edits_remaining: number
          free_trip_id: string | null
          free_trip_used: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          free_edits_remaining?: number
          free_trip_id?: string | null
          free_trip_used?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          free_edits_remaining?: number
          free_trip_id?: string | null
          free_trip_used?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "free_tier_status_free_trip_id_fkey"
            columns: ["free_trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "free_tier_status_free_trip_id_fkey"
            columns: ["free_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: Database["public"]["Enums"]["friendship_status"]
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: Database["public"]["Enums"]["friendship_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_addressee_id_fkey"
            columns: ["addressee_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friendships_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      generation_logs: {
        Row: {
          completion_token_count: number | null
          created_at: string | null
          current_phase: string | null
          day_timings: Json | null
          destination: string | null
          errors: Json | null
          id: string
          model_used: string | null
          num_days: number | null
          num_guests: number | null
          phase_timings: Json | null
          progress_pct: number | null
          prompt_token_count: number | null
          status: string | null
          total_duration_ms: number | null
          trip_id: string | null
        }
        Insert: {
          completion_token_count?: number | null
          created_at?: string | null
          current_phase?: string | null
          day_timings?: Json | null
          destination?: string | null
          errors?: Json | null
          id?: string
          model_used?: string | null
          num_days?: number | null
          num_guests?: number | null
          phase_timings?: Json | null
          progress_pct?: number | null
          prompt_token_count?: number | null
          status?: string | null
          total_duration_ms?: number | null
          trip_id?: string | null
        }
        Update: {
          completion_token_count?: number | null
          created_at?: string | null
          current_phase?: string | null
          day_timings?: Json | null
          destination?: string | null
          errors?: Json | null
          id?: string
          model_used?: string | null
          num_days?: number | null
          num_guests?: number | null
          phase_timings?: Json | null
          progress_pct?: number | null
          prompt_token_count?: number | null
          status?: string | null
          total_duration_ms?: number | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "generation_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "generation_logs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      geocoding_cache: {
        Row: {
          address: string
          created_at: string
          destination: string | null
          expires_at: string
          formatted_address: string | null
          id: string
          lat: number
          lng: number
          place_id: string | null
          query_key: string
        }
        Insert: {
          address: string
          created_at?: string
          destination?: string | null
          expires_at?: string
          formatted_address?: string | null
          id?: string
          lat: number
          lng: number
          place_id?: string | null
          query_key: string
        }
        Update: {
          address?: string
          created_at?: string
          destination?: string | null
          expires_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number
          lng?: number
          place_id?: string | null
          query_key?: string
        }
        Relationships: []
      }
      group_budget_transactions: {
        Row: {
          action_type: string
          created_at: string | null
          credits_spent: number
          group_budget_id: string
          id: string
          user_id: string
          was_free: boolean | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          credits_spent: number
          group_budget_id: string
          id?: string
          user_id: string
          was_free?: boolean | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          credits_spent?: number
          group_budget_id?: string
          id?: string
          user_id?: string
          was_free?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "group_budget_transactions_group_budget_id_fkey"
            columns: ["group_budget_id"]
            isOneToOne: false
            referencedRelation: "group_budgets"
            referencedColumns: ["id"]
          },
        ]
      }
      group_budgets: {
        Row: {
          created_at: string | null
          id: string
          initial_credits: number
          owner_id: string
          remaining_credits: number
          tier: string
          trip_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          initial_credits: number
          owner_id: string
          remaining_credits: number
          tier: string
          trip_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          initial_credits?: number
          owner_id?: string
          remaining_credits?: number
          tier?: string
          trip_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_budgets_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "group_budgets_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      group_unlocks: {
        Row: {
          caps: Json
          created_at: string
          id: string
          purchased_by: string
          stripe_session_id: string | null
          tier: string
          trip_id: string
          usage: Json
        }
        Insert: {
          caps?: Json
          created_at?: string
          id?: string
          purchased_by: string
          stripe_session_id?: string | null
          tier: string
          trip_id: string
          usage?: Json
        }
        Update: {
          caps?: Json
          created_at?: string
          id?: string
          purchased_by?: string
          stripe_session_id?: string | null
          tier?: string
          trip_id?: string
          usage?: Json
        }
        Relationships: []
      }
      guide_activity_reviews: {
        Row: {
          activity_category: string | null
          activity_name: string
          created_at: string | null
          destination_city: string
          experience_text: string | null
          guide_id: string
          id: string
          photo_count: number | null
          rating: number | null
          recommended: boolean | null
          user_id: string
        }
        Insert: {
          activity_category?: string | null
          activity_name: string
          created_at?: string | null
          destination_city: string
          experience_text?: string | null
          guide_id: string
          id?: string
          photo_count?: number | null
          rating?: number | null
          recommended?: boolean | null
          user_id: string
        }
        Update: {
          activity_category?: string | null
          activity_name?: string
          created_at?: string | null
          destination_city?: string
          experience_text?: string | null
          guide_id?: string
          id?: string
          photo_count?: number | null
          rating?: number | null
          recommended?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_activity_reviews_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "community_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_content_links: {
        Row: {
          activity_id: string | null
          activity_name: string | null
          created_at: string
          day_number: number | null
          description: string | null
          guide_id: string
          id: string
          platform: string
          sort_order: number
          title: string | null
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          activity_name?: string | null
          created_at?: string
          day_number?: number | null
          description?: string | null
          guide_id: string
          id?: string
          platform: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          activity_name?: string | null
          created_at?: string
          day_number?: number | null
          description?: string | null
          guide_id?: string
          id?: string
          platform?: string
          sort_order?: number
          title?: string | null
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_content_links_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "community_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_favorites: {
        Row: {
          activity_id: string
          created_at: string
          id: string
          note: string | null
          sort_order: number | null
          trip_id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          id?: string
          note?: string | null
          sort_order?: number | null
          trip_id: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          id?: string
          note?: string | null
          sort_order?: number | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_favorites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "guide_favorites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_follows: {
        Row: {
          created_at: string | null
          followed_id: string
          follower_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          followed_id: string
          follower_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          followed_id?: string
          follower_id?: string
          id?: string
        }
        Relationships: []
      }
      guide_manual_entries: {
        Row: {
          category: string
          created_at: string
          day_number: number
          description: string | null
          external_url: string | null
          id: string
          name: string
          sort_order: number
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          day_number?: number
          description?: string | null
          external_url?: string | null
          id?: string
          name: string
          sort_order?: number
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          day_number?: number
          description?: string | null
          external_url?: string | null
          id?: string
          name?: string
          sort_order?: number
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_manual_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "guide_manual_entries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_reports: {
        Row: {
          created_at: string
          details: string | null
          guide_id: string
          id: string
          reason: string
          reporter_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          guide_id: string
          id?: string
          reason: string
          reporter_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          guide_id?: string
          id?: string
          reason?: string
          reporter_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_reports_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "community_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_sections: {
        Row: {
          activity_category: string | null
          activity_cost: string | null
          activity_location: string | null
          activity_rating: number | null
          activity_tips: string | null
          activity_title: string | null
          body: string | null
          created_at: string | null
          guide_id: string
          id: string
          linked_activity_id: string | null
          linked_day_number: number | null
          photo_url: string | null
          photos: Json | null
          recommended: string | null
          section_type: string
          sort_order: number
          title: string
          updated_at: string | null
          user_experience: string | null
          user_rating: number | null
        }
        Insert: {
          activity_category?: string | null
          activity_cost?: string | null
          activity_location?: string | null
          activity_rating?: number | null
          activity_tips?: string | null
          activity_title?: string | null
          body?: string | null
          created_at?: string | null
          guide_id: string
          id?: string
          linked_activity_id?: string | null
          linked_day_number?: number | null
          photo_url?: string | null
          photos?: Json | null
          recommended?: string | null
          section_type: string
          sort_order?: number
          title: string
          updated_at?: string | null
          user_experience?: string | null
          user_rating?: number | null
        }
        Update: {
          activity_category?: string | null
          activity_cost?: string | null
          activity_location?: string | null
          activity_rating?: number | null
          activity_tips?: string | null
          activity_title?: string | null
          body?: string | null
          created_at?: string | null
          guide_id?: string
          id?: string
          linked_activity_id?: string | null
          linked_day_number?: number | null
          photo_url?: string | null
          photos?: Json | null
          recommended?: string | null
          section_type?: string
          sort_order?: number
          title?: string
          updated_at?: string | null
          user_experience?: string | null
          user_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guide_sections_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "community_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      guides: {
        Row: {
          archetype: string | null
          author: string | null
          category: string | null
          content: Json | null
          created_at: string
          destination_city: string | null
          destination_country: string | null
          duration_days: number | null
          excerpt: string | null
          featured: boolean | null
          guide_type: string | null
          id: string
          image_url: string | null
          like_count: number | null
          published: boolean | null
          reading_time: number | null
          slug: string
          status: string | null
          subtitle: string | null
          tags: Json | null
          title: string
          trip_id: string | null
          updated_at: string
          user_id: string | null
          vibe_tags: Json | null
          view_count: number | null
        }
        Insert: {
          archetype?: string | null
          author?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string
          destination_city?: string | null
          destination_country?: string | null
          duration_days?: number | null
          excerpt?: string | null
          featured?: boolean | null
          guide_type?: string | null
          id?: string
          image_url?: string | null
          like_count?: number | null
          published?: boolean | null
          reading_time?: number | null
          slug: string
          status?: string | null
          subtitle?: string | null
          tags?: Json | null
          title: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string | null
          vibe_tags?: Json | null
          view_count?: number | null
        }
        Update: {
          archetype?: string | null
          author?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string
          destination_city?: string | null
          destination_country?: string | null
          duration_days?: number | null
          excerpt?: string | null
          featured?: boolean | null
          guide_type?: string | null
          id?: string
          image_url?: string | null
          like_count?: number | null
          published?: boolean | null
          reading_time?: number | null
          slug?: string
          status?: string | null
          subtitle?: string | null
          tags?: Json | null
          title?: string
          trip_id?: string | null
          updated_at?: string
          user_id?: string | null
          vibe_tags?: Json | null
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "guides_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "guides_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      iap_transactions: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          status: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          status?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          status?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      image_votes: {
        Row: {
          created_at: string
          entity_key: string
          entity_type: string
          id: string
          image_url: string
          metadata: Json | null
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          entity_key: string
          entity_type?: string
          id?: string
          image_url: string
          metadata?: Json | null
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          entity_key?: string
          entity_type?: string
          id?: string
          image_url?: string
          metadata?: Json | null
          user_id?: string
          vote?: string
        }
        Relationships: []
      }
      invite_failure_log: {
        Row: {
          attempted_token: string
          created_at: string
          id: string
          reason: string
          referrer: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          attempted_token: string
          created_at?: string
          id?: string
          reason: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          attempted_token?: string
          created_at?: string
          id?: string
          reason?: string
          referrer?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      itinerary_activities: {
        Row: {
          booking_required: boolean | null
          category: string | null
          cost: Json | null
          created_at: string
          description: string | null
          duration_minutes: number | null
          end_time: string | null
          external_id: string | null
          extra_data: Json | null
          id: string
          is_locked: boolean
          itinerary_day_id: string
          location: Json | null
          name: string | null
          photos: Json | null
          rating: Json | null
          sort_order: number
          start_time: string | null
          suggested_for: string | null
          tags: string[] | null
          tips: string | null
          title: string
          transportation: Json | null
          trip_id: string
          updated_at: string
          viator_product_code: string | null
          walking_distance: string | null
          walking_time: string | null
          website: string | null
        }
        Insert: {
          booking_required?: boolean | null
          category?: string | null
          cost?: Json | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          external_id?: string | null
          extra_data?: Json | null
          id?: string
          is_locked?: boolean
          itinerary_day_id: string
          location?: Json | null
          name?: string | null
          photos?: Json | null
          rating?: Json | null
          sort_order?: number
          start_time?: string | null
          suggested_for?: string | null
          tags?: string[] | null
          tips?: string | null
          title: string
          transportation?: Json | null
          trip_id: string
          updated_at?: string
          viator_product_code?: string | null
          walking_distance?: string | null
          walking_time?: string | null
          website?: string | null
        }
        Update: {
          booking_required?: boolean | null
          category?: string | null
          cost?: Json | null
          created_at?: string
          description?: string | null
          duration_minutes?: number | null
          end_time?: string | null
          external_id?: string | null
          extra_data?: Json | null
          id?: string
          is_locked?: boolean
          itinerary_day_id?: string
          location?: Json | null
          name?: string | null
          photos?: Json | null
          rating?: Json | null
          sort_order?: number
          start_time?: string | null
          suggested_for?: string | null
          tags?: string[] | null
          tips?: string | null
          title?: string
          transportation?: Json | null
          trip_id?: string
          updated_at?: string
          viator_product_code?: string | null
          walking_distance?: string | null
          walking_time?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_activities_itinerary_day_id_fkey"
            columns: ["itinerary_day_id"]
            isOneToOne: false
            referencedRelation: "itinerary_days"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "itinerary_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_customization_requests: {
        Row: {
          action_taken: string | null
          activity_id: string | null
          conversation_id: string | null
          created_at: string
          extracted_preferences: Json | null
          id: string
          request_type: string
          trip_id: string
          user_id: string
          user_message: string
        }
        Insert: {
          action_taken?: string | null
          activity_id?: string | null
          conversation_id?: string | null
          created_at?: string
          extracted_preferences?: Json | null
          id?: string
          request_type: string
          trip_id: string
          user_id: string
          user_message: string
        }
        Update: {
          action_taken?: string | null
          activity_id?: string | null
          conversation_id?: string | null
          created_at?: string
          extracted_preferences?: Json | null
          id?: string
          request_type?: string
          trip_id?: string
          user_id?: string
          user_message?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_customization_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "itinerary_customization_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_days: {
        Row: {
          activities: Json | null
          created_at: string
          date: string
          day_brief: Json | null
          day_number: number
          description: string | null
          estimated_distance: string | null
          estimated_walking_time: string | null
          id: string
          narrative: Json | null
          theme: string | null
          title: string | null
          trip_id: string
          updated_at: string
          weather: Json | null
        }
        Insert: {
          activities?: Json | null
          created_at?: string
          date: string
          day_brief?: Json | null
          day_number: number
          description?: string | null
          estimated_distance?: string | null
          estimated_walking_time?: string | null
          id?: string
          narrative?: Json | null
          theme?: string | null
          title?: string | null
          trip_id: string
          updated_at?: string
          weather?: Json | null
        }
        Update: {
          activities?: Json | null
          created_at?: string
          date?: string
          day_brief?: Json | null
          day_number?: number
          description?: string | null
          estimated_distance?: string | null
          estimated_walking_time?: string | null
          id?: string
          narrative?: Json | null
          theme?: string | null
          title?: string | null
          trip_id?: string
          updated_at?: string
          weather?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "itinerary_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_templates: {
        Row: {
          created_at: string
          day_count: number
          description: string | null
          id: string
          last_used_at: string | null
          name: string
          pace: string | null
          source_destination: string | null
          source_trip_id: string | null
          tags: string[] | null
          template_data: Json
          trip_type: string | null
          updated_at: string
          use_count: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          day_count?: number
          description?: string | null
          id?: string
          last_used_at?: string | null
          name: string
          pace?: string | null
          source_destination?: string | null
          source_trip_id?: string | null
          tags?: string[] | null
          template_data: Json
          trip_type?: string | null
          updated_at?: string
          use_count?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          day_count?: number
          description?: string | null
          id?: string
          last_used_at?: string | null
          name?: string
          pace?: string | null
          source_destination?: string | null
          source_trip_id?: string | null
          tags?: string[] | null
          template_data?: Json
          trip_type?: string | null
          updated_at?: string
          use_count?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_templates_source_trip_id_fkey"
            columns: ["source_trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "itinerary_templates_source_trip_id_fkey"
            columns: ["source_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_versions: {
        Row: {
          activities: Json
          created_at: string
          created_by_action: string | null
          day_metadata: Json | null
          day_number: number
          dna_snapshot: Json | null
          id: string
          is_current: boolean | null
          trip_id: string
          version_number: number
        }
        Insert: {
          activities: Json
          created_at?: string
          created_by_action?: string | null
          day_metadata?: Json | null
          day_number: number
          dna_snapshot?: Json | null
          id?: string
          is_current?: boolean | null
          trip_id: string
          version_number?: number
        }
        Update: {
          activities?: Json
          created_at?: string
          created_by_action?: string | null
          day_metadata?: Json | null
          day_number?: number
          dna_snapshot?: Json | null
          id?: string
          is_current?: boolean | null
          trip_id?: string
          version_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_versions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "itinerary_versions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      page_events: {
        Row: {
          created_at: string
          device_type: string | null
          element_id: string | null
          element_text: string | null
          event_data: Json | null
          event_type: string
          id: string
          page_path: string
          page_title: string | null
          referrer: string | null
          scroll_depth: number | null
          session_id: string
          time_on_page_ms: number | null
          user_id: string | null
          utm_campaign: string | null
          utm_medium: string | null
          utm_source: string | null
          viewport_height: number | null
          viewport_width: number | null
        }
        Insert: {
          created_at?: string
          device_type?: string | null
          element_id?: string | null
          element_text?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_path: string
          page_title?: string | null
          referrer?: string | null
          scroll_depth?: number | null
          session_id: string
          time_on_page_ms?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Update: {
          created_at?: string
          device_type?: string | null
          element_id?: string | null
          element_text?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_path?: string
          page_title?: string | null
          referrer?: string | null
          scroll_depth?: number | null
          session_id?: string
          time_on_page_ms?: number | null
          user_id?: string | null
          utm_campaign?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          viewport_height?: number | null
          viewport_width?: number | null
        }
        Relationships: []
      }
      pending_credit_charges: {
        Row: {
          action: string
          created_at: string
          credits_amount: number
          id: string
          idempotency_key: string | null
          refund_attempts: number
          resolution_note: string | null
          resolved_at: string | null
          status: string
          trip_id: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          credits_amount: number
          id?: string
          idempotency_key?: string | null
          refund_attempts?: number
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          trip_id: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          credits_amount?: number
          id?: string
          idempotency_key?: string | null
          refund_attempts?: number
          resolution_note?: string | null
          resolved_at?: string | null
          status?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: []
      }
      personalization_tag_stats: {
        Row: {
          completed_count: number | null
          destination: string | null
          first_seen_at: string | null
          id: string
          last_updated_at: string | null
          rejection_rate: number | null
          retention_rate: number | null
          saved_count: number | null
          shown_count: number | null
          skipped_count: number | null
          swapped_count: number | null
          tag: string
        }
        Insert: {
          completed_count?: number | null
          destination?: string | null
          first_seen_at?: string | null
          id?: string
          last_updated_at?: string | null
          rejection_rate?: number | null
          retention_rate?: number | null
          saved_count?: number | null
          shown_count?: number | null
          skipped_count?: number | null
          swapped_count?: number | null
          tag: string
        }
        Update: {
          completed_count?: number | null
          destination?: string | null
          first_seen_at?: string | null
          id?: string
          last_updated_at?: string | null
          rejection_rate?: number | null
          retention_rate?: number | null
          saved_count?: number | null
          shown_count?: number | null
          skipped_count?: number | null
          swapped_count?: number | null
          tag?: string
        }
        Relationships: []
      }
      plan_entitlements: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          flag_id: string
          id: string
          plan_id: string
          updated_at: string | null
          value_json: Json | null
          value_number: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          flag_id: string
          id?: string
          plan_id: string
          updated_at?: string | null
          value_json?: Json | null
          value_number?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          flag_id?: string
          id?: string
          plan_id?: string
          updated_at?: string | null
          value_json?: Json | null
          value_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_entitlements_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_entitlements_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          description: string | null
          display_order: number | null
          id: string
          is_addon: boolean | null
          name: string
          stripe_price_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id: string
          is_addon?: boolean | null
          name: string
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          display_order?: number | null
          id?: string
          is_addon?: boolean | null
          name?: string
          stripe_price_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          first_name: string | null
          first_trip_used: boolean
          handle: string | null
          home_airport: string | null
          id: string
          last_name: string | null
          onboarding_state: Json | null
          pattern_group: string | null
          preferred_currency: string | null
          preferred_language: string | null
          quiz_completed: boolean | null
          travel_dna: Json | null
          travel_dna_overrides: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          first_trip_used?: boolean
          handle?: string | null
          home_airport?: string | null
          id: string
          last_name?: string | null
          onboarding_state?: Json | null
          pattern_group?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          quiz_completed?: boolean | null
          travel_dna?: Json | null
          travel_dna_overrides?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          first_name?: string | null
          first_trip_used?: boolean
          handle?: string | null
          home_airport?: string | null
          id?: string
          last_name?: string | null
          onboarding_state?: Json | null
          pattern_group?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          quiz_completed?: boolean | null
          travel_dna?: Json | null
          travel_dna_overrides?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          id: string
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          id?: string
          platform?: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          id?: string
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quiz_responses: {
        Row: {
          answer_value: string
          created_at: string | null
          display_label: string | null
          field_id: string
          field_type: string
          id: string
          question_prompt: string | null
          quiz_version: string | null
          response_order: number | null
          session_id: string | null
          step_id: string | null
          user_id: string
        }
        Insert: {
          answer_value: string
          created_at?: string | null
          display_label?: string | null
          field_id: string
          field_type: string
          id?: string
          question_prompt?: string | null
          quiz_version?: string | null
          response_order?: number | null
          session_id?: string | null
          step_id?: string | null
          user_id: string
        }
        Update: {
          answer_value?: string
          created_at?: string | null
          display_label?: string | null
          field_id?: string
          field_type?: string
          id?: string
          question_prompt?: string | null
          quiz_version?: string | null
          response_order?: number | null
          session_id?: string | null
          step_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sessions: {
        Row: {
          completed_at: string | null
          completion_percentage: number | null
          created_at: string | null
          current_step: number | null
          device_type: string | null
          id: string
          is_complete: boolean | null
          last_activity_at: string | null
          quiz_version: string
          started_at: string | null
          status: string | null
          total_steps: number | null
          updated_at: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          device_type?: string | null
          id?: string
          is_complete?: boolean | null
          last_activity_at?: string | null
          quiz_version?: string
          started_at?: string | null
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          current_step?: number | null
          device_type?: string | null
          id?: string
          is_complete?: boolean | null
          last_activity_at?: string | null
          quiz_version?: string
          started_at?: string | null
          status?: string | null
          total_steps?: number | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_limits: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          ip_address: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          ip_address: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string
          user_id?: string | null
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      route_cache: {
        Row: {
          cache_key: string | null
          created_at: string | null
          dest_lat: number
          dest_lng: number
          distance_meters: number | null
          duration_seconds: number | null
          duration_text: string | null
          expires_at: string | null
          hit_count: number | null
          id: string
          origin_lat: number
          origin_lng: number
          steps_json: Json | null
          transit_details_json: Json | null
          travel_mode: string
        }
        Insert: {
          cache_key?: string | null
          created_at?: string | null
          dest_lat: number
          dest_lng: number
          distance_meters?: number | null
          duration_seconds?: number | null
          duration_text?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          origin_lat: number
          origin_lng: number
          steps_json?: Json | null
          transit_details_json?: Json | null
          travel_mode?: string
        }
        Update: {
          cache_key?: string | null
          created_at?: string | null
          dest_lat?: number
          dest_lng?: number
          distance_meters?: number | null
          duration_seconds?: number | null
          duration_text?: string | null
          expires_at?: string | null
          hit_count?: number | null
          id?: string
          origin_lat?: number
          origin_lng?: number
          steps_json?: Json | null
          transit_details_json?: Json | null
          travel_mode?: string
        }
        Relationships: []
      }
      saved_guides: {
        Row: {
          created_at: string
          guide_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guide_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guide_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_guides_guide_id_fkey"
            columns: ["guide_id"]
            isOneToOne: false
            referencedRelation: "community_guides"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          item_data: Json | null
          item_id: string
          item_type: string
          notes: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_data?: Json | null
          item_id: string
          item_type: string
          notes?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_data?: Json | null
          item_id?: string
          item_type?: string
          notes?: string | null
          user_id?: string
        }
        Relationships: []
      }
      search_cache: {
        Row: {
          adults: number | null
          cabin_class: string | null
          created_at: string
          depart_date: string | null
          destination: string
          expires_at: string
          id: string
          origin: string | null
          result_count: number | null
          results: Json
          return_date: string | null
          search_key: string
          search_type: string
          source: string | null
        }
        Insert: {
          adults?: number | null
          cabin_class?: string | null
          created_at?: string
          depart_date?: string | null
          destination: string
          expires_at?: string
          id?: string
          origin?: string | null
          result_count?: number | null
          results?: Json
          return_date?: string | null
          search_key: string
          search_type: string
          source?: string | null
        }
        Update: {
          adults?: number | null
          cabin_class?: string | null
          created_at?: string
          depart_date?: string | null
          destination?: string
          expires_at?: string
          id?: string
          origin?: string | null
          result_count?: number | null
          results?: Json
          return_date?: string | null
          search_key?: string
          search_type?: string
          source?: string | null
        }
        Relationships: []
      }
      site_image_mappings: {
        Row: {
          created_at: string
          error_message: string | null
          original_url: string
          photo_id: string
          status: string
          storage_path: string
          storage_url: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          original_url: string
          photo_id: string
          status?: string
          storage_path: string
          storage_url: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          original_url?: string
          photo_id?: string
          status?: string
          storage_path?: string
          storage_url?: string
          updated_at?: string
        }
        Relationships: []
      }
      suggestion_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string
          vote: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id: string
          vote: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string
          vote?: string
        }
        Relationships: [
          {
            foreignKeyName: "suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "trip_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_dna_history: {
        Row: {
          created_at: string | null
          id: string
          profile_snapshot: Json
          quiz_session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          profile_snapshot: Json
          quiz_session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          profile_snapshot?: Json
          quiz_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_dna_history_quiz_session_id_fkey"
            columns: ["quiz_session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_dna_profiles: {
        Row: {
          archetype_matches: Json | null
          calculated_at: string | null
          created_at: string | null
          dna_confidence_score: number | null
          dna_rarity: string | null
          dna_version: number | null
          emotional_drivers: string[] | null
          id: string
          perfect_trip_preview: string | null
          primary_archetype_name: string | null
          secondary_archetype_name: string | null
          session_id: string | null
          summary: string | null
          tone_tags: string[] | null
          trait_contributions: Json | null
          trait_scores: Json | null
          travel_dna_v2: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          archetype_matches?: Json | null
          calculated_at?: string | null
          created_at?: string | null
          dna_confidence_score?: number | null
          dna_rarity?: string | null
          dna_version?: number | null
          emotional_drivers?: string[] | null
          id?: string
          perfect_trip_preview?: string | null
          primary_archetype_name?: string | null
          secondary_archetype_name?: string | null
          session_id?: string | null
          summary?: string | null
          tone_tags?: string[] | null
          trait_contributions?: Json | null
          trait_scores?: Json | null
          travel_dna_v2?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          archetype_matches?: Json | null
          calculated_at?: string | null
          created_at?: string | null
          dna_confidence_score?: number | null
          dna_rarity?: string | null
          dna_version?: number | null
          emotional_drivers?: string[] | null
          id?: string
          perfect_trip_preview?: string | null
          primary_archetype_name?: string | null
          secondary_archetype_name?: string | null
          session_id?: string | null
          summary?: string | null
          tone_tags?: string[] | null
          trait_contributions?: Json | null
          trait_scores?: Json | null
          travel_dna_v2?: Json | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_dna_profiles_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "quiz_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_guides: {
        Row: {
          content: string
          cover_image_url: string | null
          created_at: string | null
          destination: string
          id: string
          published_at: string | null
          selected_activities: Json | null
          selected_photos: string[] | null
          slug: string
          social_links: Json | null
          status: string
          title: string
          trip_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          destination?: string
          id?: string
          published_at?: string | null
          selected_activities?: Json | null
          selected_photos?: string[] | null
          slug: string
          social_links?: Json | null
          status?: string
          title: string
          trip_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          destination?: string
          id?: string
          published_at?: string | null
          selected_activities?: Json | null
          selected_photos?: string[] | null
          slug?: string
          social_links?: Json | null
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_guides_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "travel_guides_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      travel_intel_cache: {
        Row: {
          created_at: string
          destination: string
          end_date: string
          id: string
          intel_data: Json
          request_params: Json
          start_date: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination: string
          end_date: string
          id?: string
          intel_data: Json
          request_params?: Json
          start_date: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string
          end_date?: string
          id?: string
          intel_data?: Json
          request_params?: Json
          start_date?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "travel_intel_cache_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "travel_intel_cache_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_action_usage: {
        Row: {
          action_type: string
          id: string
          trip_id: string
          updated_at: string
          usage_count: number
          user_id: string
        }
        Insert: {
          action_type: string
          id?: string
          trip_id: string
          updated_at?: string
          usage_count?: number
          user_id: string
        }
        Update: {
          action_type?: string
          id?: string
          trip_id?: string
          updated_at?: string
          usage_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_action_usage_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_action_usage_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_activities: {
        Row: {
          added_by_user: boolean | null
          address: string | null
          block_order: number | null
          booked_at: string | null
          booking_required: boolean | null
          booking_state:
            | Database["public"]["Enums"]["booking_item_state"]
            | null
          booking_status: string | null
          cancellation_policy: Json | null
          cancelled_at: string | null
          confirmation_number: string | null
          cost: number | null
          created_at: string
          currency: string | null
          description: string | null
          end_time: string | null
          external_booking_id: string | null
          external_booking_url: string | null
          id: string
          is_client_visible: boolean | null
          itinerary_day_id: string | null
          latitude: number | null
          location: string | null
          locked: boolean | null
          longitude: number | null
          metadata: Json | null
          modification_policy: Json | null
          operating_hours: Json | null
          payment_status: string | null
          photos: Json | null
          place_id: string | null
          quote_expires_at: string | null
          quote_id: string | null
          quote_locked: boolean | null
          quote_price_cents: number | null
          rating_count: number | null
          rating_value: number | null
          recommendation_score: number | null
          refund_amount_cents: number | null
          refunded_at: string | null
          start_time: string | null
          state_history: Json | null
          tags: Json | null
          title: string
          transportation: Json | null
          traveler_data: Json | null
          trip_id: string | null
          type: string
          updated_at: string
          vendor_booking_id: string | null
          vendor_name: string | null
          venue_id: string | null
          verification_confidence: number | null
          verified: boolean | null
          voucher_data: Json | null
          voucher_url: string | null
        }
        Insert: {
          added_by_user?: boolean | null
          address?: string | null
          block_order?: number | null
          booked_at?: string | null
          booking_required?: boolean | null
          booking_state?:
            | Database["public"]["Enums"]["booking_item_state"]
            | null
          booking_status?: string | null
          cancellation_policy?: Json | null
          cancelled_at?: string | null
          confirmation_number?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          end_time?: string | null
          external_booking_id?: string | null
          external_booking_url?: string | null
          id?: string
          is_client_visible?: boolean | null
          itinerary_day_id?: string | null
          latitude?: number | null
          location?: string | null
          locked?: boolean | null
          longitude?: number | null
          metadata?: Json | null
          modification_policy?: Json | null
          operating_hours?: Json | null
          payment_status?: string | null
          photos?: Json | null
          place_id?: string | null
          quote_expires_at?: string | null
          quote_id?: string | null
          quote_locked?: boolean | null
          quote_price_cents?: number | null
          rating_count?: number | null
          rating_value?: number | null
          recommendation_score?: number | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          start_time?: string | null
          state_history?: Json | null
          tags?: Json | null
          title: string
          transportation?: Json | null
          traveler_data?: Json | null
          trip_id?: string | null
          type?: string
          updated_at?: string
          vendor_booking_id?: string | null
          vendor_name?: string | null
          venue_id?: string | null
          verification_confidence?: number | null
          verified?: boolean | null
          voucher_data?: Json | null
          voucher_url?: string | null
        }
        Update: {
          added_by_user?: boolean | null
          address?: string | null
          block_order?: number | null
          booked_at?: string | null
          booking_required?: boolean | null
          booking_state?:
            | Database["public"]["Enums"]["booking_item_state"]
            | null
          booking_status?: string | null
          cancellation_policy?: Json | null
          cancelled_at?: string | null
          confirmation_number?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          end_time?: string | null
          external_booking_id?: string | null
          external_booking_url?: string | null
          id?: string
          is_client_visible?: boolean | null
          itinerary_day_id?: string | null
          latitude?: number | null
          location?: string | null
          locked?: boolean | null
          longitude?: number | null
          metadata?: Json | null
          modification_policy?: Json | null
          operating_hours?: Json | null
          payment_status?: string | null
          photos?: Json | null
          place_id?: string | null
          quote_expires_at?: string | null
          quote_id?: string | null
          quote_locked?: boolean | null
          quote_price_cents?: number | null
          rating_count?: number | null
          rating_value?: number | null
          recommendation_score?: number | null
          refund_amount_cents?: number | null
          refunded_at?: string | null
          start_time?: string | null
          state_history?: Json | null
          tags?: Json | null
          title?: string
          transportation?: Json | null
          traveler_data?: Json | null
          trip_id?: string | null
          type?: string
          updated_at?: string
          vendor_booking_id?: string | null
          vendor_name?: string | null
          venue_id?: string | null
          verification_confidence?: number | null
          verified?: boolean | null
          voucher_data?: Json | null
          voucher_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_blogs: {
        Row: {
          content: Json
          cover_image_url: string | null
          created_at: string
          destination: string | null
          id: string
          published_at: string | null
          slug: string | null
          social_links: Json | null
          status: string
          subtitle: string | null
          title: string
          traveler_count: number | null
          trip_dates: string | null
          trip_duration_days: number | null
          trip_id: string
          updated_at: string
          user_id: string
          view_count: number | null
        }
        Insert: {
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          social_links?: Json | null
          status?: string
          subtitle?: string | null
          title: string
          traveler_count?: number | null
          trip_dates?: string | null
          trip_duration_days?: number | null
          trip_id: string
          updated_at?: string
          user_id: string
          view_count?: number | null
        }
        Update: {
          content?: Json
          cover_image_url?: string | null
          created_at?: string
          destination?: string | null
          id?: string
          published_at?: string | null
          slug?: string | null
          social_links?: Json | null
          status?: string
          subtitle?: string | null
          title?: string
          traveler_count?: number | null
          trip_dates?: string | null
          trip_duration_days?: number | null
          trip_id?: string
          updated_at?: string
          user_id?: string
          view_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_blogs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_blogs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_budget_ledger: {
        Row: {
          activity_id: string | null
          amount_cents: number
          category: string
          confidence: string | null
          created_at: string
          currency: string | null
          day_number: number | null
          description: string | null
          entry_type: string
          external_booking_id: string | null
          id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          amount_cents: number
          category: string
          confidence?: string | null
          created_at?: string
          currency?: string | null
          day_number?: number | null
          description?: string | null
          entry_type: string
          external_booking_id?: string | null
          id?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          amount_cents?: number
          category?: string
          confidence?: string | null
          created_at?: string
          currency?: string | null
          day_number?: number | null
          description?: string | null
          entry_type?: string
          external_booking_id?: string | null
          id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_budget_ledger_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_budget_ledger_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_chat_messages: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          message: string
          trip_id: string
          trip_type: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          message: string
          trip_id: string
          trip_type?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          message?: string
          trip_id?: string
          trip_type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      trip_cities: {
        Row: {
          activity_cost_cents: number | null
          allocated_budget_cents: number | null
          arrival_date: string | null
          arrival_transfer: Json | null
          city_name: string
          city_order: number
          country: string | null
          created_at: string
          days_generated: number | null
          days_total: number | null
          departure_date: string | null
          departure_transfer: Json | null
          destination_id: string | null
          dining_cost_cents: number | null
          generation_status: string
          hotel_cost_cents: number | null
          hotel_selection: Json | null
          id: string
          itinerary_data: Json | null
          misc_cost_cents: number | null
          nights: number | null
          slug: string | null
          total_cost_cents: number | null
          transition_day_mode: string | null
          transport_cost_cents: number | null
          transport_currency: string | null
          transport_details: Json | null
          transport_type: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          activity_cost_cents?: number | null
          allocated_budget_cents?: number | null
          arrival_date?: string | null
          arrival_transfer?: Json | null
          city_name: string
          city_order?: number
          country?: string | null
          created_at?: string
          days_generated?: number | null
          days_total?: number | null
          departure_date?: string | null
          departure_transfer?: Json | null
          destination_id?: string | null
          dining_cost_cents?: number | null
          generation_status?: string
          hotel_cost_cents?: number | null
          hotel_selection?: Json | null
          id?: string
          itinerary_data?: Json | null
          misc_cost_cents?: number | null
          nights?: number | null
          slug?: string | null
          total_cost_cents?: number | null
          transition_day_mode?: string | null
          transport_cost_cents?: number | null
          transport_currency?: string | null
          transport_details?: Json | null
          transport_type?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          activity_cost_cents?: number | null
          allocated_budget_cents?: number | null
          arrival_date?: string | null
          arrival_transfer?: Json | null
          city_name?: string
          city_order?: number
          country?: string | null
          created_at?: string
          days_generated?: number | null
          days_total?: number | null
          departure_date?: string | null
          departure_transfer?: Json | null
          destination_id?: string | null
          dining_cost_cents?: number | null
          generation_status?: string
          hotel_cost_cents?: number | null
          hotel_selection?: Json | null
          id?: string
          itinerary_data?: Json | null
          misc_cost_cents?: number | null
          nights?: number | null
          slug?: string | null
          total_cost_cents?: number | null
          transition_day_mode?: string | null
          transport_cost_cents?: number | null
          transport_currency?: string | null
          transport_details?: Json | null
          transport_type?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_cities_destination_id_fkey"
            columns: ["destination_id"]
            isOneToOne: false
            referencedRelation: "destinations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_cities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_cities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_collaborators: {
        Row: {
          accepted_at: string | null
          created_at: string
          id: string
          include_preferences: boolean | null
          invited_by: string | null
          permission: string
          trip_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          include_preferences?: boolean | null
          invited_by?: string | null
          permission?: string
          trip_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          include_preferences?: boolean | null
          invited_by?: string | null
          permission?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_collaborators_invited_by_profiles_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_invited_by_profiles_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_invited_by_profiles_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_invited_by_profiles_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_collaborators_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_friends"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_collaborators_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_safe"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_complexity: {
        Row: {
          base_credits: number
          created_at: string
          factor_count: number
          factors: Json
          multi_city_fee: number
          multiplier: number
          tier: string
          total_credits: number
          trip_id: string
        }
        Insert: {
          base_credits?: number
          created_at?: string
          factor_count?: number
          factors?: Json
          multi_city_fee?: number
          multiplier?: number
          tier?: string
          total_credits?: number
          trip_id: string
        }
        Update: {
          base_credits?: number
          created_at?: string
          factor_count?: number
          factors?: Json
          multi_city_fee?: number
          multiplier?: number
          tier?: string
          total_credits?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_complexity_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_complexity_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: true
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_cost_tracking: {
        Row: {
          action_type: string
          amadeus_calls: number
          cost_category: Database["public"]["Enums"]["cost_category"] | null
          created_at: string
          duration_ms: number | null
          estimated_cost_usd: number | null
          google_geocoding_calls: number
          google_photos_calls: number
          google_places_calls: number
          google_routes_calls: number
          id: string
          input_tokens: number
          metadata: Json | null
          model: string
          output_tokens: number
          perplexity_calls: number
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          amadeus_calls?: number
          cost_category?: Database["public"]["Enums"]["cost_category"] | null
          created_at?: string
          duration_ms?: number | null
          estimated_cost_usd?: number | null
          google_geocoding_calls?: number
          google_photos_calls?: number
          google_places_calls?: number
          google_routes_calls?: number
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model: string
          output_tokens?: number
          perplexity_calls?: number
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          amadeus_calls?: number
          cost_category?: Database["public"]["Enums"]["cost_category"] | null
          created_at?: string
          duration_ms?: number | null
          estimated_cost_usd?: number | null
          google_geocoding_calls?: number
          google_photos_calls?: number
          google_places_calls?: number
          google_routes_calls?: number
          id?: string
          input_tokens?: number
          metadata?: Json | null
          model?: string
          output_tokens?: number
          perplexity_calls?: number
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_cost_tracking_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_cost_tracking_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_date_versions: {
        Row: {
          created_at: string | null
          created_by_action: string | null
          day_count: number
          end_date: string
          hotel_selection: Json | null
          id: string
          itinerary_data: Json | null
          start_date: string
          trip_id: string
        }
        Insert: {
          created_at?: string | null
          created_by_action?: string | null
          day_count: number
          end_date: string
          hotel_selection?: Json | null
          id?: string
          itinerary_data?: Json | null
          start_date: string
          trip_id: string
        }
        Update: {
          created_at?: string | null
          created_by_action?: string | null
          day_count?: number
          end_date?: string
          hotel_selection?: Json | null
          id?: string
          itinerary_data?: Json | null
          start_date?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_date_versions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_date_versions_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_day_intents: {
        Row: {
          created_at: string
          date: string | null
          day_number: number | null
          destination: string | null
          end_time: string | null
          fulfilled_activity_id: string | null
          fulfilled_at: string | null
          id: string
          intent_kind: string
          locked: boolean
          locked_source: string | null
          metadata: Json
          priority: string
          raw_text: string | null
          source_entry_point: string
          start_time: string | null
          status: string
          title: string
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          day_number?: number | null
          destination?: string | null
          end_time?: string | null
          fulfilled_activity_id?: string | null
          fulfilled_at?: string | null
          id?: string
          intent_kind: string
          locked?: boolean
          locked_source?: string | null
          metadata?: Json
          priority?: string
          raw_text?: string | null
          source_entry_point: string
          start_time?: string | null
          status?: string
          title: string
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          day_number?: number | null
          destination?: string | null
          end_time?: string | null
          fulfilled_activity_id?: string | null
          fulfilled_at?: string | null
          id?: string
          intent_kind?: string
          locked?: boolean
          locked_source?: string | null
          metadata?: Json
          priority?: string
          raw_text?: string | null
          source_entry_point?: string
          start_time?: string | null
          status?: string
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_day_intents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_day_intents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_day_summaries: {
        Row: {
          created_at: string
          day_date: string
          day_number: number
          energy_level: number | null
          highlight_activity_id: string | null
          highlight_text: string | null
          id: string
          notes: string | null
          overall_rating: number | null
          pacing_rating: string | null
          trip_id: string
          unexpected_discoveries: string[] | null
          updated_at: string
          user_id: string
          weather_experience: string | null
        }
        Insert: {
          created_at?: string
          day_date: string
          day_number: number
          energy_level?: number | null
          highlight_activity_id?: string | null
          highlight_text?: string | null
          id?: string
          notes?: string | null
          overall_rating?: number | null
          pacing_rating?: string | null
          trip_id: string
          unexpected_discoveries?: string[] | null
          updated_at?: string
          user_id: string
          weather_experience?: string | null
        }
        Update: {
          created_at?: string
          day_date?: string
          day_number?: number
          energy_level?: number | null
          highlight_activity_id?: string | null
          highlight_text?: string | null
          id?: string
          notes?: string | null
          overall_rating?: number | null
          pacing_rating?: string | null
          trip_id?: string
          unexpected_discoveries?: string[] | null
          updated_at?: string
          user_id?: string
          weather_experience?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_day_summaries_highlight_activity_id_fkey"
            columns: ["highlight_activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_day_summaries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_day_summaries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_departure_summaries: {
        Row: {
          archetype_fit: string | null
          best_experience_activity_id: string | null
          best_meal_activity_id: string | null
          created_at: string
          final_thoughts: string | null
          highlight_activities: string[] | null
          id: string
          overall_trip_rating: number | null
          recommend_score: number | null
          suggestions_for_destination: string | null
          trip_id: string
          updated_at: string
          user_id: string
          would_change: string[] | null
          would_recommend: boolean | null
        }
        Insert: {
          archetype_fit?: string | null
          best_experience_activity_id?: string | null
          best_meal_activity_id?: string | null
          created_at?: string
          final_thoughts?: string | null
          highlight_activities?: string[] | null
          id?: string
          overall_trip_rating?: number | null
          recommend_score?: number | null
          suggestions_for_destination?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
          would_change?: string[] | null
          would_recommend?: boolean | null
        }
        Update: {
          archetype_fit?: string | null
          best_experience_activity_id?: string | null
          best_meal_activity_id?: string | null
          created_at?: string
          final_thoughts?: string | null
          highlight_activities?: string[] | null
          id?: string
          overall_trip_rating?: number | null
          recommend_score?: number | null
          suggestions_for_destination?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
          would_change?: string[] | null
          would_recommend?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_departure_summaries_best_experience_activity_id_fkey"
            columns: ["best_experience_activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_departure_summaries_best_meal_activity_id_fkey"
            columns: ["best_meal_activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_departure_summaries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_departure_summaries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_expenses: {
        Row: {
          actual_amount: number | null
          category: string
          created_at: string
          currency: string
          description: string
          external_item_id: string | null
          external_item_type: string | null
          id: string
          notes: string | null
          paid_at: string | null
          paid_by_member_id: string | null
          payment_status: Database["public"]["Enums"]["payment_status_enum"]
          planned_amount: number
          split_type: Database["public"]["Enums"]["expense_split_type"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          actual_amount?: number | null
          category: string
          created_at?: string
          currency?: string
          description: string
          external_item_id?: string | null
          external_item_type?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by_member_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          planned_amount?: number
          split_type?: Database["public"]["Enums"]["expense_split_type"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          actual_amount?: number | null
          category?: string
          created_at?: string
          currency?: string
          description?: string
          external_item_id?: string | null
          external_item_type?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          paid_by_member_id?: string | null
          payment_status?: Database["public"]["Enums"]["payment_status_enum"]
          planned_amount?: number
          split_type?: Database["public"]["Enums"]["expense_split_type"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_paid_by_member_id_fkey"
            columns: ["paid_by_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_feedback_responses: {
        Row: {
          activity_id: string | null
          created_at: string
          day_number: number | null
          dismissed_at: string | null
          id: string
          location: Json | null
          prompt_id: string | null
          prompt_type: Database["public"]["Enums"]["feedback_prompt_type"]
          responses: Json
          submitted_at: string
          trip_id: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          created_at?: string
          day_number?: number | null
          dismissed_at?: string | null
          id?: string
          location?: Json | null
          prompt_id?: string | null
          prompt_type: Database["public"]["Enums"]["feedback_prompt_type"]
          responses?: Json
          submitted_at?: string
          trip_id: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          created_at?: string
          day_number?: number | null
          dismissed_at?: string | null
          id?: string
          location?: Json | null
          prompt_id?: string | null
          prompt_type?: Database["public"]["Enums"]["feedback_prompt_type"]
          responses?: Json
          submitted_at?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_feedback_responses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_feedback_responses_prompt_id_fkey"
            columns: ["prompt_id"]
            isOneToOne: false
            referencedRelation: "feedback_prompts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_feedback_responses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_feedback_responses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_go_back_list: {
        Row: {
          category: string
          created_at: string
          id: string
          is_completed: boolean
          item: string
          notes: string | null
          reminder_enabled: boolean
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          item: string
          notes?: string | null
          reminder_enabled?: boolean
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          item?: string
          notes?: string | null
          reminder_enabled?: boolean
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_go_back_list_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_go_back_list_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_intents: {
        Row: {
          active: boolean | null
          confidence: string | null
          created_at: string
          id: string
          intent_type: string
          intent_value: string
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          active?: boolean | null
          confidence?: string | null
          created_at?: string
          id?: string
          intent_type: string
          intent_value: string
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          active?: boolean | null
          confidence?: string | null
          created_at?: string
          id?: string
          intent_type?: string
          intent_value?: string
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_intents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_intents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          expires_at: string | null
          id: string
          invited_by: string
          max_uses: number | null
          replaced_at: string | null
          role: string
          token: string
          trip_id: string
          uses_count: number | null
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by: string
          max_uses?: number | null
          replaced_at?: string | null
          role?: string
          token?: string
          trip_id: string
          uses_count?: number | null
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          expires_at?: string | null
          id?: string
          invited_by?: string
          max_uses?: number | null
          replaced_at?: string | null
          role?: string
          token?: string
          trip_id?: string
          uses_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_learnings: {
        Row: {
          accommodation_feedback: string | null
          best_time_of_day: string | null
          completed_at: string | null
          created_at: string
          destination: string | null
          discovered_dislikes: string[] | null
          discovered_likes: string[] | null
          highlights: Json | null
          id: string
          lessons_summary: string | null
          overall_rating: number | null
          pacing_feedback: string | null
          pain_points: Json | null
          skipped_activities: Json | null
          tips_for_others: string | null
          travel_party_notes: string | null
          trip_id: string
          updated_at: string
          user_id: string
          would_change: string | null
          would_return: boolean | null
        }
        Insert: {
          accommodation_feedback?: string | null
          best_time_of_day?: string | null
          completed_at?: string | null
          created_at?: string
          destination?: string | null
          discovered_dislikes?: string[] | null
          discovered_likes?: string[] | null
          highlights?: Json | null
          id?: string
          lessons_summary?: string | null
          overall_rating?: number | null
          pacing_feedback?: string | null
          pain_points?: Json | null
          skipped_activities?: Json | null
          tips_for_others?: string | null
          travel_party_notes?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
          would_change?: string | null
          would_return?: boolean | null
        }
        Update: {
          accommodation_feedback?: string | null
          best_time_of_day?: string | null
          completed_at?: string | null
          created_at?: string
          destination?: string | null
          discovered_dislikes?: string[] | null
          discovered_likes?: string[] | null
          highlights?: Json | null
          id?: string
          lessons_summary?: string | null
          overall_rating?: number | null
          pacing_feedback?: string | null
          pain_points?: Json | null
          skipped_activities?: Json | null
          tips_for_others?: string | null
          travel_party_notes?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
          would_change?: string | null
          would_return?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_learnings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_learnings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_at: string
          name: string | null
          role: Database["public"]["Enums"]["trip_member_role"]
          trip_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_at?: string
          name?: string | null
          role?: Database["public"]["Enums"]["trip_member_role"]
          trip_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_at?: string
          name?: string | null
          role?: Database["public"]["Enums"]["trip_member_role"]
          trip_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_memories: {
        Row: {
          activity_id: string | null
          activity_name: string | null
          caption: string | null
          created_at: string
          day_number: number | null
          id: string
          image_url: string
          location_name: string | null
          taken_at: string
          trip_id: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          activity_name?: string | null
          caption?: string | null
          created_at?: string
          day_number?: number | null
          id?: string
          image_url: string
          location_name?: string | null
          taken_at?: string
          trip_id: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          activity_name?: string | null
          caption?: string | null
          created_at?: string
          day_number?: number | null
          id?: string
          image_url?: string
          location_name?: string | null
          taken_at?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_memories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_memories_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_notes: {
        Row: {
          content: string
          created_at: string
          day_number: number | null
          id: string
          location: string | null
          note_type: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          day_number?: number | null
          id?: string
          location?: string | null
          note_type: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          day_number?: number | null
          id?: string
          location?: string | null
          note_type?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_notes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_notifications: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          notification_type: string
          read: boolean | null
          scheduled_for: string | null
          sent: boolean | null
          sent_at: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type: string
          read?: boolean | null
          scheduled_for?: string | null
          sent?: boolean | null
          sent_at?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type?: string
          read?: boolean | null
          scheduled_for?: string | null
          sent?: boolean | null
          sent_at?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_payments: {
        Row: {
          amount_cents: number
          assigned_member_id: string | null
          created_at: string
          currency: string
          external_booking_id: string | null
          external_booking_url: string | null
          external_provider: string | null
          id: string
          item_id: string
          item_name: string
          item_type: string
          paid_at: string | null
          quantity: number
          status: string
          stripe_checkout_session_id: string | null
          stripe_payment_intent_id: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          assigned_member_id?: string | null
          created_at?: string
          currency?: string
          external_booking_id?: string | null
          external_booking_url?: string | null
          external_provider?: string | null
          id?: string
          item_id: string
          item_name: string
          item_type: string
          paid_at?: string | null
          quantity?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          assigned_member_id?: string | null
          created_at?: string
          currency?: string
          external_booking_id?: string | null
          external_booking_url?: string | null
          external_provider?: string | null
          id?: string
          item_id?: string
          item_name?: string
          item_type?: string
          paid_at?: string | null
          quantity?: number
          status?: string
          stripe_checkout_session_id?: string | null
          stripe_payment_intent_id?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_payments_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_payments_assigned_member_id_fkey"
            columns: ["assigned_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_payments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_photos: {
        Row: {
          activity_id: string | null
          caption: string | null
          created_at: string
          day_number: number | null
          file_name: string
          file_size_bytes: number | null
          id: string
          is_cover: boolean | null
          is_favorite: boolean | null
          location: Json | null
          metadata: Json | null
          mime_type: string | null
          storage_path: string
          taken_at: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id?: string | null
          caption?: string | null
          created_at?: string
          day_number?: number | null
          file_name: string
          file_size_bytes?: number | null
          id?: string
          is_cover?: boolean | null
          is_favorite?: boolean | null
          location?: Json | null
          metadata?: Json | null
          mime_type?: string | null
          storage_path: string
          taken_at?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string | null
          caption?: string | null
          created_at?: string
          day_number?: number | null
          file_name?: string
          file_size_bytes?: number | null
          id?: string
          is_cover?: boolean | null
          is_favorite?: boolean | null
          location?: Json | null
          metadata?: Json | null
          mime_type?: string | null
          storage_path?: string
          taken_at?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_photos_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_photos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_photos_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_ratings: {
        Row: {
          created_at: string
          id: string
          rating: number
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rating: number
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rating?: number
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trip_rental_cars: {
        Row: {
          booking_url: string | null
          car_type: string | null
          confirmation_number: string | null
          created_at: string
          currency: string | null
          daily_rate: number | null
          dropoff_date: string | null
          dropoff_location: string | null
          dropoff_time: string | null
          id: string
          insurance_included: boolean | null
          notes: string | null
          pickup_date: string | null
          pickup_location: string | null
          pickup_time: string | null
          rental_company: string | null
          total_cost: number | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_url?: string | null
          car_type?: string | null
          confirmation_number?: string | null
          created_at?: string
          currency?: string | null
          daily_rate?: number | null
          dropoff_date?: string | null
          dropoff_location?: string | null
          dropoff_time?: string | null
          id?: string
          insurance_included?: boolean | null
          notes?: string | null
          pickup_date?: string | null
          pickup_location?: string | null
          pickup_time?: string | null
          rental_company?: string | null
          total_cost?: number | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_url?: string | null
          car_type?: string | null
          confirmation_number?: string | null
          created_at?: string
          currency?: string | null
          daily_rate?: number | null
          dropoff_date?: string | null
          dropoff_location?: string | null
          dropoff_time?: string | null
          id?: string
          insurance_included?: boolean | null
          notes?: string | null
          pickup_date?: string | null
          pickup_location?: string | null
          pickup_time?: string | null
          rental_company?: string | null
          total_cost?: number | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_rental_cars_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_rental_cars_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_reviews: {
        Row: {
          created_at: string
          experience_rating: number | null
          food_rating: number | null
          highlight_label: string | null
          highlight_text: string | null
          id: string
          location_rating: number | null
          overall_rating: number
          photo_url: string | null
          review_text: string | null
          tags: string[] | null
          trip_id: string
          updated_at: string
          user_id: string
          value_rating: number | null
        }
        Insert: {
          created_at?: string
          experience_rating?: number | null
          food_rating?: number | null
          highlight_label?: string | null
          highlight_text?: string | null
          id?: string
          location_rating?: number | null
          overall_rating: number
          photo_url?: string | null
          review_text?: string | null
          tags?: string[] | null
          trip_id: string
          updated_at?: string
          user_id: string
          value_rating?: number | null
        }
        Update: {
          created_at?: string
          experience_rating?: number | null
          food_rating?: number | null
          highlight_label?: string | null
          highlight_text?: string | null
          id?: string
          location_rating?: number | null
          overall_rating?: number
          photo_url?: string | null
          review_text?: string | null
          tags?: string[] | null
          trip_id?: string
          updated_at?: string
          user_id?: string
          value_rating?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_reviews_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_reviews_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_settlements: {
        Row: {
          amount: number
          created_at: string
          currency: string
          from_member_id: string
          id: string
          is_settled: boolean
          notes: string | null
          settled_at: string | null
          to_member_id: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency?: string
          from_member_id: string
          id?: string
          is_settled?: boolean
          notes?: string | null
          settled_at?: string | null
          to_member_id: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          from_member_id?: string
          id?: string
          is_settled?: boolean
          notes?: string | null
          settled_at?: string | null
          to_member_id?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlements_from_member_id_fkey"
            columns: ["from_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members_safe"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_suggestion_votes: {
        Row: {
          created_at: string
          id: string
          suggestion_id: string
          user_id: string | null
          vote_type: string
          voter_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          suggestion_id: string
          user_id?: string | null
          vote_type?: string
          voter_name: string
        }
        Update: {
          created_at?: string
          id?: string
          suggestion_id?: string
          user_id?: string | null
          vote_type?: string
          voter_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "trip_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_suggestions: {
        Row: {
          auto_applied: boolean
          created_at: string
          description: string | null
          display_name: string
          id: string
          owner_decided_at: string | null
          owner_decision: string | null
          replacement_reason: string | null
          status: string
          suggestion_type: string
          target_activity_id: string | null
          target_activity_title: string | null
          title: string
          trip_id: string
          trip_type: string
          updated_at: string
          user_id: string | null
          vote_deadline: string | null
          votes_against: number
          votes_for: number
        }
        Insert: {
          auto_applied?: boolean
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          owner_decided_at?: string | null
          owner_decision?: string | null
          replacement_reason?: string | null
          status?: string
          suggestion_type?: string
          target_activity_id?: string | null
          target_activity_title?: string | null
          title: string
          trip_id: string
          trip_type?: string
          updated_at?: string
          user_id?: string | null
          vote_deadline?: string | null
          votes_against?: number
          votes_for?: number
        }
        Update: {
          auto_applied?: boolean
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          owner_decided_at?: string | null
          owner_decision?: string | null
          replacement_reason?: string | null
          status?: string
          suggestion_type?: string
          target_activity_id?: string | null
          target_activity_title?: string | null
          title?: string
          trip_id?: string
          trip_type?: string
          updated_at?: string
          user_id?: string | null
          vote_deadline?: string | null
          votes_against?: number
          votes_for?: number
        }
        Relationships: []
      }
      trips: {
        Row: {
          abandoned_at: string | null
          agent_notes: string | null
          arrival_transfer: Json | null
          blended_dna: Json | null
          budget_allocations: Json | null
          budget_currency: string | null
          budget_include_flight: boolean | null
          budget_include_hotel: boolean | null
          budget_individual_cents: Json | null
          budget_input_mode: string | null
          budget_tier: string | null
          budget_total_cents: number | null
          budget_warning_threshold: string | null
          budget_warnings_enabled: boolean | null
          client_id: string | null
          created_at: string
          creation_source: string | null
          departure_transfer: Json | null
          destination: string
          destination_country: string | null
          destinations: Json | null
          dna_snapshot: Json | null
          end_date: string
          flight_intelligence: Json | null
          flight_selection: Json | null
          gap_analysis_result: Json | null
          guest_edit_mode: string
          hotel_selection: Json | null
          id: string
          is_agent_trip: boolean | null
          is_free_tier_trip: boolean
          is_multi_city: boolean | null
          itinerary_data: Json | null
          itinerary_status:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          itinerary_version: number
          journey_id: string | null
          journey_name: string | null
          journey_order: number | null
          journey_total_legs: number | null
          last_activity_at: string | null
          metadata: Json | null
          name: string
          origin_city: string | null
          owner_plan_tier: string | null
          price_lock_expires_at: string | null
          share_enabled: boolean | null
          share_token: string | null
          smart_finish_purchased: boolean
          smart_finish_purchased_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          transition_arrival_time: string | null
          transition_departure_time: string | null
          transition_mode: string | null
          transportation_preferences: Json | null
          travelers: number | null
          trip_type: string | null
          unlocked_day_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          abandoned_at?: string | null
          agent_notes?: string | null
          arrival_transfer?: Json | null
          blended_dna?: Json | null
          budget_allocations?: Json | null
          budget_currency?: string | null
          budget_include_flight?: boolean | null
          budget_include_hotel?: boolean | null
          budget_individual_cents?: Json | null
          budget_input_mode?: string | null
          budget_tier?: string | null
          budget_total_cents?: number | null
          budget_warning_threshold?: string | null
          budget_warnings_enabled?: boolean | null
          client_id?: string | null
          created_at?: string
          creation_source?: string | null
          departure_transfer?: Json | null
          destination: string
          destination_country?: string | null
          destinations?: Json | null
          dna_snapshot?: Json | null
          end_date: string
          flight_intelligence?: Json | null
          flight_selection?: Json | null
          gap_analysis_result?: Json | null
          guest_edit_mode?: string
          hotel_selection?: Json | null
          id?: string
          is_agent_trip?: boolean | null
          is_free_tier_trip?: boolean
          is_multi_city?: boolean | null
          itinerary_data?: Json | null
          itinerary_status?:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          itinerary_version?: number
          journey_id?: string | null
          journey_name?: string | null
          journey_order?: number | null
          journey_total_legs?: number | null
          last_activity_at?: string | null
          metadata?: Json | null
          name: string
          origin_city?: string | null
          owner_plan_tier?: string | null
          price_lock_expires_at?: string | null
          share_enabled?: boolean | null
          share_token?: string | null
          smart_finish_purchased?: boolean
          smart_finish_purchased_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          transition_arrival_time?: string | null
          transition_departure_time?: string | null
          transition_mode?: string | null
          transportation_preferences?: Json | null
          travelers?: number | null
          trip_type?: string | null
          unlocked_day_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          abandoned_at?: string | null
          agent_notes?: string | null
          arrival_transfer?: Json | null
          blended_dna?: Json | null
          budget_allocations?: Json | null
          budget_currency?: string | null
          budget_include_flight?: boolean | null
          budget_include_hotel?: boolean | null
          budget_individual_cents?: Json | null
          budget_input_mode?: string | null
          budget_tier?: string | null
          budget_total_cents?: number | null
          budget_warning_threshold?: string | null
          budget_warnings_enabled?: boolean | null
          client_id?: string | null
          created_at?: string
          creation_source?: string | null
          departure_transfer?: Json | null
          destination?: string
          destination_country?: string | null
          destinations?: Json | null
          dna_snapshot?: Json | null
          end_date?: string
          flight_intelligence?: Json | null
          flight_selection?: Json | null
          gap_analysis_result?: Json | null
          guest_edit_mode?: string
          hotel_selection?: Json | null
          id?: string
          is_agent_trip?: boolean | null
          is_free_tier_trip?: boolean
          is_multi_city?: boolean | null
          itinerary_data?: Json | null
          itinerary_status?:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          itinerary_version?: number
          journey_id?: string | null
          journey_name?: string | null
          journey_order?: number | null
          journey_total_legs?: number | null
          last_activity_at?: string | null
          metadata?: Json | null
          name?: string
          origin_city?: string | null
          owner_plan_tier?: string | null
          price_lock_expires_at?: string | null
          share_enabled?: boolean | null
          share_token?: string | null
          smart_finish_purchased?: boolean
          smart_finish_purchased_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          transition_arrival_time?: string | null
          transition_departure_time?: string | null
          transition_mode?: string | null
          transportation_preferences?: Json | null
          travelers?: number | null
          trip_type?: string | null
          unlocked_day_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "agent_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_type: string
          id: string
          metadata: Json | null
          source: string | null
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_type: string
          id?: string
          metadata?: Json | null
          source?: string | null
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_type?: string
          id?: string
          metadata?: Json | null
          source?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_credit_bonuses: {
        Row: {
          bonus_type: string
          credits_granted: number
          expires_at: string | null
          granted_at: string
          id: string
          metadata: Json | null
          user_id: string
        }
        Insert: {
          bonus_type: string
          credits_granted: number
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json | null
          user_id: string
        }
        Update: {
          bonus_type?: string
          credits_granted?: number
          expires_at?: string | null
          granted_at?: string
          id?: string
          metadata?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance_cents: number
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance_cents?: number
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance_cents?: number
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_enrichment: {
        Row: {
          action_type: string | null
          created_at: string
          decline_count: number | null
          enrichment_type: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          feedback_reason: string | null
          feedback_tags: string[] | null
          id: string
          interaction_count: number | null
          is_permanent_suppress: boolean | null
          metadata: Json | null
          suppress_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          action_type?: string | null
          created_at?: string
          decline_count?: number | null
          enrichment_type: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          feedback_reason?: string | null
          feedback_tags?: string[] | null
          id?: string
          interaction_count?: number | null
          is_permanent_suppress?: boolean | null
          metadata?: Json | null
          suppress_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          action_type?: string | null
          created_at?: string
          decline_count?: number | null
          enrichment_type?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          feedback_reason?: string | null
          feedback_tags?: string[] | null
          id?: string
          interaction_count?: number | null
          is_permanent_suppress?: boolean | null
          metadata?: Json | null
          suppress_until?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_entitlement_overrides: {
        Row: {
          created_at: string | null
          enabled: boolean | null
          expires_at: string | null
          flag_id: string
          id: string
          reason: string | null
          updated_at: string | null
          user_id: string
          value_json: Json | null
          value_number: number | null
        }
        Insert: {
          created_at?: string | null
          enabled?: boolean | null
          expires_at?: string | null
          flag_id: string
          id?: string
          reason?: string | null
          updated_at?: string | null
          user_id: string
          value_json?: Json | null
          value_number?: number | null
        }
        Update: {
          created_at?: string | null
          enabled?: boolean | null
          expires_at?: string | null
          flag_id?: string
          id?: string
          reason?: string | null
          updated_at?: string | null
          user_id?: string
          value_json?: Json | null
          value_number?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_entitlement_overrides_flag_id_fkey"
            columns: ["flag_id"]
            isOneToOne: false
            referencedRelation: "feature_flags"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preference_insights: {
        Row: {
          created_at: string
          disliked_activity_types: Json | null
          disliked_categories: Json | null
          feedback_count: number | null
          id: string
          insights_summary: string | null
          last_analysis_at: string | null
          loved_activity_types: Json | null
          loved_categories: Json | null
          preferred_pace: string | null
          preferred_times: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disliked_activity_types?: Json | null
          disliked_categories?: Json | null
          feedback_count?: number | null
          id?: string
          insights_summary?: string | null
          last_analysis_at?: string | null
          loved_activity_types?: Json | null
          loved_categories?: Json | null
          preferred_pace?: string | null
          preferred_times?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disliked_activity_types?: Json | null
          disliked_categories?: Json | null
          feedback_count?: number | null
          id?: string
          insights_summary?: string | null
          last_analysis_at?: string | null
          loved_activity_types?: Json | null
          loved_categories?: Json | null
          preferred_pace?: string | null
          preferred_times?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          accessibility_needs: string[] | null
          accommodation_style: string | null
          activity_level: string | null
          activity_weights: Json | null
          agent_business_email: string | null
          agent_business_name: string | null
          airport_radius_miles: number | null
          budget_alerts: boolean | null
          budget_range: Json | null
          budget_tier: string | null
          climate_preferences: string[] | null
          commission_split_config: Json | null
          communication_style: string | null
          completed_at: string | null
          created_at: string
          daytime_bias: string | null
          dietary_restrictions: string[] | null
          dining_style: string | null
          direct_flights_only: boolean | null
          downtime_ratio: string | null
          eco_friendly: boolean | null
          email_notifications: boolean | null
          emotional_drivers: string[] | null
          enable_cost_lookup: boolean | null
          enable_gap_filling: boolean | null
          enable_geocoding: boolean | null
          enable_real_transport: boolean | null
          enable_route_optimization: boolean | null
          enable_venue_verification: boolean | null
          flight_preferences: Json | null
          flight_time_preference: string | null
          food_dislikes: string[] | null
          food_likes: string[] | null
          home_airport: string | null
          hotel_style: string | null
          hotel_vs_flight: string | null
          id: string
          interests: string[] | null
          loyalty_programs: string[] | null
          marketing_emails: boolean | null
          max_activities_per_day: number | null
          mobility_level: string | null
          mobility_needs: string | null
          personal_notes: string | null
          phone_number: string | null
          planning_preference: string | null
          preferred_airlines: string[] | null
          preferred_cabin_class: string | null
          preferred_downtime_minutes: number | null
          preferred_group_size: string | null
          preferred_regions: string[] | null
          price_alerts: boolean | null
          primary_goal: string | null
          push_notifications: boolean | null
          quiz_completed: boolean | null
          quiz_version: string | null
          schedule_flexibility: string | null
          seat_preference: string | null
          sleep_schedule: string | null
          social_energy: string | null
          stripe_connect_account_id: string | null
          stripe_connect_onboarding_complete: boolean | null
          stripe_connect_status: string | null
          stripe_payout_schedule: string | null
          travel_agent_mode: boolean | null
          travel_companions: string[] | null
          travel_frequency: string | null
          travel_pace: string | null
          travel_style: string | null
          travel_vibes: string[] | null
          traveler_type: string | null
          trip_duration: string | null
          trip_reminders: boolean | null
          trip_structure_preference: string | null
          updated_at: string
          user_id: string
          vibe: string | null
          weather_preferences: string[] | null
        }
        Insert: {
          accessibility_needs?: string[] | null
          accommodation_style?: string | null
          activity_level?: string | null
          activity_weights?: Json | null
          agent_business_email?: string | null
          agent_business_name?: string | null
          airport_radius_miles?: number | null
          budget_alerts?: boolean | null
          budget_range?: Json | null
          budget_tier?: string | null
          climate_preferences?: string[] | null
          commission_split_config?: Json | null
          communication_style?: string | null
          completed_at?: string | null
          created_at?: string
          daytime_bias?: string | null
          dietary_restrictions?: string[] | null
          dining_style?: string | null
          direct_flights_only?: boolean | null
          downtime_ratio?: string | null
          eco_friendly?: boolean | null
          email_notifications?: boolean | null
          emotional_drivers?: string[] | null
          enable_cost_lookup?: boolean | null
          enable_gap_filling?: boolean | null
          enable_geocoding?: boolean | null
          enable_real_transport?: boolean | null
          enable_route_optimization?: boolean | null
          enable_venue_verification?: boolean | null
          flight_preferences?: Json | null
          flight_time_preference?: string | null
          food_dislikes?: string[] | null
          food_likes?: string[] | null
          home_airport?: string | null
          hotel_style?: string | null
          hotel_vs_flight?: string | null
          id?: string
          interests?: string[] | null
          loyalty_programs?: string[] | null
          marketing_emails?: boolean | null
          max_activities_per_day?: number | null
          mobility_level?: string | null
          mobility_needs?: string | null
          personal_notes?: string | null
          phone_number?: string | null
          planning_preference?: string | null
          preferred_airlines?: string[] | null
          preferred_cabin_class?: string | null
          preferred_downtime_minutes?: number | null
          preferred_group_size?: string | null
          preferred_regions?: string[] | null
          price_alerts?: boolean | null
          primary_goal?: string | null
          push_notifications?: boolean | null
          quiz_completed?: boolean | null
          quiz_version?: string | null
          schedule_flexibility?: string | null
          seat_preference?: string | null
          sleep_schedule?: string | null
          social_energy?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_complete?: boolean | null
          stripe_connect_status?: string | null
          stripe_payout_schedule?: string | null
          travel_agent_mode?: boolean | null
          travel_companions?: string[] | null
          travel_frequency?: string | null
          travel_pace?: string | null
          travel_style?: string | null
          travel_vibes?: string[] | null
          traveler_type?: string | null
          trip_duration?: string | null
          trip_reminders?: boolean | null
          trip_structure_preference?: string | null
          updated_at?: string
          user_id: string
          vibe?: string | null
          weather_preferences?: string[] | null
        }
        Update: {
          accessibility_needs?: string[] | null
          accommodation_style?: string | null
          activity_level?: string | null
          activity_weights?: Json | null
          agent_business_email?: string | null
          agent_business_name?: string | null
          airport_radius_miles?: number | null
          budget_alerts?: boolean | null
          budget_range?: Json | null
          budget_tier?: string | null
          climate_preferences?: string[] | null
          commission_split_config?: Json | null
          communication_style?: string | null
          completed_at?: string | null
          created_at?: string
          daytime_bias?: string | null
          dietary_restrictions?: string[] | null
          dining_style?: string | null
          direct_flights_only?: boolean | null
          downtime_ratio?: string | null
          eco_friendly?: boolean | null
          email_notifications?: boolean | null
          emotional_drivers?: string[] | null
          enable_cost_lookup?: boolean | null
          enable_gap_filling?: boolean | null
          enable_geocoding?: boolean | null
          enable_real_transport?: boolean | null
          enable_route_optimization?: boolean | null
          enable_venue_verification?: boolean | null
          flight_preferences?: Json | null
          flight_time_preference?: string | null
          food_dislikes?: string[] | null
          food_likes?: string[] | null
          home_airport?: string | null
          hotel_style?: string | null
          hotel_vs_flight?: string | null
          id?: string
          interests?: string[] | null
          loyalty_programs?: string[] | null
          marketing_emails?: boolean | null
          max_activities_per_day?: number | null
          mobility_level?: string | null
          mobility_needs?: string | null
          personal_notes?: string | null
          phone_number?: string | null
          planning_preference?: string | null
          preferred_airlines?: string[] | null
          preferred_cabin_class?: string | null
          preferred_downtime_minutes?: number | null
          preferred_group_size?: string | null
          preferred_regions?: string[] | null
          price_alerts?: boolean | null
          primary_goal?: string | null
          push_notifications?: boolean | null
          quiz_completed?: boolean | null
          quiz_version?: string | null
          schedule_flexibility?: string | null
          seat_preference?: string | null
          sleep_schedule?: string | null
          social_energy?: string | null
          stripe_connect_account_id?: string | null
          stripe_connect_onboarding_complete?: boolean | null
          stripe_connect_status?: string | null
          stripe_payout_schedule?: string | null
          travel_agent_mode?: boolean | null
          travel_companions?: string[] | null
          travel_frequency?: string | null
          travel_pace?: string | null
          travel_style?: string | null
          travel_vibes?: string[] | null
          traveler_type?: string | null
          trip_duration?: string | null
          trip_reminders?: boolean | null
          trip_structure_preference?: string | null
          updated_at?: string
          user_id?: string
          vibe?: string | null
          weather_preferences?: string[] | null
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      user_social_links: {
        Row: {
          created_at: string
          id: string
          platform: string
          updated_at: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          updated_at?: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          updated_at?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_tiers: {
        Row: {
          first_purchase_at: string | null
          highest_purchase: string | null
          tier: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          first_purchase_at?: string | null
          highest_purchase?: string | null
          tier?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          first_purchase_at?: string | null
          highest_purchase?: string | null
          tier?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_usage: {
        Row: {
          count: number | null
          created_at: string | null
          id: string
          metric_key: string
          period: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          id?: string
          metric_key: string
          period: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          id?: string
          metric_key?: string
          period?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      verified_venues: {
        Row: {
          address: string | null
          category: string | null
          coordinates: Json | null
          created_at: string
          destination: string
          expires_at: string
          foursquare_id: string | null
          google_place_id: string | null
          id: string
          last_used_at: string | null
          last_verified_at: string
          name: string
          normalized_name: string
          opening_hours: Json | null
          phone_number: string | null
          price_level: number | null
          rating: number | null
          total_reviews: number | null
          updated_at: string
          usage_count: number | null
          verification_confidence: number | null
          verification_count: number | null
          verification_source: string
          viator_product_code: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          category?: string | null
          coordinates?: Json | null
          created_at?: string
          destination: string
          expires_at?: string
          foursquare_id?: string | null
          google_place_id?: string | null
          id?: string
          last_used_at?: string | null
          last_verified_at?: string
          name: string
          normalized_name: string
          opening_hours?: Json | null
          phone_number?: string | null
          price_level?: number | null
          rating?: number | null
          total_reviews?: number | null
          updated_at?: string
          usage_count?: number | null
          verification_confidence?: number | null
          verification_count?: number | null
          verification_source?: string
          viator_product_code?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          category?: string | null
          coordinates?: Json | null
          created_at?: string
          destination?: string
          expires_at?: string
          foursquare_id?: string | null
          google_place_id?: string | null
          id?: string
          last_used_at?: string | null
          last_verified_at?: string
          name?: string
          normalized_name?: string
          opening_hours?: Json | null
          phone_number?: string | null
          price_level?: number | null
          rating?: number | null
          total_reviews?: number | null
          updated_at?: string
          usage_count?: number | null
          verification_confidence?: number | null
          verification_count?: number | null
          verification_source?: string
          viator_product_code?: string | null
          website?: string | null
        }
        Relationships: []
      }
      voyance_events: {
        Row: {
          created_at: string | null
          event_name: string
          id: string
          properties: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          event_name: string
          id?: string
          properties?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          event_name?: string
          id?: string
          properties?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      voyance_picks: {
        Row: {
          added_by: string | null
          address: string | null
          best_time: string | null
          category: string
          coordinates: Json | null
          created_at: string
          description: string | null
          destination: string
          id: string
          insider_tip: string | null
          is_active: boolean | null
          name: string
          neighborhood: string | null
          price_range: string | null
          priority: number | null
          tags: string[] | null
          updated_at: string
          why_essential: string
        }
        Insert: {
          added_by?: string | null
          address?: string | null
          best_time?: string | null
          category?: string
          coordinates?: Json | null
          created_at?: string
          description?: string | null
          destination: string
          id?: string
          insider_tip?: string | null
          is_active?: boolean | null
          name: string
          neighborhood?: string | null
          price_range?: string | null
          priority?: number | null
          tags?: string[] | null
          updated_at?: string
          why_essential: string
        }
        Update: {
          added_by?: string | null
          address?: string | null
          best_time?: string | null
          category?: string
          coordinates?: Json | null
          created_at?: string
          description?: string | null
          destination?: string
          id?: string
          insider_tip?: string | null
          is_active?: boolean | null
          name?: string
          neighborhood?: string | null
          price_range?: string | null
          priority?: number | null
          tags?: string[] | null
          updated_at?: string
          why_essential?: string
        }
        Relationships: []
      }
    }
    Views: {
      agency_accounts_intake: {
        Row: {
          id: string | null
          intake_token: string | null
          name: string | null
        }
        Insert: {
          id?: string | null
          intake_token?: string | null
          name?: string | null
        }
        Update: {
          id?: string | null
          intake_token?: string | null
          name?: string | null
        }
        Relationships: []
      }
      credit_ledger_safe: {
        Row: {
          action_type: string | null
          activity_id: string | null
          created_at: string | null
          credits_delta: number | null
          id: string | null
          is_free_credit: boolean | null
          metadata: Json | null
          notes: string | null
          transaction_type: string | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type?: string | null
          activity_id?: string | null
          created_at?: string | null
          credits_delta?: number | null
          id?: string | null
          is_free_credit?: boolean | null
          metadata?: Json | null
          notes?: string | null
          transaction_type?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string | null
          activity_id?: string | null
          created_at?: string | null
          credits_delta?: number | null
          id?: string | null
          is_free_credit?: boolean | null
          metadata?: Json | null
          notes?: string | null
          transaction_type?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      finance_trip_profit_summary: {
        Row: {
          agent_earnings_cents: number | null
          agent_id: string | null
          agent_paid_out_cents: number | null
          commission_expected_cents: number | null
          commission_received_cents: number | null
          currency: string | null
          platform_fees_cents: number | null
          stripe_fees_cents: number | null
          total_client_charges_cents: number | null
          total_client_payments_cents: number | null
          total_refunds_cents: number | null
          total_supplier_costs_cents: number | null
          total_supplier_paid_cents: number | null
          trip_gross_profit_cents: number | null
          trip_id: string | null
          trip_name: string | null
        }
        Relationships: []
      }
      profiles_friends: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          handle: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Relationships: []
      }
      profiles_public: {
        Row: {
          avatar_url: string | null
          display_name: string | null
          handle: string | null
          id: string | null
        }
        Insert: {
          avatar_url?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Update: {
          avatar_url?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
        }
        Relationships: []
      }
      profiles_safe: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string | null
          handle: string | null
          id: string | null
          preferred_currency: string | null
          preferred_language: string | null
          quiz_completed: boolean | null
          travel_dna: Json | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          quiz_completed?: boolean | null
          travel_dna?: Json | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string | null
          handle?: string | null
          id?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          quiz_completed?: boolean | null
          travel_dna?: Json | null
          updated_at?: string | null
        }
        Relationships: []
      }
      trip_budget_summary: {
        Row: {
          budget_allocations: Json | null
          budget_currency: string | null
          budget_include_flight: boolean | null
          budget_include_hotel: boolean | null
          budget_per_person_cents: number | null
          budget_total_cents: number | null
          committed_flight_cents: number | null
          committed_hotel_cents: number | null
          committed_other_cents: number | null
          planned_activities_cents: number | null
          planned_food_cents: number | null
          planned_total_cents: number | null
          planned_transit_cents: number | null
          remaining_cents: number | null
          total_committed_cents: number | null
          travelers: number | null
          trip_id: string | null
        }
        Relationships: []
      }
      trip_cost_summary: {
        Row: {
          action_type: string | null
          avg_amadeus: number | null
          avg_cost_usd: number | null
          avg_duration_ms: number | null
          avg_google_geocoding: number | null
          avg_google_photos: number | null
          avg_google_places: number | null
          avg_google_routes: number | null
          avg_input_tokens: number | null
          avg_output_tokens: number | null
          avg_perplexity: number | null
          first_call: string | null
          last_call: string | null
          model: string | null
          total_calls: number | null
          total_cost_usd: number | null
        }
        Relationships: []
      }
      trip_finance_ledger: {
        Row: {
          agent_id: string | null
          arc_bsp_count: number | null
          commission_track_count: number | null
          supplier_direct_count: number | null
          total_client_charges_cents: number | null
          total_commission_expected_cents: number | null
          total_commission_received_cents: number | null
          total_supplier_owed_cents: number | null
          total_supplier_paid_cents: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agency_booking_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "agency_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_booking_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "finance_trip_profit_summary"
            referencedColumns: ["trip_id"]
          },
        ]
      }
      trip_members_safe: {
        Row: {
          accepted_at: string | null
          created_at: string | null
          email: string | null
          id: string | null
          invited_at: string | null
          name: string | null
          role: Database["public"]["Enums"]["trip_member_role"] | null
          trip_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          invited_at?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["trip_member_role"] | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted_at?: string | null
          created_at?: string | null
          email?: never
          id?: string | null
          invited_at?: string | null
          name?: string | null
          role?: Database["public"]["Enums"]["trip_member_role"] | null
          trip_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences_safe: {
        Row: {
          accessibility_needs: string[] | null
          accommodation_style: string | null
          activity_level: string | null
          budget_tier: string | null
          climate_preferences: string[] | null
          created_at: string | null
          dietary_restrictions: string[] | null
          dining_style: string | null
          eco_friendly: boolean | null
          food_dislikes: string[] | null
          food_likes: string[] | null
          hotel_style: string | null
          interests: string[] | null
          mobility_level: string | null
          planning_preference: string | null
          preferred_regions: string[] | null
          quiz_completed: boolean | null
          social_energy: string | null
          travel_pace: string | null
          travel_style: string | null
          travel_vibes: string[] | null
          traveler_type: string | null
          trip_structure_preference: string | null
          updated_at: string | null
          user_id: string | null
          weather_preferences: string[] | null
        }
        Insert: {
          accessibility_needs?: string[] | null
          accommodation_style?: string | null
          activity_level?: string | null
          budget_tier?: string | null
          climate_preferences?: string[] | null
          created_at?: string | null
          dietary_restrictions?: string[] | null
          dining_style?: string | null
          eco_friendly?: boolean | null
          food_dislikes?: string[] | null
          food_likes?: string[] | null
          hotel_style?: string | null
          interests?: string[] | null
          mobility_level?: string | null
          planning_preference?: string | null
          preferred_regions?: string[] | null
          quiz_completed?: boolean | null
          social_energy?: string | null
          travel_pace?: string | null
          travel_style?: string | null
          travel_vibes?: string[] | null
          traveler_type?: string | null
          trip_structure_preference?: string | null
          updated_at?: string | null
          user_id?: string | null
          weather_preferences?: string[] | null
        }
        Update: {
          accessibility_needs?: string[] | null
          accommodation_style?: string | null
          activity_level?: string | null
          budget_tier?: string | null
          climate_preferences?: string[] | null
          created_at?: string | null
          dietary_restrictions?: string[] | null
          dining_style?: string | null
          eco_friendly?: boolean | null
          food_dislikes?: string[] | null
          food_likes?: string[] | null
          hotel_style?: string | null
          interests?: string[] | null
          mobility_level?: string | null
          planning_preference?: string | null
          preferred_regions?: string[] | null
          quiz_completed?: boolean | null
          social_energy?: string | null
          travel_pace?: string | null
          travel_style?: string | null
          travel_vibes?: string[] | null
          traveler_type?: string | null
          trip_structure_preference?: string | null
          updated_at?: string | null
          user_id?: string | null
          weather_preferences?: string[] | null
        }
        Relationships: []
      }
      v_budget_by_category: {
        Row: {
          category: string | null
          category_total_all_travelers_usd: number | null
          category_total_per_person_usd: number | null
          item_count: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      v_day_totals: {
        Row: {
          activity_count: number | null
          day_number: number | null
          day_total_all_travelers_usd: number | null
          day_total_per_person_usd: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      v_google_spend_per_trip: {
        Row: {
          geocoding_calls: number | null
          geocoding_usd: number | null
          photos_calls: number | null
          photos_usd: number | null
          places_calls: number | null
          places_usd: number | null
          routes_calls: number | null
          routes_usd: number | null
          spend_date: string | null
          total_google_usd: number | null
          tracking_records: number | null
          trip_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_cost_tracking_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_cost_tracking_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      v_payments_summary: {
        Row: {
          paid_count: number | null
          total_estimated_usd: number | null
          total_paid_usd: number | null
          total_remaining_usd: number | null
          trip_id: string | null
          unpaid_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      v_trip_total: {
        Row: {
          activity_count: number | null
          days_with_costs: number | null
          total_all_travelers_usd: number | null
          total_per_person_usd: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_summary"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "activity_costs_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_trip_invite: { Args: { p_token: string }; Returns: Json }
      award_founding_member: {
        Args: { p_stripe_session_id?: string; p_user_id: string }
        Returns: Json
      }
      claim_first_trip_benefit: { Args: { p_user_id: string }; Returns: Json }
      cleanup_expired_search_cache: { Args: never; Returns: number }
      cleanup_expired_venues: { Args: never; Returns: number }
      cleanup_rate_limits: { Args: never; Returns: undefined }
      consume_free_edit: { Args: { p_user_id: string }; Returns: Json }
      deduct_credits_fifo: {
        Args: { p_cost: number; p_user_id: string }
        Returns: Json
      }
      fulfill_credit_purchase: {
        Args: {
          p_amount_cents: number
          p_bonus_credits: number
          p_club_tier?: string
          p_credit_type: string
          p_credits: number
          p_price_id?: string
          p_product_id?: string
          p_stripe_session_id: string
          p_user_id: string
        }
        Returns: Json
      }
      generate_booking_reference: { Args: never; Returns: string }
      generate_intake_token: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_share_token:
        | { Args: never; Returns: string }
        | { Args: { size?: number }; Returns: string }
      get_consumer_shared_trip: {
        Args: { p_share_token: string }
        Returns: Json
      }
      get_current_user_email: { Args: never; Returns: string }
      get_founding_member_count: { Args: never; Returns: number }
      get_intake_account: {
        Args: { p_intake_token: string }
        Returns: {
          id: string
          name: string
        }[]
      }
      get_journey_trips: {
        Args: { p_journey_id: string }
        Returns: {
          abandoned_at: string | null
          agent_notes: string | null
          arrival_transfer: Json | null
          blended_dna: Json | null
          budget_allocations: Json | null
          budget_currency: string | null
          budget_include_flight: boolean | null
          budget_include_hotel: boolean | null
          budget_individual_cents: Json | null
          budget_input_mode: string | null
          budget_tier: string | null
          budget_total_cents: number | null
          budget_warning_threshold: string | null
          budget_warnings_enabled: boolean | null
          client_id: string | null
          created_at: string
          creation_source: string | null
          departure_transfer: Json | null
          destination: string
          destination_country: string | null
          destinations: Json | null
          dna_snapshot: Json | null
          end_date: string
          flight_intelligence: Json | null
          flight_selection: Json | null
          gap_analysis_result: Json | null
          guest_edit_mode: string
          hotel_selection: Json | null
          id: string
          is_agent_trip: boolean | null
          is_free_tier_trip: boolean
          is_multi_city: boolean | null
          itinerary_data: Json | null
          itinerary_status:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          itinerary_version: number
          journey_id: string | null
          journey_name: string | null
          journey_order: number | null
          journey_total_legs: number | null
          last_activity_at: string | null
          metadata: Json | null
          name: string
          origin_city: string | null
          owner_plan_tier: string | null
          price_lock_expires_at: string | null
          share_enabled: boolean | null
          share_token: string | null
          smart_finish_purchased: boolean
          smart_finish_purchased_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          transition_arrival_time: string | null
          transition_departure_time: string | null
          transition_mode: string | null
          transportation_preferences: Json | null
          travelers: number | null
          trip_type: string | null
          unlocked_day_count: number | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "trips"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_platform_destination_count: { Args: never; Returns: number }
      get_platform_trip_count: { Args: never; Returns: number }
      get_shared_trip_payload: {
        Args: { p_share_token: string }
        Returns: Json
      }
      get_trip_invite_info: { Args: { p_token: string }; Returns: Json }
      get_trip_permission: { Args: { p_trip_id: string }; Returns: Json }
      get_unit_economics_summary: {
        Args: { p_end_date?: string; p_start_date?: string }
        Returns: Json
      }
      get_user_id_by_email: { Args: { lookup_email: string }; Returns: string }
      get_user_info_by_email: {
        Args: { lookup_email: string }
        Returns: {
          display_name: string
          first_name: string
          handle: string
          last_name: string
          user_email: string
          user_id: string
        }[]
      }
      get_user_trip_ids: { Args: { uid: string }; Returns: string[] }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      increment_daily_usage: {
        Args: { p_action_type: string; p_usage_date: string; p_user_id: string }
        Returns: number
      }
      insert_audit_log: {
        Args: {
          p_action: string
          p_action_type?: string
          p_actor?: string
          p_metadata?: Json
          p_target?: string
          p_target_id?: string
          p_user_id?: string
        }
        Returns: string
      }
      insert_user_audit_log: {
        Args: {
          p_action: string
          p_action_type?: string
          p_metadata?: Json
          p_target?: string
          p_target_id?: string
        }
        Returns: string
      }
      is_trip_collaborator: {
        Args: { p_require_edit?: boolean; p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      is_trip_member: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      is_trip_owner: { Args: { p_trip_id: string }; Returns: boolean }
      optimistic_update_itinerary: {
        Args: {
          p_expected_version: number
          p_itinerary_data: Json
          p_trip_id: string
        }
        Returns: Json
      }
      resolve_or_rotate_invite: {
        Args: { p_force_rotate?: boolean; p_trip_id: string }
        Returns: Json
      }
      submit_client_intake: {
        Args: {
          p_allergies?: string[]
          p_date_of_birth?: string
          p_dietary_restrictions?: string[]
          p_email?: string
          p_emergency_contact?: Json
          p_gender?: string
          p_intake_token: string
          p_legal_first_name: string
          p_legal_last_name: string
          p_meal_preference?: string
          p_medical_notes?: string
          p_mobility_needs?: string
          p_notes?: string
          p_passport_country?: string
          p_passport_expiry?: string
          p_phone?: string
          p_preferred_name?: string
          p_seat_preference?: string
        }
        Returns: Json
      }
      sync_expired_credit_balances: { Args: never; Returns: number }
      toggle_consumer_trip_share: {
        Args: { p_enabled: boolean; p_trip_id: string }
        Returns: Json
      }
      transition_booking_state: {
        Args: {
          p_activity_id: string
          p_metadata?: Json
          p_new_state: Database["public"]["Enums"]["booking_item_state"]
          p_trigger_reference?: string
          p_trigger_source?: string
        }
        Returns: Json
      }
      update_collaborator_permission: {
        Args: { p_collaborator_id: string; p_permission: string }
        Returns: Json
      }
    }
    Enums: {
      agency_account_type: "individual" | "household" | "company"
      app_role: "user" | "admin" | "moderator"
      booking_item_state:
        | "not_selected"
        | "selected_pending"
        | "booked_confirmed"
        | "changed"
        | "cancelled"
        | "refunded"
      booking_product_type:
        | "activity"
        | "hotel"
        | "flight"
        | "transfer"
        | "package"
      booking_segment_type:
        | "flight"
        | "hotel"
        | "transfer"
        | "rail"
        | "tour"
        | "cruise"
        | "insurance"
        | "car_rental"
        | "other"
      booking_settlement_type:
        | "arc_bsp"
        | "supplier_direct"
        | "commission_track"
      booking_source: "native_api" | "imported" | "client_booked" | "manual"
      booking_status_v2:
        | "pending"
        | "confirmed"
        | "ticketed"
        | "cancelled"
        | "refunded"
        | "no_show"
        | "completed"
      booking_supplier:
        | "viator"
        | "rapid_hotels"
        | "amadeus"
        | "direct"
        | "manual"
      communication_type: "email" | "sms" | "call" | "note" | "approval"
      cost_category:
        | "home_browse"
        | "quiz"
        | "explore"
        | "itinerary_gen"
        | "itinerary_edit"
        | "booking_search"
        | "recommendations"
        | "enrichment"
        | "other"
      document_type:
        | "passport"
        | "visa"
        | "insurance"
        | "confirmation"
        | "invoice"
        | "receipt"
        | "waiver"
        | "itinerary"
        | "other"
      expense_split_type: "equal" | "manual" | "percentage"
      feedback_prompt_type:
        | "quick_reaction"
        | "day_summary"
        | "restaurant_specific"
        | "departure_summary"
        | "one_week_followup"
      feedback_question_type:
        | "emoji_scale"
        | "single_select"
        | "multi_select"
        | "text"
        | "activity_pick"
        | "rating_scale"
      finance_entry_source:
        | "stripe_webhook"
        | "manual"
        | "import"
        | "system"
        | "api"
      finance_entry_type:
        | "client_charge"
        | "client_payment"
        | "client_refund"
        | "client_credit"
        | "supplier_payable"
        | "supplier_payment"
        | "commission_expected"
        | "commission_received"
        | "agent_earning"
        | "agent_payout"
        | "platform_fee"
        | "stripe_fee"
        | "adjustment"
      friendship_status: "pending" | "accepted" | "declined" | "blocked"
      invoice_status:
        | "draft"
        | "sent"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
        | "refunded"
      itinerary_status:
        | "not_started"
        | "queued"
        | "generating"
        | "partial"
        | "ready"
        | "failed"
      payment_method:
        | "credit_card"
        | "bank_transfer"
        | "check"
        | "cash"
        | "stripe"
        | "other"
      payment_status_enum: "pending" | "paid" | "partial"
      quote_status:
        | "draft"
        | "sent"
        | "viewed"
        | "approved"
        | "rejected"
        | "expired"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "pending" | "in_progress" | "completed" | "cancelled"
      trip_member_role: "primary" | "attendee"
      trip_status:
        | "draft"
        | "planning"
        | "booked"
        | "active"
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
      agency_account_type: ["individual", "household", "company"],
      app_role: ["user", "admin", "moderator"],
      booking_item_state: [
        "not_selected",
        "selected_pending",
        "booked_confirmed",
        "changed",
        "cancelled",
        "refunded",
      ],
      booking_product_type: [
        "activity",
        "hotel",
        "flight",
        "transfer",
        "package",
      ],
      booking_segment_type: [
        "flight",
        "hotel",
        "transfer",
        "rail",
        "tour",
        "cruise",
        "insurance",
        "car_rental",
        "other",
      ],
      booking_settlement_type: [
        "arc_bsp",
        "supplier_direct",
        "commission_track",
      ],
      booking_source: ["native_api", "imported", "client_booked", "manual"],
      booking_status_v2: [
        "pending",
        "confirmed",
        "ticketed",
        "cancelled",
        "refunded",
        "no_show",
        "completed",
      ],
      booking_supplier: [
        "viator",
        "rapid_hotels",
        "amadeus",
        "direct",
        "manual",
      ],
      communication_type: ["email", "sms", "call", "note", "approval"],
      cost_category: [
        "home_browse",
        "quiz",
        "explore",
        "itinerary_gen",
        "itinerary_edit",
        "booking_search",
        "recommendations",
        "enrichment",
        "other",
      ],
      document_type: [
        "passport",
        "visa",
        "insurance",
        "confirmation",
        "invoice",
        "receipt",
        "waiver",
        "itinerary",
        "other",
      ],
      expense_split_type: ["equal", "manual", "percentage"],
      feedback_prompt_type: [
        "quick_reaction",
        "day_summary",
        "restaurant_specific",
        "departure_summary",
        "one_week_followup",
      ],
      feedback_question_type: [
        "emoji_scale",
        "single_select",
        "multi_select",
        "text",
        "activity_pick",
        "rating_scale",
      ],
      finance_entry_source: [
        "stripe_webhook",
        "manual",
        "import",
        "system",
        "api",
      ],
      finance_entry_type: [
        "client_charge",
        "client_payment",
        "client_refund",
        "client_credit",
        "supplier_payable",
        "supplier_payment",
        "commission_expected",
        "commission_received",
        "agent_earning",
        "agent_payout",
        "platform_fee",
        "stripe_fee",
        "adjustment",
      ],
      friendship_status: ["pending", "accepted", "declined", "blocked"],
      invoice_status: [
        "draft",
        "sent",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
        "refunded",
      ],
      itinerary_status: [
        "not_started",
        "queued",
        "generating",
        "partial",
        "ready",
        "failed",
      ],
      payment_method: [
        "credit_card",
        "bank_transfer",
        "check",
        "cash",
        "stripe",
        "other",
      ],
      payment_status_enum: ["pending", "paid", "partial"],
      quote_status: [
        "draft",
        "sent",
        "viewed",
        "approved",
        "rejected",
        "expired",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["pending", "in_progress", "completed", "cancelled"],
      trip_member_role: ["primary", "attendee"],
      trip_status: [
        "draft",
        "planning",
        "booked",
        "active",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
