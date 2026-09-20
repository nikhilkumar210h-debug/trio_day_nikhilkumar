/**
 * Cloudflare Worker — Trio Day Gamification Backend
 *
 * Handles all server-side writes that are blocked from direct client access:
 *   POST /gamification/award-xp        — XP + level + leaderboard + badges
 *   POST /gamification/bump-streak     — streak fields
 *   POST /gamification/award-badges    — badge array on users/{uid}
 *   POST /gamification/counter         — communityTasks counter bumps
 *
 * Auth: every request must carry Authorization: Bearer <firebase-id-token>
 * The Worker verifies the token, derives uid, and writes via service account.
 *
 * Wrangler secrets required:
 *   FIREBASE_PROJECT_ID        e.g. nkm-ind
 *   FIREBASE_SA_CLIENT_EMAIL   service account email
 *   FIREBASE_SA_PRIVATE_KEY    RSA private key PEM (-----BEGIN PRIVATE KEY-----)
 *
 * Setup:
 *   npx wrangler secret put FIREBASE_PROJECT_ID
 *   npx wrangler secret put FIREBASE_SA_CLIENT_EMAIL
 *   npx wrangler secret put FIREBASE_SA_PRIVATE_KEY
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const XP_PER_LEVEL = 100;
const LEADERBOARD_TOP_N = 50;
const MAX_XP_AWARD = 500;          // per single call
const FIREBASE_PUBLIC_KEYS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// ─── Per-UID rate limiting (10 requests/minute) ───────────────────────────────
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 10;
const rateLimitMap = new Map(); // uid -> [timestamps]

function checkRateLimit(uid) {
  const now = Date.now();
  const timestamps = rateLimitMap.get(uid) || [];
  const recent = timestamps.filter(ts => now - ts < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, retryAfter: Math.ceil((recent[0] + RATE_LIMIT_WINDOW_MS - Date.now()) / 1000) };
  }
  recent.push(now);
  rateLimitMap.set(uid, recent);
  return { allowed: true };
}

const SYSTEM_BADGES = [
  { id: 'badge_first_complete', name: 'First Win',        icon: '🏅' },
  { id: 'badge_first_post',     name: 'Storyteller',      icon: '📝' },
  { id: 'badge_streak_3',       name: 'On Fire',          icon: '🔥' },
  { id: 'badge_streak_7',       name: 'Week Warrior',     icon: '⚔️' },
  { id: 'badge_streak_30',      name: 'Unstoppable',      icon: '🚀' },
  { id: 'badge_xp_500',         name: 'Rising Star',      icon: '⭐' },
  { id: 'badge_xp_1000',        name: 'Legend',           icon: '🏆' },
  { id: 'badge_engager',        name: 'Community Voice',  icon: '🗣️' }
];

// ─── CORS (shared — see workers/shared/cors.js for single source)
import { corsHeaders, json, isAllowedOrigin } from "./shared/cors.js";

// ─── Period key helpers (matches gamification/constants.js) ───────────────────

function pad(n) { return String(n).padStart(2, '0'); }

function localDateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function localWeekKey(d = new Date()) {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (date.getDay() + 6) % 7; // Mon=0
  date.setDate(date.getDate() - day + 3);
  const week1 = new Date(date.getFullYear(), 0, 4);
  const weekNo = 1 + Math.round(
    ((date - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
  );
  return `${date.getFullYear()}-W${pad(weekNo)}`;
}

function localMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function yesterdayDateKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateKey(d);
}

function levelFromXp(xp) {
  return Math.floor(Math.max(0, Number(xp) || 0) / XP_PER_LEVEL) + 1;
}

const CATALOG_MEDIUM = new Set([
  'p1','p2','p3','p4','p5','p6','p7','p8','p9','p10','p11','p14',
  'b1','b3','b4','b7','b10','b11','b12','b14',
  'l1','l6','l7','l8','l10','l11','l13','l15',
  'c2','c3','c5','c6','c7','c9','c11','c12','c15'
]);
const CATALOG_HARD = new Set(['p12','p13','p15','b15']);

function catalogXp(activityId) {
  const id = String(activityId || '').trim().toLowerCase();
  if (!/^[pblc]\d+$/.test(id)) return 0;
  if (CATALOG_HARD.has(id)) return 60;
  if (CATALOG_MEDIUM.has(id)) return 40;
  return 25;
}

function catalogCycleDays(activityId) {
  const cycles = {
    p1:14,p2:21,p3:14,p4:21,p5:14,p6:21,p7:30,p8:30,p9:21,p10:21,p11:30,p12:40,p13:30,p14:21,p15:40,
    b1:21,b2:14,b3:30,b4:30,b5:14,b6:21,b7:30,b8:21,b9:14,b10:21,b11:30,b12:21,b13:21,b14:30,b15:40,
    l1:21,l2:21,l3:30,l4:21,l5:21,l6:30,l7:21,l8:21,l9:14,l10:30,l11:40,l12:21,l13:30,l14:21,l15:30,
    c1:14,c2:21,c3:21,c4:14,c5:30,c6:21,c7:21,c8:14,c9:30,c10:14,c11:21,c12:30,c13:14,c14:14,c15:21
  };
  return cycles[String(activityId || '').trim().toLowerCase()] || 21;
}

function catalogCycleKey(activityId, nowMs) {
  const days = catalogCycleDays(activityId);
  const epoch = Date.UTC(2026, 0, 1);
  const index = Math.max(0, Math.floor((nowMs - epoch) / (days * 86400000)));
  return activityId + '_' + String(epoch + index * days * 86400000);
}

const CATALOG_PUZZLE_CORRECT={
  p1:0,p2:0,p3:2,p4:0,p5:0,p6:0,p7:0,p8:1,p9:2,p10:1,p11:0,p12:0,p13:0,p14:0,p15:2
};
const CATALOG_LEARN_CORRECT={
  l1:2,l2:1,l3:1,l4:1,l5:1,l6:1,l7:0,l8:1,l9:0,l10:0,l11:0,l12:1,l13:0,l14:0,l15:0
};
const CATALOG_CHALLENGE_ANSWERS={
  c1:[0,1,1,0,0], c2:[1,1,1,1,0], c3:[1,0,0,0,0], c4:[1,0,2,0,0],
  c5:[0,0,1,0,0], c6:[0,0,1,1,0], c7:[0,1,0,2,0], c8:[2,1,2,2,2],
  c9:[0,0,0,0,0], c10:[0,0,0,0,0], c11:[0,0,0,0,0], c12:[0,0,0,0,0],
  c13:[0,0,0,0,0], c14:[0,0,0,0,0], c15:[0,0,0,0,0]
};
const CATALOG_BUILD={
  b1:{m:'order',items:['User problem','Core promise','Key feature','One-screen flow','60-second pitch']},
  b2:{m:'order',items:['Headline','What it is','Why join','When + where','Call to action']},
  b3:{m:'assign',people:['Feature A','Feature B','Feature C','Final flow'],roles:['User value','Must-have','Nice-to-have','Integrator'],correct:{'Feature A':'User value','Feature B':'Must-have','Feature C':'Nice-to-have','Final flow':'Integrator'}},
  b4:{m:'order',items:['Goal','Turn','Core rule','Twist','Win condition']},
  b5:{m:'order',items:['Goal 1','Goal 2','Fixed event','Buffer','Final check']},
  b6:{m:'order',items:['Hook','Setup','Problem','Turn','Climax','Ending']},
  b7:{m:'assign',people:['User story','Behaviour','Edge case','Acceptance test'],roles:['Product','Flow','Risk','Verifier'],correct:{'User story':'Product','Behaviour':'Flow','Edge case':'Risk','Acceptance test':'Verifier'}},
  b8:{m:'assign',people:['Name + hook','First event','Invitation','Next action'],roles:['Brand','Event','Copy','CTA'],correct:{'Name + hook':'Brand','First event':'Event','Invitation':'Copy','Next action':'CTA'}},
  b9:{m:'allocate',budget:10,mins:[2,2,1,1,0]},
  b10:{m:'order',items:['Detect','Acknowledge','Workaround','Fix','Follow-up']},
  b11:{m:'grid',required:['Decision','Metric','Warning','Detail'],blocked:[2,7,12],pairs:[['Decision','Metric'],['Metric','Warning']]},
  b12:{m:'assign',people:['Task 1','Task 2','Task 3','Task 4'],roles:['Planner','Builder','Tester','Owner'],correct:{'Task 1':'Planner','Task 2':'Builder','Task 3':'Tester','Task 4':'Owner'}},
  b13:{m:'assign',people:['Name','Promise','Audience','Mood'],roles:['Naming','Strategy','Audience','Art direction'],correct:{'Name':'Naming','Promise':'Strategy','Audience':'Audience','Mood':'Art direction'}},
  b14:{m:'order',items:['Explain','Example','Mini-test','Memory trick','Check']},
  b15:{m:'grid',required:['Clue','Hint','Bottleneck','Final door'],blocked:[1,6,11],pairs:[['Clue','Hint'],['Hint','Bottleneck'],['Bottleneck','Final door']]}
};

function catalogAdjacent(a,b){return (Math.abs(a-b)===1&&Math.floor(a/4)===Math.floor(b/4))||Math.abs(a-b)===4;}

function validCatalogEvidence(activityId,evidence){
  const id=String(activityId||'').toLowerCase();
  if(!evidence||typeof evidence!=='object')return false;
  const proof=String(evidence.proofText||'').trim();
  if(Object.prototype.hasOwnProperty.call(CATALOG_PUZZLE_CORRECT,id)){
    return proof.length>=20&&proof.split(/\s+/).filter(Boolean).length>=4&&Number(evidence.answerIndex)===CATALOG_PUZZLE_CORRECT[id];
  }
  if(Object.prototype.hasOwnProperty.call(CATALOG_LEARN_CORRECT,id)){
    return proof.length>=20&&proof.split(/\s+/).filter(Boolean).length>=4&&Number(evidence.answerIndex)===CATALOG_LEARN_CORRECT[id];
  }
  if(Object.prototype.hasOwnProperty.call(CATALOG_CHALLENGE_ANSWERS,id)){
    if(proof.length<20||proof.split(/\s+/).filter(Boolean).length<4)return false;
    const answers=Array.isArray(evidence.answers)?evidence.answers.map(Number):[];
    const expected=CATALOG_CHALLENGE_ANSWERS[id];
    if(answers.length!==5||answers.some(a=>!Number.isInteger(a)||a<0||a>3))return false;
    let score=0;for(let i=0;i<5;i++)if(answers[i]===expected[i])score++;
    return score>=3&&Number(evidence.score)===score;
  }
  const cfg=CATALOG_BUILD[id];
  if(!cfg||!evidence.buildEvidence||evidence.buildEvidence.mechanic!==cfg.m)return false;
  const state=evidence.buildEvidence.state;
  if(!state||typeof state!=='object')return false;
  if(cfg.m==='order')return Array.isArray(state.order)&&state.order.length===cfg.items.length&&state.order.every((v,i)=>v===cfg.items[i]);
  if(cfg.m==='allocate'){
    const a=Array.isArray(state.allocation)?state.allocation.map(Number):[];
    return a.length===cfg.mins.length&&a.every((v,i)=>Number.isFinite(v)&&v>=cfg.mins[i])&&a.reduce((s,v)=>s+v,0)<=cfg.budget;
  }
  if(cfg.m==='assign'){
    return state.assign&&cfg.people.every(p=>state.assign[p]===cfg.correct[p])&&new Set(Object.values(state.assign)).size===cfg.roles.length;
  }
  if(cfg.m==='grid'){
    const p=state.positions;if(!p||typeof p!=='object')return false;
    const vals=cfg.required.map(name=>Number(p[name]));
    if(vals.some(v=>!Number.isInteger(v)||v<0||v>15)||new Set(vals).size!==cfg.required.length)return false;
    if(vals.some(v=>cfg.blocked.includes(v)))return false;
    return cfg.pairs.every(pair=>p[pair[0]]!==undefined&&p[pair[1]]!==undefined&&catalogAdjacent(Number(p[pair[0]]),Number(p[pair[1]])));
  }
  return false;
}

async function handleCompleteCatalog(uid,body,env){
  const activityId=String(body?.activityId||'').trim().toLowerCase();
  if(!/^[pblc](?:[1-9]|1[0-5])$/.test(activityId))throw new Error('Unknown catalog activity');
  const now=Date.now();
  const expectedKey=catalogCycleKey(activityId,now);
  if(String(body?.cycleKey||'')!==expectedKey)throw new Error('Invalid activity cycle');
  if(!validCatalogEvidence(activityId,body?.evidence))throw new Error('Activity solution could not be verified');

  const projectId=env.FIREBASE_PROJECT_ID;
  const token=await getAccessToken(env);
  const completionPath='users/'+uid+'/activityCompletions/'+expectedKey;
  const cycleStart=Number(expectedKey.split('_')[1])||now;
  const evidence=body.evidence;
  const created=await fsCreateDoc(projectId,token,completionPath,{
    uid,
    activityId,
    cycleKey:expectedKey,
    verified:true,
    completedAtMs:now,
    cycleEndsAtMs:cycleStart+catalogCycleDays(activityId)*86400000,
    proofText:String(evidence.proofText||'').trim().slice(0,500),
    answerIndex:Number.isInteger(Number(evidence.answerIndex))?Number(evidence.answerIndex):null,
    score:Number.isInteger(Number(evidence.score))?Number(evidence.score):null,
    answers:Array.isArray(evidence.answers)?evidence.answers.slice(0,5).map(Number):null,
    buildEvidence:evidence.buildEvidence&&typeof evidence.buildEvidence==='object'?evidence.buildEvidence:null
  });
  if(!created){
    const existing=await fsGet(projectId,token,completionPath);
    if(!existing?.verified)throw new Error('Existing completion cannot be verified');
  }
  const award=await handleAwardXp(uid,{meta:{catalogActivityId:activityId,catalogCycleKey:expectedKey}},env);
  return {ok:true,already:!created,award};
}

async function handleAwardXp(uid, body, env) {
  const meta = body?.meta || {};
  const communityTaskId = String(meta.communityTaskId || '').trim();
  const catalogActivityId = String(meta.catalogActivityId || '').trim().toLowerCase();
  const templateId = String(meta.templateId || '').trim();
  if (!communityTaskId && !catalogActivityId && !templateId) throw new Error('activity context required');

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const now = Date.now();
  let amount = 0;
  let grantKey = '';

  if (communityTaskId) {
    const task = await fsGet(projectId, token, 'communityTasks/' + communityTaskId);
    if (!task || task.status !== 'active') throw new Error('Community activity is not active');
    if (task.creatorUid === uid) throw new Error('Creators cannot earn XP from their own activity');
    const completion = await fsGet(projectId, token, 'communityTasks/' + communityTaskId + '/completions/' + uid);
    if (!completion) throw new Error('Completion record not found');
    amount = Math.max(1, Math.min(MAX_XP_AWARD, Math.round(Number(task.xpReward) || 50)));
    grantKey = 'community_' + communityTaskId;
  } else if (catalogActivityId) {
    amount = catalogXp(catalogActivityId);
    if (!amount) throw new Error('Unknown catalog activity');
    const expectedKey = catalogCycleKey(catalogActivityId, now);
    const completionKey = String(meta.catalogCycleKey || '');
    if (completionKey !== expectedKey) throw new Error('Invalid catalog cycle');
    const completion = await fsGet(projectId, token, 'users/' + uid + '/activityCompletions/' + completionKey);
    if (!completion || completion.activityId !== catalogActivityId) throw new Error('Completion record not found');
    grantKey = 'catalog_' + expectedKey;
  } else {
    const template = await fsGet(projectId, token, 'taskTemplates/' + templateId);
    if (!template || template.active !== true) throw new Error('Template is not active');
    if (template.createdBy !== 'system' && template.createdBy !== uid) throw new Error('Template access denied');
    const cadence = String(template.cadence || 'once');
    const periodKey = cadence === 'daily' ? 'd_' + localDateKey()
      : cadence === 'weekly' ? 'w_' + localWeekKey()
      : cadence === 'monthly' ? 'm_' + localMonthKey()
      : 'o_' + localDateKey();
    const progress = await fsGet(projectId, token, 'users/' + uid + '/progress/' + periodKey);
    const completion = progress?.completions?.[templateId];
    if (!completion?.done) throw new Error('Template completion not found');
    amount = Math.max(1, Math.min(MAX_XP_AWARD, Math.round(Number(template.xpReward) || 25)));
    grantKey = 'template_' + templateId + '_' + periodKey;
  }

  const grantPath = 'users/' + uid + '/xpAwards/' + grantKey.replace(/[^A-Za-z0-9_-]/g, '_');
  const created = await fsCreateDoc(projectId, token, grantPath, { uid, grantKey, amount, createdAtMs: now });
  if (!created) {
    const current = await fsGet(projectId, token, 'users/' + uid) || {};
    return {
      ok: true,
      xp: Number(current.xp) || 0,
      level: Number(current.level) || 1,
      leveledUp: false,
      awarded: 0,
      alreadyAwarded: true,
      badgesEarned: []
    };
  }

  const userData = await fsGet(projectId, token, 'users/' + uid) || {};
  const weekKey = localWeekKey();
  const monthKey = localMonthKey();
  const prevXp = Number(userData.xp) || 0;
  const newXp = prevXp + amount;
  const newLevel = levelFromXp(newXp);

  let weeklyXp = Number(userData.weeklyXp) || 0;
  let monthlyXp = Number(userData.monthlyXp) || 0;
  if (userData.weeklyXpKey !== weekKey) weeklyXp = 0;
  if (userData.monthlyXpKey !== monthKey) monthlyXp = 0;
  weeklyXp += amount;
  monthlyXp += amount;

  await fsPatch(projectId, token, 'users/' + uid,
    { xp:newXp, level:newLevel, weeklyXp, monthlyXp, weeklyXpKey:weekKey, monthlyXpKey:monthKey },
    ['xp','level','weeklyXp','monthlyXp','weeklyXpKey','monthlyXpKey']);

  const verified = {
    uid,
    name: userData.name || 'User',
    photoURL: userData.photoURL || null,
    level: newLevel,
    xp: newXp,
    weeklyXp,
    monthlyXp,
    streakCurrent: Number(userData.streakCurrent) || 0
  };
  const boards = [
    { id:'global', key:'xp' },
    { id:'weekly_' + weekKey, key:'weeklyXp' },
    { id:'monthly_' + monthKey, key:'monthlyXp' },
    { id:'streak', key:'streakCurrent' }
  ];
  await Promise.allSettled(boards.map(b =>
    fsTransactionUpdateLeaderboard(projectId, token, b.id, uid, verified, b.key)
  ));

  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];
  const earned = evaluateBadgesDelta(currentBadges, newXp, Number(userData.streakCurrent) || 0, meta.templateId);
  if (earned.length) {
    await fsPatch(projectId, token, 'users/' + uid, { badges:[...currentBadges, ...earned] }, ['badges']);
  }

  return { ok:true, xp:newXp, level:newLevel, leveledUp:newLevel > levelFromXp(prevXp), awarded:amount, badgesEarned:earned };
}

/**
 * Bump streak for uid (idempotent per day).
 */
