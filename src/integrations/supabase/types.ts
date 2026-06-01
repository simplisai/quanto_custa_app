export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      plans: {
        Row: {
          created_at: string;
          description: string | null;
          features: Json;
          id: string;
          is_active: boolean;
          monthly_simulation_limit: number | null;
          name: string;
          billing_cycle: string | null;
          amount_cents: number | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          features?: Json;
          id?: string;
          is_active?: boolean;
          monthly_simulation_limit?: number | null;
          name: string;
          billing_cycle?: string | null;
          amount_cents?: number | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          features?: Json;
          id?: string;
          is_active?: boolean;
          monthly_simulation_limit?: number | null;
          name?: string;
          billing_cycle?: string | null;
          amount_cents?: number | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          updated_at: string;
          referral_code: string | null;
          brand_logo_url: string | null;
          brand_color: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
          referral_code?: string | null;
          brand_logo_url?: string | null;
          brand_color?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
          referral_code?: string | null;
          brand_logo_url?: string | null;
          brand_color?: string | null;
        };
        Relationships: [];
      };
      referrals: {
        Row: {
          id: string;
          referrer_id: string;
          referred_user_id: string;
          status: string;
          created_at: string;
          converted_at: string | null;
        };
        Insert: {
          id?: string;
          referrer_id: string;
          referred_user_id: string;
          status?: string;
          created_at?: string;
          converted_at?: string | null;
        };
        Update: {
          id?: string;
          referrer_id?: string;
          referred_user_id?: string;
          status?: string;
          created_at?: string;
          converted_at?: string | null;
        };
        Relationships: [];
      };
      simulations: {
        Row: {
          created_at: string;
          id: string;
          inputs: Json;
          results: Json;
          title: string | null;
          user_id: string;
          client_id: string | null;
          template_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          inputs: Json;
          results: Json;
          title?: string | null;
          user_id: string;
          client_id?: string | null;
          template_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          inputs?: Json;
          results?: Json;
          title?: string | null;
          user_id?: string;
          client_id?: string | null;
          template_id?: string | null;
        };
        Relationships: [];
      };
      gateway_tokens: {
        Row: {
          id: string;
          gateway: string;
          access_token: string;
          expires_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          gateway: string;
          access_token: string;
          expires_at: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          gateway?: string;
          access_token?: string;
          expires_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          billing_cycle: Database["public"]["Enums"]["billing_cycle"];
          amount_cents: number;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          canceled_at: string | null;
          started_at: string;
          idempotency_key: string | null;
          simplispay_subscription_id: string | null;
          card_last_four: string | null;
          card_brand: string | null;
          metadata: Json;
          referral_months_credit: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan_id: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          billing_cycle: Database["public"]["Enums"]["billing_cycle"];
          amount_cents: number;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          canceled_at?: string | null;
          started_at?: string;
          idempotency_key?: string | null;
          simplispay_subscription_id?: string | null;
          card_last_four?: string | null;
          card_brand?: string | null;
          metadata?: Json;
          referral_months_credit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          plan_id?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          billing_cycle?: Database["public"]["Enums"]["billing_cycle"];
          amount_cents?: number;
          trial_ends_at?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          canceled_at?: string | null;
          started_at?: string;
          idempotency_key?: string | null;
          simplispay_subscription_id?: string | null;
          card_last_four?: string | null;
          card_brand?: string | null;
          metadata?: Json;
          referral_months_credit?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_ledger_events: {
        Row: {
          id: string;
          subscription_id: string | null;
          user_id: string | null;
          event_type: Database["public"]["Enums"]["subscription_event_type"];
          source: Database["public"]["Enums"]["event_source"];
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id?: string | null;
          user_id?: string | null;
          event_type: Database["public"]["Enums"]["subscription_event_type"];
          source?: Database["public"]["Enums"]["event_source"];
          payload?: Json;
          created_at?: string;
        };
        Update: never;
        Relationships: [];
      };
      billing_invoices: {
        Row: {
          id: string;
          subscription_id: string;
          user_id: string;
          status: string;
          amount_cents: number;
          currency: string;
          period_start: string | null;
          period_end: string | null;
          paid_at: string | null;
          simplispay_invoice_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          user_id: string;
          status?: string;
          amount_cents: number;
          currency?: string;
          period_start?: string | null;
          period_end?: string | null;
          paid_at?: string | null;
          simplispay_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          user_id?: string;
          status?: string;
          amount_cents?: number;
          currency?: string;
          period_start?: string | null;
          period_end?: string | null;
          paid_at?: string | null;
          simplispay_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          document: string | null;
          email: string | null;
          phone: string | null;
          notes: string | null;
          profile_data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          document?: string | null;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          profile_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          document?: string | null;
          email?: string | null;
          phone?: string | null;
          notes?: string | null;
          profile_data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      form_templates: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          slug: string;
          fields: Json;
          theme_color: string;
          is_active: boolean;
          submission_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          slug: string;
          fields?: Json;
          theme_color?: string;
          is_active?: boolean;
          submission_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          slug?: string;
          fields?: Json;
          theme_color?: string;
          is_active?: boolean;
          submission_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      form_submissions: {
        Row: {
          id: string;
          form_id: string;
          owner_user_id: string;
          client_id: string | null;
          responses: Json;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          form_id: string;
          owner_user_id: string;
          client_id?: string | null;
          responses: Json;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          form_id?: string;
          owner_user_id?: string;
          client_id?: string | null;
          responses?: Json;
          submitted_at?: string;
        };
        Relationships: [];
      };
      templates: {
        Row: {
          id: string;
          user_id: string;
          operation_slug: string;
          name: string;
          payload: Json;
          is_default: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          operation_slug: string;
          name: string;
          payload?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          operation_slug?: string;
          name?: string;
          payload?: Json;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          subject: string;
          body: string;
          priority: string;
          status: string;
          category: string | null;
          admin_reply: string | null;
          resolved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subject: string;
          body: string;
          priority?: string;
          status?: string;
          category?: string | null;
          admin_reply?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subject?: string;
          body?: string;
          priority?: string;
          status?: string;
          category?: string | null;
          admin_reply?: string | null;
          resolved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      financial_transactions: {
        Row: {
          id: string;
          user_id: string;
          subscription_id: string | null;
          type: string;
          status: string;
          amount: number;
          currency: string;
          description: string | null;
          reference_date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          subscription_id?: string | null;
          type: string;
          status: string;
          amount: number;
          currency?: string;
          description?: string | null;
          reference_date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          subscription_id?: string | null;
          type?: string;
          status?: string;
          amount?: number;
          currency?: string;
          description?: string | null;
          reference_date?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      admin_metrics: {
        Row: {
          total_users: number;
          active_subscriptions: number;
          trialing_subscriptions: number;
          past_due_subscriptions: number;
          suspended_subscriptions: number;
          canceled_subscriptions: number;
          total_simulations: number;
          open_tickets: number;
          mrr_cents: number;
          arr_cents: number;
          total_revenue_cents: number;
          webhooks_last_24h: number;
          trials_converting_this_month: number;
        };
      };
      admin_subscription_overview: {
        Row: {
          id: string;
          user_id: string;
          plan_id: string;
          status: Database["public"]["Enums"]["subscription_status"];
          billing_cycle: Database["public"]["Enums"]["billing_cycle"];
          amount_cents: number;
          trial_ends_at: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          canceled_at: string | null;
          started_at: string;
          updated_at: string;
          simplispay_subscription_id: string | null;
          card_last_four: string | null;
          card_brand: string | null;
          idempotency_key: string | null;
          email: string;
          full_name: string | null;
          plan_name: string;
        };
      };
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      bootstrap_admin: {
        Args: Record<string, never>;
        Returns: void;
      };
      admin_update_subscription: {
        Args: {
          _user_id: string;
          _plan_id?: string | null;
          _status?: string | null;
          _billing_cycle?: string | null;
        };
        Returns: void;
      };
      admin_set_user_role: {
        Args: {
          _user_id: string;
          _role: Database["public"]["Enums"]["app_role"];
          _grant: boolean;
        };
        Returns: void;
      };
    };
    Enums: {
      app_role: "admin" | "user";
      subscription_status: "trialing" | "active" | "past_due" | "suspended" | "canceled" | "expired";
      billing_cycle: "monthly" | "annual";
      subscription_event_type:
        | "checkout_initiated"
        | "checkout_failed"
        | "trial_started"
        | "trial_ended"
        | "subscription_activated"
        | "subscription_updated"
        | "subscription_past_due"
        | "subscription_suspended"
        | "subscription_reactivated"
        | "subscription_canceled"
        | "invoice_paid"
        | "invoice_failed"
        | "invoice_refunded"
        | "webhook_received"
        | "admin_action";
      event_source: "checkout" | "webhook" | "admin" | "system";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      subscription_status: ["trialing", "active", "past_due", "suspended", "canceled", "expired"],
      billing_cycle: ["monthly", "annual"],
      subscription_event_type: [
        "checkout_initiated",
        "checkout_failed",
        "trial_started",
        "trial_ended",
        "subscription_activated",
        "subscription_updated",
        "subscription_past_due",
        "subscription_suspended",
        "subscription_reactivated",
        "subscription_canceled",
        "invoice_paid",
        "invoice_failed",
        "invoice_refunded",
        "webhook_received",
        "admin_action",
      ],
      event_source: ["checkout", "webhook", "admin", "system"],
    },
  },
} as const;
