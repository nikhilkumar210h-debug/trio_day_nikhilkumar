import { auth, db } from './firebase-init.js';
import { collection, query, where, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { ACTIVITY_TYPES, activityCardHtml, normalizeActivityType } from './activity-ui.js';
import { activeCatalogActivities } from './activity-catalog.js?v=20260920-audit2';

const $ = id => document.getElementById(id);
const type = document.body.dataset.forgeLane || 'puzzle';
let activeSub = 'all', activities = [];
const copy = {
  puzzle: { title: 'Solve something.', sub: 'Logic, riddles and patterns.', verb: 'Crack' },
  build: { title: 'Build something.', sub: 'Arrange, connect and make it work.', verb: 'Build' },
  learn: { title: 'Learn something.', sub: 'Small lessons with one clear takeaway.', verb: 'Learn' },
  challenge: { title: 'Challenge yourself.', sub: 'Fast rounds and clear goals.', verb: 'Enter' },
  game: { title: 'Play together.', sub: 'Quick games made for rooms and turns.', verb: 'Play' }
};
function typeOf(t) { return normalizeActivityType(t) }
function renderHero() { const c = copy[type]; const i = ACTIVITY_TYPES[type]; $('forgeKicker').textContent = 'FORGE · ' + i.label.toUpperCase(); $('forgeTitle').textContent = c.title; $('forgeSub').textContent = c.sub; $('forgeEmblem').textContent = i.icon; $('forgeCount').textContent = activities.length + ' ready'; $('forgeMode').textContent = type === 'build' ? 'No-code builds' : '15–45 min sessions' }
function renderFilters() { const subs = [...new Set(activities.map(a => a.category).filter(Boolean))].sort(); $('forgeFilters').innerHTML = '<button class="forge-filter ' + (activeSub === 'all' ? 'active' : '') + '" data-sub="all">Everything</button>' + subs.map(s => '<button class="forge-filter ' + (activeSub === s ? 'active' : '') + '" data-sub="' + s.replace(/"/g, '"') + '">' + s + '</button>').join(''); document.querySelectorAll('[data-sub]').forEach(b => b.onclick = () => { activeSub = b.dataset.sub; renderFilters(); renderList() }) }
function renderList() { const list = activities.filter(a => activeSub === 'all' || String(a.category || '') === activeSub); $('forgeList').innerHTML = list.length ? list.map(a => activityCardHtml({ ...a, activityType: typeOf(a) })).join('') : '<div class="forge-empty">Nothing here yet. Try another category or create the next activity.</div>' }
async function load() {
  try {
    const built = activeCatalogActivities().filter(a => a.type === type).map(a => ({ ...a, activityType: type }));
    const snap = await getDocs(query(collection(db, 'communityTasks'), where('status', '==', 'active'), limit(60))).catch(() => null);
    const community = snap ? snap.docs.map(d => ({ id: d.id, ...d.data(), source: 'community' })).filter(a => normalizeActivityType(a) === type && (!a.hidden) && (!a.endAtMs || a.endAtMs > Date.now())).map(a => ({ ...a, activityType: type })) : [];
    activities = [...built, ...community];
    renderHero(); renderFilters(); renderList();
  } catch (e) { $('forgeStatus').textContent = e.message || 'Could not load Forge.' }
}
$('forgeSearch')?.addEventListener('input', () => { const q = $('forgeSearch').value.toLowerCase().trim(); document.querySelectorAll('.activity-card').forEach(c => c.style.display = !q || c.textContent.toLowerCase().includes(q) ? '' : 'none') });

// Forge lanes are PUBLIC pages — load for ALL users (catalog + community data)
load();