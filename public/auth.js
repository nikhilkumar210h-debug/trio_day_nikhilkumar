import { auth } from './firebase-auth.js';
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  onAuthStateChanged, sendPasswordResetEmail, signInWithCustomToken
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { makeUserId } from './utils.js';

const $ = id => document.getElementById(id);
const statusEl = $('authFormStatus');
const params = new URLSearchParams(location.search);
const requestedRedirect = params.get('redirect') || 'index.html';
const redirectTo = (() => {
  try {
    const url = new URL(requestedRedirect, location.href);
    return url.origin === location.origin ? (url.pathname.replace(/^\//, '') + url.search + url.hash) : 'index.html';
  } catch {
    return 'index.html';
  }
})();
const urlMode = params.get('mode');
const isResetMode = urlMode === 'reset';
let mode = 'login';
let loginMethod = 'email';

function status(text = '', error = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle('error', error);
}

function setBusy(busy, label = '') {
  const btn = $('emailSubmitBtn');
  if (!btn) return;
  btn.disabled = busy;
  btn.classList.toggle('is-busy', busy);
  if (busy) {
    btn.dataset.originalLabel = btn.textContent;
    btn.textContent = label || 'Please wait…';
  } else {
    btn.textContent = btn.dataset.originalLabel || (mode === 'signup' ? 'Create account' : 'Log in');
  }
}

async function saveUserProfile(user, chosenName = '') {
  const [{ collection, doc, setDoc, serverTimestamp, getDoc, getDocs, query, where, limit, deleteField }, { db }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'),
    import('./firebase-init.js')
  ]);
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref).catch(() => null);
  const old = snap?.exists() ? snap.data() : {};
  const name = chosenName.trim() || old.name || user.displayName || user.email?.split('@')[0] || 'User';
  // IMPORTANT: once a Trio UID exists, never replace it on login or profile updates.
  let permanentUid = old.userId || makeUserId(user.uid);
  if (!old.userId) {
    const existing = await getDocs(query(collection(db, 'users'), where('userId', '==', permanentUid), limit(1))).catch(() => ({ docs: [] }));
    if (existing.docs.some(d => d.id !== user.uid)) {
      permanentUid = makeUserId(user.uid, 1);
    }
  }

  await setDoc(doc(db, 'usersPrivate', user.uid), {
    email: user.email || null,
    updatedAt: serverTimestamp()
  }, { merge: true });

  await setDoc(ref, {
    uid: user.uid,
    userId: permanentUid,
    name,
    email: deleteField(),
    photoURL: old.photoURL || user.photoURL || null,
    bio: old.bio || '',
    emailHidden: Boolean(old.emailHidden),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function setLoginMethod(next) {
  loginMethod = next === 'uid' ? 'uid' : 'email';
  const emailTab = $('emailLoginTab');
  const uidTab = $('uidLoginTab');
  const emailField = $('emailField');
  const uidField = $('trioUidField');
  const forgot = $('forgotPasswordBtn');
  const emailInput = $('email');
  const uidInput = $('trioUid');

  emailTab?.classList.toggle('active', loginMethod === 'email');
  uidTab?.classList.toggle('active', loginMethod === 'uid');
  emailTab?.setAttribute('aria-selected', String(loginMethod === 'email'));
  uidTab?.setAttribute('aria-selected', String(loginMethod === 'uid'));
  if (emailField) emailField.hidden = loginMethod !== 'email';
  if (uidField) uidField.hidden = loginMethod !== 'uid';
  if (emailInput) emailInput.required = mode === 'login' && loginMethod === 'email' || mode === 'signup';
  if (uidInput) uidInput.required = mode === 'login' && loginMethod === 'uid';
  if (forgot) forgot.hidden = !(mode === 'login' && loginMethod === 'email');
  if (loginMethod === 'uid') uidInput?.focus();
  status('');
}

function setMode(next) {
  mode = next === 'signup' ? 'signup' : 'login';
  const loginTab = $('loginTab'), signupTab = $('signupTab'), nameField = $('nameField');
  const submit = $('emailSubmitBtn'), toggle = $('modeToggle'), note = $('uidNote');
  const title = $('authTitle'), subtitle = $('authSubtitle'), pwd = $('password');
  const forgot = $('forgotPasswordBtn'), methodBar = $('loginMethodBar');
  const strength = $('passwordStrength');

  loginTab?.classList.toggle('active', mode === 'login');
  signupTab?.classList.toggle('active', mode === 'signup');
  loginTab?.setAttribute('aria-selected', String(mode === 'login'));
  signupTab?.setAttribute('aria-selected', String(mode === 'signup'));
  if (nameField) nameField.hidden = mode !== 'signup';
  if (methodBar) methodBar.hidden = mode !== 'login';
  if (submit) submit.textContent = mode === 'signup' ? 'Create account' : 'Log in';
  if (toggle) toggle.innerHTML = mode === 'signup' ? 'Already have an account? <strong>Log in</strong>' : 'New here? <strong>Create account</strong>';
  if (note) note.classList.toggle('visible', mode === 'signup');
  if (title) title.textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
  if (subtitle) subtitle.textContent = mode === 'signup'
    ? 'Create once. Your permanent Trio UID is generated automatically.'
    : 'Use email or your permanent Trio UID to sign in.';
  if (pwd) pwd.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  if (forgot) forgot.hidden = !(mode === 'login' && loginMethod === 'email');
  if (strength) strength.hidden = mode !== 'signup';
  setLoginMethod(mode === 'signup' ? 'email' : loginMethod);
  status('');
}

async function handleGoogle() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  status('Opening Google sign-in…');
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserProfile(result.user);
    status('Signed in. Redirecting…');
  } catch (e) {
    if (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request') {
      try { status('Opening Google sign-in…'); await signInWithRedirect(auth, provider); } catch (err) { status(err.message || 'Google sign-in failed.', true); }
      return;
    }
    const msgs = {
      'auth/account-exists-with-different-credential': 'This email is already linked to another sign-in method.',
      'auth/network-request-failed': 'Network error. Check your connection.'
    };
    status(msgs[e.code] || e.message || 'Google sign-in failed.', true);
  }
}

async function loginWithTrioUid(trioUid, password) {
  // Firebase Callable is the primary UID-login path because it is part of the
  // same Firebase project as Auth. Render remains a resilience fallback.
  const [{ getFunctions, httpsCallable }, { app }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.0/firebase-functions.js'),
    import('./firebase-auth.js')
  ]);

  let firebaseError = null;
  try {
    const functions = getFunctions(app, 'us-central1');
    const callable = httpsCallable(functions, 'signInWithTrioUid');
    const result = await Promise.race([
      callable({ trioUid, password }),
      new Promise((_, reject) => setTimeout(() => {
        const error = new Error('UID login service timed out.');
        error.code = 'auth/api-timeout';
        reject(error);
      }, 8000))
    ]);
    const customToken = result?.data?.customToken;
    if (!customToken) throw new Error('UID login service returned an invalid response.');
    return signInWithCustomToken(auth, customToken);
  } catch (error) {
    firebaseError = error;
    if (error?.code === 'functions/unauthenticated') {
      const invalid = new Error('Invalid Trio UID or password.');
      invalid.code = 'auth/invalid-credential';
      throw invalid;
    }
  }

  const apiBase = window.TRIO_API_BASE_URL ||
    (location.hostname === '127.0.0.1' || location.hostname === 'localhost'
      ? 'http://127.0.0.1:5000'
      : 'https://trio-day-api.onrender.com');

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(apiBase + '/api/auth/trio-uid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trioUid, password }),
        signal: controller.signal
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || 'Unable to sign in with Trio UID.');
        error.code = response.status === 401 ? 'auth/invalid-credential' : 'auth/api-error';
        throw error;
      }
      if (!data.customToken) throw new Error('UID login service returned an invalid response.');
      return signInWithCustomToken(auth, data.customToken);
    } finally {
      clearTimeout(timer);
    }
  } catch (error) {
    if (error?.code === 'auth/invalid-credential') throw error;
    if (firebaseError?.code === 'auth/invalid-credential') throw firebaseError;
    const unavailable = new Error('Trio UID login service is temporarily unavailable. Try again in a moment.');
    unavailable.code = 'auth/api-error';
    throw unavailable;
  }
}

