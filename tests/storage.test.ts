import { afterEach,describe,it,expect,vi } from 'vitest';
const {send}=vi.hoisted(()=>({send:vi.fn()}));
vi.mock('@aws-sdk/client-s3',()=>({S3Client:class{send=send;},PutObjectCommand:class{constructor(public input:unknown){}},GetObjectCommand:class{constructor(public input:unknown){}},DeleteObjectCommand:class{constructor(public input:unknown){}}}));
import {putObject,getObject,deleteObject} from '../src/lib/storage';
afterEach(()=>{vi.unstubAllEnvs();send.mockReset();});
describe('S3-compatible storage SDK boundary (mocked)',()=>{
  it('stores and reads private tenant object keys without public ACLs',async()=>{vi.stubEnv('STORAGE_DRIVER','s3');vi.stubEnv('S3_BUCKET','mock-private-bucket');send.mockResolvedValueOnce({});await putObject('tenant/client/creative.mp4',Buffer.from('media'),'video/mp4');expect(send.mock.calls[0][0].input).toMatchObject({Bucket:'mock-private-bucket',Key:'tenant/client/creative.mp4',ContentType:'video/mp4'});expect(send.mock.calls[0][0].input).not.toHaveProperty('ACL');send.mockResolvedValueOnce({Body:{transformToByteArray:async()=>new Uint8Array([1,2,3])}});expect(await getObject('tenant/client/creative.mp4')).toEqual(Buffer.from([1,2,3]));});
  it('uses the deletion boundary for rollback/cleanup',async()=>{vi.stubEnv('STORAGE_DRIVER','s3');vi.stubEnv('S3_BUCKET','mock-private-bucket');send.mockResolvedValue({});await deleteObject('tenant/client/creative.mp4');expect(send.mock.calls[0][0].input.Key).toBe('tenant/client/creative.mp4');});
  it('rejects traversal before contacting S3',async()=>{vi.stubEnv('STORAGE_DRIVER','s3');await expect(putObject('../secret',Buffer.from('x'),'text/plain')).rejects.toThrow();expect(send).not.toHaveBeenCalled();});
  it('propagates storage failures instead of claiming the upload succeeded',async()=>{vi.stubEnv('STORAGE_DRIVER','s3');send.mockRejectedValue(new Error('mock service unavailable'));await expect(putObject('tenant/asset.mp4',Buffer.from('x'),'video/mp4')).rejects.toThrow('mock service unavailable');});
});
