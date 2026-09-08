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
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          level: number;
          description?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          level?: number;
          description?: string | null;
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
          tier_name: string;
          tier_description: string | null;
          services: ProposalServiceSnapshot[];
          setup_fee: number;
          monthly_fee: number;
          founding_setup_fee: number | null;
          founding_monthly_fee: number | null;
          founding_duration_months: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          client_name: string;
          tier_id?: string | null;
          industry_id?: string | null;
          agency_name: string;
          tier_name: string;
          tier_description?: string | null;
          services: ProposalServiceSnapshot[];
          setup_fee: number;
          monthly_fee: number;
          founding_setup_fee?: number | null;
          founding_monthly_fee?: number | null;
          founding_duration_months?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          client_name?: string;
          tier_id?: string | null;
          industry_id?: string | null;
          agency_name?: string;
          tier_name?: string;
          tier_description?: string | null;
          services?: ProposalServiceSnapshot[];
          setup_fee?: number;
          monthly_fee?: number;
          founding_setup_fee?: number | null;
          founding_monthly_fee?: number | null;
          founding_duration_months?: number | null;
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
      settings: {
        Row: {
          user_id: string;
          agency_name: string;
        };
        Insert: {
          user_id: string;
          agency_name: string;
        };
        Update: {
          user_id?: string;
          agency_name?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
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

/** The fee fields a proposal renders. Both a live `PricingRule` and a saved
 * `Proposal` (which freezes them at save time) satisfy this. */
export type ProposalPricing = {
  setup_fee: number;
  monthly_fee: number;
  founding_setup_fee: number | null;
  founding_monthly_fee: number | null;
  founding_duration_months: number | null;
};
