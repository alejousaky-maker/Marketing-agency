import { describe,it,expect } from 'vitest';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { validateUpload,sampleTimes,probeVideo,processVideo,MAX_UPLOAD } from '../src/lib/video';
import { putObject,deleteObject,getObject } from '../src/lib/storage';
describe('untrusted uploads',()=>{
  const mp4=Buffer.from('000000006674797069736f6d00000000','hex');
  it.each(['ad.mp4','ad.MOV'])('accepts matching ISO media %s',name=>expect(validateUpload(name,'video/mp4',100,mp4)).toBeTruthy());
  it('accepts WebM EBML signature',()=>expect(validateUpload('ad.webm','video/webm',100,Buffer.from('1a45dfa300000000','hex'))).toBe('.webm'));
  it('rejects disguised executables',()=>expect(()=>validateUpload('ad.mp4','video/mp4',100,Buffer.from('MZfakevideo'))).toThrow());
  it('rejects an unrelated extension',()=>expect(()=>validateUpload('ad.html','video/mp4',100,mp4)).toThrow());
  it('rejects extension/signature mismatch',()=>expect(()=>validateUpload('ad.webm','video/webm',100,mp4)).toThrow());
  it.each([0,MAX_UPLOAD+1])('rejects invalid size %s',size=>expect(()=>validateUpload('ad.mp4','video/mp4',size,mp4)).toThrow());
  it('does not sample every frame',()=>{const times=sampleTimes(180,Array.from({length:90},(_,i)=>i*2));expect(times.length).toBeLessThanOrEqual(12);expect(times.slice(0,4)).toEqual([.1,.8,1.8,2.8]);});
  it('never samples outside short media',()=>expect(sampleTimes(.5,[]).every(t=>t<.5)).toBe(true));
  it('rejects storage path traversal',()=>expect(getObject('../../.env')).rejects.toThrow());
});
describe('real FFmpeg and OCR pipeline',()=>{
  it('decodes video, extracts audio and temporally sampled OCR frames',async()=>{
    const dir=await mkdtemp(join(tmpdir(),'agencyos-test-'));const file=join(dir,'test.mp4');const key=`test/media-${Date.now()}.mp4`;
    try{
      await promisify(execFile)('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=green:s=320x480:r=10:d=2','-f','lavfi','-i','sine=frequency=440:duration=2','-vf',"drawtext=text='SHOP NOW':fontcolor=white:fontsize=36:x=30:y=170",'-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest',file]);
      const m=await probeVideo(file);expect(m.duration).toBeCloseTo(2,0);expect(m.width).toBe(320);expect(m.height).toBe(480);expect(m.frameRate).toBe(10);expect(m.hasAudio).toBe(true);
      await putObject(key,await readFile(file),'video/mp4');const result=await processVideo(key,'User provided test transcript');expect(result.audioKey).toBeTruthy();expect(result.frames.length).toBeGreaterThan(1);expect(result.frames.length).toBeLessThanOrEqual(12);expect(result.frames.some(f=>f.text.includes('SHOP'))).toBe(true);expect(result.transcriptSource).toContain('User-provided');expect(result.transcript).toBe('User provided test transcript');
      for(const f of result.frames)await deleteObject(f.key);if(result.audioKey)await deleteObject(result.audioKey);
    }finally{await deleteObject(key);await rm(dir,{recursive:true,force:true});}
  });
  it('rejects malformed video after signature validation',async()=>{const dir=await mkdtemp(join(tmpdir(),'agencyos-invalid-'));try{const file=join(dir,'bad.mp4');await writeFile(file,Buffer.from('000000006674797069736f6d00000000','hex'));await expect(probeVideo(file)).rejects.toThrow();}finally{await rm(dir,{recursive:true,force:true});}});
});
