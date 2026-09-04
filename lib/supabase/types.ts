export type Database = {
  public: {
    Tables: {
      services: {
        Row: {
          id: string;
          name: string;
          description: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      tiers: {
        Row: {
          id: string;
          name: string;
          level: number;
          description: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          level: number;
          description?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          level?: number;
          description?: string | null;
        };
        Relationships: [];
      };
      tier_services: {
        Row: {
          tier_id: string;
          service_id: string;
        };
        Insert: {
          tier_id: string;
          service_id: string;
        };
        Update: {
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
          name: string;
        };
        Insert: {
          id?: string;
          name: string;
        };
        Update: {
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      pricing_rules: {
        Row: {
          id: string;
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
          user_id: string | null;
          client_name: string;
          tier_id: string;
          industry_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          client_name: string;
          tier_id: string;
          industry_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string | null;
          client_name?: string;
          tier_id?: string;
          industry_id?: string | null;
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
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
