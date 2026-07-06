# Playbook Engine — Materialization Phase 2

> **Estado:** implementado. Ver `docs/playbook-engine-materialization-design.md` para el diseño completo de las 7 fases y `docs/playbook-engine-materialization-phase-1.md` para lo que Phase 1 construyó (`playbook_snapshots`, `playbook_recommendations`, `playbook_audit_events` + `materializePlaybookGovernanceSnapshot`). Este documento cubre únicamente lo que Phase 2 agrega: una capa de servicios de lectura + una de cambio de estado, ambas sobre las tablas ya existentes. **Sin migraciones nuevas** — Phase 2 no crea columnas ni tablas.

---

## 1. Qué se implementó

Cuatro archivos nuevos en `src/lib/playbook-engine/` (más una extensión de `materialization-types.ts`), y sus tests:

- **`materialization-types.ts`** (extendido) — se agregó `MaterializationQueryReadDbClient`/`MaterializationQueryReadBuilder`, un duck-type de solo lectura que soporta `select().eq().order()` y es él mismo *thenable* (awaitable directamente para un array), replicando cómo se comporta el `PostgrestFilterBuilder` real de `@supabase/supabase-js` — el mismo patrón ya usado en `src/lib/dashboard/persistent-snapshot-store/supabase-snapshot-store.ts`. Distinto del `MaterializationDbClient` de Phase 1 (mutación, fila única, sin `order`). También se amplió `MaterializationFailureClass` con `"not_found"` y `"governance_violation"` (alineado con `PlaybookEngineFailureClass` de `types.ts`).
- **`materialization-view-models.ts`** — tipos y mappers puros (fila DB → vista UI-ready) + `buildPlaybookProjectBrainView`, una función pura de agregación.
- **`materialization-query-service.ts`** — cuatro funciones de lectura (`listPlaybookSnapshots`, `getPlaybookSnapshot`, `listPlaybookRecommendations`, `listPlaybookAuditEvents`) más una función de composición (`getPlaybookProjectBrainView`).
- **`materialization-status-service.ts`** — `updatePlaybookRecommendationStatus`, la única función de Phase 2 que escribe (solo en `playbook_recommendations` y `playbook_audit_events`).
- **`tests/playbook-engine-materialization-phase-2.test.mjs`** — 32 tests, DB mockeada en memoria (mismo patrón de Phase 1).

El resto de `src/lib/playbook-engine/` (rules engine, recommendation engine, `recommendation-state.ts`, communication/operational/closure-billing engines, audit engine) **no se tocó**. `materialization-status-service.ts` reutiliza `recommendation-state.ts` tal cual — Phase 2 no reimplementa ni modifica el grafo de transiciones.

## 2. Query services (`materialization-query-service.ts`)

Las cuatro funciones de lectura comparten dos reglas:

1. **Scoping obligatorio**: cada una valida `workspaceId`/`projectId` no vacíos antes de tocar la DB y filtra siempre por ambos (`failureClass: "validation_failed"` si falta cualquiera).
2. **Paginación en memoria por cursor de `id`**: cada función trae su resultado filtrado completo (acotado por workspace+project) ordenado en la DB, y pagina en memoria — `cursor` es el `id` del último ítem de la página anterior; `nextCursor` es `null` cuando no hay más. No hay `OFFSET`/`LIMIT` real de SQL en Phase 2 (ver §6, "Por qué paginar en memoria").

| Función | Filtros | Orden | Nota |
|---|---|---|---|
| `listPlaybookSnapshots` | `status?` | `generated_at desc` | Nunca selecciona `snapshot_payload` ni `rules_summary` (los dos JSONB más pesados) — eso solo carga en el detalle. |
| `getPlaybookSnapshot` | `snapshotId?` o `fingerprint?` (si no se da ninguno, trae el más reciente) | — | Devuelve el snapshot completo + sus recomendaciones (`snapshot_id = snapshot.id`) + sus audit events (`snapshot_id = snapshot.id`). `failureClass: "not_found"` si no existe. |
| `listPlaybookRecommendations` | `snapshotId?`, `status?`, `severity?`, `approvalRequired?`, `contentStale?` | Prioridad compuesta (ver abajo) | El orden no es expresable como un solo `ORDER BY` SQL (severity/status son texto plano, no enums con orden natural), así que se re-ordena en memoria tras el fetch filtrado por DB. |
| `listPlaybookAuditEvents` | `snapshotId?`, `eventType?`, `relatedEntityType?`, `relatedEntityId?` | `created_at desc` | — |

