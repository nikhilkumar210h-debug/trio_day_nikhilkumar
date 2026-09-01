// Single source for Firebase config — reuse-first Phase 0.
// Both firebase-init.js (full) and firebase-auth.js (light) import from here
// to avoid duplicate literals and drift on key rotation.
export const firebaseConfig = {
  apiKey: "AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA",
  authDomain: "nkm-ind.firebaseapp.com",
  projectId: "nkm-ind",
  storageBucket: "nkm-ind.firebasestorage.app",
  messagingSenderId: "180091505382",
  appId: "1:180091505382:web:b16a35ddaa3dea38fd4927",
  measurementId: "G-208ZD5YZL9"
};
