// Shared browser Supabase client.
// Credentials are injected by scripts/build.js; never create another client in a page.
(function () {
  'use strict';

  const SUPABASE_URL = '__SUPABASE_URL__';
  const SUPABASE_KEY = '__SUPABASE_KEY__';

  window.nexusSupabaseConfig = { url: SUPABASE_URL, key: SUPABASE_KEY };

  if (!window.supabase || !SUPABASE_URL || !SUPABASE_KEY ||
      SUPABASE_URL.indexOf('__SUPABASE_') === 0 ||
      SUPABASE_KEY.indexOf('__SUPABASE_') === 0) {
    window.supabaseClient = null;
    return;
  }

  window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  window.nexusSupabaseAuth = {
    getSession: function () { return window.supabaseClient.auth.getSession(); },
    signIn: function (email, password) {
      return window.supabaseClient.auth.signInWithPassword({ email: email, password: password });
    },
    signUp: function (email, password) {
      return window.supabaseClient.auth.signUp({ email: email, password: password });
    },
    signOut: function () { return window.supabaseClient.auth.signOut(); },
  };
})();
