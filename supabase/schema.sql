-- =============================================================================
-- DOORBLY — RECRUITMENT & EMPLOYEE JOINING PORTAL
-- Complete Supabase PostgreSQL Schema, RLS Policies, and Private Storage Policies
-- =============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- -----------------------------------------------------------------------------
-- 1. ADMIN USERS TABLE (#25)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'ADMIN' CHECK (role IN ('SUPER_ADMIN', 'ADMIN', 'HR')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- 2. JOB APPLICATIONS TABLE (#11)
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
  email TEXT CHECK (email IS NULL OR email = '' OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
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
-- 3. CANDIDATE DOCUMENTS TABLE (#12)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.candidate_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES public.job_applications(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('AADHAAR_FRONT', 'AADHAAR_BACK', 'EDUCATIONAL_CERTIFICATE', 'BANK_PASSBOOK')),
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  verified_by TEXT,
  verified_at TIMESTAMPTZ,
  remarks TEXT
);

CREATE INDEX IF NOT EXISTS idx_candidate_documents_application_id ON public.candidate_documents(application_id);
CREATE INDEX IF NOT EXISTS idx_candidate_documents_verification_status ON public.candidate_documents(verification_status);

-- -----------------------------------------------------------------------------
-- 4. AUDIT LOG TABLE (#23)
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
-- 5. HELPER FUNCTION FOR ADMIN AUTHORIZATION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_authorized_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.admin_users
    WHERE user_id = auth.uid()
      AND active = true
      AND role IN ('SUPER_ADMIN', 'ADMIN', 'HR')
  );
$$;

-- -----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES (#24)
-- -----------------------------------------------------------------------------
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin Users RLS: Only authenticated admins can view admin profiles; only SUPER_ADMIN can modify
CREATE POLICY "Admins can view active admin profiles"
  ON public.admin_users
  FOR SELECT
  TO authenticated
  USING (public.is_authorized_admin());

-- Job Applications RLS:
-- Public applicants can INSERT their own application (cannot SELECT/UPDATE/DELETE others)
CREATE POLICY "Public applicants can submit job applications"
  ON public.job_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (status = 'SUBMITTED');

-- Authorized administrators can SELECT, UPDATE, DELETE applications
CREATE POLICY "Authorized admins can view all job applications"
  ON public.job_applications
  FOR SELECT
  TO authenticated
  USING (public.is_authorized_admin());

CREATE POLICY "Authorized admins can update job applications"
  ON public.job_applications
  FOR UPDATE
  TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

-- Candidate Documents RLS:
-- Public applicants can INSERT document metadata during application submission
CREATE POLICY "Public applicants can insert candidate document metadata"
  ON public.candidate_documents
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (verification_status = 'PENDING');

-- Only authorized administrators can view and verify candidate documents
CREATE POLICY "Authorized admins can view candidate documents"
  ON public.candidate_documents
  FOR SELECT
  TO authenticated
  USING (public.is_authorized_admin());

CREATE POLICY "Authorized admins can verify or reject candidate documents"
  ON public.candidate_documents
  FOR UPDATE
  TO authenticated
  USING (public.is_authorized_admin())
  WITH CHECK (public.is_authorized_admin());

-- Activity Logs RLS:
CREATE POLICY "Allow inserting activity logs on submission or admin review"
  ON public.application_activity_logs
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Authorized admins can view activity logs"
  ON public.application_activity_logs
  FOR SELECT
  TO authenticated
  USING (public.is_authorized_admin());

-- -----------------------------------------------------------------------------
-- 7. PRIVATE SUPABASE STORAGE BUCKET & SECURITY POLICIES (#8)
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'candidate-kyc',
  'candidate-kyc',
  false, -- STRICTLY PRIVATE BUCKET
  5242880, -- 5 MB limit
  ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

-- Applicants can upload their own KYC documents during application submission
CREATE POLICY "Applicants can upload KYC files to private bucket"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    bucket_id = 'candidate-kyc'
    AND (storage.extension(name) IN ('pdf', 'jpg', 'jpeg', 'png'))
  );

-- Only authenticated & authorized administrators can read/download KYC documents via signed URLs
CREATE POLICY "Authorized admins can read private KYC files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'candidate-kyc'
    AND public.is_authorized_admin()
  );

-- -----------------------------------------------------------------------------
-- 8. REALTIME CONFIGURATION (#31)
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.candidate_documents;
