# Playbook Engine — Materialization Design

> **Estado de este documento:** diseño únicamente. No implementado. No hay migraciones, no hay código de persistencia, no hay UI. Requiere confirmación explícita antes de pasar a implementación.
>
> **Contexto de partida:** Sprints 1-7 + Hardening Sprint completos (`a7fa89b`, branch `claude/playbook-engine-integration-review-o94uu2`). `src/lib/playbook-engine/` es 100% lógica pura in-memory: sin DB writes, sin llamadas a Supabase, sin emails, sin `platform_events` reales, sin approvals ni cierre/facturación reales. Ver `docs/playbook-engine-foundation.md` para el diseño funcional del engine.

---

## 1. Executive recommendation

**Materializar por fases, no todo de una vez.** El engine ya resuelve idempotencia con fingerprints deterministas y ya modela status humano en memoria (`recommendation-state.ts`, `communication-state.ts`, `operational-intelligence-state.ts`, `closure-billing-state.ts`). Lo único que falta es la capa de persistencia — no hay que rediseñar el dominio.

**Persistir primero (Fase 1-2):**
- `playbook_snapshots` (header/provenance, no todo el contenido embebido)
- `playbook_recommendations`
- `playbook_audit_events`

Razón: son la base de todo lo demás (comm drafts, operational drafts y closure/billing derivan de recomendaciones), y `playbook_audit_events` es lo único con valor de auditoría/legal desde el día uno, aunque todavía no se materialice como `platform_events`.

**Persistir después (Fase 3):**
- `playbook_communication_drafts`
- `playbook_operational_drafts`
- `playbook_closure_billing_assessments` + `playbook_closure_blockers` + `playbook_billing_blockers`

**NO persistir todavía:**
- `ProjectConstitutionDraft` como tabla independiente — ver §3.7, hay ambigüedad de ownership frente a `project_constitutions`/`constitution-service.ts` que debe resolverse con el usuario antes de crear tabla (ver §8).
- `PlaybookRuleEvaluation` — es 100% derivable de `ProjectContextFacts` + `DeliveryPlaybook`, no tiene estado humano, no necesita fila propia. Vive como JSONB dentro de `playbook_snapshots.rules_evaluation_summary`, solo para explicabilidad/auditoría del snapshot, sin identidad ni lifecycle propios.
- Materialización real hacia `platform_events` — el mapper (`playbookAuditEventToPlatformEventInput`) ya existe y es correcto, pero conectar el `createPlatformEvent()` real es Fase 5, después de validar que la deduplicación de eventos entre regeneraciones funciona (ver §5, §7).
- Conversión real hacia RAID / decision-governance / task_drafts — los mappers puros (`operational-intelligence-mappers.ts`, `closure-billing-mappers.ts`) ya producen el shape correcto de input, pero la escritura real es Fase 7, la última.

---

## 2. Proposed architecture

### 2.1 Diagrama textual

```
ProjectContextFacts (input, no persistido — se recalcula desde vault/evidence en runtime)
        │
        ▼
generatePlaybookGovernanceSnapshot()          [PURO — sin cambios]
        │
        ▼
PlaybookGovernanceSnapshot (in-memory)
        │
        ▼
┌───────────────────────────────────────────────────────────────┐
│  materializePlaybookGovernanceSnapshot()   [NUEVO — capa DB]  │
│                                                                 │
│  1. upsert playbook_snapshots (header, by snapshot fingerprint)│
│  2. upsert playbook_recommendations[]      (by fingerprint)    │
│  3. upsert playbook_communication_drafts[] (by fingerprint)    │
│  4. upsert playbook_operational_drafts[]   (by fingerprint)    │
│  5. upsert playbook_closure_billing_assessments (by fingerprint)│
│     + playbook_closure_blockers[] / playbook_billing_blockers[] │
│  6. upsert playbook_audit_events[]         (by fingerprint,     │
│     insert-only — nunca update de contenido)                   │
│  7. devolver PlaybookGovernanceSnapshotViewModel (para UI)     │
└───────────────────────────────────────────────────────────────┘
        │
        ▼
UI-ready view model (lee estado humano YA persistido, no el
recién generado, para los campos que el humano puede haber tocado)
```

### 2.2 Entity ownership (quién es la fuente de verdad)

| Concepto | Fuente de verdad del **contenido** | Fuente de verdad del **estado humano** |
|---|---|---|
| Reglas evaluadas | Engine (recalculado siempre) | N/A — no aplica |
| Recomendación | Engine (título, severidad, evidencia) mientras `status='new'` | Tabla DB una vez que `status` avanza (viewed/accepted/dismissed/...) |
| Comm draft | Engine (subject/body/recipients) mientras `status='draft'` | Tabla DB desde `reviewed` en adelante |
| Operational draft | Engine mientras `status='draft'` | Tabla DB desde `reviewed` en adelante |
| Closure/Billing assessment | Engine (checklist/ratio) siempre recalculado | Tabla DB solo para `reviewStatus` y blocker `status` |
| Audit event | Engine (evento generado una vez) | N/A — inmutable, insert-only |

Este es el patrón "regeneración vs persistencia" central del diseño: **el contenido derivado siempre se puede recalcular desde `ProjectContextFacts`; lo que se persiste es (a) el ancla de identidad —fingerprint→id— y (b) la decisión humana que no debe perderse en la próxima regeneración.**

### 2.3 Regla de oro (state preservation)

Replicando el patrón ya usado en `materializeRecommendedActions` / `materializeTaskDraftForRecommendedAction`:

> Si el `status` de la fila existente ya salió de su estado inicial ("no soft/undecided" — ver tabla de estados por entidad en §3), el upsert **no sobreescribe campos de contenido**. Como máximo actualiza metadata de refresco (`content_regenerated_at`, `content_stale`) para que la UI pueda avisar "esto se generó con un contexto más viejo" sin borrar la decisión humana.

