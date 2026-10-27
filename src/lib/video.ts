import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AppError, type VideoMetadata, type VideoResult } from './domain';
import { getObject, putObject } from './storage';
import { aiKey,providerFetch } from './provider-http';
const exec=promisify(execFile);
const ffmpeg=process.env.FFMPEG_PATH??'ffmpeg',ffprobe=process.env.FFPROBE_PATH??'ffprobe';
export const MAX_UPLOAD=100*1024*1024;
export function validateUpload(name:string,type:string,size:number,head:Buffer) {
  const ext=path.extname(name).toLowerCase();
  if(!['.mp4','.mov','.webm'].includes(ext))throw new AppError(415,'Upload an MP4, MOV or WebM video.');
  if(size<=0||size>MAX_UPLOAD)throw new AppError(413,'Video must be between 1 byte and 100 MB.');
  if(!['video/mp4','video/quicktime','video/webm','application/octet-stream',''].includes(type))throw new AppError(415,'Unsupported video type.');
  const iso=head.length>=12&&['ftyp','wide','mdat','moov'].includes(head.subarray(4,8).toString());
  const webm=head.length>=4&&head.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if(ext==='.webm'?!webm:!iso)throw new AppError(415,'File content does not match the video extension.');
  return ext;
}
export async function probeVideo(file:string):Promise<VideoMetadata> {
  const {stdout}=await exec(ffprobe,['-v','error','-protocol_whitelist','file,pipe','-show_format','-show_streams','-of','json',file],{timeout:20000,maxBuffer:2*1024*1024});
  const p=JSON.parse(stdout),v=p.streams?.find((s:{codec_type:string})=>s.codec_type==='video');
  if(!v)throw new AppError(422,'No video stream found.');
  const duration=Number(p.format.duration||v.duration),width=Number(v.width),height=Number(v.height);
  if(!Number.isFinite(duration)||duration<=0||duration>180)throw new AppError(422,'Videos must be 3 minutes or shorter.');
  if(!width||!height||width>4096||height>4096)throw new AppError(422,'Video resolution must not exceed 4096 pixels per side.');
  if(!/mov|mp4|matroska|webm/.test(p.format.format_name))throw new AppError(415,'Unsupported media container.');
  const [n,d]=String(v.avg_frame_rate).split('/').map(Number),frameRate=d?n/d:0;
  if(!Number.isFinite(frameRate)||frameRate>120)throw new AppError(422,'Frame rate must not exceed 120 fps.');
  const gcd=(a:number,b:number):number=>b?gcd(b,a%b):a;const g=gcd(width,height);
  return {duration,width,height,aspectRatio:`${width/g}:${height/g}`,frameRate,hasAudio:p.streams.some((s:{codec_type:string})=>s.codec_type==='audio'),scenes:[],format:p.format.format_name};
}
export function sampleTimes(duration:number,scenes:number[],max=12) {
  const times=[.1,.8,1.8,2.8,...scenes,...Array.from({length:8},(_,i)=>duration*(i+1)/9)];
  const out:number[]=[];
  for(const t of times)if(t<duration&&out.every(x=>Math.abs(x-t)>.35)&&out.length<max)out.push(Math.round(t*100)/100);
  return out.sort((a,b)=>a-b);
}
export async function processVideo(storageKey:string,manualTranscript:string|null=null):Promise<VideoResult> {
  const temp=await mkdtemp(path.join(tmpdir(),'agencyos-video-'));const warnings:string[]=[];
  try {
    const file=path.join(temp,'input'+path.extname(storageKey));await writeFile(file,await getObject(storageKey));
    const metadata=await probeVideo(file);
    const detection=await exec(ffmpeg,['-nostdin','-v','info','-threads','1','-protocol_whitelist','file,pipe','-i',file,'-an','-vf',"scale=320:-2,select='gt(scene,0.32)',showinfo",'-fps_mode','vfr','-frames:v','24','-f','null','-'],{timeout:90000,maxBuffer:4*1024*1024});
    metadata.scenes=[...detection.stderr.matchAll(/pts_time:([\d.]+)/g)].map(x=>Number(x[1]));
    const frames:VideoResult['frames']=[];
    for(const [i,time] of sampleTimes(metadata.duration,metadata.scenes).entries()) {
      const output=path.join(temp,`frame-${i}.jpg`);
      await exec(ffmpeg,['-nostdin','-v','error','-threads','1','-protocol_whitelist','file,pipe','-ss',String(time),'-i',file,'-frames:v','1','-vf','scale=640:-2','-q:v','3',output],{timeout:30000,maxBuffer:1024*1024});
      let text='';try {text=(await exec(process.env.TESSERACT_PATH??'tesseract',[output,'stdout','--psm','11'],{timeout:15000,maxBuffer:1024*1024,env:{...process.env,OMP_THREAD_LIMIT:'1'}})).stdout.trim();}catch{if(!warnings.includes('OCR unavailable.'))warnings.push('OCR unavailable.');}
      const key=`${storageKey}.frames/${i}.jpg`;await putObject(key,await readFile(output),'image/jpeg');frames.push({key,time,text});
    }
    let audioKey:string|null=null,transcript=manualTranscript,transcriptSource=manualTranscript?'User-provided transcript (not automatically verified)':'Unavailable';
    if(metadata.hasAudio){
      const audio=path.join(temp,'audio.wav');await exec(ffmpeg,['-nostdin','-v','error','-threads','1','-protocol_whitelist','file,pipe','-i',file,'-vn','-ac','1','-ar','16000',audio],{timeout:45000,maxBuffer:1024*1024});
      audioKey=storageKey+'.audio.wav';const bytes=await readFile(audio);await putObject(audioKey,bytes,'audio/wav');
      if(!transcript&&aiKey()){try{const body=new FormData();body.set('file',new Blob([new Uint8Array(bytes)],{type:'audio/wav'}),'audio.wav');body.set('model',process.env.TRANSCRIPTION_MODEL??'whisper-1');const r=await providerFetch('https://api.openai.com/v1/audio/transcriptions',{method:'POST',headers:{Authorization:`Bearer ${aiKey()}`},body,signal:AbortSignal.timeout(90000)});if(!r.ok)throw new Error(`Transcription provider returned ${r.status}`);transcript=(await r.json()).text;transcriptSource='OpenAI transcription';}catch{warnings.push('Transcription provider failed; speech claims remain unverified.');}}
      if(!transcript)warnings.push('Connect a transcription provider or supply a transcript to evaluate spoken messaging.');
    }else warnings.push('No audio stream; spoken hook cannot be evaluated.');
    return {metadata,frames,audioKey,transcript,transcriptSource,warnings};
  } finally {await rm(temp,{recursive:true,force:true});}
}
