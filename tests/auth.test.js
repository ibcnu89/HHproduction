import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET = 'test-only-access-secret';
process.env.JWT_REFRESH_SECRET = 'test-only-refresh-secret';

const { requireAuth } = await import('../lib/auth.js');
const { createAccessToken } = await import('../lib/jwt.js');
const { storeOAuthState, verifyAndConsumeOAuthState, setTempSessionCookie, getTempSessionCookie, clearTempSessionCookie, getSessionIdFromRequest } = await import('../lib/oauth-state.js');
const { verifyAccessToken } = await import('../lib/jwt.js');
const { createPasswordResetToken, verifyAndConsumeResetToken, completePasswordReset } = await import('../lib/password-reset.js');

function response() {
  return { statusCode: 200, body: null, cookies: {}, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, cookie(name, value, options) { this.cookies[name] = { value, ...options }; return this; } };
}

test('requireAuth uses the real middleware and returns a compatible user', () => {
  const token = createAccessToken({ id: 'user-1', email: 'teacher@example.test', name: 'Teacher' });
  const req = { headers: { cookie: `access_token=${encodeURIComponent(token)}` } };
  const res = response();
  let called = false;
  requireAuth(req, res, () => { called = true; });
  assert.equal(called, true);
  assert.equal(req.user.id, 'user-1');
  assert.equal(req.user.sub, 'user-1');
});

test('requireAuth rejects missing and invalid cookies', () => {
  for (const cookie of [undefined, 'access_token=not-a-jwt']) {
    const res = response();
    const req = { headers: cookie ? { cookie } : {} };
    assert.equal(requireAuth(req, res), undefined);
    assert.equal(res.statusCode, 401);
  }
});

test('temporary OAuth cookie uses HttpOnly, Secure, SameSite=Lax and clears', () => {
  const res = response();
  setTempSessionCookie(res, 'opaque-session');
  assert.equal(res.cookies.temp_session_id.httpOnly, true);
  assert.equal(res.cookies.temp_session_id.secure, true);
  assert.equal(res.cookies.temp_session_id.sameSite, 'lax');
  assert.equal(getTempSessionCookie({ headers: { cookie: 'temp_session_id=opaque-session' } }), 'opaque-session');
  clearTempSessionCookie(res);
  assert.equal(res.cookies.temp_session_id.maxAge, 0);
});

test('access token carries the database session id used by Classroom OAuth', async () => {
  const token = createAccessToken({ id: 'user-1', email: 'teacher@example.test' }, 'session-7');
  const sessionId = await getSessionIdFromRequest({ headers: { cookie: `access_token=${encodeURIComponent(token)}` } }, verifyAccessToken);
  assert.equal(sessionId, 'session-7');
});

test('OAuth state is session/provider-bound and consumed with one atomic update', async () => {
  const records = new Map();
  const sql = [];
  const client = { async query(statement, params) {
    sql.push(statement);
    if (statement.startsWith('INSERT INTO oauth_states')) {
      records.set(params[1], { session: params[0], data: JSON.parse(params[2]), provider: params[3], expires: params[4], consumed: false });
      return { rows: [], rowCount: 1 };
    }
    const row = records.get(params[0]);
    if (!row || row.session !== params[1] || row.provider !== params[2] || row.consumed || row.expires <= new Date()) return { rows: [] };
    row.consumed = true;
    return { rows: [{ state_data: row.data }] };
  } };
  const { state } = await storeOAuthState({ sessionId: 'session-a', stateData: { redirect: '/classroom' }, provider: 'classroom', client });
  assert.equal(await verifyAndConsumeOAuthState({ state, sessionId: 'session-b', provider: 'classroom', client }), null);
  assert.deepEqual(await verifyAndConsumeOAuthState({ state, sessionId: 'session-a', provider: 'classroom', client }), { redirect: '/classroom' });
  assert.equal(await verifyAndConsumeOAuthState({ state, sessionId: 'session-a', provider: 'classroom', client }), null);
  assert.match(sql.at(-1), /consumed_at IS NULL[\s\S]*expires_at > NOW\(\)[\s\S]*RETURNING state_data/);
});

