import { auth } from './firebase-init.js';
import { completeTask } from './gamification/community-tasks.js';

const esc = value => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function hintKey(taskId) {
  return 'trio_mystery_hints_' + (auth.currentUser?.uid || 'guest') + '_' + taskId;
}

export function renderMysteryInvestigation(caseData, started, completed, taskId) {
  const suspects = Array.isArray(caseData?.suspects) ? caseData.suspects : [];
  const clues = Array.isArray(caseData?.clues) ? caseData.clues : [];
  const timeline = Array.isArray(caseData?.timeline) ? caseData.timeline : [];
  const hints = Array.isArray(caseData?.hints) ? caseData.hints : [];
  const revealed = Math.min(hints.length, Number(localStorage.getItem(hintKey(taskId)) || 0));

  if (!started) {
    return '<section class="case-briefing">' +
      '<div class="case-kicker">CASE BRIEFING</div>' +
      '<h2>' + esc(caseData?.synopsis || 'Mystery case') + '</h2>' +
      '<p>' + esc(caseData?.briefing || 'Investigate the evidence and make your final deduction.') + '</p>' +
      '<div class="case-note">Start the challenge to open the evidence board, suspect files, timeline and final deduction.</div>' +
      '</section>';
  }

  const suspectHtml = suspects.map(function(s) {
    return '<article class="case-suspect">' +
      '<div class="case-suspect-head"><strong>' + esc(s.name || s.id) + '</strong><span>' + esc(s.role || 'Suspect') + '</span></div>' +
      (s.description ? '<p>' + esc(s.description) + '</p>' : '') +
      (s.alibi ? '<div class="case-alibi"><b>Alibi</b><span>' + esc(s.alibi) + '</span></div>' : '') +
      '</article>';
  }).join('');

  const clueHtml = clues.map(function(c, index) {
    return '<article class="case-clue">' +
      '<button type="button" class="case-clue-toggle" data-clue-toggle="' + esc(c.id) + '" aria-expanded="false">' +
      '<span><b>' + (index + 1) + '</b><strong>' + esc(c.title || c.id) + '</strong></span>' +
      '<small>view</small></button>' +
      '<div class="case-clue-content" data-clue-content="' + esc(c.id) + '" hidden>' +
      '<div class="case-clue-type">' + esc(c.type || 'evidence') + '</div>' +
      '<p>' + esc(c.content || 'No evidence description.') + '</p>' +
      (c.mediaUrl ? '<a href="' + esc(c.mediaUrl) + '" target="_blank" rel="noopener">Open attached evidence ↗</a>' : '') +
      '</div></article>';
  }).join('');

  const timelineHtml = timeline.map(function(event) {
    return '<div class="case-timeline-row"><span class="case-time">' + esc(event.time || '—') +
      '</span><span>' + esc(event.event || '') + '</span></div>';
  }).join('');

  const hintHtml = hints.length ? (
    '<section class="case-panel case-hints">' +
      '<div class="case-panel-head"><div><span class="case-kicker">HINTS</span><h3>Need a nudge?</h3></div>' +
      '<span>' + revealed + '/' + hints.length + '</span></div>' +
      '<div class="case-hint-actions">' +
      hints.map(function(h, i) {
        const disabled = i > revealed ? ' disabled' : '';
        const label = i < revealed ? 'Hint ' + (i + 1) + ' revealed' : i === revealed ? 'Reveal Hint ' + (i + 1) : 'Locked';
        return '<button type="button" class="btn secondary case-hint-btn" data-hint-index="' + i + '"' + disabled + '>' + label + '</button>';
      }).join('') +
      '</div>' +
      '<div id="caseHintOutput" class="case-hint-output">' +
      (revealed ? esc(hints[revealed - 1]?.text || '') : 'Hints are optional. Use the evidence first.') +
      '</div>' +
    '</section>'
  ) : '';

  const finalHtml = completed ? (
    '<section class="case-panel case-finished" id="caseFinal"><strong>Verified deduction ✓</strong><p>This mystery case is complete.</p></section>'
  ) : (
    '<section class="case-panel case-final" id="caseFinal">' +
      '<div class="case-kicker">FINAL DEDUCTION</div>' +
      '<h3>' + esc(caseData?.finalPrompt || 'Who is responsible, why, and which evidence proves it?') + '</h3>' +
      '<label class="field"><span class="label-text">Who is responsible?</span><select id="caseSuspect"><option value="">Choose a suspect</option>' +
      suspects.map(function(s) { return '<option value="' + esc(s.id) + '">' + esc(s.name || s.id) + '</option>'; }).join('') +
      '</select></label>' +
      '<label class="field"><span class="label-text">What is the motive?</span><textarea id="caseMotive" rows="3" maxlength="300" placeholder="State the motive in your own words…"></textarea></label>' +
      '<div class="field"><span class="label-text">Which evidence proves your deduction?</span>' +
      '<div class="case-evidence-select">' +
      clues.map(function(c) {
        return '<label><input type="checkbox" value="' + esc(c.id) + '" data-case-evidence><span>' + esc(c.title || c.id) + '</span></label>';
      }).join('') +
      '</div></div>' +
      '<button type="button" class="btn primary" id="submitCaseBtn">Submit final deduction</button>' +
      '<p id="caseVerifyStatus" class="status" aria-live="polite"></p>' +
    '</section>'
  );

  return '<div class="case-board">' +
    '<section class="case-panel"><div class="case-kicker">BRIEFING</div><p class="case-briefing-text">' +
      esc(caseData?.briefing || '') + '</p></section>' +
    '<section class="case-panel"><div class="case-panel-head"><div><span class="case-kicker">SUSPECTS</span><h3>Who had the opportunity?</h3></div><span>' +
      suspects.length + '</span></div><div class="case-suspect-grid">' + suspectHtml + '</div></section>' +
    '<section class="case-panel"><div class="case-panel-head"><div><span class="case-kicker">EVIDENCE BOARD</span><h3>Inspect every clue</h3></div><span>' +
      clues.length + '</span></div><div class="case-clue-list">' + clueHtml + '</div></section>' +
    '<section class="case-panel"><div class="case-panel-head"><div><span class="case-kicker">TIMELINE</span><h3>Line up the events</h3></div><span>' +
      timeline.length + '</span></div><div class="case-timeline">' + timelineHtml + '</div></section>' +
    hintHtml + finalHtml +
    '</div>';
}

