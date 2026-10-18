(() => {
  const VERSION = '20260923-core-loop1';
  const addStyle = () => {
    if (document.querySelector(`link[data-trio-core-style="${VERSION}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `styles/core-loop.css?v=${VERSION}`;
    link.dataset.trioCoreStyle = VERSION;
    document.head.appendChild(link);
  };
  function enhanceToday() {
    const focus = document.getElementById('todayFocus');
    if (!focus || document.querySelector('.core-loop-continue')) return;
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem('trio_last_challenge') || 'null'); } catch {}
    if (!saved?.id) return;
    const bar = document.createElement('aside');
    bar.className = 'core-loop-continue';
    bar.innerHTML = '<div><span class="core-loop-eyebrow">YOUR LAST MOVE</span><strong>You already picked an answer.</strong><small>See the community split and explain why you chose it.</small></div><a class="nkm-btn nkm-btn--primary nkm-btn--sm" href="index.html">Browse Activities →</a>';
    focus.parentNode.insertBefore(bar, focus.nextSibling);
  }
  function enhanceDiscover() {
    const shell = document.querySelector('.discover-shell');
    if (!shell || shell.querySelector('.core-loop-discover')) return;
    const section = document.createElement('section');
    section.className = 'core-loop-discover';
    section.innerHTML = '<div><span class="core-loop-eyebrow">THE TRIO LOOP</span><h2>Pick → compare → connect.</h2><p>Start with one quick choice. The useful part is what happens after you answer.</p></div><div class="core-loop-discover-actions"><a class="nkm-btn nkm-btn--primary" href="index.html">Browse Activities</a><a class="nkm-btn nkm-btn--secondary" href="search.html">Find people</a></div>';
    const hub = shell.querySelector('.challenge-hub');
    (hub || shell.firstElementChild)?.after(section);
  }
  function enhanceProfile() {
    const bio = document.getElementById('profileBio');
    if (!bio || document.querySelector('.core-loop-bio-cta')) return;
    if (new URLSearchParams(location.search).has('uid')) return;
    if (!bio.textContent.trim().toLowerCase().includes('no bio')) return;
    const actions = document.getElementById('profileActions');
    if (!actions) return;
    // A <button> (never <a href="#">) so this CTA can never navigate to "/profile#".
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'nkm-btn nkm-btn--secondary core-loop-bio-cta';
    btn.textContent = '+ Add a short bio';
    btn.setAttribute('aria-label', 'Add a short profile bio');
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      // Open the bio editor directly — profile.js owns the edit modal. Works
      // even when #profileMenuBtn is hidden or not wired yet.
      window.dispatchEvent(new CustomEvent('trio:open-bio-editor'));
    });
    actions.appendChild(btn);
  }
  function enhanceStoryEmpty() {
    const empty = document.getElementById('heroStoriesEmpty');
    if (!empty || empty.dataset.coreLoopDone) return;
    empty.dataset.coreLoopDone = '1';
    empty.innerHTML = '<strong>No stories yet</strong><span>Share today’s moment or be the first to start the strip.</span>';
  }
  function boot() {
    addStyle(); enhanceToday(); enhanceDiscover(); enhanceProfile(); enhanceStoryEmpty();
    const observer = new MutationObserver(() => { enhanceToday(); enhanceProfile(); enhanceStoryEmpty(); });
    observer.observe(document.body, {subtree:true, childList:true});
    window.setTimeout(() => observer.disconnect(), 8000);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();