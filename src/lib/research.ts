import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { AppError, type Evidence } from './domain';
import { query } from './db';
import { searchKey,providerFetch } from './provider-http';
export function isPublicAddress(address:string) {
  try{return ipaddr.parse(address).range()==='unicast';}catch{return false;}
}
/** HTTPS only, pinned DNS, no redirect following or authenticated requests. */
export async function fetchPublicPage(raw:string):Promise<{url:string;text:string;title:string}> {
  const u=new URL(raw);
  if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.hostname==='localhost')throw new AppError(400,'Research requires a public HTTPS URL without credentials.');
  const proxy=process.env.RESEARCH_USE_ENV_PROXY==='true'?(process.env.HTTPS_PROXY??process.env.https_proxy):undefined;
  let chosen:{address:string;family:number}|undefined;
  if(proxy){
    // A trusted egress proxy resolves DNS. Require administrator-approved exact hosts;
    // the proxy must enforce public-only destinations as documented in SECURITY.md.
    const allowed=(process.env.RESEARCH_ALLOWED_HOSTS??'').split(',').map(h=>h.trim().toLowerCase()).filter(Boolean);
    if(isIP(u.hostname)||u.hostname.includes(':')||!allowed.includes(u.hostname.toLowerCase()))throw new AppError(403,'This source is not approved for research through the egress proxy. Ask your administrator to allow its hostname in research and network settings.');
  }else{
    const addresses=await lookup(u.hostname,{all:true});
    if(!addresses.length||addresses.some(a=>!isPublicAddress(a.address)))throw new AppError(400,'Private network addresses are not allowed.');
    chosen=addresses[0];
  }
  const html=await new Promise<string>((resolve,reject)=>{
    const req=https.get(u,{...(proxy?{agent:new HttpsProxyAgent(proxy)}:{lookup:(_host:string,_options:unknown,cb:(error:Error|null,address:string,family:number)=>void)=>cb(null,chosen!.address,chosen!.family)}),headers:{'User-Agent':'AgencyOS/1.0 (public marketing research)','Accept':'text/html,text/plain'},timeout:10000},res=>{
      if(res.statusCode!==200){res.resume();reject(new AppError(422,`Source returned HTTP ${res.statusCode}. Provide its final public URL.`));return;}
      if(!/text\/(html|plain)/i.test(res.headers['content-type']??'')){res.resume();reject(new AppError(422,'Source must be HTML or plain text.'));return;}
      const chunks:Buffer[]=[];let size=0;
      res.on('data',(chunk:Buffer)=>{size+=chunk.length;if(size>1024*1024){req.destroy(new Error('Source exceeds 1 MB'));return;}chunks.push(chunk);});
      res.on('end',()=>resolve(Buffer.concat(chunks).toString('utf8')));res.on('error',reject);
    });req.on('timeout',()=>req.destroy(new Error('Source timed out')));req.on('error',reject);
  });
  const title=(html.match(/<title[^>]*>([^<]*)/i)?.[1]??u.hostname).slice(0,200);
  const text=html.replace(/<(script|style|nav|footer)[\s\S]*?<\/\1>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim().slice(0,16000);
  return {url:u.href,text,title};
}
export async function researchUrl(workspaceId:string,clientId:string,url:string,kind='competitor'):Promise<Evidence> {
  const cached=await query<{id:string;title:string;url:string;excerpt:string;fetchedAt:string;provenance:'observed';kind:string}>('SELECT id,title,url,excerpt,fetched_at AS "fetchedAt",provenance,kind FROM research_sources WHERE workspace_id=$1 AND client_id=$2 AND url=$3 AND expires_at>now()',[workspaceId,clientId,url]);
  if(cached[0])return cached[0];
  const page=await fetchPublicPage(url);
  const [row]=await query<Evidence>(`INSERT INTO research_sources(workspace_id,client_id,title,url,excerpt,kind,provenance) VALUES($1,$2,$3,$4,$5,$6,'observed') ON CONFLICT(workspace_id,client_id,url) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,kind=EXCLUDED.kind,provenance='observed',fetched_at=now(),expires_at=now()+interval '24 hours' RETURNING id,title,url,excerpt,fetched_at AS "fetchedAt",provenance,kind`,[workspaceId,clientId,page.title,url,page.text,kind]);
  return row;
}
export async function searchPublic(workspaceId:string,clientId:string,search:string):Promise<Evidence[]> {
  const key=searchKey();
  if(!key)throw new AppError(422,'Connect BRAVE_SEARCH_API_KEY for web discovery, or add a public source URL.');
  const url=new URL('https://api.search.brave.com/res/v1/web/search');url.searchParams.set('q',search);url.searchParams.set('count','5');url.searchParams.set('freshness','pm');
  const response=await providerFetch(url,{headers:{'X-Subscription-Token':key},signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new AppError(502,`Search provider returned ${response.status}`);
  const data=await response.json();const results:Evidence[]=[];
  for(const item of (data.web?.results??[]).slice(0,5)) {
    if(typeof item.url!=='string'||!item.url.startsWith('https://'))continue;
    const [row]=await query<Evidence>(`INSERT INTO research_sources(workspace_id,client_id,title,url,excerpt,kind,provenance) VALUES($1,$2,$3,$4,$5,'market','observed') ON CONFLICT(workspace_id,client_id,url) DO UPDATE SET title=EXCLUDED.title,excerpt=EXCLUDED.excerpt,fetched_at=now(),expires_at=now()+interval '24 hours' RETURNING id,title,url,excerpt,fetched_at AS "fetchedAt",provenance,kind`,[workspaceId,clientId,String(item.title).slice(0,200),item.url,String(item.description??'').slice(0,3000)]);results.push(row);
  }
  return results;
}
