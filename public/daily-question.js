import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
const FALLBACK=[
'If you could change one thing about your school or college, what would it be?','What matters more for a first job: skills or marks?','Which study habit actually helps you remember things?','Would you rather learn one skill deeply or five skills lightly?','What should students learn before choosing a career?','Which matters more in a team: speed or communication?','What makes a good teacher unforgettable?','Would you choose a stable job or a risky startup idea?','What is one exam rule you would redesign?','Which is harder: starting a project or finishing it?','What makes an app worth opening every day?','Would you rather build for 100 loyal users or 10,000 casual users?','What should every student know about money?','Which is more useful: asking good questions or giving quick answers?','What makes online communities feel welcoming?','Would you rather work alone or with a great team?','Which college factor matters most: course, location, cost or people?','What is the best way to recover after a bad study day?','Would you rather have more free time or more money?','What makes a challenge fun instead of stressful?','Which technology will change student life the most?','What is one skill you wish schools taught earlier?','Would you rather travel often or build something long-term?','What makes someone a good friend in a busy life?','Which is more satisfying: learning something or making something?','What should a beginner check before joining a new online community?','Would you rather solve a hard problem or explain an easy one brilliantly?','What is one small habit that improves your day?','Which matters more when learning: consistency or intensity?','What question should Trio Day ask students tomorrow?'];
function key(){return new Date().toISOString().slice(0,10)}
function fallback(){const k=key();let h=0;for(const ch of k)h=(h*31+ch.charCodeAt(0))>>>0;return {date:k,question:FALLBACK[h%FALLBACK.length]};}
let currentDailyQuestion=null;
async function loadDailyQuestion(){const host=document.getElementById('dailyQuestionCard');if(!host)return;const k=key();try{const cached=JSON.parse(localStorage.getItem('trio_daily_question')||'null');if(cached?.date===k) return render(cached);}catch{}let data=fallback();try{const snap=await getDoc(doc(db,'config','dailyQuestion'));if(snap.exists()&&snap.data().date===k&&snap.data().question)data={date:k,question:snap.data().question};}catch{}try{localStorage.setItem('trio_daily_question',JSON.stringify(data));}catch{}render(data);}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function saveDailyAnswer(questionKey, answer, user){
  if(!user) return false;
  try{
    await setDoc(doc(db,'dailyAnswers',user.uid+'_'+questionKey),{
      uid:user.uid,
      questionKey,
      answer,
      createdAt:serverTimestamp(),
      createdAtMs:Date.now()
    },{merge:true});
    return true;
  }catch(e){
    console.warn('[DailyQuestion] save answer failed',e);
    return false;
  }
}
function render(data){
  currentDailyQuestion=data;
  const host=document.getElementById('dailyQuestionCard');
  if(!host)return;
  const user=auth.currentUser;
  const answerKey='daily_answer_'+data.date;
  const savedAnswer=localStorage.getItem(answerKey)||'';
  host.innerHTML='<span class="daily-q-kicker">DAILY QUESTION · '+data.date+'</span><h2>'+esc(data.question)+'</h2>'
    +'<div class="daily-answer-input" style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">'
    +'<input type="text" id="dailyAnswerInput" placeholder="Your answer…" maxlength="280" value="'+esc(savedAnswer)+'" style="flex:1;min-width:180px;padding:10px 12px;border:1px solid var(--color-border);background:var(--color-glass);color:var(--color-ink);border-radius:10px;font:inherit;font-size:13px">'
    +'<button type="button" id="dailyAnswerSave" class="nkm-btn nkm-btn--primary" style="height:40px" '+(user?'':'disabled')+'>Save Answer</button>'
    +'</div>'
    +'<p class="daily-answer-hint" style="margin-top:8px;font-size:11px;color:var(--color-ink-muted)">'+(user?'Your answer is saved privately.':'Sign in to save your answer.')+'</p>'
    +'<a class="nkm-btn nkm-btn--secondary" href="challenge-create.html" style="margin-top:12px;display:inline-block">Turn this into a Challenge →</a>';
  const input=host.querySelector('#dailyAnswerInput');
  const saveBtn=host.querySelector('#dailyAnswerSave');
  input?.addEventListener('input',()=>{localStorage.setItem(answerKey,input.value);});
  saveBtn?.addEventListener('click',async()=>{
    const ans=input.value.trim();
    if(!ans) return;
    saveBtn.disabled=true;saveBtn.textContent='Saving…';
    const saved = await saveDailyAnswer(data.date,ans,user);
    saveBtn.textContent=saved ? 'Saved ✓' : 'Save failed';
    setTimeout(()=>{saveBtn.textContent='Save Answer';saveBtn.disabled=false;},1500);
  });
}
loadDailyQuestion();

// Firebase Auth may resolve after the first render; refresh the control state when it does.
onAuthStateChanged(auth, () => {
  if (currentDailyQuestion) render(currentDailyQuestion);
});