function updateStrength() {
  const input = $('password');
  const wrap = $('passwordStrength');
  const fill = $('passwordStrengthFill');
  const text = $('passwordStrengthText');
  if (!input || !wrap || !fill || !text) return;
  if (mode !== 'signup') return;
  const value = input.value || '';
  let score = 0;
  if (value.length >= 6) score++;
  if (value.length >= 10) score++;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score++;
  if (/\d/.test(value)) score++;
  if (/[^A-Za-z0-9]/.test(value)) score++;
  const widths = [0, 22, 42, 62, 82, 100];
  const labels = ['Use 6+ characters.', 'A little short.', 'Getting there.', 'Good password.', 'Strong password.', 'Very strong password.'];
  fill.style.width = widths[score] + '%';
  text.textContent = labels[score];
}

$('googleBtn')?.addEventListener('click', handleGoogle);
$('loginTab')?.addEventListener('click', () => setMode('login'));
$('signupTab')?.addEventListener('click', () => setMode('signup'));
$('modeToggle')?.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));
$('emailLoginTab')?.addEventListener('click', () => setLoginMethod('email'));
$('uidLoginTab')?.addEventListener('click', () => setLoginMethod('uid'));

$('passwordToggle')?.addEventListener('click', () => {
  const input = $('password');
  const btn = $('passwordToggle');
  if (!input || !btn) return;
  const visible = input.type === 'text';
  input.type = visible ? 'password' : 'text';
  btn.textContent = visible ? 'Show' : 'Hide';
  btn.setAttribute('aria-label', visible ? 'Show password' : 'Hide password');
});

