// Shared Firebase initialization - Auth + Firestore (full, for app pages).
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDyuycRTSAaGSEiCPEXXf36sxhyDVPQLTA",
  authDomain: "nkm-ind.firebaseapp.com",
  projectId: "nkm-ind",
  storageBucket: "nkm-ind.firebasestorage.app",
  messagingSenderId: "180091505382",
  appId: "1:180091505382:web:b16a35ddaa3dea38fd4927",
  measurementId: "G-208ZD5YZL9"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
