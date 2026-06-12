import test from 'node:test'
import assert from 'node:assert/strict'
import { createPersistentLifecycleStore, getPersistentLifecycleStoreHealth } from '../src/lib/dashboard/persistent-lifecycle-store/lifecycle-store-factory.ts'
import { createSupabasePersistentLifecycleStore } from '../src/lib/dashboard/persistent-lifecycle-store/supabase-lifecycle-store.ts'
import { createVaultPersistentLifecycleStore } from '../src/lib/dashboard/persistent-lifecycle-store/vault-lifecycle-store-contract.ts'
import { hydratePersistentLifecycleState } from '../src/lib/dashboard/persistent-lifecycle-store/lifecycle-hydration-engine.ts'
import { mapEventToPersistentRecord, mapPersistentRecordToEvent } from '../src/lib/dashboard/persistent-lifecycle-store/lifecycle-event-mapper.ts'
import { mapLifecycleToPersistentRecord, mapPersistentRecordToLifecycle } from '../src/lib/dashboard/persistent-lifecycle-store/lifecycle-record-mapper.ts'
import { reconcilePersistentLifecycleState } from '../src/lib/dashboard/persistent-lifecycle-store/lifecycle-reconciliation-engine.ts'
import { replayLifecycleEventStream } from '../src/lib/dashboard/persistent-lifecycle-store/lifecycle-replay-engine.ts'
import { runPersistentLifecycleStoreRuntime } from '../src/lib/dashboard/persistent-lifecycle-store/persistent-lifecycle-store-runtime.ts'

const NOW='2026-05-26T12:00:00.000Z'
const lifecycle=(id,status='created')=>({id, envelopeId:`env-${id}`, actionId:'a1', adapter:'jira', status, envelope:{id:'x'}, approvalDecisions:[], retryCount:0, createdAt:NOW, updatedAt:NOW})
const event=(id,lifecycleId,eventType,occurredAt=NOW)=>({id,lifecycleId,eventType,occurredAt,message:'m',metadata:{}})

function createFakeSupabaseClient(){const db={dashboard_task_lifecycle_records:[],dashboard_task_lifecycle_events:[]};return {from(table){const state={rows:[...db[table]]};const q={eq(k,v){state.rows=state.rows.filter(r=>r[k]===v);return q},is(k,v){state.rows=state.rows.filter(r=>r[k]===v);return q},order(k,{ascending}){state.rows=state.rows.sort((a,b)=>{if(a[k]===b[k])return 0;return ascending?(a[k]>b[k]?1:-1):(a[k]>b[k]?-1:1)});return q},select(){return q},maybeSingle:async()=>({data:state.rows[0]??null}),then(res){return Promise.resolve({data:state.rows}).then(res)},async upsert(payload){const i=db[table].findIndex(r=>r.lifecycle_id===payload.lifecycle_id&&r.tenant_id===payload.tenant_id&&r.workspace_id===payload.workspace_id);if(i>=0)db[table][i]=payload;else db[table].push(payload);return {data:payload}},async insert(payload){const arr=Array.isArray(payload)?payload:[payload];for(const row of arr){if(!db[table].some(x=>x.event_id===row.event_id))db[table].push(row)}return {data:arr}}};return q},rpc(){}}}