**Orden de `listPlaybookRecommendations`** (de mayor a menor prioridad): `approvalRequired=true` primero → severidad (`critical` > `high` > `medium` > `low`) → status pendiente antes que status asentado (`new` > `viewed` > `requires_approval` > `accepted` > `approved` > `converted_to_task` > `converted_to_draft` > `dismissed` > `executed`) → `created_at desc` como desempate final.

**`getPlaybookProjectBrainView`** compone las tres funciones anteriores (snapshot más reciente + *todas* las recomendaciones del proyecto, no solo las del último snapshot + últimos N audit events) y llama al builder puro `buildPlaybookProjectBrainView`. Trae recomendaciones sin paginar (tope de seguridad de 5000) porque los conteos de `PlaybookProjectBrainView` se invalidarían si vinieran de una página parcial.

> Por qué "todas las recomendaciones del proyecto" y no solo las del último snapshot: una recomendación con estado humano preservado (`shouldPreserveHumanState`, Phase 1) conserva el `snapshot_id` del snapshot que la creó/refrescó por última vez mientras seguía en `'new'` — no el del snapshot más reciente. Filtrar solo por el último snapshot escondería recomendaciones que un humano todavía está trabajando activamente.

## 3. View models (`materialization-view-models.ts`)

Tipos: `PlaybookSnapshotListItemView`, `PlaybookSnapshotDetailView` (extiende al anterior + `rulesSummary`/`missingEvidenceSummary`/`approvalRequiredSummary`/`nextBestActions`/`demoSummary`/`recommendations`/`auditEvents`), `PlaybookRecommendationView`, `PlaybookAuditEventView`, `PlaybookProjectBrainView`.

Ninguna vista expone las columnas JSONB "crudas" del motor (`recommendation_payload`, `audit_payload`) — son detalle interno de persistencia, no algo que una UI necesite.

`buildPlaybookProjectBrainView(input)` es **puro** (no toca DB, se testea sin mocks) y calcula:

- `recommendationCountsByStatus` / `recommendationCountsBySeverity` — mapas siempre completos (cero-rellenados), nunca `undefined` en una clave.
- `approvalRequiredCount`, `staleRecommendationCount`.
- `missingEvidenceSummary` — unión deduplicada (`Set`) de `missingEvidence` de todas las recomendaciones recibidas.
- `nextBestActions` — pasado explícitamente por el caller (viene de `latestSnapshot.nextBestActions`, que la vista liviana de lista omite a propósito).
- `readOnlyWarnings` — **hardcoded**, nunca derivado de datos, para que no pueda desalinearse silenciosamente con lo que la capa de lectura realmente hace:
  - comm drafts todavía no persisten (viven en `snapshot_payload`)
  - operational drafts todavía no persisten (viven en `snapshot_payload`)
  - closure/billing assessments todavía no persisten (viven en `snapshot_payload`)
  - la materialización hacia `platform_events` sigue diferida
  - ninguna acción se ejecuta automáticamente

## 4. Status service (`materialization-status-service.ts`)

`updatePlaybookRecommendationStatus(input)` — único punto de escritura de Phase 2.

**Acciones soportadas** (mapeadas 1:1 a `recommendation-state.ts`, sin reimplementar el grafo):

| `action` | Función delegada | Timestamp que setea | `reviewed_by`/`approved_by` |
|---|---|---|---|
| `mark_viewed` | `markRecommendationViewed` | `viewed_at` | `reviewed_by` |
| `accept` | `acceptRecommendation` | `accepted_at` | `reviewed_by` |
| `dismiss` | `dismissRecommendation` | `dismissed_at` | `reviewed_by` |
| `require_approval` | `markRecommendationRequiresApproval` | — | `reviewed_by` |
| `approve` | `approveRecommendation` | `approved_at` | `approved_by` |
| `mark_converted_to_task` | `markRecommendationConvertedToTask` | — | `reviewed_by` |
| `mark_converted_to_draft` | `markRecommendationConvertedToDraft` | — | `reviewed_by` |
| `mark_executed` | **bloqueado, ver §5** | — | — |

