import { readFile } from 'node:fs/promises';
import { pool,query,transaction } from '../src/lib/db';
import { hashPassword,type Session } from '../src/lib/auth';
import { createClient,createUpload } from '../src/lib/services';
import { type Economics } from '../src/lib/domain';
import { makeDemoVideo } from './demo-video';
const email=process.env.DEMO_EMAIL??'demo@agencyos.local';
const password=process.env.DEMO_PASSWORD;
if(!password||password.length<10)throw new Error('Set DEMO_PASSWORD to at least 10 characters in .env before seeding.');
let [user]=await query<{id:string;workspace_id:string}>('SELECT u.id,m.workspace_id FROM users u JOIN memberships m ON m.user_id=u.id WHERE u.email=$1',[email]);
if(!user){const hash=await hashPassword(password);user=await transaction(async db=>{const u=(await db.query('INSERT INTO users(email,name,password_hash) VALUES($1,$2,$3) RETURNING id',[email,'Alex Morgan',hash])).rows[0];const w=(await db.query('INSERT INTO workspaces(name) VALUES($1) RETURNING id',['Studio North'])).rows[0];await db.query('INSERT INTO memberships(workspace_id,user_id,role) VALUES($1,$2,\'owner\')',[w.id,u.id]);return {id:u.id,workspace_id:w.id};});}
const s:Session={userId:user.id,workspaceId:user.workspace_id,email,name:'Alex Morgan',workspaceName:'Studio North',role:'owner'};
const economics:Economics={aov:78,cogs:19,shipping:5,fulfillment:3,paymentFeeRate:.029,paymentFeeFixed:.3,refundRate:.04,discountRate:.05,targetCac:30,capacity:500,historicalCpm:12,historicalCtr:.018,historicalCvr:.035,historicalCac:28,historicalRoas:2.8,sampleSize:240};
let [client]=await query<{id:string}>('SELECT id FROM clients WHERE workspace_id=$1 AND name=$2',[s.workspaceId,'Terra Rituals']);
if(!client){client=await createClient(s,{name:'Terra Rituals',industry:'Wellness & personal care',website:'https://example.com',geography:'United States',currency:'USD',audience:'Busy professionals looking for a simpler daily routine',productName:'Daily Ritual Starter Kit',price:78,offer:'A thoughtfully curated starter kit',economics},true);
  await createClient(s,{name:'Form & Field',industry:'Home & lifestyle',website:'https://example.org',geography:'United States',currency:'USD',audience:'Design-conscious urban households',productName:'Everyday Home Set',price:112,offer:'The everyday essentials collection',economics:{...economics,aov:112,cogs:42,shipping:8,historicalCpm:16,historicalCvr:.025}},true);
  await createClient(s,{name:'Pace Athletics',industry:'Fitness & apparel',website:'https://example.net',geography:'United Kingdom',currency:'GBP',audience:'Recreational runners',productName:'Daily Training Tee',price:48,offer:'Movement made comfortable',economics:{...economics,aov:48,cogs:12,shipping:4,historicalCpm:10,historicalCvr:.03}},true);
  for(const [name,kind,notes] of [['Sunday Studio','direct','Simulated: calm visual identity, bundles and routine-led messaging.'],['Everyday Co.','indirect','Simulated: practical use cases and accessible starter offers.'],['Ritual House','leader','Simulated: polished education and product demonstration.']])await query('INSERT INTO competitors(workspace_id,client_id,name,website,kind,notes,simulated) VALUES($1,$2,$3,$4,$5,$6,true)',[s.workspaceId,client.id,name,'https://example.com/'+name.toLowerCase().replaceAll(' ','-'),kind,notes]);
  const sources=[['Category positioning brief','competitor','Simulated research: category brands emphasize daily habits and starter bundles. This does not represent a real competitor audit.'],['Customer objection synthesis','customer','Simulated research: questions center on value, consistency and fitting a routine. No real reviews were collected.'],['Ritual-led demonstrations','trend','Simulated trend: short, sequential demonstrations make routines tangible. No live popularity metric.'],['Proof over polish','trend','Simulated trend: specific, consented customer proof can be tested against aesthetic product shots.'],['Small everyday routines','trend','Simulated trend: practical daily use cases are a candidate creative angle.']];
  for(const [i,[title,kind,excerpt]] of sources.entries())await query('INSERT INTO research_sources(workspace_id,client_id,title,url,excerpt,kind,provenance) VALUES($1,$2,$3,$4,$5,$6,\'simulated\')',[s.workspaceId,client.id,title,`https://example.com/demo-evidence/${i}`,excerpt,kind]);
}
const [creative]=await query('SELECT id FROM creatives WHERE workspace_id=$1 AND client_id=$2',[s.workspaceId,client.id]);
if(!creative){const file=await makeDemoVideo();await createUpload(s,client.id,{name:'Terra — The Daily Ritual.mp4',type:'video/mp4',data:await readFile(file)},'SIMULATED TRANSCRIPT: Less rush. More ritual. One simple step. Find your daily ritual.',true);}
console.log('Demo workspace prepared. All sample clients, market evidence and creative judgments are explicitly simulated.');
await pool.end();