test('password reset token is stored hashed and consumed atomically once', async () => {
  let storedHash;
  let used = false;
  const client = { async query(statement, params) {
    if (statement.startsWith('INSERT INTO password_reset_tokens')) { storedHash = params[1]; return { rows: [], rowCount: 1 }; }
    if (statement.startsWith('UPDATE password_reset_tokens')) {
      if (used || params[0] !== storedHash) return { rows: [] };
      used = true;
      return { rows: [{ user_id: 'user-2', email: 'teacher@example.test' }] };
    }
    throw new Error(`Unexpected SQL: ${statement}`);
  } };
  const { token } = await createPasswordResetToken({ userId: 'user-2', email: 'teacher@example.test', client });
  assert.notEqual(storedHash, token);
  assert.deepEqual(await verifyAndConsumeResetToken({ token, email: 'teacher@example.test', client }), { userId: 'user-2', email: 'teacher@example.test' });
  assert.equal(await verifyAndConsumeResetToken({ token, email: 'teacher@example.test', client }), null);
});

test('password update, reset-token consumption, and session revocation share a transaction', async () => {
  const calls = [];
  const client = { async query(statement) {
    calls.push(statement);
    if (statement.startsWith('UPDATE password_reset_tokens')) return { rows: [{ user_id: 'user-3', email: 't@example.test' }] };
    if (statement.startsWith('UPDATE users')) return { rows: [], rowCount: 1 };
    return { rows: [], rowCount: 1 };
  } };
  const result = await completePasswordReset({ token: 'reset-secret', email: 't@example.test', newPassword: 'safePass123', client });
  assert.equal(result.success, true);
  assert.equal(calls[0], 'BEGIN');
  assert.ok(calls.some((sql) => sql.startsWith('DELETE FROM sessions')));
  assert.equal(calls.at(-1), 'COMMIT');
});

