// Trio Day WebMCP — Challenge-first surface
// Keep model-facing tools aligned with the current product. Legacy activity tools are retired.
const modelContext=(typeof document!=='undefined'&&document.modelContext)||(typeof navigator!=='undefined'&&navigator.modelContext)||null;
if(modelContext&&typeof modelContext.registerTool==='function'){
  const controller=new AbortController();
  const go=id=>{const q=id?'?challenge='+encodeURIComponent(id):'';location.href='challenge.html'+q;return JSON.stringify({ok:true,url:'challenge.html'+q});};
  try{
    await modelContext.registerTool({name:'search_challenges',title:'Search Trio Day challenges',description:'Find and open the current Challenge surface. Read-only.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:[]},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async({query=''}={})=>JSON.stringify({surface:'challenge.html',query:String(query||'').trim(),mechanics:['PICK','PREDICT','GUESS','DEFEND','JUDGE','HELP']})},{signal:controller.signal});
    await modelContext.registerTool({name:'open_challenge',title:'Open Trio Day challenge',description:'Open the current public Challenge surface, optionally targeting a challenge ID.',inputSchema:{type:'object',properties:{challengeId:{type:'string'}},required:[]},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async({challengeId=''})=>go(String(challengeId||''))},{signal:controller.signal});
  }catch(error){console.warn('[WebMCP] registration skipped:',error)}
}
