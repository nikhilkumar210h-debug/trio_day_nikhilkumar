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
 const baseRoles=Array.isArray(activity.roles)&&activity.roles.length ? activity.roles : ['Planner','Maker','Reviewer'];
 const availableRoles=[...new Set([...baseRoles,...Array.from({length:8},(_,i)=>'Contributor '+(i+1))])];
 const write=async(next)=>{
   await runTransaction(db,async tx=>{
     const snap=await tx.get(ref);
     const latest=snap.exists()?snap.data():{state:initialState(activity)||{}};
     const merged={...(latest.state||{}),...next};
     tx.set(ref,{state:merged,updatedBy:me.uid,updatedAtMs:Date.now(),version:Number(latest.version||0)+1,activityId:activity.id,mechanic:cfg.mechanic},{merge:true});
     current={...merged,version:Number(latest.version||0)+1,updatedBy:me.uid,updatedAtMs:Date.now()};
   });
 };
 const getParticipantIds=()=>[...root.closest('.room-grid')?.querySelectorAll('.room-member[data-uid]')||[]]
   .map(el=>el.dataset.uid).filter(Boolean);
 const pass=async()=>{
   const teamRoles=current?.teamRoles||{};
   const participantIds=getParticipantIds();
   const ids=participantIds.length?participantIds:[me.uid];
   const assigned=ids.map(uid=>teamRoles[uid]).filter(Boolean);
   const uniqueRoles=new Set(assigned);
   const everyoneAssigned=ids.every(uid=>typeof teamRoles[uid]==='string'&&teamRoles[uid].trim());
   const uniquePerPerson=uniqueRoles.size===ids.length;
   if(!everyoneAssigned||!uniquePerPerson){
     showBuildRoleWarning(ids.length);
     return;
   }
   await write({passed:true,passedBy:me.uid,passedAtMs:Date.now()});
   onStateChange?.({passed:true});
 };
 const showBuildRoleWarning=(count=2)=>{
   const out=root.querySelector('.room-forge-status');
   if(out){
     out.textContent=count>1
       ? 'Everyone in the room must claim a different role before the team can finish.'
       : 'Claim your role before finishing the build.';
     out.className='room-forge-status bad';
   }
 };
 const render=state=>{
  current=state;
  const body=root.querySelector('#roomForgeBody');
  if(!body)return;

  const myRole=state.teamRoles?.[me.uid]||'';
  const claimedRoles=new Set(Object.values(state.teamRoles||{}));
  const roleHtml='<div class="room-team-roles">'+
    '<div class="room-team-roles-head"><strong>Pick your job</strong><small>Claim one role, then work on the shared board.</small></div>'+
    '<div class="room-team-role-list">'+
      availableRoles.map(role=>'<button type="button" class="room-team-role '+(myRole===role?'is-active':'')+'" data-role="'+esc(role)+'" '+(claimedRoles.has(role)&&myRole!==role?'disabled':'')+'>'+esc(role)+'</button>').join('')+
    '</div></div>';

  let boardHtml='';
  if(cfg.mechanic==='order'){
    boardHtml='<div class="forge-order-list">'+state.order.map((item,i)=>
      '<div class="forge-order-row"><span class="forge-order-label">'+esc(item)+'</span>'+
      '<button type="button" class="forge-mini-btn" data-move="'+i+'" data-dir="-1" '+(state.passed?'disabled':'')+'>↑</button>'+
      '<button type="button" class="forge-mini-btn" data-move="'+i+'" data-dir="1" '+(state.passed?'disabled':'')+'>↓</button></div>'
    ).join('')+'</div>'+
    '<div class="room-forge-actions"><button type="button" class="room-forge-btn room-forge-btn--primary" id="roomCheck" '+(state.passed?'disabled':'')+'>Check shared build</button></div>'+
    '<div id="roomResult" class="room-forge-status '+(state.passed?'ok':'')+'">'+(state.passed?'Shared build accepted ✓':'')+'</div>';
  }else if(cfg.mechanic==='allocate'){
    boardHtml='<div class="forge-budget-list">'+cfg.items.map((it,i)=>
      '<label class="forge-budget-row"><strong>'+esc(it[0])+'</strong><input type="number" min="0" max="'+cfg.budget+'" value="'+Number(state.alloc?.[i]||0)+'" data-alloc="'+i+'" '+(state.passed?'disabled':'')+'><span></span></label>'
    ).join('')+'</div>'+
    '<div class="forge-total">Total: <strong id="roomTotal">0</strong> / '+cfg.budget+'</div>'+
    '<div class="room-forge-actions"><button type="button" class="room-forge-btn room-forge-btn--primary" id="roomCheck" '+(state.passed?'disabled':'')+'>Check allocation</button></div>'+
    '<div id="roomResult" class="room-forge-status '+(state.passed?'ok':'')+'">'+(state.passed?'Shared allocation accepted ✓':'')+'</div>';
  }else if(cfg.mechanic==='grid'){
    const blocked=new Set(cfg.blocked||[]);
    boardHtml='<div class="room-forge-grid-tools">'+cfg.required.map((x,i)=>
      '<button type="button" class="room-forge-grid-tool '+(i===tool?'active':'')+'" data-tool="'+i+'" '+(state.passed?'disabled':'')+'>'+esc(x)+'</button>'
    ).join('')+'</div>'+
    '<div class="room-forge-grid">'+Array.from({length:cfg.size*cfg.size},(_,i)=>
      '<button type="button" class="room-forge-cell '+(blocked.has(i)?'blocked':'')+'" data-cell="'+i+'" '+(blocked.has(i)||state.passed?'disabled':'')+'>'+esc(state.placed?.[i]!==undefined?cfg.required[state.placed[i]]:'')+'</button>'
    ).join('')+'</div>'+
    '<div class="room-forge-actions" style="margin-top:10px"><button type="button" class="room-forge-btn room-forge-btn--primary" id="roomCheck" '+(state.passed?'disabled':'')+'>Check layout</button></div>'+
    '<div id="roomResult" class="room-forge-status '+(state.passed?'ok':'')+'">'+(state.passed?'Shared layout accepted ✓':'')+'</div>';
  }else if(cfg.mechanic==='assign'){
    boardHtml='<div class="forge-assign-list">'+cfg.people.map(person=>
      '<label class="forge-assign-row"><span>'+esc(person)+'</span><select data-person="'+esc(person)+'" '+(state.passed?'disabled':'')+'><option value="">Choose role…</option>'+
      cfg.roles.map(role=>'<option '+(state.assign?.[person]===role?'selected':'')+'>'+esc(role)+'</option>').join('')+
      '</select></label>'
    ).join('')+'</div>'+
    '<div class="room-forge-actions"><button type="button" class="room-forge-btn room-forge-btn--primary" id="roomCheck" '+(state.passed?'disabled':'')+'>Check team</button></div>'+
    '<div id="roomResult" class="room-forge-status '+(state.passed?'ok':'')+'">'+(state.passed?'Team accepted ✓':'')+'</div>';
  }

  body.innerHTML=roleHtml+boardHtml;

  body.querySelectorAll('[data-role]').forEach(button=>button.onclick=async()=>{
    if(current.passed)return;
    const role=button.dataset.role;
    const teamRoles={...(current.teamRoles||{})};
    if(myRole===role) delete teamRoles[me.uid];
    else {
      Object.keys(teamRoles).forEach(uid=>{if(uid!==me.uid&&teamRoles[uid]===role)delete teamRoles[uid]});
      teamRoles[me.uid]=role;
    }
    await write({teamRoles});
  });

  if(cfg.mechanic==='order'){
    body.querySelectorAll('[data-move]').forEach(button=>button.onclick=async()=>{
      const i=Number(button.dataset.move),to=i+Number(button.dataset.dir);
      if(current.passed||to<0||to>=current.order.length)return;
      const order=current.order.slice();
      [order[i],order[to]]=[order[to],order[i]];
      await write({order});
    });
    body.querySelector('#roomCheck')?.addEventListener('click',async()=>{
      const target=cfg.target||[];
      const ok=target.length===current.order.length&&target.every((x,i)=>x===current.order[i]);
      const out=body.querySelector('#roomResult');
      out.textContent=ok?'Build arrangement is correct.':'Not yet — compare the dependency order with the team.';
      out.className='room-forge-status '+(ok?'ok':'bad');
      if(ok)await pass();
    });
  }else if(cfg.mechanic==='allocate'){
    const updateTotal=()=>{
      const vals=[...body.querySelectorAll('[data-alloc]')].map(input=>Math.max(0,Number(input.value)||0));
      const total=vals.reduce((sum,v)=>sum+v,0);
      const totalEl=body.querySelector('#roomTotal');
      if(totalEl)totalEl.textContent=String(total);
    };
    body.querySelectorAll('[data-alloc]').forEach(input=>input.addEventListener('input',updateTotal));
    updateTotal();
    body.querySelectorAll('[data-alloc]').forEach(input=>input.addEventListener('change',async()=>{
      if(current.passed)return;
      const alloc={...(current.alloc||{})};
      alloc[input.dataset.alloc]=Math.max(0,Number(input.value)||0);
      await write({alloc});
    }));
    body.querySelector('#roomCheck')?.addEventListener('click',()=>{
      const total=Object.values(current.alloc||{}).reduce((sum,v)=>sum+Number(v||0),0);
      const mins=cfg.mins||[];
      const ok=total<=Number(cfg.budget||0)&&cfg.items.every((it,i)=>Number(current.alloc?.[i]||0)>=Number(mins[i]||0));
      const out=body.querySelector('#roomResult');
      out.textContent=ok?'Allocation accepted — essentials are covered.':'Adjust the shared budget and try again.';
      out.className='room-forge-status '+(ok?'ok':'bad');
      if(ok)pass();
    });
  }else if(cfg.mechanic==='grid'){
    body.querySelectorAll('[data-tool]').forEach(button=>button.onclick=()=>{if(current.passed)return;tool=Number(button.dataset.tool);render(current)});
    body.querySelectorAll('[data-cell]').forEach(cell=>cell.onclick=async()=>{
      if(current.passed||cell.disabled)return;
      const placed={...(current.placed||{})};
      const idx=Number(cell.dataset.cell);
      if(placed[idx]!==undefined)delete placed[idx];
      else placed[idx]=tool;
      await write({placed});
    });
    body.querySelector('#roomCheck')?.addEventListener('click',()=>{
      const placed=current.placed||{},keys=Object.keys(placed);
      const unique=new Set(Object.values(placed)).size===cfg.required.length;
      const safe=keys.every(k=>!new Set(cfg.blocked||[]).has(Number(k)));
      const positions={};
      Object.entries(placed).forEach(([k,v])=>{positions[cfg.required[v]]=Number(k)});
      const adjacent=(a,b)=>(Math.abs(a-b)===1&&Math.floor(a/cfg.size)===Math.floor(b/cfg.size))||Math.abs(a-b)===cfg.size;
      const adjOk=(cfg.adjacentPairs||[]).every(([a,b])=>positions[a]!==undefined&&positions[b]!==undefined&&adjacent(positions[a],positions[b]));
      const ok=keys.length===cfg.required.length&&unique&&safe&&adjOk;
      const out=body.querySelector('#roomResult');
      out.textContent=ok?'Layout accepted — the team placed every zone safely.':'The layout still breaks a board constraint.';
      out.className='room-forge-status '+(ok?'ok':'bad');
      if(ok)pass();
    });
  }else if(cfg.mechanic==='assign'){
    body.querySelectorAll('[data-person]').forEach(select=>select.onchange=async()=>{
      if(current.passed)return;
      const assign={...(current.assign||{})};
      assign[select.dataset.person]=select.value;
      await write({assign});
    });
    body.querySelector('#roomCheck')?.addEventListener('click',()=>{
      const assigned=cfg.people.every(person=>cfg.roles.includes(current.assign?.[person]));
      const unique=new Set(Object.values(current.assign||{})).size===cfg.roles.length;
      const allowed=cfg.people.every(person=>!(cfg.forbidden?.[person]||[]).includes(current.assign?.[person]));
      const ok=assigned&&unique&&allowed;
      const out=body.querySelector('#roomResult');
      out.textContent=ok?'Team accepted — every role is covered.':'There is still a role conflict or missing assignment.';
      out.className='room-forge-status '+(ok?'ok':'bad');
      if(ok)pass();
    });
  }

  const last=root.querySelector('#roomForgeLast');
  if(last)last.textContent=current.passed
    ? 'Team solution accepted ✓ · '+new Date(current.passedAtMs||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
    : (current.updatedBy
      ? 'Last update by '+(current.updatedBy===me.uid?'you':'another teammate')+' · '+new Date(current.updatedAtMs||Date.now()).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
      : 'Shared board initialized');
 };
 const unsub=onSnapshot(ref,async snap=>{if(snap.exists()){const data=snap.data();const base=initialState(activity);render({...base,...(data.state||{}),version:data.version,updatedBy:data.updatedBy,updatedAtMs:data.updatedAtMs})}else{const init=initialState(activity);if(init)await setDoc(ref,{state:init,updatedBy:me.uid,updatedAtMs:Date.now(),version:1,activityId:activity.id,mechanic:cfg.mechanic},{merge:true})}},err=>{root.innerHTML='<div class="room-forge-note">Shared workspace is unavailable right now. Room chat is still available.</div>';console.error(err)});
 return unsub;
}