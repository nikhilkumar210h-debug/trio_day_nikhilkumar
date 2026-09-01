import { db } from "./firebase-init.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { ONESIGNAL_APP_ID, siteBasePath } from "./onesignal-config.js";

let sdkLoadPromise = null;
let initPromise = null;

function loadSdk() {
  if (sdkLoadPromise) return sdkLoadPromise;
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  const existing = document.querySelector('script[src*="OneSignalSDK.page.js"]');
  if (existing) {
    sdkLoadPromise = Promise.resolve();
    return sdkLoadPromise;
  }
  sdkLoadPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js";
    s.defer = true;
    s.onload = () => resolve(true);
    s.onerror = () => {
      console.warn('[OneSignal] SDK blocked or unavailable — push notifications disabled.');
      resolve(false); // resolve false so callers can check, never reject
    };
    document.head.appendChild(s);
  });
  return sdkLoadPromise;
}

function withOneSignal(fn) {
  return new Promise((resolve, reject) => {
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async (OneSignal) => {
      try {
        resolve(await fn(OneSignal));
      } catch (err) {
        reject(err);
      }
    });
  });
}

function ensureInit() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const sdkLoaded = await loadSdk();
    if (!sdkLoaded) return null; // SDK blocked — skip init silently
    return withOneSignal(async (OneSignal) => {
      const base = siteBasePath().replace(/^\//, "");
      await OneSignal.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerPath: `${base}push/onesignal/OneSignalSDKWorker.js`,
        serviceWorkerParam: { scope: `/${base}push/onesignal/` }
      });
      // Prefer in-app toasts while the tab is open (auth-ui Firestore listener).
      OneSignal.Notifications.addEventListener("foregroundWillDisplay", (event) => {
        if (document.visibilityState === "visible") {
          try { event.preventDefault(); } catch (_) { /* older SDK */ }
        }
      });
      return OneSignal;
    });
  })();
  return initPromise;
}

async function waitForSubscriptionId(OneSignal, timeoutMs = 8000) {
  const current = OneSignal.User?.PushSubscription?.id;
  if (current) return current;

  return new Promise((resolve) => {
    let done = false;
    const finish = (id) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        OneSignal.User.PushSubscription.removeEventListener("change", onChange);
      } catch (_) { /* ignore */ }
      resolve(id || null);
    };
    const onChange = (event) => {
      const id = event?.current?.id || OneSignal.User?.PushSubscription?.id;
      if (id) finish(id);
    };
    const timer = setTimeout(() => finish(OneSignal.User?.PushSubscription?.id || null), timeoutMs);
    OneSignal.User.PushSubscription.addEventListener("change", onChange);
    const now = OneSignal.User?.PushSubscription?.id;
    if (now) finish(now);
  });
}

export async function saveOneSignalId(uid, oneSignalId) {
  if (!uid || !oneSignalId) return;
  await setDoc(
    doc(db, "users", uid),
    { oneSignalId, oneSignalIdUpdatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** Init SDK, ask permission, link Firebase uid, save subscription id. */
export async function enableOneSignalPush(user) {
  if (!user?.uid || !("Notification" in window)) return null;

  const OneSignal = await ensureInit();
  if (!OneSignal) {
    console.warn('[OneSignal] Push notifications unavailable (SDK not loaded).');
    return null;
  }

  try {
    await OneSignal.login(user.uid);
  } catch (err) {
    console.warn("OneSignal.login failed", err);
  }

  const native = OneSignal.Notifications?.permissionNative || Notification.permission;
  if (native === "default" || native === "prompt") {
    await OneSignal.Notifications.requestPermission();
  }

  const granted =
    OneSignal.Notifications?.permission === true ||
    Notification.permission === "granted";
  if (!granted) return null;

  const subscriptionId = await waitForSubscriptionId(OneSignal);
  if (!subscriptionId) return null;

  await saveOneSignalId(user.uid, subscriptionId);
  return subscriptionId;
}
