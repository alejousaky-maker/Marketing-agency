import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { randomUUID,randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pool,query,transaction } from '../src/lib/db';
import { hashPassword,createSession,type Session } from '../src/lib/auth';
import { createClient,getClient,listClients,getCreative,createUpload } from '../src/lib/services';
import { economics } from './fixtures';
import { deleteObject } from '../src/lib/storage';
import { makeDemoVideo } from '../scripts/demo-video';
const base=process.env.APP_URL??'http://localhost:3000';
const suite=process.env.RUN_INTEGRATION==='1'?describe:describe.skip;
suite('real PostgreSQL and HTTP integration / tenant isolation',()=>{
  const contexts:Session[]=[],cookies:string[]=[];let clientA:string,clientB:string,creativeA:string;
  const password=randomBytes(24).toString('base64url');
  async function api(path:string,tenant=0,method='GET',body?:unknown,headers:Record<string,string>={}){return fetch(base+'/api/'+path,{method,headers:{cookie:cookies[tenant]??'',origin:base,...(body&&!(body instanceof FormData)?{'content-type':'application/json'}:{}),...headers},body:body instanceof FormData?body:body?JSON.stringify(body):undefined});}
  beforeAll(async()=>{
    for(let i=0;i<2;i++){const email=`test-${randomUUID()}@example.test`,hash=await hashPassword(password);const c=await transaction(async db=>{const u=(await db.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,'Integration test',hash])).rows[0];const w=(await db.query('INSERT INTO workspaces(name) VALUES($1) RETURNING id',['Integration test'])).rows[0];await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,\'owner\')',[w.id,u.id]);return {userId:u.id,workspaceId:w.id,email,name:'Integration test',workspaceName:'Integration test',role:'owner' as const};});contexts.push(c);cookies.push('agencyos_session='+await createSession(c.userId,c.workspaceId));}
    const raw={name:'Integration client',industry:'Home',website:'',geography:'US',currency:'USD',audience:'Households',productName:'Product',price:100,offer:'Starter',economics};
    clientA=(await createClient(contexts[0],raw)).id;clientB=(await createClient(contexts[1],raw)).id;
  });
  afterAll(async()=>{
    for(const s of contexts){
      const media=await query<{storage_key:string;result:{video:{frames:{key:string}[];audioKey:string|null}}|null}>('SELECT c.storage_key,a.result FROM creatives c LEFT JOIN analyses a ON a.creative_id=c.id WHERE c.workspace_id=$1',[s.workspaceId]);for(const m of media){await deleteObject(m.storage_key);for(const f of m.result?.video.frames??[])await deleteObject(f.key);if(m.result?.video.audioKey)await deleteObject(m.result.video.audioKey);}
      await transaction(async db=>{for(const table of ['knowledge_findings','experiments','forecasts','recommendations','trends','market_opportunities','creative_versions','analyses','jobs','creatives','research_sources','competitors','financial_profiles','products','offers','clients','provider_cache','audit_logs','sessions','memberships'])await db.query(`DELETE FROM ${table} WHERE workspace_id=$1`,[s.workspaceId]);await db.query('DELETE FROM workspaces WHERE id=$1',[s.workspaceId]);await db.query('DELETE FROM users WHERE id=$1',[s.userId]);});
    }await pool.end();
  });
  it('authenticates a stored password and issues a private session cookie',async()=>{const r=await api('auth/login',0,'POST',{email:contexts[0].email,password});expect(r.status).toBe(200);expect(r.headers.get('set-cookie')).toContain('HttpOnly');expect(r.headers.get('set-cookie')).toContain('SameSite=lax');});
  it('rejects invalid credentials',async()=>expect((await api('auth/login',0,'POST',{email:contexts[0].email,password:'incorrect-password'})).status).toBe(401));
  it('requires a session for private API data',async()=>expect((await fetch(base+'/api/bootstrap')).status).toBe(401));
  it('does not disclose clients across workspaces in Drizzle queries',async()=>{const rows=await listClients(contexts[0].workspaceId);expect(rows.map(r=>r.id)).toContain(clientA);expect(rows.map(r=>r.id)).not.toContain(clientB);});
  it('rejects cross-workspace service reads',async()=>expect(getClient(contexts[1].workspaceId,clientA)).rejects.toMatchObject({status:404}));
  it('rejects cross-workspace API reads and writes',async()=>{expect((await api('clients/'+clientA,1)).status).toBe(404);expect((await api('clients/'+clientA,1,'PATCH',{})).status).toBe(404);});
  it('enforces composite tenant foreign keys in PostgreSQL',async()=>expect(query('INSERT INTO competitors(workspace_id,client_id,name,website) VALUES($1,$2,$3,$4)',[contexts[1].workspaceId,clientA,'Invalid','https://example.com'])).rejects.toMatchObject({code:'23503'}));
  it('blocks unauthorized workspace switching',async()=>expect((await api('workspaces',1,'POST',{workspaceId:contexts[0].workspaceId})).status).toBe(404));
  it('rejects a missing or forged Origin',async()=>expect((await api('clients',0,'POST',{}, {origin:'https://attacker.example'})).status).toBe(403));
  it('rejects malformed economics rather than filling missing values',async()=>{const r=await api('clients',0,'POST',{name:'Bad client',industry:'Home',geography:'US',productName:'P',price:10,economics:{aov:10}});expect(r.status).toBe(400);});
  it('rejects a disguised video through the upload API',async()=>{const form=new FormData();form.set('clientId',clientA);form.set('video',new Blob(['not a video'],{type:'video/mp4'}),'fake.mp4');expect((await api('creatives',0,'POST',form)).status).toBe(415);});
  it('blocks uploads into another tenant',async()=>{const form=new FormData();form.set('clientId',clientA);form.set('video',new Blob(['not a video'],{type:'video/mp4'}),'fake.mp4');expect((await api('creatives',1,'POST',form)).status).toBe(404);});
  it('blocks private-network research URLs',async()=>expect((await api('research',0,'POST',{clientId:clientA,url:'https://localhost'})).status).toBe(400));
  it('saves scenarios and returns deterministic arithmetic',async()=>{const r=await api('forecasts',0,'POST',{clientId:clientA,assumptions:{budget:1000,cpm:10,ctr:.02,cvr:.04,source:'Integration fixture',sampleSize:200}});expect(r.status).toBe(200);expect((await r.json()).scenarios.base.contributionAfterAds).toBeCloseTo(2520);});
  it('uploads real media and completes the durable analysis workflow',async()=>{
    const file=await makeDemoVideo();const form=new FormData();form.set('clientId',clientA);form.set('video',new Blob([new Uint8Array(await readFile(file))],{type:'video/mp4'}),'integration.mp4');form.set('transcript','User provided transcript: Find your daily ritual.');
    const r=await api('creatives',0,'POST',form);expect(r.status).toBe(202);creativeA=(await r.json()).id;
    let c=await getCreative(contexts[0].workspaceId,creativeA);for(let i=0;i<45&&c.status!=='complete'&&c.status!=='failed';i++){await new Promise(r=>setTimeout(r,1000));c=await getCreative(contexts[0].workspaceId,creativeA);}
    expect(c.status).toBe('complete');expect(c.result?.video.frames.length).toBeGreaterThan(0);expect(c.result?.economicsInputs).toEqual(economics);expect(c.result?.decision.label).toBe('REVISE BEFORE TEST');expect(c.result?.provenance).toBe('estimated');
  });
  it('authorizes video range requests and protects all derived media',async()=>{const r=await api('assets/'+creativeA,0,'GET',undefined,{range:'bytes=0-99'});expect(r.status).toBe(206);expect((await r.arrayBuffer()).byteLength).toBe(100);for(const path of ['assets/'+creativeA,'assets/'+creativeA+'/frame/0','creatives/'+creativeA,'creatives/'+creativeA+'/variants','reports/'+creativeA])expect((await api(path,1)).status).toBe(404);});
  it('creates lineage-linked experiment proposals and prevents tiny-sample winners',async()=>{const r=await api('experiments',0,'POST',{creativeId:creativeA});expect(r.status).toBe(201);const id=(await r.json()).id;const arm={spend:50,clicks:10,purchases:1,newCustomers:1,netRevenue:100,contributionBeforeAds:44};const update=await api('experiments/'+id,0,'PATCH',{status:'completed',results:{control:arm,treatment:arm,days:1,refundWindowClosed:false,notes:'Tiny test'}});expect(update.status).toBe(200);const [row]=await query<{variant_id:string;results:{conclusion:string}}>('SELECT variant_id,results FROM experiments WHERE id=$1',[id]);expect(row.variant_id).toBeTruthy();expect(row.results.conclusion).toContain('INCONCLUSIVE');expect((await api('experiments/'+id,1,'PATCH',{status:'running'})).status).toBe(404);});
  it('retries idempotently without duplicating analyses, recommendations or variants',async()=>{
    const [before]=await query<{count:string}>('SELECT count(*) FROM creative_versions WHERE workspace_id=$1 AND creative_id=$2',[contexts[0].workspaceId,creativeA]);expect((await api('creatives/'+creativeA+'/retry',0,'POST')).status).toBe(202);
    let c=await getCreative(contexts[0].workspaceId,creativeA);for(let i=0;i<45&&c.status!=='complete';i++){await new Promise(r=>setTimeout(r,1000));c=await getCreative(contexts[0].workspaceId,creativeA);}expect(c.status).toBe('complete');const [a]=await query<{count:string}>('SELECT count(*) FROM analyses WHERE workspace_id=$1 AND creative_id=$2',[contexts[0].workspaceId,creativeA]);expect(a.count).toBe('1');const [after]=await query<{count:string}>('SELECT count(*) FROM creative_versions WHERE workspace_id=$1 AND creative_id=$2',[contexts[0].workspaceId,creativeA]);expect(after.count).toBe(before.count);
  });
  it('exports assumptions and provenance and logs the operation',async()=>{const r=await api('reports/'+creativeA);expect(r.status).toBe(200);const report=await r.json();expect(report.uncertainty.assumptions.length).toBeGreaterThan(0);expect(report.provenance).toBe('estimated');expect((await query('SELECT 1 FROM audit_logs WHERE workspace_id=$1 AND action=$2',[contexts[0].workspaceId,'report.exported'])).length).toBeGreaterThan(0);});
});
