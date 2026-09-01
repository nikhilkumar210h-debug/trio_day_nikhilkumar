import { auth } from './firebase-auth.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { makeUserId } from './utils.js';

const $ = id => document.getElementById(id);
const statusEl = $('authFormStatus');
const params = new URLSearchParams(location.search);
const redirectTo = params.get('redirect') || 'index.html';

function status(t = '', err = false) {
  if (!statusEl) return;
  statusEl.textContent = t;
  statusEl.classList.toggle('error', err);
}

async function saveUserProfile(user, chosenName = '') {
  const [{ doc, setDoc, serverTimestamp, getDoc }, { db }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js'),
    import('./firebase-init.js')
  ]);
  const ref = doc(db, 'users', user.uid);
  const snap = await getDoc(ref).catch(() => null);
  const old = snap?.exists() ? snap.data() : {};
  const name = chosenName.trim() || old.name || user.displayName || user.email?.split('@')[0] || 'User';
  await setDoc(ref, {
    uid: user.uid,
    userId: old.userId || makeUserId(user.uid),
    name,
    email: user.email || null,
    photoURL: old.photoURL || user.photoURL || null,
    bio: old.bio || '',
    emailHidden: Boolean(old.emailHidden),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

getRedirectResult(auth)
  .then(async result => {
    if (result?.user) {
      status('Google se sign in ho raha hai…');
      await saveUserProfile(result.user);
      status('Signed in!');
    }
  })
  .catch(e => {
    console.error('Redirect result error:', e);
    if (e.code && e.code !== 'auth/no-auth-event') {
      const msgs = {
        'auth/account-exists-with-different-credential': 'Yeh email doosre provider se pehle se registered hai.',
        'auth/popup-closed-by-user': ''
      };
      status(msgs[e.code] ?? (e.message || 'Google sign-in fail ho gaya.'), true);
    }
  });

onAuthStateChanged(auth, u => { if (u) location.href = redirectTo; });

const googleBtn = $('googleBtn');
if (googleBtn) {
  googleBtn.addEventListener('click', async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    status('Google sign-in khul raha hai…');
    try {
      const result = await signInWithPopup(auth, provider);
      await saveUserProfile(result.user);
      status('Signed in!');
    } catch (e) {
      console.warn('Popup failed, trying redirect:', e.code);
      if (e.code === 'auth/popup-blocked' || e.code === 'auth/popup-closed-by-user' || e.code === 'auth/cancelled-popup-request') {
        status('Google page pe redirect ho raha hai…');
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr) {
          console.error('Redirect also failed:', redirectErr);
          status(redirectErr.message || 'Sign-in fail ho gaya.', true);
        }
      } else {
        const msgs = {
          'auth/account-exists-with-different-credential': 'Yeh email doosre provider se pehle se registered hai.',
          'auth/network-request-failed': 'Network error. Internet connection check karo.'
        };
        status(msgs[e.code] ?? (e.message || 'Google sign-in fail ho gaya.'), true);
      }
    }
  });
}

let mode = 'login';
const modeToggle = $('modeToggle');
if (modeToggle) {
  modeToggle.addEventListener('click', () => {
    mode = mode === 'login' ? 'signup' : 'login';
    const submitBtn = $('emailSubmitBtn');
    const nameField = $('nameField');
    const pwd = $('password');
    if (submitBtn) submitBtn.textContent = mode === 'login' ? 'Login' : 'Sign up';
    modeToggle.textContent = mode === 'login' ? 'New here? Create account' : 'Already have an account? Login';
    if (nameField) nameField.hidden = mode !== 'signup';
    if (pwd) pwd.autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    status('');
  });
}

const emailForm = $('emailForm');
if (emailForm) {
  emailForm.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('email').value.trim();
    const password = $('password').value;
    const name = $('fullName').value.trim();
    if (!email || !password) return status('Email aur password dono chahiye.', true);
    if (mode === 'signup' && password.length < 6) return status('Password kam se kam 6 characters ka hona chahiye.', true);
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
      status('Success! Redirecting…');
    } catch (e) {
      console.error(e);
      const m = {
        'auth/email-already-in-use': 'Email already registered.',
        'auth/invalid-email': 'Email sahi format me daalo.',
        'auth/weak-password': 'Password kam se kam 6 characters ka rakho.',
        'auth/user-not-found': 'User nahi mila.',
        'auth/wrong-password': 'Password galat hai.',
        'auth/invalid-credential': 'Email ya password galat hai.'
      };
      status(m[e.code] || e.message || 'Kuch galat ho gaya.', true);
    } finally {
      const btn2 = $('emailSubmitBtn');
      if (btn2) btn2.disabled = false;
    }
  });
}