// Exercise the actual route bodies with fake DB/network boundaries; do not boot the server.
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
const root = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
process.env.JWT_SECRET='supervisor-test-only';
process.env.JWT_REFRESH_SECRET='supervisor-refresh-test-only';
const oauth=await import(`${root}/lib/oauth-state.js`);
const jwt=await import(`${root}/lib/jwt.js`);
const classroom=await import(`${root}/lib/google-classroom.js`);
function res(){return {statusCode:200, cookies:{}, status(n){this.statusCode=n;return this},json(x){this.body=x;return this},send(x){this.body=x;return this},redirect(n,x){this.statusCode=n;this.location=x;return this},cookie(n,v,o){this.cookies[n]={value:v,...o};return this}}}
function setup(){
 const records=new Map(); const statements=[]; const effects=[]; const logs=[];
 const client={async query(sql,p){statements.push(sql);
 if (/^INSERT INTO oauth_states/.test(sql)){records.set(p[1],{session:p[0],data:JSON.parse(p[2]),provider:p[3],expires:p[4],used:false});return {rows:[]}}
 assert.match(sql,/UPDATE oauth_states/);assert.match(sql,/state_hash = \$1/);assert.match(sql,/session_id = \$2/);assert.match(sql,/provider = \$3/);assert.match(sql,/consumed_at IS NULL/);assert.match(sql,/expires_at > NOW\(\)/);assert.match(sql,/RETURNING state_data/);
 const r=records.get(p[0]);if(!r||r.session!==p[1]||r.provider!==p[2]||r.used||r.expires<=new Date())return {rows:[]};r.used=true;return {rows:[{state_data:r.data}]};},release(){}};
 const routes={};const app={get(p,...h){routes[p]=h.at(-1)},post(p,...h){routes[p]=h.at(-1)}};
 const context={app,...oauth,storeOAuthState:p=>oauth.storeOAuthState({...p,client}),verifyAndConsumeOAuthState:p=>oauth.verifyAndConsumeOAuthState({...p,client}),verifyAccessToken:jwt.verifyAccessToken,requireAuth(){},getClassroomAuthUrl:classroom.getClassroomAuthUrl,FRONTEND_URL:'https://example.test',GOOGLE_CLIENT_ID:'test-id',REDIRECT_URI:'https://example.test/api/auth/google/callback',requestPasswordReset:async()=>({message:'Generic reset message',token:'MUST_NOT_LEAK'}),completePasswordReset:async()=>({success:true,message:'Reset complete',token:'MUST_NOT_LEAK'}),validatePasswordStrength:()=>({valid:true}),process:{env:{GOOGLE_CLIENT_SECRET:'test-secret'}},URLSearchParams,Buffer,console:{error(...args){logs.push(args.map(String).join(' '))},warn(...args){logs.push(args.map(String).join(' '))},log(...args){logs.push(args.map(String).join(' '))}},fetch:async()=>{effects.push('exchange');return {ok:false,text:async()=> 'test rejection'}},exchangeClassroomCode:async()=>{effects.push('exchange');return {}},storeClassroomTokens:async(user)=>{effects.push(`store:${user}`)},getClient:async()=>{throw Error('Unexpected direct database fallback')}};
 const source=readFileSync(`${root}/server.js`,'utf8');
 for(const path of ['/api/auth/google','/api/auth/google/callback','/api/classroom/connect','/api/classroom/callback','/api/auth/forgot-password','/api/auth/reset-password']){
 const start=source.indexOf(`app.${(path.endsWith('connect')||path.endsWith('-password'))?'post':'get'}('${path}',`);assert.ok(start>=0);
 const next=source.indexOf('\napp.',start+1);let section=source.slice(start,next<0?undefined:next);section=section.slice(0,section.lastIndexOf('\n});')+4);vm.runInNewContext(section,context);
 }
 return {routes,records,statements,effects,client,context,logs};
}
for(const provider of ['google','classroom']){
 test(`${provider}: actual callback rejects absent/wrong/expired state or session before exchange`,async()=>{
 for(const mode of ['no-state','no-cookie','wrong-cookie','wrong-state','expired','wrong-provider','malformed']){
 const h=setup(); const session='browser-A';const {state}=await oauth.storeOAuthState({sessionId:session,stateData:{userId:'user-A',redirect:'/classroom'},provider:mode==='wrong-provider'?'other':provider,client:h.client});
 if(mode==='expired')for(const r of h.records.values())r.expires=new Date(0);
 const cookie=provider==='google'?`temp_session_id=${mode==='wrong-cookie'?'browser-B':session}`:`access_token=${jwt.createAccessToken({id:'user-A'},mode==='wrong-cookie'?'browser-B':session)}`;
 const query={code:'fake-code',state:mode==='no-state'?undefined:mode==='wrong-state'?'invalid':mode==='malformed'?['bad']:state}; const response=res();
 await h.routes[provider==='google'?'/api/auth/google/callback':'/api/classroom/callback']({query,headers:mode==='no-cookie'?{}:{cookie}},response);
 assert.equal(h.effects.length,0,mode);assert.match(String(response.body??response.location),/invalid_state|no_session/,mode);
 if(provider==='google')assert.equal(response.cookies.temp_session_id.maxAge,0);
 }
 });
 test(`${provider}: actual callback accepts matching cookie and state once`,async()=>{
 const h=setup();const {state}=await oauth.storeOAuthState({sessionId:'browser-A',stateData:{userId:'user-A',redirect:'/classroom'},provider,client:h.client});
 const cookie=provider==='google'?'temp_session_id=browser-A':`access_token=${jwt.createAccessToken({id:'user-A'},'browser-A')}`;
 const req={query:{code:'fake-code',state},headers:{cookie}};const route=h.routes[provider==='google'?'/api/auth/google/callback':'/api/classroom/callback'];
 await route(req,res());assert.equal(h.effects.filter(x=>x==='exchange').length,1);const replay=res();await route(req,replay);assert.equal(h.effects.filter(x=>x==='exchange').length,1);assert.match(String(replay.body??replay.location),/invalid_state/);
 if(provider==='classroom')assert.ok(h.effects.includes('store:user-A'));
 });
}
test('Google start persists the same opaque identity placed in the browser cookie',async()=>{
 const h=setup();const r=res();await h.routes['/api/auth/google']({query:{},headers:{}},r);
 const cookie=r.cookies.temp_session_id;assert.equal(cookie.httpOnly,true);assert.equal(cookie.sameSite,'lax');assert.equal(cookie.maxAge,600000);assert.match(cookie.value,/^[A-Za-z0-9_-]{43}$/);
 const state=new URL(r.location).searchParams.get('state');const stored=h.records.get(crypto.createHash('sha256').update(state).digest('hex'));assert.equal(stored.session,cookie.value);assert.equal(stored.provider,'google');
});
test('Classroom start URL preserves the exact state accepted by the callback',async()=>{
 const h=setup();const r=res();const token=jwt.createAccessToken({id:'user-A'},'browser-A');const req={user:{sub:'user-A'},body:{redirect:'/classroom'},headers:{cookie:`access_token=${token}`}};
 await h.routes['/api/classroom/connect'](req,r);const state=new URL(r.body.authUrl).searchParams.get('state');assert.ok(h.records.has(crypto.createHash('sha256').update(state).digest('hex')));
 await h.routes['/api/classroom/callback']({query:{state,code:'fake-code'},headers:req.headers},res());assert.deepEqual(h.effects,['exchange','store:user-A']);
});
test('concurrent state consumption yields exactly one winner',async()=>{
 const h=setup();const {state}=await oauth.storeOAuthState({sessionId:'browser-A',stateData:{verified:true},provider:'google',client:h.client});
 const results=await Promise.all(Array.from({length:20},()=>oauth.verifyAndConsumeOAuthState({state,sessionId:'browser-A',provider:'google',client:h.client})));
 assert.equal(results.filter(Boolean).length,1);assert.equal(h.statements.filter(s=>/UPDATE oauth_states/.test(s)).length,20);
});
test('forgot-password production client commits before delivery and never returns token',async()=>{
 const events=[];let failCommit=false;let failInsert=false;
 const client={async query(sql){events.push(sql);if(sql.startsWith('SELECT'))return {rows:[{id:'user-A',email:'a@example.test',password_hash:'hash'}]};if(failCommit&&sql==='COMMIT')throw Error('commit failed');if(failInsert&&sql.startsWith('INSERT'))throw Error('insert failed');return {rows:[]}},release(){events.push('release')}};
 globalThis.__supervisorResetClient=client;
 let source=readFileSync(`${root}/lib/password-reset.js`,'utf8').replace("import { getClient } from './db.js';","const getClient = async () => globalThis.__supervisorResetClient;").replace("from './password.js'",`from 'file://${root}/lib/password.js'`);
 const reset=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
 const sendFn=async()=>{events.push('email');assert.ok(events.includes('COMMIT'));return {success:true}};
 const result=await reset.requestPasswordReset({email:'a@example.test',sendFn});assert.ok(events.indexOf('COMMIT')<events.indexOf('email'));assert.deepEqual(Object.keys(result).sort(),['message','success']);assert.doesNotMatch(JSON.stringify(result),/token=|resetUrl/);
 for(const failure of ['insert','commit']){events.length=0;failInsert=failure==='insert';failCommit=failure==='commit';try{await reset.requestPasswordReset({email:'a@example.test',sendFn})}catch{}assert.ok(!events.includes('email'));assert.ok(events.includes('ROLLBACK'));assert.ok(events.includes('release'));}
 delete globalThis.__supervisorResetClient;
});
test('both callbacks fail safely if state storage fails',async()=>{
 for(const provider of ['google','classroom']){
 const h=setup();h.context.verifyAndConsumeOAuthState=async()=>{throw Error('private database diagnostic')};
 const cookie=provider==='google'?'temp_session_id=browser-A':`access_token=${jwt.createAccessToken({id:'user-A'},'browser-A')}`;
 const r=res();await h.routes[provider==='google'?'/api/auth/google/callback':'/api/classroom/callback']({query:{state:'test-state',code:'fake-code'},headers:{cookie}},r);
 assert.equal(h.effects.length,0);assert.doesNotMatch(String(r.body??r.location),/private database diagnostic/);assert.ok(r.body||r.location);if(provider==='google')assert.equal(r.cookies.temp_session_id.maxAge,0);
 }
});
test('Google initiation returns safe failure when state cannot be persisted',async()=>{
 const h=setup();h.context.storeOAuthState=async()=>{throw Error('private database diagnostic')};const r=res();await h.routes['/api/auth/google']({query:{},headers:{}},r);assert.equal(r.statusCode,500);assert.doesNotMatch(JSON.stringify(r.body),/private database diagnostic/);assert.ok(!r.location);
});
test('provider error callbacks still require verified state',async()=>{
 for(const provider of ['google','classroom']){
 const h=setup();const r=res();await h.routes[provider==='google'?'/api/auth/google/callback':'/api/classroom/callback']({query:{error:'UNTRUSTED_PROVIDER_PAYLOAD'},headers:{}},r);
 assert.doesNotMatch(String(r.body??r.location),/UNTRUSTED_PROVIDER_PAYLOAD/);assert.match(String(r.body??r.location),/invalid_state|no_session/);assert.equal(h.effects.length,0);
 }
});
test('Classroom reads a cookie header with no optional spaces',async()=>{
 const token=jwt.createAccessToken({id:'user-A'},'browser-A');assert.equal(await oauth.getSessionIdFromRequest({headers:{cookie:`other=1;access_token=${encodeURIComponent(token)}`}},jwt.verifyAccessToken),'browser-A');
});
test('injected dedicated reset client also commits before delivery',async()=>{
 const reset=await import(`${root}/lib/password-reset.js`);const events=[];
 const client={async query(sql){events.push(sql);return {rows:sql.startsWith('SELECT')?[{id:'user-A',email:'a@example.test',password_hash:'hash'}]:[]}}};
 await reset.requestPasswordReset({email:'a@example.test',client,sendFn:async()=>{events.push('email');return {success:true}}});assert.equal(events[0],'BEGIN');assert.ok(events.indexOf('COMMIT')>=0);assert.ok(events.indexOf('COMMIT')<events.indexOf('email'));
});
test('mail network failure never logs or returns raw error details',async()=>{
 const reset=await import(`${root}/lib/password-reset.js`);const logs=[];const oldFetch=globalThis.fetch;const oldError=console.error;
 process.env.RESEND_API_KEY='supervisor-fake-key';globalThis.fetch=async()=>{throw Error('SENSITIVE_RESET_LINK_TOKEN')};console.error=(...args)=>logs.push(args);
 try{const result=await reset.sendPasswordResetEmail({email:'a@example.test',token:'fake-token',resetUrl:'https://example.test/fake'});assert.equal(result.success,false);assert.doesNotMatch(JSON.stringify([result,logs]),/SENSITIVE_RESET_LINK_TOKEN/)}finally{globalThis.fetch=oldFetch;console.error=oldError;delete process.env.RESEND_API_KEY}
});
test('reset API routes whitelist responses and catch failures generically',async()=>{
 for(const action of ['forgot-password','reset-password']){
 const h=setup();const req={body:{email:'a@example.test',token:'fake-token',new_password:'SafePassword123'}};let r=res();await h.routes[`/api/auth/${action}`](req,r);assert.equal(r.statusCode,200);assert.doesNotMatch(JSON.stringify(r.body),/MUST_NOT_LEAK|fake-token/);
 h.context[action==='forgot-password'?'requestPasswordReset':'completePasswordReset']=async()=>{throw Error('SENSITIVE_RESET_LINK_TOKEN')};r=res();await h.routes[`/api/auth/${action}`](req,r);assert.equal(r.statusCode,500);assert.doesNotMatch(JSON.stringify(r.body),/SENSITIVE_RESET_LINK_TOKEN/);
 }
});

