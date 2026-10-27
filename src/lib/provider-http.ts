import { ProxyAgent } from 'undici';
let proxyAgent:ProxyAgent|undefined;
let proxyAddress:string|undefined;
/** Fixed provider endpoints only. User-supplied research URLs use a separate SSRF boundary. */
export function providerFetch(url:string|URL,init:RequestInit) {
  const parsed=new URL(url);
  if(parsed.protocol!=='https:'||!['api.openai.com','api.search.brave.com'].includes(parsed.hostname))throw new Error('Unknown provider destination');
  const proxy=process.env.HTTPS_PROXY??process.env.https_proxy;
  if(proxy&&proxy!==proxyAddress){proxyAddress=proxy;proxyAgent=new ProxyAgent(proxy);}
  const options:RequestInit&{dispatcher?:ProxyAgent}={...init,...(proxy?{dispatcher:proxyAgent}:{})};
  return fetch(url,options);
}
export const aiKey=()=>process.env.AGENCYOS_AI_KEY||process.env.OPENAI_API_KEY;
export const searchKey=()=>process.env.AGENCYOS_SEARCH_KEY||process.env.BRAVE_SEARCH_API_KEY;