**Qué columnas se tocan y cuáles nunca**: solo `status`, el timestamp correspondiente, `reviewed_by`/`approved_by`, y (vía el trigger existente) `updated_at`. **Nunca** `title`, `severity`, `evidence_used`, `suggested_actions`, `explanation`, `recommendation_payload`, ni `approval_required` — este servicio no puede relajar ni endurecer un approval gate, solo registrar decisiones bajo el gate que ya está persistido.

**Reconstrucción del objeto del motor**: para invocar las funciones puras de `recommendation-state.ts` (que esperan un `PlaybookRecommendation` completo), se reconstruye a partir de `recommendation_payload` (guardado por Phase 1 mientras la fila seguía en `'new'`) pero **sobreescribiendo `status`/`approvalRequired`/identidad desde la fila** — la fila, no el payload archivado, es la fuente de verdad del estado actual.

**Auditoría**: cada cambio de status exitoso inserta una fila en `playbook_audit_events` con `event_type: "recommendation_state_changed"`, `related_entity_type: "recommendation"`, `related_entity_id` = el `id` real de la recomendación, `actor_type: "user"`, y `metadata: { previousStatus, nextStatus, reason }`. El `fingerprint` de este evento es `sha256(recommendationId:previousStatus:nextStatus:actorId:reason:now)` — **distinto** del `fingerprint` que usa `auditRecommendationStateChanged` en `playbook-audit-engine.ts` (que solo hashea `fingerprint:fromStatus:toStatus`, pensado para el registro en tiempo de generación del motor, sin actor humano). Aquí la idempotencia debe considerar también *quién* decidió y *cuándo*, así que una llamada repetida con inputs idénticos (recomendación, acción, actor, motivo, `now`) deduplica en vez de insertar una segunda fila.

## 5. Por qué `mark_executed` está bloqueado

La consigna de Phase 2 era: *"si hay duda, bloquear `mark_executed`"*. Hay duda real: `markRecommendationExecuted` (en `recommendation-state.ts`) ya valida que una recomendación con `approvalRequired=true` debe estar en `approved` antes de poder marcarse `executed`, pero esa función es pura bookkeeping — asume que *"una ejecución real ya sucedió en otro lugar"*. Phase 2 no tiene ningún adaptador de ejecución real (eso es explícitamente una fase futura, fuera de todo lo enumerado en la sección de restricciones), así que exponer `mark_executed` aquí crearía una fila `executed` sin que nada real haya ocurrido — un registro de auditoría falso.

`updatePlaybookRecommendationStatus` rechaza `action: "mark_executed"` **antes de tocar la base de datos**, con `failureClass: "governance_violation"`. Ninguna fila puede llegar a `status: 'executed'` a través de este servicio. `executed` sigue siendo terminal en el grafo (`recommendation-state.ts`) y `dismissed` sigue sin salida — ambas garantías ya existían en Phase 1/el motor puro, Phase 2 solo se asegura de nunca ejercitar el camino hacia `executed`.

## 6. Decisiones de diseño

**Por qué paginar en memoria y no con `OFFSET`/`LIMIT` de SQL**: `listPlaybookRecommendations` necesita un orden compuesto (approval → severidad → status → fecha) que Postgres no puede expresar con un `ORDER BY` de una sola columna sobre texto plano sin agregar columnas de prioridad numérica o una vista SQL — ninguna de las dos está en el alcance de Phase 2 ("no migraciones nuevas salvo que sea absolutamente necesario"). Para mantener las cuatro funciones de lectura consistentes entre sí, las cuatro traen su resultado filtrado (acotado por workspace+project) y paginan con un cursor basado en `id` en memoria. Esto es correcto y suficientemente simple para el volumen de datos esperado en esta fase (recomendaciones/eventos por proyecto, no un log global); si el volumen creciera, una fase futura podría introducir una vista SQL con columnas de prioridad precalculadas.

