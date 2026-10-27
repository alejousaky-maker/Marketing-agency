import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { mkdir,access } from 'node:fs/promises';
const exec=promisify(execFile);
export async function makeDemoVideo() {
  const file='.data/demo-ritual.mp4';try{await access(file);return file;}catch{}
  await mkdir('.data',{recursive:true});
  const filter=[
    'drawbox=x=0:y=0:w=480:h=854:color=0x294d40:t=fill',
    'drawbox=x=0:y=500:w=480:h=354:color=0xd8dfc5:t=fill',
    "drawtext=text='T E R R A':fontcolor=white:fontsize=26:x=(w-tw)/2:y=56",
    "drawtext=text='Less rush.':fontcolor=white:fontsize=44:x=(w-tw)/2:y=138:enable='lt(t,5)'",
    "drawtext=text='More ritual.':fontcolor=white:fontsize=44:x=(w-tw)/2:y=192:enable='lt(t,5)'",
    "drawtext=text='One simple step.':fontcolor=white:fontsize=32:x=(w-tw)/2:y=160:enable='between(t,5,10)'",
    "drawtext=text='Find your daily ritual.':fontcolor=white:fontsize=28:x=(w-tw)/2:y=160:enable='gte(t,10)'",
    'drawbox=x=187:y=300:w=106:h=42:color=0x1b352a:t=fill',
    'drawbox=x=168:y=342:w=144:h=244:color=0xf4f0df:t=fill',
    "drawtext=text='terra':fontcolor=0x294d40:fontsize=33:x=(w-tw)/2:y=405",
    "drawtext=text='DAILY RITUAL':fontcolor=0x294d40:fontsize=13:x=(w-tw)/2:y=458",
    "drawtext=text='STARTER KIT':fontcolor=0x294d40:fontsize=20:x=(w-tw)/2:y=680",
    "drawtext=text='SIMULATED DEMO CREATIVE':fontcolor=0x294d40:fontsize=12:x=(w-tw)/2:y=800",
  ].join(',');
  await exec('ffmpeg',['-nostdin','-v','error','-f','lavfi','-i','color=c=0x294d40:s=480x854:r=24:d=15','-f','lavfi','-i','sine=frequency=330:duration=15','-vf',filter,'-af','volume=0.015','-c:v','libx264','-threads','1','-pix_fmt','yuv420p','-c:a','aac','-shortest','-movflags','+faststart','-y',file],{timeout:60000});return file;
}
