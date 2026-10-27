import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
// Runtime media is an external private volume, never a deployment-bundle input.
const root=path.resolve(/* turbopackIgnore: true */ process.env.STORAGE_PATH??'.data/storage');
function safe(key:string) {if(!/^[a-zA-Z0-9/_\-.]+$/.test(key)||key.includes('..')||key.startsWith('/'))throw new Error('Invalid storage key');return path.join(/* turbopackIgnore: true */ root,key);}
const s3=()=>new S3Client({region:process.env.S3_REGION??'us-east-1',endpoint:process.env.S3_ENDPOINT||undefined,forcePathStyle:!!process.env.S3_ENDPOINT,credentials:process.env.S3_ACCESS_KEY_ID?{accessKeyId:process.env.S3_ACCESS_KEY_ID,secretAccessKey:process.env.S3_SECRET_ACCESS_KEY!}:undefined});
export async function putObject(key:string,data:Buffer,contentType:string) {
  safe(key);
  if(process.env.STORAGE_DRIVER==='s3')await s3().send(new PutObjectCommand({Bucket:process.env.S3_BUCKET,Key:key,Body:data,ContentType:contentType}));
  else{await mkdir(path.dirname(safe(key)),{recursive:true,mode:0o700});await writeFile(safe(key),data,{mode:0o600});}
}
export async function getObject(key:string) {safe(key);if(process.env.STORAGE_DRIVER==='s3'){const r=await s3().send(new GetObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));if(!r.Body)throw new Error('Object missing');return Buffer.from(await r.Body.transformToByteArray());}return readFile(/* turbopackIgnore: true */ safe(key));}
export async function deleteObject(key:string) {safe(key);if(process.env.STORAGE_DRIVER==='s3')await s3().send(new DeleteObjectCommand({Bucket:process.env.S3_BUCKET,Key:key}));else await rm(safe(key),{force:true});}
