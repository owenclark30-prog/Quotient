import type { PricingSnapshot } from "@/lib/pricing-snapshot";

/** What a proposal freezes about each included service at save time. */
export type ProposalServiceSnapshot = {
  name: string;
  description: string | null;
};

export type Database = {
  public: {
    Tables: {
      services: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      tiers: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          level: number;
          description: string | null;
          /** What delivering this tier costs in hours. NULL means never set,
           * which is different from a deliberate 0 — the app falls back to the
           * by-level defaults in lib/pricing.ts. */
          setup_hours: number | null;
          support_hours: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          level: number;
          description?: string | null;
          setup_hours?: number | null;
          support_hours?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          level?: number;
          description?: string | null;
          setup_hours?: number | null;
          support_hours?: number | null;
        };
        Relationships: [];
      };
      agency_cost_settings: {
        Row: {
          user_id: string;
          hourly_cost: number;
          /** Fraction, not a percentage: used directly as (1 - g). */
          target_margin: number;
          tool_cost_monthly: number;
          conservatism_factor: number;
          rounding_style: "off" | "clean" | "charm";
          /** 7 or 9. Only read when the style is charm. */
          rounding_ending: number;
          /** Whole pounds; null means the scaled default in lib/pricing.ts. */
          rounding_step: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          hourly_cost?: number;
          target_margin?: number;
          tool_cost_monthly?: number;
          conservatism_factor?: number;
          rounding_style?: "off" | "clean" | "charm";
          rounding_ending?: number;
          rounding_step?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          hourly_cost?: number;
          target_margin?: number;
          tool_cost_monthly?: number;
          conservatism_factor?: number;
          rounding_style?: "off" | "clean" | "charm";
          rounding_ending?: number;
          rounding_step?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tier_services: {
        Row: {
          user_id: string;
          tier_id: string;
          service_id: string;
        };
        Insert: {
          user_id: string;
          tier_id: string;
          service_id: string;
        };
        Update: {
          user_id?: string;
          tier_id?: string;
          service_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tier_services_tier_id_fkey";
            columns: ["tier_id"];
            isOneToOne: false;
            referencedRelation: "tiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tier_services_service_id_fkey";
            columns: ["service_id"];
            isOneToOne: false;
            referencedRelation: "services";
            referencedColumns: ["id"];
          },
        ];
      };
      industries: {
        Row: {
          id: string;
          user_id: string;
          name: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          id: string;
          user_id: string;
          tier_id: string;
          industry_id: string | null;
          setup_fee: number;
          monthly_fee: number;
          founding_setup_fee: number | null;
          founding_monthly_fee: number | null;
          founding_duration_months: number | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier_id: string;
          industry_id?: string | null;
          setup_fee: number;
          monthly_fee: number;
          founding_setup_fee?: number | null;
          founding_monthly_fee?: number | null;
          founding_duration_months?: number | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier_id?: string;
          industry_id?: string | null;
          setup_fee?: number;
          monthly_fee?: number;
          founding_setup_fee?: number | null;
          founding_monthly_fee?: number | null;
          founding_duration_months?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "pricing_rules_tier_id_fkey";
            columns: ["tier_id"];
            isOneToOne: false;
            referencedRelation: "tiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pricing_rules_industry_id_fkey";
            columns: ["industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
        ];
      };
      proposals: {
        Row: {
          id: string;
          user_id: string;
          client_name: string;
          tier_id: string | null;
          industry_id: string | null;
          agency_name: string;
          agency_logo: string | null;
          agency_email: string | null;
          agency_website: string | null;
          industry_name: string | null;
          tier_name: string;
          tier_description: string | null;
          services: ProposalServiceSnapshot[];
          setup_fee: number;
          monthly_fee: number;
          founding_setup_fee: number | null;
          founding_monthly_fee: number | null;
          founding_duration_months: number | null;
          /** The frozen "Price this client" snapshot, or NULL for a proposal
           * priced straight from the rate card. Typed `unknown` on the way out
           * on purpose: it's a jsonb column, so `parsePricingSnapshot` is the
           * only way in. */
          pricing_inputs: unknown;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_name: string;
          tier_id?: string | null;
          industry_id?: string | null;
          agency_name: string;
          agency_logo?: string | null;
          agency_email?: string | null;
          agency_website?: string | null;
          industry_name?: string | null;
          tier_name: string;
          tier_description?: string | null;
          services: ProposalServiceSnapshot[];
          setup_fee: number;
          monthly_fee: number;
          founding_setup_fee?: number | null;
          founding_monthly_fee?: number | null;
          founding_duration_months?: number | null;
          pricing_inputs?: PricingSnapshot | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          client_name?: string;
          tier_id?: string | null;
          industry_id?: string | null;
          agency_name?: string;
          agency_logo?: string | null;
          agency_email?: string | null;
          agency_website?: string | null;
          industry_name?: string | null;
          tier_name?: string;
          tier_description?: string | null;
          services?: ProposalServiceSnapshot[];
          setup_fee?: number;
          monthly_fee?: number;
          founding_setup_fee?: number | null;
          founding_monthly_fee?: number | null;
          founding_duration_months?: number | null;
          pricing_inputs?: PricingSnapshot | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proposals_tier_id_fkey";
            columns: ["tier_id"];
            isOneToOne: false;
            referencedRelation: "tiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proposals_industry_id_fkey";
            columns: ["industry_id"];
            isOneToOne: false;
            referencedRelation: "industries";
            referencedColumns: ["id"];
          },
        ];
      };
      onboarding_documents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      tier_onboarding_documents: {
        Row: { user_id: string; tier_id: string; document_id: string };
        Insert: { user_id: string; tier_id: string; document_id: string };
        Update: { user_id?: string; tier_id?: string; document_id?: string };
        Relationships: [];
      };
      onboarding_runs: {
        Row: {
          id: string;
          user_id: string;
          proposal_id: string | null;
          tier_id: string | null;
          client_name: string;
          tier_name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          proposal_id?: string | null;
          tier_id?: string | null;
          client_name: string;
          tier_name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          proposal_id?: string | null;
          tier_id?: string | null;
          client_name?: string;
          tier_name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      onboarding_run_documents: {
        Row: {
          id: string;
          user_id: string;
          run_id: string;
          document_id: string | null;
          name: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          run_id: string;
          document_id?: string | null;
          name: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          run_id?: string;
          document_id?: string | null;
          name?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "onboarding_run_documents_run_fkey";
            columns: ["run_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "onboarding_runs";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      onboarding_stages: {
        Row: {
          id: string;
          user_id: string;
          tier_id: string;
          position: number;
          day_offset: number | null;
          title: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier_id: string;
          position?: number;
          day_offset?: number | null;
          title: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier_id?: string;
          position?: number;
          day_offset?: number | null;
          title?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      onboarding_run_steps: {
        Row: {
          id: string;
          user_id: string;
          run_id: string;
          stage_id: string | null;
          position: number;
          day_offset: number | null;
          title: string;
          notes: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          run_id: string;
          stage_id?: string | null;
          position?: number;
          day_offset?: number | null;
          title: string;
          notes?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          run_id?: string;
          stage_id?: string | null;
          position?: number;
          day_offset?: number | null;
          title?: string;
          notes?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      waitlist_emails: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          /** Stripe's own status, verbatim and unconstrained — see 0018. */
          status: string | null;
          plan: "founder" | "standard" | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          comped: boolean;
          past_due_since: string | null;
          claimed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string | null;
          plan?: "founder" | "standard" | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          comped?: boolean;
          past_due_since?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          status?: string | null;
          plan?: "founder" | "standard" | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          comped?: boolean;
          past_due_since?: string | null;
          claimed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stripe_events: {
        Row: { id: string; type: string; received_at: string };
        Insert: { id: string; type: string; received_at?: string };
        Update: { id?: string; type?: string; received_at?: string };
        Relationships: [];
      };
      settings: {
        Row: {
          user_id: string;
          agency_name: string;
          logo: string | null;
          contact_email: string | null;
          website: string | null;
        };
        Insert: {
          user_id: string;
          agency_name: string;
          logo?: string | null;
          contact_email?: string | null;
          website?: string | null;
        };
        Update: {
          user_id?: string;
          agency_name?: string;
          logo?: string | null;
          contact_email?: string | null;
          website?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      /** Both are SECURITY DEFINER and granted to service_role only, so these
       * are callable from server code holding the service key and from nowhere
       * else. See migration 0018. */
      claim_plan: {
        Args: { p_user_id: string };
        Returns: "founder" | "standard";
      };
      founder_slots_used: {
        Args: { p_exclude_user?: string | null };
        Returns: number;
      };
    };
    Enums: {};
    CompositeTypes: {};
  };
};

export type Service = Database["public"]["Tables"]["services"]["Row"];
export type Tier = Database["public"]["Tables"]["tiers"]["Row"];
export type Industry = Database["public"]["Tables"]["industries"]["Row"];
export type PricingRule = Database["public"]["Tables"]["pricing_rules"]["Row"];
export type Proposal = Database["public"]["Tables"]["proposals"]["Row"];
export type Settings = Database["public"]["Tables"]["settings"]["Row"];
export type Subscription =
  Database["public"]["Tables"]["subscriptions"]["Row"];

/** The fee fields a proposal renders. Both a live `PricingRule` and a saved
 * `Proposal` (which freezes them at save time) satisfy this. */
export type ProposalPricing = {
  setup_fee: number;
  monthly_fee: number;
  founding_setup_fee: number | null;
  founding_monthly_fee: number | null;
  founding_duration_months: number | null;
};

/** The agency's own identity, as it appears on a proposal. `logo` is a PNG
 * data URI (see lib/logo.ts); the rest are plain text. */
export type AgencyIdentity = {
  agencyName: string;
  logo: string | null;
  contactEmail: string | null;
  website: string | null;
};

export type OnboardingDocument =
  Database["public"]["Tables"]["onboarding_documents"]["Row"];
export type OnboardingRun =
  Database["public"]["Tables"]["onboarding_runs"]["Row"];
export type OnboardingRunDocument =
  Database["public"]["Tables"]["onboarding_run_documents"]["Row"];

export type OnboardingStage =
  Database["public"]["Tables"]["onboarding_stages"]["Row"];
export type OnboardingRunStep =
  Database["public"]["Tables"]["onboarding_run_steps"]["Row"];
