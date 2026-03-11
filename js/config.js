// ── Supabase Configuration ────────────────────────────────────────────────────
// After creating your Supabase project, fill in these two values.
// Dashboard → Project Settings → API
//
// The anon key is safe to put here — Supabase is designed this way.
// Row Level Security (RLS) in schema.sql ensures users only see their own data.

const SUPABASE_URL      = "PASTE_YOUR_PROJECT_URL_HERE";
const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE";

// ── Google Books API ──────────────────────────────────────────────────────────
// Works without a key for light use (family app).
// For higher rate limits, get a free key at: https://console.cloud.google.com/
const GOOGLE_BOOKS_API_KEY = "";   // optional — leave blank to use without key
