import{doc,getDoc,setDoc,onSnapshot,runTransaction}from'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';import{getBuildConfig}from'./activity-catalog.js';
const esc=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML};
const stateRef=(db,roomId)=>doc(db,'rooms',roomId,'state','main');
function getBuildRuntimeConfig(activity){
 const custom=activity?.interaction?.kind==='build' ? activity.interaction : null;
 const original=getBuildConfig(activity?.engineId || activity?.id);
 if(!custom || !['order','allocate','grid','assign'].includes(custom.mechanic)) return original;
 if(custom.mechanic==='order') return {mechanic:'order',items:(custom.items||[]),target:(custom.items||[])};
 if(custom.mechanic==='allocate') return {mechanic:'allocate',budget:Number(custom.budget)||100,items:(custom.items||[]),mins:(custom.items||[]).map(x=>Number(x?.[1])||0)};
 if(custom.mechanic==='grid') return {mechanic:'grid',size:4,required:(custom.required||[]),blocked:(custom.blocked||[]),adjacentPairs:(custom.adjacentPairs||[])};
 return {mechanic:'assign',people:(custom.people||[]),roles:(custom.roles||[]),correct:(custom.correct||{})};
}
function initialState(activity){
 const cfg=getBuildRuntimeConfig(activity);
 if(!cfg)return null;
 const st={order:(cfg.items||[]).slice(),alloc:{},placed:{},assign:{}};
 if(cfg.mechanic==='order'&&st.order.length>2){
   const shift=((activity.id||'b0').charCodeAt(1)||1)%st.order.length;
   st.order=st.order.slice(shift).concat(st.order.slice(0,shift));
   if(st.order.every((x,i)=>x===cfg.target?.[i]))st.order.reverse();
 }
 return st;
}
export async function mountSharedBuildWorkspace(root,{db,roomId,activity,me,onStateChange}){
 const cfg=getBuildRuntimeConfig(activity);
 if(!cfg){
   root.innerHTML='<div class="room-forge-note">This activity does not have a shared board configuration yet. The room can still use chat and the activity page.</div>';
   return()=>{};
 }

 root.innerHTML='<div class="room-forge-head"><div class="room-forge-title"><strong>Shared Forge Board</strong><small>Everyone in this room sees the same board.</small></div><span class="room-forge-sync"><i></i> SYNCED</span></div><div id="roomForgeBody" class="room-forge-body"></div><div id="roomForgeLast" class="room-forge-last">Waiting for the shared board…</div>';
 let current=null,tool=0;
 const ref=stateRef(db,roomId);
 const write=async(next)=>{
   await runTransaction(db,async tx=>{
     const snap=await tx.get(ref);
     const latest=snap.exists()?snap.data():{state:initialState(activity)||{}};
     const merged={...(latest.state||{}),...next};
     tx.set(ref,{state:merged,updatedBy:me.uid,updatedAtMs:Date.now(),version:Number(latest.version||0)+1,activityId:activity.id,mechanic:cfg.mechanic},{merge:true});
     current={...merged,version:Number(latest.version||0)+1,updatedBy:me.uid,updatedAtMs:Date.now()};
   });
 };
 const pass=async()=>{await write({passed:true,passedBy:me.uid,passedAtMs:Date.now()});onStateChange?.({passed:true})};
 const render=state=>{current=state;const body=root.querySelector('#roomForgeBody');if(!body)return;
  if(cfg.mechanic==='order'){body.innerHTML='<div class="forge-order-list">'+state.order.map((item,i)=>'<div class="forge-order-row"><span class="forge-order-label">'+esc(item)+'</span><button class="forge-mini-btn" data-move="'+i+'" data-dir="-1">↑</button><button class="forge-mini-btn" data-move="'+i+'" data-dir="1">↓</button></div>').join('')+'</div><div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="roomCheck">Check shared build</button></div><div id="roomResult" class="room-forge-status">'+(state.passed?'Shared build accepted ✓':'')+'</div>';
   body.querySelectorAll('[data-move]').forEach(b=>b.onclick=async()=>{const i=Number(b.dataset.move),to=i+Number(b.dataset.dir);if(to<0||to>=state.order.length)return;const order=state.order.slice();[order[i],order[to]]=[order[to],order[i]];await write({order})});
   body.querySelector('#roomCheck').onclick=()=>{const ok=(cfg.target||[]).length===state.order.length&&(cfg.target||[]).every((x,i)=>x===state.order[i]);const out=body.querySelector('#roomResult');out.textContent=ok?'Shared build accepted ✓':'Not yet — keep working with the room.';out.className='room-forge-status '+(ok?'ok':'bad');if(ok)pass()};
  }else if(cfg.mechanic==='allocate'){body.innerHTML='<div class="forge-budget-list">'+cfg.items.map((it,i)=>'<label class="forge-budget-row"><strong>'+esc(it[0])+'</strong><input type="number" min="0" max="'+cfg.budget+'" value="'+Number(state.alloc?.[i]||0)+'" data-alloc="'+i+'"><span></span></label>').join('')+'</div><div class="forge-total">Total: <strong id="roomTotal">0</strong> / '+cfg.budget+'</div><div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="roomCheck">Check allocation</button></div><div id="roomResult" class="room-forge-status">'+(state.passed?'Shared allocation accepted ✓':'')+'</div>';const updateTotal=()=>{const vals=[...body.querySelectorAll('[data-alloc]')].map(x=>Math.max(0,Number(x.value)||0));body.querySelector('#roomTotal').textContent=vals.reduce((a,b)=>a+b,0)};body.querySelectorAll('[data-alloc]').forEach(input=>input.onchange=async()=>{const alloc={...(state.alloc||{})};alloc[input.dataset.alloc]=Math.max(0,Number(input.value)||0);await write({alloc})});updateTotal();body.querySelector('#roomCheck').onclick=()=>{const total=Object.values(state.alloc||{}).reduce((a,b)=>a+Number(b||0),0);const mins=cfg.mins||[];const ok=total<=cfg.budget&&cfg.items.every((it,i)=>Number(state.alloc?.[i]||0)>=Number(mins[i]||0));const out=body.querySelector('#roomResult');out.textContent=ok?'Shared allocation accepted ✓':'Adjust the shared allocation to satisfy the minimums and budget.';out.className='room-forge-status '+(ok?'ok':'bad');if(ok)pass()};
  }
  else if(cfg.mechanic==='grid'){const blocked=new Set(cfg.blocked||[]);body.innerHTML='<div class="room-forge-grid-tools">'+cfg.required.map((x,i)=>'<button class="room-forge-grid-tool '+(i===tool?'active':'')+'" data-tool="'+i+'">'+esc(x)+'</button>').join('')+'</div><div class="room-forge-grid">'+Array.from({length:cfg.size*cfg.size},(_,i)=>'<button type="button" class="room-forge-cell '+(blocked.has(i)?'blocked':'')+'" data-cell="'+i+'" '+(blocked.has(i)?'disabled':'')+'>'+esc(state.placed?.[i]!==undefined?cfg.required[state.placed[i]]:'')+'</button>').join('')+'</div><div class="room-forge-actions" style="margin-top:10px"><button class="room-forge-btn room-forge-btn--primary" id="roomCheck">Check layout</button></div><div id="roomResult" class="room-forge-status">'+(state.passed?'Shared layout accepted ✓':'')+'</div>';body.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{tool=Number(b.dataset.tool);render(current)});body.querySelectorAll('[data-cell]').forEach(cell=>cell.onclick=async()=>{const p={...(state.placed||{})};const idx=Number(cell.dataset.cell);if(p[idx]!==undefined)delete p[idx];else p[idx]=tool;await write({placed:p})});body.querySelector('#roomCheck').onclick=()=>{const placed=state.placed||{},keys=Object.keys(placed),unique=new Set(Object.values(placed)).size===cfg.required.length,safe=keys.every(k=>!blocked.has(Number(k))),positions={};Object.entries(placed).forEach(([k,v])=>positions[cfg.required[v]]=Number(k));const adj=(a,b)=>(Math.abs(a-b)===1&&Math.floor(a/cfg.size)===Math.floor(b/cfg.size))||Math.abs(a-b)===cfg.size;const adjOk=(cfg.adjacentPairs||[]).every(([a,b])=>positions[a]!==undefined&&positions[b]!==undefined&&adj(positions[a],positions[b]));const ok=keys.length===cfg.required.length&&unique&&safe&&adjOk;const out=body.querySelector('#roomResult');out.textContent=ok?'Shared layout accepted ✓':'Use every required piece once and respect the board constraints.';out.className='room-forge-status '+(ok?'ok':'bad');if(ok)pass()};
  }
  else if(cfg.mechanic==='assign'){body.innerHTML='<div class="forge-assign-list">'+cfg.people.map(person=>'<label class="forge-assign-row"><span>'+esc(person)+'</span><select data-person="'+esc(person)+'"><option value="">Choose role…</option>'+cfg.roles.map(r=>'<option '+(state.assign?.[person]===r?'selected':'')+'>'+esc(r)+'</option>').join('')+'</select></label>').join('')+'</div><div class="room-forge-actions"><button class="room-forge-btn room-forge-btn--primary" id="roomCheck">Check team</button></div><div id="roomResult" class="room-forge-status">'+(state.passed?'Team accepted ✓':'')+'</div>';body.querySelectorAll('[data-person]').forEach(s=>s.onchange=async()=>{const assign={...(state.assign||{})};assign[s.dataset.person]=s.value;await write({assign})});body.querySelector('#roomCheck').onclick=()=>{const ok=cfg.people.every(p=>state.assign?.[p]===cfg.correct[p])&&new Set(Object.values(state.assign||{})).size===cfg.roles.length;const out=body.querySelector('#roomResult');out.textContent=ok?'Team accepted ✓':'The shared assignment still has conflicts.';out.className='room-forge-status '+(ok?'ok':'bad');if(ok)pass()};
  }
  const last=root.querySelector('#roomForgeLast');if(last)last.textContent=current.passed?'Shared solution accepted by the room · '+new Date(current.passedAtMs||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):(current.updatedBy?'Last updated by '+(current.updatedBy===me.uid?'you':'another room member')+' · synced '+new Date(current.updatedAtMs||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Shared board initialized');
 };
 const unsub=onSnapshot(ref,async snap=>{if(snap.exists()){const data=snap.data();const base=initialState(activity);render({...base,...(data.state||{}),version:data.version,updatedBy:data.updatedBy,updatedAtMs:data.updatedAtMs})}else{const init=initialState(activity);if(init)await setDoc(ref,{state:init,updatedBy:me.uid,updatedAtMs:Date.now(),version:1,activityId:activity.id,mechanic:cfg.mechanic},{merge:true})}},err=>{root.innerHTML='<div class="room-forge-note">Shared workspace is unavailable right now. Room chat is still available.</div>';console.error(err)});
 return unsub;
}