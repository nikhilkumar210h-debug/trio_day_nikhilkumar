import { db } from './firebase-init.js';
import { getDocs, query, where, orderBy, limit } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
import { collection } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const TOPICS = [
  { id: 'career', label: 'Career', icon: '💼', desc: 'Jobs, skills, growth', color: '#8B5CF6' },
  { id: 'study', label: 'Study', icon: '📚', desc: 'Habits, focus, exams', color: '#10B981' },
  { id: 'tech', label: 'Tech', icon: '💻', desc: 'Code, tools, projects', color: '#F59E0B' },
  { id: 'life', label: 'Life', icon: '🌱', desc: 'Choices, values, habits', color: '#EC4899' },
  { id: 'fun', label: 'Fun', icon: '🎮', desc: 'Games, movies, humor', color: '#F97316' },
  { id: 'community', label: 'Community', icon: '🤝', desc: 'People, teams, kindness', color: '#06B6D4' },
  { id: 'college', label: 'College', icon: '🎓', desc: 'Campus, friends, majors', color: '#8B5CF6' }
];

function esc(s) { return String(s??'').replace(/[&<>"']/g,c=>({'&':'&','<':'<','>':'>','"':'"',"'":'''}[c])); }

async function loadTopics() {
  const grid = document.getElementById('topicsGrid');
  
  const cards = await Promise.all(TOPICS.map(async t => {
    try {
      const snap = await getDocs(query(
        collection(db, 'communityTasks'),
        where('category', '==', t.label.charAt(0).toUpperCase() + t.label.slice(1)),
        where('status', '==', 'active'),
        where('kind', '==', 'challenge'),
        orderBy('createdAtMs', 'desc'),
        limit(1)
      ));
      t.count = snap.size;
    } catch { t.count = 0; }
    
    return `<a href="challenge.html?category=${esc(t.id)}" class="nkm-card" style="padding:24px;text-decoration:none;color:inherit;transition:transform .15s,box-shadow .15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
      <div style="width:48px;height:48px;border-radius:14px;display:grid;place-items:center;font-size:24px;background:${t.color}20;border:1px solid ${t.color}40;color:${t.color};margin-bottom:12px">${t.icon}</div>
      <strong style="font-size:16px;display:block;margin-bottom:4px">${esc(t.label)}</strong>
      <small style="color:var(--color-ink-muted);display:block;margin-bottom:8px">${esc(t.desc)}</small>
      <span class="nkm-badge" style="background:${t.color}20;color:${t.color};border-color:${t.color}40">${t.count || 0} active</span>
    </a>`;
  }));
  
  grid.innerHTML = cards.join('');
}

loadTopics();