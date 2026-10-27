import { randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { query } from './db';
import { AppError } from './domain';
const scrypt=promisify(scryptCb);
export async function hashPassword(password:string) {const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64) as Buffer;return `${salt}:${key.toString('hex')}`;}
export async function verifyPassword(password:string,hash:string) {const [salt,key]=hash.split(':');const test=await scrypt(password,salt,64) as Buffer;const expected=Buffer.from(key,'hex');return expected.length===test.length&&timingSafeEqual(test,expected);}
export const tokenHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export type Session={userId:string;workspaceId:string;email:string;name:string;workspaceName:string;role:'owner'|'member'};
export async function sessionFromToken(token:string):Promise<Session|null> {
  if(!/^[a-f0-9]{64}$/.test(token))return null;
  const rows=await query<Session>(`SELECT u.id AS "userId",u.email,u.name,s.workspace_id AS "workspaceId",w.name AS "workspaceName",m.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN workspaces w ON w.id=s.workspace_id JOIN memberships m ON m.user_id=s.user_id AND m.workspace_id=s.workspace_id WHERE s.id=$1 AND s.expires_at>now()`,[tokenHash(token)]);
  return rows[0]??null;
}
export async function getSession() {return sessionFromToken((await cookies()).get('agencyos_session')?.value??'');}
export async function requireSession() {const s=await getSession();if(!s)throw new AppError(401,'Please sign in.');return s;}
export async function createSession(userId:string,workspaceId:string) {const token=randomBytes(32).toString('hex');await query('INSERT INTO sessions(id,user_id,workspace_id,expires_at) VALUES($1,$2,$3,now()+interval \'7 days\')',[tokenHash(token),userId,workspaceId]);return token;}
export async function setSessionCookie(token:string) {(await cookies()).set('agencyos_session',token,{httpOnly:true,sameSite:'lax',secure:process.env.APP_URL?.startsWith('https://')??process.env.NODE_ENV==='production',path:'/',maxAge:7*86400});}
export async function rateLimit(key:string,limit:number,seconds:number) {
  const rows=await query<{count:number}>(`INSERT INTO rate_limits(key,count,reset_at) VALUES($1,1,now()+$2*interval '1 second') ON CONFLICT(key) DO UPDATE SET count=CASE WHEN rate_limits.reset_at<now() THEN 1 ELSE rate_limits.count+1 END,reset_at=CASE WHEN rate_limits.reset_at<now() THEN now()+$2*interval '1 second' ELSE rate_limits.reset_at END RETURNING count`,[key,seconds]);
  if(rows[0].count>limit)throw new AppError(429,'Too many requests. Please try again later.');
}
export function requireSameOrigin(req:Request) {const origin=req.headers.get('origin');const expected=new URL(process.env.APP_URL??req.url).origin;if(!origin||origin!==expected)throw new AppError(403,'Request origin is not allowed.');}
