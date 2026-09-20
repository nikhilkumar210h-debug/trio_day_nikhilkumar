import { isAllowedOrigin } from "./shared/cors.js";
// workers/studio-ai.js — AI proxy with auth + rate limit (5/min/user). No key in client.
// Deploy as Cloudflare Worker. Uses crypto.subtle verification (Workers-compatible).

const RATE_MAX = 5;
const WINDOW_MS = 60 * 1000;
const mem = new Map(); // uid -> [timestamps]

function rateOk(uid){
  const now=Date.now();
  const arr=(mem.get(uid)||[]).filter(t=> now - t < WINDOW_MS);
  if(arr.length >= RATE_MAX) return { ok:false, retryAfter: Math.ceil((arr[0]+WINDOW_MS - now)/1000) };
  arr.push(now); mem.set(uid, arr); return { ok:true };
}

const FIREBASE_PUBLIC_KEYS_URL = 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

function b64urlDecode(str) {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (b64.length % 4)) % 4;
  const padded = b64 + '='.repeat(pad);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getFirebasePublicKeys(cacheStorage) {
  const cacheKey = 'https://firebase-pubkeys.internal/v1';
  try {
    const cached = await cacheStorage.match(cacheKey);
    if (cached) {
      const keys = await cached.json();
      return keys;
    }
  } catch (_) {}
  const res = await fetch(FIREBASE_PUBLIC_KEYS_URL);
  const certMap = await res.json();
  const result = {};
  for (const [kid, pem] of Object.entries(certMap)) {
    try {
      const pemBody = pem.replace('-----BEGIN CERTIFICATE-----', '').replace('-----END CERTIFICATE-----', '').replace(/\s/g, '');
      const derBytes = b64urlDecode(pemBody);
      const cryptoKey = await crypto.subtle.importKey('spki', extractPublicKeyFromCert(derBytes), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
      result[kid] = cryptoKey;
    } catch (_) {}
  }
  return result;
}

function extractPublicKeyFromCert(derBytes) {
  let offset = 0;
  function readTag(buf, off) { return { tag: buf[off], next: off + 1 }; }
  function readLength(buf, off) {
    if (buf[off] < 0x80) return { len: buf[off], next: off + 1 };
    const numBytes = buf[off] & 0x7f;
    let len = 0;
    for (let i = 0; i < numBytes; i++) len = (len << 8) | buf[off + 1 + i];
    return { len, next: off + 1 + numBytes };
  }
  function skipField(buf, off) {
    const { next: afterTag } = readTag(buf, off);
    const { len, next: afterLen } = readLength(buf, afterTag);
    return afterLen + len;
  }
  function enterSequence(buf, off) {
    const { next: afterTag } = readTag(buf, off);
    const { next: afterLen } = readLength(buf, afterTag);
    return afterLen;
  }
  offset = enterSequence(derBytes, offset);
  offset = enterSequence(derBytes, offset);
  if (derBytes[offset] === 0xa0) offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  offset = skipField(derBytes, offset);
  const { next: afterTag } = readTag(derBytes, offset);
  const { len, next: afterLen } = readLength(derBytes, afterTag);
  const end = afterLen + len;
  return derBytes.slice(offset, end).buffer;
}

async function verifyFirebaseIdToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  let header, payload;
  try {
    header = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[0])));
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
  } catch (_) { throw new Error('Token decode failed'); }
  if (header.alg !== 'RS256') throw new Error('Unsupported algorithm');
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error('Token expired');
  if (payload.iat > now + 60) throw new Error('Token issued in future');
  if (payload.aud !== projectId) throw new Error('Token audience mismatch');
  if (payload.iss !== `https://securetoken.google.com/${projectId}`) throw new Error('Token issuer mismatch');
  if (!payload.sub) throw new Error('Missing subject');
  const keys = await getFirebasePublicKeys(caches.default);
  const publicKey = keys[header.kid];
  if (!publicKey) throw new Error('Unknown key id');
  const signingInput = new TextEncoder().encode(`${parts[0]}.${parts[1]}`);
  const signature = b64urlDecode(parts[2]);
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, signingInput);
  if (!valid) throw new Error('Token signature invalid');
  return payload;
}

