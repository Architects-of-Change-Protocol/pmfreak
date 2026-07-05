# Playbook Engine — Materialization Phase 1

> **Estado:** implementado. Ver `docs/playbook-engine-materialization-design.md` para el diseño completo de las 7 fases; este documento cubre únicamente lo que Phase 1 realmente construyó.
>
> **Contexto de partida:** Sprints 1-7 + Hardening Sprint (`a7fa89b`, branch `claude/playbook-engine-integration-review-o94uu2`) + Materialization Design (`74f14b7`, branch `claude/playbook-engine-materialization-design-hz5n4o`).

---

## 1. Qué se implementó

Tres tablas nuevas (migración `supabase/migrations/20260816000000_playbook_engine_materialization_phase1.sql`):

- **`playbook_snapshots`** — header/provenance de una corrida de `generatePlaybookGovernanceSnapshot()`. Único por `(workspace_id, project_id, fingerprint)`.
- **`playbook_recommendations`** — una fila por `PlaybookRecommendation`, con el lifecycle completo de 9 estados (`new → viewed → accepted → ... → executed`, o `dismissed`/`converted_to_task`/`converted_to_draft`). Único por `(workspace_id, project_id, fingerprint)`.
- **`playbook_audit_events`** — append-only, deduplicado por fingerprint, sin política de `update`/`delete` (inmutable).

Capa de servicio pura + DB-aware, en `src/lib/playbook-engine/`:

- `materialization-types.ts` — row types, la interfaz duck-typed `MaterializationDbClient`/`MaterializationQueryBuilder` (estructuralmente compatible con `SupabaseClient`, mockeable sin DB real) y los tipos de input/resultado.
- `materialization-mappers.ts` — **puro**, sin DB: `governanceSnapshotToSnapshotRow`, `recommendationToRecommendationRow`, `auditEventToAuditEventRow`, `shouldPreserveHumanState`, `recommendationContentSignature`.
- `materialization-service.ts` — `materializePlaybookGovernanceSnapshot(input)`, la única función de este directorio que llama a una base de datos.

El resto de `src/lib/playbook-engine/` (rules engine, recommendation engine, communication/operational/closure-billing engines, audit engine, governance snapshot engine, demo scenarios) **no se tocó** — sigue siendo 100% puro/in-memory.

## 2. Qué NO se materializa todavía

- UI — cero componentes/rutas nuevas.
- `playbook_communication_drafts` / `playbook_operational_drafts` / `playbook_closure_billing_assessments` (+ blockers) — sus datos siguen viviendo únicamente dentro de `playbook_snapshots.snapshot_payload` (jsonb), no en tablas propias.
- `platform_events` real — el mapper `playbookAuditEventToPlatformEventInput` (Sprint 7) sigue sin conectarse a `createPlatformEvent()`. Confirmado el motivo: coexisten migraciones de `platform_events` con columnas divergentes (`event_payload` vs `payload`), documentado como riesgo bloqueante en `docs/playbook-engine-materialization-design.md` §8. Resolver esa divergencia es un prerequisito de la Fase 5, fuera de este esfuerzo.
- Conversión real hacia RAID (`raid_items`), decision-governance (`constitutional_decisions`), o `task_drafts`/`recommended_actions` — ningún mapper de conversión se conectó; esos dominios siguen siendo dominios separados por diseño (§6 del documento de diseño).
- Gmail/email — no hay envío real, nunca lo hubo en el engine.
- Playbook Registry, auto-approval, auto-execution — no existen en este repo todavía; no se agregó nada de esto.

## 3. Overwrite policy / human-state preservation

`shouldPreserveHumanState(existingRow)` (pura, en `materialization-mappers.ts`) devuelve `true` para cualquier `playbook_recommendations.status` distinto de `"new"`:

```
viewed, accepted, dismissed, converted_to_task, converted_to_draft,
requires_approval, approved, executed
```

Comportamiento de `materializePlaybookGovernanceSnapshot` por tabla:

- **`playbook_snapshots`**: se upsertea por fingerprint. Fingerprint existente → no-op total (el contenido es determinístico por fingerprint, no hay nada que refrescar). Fingerprint nuevo → insert de una fila nueva. Nunca se actualiza contenido de una fila existente.
- **`playbook_recommendations`**:
  - Fingerprint nuevo → insert con `status: "new"`.
  - Fingerprint existente con `status !== "new"` (estado humano) → **no se toca** `status`, ningún timestamp (`viewed_at`/`accepted_at`/`dismissed_at`/`approved_at`/`executed_at`), ni ninguna columna de contenido (`title`, `severity`, `evidence_used`, `suggested_actions`, `explanation`, `recommendation_payload`, `approval_required`, etc.). Lo único que puede cambiar es `content_stale`, calculado comparando la firma de contenido (`recommendationContentSignature`) del payload guardado contra el recién generado.
  - Fingerprint existente con `status === "new"` → el contenido se refresca libremente, **excepto** `approval_required`, que se combina con OR (`existing.approval_required || nuevo.approvalRequired`) — nunca puede pasar de `true` a `false`.
- **`playbook_audit_events`**: insert-only. Fingerprint existente → dedupe, no se inserta ni se actualiza nada. Fingerprint nuevo → insert.

Ninguna función de esta capa aprueba, ejecuta, ni avanza automáticamente el estado de una recomendación. `approval_required` solo puede endurecerse, nunca relajarse.

## 4. Base de datos

Convenciones seguidas (mismas que `recommended_actions`/`task_drafts`/`project_constitutions`):

- `workspace_id`/`project_id` con `references ... on delete cascade`.
- RLS vía `public.is_workspace_member(workspace_id)` en las 3 tablas; políticas `select`/`insert`/`update` en `playbook_snapshots` y `playbook_recommendations`; **solo `select`/`insert`** en `playbook_audit_events` (sin `update`/`delete` — inmutable).
- `updated_at` vía trigger `public.set_updated_at()` reusado (no aplica a `playbook_audit_events`, que no tiene `updated_at`).
- Todas las columnas nuevas declaradas en `src/lib/db/database-contract.ts` (`PlaybookSnapshotRow`, `PlaybookRecommendationRow`, `PlaybookAuditEventRow` + sus `*_SELECTABLE_COLUMNS`), y registradas en `scripts/check-db-schema-contract.mjs`.

## 5. Servicio: `materializePlaybookGovernanceSnapshot(input)`

```ts
materializePlaybookGovernanceSnapshot({
  supabase,       // MaterializationDbClient — cualquier cliente estructuralmente compatible
  snapshot,       // PlaybookGovernanceSnapshot generado por generatePlaybookGovernanceSnapshot()
  actorId,        // opcional, reservado para una fase futura — no se escribe en ninguna columna todavía
  options,        // { sourceContextHash?: string | null }
}): Promise<MaterializePlaybookGovernanceSnapshotResult>
```

Devuelve un view model con los IDs reales de DB (no los IDs sintéticos/fingerprint del engine) y, por cada recomendación/evento, si fue `created`, `preserved`/`deduplicated`, y `contentStale`.

`MaterializationDbClient` es una interfaz duck-typed (`from(table).select().eq().insert()/.update().maybeSingle()/.single()`) — un `SupabaseClient` real la satisface sin adaptador, y los tests la satisfacen con un repositorio en memoria, sin tocar una base de datos real.

## 6. Tests

`tests/playbook-engine-materialization.test.mjs` — 28 tests, 3 categorías:

1. **Migración/contrato** (assertions de texto sobre el SQL y `database-contract.ts`): tablas, columnas, constraints de status, índices, RLS, ausencia de política `update`/`delete` en `playbook_audit_events`.
2. **Mappers puros** (fixtures reales vía `generateDemoGovernanceSnapshot`): `governanceSnapshotToSnapshotRow`, `recommendationToRecommendationRow` (status `new` por defecto), `auditEventToAuditEventRow`, `shouldPreserveHumanState` (true/false), `recommendationContentSignature`.
3. **Repositorio mock en memoria** (sin DB real): idempotencia con mismo fingerprint, preservación de `dismissed`, no relajación de `approval_required`, `content_stale` cuando el payload cambia bajo estado humano preservado, dedupe de audit events, y verificación de que el servicio **solo** llama `.from()` sobre las 3 tablas de Phase 1 (nunca `recommended_actions`, `task_drafts`, ni `platform_events`).

## 7. Próxima fase recomendada

**Fase 2** del documento de diseño original: exponer `listPlaybookRecommendations` / `updatePlaybookRecommendationStatus` (delegando la validación de transición a `recommendation-state.ts`, ya existente y puro) y `listPlaybookAuditEvents`, todavía sin UI — esto habilita que un caller real (ruta API) invoque `materializePlaybookGovernanceSnapshot` y permita a un humano mover una recomendación por su lifecycle, antes de construir cualquier pantalla.