// 25 tests
for (const [i,fn] of [
()=>{const p=mapLifecycleToPersistentRecord({tenantId:'t',workspaceId:'w',lifecycle:lifecycle('1')});assert.equal(mapPersistentRecordToLifecycle(p).id,'1')},
()=>{const p=mapEventToPersistentRecord({tenantId:'t',workspaceId:'w',event:event('e','1','execution_completed')});assert.equal(mapPersistentRecordToEvent(p).id,'e')},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveLifecycle(lifecycle('1'));assert.equal((await s.listLifecycles()).length,1)},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveEvent(event('e1','1','execution_completed'));assert.equal((await s.listEvents()).length,1)},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveLifecycle({...lifecycle('1'),updatedAt:'2026-01-01T00:00:00.000Z'});await s.saveLifecycle({...lifecycle('2'),updatedAt:'2026-02-01T00:00:00.000Z'});assert.deepEqual((await s.listLifecycles()).map(x=>x.id),['1','2'])},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveEvent(event('1','1','execution_completed','2026-01-01T00:00:00.000Z'));await s.saveEvent(event('2','1','execution_failed','2026-02-01T00:00:00.000Z'));assert.deepEqual((await s.listEvents()).map(x=>x.id),['1','2'])},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveEvent(event('1','1','execution_completed'));await s.saveEvent(event('1','1','execution_completed'));assert.equal((await s.listEvents()).length,1)},
async()=>{const s=createVaultPersistentLifecycleStore();await assert.rejects(()=>s.listLifecycles())},
()=>{const s=createPersistentLifecycleStore({config:{provider:'supabase',tenantId:'t'},supabaseClient:createFakeSupabaseClient()});assert.ok(s)},
()=>{const s=createPersistentLifecycleStore({config:{provider:'vault',tenantId:'t'}});assert.ok(s)},
()=>{assert.equal(getPersistentLifecycleStoreHealth({config:{provider:'supabase',tenantId:'t'},supabaseClient:createFakeSupabaseClient()}).healthy,true)},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveLifecycle(lifecycle('1'));await s.saveEvent(event('e','1','execution_completed'));const h=await hydratePersistentLifecycleState(s);assert.equal(h.records.length+h.events.length,2)},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveLifecycle(lifecycle('1'));const h=await hydratePersistentLifecycleState(s);assert.equal(h.warnings[0],'Lifecycle has no event lineage.')},
()=>{assert.equal(replayLifecycleEventStream({lifecycles:[lifecycle('1')],events:[event('e','1','execution_completed')]}).reconstructed[0].status,'execution_completed')},
()=>{assert.equal(replayLifecycleEventStream({lifecycles:[lifecycle('1')],events:[event('e','1','execution_failed')]}).reconstructed[0].status,'execution_failed')},
()=>{assert.equal(replayLifecycleEventStream({lifecycles:[lifecycle('1')],events:[event('e','1','retry_scheduled')]}).reconstructed[0].retryCount,1)},
()=>{assert.equal(replayLifecycleEventStream({lifecycles:[lifecycle('1')],events:[event('e','1','approval_approved')]}).reconstructed[0].status,'approved')},
()=>{assert.equal(replayLifecycleEventStream({lifecycles:[lifecycle('1')],events:[event('e','1','approval_rejected')]}).reconstructed[0].status,'rejected')},
()=>{assert.ok(replayLifecycleEventStream({lifecycles:[lifecycle('1')],events:[event('e','1','bogus')]}).warnings[0].includes('Unknown'))},
()=>{assert.equal(reconcilePersistentLifecycleState({hydrated:[lifecycle('1','created')],replayed:[lifecycle('1','execution_completed')]}).warnings[0],'Lifecycle state reconciled from replay.')},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveLifecycle(lifecycle('1'));await s.saveEvent(event('e','1','execution_completed'));const r=await runPersistentLifecycleStoreRuntime({store:s,supabaseClient:createFakeSupabaseClient(),now:NOW});assert.equal(r.healthy,true)},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveLifecycle(lifecycle('1'));const r=await runPersistentLifecycleStoreRuntime({store:s,supabaseClient:createFakeSupabaseClient(),now:NOW});assert.equal(r.executiveSummary,'PMFreak recovered lifecycle state with reconciliation warnings.')},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});const r=await runPersistentLifecycleStoreRuntime({store:s,supabaseClient:null,now:NOW});assert.equal(r.executiveSummary,'Persistent lifecycle store health issues detected.')},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveEvent(event('b','1','execution_failed','2026-01-02T00:00:00.000Z'));await s.saveEvent(event('a','1','execution_completed','2026-01-01T00:00:00.000Z'));assert.deepEqual((await s.getEventsForLifecycle('1')).map(x=>x.id),['a','b'])},
async()=>{const s=createSupabasePersistentLifecycleStore({client:createFakeSupabaseClient(),config:{provider:'supabase',tenantId:'t',workspaceId:'w'}});await s.saveLifecycle(lifecycle('1'));await s.saveEvent(event('e','1','execution_completed'));const r1=await runPersistentLifecycleStoreRuntime({store:s,supabaseClient:createFakeSupabaseClient(),now:NOW});const r2=await runPersistentLifecycleStoreRuntime({store:s,supabaseClient:createFakeSupabaseClient(),now:NOW});assert.deepEqual(r1,r2)},
()=>{assert.equal(replayLifecycleEventStream({lifecycles:[lifecycle('1')],events:[event('e','1','approval_requested')]}).reconstructed[0].status,'approval_pending')}
].entries()){
  test(`${i+1} persistent lifecycle`, fn)
}
