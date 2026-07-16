import fs from 'node:fs'; import path from 'node:path'; import {readJson,listFiles,fail,root} from './compliance-lib.mjs';
const errs=[]; const pkgs=listFiles('.').filter(f=>f.endsWith('package.json'));
for(const f of pkgs){ const p=readJson(f); const internal=f==='package.json'||f.startsWith('src/aoc/'); if(internal && p.private!==true && f==='package.json') errs.push(`${f} must be private:true`); if(f==='package.json'&&p.publishConfig) errs.push('Root package must not define publishConfig'); for(const [n,s] of Object.entries(p.scripts||{})) if(/npm\s+publish/.test(s)&&f==='package.json') errs.push(`Potential direct npm publish script in root: ${n}`); }
for(const f of listFiles('.').filter(f=>f.endsWith('.npmrc')||f.includes('npmrc'))){ const t=fs.readFileSync(path.join(root,f),'utf8'); if(/_authToken\s*=\s*\S+|npm_?token/i.test(t)) errs.push(`Potential npm credential in ${f}: [REDACTED]`); }
fail(errs); console.log('Package publication safety passed.');
