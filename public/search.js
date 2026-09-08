import { auth, db } from './firebase-init.js';
import { trioCache } from './trio-cache.js';
import { attachSearch } from './ui/search.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import {
  collection, query, orderBy, limit, getDocs
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const $ = id => document.getElementById(id);
const input = $('searchInput');
const results = $('searchResults');
const empty = $('searchEmpty');
const trendingTags = $('trendingTags');
const trendingPosts = $('trendingPosts');
const trendingList = $('trendingPostsList');

let me = null;

function showTrendingTags(show) { trendingTags.style.display = show ? 'block' : 'none'; }
function showTrendingPosts(show) { trendingPosts.style.display = show ? 'block' : 'none'; }
function showEmpty(show) { empty.style.display = show ? 'block' : 'none'; }
function clearResults() { results.innerHTML = ''; }

async function loadTrendingPosts() {
  const cached = trioCache.get('trending_posts');
  if (cached) { renderTrendingPosts(cached); return; }
  try {
    const snap = await getDocs(query(collection(db, 'posts'), orderBy('createdAtMs', 'desc'), limit(10)));
    const posts = snap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(p => !p.isStory && p.type !== 'story');
    trioCache.set('trending_posts', posts, trioCache.TTL.SHORT);
    renderTrendingPosts(posts);
  } catch (err) { console.error(err); }
}

function renderTrendingPosts(posts) {
  if (!posts.length) { showTrendingPosts(false); return; }
  trendingList.innerHTML = posts.slice(0, 5).map(p => {
    const avatar = p.photoURL ? `<img src="${p.photoURL}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover">` : `<div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#4f46e5);display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;font-size:14px">${(p.name || 'U').charAt(0)}</div>`;
    const likes = p.likesCount || p.likes?.length || 0;
    return `<a href="view_post.html?postId=${encodeURIComponent(p._id)}" style="display:block;padding:12px;border-radius:12px;background:rgba(255,255,255,.02);border:1px solid rgba(148,163,184,.08);margin-bottom:8px;text-decoration:none;color:inherit;transition:background .15s,border-color .15s" onmouseover="this.style.background='rgba(99,102,241,.08)';this.style.borderColor='rgba(99,102,241,.15)'" onmouseout="this.style.background='rgba(255,255,255,.02)';this.style.borderColor='rgba(148,163,184,.08)'">
      <div style="display:flex;gap:10px;align-items:flex-start">
        <div style="flex-shrink:0">${avatar}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">${p.name || 'User'}</div>
          <div style="font-size:13px;color:var(--ink-muted);margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${p.message || ''}</div>
          <div style="font-size:11px;color:var(--ink-dim);margin-top:6px">❤️ ${likes}</div>
        </div>
      </div>
    </a>`;
  }).join('');
  showTrendingPosts(true);
}

onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=search.html'; return; }
  me = u;
  
  input.focus();
  
  const { onSelect } = attachSearch(input, results, {
    onSelect: () => { input.value = ''; showTrendingTags(true); showTrendingPosts(true); clearResults(); showEmpty(false); }
  });
  
  input.addEventListener('focus', () => { if (!input.value.trim()) { showTrendingTags(true); showTrendingPosts(true); clearResults(); showEmpty(false); } });
  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (!q) { showTrendingTags(true); showTrendingPosts(true); clearResults(); showEmpty(false); }
    else { showTrendingTags(false); showTrendingPosts(false); showEmpty(false); }
  });
  
  trendingTags.querySelectorAll('.trend-tag').forEach(btn => {
    btn.addEventListener('click', () => {
      input.value = btn.dataset.tag;
      input.dispatchEvent(new Event('input'));
      input.focus();
    });
  });
  
  await loadTrendingPosts();
});