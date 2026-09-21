import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, query, where, limit, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { listCommunityTasks } from './gamification/community-tasks.js';
import { activeCatalogActivities } from './activity-catalog.js?v=20260920-audit2';
import { activityCardHtml, roomCardHtml, ACTIVITY_TYPES, normalizeActivityType } from './activity-ui.js';

const $ = id => document.getElementById(id);
const laneOrder = ['build', 'learn', 'challenge', 'puzzle'];
const params = new URLSearchParams(location.search);
let allActivities = [], activeType = laneOrder.includes(params.get('activity')) ? params.get('activity') : 'all', search = '';

function renderFilters() {
  const host = $('discoverTypeFilters');
  if (!host) return;
  host.innerHTML = '<button type="button" class="discover-filter ' + (activeType === 'all' ? 'active' : '') + '" data-type="all">Everything</button>' +
    laneOrder.map(type => '<button type="button" class="discover-filter ' + (activeType === type ? 'active' : '') + '" data-type="' + type + '">' + ACTIVITY_TYPES[type].icon + ' ' + ACTIVITY_TYPES[type].label + '</button>').join('');
  host.querySelectorAll('.discover-filter').forEach(btn => btn.onclick = () => { activeType = btn.dataset.type; renderFilters(); renderActivities() });
}
function renderActivities() {
  const host = $('discoverActivityList'); if (!host) return;
  const q = search.toLowerCase();
  const filtered = allActivities.filter(a => { const type = normalizeActivityType(a); const haystack = [a.title, a.description, a.category, a.creatorName].filter(Boolean).join(' ').toLowerCase(); return (activeType === 'all' || type === activeType) && (!q || haystack.includes(q)) });
  $('discoverActivityStatus').textContent = filtered.length ? filtered.length + ' activities ready' : 'No activities match this filter.';
  host.innerHTML = filtered.length ? filtered.map(a => activityCardHtml({ ...a, activityType: normalizeActivityType(a) })).join('') : '<div class="discover-empty">Try another lane or clear the search.</div>';
}
async function loadActivities() {
  const community = await listCommunityTasks({ status: 'active', max: 40 });
  const built = activeCatalogActivities();
  allActivities = [...community.filter(t => !t.hidden).map(t => ({ ...t, source: 'community', activityType: normalizeActivityType(t) })), ...built];
  renderFilters(); renderActivities();
}
function renderRooms(snapshot) {
  const host = $('discoverRoomList'); if (!host) return;
  const now = Date.now();
  const rows = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => (Number(r.expiresAtMs) || now + 21600000) > now).sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0)).slice(0, 8);
  host.innerHTML = rows.length ? rows.map(roomCardHtml).join('') : '<div class="discover-empty">No live rooms right now. Open any activity to start one.</div>';
}

// Discover is public, but live rooms require an authenticated Firestore session.
// Do not read auth.currentUser only once: Firebase may still be restoring the
// persisted session when this module first executes.
let roomsUnsubscribe = null;
function initRoomListener(user) {
  if (roomsUnsubscribe) {
    roomsUnsubscribe();
    roomsUnsubscribe = null;
  }

  const host = $('discoverRoomList');
  if (!user) {
    if (host) host.innerHTML = '<div class="discover-empty">Sign in to see live rooms.</div>';
    return;
  }

  const roomsQuery = query(collection(db, 'rooms'), where('status', '==', 'open'), limit(24));
  roomsUnsubscribe = onSnapshot(
    roomsQuery,
    renderRooms,
    () => {
      if (host) host.innerHTML = '<div class="discover-empty">Live rooms are temporarily unavailable.</div>';
    }
  );
}

onAuthStateChanged(auth, initRoomListener);

// Load catalog + community activities for everyone
loadActivities();

$('discoverSearch')?.addEventListener('input', e => { search = e.target.value.trim(); renderActivities() });