---

## 3. Entidades — persistir sí/no y diseño por entidad

### 3.1 `PlaybookGovernanceSnapshot` → **tabla propia: `playbook_snapshots`**
- **Persistir:** sí, pero como **header ligero**, no como blob con todo embebido.
- **Razón:** es el punto de entrada de toda regeneración y el ancla de staleness/versioning; pero su contenido completo (recomendaciones, drafts, etc.) ya vive en tablas propias — duplicarlo en JSONB sería la trampa de "JSONB overuse" (riesgo, §Riesgos).
- **Lifecycle:** no tiene status propio de negocio; es puramente de provenance. Campo `is_latest boolean` para marcar la versión vigente por proyecto.
- **Owner/source of truth:** engine (contenido), sistema (provenance).
- **Regenerable:** sí, siempre. Cada regeneración crea una fila nueva si el fingerprint cambia; nunca se actualiza contenido de una fila con fingerprint distinto.
- **PK real:** sí, `id uuid`. `fingerprint` es la clave de dedupe.

### 3.2 `PlaybookRecommendation` → **tabla propia: `playbook_recommendations`**
- **Persistir:** sí.
- **Razón:** tiene lifecycle humano explícito (`new→viewed→accepted→...→executed`, o `dismissed`/`converted_to_task`/`converted_to_draft`) que debe sobrevivir a regeneraciones del snapshot.
- **Lifecycle:** el de `PlaybookRecommendationStatus` (9 estados, ya definido en `recommendation-state.ts`).
- **Owner/source of truth:** engine hasta `viewed`; humano desde `accepted`/`dismissed` en adelante.
- **Regenerable:** el contenido sí; el status no.
- **PK real:** sí, además de fingerprint (que ya es único por `workspaceId:projectId:playbookId:playbookVersion:ruleId`).

### 3.3 `CommunicationDraft` → **tabla propia: `playbook_communication_drafts`**
- **Persistir:** sí — es el artefacto que un PM copia/edita/envía manualmente; perderlo en cada regeneración es inaceptable.
- **Lifecycle:** `draft→reviewed→approved→copied/sent_manually`, o `discarded`.
- **Owner:** engine hasta `draft`; humano desde `reviewed`. El **envío real** nunca lo hace el sistema (`sent_manually` es literal — el humano lo hace fuera de la app y marca la casilla).
- **Regenerable:** subject/body sí, mientras `status='draft'`; congelado desde `reviewed`.
- **PK real:** sí.

### 3.4 `OperationalDraft` (Risk/Issue/Dependency/Decision) → **tabla propia: `playbook_operational_drafts`** (una tabla, discriminada por `draft_type`)
- **Persistir:** sí.
- **Razón:** es el candidato a convertirse en RAID real o en decision-governance real (Fase 7); hasta entonces necesita sobrevivir como borrador con estado propio.
- **Lifecycle:** `draft→reviewed→approved→converted`, o `discarded`.
- **Owner:** engine hasta `draft`; humano desde `reviewed`.
- **Regenerable:** sí mientras `draft`; nunca una vez `approved`/`converted` (evita duplicar conversiones).
- **PK real:** sí. Discriminador `draft_type: 'risk'|'issue'|'dependency'|'decision'` + JSONB `type_specific` para los campos propios de cada subtipo (ver §6).

### 3.5 `ClosureBillingAssessment` → **tabla propia: `playbook_closure_billing_assessments`** (1 fila vigente por proyecto)
- **Persistir:** sí, con fuerte disclaimer de estado.
- **Razón:** el checklist y el ratio de completitud se recalculan siempre, pero `reviewStatus` (draft/reviewed/discarded) es humano.
- **Regla crítica explícita del usuario:** `readyForBilling` NO implica `invoiced`, y `readyForClosure` NO implica `closed` — estos son solo *indicadores calculados*, nunca transicionan automáticamente a estados de facturación/cierre reales. La tabla NO tiene columnas `invoiced`/`closed`; esas viven (si existen) en el sistema de facturación real, fuera de este dominio.
- **PK real:** sí.

### 3.6 `ClosureBlocker` / `BillingBlocker` → **tablas propias: `playbook_closure_blockers`, `playbook_billing_blockers`**
- **Persistir:** sí, separadas de la tabla de assessment (relación 1-N), para poder marcar cada blocker individualmente como `reviewed` sin tocar el resto.
- **Lifecycle:** `open→reviewed` (nunca auto-resuelto — coincide con el diseño actual, que documenta explícitamente que ningún blocker se resuelve solo).
- **PK real:** sí. FK a `playbook_closure_billing_assessments.id`.

### 3.7 `PlaybookAuditEvent` → **tabla propia: `playbook_audit_events`**
- **Persistir:** sí, append-only.
- **Razón:** es el trail de "qué generó/evaluó el sistema", precursor de `platform_events` pero con más detalle interno (fingerprints de origen) del que querríamos meter en el log global.
- **Lifecycle:** ninguno — inmutable una vez insertado, igual que `platform_events` (mismo patrón: sin políticas RLS de update/delete, trigger de inmutabilidad).
- **PK real:** sí. Fingerprint como clave de dedupe para no duplicar el mismo evento en regeneraciones consecutivas sin cambios.

