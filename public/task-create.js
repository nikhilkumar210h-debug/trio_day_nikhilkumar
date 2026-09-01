import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, doc, getDoc, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { listActiveTemplates, createTemplate, isAdmin } from './gamification/templates.js';
import { createCommunityTask } from './gamification/community-tasks.js';

const $ = id => document.getElementById(id);
let me = null;
let profile = null;
let selected = null;
let admin = false;

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ── Toast notification ────────────────────────────────────────────────────────
function showToast(message, type = 'success') {
  document.getElementById('trioToast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'trioToast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.style.cssText = `
    position: fixed;
    bottom: calc(env(safe-area-inset-bottom, 0px) + 5rem);
    left: 50%;
    transform: translateX(-50%);
    background: ${type === 'error' ? '#c0392b' : type === 'warn' ? '#d4821a' : '#138843'};
    color: #fff;
    padding: 0.75rem 1.35rem;
    border-radius: 2rem;
    font-size: 0.95rem;
    font-weight: 600;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    z-index: 9999;
    white-space: nowrap;
    max-width: calc(100vw - 2rem);
    text-align: center;
    animation: trioToastIn 0.25s ease;
  `;
  toast.textContent = message;
  if (!document.getElementById('trioToastStyle')) {
    const style = document.createElement('style');
    style.id = 'trioToastStyle';
    style.textContent = '@keyframes trioToastIn { from { opacity:0; transform:translateX(-50%) translateY(12px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }';
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  const dur = type === 'error' || type === 'warn' ? 5000 : 2800;
  setTimeout(() => toast?.remove(), dur);
}

// ── Duplicate check ───────────────────────────────────────────────────────────
async function checkDuplicate(title) {
  if (!title) return false;
  try {
    const q = query(
      collection(db, 'communityTasks'),
      where('status', '==', 'active'),
      where('title', '==', title.trim()),
      limit(1)
    );
    const snap = await getDocs(q);
    return !snap.empty;
  } catch (_) {
    return false;
  }
}

// ── Template picker ───────────────────────────────────────────────────────────
function fillFromTemplate(t) {
  selected = t;
  $('title').value = t.title || '';
  $('description').value = t.description || '';
  $('icon').value = t.icon || '🏁';
  $('metric').value = t.metric || 'manual';
  $('target').value = t.target || 1;
  $('xpReward').value = t.xpReward || 50;
  document.querySelectorAll('.template-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.id === t.id);
  });
}

async function loadTemplates() {
  const list = await listActiveTemplates();
  const box = $('templatePicker');
  box.innerHTML = list.map(t =>
    `<button type="button" class="template-option" data-id="${esc(t.id)}">
      <strong>${esc(t.icon || '✅')} ${esc(t.title)}</strong>
      <div style="font-size:0.75rem;opacity:0.7">${esc(t.cadence)} · target ${esc(t.target)} · +${esc(t.xpReward)} XP</div>
    </button>`
  ).join('');
  box.querySelectorAll('.template-option').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = list.find(x => x.id === btn.dataset.id);
      if (t) fillFromTemplate(t);
    });
  });
  if (list[0]) fillFromTemplate(list[0]);
}

// ── Submit ────────────────────────────────────────────────────────────────────
$('submitBtn').addEventListener('click', async () => {
  if (!me) { showToast('Please login first', 'error'); return; }

  const btn = $('submitBtn');
  const status = $('formStatus');
  const title = $('title').value.trim();

  if (!title) {
    showToast('Please enter a challenge title', 'warn');
    $('title').focus();
    return;
  }

  // Disable immediately — prevents double-submit
  btn.disabled = true;
  btn.textContent = 'Saving…';
  status.textContent = '';
  status.classList.remove('error');

  try {
    // Duplicate check
    const isDuplicate = await checkDuplicate(title);
    if (isDuplicate) {
      const proceed = confirm(`A challenge named "${title}" already exists.\n\nCreate anyway?`);
      if (!proceed) {
        btn.disabled = false;
        btn.textContent = 'Publish challenge';
        return;
      }
    }

    status.textContent = 'Publishing…';

    const days = Math.max(1, Number($('days').value) || 7);
    const id = await createCommunityTask(me.uid, profile, {
      title,
      description: $('description').value.trim(),
      icon: $('icon').value.trim() || '🏁',
      kind: $('kind').value,
      templateId: selected?.id || null,
      metric: $('metric').value,
      target: Number($('target').value) || 1,
      xpReward: Number($('xpReward').value) || 50,
      startAtMs: Date.now(),
      endAtMs: Date.now() + days * 86400000
    });

    if ($('alsoTemplate').checked) {
      await createTemplate(me.uid, {
        title,
        description: $('description').value.trim(),
        icon: $('icon').value.trim(),
        cadence: 'once',
        metric: $('metric').value,
        target: Number($('target').value) || 1,
        xpReward: Number($('xpReward').value) || 50
      }, { isAdmin: admin });
    }

    status.textContent = 'Published ✅';
    showToast('Challenge published successfully! 🎉');

    // Redirect to tasks.html after toast is visible
    setTimeout(() => { location.href = 'tasks.html'; }, 1400);

  } catch (err) {
    console.error(err);
    const msg = err.message || 'Failed to publish challenge';
    status.textContent = msg;
    status.classList.add('error');
    showToast(msg, 'error');
    btn.disabled = false;
    btn.textContent = 'Publish challenge';
  }
});

// ── Auth ──────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  me = user;
  if (!user) return;
  const snap = await getDoc(doc(db, 'users', user.uid));
  profile = snap.exists() ? snap.data() : { name: user.displayName };
  admin = await isAdmin(user.uid);
  $('alsoTemplateWrap').hidden = false;
  await loadTemplates();
});