export function bindMysteryInteractions(taskId) {
  document.querySelectorAll('[data-clue-toggle]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const id = btn.dataset.clueToggle;
      const panel = document.querySelector('[data-clue-content="' + CSS.escape(id) + '"]');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      btn.setAttribute('aria-expanded', String(!panel.hidden));
      const small = btn.querySelector('small');
      if (small) small.textContent = panel.hidden ? 'view' : 'hide';
    });
  });

  document.querySelectorAll('[data-hint-index]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const index = Number(btn.dataset.hintIndex);
      const key = hintKey(taskId);
      const current = Number(localStorage.getItem(key) || 0);
      if (index !== current) return;
      localStorage.setItem(key, String(current + 1));
      const output = document.getElementById('caseHintOutput');
      const caseData = window.__trioMysteryCaseData;
      const hint = caseData?.hints?.[index];
      if (output && hint) output.textContent = hint.text || '';
      document.querySelectorAll('[data-hint-index]').forEach(function(item) {
        const i = Number(item.dataset.hintIndex);
        item.disabled = i > current + 1;
        item.textContent = i < current + 1 ? 'Hint ' + (i + 1) + ' revealed' : i === current + 1 ? 'Reveal Hint ' + (i + 2) : 'Locked';
      });
    });
  });

  document.getElementById('submitCaseBtn')?.addEventListener('click', async function() {
    const suspectId = document.getElementById('caseSuspect')?.value || '';
    const motive = document.getElementById('caseMotive')?.value.trim() || '';
    const keyEvidenceIds = Array.from(document.querySelectorAll('[data-case-evidence]:checked')).map(function(input) { return input.value; });
    const status = document.getElementById('caseVerifyStatus');
    const btn = document.getElementById('submitCaseBtn');

    if (!suspectId) { status.textContent = 'Choose the suspect.'; return; }
    if (motive.length < 3) { status.textContent = 'Explain the motive in a few words.'; return; }
    if (!keyEvidenceIds.length) { status.textContent = 'Select at least one key evidence item.'; return; }

    btn.disabled = true;
    btn.textContent = 'Verifying…';
    status.textContent = 'Checking your deduction…';

    try {
      const result = await completeTask(taskId, auth.currentUser.uid, null, {
        caseSolution: { suspectId, motive, keyEvidenceIds }
      });

      if (result.correct === false) {
        const b = result.breakdown || {};
        status.textContent = 'Not solved yet — Suspect ' + (b.suspectCorrect ? '✓' : 'needs review') +
          ' · Motive ' + (b.motiveCorrect ? '✓' : 'needs review') +
          ' · Evidence ' + (b.evidenceCorrect ? '✓' : 'needs review');
        btn.disabled = false;
        btn.textContent = 'Submit final deduction';
        return;
      }

      status.textContent = 'Case solved — verified ✓';
      window.dispatchEvent(new CustomEvent('trio-mystery-complete'));
    } catch (error) {
      status.textContent = error.message || 'Could not verify the case.';
      btn.disabled = false;
      btn.textContent = 'Submit final deduction';
    }
  });
}
