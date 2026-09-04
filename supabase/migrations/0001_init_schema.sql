create extension if not exists pgcrypto;

create table services (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text
);

create table tiers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  level int not null unique,
  description text
);

create table tier_services (
  tier_id uuid not null references tiers (id) on delete cascade,
  service_id uuid not null references services (id) on delete cascade,
  primary key (tier_id, service_id)
);

create table industries (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  tier_id uuid not null references tiers (id) on delete cascade,
  industry_id uuid references industries (id) on delete cascade,
  setup_fee numeric(10, 2) not null,
  monthly_fee numeric(10, 2) not null,
  founding_setup_fee numeric(10, 2),
  founding_monthly_fee numeric(10, 2),
  founding_duration_months int,
  unique (tier_id, industry_id)
);

create table proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  client_name text not null,
  tier_id uuid not null references tiers (id),
  industry_id uuid references industries (id),
  created_at timestamptz not null default now()
);
