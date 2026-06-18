-- =============================================================================
-- SuperLoopz — Vendor Onboarding  |  Schema + Row Level Security
-- Migration 001 (initial)
--
-- Security model (matches Tech Stack Report §10):
--   * Every request opens a transaction and sets two GUCs:
--       SET LOCAL app.current_user_id = '<users.id uuid>';
--       SET LOCAL app.user_role       = 'vendor' | 'admin' | 'support';
--   * RLS policies use those GUCs so a vendor can ONLY read/write their own
--     rows, while admin/support can see everything.
--   * FORCE ROW LEVEL SECURITY makes the policies apply even to the table
--     owner, so there is no accidental bypass.
--   * Passwords are never stored here — Keycloak owns all credentials.
-- =============================================================================

BEGIN;

CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('vendor', 'admin', 'support');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vendor_status AS ENUM ('pending', 'active', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doc_type AS ENUM ('GST', 'PAN', 'CIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE storage_type AS ENUM ('minio', 'r2');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE address_type AS ENUM ('registered', 'billing', 'shipping');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- Helper functions reading the per-request GUCs
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_current_user_id() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION app_user_role() RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(NULLIF(current_setting('app.user_role', true), ''), 'anonymous')
$$;

CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_user_role() IN ('admin', 'support')
$$;

-- updated_at trigger
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- ----------------------------------------------------------------------------
-- users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_id text UNIQUE NOT NULL,
  email       text UNIQUE NOT NULL,
  role        user_role NOT NULL DEFAULT 'vendor',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users (lower(email));

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- vendor_profiles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendor_profiles (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name      text,
  last_name       text,
  phone           text,
  onboarding_step integer NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 5),
  status          vendor_status NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_vendor_profiles_user ON vendor_profiles (user_id);

CREATE TRIGGER trg_vendor_profiles_updated
  BEFORE UPDATE ON vendor_profiles FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- companies
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  legal_name          text,
  trade_name          text,
  registration_number text,
  incorporation_date  date,
  industry            text,
  vendor_type         text,
  vendor_category     text,
  years_in_business   text,
  number_of_employees text,
  annual_turnover     text,
  website             text,
  company_email       text,
  company_speciality  text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_companies_user ON companies (user_id);

CREATE TRIGGER trg_companies_updated
  BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------------------------------------------------------------
-- legal_documents
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS legal_documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  doc_type     doc_type NOT NULL,
  doc_name     text,
  doc_number   text,
  file_url     text,
  storage_type storage_type NOT NULL DEFAULT 'minio',
  verified     boolean NOT NULL DEFAULT false,
  verified_at  timestamptz,
  verified_by  uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, doc_type)
);
CREATE INDEX IF NOT EXISTS idx_legal_documents_company ON legal_documents (company_id);

-- ----------------------------------------------------------------------------
-- addresses
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS addresses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id     uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  type           address_type NOT NULL,
  street_address text,
  city           text,
  state          text,
  postal_code    text,
  country        text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, type)
);
CREATE INDEX IF NOT EXISTS idx_addresses_company ON addresses (company_id);

-- ----------------------------------------------------------------------------
-- onboarding_status
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS onboarding_status (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_reset         boolean NOT NULL DEFAULT false,
  profile_completed      boolean NOT NULL DEFAULT false,
  company_info_completed boolean NOT NULL DEFAULT false,
  legal_docs_completed   boolean NOT NULL DEFAULT false,
  address_completed      boolean NOT NULL DEFAULT false,
  fully_onboarded        boolean NOT NULL DEFAULT false,
  completed_at           timestamptz,
  UNIQUE (user_id)
);
CREATE INDEX IF NOT EXISTS idx_onboarding_status_user ON onboarding_status (user_id);

-- ----------------------------------------------------------------------------
-- audit_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  metadata   jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs (created_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

-- users: a user can read/update only their own row; staff can read all.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users FOR SELECT
  USING (id = app_current_user_id() OR app_is_staff());
DROP POLICY IF EXISTS users_modify ON users;
CREATE POLICY users_modify ON users FOR ALL
  USING (id = app_current_user_id() OR app_user_role() = 'admin')
  WITH CHECK (id = app_current_user_id() OR app_user_role() = 'admin');

-- vendor_profiles
ALTER TABLE vendor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_profiles FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS vendor_profiles_rls ON vendor_profiles;
CREATE POLICY vendor_profiles_rls ON vendor_profiles FOR ALL
  USING (user_id = app_current_user_id() OR app_is_staff())
  WITH CHECK (user_id = app_current_user_id() OR app_user_role() = 'admin');

-- companies
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS companies_rls ON companies;
CREATE POLICY companies_rls ON companies FOR ALL
  USING (user_id = app_current_user_id() OR app_is_staff())
  WITH CHECK (user_id = app_current_user_id() OR app_user_role() = 'admin');

-- legal_documents (owned via companies.user_id)
ALTER TABLE legal_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_documents FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_documents_rls ON legal_documents;
CREATE POLICY legal_documents_rls ON legal_documents FOR ALL
  USING (
    app_is_staff() OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = legal_documents.company_id
        AND c.user_id = app_current_user_id()
    )
  )
  WITH CHECK (
    app_user_role() IN ('admin', 'support') OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = legal_documents.company_id
        AND c.user_id = app_current_user_id()
    )
  );

-- addresses (owned via companies.user_id)
ALTER TABLE addresses ENABLE ROW LEVEL SECURITY;
ALTER TABLE addresses FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS addresses_rls ON addresses;
CREATE POLICY addresses_rls ON addresses FOR ALL
  USING (
    app_is_staff() OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = addresses.company_id
        AND c.user_id = app_current_user_id()
    )
  )
  WITH CHECK (
    app_user_role() = 'admin' OR EXISTS (
      SELECT 1 FROM companies c
      WHERE c.id = addresses.company_id
        AND c.user_id = app_current_user_id()
    )
  );

-- onboarding_status
ALTER TABLE onboarding_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_status FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS onboarding_status_rls ON onboarding_status;
CREATE POLICY onboarding_status_rls ON onboarding_status FOR ALL
  USING (user_id = app_current_user_id() OR app_is_staff())
  WITH CHECK (user_id = app_current_user_id() OR app_user_role() = 'admin');

-- audit_logs: vendors see only their own; staff see all; inserts allowed for
-- the acting user (the app always inserts within the user's request context).
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS audit_logs_select ON audit_logs;
CREATE POLICY audit_logs_select ON audit_logs FOR SELECT
  USING (user_id = app_current_user_id() OR app_is_staff());
DROP POLICY IF EXISTS audit_logs_insert ON audit_logs;
CREATE POLICY audit_logs_insert ON audit_logs FOR INSERT
  WITH CHECK (user_id = app_current_user_id() OR app_is_staff());

-- ----------------------------------------------------------------------------
-- Migration bookkeeping
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version) VALUES ('001_init')
  ON CONFLICT (version) DO NOTHING;

COMMIT;
