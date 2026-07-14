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
      api_key_otp_logs: {
        Row: {
          api_key_id: string
          created_at: string
          event: string
          id: string
          ip: string | null
          phone: string
        }
        Insert: {
          api_key_id: string
          created_at?: string
          event: string
          id?: string
          ip?: string | null
          phone: string
        }
        Update: {
          api_key_id?: string
          created_at?: string
          event?: string
          id?: string
          ip?: string | null
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_otp_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_key_usage_logs: {
        Row: {
          api_key_id: string
          created_at: string
          endpoint: string
          id: string
          ip_address: string | null
          status_code: number
          user_agent: string | null
        }
        Insert: {
          api_key_id: string
          created_at?: string
          endpoint: string
          id?: string
          ip_address?: string | null
          status_code: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string
          created_at?: string
          endpoint?: string
          id?: string
          ip_address?: string | null
          status_code?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_key_usage_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      api_keys: {
        Row: {
          allow_phone_search: boolean
          allow_price: boolean
          allowed_branches: string[] | null
          allowed_customer_codes: string[]
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          last_used_ip: string | null
          merchant_id: string | null
          name: string
          pending_otp_attempts: number
          pending_otp_expires_at: string | null
          pending_otp_hash: string | null
          pending_otp_last_sent_at: string | null
          pending_phone: string | null
          rate_limit_per_day: number
          rate_limit_per_minute: number
          updated_at: string
          verified_phone: string | null
          verified_phone_at: string | null
          webhook_enabled: boolean
          webhook_events: string[]
          webhook_secret: string | null
          webhook_url: string | null
        }
        Insert: {
          allow_phone_search?: boolean
          allow_price?: boolean
          allowed_branches?: string[] | null
          allowed_customer_codes?: string[]
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          last_used_ip?: string | null
          merchant_id?: string | null
          name: string
          pending_otp_attempts?: number
          pending_otp_expires_at?: string | null
          pending_otp_hash?: string | null
          pending_otp_last_sent_at?: string | null
          pending_phone?: string | null
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          updated_at?: string
          verified_phone?: string | null
          verified_phone_at?: string | null
          webhook_enabled?: boolean
          webhook_events?: string[]
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Update: {
          allow_phone_search?: boolean
          allow_price?: boolean
          allowed_branches?: string[] | null
          allowed_customer_codes?: string[]
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          last_used_ip?: string | null
          merchant_id?: string | null
          name?: string
          pending_otp_attempts?: number
          pending_otp_expires_at?: string | null
          pending_otp_hash?: string | null
          pending_otp_last_sent_at?: string | null
          pending_phone?: string | null
          rate_limit_per_day?: number
          rate_limit_per_minute?: number
          updated_at?: string
          verified_phone?: string | null
          verified_phone_at?: string | null
          webhook_enabled?: boolean
          webhook_events?: string[]
          webhook_secret?: string | null
          webhook_url?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_enabled: boolean
          link_url: string | null
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean
          link_url?: string | null
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_enabled?: boolean
          link_url?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          china_address_prefix: string | null
          china_address_text: string | null
          code: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          phone: string | null
          updated_at: string
          volume_rate: number | null
          weight_rate: number | null
        }
        Insert: {
          address?: string | null
          china_address_prefix?: string | null
          china_address_text?: string | null
          code: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          updated_at?: string
          volume_rate?: number | null
          weight_rate?: number | null
        }
        Update: {
          address?: string | null
          china_address_prefix?: string | null
          china_address_text?: string | null
          code?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          volume_rate?: number | null
          weight_rate?: number | null
        }
        Relationships: []
      }
      cargo: {
        Row: {
          auto_status_source: string | null
          branch_id: string | null
          china_tracking_completed: boolean
          created_at: string
          cubic_meter_price: number | null
          customer_code: string | null
          ereen_received_detected_at: string | null
          external_ref: string | null
          height: number | null
          id: string
          kg_price: number | null
          length: number | null
          merchant_id: string | null
          notes: string | null
          payment_id: string | null
          phone_number: string
          price: number | null
          registered_by: string | null
          shelf_location: string | null
          shipment_id: string | null
          status: Database["public"]["Enums"]["cargo_status"]
          status_date: string
          total_cubic_meters: number | null
          track_number: string
          tracking_carrier: number | null
          tracking_last_sync_at: string | null
          tracking_latest_event_description: string | null
          tracking_latest_event_location: string | null
          tracking_latest_event_time: string | null
          tracking_raw: Json | null
          tracking_register_error: string | null
          tracking_registered: boolean
          tracking_status_17track: string | null
          tracking_sub_status_17track: string | null
          updated_at: string
          user_id: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          auto_status_source?: string | null
          branch_id?: string | null
          china_tracking_completed?: boolean
          created_at?: string
          cubic_meter_price?: number | null
          customer_code?: string | null
          ereen_received_detected_at?: string | null
          external_ref?: string | null
          height?: number | null
          id?: string
          kg_price?: number | null
          length?: number | null
          merchant_id?: string | null
          notes?: string | null
          payment_id?: string | null
          phone_number: string
          price?: number | null
          registered_by?: string | null
          shelf_location?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["cargo_status"]
          status_date?: string
          total_cubic_meters?: number | null
          track_number: string
          tracking_carrier?: number | null
          tracking_last_sync_at?: string | null
          tracking_latest_event_description?: string | null
          tracking_latest_event_location?: string | null
          tracking_latest_event_time?: string | null
          tracking_raw?: Json | null
          tracking_register_error?: string | null
          tracking_registered?: boolean
          tracking_status_17track?: string | null
          tracking_sub_status_17track?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          auto_status_source?: string | null
          branch_id?: string | null
          china_tracking_completed?: boolean
          created_at?: string
          cubic_meter_price?: number | null
          customer_code?: string | null
          ereen_received_detected_at?: string | null
          external_ref?: string | null
          height?: number | null
          id?: string
          kg_price?: number | null
          length?: number | null
          merchant_id?: string | null
          notes?: string | null
          payment_id?: string | null
          phone_number?: string
          price?: number | null
          registered_by?: string | null
          shelf_location?: string | null
          shipment_id?: string | null
          status?: Database["public"]["Enums"]["cargo_status"]
          status_date?: string
          total_cubic_meters?: number | null
          track_number?: string
          tracking_carrier?: number | null
          tracking_last_sync_at?: string | null
          tracking_latest_event_description?: string | null
          tracking_latest_event_location?: string | null
          tracking_latest_event_time?: string | null
          tracking_raw?: Json | null
          tracking_register_error?: string | null
          tracking_registered?: boolean
          tracking_status_17track?: string | null
          tracking_sub_status_17track?: string | null
          updated_at?: string
          user_id?: string | null
          weight?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_photos: {
        Row: {
          cargo_id: string
          created_at: string
          id: string
          photo_url: string
          uploaded_by: string | null
        }
        Insert: {
          cargo_id: string
          created_at?: string
          id?: string
          photo_url: string
          uploaded_by?: string | null
        }
        Update: {
          cargo_id?: string
          created_at?: string
          id?: string
          photo_url?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cargo_photos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_photos_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_preregistrations: {
        Row: {
          created_at: string
          description: string | null
          id: string
          matched_cargo_id: string | null
          track_number: string
          tracking_carrier: number | null
          tracking_last_sync_at: string | null
          tracking_register_error: string | null
          tracking_registered: boolean
          tracking_status_17track: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          matched_cargo_id?: string | null
          track_number: string
          tracking_carrier?: number | null
          tracking_last_sync_at?: string | null
          tracking_register_error?: string | null
          tracking_registered?: boolean
          tracking_status_17track?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          matched_cargo_id?: string | null
          track_number?: string
          tracking_carrier?: number | null
          tracking_last_sync_at?: string | null
          tracking_register_error?: string | null
          tracking_registered?: boolean
          tracking_status_17track?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cargo_preregistrations_matched_cargo_id_fkey"
            columns: ["matched_cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_preregistrations_matched_cargo_id_fkey"
            columns: ["matched_cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo_public"
            referencedColumns: ["id"]
          },
        ]
      }
      cargo_status_history: {
        Row: {
          cargo_id: string
          changed_by: string | null
          created_at: string
          id: string
          notes: string | null
          status: Database["public"]["Enums"]["cargo_status"]
        }
        Insert: {
          cargo_id: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status: Database["public"]["Enums"]["cargo_status"]
        }
        Update: {
          cargo_id?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          status?: Database["public"]["Enums"]["cargo_status"]
        }
        Relationships: [
          {
            foreignKeyName: "cargo_status_history_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cargo_status_history_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo_public"
            referencedColumns: ["id"]
          },
        ]
      }
      coupon_usage: {
        Row: {
          coupon_id: string
          discount_applied: number
          id: string
          order_id: string | null
          used_at: string
          user_id: string
        }
        Insert: {
          coupon_id: string
          discount_applied: number
          id?: string
          order_id?: string | null
          used_at?: string
          user_id: string
        }
        Update: {
          coupon_id?: string
          discount_applied?: number
          id?: string
          order_id?: string | null
          used_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupon_usage_coupon_id_fkey"
            columns: ["coupon_id"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          min_order_amount: number | null
          updated_at: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          min_order_amount?: number | null
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      delivery_addresses: {
        Row: {
          address_line: string
          city: string
          created_at: string
          district: string | null
          id: string
          is_default: boolean
          label: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line: string
          city?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line?: string
          city?: string
          created_at?: string
          district?: string | null
          id?: string
          is_default?: boolean
          label?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      delivery_order_items: {
        Row: {
          cargo_id: string
          created_at: string
          delivery_order_id: string
          id: string
          price: number
        }
        Insert: {
          cargo_id: string
          created_at?: string
          delivery_order_id: string
          id?: string
          price?: number
        }
        Update: {
          cargo_id?: string
          created_at?: string
          delivery_order_id?: string
          id?: string
          price?: number
        }
        Relationships: [
          {
            foreignKeyName: "delivery_order_items_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_order_items_delivery_order_id_fkey"
            columns: ["delivery_order_id"]
            isOneToOne: false
            referencedRelation: "delivery_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_orders: {
        Row: {
          cargo_price: number
          created_at: string
          delivery_address_id: string | null
          delivery_price: number | null
          delivery_type: string
          delivery_zone_id: string | null
          id: string
          map_coordinates: Json | null
          notes: string | null
          payment_id: string | null
          pickup_deadline: string | null
          status: string
          total_price: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cargo_price?: number
          created_at?: string
          delivery_address_id?: string | null
          delivery_price?: number | null
          delivery_type: string
          delivery_zone_id?: string | null
          id?: string
          map_coordinates?: Json | null
          notes?: string | null
          payment_id?: string | null
          pickup_deadline?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cargo_price?: number
          created_at?: string
          delivery_address_id?: string | null
          delivery_price?: number | null
          delivery_type?: string
          delivery_zone_id?: string | null
          id?: string
          map_coordinates?: Json | null
          notes?: string | null
          payment_id?: string | null
          pickup_deadline?: string | null
          status?: string
          total_price?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "delivery_addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_orders_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_zones: {
        Row: {
          code: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          polygon: Json | null
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          polygon?: Json | null
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          polygon?: Json | null
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_global: boolean
          message: string
          read_at: string | null
          title: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_global?: boolean
          message: string
          read_at?: string | null
          title: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_global?: boolean
          message?: string
          read_at?: string | null
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
      payment_cargo: {
        Row: {
          cargo_id: string
          created_at: string
          id: string
          payment_id: string
        }
        Insert: {
          cargo_id: string
          created_at?: string
          id?: string
          payment_id: string
        }
        Update: {
          cargo_id?: string
          created_at?: string
          id?: string
          payment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_cargo_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_cargo_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_cargo_payment_id_fkey"
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
          branch_id: string | null
          created_at: string
          created_by: string | null
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          qpay_invoice_id: string | null
          qpay_qr_image: string | null
          qpay_qr_text: string | null
          qpay_urls: Json | null
          status: Database["public"]["Enums"]["payment_status"]
          storepay_loan_id: string | null
          storepay_phone: string | null
          storepay_request_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          qpay_invoice_id?: string | null
          qpay_qr_image?: string | null
          qpay_qr_text?: string | null
          qpay_urls?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          storepay_loan_id?: string | null
          storepay_phone?: string | null
          storepay_request_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          qpay_invoice_id?: string | null
          qpay_qr_image?: string | null
          qpay_qr_text?: string | null
          qpay_urls?: Json | null
          status?: Database["public"]["Enums"]["payment_status"]
          storepay_loan_id?: string | null
          storepay_phone?: string | null
          storepay_request_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      product_research_orders: {
        Row: {
          admin_notes: string | null
          admin_quoted_price: number | null
          admin_response: string | null
          created_at: string
          fee: number
          id: string
          notes: string | null
          product_url: string
          status: Database["public"]["Enums"]["product_research_status"]
          updated_at: string
          user_id: string
          wallet_transaction_id: string | null
        }
        Insert: {
          admin_notes?: string | null
          admin_quoted_price?: number | null
          admin_response?: string | null
          created_at?: string
          fee?: number
          id?: string
          notes?: string | null
          product_url: string
          status?: Database["public"]["Enums"]["product_research_status"]
          updated_at?: string
          user_id: string
          wallet_transaction_id?: string | null
        }
        Update: {
          admin_notes?: string | null
          admin_quoted_price?: number | null
          admin_response?: string | null
          created_at?: string
          fee?: number
          id?: string
          notes?: string | null
          product_url?: string
          status?: Database["public"]["Enums"]["product_research_status"]
          updated_at?: string
          user_id?: string
          wallet_transaction_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          default_branch_id: string | null
          full_name: string | null
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_branch_id?: string | null
          full_name?: string | null
          id: string
          phone: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_branch_id?: string | null
          full_name?: string | null
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string
          id: string
          user_id: string
          uses_count: number
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          user_id: string
          uses_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          user_id?: string
          uses_count?: number
        }
        Relationships: []
      }
      referrals: {
        Row: {
          created_at: string
          id: string
          referral_code_id: string
          referred_id: string
          referrer_id: string
          reward_amount: number | null
          reward_paid: boolean
          reward_paid_at: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          referral_code_id: string
          referred_id: string
          referrer_id: string
          reward_amount?: number | null
          reward_paid?: boolean
          reward_paid_at?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          referral_code_id?: string
          referred_id?: string
          referrer_id?: string
          reward_amount?: number | null
          reward_paid?: boolean
          reward_paid_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "referrals_referral_code_id_fkey"
            columns: ["referral_code_id"]
            isOneToOne: false
            referencedRelation: "referral_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      remittance_orders: {
        Row: {
          admin_note: string | null
          amount_cny: number
          amount_mnt: number
          created_at: string
          fee: number
          id: string
          note: string | null
          processed_at: string | null
          processed_by: string | null
          proof_url: string | null
          rate: number
          receiver_account: string
          receiver_name: string
          receiver_type: Database["public"]["Enums"]["remittance_receiver_type"]
          status: Database["public"]["Enums"]["remittance_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          amount_cny: number
          amount_mnt: number
          created_at?: string
          fee?: number
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          proof_url?: string | null
          rate: number
          receiver_account: string
          receiver_name: string
          receiver_type: Database["public"]["Enums"]["remittance_receiver_type"]
          status?: Database["public"]["Enums"]["remittance_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          amount_cny?: number
          amount_mnt?: number
          created_at?: string
          fee?: number
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          proof_url?: string | null
          rate?: number
          receiver_account?: string
          receiver_name?: string
          receiver_type?: Database["public"]["Enums"]["remittance_receiver_type"]
          status?: Database["public"]["Enums"]["remittance_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shipment_items: {
        Row: {
          added_at: string
          cargo_id: string
          id: string
          shipment_id: string
        }
        Insert: {
          added_at?: string
          cargo_id: string
          id?: string
          shipment_id: string
        }
        Update: {
          added_at?: string
          cargo_id?: string
          id?: string
          shipment_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shipment_items_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipment_items_shipment_id_fkey"
            columns: ["shipment_id"]
            isOneToOne: false
            referencedRelation: "shipments"
            referencedColumns: ["id"]
          },
        ]
      }
      shipments: {
        Row: {
          cargo_count: number
          created_at: string
          id: string
          loaded_at: string
          loaded_by: string
          notes: string | null
          shipment_number: string
          status: string
          total_weight: number | null
          updated_at: string
        }
        Insert: {
          cargo_count?: number
          created_at?: string
          id?: string
          loaded_at?: string
          loaded_by: string
          notes?: string | null
          shipment_number: string
          status?: string
          total_weight?: number | null
          updated_at?: string
        }
        Update: {
          cargo_count?: number
          created_at?: string
          id?: string
          loaded_at?: string
          loaded_by?: string
          notes?: string | null
          shipment_number?: string
          status?: string
          total_weight?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tracking_events: {
        Row: {
          cargo_id: string | null
          carrier: number | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          description_translation: string | null
          event_time: string | null
          event_time_raw: string | null
          id: string
          location: string | null
          preregistration_id: string | null
          provider_key: string | null
          provider_name: string | null
          raw_event: Json | null
          stage: string | null
          state: string | null
          sub_status: string | null
          tracking_number: string
        }
        Insert: {
          cargo_id?: string | null
          carrier?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          description_translation?: string | null
          event_time?: string | null
          event_time_raw?: string | null
          id?: string
          location?: string | null
          preregistration_id?: string | null
          provider_key?: string | null
          provider_name?: string | null
          raw_event?: Json | null
          stage?: string | null
          state?: string | null
          sub_status?: string | null
          tracking_number: string
        }
        Update: {
          cargo_id?: string | null
          carrier?: number | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          description_translation?: string | null
          event_time?: string | null
          event_time_raw?: string | null
          id?: string
          location?: string | null
          preregistration_id?: string | null
          provider_key?: string | null
          provider_name?: string | null
          raw_event?: Json | null
          stage?: string | null
          state?: string | null
          sub_status?: string | null
          tracking_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "tracking_events_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_events_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargo_public"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracking_events_preregistration_id_fkey"
            columns: ["preregistration_id"]
            isOneToOne: false
            referencedRelation: "cargo_preregistrations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_branches: {
        Row: {
          branch_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          branch_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          branch_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_branches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
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
      wallet_topups: {
        Row: {
          amount: number
          created_at: string
          id: string
          invoice_ref: string | null
          omniway_image_base64: string | null
          omniway_invoice_number: string | null
          omniway_qr_content: string | null
          paid_at: string | null
          provider: string
          qpay_invoice_id: string | null
          qpay_qr_image: string | null
          qpay_qr_text: string | null
          qpay_urls: Json | null
          status: string
          storepay_loan_id: string | null
          storepay_phone: string | null
          storepay_request_id: string | null
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_ref?: string | null
          omniway_image_base64?: string | null
          omniway_invoice_number?: string | null
          omniway_qr_content?: string | null
          paid_at?: string | null
          provider?: string
          qpay_invoice_id?: string | null
          qpay_qr_image?: string | null
          qpay_qr_text?: string | null
          qpay_urls?: Json | null
          status?: string
          storepay_loan_id?: string | null
          storepay_phone?: string | null
          storepay_request_id?: string | null
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_ref?: string | null
          omniway_image_base64?: string | null
          omniway_invoice_number?: string | null
          omniway_qr_content?: string | null
          paid_at?: string | null
          provider?: string
          qpay_invoice_id?: string | null
          qpay_qr_image?: string | null
          qpay_qr_text?: string | null
          qpay_urls?: Json | null
          status?: string
          storepay_loan_id?: string | null
          storepay_phone?: string | null
          storepay_request_id?: string | null
          updated_at?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_topups_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          created_at: string
          description: string | null
          id: string
          reference_id: string | null
          reference_type: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          created_at?: string
          description?: string | null
          id?: string
          reference_id?: string | null
          reference_type?: string | null
          type?: string
          user_id?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      webhook_deliveries: {
        Row: {
          api_key_id: string
          attempts: number
          created_at: string
          error: string | null
          event: string
          event_id: string | null
          id: string
          last_attempt_at: string | null
          last_error: string | null
          max_attempts: number
          next_retry_at: string | null
          payload: Json
          response_body: string | null
          response_status: number | null
          status: string
          success: boolean
          target_url: string
        }
        Insert: {
          api_key_id: string
          attempts?: number
          created_at?: string
          error?: string | null
          event: string
          event_id?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          payload: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          success?: boolean
          target_url: string
        }
        Update: {
          api_key_id?: string
          attempts?: number
          created_at?: string
          error?: string | null
          event?: string
          event_id?: string | null
          id?: string
          last_attempt_at?: string | null
          last_error?: string | null
          max_attempts?: number
          next_retry_at?: string | null
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          status?: string
          success?: boolean
          target_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      cargo_public: {
        Row: {
          created_at: string | null
          id: string | null
          status: Database["public"]["Enums"]["cargo_status"] | null
          status_date: string | null
          track_number: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["cargo_status"] | null
          status_date?: string | null
          track_number?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string | null
          status?: Database["public"]["Enums"]["cargo_status"] | null
          status_date?: string | null
          track_number?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calculate_cargo_price: {
        Args: {
          p_height: number
          p_length: number
          p_volume_rate?: number
          p_weight: number
          p_weight_rate?: number
          p_width: number
        }
        Returns: {
          cubic_meters: number
          final_price: number
          volume_price: number
          weight_price: number
        }[]
      }
      create_product_research_order: {
        Args: { p_fee: number; p_notes: string; p_product_url: string }
        Returns: string
      }
      generate_referral_code: { Args: { p_user_id: string }; Returns: string }
      get_user_phone: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user" | "china_warehouse" | "branch_admin"
      cargo_status:
        | "registered"
        | "received_ereen"
        | "transporting"
        | "warehouse_processing"
        | "ready_warehouse"
        | "completed"
      payment_method: "qpay" | "cash" | "bank_transfer" | "manual" | "storepay"
      payment_status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
      product_research_status:
        | "pending"
        | "processing"
        | "completed"
        | "rejected"
        | "cancelled"
      remittance_receiver_type: "alipay" | "wechat"
      remittance_status:
        | "pending"
        | "processing"
        | "completed"
        | "cancelled"
        | "rejected"
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
      app_role: ["admin", "user", "china_warehouse", "branch_admin"],
      cargo_status: [
        "registered",
        "received_ereen",
        "transporting",
        "warehouse_processing",
        "ready_warehouse",
        "completed",
      ],
      payment_method: ["qpay", "cash", "bank_transfer", "manual", "storepay"],
      payment_status: ["pending", "paid", "failed", "cancelled", "refunded"],
      product_research_status: [
        "pending",
        "processing",
        "completed",
        "rejected",
        "cancelled",
      ],
      remittance_receiver_type: ["alipay", "wechat"],
      remittance_status: [
        "pending",
        "processing",
        "completed",
        "cancelled",
        "rejected",
      ],
    },
  },
} as const
