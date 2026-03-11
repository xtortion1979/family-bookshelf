// ── Supabase client singleton ─────────────────────────────────────────────
let _supabase = null;

function getSupabase() {
  if (!_supabase) {
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return _supabase;
}

// ── Session guard — call on every protected page ──────────────────────────
// Returns the current user, or redirects to index.html if not logged in.
async function requireAuth() {
  const { data: { session } } = await getSupabase().auth.getSession();
  if (!session) {
    window.location.replace('index.html');
    return null;
  }
  return session.user;
}

// ── Get display name from profiles table ─────────────────────────────────
async function getUserName(userId) {
  const { data } = await getSupabase()
    .from('profiles')
    .select('name')
    .eq('id', userId)
    .single();
  return data?.name || 'Reader';
}

// ── Sign out ──────────────────────────────────────────────────────────────
async function signOut() {
  await getSupabase().auth.signOut();
  window.location.replace('index.html');
}
