const CHALLENGES=[
{id:'trip',tag:'CHOICE',q:'You get one free trip tomorrow. Where are you going?',o:['Japan 🇯🇵','Switzerland 🇨🇭','Somewhere unexpected 🌍']},
{id:'hour',tag:'MOOD',q:'You have one free hour tonight. What sounds better?',o:['Talk to someone 💬','Play something 🎮','Learn something 🧠']},
{id:'weekend',tag:'MAKE',q:'You have one weekend to make something. What do you pick?',o:['An app 💻','A game 🎮','Something useful 🛠️']},
{id:'food',tag:'LIFE',q:'Pick one forever.',o:['Street food 🌮','Home food 🍲','Restaurant food 🍽️']}
];
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const host=document.getElementById('challengeList');
CHALLENGES.forEach(c=>{
 const card=document.createElement('article');card.className='challenge-main-card';
 card.innerHTML='<span class="challenge-tag">'+c.tag+'</span><h2>'+esc(c.q)+'</h2><div class="challenge-main-options">'+c.o.map((x,i)=>'<button type="button" data-choice="'+i+'">'+esc(x)+'</button>').join('')+'</div><div class="challenge-result" hidden></div><div class="challenge-links" hidden><a class="nkm-btn nkm-btn--secondary" href="chat.html?challenge='+encodeURIComponent(c.id)+'">Discuss in Chat →</a><a class="nkm-btn nkm-btn--primary" href="all-users.html">Next Challenge →</a></div>';
 const result=card.querySelector('.challenge-result'),links=card.querySelector('.challenge-links');
 card.querySelectorAll('[data-choice]').forEach(btn=>btn.addEventListener('click',()=>{
   const choice=Number(btn.dataset.choice);
   localStorage.setItem('trio_last_challenge',JSON.stringify({id:c.id,choice,at:Date.now()}));
   card.querySelectorAll('[data-choice]').forEach(x=>x.disabled=true);
   result.hidden=false;result.textContent='Locked in ✓ Your choice is saved on this device. Invite someone to compare answers or continue to the next challenge.';
   links.hidden=false;
 }));
 host.appendChild(card);
});