async function handleBumpStreak(uid, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);

  const userData = await fsGet(projectId, token, `users/${uid}`) || {};
  const today     = localDateKey();
  const yesterday = yesterdayDateKey();
  const last      = userData.streakLastDate || null;

  // Idempotent — already bumped today
  if (last === today) {
    return {
      ok:             true,
      streakCurrent:  Number(userData.streakCurrent) || 0,
      streakBest:     Number(userData.streakBest)    || 0,
      alreadyCounted: true
    };
  }

  let streakCurrent = 1;
  if (last === yesterday) {
    streakCurrent = (Number(userData.streakCurrent) || 0) + 1;
  }
  const streakBest = Math.max(Number(userData.streakBest) || 0, streakCurrent);

  await fsPatch(projectId, token, `users/${uid}`,
    { streakCurrent, streakBest, streakLastDate: today },
    ['streakCurrent', 'streakBest', 'streakLastDate']
  );

  // Update streak leaderboard
  const verified = {
    uid,
    name:          userData.name     || 'User',
    photoURL:      userData.photoURL || null,
    level:         Number(userData.level) || 1,
    xp:            Number(userData.xp)    || 0,
    weeklyXp:      Number(userData.weeklyXp)   || 0,
    monthlyXp:     Number(userData.monthlyXp)  || 0,
    streakCurrent
  };
  await fsTransactionUpdateLeaderboard(projectId, token, 'streak', uid, verified, 'streakCurrent')
    .catch(() => { /* best-effort */ });

  // Evaluate streak badges
  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];
  const earned = evaluateBadgesDelta(currentBadges, Number(userData.xp) || 0, streakCurrent, null);
  if (earned.length > 0) {
    const newBadges = [...currentBadges, ...earned];
    await fsPatch(projectId, token, `users/${uid}`, { badges: newBadges }, ['badges'])
      .catch(() => { /* best-effort */ });
  }

  return { ok: true, streakCurrent, streakBest, alreadyCounted: false, badgesEarned: earned };
}