### 3.8 `ProjectConstitutionDraft` → **⚠️ decisión pendiente, ver §8** — recomendación tentativa: tabla propia `playbook_constitution_drafts`, separada de `project_constitutions`
- **Persistir:** probablemente sí, pero **no en Fase 1-2**.
- **Razón de la ambigüedad:** ya existen *dos* tablas reales de constitución (`project_constitutions` — CRUD simple con status `draft/active/on_hold/...`, y el sistema más pesado de `constitution-service.ts` con `draft/proposed/approved/active/suspended/closed/archived` + `constitution_lifecycle_history`). El `ProjectConstitutionDraft` del playbook engine es conceptualmente un **borrador de insumos** (con `ProjectConstitutionDraftFieldStatus` por campo: `provided/derived_from_playbook/pending_definition/requires_validation/not_available`) que un humano usaría para *poblar* una constitución real — no es la constitución en sí.
- **Recomendación:** tabla puente `playbook_constitution_drafts` (1 por proyecto, regenerable), con conversión explícita hacia `project_constitutions`/`constitution-service` como acción humana en Fase 7 (nunca automática). No mezclar con las tablas de constitución reales — mezclar el vocabulario de lifecycle (`draft/proposed/approved/...`) con el de field-status (`provided/derived_from_playbook/...`) generaría confusión de estado.
- **PK real:** sí, si se aprueba crear la tabla.

### 3.9 `PlaybookRuleEvaluation` → **NO persistir como entidad propia**
- **Persistir:** no.
- **Razón:** cero estado humano, 100% derivable de `(ProjectContextFacts, DeliveryPlaybook)`. Darle tabla propia sería sobre-ingeniería (riesgo "too many tables too early").
- **Dónde vive:** JSONB `rules_evaluation_summary` dentro de `playbook_snapshots`, solo para trazabilidad/explicabilidad de esa versión del snapshot.

---

## 4. Fingerprint vs ID real — política

1. **Todas** las tablas `playbook_*` tienen `id uuid primary key default gen_random_uuid()` como PK real de base de datos, **desacoplado** del fingerprint del engine. Esto es un cambio de comportamiento respecto al engine actual (donde `id === fingerprint`); la capa de materialización es la responsable de mapear: si existe fila con ese fingerprint, reusar su `id` real; si no existe, generar `id` nuevo y guardar el fingerprint del engine en la columna `fingerprint`.
2. **Unique constraint de dedupe:** `unique (workspace_id, project_id, fingerprint)` (o `(workspace_id, fingerprint)` para snapshot, que ya incluye `project_id` en su hash) — replica el patrón de `recommended_actions`/`raid_items`.
3. **Cuándo se preserva estado humano:** cuando la fila existente tiene `status` fuera de su valor inicial ("undecided" — `new` para recomendaciones, `draft` para comm/operational drafts, `open` para blockers). En ese caso el upsert:
   - No sobreescribe: título, descripción, severidad, acciones sugeridas, subject/body, etc.
   - Sí puede actualizar: `content_regenerated_at`, un flag `content_stale: boolean` (true si el fingerprint recién calculado difiere del guardado pero la fila ya no está en estado inicial), y campos puramente de auditoría (`missing_evidence` recalculado solo si aún no field-locked).
4. **Cuándo se regenera contenido:** cuando la fila existente sigue en su status inicial ("undecided") — se sobreescribe libremente porque nadie la ha tocado.
5. **Cuándo se crea una nueva versión (fila nueva) en vez de actualizar:** cuando cambia `playbookVersion` (la política/reglas cambiaron) **y** la fila existente ya está en estado terminal (`dismissed`, `converted_to_task`, `converted_to_draft`, `executed`, `discarded`, `approved`+`converted`). En ese caso no tiene sentido "revivir" la fila vieja; se crea una nueva con fingerprint distinto (el playbookVersion ya forma parte del hash de fingerprint en recomendaciones, así que esto es automático) y la vieja queda como historial.
6. **Evitar duplicados:** el unique constraint de (3) es la única defensa necesaria — no se requiere lógica de deduplicación adicional en aplicación más allá del select-then-branch que ya usan `recommended_actions`/`raid_items` (no hace falta `ON CONFLICT` real de Postgres; seguir el patrón manual ya establecido en el repo para poder aplicar la regla de preservación de estado del punto 3, que un `ON CONFLICT DO UPDATE` puro no puede expresar limpiamente).

---

## 5. Materialization flow

**Orden de materialización** (dependencias: snapshot → recommendations → {comm drafts, operational drafts} → closure/billing → audit):

1. `playbook_snapshots` — insertar header (o detectar que el fingerprint ya existe y no hacer nada, solo marcar `is_latest`).
2. `playbook_recommendations[]` — upsert cada una (select-then-branch por fingerprint).
3. `playbook_communication_drafts[]` — upsert, cada uno con `linked_recommendation_id` apuntando al **id real** (no fingerprint) resuelto en el paso 2.
4. `playbook_operational_drafts[]` — igual, en paralelo lógico con el paso 3 (no dependen entre sí).
5. `playbook_closure_billing_assessments` + blockers hijos — upsert.
6. `playbook_audit_events[]` — insert-only, dedupe por fingerprint (si ya existe, no insertar de nuevo).
7. Devolver el view model de UI, leyendo los **ids reales + status persistidos**, no los objetos recién generados en memoria (para que la UI vea el estado humano correcto).

**Transacciones:** siguiendo el precedente real más cercano del repo (`operational-flow-service.ts` usando `client.rpc(...)` para atomicidad multi-tabla) — se recomienda envolver los pasos 1-6 en **una función Postgres (`materialize_playbook_snapshot`)** llamada vía `supabase.rpc(...)`, en vez de un wrapper transaccional en la aplicación. Esto da atomicidad real (todo o nada) en vez del patrón "best-effort con log de fallo" usado en `program-materialization-service.ts`, que es aceptable para materializaciones de un solo bloque de trabajo pero deja filas huérfanas si falla a mitad de camino — no deseable aquí porque tenemos 6 tablas relacionadas.

**Idempotencia:** correr `materializePlaybookGovernanceSnapshot()` dos veces seguidas con el mismo `ProjectContextFacts` debe ser un no-op total (mismos fingerprints → ninguna fila nueva, ningún cambio de contenido en filas ya "undecided" salvo timestamps de refresco).

