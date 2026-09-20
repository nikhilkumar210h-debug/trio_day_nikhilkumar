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

// Pages that are PUBLICLY ACCESSIBLE without authentication.
// Protected pages (chat, rooms, room, activity, profile, notifications, create, private-chat, voice-status) must NOT be here.
const PUBLIC_PAGES = new Set([
  'index.html',
  'login.html',
  '404.html',
  'sitemap.html',
  'offline.html',
  'privacy.html',
  'privacy-policy.html',
  'view_post.html',
  'all-users.html',    // Discover
  'build.html',        // Forge Build lane
  'learn.html',        // Forge Learn lane
  'challenge.html',    // Forge Challenge lane
  'puzzle.html',       // Forge Puzzle lane (if exists)
  'tasks.html',        // Do page
  'task-create.html',  // Create activity (public entry, but requires auth for actual creation)
  'task-detail.html',  // Community task detail
  'leaderboard.html',
  'admin-tasks.html',
  'voice-status.html',
  'search.html',
]);

// Room and activity pages that need special handling - they redirect to login if no auth,
// but if user has an active room, they should stay in it
const ROOM_ACTIVITY_PAGES = new Set([
  'room.html',
  'activity.html',
  'rooms.html',
]);

onAuthStateChanged(auth, (user) => {
  const page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  const isPublic = PUBLIC_PAGES.has(page);
  const isRoomActivity = ROOM_ACTIVITY_PAGES.has(page);

  if (!user) {
    if (!isPublic) {
      const fullPage = (location.pathname.split("/").pop() || "index.html") + (location.search || "");
      window.location.href = `login.html?redirect=${encodeURIComponent(fullPage)}`;
    }
    return;
  }

  // For room/activity pages, let the page-specific logic handle active room routing
  // to avoid race conditions between auth-guard and page load
  if (isRoomActivity) {
    document.documentElement.classList.add("auth-ok");
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
