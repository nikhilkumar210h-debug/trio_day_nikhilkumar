import{getBuildConfig}from'./activity-catalog.js';
const esc=s=>{const d=document.createElement('div');d.textContent=String(s??'');return d.innerHTML};
export function renderBuildWorkspace(root,activity,onPass){
 const selectedMechanic=activity.interaction?.kind==='build' ? String(activity.interaction.mechanic||'') : '';
 const generic={
  order:{mechanic:'order',items:['Start','Step 1','Step 2','Finish'],target:['Start','Step 1','Step 2','Finish']},
  allocate:{mechanic:'allocate',budget:100,items:[['Core',30],['Support',25],['Backup',10],['Extra',5]],mins:[30,25,10,5]},
  grid:{mechanic:'grid',size:4,required:['Start','Work','Check'],blocked:[5,6,9],adjacentPairs:[['Start','Work'],['Work','Check']]},
  assign:{mechanic:'assign',people:['Person 1','Person 2','Person 3','Person 4'],roles:['Planner','Builder','Checker','Presenter'],correct:{'Person 1':'Planner','Person 2':'Builder','Person 3':'Checker','Person 4':'Presenter'}}
 };
 const custom=activity.interaction?.kind==='build' ? activity.interaction : null;
 const original=getBuildConfig(activity.engineId || activity.id);
 const cfg=custom && ['order','allocate','grid','assign'].includes(custom.mechanic)
   ? (custom.mechanic==='order'
      ? {mechanic:'order',items:(custom.items||[]),target:(custom.items||[])}
      : custom.mechanic==='allocate'
        ? {mechanic:'allocate',budget:Number(custom.budget)||100,items:(custom.items||[]),mins:(custom.items||[]).map(x=>Number(x?.[1])||0)}
        : custom.mechanic==='grid'
          ? {mechanic:'grid',size:4,required:(custom.required||[]),blocked:(custom.blocked||[]),adjacentPairs:(custom.adjacentPairs||[])}
          : {mechanic:'assign',people:(custom.people||[]),roles:(custom.roles||[]),correct:(custom.correct||{})})
   : (selectedMechanic && generic[selectedMechanic] && original?.mechanic!==selectedMechanic ? generic[selectedMechanic] : original);
 if(!cfg){root.hidden=true;return null} root.hidden=false; let passed=false;
 const baseOrder=cfg.items?.slice()||[];let order=baseOrder.slice();if(order.length>2){const shift=((activity.engineId || activity.id||'b0').charCodeAt(1)||1)%order.length;order=order.slice(shift).concat(order.slice(0,shift));if(order.every((x,i)=>x===cfg.target?.[i]))order.reverse()}const state={order,alloc:[],selectedTool:null,placed:{},assign:{}};
 const setResult=(text,ok,evidenceState=null)=>{root.querySelector('.forge-result').textContent=text;root.querySelector('.forge-result').className='forge-result '+(ok?'ok':'bad');if(ok&&!passed){passed=true;onPass?.(true,{buildEvidence:{mechanic:cfg.mechanic,state:evidenceState||{order:state.order.slice(0,8),allocation:state.alloc.slice(0,8),assign:{...state.assign},positions:{}}}})}};
 root.innerHTML='<div class="forge-workspace-head"><div><h3>Forge Board</h3><p>Actually build the solution. Your result is checked against the activity constraints.</p></div><span class="forge-pill">LIVE LOGIC</span></div><div class="forge-board-body"></div><div class="forge-result"></div>';
 const body=root.querySelector('.forge-board-body');
 if(cfg.mechanic==='order'){
   const render=()=>{
     body.innerHTML='<div class="forge-order-list">'+state.order.map((item,i)=>'<div class="forge-order-row"><span class="forge-order-label">'+esc(item)+'</span><button class="forge-mini-btn" data-move="'+i+'" data-dir="-1" aria-label="Move up">↑</button><button class="forge-mini-btn" data-move="'+i+'" data-dir="1" aria-label="Move down">↓</button></div>').join('')+'</div><button class="forge-check" id="forgeCheck">Check build</button>';
     body.querySelectorAll('[data-move]').forEach(b=>b.onclick=()=>{
       const i=Number(b.dataset.move),to=i+Number(b.dataset.dir);
       if(to<0||to>=state.order.length)return;
       [state.order[i],state.order[to]]=[state.order[to],state.order[i]];
       render();
     });
     body.querySelector('#forgeCheck').onclick=()=>{
       const target=cfg.target||[];
       const ok=target.length===state.order.length&&target.every((x,i)=>x===state.order[i]);
       setResult(ok?'Build accepted — every step is in the correct order.':'Not quite. Check the constraints and try another arrangement.',ok,{order:state.order.slice(0,8)});
     };
   };
   render();
 }else if(cfg.mechanic==='allocate'){
   body.innerHTML='<div class="forge-budget-list">'+cfg.items.map((it,i)=>'<label class="forge-budget-row"><strong>'+esc(it[0])+'</strong><input type="number" min="0" max="'+cfg.budget+'" value="0" data-alloc="'+i+'"><span></span></label>').join('')+'</div><div class="forge-total">Total: <strong id="forgeTotal">0</strong> / '+cfg.budget+'</div><button class="forge-check" id="forgeCheck">Check allocation</button>';
   const update=()=>{let total=0;body.querySelectorAll('[data-alloc]').forEach((input,i)=>{const v=Math.max(0,Number(input.value)||0);state.alloc[i]=v;total+=v});body.querySelector('#forgeTotal').textContent=total};
   body.querySelectorAll('[data-alloc]').forEach(i=>i.addEventListener('input',update));update();
   body.querySelector('#forgeCheck').onclick=()=>{const total=Object.values(state.alloc).reduce((a,b)=>a+b,0);const mins=cfg.mins||cfg.items.map(it=>Number(it[1])||0);const ok=total<=cfg.budget&&cfg.items.every((it,i)=>Number(state.alloc[i]||0)>=Number(mins[i]||0));setResult(ok?'Allocation works — the essentials fit inside the budget.':'One or more required minimums are missing, or the budget is exceeded.',ok,{allocation:state.alloc.slice(0,8)})};
 }else if(cfg.mechanic==='grid'){
   const blocked=new Set(cfg.blocked||[]);const adjacent=(a,b)=>Math.abs(a-b)===1&&Math.floor(a/cfg.size)===Math.floor(b/cfg.size)||Math.abs(a-b)===cfg.size;let html='<div class="forge-grid-tools">'+cfg.required.map((x,i)=>'<button class="forge-grid-tool '+(i===0?'active':'')+'" data-tool="'+i+'">'+esc(x)+'</button>').join('')+'</div><div class="forge-grid-board">'+Array.from({length:cfg.size*cfg.size},(_,i)=>'<button type="button" class="forge-grid-cell '+(blocked.has(i)?'blocked':'')+'" data-cell="'+i+'" '+(blocked.has(i)?'disabled':'')+'></button>').join('')+'</div><button class="forge-check" id="forgeCheck" style="margin-top:10px">Check layout</button>';body.innerHTML=html;state.selectedTool=0;
   body.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{state.selectedTool=Number(b.dataset.tool);body.querySelectorAll('.forge-grid-tool').forEach(x=>x.classList.toggle('active',x===b))});
   body.querySelectorAll('[data-cell]').forEach(cell=>cell.onclick=()=>{const idx=Number(cell.dataset.cell);const already=Object.keys(state.placed).find(k=>Number(k)===idx);if(already!==undefined)delete state.placed[already];else state.placed[idx]=state.selectedTool;cell.textContent=already!==undefined?'':cfg.required[state.selectedTool];cell.classList.toggle('placed',already===undefined)});
   body.querySelector('#forgeCheck').onclick=()=>{const occupied=Object.keys(state.placed).length===cfg.required.length;const unique=new Set(Object.values(state.placed)).size===cfg.required.length;const safe=Object.keys(state.placed).every(k=>!blocked.has(Number(k)));const positions={};Object.entries(state.placed).forEach(([cell,tool])=>{positions[cfg.required[tool]]=Number(cell)});const adjOk=(cfg.adjacentPairs||[]).every(([a,b])=>positions[a]!==undefined&&positions[b]!==undefined&&adjacent(positions[a],positions[b]));setResult(occupied&&unique&&safe&&adjOk?'Layout accepted — all required zones are placed safely.':'Use each item once, keep placements available, and respect adjacency constraints.',occupied&&unique&&safe&&adjOk,{positions})};
 }else if(cfg.mechanic==='assign'){
   body.innerHTML='<div class="forge-assign-list">'+cfg.people.map((person,i)=>'<label class="forge-assign-row"><span>'+esc(person)+'</span><select data-person="'+esc(person)+'"><option value="">Choose role…</option>'+cfg.roles.map(r=>'<option>'+esc(r)+'</option>').join('')+'</select></label>').join('')+'</div><button class="forge-check" id="forgeCheck">Check team</button>';
   body.querySelectorAll('[data-person]').forEach(s=>s.onchange=()=>state.assign[s.dataset.person]=s.value);
   body.querySelector('#forgeCheck').onclick=()=>{const ok=cfg.people.every(p=>state.assign[p]===cfg.correct[p])&&new Set(Object.values(state.assign)).size===cfg.roles.length;setResult(ok?'Team accepted — every role has the right fit.':'The assignment has conflicts. Try matching strengths to roles again.',ok,{assign:{...state.assign}})};
 }
 return{isPassed:()=>passed};
}