test('malformed state parameters are rejected without querying the database', async () => {
  let queries = 0;
  const client = { async query() { queries++; return { rows: [] }; } };
  for (const field of ['state', 'sessionId', 'provider']) {
    for (const value of [undefined, null, '', [], {}, 123]) {
      const args = { state: 'state', sessionId: 'session', provider: 'google', client, [field]: value };
      assert.equal(await verifyAndConsumeOAuthState(args), null);
    }
  }
  assert.equal(queries, 0);
});

test('provider denial consumes matching state and rejects replay without exchanging code', async () => {
  for (const provider of ['google', 'classroom']) {
    const h = setup();
    const { state } = await oauth.storeOAuthState({ sessionId: 'browser-A', stateData: { userId: 'user-A' }, provider, client: h.client });
    const cookie = provider === 'google' ? 'temp_session_id=browser-A' : `access_token=${jwt.createAccessToken({ id: 'user-A' }, 'browser-A')}`;
    const route = h.routes[provider === 'google' ? '/api/auth/google/callback' : '/api/classroom/callback'];
    const req = { query: { state, error: 'PRIVATE_PROVIDER_DETAIL' }, headers: { cookie } };
    const first = res();
    await route(req, first);
    assert.match(String(first.body ?? first.location), /access_denied/);
    assert.doesNotMatch(String(first.body ?? first.location), /PRIVATE_PROVIDER_DETAIL/);
    assert.ok([...h.records.values()][0].used);
    const replay = res();
    await route(req, replay);
    assert.match(String(replay.body ?? replay.location), /invalid_state/);
    assert.equal(h.effects.length, 0);
  }
});

