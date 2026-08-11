// NEXUS authentication helpers.
// Supabase Auth persists its session in the browser automatically.
(function () {
  'use strict';

  document.documentElement.classList.add('auth-pending');
  var client = window.supabaseClient;
  var publicPages = ['/login.html'];

  function isPublicPage() {
    var path = window.location.pathname.replace(/\\/g, '/');
    return publicPages.indexOf(path) !== -1 || path.endsWith('/login.html');
  }

  async function getSession() {
    if (!window.nexusSupabaseAuth) return null;
    var result = await window.nexusSupabaseAuth.getSession();
    return result && result.data ? result.data.session : null;
  }

  function prepareUserStorage(userId) {
    var marker = 'nexus-auth-user-id';
    var previous = null;
    try { previous = localStorage.getItem(marker); } catch (e) { }
    if (previous === userId) return true;

    var appKeys = [
      'long_goals_v1', 'day_window_v1', 'wellness:sleep', 'wellness:habits',
      'wellness:recovery', 'wellness:dreams', 'wellness:journal', 'ibrahim_gym_v1',
      'ibrahim_gym_done', 'gym_pr_v1', 'gym_measurements_v1', 'gym_schedule_v1',
      'grind_log_v1', 'cali_skills_v1', 'facescan_last_scan', 'nx-workout-hist',
      'nx-session-snap', 'apple_health_metrics_v1', 'apple_health_sync_token',
      'journal:entry:'
    ];
    try {
      for (var i = 0; i < appKeys.length; i += 1) {
        if (appKeys[i].endsWith(':')) {
          for (var j = localStorage.length - 1; j >= 0; j -= 1) {
            var key = localStorage.key(j);
            if (key && key.indexOf(appKeys[i]) === 0) localStorage.removeItem(key);
          }
        } else {
          localStorage.removeItem(appKeys[i]);
        }
      }
      localStorage.setItem(marker, userId);
    } catch (e) { }
    if (previous !== null || appKeys.some(function (key) { return key.indexOf(':') === -1 && localStorage.getItem(key) !== null; })) {
      window.location.reload();
      return false;
    }
    return true;
  }

  async function requireAuth() {
    if (isPublicPage()) {
      document.documentElement.classList.remove('auth-pending');
      return null;
    }
    var session = await getSession();
    if (!session) {
      window.location.replace('/login.html');
      return null;
    }
    if (!prepareUserStorage(session.user.id)) return null;
    window.nexusSession = session;
    document.documentElement.classList.remove('auth-pending');
    return session;
  }

  function notConfiguredError() {
    return new Error(
      'Supabase Auth is not configured in this build. ' +
      'Run `npm run build` after copying .env.example to .env and filling in SUPABASE_URL and SUPABASE_KEY, then reload dist/login.html.'
    );
  }

  async function signIn(email, password) {
    if (!window.nexusSupabaseAuth) return { data: null, error: notConfiguredError() };
    return window.nexusSupabaseAuth.signIn(email, password);
  }

  async function signUp(email, password) {
    if (!window.nexusSupabaseAuth) return { data: null, error: notConfiguredError() };
    return window.nexusSupabaseAuth.signUp(email, password);
  }

  async function signOut() {
    if (window.nexusSupabaseAuth) await window.nexusSupabaseAuth.signOut();
    window.location.replace('/login.html');
  }

  window.nexusAuth = {
    client: client,
    getSession: getSession,
    requireAuth: requireAuth,
    signIn: signIn,
    signUp: signUp,
    signOut: signOut,
  };

  window.nexusAuthReady = isPublicPage() ? (document.documentElement.classList.remove('auth-pending'), Promise.resolve(null)) : requireAuth();

  if (client) {
    client.auth.onAuthStateChange(function (event, nextSession) {
      var currentUserId = window.nexusSession && window.nexusSession.user && window.nexusSession.user.id;
      var nextUserId = nextSession && nextSession.user && nextSession.user.id;
      if (event === 'SIGNED_OUT' && !isPublicPage()) {
        window.location.replace('/login.html');
        return;
      }
      if (nextSession && currentUserId && nextUserId !== currentUserId && !isPublicPage()) {
        prepareUserStorage(nextUserId);
        window.location.reload();
        return;
      }
      if (nextSession) window.nexusSession = nextSession;
    });
  }

  window.addEventListener('DOMContentLoaded', function () {
    var signOutButton = document.querySelector('[data-sign-out]');
    if (signOutButton) signOutButton.addEventListener('click', signOut);
    if (!isPublicPage() && window.nexusAuthReady) {
      window.nexusAuthReady.catch(function () { window.location.replace('/login.html'); });
    }
  }, { once: true });
})();
