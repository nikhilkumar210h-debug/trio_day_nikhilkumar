import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { createCommunityTask } from './gamification/community-tasks.js?v=20260919-community5';
import { uploadStoryMedia, cloudinaryAutoUrl } from './image-upload.js?v=20261018-img1';
import { showToast } from './ui/toast.js';
import { escapeHtml as esc } from './utils.js';

const $ = id => document.getElementById(id);
let me = null, profile = {};
let choices = ['', '', ''];
let momentFormat = 'quick';
let challengeImageUrl = null;

function render() {
  $('options').innerHTML = choices.map((v, i) => `<div class="cc-option"><input class="cc-input" maxlength="100" data-choice="${i}" value="${esc(v)}" placeholder="Choice ${i+1}">${choices.length > 2 ? `<button class="cc-remove" type="button" data-remove="${i}">Remove</button>` : ''}</div>`).join('');
  $('options').querySelectorAll('[data-choice]').forEach(e => e.addEventListener('input', () => { choices[Number(e.dataset.choice)] = e.value; preview(); }));
  $('options').querySelectorAll('[data-remove]').forEach(e => e.addEventListener('click', () => { choices.splice(Number(e.dataset.remove), 1); render(); preview(); }));
  preview();
}

function preview() {
  const q = $('question').value.trim() || 'Your question will appear here.';
  const twist = $('twist')?.value.trim();
  const labels = { quick: '⚡ QUICK PICK', rather: '↔ WOULD YOU', hot: '🔥 HOT TAKE', scenario: '✦ SCENARIO' };
  let detectiveHtml = '';
  if ($('detectiveMode')?.checked) {
    const clues = [$('clue1')?.value.trim(), $('clue2')?.value.trim(), $('clue3')?.value.trim()].filter(Boolean);
    if (clues.length) {
      detectiveHtml = `<div class="cc-preview-detective"><strong>🕵️ Detective Mystery</strong>${clues.map((c, i) => `<p>Clue ${i+1}: ${esc(c)}</p>`).join('')}</div>`;
    }
  }
  $('preview').innerHTML = `<span class="cc-preview-type">${labels[momentFormat]}</span><strong>${esc(q)}</strong>${twist ? `<p class="cc-preview-twist">✦ ${esc(twist)}</p>` : ''}${detectiveHtml}<div class="cc-preview-options">${choices.map((v, i) => `<button type="button"><span>${['A', 'B', 'C', 'D', 'E'][i]}</span>${esc(v || 'Choice')}</button>`).join('')}</div><small>No right answer · choose your side · see what the room thinks</small>`;
}

$('formatPicker')?.querySelectorAll('[data-format]').forEach(btn => btn.addEventListener('click', () => {
  momentFormat = btn.dataset.format;
  $('format').value = momentFormat;
  $('formatPicker').querySelectorAll('[data-format]').forEach(x => x.classList.toggle('is-active', x === btn));
  if (momentFormat === 'rather') { choices = choices.slice(0, 2); while (choices.length < 2) choices.push(''); render(); }
  else preview();
}));
$('twist')?.addEventListener('input', preview);
$('question').addEventListener('input', preview); $('topic').addEventListener('input', preview);
$('addOption').addEventListener('click', () => { if (choices.length < 5) { choices.push(''); render(); } });

// Detective mode toggle
$('detectiveMode')?.addEventListener('change', () => {
  const cluesContainer = $('cluesContainer');
  if (cluesContainer) cluesContainer.style.display = $('detectiveMode').checked ? 'flex' : 'none';
  preview();
});
// Clue inputs update preview
['clue1', 'clue2', 'clue3'].forEach(id => { $(id)?.addEventListener('input', preview); });

// Image upload (Phase 4)
$('challengeImage')?.addEventListener('change', async () => {
  const file = $('challengeImage').files?.[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return showToast('Please select an image file.', 'warn');
  const previewEl = $('challengeImagePreview');
  previewEl.style.display = 'block';
  previewEl.innerHTML = '<strong>Uploading image…</strong>';
  try {
    const token = await me.getIdToken();
    const url = await uploadStoryMedia(me.uid, file, token);
    challengeImageUrl = cloudinaryAutoUrl(url);
    previewEl.innerHTML = `<img src="${challengeImageUrl}" style="max-width:200px;max-height:200px;border-radius:10px;margin-top:6px"><button type="button" id="removeImage" class="nkm-btn" style="margin-top:8px">Remove image</button>`;
    $('removeImage')?.addEventListener('click', () => {
      challengeImageUrl = null;
      previewEl.style.display = 'none';
      $('challengeImage').value = '';
    });
    showToast('Image uploaded.', 'success');
  } catch (err) {
    console.error('Image upload failed:', err);
    previewEl.innerHTML = '';
    showToast('Image upload failed.', 'error');
  }
});

$('publish').addEventListener('click', async () => {
  if ($('publish').disabled) return;
  if (!me) return;
  const q = $('question').value.trim(), opts = choices.map(x => x.trim()).filter(Boolean);
  if (q.length < 8) return showToast('Write a clear question first.', 'warn');
  if (opts.length < 2) return showToast('Add at least 2 choices.', 'warn');
  $('publish').disabled = true; $('status').textContent = 'Publishing…';
  try {
    const interaction = {
      kind: 'choice',
      question: q,
      options: opts,
      correct: null,
      proofRequired: false,
      proofPrompt: 'Why did you choose this?',
      format: momentFormat,
      twist: $('twist')?.value.trim() || ''
    };

    if ($('detectiveMode')?.checked) {
      const clues = [$('clue1')?.value.trim(), $('clue2')?.value.trim(), $('clue3')?.value.trim()].filter(Boolean);
      if (clues.length) {
        interaction.kind = 'detective';
        interaction.clues = clues.slice(0, 3);
      }
    }

    const id = await createCommunityTask(me.uid, profile, {
      title: q.slice(0, 100),
      description: q,
      goal: 'Choose an answer and compare your thinking with other people.',
      instructions: 'Pick one choice. Then use Chat to explain why.',
      icon: '⚡',
      kind: 'challenge',
      activityType: 'challenge',
      category: $('topic').value.trim() || 'Community',
      mechanic: 'choice',
      templateId: null,
      durationMin: 2,
      difficulty: 'Easy',
      expiresInDays: 14,
      target: 1,
      metric: 'manual',
      xpReward: 25,
      imageUrl: challengeImageUrl || null,
      interaction
    });
    $('status').textContent = 'Published ✓'; showToast('Challenge published.');
    setTimeout(() => location.href = 'challenge.html?id=' + encodeURIComponent(id), 500);
  } catch (e) { console.error(e); $('status').textContent = e?.message || 'Could not publish.'; showToast($('status').textContent, 'error'); $('publish').disabled = false; }
});
render();
$('formatPicker')?.querySelector('[data-format="quick"]')?.classList.add('is-active');
onAuthStateChanged(auth, async user => { if (!user) { location.href = 'login.html?redirect=challenge-create.html'; return; } me = user; const s = await getDoc(doc(db, 'users', user.uid)).catch(() => null); profile = s?.exists() ? s.data() : { name: user.displayName || 'User' }; });