$('password')?.addEventListener('input', updateStrength);
$('trioUid')?.addEventListener('input', e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 13);
});

$('forgotPasswordBtn')?.addEventListener('click', async () => {
  const email = $('email')?.value.trim();
  if (!email) return status('Enter your email first.', true);
  try {
    await sendPasswordResetEmail(auth, email);
    status('Reset link sent. Check your email.');
  } catch (err) {
    status(err.message || 'Could not send reset link.', true);
  }
});

$('emailForm')?.addEventListener('submit', async event => {
  event.preventDefault();
  if (isResetMode) {
    const email = $('email')?.value.trim();
    if (!email) return status('Enter your email first.', true);
    try { await sendPasswordResetEmail(auth, email); status('Reset link sent. Check your email.'); }
    catch (err) { status(err.message || 'Could not send reset link.', true); }
    return;
  }

  const email = $('email')?.value.trim();
  const trioUid = $('trioUid')?.value.trim().toUpperCase();
  const password = $('password')?.value || '';
  const name = $('fullName')?.value.trim() || '';

  if (mode === 'signup') {
    if (!name) return status('Enter your name.', true);
    if (!email || !password) return status('Email and password are required.', true);
    if (password.length < 6) return status('Password must be at least 6 characters.', true);
  } else if (loginMethod === 'uid') {
    if (!/^TRIO-[A-Z0-9]{8}$/.test(trioUid)) return status('Enter a valid Trio UID like TRIO-AB12CD34.', true);
    if (!password) return status('Enter your password.', true);
  } else if (!email || !password) {
    return status('Email and password are required.', true);
  }

  setBusy(true, mode === 'signup' ? 'Creating…' : 'Signing in…');
  try {
    let signedInUser;
    if (mode === 'signup') {
      const c = await createUserWithEmailAndPassword(auth, email, password);
      signedInUser = c.user;
      if (name) await updateProfile(c.user, { displayName: name });
    } else if (loginMethod === 'uid') {
      const c = await loginWithTrioUid(trioUid, password);
      signedInUser = c.user;
    } else {
      const c = await signInWithEmailAndPassword(auth, email, password);
      signedInUser = c.user;
    }

    // Authentication success must never be held hostage by a secondary
    // profile-sync write. The auth listener will redirect after sign-in.
    try {
      await saveUserProfile(signedInUser, mode === 'signup' ? name : '');
    } catch (profileError) {
      console.warn('[Auth] profile sync failed after successful sign-in:', profileError);
    }
    status('Success. Redirecting…');
  } catch (e) {
    const m = {
      'auth/email-already-in-use': 'Email already registered.',
      'auth/invalid-email': 'Enter a valid email.',
      'auth/weak-password': 'Password is too weak.',
      'auth/user-not-found': 'No account found for this email.',
      'auth/wrong-password': 'Incorrect password.',
      'auth/invalid-credential': 'Email or password is incorrect.'
    };
    const message = e?.message || '';
    const safe = e?.code === 'functions/unauthenticated' || /invalid trio uid or password/i.test(message)
      ? 'Invalid Trio UID or password.'
      : (m[e.code] || message || 'Something went wrong.');
    status(safe, true);
  } finally {
    setBusy(false);
  }
});

let redirectProfileReady = Promise.resolve();
redirectProfileReady = getRedirectResult(auth)
  .then(async result => {
    if (result?.user) {
      await saveUserProfile(result.user);
      status('Signed in. Redirecting…');
    }
  })
  .catch(e => {
    if (e.code && e.code !== 'auth/no-auth-event') status(e.message || 'Google sign-in failed.', true);
  });

onAuthStateChanged(auth, async user => {
  if (user) {
    await redirectProfileReady;
    location.href = redirectTo;
  } else {
    setMode(isResetMode ? 'login' : 'login');
  }
});

if (isResetMode) {
  const google = $('googleBtn'), tabs = document.querySelector('.mode-tabs'), toggle = $('modeToggle');
  const submit = $('emailSubmitBtn'), pwd = $('password'), title = $('authTitle'), subtitle = $('authSubtitle'), forgot = $('forgotPasswordBtn'), note = $('uidNote'), methodBar = $('loginMethodBar');
  if (google) google.hidden = true;
  if (tabs) tabs.hidden = true;
  if (toggle) toggle.hidden = true;
  if (methodBar) methodBar.hidden = true;
  if (pwd) { pwd.hidden = true; pwd.required = false; }
  if ($('trioUidField')) $('trioUidField').hidden = true;
  if (forgot) forgot.hidden = true;
  if (note) note.classList.remove('visible');
  if (submit) submit.textContent = 'Send reset link';
  if (title) title.textContent = 'Reset password';
  if (subtitle) subtitle.textContent = 'Enter your email to receive a password reset link.';
}
