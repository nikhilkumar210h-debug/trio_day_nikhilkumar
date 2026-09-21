import{activeCatalogActivities,getCatalogActivity}from'./activity-catalog.js?v=20260920-audit2';

const modelContext=document.modelContext;
if(modelContext?.registerTool){
  const compact=a=>({id:a.id,type:a.type,title:a.title,category:a.category,difficulty:a.difficulty,durationMin:a.durationMin,xpReward:a.xpReward,icon:a.icon,description:a.description});
  try{
    await modelContext.registerTool({
      name:'search_activities',
      title:'Search Trio Day activities',
      description:'Find active Trio Day activities by title, category, type, or difficulty. Read-only.',
      inputSchema:{type:'object',properties:{query:{type:'string',description:'Text to match against activity title, category, or description.'},type:{type:'string',enum:['puzzle','build','learn','challenge','game']},difficulty:{type:'string',enum:['Easy','Medium','Hard']},limit:{type:'number',minimum:1,maximum:10}},required:[]},
      annotations:{readOnlyHint:true,untrustedContentHint:true},
      execute:async({query='',type='',difficulty='',limit=6}={})=>{
        const q=String(query).trim().toLowerCase();
        const items=activeCatalogActivities().filter(a=>
          (!type||a.type===type)&&(!difficulty||a.difficulty===difficulty)&&(!q||[a.title,a.category,a.description,a.premise].some(v=>String(v||'').toLowerCase().includes(q)))
        ).slice(0,Math.min(10,Math.max(1,Number(limit)||6)));
        return JSON.stringify(items.map(compact));
      }
    });
    await modelContext.registerTool({
      name:'get_activity',
      title:'Get Trio Day activity',
      description:'Get the active details for one Trio Day activity by ID. Read-only.',
      inputSchema:{type:'object',properties:{activityId:{type:'string'}},required:['activityId']},
      annotations:{readOnlyHint:true,untrustedContentHint:true},
      execute:async({activityId})=>{
        const a=getCatalogActivity(String(activityId||''));
        return a?JSON.stringify(compact(a)):JSON.stringify({error:'Activity not found or inactive.'});
      }
    });
    await modelContext.registerTool({
      name:'open_activity',
      title:'Open Trio Day activity',
      description:'Navigate the current Trio Day page to a specific active activity.',
      inputSchema:{type:'object',properties:{activityId:{type:'string'}},required:['activityId']},
      annotations:{readOnlyHint:false,untrustedContentHint:true},
      execute:async({activityId})=>{
        const a=getCatalogActivity(String(activityId||''));
        if(!a)return JSON.stringify({error:'Activity not found or inactive.'});
        location.href='activity.html?id='+encodeURIComponent(a.id)+'&source=catalog';
        return null;
      }
    });
  }catch(error){
    console.warn('[WebMCP] tool registration skipped:',error);
  }
}
