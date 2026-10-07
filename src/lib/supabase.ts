import { createClient } from '@supabase/supabase-js';

// Frontend Supabase client using strictly public/anonymous credentials (#8, #24)
// Never expose service_role_key in frontend code.
const supabaseUrl = (
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://ygeggtwqsphluwfegqjl.supabase.co'
).trim();

const supabaseAnonKey = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnZWdndHdxc3BobHV3ZmVncWpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNjU1ODksImV4cCI6MjEwNjk0MTU4OX0.R5hEitdWflQGQbE-DK_wTjg-oroRRXlJtiWVEiiacaU'
).trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('http') &&
  !supabaseUrl.includes('YOUR_SUPABASE')
);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    })
  : null;

export const KYC_STORAGE_BUCKET = 'candidate-kyc';
