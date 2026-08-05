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
      activity_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["activity_action_type"]
          company_id: string | null
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["activity_action_type"]
          company_id?: string | null
          created_at?: string
          description: string
          entity_id?: string | null
          entity_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["activity_action_type"]
          company_id?: string | null
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      categories: {
        Row: {
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          nom: string
          ordre: number | null
          slug: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          nom: string
          ordre?: number | null
          slug: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          nom?: string
          ordre?: number | null
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          address: string | null
          city: string | null
          company_description: string | null
          created_at: string | null
          created_by: string | null
          default_display_currency: string | null
          description: string | null
          email: string | null
          id: string
          invitation_code: string | null
          is_active: boolean | null
          last_reminder_sent: string | null
          logo_height: number | null
          logo_position_x: number | null
          logo_position_y: number | null
          logo_url: string | null
          logo_width: number | null
          max_products: number | null
          max_users: number | null
          name: string
          payment_terms: string | null
          phone: string | null
          slug: string
          subscription_end: string | null
          subscription_plan: string | null
          subscription_start: string | null
          tva_rate: number | null
          updated_at: string | null
          usd_htg_rate: number | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          company_description?: string | null
          created_at?: string | null
          created_by?: string | null
          default_display_currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          invitation_code?: string | null
          is_active?: boolean | null
          last_reminder_sent?: string | null
          logo_height?: number | null
          logo_position_x?: number | null
          logo_position_y?: number | null
          logo_url?: string | null
          logo_width?: number | null
          max_products?: number | null
          max_users?: number | null
          name: string
          payment_terms?: string | null
          phone?: string | null
          slug: string
          subscription_end?: string | null
          subscription_plan?: string | null
          subscription_start?: string | null
          tva_rate?: number | null
          updated_at?: string | null
          usd_htg_rate?: number | null
        }
        Update: {
          address?: string | null
          city?: string | null
          company_description?: string | null
          created_at?: string | null
          created_by?: string | null
          default_display_currency?: string | null
          description?: string | null
          email?: string | null
          id?: string
          invitation_code?: string | null
          is_active?: boolean | null
          last_reminder_sent?: string | null
          logo_height?: number | null
          logo_position_x?: number | null
          logo_position_y?: number | null
          logo_url?: string | null
          logo_width?: number | null
          max_products?: number | null
          max_users?: number | null
          name?: string
          payment_terms?: string | null
          phone?: string | null
          slug?: string
          subscription_end?: string | null
          subscription_plan?: string | null
          subscription_start?: string | null
          tva_rate?: number | null
          updated_at?: string | null
          usd_htg_rate?: number | null
        }
        Relationships: []
      }
      database_size_history: {
        Row: {
          id: string
          recorded_at: string
          size_mb: number
          usage_percent: number
        }
        Insert: {
          id?: string
          recorded_at?: string
          size_mb: number
          usage_percent: number
        }
        Update: {
          id?: string
          recorded_at?: string
          size_mb?: number
          usage_percent?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          billing_period: string | null
          company_id: string
          completed_at: string | null
          created_at: string | null
          currency: string
          id: string
          invoice_number: string | null
          metadata: Json | null
          payment_method: string
          payment_reference: string | null
          plan_id: string | null
          status: string
        }
        Insert: {
          amount: number
          billing_period?: string | null
          company_id: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          invoice_number?: string | null
          metadata?: Json | null
          payment_method: string
          payment_reference?: string | null
          plan_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          billing_period?: string | null
          company_id?: string
          completed_at?: string | null
          created_at?: string | null
          currency?: string
          id?: string
          invoice_number?: string | null
          metadata?: Json | null
          payment_method?: string
          payment_reference?: string | null
          plan_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alert_threshold: number
          barcode: string | null
          bars_per_ton: number | null
          bloc_poids: number | null
          bloc_type: string | null
          capacite: number | null
          categorie_id: string | null
          category: Database["public"]["Enums"]["product_category"]
          company_id: string
          created_at: string
          created_by: string | null
          currency: string
          decimal_autorise: boolean | null
          description: string | null
          diametre: string | null
          dimension: string | null
          electromenager_classe_energie: string | null
          electromenager_couleur: string | null
          electromenager_garantie_mois: number | null
          electromenager_installation: string | null
          electromenager_marque: string | null
          electromenager_materiau: string | null
          electromenager_modele: string | null
          electromenager_niveau_sonore_db: number | null
          electromenager_sous_categorie: string | null
          id: string
          is_active: boolean
          longueur_barre: number | null
          longueur_barre_ft: number | null
          name: string
          price: number
          prix_m2: number | null
          prix_par_barre: number | null
          prix_par_metre: number | null
          puissance: number | null
          purchase_price: number | null
          quantity: number
          sale_type: Database["public"]["Enums"]["sale_type"]
          sous_categorie_id: string | null
          specifications_techniques: Json | null
          stock_barre: number | null
          stock_boite: number | null
          surface_par_boite: number | null
          type_energie: string | null
          unit: string
          updated_at: string
          vetement_couleur: string | null
          vetement_genre: string | null
          vetement_taille: string | null
          voltage: number | null
        }
        Insert: {
          alert_threshold?: number
          barcode?: string | null
          bars_per_ton?: number | null
          bloc_poids?: number | null
          bloc_type?: string | null
          capacite?: number | null
          categorie_id?: string | null
          category: Database["public"]["Enums"]["product_category"]
          company_id: string
          created_at?: string
          created_by?: string | null
          currency?: string
          decimal_autorise?: boolean | null
          description?: string | null
          diametre?: string | null
          dimension?: string | null
          electromenager_classe_energie?: string | null
          electromenager_couleur?: string | null
          electromenager_garantie_mois?: number | null
          electromenager_installation?: string | null
          electromenager_marque?: string | null
          electromenager_materiau?: string | null
          electromenager_modele?: string | null
          electromenager_niveau_sonore_db?: number | null
          electromenager_sous_categorie?: string | null
          id?: string
          is_active?: boolean
          longueur_barre?: number | null
          longueur_barre_ft?: number | null
          name: string
          price: number
          prix_m2?: number | null
          prix_par_barre?: number | null
          prix_par_metre?: number | null
          puissance?: number | null
          purchase_price?: number | null
          quantity?: number
          sale_type?: Database["public"]["Enums"]["sale_type"]
          sous_categorie_id?: string | null
          specifications_techniques?: Json | null
          stock_barre?: number | null
          stock_boite?: number | null
          surface_par_boite?: number | null
          type_energie?: string | null
          unit?: string
          updated_at?: string
          vetement_couleur?: string | null
          vetement_genre?: string | null
          vetement_taille?: string | null
          voltage?: number | null
        }
        Update: {
          alert_threshold?: number
          barcode?: string | null
          bars_per_ton?: number | null
          bloc_poids?: number | null
          bloc_type?: string | null
          capacite?: number | null
          categorie_id?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          company_id?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          decimal_autorise?: boolean | null
          description?: string | null
          diametre?: string | null
          dimension?: string | null
          electromenager_classe_energie?: string | null
          electromenager_couleur?: string | null
          electromenager_garantie_mois?: number | null
          electromenager_installation?: string | null
          electromenager_marque?: string | null
          electromenager_materiau?: string | null
          electromenager_modele?: string | null
          electromenager_niveau_sonore_db?: number | null
          electromenager_sous_categorie?: string | null
          id?: string
          is_active?: boolean
          longueur_barre?: number | null
          longueur_barre_ft?: number | null
          name?: string
          price?: number
          prix_m2?: number | null
          prix_par_barre?: number | null
          prix_par_metre?: number | null
          puissance?: number | null
          purchase_price?: number | null
          quantity?: number
          sale_type?: Database["public"]["Enums"]["sale_type"]
          sous_categorie_id?: string | null
          specifications_techniques?: Json | null
          stock_barre?: number | null
          stock_boite?: number | null
          surface_par_boite?: number | null
          type_energie?: string | null
          unit?: string
          updated_at?: string
          vetement_couleur?: string | null
          vetement_genre?: string | null
          vetement_taille?: string | null
          voltage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_sous_categorie_id_fkey"
            columns: ["sous_categorie_id"]
            isOneToOne: false
            referencedRelation: "sous_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string | null
          created_at: string
          email: string | null
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string | null
          created_at?: string
          email?: string | null
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      proformas: {
        Row: {
          company_id: string
          converted_sale_id: string | null
          created_at: string
          customer_name: string | null
          display_currency: string
          expires_at: string
          id: string
          items: Json
          proforma_number: string
          seller_id: string
          status: string
          subtotal_ht: number
          total_ttc: number
          tva_amount: number
          updated_at: string
          validity_days: number
        }
        Insert: {
          company_id: string
          converted_sale_id?: string | null
          created_at?: string
          customer_name?: string | null
          display_currency?: string
          expires_at: string
          id?: string
          items?: Json
          proforma_number: string
          seller_id: string
          status?: string
          subtotal_ht?: number
          total_ttc?: number
          tva_amount?: number
          updated_at?: string
          validity_days?: number
        }
        Update: {
          company_id?: string
          converted_sale_id?: string | null
          created_at?: string
          customer_name?: string | null
          display_currency?: string
          expires_at?: string
          id?: string
          items?: Json
          proforma_number?: string
          seller_id?: string
          status?: string
          subtotal_ht?: number
          total_ttc?: number
          tva_amount?: number
          updated_at?: string
          validity_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "proformas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_settings: {
        Row: {
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          company_id: string
          currency: string | null
          id: string
          product_id: string
          product_name: string
          profit_amount: number | null
          purchase_price_at_sale: number | null
          quantity: number
          sale_id: string
          subtotal: number
          unit: string | null
          unit_price: number
        }
        Insert: {
          company_id: string
          currency?: string | null
          id?: string
          product_id: string
          product_name: string
          profit_amount?: number | null
          purchase_price_at_sale?: number | null
          quantity: number
          sale_id: string
          subtotal: number
          unit?: string | null
          unit_price: number
        }
        Update: {
          company_id?: string
          currency?: string | null
          id?: string
          product_id?: string
          product_name?: string
          profit_amount?: number | null
          purchase_price_at_sale?: number | null
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          company_id: string
          created_at: string
          customer_address: string | null
          customer_name: string | null
          discount_amount: number | null
          discount_currency: string | null
          discount_type: string | null
          discount_value: number | null
          id: string
          notes: string | null
          payment_method: string | null
          seller_id: string
          subtotal: number
          total_amount: number
        }
        Insert: {
          company_id: string
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          discount_currency?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          seller_id: string
          subtotal?: number
          total_amount: number
        }
        Update: {
          company_id?: string
          created_at?: string
          customer_address?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          discount_currency?: string | null
          discount_type?: string | null
          discount_value?: number | null
          id?: string
          notes?: string | null
          payment_method?: string | null
          seller_id?: string
          subtotal?: number
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_authorized_categories: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          category: Database["public"]["Enums"]["product_category"]
          company_id: string
          id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          category: Database["public"]["Enums"]["product_category"]
          company_id: string
          id?: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          category?: Database["public"]["Enums"]["product_category"]
          company_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seller_authorized_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      sous_categories: {
        Row: {
          categorie_id: string
          company_id: string
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          nom: string
          ordre: number | null
          slug: string
          stock_type: string | null
          updated_at: string | null
        }
        Insert: {
          categorie_id: string
          company_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          nom: string
          ordre?: number | null
          slug: string
          stock_type?: string | null
          updated_at?: string | null
        }
        Update: {
          categorie_id?: string
          company_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          nom?: string
          ordre?: number | null
          slug?: string
          stock_type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sous_categories_categorie_id_fkey"
            columns: ["categorie_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sous_categories_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      specifications_modeles: {
        Row: {
          company_id: string
          created_at: string | null
          id: string
          label: string
          nom_champ: string
          obligatoire: boolean | null
          options: Json | null
          ordre: number | null
          sous_categorie_id: string
          type_champ: string
          unite: string | null
        }
        Insert: {
          company_id: string
          created_at?: string | null
          id?: string
          label: string
          nom_champ: string
          obligatoire?: boolean | null
          options?: Json | null
          ordre?: number | null
          sous_categorie_id: string
          type_champ: string
          unite?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string | null
          id?: string
          label?: string
          nom_champ?: string
          obligatoire?: boolean | null
          options?: Json | null
          ordre?: number | null
          sous_categorie_id?: string
          type_champ?: string
          unite?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "specifications_modeles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "specifications_modeles_sous_categorie_id_fkey"
            columns: ["sous_categorie_id"]
            isOneToOne: false
            referencedRelation: "sous_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          company_id: string
          created_at: string
          created_by: string | null
          id: string
          movement_type: string
          new_quantity: number
          previous_quantity: number
          product_id: string
          quantity: number
          reason: string | null
          sale_id: string | null
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type: string
          new_quantity: number
          previous_quantity: number
          product_id: string
          quantity: number
          reason?: string | null
          sale_id?: string | null
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          movement_type?: string
          new_quantity?: number
          previous_quantity?: number
          product_id?: string
          quantity?: number
          reason?: string | null
          sale_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_invoices: {
        Row: {
          amount: number
          company_id: string
          created_at: string | null
          currency: string | null
          id: string
          invoice_number: string
          payment_id: string | null
          pdf_url: string | null
          period_end: string | null
          period_start: string | null
          plan_name: string | null
          status: string | null
        }
        Insert: {
          amount: number
          company_id: string
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number: string
          payment_id?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          company_id?: string
          created_at?: string | null
          currency?: string | null
          id?: string
          invoice_number?: string
          payment_id?: string | null
          pdf_url?: string | null
          period_end?: string | null
          period_start?: string | null
          plan_name?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_invoices_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          is_active: boolean | null
          max_products: number
          max_sales_monthly: number
          max_users: number
          name: string
          price_monthly: number
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id: string
          is_active?: boolean | null
          max_products?: number
          max_sales_monthly?: number
          max_users?: number
          name: string
          price_monthly?: number
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          max_products?: number
          max_sales_monthly?: number
          max_users?: number
          name?: string
          price_monthly?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          company_id: string | null
          created_at: string
          id: string
          is_active: boolean
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          company_id?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_database_size: { Args: never; Returns: Json }
      cleanup_database_history: { Args: never; Returns: undefined }
      cleanup_old_data: { Args: never; Returns: Json }
      delete_user_account: { Args: { target_user_id: string }; Returns: Json }
      get_seller_authorized_categories: {
        Args: { _user_id: string }
        Returns: {
          category: Database["public"]["Enums"]["product_category"]
        }[]
      }
      get_user_company_id: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      promote_user_to_admin: { Args: { user_email: string }; Returns: boolean }
    }
    Enums: {
      activity_action_type:
        | "sale_created"
        | "product_added"
        | "product_updated"
        | "product_deleted"
        | "stock_adjusted"
        | "user_approved"
        | "user_deactivated"
        | "settings_updated"
        | "user_login"
        | "user_logout"
        | "user_signup"
        | "user_update_password"
        | "connection_failed"
        | "product_deactivated"
        | "user_deleted"
        | "system_cleanup"
        | "category_created"
        | "category_updated"
        | "category_deleted"
        | "subcategory_created"
        | "subcategory_updated"
        | "subcategory_deleted"
        | "sale_deleted"
        | "sale_cancelled"
      app_role: "admin" | "seller" | "super_admin"
      product_category:
        | "alimentaires"
        | "boissons"
        | "gazeuses"
        | "electronique"
        | "autres"
        | "energie"
        | "ceramique"
        | "fer"
        | "materiaux_de_construction"
        | "blocs"
        | "vetements"
        | "electromenager"
      sale_type: "retail" | "wholesale"
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
      activity_action_type: [
        "sale_created",
        "product_added",
        "product_updated",
        "product_deleted",
        "stock_adjusted",
        "user_approved",
        "user_deactivated",
        "settings_updated",
        "user_login",
        "user_logout",
        "user_signup",
        "user_update_password",
        "connection_failed",
        "product_deactivated",
        "user_deleted",
        "system_cleanup",
        "category_created",
        "category_updated",
        "category_deleted",
        "subcategory_created",
        "subcategory_updated",
        "subcategory_deleted",
        "sale_deleted",
        "sale_cancelled",
      ],
      app_role: ["admin", "seller", "super_admin"],
      product_category: [
        "alimentaires",
        "boissons",
        "gazeuses",
        "electronique",
        "autres",
        "energie",
        "ceramique",
        "fer",
        "materiaux_de_construction",
        "blocs",
        "vetements",
        "electromenager",
      ],
      sale_type: ["retail", "wholesale"],
    },
  },
} as const
