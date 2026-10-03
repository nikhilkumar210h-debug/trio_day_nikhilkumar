import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, query, where, orderBy, limit
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { trioCache } from './trio-cache.js';
import { getCachedUser } from './services/userCache.js';
import { showToast } from './ui/toast.js';
import { makeUserId, escapeHtml as esc } from './utils.js';

const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c]));

const $ = id => document.getElementById(id);

let me = null;

async function loadDiscoverPeople() {
  const section = $('peopleSection');
  if (!section) return;
  
  if (!me) {
    section.innerHTML = '<div class="discover-empty">Sign in to discover people</div>';
    return;
  }
  
  try {
    const followingSnap = await getDocs(query(collection(db, 'users', me.uid, 'following'), limit(500)));
    const followingIds = new Set(followingSnap.docs.map(d => d.id));
    
    const leaderboardSnap = await getDocs(query(
      collection(db, 'leaderboards', 'global')
    ));
    
    let candidates = [];
    if (!leaderboardSnap.empty) {
      const data = leaderboardSnap.data();
      if (data.entries) {
        candidates = data.entries
          .filter(e => e.uid !== me.uid && !followingIds.has(e.uid))
          .slice(0, 20);
      }
    }
    
    if (candidates.length === 0) {
      const usersSnap = await getDocs(query(collection(db, 'users'), limit(30)));
      candidates = usersSnap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u => u.uid !== me.uid && !followingIds.has(u.uid))
        .slice(0, 20);
    }
    
    if (candidates.length === 0) {
      section.innerHTML = '<div class="discover-empty">No new people to discover yet</div>';
      return;
    }
    
    section.innerHTML = candidates.map(u => `
      <article class="person-card" data-uid="${u.uid}">
        <div class="person-avatar">${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="">` : (u.name || 'U').charAt(0).toUpperCase()}</div>
        <div class="person-name">${esc(u.name || 'User')}</div>
        <div class="person-id">${esc(u.userId || makeUserId(u.uid))}</div>
        <button type="button" class="nkm-btn nkm-btn--secondary follow-btn" data-uid="${u.uid}" data-following="false" style="margin-top:8px;width:100%">Follow</button>
      </article>
    `).join('');
    
    section.querySelectorAll('.follow-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const uid = btn.dataset.uid;
        const following = btn.dataset.following === 'true';
        
        if (following) {
          const confirmed = confirm('Unfollow this user?');
          if (!confirmed) return;
          await deleteDoc(doc(db, 'users', me.uid, 'following', uid));
          await deleteDoc(doc(db, 'users', uid, 'followers', me.uid)).catch(() => {});
          btn.dataset.following = 'false';
          btn.textContent = 'Follow';
          btn.classList.remove('following');
          showToast('Unfollowed', 'success');
        } else {
          const profile = await getCachedUser(uid);
          await setDoc(doc(db, 'users', me.uid, 'following', uid), { uid, userId: profile?.userId || makeUserId(uid), name: profile?.name || 'User', createdAt: serverTimestamp() });
          await setDoc(doc(db, 'users', uid, 'followers', me.uid), { uid: me.uid, createdAt: serverTimestamp() });
          btn.dataset.following = 'true';
          btn.textContent = 'Following';
          btn.classList.add('following');
          showToast('Followed! ✨', 'success');
        }
      });
    });
    
  } catch (err) {
    console.error('loadDiscoverPeople:', err);
    section.innerHTML = '<div class="discover-empty">Could not load people</div>';
  }
}

async function loadActiveChallengePreview() {
  const host = $('challengePreview');
  const meta = $('challengePreviewMeta');
  if (!host) return;
  
  try {
    const cached = trioCache.get('lb_global');
    let challenge = null;
    
    if (cached && cached.entries && cached.entries.length) {
      const activeUsers = cached.entries.filter(e => e.uid !== me?.uid).slice(0, 3);
      if (activeUsers.length) {
        const latestActive = activeUsers[0];
        const answersSnap = await getDocs(query(
          collection(db, 'challengeAnswers'),
          where('uid', '==', latestActive.uid),
          orderBy('createdAtMs', 'desc'),
          limit(1)
        ));
        if (!answersSnap.empty) {
          challenge = answersSnap.docs[0].data().challengeId;
        }
      }
    }
    
    if (!challenge) challenge = 'trip';
    
    const challengeSnap = await getDoc(doc(db, 'communityTasks', challenge));
    if (challengeSnap.exists()) {
      const c = challengeSnap.data();
      if (c.interaction?.question && c.interaction?.options) {
        host.innerHTML = `
          <div class="challenge-card-question">${esc(c.interaction.question)}</div>
          <div class="challenge-options">
            ${c.interaction.options.map((x,i)=>`<button class="challenge-option" type="button" data-choice="${i}">${esc(x)}<small>Choose this</small></button>`).join('')}
          </div>
        `;
        if (meta) meta.textContent = `${c.title} · Quick interaction · under 60 seconds`;
        
        host.querySelectorAll('[data-choice]').forEach(btn=>btn.onclick=()=>{
          const selected=Number(btn.dataset.choice);
          localStorage.setItem('trio_last_challenge',JSON.stringify({id:challenge,choice:selected,at:Date.now()}));
          host.innerHTML='<div class="challenge-card-question">Locked in ✓</div><p style="margin:8px 0 0;color:var(--color-ink-muted);font-size:11px">Your choice is ready. Open the Challenge to continue.</p><a class="nkm-btn nkm-btn--primary" href="challenge.html?id='+encodeURIComponent(challenge)+'" style="display:inline-flex;margin-top:12px">Open Challenge →</a>';
        });
      }
    }
  } catch (err) {
    console.warn('loadActiveChallengePreview:', err);
  }
}

onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=all-users.html'; return; }
  me = u;
  await loadDiscoverPeople();
  await loadActiveChallengePreview();
});