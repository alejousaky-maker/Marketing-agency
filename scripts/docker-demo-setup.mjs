import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';

// A random password is needed for the seed account; the local demo uses its
// explicitly enabled one-click session flow. Never print or save the password.
const env = { ...process.env, DEMO_PASSWORD: randomBytes(32).toString('base64url') };
for (const task of ['db:migrate', 'db:seed']) {
  execFileSync('npm', ['run', task], { env, stdio: 'inherit' });
}
console.log('AgencyOS demo initialized. The web and worker services can now start.');