/**
 * Award specific badges to uid (e.g. first_post triggered by template completion).
 */
async function handleAwardBadges(uid, _body, env) {
  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const userData = await fsGet(projectId, token, `users/${uid}`) || {};
  const currentBadges = Array.isArray(userData.badges) ? userData.badges : [];

  const postQuery = {
    from: [{ collectionId: 'posts' }],
    where: {
      fieldFilter: {
        field: { fieldPath: 'uid' },
        op: 'EQUAL',
        value: { stringValue: uid }
      }
    },
    limit: 1
  };
  const hasPost = (await fsRunQuery(projectId, token, postQuery).catch(() => [])).length > 0;
  const monthKey = localMonthKey();
  const monthProgress = await fsGet(projectId, token, `users/${uid}/progress/m_${monthKey}`).catch(() => null);
  const monthlyDone = !!monthProgress?.completions?.sys_monthly_engage?.done;
  const verifiedBadges = [];
  if (hasPost) verifiedBadges.push('verified_first_post');
  if (monthlyDone) verifiedBadges.push('verified_monthly_engage');

  const earned = evaluateBadgesDelta(
    currentBadges,
    Number(userData.xp) || 0,
    Number(userData.streakCurrent) || 0,
    verifiedBadges
  );
  if (earned.length > 0) {
    const newBadges = [...currentBadges, ...earned];
    await fsPatch(projectId, token, `users/${uid}`, { badges: newBadges }, ['badges']);
  }
  return { ok: true, badgesEarned: earned };
}
/**
 * Bump a counter field on a communityTasks document.
 * action: 'join'|'leave'|'like'|'unlike'|'comment'|'complete'
 */
