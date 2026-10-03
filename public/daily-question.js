import { auth, db } from './firebase-init.js';
import { doc, getDoc, setDoc, collection, getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { showToast } from './ui/toast.js';

const FALLBACK = [
'If you could change one thing about your school or college, what would it be?','What matters more for a first job: skills or marks?','Which study habit actually helps you remember things?','Would you rather learn one skill deeply or five skills lightly?','What should students learn before choosing a career?','Which matters more in a team: speed or communication?','What makes a good teacher unforgettable?','Would you choose a stable job or a risky startup idea?','What is one exam rule you would redesign?','Which is harder: starting a project or finishing it?','What makes an app worth opening every day?','Would you rather build for 100 loyal users or 10,000 casual users?','What should every student know about money?','Which is more useful: asking good questions or giving quick answers?','What makes online communities feel welcoming?','Would you rather work alone or with a great team?','Which college factor matters most: course, location, cost or people?','What is the best way to recover after a bad study day?','Would you rather have more free time or more money?','What makes a challenge fun instead of stressful?','Which technology will change student life the most?','What is one skill you wish schools taught earlier?','Would you rather travel often or build something long-term?','What makes someone a good friend in a busy life?','Which is more satisfying: learning something or making something?','What should a beginner check before joining a new online community?','Would you rather solve a hard problem or explain an easy one brilliantly?','What is one small habit that improves your day?','Which matters more when learning: consistency or intensity?','What question should Trio Day ask students tomorrow?'];

function key() { return new Date().toISOString().slice(0,10); }
function fallback() { const k=key(); let h=0; for(const ch of k) h=(h*31+ch.charCodeAt(0))>>>0; return {date:k,question:FALLBACK[h%FALLBACK.length]}; }

const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c]));

async function loadDailyQuestion() {
  const host = document.getElementById('dailyQuestionCard');
  if (!host) return;
  const k = key();
  try {
    const cached = JSON.parse(localStorage.getItem('trio_daily_question')||'null');
    if (cached?.date===k) return render(cached);
  } catch {}
  let data = fallback();
  try {
    const snap = await getDoc(doc(db,'config','dailyQuestion'));
    if (snap.exists() && snap.data().date===k && snap.data().question) data = {date:k, question:snap.data().question};
  } catch {}
  try { localStorage.setItem('trio_daily_question', JSON.stringify(data)); } catch {}
  render(data);
}

function render(data) {
  const host = document.getElementById('dailyQuestionCard');
  if (!host) return;
  const answeredKey = 'dq_answered_' + data.date;
  const hasAnswered = localStorage.getItem(answeredKey);
  let answerHtml = '';
  if (hasAnswered) {
    answerHtml = '<div class="dq-answered"><strong>You answered:</strong> ' + esc(hasAnswered) + '</div>';
  } else {
    answerHtml = `
      <div class="dq-answer-form">
        <label for="dqAnswer" class="label-text">Your answer</label>
        <textarea id="dqAnswer" class="nkm-input" rows="3" maxlength="500" placeholder="Type your answer…"></textarea>
        <div style="display:flex;gap:8px;margin-top:8px">
          <button id="dqSubmit" class="nkm-btn nkm-btn--primary" type="button">Submit Answer</button>
          <button id="dqSkip" class="nkm-btn nkm-btn--secondary" type="button">Skip</button>
        </div>
      </div>
    `;
  }
  host.innerHTML = `
    <span class="daily-q-kicker">DAILY QUESTION · ${data.date}</span>
    <h2>${esc(data.question)}</h2>
    <p>One fixed question for everyone today. Answer it in your own way.</p>
    ${answerHtml}
    <div id="dqOthers" class="dq-others" style="margin-top:16px"></div>
    <a class="nkm-btn nkm-btn--secondary" href="challenge-create.html" style="margin-top:12px">Turn this into a Challenge →</a>
  `;

  const submitBtn = host.querySelector('#dqSubmit');
  const skipBtn = host.querySelector('#dqSkip');
  const textarea = host.querySelector('#dqAnswer');
  const othersDiv = host.querySelector('#dqOthers');

  if (submitBtn && textarea) {
    submitBtn.onclick = async () => {
      const text = textarea.value.trim();
      if (!text) return showToast('Write something first', 'warn');
      if (text.length > 500) return showToast('Keep it under 500 chars', 'warn');
      if (!auth.currentUser) return location.href = 'login.html?redirect=' + encodeURIComponent(location.pathname);
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting…';
      try {
        await setDoc(doc(db, 'dailyQuestionAnswers', auth.currentUser.uid + '_' + data.date), {
          uid: auth.currentUser.uid,
          questionId: data.date,
          answer: text,
          createdAtMs: Date.now()
        });
        localStorage.setItem(answeredKey, text);
        showToast('Answer submitted! +10 XP', 'success');
        render(data);
        loadOthersAnswers(data.date, othersDiv);
      } catch (err) {
        console.error(err);
        showToast('Failed to submit', 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Answer';
      }
    };
  }
  if (skipBtn) {
    skipBtn.onclick = () => {
      localStorage.setItem(answeredKey, '[skipped]');
      render(data);
      loadOthersAnswers(data.date, othersDiv);
    };
  }

  loadOthersAnswers(data.date, othersDiv);
}

async function loadOthersAnswers(date, container) {
  if (!container) return;
  try {
    const snap = await getDocs(query(
      collection(db, 'dailyQuestionAnswers'),
      where('questionId', '==', date),
      orderBy('createdAtMs', 'desc'),
      limit(50)
    ));
    const answers = snap.docs.map(d => d.data().answer).filter(a => a && a !== '[skipped]');
    if (answers.length === 0) {
      container.innerHTML = '<p class="dq-others-empty" style="color:var(--color-ink-muted);font-size:13px">No answers yet. Be the first!</p>';
      return;
    }
    const sample = answers.slice(0, 10).map(a => '<span class="dq-other-answer" style="background:var(--color-glass);padding:6px 10px;border-radius:8px;margin:4px;display:inline-block;font-size:12px;color:var(--color-ink)">' + esc(a) + '</span>').join('');
    container.innerHTML = '<strong style="display:block;margin-bottom:8px;font-size:13px">How others answered (' + answers.length + '):</strong>' + sample + (answers.length > 10 ? '<span style="color:var(--color-ink-muted);font-size:12px"> +' + (answers.length - 10) + ' more</span>' : '');
  } catch (err) {
    console.warn('daily question others load failed', err);
  }
}

onAuthStateChanged(auth, user => {
  if (user) {
    const host = document.getElementById('dailyQuestionCard');
    if (host) {
      const k = key();
      const cached = localStorage.getItem('trio_daily_question');
      if (cached) {
        const data = JSON.parse(cached);
        if (data.date === k) {
          const othersDiv = host.querySelector('#dqOthers');
          loadOthersAnswers(k, othersDiv);
        }
      }
    }
  }
});

loadDailyQuestion();