// Ameple — Supabase Client Initialization
// Uses ESM import from CDN with ready-promise pattern

const SUPABASE_URL = 'https://agifokfebftbznqqpvjq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnaWZva2ZlYmZ0YnpucXFwdmpxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0OTIzMjYsImV4cCI6MjA5MTA2ODMyNn0.IlmyJmX18fHlco3EWhuqomEKy8wON_cRh6VsFPBmAD0';

window.AmepleSupabase = null;

// Promise that resolves when Supabase is ready
window.AmepleSupabaseReady = (async function () {
  try {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.AmepleSupabase = supabase;
    console.log('✅ Supabase client initialized');
    return supabase;
  } catch (e) {
    console.error('❌ Supabase init failed:', e);
    return null;
  }
})();
