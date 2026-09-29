const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const crypto = require('crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// Firebase Web API keys are public application identifiers, not server secrets.
// Keeping this here lets the callable verify an email/password without exposing
// the account email associated with a Trio UID to the browser.
const FIREBASE_WEB_API_KEY = 'AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA';

const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const LOGIN_RATE_LIMIT_MAX = 5;

function rateLimitDocId(trioUid) {
  return crypto.createHash('sha256').update(trioUid).digest('hex').slice(0, 32);
}

async function checkTrioLoginRateLimit(trioUid) {
  const ref = db.collection('authRateLimits').doc(rateLimitDocId(trioUid));
  const now = Date.now();
  let blockedUntil = 0;

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.exists ? snap.data() : {};
    const windowStartedAt = Number(data.windowStartedAtMs || now);
    const withinWindow = now - windowStartedAt < LOGIN_RATE_LIMIT_WINDOW_MS;
    const attempts = withinWindow ? Number(data.attempts || 0) : 0;
    const nextWindowStart = withinWindow ? windowStartedAt : now;

    if (attempts >= LOGIN_RATE_LIMIT_MAX) {
      blockedUntil = nextWindowStart + LOGIN_RATE_LIMIT_WINDOW_MS;
      return;
    }

    tx.set(ref, {
      attempts: attempts + 1,
      windowStartedAtMs: nextWindowStart,
      updatedAt: Timestamp.fromMillis(now)
    }, { merge: true });
  });

  if (blockedUntil > now) {
    const retryAfterSeconds = Math.max(1, Math.ceil((blockedUntil - now) / 1000));
    throw new HttpsError('resource-exhausted', 'Too many Trio UID login attempts. Try again later.', { retryAfterSeconds });
  }
}

async function clearTrioLoginRateLimit(trioUid) {
  const ref = db.collection('authRateLimits').doc(rateLimitDocId(trioUid));
  await ref.set({ attempts: 0, windowStartedAtMs: Date.now(), updatedAt: Timestamp.now() }, { merge: true });
}

function normaliseTrioUid(value) {
  return String(value || '').trim().toUpperCase();
}

exports.signInWithTrioUid = onCall(async (request) => {
  const trioUid = normaliseTrioUid(request.data?.trioUid);
  const password = String(request.data?.password || '');

  if (!/^TRIO-[A-Z0-9]{8}$/.test(trioUid) || password.length < 1) {
    throw new HttpsError('unauthenticated', 'Invalid Trio UID or password.');
  }

  await checkTrioLoginRateLimit(trioUid);

  try {
    const snap = await db.collection('users')
      .where('userId', '==', trioUid)
      .limit(2)
      .get();

    // A public Trio UID must map to exactly one Firebase account.
    // Reject ambiguous legacy data instead of signing into an arbitrary account.
    if (snap.docs.length !== 1) {
      throw new HttpsError('unauthenticated', 'Invalid Trio UID or password.');
    }

    const uid = snap.docs[0].id;
    const authUser = await admin.auth().getUser(uid);
    const email = authUser.email;

    // Google-only accounts do not have an email/password credential.
    if (!email) {
      throw new HttpsError('unauthenticated', 'This account uses Google sign-in. Use Continue with Google.');
    }

    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true })
      }
    );

    if (!response.ok) {
      throw new HttpsError('unauthenticated', 'Invalid Trio UID or password.');
    }

    await clearTrioLoginRateLimit(trioUid);

    const customToken = await admin.auth().createCustomToken(uid, {
      trioLogin: true,
      trioUid
    });

    return { customToken };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[signInWithTrioUid]', error);
    throw new HttpsError('internal', 'Unable to sign in with Trio UID right now.');
  }
});
