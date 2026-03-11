// ── Supabase Configuration ────────────────────────────────────────────────────
// After creating your Supabase project, fill in these two values.
// Dashboard → Project Settings → API
//
// The anon key is safe to put here — Supabase is designed this way.
// Row Level Security (RLS) in schema.sql ensures users only see their own data.

const SUPABASE_URL      = "https://jlcvznpnhxhqytopjiud.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsY3Z6bnBuaHhocXl0b3BqaXVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyMjc4ODAsImV4cCI6MjA4ODgwMzg4MH0.Q5Ud4A8c_YaSnI85LpQ-x3goZLvqGcFLTIYon9Kghno";

// ── Google Books API ──────────────────────────────────────────────────────────
// Works without a key for light use (family app).
// For higher rate limits, get a free key at: https://console.cloud.google.com/
const GOOGLE_BOOKS_API_KEY = "";   // optional — leave blank to use without key
