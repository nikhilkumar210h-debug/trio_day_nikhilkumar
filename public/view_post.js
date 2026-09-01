import { auth, db } from './firebase-init.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';
const box=document.getElementById('postContainer');
const postId=new URLSearchParams(location.search).get('postId');
onAuthStateChanged(auth,async user=>{
  if(!user){location.href=`login.html?redirect=${encodeURIComponent(location.pathname+location.search)}`;return}
  if(!postId){box.textContent='Post not found.';return}
  try{
    const snap=await getDoc(doc(db,'posts',postId));
    if(!snap.exists()){box.textContent='Post not found.';return}
    const item={...snap.data(),_id:snap.id};
    if(item.type==='reel'){box.textContent='This post type is no longer supported.';return}
    if(window.buildFeedItem)box.appendChild(window.buildFeedItem(item));else box.textContent=item.message||'';
  }catch(err){console.error(err);box.textContent='Could not load this post.'}
});
