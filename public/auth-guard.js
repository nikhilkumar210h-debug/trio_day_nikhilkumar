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

const PUBLIC_PAGES = new Set([
  'index.html',
  'login.html',
  '404.html',
  'sitemap.html',
  'offline.html',
  'privacy.html',
  'privacy-policy.html',
  'view_post.html',
  'all-users.html',
  'build.html',
  'learn.html',
  'challenge.html',
  'tasks.html',
  'task-create.html',
  'task-detail.html',
  'leaderboard.html',
  'admin-tasks.html',
  'chat.html',
  'private-chat.html',
  'rooms.html',
  'room.html',
  'activity.html',
  'create.html',
  'voice-status.html',
  'notifications.html',
  'profile.html',
  'search.html',
  'sitemap.html'
]);

onAuthStateChanged(auth, (user) => {
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isPublic = PUBLIC_PAGES.has(page);

  console.log('[auth-guard] page:', page, 'isPublic:', isPublic, 'user:', !!user);

  if (!user) {
    if (!isPublic) {
      const fullPage = (location.pathname.split("/").pop() || "index.html") + (location.search || "");
      console.log('[auth-guard] Redirecting to login:', fullPage);
      window.location.href = `login.html?redirect=${encodeURIComponent(fullPage)}`;
    }
    return;
  }
  const active = activeRoom();
  const roomId = new URLSearchParams(location.search).get("id");
  if (active && !(page === "room.html" && roomId === active.id)) {
    window.location.replace(active.url);
    return;
  }
  document.documentElement.classList.add("auth-ok");
});
