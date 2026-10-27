import { afterEach,describe,it,expect,vi } from 'vitest';
vi.mock('../src/lib/db',()=>({query:vi.fn().mockImplementation(async(_sql:string,args:unknown[])=>[{id:'source-id',title:args?.[2],url:args?.[3],excerpt:args?.[4],provenance:'observed',kind:'market'}])}));
import { searchPublic,fetchPublicPage } from '../src/lib/research';
import { query } from '../src/lib/db';
import {UnconnectedProvider} from '../src/lib/providers';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});
describe('search provider boundary (mocked)',()=>{
  it('requires a key rather than generating invented sources',async()=>{vi.stubEnv('BRAVE_SEARCH_API_KEY','');await expect(searchPublic('w','c','market query')).rejects.toMatchObject({status:422});expect(query).not.toHaveBeenCalled();});
  it('persists dated public source snippets and skips unsafe URLs',async()=>{vi.stubEnv('BRAVE_SEARCH_API_KEY','mock-test-key');const f=vi.fn().mockResolvedValue(Response.json({web:{results:[{title:'Category research',url:'https://example.com/research',description:'Public source snippet'},{title:'Invalid',url:'javascript:alert(1)',description:'invalid'}]}}));vi.stubGlobal('fetch',f);const rows=await searchPublic('tenant','client','category');expect(rows).toHaveLength(1);expect(rows[0].provenance).toBe('observed');expect(vi.mocked(query).mock.calls[0][1]?.slice(0,2)).toEqual(['tenant','client']);expect(String(f.mock.calls[0][0])).toContain('freshness=pm');});
  it('reports provider errors instead of success',async()=>{vi.stubEnv('BRAVE_SEARCH_API_KEY','mock-test-key');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('',{status:403})));await expect(searchPublic('w','c','query')).rejects.toMatchObject({status:502});});
  it('requires exact approved domains when using the trusted proxy',async()=>{vi.stubEnv('RESEARCH_USE_ENV_PROXY','true');vi.stubEnv('HTTPS_PROXY','http://proxy.example:8080');vi.stubEnv('RESEARCH_ALLOWED_HOSTS','approved.example');await expect(fetchPublicPage('https://unapproved.example')).rejects.toMatchObject({status:403});await expect(fetchPublicPage('https://approved.example.attacker.test')).rejects.toMatchObject({status:403});});
});
describe('future provider interfaces',()=>{
  it('reports unconnected advertising integrations honestly and has no execution method',async()=>{const p=new UnconnectedProvider('meta');expect((await p.verifyConnection()).connected).toBe(false);await expect(p.readMetrics()).rejects.toThrow('not connected');expect(p).not.toHaveProperty('executeCampaign');});
});