**Partial failure handling:** con RPC transaccional, un fallo a mitad camino revierte todo — no hay estado parcial que limpiar. Si se opta por no usar RPC (por restricciones de Supabase RPC/plpgsql), el fallback es el patrón de `program-materialization-service.ts`: fila de header (`playbook_snapshots`) en status `materializing`→`completed`/`failed`, y un audit event de fallo. Recomendamos empezar con RPC — es el patrón correcto para este caso, no el fallback.

**Conflict resolution:** no hay escritura concurrente real esperada (un solo proceso de materialización por proyecto a la vez, disparado por acción de usuario o por regeneración periódica) — el unique constraint de fingerprint más el select-then-branch resuelve carreras al nivel de fila individual; no se necesita locking optimista adicional en Fase 1-2.

**Stale snapshot handling:** el flag `content_stale` (por fila) y `is_latest` (por snapshot) son suficientes para que la UI muestre "hay una versión más reciente del playbook — estas recomendaciones se generaron con datos más viejos" sin forzar regeneración automática ni perder decisiones humanas.

---

## 6. Existing-table reuse analysis

| Tabla existente | ¿Compatible con playbook engine? | Qué se puede mapear | Qué NO mezclar | ¿Tabla puente? |
|---|---|---|---|---|
| `recommended_actions` | **No directamente** | Vocabulario y patrón de fingerprint/status (`proposed→accepted/rejected/deferred/converted_to_task`) sirven de precedente de diseño | `recommended_actions` nace de `raid_items` (evidencia RAID ya materializada); `playbook_recommendations` nace de reglas de playbook evaluadas contra `ProjectContextFacts` — dominios distintos, status vocab distinto (9 estados vs 5). Mezclarlas perdería la semántica de `approvalRequired`/`hasApprovalSensitiveActions` propia del playbook. | No — mantener `playbook_recommendations` separada. Sí puede existir, en Fase 7, un mapper `playbookRecommendationToRecommendedActionInput` si se decide que ciertas recomendaciones deban "graduarse" a `recommended_actions` para reusar su UI de bandeja — pero eso es decisión de producto futura, no de esta fase. |
| `task_drafts` | **Reusable como destino de conversión**, no como tabla de origen | El patrón `IMMUTABLE_STATUSES` (no sobreescribir approved/discarded/converted_to_task) es exactamente el patrón que aplicamos a `playbook_operational_drafts` | No crear filas de `task_drafts` directamente desde el playbook engine sin pasar por una conversión explícita y humana (Fase 7) | Sí — `playbook_operational_drafts` actúa de tabla puente hacia `task_drafts`/`raid_items`/decisiones reales, igual que `recommended_actions` actúa de puente hacia `task_drafts` hoy. |
| `raid_items` | **Destino de conversión para Risk/Issue/Dependency drafts** | `operational-intelligence-mappers.ts` ya produce el input shape correcto (`canonicalRaidFingerprint`) | No insertar en `raid_items` automáticamente al generar el draft — solo tras aprobación humana explícita (`status='approved'` en `playbook_operational_drafts`, acción de conversión Fase 7) | Sí, mismo rol que arriba. |
| Decision-governance (`constitutional_decisions`) | **Destino de conversión para `DecisionDraft`** | `closure-billing-mappers.ts`/`operational-intelligence-mappers.ts` ya generan el shape de input | Es un state machine "pesado" (`decision_type`/`decision_authority`, approve/execute/cancel con actores separados) — no forzar `DecisionDraft` a encajar ahí antes de que el humano decida convertir | Sí, vía conversión explícita, no automática. |
| `platform_events` | **Destino final de `PlaybookAuditEvent`, no inmediato** | El mapper `playbookAuditEventToPlatformEventInput` ya produce el `CreatePlatformEventInput` correcto | No llamar `createPlatformEvent()` en cada regeneración de snapshot sin dedupe — el diseño actual del engine ya dedupe en memoria (`dedupePlaybookAuditEvents`), pero la materialización debe repetir esa dedupe contra lo ya persistido en `platform_events`/`playbook_audit_events` para no inflar el log global. **Nota de riesgo:** se detectaron dos migraciones `platform_events` con distinto shape de columna (`event_payload` vs `payload`) coexistiendo — hay que resolver esa inconsistencia en el schema real antes de escribir en `platform_events` desde este flujo (ver §8). | No aplica — es el sumidero final, no un puente. |
| `project_constitutions` / `constitution-service` | **Destino de conversión para `ProjectConstitutionDraft`**, no la misma tabla | Campos objective/scope/stakeholders/etc. del draft mapean 1:1 a columnas de `project_constitutions` | No usar el vocabulario de `ProjectConstitutionDraftFieldStatus` (`provided/derived_from_playbook/...`) como si fuera el lifecycle de la constitución real (`draft/proposed/approved/...`) — son dos ejes distintos (uno es "qué tan confiable es este campo", el otro es "en qué fase de aprobación está el documento") | Sí — `playbook_constitution_drafts` (§3.8) es la tabla puente; conversión a `project_constitutions` es acción humana explícita en Fase 7. |

---

## 7. Proposed database model

