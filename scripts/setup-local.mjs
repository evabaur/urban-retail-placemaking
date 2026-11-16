// LOCAL ONLY: initialize a fresh built app without production credentials.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const config='dist/server/wrangler.json';
if(!existsSync(config))throw Error('Run npm run build first. No production operation was attempted.');
const vars=path.join(root,'.dev.vars');
if(!existsSync(vars))writeFileSync(vars,
  '# Local only; never commit or share this file.\nADMIN_INITIAL_PASSWORD="'+randomBytes(24).toString('base64url')+'"\nVPA_CANVAS_SUBMIT_ENABLED="false"\nVPA_REVIEW_LIVE_ENABLED="false"\n',
  {flag:'wx',mode:0o600});
const cfg=JSON.parse(readFileSync(config,'utf8'));
if(!cfg.d1_databases?.some(x=>x.binding==='DB'))throw Error('Built config has no DB binding.');
// Wrangler resolves .dev.vars relative to its generated config, not repo root.
// Root copy is for hot reload; dist copy is ignored and only for npm start.
writeFileSync(path.join(path.dirname(config),'.dev.vars'),readFileSync(vars),{mode:0o600});
const args=['node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config',config,'--persist-to','.wrangler/state'];
const probe=spawnSync(process.execPath,[...args,'--command',"SELECT name FROM sqlite_master WHERE type='table' AND name='users'",'--json'],{encoding:'utf8',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
if(probe.status!==0)throw Error('Local DB probe failed: '+probe.stderr);
const result=JSON.parse(probe.stdout);
if(result.some(x=>x.results?.some(r=>r.name==='users'))){
  console.log('Existing local schema preserved. No accounts or files reset.');
}else{
  const migration=spawnSync(process.execPath,[...args,'--file','drizzle/0000_absurd_jasper_sitwell.sql'],{stdio:'inherit',env:{...process.env,WRANGLER_SEND_METRICS:'false'}});
  if(migration.status!==0)process.exit(migration.status??1);
}
console.log('Local setup ready. Run npm start. Username: owner01. Read your local password in ignored .dev.vars; it is not a production password.');
