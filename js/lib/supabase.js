// Orbiit — Supabase Client Initialization
// Uses ESM import from CDN

const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';

let supabase = null;

try {
  if (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    // Dynamic import for Supabase ESM
    import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm').then(({ createClient }) => {
      supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      window.OrbiitSupabase = supabase;
      console.log('✅ Supabase client initialized');
    });
  } else {
    console.log('ℹ️ Supabase not configured — using localStorage mode');
  }
} catch (e) {
  console.log('ℹ️ Supabase unavailable — using localStorage mode');
}

window.OrbiitSupabase = supabase;