Convenciones (heredadas del resto del repo, confirmadas en `recommended_actions`/`raid_items`/`project_constitutions`):
- `workspace_id uuid not null references public.workspaces(id) on delete cascade` en todas.
- `project_id uuid not null references public.projects(id) on delete cascade` (nullable solo si en el futuro se soporta playbook a nivel workspace, no en Fase 1-2).
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()` + trigger `public.set_updated_at()` reusado.
- JSONB con `not null default '{}'::jsonb` (nunca nullable-sin-default).
- RLS: `enable row level security` + policies `select/insert/update` (nunca `delete`) usando `public.is_workspace_member(workspace_id)`, patrón idéntico al resto del repo.
- Todas las tablas nuevas deben añadir su sección correspondiente en `src/lib/db/database-contract.ts` (`XRow` + `X_SELECTABLE_COLUMNS`), siguiendo la convención de single-source-of-truth ya vigente y verificada por `scripts/check-db-schema-contract.mjs`.

### `playbook_snapshots`
- `id uuid pk`, `workspace_id`, `project_id`, `playbook_id text not null`, `playbook_version text not null`
- `fingerprint text not null`, `is_latest boolean not null default true`
- `rules_evaluation_summary jsonb not null default '{}'` (solo para explicabilidad — no consultado por índice)
- `approval_required_summary jsonb not null default '[]'`, `missing_evidence_summary jsonb not null default '[]'`
- `demo_summary text`
- `created_at`, `updated_at`
- Unique: `(workspace_id, project_id, fingerprint)`. Índice parcial `(workspace_id, project_id) where is_latest` (garantiza una sola vigente — reforzado en app, no como constraint duro, para permitir historial).
- FK: `(project_id, workspace_id) references projects(id, workspace_id)` (patrón composite FK visto en `constitutional_decisions`).

### `playbook_recommendations`
- `id uuid pk`, `workspace_id`, `project_id`, `snapshot_id uuid references playbook_snapshots(id) on delete set null` (referencia informativa al snapshot que la originó/refrescó, no dueño)
- `fingerprint text not null`, `playbook_id`, `playbook_version`, `playbook_rule_id text not null`, `rule_name text`
- `title text not null`, `detected_situation text`, `phase text`, `severity text check(...)`, `status text not null default 'new' check(...)` (9 valores de `PlaybookRecommendationStatus`)
- `confidence numeric(5,2) check (confidence between 0 and 100)`
- `evidence_used jsonb not null default '[]'`, `missing_evidence jsonb not null default '[]'`
- `recommended_action text`, `suggested_actions jsonb not null default '[]'`
- `approval_required boolean not null default false`, `has_approval_sensitive_actions boolean not null default false`
- `explanation jsonb`
- `content_stale boolean not null default false`, `content_regenerated_at timestamptz`
- `reviewed_by uuid references auth.users(id) on delete set null`, `reviewed_at timestamptz` (cuando pasa a `viewed`/`accepted`/`dismissed`)
- `created_at`, `updated_at`
- Unique: `(workspace_id, project_id, fingerprint)`. Índices: `(workspace_id, project_id, status)`, `(playbook_rule_id)`.

### `playbook_communication_drafts`
- `id uuid pk`, `workspace_id`, `project_id`, `linked_recommendation_id uuid references playbook_recommendations(id) on delete set null`
- `fingerprint text not null`, `playbook_rule_id text`, `template_id text not null`, `channel text`
- `status text not null default 'draft' check(...)` (`draft/reviewed/approved/copied/sent_manually/discarded`)
- `subject text`, `body text not null`, `recipients jsonb not null default '[]'`, `cc jsonb not null default '[]'`
- `missing_inputs jsonb not null default '[]'`, `evidence_used jsonb`, `missing_evidence jsonb`
- `approval_required boolean not null default false`, `external_send_requires_approval boolean not null default false`
- `explanation jsonb`, `content_stale boolean not null default false`
- `reviewed_by`, `reviewed_at`, `approved_by uuid references auth.users(id) on delete set null`, `approved_at timestamptz`
- `created_at`, `updated_at`
- Unique: `(workspace_id, project_id, fingerprint)`.

### `playbook_operational_drafts`
- `id uuid pk`, `workspace_id`, `project_id`, `linked_recommendation_id uuid references playbook_recommendations(id) on delete set null`
- `fingerprint text not null`, `playbook_rule_id text`, `draft_type text not null check (draft_type in ('risk','issue','dependency','decision'))`
- `status text not null default 'draft' check(...)` (`draft/reviewed/approved/converted/discarded`)
- `title text not null`, `description text`, `severity text`, `owner text`, `due_date date`
- `type_specific jsonb not null default '{}'` — campos propios de cada subtipo (`probability/impact/mitigation/escalationRecommended` para risk; `blocking/linkedMilestoneId/...` para issue; `dependencyType/externalParty/...` para dependency; `decisionOwner/options/recommendedOption/deadline/consequenceIfNotDecided` para decision)
- `evidence_used`, `missing_evidence`, `missing_inputs jsonb`
- `approval_required boolean not null default false`
- `explanation jsonb`, `content_stale boolean not null default false`
- `converted_entity_type text`, `converted_entity_id uuid` (poblados en Fase 7, tras conversión real a `raid_items`/`constitutional_decisions`)
- `reviewed_by`, `reviewed_at`, `approved_by`, `approved_at`
- `created_at`, `updated_at`
- Unique: `(workspace_id, project_id, fingerprint)`. Índice `(draft_type, status)`.
- **Nota:** una sola tabla discriminada (no 4 tablas) — evita duplicar columnas comunes y sigue el patrón que el propio engine ya usa (`OperationalDraftCommon` + union type).

### `playbook_closure_billing_assessments`
- `id uuid pk`, `workspace_id`, `project_id`, `snapshot_id uuid references playbook_snapshots(id) on delete set null`
- `fingerprint text not null`, `playbook_id`, `playbook_version`
- `review_status text not null default 'draft' check (review_status in ('draft','reviewed','discarded'))`
- `closure_status text`, `billing_status text`
- `ready_for_closure boolean not null default false`, `ready_for_billing boolean not null default false`
- `technical_completion_ratio numeric(5,2)`
- `checklist jsonb not null default '[]'`
- `evidence_used jsonb`, `missing_evidence jsonb`
- `next_best_actions jsonb not null default '[]'`
- `recommended_communication_template_id text`, `recommended_operational_draft_types jsonb not null default '[]'`
- `approval_required boolean not null default false`, `explanation jsonb`
- `reviewed_by`, `reviewed_at`
- `created_at`, `updated_at`
- Unique: `(workspace_id, project_id, fingerprint)`. **Sin columnas `invoiced`/`closed`** — deliberado, ver §3.5.

### `playbook_closure_blockers` / `playbook_billing_blockers`
(misma forma, dos tablas para no mezclar dominios de facturación vs cierre en queries/RLS)
- `id uuid pk`, `assessment_id uuid not null references playbook_closure_billing_assessments(id) on delete cascade`
- `workspace_id`, `project_id` (denormalizados para RLS directo sin join)
- `blocker_type text not null`, `severity text`, `description text not null`
- `owner text`, `due_date date`
- `evidence_used jsonb`, `missing_evidence jsonb`
- `evidence_status text not null check (evidence_status in ('missing','requires_validation'))`
- `approval_required boolean not null default false`, `suggested_action text`
- `status text not null default 'open' check (status in ('open','reviewed'))`
- `related_checklist_item_id text`, `related_recommendation_id uuid references playbook_recommendations(id) on delete set null`
- `reviewed_by`, `reviewed_at`
- `created_at`, `updated_at`
- Unique: `(assessment_id, blocker_type, related_checklist_item_id)` como natural key (no fingerprint propio — el blocker ya está scoped 1:1 bajo su assessment).

### `playbook_audit_events`
- `id uuid pk`, `workspace_id`, `project_id`
- `fingerprint text not null`, `event_type text not null`, `actor_type text not null`, `actor_id uuid references auth.users(id) on delete set null`
- `related_entity_type text`, `related_entity_id uuid`
- `summary text not null`, `evidence_used jsonb not null default '[]'`, `missing_evidence jsonb not null default '[]'`
- `approval_required boolean not null default false`, `severity text`
- `metadata jsonb not null default '{}'`, `explanation jsonb`
- `platform_event_id uuid references platform_events(id) on delete set null` (poblado en Fase 5, tras materializar hacia el log global — evita duplicar el mismo evento hacia `platform_events` dos veces)
- `created_at timestamptz not null default now()` — **sin `updated_at`**, tabla append-only
- Unique: `(workspace_id, project_id, fingerprint)`. Sin políticas RLS de `update`/`delete` — trigger de inmutabilidad igual que `platform_events`.

### `playbook_constitution_drafts` (Fase 3+, pendiente confirmación — §8)
- `id uuid pk`, `workspace_id`, `project_id` — **unique `(workspace_id, project_id)`, una sola vigente por proyecto** (no historial multi-versión, se sobreescribe con las mismas reglas de field-level preservation)
- `playbook_id`, `playbook_version`, `status text` (estado global del draft, no confundir con field status)
- `fields jsonb not null default '{}'` — mapa `{ objective: {value, status, note}, scopeIn: {...}, ... }` (13 campos definidos en `ProjectConstitutionDraftField`)
- `converted_constitution_id uuid references project_constitutions(id) on delete set null` (poblado tras conversión real, Fase 7)
- `created_at`, `updated_at`

---

## 8. Platform events materialization

- **Cuándo un `PlaybookAuditEvent` se materializa como `platform_event`:** no en cada regeneración — solo la primera vez que un fingerprint de audit event se ve (mismo criterio de dedupe que ya usa `dedupePlaybookAuditEvents` en memoria, ahora contra lo persistido). Prácticamente: al insertar una fila nueva en `playbook_audit_events` (no al reafirmar una existente), disparar `createPlatformEvent()` una sola vez y guardar el `platform_event_id` resultante en la misma fila.
- **Cuáles eventos sí/no:** todos los `eventType` que ya representan una transición real observable (`snapshot_generated`, `recommendation_generated`, `recommendation_status_changed`, `communication_draft_generated`, etc.) — no materializar eventos puramente internos/derivables (si el engine llega a emitir alguno solo para debug interno).
- **Naming convention:** ya resuelto por el mapper existente — `PLAYBOOK_` + `UPPER_SNAKE(eventType)` como `event_type`, y `event_category` mapeado a `recommendation`/`governance` vía `EVENT_TYPE_TO_CATEGORY`. Mantener esa convención.
- **`learningEligible`:** el mapper actual lo fija en `false` siempre — correcto para Fase 5 (no queremos que el pipeline de aprendizaje consuma señales de un dominio todavía no validado en producción real); revisar en fases posteriores si algún tipo de evento amerita `true`.
- **Relación con snapshot/recommendation/draft:** vía `related_entity_type`/`related_entity_id`, ya presente en el shape actual — no requiere cambios.
- **Evitar duplicar eventos en cada regeneración:** el unique `(workspace_id, project_id, fingerprint)` en `playbook_audit_events` es la defensa; el paso hacia `platform_events` solo ocurre en el insert, nunca en un update.
- **⚠️ Riesgo detectado y a resolver antes de Fase 5:** existen dos migraciones de `platform_events` con columnas divergentes (`event_payload` vs `payload`, presencia/ausencia de `event_category`/`learning_eligible`) coexistiendo en `supabase/migrations/`. Antes de escribir hacia esa tabla desde el flujo del playbook, hay que confirmar cuál es el schema realmente vigente en la base de datos real (no solo en los archivos de migración) y, si hace falta, corregir la inconsistencia — esto es preexistente al playbook engine y no se soluciona en este diseño, pero bloquea la Fase 5.

---

## 9. UI contracts (view models, sin implementar)

| Pantalla | Endpoint (futuro) | Tabla(s)/vista | Acciones humanas permitidas | Bloqueado (no permitido) |
|---|---|---|---|---|
| **Project Brain** | `GET /api/playbook/projects/:id/snapshot` | `playbook_snapshots` (latest) + joins de conteos | Ver resumen, disparar regeneración manual | Editar contenido derivado directamente |
| **Playbook Recommendations** | `GET/PATCH /api/playbook/projects/:id/recommendations` | `playbook_recommendations` | `viewed`, `accepted`, `dismissed`, iniciar conversión a draft/task (marca `requires_approval`/`approved` si aplica) | `executed` sin pasar por `approved` cuando `approvalRequired=true`; cualquier ejecución real de la acción |
| **Comms Center** | `GET/PATCH /api/playbook/projects/:id/communication-drafts` | `playbook_communication_drafts` | `reviewed`, `approved`, `copied`, `sent_manually`, `discarded` (edición de subject/body mientras `draft`) | Envío automático real de emails/mensajes — siempre manual |
| **Operational Drafts** | `GET/PATCH/POST convert` `/api/playbook/projects/:id/operational-drafts` | `playbook_operational_drafts` | `reviewed`, `approved`, `discarded`; **acción de conversión explícita** hacia RAID/decision-governance (Fase 7) | Conversión automática sin aprobación humana previa |
| **Closure & Billing** | `GET/PATCH /api/playbook/projects/:id/closure-billing` | `playbook_closure_billing_assessments` + blockers | `reviewed` del assessment, `reviewed` por blocker individual | Marcar `invoiced`/`closed` — eso vive en el sistema de facturación/cierre real, fuera de este dominio |
| **Audit Trail** | `GET /api/playbook/projects/:id/audit-events` | `playbook_audit_events` | Solo lectura/filtrado | Cualquier edición — tabla inmutable |
| **Governance Snapshot Demo** | (sin cambios — sigue siendo in-memory, `demo-scenarios.ts`) | Ninguna — demo mode no toca DB | N/A | N/A — el modo demo se mantiene 100% in-memory a propósito |

---

## 10. API / service layer (firmas propuestas, sin implementar)

```
materializePlaybookGovernanceSnapshot(input: { workspaceId, projectId, snapshot: PlaybookGovernanceSnapshot, actorId? }): Promise<MaterializationResult>

