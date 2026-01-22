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
          rating?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feedback_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
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
          status: Database["public"]["Enums"]["booking_status"] | null
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
          status?: Database["public"]["Enums"]["booking_status"] | null
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
          status?: Database["public"]["Enums"]["booking_status"] | null
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
      attractions: {
        Row: {
          address: string | null
          average_rating: number | null
          category: string | null
          created_at: string
          crowd_patterns: Json | null
          description: string | null
          destination_id: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          opening_hours: Json | null
          peak_hours: Json | null
          price_range: Json | null
          subcategory: string | null
          tags: Json | null
          updated_at: string
          visit_duration_mins: number | null
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          category?: string | null
          created_at?: string
          crowd_patterns?: Json | null
          description?: string | null
          destination_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          opening_hours?: Json | null
          peak_hours?: Json | null
          price_range?: Json | null
          subcategory?: string | null
          tags?: Json | null
          updated_at?: string
          visit_duration_mins?: number | null
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          category?: string | null
          created_at?: string
          crowd_patterns?: Json | null
          description?: string | null
          destination_id?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          opening_hours?: Json | null
          peak_hours?: Json | null
          price_range?: Json | null
          subcategory?: string | null
          tags?: Json | null
          updated_at?: string
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
      booking_history: {
        Row: {
          booking_id: string
          changes: Json | null
          created_at: string
          event_type: string
          id: string
          new_status: Database["public"]["Enums"]["booking_status_v2"] | null
          notes: string | null
          previous_status:
            | Database["public"]["Enums"]["booking_status_v2"]
            | null
          supplier_response: Json | null
          triggered_by: string | null
          triggered_by_user_id: string | null
        }
        Insert: {
          booking_id: string
          changes?: Json | null
          created_at?: string
          event_type: string
          id?: string
          new_status?: Database["public"]["Enums"]["booking_status_v2"] | null
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["booking_status_v2"]
            | null
          supplier_response?: Json | null
          triggered_by?: string | null
          triggered_by_user_id?: string | null
        }
        Update: {
          booking_id?: string
          changes?: Json | null
          created_at?: string
          event_type?: string
          id?: string
          new_status?: Database["public"]["Enums"]["booking_status_v2"] | null
          notes?: string | null
          previous_status?:
            | Database["public"]["Enums"]["booking_status_v2"]
            | null
          supplier_response?: Json | null
          triggered_by?: string | null
          triggered_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_history_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_offers: {
        Row: {
          availability_summary: string | null
          available_dates: Json | null
          cancellation_summary: string | null
          created_at: string
          currency: string
          deep_link: string | null
          description: string | null
          duration_minutes: number | null
          exclusions: Json | null
          expires_at: string
          fetched_at: string
          id: string
          image_url: string | null
          image_urls: Json | null
          inclusions: Json | null
          location: Json | null
          max_participants: number | null
          min_participants: number | null
          price_breakdown: Json | null
          price_cents: number
          product_type: Database["public"]["Enums"]["booking_product_type"]
          rating: number | null
          review_count: number | null
          supplier: Database["public"]["Enums"]["booking_supplier"]
          supplier_metadata: Json | null
          supplier_offer_id: string
          supplier_product_code: string | null
          title: string
          trip_id: string | null
          user_id: string
        }
        Insert: {
          availability_summary?: string | null
          available_dates?: Json | null
          cancellation_summary?: string | null
          created_at?: string
          currency?: string
          deep_link?: string | null
          description?: string | null
          duration_minutes?: number | null
          exclusions?: Json | null
          expires_at?: string
          fetched_at?: string
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          inclusions?: Json | null
          location?: Json | null
          max_participants?: number | null
          min_participants?: number | null
          price_breakdown?: Json | null
          price_cents: number
          product_type: Database["public"]["Enums"]["booking_product_type"]
          rating?: number | null
          review_count?: number | null
          supplier: Database["public"]["Enums"]["booking_supplier"]
          supplier_metadata?: Json | null
          supplier_offer_id: string
          supplier_product_code?: string | null
          title: string
          trip_id?: string | null
          user_id: string
        }
        Update: {
          availability_summary?: string | null
          available_dates?: Json | null
          cancellation_summary?: string | null
          created_at?: string
          currency?: string
          deep_link?: string | null
          description?: string | null
          duration_minutes?: number | null
          exclusions?: Json | null
          expires_at?: string
          fetched_at?: string
          id?: string
          image_url?: string | null
          image_urls?: Json | null
          inclusions?: Json | null
          location?: Json | null
          max_participants?: number | null
          min_participants?: number | null
          price_breakdown?: Json | null
          price_cents?: number
          product_type?: Database["public"]["Enums"]["booking_product_type"]
          rating?: number | null
          review_count?: number | null
          supplier?: Database["public"]["Enums"]["booking_supplier"]
          supplier_metadata?: Json | null
          supplier_offer_id?: string
          supplier_product_code?: string | null
          title?: string
          trip_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_offers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_quotes: {
        Row: {
          cancellation_policy: Json
          created_at: string
          currency: string
          exclusions: Json | null
          expires_at: string
          id: string
          inclusions: Json | null
          is_locked: boolean
          modification_policy: Json | null
          offer_id: string | null
          participant_count: number
          price_breakdown: Json | null
          price_cents: number
          product_type: Database["public"]["Enums"]["booking_product_type"]
          selected_date: string | null
          selected_time: string | null
          supplier: Database["public"]["Enums"]["booking_supplier"]
          supplier_offer_id: string
          supplier_quote_id: string | null
          title: string
          trip_activity_id: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancellation_policy: Json
          created_at?: string
          currency?: string
          exclusions?: Json | null
          expires_at: string
          id?: string
          inclusions?: Json | null
          is_locked?: boolean
          modification_policy?: Json | null
          offer_id?: string | null
          participant_count?: number
          price_breakdown?: Json | null
          price_cents: number
          product_type: Database["public"]["Enums"]["booking_product_type"]
          selected_date?: string | null
          selected_time?: string | null
          supplier: Database["public"]["Enums"]["booking_supplier"]
          supplier_offer_id: string
          supplier_quote_id?: string | null
          title: string
          trip_activity_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancellation_policy?: Json
          created_at?: string
          currency?: string
          exclusions?: Json | null
          expires_at?: string
          id?: string
          inclusions?: Json | null
          is_locked?: boolean
          modification_policy?: Json | null
          offer_id?: string | null
          participant_count?: number
          price_breakdown?: Json | null
          price_cents?: number
          product_type?: Database["public"]["Enums"]["booking_product_type"]
          selected_date?: string | null
          selected_time?: string | null
          supplier?: Database["public"]["Enums"]["booking_supplier"]
          supplier_offer_id?: string
          supplier_quote_id?: string | null
          title?: string
          trip_activity_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "booking_quotes_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "booking_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quotes_trip_activity_id_fkey"
            columns: ["trip_activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "booking_quotes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      booking_state_log: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          new_state: Database["public"]["Enums"]["booking_item_state"]
          previous_state:
            | Database["public"]["Enums"]["booking_item_state"]
            | null
          trigger_reference: string | null
          trigger_source: string | null
          trip_activity_id: string | null
          trip_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          new_state: Database["public"]["Enums"]["booking_item_state"]
          previous_state?:
            | Database["public"]["Enums"]["booking_item_state"]
            | null
          trigger_reference?: string | null
          trigger_source?: string | null
          trip_activity_id?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          new_state?: Database["public"]["Enums"]["booking_item_state"]
          previous_state?:
            | Database["public"]["Enums"]["booking_item_state"]
            | null
          trigger_reference?: string | null
          trigger_source?: string | null
          trip_activity_id?: string | null
          trip_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "booking_state_log_trip_activity_id_fkey"
            columns: ["trip_activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
        ]
      }
      bookings: {
        Row: {
          booked_date: string
          booked_time: string | null
          booking_reference: string
          cancellation_policy: Json
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          currency: string
          id: string
          last_supplier_sync: string | null
          lead_traveler_email: string | null
          lead_traveler_name: string | null
          modification_policy: Json | null
          offer_id: string | null
          paid_at: string | null
          participant_count: number
          payment_method: string | null
          price_breakdown: Json | null
          price_cents: number
          product_type: Database["public"]["Enums"]["booking_product_type"]
          quote_id: string | null
          refund_amount_cents: number | null
          refund_status: string | null
          refunded_at: string | null
          status: Database["public"]["Enums"]["booking_status_v2"]
          stripe_charge_id: string | null
          stripe_payment_intent_id: string | null
          supplier: Database["public"]["Enums"]["booking_supplier"]
          supplier_booking_id: string | null
          supplier_emails: Json | null
          supplier_status: string | null
          tickets: Json | null
          title: string
          traveler_data: Json
          trip_activity_id: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
          voucher_data: Json | null
          voucher_url: string | null
        }
        Insert: {
          booked_date: string
          booked_time?: string | null
          booking_reference: string
          cancellation_policy: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_supplier_sync?: string | null
          lead_traveler_email?: string | null
          lead_traveler_name?: string | null
          modification_policy?: Json | null
          offer_id?: string | null
          paid_at?: string | null
          participant_count?: number
          payment_method?: string | null
          price_breakdown?: Json | null
          price_cents: number
          product_type: Database["public"]["Enums"]["booking_product_type"]
          quote_id?: string | null
          refund_amount_cents?: number | null
          refund_status?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["booking_status_v2"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          supplier: Database["public"]["Enums"]["booking_supplier"]
          supplier_booking_id?: string | null
          supplier_emails?: Json | null
          supplier_status?: string | null
          tickets?: Json | null
          title: string
          traveler_data: Json
          trip_activity_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
          voucher_data?: Json | null
          voucher_url?: string | null
        }
        Update: {
          booked_date?: string
          booked_time?: string | null
          booking_reference?: string
          cancellation_policy?: Json
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          last_supplier_sync?: string | null
          lead_traveler_email?: string | null
          lead_traveler_name?: string | null
          modification_policy?: Json | null
          offer_id?: string | null
          paid_at?: string | null
          participant_count?: number
          payment_method?: string | null
          price_breakdown?: Json | null
          price_cents?: number
          product_type?: Database["public"]["Enums"]["booking_product_type"]
          quote_id?: string | null
          refund_amount_cents?: number | null
          refund_status?: string | null
          refunded_at?: string | null
          status?: Database["public"]["Enums"]["booking_status_v2"]
          stripe_charge_id?: string | null
          stripe_payment_intent_id?: string | null
          supplier?: Database["public"]["Enums"]["booking_supplier"]
          supplier_booking_id?: string | null
          supplier_emails?: Json | null
          supplier_status?: string | null
          tickets?: Json | null
          title?: string
          traveler_data?: Json
          trip_activity_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
          voucher_data?: Json | null
          voucher_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "booking_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "booking_quotes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_activity_id_fkey"
            columns: ["trip_activity_id"]
            isOneToOne: false
            referencedRelation: "trip_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bookings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
          metadata: Json | null
          photo_reference: string | null
          place_id: string | null
          quality_score: number | null
          source: string
          thumbnail_url: string | null
          updated_at: string | null
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
          metadata?: Json | null
          photo_reference?: string | null
          place_id?: string | null
          quality_score?: number | null
          source: string
          thumbnail_url?: string | null
          updated_at?: string | null
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
          metadata?: Json | null
          photo_reference?: string | null
          place_id?: string | null
          quality_score?: number | null
          source?: string
          thumbnail_url?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      destination_images: {
        Row: {
          alt_text: string | null
          confidence_score: number | null
          created_at: string
          destination_id: string
          id: string
          image_url: string
          is_hero: boolean | null
          is_primary: boolean | null
          source: string | null
          updated_at: string
        }
        Insert: {
          alt_text?: string | null
          confidence_score?: number | null
          created_at?: string
          destination_id: string
          id?: string
          image_url: string
          is_hero?: boolean | null
          is_primary?: boolean | null
          source?: string | null
          updated_at?: string
        }
        Update: {
          alt_text?: string | null
          confidence_score?: number | null
          created_at?: string
          destination_id?: string
          id?: string
          image_url?: string
          is_hero?: boolean | null
          is_primary?: boolean | null
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      destinations: {
        Row: {
          airport_codes: Json | null
          airport_lookup_codes: string | null
          alternative_names: Json | null
          best_time_to_visit: string | null
          city: string
          coordinates: Json | null
          cost_tier: string | null
          country: string
          created_at: string
          currency_code: string | null
          currency_data: Json | null
          default_transport_modes: Json | null
          description: string | null
          dynamic_currency_conversion: Json | null
          dynamic_weather: Json | null
          enrichment_priority: number | null
          enrichment_status: Json | null
          featured: boolean | null
          google_place_id: string | null
          id: string
          known_for: Json | null
          last_content_update: string | null
          last_currency_update: string | null
          last_enriched: string | null
          last_weather_update: string | null
          points_of_interest: Json | null
          population: number | null
          region: string | null
          safe_search_keywords: Json | null
          seasonal_events: Json | null
          seasonality: string | null
          stock_image_url: string | null
          tags: Json | null
          temperature_range: string | null
          tier: number | null
          timezone: string | null
          updated_at: string
          weather_data: Json | null
        }
        Insert: {
          airport_codes?: Json | null
          airport_lookup_codes?: string | null
          alternative_names?: Json | null
          best_time_to_visit?: string | null
          city: string
          coordinates?: Json | null
          cost_tier?: string | null
          country: string
          created_at?: string
          currency_code?: string | null
          currency_data?: Json | null
          default_transport_modes?: Json | null
          description?: string | null
          dynamic_currency_conversion?: Json | null
          dynamic_weather?: Json | null
          enrichment_priority?: number | null
          enrichment_status?: Json | null
          featured?: boolean | null
          google_place_id?: string | null
          id?: string
          known_for?: Json | null
          last_content_update?: string | null
          last_currency_update?: string | null
          last_enriched?: string | null
          last_weather_update?: string | null
          points_of_interest?: Json | null
          population?: number | null
          region?: string | null
          safe_search_keywords?: Json | null
          seasonal_events?: Json | null
          seasonality?: string | null
          stock_image_url?: string | null
          tags?: Json | null
          temperature_range?: string | null
          tier?: number | null
          timezone?: string | null
          updated_at?: string
          weather_data?: Json | null
        }
        Update: {
          airport_codes?: Json | null
          airport_lookup_codes?: string | null
          alternative_names?: Json | null
          best_time_to_visit?: string | null
          city?: string
          coordinates?: Json | null
          cost_tier?: string | null
          country?: string
          created_at?: string
          currency_code?: string | null
          currency_data?: Json | null
          default_transport_modes?: Json | null
          description?: string | null
          dynamic_currency_conversion?: Json | null
          dynamic_weather?: Json | null
          enrichment_priority?: number | null
          enrichment_status?: Json | null
          featured?: boolean | null
          google_place_id?: string | null
          id?: string
          known_for?: Json | null
          last_content_update?: string | null
          last_currency_update?: string | null
          last_enriched?: string | null
          last_weather_update?: string | null
          points_of_interest?: Json | null
          population?: number | null
          region?: string | null
          safe_search_keywords?: Json | null
          seasonal_events?: Json | null
          seasonality?: string | null
          stock_image_url?: string | null
          tags?: Json | null
          temperature_range?: string | null
          tier?: number | null
          timezone?: string | null
          updated_at?: string
          weather_data?: Json | null
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
      guides: {
        Row: {
          author: string | null
          category: string | null
          content: Json | null
          created_at: string
          destination_city: string | null
          destination_country: string | null
          excerpt: string | null
          featured: boolean | null
          id: string
          image_url: string | null
          published: boolean | null
          reading_time: number | null
          slug: string
          subtitle: string | null
          tags: Json | null
          title: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string
          destination_city?: string | null
          destination_country?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published?: boolean | null
          reading_time?: number | null
          slug: string
          subtitle?: string | null
          tags?: Json | null
          title: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          category?: string | null
          content?: Json | null
          created_at?: string
          destination_city?: string | null
          destination_country?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: string
          image_url?: string | null
          published?: boolean | null
          reading_time?: number | null
          slug?: string
          subtitle?: string | null
          tags?: Json | null
          title?: string
          updated_at?: string
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
          handle: string | null
          home_airport: string | null
          id: string
          last_name: string | null
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
          handle?: string | null
          home_airport?: string | null
          id: string
          last_name?: string | null
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
          handle?: string | null
          home_airport?: string | null
          id?: string
          last_name?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          quiz_completed?: boolean | null
          travel_dna?: Json | null
          travel_dna_overrides?: Json | null
          updated_at?: string
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
          invited_by: string | null
          permission: string
          trip_id: string
          user_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          permission?: string
          trip_id: string
          user_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          id?: string
          invited_by?: string | null
          permission?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_collaborators_trip_id_fkey"
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
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_payments: {
        Row: {
          amount_cents: number
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
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
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
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          abandoned_at: string | null
          agent_notes: string | null
          budget_tier: string | null
          client_id: string | null
          created_at: string
          destination: string
          destination_country: string | null
          destinations: Json | null
          end_date: string
          flight_selection: Json | null
          hotel_selection: Json | null
          id: string
          is_agent_trip: boolean | null
          is_multi_city: boolean | null
          itinerary_data: Json | null
          itinerary_status:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          last_activity_at: string | null
          metadata: Json | null
          name: string
          origin_city: string | null
          owner_plan_tier: string | null
          price_lock_expires_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          transportation_preferences: Json | null
          travelers: number | null
          trip_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          abandoned_at?: string | null
          agent_notes?: string | null
          budget_tier?: string | null
          client_id?: string | null
          created_at?: string
          destination: string
          destination_country?: string | null
          destinations?: Json | null
          end_date: string
          flight_selection?: Json | null
          hotel_selection?: Json | null
          id?: string
          is_agent_trip?: boolean | null
          is_multi_city?: boolean | null
          itinerary_data?: Json | null
          itinerary_status?:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          last_activity_at?: string | null
          metadata?: Json | null
          name: string
          origin_city?: string | null
          owner_plan_tier?: string | null
          price_lock_expires_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          transportation_preferences?: Json | null
          travelers?: number | null
          trip_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          abandoned_at?: string | null
          agent_notes?: string | null
          budget_tier?: string | null
          client_id?: string | null
          created_at?: string
          destination?: string
          destination_country?: string | null
          destinations?: Json | null
          end_date?: string
          flight_selection?: Json | null
          hotel_selection?: Json | null
          id?: string
          is_agent_trip?: boolean | null
          is_multi_city?: boolean | null
          itinerary_data?: Json | null
          itinerary_status?:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          last_activity_at?: string | null
          metadata?: Json | null
          name?: string
          origin_city?: string | null
          owner_plan_tier?: string | null
          price_lock_expires_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          transportation_preferences?: Json | null
          travelers?: number | null
          trip_type?: string | null
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
          created_at: string
          decline_count: number | null
          enrichment_type: string
          entity_id: string | null
          entity_name: string | null
          entity_type: string | null
          feedback_reason: string | null
          feedback_tags: string[] | null
          id: string
          is_permanent_suppress: boolean | null
          metadata: Json | null
          suppress_until: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          decline_count?: number | null
          enrichment_type: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          feedback_reason?: string | null
          feedback_tags?: string[] | null
          id?: string
          is_permanent_suppress?: boolean | null
          metadata?: Json | null
          suppress_until?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          decline_count?: number | null
          enrichment_type?: string
          entity_id?: string | null
          entity_name?: string | null
          entity_type?: string | null
          feedback_reason?: string | null
          feedback_tags?: string[] | null
          id?: string
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
      user_id_mappings: {
        Row: {
          created_at: string
          email: string | null
          legacy_user_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          legacy_user_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          legacy_user_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
    }
    Views: {
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
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences_safe: {
        Row: {
          activity_level: string | null
          budget_tier: string | null
          created_at: string | null
          quiz_completed: boolean | null
          travel_pace: string | null
          travel_style: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          activity_level?: string | null
          budget_tier?: string | null
          created_at?: string | null
          quiz_completed?: boolean | null
          travel_pace?: string | null
          travel_style?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          activity_level?: string | null
          budget_tier?: string | null
          created_at?: string | null
          quiz_completed?: boolean | null
          travel_pace?: string | null
          travel_style?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_trip_invite: { Args: { p_token: string }; Returns: Json }
      cleanup_expired_search_cache: { Args: never; Returns: number }
      generate_booking_reference: { Args: never; Returns: string }
      generate_intake_token: { Args: never; Returns: string }
      generate_invoice_number: { Args: never; Returns: string }
      generate_share_token: { Args: never; Returns: string }
      get_shared_trip_payload: {
        Args: { p_share_token: string }
        Returns: Json
      }
      get_trip_invite_info: { Args: { p_token: string }; Returns: Json }
      get_user_id_by_email: { Args: { lookup_email: string }; Returns: string }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
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
      booking_status:
        | "pending"
        | "confirmed"
        | "ticketed"
        | "cancelled"
        | "refunded"
        | "no_show"
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
      booking_status: [
        "pending",
        "confirmed",
        "ticketed",
        "cancelled",
        "refunded",
        "no_show",
      ],
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
