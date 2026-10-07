// Complete Supabase PostgreSQL Schema, RLS Policies, Storage Bucket, and Authorized Admin Seed
// Ready to paste and run directly in Supabase Dashboard -> SQL Editor

export const SUPABASE_PRODUCTION_SQL = `-- =============================================================================
-- DOORBLY — RECRUITMENT & EMPLOYEE JOINING PORTAL
-- Complete Supabase PostgreSQL Schema, RLS Policies & Storage Bucket Setup
-- Project: https://ygeggtwqsphluwfegqjl.supabase.co
-- Authorized Admin: debabrata.tribune@gmail.com
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ADMIN USERS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'SUPER_ADMIN' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'HR')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the authorized Super Admin account
INSERT INTO public.admin_users (user_id, name, email, role, active)
VALUES (
  'admin-super-tribune',
  'Debabrata Mohanta',
  'debabrata.tribune@gmail.com',
  'SUPER_ADMIN',
  true
)
ON CONFLICT (email) DO UPDATE
SET name = EXCLUDED.name,
    role = 'SUPER_ADMIN',
    active = true;

-- -----------------------------------------------------------------------------
-- 2. JOB APPLICATIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.job_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_number TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  parent_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender TEXT NOT NULL,
  mobile TEXT NOT NULL CHECK (mobile ~ '^[6-9][0-9]{9}$'),
  alternate_mobile TEXT CHECK (alternate_mobile IS NULL OR alternate_mobile = '' OR alternate_mobile ~ '^[6-9][0-9]{9}$'),
  email TEXT CHECK (email IS NULL OR email = '' OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'),
  address TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  pin_code TEXT NOT NULL CHECK (pin_code ~ '^[1-9][0-9]{5}$'),
  applied_position TEXT NOT NULL,
  preferred_location TEXT NOT NULL,
  experience TEXT NOT NULL,
  total_experience TEXT NOT NULL,
  previous_company TEXT,
  previous_designation TEXT,
  expected_salary TEXT NOT NULL,
  notice_period TEXT NOT NULL,
  highest_qualification TEXT NOT NULL,
  institution TEXT NOT NULL,
  passing_year TEXT NOT NULL,
  additional_qualifications TEXT,
  skills TEXT NOT NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_relationship TEXT NOT NULL,
  emergency_contact_mobile TEXT NOT NULL CHECK (emergency_contact_mobile ~ '^[6-9][0-9]{9}$'),
  status TEXT NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN ('SUBMITTED', 'UNDER_REVIEW', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'ON_HOLD')),
  admin_remarks TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

-- Indexes for fast Admin filtering & search
CREATE INDEX IF NOT EXISTS idx_job_applications_status ON public.job_applications(status);
CREATE INDEX IF NOT EXISTS idx_job_applications_position ON public.job_applications(applied_position);
CREATE INDEX IF NOT EXISTS idx_job_applications_district ON public.job_applications(district);
CREATE INDEX IF NOT EXISTS idx_job_applications_mobile ON public.job_applications(mobile);
CREATE INDEX IF NOT EXISTS idx_job_applications_created_at ON public.job_applications(created_at DESC);

-- -----------------------------------------------------------------------------
-- 3. CANDIDATE DOCUMENTS TABLE (Supports all 4 mandatory + 2 optional KYC docs)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN (
    'AADHAAR_FRONT',
    'AADHAAR_BACK',
    'EDUCATIONAL_CERTIFICATE',
    'BANK_PASSBOOK',
    'RESUME',
    'PASSPORT_PHOTO'
  )),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT DEFAULT 'application/pdf',
  file_data TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_application_id ON public.candidate_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_verification_status ON public.candidate_documents(verification_status);

-- -----------------------------------------------------------------------------
-- 4. APPLICATION ACTIVITY / AUDIT LOG TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_status TEXT,
  new_status TEXT,
  remarks TEXT,
  performed_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_application_id ON public.application_activity_logs(application_id);

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_activity_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policies safely if re-running script
DROP POLICY IF EXISTS "Allow read/update admin_users" ON public.admin_users;
DROP POLICY IF EXISTS "Allow public and admin operations on job_applications" ON public.job_applications;
DROP POLICY IF EXISTS "Allow public and admin operations on candidate_documents" ON public.candidate_documents;
DROP POLICY IF EXISTS "Allow public and admin operations on application_activity_logs" ON public.application_activity_logs;

CREATE POLICY "Allow read/update admin_users"
  ON public.admin_users
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public and admin operations on job_applications"
  ON public.job_applications
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public and admin operations on candidate_documents"
  ON public.candidate_documents
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public and admin operations on application_activity_logs"
  ON public.application_activity_logs
  FOR ALL
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);

-- -----------------------------------------------------------------------------
-- 6. SUPABASE STORAGE BUCKET (candidate-kyc) & STORAGE POLICIES
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-kyc',
  'candidate-kyc',
  false,
  5242880, -- 5 MB limit per file
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

DROP POLICY IF EXISTS "Allow KYC uploads to candidate-kyc" ON storage.objects;
DROP POLICY IF EXISTS "Allow KYC reads from candidate-kyc" ON storage.objects;

CREATE POLICY "Allow KYC uploads to candidate-kyc"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'candidate-kyc');

CREATE POLICY "Allow KYC reads from candidate-kyc"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'candidate-kyc');

-- -----------------------------------------------------------------------------
-- 7. ENABLE REALTIME UPDATES FOR ADMIN DASHBOARD
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'job_applications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'candidate_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_documents;
  END IF;
END $$;
`;
