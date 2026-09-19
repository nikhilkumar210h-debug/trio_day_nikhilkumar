import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { getDoc, doc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { createCommunityTask } from './gamification/community-tasks.js';
import { showToast } from './ui/toast.js';

const $ = (id) => document.getElementById(id);
let me = null;
let profile = null;

function updatePreview() {
  $('previewIcon').textContent = $('icon')?.value.trim() || '✦';
  $('previewTitle').textContent = $('title')?.value.trim() || 'Your challenge';
  $('previewObjective').textContent = $('objective')?.value.trim() || 'Describe what people should do.';
  $('previewCategory').textContent = $('category')?.value || 'Reasoning';
  $('previewDifficulty').textContent = $('difficulty')?.value || 'Medium';
  const duration = Number($('durationMinutes')?.value || 15);
  $('previewTime').textContent = duration >= 60 ? (duration / 60) + ' hr' + (duration > 60 ? 's' : '') : duration + ' min';
}

['title','objective','icon','category','difficulty','durationMinutes'].forEach((id) => {
  const element = $(id);
  element?.addEventListener('input', updatePreview);
  element?.addEventListener('change', updatePreview);
});

$('submitBtn')?.addEventListener('click', async () => {
  if (!me) { showToast('Please login first', 'error'); return; }
  const title = $('title').value.trim();
  const objective = $('objective').value.trim();
  if (!title) { showToast('Give your challenge a title.', 'warn'); $('title').focus(); return; }
  if (objective.length < 10) { showToast('Add a clear objective so people know what to solve.', 'warn'); $('objective').focus(); return; }
  const button = $('submitBtn');
  const status = $('formStatus');
  button.disabled = true;
  button.textContent = 'Publishing…';
  status.textContent = '';
  try {
    const days = Number($('days').value || 7);
    const id = await createCommunityTask(me.uid, profile, {
      title,
      description: objective,
      objective,
      icon: $('icon').value.trim() || '✦',
      category: $('category').value,
      difficulty: $('difficulty').value,
      durationMinutes: Number($('durationMinutes').value || 15),
      metric: $('metric').value || 'manual',
      target: Number($('target').value) || 1,
      xpReward: Number($('xpReward').value) || 50,
      startAtMs: Date.now(),
      endAtMs: Date.now() + days * 86400000
    });
    status.textContent = 'Published ✓';
    showToast('Challenge published successfully!');
    setTimeout(() => { location.href = 'task-detail.html?id=' + encodeURIComponent(id); }, 700);
  } catch (error) {
    console.error('Create challenge failed:', error);
    status.textContent = error.message || 'Could not publish challenge.';
    status.classList.add('error');
    showToast(error.message || 'Could not publish challenge.', 'error');
    button.disabled = false;
    button.textContent = 'Publish challenge';
  }
});

onAuthStateChanged(auth, async (user) => {
  me = user;
  if (!user) { $('formStatus').textContent = 'Please login to create a challenge.'; return; }
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  profile = snap?.exists() ? snap.data() : { name: user.displayName || 'User', photoURL: user.photoURL || null };
  updatePreview();
});