listPlaybookRecommendations(workspaceId, projectId, filter?): Promise<PlaybookRecommendationRow[]>
updatePlaybookRecommendationStatus(id, workspaceId, toStatus, actorId): Promise<Result>   // valida transición vía recommendation-state.ts

listCommunicationDrafts(workspaceId, projectId, filter?): Promise<CommunicationDraftRow[]>
updateCommunicationDraftStatus(id, workspaceId, toStatus, actorId): Promise<Result>        // valida vía communication-state.ts

listOperationalDrafts(workspaceId, projectId, filter?): Promise<OperationalDraftRow[]>
convertOperationalDraft(id, workspaceId, actorId): Promise<Result>                         // Fase 7 — escribe en raid_items/constitutional_decisions

getClosureBillingAssessment(workspaceId, projectId): Promise<ClosureBillingAssessmentRow | null>
markBlockerReviewed(blockerId, workspaceId, actorId): Promise<Result>

listPlaybookAuditEvents(workspaceId, projectId, filter?): Promise<PlaybookAuditEventRow[]>
```

Todas las funciones de "update status" delegan la **validación de la transición** a las funciones puras ya existentes (`recommendation-state.ts`, `communication-state.ts`, `operational-intelligence-state.ts`, `closure-billing-state.ts`) — la capa DB nunca reimplementa la lógica de qué transiciones son válidas, solo persiste el resultado.

---

## 11. Seguridad y governance

- **Approval gates:** ya modelados en el engine (`approvalRequired`, `hasApprovalSensitiveActions`, `externalSendRequiresApproval`); la capa de persistencia debe **rechazar** (no solo ignorar) cualquier intento de `PATCH` que salte de `requires_approval` a `executed` sin pasar por `approved`, igual que hace `convertTaskDraftToExecutionTask` hoy (`failureClass: "invalid_transition"`).
- **No auto-execute:** ninguna función de materialización o de conversión (Fase 7) debe ejecutar la acción recomendada por sí sola — siempre requiere una llamada explícita iniciada por un humano vía API.
- **RLS:** mismo patrón `is_workspace_member(workspace_id)` en todas las tablas nuevas; sin política de `delete` en ninguna (soft-delete si hace falta, vía status `discarded`/`dismissed`, nunca borrado físico); `playbook_audit_events` sin `update`/`delete` en absoluto.
- **Workspace/project scoping:** FK compuesta `(project_id, workspace_id) references projects(id, workspace_id)` en las tablas raíz (snapshot, assessment) para evitar fugas cross-workspace, replicando el patrón visto en `constitutional_decisions`.
- **Auditabilidad:** toda transición de status relevante (recomendación, comm draft, operational draft, blocker) debería, además de actualizar la fila, insertar un `playbook_audit_events` correspondiente — igual que `recommended_action_decisions` acompaña a `recommended_actions`.
- **Preservar intención humana:** regla central de §4 — nunca sobreescribir contenido de una fila que salió de su estado inicial.
- **Evitar sobreescribir dismissed/approved/executed:** aplicar el mismo patrón `IMMUTABLE_STATUSES` de `task_drafts` a `playbook_recommendations`/`playbook_communication_drafts`/`playbook_operational_drafts`.
- **Relación con AOC boundaries:** se confirmó que `lint:aoc-boundaries` **no** es una regla general de capas — solo prohíbe importar `security/governance-runtime` fuera de un allowlist puntual. No hay hoy ningún lint que impida que `src/lib/playbook-engine` importe código de DB; la separación "lógica pura" es convención, no está enforced. **Recomendación:** si se quiere blindar esa separación al implementar la capa de materialización, añadir un lint check nuevo (siguiendo el estilo de `scripts/lint-aoc-boundaries.mjs`) que impida que `src/lib/playbook-engine/**` importe `@supabase/*` o cualquier cliente DB — así el engine permanece testeable/puro por construcción, no por disciplina. Esta es una decisión a tomar en Fase 1, no una migración.

---

## 12. Phased implementation plan

1. **Fase 1 — Tablas read-first + lint boundary.** Migraciones de `playbook_snapshots`, `playbook_recommendations`, `playbook_audit_events`. Añadir el lint de boundary (§11) para que `playbook-engine/` no pueda importar DB. Sin escritura desde producto todavía — solo migración + entradas en `database-contract.ts`.
2. **Fase 2 — Upsert snapshot + recommendations.** Implementar `materializePlaybookGovernanceSnapshot` (parcial: solo snapshot + recommendations + audit events), vía RPC transaccional. Sin UI.
3. **Fase 3 — Draft persistence.** Añadir `playbook_communication_drafts`, `playbook_operational_drafts`, `playbook_closure_billing_assessments` + blockers. Extender la función de materialización para cubrir las 6 tablas.
4. **Fase 4 — Status transitions.** Servicios `update*Status`/`markBlockerReviewed` con validación vía las funciones `*-state.ts` puras existentes.
5. **Fase 5 — Platform-events materialization.** Resolver primero la inconsistencia de schema de `platform_events` (§8); luego conectar `createPlatformEvent()` real desde el insert de `playbook_audit_events`.
6. **Fase 6 — UI integration.** Recién aquí se construyen las pantallas de §9, contra los endpoints/servicios ya estables.
7. **Fase 7 — Conversión real a RAID/decisions/tasks/constitution.** Última fase — conecta `playbook_operational_drafts`→`raid_items`/`constitutional_decisions`, `playbook_constitution_drafts`→`project_constitutions`, siempre como acción humana explícita, nunca automática.

Orden elegido por riesgo creciente: fases 1-2 son aditivas y no tocan ningún flujo existente; fase 5 es la más delicada (log global compartido); fase 7 es la que más se acerca a "acción real con consecuencias de negocio" y por eso va al final.

---

## 13. Riesgos

- **Duplicación con `recommended_actions`:** mitigado manteniendo dominios separados (§6); riesgo residual si en el futuro alguien intenta unificar las bandejas de UI sin unificar el modelo de datos — dejar explícito que son conceptualmente distintos.
- **Snapshot staleness:** mitigado con `is_latest`/`content_stale`, pero requiere que la UI realmente comunique el flag — riesgo de que se ignore en el diseño de pantallas.
- **Overwriting human decisions:** mitigado por la regla de §4; riesgo si alguna futura entidad no sigue el mismo patrón de "select-then-branch" y usa `ON CONFLICT DO UPDATE` sin distinguir status.
- **JSONB overuse:** mitigado evitando materializar `PlaybookRuleEvaluation` como tabla, y limitando JSONB a campos genuinamente variables (evidence lists, checklist, type_specific) — pero vigilar que no se agreguen más columnas JSONB "por si acaso" en fases posteriores.
- **Too many tables too early:** mitigado por el fasing (§12) — Fase 1 son solo 3 tablas.
- **Premature platform-event materialization:** mitigado poniéndolo en Fase 5, después de resolver la inconsistencia de schema existente.
- **Mismatch con futuro diseño de UI:** riesgo real — este documento propone view models basados en el diseño funcional actual del engine; si el diseño de UI final necesita agregaciones distintas (ej. una vista combinada snapshot+recomendaciones+drafts en un solo request), puede requerir una vista SQL adicional (`playbook_project_dashboard_view`) no cubierta aquí — se recomienda revisar wireframes de UI antes de Fase 6, no antes de Fase 1-3.
- **Schema `platform_events` inconsistente:** riesgo preexistente descubierto durante esta investigación (dos migraciones con distinto shape de columna) — no es parte de este diseño, pero bloquea Fase 5 y debería reportarse/resolverse independientemente.

---

## 14. Open questions / decisions needed

1. **`ProjectConstitutionDraft`:** ¿confirmar la tabla puente `playbook_constitution_drafts` separada de `project_constitutions`, o el usuario prefiere que el playbook engine escriba directamente campos "sugeridos" dentro de `project_constitutions` (p. ej. columna `suggested_fields jsonb`) para evitar una tabla más? Recomendación de este informe: tabla puente separada (§3.8), pero es una decisión de producto, no solo técnica.
2. **RPC transaccional vs best-effort:** ¿el equipo tiene apetito por añadir una función Postgres nueva (`materialize_playbook_snapshot`) siguiendo el patrón de `operational-flow-service.ts`, o prefiere el patrón "header + best-effort" de `program-materialization-service.ts` por simplicidad de mantenimiento, aceptando el riesgo de filas huérfanas en fallo parcial?
3. **Historial de snapshots:** ¿se necesita conservar snapshots históricos completos (para "ver cómo se veía el governance hace 2 semanas") o basta con 1 vigente + audit trail? Este diseño asume que el audit trail es suficiente y `playbook_snapshots` no necesita ser una tabla de historial pesada — confirmar.
4. **Lint de boundary nuevo (§11):** ¿se aprueba añadir un check de lint dedicado para blindar que `playbook-engine/` no importe DB, o se prefiere mantenerlo como convención de code review sin enforcement automático?
5. **Fix de `platform_events`:** la inconsistencia de schema detectada (§8, §13) — ¿se resuelve como trabajo independiente antes de que este proyecto llegue a Fase 5, o se aborda dentro del mismo esfuerzo?

---

**Fin del informe. No se ha modificado código de runtime, no se han creado migraciones, no se ha tocado UI. Pendiente confirmación del usuario antes de iniciar cualquier fase de implementación.**