async function handleCounter(uid, body, env) {
  const taskId = String(body?.taskId || '').trim();
  const action = String(body?.action || '').trim();
  const eventId = String(body?.eventId || '').trim();
  if (!taskId) throw new Error('taskId required');
  if (!eventId) throw new Error('eventId required');

  const validActions = ['join','leave','like','unlike','comment','complete'];
  if (!validActions.includes(action)) throw new Error('Invalid action: ' + action);

  const projectId = env.FIREBASE_PROJECT_ID;
  const token = await getAccessToken(env);
  const eventKey = action === 'unlike' ? 'like_' + uid + '_' + eventId :
                   action === 'leave' ? 'join_' + uid + '_' + eventId :
                   action + '_' + uid + '_' + eventId;
  const eventPath = 'communityTasks/' + taskId + '/counterEvents/' + eventKey.replace(/[^A-Za-z0-9_-]/g, '_');

  let verified = false;
  if (action === 'join') {
    const member = await fsGet(projectId, token, 'communityTasks/' + taskId + '/members/' + uid);
    verified = !!member && String(member.joinedAtMs) === eventId;
  } else if (action === 'like') {
    const like = await fsGet(projectId, token, 'communityTasks/' + taskId + '/likes/' + uid);
    verified = !!like && String(like.atMs) === eventId;
  } else if (action === 'comment') {
    const comment = await fsGet(projectId, token, 'communityTasks/' + taskId + '/comments/' + eventId);
    verified = !!comment && comment.uid === uid;
  } else if (action === 'complete') {
    const completion = await fsGet(projectId, token, 'communityTasks/' + taskId + '/completions/' + uid);
    verified = !!completion && String(completion.atMs) === eventId;
  } else {
    const previous = await fsGet(projectId, token, eventPath);
    verified = !!previous && previous.uid === uid;
  }

  if (!verified) throw new Error('Counter event could not be verified');

  if (action === 'unlike' || action === 'leave') {
    await fsDelete(projectId, token, eventPath);
    await fsAtomicIncrement(
      projectId,
      token,
      'communityTasks/' + taskId,
      action === 'unlike' ? 'likes' : 'joins',
      -1
    );
    return { ok:true, taskId, action, eventId, delta:-1 };
  }

  const created = await fsCreateDoc(projectId, token, eventPath, {
    uid, action, eventId, createdAtMs: Date.now()
  });
  if (!created) {
    return { ok:true, taskId, action, eventId, delta:0, alreadyCounted:true };
  }

  const fieldMap = {
    join:'joins', like:'likes', comment:'comments', complete:'completions'
  };
  await fsAtomicIncrement(projectId, token, 'communityTasks/' + taskId, fieldMap[action], 1);
  return { ok:true, taskId, action, eventId, delta:1 };
}

