/* =====================================================================
   supabase.js — Database client via Vercel API routes
   ---------------------------------------------------------------------
   Replaces the Supabase client with direct API calls to /api/auth,
   /api/farms, and /api/activity endpoints backed by Vercel Postgres.
   
   Environment variables (set in Vercel or public/env.js):
     API_BASE — base URL for API routes (default: '' for same origin)
   ===================================================================== */

const API_BASE = (window.ENV && window.ENV.API_BASE) || '';

let _sessionToken = null;
let _userId = null;
let _userEmail = null;

function sbReady() { return true; }

/* ---- auth helpers ---- */
async function sbSignUp(email, password) {
  const res = await fetch(API_BASE + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'signup', email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Signup failed');
  _sessionToken = data.token;
  _userId = data.user_id;
  _userEmail = data.email;
  localStorage.setItem('at3_session', JSON.stringify({ token: data.token, user_id: data.user_id, email: data.email }));
  return data;
}

async function sbSignIn(email, password) {
  const res = await fetch(API_BASE + '/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'login', email, password })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Login failed');
  _sessionToken = data.token;
  _userId = data.user_id;
  _userEmail = data.email;
  localStorage.setItem('at3_session', JSON.stringify({ token: data.token, user_id: data.user_id, email: data.email }));
  return { user: { id: data.user_id, email: data.email } };
}

async function sbSignOut() {
  _sessionToken = null;
  _userId = null;
  _userEmail = null;
  localStorage.removeItem('at3_session');
}

function sbUser() {
  if (_userId && _userEmail) return { id: _userId, email: _userEmail };
  return null;
}

async function sbCurrentUser() {
  // Try restoring from localStorage
  if (!_sessionToken) {
    try {
      const saved = JSON.parse(localStorage.getItem('at3_session'));
      if (saved && saved.token) {
        _sessionToken = saved.token;
        _userId = saved.user_id;
        _userEmail = saved.email;
      }
    } catch (e) {}
  }
  if (!_sessionToken) return null;
  
  try {
    const res = await fetch(API_BASE + '/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'session', token: _sessionToken })
    });
    if (!res.ok) {
      _sessionToken = null; _userId = null; _userEmail = null;
      localStorage.removeItem('at3_session');
      return null;
    }
    const data = await res.json();
    _userId = data.user_id;
    _userEmail = data.email;
    return { id: data.user_id, email: data.email };
  } catch (e) {
    return null;
  }
}

/* ---- farm CRUD ---- */
async function sbSaveFarm(farm) {
  if (!_userId) return null;
  try {
    const res = await fetch(API_BASE + '/api/farms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: _userId, name: farm.name, data: farm })
    });
    const data = await res.json();
    return data.farm;
  } catch (e) {
    console.warn('sbSaveFarm:', e);
    return null;
  }
}

async function sbLoadFarm() {
  if (!_userId) return null;
  try {
    const res = await fetch(API_BASE + '/api/farms?user_id=' + encodeURIComponent(_userId));
    const data = await res.json();
    return data.farm || null;
  } catch (e) {
    console.warn('sbLoadFarm:', e);
    return null;
  }
}

async function sbDeleteFarm() {
  if (!_userId) return;
  try {
    await fetch(API_BASE + '/api/farms', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: _userId })
    });
  } catch (e) {}
}

/* ---- activity logging ---- */
async function sbLog(kind, message, payload) {
  if (!_userId) return;
  try {
    await fetch(API_BASE + '/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: _userId, kind, message, payload })
    });
  } catch (e) {}
}

/* ---- session restore on load ---- */
(function _restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem('at3_session'));
    if (saved && saved.token) {
      _sessionToken = saved.token;
      _userId = saved.user_id;
      _userEmail = saved.email;
    }
  } catch (e) {}
})();