function corsHeaders(origin){
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400'
  };
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    if(origin && !isAllowedOrigin(origin)){
      return new Response(JSON.stringify({error:'Origin not allowed'}), {status:403, headers:{'Content-Type':'application/json'}});
    }
    if(request.method==='OPTIONS') return new Response(null, { status:204, headers: corsHeaders(origin) });
    if(request.method!=='POST' || !new URL(request.url).pathname.endsWith('/ai/generate')){
      return new Response(JSON.stringify({error:'Not found'}), { status:404, headers: { 'Content-Type':'application/json', ...corsHeaders(origin)} });
    }
    const authHeader = request.headers.get('Authorization')||'';
    const m = authHeader.match(/^Bearer\s+(.+)$/);
    if(!m) return new Response(JSON.stringify({error:'Missing auth'}), { status:401, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
    const idToken=m[1];
    let uid=null;
    try{
      let projectId = env.FIREBASE_PROJECT_ID || null;
      if (!projectId && env.FIREBASE_SERVICE_ACCOUNT) {
        try { projectId = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT).project_id; } catch {}
      }
      if (!projectId) projectId = 'nkm-ind';
      const decoded = await verifyFirebaseIdToken(idToken, projectId);
      uid = decoded.sub;
    }catch(e){
      return new Response(JSON.stringify({error:'Invalid token', detail: e.message}), { status:401, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
    }
    if(!uid) return new Response(JSON.stringify({error:'Auth failed'}), { status:401, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
    const rl = rateOk(uid);
    if(!rl.ok) return new Response(JSON.stringify({error:'Rate limited — 5/minute', retryAfter: rl.retryAfter}), { status:429, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });

    let body={};
    try{ body=await request.json(); }catch{}
    const { type='status', category='Motivation', prompt='', language='Hinglish', tone='Simple' } = body;
    if(String(prompt).length>500) return new Response(JSON.stringify({error:'Prompt too long'}), { status:400, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });

    const nvidiaKey = env.NVIDIA_API_KEY || env.NVIDIA_NIM_API_KEY || null;
    if(!nvidiaKey){
      return new Response(JSON.stringify({error:'Live AI not configured', code:'not_configured'}), { status:503, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
    }
    try{
      const nvidiaModel = env.NVIDIA_MODEL || 'deepseek-ai/deepseek-v4-flash-0731';
      const typeLabel = String(type||'status');
      const userPrompt = String(prompt||'').trim().slice(0,500);
      const systemInstruction = `You are NKM Studio — an Indian content assistant. Generate exactly 3 suggestions for type=${typeLabel}, category=${category}, language=${language}, tone=${tone}. Each suggestion max 180 chars, one per line, no numbering or bullets, no extra explanation. Keep language exactly as requested (${language}). If Hindi, Devanagari must be readable. Topic/prompt: "${userPrompt || category}".`;
      const controller = new AbortController();
      const timeoutId = setTimeout(()=> controller.abort(), 15000);
      const gr = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${nvidiaKey}` },
        body: JSON.stringify({
          model: nvidiaModel,
          messages: [{ role:'user', content: systemInstruction }],
          temperature: 1,
          top_p: 0.95,
          max_tokens: 2048,
          extra_body: { chat_template_kwargs: { thinking: true, reasoning_effort: 'high' } }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if(gr.status===429){
        const t=await gr.text().catch(()=> 'Rate limited');
        return new Response(JSON.stringify({error:'Rate limited', code:'rate_limited', detail:t.slice(0,400)}), { status:429, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
      }
      if(!gr.ok){
        const t=await gr.text().catch(()=>'');
        return new Response(JSON.stringify({error: t.slice(0,600) || `NVIDIA error ${gr.status}`, code:'provider_error'}), { status:502, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
      }
      const gj=await gr.json().catch(()=> ({}));
      const raw = gj.choices?.[0]?.message?.content || '';
      let suggestions = String(raw).split('\n').map(s=> s.replace(/^[\d\-\*\.\s]+/,'').trim()).filter(Boolean).slice(0,3);
      if(suggestions.length===1 && suggestions[0].length>220){
        const alt = suggestions[0].split(/\s*\|\s*|\s*\/\s*/).map(s=>s.trim()).filter(Boolean);
        if(alt.length>=2) suggestions = alt.slice(0,3);
      }
      if(!suggestions.length) throw Error('Empty response from NVIDIA');
      return new Response(JSON.stringify({ suggestions, provider:'nvidia', model: nvidiaModel }), { headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
    }catch(e){
      const isAbort = String(e?.name||'').includes('Abort') || String(e?.message||'').includes('aborted');
      const code = isAbort ? 'timeout' : 'provider_error';
      return new Response(JSON.stringify({error: e.message||'AI error', code}), { status:502, headers:{'Content-Type':'application/json', ...corsHeaders(origin)} });
    }
  }
};
