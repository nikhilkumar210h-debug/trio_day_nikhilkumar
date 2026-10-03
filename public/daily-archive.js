import { db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { getCachedUser } from './services/userCache.js';
import { showToast } from './ui/toast.js';

const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c]));

const FALLBACK = [
  'If you could change one thing about your school or college, what would it be?',
  'What matters more for a first job: skills or marks?',
  'Which study habit actually helps you remember things?',
  'Would you rather learn one skill deeply or five skills lightly?',
  'What should students learn before choosing a career?',
  'Which matters more in a team: speed or communication?',
  'What makes a good teacher unforgettable?',
  'Would you choose a stable job or a risky startup idea?',
  'What is one exam rule you would redesign?',
  'Which is harder: starting a project or finishing it?',
  'What makes an app worth opening every day?',
  'Would you rather build for 100 loyal users or 10,000 casual users?',
  'What should every student know about money?',
  'Which is more useful: asking good questions or giving quick answers?',
  'What makes online communities feel welcoming?',
  'Would you rather work alone or with a great team?',
  'Which college factor matters most: course, location, cost or people?',
  'What is the best way to recover after a bad study day?',
  'Would you rather have more free time or more money?',
  'What makes a challenge fun instead of stressful?',
  'Which technology will change student life the most?',
  'What is one skill you wish schools taught earlier?',
  'Would you rather travel often or build something long-term?',
  'What makes someone a good friend in a busy life?',
  'Which is more satisfying: learning something or making something?',
  'What should a beginner check before joining a new online community?',
  'Would you rather solve a hard problem or explain an easy one brilliantly?',
  'What is one small habit that improves your day?',
  'Which matters more when learning: consistency or intensity?',
  'What question should Trio Day ask students tomorrow?'
];

function keyFromDate(d) { return d.toISOString().slice(0,10); }
function fallbackForDate(d) { const k=keyFromDate(d); let h=0; for(const ch of k) h=(h*31+ch.charCodeAt(0))>>>0; return {date:k, question:FALLBACK[h%FALLBACK.length]}; }

async function loadArchive() {
  const tabsEl = document.getElementById('dateTabs');
  const listEl = document.getElementById('questionsList');
  
  const today = new Date();
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    dates.push(d);
  }
  
  tabsEl.innerHTML = dates.slice(0, 7).map((d,i) => `<button role="tab" class="nkm-tab${i===0?' is-active':''}" data-date="${keyFromDate(d)}" aria-selected="${i===0}">${d.toLocaleDateString(undefined, {weekday:'short',month:'short',day:'numeric'})}</button>`).join('');
  
  tabsEl.querySelectorAll('[role="tab"]').forEach(btn => btn.addEventListener('click', () => {
    tabsEl.querySelectorAll('[role="tab"]').forEach(b => { b.classList.remove('is-active'); b.setAttribute('aria-selected','false'); });
    btn.classList.add('is-active'); btn.setAttribute('aria-selected','true');
    renderDay(btn.dataset.date);
  }));
  
  renderDay(keyFromDate(today));
  
  async function renderDay(dateKey) {
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--color-ink-muted)">Loading…</div>';
    let questionData = fallbackForDate(new Date(dateKey + 'T00:00:00'));
    
    try {
      const snap = await getDocs(query(collection(db, 'config', 'dailyQuestions')));
      // Check if we have stored questions
    } catch {}
    
    try {
      const answersSnap = await getDocs(query(
        collection(db, 'dailyQuestionAnswers'),
        where('questionId', '==', dateKey),
        orderBy('createdAtMs', 'desc'),
        limit(100)
      ));
      
      const answers = answersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const answerTexts = answers.map(a => a.answer).filter(a => a && a !== '[skipped]');
      
      listEl.innerHTML = `
        <article class="nkm-card" style="padding:20px">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <span class="daily-q-kicker">DAILY QUESTION · ${dateKey}</span>
          </div>
          <h2 style="font-family:var(--font-display);font-size:clamp(20px,4vw,28px);margin:0 0 16px">${esc(questionData.question)}</h2>
          <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            <a href="challenge-create.html" class="nkm-btn nkm-btn--secondary">Turn into Challenge →</a>
          </div>
          <div class="dq-answers-section">
            <h3 style="font-size:14px;margin:0 0 12px;color:var(--color-ink-muted)">Community Answers (${answerTexts.length})</h3>
            ${answerTexts.length === 0 
              ? '<p style="color:var(--color-ink-muted);text-align:center;padding:20px">No answers yet. Be the first!</p>'
              : answerTexts.slice(0, 20).map(a => `<div class="nkm-skeleton--text" style="background:var(--color-glass);padding:10px 12px;border-radius:8px;margin-bottom:8px;color:var(--color-ink);font-size:13px;line-height:1.5">${esc(a)}</div>`).join('')}
            ${answerTexts.length > 20 ? `<p style="color:var(--color-ink-dim);font-size:12px;text-align:center;margin-top:12px">+${answerTexts.length - 20} more answers</p>` : ''}
          </div>
        </article>
      `;
    } catch (err) {
      console.error('renderDay:', err);
      listEl.innerHTML = '<p style="text-align:center;color:var(--color-ink-muted);padding:20px">Could not load answers</p>';
    }
  }
}

onAuthStateChanged(auth, user => { if (user) loadArchive(); else location.href = 'login.html?redirect=daily-questions.html'; });