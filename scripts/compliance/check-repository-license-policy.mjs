import fs from 'node:fs'; import path from 'node:path'; import {readJson,exists,listFiles,fail,root} from './compliance-lib.mjs';
const errs=[]; const p=readJson('package.json'); if(p.private!==true) errs.push('Root package.json must be private:true'); if(p.license!=='UNLICENSED') errs.push('Root package.json license must be UNLICENSED');
for(const f of ['LICENSE','LICENSE.md','LICENSE.txt']) if(exists(f)) errs.push(`Unexpected root ${f} file`);
if(exists('README.md')){ const r=fs.readFileSync(path.join(root,'README.md'),'utf8'); if(/license-?MIT|license-?Apache|license-?GPL|MIT license|Apache License|GNU General Public License/i.test(r)) errs.push('README appears to advertise a public license'); }
const grantPattern = new RegExp('Permission is hereby granted, free' + ' of charge', 'i');
for(const f of listFiles('.')){ if(['THIRD_PARTY_NOTICES.md'].includes(f)||f.startsWith('third_party_licenses/')||f.startsWith('docs/governance/ip-compliance/')||f.startsWith('tests/compliance/')||f==='package-lock.json') continue; const txt=fs.readFileSync(path.join(root,f),'utf8'); if(grantPattern.test(txt)) errs.push(`Public license grant phrase outside allowed paths: ${f}`); }
fail(errs); console.log('Repository license policy passed.');
