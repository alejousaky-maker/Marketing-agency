import { Pool, type PoolClient } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema';
const globalDb=globalThis as unknown as {agencyPool?:Pool};
export const pool=globalDb.agencyPool??new Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000});
if(process.env.NODE_ENV!=='production')globalDb.agencyPool=pool;
export const db=drizzle(pool,{schema});
export async function query<T=Record<string,unknown>>(text:string,values:unknown[]=[]):Promise<T[]> {return (await pool.query(text,values)).rows as T[];}
export async function transaction<T>(fn:(client:PoolClient)=>Promise<T>) {const c=await pool.connect();try{await c.query('BEGIN');const r=await fn(c);await c.query('COMMIT');return r;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}
export async function audit(workspaceId:string,userId:string|null,action:string,entityId:string,details:Record<string,unknown>={}) {await query('INSERT INTO audit_logs(workspace_id,user_id,action,entity_id,details) VALUES($1,$2,$3,$4,$5)',[workspaceId,userId,action,entityId,JSON.stringify(details)]);}
