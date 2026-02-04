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
          branch_id: string | null
          created_at: string
          cubic_meter_price: number | null
          height: number | null
          id: string
          kg_price: number | null
          length: number | null
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
          updated_at: string
          user_id: string | null
          weight: number | null
          width: number | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          cubic_meter_price?: number | null
          height?: number | null
          id?: string
          kg_price?: number | null
          length?: number | null
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
          updated_at?: string
          user_id?: string | null
          weight?: number | null
          width?: number | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          cubic_meter_price?: number | null
          height?: number | null
          id?: string
          kg_price?: number | null
          length?: number | null
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
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          matched_cargo_id?: string | null
          track_number: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          matched_cargo_id?: string | null
          track_number?: string
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
          paid_at: string | null
          qpay_invoice_id: string | null
          qpay_qr_image: string | null
          qpay_qr_text: string | null
          qpay_urls: Json | null
          status: string
          updated_at: string
          user_id: string
          wallet_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          invoice_ref?: string | null
          paid_at?: string | null
          qpay_invoice_id?: string | null
          qpay_qr_image?: string | null
          qpay_qr_text?: string | null
          qpay_urls?: Json | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          invoice_ref?: string | null
          paid_at?: string | null
          qpay_invoice_id?: string | null
          qpay_qr_image?: string | null
          qpay_qr_text?: string | null
          qpay_urls?: Json | null
          status?: string
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
      payment_method: "qpay" | "cash" | "bank_transfer" | "manual"
      payment_status: "pending" | "paid" | "failed" | "cancelled" | "refunded"
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
      payment_method: ["qpay", "cash", "bank_transfer", "manual"],
      payment_status: ["pending", "paid", "failed", "cancelled", "refunded"],
    },
  },
} as const
