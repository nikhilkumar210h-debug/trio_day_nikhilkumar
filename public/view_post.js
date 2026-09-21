import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const box = document.getElementById('postContainer');
const storyId = new URLSearchParams(location.search).get('postId');

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = `login.html?redirect=${encodeURIComponent(location.pathname + location.search)}`;
    return;
  }
  if (!storyId) {
    box.textContent = 'Story not found.';
    return;
  }

  try {
    const snap = await getDoc(doc(db, 'posts', storyId));
    if (!snap.exists()) {
      box.textContent = 'Story not found.';
      return;
    }

    const item = { ...snap.data(), _id: snap.id };
    if (item.type !== 'story' || item.isStory !== true) {
      box.textContent = 'Story not found.';
      return;
    }

    if (Number(item.expiresAtMs) && Number(item.expiresAtMs) <= Date.now()) {
      box.textContent = 'This story has expired.';
      return;
    }

    if (window.buildStoryCard) {
      box.appendChild(window.buildStoryCard(item));
    } else {
      box.textContent = item.message || 'Story';
    }
  } catch (err) {
    console.error(err);
    box.textContent = 'Could not load this story.';
  }
});