**Por qué un `MaterializationQueryReadDbClient` separado del `MaterializationDbClient` de Phase 1**: el cliente de Phase 1 es deliberadamente angosto (fila única, sin `order`) porque `materialization-service.ts` solo hace upserts fila por fila. La capa de lectura necesita `order()` y resultados en array — ampliar el tipo de Phase 1 habría mezclado semánticas de mutación y lectura en una sola interfaz. Ambos tipos son satisfechos sin adaptador por un `SupabaseClient` real.

## 7. Qué NO se implementó (sigue igual que Phase 1, explícito)

- **UI** — cero componentes/rutas nuevas.
- **`playbook_communication_drafts` / `playbook_operational_drafts` / `playbook_closure_billing_assessments`** (+ blockers) — sus datos siguen viviendo únicamente en `playbook_snapshots.snapshot_payload` (jsonb).
- **`platform_events` real** — ningún archivo de Phase 2 lo referencia; sigue bloqueado por la divergencia de schema documentada en `docs/playbook-engine-materialization-design.md` §8.
- **Conversión real hacia RAID (`raid_items`), decision-governance (`constitutional_decisions`), `task_drafts`, o `recommended_actions`** — `mark_converted_to_task`/`mark_converted_to_draft` solo cambian el `status` de la fila; no crean ninguna entidad en esas tablas. Verificado en tests (`converted_to_task marks status only`, `converted_to_draft marks status only`).
- **Ejecución real de la acción recomendada** — `mark_executed` está bloqueado (ver §5); ninguna función de Phase 2 llama a nada fuera de `playbook_recommendations`/`playbook_audit_events`.
- **Auto-aprobación** — `approve` requiere una llamada explícita con un `actorId` humano; nada la dispara automáticamente.
- **Gmail/email** — no hay envío real, nunca lo hubo en el motor.

## 8. Tests

`tests/playbook-engine-materialization-phase-2.test.mjs` — 32 tests, mismo patrón de DB mockeada en memoria que Phase 1 (`tests/playbook-engine-materialization.test.mjs`), extendido para soportar `order()` y resolución como array (`then`) además de `select/eq/insert/update/maybeSingle/single`. Cubre: filtrado por workspace/project en las cuatro funciones de lectura, exclusión de `snapshot_payload` en la lista de snapshots, detalle de snapshot con recomendaciones+audit events, filtros de `listPlaybookRecommendations`/`listPlaybookAuditEvents`, el orden compuesto y su paginación por cursor, las nueve transiciones de `updatePlaybookRecommendationStatus` (incluyendo el approval gate, el bloqueo de `mark_executed`, y que `dismissed` nunca llega a `executed`), que cada cambio de estado crea exactamente un `playbook_audit_events` y nunca toca `platform_events`/`recommended_actions`/`task_drafts`/`raid_items`/`constitutional_decisions`, y los cálculos puros de `buildPlaybookProjectBrainView` (conteos, `staleRecommendationCount`, deduplicación de `missingEvidenceSummary`).

Verificación ejecutada: `npm run typecheck` limpio, `npm test` 8800/8800 passing, `npm run lint:aoc-boundaries` limpio, `npm run check:db-contract` limpio, `eslint` limpio sobre los archivos modificados/creados.

## 9. Próxima fase recomendada

**Fase 3** del documento de diseño original: persistencia de `playbook_communication_drafts`, `playbook_operational_drafts`, y `playbook_closure_billing_assessments` (+ blockers) — hoy solo viven dentro de `snapshot_payload`. Estas tres tablas seguirían el mismo patrón de Phase 1/2: mappers puros, servicio de materialización con preservación de estado humano, servicios de query/status análogos a los de este documento. Recién después de eso (Fase 4-5 del diseño original) tendría sentido abordar `platform_events` real y las conversiones hacia RAID/decisions/tasks — ambas siguen bloqueadas por las razones ya documentadas (§8 del diseño, §5 de este documento).
