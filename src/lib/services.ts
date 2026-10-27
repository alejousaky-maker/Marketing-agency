import { randomUUID, createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { query,transaction,audit,db } from './db';
import { clients as clientsTable } from './schema';
import { AppError, clientSchema, type Evidence } from './domain';
import { type Session } from './auth';
import { type ClientContext, type AnalysisResult } from './intelligence';
import { putObject,deleteObject } from './storage';
import { validateUpload } from './video';
export type ClientRow=ClientContext&{created_at:string;price:number;offer:string;product_name:string};
export async function getClient(workspaceId:string,id:string):Promise<ClientContext> {
  const [c]=await query<ClientContext>(`SELECT c.*,f.inputs AS economics,(SELECT name FROM products p WHERE p.workspace_id=c.workspace_id AND p.client_id=c.id LIMIT 1) AS "productName",(SELECT description FROM offers o WHERE o.workspace_id=c.workspace_id AND o.client_id=c.id LIMIT 1) AS offer FROM clients c LEFT JOIN financial_profiles f ON f.workspace_id=c.workspace_id AND f.client_id=c.id WHERE c.workspace_id=$1 AND c.id=$2`,[workspaceId,id]);
  if(!c)throw new AppError(404,'Client not found.');return c;
}
export async function createClient(s:Session,raw:unknown,simulated=false) {
  const c=clientSchema.parse(raw);
  const id=await transaction(async db=>{
    const {rows}=await db.query('INSERT INTO clients(workspace_id,name,industry,website,geography,currency,audience,simulated) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[s.workspaceId,c.name,c.industry,c.website,c.geography,c.currency,c.audience,simulated]);const id=rows[0].id;
    await db.query('INSERT INTO products(workspace_id,client_id,name,price) VALUES($1,$2,$3,$4)',[s.workspaceId,id,c.productName,c.price]);
    await db.query('INSERT INTO offers(workspace_id,client_id,description) VALUES($1,$2,$3)',[s.workspaceId,id,c.offer]);
    if(c.economics)await db.query('INSERT INTO financial_profiles(workspace_id,client_id,inputs) VALUES($1,$2,$3)',[s.workspaceId,id,JSON.stringify(c.economics)]);
    await db.query('INSERT INTO audit_logs(workspace_id,user_id,action,entity_id) VALUES($1,$2,$3,$4)',[s.workspaceId,s.userId,'client.created',id]);return id;
  });return {id};
}
export async function listClients(workspaceId:string) {return db.select().from(clientsTable).where(eq(clientsTable.workspaceId,workspaceId));}
export async function allClients(workspaceId:string) {return query<ClientRow>(`SELECT c.*,f.inputs AS economics,(SELECT name FROM products p WHERE p.workspace_id=c.workspace_id AND p.client_id=c.id LIMIT 1) AS product_name,(SELECT price FROM products p WHERE p.workspace_id=c.workspace_id AND p.client_id=c.id LIMIT 1) AS price,(SELECT description FROM offers o WHERE o.workspace_id=c.workspace_id AND o.client_id=c.id LIMIT 1) AS offer FROM clients c LEFT JOIN financial_profiles f ON c.id=f.client_id AND c.workspace_id=f.workspace_id WHERE c.workspace_id=$1 ORDER BY c.created_at DESC LIMIT 100`,[workspaceId]);}
export async function updateClient(s:Session,id:string,raw:unknown) {
  await getClient(s.workspaceId,id);const c=clientSchema.parse(raw);
  await transaction(async db=>{
    await db.query('UPDATE clients SET name=$3,industry=$4,website=$5,geography=$6,currency=$7,audience=$8 WHERE workspace_id=$1 AND id=$2',[s.workspaceId,id,c.name,c.industry,c.website,c.geography,c.currency,c.audience]);
    await db.query('UPDATE products SET name=$3,price=$4 WHERE workspace_id=$1 AND client_id=$2',[s.workspaceId,id,c.productName,c.price]);
    await db.query('UPDATE offers SET description=$3 WHERE workspace_id=$1 AND client_id=$2',[s.workspaceId,id,c.offer]);
    if(c.economics)await db.query('INSERT INTO financial_profiles(workspace_id,client_id,inputs) VALUES($1,$2,$3) ON CONFLICT(workspace_id,client_id) DO UPDATE SET inputs=$3,updated_at=now()',[s.workspaceId,id,JSON.stringify(c.economics)]);
    else await db.query('DELETE FROM financial_profiles WHERE workspace_id=$1 AND client_id=$2',[s.workspaceId,id]);
    await db.query('INSERT INTO audit_logs(workspace_id,user_id,action,entity_id) VALUES($1,$2,$3,$4)',[s.workspaceId,s.userId,'client.updated',id]);
  });return {id};
}
export async function createUpload(s:Session,clientId:string,file:{name:string;type:string;data:Buffer},transcript:string|null,simulated=false) {
  const client=await getClient(s.workspaceId,clientId);
  if(simulated&&!client.simulated)throw new AppError(400,'Demo uploads require a demo client.');
  const ext=validateUpload(file.name,file.type,file.data.length,file.data.subarray(0,16));
  const sha=createHash('sha256').update(file.data).digest('hex');const id=randomUUID(),key=`${s.workspaceId}/${clientId}/${id}${ext}`;
  await putObject(key,file.data,ext==='.webm'?'video/webm':ext==='.mov'?'video/quicktime':'video/mp4');
  try{
    await transaction(async db=>{
      await db.query('INSERT INTO creatives(id,workspace_id,client_id,name,storage_key,mime_type,size,sha256,simulated,manual_transcript) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[id,s.workspaceId,clientId,file.name.slice(0,150),key,ext==='.webm'?'video/webm':ext==='.mov'?'video/quicktime':'video/mp4',file.data.length,sha,client.simulated,transcript]);
      await db.query('INSERT INTO jobs(workspace_id,creative_id) VALUES($1,$2)',[s.workspaceId,id]);
      await db.query('INSERT INTO audit_logs(workspace_id,user_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)',[s.workspaceId,s.userId,'creative.uploaded',id,JSON.stringify({sha256:sha,size:file.data.length,simulated:client.simulated})]);
    });
  }catch(error){await deleteObject(key);throw error;}
  return {id,status:'queued'};
}
export async function evidenceFor(workspaceId:string,clientId:string) {return query<Evidence>('SELECT id,title,url,excerpt,kind,provenance,fetched_at AS "fetchedAt" FROM research_sources WHERE workspace_id=$1 AND client_id=$2 ORDER BY fetched_at DESC LIMIT 30',[workspaceId,clientId]);}
export type CreativeRow={id:string;client_id:string;name:string;status:string;error:string|null;simulated:boolean;created_at:string;result:AnalysisResult|null;client_name:string;mime_type:string;size:number};
export async function allCreatives(workspaceId:string) {return query<CreativeRow>(`SELECT c.id,c.client_id,c.name,c.status,c.error,c.simulated,c.created_at,c.mime_type,c.size,cl.name AS client_name,a.result FROM creatives c JOIN clients cl ON cl.id=c.client_id AND cl.workspace_id=c.workspace_id LEFT JOIN analyses a ON a.creative_id=c.id AND a.workspace_id=c.workspace_id WHERE c.workspace_id=$1 ORDER BY c.created_at DESC LIMIT 50`,[workspaceId]);}
export async function getCreative(workspaceId:string,id:string) {const [r]=await query<CreativeRow&{storage_key:string;sha256:string;manual_transcript:string|null}>('SELECT c.*,a.result FROM creatives c LEFT JOIN analyses a ON a.workspace_id=c.workspace_id AND a.creative_id=c.id WHERE c.workspace_id=$1 AND c.id=$2',[workspaceId,id]);if(!r)throw new AppError(404,'Creative not found.');return r;}
export async function retryCreative(s:Session,id:string) {
  const c=await getCreative(s.workspaceId,id);if(['queued','processing'].includes(c.status))throw new AppError(409,'Analysis is already in progress.');
  await transaction(async db=>{
    await db.query('UPDATE jobs SET status=\'queued\',attempts=0,error=NULL,available_at=now(),locked_at=NULL,lock_token=NULL WHERE workspace_id=$1 AND creative_id=$2',[s.workspaceId,id]);
    await db.query('UPDATE creatives SET status=\'queued\',error=NULL WHERE workspace_id=$1 AND id=$2',[s.workspaceId,id]);
  });await audit(s.workspaceId,s.userId,'creative.reanalyze',id);return {id};
}
