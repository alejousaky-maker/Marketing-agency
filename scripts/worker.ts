import { runNextJob } from '../src/lib/jobs';
import { pool } from '../src/lib/db';
let stopped=false;
process.on('SIGTERM',()=>{stopped=true;});process.on('SIGINT',()=>{stopped=true;});
console.log('AgencyOS analysis worker ready');
while(!stopped){try{const ran=await runNextJob();if(!ran)await new Promise(r=>setTimeout(r,1500));}catch{console.error('Worker database unavailable; retrying shortly.');await new Promise(r=>setTimeout(r,5000));}}
await pool.end();