test('injected reset client rolls back failures without mail and retains release ownership', async () => {
  const { requestPasswordReset } = await import('../lib/password-reset.js');
  for (const failure of ['INSERT', 'COMMIT']) {
    const events = [];
    const client = {
      async query(sql) {
        events.push(sql);
        if (sql.startsWith(failure)) throw new Error('Simulated database failure');
        return { rows: sql.startsWith('SELECT') ? [{ id: 'user-A', email: 'a@example.test', password_hash: 'hash' }] : [] };
      },
      release() { events.push('release'); },
    };
    await assert.rejects(requestPasswordReset({ email: 'a@example.test', client, sendFn: async () => { events.push('mail'); return { success: true }; } }));
    assert.equal(events[0], 'BEGIN');
    assert.equal(events.at(-1), 'ROLLBACK');
    assert.ok(!events.includes('mail'));
    assert.ok(!events.includes('release'));
  }
});

test('forgot-password responses do not disclose missing or Google-only accounts', async () => {
  const { requestPasswordReset } = await import('../lib/password-reset.js');
  const replies = [];
  for (const account of [null, { id: 'user-A', email: 'a@example.test', password_hash: null }, { id: 'user-A', email: 'a@example.test', password_hash: 'hash' }]) {
    const events = [];
    const client = { async query(sql) { events.push(sql); return { rows: sql.startsWith('SELECT') && account ? [account] : [] }; } };
    replies.push(await requestPasswordReset({ email: 'a@example.test', client, sendFn: async () => { events.push('mail'); return { success: true }; } }));
    assert.ok(events.includes('COMMIT'));
    assert.equal(events.includes('mail'), Boolean(account?.password_hash));
  }
  assert.deepEqual(replies[0], replies[1]);
  assert.deepEqual(replies[1], replies[2]);
});

test('OAuth provider failures never log or reflect token-bearing exceptions', async () => {
  for (const provider of ['google', 'classroom']) {
    const h = setup();
    const { state } = await oauth.storeOAuthState({ sessionId: 'browser-A', stateData: { userId: 'user-A' }, provider, client: h.client });
    const cookie = provider === 'google' ? 'temp_session_id=browser-A' : `access_token=${jwt.createAccessToken({ id: 'user-A' }, 'browser-A')}`;
    h.context.fetch = h.context.exchangeClassroomCode = async () => { throw new Error('PRIVATE_PROVIDER_TOKEN'); };
    const r = res();
    await h.routes[provider === 'google' ? '/api/auth/google/callback' : '/api/classroom/callback']({ query: { state, code: 'fake-code' }, headers: { cookie } }, r);
    assert.doesNotMatch(JSON.stringify([h.logs, r.body, r.location]), /PRIVATE_PROVIDER_TOKEN/);
    assert.match(String(r.body ?? r.location), /auth_error|classroom_error/);
  }
});
