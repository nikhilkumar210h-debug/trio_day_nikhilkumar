import { escapeHtml as esc, initials, formatTime, avatarHtml } from '../utils.js';

export async function buildFeedItem(data, { currentUser, getMyProfile, notifyPostOwner, onPostCreated, onLikeGiven, onLikeReceived, onCommentCreated, SoundManager, window } = {}) {
  const postId = data._id;
  const item = document.createElement('article'); item.className = 'feed-item nkm-post'; item.dataset.postId = postId;
  const head = document.createElement('div'); head.className = 'feed-post-head nkm-post-head';
  const av = document.createElement('div'); av.className = 'feed-avatar nkm-post-avatar';
  if (data.photoURL) { const img = document.createElement('img'); img.src = data.photoURL; img.alt = ''; img.width = 36; img.height = 36; img.decoding = 'async'; img.loading = 'lazy'; av.appendChild(img); } else av.textContent = initials(data.name);
  const identity = document.createElement('div'); identity.className = 'feed-identity nkm-post-meta';
  const name = document.createElement('div'); name.className = 'pname nkm-post-name'; name.textContent = data.name || 'User'; name.title = 'Open profile';
  name.addEventListener('click', () => data.uid && (window.location.href = `profile.html?uid=${encodeURIComponent(data.uid)}`));
  const uid = document.createElement('div'); uid.className = 'puid nkm-post-id'; uid.textContent = data.userId || '';
  const time = document.createElement('div'); time.className = 'ptime nkm-post-time'; time.textContent = formatTime(data);
  identity.append(name, uid, time); head.append(av, identity);

  if (data.uid) {
    getMyProfile?.(data.uid).then(latest => {
      if (!latest) return;
      if (latest.name) { name.textContent = latest.name; if (!data.photoURL) av.textContent = initials(latest.name); }
      if (latest.userId) uid.textContent = latest.userId;
      if (latest.photoURL) {
        let img = av.querySelector('img');
        if (!img) { av.textContent = ''; img = document.createElement('img'); img.alt = ''; img.width = 44; img.height = 44; img.decoding = 'async'; img.loading = 'lazy'; av.appendChild(img); }
        img.src = latest.photoURL;
      }
    }).catch(() => { });
  }

  const mediaWrap = document.createElement('div'); mediaWrap.className = 'feed-media nkm-post-media';
  if (data.mediaUrl) {
    const img = document.createElement('img'); img.className = 'media'; img.loading = 'lazy'; img.decoding = 'async'; img.src = data.mediaUrl; img.alt = `Photo from ${data.name || 'User'}`; img.width = 800; img.height = 450;
    img.style.aspectRatio = '16 / 9';
    mediaWrap.appendChild(img);
  } else {
    mediaWrap.classList.add('text-only-media');
    const quote = document.createElement('div'); quote.className = 'text-only-copy'; quote.textContent = data.message || '🇮🇳';
    mediaWrap.appendChild(quote);
  }

  const content = document.createElement('div'); content.className = 'feed-content-panel nkm-post-content'; content.appendChild(head);
  if (data.message) { const cap = document.createElement('p'); cap.className = 'feed-caption nkm-post-caption'; cap.textContent = data.message; content.appendChild(cap); }

  const commentsPreview = document.createElement('div'); commentsPreview.className = 'comments-preview';
  content.appendChild(commentsPreview);
  function renderCommentsPreview(arr) {
    commentsPreview.innerHTML = '';
    if (!arr.length) return;
    const c = arr[0]; if (!c) return;
    const p = document.createElement('div'); p.className = 'comment-preview-item';
    p.innerHTML = `<strong>${esc(c.name || 'User')}</strong> <span class="preview-txt">${esc(c.txt || '')}</span>`;
    commentsPreview.appendChild(p);
    commentsPreview.style.cursor = 'pointer';
    commentsPreview.onclick = (e) => { e.stopPropagation(); window.CommentWidget?.openFor(postId, data.name || 'Comments', data.uid); };
  }

  try {
    const { collection, query, orderBy, limit, onSnapshot, getDoc, doc, setDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const { db } = await import('../firebase-init.js');
    onSnapshot(query(collection(db, 'posts', postId, 'comments'), orderBy('createdAtMs', 'desc'), limit(1)),
      snap => { const arr = []; snap.forEach(d => arr.push(d.data())); renderCommentsPreview(arr); },
      () => { commentsPreview.innerHTML = ''; });
  } catch (e) { }

  const actions = document.createElement('div'); actions.className = 'post-actions nkm-post-actions';
  const reacts = ['❤️', '😂', '😍', '🔥', '💯', '🎉'];
  const reactWrap = document.createElement('div'); reactWrap.className = 'react-wrap'; reactWrap.style.position='relative';
  const reactBtn = document.createElement('button'); reactBtn.className='action-btn react-btn'; reactBtn.type='button';
  reactBtn.innerHTML='<span class="react-sample" aria-hidden="true"></span><span class="react-btn-text">React</span>';
  reactBtn.setAttribute('aria-haspopup','true'); reactBtn.setAttribute('aria-expanded','false');
  const reactionPicker = document.createElement('div'); reactionPicker.className='reaction-picker'; reactionPicker.hidden=true; reactionPicker.setAttribute('role','menu');
  reactionPicker.innerHTML = reacts.map(m => `<button class="action-btn mood-btn" type="button" role="menuitem" title="${m}" data-mood="${m}">${m} <span class="mood-count"></span></button>`).join('');
  reactWrap.append(reactBtn, reactionPicker);
  actions.append(reactWrap);

  try {
    const { collection, onSnapshot, query, orderBy, limit, doc, getDoc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
    const { db } = await import('../firebase-init.js');
    onSnapshot(collection(db, 'posts', postId, 'moods'), moodSnap => {
      const moodCounts = {};
      let myMood = null; let total=0;
      moodSnap.forEach(d => {
        const m = d.data()?.mood;
        if (m) { moodCounts[m] = (moodCounts[m] || 0) + 1; total++; }
        if (d.id === currentUser?.uid) myMood = m;
      });
      reactionPicker.querySelectorAll('.mood-btn').forEach(btn => {
        const mood = btn.dataset.mood;
        const c = moodCounts[mood] || 0;
        const span = btn.querySelector('.mood-count');
        if (span) span.textContent = c > 0 ? String(c) : '';
        btn.classList.toggle('liked', myMood === mood);
      });
      const sample = reactBtn.querySelector('.react-sample');
      const rText = reactBtn.querySelector('.react-btn-text');
      if(sample){
        if(total>0){
          const sorted = Object.entries(moodCounts).sort((a,b)=> b[1]-a[1]).slice(0,3);
          sample.innerHTML = sorted.map(([emoji])=>`<span class="react-sample-emoji">${emoji}</span>`).join('') + `<span style="margin-left:4px;font-size:12px;color:var(--ink-muted)">${total}</span>`;
        } else sample.innerHTML='';
      }
      if(rText) rText.textContent = myMood ? `${myMood} React` : 'React';
      reactBtn.classList.toggle('liked', !!myMood);
      reactBtn.setAttribute('aria-expanded', String(!reactionPicker.hidden));
    }, () => { });
  } catch (_) { }

  reactBtn.addEventListener('click', e=>{
    e.stopPropagation(); SoundManager?.moodSelect?.();
    document.querySelectorAll('.reaction-picker').forEach(p=>{ if(p!==reactionPicker) p.hidden=true; });
    document.querySelectorAll('.share-menu.open').forEach(m=>m.classList.remove('open'));
    const isHidden = reactionPicker.hidden;
    reactionPicker.hidden = !isHidden;
    reactBtn.setAttribute('aria-expanded', String(!reactionPicker.hidden));
  });

  reactionPicker.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      SoundManager?.moodSelect?.();
      if (!currentUser) return alert('Login karke react karo.');
      const mood = btn.dataset.mood;
      const { doc, getDoc, setDoc, deleteDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const { db } = await import('../firebase-init.js');
      const moodRef = doc(db, 'posts', postId, 'moods', currentUser.uid);
      try {
        const s = await getDoc(moodRef);
        if (s.exists() && s.data()?.mood === mood) {
          await deleteDoc(moodRef);
        } else {
          await setDoc(moodRef, { uid: currentUser.uid, mood, createdAt: serverTimestamp() });
          if (!s.exists()) {
            await notifyPostOwner?.(data, 'like').catch(() => {});
            onLikeGiven?.(currentUser.uid);
            if (data.uid && data.uid !== currentUser.uid) onLikeReceived?.(data.uid);
          }
        }
        reactionPicker.hidden=true;
      } catch (err) { console.error(err); alert(err.message || 'React failed.'); }
    });
  });

  const comment = document.createElement('button'); comment.className = 'action-btn comment-toggle-btn'; comment.type = 'button'; comment.innerHTML = '💬 <span>Comment</span>';
  comment.addEventListener('click', e => { e.stopPropagation(); window.CommentWidget?.openFor(postId, data.name || 'Comments', data.uid); });

  const share = document.createElement('button'); share.className = 'action-btn'; share.type = 'button'; share.innerHTML = '↗ <span>Share</span>';
  const menu = document.createElement('div'); menu.className = 'share-menu';
  const copy = document.createElement('button'); copy.type = 'button'; copy.textContent = 'Copy link';
  const native = document.createElement('button'); native.type = 'button'; native.textContent = 'Share…';
  const connectedTitle = document.createElement('div'); connectedTitle.className = 'share-title'; connectedTitle.textContent = 'Connected users';
  const connectedBox = document.createElement('div'); connectedBox.className = 'connected-share-list';
  menu.append(copy, native, connectedTitle, connectedBox);
  const postUrl = new URL(`view_post.html?postId=${encodeURIComponent(postId)}`, window.location.href).href;

  async function loadConnected() {
    connectedBox.innerHTML = '<div class="share-loading">Loading connections…</div>';
    if (!currentUser) { connectedBox.innerHTML = '<div class="share-loading">Login to share with connections.</div>'; return; }
    try {
      const { getDoc, collection, query, limit, getDocs } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
      const { db } = await import('../firebase-init.js');
      const cacheKey = `connections_${currentUser.uid}`;
      const { trioCache } = await import('../trio-cache.js');
      let followingIds = trioCache.get(cacheKey);
      if (!followingIds) {
        const snap = await getDocs(collection(db, 'users', currentUser.uid, 'following'));
        followingIds = snap.docs.map(d => d.id);
        trioCache.set(cacheKey, followingIds, trioCache.TTL.SHORT);
      }
      if (!followingIds.length) { connectedBox.innerHTML = '<div class="share-loading">No connected users yet.</div>'; return; }
      const { getCachedUser } = await import('../services/userCache.js');
      const users = (await Promise.all(followingIds.map(id => getCachedUser(id)))).filter(Boolean);
      connectedBox.innerHTML = '';
      users.forEach(u => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'connected-share-user';
        b.innerHTML = `<span class="user-avatar">${u.photoURL ? `<img src="${esc(u.photoURL)}" alt="">` : (u.name || 'U').charAt(0).toUpperCase()}</span><span><strong>${esc(u.name || 'User')}</strong><small>${esc(u.userId || u.uid)}</small></span><b>Send</b>`;
        b.onclick = async () => {
          b.disabled = true; b.lastElementChild.textContent = '…';
          try {
            const me = await getMyProfile(currentUser.uid);
            const cid = [currentUser.uid, u.uid].sort().join('_');
            await addDoc(collection(db, 'privateChats', cid, 'messages'), { uid: currentUser.uid, name: me?.name || currentUser.displayName || 'User', userId: me?.userId || makeUserId(currentUser.uid), text: `📎 Shared a post: ${postUrl}`, createdAt: Date.now(), createdAtMs: Date.now(), sharedPostId: postId });
            await Promise.all([notifyPostOwner?.(data, 'share'), notifyUser?.(u.uid, { type: 'share', actorUid: currentUser.uid, actorName: me?.name || currentUser.displayName || 'Someone', postId })]);
            b.lastElementChild.textContent = 'Sent ✓';
          } catch (err) { console.error(err); b.lastElementChild.textContent = 'Retry'; alert(err.message || 'Share failed.'); }
          finally { b.disabled = false; }
        };
        connectedBox.appendChild(b);
      });
    } catch (err) { console.error(err); connectedBox.innerHTML = '<div class="share-loading">Could not load connections.</div>'; }
  }

  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(postUrl); await notifyPostOwner?.(data, 'share').catch(() => { }); alert('Post link copied ✅'); } catch { prompt('Copy link', postUrl); } menu.classList.remove('open'); });
  native.addEventListener('click', async () => { if (navigator.share) { try { await navigator.share({ title: `${data.name || 'Trio Day'} on Trio Day`, url: postUrl }); await notifyPostOwner?.(data, 'share').catch(() => { }); } catch { } } else { try { await navigator.clipboard.writeText(postUrl); await notifyPostOwner?.(data, 'share').catch(() => { }); alert('Link copied ✅'); } catch { prompt('Copy link', postUrl); } } menu.classList.remove('open'); });
  share.addEventListener('click', e => { e.stopPropagation(); document.querySelectorAll('.share-menu.open').forEach(m => m !== menu && m.classList.remove('open')); menu.classList.toggle('open'); if (menu.classList.contains('open')) loadConnected(); });

  if (data.uid && currentUser?.uid && data.uid === currentUser.uid) {
    const remove = document.createElement('button'); remove.className = 'action-btn danger-action'; remove.type = 'button'; remove.textContent = 'Delete';
    remove.addEventListener('click', async e => {
      e.stopPropagation();
      if (!confirm('Is this post delete karna chahte ho?')) return;
      SoundManager?.delete?.();
      try {
        const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js');
        const { db } = await import('../firebase-init.js');
        await deleteDoc(doc(db, 'posts', postId));
        const { trioCache } = await import('../trio-cache.js');
        trioCache.invalidate(`posts_${currentUser.uid}`);
      } catch (err) {
        console.error(err);
        const msg = String(err?.code || err?.message || '');
        alert(/permission|insufficient/i.test(msg) ? 'Delete blocked: Firebase rules update karo.' : (err.message || 'Delete failed.'));
      }
    });
    actions.append(remove);
  }

  actions.append(comment, share, menu);
  item.append(mediaWrap, content, actions);
  return item;
}