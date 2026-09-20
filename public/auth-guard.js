// Gates pages behind login. Include before page scripts.
import { auth } from "./firebase-init.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";

const ACTIVE_ROOM_KEY = "trio_active_room_v1";
function activeRoom() {
  try {
    const value = JSON.parse(sessionStorage.getItem(ACTIVE_ROOM_KEY) || "null");
    if (!value?.id || !value?.url) return null;
    if (Number(value.expiresAtMs || 0) && Number(value.expiresAtMs) <= Date.now()) {
      sessionStorage.removeItem(ACTIVE_ROOM_KEY);
      return null;
    }
    return value;
  } catch { return null; }
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    const page = (location.pathname.split("/").pop() || "index.html") + (location.search || "");
    window.location.href = `login.html?redirect=${encodeURIComponent(page)}`;
    return;
  }
  const active = activeRoom();
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const roomId = new URLSearchParams(location.search).get("id");
  if (active && !(page === "room.html" && roomId === active.id)) {
    window.location.replace(active.url);
    return;
  }
  document.documentElement.classList.add("auth-ok");
});
