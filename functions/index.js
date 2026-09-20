const { getFirestore } = require('firebase-admin/firestore');
const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = getFirestore();

// Firebase Web API keys are public application identifiers, not server secrets.
// Keeping this here lets the callable verify an email/password without exposing
// the account email associated with a Trio UID to the browser.
const FIREBASE_WEB_API_KEY = 'AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA';

function normaliseTrioUid(value) {
  return String(value || '').trim().toUpperCase();
}

exports.signInWithTrioUid = onCall(async (request) => {
  const trioUid = normaliseTrioUid(request.data?.trioUid);
  const password = String(request.data?.password || '');

  if (!/^TRIO-[A-Z0-9]{8}$/.test(trioUid) || password.length < 1) {
    throw new HttpsError('unauthenticated', 'Invalid Trio UID or password.');
  }

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
