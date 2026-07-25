/**
 * RiskFusion AI — Runtime configuration.
 *
 * The Supabase project URL and anon (publishable) key are designed to be public:
 * they identify the project and carry no privileges of their own. All access is
 * governed by Row Level Security policies plus the authenticated user's JWT.
 * Never place the service_role key in this file — it belongs only in the
 * server-side environment (see .env.example).
 */
window.RISKFUSION_CONFIG = {
  supabaseUrl: 'https://njepfasjoaomxgpxvjbx.supabase.co',
  supabaseAnonKey:
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5qZXBmYXNqb2FvbXhncHh2amJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4OTA5MDQsImV4cCI6MjEwMDQ2NjkwNH0.pGo6LgCm8VPdim_LF8yaTDk8m13crwaOpfglTJ2q39E',
  /** Page an authenticated user lands on. */
  homePage: 'dashboard.html',
  /** Page unauthenticated users are sent to. */
  loginPage: 'index.html',
};
