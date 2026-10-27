import { readdir, readFile } from 'node:fs/promises';
import { pool, transaction } from '../src/lib/db';
await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(274901)');
  await c.query('CREATE TABLE IF NOT EXISTS schema_migrations(name text PRIMARY KEY,applied_at timestamptz DEFAULT now())');
  for(const name of (await readdir('migrations')).filter(n=>n.endsWith('.sql')).sort()) {
    if((await c.query('SELECT 1 FROM schema_migrations WHERE name=$1',[name])).rowCount)continue;
    await c.query(await readFile(`migrations/${name}`,'utf8'));
    await c.query('INSERT INTO schema_migrations(name) VALUES($1)',[name]);
    console.log('Applied',name);
  }
});
await pool.end();
