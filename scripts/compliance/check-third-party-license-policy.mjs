import {readJson,classifyLicense,exceptionFor,fail,exists} from './compliance-lib.mjs';
if(!exists('artifacts/compliance/third-party-license-inventory.json')) { console.error('Inventory missing; run npm run compliance:licenses:generate'); process.exit(1); }
const policy=readJson('config/compliance/license-policy.json'), inv=readJson('artifacts/compliance/third-party-license-inventory.json'); const errs=[];
for(const p of inv.packages){ const c=classifyLicense(p.declaredLicense,policy); if(c.classification==='BLOCKED'&&!exceptionFor(p,policy)) errs.push(`${p.name}@${p.version} blocked license ${p.declaredLicense}`); if(c.classification==='REVIEW_REQUIRED'&&!exceptionFor(p,policy)) console.warn(`[REVIEW_REQUIRED] ${p.name}@${p.version} requires review for ${p.declaredLicense}`); }
for(const e of policy.approvedExceptions||[]) for(const k of ['package','detectedLicense','justification','approver','approvalDate','reviewDate','compensatingControl','legalReviewRequired']) if(e[k]===undefined||e[k]==='') errs.push(`Incomplete exception for ${e.package||'UNKNOWN'} missing ${k}`);
fail(errs); console.log('Third-party license policy passed.');
