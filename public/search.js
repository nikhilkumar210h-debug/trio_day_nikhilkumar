import { auth } from './firebase-init.js';
import { attachSearch } from './ui/search.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';

const $ = id => document.getElementById(id);
const input = $('searchInput');
const results = $('searchResults');
const empty = $('searchEmpty');

onAuthStateChanged(auth, async u => {
  if (!u) { location.href = 'login.html?redirect=search.html'; return; }
  const api = attachSearch(input, results, {
    onSelect: () => { input.value = ''; empty.style.display = 'none'; }
  });
  input.focus();
  input.addEventListener('input', () => {
    empty.style.display = input.value.trim() ? 'none' : 'block';
  });
  api?.render?.();
});
