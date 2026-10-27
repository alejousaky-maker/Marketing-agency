import { randomUUID } from 'node:crypto';
import { query,transaction } from './db';
import { getClient,getCreative,evidenceFor } from './services';
import { processVideo } from './video';
import { analyzeSemantic,assembleAnalysis,analysisCacheKey } from './intelligence';
type Job={id:string;workspace_id:string;creative_id:string;attempts:number;lock_token:string};
export async function runNextJob() {
  await transaction(async db=>{
    const exhausted=await db.query("UPDATE jobs SET status='failed',error='Worker stopped during the final attempt. Retry the analysis.',locked_at=NULL,lock_token=NULL WHERE status='processing' AND locked_at<now()-interval '15 minutes' AND attempts>=3 RETURNING workspace_id,creative_id");
    for(const j of exhausted.rows)await db.query("UPDATE creatives SET status='failed',error='Worker stopped during the final attempt. Retry the analysis.' WHERE workspace_id=$1 AND id=$2",[j.workspace_id,j.creative_id]);
  });
  // A crashed worker may be reclaimed after a lease expires; heartbeat protects active jobs.
  const token=randomUUID();
  const [job]=await query<Job>(`UPDATE jobs SET status='processing',attempts=attempts+1,locked_at=now(),lock_token=$1 WHERE id=(SELECT id FROM jobs WHERE (status='queued' AND available_at<=now() OR status='processing' AND locked_at<now()-interval '15 minutes') AND attempts<3 ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[token]);
  if(!job)return false;
  const heartbeat=setInterval(()=>{query('UPDATE jobs SET locked_at=now() WHERE id=$1 AND lock_token=$2',[job.id,token]).catch(()=>{});},30000);
  try {
    await query('UPDATE creatives SET status=\'processing\',error=NULL WHERE workspace_id=$1 AND id=$2',[job.workspace_id,job.creative_id]);
    const creative=await getCreative(job.workspace_id,job.creative_id),client=await getClient(job.workspace_id,creative.client_id);
    const evidence=await evidenceFor(job.workspace_id,creative.client_id);
    const cacheKey=analysisCacheKey(job.workspace_id,creative.sha256,{client,transcript:creative.manual_transcript});
    const video=await processVideo(creative.storage_key,creative.manual_transcript);
    const {semantic,provider,warnings}=await analyzeSemantic(job.workspace_id,video,client,cacheKey);
    const result=assembleAnalysis(client,video,semantic,evidence,provider,warnings);
    await transaction(async db=>{
      const lease=await db.query('SELECT 1 FROM jobs WHERE id=$1 AND lock_token=$2 FOR UPDATE',[job.id,token]);if(!lease.rowCount)throw new Error('Job lease lost');
      const {rows}=await db.query('INSERT INTO analyses(workspace_id,client_id,creative_id,result,cache_key) VALUES($1,$2,$3,$4,$5) ON CONFLICT(workspace_id,creative_id) DO UPDATE SET result=$4,cache_key=$5,created_at=now() RETURNING id',[job.workspace_id,creative.client_id,creative.id,JSON.stringify(result),cacheKey]);const analysisId=rows[0].id;
      await db.query('DELETE FROM recommendations WHERE workspace_id=$1 AND analysis_id=$2',[job.workspace_id,analysisId]);
      await db.query('DELETE FROM market_opportunities WHERE workspace_id=$1 AND analysis_id=$2',[job.workspace_id,analysisId]);
      await db.query('DELETE FROM trends WHERE workspace_id=$1 AND analysis_id=$2',[job.workspace_id,analysisId]);
      await db.query('DELETE FROM forecasts WHERE workspace_id=$1 AND analysis_id=$2',[job.workspace_id,analysisId]);
      await db.query('INSERT INTO recommendations(workspace_id,client_id,analysis_id,label,reasoning) VALUES($1,$2,$3,$4,$5)',[job.workspace_id,creative.client_id,analysisId,result.decision.label,JSON.stringify(result.decision)]);
      for(const data of result.opportunities)await db.query('INSERT INTO market_opportunities(workspace_id,client_id,analysis_id,data) VALUES($1,$2,$3,$4)',[job.workspace_id,creative.client_id,analysisId,JSON.stringify(data)]);
      for(const data of result.trends)await db.query('INSERT INTO trends(workspace_id,client_id,analysis_id,data) VALUES($1,$2,$3,$4)',[job.workspace_id,creative.client_id,analysisId,JSON.stringify(data)]);
      if(result.forecast)await db.query('INSERT INTO forecasts(workspace_id,client_id,analysis_id,assumptions,result,provenance) VALUES($1,$2,$3,$4,$5,$6)',[job.workspace_id,creative.client_id,analysisId,JSON.stringify(result.forecast.base.assumptions),JSON.stringify(result.forecast),result.provenance]);
      // Original is stable across retries. Variants already used by experiments retain their lineage.
      const original=await db.query('SELECT id FROM creative_versions WHERE workspace_id=$1 AND creative_id=$2 AND parent_id IS NULL',[job.workspace_id,creative.id]);
      let originalId=original.rows[0]?.id;
      if(!originalId)originalId=(await db.query('INSERT INTO creative_versions(workspace_id,client_id,creative_id,name,variable,instruction,hypothesis) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[job.workspace_id,creative.client_id,creative.id,'Original','control','Original uploaded video','Control'])).rows[0].id;
      for(const v of semantic.variants){const exists=await db.query('SELECT 1 FROM creative_versions WHERE workspace_id=$1 AND creative_id=$2 AND name=$3',[job.workspace_id,creative.id,v.name]);if(!exists.rowCount)await db.query('INSERT INTO creative_versions(workspace_id,client_id,creative_id,parent_id,name,variable,instruction,hypothesis) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[job.workspace_id,creative.client_id,creative.id,originalId,v.name,v.variable,v.instruction,v.hypothesis]);}
      await db.query('UPDATE creatives SET status=\'complete\',error=NULL WHERE workspace_id=$1 AND id=$2',[job.workspace_id,creative.id]);
      await db.query('UPDATE jobs SET status=\'complete\',error=NULL,locked_at=NULL WHERE id=$1 AND lock_token=$2',[job.id,token]);
      await db.query('INSERT INTO audit_logs(workspace_id,action,entity_id,details) VALUES($1,$2,$3,$4)',[job.workspace_id,'analysis.completed',creative.id,JSON.stringify({provider,provenance:result.provenance})]);
    });
  }catch(error){
    // Do not expose raw provider responses, environment values or process command lines.
    const message=error instanceof Error&&/Video|video|stream|resolution|Frame rate|container/.test(error.message)?error.message.slice(0,250):'Processing failed. Check media validity and worker/provider availability, then retry.';
    const failed=job.attempts>=3;
    await transaction(async db=>{
      const updated=await db.query(`UPDATE jobs SET status=$3,error=$4,locked_at=NULL,available_at=now()+interval '15 seconds' WHERE id=$1 AND lock_token=$2 RETURNING id`,[job.id,token,failed?'failed':'queued',message]);
      if(updated.rowCount)await db.query('UPDATE creatives SET status=$3,error=$4 WHERE workspace_id=$1 AND id=$2',[job.workspace_id,job.creative_id,failed?'failed':'queued',message]);
    });
    console.error(`Analysis job ${job.id}: ${message}`);
  }finally{clearInterval(heartbeat);}return true;
}
