-- =============================================================================
-- SuperLoopz on Supabase — schema + Row Level Security + Storage
-- Run this in: Supabase Dashboard → SQL Editor → New query → paste → Run.
--
-- Model:
--   * Users live in Supabase's auth.users. Their ROLE (vendor/admin/support)
--     is stored in app_metadata and read from the JWT in RLS (no table
--     recursion). We mirror it into public.profiles for convenience.
--   * Vendors can only see/edit their own rows; admin/support see everything.
--   * Legal docs go to the private 'legal-docs' Storage bucket, scoped per user.
-- =============================================================================

-- ---- enums -----------------------------------------------------------------
do $$ begin create type vendor_status as enum ('pending','active','suspended'); exception when duplicate_object then null; end $$;
do $$ begin create type doc_type as enum ('GST','PAN','CIN'); exception when duplicate_object then null; end $$;
do $$ begin create type address_type as enum ('registered','billing','shipping'); exception when duplicate_object then null; end $$;

-- ---- role helpers (read role from the JWT, not a table → no recursion) ------
-- Model: invited users are tagged role='vendor'. ANY OTHER authenticated user
-- (i.e. accounts created in the Supabase dashboard by the SuperLoopz team) is
-- treated as staff/admin. Anonymous requests are never staff.
create or replace function public.jwt_role() returns text
language sql stable as $$
  select case
    when auth.uid() is null then 'anon'
    when coalesce(current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,role}','') = 'vendor' then 'vendor'
    else 'admin'
  end
$$;

create or replace function public.is_staff() returns boolean
language sql stable as $$
  select auth.uid() is not null
     and coalesce(current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,role}','') <> 'vendor'
$$;

-- ---- profiles (mirror of auth user + role) ---------------------------------
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  role        text not null default 'vendor',
  created_at  timestamptz not null default now()
);

-- Auto-create a profile when a new auth user is created. Invited users carry
-- role='vendor' (in app/user metadata); dashboard-created users default to admin.
-- Only vendors get onboarding rows.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_role text := coalesce(new.raw_app_meta_data ->> 'role', new.raw_user_meta_data ->> 'role', 'admin');
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, v_role)
  on conflict (id) do update set email = excluded.email;
  if v_role = 'vendor' then
    insert into public.onboarding_status (user_id) values (new.id) on conflict (user_id) do nothing;
    insert into public.vendor_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- ---- vendor_profiles -------------------------------------------------------
create table if not exists public.vendor_profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade unique,
  first_name      text,
  last_name       text,
  phone           text,
  onboarding_step integer not null default 1 check (onboarding_step between 1 and 5),
  status          vendor_status not null default 'pending',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---- companies -------------------------------------------------------------
create table if not exists public.companies (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade unique,
  legal_name          text, trade_name text, registration_number text,
  incorporation_date  date, industry text, vendor_type text, vendor_category text,
  years_in_business   text, number_of_employees text, annual_turnover text,
  website text, company_email text, company_speciality text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- legal_documents -------------------------------------------------------
create table if not exists public.legal_documents (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  doc_type    doc_type not null,
  doc_name    text, doc_number text,
  file_path   text,                 -- path in the 'legal-docs' storage bucket
  verified    boolean not null default false,
  verified_at timestamptz, verified_by uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  unique (user_id, doc_type)
);

-- ---- addresses -------------------------------------------------------------
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        address_type not null,
  street_address text, city text, state text, postal_code text, country text,
  created_at  timestamptz not null default now(),
  unique (user_id, type)
);

-- ---- onboarding_status -----------------------------------------------------
create table if not exists public.onboarding_status (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  profile_completed      boolean not null default false,
  company_info_completed boolean not null default false,
  legal_docs_completed   boolean not null default false,
  address_completed      boolean not null default false,
  fully_onboarded        boolean not null default false,
  completed_at           timestamptz
);

-- ---- audit_logs ------------------------------------------------------------
create table if not exists public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users(id) on delete set null,
  action     text not null,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table public.profiles          enable row level security;
alter table public.vendor_profiles   enable row level security;
alter table public.companies         enable row level security;
alter table public.legal_documents   enable row level security;
alter table public.addresses         enable row level security;
alter table public.onboarding_status enable row level security;
alter table public.audit_logs        enable row level security;

-- profiles: read own or staff
drop policy if exists profiles_sel on public.profiles;
create policy profiles_sel on public.profiles for select using (id = auth.uid() or public.is_staff());

-- generic "own row or staff" for the vendor-owned tables
do $$
declare t text;
begin
  foreach t in array array['vendor_profiles','companies','legal_documents','addresses','onboarding_status']
  loop
    execute format('drop policy if exists %1$s_sel on public.%1$s;', t);
    execute format('create policy %1$s_sel on public.%1$s for select using (user_id = auth.uid() or public.is_staff());', t);
    execute format('drop policy if exists %1$s_ins on public.%1$s;', t);
    execute format('create policy %1$s_ins on public.%1$s for insert with check (user_id = auth.uid());', t);
    execute format('drop policy if exists %1$s_upd on public.%1$s;', t);
    execute format('create policy %1$s_upd on public.%1$s for update using (user_id = auth.uid() or public.is_staff()) with check (user_id = auth.uid() or public.is_staff());', t);
  end loop;
end $$;

-- audit_logs: read own/staff, insert own
drop policy if exists audit_sel on public.audit_logs;
create policy audit_sel on public.audit_logs for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists audit_ins on public.audit_logs;
create policy audit_ins on public.audit_logs for insert with check (user_id = auth.uid());

-- =============================================================================
-- Storage: private bucket for legal documents, scoped to each user's folder
--   path convention:  legal-docs/<user_id>/<doc_type>/<filename>
-- =============================================================================
insert into storage.buckets (id, name, public) values ('legal-docs','legal-docs', false)
  on conflict (id) do nothing;

drop policy if exists legaldocs_rw on storage.objects;
create policy legaldocs_rw on storage.objects for all
  using (
    bucket_id = 'legal-docs'
    and (public.is_staff() or (storage.foldername(name))[1] = auth.uid()::text)
  )
  with check (
    bucket_id = 'legal-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- Automated document verification (Surepass) — credit budget + per-doc records
-- Written only by the server (service key). When the budget is exhausted the app
-- falls back to manual admin verification.
-- =============================================================================

-- Single-row credit counter. Increment atomically via consume_verify_credit().
create table if not exists public.verify_usage (
  id boolean primary key default true,
  used integer not null default 0,
  constraint verify_usage_one_row check (id)
);
insert into public.verify_usage (id, used) values (true, 0) on conflict (id) do nothing;

create or replace function public.consume_verify_credit() returns integer
language sql volatile security definer as $$
  update public.verify_usage set used = used + 1 where id returning used;
$$;

-- One row per successful automated verification (server-inserted only).
create table if not exists public.verifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doc_type doc_type not null,
  id_number text not null,
  valid boolean not null default false,
  registered_name text,
  source text default 'surepass',
  created_at timestamptz default now()
);
alter table public.verifications enable row level security;
drop policy if exists verifications_sel on public.verifications;
create policy verifications_sel on public.verifications for select
  using (user_id = auth.uid() or public.is_staff());
-- No insert/update policy: writes go through the service key only.
