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
          email: string | null
          first_name: string | null
          handle: string | null
          home_airport: string | null
          id: string
          last_name: string | null
          preferred_currency: string | null
          preferred_language: string | null
          quiz_completed: boolean | null
          travel_dna: Json | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          handle?: string | null
          home_airport?: string | null
          id: string
          last_name?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          quiz_completed?: boolean | null
          travel_dna?: Json | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          first_name?: string | null
          handle?: string | null
          home_airport?: string | null
          id?: string
          last_name?: string | null
          preferred_currency?: string | null
          preferred_language?: string | null
          quiz_completed?: boolean | null
          travel_dna?: Json | null
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
          calculated_at: string | null
          created_at: string | null
          dna_confidence_score: number | null
          dna_rarity: string | null
          emotional_drivers: string[] | null
          id: string
          primary_archetype_name: string | null
          secondary_archetype_name: string | null
          session_id: string | null
          summary: string | null
          tone_tags: string[] | null
          trait_scores: Json | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          calculated_at?: string | null
          created_at?: string | null
          dna_confidence_score?: number | null
          dna_rarity?: string | null
          emotional_drivers?: string[] | null
          id?: string
          primary_archetype_name?: string | null
          secondary_archetype_name?: string | null
          session_id?: string | null
          summary?: string | null
          tone_tags?: string[] | null
          trait_scores?: Json | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          calculated_at?: string | null
          created_at?: string | null
          dna_confidence_score?: number | null
          dna_rarity?: string | null
          emotional_drivers?: string[] | null
          id?: string
          primary_archetype_name?: string | null
          secondary_archetype_name?: string | null
          session_id?: string | null
          summary?: string | null
          tone_tags?: string[] | null
          trait_scores?: Json | null
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
          booking_required: boolean | null
          booking_status: string | null
          cost: number | null
          created_at: string
          currency: string | null
          description: string | null
          end_time: string | null
          external_booking_id: string | null
          external_booking_url: string | null
          id: string
          itinerary_day_id: string | null
          latitude: number | null
          location: string | null
          locked: boolean | null
          longitude: number | null
          metadata: Json | null
          operating_hours: Json | null
          payment_status: string | null
          photos: Json | null
          place_id: string | null
          rating_count: number | null
          rating_value: number | null
          recommendation_score: number | null
          start_time: string | null
          tags: Json | null
          title: string
          transportation: Json | null
          trip_id: string | null
          type: string
          updated_at: string
          venue_id: string | null
          verification_confidence: number | null
          verified: boolean | null
        }
        Insert: {
          added_by_user?: boolean | null
          address?: string | null
          block_order?: number | null
          booking_required?: boolean | null
          booking_status?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          end_time?: string | null
          external_booking_id?: string | null
          external_booking_url?: string | null
          id?: string
          itinerary_day_id?: string | null
          latitude?: number | null
          location?: string | null
          locked?: boolean | null
          longitude?: number | null
          metadata?: Json | null
          operating_hours?: Json | null
          payment_status?: string | null
          photos?: Json | null
          place_id?: string | null
          rating_count?: number | null
          rating_value?: number | null
          recommendation_score?: number | null
          start_time?: string | null
          tags?: Json | null
          title: string
          transportation?: Json | null
          trip_id?: string | null
          type?: string
          updated_at?: string
          venue_id?: string | null
          verification_confidence?: number | null
          verified?: boolean | null
        }
        Update: {
          added_by_user?: boolean | null
          address?: string | null
          block_order?: number | null
          booking_required?: boolean | null
          booking_status?: string | null
          cost?: number | null
          created_at?: string
          currency?: string | null
          description?: string | null
          end_time?: string | null
          external_booking_id?: string | null
          external_booking_url?: string | null
          id?: string
          itinerary_day_id?: string | null
          latitude?: number | null
          location?: string | null
          locked?: boolean | null
          longitude?: number | null
          metadata?: Json | null
          operating_hours?: Json | null
          payment_status?: string | null
          photos?: Json | null
          place_id?: string | null
          rating_count?: number | null
          rating_value?: number | null
          recommendation_score?: number | null
          start_time?: string | null
          tags?: Json | null
          title?: string
          transportation?: Json | null
          trip_id?: string | null
          type?: string
          updated_at?: string
          venue_id?: string | null
          verification_confidence?: number | null
          verified?: boolean | null
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
            foreignKeyName: "trip_expenses_trip_id_fkey"
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
            foreignKeyName: "trip_settlements_to_member_id_fkey"
            columns: ["to_member_id"]
            isOneToOne: false
            referencedRelation: "trip_members"
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
          budget_tier: string | null
          created_at: string
          destination: string
          destination_country: string | null
          end_date: string
          flight_selection: Json | null
          hotel_selection: Json | null
          id: string
          itinerary_data: Json | null
          itinerary_status:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          metadata: Json | null
          name: string
          origin_city: string | null
          price_lock_expires_at: string | null
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          travelers: number | null
          trip_type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          budget_tier?: string | null
          created_at?: string
          destination: string
          destination_country?: string | null
          end_date: string
          flight_selection?: Json | null
          hotel_selection?: Json | null
          id?: string
          itinerary_data?: Json | null
          itinerary_status?:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          metadata?: Json | null
          name: string
          origin_city?: string | null
          price_lock_expires_at?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          travelers?: number | null
          trip_type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          budget_tier?: string | null
          created_at?: string
          destination?: string
          destination_country?: string | null
          end_date?: string
          flight_selection?: Json | null
          hotel_selection?: Json | null
          id?: string
          itinerary_data?: Json | null
          itinerary_status?:
            | Database["public"]["Enums"]["itinerary_status"]
            | null
          metadata?: Json | null
          name?: string
          origin_city?: string | null
          price_lock_expires_at?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          travelers?: number | null
          trip_type?: string | null
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
          airport_radius_miles: number | null
          budget_alerts: boolean | null
          budget_range: Json | null
          budget_tier: string | null
          climate_preferences: string[] | null
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
          airport_radius_miles?: number | null
          budget_alerts?: boolean | null
          budget_range?: Json | null
          budget_tier?: string | null
          climate_preferences?: string[] | null
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
          airport_radius_miles?: number | null
          budget_alerts?: boolean | null
          budget_range?: Json | null
          budget_tier?: string | null
          climate_preferences?: string[] | null
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
    }
    Views: {
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
    }
    Enums: {
      app_role: "user" | "admin" | "moderator"
      expense_split_type: "equal" | "manual" | "percentage"
      friendship_status: "pending" | "accepted" | "declined" | "blocked"
      itinerary_status:
        | "not_started"
        | "queued"
        | "generating"
        | "ready"
        | "failed"
      payment_status_enum: "pending" | "paid" | "partial"
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
      app_role: ["user", "admin", "moderator"],
      expense_split_type: ["equal", "manual", "percentage"],
      friendship_status: ["pending", "accepted", "declined", "blocked"],
      itinerary_status: [
        "not_started",
        "queued",
        "generating",
        "ready",
        "failed",
      ],
      payment_status_enum: ["pending", "paid", "partial"],
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