// ─── Request router ───────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      if (origin && !isAllowedOrigin(origin)) {
        return new Response(null, { status: 403 });
      }
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return json({ error: 'POST only' }, 405, origin);
    }

    if (origin && !isAllowedOrigin(origin)) {
      return json({ error: 'Origin not allowed' }, 403, origin);
    }

    // Verify required secrets are present
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_SA_CLIENT_EMAIL || !env.FIREBASE_SA_PRIVATE_KEY) {
      return json({ error: 'Server configuration incomplete' }, 500, origin);
    }

    // Verify Firebase ID token
    const authHeader = request.headers.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
    if (!idToken) {
      return json({ error: 'Authorization header required' }, 401, origin);
    }

    let tokenPayload;
    try {
      tokenPayload = await verifyFirebaseIdToken(idToken, env.FIREBASE_PROJECT_ID);
    } catch (err) {
      return json({ error: 'Unauthorized', detail: err.message }, 401, origin);
    }

    const uid = tokenPayload.sub;
    if (!uid) return json({ error: 'Invalid token: no uid' }, 401, origin);

    // Rate limit: ~10 requests/minute per UID
    const rateLimit = checkRateLimit(uid);
    if (!rateLimit.allowed) {
      return json({ error: 'Rate limit exceeded', retryAfter: rateLimit.retryAfter }, 429, origin);
    }

    // Reject oversized bodies before parsing.
    const contentLength = Number(request.headers.get('Content-Length') || 0);
    if (contentLength > 8192) {
      return json({ error: 'Request body too large' }, 413, origin);
    }

    // Parse body
    let body = {};
    try {
      body = await request.json();
    } catch (_) {
      return json({ error: 'Invalid JSON body' }, 400, origin);
    }

    // Route
    const path = url.pathname.replace(/\/$/, '');
    try {
      let result;
      if (path === '/gamification/complete-catalog') {
         result = await handleCompleteCatalog(uid, body, env);
       } else if (path === '/gamification/award-xp') {
        result = await handleAwardXp(uid, body, env);
      } else if (path === '/gamification/bump-streak') {
        result = await handleBumpStreak(uid, env);
      } else if (path === '/gamification/award-badges') {
        result = await handleAwardBadges(uid, body, env);
      } else if (path === '/gamification/counter') {
        result = await handleCounter(uid, body, env);
      } else {
        return json({ error: 'Unknown route' }, 404, origin);
      }
      return json(result, 200, origin);
    } catch (err) {
      console.error(`[gamification] ${path} uid=${uid} error:`, err.message);
      return json({ error: err.message || 'Internal error' }, 500, origin);
    }
  }
};