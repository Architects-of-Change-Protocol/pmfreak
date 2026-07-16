import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const root = process.cwd();
export function readJson(p){return JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));}
export function exists(p){return fs.existsSync(path.join(root,p));}
export function sha256(p){return crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex');}
export function commit(){try{return execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim()}catch{return 'UNKNOWN'}}
export function listFiles(dir='.') { const out=[]; function walk(d){ for(const e of fs.readdirSync(path.join(root,d),{withFileTypes:true})){ const rel=path.join(d,e.name).replace(/^\.\//,''); if(['node_modules','.git','.next','coverage','dist','build','tmp'].some(x=>rel===x||rel.startsWith(x+'/'))) continue; if(e.isDirectory()) walk(rel); else out.push(rel); }} walk(dir); return out.sort(); }
export function classifyLicense(lic, policy){
  const raw=(lic||'UNKNOWN').trim();
  const upper=raw.toUpperCase();
  if(!lic) return {classification:'REVIEW_REQUIRED', reason:'UNKNOWN'};
  if(upper.includes('SEE LICENSE IN')) return {classification:'REVIEW_REQUIRED', reason:'SEE LICENSE IN'};
  if(/[()]/.test(raw)||/\s+(OR|AND)\s+/i.test(raw)){
    const toks=raw.replace(/[()]/g,'').split(/\s+(?:OR|AND)\s+/i).map(s=>s.trim());
    if(/\s+OR\s+/i.test(raw) && toks.some(t=>classifyLicense(t,policy).classification==='ALLOWED')) return {classification:'ALLOWED', reason:raw};
    if(toks.some(t=>classifyLicense(t,policy).classification==='BLOCKED')) return {classification:'BLOCKED', reason:raw};
    if(toks.every(t=>policy.allowed.includes(t))) return {classification:'ALLOWED', reason:raw};
    return {classification:'REVIEW_REQUIRED', reason:'COMPOUND'};
  }
  if(/LGPL/i.test(raw)) return {classification:'REVIEW_REQUIRED', reason:raw};
  if(/(?:^|[^L])GPL|AGPL|SSPL|BUSL|COMMONS CLAUSE|NON-?COMMERCIAL|NO DERIV|NO MODIFICATION|FIELD.?OF.?USE/i.test(raw)) return {classification:'BLOCKED', reason:raw};
  if(policy.allowed.includes(raw)) return {classification:'ALLOWED', reason:raw};
  if(policy.reviewRequired.includes(raw)||['UNLICENSED','UNKNOWN'].includes(raw)) return {classification:'REVIEW_REQUIRED', reason:raw};
  return {classification:'REVIEW_REQUIRED', reason:'CUSTOM'};
}
export function exceptionFor(pkg, policy){ const today=new Date().toISOString().slice(0,10); return (policy.approvedExceptions||[]).find(e=>e.package===pkg.name && (!e.versionRange||e.versionRange===pkg.version||e.versionRange==='*') && e.detectedLicense===pkg.declaredLicense && e.justification && e.approver && e.approvalDate && e.reviewDate && e.compensatingControl && typeof e.legalReviewRequired==='boolean' && e.reviewDate>=today); }
export function fail(msgs){ if(msgs.length){ console.error(msgs.map(m=>'[FAIL] '+m).join('\n')); process.exit(1);} }
