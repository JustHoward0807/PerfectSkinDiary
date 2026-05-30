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
      entries: {
        Row: {
          analysis_scores: Json
          created_at: string | null
          delta_scores: Json | null
          entry_date: string
          id: string
          issue_id: string
          llm_summary: string | null
          mask_urls: Json | null
          photo_url: string
          user_id: string
        }
        Insert: {
          analysis_scores: Json
          created_at?: string | null
          delta_scores?: Json | null
          entry_date: string
          id?: string
          issue_id: string
          llm_summary?: string | null
          mask_urls?: Json | null
          photo_url: string
          user_id: string
        }
        Update: {
          analysis_scores?: Json
          created_at?: string | null
          delta_scores?: Json | null
          entry_date?: string
          id?: string
          issue_id?: string
          llm_summary?: string | null
          mask_urls?: Json | null
          photo_url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entries_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      issues: {
        Row: {
          am_routine: Json | null
          baseline_scores: Json | null
          created_at: string | null
          description: string | null
          goal_image_url: string | null
          id: string
          pm_routine: Json | null
          target_concerns: Json
          title: string
          user_id: string
        }
        Insert: {
          am_routine?: Json | null
          baseline_scores?: Json | null
          created_at?: string | null
          description?: string | null
          goal_image_url?: string | null
          id?: string
          pm_routine?: Json | null
          target_concerns: Json
          title: string
          user_id: string
        }
        Update: {
          am_routine?: Json | null
          baseline_scores?: Json | null
          created_at?: string | null
          description?: string | null
          goal_image_url?: string | null
          id?: string
          pm_routine?: Json | null
          target_concerns?: Json
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          id: string
          issue_id: string
          name: string
        }
        Insert: {
          brand?: string | null
          category?: string | null
          id?: string
          issue_id: string
          name: string
        }
        Update: {
          brand?: string | null
          category?: string | null
          id?: string
          issue_id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_issue_id_fkey"
            columns: ["issue_id"]
            isOneToOne: false
            referencedRelation: "issues"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          user_id:      string
          coin_balance: number
          created_at:   string
          updated_at:   string
        }
        Insert: {
          user_id:      string
          coin_balance?: number
          created_at?:  string
          updated_at?:  string
        }
        Update: {
          user_id?:     string
          coin_balance?: number
          created_at?:  string
          updated_at?:  string
        }
        Relationships: []
      }
      coin_packages: {
        Row: {
          id:                     string
          product_id:             string
          display_name:           string
          coin_amount:            number
          bonus_coins:            number
          badge:                  string | null
          badge_style:            string | null
          is_featured:            boolean
          original_price_display: string | null
          sort_order:             number
          is_active:              boolean
          created_at:             string
        }
        Insert: {
          id?:                    string
          product_id:             string
          display_name:           string
          coin_amount:            number
          bonus_coins?:           number
          badge?:                 string | null
          badge_style?:           string | null
          is_featured?:           boolean
          original_price_display?: string | null
          sort_order?:            number
          is_active?:             boolean
          created_at?:            string
        }
        Update: {
          id?:                    string
          product_id?:            string
          display_name?:          string
          coin_amount?:           number
          bonus_coins?:           number
          badge?:                 string | null
          badge_style?:           string | null
          is_featured?:           boolean
          original_price_display?: string | null
          sort_order?:            number
          is_active?:             boolean
          created_at?:            string
        }
        Relationships: []
      }
      coin_transactions: {
        Row: {
          id:           string
          user_id:      string
          amount:       number
          type:         'purchase' | 'redeem_code' | 'analysis_deduct' | 'trial'
          reference_id: string | null
          created_at:   string
        }
        Insert: {
          id?:          string
          user_id:      string
          amount:       number
          type:         'purchase' | 'redeem_code' | 'analysis_deduct' | 'trial'
          reference_id?: string | null
          created_at?:  string
        }
        Update: {
          id?:          string
          user_id?:     string
          amount?:      number
          type?:        'purchase' | 'redeem_code' | 'analysis_deduct' | 'trial'
          reference_id?: string | null
          created_at?:  string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_coins: {
        Args: { p_user_id: string; p_amount: number }
        Returns: undefined
      }
      deduct_coin_atomic: {
        Args: { p_user_id: string }
        Returns: Array<{ success: boolean; remaining_balance: number }>
      }
      redeem_code_atomic: {
        Args: { p_user_id: string; p_code: string }
        Returns: Json
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
    ? DefaultSchema["CompositeTypes"][CompositeTypeName extends keyof DefaultSchema["CompositeTypes"] ? CompositeTypeName : never]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
