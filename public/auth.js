import { auth } from './firebase-auth.js';
import {
  GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  onAuthStateChanged, sendPasswordResetEmail
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { makeUserId } from './utils.js';

const $ = id => document.getElementById(id);
const statusEl = $('authFormStatus');
const params = new URLSearchParams(location.search);
const redirectTo = params.get('redirect') || 'index.html';
const urlMode = params.get('mode');
const isResetMode = urlMode === 'reset';
let mode = 'login';

function status(text = '', error = false) {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle('error', error);
}

async function saveUserProfile(user, chosenName = '') {
  const [{ doc, setDoc, serverTimestamp, getDoc, deleteField }, { db }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'),
    import('./firebase-init.js')
  ]);
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref).catch(() => null);
  const old = snap?.exists() ? snap.data() : {};
  const name = chosenName.trim() || old.name || user.displayName || user.email?.split('@')[0] || 'User';
  const permanentUid = old.userId || makeUserId(user.uid);

  await setDoc(doc(db, 'usersPrivate', user.uid), {
    email: user.email || null,
    updatedAt: serverTimestamp()
  }, { merge: true });

  // userId is a legacy field name retained for database compatibility.
  // It is created once from the Firebase Auth UID and never changed afterwards.
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

function setMode(next) {
  mode = next === 'signup' ? 'signup' : 'login';
  const loginTab = $('loginTab'), signupTab = $('signupTab'), nameField = $('nameField');
  const submit = $('emailSubmitBtn'), toggle = $('modeToggle'), note = $('uidNote');
  const title = $('authTitle'), subtitle = $('authSubtitle'), pwd = $('password');
  const forgot = $('forgotPasswordBtn');

  loginTab?.classList.toggle('active', mode === 'login');
  signupTab?.classList.toggle('active', mode === 'signup');
  loginTab?.setAttribute('aria-selected', String(mode === 'login'));
  signupTab?.setAttribute('aria-selected', String(mode === 'signup'));
  if (nameField) nameField.hidden = mode !== 'signup';
  if (submit) submit.textContent = mode === 'signup' ? 'Create account' : 'Log in';
  if (toggle) toggle.innerHTML = mode === 'signup' ? 'Already have an account? <strong>Log in</strong>' : 'New here? <strong>Create account</strong>';
  if (note) note.classList.toggle('visible', mode === 'signup');
  if (title) title.textContent = mode === 'signup' ? 'Create your account' : 'Welcome back';
  if (subtitle) subtitle.textContent = mode === 'signup' ? 'Your permanent UID will be created automatically.' : 'Sign in to continue where you left off.';
  if (pwd) pwd.autocomplete = mode === 'signup' ? 'new-password' : 'current-password';
  if (forgot) forgot.hidden = mode === 'signup';
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

$('googleBtn')?.addEventListener('click', handleGoogle);
$('loginTab')?.addEventListener('click', () => setMode('login'));
$('signupTab')?.addEventListener('click', () => setMode('signup'));
$('modeToggle')?.addEventListener('click', () => setMode(mode === 'login' ? 'signup' : 'login'));

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
  const password = $('password')?.value || '';
  const name = $('fullName')?.value.trim() || '';
  if (!email || !password) return status('Email and password are required.', true);
  if (mode === 'signup' && !name) return status('Enter your name.', true);
  if (mode === 'signup' && password.length < 6) return status('Password must be at least 6 characters.', true);

  const btn = $('emailSubmitBtn');
  if (btn) btn.disabled = true;
  try {
    if (mode === 'signup') {
      const c = await createUserWithEmailAndPassword(auth, email, password);
      if (name) await updateProfile(c.user, { displayName: name });
      await saveUserProfile(c.user, name);
    } else {
      const c = await signInWithEmailAndPassword(auth, email, password);
      await saveUserProfile(c.user);
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
    status(m[e.code] || e.message || 'Something went wrong.', true);
  } finally {
    if (btn) btn.disabled = false;
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
  const submit = $('emailSubmitBtn'), pwd = $('password'), title = $('authTitle'), subtitle = $('authSubtitle'), forgot = $('forgotPasswordBtn'), note = $('uidNote');
  if (google) google.hidden = true;
  if (tabs) tabs.hidden = true;
  if (toggle) toggle.hidden = true;
  if (pwd) { pwd.hidden = true; pwd.required = false; }
  if (forgot) forgot.hidden = true;
  if (note) note.classList.remove('visible');
  if (submit) submit.textContent = 'Send reset link';
  if (title) title.textContent = 'Reset password';
  if (subtitle) subtitle.textContent = 'Enter your email to receive a password reset link.';
}
