import { describe,it,expect } from 'vitest';
import { isPublicAddress,fetchPublicPage } from '../src/lib/research';
import { hashPassword,verifyPassword,tokenHash,requireSameOrigin } from '../src/lib/auth';
describe('public research URL boundaries',()=>{
  it.each(['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','0.0.0.0','224.0.0.1','::1','::ffff:127.0.0.1','fd00::1','fe80::1'])('rejects private and reserved address %s',address=>expect(isPublicAddress(address)).toBe(false));
  it.each(['93.184.216.34','8.8.8.8','2606:4700:4700::1111'])('accepts public address %s',address=>expect(isPublicAddress(address)).toBe(true));
  it.each(['http://example.com','https://localhost','https://user:password@example.com','https://example.com:8443'])('rejects unsafe source %s',url=>expect(fetchPublicPage(url)).rejects.toThrow());
});
describe('authentication primitives',()=>{
  it('salts password hashes and verifies them safely',async()=>{const password='only-a-test-password';const a=await hashPassword(password),b=await hashPassword(password);expect(a).not.toBe(b);expect(a).not.toContain(password);expect(await verifyPassword(password,a)).toBe(true);expect(await verifyPassword('wrong-password',a)).toBe(false);});
  it('stores only token hashes',()=>expect(tokenHash('token')).toHaveLength(64));
  it('blocks cross-site writes',()=>expect(()=>requireSameOrigin(new Request('http://localhost:3000/api/clients',{headers:{origin:'https://attacker.example'}}))).toThrow());
  it('blocks missing origins on writes',()=>expect(()=>requireSameOrigin(new Request('http://localhost:3000/api/clients'))).toThrow());
  it('allows configured application origin',()=>expect(()=>requireSameOrigin(new Request('http://localhost:3000/api/clients',{headers:{origin:process.env.APP_URL??'http://localhost:3000'}}))).not.toThrow());
});
