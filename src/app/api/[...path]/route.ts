import { z } from 'zod';
import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { query,transaction,audit } from '@/lib/db';
import { AppError, economicsSchema, scenarioSchema, money, type Evidence } from '@/lib/domain';
import { getSession,requireSession,requireSameOrigin,rateLimit,hashPassword,verifyPassword,createSession,setSessionCookie,tokenHash } from '@/lib/auth';
import { allClients,allCreatives,createClient,updateClient,getClient,getCreative,createUpload,retryCreative } from '@/lib/services';
import { getObject } from '@/lib/storage';
import { MAX_UPLOAD } from '@/lib/video';
import { researchUrl,searchPublic } from '@/lib/research';
import { scenarios,sensitivity,unitEconomics,actualMetrics } from '@/lib/finance';
import { aiKey,searchKey } from '@/lib/provider-http';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const idSchema=z.uuid();
const ok=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
async function json(req:Request) {
  const bytes=await limitedBody(req,64*1024);try{return JSON.parse(bytes.toString());}catch{throw new AppError(400,'Invalid JSON.');}
}
async function limitedBody(req:Request,max:number) {
  if(Number(req.headers.get('content-length'))>max)throw new AppError(413,'Request is too large.');
  const reader=req.body?.getReader();if(!reader)return Buffer.alloc(0);
  const chunks:Buffer[]=[];let size=0;
  try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>max){await reader.cancel();throw new AppError(413,'Request is too large.');}chunks.push(Buffer.from(r.value));}}finally{reader.releaseLock();}
  return Buffer.concat(chunks);
}
async function handler(req:Request,ctx:{params:Promise<{path:string[]}>}) {
  try {
    const {path:p}=await ctx.params;const method=req.method;
    if(method!=='GET')requireSameOrigin(req);
    if(p[0]==='health'&&method==='GET'){await query('SELECT 1');return ok({status:'ok'});}
    if(p[0]==='auth'&&p[1]==='me'&&method==='GET')return ok({session:await getSession()});
    if(p[0]==='auth'&&p[1]==='demo'&&method==='POST'){
      if(process.env.DEMO_MODE!=='true'||!['localhost','127.0.0.1'].includes(new URL(process.env.APP_URL??'https://invalid').hostname))throw new AppError(404,'Demo access is disabled.');
      await rateLimit('demo-login',60,3600);
      const [u]=await query<{id:string;workspace_id:string}>('SELECT u.id,m.workspace_id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=$1 LIMIT 1',[process.env.DEMO_EMAIL??'demo@agencyos.local']);
      if(!u)throw new AppError(422,'Demo data has not been prepared.');await setSessionCookie(await createSession(u.id,u.workspace_id));return ok({success:true});
    }
    if(p[0]==='auth'&&['login','register'].includes(p[1])&&method==='POST'){
      const input=z.object({email:z.email().max(254).transform(v=>v.toLowerCase().trim()),password:z.string().min(10).max(128),name:z.string().min(2).max(80).optional(),workspace:z.string().min(2).max(100).optional()}).parse(await json(req));
      await rateLimit('auth:'+createHash('sha256').update(input.email).digest('hex'),10,900);
      let userId:string,workspaceId:string;
      if(p[1]==='register'){
        await rateLimit('registration',50,3600);
        if(!input.name||!input.workspace)throw new AppError(400,'Name and agency name are required.');
        const hash=await hashPassword(input.password);
        const ids=await transaction(async db=>{
          const existing=await db.query('SELECT 1 FROM users WHERE email=$1',[input.email]);if(existing.rowCount)throw new AppError(409,'Unable to create this account. Try signing in.');
          const user=(await db.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[input.email,input.name,hash])).rows[0];
          const w=(await db.query('INSERT INTO workspaces(name) VALUES($1) RETURNING id',[input.workspace])).rows[0];
          await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,\'owner\')',[w.id,user.id]);return {userId:user.id,workspaceId:w.id};
        });userId=ids.userId;workspaceId=ids.workspaceId;
      }else{
        const [user]=await query<{id:string;password_hash:string;workspace_id:string}>(`SELECT u.id,u.password_hash,m.workspace_id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=$1 ORDER BY m.role DESC LIMIT 1`,[input.email]);
        const valid=await verifyPassword(input.password,user?.password_hash??('0'.repeat(32)+':'+ '0'.repeat(128)));
        if(!user||!valid)throw new AppError(401,'Email or password is incorrect.');userId=user.id;workspaceId=user.workspace_id;
      }
      const token=await createSession(userId,workspaceId);await setSessionCookie(token);await audit(workspaceId,userId,'auth.'+p[1],userId);return ok({success:true});
    }
    const s=await requireSession();
    if(p[0]==='auth'&&p[1]==='logout'&&method==='POST'){const jar=await cookies();const token=jar.get('agencyos_session')?.value;if(token)await query('DELETE FROM sessions WHERE id=$1',[tokenHash(token)]);jar.delete('agencyos_session');return ok({success:true});}
    if(method!=='GET')await rateLimit('write:'+s.workspaceId,150,60);
    if(p[0]==='bootstrap'&&method==='GET'){
      const [clients,creatives,competitors,sources,experiments,logs]=await Promise.all([
        allClients(s.workspaceId),allCreatives(s.workspaceId),
        query('SELECT * FROM competitors WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 100',[s.workspaceId]),
        query<Evidence&{client_id:string}>('SELECT id,client_id,title,url,excerpt,kind,provenance,fetched_at AS "fetchedAt" FROM research_sources WHERE workspace_id=$1 ORDER BY fetched_at DESC LIMIT 100',[s.workspaceId]),
        query('SELECT e.*,c.name AS client_name FROM experiments e JOIN clients c ON c.id=e.client_id AND c.workspace_id=e.workspace_id WHERE e.workspace_id=$1 ORDER BY e.created_at DESC LIMIT 100',[s.workspaceId]),
        query('SELECT id,action,entity_id,created_at FROM audit_logs WHERE workspace_id=$1 ORDER BY created_at DESC LIMIT 20',[s.workspaceId]),
      ]);return ok({session:s,clients,creatives,competitors,sources,experiments,logs,integrations:{multimodal:!!aiKey(),search:!!searchKey(),storage:process.env.STORAGE_DRIVER??'local'}});
    }
    if(p[0]==='clients'){
      if(p.length===1&&method==='GET')return ok(await allClients(s.workspaceId));
      if(p.length===1&&method==='POST')return ok(await createClient(s,await json(req)),201);
      const id=idSchema.parse(p[1]);
      if(method==='GET')return ok(await getClient(s.workspaceId,id));
      if(method==='PATCH')return ok(await updateClient(s,id,await json(req)));
    }
    if(p[0]==='creatives'){
      if(p.length===1&&method==='GET')return ok(await allCreatives(s.workspaceId));
      if(p.length===1&&method==='POST'){
        await rateLimit('upload:'+s.workspaceId,20,3600);
        if(!req.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new AppError(415,'Use multipart form data.');
        const bytes=await limitedBody(req,MAX_UPLOAD+65536);
        const form=await new Response(new Uint8Array(bytes),{headers:{'content-type':req.headers.get('content-type')!}}).formData();
        const file=form.get('video'),clientId=idSchema.parse(form.get('clientId'));
        if(!(file instanceof File))throw new AppError(400,'Select a video.');
        const transcript=z.string().max(20000).parse(form.get('transcript')??'')||null;
        return ok(await createUpload(s,clientId,{name:file.name,type:file.type,data:Buffer.from(await file.arrayBuffer())},transcript),202);
      }
      const id=idSchema.parse(p[1]);
      if(p[2]==='retry'&&method==='POST')return ok(await retryCreative(s,id),202);
      if(p[2]==='variants'&&method==='GET'){await getCreative(s.workspaceId,id);return ok(await query('SELECT * FROM creative_versions WHERE workspace_id=$1 AND creative_id=$2 ORDER BY created_at',[s.workspaceId,id]));}
      if(method==='GET')return ok(await getCreative(s.workspaceId,id));
    }
    if(p[0]==='assets'&&method==='GET'){
      const c=await getCreative(s.workspaceId,idSchema.parse(p[1]));let key=c.storage_key,type=c.mime_type;
      if(p[2]==='frame'){const i=z.coerce.number().int().min(0).max(11).parse(p[3]);const frame=c.result?.video.frames[i];if(!frame)throw new AppError(404,'Frame not found.');key=frame.key;type='image/jpeg';}
      if(p[2]==='audio'){if(!c.result?.video.audioKey)throw new AppError(404,'Audio not found.');key=c.result.video.audioKey;type='audio/wav';}
      if(!key.startsWith(s.workspaceId+'/'))throw new AppError(404,'Asset not found.');
      const data=await getObject(key);const headers={'Content-Type':type,'Cache-Control':'private, max-age=300','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
      const range=req.headers.get('range');
      if(range){const m=/^bytes=(\d+)-(\d*)$/.exec(range);if(!m)return new Response(null,{status:416});const start=Number(m[1]),end=m[2]?Math.min(Number(m[2]),data.length-1):data.length-1;if(start>end||start>=data.length)return new Response(null,{status:416,headers:{'Content-Range':`bytes */${data.length}`}});return new Response(new Uint8Array(data.subarray(start,end+1)),{status:206,headers:{...headers,'Content-Range':`bytes ${start}-${end}/${data.length}`,'Content-Length':String(end-start+1)}});}
      return new Response(new Uint8Array(data),{headers:{...headers,'Content-Length':String(data.length)}});
    }
    if(p[0]==='competitors'&&method==='POST'){
      const body=z.object({clientId:idSchema,name:z.string().min(2).max(100),website:z.url().max(2000).refine(v=>new URL(v).protocol==='https:','Use a public HTTPS website.'),kind:z.enum(['direct','indirect','leader']).default('direct'),notes:z.string().max(2000).default('')}).parse(await json(req));await getClient(s.workspaceId,body.clientId);
      const [row]=await query('INSERT INTO competitors(workspace_id,client_id,name,website,kind,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[s.workspaceId,body.clientId,body.name,body.website,body.kind,body.notes]);await audit(s.workspaceId,s.userId,'competitor.added',String(row.id));return ok(row,201);
    }
    if(p[0]==='research'&&method==='POST'){
      const body=z.object({clientId:idSchema,url:z.url().max(2000).optional(),search:z.string().min(3).max(300).optional(),kind:z.enum(['competitor','market','customer','trend','landing-page']).default('competitor')}).parse(await json(req));await getClient(s.workspaceId,body.clientId);await rateLimit('research:'+s.workspaceId,20,3600);
      if(!body.url&&!body.search)throw new AppError(400,'Provide a public URL or search query.');
      const result=body.url?await researchUrl(s.workspaceId,body.clientId,body.url,body.kind):await searchPublic(s.workspaceId,body.clientId,body.search!);await audit(s.workspaceId,s.userId,'research.collected',body.clientId);return ok(result);
    }
    if(p[0]==='forecasts'&&method==='POST'){
      const body=z.object({clientId:idSchema,assumptions:scenarioSchema,economics:economicsSchema.optional()}).parse(await json(req));const client=await getClient(s.workspaceId,body.clientId);const e=body.economics??client.economics;if(!e)throw new AppError(422,'Complete the financial profile first.');
      const result={unit:unitEconomics(e),scenarios:scenarios(e,body.assumptions),sensitivity:sensitivity(e,body.assumptions)};
      await query('INSERT INTO forecasts(workspace_id,client_id,assumptions,result,provenance) VALUES($1,$2,$3,$4,$5)',[s.workspaceId,client.id,JSON.stringify({economics:e,...body.assumptions}),JSON.stringify(result),client.simulated?'simulated':'estimated']);await audit(s.workspaceId,s.userId,'forecast.created',client.id);return ok(result);
    }
    if(p[0]==='experiments'&&method==='POST'){
      const body=z.object({creativeId:idSchema,variantName:z.string().max(200).optional()}).parse(await json(req));const c=await getCreative(s.workspaceId,body.creativeId);if(!c.result)throw new AppError(422,'Complete the creative analysis first.');
      const [v]=await query<{id:string;name:string;instruction:string;hypothesis:string;variable:string}>('SELECT * FROM creative_versions WHERE workspace_id=$1 AND creative_id=$2 AND parent_id IS NOT NULL AND ($3::text IS NULL OR name=$3) ORDER BY created_at LIMIT 1',[s.workspaceId,c.id,body.variantName??null]);
      if(!v)throw new AppError(404,'Variant not found.');
      const proposal={...c.result.experiment,name:v.name,treatment:v.instruction,hypothesis:v.hypothesis,variable:v.variable};
      const [row]=await query('INSERT INTO experiments(workspace_id,client_id,creative_id,variant_id,name,proposal) VALUES($1,$2,$3,$4,$5,$6) RETURNING id',[s.workspaceId,c.client_id,c.id,v.id,v.name,JSON.stringify(proposal)]);await audit(s.workspaceId,s.userId,'experiment.proposed',String(row.id));return ok(row,201);
    }
    if(p[0]==='experiments'&&method==='PATCH'){
      const id=idSchema.parse(p[1]);const [e]=await query<{id:string;client_id:string;proposal:{minimumSamplePerArm:number|null}}>('SELECT * FROM experiments WHERE workspace_id=$1 AND id=$2',[s.workspaceId,id]);if(!e)throw new AppError(404,'Experiment not found.');
      const arm=z.object({spend:money,clicks:z.number().int().nonnegative(),purchases:z.number().int().nonnegative(),newCustomers:z.number().int().nonnegative(),netRevenue:money,contributionBeforeAds:money});
      const body=z.object({status:z.enum(['draft','running','completed','stopped']),results:z.object({control:arm,treatment:arm,days:z.number().int().nonnegative(),refundWindowClosed:z.boolean(),notes:z.string().max(2000)}).optional()}).parse(await json(req));
      let results:unknown=null;
      if(body.results){const r=body.results;for(const a of [r.control,r.treatment])if(a.purchases>a.clicks||a.newCustomers>a.purchases)throw new AppError(400,'Purchases cannot exceed clicks; new customers cannot exceed purchases.');
        const metrics=(a:z.infer<typeof arm>)=>actualMetrics({adSpend:a.spend,marketingSpend:a.spend,orders:a.purchases,newCustomers:a.newCustomers,netRevenue:a.netRevenue,contributionBeforeAds:a.contributionBeforeAds});
        const sufficient=!!e.proposal.minimumSamplePerArm&&r.control.clicks>=e.proposal.minimumSamplePerArm&&r.treatment.clicks>=e.proposal.minimumSamplePerArm&&Math.min(r.control.purchases,r.treatment.purchases)>=30&&r.days>=7&&r.refundWindowClosed;
        results={...r,controlMetrics:metrics(r.control),treatmentMetrics:metrics(r.treatment),conclusion:sufficient?'Sample threshold met. Review attribution, profit uncertainty and replication before choosing a winner.':'INCONCLUSIVE — required sample, duration or refund observation window is incomplete.',provenance:'User-entered; not independently verified'};
      }
      if(body.status==='completed'&&!results)throw new AppError(400,'Enter both experiment arms before completing the experiment.');
      await query('UPDATE experiments SET status=$3,results=COALESCE($4,results) WHERE workspace_id=$1 AND id=$2',[s.workspaceId,id,body.status,results?JSON.stringify(results):null]);await audit(s.workspaceId,s.userId,'experiment.updated',id);return ok({id});
    }
    if(p[0]==='settings'&&method==='PATCH'){
      if(s.role!=='owner')throw new AppError(403,'Only workspace owners can change settings.');const body=z.object({name:z.string().min(2).max(100)}).parse(await json(req));await query('UPDATE workspaces SET name=$2 WHERE id=$1',[s.workspaceId,body.name]);await audit(s.workspaceId,s.userId,'workspace.updated',s.workspaceId);return ok({success:true});
    }
    if(p[0]==='workspaces'&&method==='GET')return ok(await query('SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=$1',[s.userId]));
    if(p[0]==='workspaces'&&method==='POST'){
      const body=z.object({workspaceId:idSchema}).parse(await json(req));const [membership]=await query('SELECT 1 FROM memberships WHERE workspace_id=$1 AND user_id=$2',[body.workspaceId,s.userId]);if(!membership)throw new AppError(404,'Workspace not found.');await setSessionCookie(await createSession(s.userId,body.workspaceId));return ok({success:true});
    }
    if(p[0]==='members'&&method==='POST'){
      if(s.role!=='owner')throw new AppError(403,'Only workspace owners can add members.');const body=z.object({email:z.email()}).parse(await json(req));const [user]=await query<{id:string}>('SELECT id FROM users WHERE email=$1',[body.email.toLowerCase()]);if(!user)throw new AppError(404,'This person must register an account first.');await query('INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,\'member\') ON CONFLICT DO NOTHING',[s.workspaceId,user.id]);await audit(s.workspaceId,s.userId,'member.added',user.id);return ok({success:true});
    }
    if(p[0]==='reports'&&method==='GET'){
      const c=await getCreative(s.workspaceId,idSchema.parse(p[1]));if(!c.result)throw new AppError(422,'Analysis is not complete.');
      await audit(s.workspaceId,s.userId,'report.exported',c.id);
      return new Response(JSON.stringify({creative:c.name,clientId:c.client_id,...c.result},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="agencyos-${c.id}.json"`,'Cache-Control':'no-store'}});
    }
    throw new AppError(404,'Endpoint not found.');
  }catch(error){
    if(error instanceof AppError)return ok({error:error.message},error.status);
    if(error instanceof z.ZodError)return ok({error:error.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},400);
    console.error('API request failed:',error instanceof Error?error.name:'Unknown error');return ok({error:'The request could not be completed. Check service availability and try again.'},500);
  }
}
export {handler as GET,handler as POST,handler as PATCH};
