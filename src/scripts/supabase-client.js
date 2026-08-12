(function () {
  'use strict';

  const SUPABASE_URL = '__SUPABASE_URL__';
  const SUPABASE_KEY = '__SUPABASE_KEY__';

  const isPlaceholder =
    !SUPABASE_URL || !SUPABASE_KEY ||
    SUPABASE_URL.indexOf('__SUPABASE_') === 0 ||
    SUPABASE_KEY.indexOf('__SUPABASE_') === 0;

  window.nexusSupabaseConfig = { url: SUPABASE_URL, key: SUPABASE_KEY, configured: false };
  window.supabaseClient = null;
  window.nexusSupabaseAuth = null;

  if (isPlaceholder) {
    console.warn('[NEXUS] Supabase creds missing — local-only mode.');
    return;
  }

  var sb = window.supabase || null;

  if (!sb || typeof sb.createClient !== 'function') {
    console.error('[NEXUS] window.supabase not found — CDN script failed to load.');
    return;
  }

  try {
    var client = sb.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = client;
    window.nexusSupabaseConfig.configured = true;
    window.nexusSupabaseAuth = {
      getSession: function () { return client.auth.getSession(); },
      signIn:     function (email, pw) { return client.auth.signInWithPassword({ email: email, password: pw }); },
      signUp:     function (email, pw) { return client.auth.signUp({ email: email, password: pw }); },
      signOut:    function () { return client.auth.signOut(); },
    };
    console.log('[NEXUS] Supabase ready.');
  } catch (err) {
    console.error('[NEXUS] createClient failed:', err);
  }
}());
