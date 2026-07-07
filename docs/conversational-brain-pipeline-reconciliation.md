# Conversational Brain — Pipeline Reconciliation (Sprint 9R)

> **Estado:** documento de análisis únicamente. No se tocó producción, no se creó Context Resolver/Router/Composer nuevo, no se borró código. Ver `git log` — este sprint solo agrega este archivo.

## 0. Contexto

Durante Sprint 9 se descubrió que el repo ya tiene un pipeline conversacional completo y **en producción** (`src/lib/playbook-engine/conversation/`, Sprint 8 real, commit `253f6d1`), distinto del módulo nuevo creado en `src/lib/conversational-brain/` (branch `claude/sprint-9-intent-classifier-pq95u8`, commit `7e97c05`). Este documento resuelve esa duplicación con un gap analysis y un plan de consolidación — sin ejecutar todavía ninguna integración.

---

## 1. Pipeline actual (`src/lib/playbook-engine/conversation/`) — evidencia por archivo

| Archivo | Función |
|---|---|
| `types.ts` (173 líneas) | Todos los tipos del pipeline: `ConversationIntent` (union de 12 strings), `BrainRoute` (10 rutas), `ResponseMode`, `MissingContextItem` (10 valores), `IntentClassification`, `ContextResolution`, `BrainRoutingDecision`, `HandlerResult`, `ConversationalGatewayResult`. |
| `classifier/intentClassifier.rules.ts` (132 líneas) | `INTENT_PATTERNS`: reglas regex por intent con pesos libres (20-60, no una escala fija), `normalizeConversationText()` (strip acentos/¿¡), `detectConversationLanguage()`. |
| `classifier/intentClassifier.ts` (79 líneas) | `classifyConversationIntent(message: string)` → `{ intent, confidence, signals, language }`. Un solo string ganador por prioridad fija (`INTENT_PRIORITY`), sin familias ni subtipos. |
| `context/contextResolver.ts` (112 líneas) | `resolveConversationContext(intent, input)`: narrows `projectState` (unknown) a `ProjectContextFacts` solo si "parece" serlo (duck-typing con 14 keys de prueba, mínimo 8 hits), corre `generatePlaybookGovernanceSnapshot()` real cuando hay evidencia, calcula `missingContext` y un `confidence` 0-100 penalizado. |
| `context/missingContext.ts` (100 líneas) | `computeMissingContext()`: mapa `INTENT_CONTEXT_NEEDS` (intent → lista de `MissingContextItem` necesarios) contra `ProjectContextFacts`/metadata reales — **más granular que un solo "falta proyecto"**: distingue `stakeholder`, `requested_output`, `due_date`, `decision_owner`, `acceptance_status`, `billing_status`, `risk_evidence`, `blocked_milestone`, `last_communication`. |
| `router/brainRouter.ts` (53 líneas) | `routeConversation()`: mapa directo `DIRECT_ROUTES` (1 intent → 1 ruta), más fallback `WEAK_PM_SIGNAL` para `unknown` (vocabulario PM genérico → `general_pm_advisor`) y `unsupported` → `unsupported_handler`. |
| `composer/responseComposer.ts` + `responseTemplates.ts` | `composeConversationalResponse()`: junta headline+body+nextSteps+missingContext en texto final, promedia 3 confidences (classifier+resolver+handler) en un solo número final. |
| `handlers/*.ts` (10 archivos) | Un handler por ruta — ver tabla §1.2. Todos llaman a engines reales de Sprints 1-7 (`generatePlaybookGovernanceSnapshot`, recomendaciones, drafts operacionales, closure/billing assessment) cuando hay evidencia, y caen a guía genérica cuando no. |
| `gateway/conversationalBrainGateway.ts` (64 líneas) | `runConversationalBrainGateway(input)`: orquesta classifier → contextResolver → router → dispatch a handler → composer. Único entry point. |
| `demo/conversationalDemoScenarios.ts` | Escenarios demo reutilizando `PLAYBOOK_DEMO_SCENARIOS` (Sprint 7). |

### 1.1 Intents reconocidos hoy (12, plano, sin familias)

```
general_pm_advice, project_status_question, recommendation_request, risk_analysis,
communication_draft, closure_question, billing_question, governance_question,
audit_question, task_or_action_request, clarification, unsupported, unknown
```

### 1.2 Rutas y handlers (10)

| Intent | Route | Handler | Usa evidencia real de |
|---|---|---|---|
| `general_pm_advice` | `general_pm_advisor` | `generalPmAdvisor.ts` | nada (por diseño) — matching de tópicos hardcodeados |
| `project_status_question` | `project_status_handler` | `projectStatusHandler.ts` | `governanceSnapshot.rulesEvaluationSummary` (Sprint 1) |
| `recommendation_request` | `recommendation_handler` | `recommendationHandler.ts` | `governanceSnapshot.recommendations` (Sprint 3) |
| `risk_analysis` | `risk_handler` | `riskHandler.ts` | `governanceSnapshot.operationalDrafts` filtrado a `type === "risk"` (Sprint 5) — **no usa `IssueDraft`/`DependencyDraft`, que sí existen en el mismo array** |
| `communication_draft` | `communications_handler` | `communicationsHandler.ts` | `governanceSnapshot.communicationDrafts` (Sprint 4), 4 `templateHint` (`soft_follow_up`, `reception_request`, `billing_enablement_follow_up`, `decision_request`) |
| `closure_question` / `billing_question` | `closure_billing_handler` | `closureBillingHandler.ts` | `governanceSnapshot.closureBillingAssessment` (Sprint 6) — un solo handler, diferencia `isBilling` por parámetro |
| `governance_question` | `governance_handler` | `governanceHandler.ts` | `snapshot.approvalRequiredSummary` + `missingEvidenceSummary` (Sprint 7) |
| `audit_question` | `audit_handler` | `auditHandler.ts` | `snapshot.recommendations[].explanation.narrative` (Sprint 7), matching por keywords |
| `task_or_action_request` | `task_action_handler` | `taskActionHandler.ts` | ninguna — siempre devuelve el mismo genérico "necesito título/dueño/fecha" |
| `clarification` | `general_pm_advisor` (fallback, sin handler propio) | — | — |
| `unsupported` / `unknown` | `unsupported_handler` | `unsupportedHandler.ts` | ninguna — redirect fijo |

### 1.3 Wiring a producción

```
POST /api/command-center/chat (route.ts)
  → runConversationChat() (src/lib/command-center/conversation-chat.ts)
    → runConversationalBrainGateway() (playbook-engine barrel export)
```
Auth-gated (`getAuthUser`), sin LLM, sin persistencia. Consumido por el chat real del Command Center (`command-feed.tsx`, `command-center-layout.tsx`).

### 1.4 Cobertura de tests existente (741 líneas, 6 archivos)

`playbook-engine-conversation-{intent-classifier,context-resolver,brain-router,response-composer,gateway,demo-scenarios}.test.mjs` + `command-center-conversation-gateway-integration.test.mjs`.

---

## 2. Nuevo classifier (`src/lib/conversational-brain/`) — qué aporta

Módulo puro (786 líneas: types 142, patterns 119, classifier 232, explain 58, index 19, tests 216). Solo cubre **clasificación** — no tiene context resolver, router, composer ni handlers propios.

### 2.1 Familias/tipos nuevos

- **11 familias** vs. 12 intents planos de A — pero con **familia + tipo de 2 niveles**: cada familia real tiene 3-6 `ConversationIntentType` (ej. `closure_billing` → 5 subtipos: `billing_blocker_check`, `billing_readiness_check`, `closure_readiness_check`, `reception_status_check`, `acceptance_status_check`).
- **`decision_support`** es una familia **completamente nueva que A no tiene** — ni intent, ni ruta, ni handler. A no puede responder "¿qué decisión falta?" de forma diferenciada hoy.
- `risk_issue_dependency` unifica riesgo+issue+dependencia bajo una sola familia con 4 subtipos (`risk_check`, `issue_check`, `dependency_check`, `blocker_check`) — A solo tiene `risk_analysis` (sin subtipos, sin cubrir issues/dependencias explícitamente pese a que el dato ya existe).

### 2.2 Flags nuevos vs. equivalentes actuales en A

| Flag en B | ¿Existe en A? | Cómo lo aproxima A hoy |
|---|---|---|
| `requiresProjectContext` | No como flag único | Implícito: si el intent no está en `INTENT_CONTEXT_NEEDS` (solo `general_pm_advice`), se asume que necesita proyecto. Disperso, no declarativo. |
| `requiresEvidence` | No existe | Solo se observa post-hoc en `HandlerResult.sourced` (resultado, no predicción a priori). |
| `mayRequireApproval` | No como flag a priori | Cada handler calcula `requiresApproval` dinámicamente y distinto (a veces `true` fijo, a veces `.some(...)` sobre acciones concretas). |
| `isActionRequest` | No existe | Solo inferible por `route === "task_action_handler"`. |
| `isExternalCommunicationRequest` | No existe | Solo inferible por `route === "communications_handler"`. |
| `isReadOnly` | No existe | Ningún equivalente. |
| `candidateRoutes` | Parcial | A tiene un mapa 1:1 intent→route ya resuelto (`DIRECT_ROUTES`), no una lista de candidatos previos a resolver contexto — es un concepto de una etapa de pipeline posterior (Route Decision) que A no separa de la clasificación. |
| `missingClarifications` | **A es más rico aquí** | `computeMissingContext()` ya calcula 10 tipos posibles contra `ProjectContextFacts`/metadata reales; B solo tiene `missing_project` (deliberadamente mínimo, Sprint 9 no debía adelantar Context Resolver). |
| `confidence` (categórico) | Distinto | A expone un número crudo 0-100 (`IntentClassification.confidence`) sin categorías; B expone bucket (`high/medium/low/unknown`) + `score` numérico separado. |
| `score` | No separado | En A, "score" y "confidence" son el mismo número. |
| `rationale` | No existe | A no sintetiza una oración explicativa en el resultado de clasificación (el composer sí expone `routingReason`, pero es sobre el ruteo, no sobre por qué se eligió el intent). |
| `detectedSignals` | **Casi idéntico** | A ya tiene `IntentSignal[]` (`{ intent, matchedPattern, weight }`) — el campo más parecido entre ambos módulos, prácticamente un rename (`intent`→`family`, `matchedPattern`→`label`). |

---

## 3. Comparación intent-por-intent

| Intent actual (A) | Familia/tipo nuevo equivalente (B) | Gaps | Riesgo de migración | Recomendación |
|---|---|---|---|---|
| `general_pm_advice` | `general_pm_advice` (4 subtipos) | A tiene contenido real (`ADVICE_TOPICS` con 4 consejos hardcodeados); B solo clasifica, no aporta contenido. | Bajo — nombres 1:1. | Mapeo directo. |
| `project_status_question` | `project_status` (4 subtipos: summary/health/timeline/blockers) | El handler de A no distingue subtipos — siempre usa `rulesEvaluationSummary` sin importar si preguntan por timeline vs. blockers. | Medio — requiere branch nuevo en el handler para aprovechar el subtipo. | Adoptar `intentType` como hint opcional, no bloqueante. |
| `recommendation_request` | `playbook_analysis` (recommendation/rule_explanation/gap_analysis/governed_next_action) | Riesgo de solape: un mensaje tipo "según el playbook, ¿por qué recomendaste esto?" podría clasificar como `governance_audit` en B pero como `recommendation_request`/`audit_question` en A. | **Alto** — necesita tabla de desambiguación explícita antes de fusionar. | No es un rename directo; requiere diseño. |
| `risk_analysis` | `risk_issue_dependency` (risk/issue/dependency/blocker) | A **ya tiene** `IssueDraft`/`DependencyDraft` en `operational-intelligence-types.ts` (Sprint 5) pero `riskHandler.ts` solo filtra `type === "risk"` — capacidad no cableada, no un gap de clasificación. | Bajo agregar (aditivo). | Candidata a PR de producto independiente: extender el handler a issues/dependencias ya generadas. |
| `communication_draft` | `communication_draft` (6 subtipos) | A tiene 4 `templateHint`; B distingue 6 (agrega `meeting_minutes_request`, separa `escalation_draft_request`, `closure_communication_request`). | Bajo-medio. | Extender `pickTemplateHint` con los subtipos nuevos cuando se integre. |
| `closure_question` + `billing_question` | `closure_billing` (5 subtipos, una sola familia) | A ya trata ambos como una sola ruta (`closure_billing_handler` con flag `isBilling`) — coincide conceptualmente. B añade `reception_status_check`/`acceptance_status_check` que A no expone como preguntas independientes (solo como parte del assessment interno). | Medio. | Subtipos de B son mejora real; incorporar como branches del handler existente. |
| `governance_question` + `audit_question` | `governance_audit` (recommendation_explanation/audit_trail_request/evidence_request/why_recommended_request) | B **fusiona 2 handlers de A en 1 familia**. Esto es viable porque el `intentType` de B ya indica cuál de los 2 comportamientos de A aplica (`evidence_request`→governanceHandler-like, `why_recommended_request`→auditHandler-like). | Medio — fusionable si el router usa `(family, intentType)` en vez de solo `family`. | Punto de apalancamiento: usar el subtipo para rutear a uno u otro handler existente sin fusionar el código real todavía. |
| `task_or_action_request` | `task_action` (creation/update/execution/convert_recommendation) | `taskActionHandler.ts` es 100% genérico hoy — no distingue nada, y **no está conectado** a `markRecommendationConvertedToTask()` (ya existe en `recommendation-state.ts` desde Sprint 3). | Bajo agregar (aditivo). | Candidata a PR de producto: cablear `convert_recommendation_request` a la transición de estado ya existente. |
| `clarification` | `needs_clarification` | A rutea a `general_pm_advisor` (rama "tooShort"); B solo clasifica. | Bajo. | Mapeo directo. |
| `unsupported` | `unknown` (vía fallback, sin patrones explícitos de trivia) | **B no tiene lista de patrones off-topic** (capital de, clima, receta, mundial, chiste, horóscopo) — llega a `unknown` por ausencia de match, no por detección explícita. Funcionalmente el `candidateRoute` resultante es el mismo (`unsupported`), pero la confianza difiere (A: alta explícita; B: `"unknown"` por defecto). | Bajo funcionalmente, pero difiere en semántica de confidence. | Si se fusiona, portar la lista de trivia de A a B para no perder la señal explícita. |
| `unknown` | `unknown` / `needs_clarification` (heurística de conteo de palabras) | Heurísticas distintas pero compatibles. | Bajo. | Mapeo directo. |
| *(no existe)* | **`decision_support`** (nuevo) | A no tiene intent, ruta, ni handler para esto. El dato subyacente (`DecisionDraft`) **ya existe** en `operational-intelligence-engine.ts` (Sprint 5) y en el governance snapshot, solo no está expuesto conversacionalmente. | Bajo agregar (aditivo, dato ya existe). | Mejor candidata para un handler **nuevo** genuino (no reemplaza nada existente). |

---

## 4. Decisión de arquitectura — opciones evaluadas

**A. Evolucionar el classifier existente in-place.** Requiere cambiar el tipo `ConversationIntent` (string union) consumido por 10 handlers + router + `missingContext.ts` + composer + 6 archivos de test (741 líneas) ya en producción. Alto riesgo de romper el chat real en el mismo cambio. **No recomendado como próximo paso.**

**B. Mantener `conversational-brain/` como core puro y adaptar `playbook-engine/conversation/` para consumirlo.** Requiere construir Context Resolver + Router + Composer nuevos (fuera de alcance de este sprint) o un adapter que traduzca `ConversationIntent` (B) al `ConversationIntent`/`BrainRoute` (A) que ya consumen router/handlers. Es el destino técnico más alineado con la arquitectura objetivo (familias ↔ 7 dominios, flags declarativos), pero no es ejecutable de un salto.

**C. Mantener ambos temporalmente, con adapter explícito y deprecación planificada.** Cero riesgo de romper producción; permite iterar el classifier rico sin bloquear el chat real; deja un camino incremental hacia B.

**D. Revertir el módulo nuevo y portar solo las ideas al pipeline existente.** Descarta 786 líneas ya escritas y con 32 tests en verde para reimplementar las mismas ideas a mano dentro de A — más riesgo de introducir errores que adaptar el código ya probado.

## 5. Recomendación técnica

**Camino C ahora, con B como norte técnico.** Razones:

1. Los handlers de A contienen lógica de producto real y ya probada (llamadas a `generatePlaybookGovernanceSnapshot`, `recommendations`, `communicationDrafts`, `closureBillingAssessment`) que **no se debe reescribir** solo para cambiar de dónde viene el intent — el valor está en los handlers, no en el classifier.
2. El modelo de B (familias ↔ `CandidateRoute` con 7 dominios) calza con la arquitectura objetivo del bloque Conversational Brain descrita en Sprint 9 original — más que el modelo plano de A (10 rutas específicas por handler).
3. Fusionar directamente (Opción A) obliga a tocar 741 líneas de tests de producción en un solo cambio — contradice "no big refactor todavía".
4. Descartar B (Opción D) tira trabajo ya verificado por preferencia estética, sin beneficio real.

El plan de PRs de §6 mueve gradualmente hacia B sin nunca requerir un cambio atómico grande.

---

## 6. Plan de migración (PRs pequeños, ninguno ejecutado todavía)

| PR | Contenido | Toca producción |
|---|---|---|
| **PR 1** | Tipos compartidos + adapter puro: `mapLegacyIntentToStructuredIntent(legacy: LegacyConversationIntent) → Partial<ConversationIntent>` y `mapStructuredFamilyToLegacyIntent(family, type) → LegacyConversationIntent`. Sin wiring, solo funciones puras + tests. | No |
| **PR 2** | Extender `router/brainRouter.ts` para aceptar opcionalmente el resultado de B detrás de un feature flag (`USE_STRUCTURED_CLASSIFIER`, apagado por defecto) — el router sigue usando `DIRECT_ROUTES` de A como fallback siempre. | No (flag off) |
| **PR 3** | Nuevo handler para `decision_support` (usa `DecisionDraft` ya existente en `operational-intelligence-engine.ts`) — capacidad aditiva, sin tocar rutas existentes. | No hasta activarlo explícitamente |
| **PR 4** | Extender `riskHandler.ts` para incluir `IssueDraft`/`DependencyDraft` (dato ya generado, hoy filtrado fuera) — mejora aditiva de un handler existente. | Sí, pero aditivo/no-breaking (más contenido, mismo contrato `HandlerResult`) |
| **PR 5** | Cablear `convert_recommendation_request` (task_action) a `markRecommendationConvertedToTask()` ya existente. | Sí, aditivo |
| **PR 6** | Activar el feature flag `USE_STRUCTURED_CLASSIFIER` en un entorno de staging/demo, correr ambos pipelines en paralelo (shadow mode: B clasifica pero A sigue ruteando), comparar divergencias en logs. | No (shadow, no afecta respuesta real) |
| **PR 7** | Una vez validado el shadow mode, decidir si `router`/`missingContext` migran a usar `(family, intentType)` de B como fuente primaria, con A como legacy fallback. | Sí — este es el único PR que cambiaría el comportamiento real del chat, y solo después de PR 6 en verde. |
| **PR 8** | Deprecar `classifier/intentClassifier.ts` de A (marcar `@deprecated`, no borrar) una vez PR 7 esté estable en producción por un período de observación. | No (solo anotación) |

Ningún PR de esta lista requiere el Context Resolver/Router/Composer *nuevos* de B — todos reutilizan los ya existentes en A, que es justamente la lógica de negocio que no queremos duplicar.

---

## 7. Riesgos

- **Romper el chat en producción:** el único punto de riesgo real es PR 7 (cambiar qué clasifica el router). Mitigado por requerir shadow mode (PR 6) en verde primero.
- **Tener dos classifiers activos a la vez:** riesgo de confusión para quien toque el código después. Mitigado documentando explícitamente en ambos módulos (vía comentario/README) cuál es "legacy en producción" y cuál es "core futuro", y con este documento como fuente de verdad.
- **Imports cruzados:** hoy no hay ningún import entre `playbook-engine/conversation/` y `conversational-brain/` — deben mantenerse así hasta PR 1 (el adapter es el único punto de acoplamiento permitido, y debe vivir en un archivo propio, no mezclado dentro de ninguno de los dos módulos).
- **Tests duplicados:** ambos módulos ya tienen suites de tests que cubren escenarios conceptualmente similares (ej. "redactame un correo" está testeado en ambos). No fusionar los archivos de test todavía; el adapter (PR 1) necesita su propio archivo de test de mapeo bidireccional.
- **Naming conflict:** **ambos módulos exportan un tipo llamado `ConversationIntent`** con formas completamente distintas (A: string union; B: objeto estructurado). Si algún archivo futuro importa de ambos barrels sin alias, esto rompe en compilación. Acción recomendada antes de cualquier PR de integración: renombrar uno de los dos (sugerido: A conserva `ConversationIntent` por antigüedad/producción; B renombra su export a algo como `StructuredConversationIntent` en su próximo cambio, ya que B es el módulo no cableado a producción y tiene menor costo de rename).

## 8. Tests mínimos antes de conectar cualquier cosa a producción

1. **Adapter (PR 1):** para cada uno de los 12 intents legacy, test de ida (`legacy → structured family/type`) y vuelta (`structured → legacy`) — incluyendo los casos de fusión (`governance_question`+`audit_question` ambos deben mapear de vuelta correctamente según `intentType`).
2. **Paridad de clasificación:** correr el mismo corpus de mensajes (los ~30 casos ya cubiertos en `playbook-engine-conversation-intent-classifier.test.mjs` + `conversational-brain-intent-classifier.test.mjs`) contra ambos classifiers y afirmar que el adapter produce el mismo `BrainRoute` final que el classifier legacy ya produce hoy — este es el test de regresión que habilita PR 6 (shadow mode).
3. **Shadow-mode logging:** test de que activar el feature flag nunca cambia el `ConversationalGatewayResult` devuelto al usuario (solo agrega un log/diagnóstico interno) — condición de entrada para PR 6.
4. **Nuevo handler `decision_support` (PR 3):** tests aislados con y sin `governanceSnapshot`, igual que los demás handlers (nunca inventa evidencia, siempre aprobación humana si sugiere acción).
5. **Extensión de `riskHandler` (PR 4):** tests de que issues/dependencias ya presentes en `PLAYBOOK_DEMO_SCENARIOS` aparecen en la respuesta sin romper los tests existentes de riesgo puro.
6. **Naming-conflict guard:** un test simple que importe ambos barrels (`@/lib/playbook-engine` y `@/lib/conversational-brain`) en el mismo archivo y falle la compilación si hay colisión de nombres — sirve como red antes de habilitar el rename de §7.

---

## 9. Resumen ejecutivo

- **A (producción):** completo, cableado, con lógica de negocio real en los handlers; taxonomía de intents plana; sin flags declarativos; ya expone `missingContext` más rico que B.
- **B (nuevo):** solo clasificación, pero con taxonomía más rica (familias+tipos, flags declarativos, candidateRoutes) y una familia genuinamente nueva (`decision_support`) que A no tiene.
- **Recomendación:** Opción **C** ahora (coexistir con adapter, sin tocar producción), con Opción **B** como norte técnico de mediano plazo, ejecutado vía el plan de 8 PRs de §6 — ninguno de los cuales requiere Context Resolver/Router/Composer nuevos.
- **No se implementó ningún wiring en este sprint.** `POST /api/command-center/chat` no fue tocado. No se borró código de ninguno de los dos módulos.

---

## 10. Sprint 10R — Compatibility Adapter + Shadow Mode

> **Estado:** implementación del **PR 1** del plan de §6 (tipos compartidos + adapter puro) más una versión mínima de shadow mode (parte de PR 6, sin feature flag ni wiring a producción). Ver `git log` — este sprint agrega únicamente `src/lib/playbook-engine/conversation/classifier/intentCompatibilityAdapter.ts` y su test file; no modifica `intentClassifier.ts`, `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el endpoint, ni borra código.

### 10.1 Qué se creó

`src/lib/playbook-engine/conversation/classifier/intentCompatibilityAdapter.ts` — módulo puro, sin efectos secundarios, que expone:

- `mapEnrichedIntentToProductionIntent(enrichedIntent)` → `IntentCompatibilityResult` (`productionIntent`, `sourceFamily`, `sourceIntentType`, `mappingRule`, `warnings`). Traduce una clasificación enriquecida (`@/lib/conversational-brain`) al valor de `ConversationIntent` (string union) que ya consumen `router/brainRouter.ts` y los `handlers/*.ts` de producción.
- `compareProductionAndEnrichedIntent({ productionClassification, enrichedIntent })` → `IntentShadowComparison`. Función pura: recibe ambas clasificaciones ya calculadas y las compara — no ejecuta ningún classifier por sí misma.
- `runIntentClassifierShadowComparison(input, options?)` → `IntentShadowComparison`. Orquesta: corre `classifyConversationIntent` de producción (`intentClassifier.ts`) y el de `conversational-brain` sobre el mismo turno normalizado, mapea el resultado enriquecido, y delega en `compareProductionAndEnrichedIntent`. Es la única función "shadow mode" de este sprint.
- `explainIntentCompatibilityMapping()` → documentación programática de la tabla de mapping, qué no hace el adapter, y riesgos restantes (mismo patrón que `explainIntentClassifierCapability()` / `explainPlaybookEngineCapability()`).

Tipos nuevos (definidos en el mismo archivo, sin archivo de tipos separado dado el alcance acotado del sprint): `IntentCompatibilityResult`, `IntentMappingWarning`, `IntentShadowComparison`, `IntentCompatibilityMappingExplain`. Aliases explícitos para evitar el conflicto de nombres documentado en §7: `ProductionConversationIntent` (re-export del `ConversationIntent` de producción) y `EnrichedConversationIntent` (alias del `ConversationIntent` estructurado de `conversational-brain`). El archivo no se agregó al barrel `conversation/index.ts` — se importa directamente desde su ruta, precisamente para no forzar ese rename todavía.

### 10.2 Tabla de mapping (con decisiones documentadas)

| Familia/tipo enriquecido (B) | Intent de producción (A) | Regla |
|---|---|---|
| `general_pm_advice` | `general_pm_advice` | 1:1 directo |
| `project_status` | `project_status_question` | Mapeo directo de familia (el handler de A no distingue subtipos todavía) |
| `playbook_analysis` | `recommendation_request` | Mapeo directo; **riesgo documentado**: puede solapar con `governance_audit`/`audit_question` para mensajes tipo "¿por qué el playbook recomienda esto?" (ver §3, "Alto riesgo") |
| `risk_issue_dependency` | `risk_analysis` | Mapeo directo (A no distingue issue/dependency/blocker todavía) |
| `communication_draft` | `communication_draft` | Mapeo directo, independiente del subtipo |
| `closure_billing` + `billing_*` | `billing_question` | Match por prefijo en `intentType` |
| `closure_billing` + `closure_readiness_check` / `reception_status_check` / `acceptance_status_check` | `closure_question` | **Decisión documentada**: `reception_status_check`/`acceptance_status_check` no calzan literalmente con `billing_*`/`closure_*`; se tratan como parte del ciclo de cierre (no de facturación), igual que ya hace `closureBillingHandler.ts` |
| `governance_audit` + `audit_trail_request` / `recommendation_explanation` / `why_recommended_request` | `audit_question` | Match por subtipo |
| `governance_audit` + `evidence_request` (o subtipo no reconocido) | `governance_question` | Default documentado — el más conservador de los dos intents de A |
| `task_action` | `task_or_action_request` | Mapeo directo |
| `decision_support` | `unsupported` | **Decisión documentada**: A no tiene intent/ruta/handler para esto (ver §3/§6, PR 3); mapear a `governance_question` sugeriría falsamente una respuesta de evidencia/auditoría que A no puede dar hoy. `unsupported` es el default más seguro hasta que exista un handler dedicado. |
| `unknown` | `unsupported` | Default documentado. Nota: el *router* de A (`brainRouter.ts`) puede aún así recuperar `unknown` hacia `general_pm_advisor` vía `WEAK_PM_SIGNAL` — ese fallback vive en la capa de ruteo, no en la de clasificación, y a propósito no se reproduce aquí. |
| `needs_clarification` | `general_pm_advice` | **Decisión documentada**: el propio intent `clarification` de A ya rutea a `general_pm_advisor` (`DIRECT_ROUTES` en `brainRouter.ts`), así que mapear a `general_pm_advice` preserva esa equivalencia de comportamiento sin introducir un valor legacy nuevo. Se prefirió sobre `unsupported` porque sería un cambio de comportamiento más estricto que el fallback actual de A. |

### 10.3 Qué hace el adapter

- Traduce, de forma pura y determinística, una clasificación de `conversational-brain` al modelo de intents de producción.
- Corre ambos classifiers sobre el mismo mensaje y compara sus resultados (`runIntentClassifierShadowComparison`), devolviendo `productionIntent`, `enrichedIntent`, `mappedIntent`, `compatible`, `differences` y `migrationWarnings`.
- Documenta, en código (`explainIntentCompatibilityMapping()`) y en este archivo, cada decisión de mapping no obvia.

### 10.4 Qué NO hace el adapter (shadow mode no cambia producción)

- No reemplaza, llama, ni modifica `classifier/intentClassifier.ts` — sigue siendo la única fuente de verdad para `POST /api/command-center/chat`.
- No importa ni modifica `router/brainRouter.ts`, `composer/responseComposer.ts`, ni ningún `handlers/*.ts` (verificado también por test — ver §10.6).
- No toca `gateway/conversationalBrainGateway.ts` ni el endpoint `POST /api/command-center/chat`.
- No lee ni escribe base de datos, no llama Supabase, no hace `fetch`, no envía correos, no crea tareas ni RAID, no genera eventos de auditoría (verificado por test, mismo patrón que el test de pureza de Sprint 9).
- No activa el classifier enriquecido en producción — no existe ningún feature flag conectado a nada; `runIntentClassifierShadowComparison` solo se invoca desde sus propios tests en este sprint.
- No crea un Context Resolver, Router o Composer nuevos.

### 10.5 Criterios para un futuro PR de integración

1. Correr `runIntentClassifierShadowComparison` sobre el corpus combinado de `playbook-engine-conversation-intent-classifier.test.mjs` + `conversational-brain-intent-classifier.test.mjs` y confirmar una tasa de `compatible === true` estable y cercana al 100% antes de proponer cualquier cambio de router/handler.
2. Cualquier caso incompatible recurrente se resuelve ajustando la tabla de mapping de este adapter (no cambiando comportamiento de producción) hasta que se scope un PR de integración dedicado.
3. Conectar el classifier enriquecido al router real (plan de §6, PR 6/PR 7) requiere: feature flag apagado por defecto, y este shadow mode en verde en un ambiente de staging primero.
4. Antes de fusionar el naming (`ConversationIntent` de A vs. B), aplicar el rename recomendado en §7 (B → `StructuredConversationIntent`) para eliminar el riesgo de colisión — este adapter ya usa aliases explícitos (`ProductionConversationIntent`/`EnrichedConversationIntent`) como mitigación local mientras tanto.

### 10.6 Riesgos restantes

- El mapeo plano `playbook_analysis` → `recommendation_request` puede ocultar solapes reales con `governance_audit`/`audit_question` (riesgo ya identificado en §3, no resuelto por este sprint — requiere tabla de desambiguación por `intentType`, no solo por familia).
- `decision_support` no tiene ningún handler de producción: toda comparación shadow para esa familia reportará `mappedIntent = "unsupported"`, que hoy no tiene contenido real detrás (candidata a PR 3 de §6).
- El test suite de este adapter (`tests/playbook-engine-conversation-intent-compatibility.test.mjs`) es independiente de las suites de regresión de ambos classifiers — un futuro PR de integración debería correr ambos corpus contra el adapter juntos, no solo los casos nuevos de este sprint.
- El conflicto de nombres de tipos (`ConversationIntent` en A vs. B) descrito en §7 sigue sin resolverse a nivel de barrel exports; este adapter lo evita importando cada módulo con alias explícitos y sin agregarse al barrel de `conversation/index.ts`, pero el riesgo persiste para cualquier otro archivo futuro que importe ambos barrels sin alias.

---

## 11. Sprint 11R — Golden Intent Evaluation Set

> **Estado:** evaluación offline únicamente. Ver `git log` — este sprint agrega `tests/fixtures/conversational-brain-golden-intents.ts`, `src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation.ts`, su test file, y esta sección; no modifica `intentClassifier.ts`, `intentCompatibilityAdapter.ts`, `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el endpoint, ni activa ningún feature flag.

### 11.1 Propósito del corpus

El adapter de Sprint 10R (§10) puede comparar producción vs. enriquecido para un mensaje puntual, pero no había ninguna medición agregada de qué tan compatibles son ambos classifiers sobre frases realistas de un PM de PMFreak. El **golden corpus** (`tests/fixtures/conversational-brain-golden-intents.ts`) es un conjunto de 102 frases en español natural (y alguna mezcla de inglés/spanglish, como ya soportan ambos classifiers) que:

- Cubre las 10 categorías mínimas pedidas: `general_pm_advice`, `project_status`, `playbook_analysis`, `communication_draft`, `closure_billing`, `governance_audit`, `risk_issue_dependency`, `task_action`, `decision_support`, `ambiguous_or_unknown`.
- Registra `expectedProductionIntent`, `expectedEnrichedFamily` y `expectedMappedIntent` **capturados corriendo ambos classifiers de verdad** contra cada `input` al momento de escribir el corpus (no son valores adivinados) — esto convierte el corpus en una línea base de regresión: si un cambio futuro en cualquiera de los dos classifiers o en la tabla de mapping del adapter cambia el resultado, la evaluación lo reporta como *drift*, no lo oculta.
- Documenta con `notes` los casos no obvios: solapes reales de vocabulario entre familias (p. ej. `playbook_analysis` vs. `governance_audit` vs. `decision_support` cuando el mensaje menciona "recomendación"/"decisión"), y huecos de patrones donde un classifier reconoce una frase y el otro no.

### 11.2 Cómo correr la evaluación

```bash
npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs
```

Programáticamente:

```ts
import { runGoldenIntentEvaluation, summarizeGoldenIntentEvaluation } from
  "src/lib/playbook-engine/conversation/classifier/intentGoldenEvaluation";
import { GOLDEN_INTENT_CASES } from "tests/fixtures/conversational-brain-golden-intents";

const evaluation = runGoldenIntentEvaluation(GOLDEN_INTENT_CASES);
const report = summarizeGoldenIntentEvaluation(evaluation);
```

`runGoldenIntentEvaluation()` corre `runIntentClassifierShadowComparison()` (Sprint 10R) por cada caso — nunca llama al router, composer, handlers, DB, Supabase, ni ejecuta ninguna acción. `summarizeGoldenIntentEvaluation()` es puro: sólo reordena/resume el resultado ya calculado.

### 11.3 Métricas

- `totalCases`, `compatibleCount`, `incompatibleCount`, `compatibilityRate` (0-100, redondeado a 1 decimal): compatibilidad real observada (producción vs. mapeo del enriquecido) sobre el corpus completo.
- `expectedMappedIntentPassCount` / `expectedMappedIntentFailCount`: cuántos casos coinciden con lo que el corpus dice que *debería* salir hoy — un `FailCount > 0` es una señal de que el corpus quedó desactualizado respecto al código, no una falla del feature.
- `byCategory`: el mismo desglose por cada una de las 10 categorías.
- `warnings`: avisos deduplicados — warnings de severidad `caution` del adapter (p. ej. `decision_support_no_production_equivalent`) más avisos de *drift* si algún caso ya no coincide con su expectativa registrada.
- `topDifferences`: hasta 25 casos incompatibles, con el mensaje, el intent real de producción y el intent mapeado, para priorizar qué mirar primero.
- `summarizeGoldenIntentEvaluation()` agrega además: `incompatibleCases`, `casesWithWarnings`, `productionUnsupportedButEnrichedDetected` (producción no reconoce nada pero el enriquecido sí clasificó algo) y `enrichedUnknownButProductionDetected` (el enriquecido no reconoce nada pero producción sí).

### 11.4 Resultado obtenido en este sprint (baseline, no bloqueante)

Corriendo el corpus completo (102 casos) hoy:

| Categoría | Casos | Compatibles | compatibilityRate |
|---|---|---|---|
| communication_draft | 10 | 6 | 60% |
| task_action | 10 | 5 | 50% |
| governance_audit | 10 | 4 | 40% |
| closure_billing | 12 | 4 | 33.3% |
| general_pm_advice | 10 | 3 | 30% |
| risk_issue_dependency | 10 | 3 | 30% |
| playbook_analysis | 9 | 2 | 22.2% |
| project_status | 11 | 2 | 18.2% |
| decision_support | 10 | 0 | 0% |
| ambiguous_or_unknown | 10 | 0 | 0% |
| **Total** | **102** | **29** | **28.4%** |

`expectedMappedIntentPassCount = 102 / 102` — el corpus está al día con el código en el momento de este sprint (0 casos de *drift*).

Esta tasa global (28.4%) es un hallazgo real del sprint, no un error de captura: la mayoría de las divergencias vienen de que el classifier de producción (`intentClassifier.rules.ts`) tiene un vocabulario mucho más angosto y literal (por ejemplo, sólo reconoce "como va"/"estado del proyecto", no "que avance tenemos" ni "cual es el status") que el classifier enriquecido, cuyo vocabulario a su vez tampoco cubre todo lo que producción sí reconoce (p. ej. "atorado/estancado/no avanza", "nadie responde"). `decision_support` y `ambiguous_or_unknown` están en 0% por diseño: la primera no tiene intent de producción (documentado ya en §10.2), y la segunda mapea siempre a `general_pm_advice` mientras que producción distingue entre `clarification` y `unknown`.

### 11.5 Threshold bands (soft, documentado — no bloquea el PR)

| Banda | Rango | Significado |
|---|---|---|
| `staging_candidate` | `compatibilityRate >= 85%` | Candidato razonable para iniciar una captura de shadow mode en staging (Sprint 10R, PR 6). |
| `needs_adjustment` | `70% - 84%` | Requiere ajustar la tabla de mapping del adapter o los patrones de algún classifier antes de proponer un feature flag. |
| `not_ready` | `< 70%` | No integrar todavía — resolver las categorías con mayor incompatibilidad recurrente primero. |

Con 28.4%, el resultado de este sprint cae en `not_ready`. El test suite del corpus (`tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs`) **calcula y reporta** `thresholdBand`/`recommendation`, pero **no falla** por una tasa baja — sólo fallaría por un problema estructural (un caso que rompe la evaluación, un id duplicado, una categoría inválida, o *drift* de `expectedMappedIntent` respecto al comportamiento real).

### 11.6 Qué significa "compatible" y qué casos requieren revisión

- **Compatible** (`shouldBeCompatible: true` / `actual.compatible: true`): el intent de producción para ese mensaje ya es exactamente el mismo valor al que el adapter mapea la clasificación enriquecida. Estos casos son evidencia de que, para esa frase, activar el classifier enriquecido en el router (futuro, tras un feature flag) no cambiaría el comportamiento observable.
- **Requieren revisión** (`compatible: false`): no implica un bug — la mayoría de las veces refleja que uno de los dos classifiers tiene un patrón que el otro no tiene todavía (ver `notes` de casos como `ps-08`, `ps-09`, `pa-05`, `pa-09`, `ga-10`), o un solape de vocabulario documentado entre familias (`ga-07`, `ga-09`, `ta-03`). Estos son justamente los casos que `topDifferences` y `byCategory` priorizan para trabajo futuro de nivelación de patrones — no de router/handlers.

### 11.7 Criterio para pasar a Sprint 12R

1. Priorizar por `byCategory`: nivelar primero el vocabulario de las categorías con mayor brecha respecto al umbral de 85% y mayor volumen de tráfico real esperado (`project_status`, `playbook_analysis`, `closure_billing` son las de mayor caso de uso y hoy están entre las más bajas).
2. Cualquier ajuste de vocabulario debe hacerse en las listas de patrones de cada classifier (`intentClassifier.rules.ts` para producción, `intent-patterns.ts` para el enriquecido) o en la tabla de mapping del adapter — nunca cambiando router/composer/handlers todavía.
3. Repetir la evaluación después de cada ajuste y verificar que `compatibilityRate` sube y que `expectedMappedIntentFailCount` se mantiene en 0 (o se actualiza el corpus deliberadamente, documentando por qué cambió el valor esperado).
4. Sólo cuando el corpus alcance de forma estable la banda `staging_candidate` (>= 85%) tiene sentido retomar el PR 6 de §6 (shadow mode en staging) con este corpus como criterio de entrada.
5. `decision_support` y `ambiguous_or_unknown` seguirán en 0% mientras no exista handler de producción para `decision_support` (PR 3 de §6) y mientras producción no distinga `clarification` de `unknown` en el modelo enriquecido — ninguno de los dos es un blocker para elevar el resto de las categorías por separado.

---

## 12. Sprint 12R — Intent Vocabulary Calibration

> **Estado:** ajuste de vocabulario/patrones únicamente. Ver `git log` — este sprint modifica `intentClassifier.rules.ts` (producción) y `intent-patterns.ts` (enriquecido), actualiza los `expected*` de 15 casos del golden corpus que cambiaron de comportamiento real, agrega `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`, y esta sección; no modifica `intentCompatibilityAdapter.ts`, `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el endpoint, ni activa ningún feature flag.

### 12.1 Análisis de `topDifferences` (antes de tocar código)

Sobre el baseline de Sprint 11R (28.4%, `project_status` 18.2%, `playbook_analysis` 22.2%), cada mismatch de esas dos categorías se clasificó así:

**project_status (9 de 11 casos fallando):**

| Caso | Clasificación del mismatch |
|---|---|
| `ps-02`, `ps-03`, `ps-06`, `ps-10` | production classifier misses vocabulary (`estado de X`, `avance`, `status`, `salud`) |
| `ps-04`, `ps-11` | production classifier misses vocabulary (`atrasado(s)`) — `ps-04` además caía en el fallback de "clarification" por conteo de palabras al no matchear ningún patrón |
| `ps-05` | adapter mapping too coarse / vocabulario ambiguo entre familias — "bloqueos" matcheaba `risk_issue_dependency` en el enriquecido pero ningún patrón de producción, sin verdadero solape de diseño (ver 12.2) |
| `ps-08`, `ps-09` | enriched classifier misses vocabulary (`atorado/estancado/no avanza`, `nadie responde/contesta`) — producción ya los reconocía |

**playbook_analysis (7 de 9 casos fallando):**

| Caso | Clasificación del mismatch |
|---|---|
| `pa-01`, `pa-03`, `pa-07` | production classifier misses vocabulary (forma verbal "recomienda" en 3ª persona, "según el playbook", palabra suelta "playbook") |
| `pa-02` | production classifier misses vocabulary ("siguiente mejor acción" con frase distinta a la ya soportada "siguiente paso") |
| `pa-05` | enriched classifier misses vocabulary ("recomiendas", 2ª persona — producción ya lo reconocía) |
| `pa-09` | enriched classifier misses vocabulary ("sugieres" — producción ya lo reconocía) |
| `pa-04` | **true product gap** — "qué gap ve PMFreak" es coloquial y ninguno de los dos classifiers tiene vocabulario para él; no es un problema de nivelación, es un vacío real de producto (no atacado este sprint, por instrucción explícita). |

Ningún caso de las dos categorías prioritarias resultó ser "golden expectation questionable" — todos los `expected*` de Sprint 11R eran correctos para el código de ese momento; simplemente el código cambió deliberadamente en este sprint, así que sus `expected*` se actualizaron para reflejar el nuevo comportamiento real (documentado caso por caso con una nota "Sprint 12R calibration" en el fixture).

### 12.2 Ajustes de patrones aplicados

**Producción — `src/lib/playbook-engine/conversation/classifier/intentClassifier.rules.ts`:**

- `project_status_question`: se agregaron 7 patrones acotados — `estado de <referencia>` (con lookahead negativo que excluye `estado de esta/la/una/dicha tarea`, para no secuestrar frases de `task_action`), `avance tenemos|avance del proyecto`, `\bstatus\b`, `atrasad[oa]s?`, `\bbloqueos\b`, `health|salud (del )?proyecto`, `timeline|cronograma`.
- `recommendation_request`: se amplió el patrón existente de `que (?:me )?recomiendas` a `que (?:me |nos )?recomienda(?:s)?` (acepta 3ª persona y "nos"), y se agregaron `siguiente mejor accion`, `segun el playbook`, `\bplaybook\b`.

**Enriquecido — `src/lib/conversational-brain/intent-patterns.ts`:**

- `project_status`: se portaron dos patrones que producción ya tenía (`atorado|estancado|no avanza`, `nadie (responde|contesta)`), y se agregó `\bbloqueos\b` (forma plural, distinta del patrón `bloqueado` ya existente).
- `playbook_analysis`: se amplió el patrón existente `(que recomienda|recomendacion)` a `(que (?:me |nos )?recomienda(?:s)?|recomendacion)` (acepta 2ª persona), y se agregó `que sugieres`.

**Mapping del adapter (`intentCompatibilityAdapter.ts`):** sin cambios — la tabla de mapeo ya era correcta 1:1 para ambas categorías (`project_status` → `project_status_question`, `playbook_analysis` → `recommendation_request`); el problema nunca fue el mapeo, sino que cada classifier tenía vocabulario que el otro no tenía.

**Riesgo de colisión verificado:** cada patrón nuevo se validó contra los 102 casos del corpus completo antes de aplicarse. El único riesgo real detectado fue la palabra "estado" (aparece también en `ta-09`, `task_action`) y "avance" (aparece también en `ds-05`/`rid-08`); se resolvió con un lookahead negativo para "estado de" y restringiendo el patrón de "avance" a la frase exacta `avance tenemos|avance del proyecto` (en vez de una palabra suelta), evitando que producción reclasifique mensajes de otras categorías.

### 12.3 Resultado — antes / después

| Métrica | Sprint 11R | Sprint 12R | Δ |
|---|---|---|---|
| `compatibilityRate` global | 28.4% (29/102) | **43.1% (44/102)** | **+14.7 puntos** |
| `project_status` | 18.2% (2/11) | **100% (11/11)** | +81.8 puntos |
| `playbook_analysis` | 22.2% (2/9) | **88.9% (8/9)** | +66.7 puntos |
| `thresholdBand` | `not_ready` | `not_ready` | sin cambio de banda (sigue por debajo de 70%) |

Desglose completo por categoría después de este sprint:

| Categoría | Casos | Compatibles | compatibilityRate | Cambio vs. Sprint 11R |
|---|---|---|---|---|
| project_status | 11 | 11 | **100%** | +81.8 pts |
| playbook_analysis | 9 | 8 | **88.9%** | +66.7 pts |
| communication_draft | 10 | 6 | 60% | sin cambio |
| task_action | 10 | 5 | 50% | sin cambio |
| governance_audit | 10 | 4 | 40% | sin cambio |
| closure_billing | 12 | 4 | 33.3% | sin cambio |
| general_pm_advice | 10 | 3 | 30% | sin cambio |
| risk_issue_dependency | 10 | 3 | 30% | sin cambio |
| decision_support | 10 | 0 | 0% | sin cambio (fuera de alcance) |
| ambiguous_or_unknown | 10 | 0 | 0% | sin cambio (fuera de alcance) |

`expectedMappedIntentFailCount = 0` — el corpus quedó al día con el código después de actualizar los 15 casos afectados (`ps-02,03,04,05,06,08,09,10,11`, `pa-01,02,03,05,07,09`).

### 12.4 `topDifferences` restante en las categorías priorizadas

- `pa-04` ("qué gap ve PMFreak"): único mismatch restante de `playbook_analysis` — vocabulario coloquial que ningún classifier reconoce, documentado como *true product gap*, no atacado por instrucción explícita de este sprint.
- `project_status`: sin mismatches restantes (100%).

### 12.5 Protección contra regresiones

- `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (nuevo): verifica explícitamente que las frases antes fallidas de `project_status` y `playbook_analysis` ahora clasifican correctamente en ambos classifiers, que el lookahead de "estado de" no secuestra una frase de `task_action`, que el patrón ampliado de recomendación no matchea `decision_support`/`general_pm_advice`, y que `communication_draft`, `closure_billing`, `task_action` y `governance_audit` siguen clasificando igual que antes.
- El mismo archivo fija *floors* de `compatibilityRate` por categoría (project_status ≥ 90%, playbook_analysis ≥ 80%, y un piso de no-regresión para cada categoría no tocada este sprint, igual a su valor de Sprint 11R) y un piso global de 28.4% — si un cambio futuro degrada cualquiera de estos, el test falla.
- Las 113 pruebas ya existentes de `playbook-engine/conversation/*` y `conversational-brain-intent-classifier` siguen pasando sin cambios.

### 12.6 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — 21/21 ok.
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — 18/18 ok.
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (sin cambios de comportamiento fuera de lo documentado).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (nuevo) — 13/13 ok.
- Resto de tests de `playbook-engine/conversation/*` (brain-router, response-composer, gateway, context-resolver, demo-scenarios, intent-classifier) — 147/147 ok en conjunto.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados (paquetes faltantes: `react`, `stripe`, `@supabase/*`, `@types/node`); cero errores nuevos en los archivos tocados este sprint.

### 12.7 Recomendación para el siguiente sprint

1. `closure_billing` (33.3%, 12 casos, la categoría con más volumen del corpus) es la candidata más clara para la próxima ronda de nivelación — varios de sus mismatches son de la misma naturaleza (producción no reconoce frases genéricas como "qué falta para X", "estamos listos para X").
2. `governance_audit` (40%) y `risk_issue_dependency` (30%) tienen el mismo patrón de causa raíz (vocabulario asimétrico entre ambos classifiers) y se benefician de la misma técnica de nivelación bidireccional usada en este sprint.
3. `general_pm_advice` (30%) probablemente requiera revisar primero si hay solapes de diseño con `playbook_analysis`/`decision_support` (ver `gpa-02` en el corpus) antes de sólo agregar vocabulario, ya que ahí el problema puede ser de familia, no de patrón.
4. `decision_support` y `ambiguous_or_unknown` siguen fuera de alcance de nivelación de vocabulario — requieren decisiones de arquitectura/producto (handler nuevo y distinción `clarification`/`unknown` en el modelo enriquecido, respectivamente) antes de que tenga sentido tocar sus patrones.
5. Sólo cuando el `compatibilityRate` global se acerque de forma sostenida a la banda `staging_candidate` (≥ 85%) tiene sentido retomar el PR 6 de §6 (shadow mode en staging).

---

## 13. Sprint 13R — Closure/Billing Vocabulary Calibration

> **Estado:** ajuste de vocabulario/patrones únicamente. Ver `git log` — este sprint modifica solo `intentClassifier.rules.ts` (producción), actualiza los `expected*` de 8 casos `closure_billing` del golden corpus que cambiaron de comportamiento real, agrega una sección `closure_billing` a `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`, y esta sección; no modifica `intent-patterns.ts` (enriquecido), `intentCompatibilityAdapter.ts`, `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el endpoint, ni activa ningún feature flag.

### 13.1 Análisis de `closure_billing` (antes de tocar código)

Sobre el baseline de Sprint 12R (`closure_billing` 33.3%, 4/12), se corrió la evaluación completa y se examinaron los 12 resultados caso por caso. Hallazgo clave: en **los 8 casos incompatibles, el classifier enriquecido (`closure_billing` family) ya clasificaba y mapeaba correctamente** — el `mappedIntent` ya coincidía con el `expectedMappedIntent` del corpus en el 100% de los casos. El único lado con vocabulario faltante era producción (`intentClassifier.rules.ts`):

| Caso | Frase | Clasificación del mismatch |
|---|---|---|
| `cb-01` | "qué falta para facturar" | production classifier misses vocabulary (patrón de bloqueo de facturación) |
| `cb-02` | "estamos listos para cobrar" | production classifier misses vocabulary ("cobrar" no cubierto por el patrón existente "listos para facturar") |
| `cb-03` | "qué nos falta para la recepción definitiva" | production classifier misses vocabulary (sin ningún patrón para "recepción") |
| `cb-06` | "preparame el seguimiento para recepción" | production classifier misses vocabulary ("recepción") — **communication_draft collision risk evaluado y descartado**: la frase no contiene "correo"/"redacta"/"escribe", así que ningún patrón de `communication_draft` la reclama; queda correctamente en `closure_question` (documentado ya en el `notes` del caso desde Sprint 11R) |
| `cb-08` | "estamos listos para la recepción definitiva" | production classifier misses vocabulary ("recepción definitiva") |
| `cb-09` | "qué falta para el cierre" | production classifier misses vocabulary (sin patrón para "cierre" como sustantivo) |
| `cb-10` | "ya podemos cobrar honorarios" | production classifier misses vocabulary ("cobrar" no cubierto por "podemos facturar") |
| `cb-11` | "el cliente ya firmó el acta de aceptación" | production classifier misses vocabulary ("acta"/"aceptación") |

Ningún caso resultó ser *adapter mapping too coarse*, *golden expectation questionable*, ni *true product gap* — los 8 eran, de forma consistente, el mismo patrón de causa raíz que `governance_audit`/`risk_issue_dependency` (vocabulario asimétrico), ya anticipado en la recomendación de Sprint 12R (§12.7.1).

**Riesgo de colisión con `communication_draft` (prioridad #2 del sprint):** antes de tocar código se grepeó el corpus completo (102 casos) por las palabras nuevas a introducir (`facturar`, `facturación`, `cobrar`, `cobro`, `cobranza`, `recepción`, `acta`, `aceptación`, `cierre`, `honorarios`) fuera de las categorías `closure_billing`/`communication_draft`: cero coincidencias. Dentro de `communication_draft`, solo dos casos comparten vocabulario (`cd-01` "redactame un correo para pedir recepción" contiene "recepción"; `cd-08` "redactame un correo de cierre para el cliente" contiene "cierre"), y en ambos el score de `communication_draft` (45 de `redacta(me)` + 25 de `correo (para|de)` = 70) es muy superior al de cualquier patrón nuevo de `closure_billing` (bare word, peso 20) — verificado con la evaluación completa después del cambio, sin regresión.

### 13.2 Ajustes de patrones aplicados

**Producción — `src/lib/playbook-engine/conversation/classifier/intentClassifier.rules.ts`** (único archivo tocado):

- `billing_question`: se amplió `(?:ya )?podemos facturar` a `(?:ya )?podemos (?:facturar|cobrar)`, y `listos? para facturar` a `listos? para (?:cobrar|facturar)`; se agregaron `que (?:nos |le )?falta para (?:facturar|cobrar)`, `pendiente para (?:facturar|cobrar)`, y la palabra suelta `\b(?:cobrar|cobro|cobranza)\b` (peso 20, igual que la ya existente `facturaci[o]?n`).
- `closure_question`: se agregaron `que (?:nos |le )?falta para (?:el cierre|la recepcion|la aceptacion)`, `pendiente para (?:cierre|recepcion|aceptacion)`, `recepcion definitiva`, `acta de (?:recepcion|aceptacion)`, `cierre (?:administrativo|tecnico|contractual)`, `cerrar formalmente|dar por cerrado`, y las palabras sueltas `\brecepcion\b`, `\b(?:acta|aceptacion)\b`, `\bcierre\b` (todas a peso 20, por debajo de cualquier señal de `communication_draft`).

**Enriquecido — `src/lib/conversational-brain/intent-patterns.ts`:** sin cambios. La familia `closure_billing` ya cubría el 100% del vocabulario objetivo de este sprint (verificado antes de tocar código — ver §13.1).

**Mapping del adapter (`intentCompatibilityAdapter.ts`):** sin cambios — el mapeo `billing_*` → `billing_question` / resto → `closure_question` ya era correcto; el problema nunca fue el mapeo.

**Colisiones evitadas:** ver §13.1. Ninguna de las palabras nuevas aparece en `governance_audit`, `risk_issue_dependency`, `task_action`, `project_status`, `playbook_analysis`, `decision_support`, `general_pm_advice` ni `ambiguous_or_unknown` en el corpus; los dos casos de `communication_draft` con vocabulario compartido (`cd-01`, `cd-08`) se protegen por margen de score (70 vs. 20), no por exclusión léxica, y quedan cubiertos por test de regresión explícito (§13.5).

### 13.3 Resultado — antes / después

| Métrica | Sprint 12R | Sprint 13R | Δ |
|---|---|---|---|
| `compatibilityRate` global | 43.1% (44/102) | **51% (52/102)** | **+7.9 puntos** |
| `closure_billing` | 33.3% (4/12) | **100% (12/12)** | +66.7 puntos |
| `communication_draft` | 60% (6/10) | **60% (6/10)** | sin cambio (protegido) |
| `project_status` | 100% (11/11) | **100% (11/11)** | sin cambio (protegido) |
| `playbook_analysis` | 88.9% (8/9) | **88.9% (8/9)** | sin cambio (protegido) |
| `thresholdBand` | `not_ready` | `not_ready` | sin cambio de banda (sigue por debajo de 70%) |

Desglose completo por categoría después de este sprint:

| Categoría | Casos | Compatibles | compatibilityRate | Cambio vs. Sprint 12R |
|---|---|---|---|---|
| project_status | 11 | 11 | **100%** | sin cambio |
| closure_billing | 12 | 12 | **100%** | +66.7 pts |
| playbook_analysis | 9 | 8 | **88.9%** | sin cambio |
| communication_draft | 10 | 6 | 60% | sin cambio |
| task_action | 10 | 5 | 50% | sin cambio |
| governance_audit | 10 | 4 | 40% | sin cambio |
| general_pm_advice | 10 | 3 | 30% | sin cambio |
| risk_issue_dependency | 10 | 3 | 30% | sin cambio |
| decision_support | 10 | 0 | 0% | sin cambio (fuera de alcance) |
| ambiguous_or_unknown | 10 | 0 | 0% | sin cambio (fuera de alcance) |

`expectedMappedIntentFailCount = 0` — el corpus quedó al día con el código después de actualizar los 8 casos afectados (`cb-01,02,03,06,08,09,10,11`), cada uno con una nota "Sprint 13R calibration".

### 13.4 `topDifferences` restante

`closure_billing` queda en 100% (0 mismatches restantes). Las categorías con mayor brecha ahora son `decision_support` (0%, fuera de alcance por diseño), `ambiguous_or_unknown` (0%, fuera de alcance por diseño), `general_pm_advice` y `risk_issue_dependency` (30% cada una), y `governance_audit` (40%) — los mismos candidatos ya señalados por la recomendación de Sprint 12R (§12.7.2/.3), sin cambios este sprint por estar fuera de su alcance explícito.

### 13.5 Protección contra regresiones

- `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`: se agregó una sección `closure_billing` que verifica (a) las 4 frases de facturación y las 9 frases de cierre/recepción/aceptación antes fallidas ahora clasifican como `billing_question`/`closure_question` en producción; (b) `redactame un correo para pedir recepción` y `redactame un correo de cierre para el cliente` siguen clasificando como `communication_draft` pese a compartir vocabulario nuevo con `closure_billing`; (c) `ayudame a responder este correo` y `preparame una minuta` (sin vocabulario de cierre) no se ven afectadas, y el classifier enriquecido las sigue clasificando como `communication_draft`; (d) un piso de `closure_billing` ≥ 70% junto con los pisos exactos de `project_status` (100%), `playbook_analysis` (≥ 88.9%) y `communication_draft` (≥ 60%) en el mismo test.
- Los pisos por categoría de Sprint 12R (`project_status` ≥ 90%, `playbook_analysis` ≥ 80%, piso de no-regresión por categoría, piso global 28.4%) permanecen sin cambios y siguen pasando.
- Las 147 pruebas ya existentes de `playbook-engine/conversation/*` y `conversational-brain-intent-classifier` siguen pasando sin cambios de comportamiento fuera de lo documentado.

### 13.6 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok.
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok.
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (sin cambios, el archivo tocado no es `intent-patterns.ts`).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (actualizado, +5 tests nuevos) — ok.
- `npx tsx --test tests/playbook-engine-conversation-intent-classifier.test.mjs` — ok.
- Resto de tests de `playbook-engine/conversation/*` (brain-router, response-composer, gateway, context-resolver, demo-scenarios) + `command-center-conversation-gateway-integration` — 57/57 ok en conjunto.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados (paquetes faltantes en este entorno: `react`, `stripe`, `@supabase/*`, `next/*`, `@types/node`); cero errores nuevos en `intentClassifier.rules.ts` o cualquier otro archivo tocado este sprint (verificado con `grep` del output de typecheck sobre los nombres de archivo modificados).

### 13.7 Recomendación para el siguiente sprint

1. `governance_audit` (40%), `risk_issue_dependency` (30%) y `general_pm_advice` (30%) siguen siendo los candidatos de mayor volumen con el mismo patrón de causa raíz (vocabulario asimétrico bidireccional) — aplican la misma técnica usada en Sprint 12R/13R.
2. `general_pm_advice` probablemente tenga, además de vocabulario faltante, solapes de diseño reales con `playbook_analysis`/`decision_support` (ver `gpa-02`, `gpa-08` en el corpus) — revisar eso antes de solo agregar patrones, igual que se señaló en Sprint 12R (§12.7.3).
3. `decision_support` y `ambiguous_or_unknown` siguen fuera de alcance de nivelación de vocabulario — requieren decisiones de arquitectura/producto (handler nuevo y distinción `clarification`/`unknown` en el modelo enriquecido, respectivamente).

## 14. Sprint 14R — Governance/Audit & Risk/Issue/Dependency Vocabulary Calibration

> **Estado:** ajuste de vocabulario/patrones únicamente. Este sprint modifica `intentClassifier.rules.ts` (producción) y `intent-patterns.ts` (enriquecido), actualiza los `expected*` de 12 casos (`governance_audit` ×5, `risk_issue_dependency` ×7) del golden corpus que cambiaron de comportamiento real, agrega secciones `governance_audit` y `risk_issue_dependency` a `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`, y esta sección; no modifica `intentCompatibilityAdapter.ts` (la tabla de mapping ya cubría todos los subtipos necesarios), `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el endpoint, ni activa ningún feature flag.

### 14.1 Análisis de `governance_audit` (antes de tocar código)

Sobre el baseline de Sprint 13R (`governance_audit` 40%, 4/10), se corrió la evaluación completa y se examinaron los 10 resultados caso por caso:

| Caso | Frase | Clasificación del mismatch |
|---|---|---|
| `ga-02` | "qué evidencia usaste" | production classifier misses vocabulary (sin patrón bare "evidencia"; el enriquecido ya lo tenía) |
| `ga-03` | "mostrame el audit trail" | production classifier misses vocabulary (sin patrón "audit trail"; el enriquecido ya matcheaba vía "audit" bare) |
| `ga-04` | "qué regla aplicó" | production classifier misses vocabulary (el enriquecido ya mapea "que regla" → `recommendation_explanation` → `audit_question` vía el adapter existente) |
| `ga-05` | "quién aprobó esto" | production classifier misses vocabulary (el enriquecido ya tenía "quien aprobo" → `audit_trail_request` → `audit_question`) |
| `ga-09` | "qué trazabilidad tiene esta decisión" | **golden expectation questionable / audit vs. decision_support overlap** — ya documentado desde Sprint 11R: "decisión" pesa más que "trazabilidad" en el enriquecido y cae en `decision_support`, familia sin equivalente productivo. Fuera de alcance (requiere decisión de arquitectura sobre `decision_support`, explícitamente no tocar este sprint). |
| `ga-10` | "hay aprobaciones pendientes" | enriched classifier misses vocabulary (producción ya tenía "aprobaciones? pendientes?"; el enriquecido no tenía ningún patrón y caía a `needs_clarification`) |

Solo `ga-09` queda fuera de alcance por diseño; los otros 5 casos eran vocabulario asimétrico resoluble sin tocar el adapter ni ninguna ruta.

**Riesgo de colisión evaluado:** se grepeó el corpus completo (102 casos) por las palabras nuevas (`evidencia`, `auditoria`, `bitacora`, `historial`, `criterio`, `fundamento`, `basado en`, `regla`, `aprobo`, `justificacion`) fuera de `governance_audit`: cero coincidencias, salvo `ga-04`/`ga-05` (el propio caso a arreglar). El caso más delicado fue el vocabulario de "explicación de una recomendación" (`basado en qué...`, `cuál fue el fundamento...`), que comparte la palabra "recomendación" con el patrón bare de `playbook_analysis`/`recommendation_request` — ver §14.2 para cómo se evitó el empate.

### 14.2 Análisis de `risk_issue_dependency` (antes de tocar código)

Sobre el baseline de Sprint 13R (`risk_issue_dependency` 30%, 3/10):

| Caso | Frase | Clasificación del mismatch |
|---|---|---|
| `rid-02` | "qué issues tenemos abiertos" | production classifier misses vocabulary (el enriquecido ya tenía `issues?|problemas?` bare) |
| `rid-03` | "qué dependencias nos bloquean" | production classifier misses vocabulary (el enriquecido ya tenía `dependenc(ia\|y)(s\|as)?` bare) |
| `rid-04` | "qué nos está deteniendo" | **true product gap en ambos classifiers** — el patrón existente del enriquecido "que nos detiene" no cubría el gerundio "está deteniendo" |
| `rid-06` | "hay algún impedimento activo" | production classifier misses vocabulary (el enriquecido ya tenía "impedimento" bare) |
| `rid-07` | "qué problemas tenemos pendientes" | production classifier misses vocabulary (mismo patrón que rid-02, con "problemas") |
| `rid-08` | "qué está trabando el avance" | **overlap real con `project_status`** — "avance" bare (peso 3 en el enriquecido) ganaba porque ningún classifier tenía un patrón para "trabando" |
| `rid-10` | "qué dependencias externas tenemos" | production classifier misses vocabulary (mismo patrón que rid-03) |

En 5 de 7 casos (`rid-02/03/06/07/10`) el enriquecido ya clasificaba y mapeaba correctamente — el único lado con vocabulario faltante era producción, igual que en Sprint 13R. Los dos restantes (`rid-04`, `rid-08`) eran gaps genuinos/colisiones en ambos lados.

**Regla de colisión aplicada (protección de `project_status`):** `project_status` ya posee vocabulario de "bloqueo genérico" (`atorado|estancado|no avanza`, `avance tenemos|avance del proyecto`, bare `avance`) que **no se tocó**. Los nuevos patrones de `risk_issue_dependency` para frases de "bloqueador explícito" (`está frenando`, `está trabando`, `bloquea el avance`, `impide avanzar`, `qué nos detiene/está deteniendo`) usan palabras propias que no aparecen en ningún patrón de `project_status`, y en el classifier enriquecido se les asignó peso 5 (no 3) para que superen estrictamente el bare `avance` (peso 3) sin empatar — un empate entre `risk_issue_dependency` y `project_status` cae a `needs_clarification`, porque `risk_issue_dependency` no está en `FAMILY_TIE_BREAK_ORDER`. Verificado con test de regresión explícito (§14.5) que `el proyecto está estancado` y `qué tan atrasados estamos con el cronograma` (vocabulario ya propio de `project_status`) no se ven afectados.

También se restringió el nuevo patrón bare de producción `problemas` a plural únicamente, para no colisionar con `gpa-08` ("cómo escalo este problema", `general_pm_advice`, singular) — verificado con test de regresión explícito.

### 14.3 Ajustes de patrones aplicados

**Producción — `intentClassifier.rules.ts`:**

- `risk_analysis`: se agregaron `\bissues?\b`, `\bproblemas\b` (solo plural), `dependenc(?:ia|y)(?:s|as)?`, `\bimpedimentos?\b`, `\btrabas?\b`, `\bobstaculos?\b` (todas peso 20, bare), más las frases de bloqueador explícito `que nos detiene|que nos esta deteniendo`, `que (?:nos )?esta frenando`, `bloquea el avance|impide avanzar`, `esta trabando` (peso 35-40), y las de dependencia de terceros `esperando al (?:cliente|proveedor)`, `pendiente de (?:tercero|proveedor|cliente)` (peso 35).
- `governance_question`: se agregó bare `\bevidencia\b` (peso 20).
- `audit_question`: se agregaron `audit trail`, `\bbitacora\b`, `\bauditoria\b`, `historial de (?:cambios|decisiones|recomendaciones)`, `\bhistorial\b`, `eventos registrados|quien hizo que`, `que regla (?:aplico|aplique|uso|utilizaste|utilizo)`, `quien aprobo`, `\bjustificacion\b`, y el par `basado en (?:que|la evidencia|los datos)` + `hiciste (?:esa|esta) recomendacion` / `cual fue el fundamento` + `fundamento de (?:esa|esta) recomendacion` — diseñados en pares para que la suma de ambos (35+20=55) supere con margen el peso del patrón bare "recomendacion" de `recommendation_request` (30), en vez de solo empatarlo.

**Enriquecido — `intent-patterns.ts`:**

- `risk_issue_dependency`: se amplió `que nos detiene` a `que nos detiene|que nos esta deteniendo`; se agregó `obstaculo` a la alternativa de `impedimento|traba`; se agregaron `que (?:nos )?esta frenando`, `bloquea el avance|impide avanzar`, `esta trabando`, `esperando al (?:cliente|proveedor)`, `pendiente de (?:tercero|proveedor|cliente)` — todas a peso 5 (no 3) para superar sin empate el bare `avance` de `project_status` (peso 3).
- `governance_audit`: se agregaron `aprobaciones? pendientes?` (intentType `evidence_request`, igual que el patrón ya existente de producción), `\bbitacora\b`, `registro de auditoria`, el par `historial de (?:cambios|decisiones|recomendaciones)` + bare `\bhistorial\b` (suma 8, supera el empate de 5 con el bare `decision(es)` de `decision_support` en "historial de decisiones"), `que criterio (?:usaste|uso)`, y el par `basado en (?:que|...)` + `hiciste (?:esa|esta) recomendacion` / `cual fue el fundamento` + `fundamento de (?:esa|esta) recomendacion` (suma 10, supera sin empate el bare "recomendacion" de `playbook_analysis`, peso 5).

**Mapping del adapter (`intentCompatibilityAdapter.ts`):** sin cambios — la tabla ya resolvía `evidence_request`→`governance_question` y `audit_trail_request`/`recommendation_explanation`/`why_recommended_request`→`audit_question` correctamente; todos los patrones nuevos se asignaron al `intentType` que produce el resultado deseado sin tocar el adapter.

**Colisiones evitadas:** ver §14.1/§14.2. Se verificó con `grep` sobre el corpus completo que ninguna palabra nueva aparece fuera de su categoría objetivo, salvo los dos casos de diseño intencional descritos arriba (empate `historial de decisiones` vs. `decision_support`, resuelto por margen de score; y singular/plural `problema(s)` entre `risk_issue_dependency`/`general_pm_advice`, resuelto por restricción léxica).

### 14.4 Resultado — antes / después

| Métrica | Sprint 13R | Sprint 14R | Δ |
|---|---|---|---|
| `compatibilityRate` global | 51% (52/102) | **62.7% (64/102)** | **+11.7 puntos** |
| `governance_audit` | 40% (4/10) | **90% (9/10)** | +50 puntos |
| `risk_issue_dependency` | 30% (3/10) | **100% (10/10)** | +70 puntos |
| `project_status` | 100% (11/11) | **100% (11/11)** | sin cambio (protegido) |
| `closure_billing` | 100% (12/12) | **100% (12/12)** | sin cambio (protegido) |
| `playbook_analysis` | 88.9% (8/9) | **88.9% (8/9)** | sin cambio (protegido) |
| `communication_draft` | 60% (6/10) | **60% (6/10)** | sin cambio (protegido) |
| `thresholdBand` | `not_ready` | `not_ready` | sin cambio de banda (sigue por debajo de 70%) |

Desglose completo por categoría después de este sprint:

| Categoría | Casos | Compatibles | compatibilityRate | Cambio vs. Sprint 13R |
|---|---|---|---|---|
| project_status | 11 | 11 | **100%** | sin cambio |
| closure_billing | 12 | 12 | **100%** | sin cambio |
| risk_issue_dependency | 10 | 10 | **100%** | +70 pts |
| governance_audit | 10 | 9 | **90%** | +50 pts |
| playbook_analysis | 9 | 8 | **88.9%** | sin cambio |
| communication_draft | 10 | 6 | 60% | sin cambio |
| task_action | 10 | 5 | 50% | sin cambio |
| general_pm_advice | 10 | 3 | 30% | sin cambio |
| decision_support | 10 | 0 | 0% | sin cambio (fuera de alcance) |
| ambiguous_or_unknown | 10 | 0 | 0% | sin cambio (fuera de alcance) |

`expectedMappedIntentFailCount = 0` — el corpus quedó al día con el código después de actualizar los 12 casos afectados (`ga-02,03,04,05,10`, `rid-02,03,04,06,07,08,10`), cada uno con una nota "Sprint 14R calibration".

### 14.5 `topDifferences` restante

`risk_issue_dependency` queda en 100% (0 mismatches). `governance_audit` queda en 90%, con un único mismatch restante:

- `ga-09` ("qué trazabilidad tiene esta decisión") — overlap documentado `governance_audit`/`decision_support` desde Sprint 11R, no resoluble por vocabulario (requiere que `decision_support` tenga primero una decisión de arquitectura/handler productivo).

Las categorías con mayor brecha ahora son `decision_support` (0%, fuera de alcance por diseño), `ambiguous_or_unknown` (0%, fuera de alcance por diseño), y `general_pm_advice` (30%) — el mismo candidato ya señalado por la recomendación de Sprint 12R/13R, sin cambios este sprint por estar fuera de su alcance explícito.

### 14.6 Protección contra regresiones

- `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`: se agregaron secciones `governance_audit` y `risk_issue_dependency` que verifican (a) las 10 frases de gobernanza/auditoría antes fallidas ahora clasifican como `governance_question`/`audit_question` en producción y como `governance_audit` en el enriquecido; (b) las 10 frases de riesgo/issue/dependencia antes fallidas ahora clasifican como `risk_analysis`/`risk_issue_dependency` en ambos; (c) el empate `historial de decisiones` vs. `decision_support` se resuelve a `governance_audit`; (d) las frases de bloqueo ya propias de `project_status` (`atorado|estancado|no avanza`, `atrasados con el cronograma`) no se ven afectadas por el nuevo vocabulario de bloqueador de `risk_issue_dependency`; (e) el singular "este problema" de `general_pm_advice` no se ve afectado por el patrón plural-only de `risk_issue_dependency`; (f) pisos de `governance_audit` ≥ 70% y `risk_issue_dependency` ≥ 70%, junto con los pisos exactos de `project_status` (100%), `closure_billing` (100%), `playbook_analysis` (≥ 88.9%) y `communication_draft` (≥ 60%); (g) las frases protegidas de Sprint 12R/13R (`project_status`, `communication_draft`, `closure_billing`, `playbook_analysis`) siguen clasificando igual.
- Los pisos por categoría de Sprint 12R/13R permanecen sin cambios y siguen pasando.
- Las 163 pruebas de `playbook-engine/conversation/*` + `conversational-brain-intent-classifier` siguen pasando sin cambios de comportamiento fuera de lo documentado.

### 14.7 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok.
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok.
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok.
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (actualizado, +10 tests nuevos, 103 en total) — ok.
- `npx tsx --test tests/playbook-engine-conversation-intent-classifier.test.mjs` — ok.
- Resto de tests de `playbook-engine/conversation/*` (brain-router, response-composer, gateway, context-resolver, demo-scenarios) + `conversational-brain-intent-classifier` — 163/163 ok en conjunto.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados (paquetes faltantes en este entorno: `react`, `@supabase/*`, `next/*`, `@types/node`; conteo de líneas de error idéntico antes/después del cambio, verificado con `git stash`); cero errores nuevos en `intentClassifier.rules.ts`, `intent-patterns.ts`, o cualquier otro archivo tocado este sprint (verificado con `grep` del output de typecheck sobre los nombres de archivo modificados).

### 14.8 Recomendación para el siguiente sprint

1. `general_pm_advice` (30%) es ahora el único candidato de vocabulario asimétrico restante fuera de `task_action` — pero, como ya señalado en Sprint 12R/13R (§12.7.3), probablemente tenga solapes de diseño reales con `playbook_analysis`/`decision_support` (ver `gpa-02`, `gpa-08`) que ameritan revisión de diseño antes de solo agregar patrones.
2. `task_action` (50%) no ha sido priorizado en ningún sprint de calibración hasta ahora — buen candidato de bajo riesgo para la misma técnica bidireccional (varios de sus casos incompatibles, como `ta-02`/`ta-04`/`ta-05`/`ta-09`, muestran production con `unknown` mientras el enriquecido ya clasifica correctamente).
3. `decision_support` y `ambiguous_or_unknown` siguen fuera de alcance de nivelación de vocabulario — requieren decisiones de arquitectura/producto (handler nuevo y distinción `clarification`/`unknown` en el modelo enriquecido, respectivamente). `ga-09` es evidencia adicional de que `decision_support` necesita resolverse antes de que `governance_audit` pueda superar ~90-95%.
4. Sólo cuando el `compatibilityRate` global se acerque de forma sostenida a la banda `staging_candidate` (≥ 85%) tiene sentido retomar el PR 6 de §6 (shadow mode en staging). En 51% (post Sprint 13R), sigue en `not_ready`, pero con 3 de 10 categorías ya en 100%/≥88.9%.

## 15. Sprint 15R — Task Action Vocabulary Calibration

> **Estado:** ajuste de vocabulario/patrones únicamente. Este sprint modifica `intentClassifier.rules.ts` (producción) y `intent-patterns.ts` (enriquecido), actualiza los `expected*` de 5 casos (`ta-02, ta-04, ta-05, ta-09, ta-10`) del golden corpus que cambiaron de comportamiento real, agrega una sección `task_action` a `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`, y esta sección; no modifica `intentCompatibilityAdapter.ts` (la tabla de mapping ya resolvía `task_action` → `task_or_action_request` 1:1, y ningún caso nuevo requería un subtipo distinto), `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el endpoint, ni activa ningún feature flag.

### 15.1 Análisis de `task_action` (antes de tocar código)

Sobre el baseline de Sprint 14R (`task_action` 50%, 5/10), se corrió la evaluación completa y se examinaron los 10 resultados caso por caso:

| Caso | Frase | Clasificación del mismatch |
|---|---|---|
| `ta-01` | "creá una tarea para Arturo" | ya compatible — sin cambios |
| `ta-02` | "convertí esto en tarea" | production classifier misses vocabulary (sin patrón "convertir...en tarea"; el enriquecido ya lo tenía) |
| `ta-03` | "marcá esta recomendación como vista" | ya compatible — overlap documentado `task_action`/`playbook_analysis` (ambos classifiers de acuerdo en `recommendation_request` vía el mapping existente); intencionalmente **no tocado** |
| `ta-04` | "cerrá esta acción" | production classifier misses vocabulary (sin patrón "cerrar acción/tarea"; el enriquecido ya tenía bare `cerra`) |
| `ta-05` | "asignale seguimiento a Gabriela" | production classifier misses vocabulary (el patrón existente `asigna(?:me)? (?:esto|una tarea)` era demasiado angosto; el enriquecido ya matcheaba con su bare `asigna(r|me)?`) |
| `ta-06` | "creame una tarea para el equipo" | ya compatible — sin cambios |
| `ta-07` | "programa una reunión con el cliente" | ya compatible — sin cambios |
| `ta-08` | "asigname esto a Gabriela" | ya compatible — sin cambios |
| `ta-09` | "actualiza el estado de esta tarea" | production classifier misses vocabulary (el enriquecido ya tenía bare `actualiza(r)?`; producción no tenía ningún patrón de "estado" en `task_or_action_request`) |
| `ta-10` | "recordame hacer seguimiento mañana" | **true product gap en ambos classifiers** — ninguno reconocía "recordame" como vocabulario de recordatorio/seguimiento |

7 de 10 casos ya estaban compatibles o eran production-side-only gaps resolubles sin tocar el adapter. Solo `ta-10` requería una adición simétrica en ambos classifiers, y `ta-03` se dejó explícitamente sin tocar por ser un overlap ya documentado y ya compatible.

**Riesgo de colisión evaluado:** se grepeó el corpus completo (102 casos) por las palabras nuevas (`asigna`, `convert`, `pasa.*a (tarea|task)`, `action item`, `como pendiente`, `genera.*accion`, `recordame`) fuera de `task_action`: cero coincidencias, salvo los propios casos de `task_action` a arreglar. El caso más delicado era evitar que el nuevo vocabulario de "actualizar/marcar/cerrar" colisionara con `ta-03` ("marcá esta recomendación como vista") — ver §15.2.

### 15.2 Ajustes de patrones aplicados

**Producción — `intentClassifier.rules.ts` (`task_or_action_request`):**

- Se amplió el patrón de asignación de `asigna(?:me)? (?:esto|una tarea)` a un prefijo bare `asigna(?:le|me|r)?\b` (peso 35) — cubre "asignale seguimiento a Gabriela" sin perder los casos ya compatibles.
- Se amplió `programa(?:me)? una reunion` a `programa(?:me)? (?:una reunion|seguimiento)` (peso 35) — cubre "programá seguimiento para mañana" (el enriquecido ya matcheaba vía su bare `programa(r)?`).
- Se agregaron patrones de conversión: `convert(?:i|ir)(?:me)? esto en (?:tarea|task|accion|action item)` (peso 40), `pasa(?:lo|rlo)? a (?:tarea|task|accion|action item)` (peso 40), `genera(?:r)? (?:una )?accion desde` (peso 40 — deliberadamente por encima del bare "recomendacion" de `recommendation_request`, peso 30, para que "generá una acción desde esta recomendación" resuelva a `task_or_action_request`), y bare `\baction item\b` (peso 40).
- Se agregaron patrones de status/update, cada uno exigiendo explícitamente la palabra "tarea"/"accion"/"estado" para no colisionar con `ta-03`: `actualiza(?:r)? (?:el )?estado(?: de (?:esta|la|una|dicha) tarea)?` (peso 35), `cambia(?:r)? (?:el )?estado` (peso 30), `cerra(?:r)? (?:esta |la )?(?:accion|tarea)` (peso 40), `marca(?:r)? (?:esta |la |una )?(?:tarea|accion) como` (peso 35), y bare `como pendiente` (peso 35).
- Se agregó `recordame (?:hacer )?seguimiento` (peso 30) — vocabulario de recordatorio distinto de `recomendame` (`general_pm_advice`).

**Enriquecido — `intent-patterns.ts` (`task_action`):**

- Se agregó bare `\baction item\b` (peso 5, `task_creation_request`).
- Se amplió `convert(i|ir)(me)? esto en tarea` a `convert(i|ir)(me)? esto en (tarea|task|accion|action item)` (peso 5).
- Se agregó `pasa(lo|rlo)? a (tarea|task|accion|action item)` (peso 5, `convert_recommendation_request`).
- Se agregó `genera(r)? (una )?accion desde` (peso 5, `convert_recommendation_request`) — empata con el bare "recomendacion" de `playbook_analysis` (peso 5); el empate se resuelve a `task_action` vía `FAMILY_TIE_BREAK_ORDER` (que ya lista `task_action` primero), igual que producción resuelve el mismo caso por margen de score.
- Se agregó bare `como pendiente` (peso 5, `task_update_request`).
- Se agregó `recordame (hacer )?seguimiento` (peso 5, `action_execution_request`).

**Mapping del adapter (`intentCompatibilityAdapter.ts`):** sin cambios — `task_action` ya mapeaba 1:1 a `task_or_action_request` sin distinción de subtipo; ningún patrón nuevo requería una regla nueva.

**Colisiones evitadas:** ver §15.1. Se verificó explícitamente que:
- `marcá esta recomendación como vista` (ta-03) sigue clasificando como `recommendation_request`/`playbook_analysis` en ambos classifiers — ninguno de los nuevos patrones de status/update matchea porque todos exigen "tarea"/"accion"/"estado" explícitos.
- `dame estado de HMP`, `cómo va el proyecto`, `qué avance tenemos` (`project_status`) no matchean los nuevos patrones de "estado"/"asigna" (requieren "actualiza"/"cambia" como prefijo, ausente en estas frases).
- `qué falta para facturar`, `estamos listos para cobrar` (`closure_billing`), `redactame un correo...`, `ayudame a responder este correo`, `preparame una minuta` (`communication_draft`), `por qué recomendaste esto`, `qué evidencia usaste` (`governance_audit`), `qué riesgos hay`, `qué dependencias nos bloquean` (`risk_issue_dependency`), y `qué recomienda el playbook`, `cuál es la siguiente mejor acción` (`playbook_analysis`) no se ven afectados por ningún patrón nuevo (ninguno contiene "asigna", "convert", "action item", "como pendiente", "estado", o "cerra").

### 15.3 Resultado — antes / después

| Métrica | Sprint 14R | Sprint 15R | Δ |
|---|---|---|---|
| `compatibilityRate` global | 62.7% (64/102) | **67.6% (69/102)** | **+4.9 puntos** |
| `task_action` | 50% (5/10) | **100% (10/10)** | +50 puntos |
| `project_status` | 100% (11/11) | **100% (11/11)** | sin cambio (protegido) |
| `closure_billing` | 100% (12/12) | **100% (12/12)** | sin cambio (protegido) |
| `risk_issue_dependency` | 100% (10/10) | **100% (10/10)** | sin cambio (protegido) |
| `governance_audit` | 90% (9/10) | **90% (9/10)** | sin cambio (protegido) |
| `playbook_analysis` | 88.9% (8/9) | **88.9% (8/9)** | sin cambio (protegido) |
| `communication_draft` | 60% (6/10) | **60% (6/10)** | sin cambio (protegido) |
| `thresholdBand` | `not_ready` | `not_ready` | sin cambio de banda (sigue por debajo de 70%, aunque a 2.4 puntos) |

Desglose completo por categoría después de este sprint:

| Categoría | Casos | Compatibles | compatibilityRate | Cambio vs. Sprint 14R |
|---|---|---|---|---|
| project_status | 11 | 11 | **100%** | sin cambio |
| closure_billing | 12 | 12 | **100%** | sin cambio |
| risk_issue_dependency | 10 | 10 | **100%** | sin cambio |
| task_action | 10 | 10 | **100%** | +50 pts |
| governance_audit | 10 | 9 | **90%** | sin cambio |
| playbook_analysis | 9 | 8 | **88.9%** | sin cambio |
| communication_draft | 10 | 6 | 60% | sin cambio |
| general_pm_advice | 10 | 3 | 30% | sin cambio |
| decision_support | 10 | 0 | 0% | sin cambio (fuera de alcance) |
| ambiguous_or_unknown | 10 | 0 | 0% | sin cambio (fuera de alcance) |

`expectedMappedIntentFailCount = 0` — el corpus quedó al día con el código después de actualizar los 5 casos afectados (`ta-02, ta-04, ta-05, ta-09, ta-10`), cada uno con una nota "Sprint 15R calibration".

### 15.4 `topDifferences` restante

`task_action` queda en 100% (0 mismatches) — la primera categoría, junto con `project_status`, `closure_billing` y `risk_issue_dependency`, en llegar a compatibilidad total.

Las categorías con mayor brecha ahora son `decision_support` (0%, fuera de alcance por diseño), `ambiguous_or_unknown` (0%, fuera de alcance por diseño), y `general_pm_advice` (30%) — el mismo candidato ya señalado por la recomendación de Sprint 12R/13R/14R, sin cambios este sprint por estar fuera de su alcance explícito. `communication_draft` (60%) es ahora el candidato de vocabulario asimétrico de menor riesgo entre las categorías "reales" que aún no llegan a 100%.

### 15.5 Protección contra regresiones

- `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`: se agregó una sección `task_action` que verifica (a) las 11 frases de task_action antes fallidas (o nuevas, del listado de "tests mínimos") ahora clasifican como `task_or_action_request` en producción; (b) las 10 frases correspondientes ahora clasifican como `task_action` en el enriquecido; (c) `marcá esta recomendación como vista` sigue clasificando como `recommendation_request`/`playbook_analysis` en ambos, sin verse afectada por el nuevo vocabulario de status/update; (d) las frases protegidas de `project_status`, `closure_billing`, `communication_draft`, `governance_audit`, `risk_issue_dependency` y `playbook_analysis` no se ven afectadas por el nuevo vocabulario de `task_action`; (e) un test de "safety" que verifica por `grep` de texto fuente que ninguno de los dos archivos de patrones modificados importa/menciona el router, composer, handlers, Supabase, `fetch`, envío de emails, o creación/ejecución real de tareas; (f) el piso de `task_action` ≥ 80%, junto con los pisos exactos/mínimos de las 6 categorías protegidas; (g) el piso global ≥ 62.7% (baseline Sprint 14R).
- Los pisos por categoría de Sprint 12R/13R/14R permanecen sin cambios y siguen pasando.
- Las 170 pruebas de `playbook-engine/conversation/*` + `conversational-brain-intent-classifier` siguen pasando sin cambios de comportamiento fuera de lo documentado.

### 15.6 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (actualizado, +7 tests nuevos, 36 en total) — ok.
- `npx tsx --test tests/playbook-engine-conversation-intent-classifier.test.mjs` — ok (17/17).
- Resto de tests de `playbook-engine/conversation/*` (brain-router, response-composer, gateway, context-resolver, demo-scenarios, runtime-conversation-state, command-center-conversation-gateway-integration, conversation-vault-ingestion) — todos ok, sin cambios de comportamiento.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` (`tsc --noEmit`) — mismos errores preexistentes no relacionados (paquetes faltantes en este entorno: `react`, `@supabase/*`, `next/*`, `@types/node`); cero errores nuevos en `intentClassifier.rules.ts`, `intent-patterns.ts`, `intentGoldenEvaluation.ts`, la fixture del golden corpus, o cualquier otro archivo tocado este sprint (verificado con `grep` del output de typecheck sobre los nombres de archivo modificados).

### 15.7 Recomendación para el siguiente sprint

1. `communication_draft` (60%) y `general_pm_advice` (30%) son ahora los únicos candidatos de vocabulario asimétrico restantes entre las categorías "reales". `communication_draft` es probablemente el de menor riesgo (varios de sus mismatches muestran production con `unknown` mientras el enriquecido ya clasifica correctamente, similar al patrón resuelto este sprint para `task_action`). `general_pm_advice`, como ya señalado en Sprint 12R/13R/14R (§12.7.3, §14.8), probablemente tenga solapes de diseño reales con `playbook_analysis`/`decision_support` que ameritan revisión de diseño antes de solo agregar patrones.
2. `decision_support` y `ambiguous_or_unknown` siguen fuera de alcance de nivelación de vocabulario — requieren decisiones de arquitectura/producto (handler nuevo y distinción `clarification`/`unknown` en el modelo enriquecido, respectivamente).
3. Con 4 de 10 categorías ya en 100% (`project_status`, `closure_billing`, `risk_issue_dependency`, `task_action`) y 2 más por encima de 85% (`governance_audit` 90%, `playbook_analysis` 88.9%), el `compatibilityRate` global (67.6%) está a solo 2.4 puntos de la banda `needs_adjustment` (≥ 70%). Calibrar `communication_draft` (60% → potencialmente 90%+) es probablemente suficiente para cruzar ese umbral en el próximo sprint.
4. Sólo cuando el `compatibilityRate` global se acerque de forma sostenida a la banda `staging_candidate` (≥ 85%) tiene sentido retomar el PR 6 de §6 (shadow mode en staging). En 67.6% (post Sprint 15R), sigue en `not_ready`, pero con 4 de 10 categorías ya en 100% y 2 más ≥ 88.9%.

## 16. Sprint 16R — Communication Draft Vocabulary Calibration

> **Estado:** ajuste de vocabulario/patrones únicamente. Este sprint modifica `intentClassifier.rules.ts` (producción) y `intent-patterns.ts` (enriquecido), actualiza los `expected*` de 5 casos (`cd-02, cd-03, cd-04, cd-07, gpa-07`) del golden corpus que cambiaron de comportamiento real, agrega una sección `communication_draft` a `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`, y esta sección; no modifica `intentCompatibilityAdapter.ts` (la tabla de mapping ya resolvía `communication_draft` → `communication_draft` 1:1 sin distinción de subtipo, y ningún caso nuevo requería una regla nueva), `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el endpoint, ni activa ningún feature flag. No se envió ningún correo real, no se creó ningún draft externo, no se llamó a Gmail, no se ejecutó ninguna acción real.

### 16.1 Análisis de `communication_draft` (antes de tocar código)

Sobre el baseline de Sprint 15R (`communication_draft` 60%, 6/10), se corrió la evaluación completa y se examinaron los 10 resultados caso por caso:

| Caso | Frase | Clasificación del mismatch |
|---|---|---|
| `cd-01` | "redactame un correo para pedir recepción" | ya compatible — sin cambios |
| `cd-02` | "ayudame a responder este correo" | production classifier misses vocabulary (sin patrón "ayudame a responder/contestar"; el enriquecido ya lo tenía) |
| `cd-03` | "dame seguimiento formal para el cliente" | production classifier misses vocabulary (sin patrón "seguimiento formal"; el enriquecido ya lo tenía) |
| `cd-04` | "preparame una minuta" | production classifier misses vocabulary (sin patrón bare "minuta"; el enriquecido ya lo tenía) |
| `cd-05` | "haceme un correo de escalamiento" | ya compatible — sin cambios |
| `cd-06` | "escribime un correo para el cliente" | ya compatible — sin cambios |
| `cd-07` | "necesito un draft de email para escalar esto" | production classifier misses vocabulary (el patrón existente `draft (?:an? )?(?:email\|message)` no cubre "draft de email"; el enriquecido ya matcheaba vía su bare "email") |
| `cd-08` | "redactame un correo de cierre para el cliente" | ya compatible — sin cambios |
| `cd-09` | "ayudame a redactar una minuta de la reunión" | ya compatible — sin cambios |
| `cd-10` | "preparame el correo de seguimiento para el stakeholder" | ya compatible — sin cambios |

6 de 10 casos ya estaban compatibles. Los 4 restantes (`cd-02/03/04/07`) eran todos production-side-only gaps — vocabulario que el clasificador enriquecido ya reconocía y producción no — resolubles sin tocar el adapter, exactamente el mismo patrón que Sprint 15R resolvió para `task_action`.

Adicionalmente, la instrucción del sprint pedía verificar 15 frases mínimas de prueba (algunas fuera del golden corpus) cubriendo las reglas de colisión A–G (communication_draft debe ganar sobre closure_billing/task_action/governance_audit/risk_issue_dependency/project_status/playbook_analysis cuando hay un verbo explícito de redacción). Al correr esas 15 frases contra el estado post-Sprint 15R se encontraron 6 gaps adicionales fuera del golden corpus:

| Frase | Gap encontrado |
|---|---|
| "armame un mensaje para pedir visto bueno" | true product gap en ambos classifiers — ningún patrón de "arma" ni "visto bueno" existía |
| "cómo le digo al cliente que falta el acta" | producción sin patrón "como le digo" (colisionaba con `closure_question`'s bare "acta"); enriquecido tenía "como le digo" pero bajo `general_pm_advice`, no `communication_draft` |
| "preparame correo para solicitar recepción definitiva" | producción: `closure_question`'s "recepcion definitiva" (peso 35) superaba a `correo para` (peso 25) — faltaba un verbo de redacción "prepara" con peso suficiente |
| "preparame un mensaje al cliente sobre la dependencia" | overlap con `risk_issue_dependency` en ambos classifiers — faltaba patrón "prepara/arma/formula + mensaje" |
| "ayudame a escalar el bloqueo" | overlap con `risk_issue_dependency`'s bare "bloqueo" en el enriquecido; sin patrón en producción |
| "escribime un correo explicando la recomendación" | producción ya compatible; enriquecido sin patrón "escribeme/escribime" en su lista de `communication_draft` (gap simétrico con producción, que sí lo tenía) — perdía contra `playbook_analysis`'s bare "recomendacion" |
| "redactame un correo con la recomendación del playbook" | producción: `recommendation_request`'s "recomendacion" (30) + "playbook" (25) = 55 superaba a `redacta` (45) solo — faltaba una señal adicional de "correo + recomendación" |

**Riesgo de colisión evaluado:** se grepeó el corpus completo (102 casos) por cada palabra/frase nueva (`prepara`, `arma`, `formula`, `minuta`, `draft`, `borrador`, `como le digo`, `ayudame a escalar`, `seguimiento formal`, `visto bueno`, `conformidad`, `recomendacion del playbook`, `explicando la recomendacion`) fuera de `communication_draft`. El único caso protegido con superposición literal fue `cb-06` ("preparame el seguimiento para recepción", `closure_billing`, ya documentado en Sprint 13R como una superposición intencional) — contiene "prepara" pero ningún sustantivo de comunicación (correo/mensaje/minuta/borrador/respuesta/nota), así que el nuevo patrón combinado "prepara/arma/formula + sustantivo" no lo alcanza; se verificó explícitamente que `cb-06` permanece en `closure_billing` después del cambio. El único caso del corpus que sí cambió de comportamiento fuera de `communication_draft` fue `gpa-07` (ver §16.2).

### 16.2 Ajustes de patrones aplicados

**Producción — `intentClassifier.rules.ts` (`communication_draft`):**

- `ayudame a (?:responder|contestar)|necesito (?:responder|contestar)` (peso 35).
- `seguimiento formal|dar seguimiento formal` (peso 35).
- bare `\bminutas?\b` (peso 35).
- bare `\bdraft\b` (peso 30) y bare `\bborrador\b` (peso 30).
- `\b(?:prepara(?:me)?|arma(?:me)?|formula(?:me)?)\b[\s\S]*\b(?:correo|mensaje|minuta|borrador|respuesta|nota)\b` (peso 40) — exige el verbo de redacción **y** un sustantivo de comunicación en el mismo mensaje, para no colisionar con `cb-06`.
- `(?:pedir|solicitar) (?:recepcion|visto bueno|aceptacion|conformidad)` (peso 30) — amplía el vocabulario de "cierre comunicacional" del sprint.
- `como le digo|como se lo digo|que le digo|que le respondo|que le contesto` (peso 35).
- `ayudame a escalar` (peso 35).
- `con la recomendacion|recomendacion del playbook|explicando la recomendacion|explicar(?:le)? la recomendacion` (peso 40) — supera el combinado `recomendacion`(30) + `playbook`(25) = 55 de `recommendation_request` cuando también hay un verbo de redacción (45+).

**Enriquecido — `intent-patterns.ts` (`communication_draft`):**

- Se agregó `escrib(eme|ime)` (peso 5, `email_draft_request`) — producción ya lo tenía; era un gap simétrico puro.
- Se agregó el mismo patrón combinado `\b(prepara(me)?|arma(me)?|formula(me)?)\b[\s\S]*\b(correo|mensaje|minuta|borrador|respuesta|nota)\b` (peso 5, `email_draft_request`).
- Se agregó `ayudame a escalar` (peso 5, `escalation_draft_request`).
- Se agregó `(como le digo|como se lo digo|que le digo|que le respondo|que le contesto)` (peso 5, `email_draft_request`) — empata con el patrón preexistente "como le digo" de `general_pm_advice` (peso 5); el empate se resuelve a `communication_draft` vía `FAMILY_TIE_BREAK_ORDER` (que lista `communication_draft` pero no `general_pm_advice`).
- Se amplió `(pedir|solicitar) recepcion` a `(pedir|solicitar) (recepcion|visto bueno|aceptacion|conformidad)` (peso 5, sin cambiar el `intentType`).

**Mapping del adapter (`intentCompatibilityAdapter.ts`):** sin cambios — `communication_draft` ya mapeaba 1:1 a `communication_draft` sin distinción de subtipo; ningún patrón nuevo requería una regla nueva.

**Colisiones evitadas:** ver §16.1. Se verificó explícitamente que:
- `cb-06` ("preparame el seguimiento para recepción") y el resto de `closure_billing` (`qué falta para facturar`, `estamos listos para cobrar`, `qué nos falta para la recepción definitiva`, `ya puedo cerrar el proyecto`, `qué bloquea la facturación`, `falta el acta de recepción`, `tenemos aceptación final?`, `está listo el cierre administrativo?`) siguen clasificando igual en ambos classifiers.
- `task_action` (`creá una tarea para Arturo`, `convertí esto en tarea`, `asignale seguimiento a Gabriela`, `actualizá el estado de esta tarea`, `cerrá esta acción`, `programá seguimiento para mañana`, `pasalo a task`, `creá un action item`, y el overlap ya documentado `marcá esta recomendación como vista`) no se ve afectado — ninguna de estas frases contiene un verbo de redacción explícito.
- `governance_audit` (`por qué recomendaste esto`, `qué evidencia usaste`, `mostrame el audit trail`, `qué regla aplicó`, `quiero ver la bitácora de auditoría`, `quién aprobó esto`) no se ve afectado.
- `risk_issue_dependency` (`qué riesgos hay`, `qué issues tenemos abiertos`, `qué dependencias nos bloquean`, `qué nos está deteniendo`, `cuál es el impedimento`, `estamos esperando al cliente`, `hay algún pendiente de proveedor`) no se ve afectado.
- `project_status` (`cómo va el proyecto`, `dame estado de HMP`, `qué avance tenemos`, `estamos atrasados`, `salud del proyecto`) no se ve afectado.
- `playbook_analysis` (`qué recomienda el playbook`, `cuál es la siguiente mejor acción`, `analizá esto según el playbook`) no se ve afectado.
- `gpa-07` ("cómo le digo al cliente que hay un retraso") **sí** cambió de comportamiento — de `general_pm_advice`/`unknown` (incompatible) a `communication_draft`/`communication_draft` (compatible) — por diseño explícito del sprint (la regla de colisión A dice que "cómo le digo" debe ganar aunque el contenido hable de "atraso"). Se actualizó el golden corpus con nota "Sprint 16R calibration" documentando el cambio; `general_pm_advice` no bajó (30% → 40%, una mejora incidental) y la categoría se dejó fuera de alcance de calibración activa, como pide el sprint.

### 16.3 Resultado — antes / después

| Métrica | Sprint 15R | Sprint 16R | Δ |
|---|---|---|---|
| `compatibilityRate` global | 67.6% (69/102) | **72.5% (74/102)** | **+4.9 puntos** |
| `communication_draft` | 60% (6/10) | **100% (10/10)** | +40 puntos |
| `project_status` | 100% (11/11) | **100% (11/11)** | sin cambio (protegido) |
| `closure_billing` | 100% (12/12) | **100% (12/12)** | sin cambio (protegido) |
| `risk_issue_dependency` | 100% (10/10) | **100% (10/10)** | sin cambio (protegido) |
| `task_action` | 100% (10/10) | **100% (10/10)** | sin cambio (protegido) |
| `governance_audit` | 90% (9/10) | **90% (9/10)** | sin cambio (protegido) |
| `playbook_analysis` | 88.9% (8/9) | **88.9% (8/9)** | sin cambio (protegido) |
| `general_pm_advice` | 30% (3/10) | 40% (4/10) | +10 puntos (efecto incidental de `gpa-07`, categoría fuera de alcance) |
| `thresholdBand` | `not_ready` | **`needs_adjustment`** | cruzó el umbral de 70% |

Desglose completo por categoría después de este sprint:

| Categoría | Casos | Compatibles | compatibilityRate | Cambio vs. Sprint 15R |
|---|---|---|---|---|
| project_status | 11 | 11 | **100%** | sin cambio |
| closure_billing | 12 | 12 | **100%** | sin cambio |
| risk_issue_dependency | 10 | 10 | **100%** | sin cambio |
| task_action | 10 | 10 | **100%** | sin cambio |
| communication_draft | 10 | 10 | **100%** | +40 pts |
| governance_audit | 10 | 9 | **90%** | sin cambio |
| playbook_analysis | 9 | 8 | **88.9%** | sin cambio |
| general_pm_advice | 10 | 4 | 40% | +10 pts (incidental) |
| decision_support | 10 | 0 | 0% | sin cambio (fuera de alcance) |
| ambiguous_or_unknown | 10 | 0 | 0% | sin cambio (fuera de alcance) |

`expectedMappedIntentFailCount = 0` — el corpus quedó al día con el código después de actualizar los 5 casos afectados (`cd-02, cd-03, cd-04, cd-07, gpa-07`), cada uno con una nota "Sprint 16R calibration".

### 16.4 `topDifferences` restante

`communication_draft` queda en 100% (0 mismatches) — la quinta categoría, junto con `project_status`, `closure_billing`, `risk_issue_dependency` y `task_action`, en llegar a compatibilidad total.

Las categorías con mayor brecha ahora son `decision_support` (0%, fuera de alcance por diseño), `ambiguous_or_unknown` (0%, fuera de alcance por diseño), y `general_pm_advice` (40%) — la única categoría "real" restante sin nivelar, y la única señalada por instrucción explícita del sprint como fuera de alcance por requerir revisión de diseño (overlap con `playbook_analysis`/`decision_support`), no solo vocabulario.

### 16.5 Protección contra regresiones

- `tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs`: se agregó una sección `communication_draft` que verifica (a) las 15 frases mínimas de prueba del sprint (golden corpus + las reglas de colisión A–G) clasifican como `communication_draft` en ambos classifiers; (b) las frases protegidas de `closure_billing`, `task_action`, `governance_audit`, `risk_issue_dependency`, `project_status` y `playbook_analysis` sin verbo de redacción siguen clasificando exactamente igual en ambos classifiers; (c) un test de "safety" que verifica por `grep` de texto fuente que ninguno de los dos archivos de patrones modificados importa/menciona el router, composer, handlers, Supabase, `fetch`, envío de emails reales, Gmail, o creación/ejecución real de tareas; (d) el piso de `communication_draft` ≥ 90%, junto con los pisos exactos/mínimos de las 6 categorías protegidas; (e) el piso global ≥ 67.6% (baseline Sprint 15R).
- Los pisos por categoría de Sprint 12R/13R/14R/15R permanecen sin cambios y siguen pasando.
- Las 180 pruebas de `playbook-engine/conversation/*` + `conversational-brain-intent-classifier` siguen pasando sin cambios de comportamiento fuera de lo documentado (`gpa-07`).

### 16.6 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` (actualizado, +9 tests nuevos, 46 en total) — ok.
- Resto de tests de `playbook-engine/conversation/*` (classifier, brain-router, response-composer, gateway, context-resolver, demo-scenarios) + `conversational-brain-intent-classifier` — todos ok, sin cambios de comportamiento (180/180 combinados).
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` (`tsc --noEmit`) — mismos errores preexistentes no relacionados (paquetes faltantes en este entorno: `react`, `@supabase/*`, `next/*`, `@types/node`); cero errores nuevos en `intentClassifier.rules.ts`, `intent-patterns.ts`, `intentGoldenEvaluation.ts`, la fixture del golden corpus, o cualquier otro archivo tocado este sprint (verificado con `grep` del output de typecheck sobre los nombres de archivo modificados).
- Suite completa (`tests/*.test.mjs`, ~7080 tests): mismas 9 fallas preexistentes y no relacionadas (módulos de `agent-execution`/`beta-readiness`/`governance-runtime-hardening`, ya fallando de forma idéntica en el baseline de Sprint 15R sin ningún cambio de este sprint) — verificado comparando el conteo de fallas antes y después de aplicar el diff de este sprint.

### 16.7 Recomendación para el siguiente sprint

1. `general_pm_advice` (40%) es ahora la única categoría "real" restante sin nivelar. Como ya señalado en Sprint 12R/13R/14R/15R (§12.7.3, §14.8, §15.7), probablemente tenga solapes de diseño reales con `playbook_analysis`/`decision_support` (ver `gpa-06`, `gpa-08`, `gpa-09` en el golden corpus) que ameritan revisión de diseño antes de solo agregar patrones — no se recomienda otro sprint de calibración de vocabulario puro sin esa revisión primero.
2. `decision_support` y `ambiguous_or_unknown` siguen fuera de alcance de nivelación de vocabulario — requieren decisiones de arquitectura/producto (handler nuevo y distinción `clarification`/`unknown` en el modelo enriquecido, respectivamente).
3. Con 5 de 10 categorías ya en 100% (`project_status`, `closure_billing`, `risk_issue_dependency`, `task_action`, `communication_draft`) y 2 más por encima de 85% (`governance_audit` 90%, `playbook_analysis` 88.9%), el `compatibilityRate` global (72.5%) ya cruzó la banda `needs_adjustment` (≥ 70%). Acercarse a `staging_candidate` (≥ 85%) requeriría resolver `general_pm_advice` y al menos parte de `decision_support`/`ambiguous_or_unknown` — ambos fuera de alcance de una calibración de vocabulario simple.
4. Sólo cuando el `compatibilityRate` global se acerque de forma sostenida a la banda `staging_candidate` (≥ 85%) tiene sentido retomar el PR 6 de §6 (shadow mode en staging). En 72.5% (post Sprint 16R), la banda es `needs_adjustment`, con 5 de 10 categorías ya en 100% y 2 más ≥ 88.9%.

## 17. Sprint 17R — General PM Advice Boundary & Design Review

### 17.1 Por qué este sprint NO es calibración de vocabulario

Sprint 16R dejó `general_pm_advice` (40%), `decision_support` (0%) y `ambiguous_or_unknown` (0%) sin
tocar, señalando explícitamente que `general_pm_advice` "probablemente tenga solapes de diseño reales
con `playbook_analysis`/`decision_support`" (§16.7.1) y que `decision_support`/`ambiguous_or_unknown`
"requieren decisiones de arquitectura/producto" (§16.7.2). Agregar patrones de vocabulario a
`general_pm_advice` sin resolver esos dos huecos arquitectónicos primero arriesga que
`general_pm_advice` termine siendo el default silencioso para cualquier mensaje con forma de decisión
o de ambigüedad, precisamente porque ninguna otra categoría los reclama todavía — lo opuesto a lo que
una política de frontera explícita debería garantizar.

Por eso Sprint 17R no modifica `intentClassifier.rules.ts`, `intent-patterns.ts`, ni
`intentCompatibilityAdapter.ts`. En su lugar, produce tres artefactos nuevos y puramente de solo
lectura:

1. Una **política de frontera explícita** para `general_pm_advice` — `docs/conversational-brain-general-pm-advice-boundary.md`.
2. Un **corpus de boundary cases** — `tests/fixtures/conversational-brain-general-pm-advice-boundary-cases.ts` (70 casos).
3. Un **evaluator puro** — `src/lib/playbook-engine/conversation/classifier/generalPmAdviceBoundaryReview.ts`
   (`runGeneralPmAdviceBoundaryReview`, `summarizeGeneralPmAdviceBoundaryReview`,
   `explainGeneralPmAdviceBoundaryPolicy`), que reutiliza el shadow comparison de Sprint 10R
   (`runIntentClassifierShadowComparison`) sin llamar router, composer, handlers, DB, Supabase, Gmail
   ni ejecutar ninguna acción real.

### 17.2 Propósito del boundary review

Definir con precisión cuándo un mensaje debe ser `general_pm_advice` versus cuándo debe ganar
`playbook_analysis`, `decision_support` (candidate), `ambiguous_or_unknown`/`needs_clarification`
(candidate), `project_status`, `task_action`, `communication_draft`, `risk_issue_dependency`,
`governance_audit`, o `closure_billing` — y medir qué tan alineados están la política, el classifier
productivo, el classifier enriquecido y el intent mapeado vía el adaptador de Sprint 10R, sin subir el
`compatibilityRate` global ni tocar producción.

### 17.3 Definición y precedence rules

Ver `docs/conversational-brain-general-pm-advice-boundary.md` para el documento completo. Resumen: 9
categorías (`project_status_preferred`, `playbook_analysis_preferred`, `communication_draft_preferred`,
`task_action_preferred`, `closure_billing_preferred`, `risk_issue_dependency_preferred`,
`governance_audit_preferred`, `decision_support_candidate`, `ambiguous_clarification_candidate`) ganan
sobre `general_pm_advice` cuando el mensaje trae su señal explícita; `general_pm_advice` es el
fallback útil sólo cuando ninguna de esas nueve señales está presente.

### 17.4 Corpus creado

`tests/fixtures/conversational-brain-general-pm-advice-boundary-cases.ts` — 70 casos, con
`boundaryCategory`, `policyTarget`, `policyTargetKind` (`production_intent` | `architecture_candidate`
| `clarification_candidate`), `rationale`, `riskLevel`, y `shouldCurrentSystemHandle` registrado en el
momento de autoría (corriendo los classifiers reales, igual que el golden corpus de Sprint 11R).

| `boundaryCategory` | Casos (mínimo del sprint) |
|---|---|
| `safe_general_pm_advice` | 12 (≥12) |
| `playbook_analysis_preferred` | 8 (≥8) |
| `decision_support_candidate` | 10 (≥10) |
| `ambiguous_clarification_candidate` | 10 (≥10) |
| `project_status_preferred` | 5 (≥5) |
| `communication_draft_preferred` | 5 (≥5) |
| `task_action_preferred` | 5 (≥5) |
| `closure_billing_preferred` | 5 (≥5) |
| `risk_issue_dependency_preferred` | 5 (≥5) |
| `governance_audit_preferred` | 5 (≥5) |

### 17.5 Métricas del boundary evaluator

| Métrica | Valor |
|---|---|
| `totalCases` | 70 |
| `policyAlignedRate` | **74.3%** (52/70) |
| `currentSystemAcceptableRate` | **84.3%** (59/70) |
| `architectureGapCount` | 10 (14.3%) |
| `clarificationGapCount` | 10 (14.3%) |
| `recommendedNextSprint` | **"Decision Support + Clarification Architecture Review"** |

Por `boundaryCategory` (`policyAlignedRate` / `currentSystemAcceptableRate`):
`safe_general_pm_advice` 16.7%/16.7%, `playbook_analysis_preferred` 87.5%/100%,
`decision_support_candidate` 40%/90%, `ambiguous_clarification_candidate` 90%/100%,
`project_status_preferred` 100%/100%, `communication_draft_preferred` 100%/100%,
`task_action_preferred` 100%/100%, `closure_billing_preferred` 100%/100%,
`risk_issue_dependency_preferred` 100%/100%, `governance_audit_preferred` 100%/100%.

### 17.6 Principales conflictos encontrados

`byConflictType`: `none` 52, `general_pm_vs_closure_billing` 1, `classifier_disagreement` 10,
`mapping_gap` 1, `architecture_gap` 6 (el resto de los tipos `general_pm_vs_*` en 0 — ninguna de las
nueve categorías "preferred"/"candidate" fue swallowed por `general_pm_advice` en este corpus).

- **`general_pm_vs_closure_billing` (1 caso)**: "qué buenas prácticas aplican para una reunión de
  cierre" resuelve hoy a `closure_question` (patrón bare `cierre`, peso 20) en vez de
  `general_pm_advice` — un solapamiento real de vocabulario que una futura calibración de
  `general_pm_advice` deberá evitar repetir (mismo tipo de trabajo de "collision-avoidance" que
  Sprint 16R hizo para `communication_draft`).
- **`classifier_disagreement` (10 casos)**: en su mayoría, frases de `safe_general_pm_advice` con
  conjugaciones que ninguno de los dos classifiers reconoce ("cómo puedo ordenar…", "cómo reduzco…",
  "cómo evito…", "cómo recupero…", "cómo puedo mejorar…") — brecha real de vocabulario, no de diseño.
- **`architecture_gap` (6 casos)**: `decision_support_candidate` sin ningún intent productivo que lo
  represente — incluye un caso donde tanto producción como el classifier enriquecido lo confunden con
  `governance_audit` ("deberíamos cerrar ya o pedir más evidencia").
- **`mapping_gap` (1 caso)**: "no sé qué hacer" — ni producción ni el classifier enriquecido detectan
  ambigüedad aquí; cae a `unknown`/`unknown` en vez de `clarification`/`needs_clarification`.

### 17.7 Decision support candidates

Los 10 casos `decision_support_candidate` tienen `policyAlignedRate` 40% (sólo el classifier
enriquecido, la única señal disponible ya que producción no tiene intent para esto, detecta 4/10
correctamente) y `currentSystemAcceptableRate` 90%. La brecha de vocabulario en `decision_support`
(singular "alternativa" vs. patrón sólo-plural "alternativas"; "recomiendas" vs. patrón sólo-condicional
"recomendarias"; frases sin keyword de decisión) es secundaria frente al hueco real: no existe intent,
ruta ni handler productivo para `decision_support` — el mismo solapamiento `governance_audit`/
`decision_support` documentado desde Sprint 11R (`ga-09`) reaparece aquí ("deberíamos cerrar ya o
pedir más evidencia").

### 17.8 Clarification candidates

Los 10 casos `ambiguous_clarification_candidate` tienen `policyAlignedRate` 90% y
`currentSystemAcceptableRate` 100% — detectar ambigüedad ya funciona bien con la lógica existente de
mensajes cortos/sin señal. Lo que falta no es detección: es que tanto `clarification` (producción)
como `needs_clarification` (enriquecido) resuelven directo a `general_pm_advisor` sin hacer ninguna
pregunta de clarificación real — una decisión de producto pendiente, no un problema de patrones.

### 17.9 Recomendación para el siguiente PR

`architectureGapCount` y `clarificationGapCount` están ambos por encima del umbral de "alto" (12% del
corpus) que usa el evaluator, así que `recommendedNextSprint` resuelve a **"Decision Support +
Clarification Architecture Review"**: aunque `safe_general_pm_advice` (16.7%) parece a primera vista
el candidato obvio de calibración, dos de sus nueve fronteras competidoras (`decision_support`,
`ambiguous_or_unknown`) no tienen todavía un hogar productivo — calibrar `general_pm_advice` antes de
resolver eso arriesga justamente lo que este sprint buscaba evitar (ver §17.1). Ver "Recommendation
for next PR" en `docs/conversational-brain-general-pm-advice-boundary.md` para el detalle completo.

### 17.10 Protección contra regresiones

- El golden corpus de Sprint 11R-16R (`tests/fixtures/conversational-brain-golden-intents.ts`) no fue
  tocado. `compatibilityRate` global permanece en **72.5%** y las 7 categorías previamente calibradas
  (`project_status`, `closure_billing`, `risk_issue_dependency`, `task_action`, `communication_draft`
  en 100%; `governance_audit` en 90%; `playbook_analysis` en 88.9%) quedan exactamente iguales —
  verificado por `tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` (sección
  "Regression awareness", que re-corre `runGoldenIntentEvaluation`/`summarizeGoldenIntentEvaluation`
  y falla si cualquiera de esos números cambia) y por la suite completa del golden corpus.
- `intentClassifier.rules.ts`, `intent-patterns.ts`, e `intentCompatibilityAdapter.ts` no fueron
  modificados (verificado con `git diff --name-only`).
- El nuevo módulo (`generalPmAdviceBoundaryReview.ts`) tiene sus propios tests de "safety" (grep de
  texto fuente) que verifican que no importa el router, composer, handlers, o los archivos de
  patrones de clasificación, y que no llama Supabase, `fetch`, envío de emails, Gmail, ni
  creación/ejecución de tareas.

### 17.11 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` — ok (45/45, nuevo).
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` — ok (46/46, sin cambios).
- Resto de `playbook-engine/conversation/*` (classifier, brain-router, response-composer, gateway, context-resolver, demo-scenarios) — todos ok, sin cambios de comportamiento.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` (`tsc --noEmit`) — mismos errores preexistentes no relacionados a este sprint (paquetes faltantes en este entorno: `react`, `@supabase/*`, `next/*`, `stripe`, `@types/node`); cero errores nuevos en `generalPmAdviceBoundaryReview.ts`, la fixture del boundary corpus, o el nuevo archivo de tests (verificado con `grep` del output de typecheck).
- `git diff --name-only` — confirma que sólo se agregaron archivos nuevos; ningún archivo de producción, router, composer, handler, classifier de patrones, o adaptador fue modificado.

---

## 18. Sprint 18R — Decision Support + Clarification Architecture Review

> **Estado:** review de arquitectura únicamente. Ver `git log` — este sprint agrega
> `docs/conversational-brain-decision-support-clarification-architecture.md`,
> `tests/fixtures/conversational-brain-decision-clarification-cases.ts`,
> `src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts`, su
> test file, y esta sección; no modifica `intentClassifier.rules.ts`, `intent-patterns.ts`,
> `intentCompatibilityAdapter.ts`, `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts`, el
> endpoint, ni activa ningún feature flag. No crea un handler productivo de `decision_support`. No
> implementa un clarification loop real.

### 18.1 Por qué no se implementó handler ni clarification loop todavía

Sprint 17R (§17) dejó `decision_support` (0%) y `ambiguous_or_unknown` (0%) fuera de calibración de
vocabulario y recomendó explícitamente un **"Decision Support + Clarification Architecture Review"**
como siguiente sprint — no un PR de implementación. Ambos huecos son arquitectónicos: `decision_support`
no tiene intent, ruta ni handler productivo; `needs_clarification` no tiene un loop de clarificación
real (resuelve directo a `general_pm_advisor`). Construir cualquiera de los dos sin primero medir
dónde cada uno colisiona con las otras ocho categorías arriesgaba repetir el mismo error que Sprint
17R evitó para `general_pm_advice`: absorber territorio ajeno silenciosamente, o ser absorbido por él.

### 18.2 Qué se creó

1. **Documento de arquitectura** —
   `docs/conversational-brain-decision-support-clarification-architecture.md`: definición de
   `decision_support`, definición de `needs_clarification`, qué NO es cada uno, precedence rules de
   10 niveles, safe temporary mapping, requisitos de un futuro Decision Support Candidate Handler y
   de una futura Clarification Response Strategy, y recomendación para Sprint 19R.
2. **Corpus dedicado** — `tests/fixtures/conversational-brain-decision-clarification-cases.ts`, 79
   casos con `id`, `input`, `architectureCategory`, `desiredFutureRoute`, `currentSafeMappedIntent`,
   `targetKind`, `rationale`, `riskLevel`, `requiresNewHandler`, `requiresClarification`,
   `shouldExecuteAction` (siempre `false`).
3. **Evaluator puro** —
   `src/lib/playbook-engine/conversation/classifier/decisionClarificationArchitectureReview.ts`
   (`runDecisionClarificationArchitectureReview`, `summarizeDecisionClarificationArchitectureReview`,
   `explainDecisionClarificationArchitecture`), que reutiliza el shadow comparison de Sprint 10R
   (`runIntentClassifierShadowComparison`) — sin llamar router, composer, handlers, DB, Supabase,
   Gmail, ni ejecutar ninguna acción real.

### 18.3 Corpus

13 valores de `architectureCategory` (mínimos del sprint entre paréntesis):

| `architectureCategory` | Casos | `currentSafeMappingRate` | `futureRouteAlreadySupportedRate` |
|---|---|---|---|
| `decision_support_clear` (≥12) | 12 | 91.7% | 33.3% |
| `decision_support_vs_playbook` (≥8) | 8 | 75% | 62.5% |
| `decision_support_vs_general_pm` (≥8) | 8 | 37.5% | 25% |
| `decision_support_vs_risk` (≥6) | 6 | 16.7% | 0% |
| `decision_support_vs_closure` (≥6) | 6 | 16.7% | 0% |
| `decision_support_vs_governance` (≥5) | 5 | 40% | 20% |
| `clarification_clear` (≥10) | 10 | 90% | 90% |
| `clarification_vs_general_pm` (≥6) | 6 | 100% | 100% |
| `clarification_vs_status` / `vs_risk` / `vs_task` / `vs_communication` (≥8 combinados) | 8 (2 c/u) | 25-50% | 25-50% |
| `existing_route_should_win` (≥10) | 10 | 100% | 100% |

### 18.4 Métricas del evaluator

| Métrica | Valor |
|---|---|
| `totalCases` | 79 |
| `currentSafeMappingRate` | **64.6%** (51/79) |
| `futureRouteAlreadySupportedRate` | **49.4%** (39/79) |
| `requiresNewHandlerCount` | 45 |
| `requiresClarificationCount` | 24 |
| `shouldExecuteActionCount` | 0 |
| `unsafeMappings` | 28/79 |
| `existingRouteRegressions` | 0/10 |
| `recommendedImplementationOrder` | Decision Support Candidate Handler → Clarification Response Strategy → General PM Advice Calibration → Controlled Shadow Capture Prep |
| `recommendedNextSprint` | **"Sprint 19R — Decision Support Candidate Handler"** |

`byConflictType` (no-cero): `none` 20, `decision_support_missing_handler` 22,
`decision_support_collides_with_playbook` 7, `decision_support_collides_with_general_pm` 4,
`decision_support_collides_with_risk` 5, `decision_support_collides_with_closure` 3,
`decision_support_collides_with_governance` 4, `clarification_missing_strategy` 12,
`clarification_collides_with_status` 2.

### 18.5 Principales decision_support gaps

- `decision_support_vs_playbook` es la colisión más marcada: 7/8 casos resuelven hoy a
  `recommendation_request` en ambos classifiers (el patrón bare `playbook` de producción y las
  patterns de `playbook_analysis` del enriquecido ganan sobre el framing de decisión).
- `decision_support_vs_general_pm` es la segunda más marcada (5/8 unsafe): "qué harías en mi lugar" y
  "qué hago si el cliente no responde, escalo o espero" resuelven a `general_pm_advice` en ambos
  classifiers — la misma colisión que el corpus de boundary de Sprint 17R ya había señalado (`gpa-02`).
- `decision_support_vs_risk` y `decision_support_vs_closure` son las dos peores franjas (16.7%
  `currentSafeMappingRate` cada una) — vocabulario de riesgo/cierre/facturación/evidencia domina el
  framing de decisión en casi todos los casos. `dc-36` reproduce el mismo solapamiento
  `governance_audit`/`decision_support` documentado desde `ga-09` (Sprint 11R).
- `decision_support_clear` sólo alcanza 33.3% de `futureRouteAlreadySupportedRate` — el classifier
  enriquecido (la única señal disponible, ya que producción no tiene equivalente) no reconoce dos
  tercios incluso de la frase decision_support más limpia — una brecha real de vocabulario en el
  enriquecido, independiente del handler productivo faltante.

### 18.6 Principales clarification gaps

- `clarification_clear` y `clarification_vs_general_pm` ya están cerca o en el máximo (90% y 100%
  respectivamente) — la detección de ambigüedad ya funciona bien para la mayoría de estos casos.
- `clarification_vs_status` es el único riesgo de regresión viva confirmado: "esto no avanza" y "esto
  está bloqueado" resuelven hoy con confianza a `project_status_question` (patrones de Sprint
  12R/14R) en vez de caer a un fallback seguro de clarificación.
- El resto de las categorías `vs_risk`/`vs_task`/`vs_communication` fallan sobre todo cayendo a
  `unsupported`/`unknown` en vez del fallback documentado `general_pm_advice` — un hueco más leve
  (sigue siendo una no-respuesta neutral) pero tampoco el comportamiento objetivo de un clarification
  loop real.

### 18.7 Recomendación para Sprint 19R

`requiresNewHandlerCount` (45) casi duplica `requiresClarificationCount` (24), y dentro de los dos
grupos de huecos `decision_support` es el 65.2% del total combinado (45/69) — por encima del umbral
de dominancia (60%) que usa el evaluator. `decision_support` también tiene el modo de fallo más
severo: sus mappings inseguros no solo fallan en detectar — casi la mitad de las veces producen una
respuesta operacional específica y confiadamente equivocada.

**Recomendación: Sprint 19R — Decision Support Candidate Handler**, seguido de una calibración de
vocabulario de `general_pm_advice` una vez que el handler exista, y luego una Clarification Response
Strategy. Ver la sección "Recommendation for Sprint 19R" de
`docs/conversational-brain-decision-support-clarification-architecture.md` para el detalle completo y
los criterios de entrada/salida.

### 18.8 Protección contra regresiones

- El golden corpus de Sprint 11R-16R no fue tocado. `compatibilityRate` global permanece en **72.5%**
  y las 7 categorías previamente calibradas quedan exactamente iguales.
- El boundary review de Sprint 17R no fue tocado: `policyAlignedRate` (74.3%),
  `currentSystemAcceptableRate` (84.3%), `architectureGapCount` (10), y `clarificationGapCount` (10)
  quedan exactamente iguales.
- `intentClassifier.rules.ts`, `intent-patterns.ts`, e `intentCompatibilityAdapter.ts` no fueron
  modificados (verificado con `git diff --name-only`).
- El nuevo módulo (`decisionClarificationArchitectureReview.ts`) tiene sus propios tests de "safety"
  (grep de texto fuente) que verifican que no importa el router, composer, handlers, o los archivos
  de patrones de clasificación, y que no llama Supabase, `fetch`, envío de emails, Gmail, ni
  creación/ejecución de tareas.

### 18.9 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` — ok (51/51, nuevo).
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` — ok (45/45, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok, sin cambios.
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok, sin cambios.
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` — ok, sin cambios.
- Resto de `playbook-engine/conversation/*` — todos ok, sin cambios de comportamiento.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados (paquetes faltantes en este
  entorno); cero errores nuevos en los archivos de este sprint.
- `git diff --name-only` — confirma que sólo se agregaron archivos nuevos; ningún archivo de
  producción, router, composer, handler, classifier de patrones, o adaptador fue modificado.

## 19. Sprint 19R — Decision Support Candidate Handler

> **Estado:** capacidad técnica aislada únicamente. Ver `git log` — este sprint agrega
> `src/lib/playbook-engine/conversation/decision-support/` (4 archivos), su fixture corpus
> (`tests/fixtures/conversational-brain-decision-support-handler-cases.ts`), su test file
> (`tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs`), este documento
> (`docs/conversational-brain-decision-support-candidate-handler.md`), y esta sección; no modifica
> `intentClassifier.rules.ts`, `intent-patterns.ts`, `intentCompatibilityAdapter.ts`,
> `brainRouter.ts`, `responseComposer.ts`, ningún `handlers/*.ts` existente, el endpoint, ni activa
> ningún feature flag. No conecta `decision_support` a producción.

### 19.1 Por qué este handler y no otra cosa

Sprint 18R (§18) midió que `decision_support` era el hueco más urgente de los dos restantes
(`decision_support`, `needs_clarification`): sus mappings inseguros no solo fallan en detectar, casi
la mitad de las veces producen una respuesta operacional específica y confiadamente equivocada
(colisionando con `playbook_analysis`, `general_pm_advice`, `risk_issue_dependency`,
`closure_billing`, o `governance_audit`). `requiresNewHandlerCount` (45) casi duplicó
`requiresClarificationCount` (24), y `decision_support` fue el 65.2% del total combinado de los dos
grupos de huecos. El evaluator de Sprint 18R recomendó explícitamente **"Sprint 19R — Decision
Support Candidate Handler"** como siguiente paso.

### 19.2 Qué se creó

1. **Módulo aislado** — `src/lib/playbook-engine/conversation/decision-support/`:
   - `decisionSupportCandidateTypes.ts`: tipos puros (`DecisionSupportInput`, `DecisionSupportContext`,
     `DecisionSupportDecisionType` (10 valores), `DecisionSupportOption`, `DecisionSupportTradeoff`,
     `DecisionSupportRisk`, `DecisionSupportEvidenceNeed`, `DecisionSupportRecommendation`,
     `DecisionSupportSafety`, `DecisionSupportAuditMetadata`, `DecisionSupportCandidateResult`).
   - `decisionSupportAnalyzer.ts`: analyzer puro y determinístico —
     `normalizeDecisionSupportInput`, `detectDecisionType`/`detectDecisionTypeWithDetail`,
     `extractDecisionOptions`, `identifyDecisionTradeoffs`, `identifyDecisionRisks`,
     `identifyEvidenceNeeds`, `buildDecisionStatement`, `estimateDecisionConfidence`,
     `explainDecisionSupportAnalysis`. Sin `fetch`, sin DB, sin Supabase, sin Gmail, sin LLM, sin leer
     el reloj del sistema.
   - `decisionSupportCandidateHandler.ts`: `handleDecisionSupportCandidate`,
     `formatDecisionSupportCandidateResponse`, `explainDecisionSupportCandidateHandler`. No llama
     router, composer, ningún handler productivo, ni ejecuta ninguna acción.
   - `index.ts`: barrel aislado — **no** re-exportado desde
     `src/lib/playbook-engine/conversation/index.ts` (verificado por test).
2. **Fixture corpus** — `tests/fixtures/conversational-brain-decision-support-handler-cases.ts`: 50
   casos cubriendo los 10 `DecisionSupportDecisionType`, cada uno con `expectedDecisionType`,
   `expectedMinOptions`, `expectedEvidenceKeywords`, `expectedTradeoffKeywords`,
   `expectedRiskKeywords`, `expectedConfidence`, `shouldAskClarifyingQuestion`.
3. **Test suite** — `tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs`:
   54 tests (estructura del fixture, analyzer, extracción de opciones, handler end-to-end,
   formatting, safety a nivel de código fuente, y regresión contra golden/Sprint 17R/Sprint 18R).
4. **Documento de referencia** —
   `docs/conversational-brain-decision-support-candidate-handler.md`: input/output contract, los 10
   decision types, safety guarantees, human confirmation policy, ejemplo de output, limitaciones, por
   qué no se conecta al router todavía, y criterios para Sprint 20R.

### 19.3 Decision types soportados

`choose_between_options`, `escalate_or_wait`, `close_or_continue`, `bill_or_wait`,
`accept_or_mitigate_risk`, `change_vendor_or_continue`, `approve_or_request_evidence`,
`prioritize_next_step`, `identify_missing_decision`, `general_decision_support` (fallback seguro).

Detección por reglas de keyword/conector ordenadas de más a menos específicas (facturación, cierre,
escalamiento, riesgo, proveedor, evidencia, decisión faltante, priorización, luego conectores
estructurales de opciones), cayendo a `general_decision_support` cuando nada más específico aplica.
Documentado en código vía `explainDecisionSupportAnalysis()`, para que las reglas y su documentación
no diverjan.

### 19.4 Qué NO se hizo (por diseño de este sprint)

- No se conectó `decision_support` a producción, al router, al composer, o al endpoint.
- No se activó ningún feature flag.
- No se modificó `intentClassifier.rules.ts`, `intent-patterns.ts`, ni
  `intentCompatibilityAdapter.ts` (verificado con `git diff --name-only` y con tests de safety que
  hacen grep del código fuente).
- No se reutilizó todavía el `DecisionDraft` real de `operational-intelligence-engine.ts` (Sprint 5) —
  las tradeoffs/riesgos/evidencia son plantillas determinísticas por `decisionType`, no informadas por
  datos reales de proyecto. Documentado como el gap más grande antes de Sprint 20R.
- No se implementó un clarification loop real (`needs_clarification` sigue exactamente como lo dejó
  Sprint 18R).
- No se calibró vocabulario de `general_pm_advice`.

### 19.5 Protección contra regresiones

- El golden corpus de Sprint 11R-16R no fue tocado: `compatibilityRate` global permanece en **72.5%**
  y las 7 categorías previamente calibradas quedan exactamente iguales.
- El boundary review de Sprint 17R no fue tocado: `policyAlignedRate` (74.3%),
  `currentSystemAcceptableRate` (84.3%), `architectureGapCount` (10), y `clarificationGapCount` (10)
  quedan exactamente iguales.
- El architecture review de Sprint 18R no fue tocado: `currentSafeMappingRate` (64.6%),
  `futureRouteAlreadySupportedRate` (49.4%), `requiresNewHandlerCount` (45),
  `requiresClarificationCount` (24), y `recommendedNextSprint` ("Sprint 19R — Decision Support
  Candidate Handler") quedan exactamente iguales.
- `intentClassifier.rules.ts`, `intent-patterns.ts`, e `intentCompatibilityAdapter.ts` no fueron
  modificados.
- El nuevo módulo tiene sus propios tests de "safety" (grep de texto fuente) que verifican que no
  importa el router, composer, handlers, el gateway, los archivos de patrones de clasificación, ni el
  adaptador, y que no llama Supabase, `fetch`, Gmail, envío de emails, ni creación/ejecución de tareas.
  Un test adicional confirma que el barrel productivo (`conversation/index.ts`) no exporta el módulo
  nuevo.

### 19.6 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` — ok (54/54, nuevo).
- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` — ok (51/51, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` — ok (45/45, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21, sin cambios).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` — ok (46/46, sin cambios).
- Resto de `tests/playbook-engine-conversation-*.test.mjs` + `command-center-conversation-gateway-integration.test.mjs` — 312/312 ok, sin cambios de comportamiento.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados (módulos/tipos de Node/React/Next
  faltantes en todo el repo); cero errores nuevos en los archivos de este sprint (verificado con
  `grep -i decision-support` sobre la salida de `tsc --noEmit`).
- `git diff --name-only` — confirma que sólo se agregaron archivos nuevos; ningún archivo de
  producción, router, composer, handler existente, classifier de patrones, adaptador, o endpoint fue
  modificado.

## 20. Sprint 20R — Decision Support Shadow Mapping Evaluation

> **Estado:** evaluación offline/shadow únicamente. Este sprint agrega
> `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts` y
> `decisionSupportShadowMappingTypes.ts`, su test file
> (`tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs`), este documento
> (`docs/conversational-brain-decision-support-shadow-mapping.md`), y esta sección; agrega exports al
> barrel aislado `decision-support/index.ts` (no re-exportado desde el barrel productivo). No modifica
> `intentClassifier.rules.ts`, `intent-patterns.ts`, `intentCompatibilityAdapter.ts`, `brainRouter.ts`,
> `responseComposer.ts`, ningún `handlers/*.ts` existente, el endpoint, ni activa ningún feature flag.
> No conecta `decision_support` a producción. No se creó ningún corpus nuevo — reutiliza el corpus de
> 79 casos de Sprint 18R sin modificarlo.

### 20.1 Por qué esta evaluación y no otra cosa

Sprint 19R construyó el Decision Support Candidate Handler como una capacidad aislada, pura y
probada, pero dejó una pregunta abierta explícitamente en su propio documento ("Criteria to pass to
Sprint 20R"): re-ejecutar los test suites existentes confirma que nada regresó, pero no mide con
números reales cómo se comportaría el handler frente al corpus que motivó construirlo. Este sprint
responde exactamente eso — sin integrar nada a producción.

### 20.2 Qué se creó

1. **Evaluator puro** —
   `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts`:
   `runDecisionSupportShadowMappingEvaluation(cases, options?)`,
   `summarizeDecisionSupportShadowMappingEvaluation(results)`,
   `explainDecisionSupportShadowMappingEvaluation()`. Reutiliza
   `runDecisionClarificationArchitectureReview()` (Sprint 18R) para la comparación shadow
   producción/enriquecido/adapter, y `handleDecisionSupportCandidate()` (Sprint 19R) para los casos
   elegibles. Sin `fetch`, sin DB, sin Supabase, sin Gmail, sin LLM, sin feature flags.
2. **Tipos** — `decisionSupportShadowMappingTypes.ts`: `DecisionSupportShadowEligibility`,
   `DecisionSupportShadowCollisionType` (18 valores), `DecisionSupportShadowIntegrationMode` (8
   valores), `DecisionSupportShadowMappingResult`, `DecisionSupportShadowMappingSummary`.
3. **Test suite** — `tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs`: 52
   tests (estructura, elegibilidad, candidate handler, detección de colisiones, safety a nivel de
   código fuente, y regresión contra golden/Sprint 17R/Sprint 18R).
4. **Documento de referencia** — `docs/conversational-brain-decision-support-shadow-mapping.md`:
   metodología completa, resultados, top collisions, top handler gaps, shadow routable cases,
   recomendación de integration mode, y criterios para Sprint 21R.

### 20.3 Resultados obtenidos

| Métrica | Valor |
|---|---|
| `totalCases` | 79 |
| `decisionSupportDesiredCount` / `candidateHandlerEligibleCount` | 45 / 45 (**100% coverage**) |
| `candidateHandlerSafeRate` | **100%** (0 safety failures, 0 missing options/evidence) |
| `shadowRoutableRate` | **40%** (18/45) |
| `unsafeClassifierCollisionCount` | 21 (playbook 3, general_pm 7, risk 5, closure 2, governance 3, mapping_gap 1) |
| `handlerLowConfidenceCount` | 19 (diseño esperado: sin `availableContext`, no un defecto) |
| `recommendedIntegrationMode` | **`do_not_integrate`** (por `shadowRoutableRate` < 50%, no por falla del handler) |
| `recommendedNextSprint` | **"Sprint 21R — Decision Support Classifier Boundary Calibration"** |

### 20.4 Qué NO se hizo (por diseño de este sprint)

- No se conectó `decision_support` a producción, al router, al composer, o al endpoint.
- No se activó ningún feature flag.
- No se modificó `intentClassifier.rules.ts`, `intent-patterns.ts`, ni
  `intentCompatibilityAdapter.ts` (verificado con `git diff --name-only` y con tests de safety que
  hacen grep del código fuente).
- No se creó ningún corpus nuevo — se reutilizó el corpus de 79 casos de Sprint 18R sin modificarlo.
- No se implementó `DecisionDraft` reuse — esta evaluación cuantifica cuánto cuesta no tenerlo
  (`handlerLowConfidenceCount` 19/45) sin resolverlo.
- No se implementó un clarification loop real.
- No se calibró vocabulario de `general_pm_advice`.

### 20.5 Protección contra regresiones

- El golden corpus permanece en `compatibilityRate` **72.5%**, sin cambios por categoría.
- El boundary review de Sprint 17R permanece igual (`policyAlignedRate` 74.3%,
  `currentSystemAcceptableRate` 84.3%, `architectureGapCount` 10, `clarificationGapCount` 10).
- El architecture review de Sprint 18R permanece igual (`currentSafeMappingRate` 64.6%,
  `futureRouteAlreadySupportedRate` 49.4%, `requiresNewHandlerCount` 45,
  `requiresClarificationCount` 24, `existingRouteRegressions` 0).
- El candidate handler de Sprint 19R no cambió — su propio test suite (54 tests) sigue pasando sin
  modificaciones al código de producción del handler.

### 20.6 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs` — ok (52/52, nuevo).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` — ok (54/54, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` — ok (51/51, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` — ok (45/45, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21, sin cambios).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32, sin cambios).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` — ok (46/46, sin cambios).
- Resto de `tests/playbook-engine-conversation-*.test.mjs` + `tests/conversational-brain-*.test.mjs` — 382/382 ok, sin cambios de comportamiento.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados (módulos/tipos de Node/React/Next
  faltantes en todo el repo); cero errores nuevos en los archivos de este sprint (verificado con
  `grep -i decisionSupportShadow` sobre la salida de `tsc --noEmit`).
- `git diff --name-only` — confirma que sólo se agregaron archivos nuevos y se editó el barrel aislado
  `decision-support/index.ts`; ningún archivo de producción, router, composer, handler existente,
  classifier de patrones, adaptador, o endpoint fue modificado.

## 21. Sprint 21R — Decision Support Classifier Boundary Calibration

> **Estado:** calibración del classifier enriquecido únicamente. Este sprint modifica
> `src/lib/conversational-brain/intent-patterns.ts` (classifier enriquecido, no productivo);
> `src/lib/playbook-engine/conversation/decision-support/decisionSupportShadowMappingEvaluation.ts` y
> `decisionSupportShadowMappingTypes.ts` (nuevas métricas); `tests/fixtures/conversational-brain-golden-intents.ts`
> (una entrada, `gpa-06`, con nota documentada); y los test files de Sprint 17R/18R/20R (sólo los
> valores hardcodeados de regresión que este sprint mueve intencionalmente). Agrega
> `tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs` (99 tests) y
> `docs/conversational-brain-decision-support-classifier-boundary.md`. No modifica
> `intentClassifier.rules.ts`, `intentCompatibilityAdapter.ts`, `brainRouter.ts`,
> `responseComposer.ts`, ningún `handlers/*.ts` existente, el endpoint, ni activa ningún feature flag.
> No conecta `decision_support` a producción. No se creó ningún corpus nuevo.

### 21.1 Por qué esta calibración y no otra cosa

Sprint 20R midió, con números reales, que el Decision Support Candidate Handler es 100%
estructuralmente seguro pero sólo 40% "shadow routable" — y que el bloqueador dominante no era el
handler sino el classifier enriquecido: no reconocía frases de decisión específicas (comparación
explícita, escalar/esperar, cerrar/continuar, facturar/cobrar vs. esperar, aceptar/mitigar riesgo,
cambiar proveedor, evidencia/criterio "para decidir") como `decision_support`, así que colisionaban
con `playbook_analysis`, `general_pm_advice`, `risk_issue_dependency`, `closure_billing`, o
`governance_audit`. Este sprint calibra exactamente esa frontera.

### 21.2 Qué se hizo

1. **~24 patrones nuevos** agregados a `INTENT_FAMILY_PATTERNS.decision_support` en
   `intent-patterns.ts`, cada uno anclado a un conector de decisión explícito (no vocabulario
   genérico) para no colisionar con las frases "puras" (sin framing de decisión) que las otras cinco
   familias siguen ganando.
2. **Dos ajustes de precisión** en otras familias del mismo archivo: `task_action`'s patrón de
   conversión ahora acepta también "esta decisión" (no sólo "esto"); `communication_draft` ganó un
   patrón `ayudame a explicar` (espejo de su `ayudame a contestar/responder` existente).
3. **Sin nueva lógica de tie-break**: `decision_support` no se agregó a `FAMILY_TIE_BREAK_ORDER`;
   cada patrón fue pesado para que el score de decision_support supere estrictamente al de la familia
   colisionante en las frases objetivo, o para que las colisiones con `task_action`/
   `communication_draft` se resuelvan vía el tie-break ya existente (ambas ya listadas primero).
4. **Nuevas métricas** en el evaluador de shadow mapping (Sprint 20R):
   `enrichedDecisionSupportDetectedCount`/`Rate`, `decisionSupportBoundaryCapturedCount`/`Rate`,
   `unsupportedSafeParkingCount`, `semanticBoundaryImprovementCount`, y cinco
   `*CollisionReduction` — todas calculadas contra una constante `SPRINT_20R_BASELINE` documentada y
   hardcodeada (nunca re-medida en runtime).
5. **99 tests nuevos** — `tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs`.
6. **Una entrada de golden fixture actualizada** (`gpa-06`) con nota explícita de Sprint 21R.

### 21.3 Resultados obtenidos

| Métrica | Sprint 20R | Sprint 21R |
|---|---|---|
| `enrichedDecisionSupportDetectionRate` | 33.3% (15/45) | **88.9% (40/45)** |
| `unsafeClassifierCollisionCount` | 21 | **5** |
| `playbookCollisionCount` | 3 | **0** |
| `generalPmCollisionCount` | 7 | **1** |
| `riskCollisionCount` | 5 | **2** |
| `closureCollisionCount` | 2 | **1** |
| `governanceCollisionCount` | 3 | **0** |
| `unsupportedSafeParkingCount` (nueva) | n/a | **40** (semántica capturada, no ruteo productivo) |
| `shadowRoutableRate` | 40% | 40% (sin cambio — el límite ahora es confianza del handler, no el classifier) |
| `candidateHandlerSafeRate` | 100% | 100% (sin cambio) |
| `recommendedIntegrationMode` | `do_not_integrate` | `do_not_integrate` (sin cambio) |
| `recommendedNextSprint` | "Sprint 21R — Decision Support Classifier Boundary Calibration" | "Sprint 21R — Clarification Response Strategy" (real: Sprint 22R) |

### 21.4 Qué NO se hizo (por diseño de este sprint)

- No se conectó `decision_support` a producción, al router, al composer, o al endpoint.
- No se activó ningún feature flag.
- No se modificó `intentClassifier.rules.ts` ni `intentCompatibilityAdapter.ts`.
- No se calibró vocabulario de `general_pm_advice`.
- No se implementó `DecisionDraft` reuse ni un clarification loop real.
- 5 colisiones del corpus de 45 casos quedan documentadas como brechas restantes (dc-25, dc-26,
  dc-32, dc-37, dc-40) — ninguna estaba en la lista de frases requeridas por este sprint.

### 21.5 Protección contra regresiones

- Golden corpus: `compatibilityRate` global **72.5%, sin cambios**; todas las categorías previamente
  calibradas sin cambios. Una entrada (`gpa-06`) actualizada por drift real, documentada.
- Sprint 17R: `policyAlignedRate` **74.3% → 82.9%** (movimiento esperado, sólo por decision_support
  boundary); `currentSystemAcceptableRate` 84.3%, `architectureGapCount` 10, `clarificationGapCount`
  10 — sin cambios.
- Sprint 18R: `currentSafeMappingRate` **64.6% → 84.8%**, `futureRouteAlreadySupportedRate`
  **49.4% → 84.8%** (ambos movimientos esperados); `requiresNewHandlerCount` 45,
  `requiresClarificationCount` 24, `existingRouteRegressions` 0 — sin cambios.
- Sprint 19R: código del handler sin modificar; su test suite de 54 tests sigue pasando sin cambios.

### 21.6 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs` — ok (99/99, nuevo).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs` — ok (52/52).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` — ok (54/54).
- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` — ok (51/51).
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` — ok (45/45).
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` — ok (46/46).
- Resto de `tests/playbook-engine-conversation-*.test.mjs` (brain-router, context-resolver,
  demo-scenarios, gateway, intent-classifier, response-composer) — sin cambios de comportamiento.
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados (módulos/tipos de Node/React/Next
  faltantes en todo el repo); cero errores nuevos en los archivos de este sprint (verificado con
  `grep` sobre la salida de `tsc --noEmit` filtrando por los paths tocados).
- `git diff --name-only` — confirma que no se tocó `intentClassifier.rules.ts`,
  `intentCompatibilityAdapter.ts`, el router, el composer, ningún handler productivo, ni el endpoint.

---

## 22. Sprint 22R — Clarification Response Strategy

> **Estado:** módulo aislado nuevo. Ver `git log` — este sprint agrega
> `src/lib/playbook-engine/conversation/clarification/` completo (tipos, analyzer, strategy,
> evaluator, barrel), `tests/fixtures/conversational-brain-clarification-response-cases.ts` (67
> casos), `tests/playbook-engine-conversation-clarification-response-strategy.test.mjs`,
> `docs/conversational-brain-clarification-response-strategy.md`, y esta sección; no modifica
> `intentClassifier.rules.ts`, `intent-patterns.ts`, `intentCompatibilityAdapter.ts`, el router, el
> composer, ningún handler productivo, ni el endpoint; no activa ningún feature flag.

### 22.1 Qué se creó

Siguiendo la recomendación de Sprint 21R ("Sprint 22R — Clarification Response Strategy", el gap
bucket más grande de los cuatro que rastrea `decisionSupportShadowMappingEvaluation.ts` una vez
calibrado el boundary de `decision_support`), este sprint construye la capacidad de respuesta que
faltaba para `needs_clarification`: dado un mensaje ambiguo, clasificarlo en uno de once
`ClarificationStrategyType`, inferir qué slots faltan (project, intent, source_context,
desired_output, owner, recipient, evidence, decision_options, urgency, timeframe,
action_authorization), sugerir rutas plausibles, y renderizar una pregunta aclaratoria estructurada
— todo puro, determinístico, sin LLM, sin red, sin DB.

### 22.2 Resultados obtenidos

| Métrica | Valor |
|---|---|
| `evaluatedClarificationCases` (corpus Sprint 18R `clarification_*` + Sprint 17R `ambiguous_clarification_candidate`) | 34 |
| `strategyCoverageRate` | **100%** |
| `acceptableResponseRate` | **100%** |
| `safetyPassRate` | **100%** |
| `routeOptionsCoverageRate` | **100%** |
| `overQuestioningCount` | **0** |
| `recommendedNextSprint` | **"Sprint 23R — Decision Support Adapter Mapping Plan"** |

### 22.3 Qué NO se hizo (por diseño de este sprint)

- No se implementó un clarification loop persistente/multi-turno — cada llamada es un turno único y
  sin estado.
- No se conectó la estrategia al router, composer, handlers, o endpoint.
- No se modificó el classifier de producción ni el mapeo del adapter.
- No se activó ningún feature flag.
- No se calibró vocabulario de `general_pm_advice`.
- No se creó un Context Resolver, Router, o Composer nuevos.

### 22.4 Protección contra regresiones

- Golden corpus: `compatibilityRate` global **72.5%, sin cambios**; todas las categorías previamente
  calibradas sin cambios.
- Sprint 17R: `policyAlignedRate` **82.9%**, `currentSystemAcceptableRate` **84.3%**,
  `architectureGapCount` **10**, `clarificationGapCount` **10** — sin cambios.
- Sprint 18R: `currentSafeMappingRate` **84.8%**, `futureRouteAlreadySupportedRate` **84.8%**,
  `requiresNewHandlerCount` **45**, `requiresClarificationCount` **24** — sin cambios.
- Sprint 19R: código del handler de decision-support sin modificar; su test suite de 54 tests sigue
  pasando sin cambios.
- Sprint 20R/21R: `candidateHandlerSafeRate` **100%**, `shadowRoutableRate` **40%**,
  `unsafeClassifierCollisionCount` **5** (playbook 0 / general_pm 1 / risk 2 / closure 1 /
  governance 0), `enrichedDecisionSupportDetectionRate` **88.9%**,
  `recommendedIntegrationMode` `do_not_integrate` — sin cambios.

### 22.5 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-clarification-response-strategy.test.mjs` — ok (77/77, nuevo).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs` — ok (99/99).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs` — ok (52/52).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` — ok (54/54).
- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` — ok (51/51).
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` — ok (45/45).
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` — ok (46/46).
- `npm run lint:aoc-boundaries` — pasó.
- `npm run typecheck` — mismos errores preexistentes no relacionados; cero errores nuevos en los
  archivos de este sprint.
- `git diff --name-only` — confirma que no se tocó `intentClassifier.rules.ts`,
  `intent-patterns.ts`, `intentCompatibilityAdapter.ts`, el router, el composer, ningún handler
  productivo, ni el endpoint.

### 22.6 Recomendación siguiente

Per el heurístico propio (sin modificar) del nuevo evaluador, el siguiente sprint debería ser
**Sprint 23R — Decision Support Adapter Mapping Plan**: con la calidad y seguridad de la respuesta de
clarificación ya sólidas en su primera corrida real, la brecha arquitectónica más grande que queda
abierta en esta serie es que `decision_support` todavía no tiene una ruta de producción real
(`recommendedIntegrationMode: do_not_integrate` de Sprint 21R, con `shadowRoutableRate` en 40%).

## 23. Sprint 23R — Decision Support Adapter Mapping Plan

> **Estado:** módulo aislado nuevo. Ver `git log` — este sprint agrega
> `src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlanTypes.ts`,
> `src/lib/playbook-engine/conversation/decision-support/decisionSupportAdapterMappingPlan.ts`,
> `tests/playbook-engine-conversation-decision-support-adapter-mapping-plan.test.mjs` (45 tests),
> `docs/conversational-brain-decision-support-adapter-mapping-plan.md`, esta sección, y actualiza el
> barrel aislado `decision-support/index.ts`; no modifica `intentClassifier.rules.ts`,
> `intent-patterns.ts`, `intentCompatibilityAdapter.ts`, el router, el composer, ningún handler
> productivo, ni el endpoint; no activa ningún feature flag.

### 23.1 Qué se creó

Siguiendo la recomendación propia de Sprint 22R ("Sprint 23R — Decision Support Adapter Mapping
Plan"), este sprint construye un planner/simulador offline que compara ocho estrategias candidatas
para cómo `intentCompatibilityAdapter.ts` podría eventualmente mapear `decision_support` (y
`needs_clarification`): `keep_unsupported`, `map_to_general_pm_advice`,
`map_to_recommendation_request`, `shadow_candidate_handler_only`, `feature_flag_default_off`,
`clarify_before_decision_support`, `hybrid_shadow_then_clarify`, y `do_not_map`. Reutiliza el
evaluador de sombra del Sprint 20R/21R y el candidate handler del Sprint 19R, además de la estrategia
de clarificación del Sprint 22R, contra el corpus de 79 casos del Sprint 18R — sin tocar ninguno de
esos módulos.

### 23.2 Resultados obtenidos

| Métrica | Valor |
|---|---|
| `totalCases` / `strategiesEvaluated` | 79 / 8 |
| `bestStrategy` | **`hybrid_shadow_then_clarify`** |
| `worstStrategy` | `map_to_general_pm_advice` |
| `safestNonProductionStrategy` / `safestFutureIntegrationStrategy` | `hybrid_shadow_then_clarify` / `hybrid_shadow_then_clarify` |
| `recommendedSprint24Strategy` | **`hybrid_shadow_then_clarify`** |
| `recommendedNextSprint` | **"Sprint 24R — Decision Support Shadow Mode Prep"** |

Ver `docs/conversational-brain-decision-support-adapter-mapping-plan.md` para la tabla comparativa
completa de las 8 estrategias.

### 23.3 Qué NO se hizo (por diseño de este sprint)

- No se modificó `intentCompatibilityAdapter.ts` ni su tabla de mapeo real.
- No se conectó `decision_support` al router, composer, handlers, o endpoint.
- No se activó ningún feature flag.
- No se ejecutó ninguna acción real — todos los 632 resultados simulados (79 casos × 8 estrategias)
  llevan `shouldExecuteAction: false`.
- No se implementó un clarification loop persistente/multi-turno.
- No se creó un Context Resolver, Router, o Composer nuevos.
- No se calibró vocabulario de `general_pm_advice`.

### 23.4 Protección contra regresiones

- Golden corpus: `compatibilityRate` global **72.5%, sin cambios**.
- Sprint 17R: `policyAlignedRate` **82.9%**, `currentSystemAcceptableRate` **84.3%** — sin cambios.
- Sprint 18R: `currentSafeMappingRate` **84.8%**, `futureRouteAlreadySupportedRate` **84.8%**,
  `requiresNewHandlerCount` **45**, `requiresClarificationCount` **24** — sin cambios.
- Sprint 19R: código del handler de decision-support sin modificar; su test suite de 54 tests sigue
  pasando sin cambios.
- Sprint 20R/21R: `candidateHandlerSafeRate` **100%**, `shadowRoutableRate` **40%**,
  `unsafeClassifierCollisionCount` **5** (playbook 0 / general_pm 1 / risk 2 / closure 1 /
  governance 0), `recommendedIntegrationMode` `do_not_integrate` — sin cambios.
- Sprint 22R: `acceptableResponseRate` **100%**, `safetyPassRate` **100%**,
  `routeOptionsCoverageRate` **100%**, `overQuestioningCount` **0** — sin cambios.

### 23.5 Verificación ejecutada

- `npx tsx --test tests/playbook-engine-conversation-decision-support-adapter-mapping-plan.test.mjs` — ok (45/45, nuevo).
- `npx tsx --test tests/playbook-engine-conversation-clarification-response-strategy.test.mjs` — ok (77/77).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-classifier-boundary.test.mjs` — ok (99/99).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-shadow-mapping.test.mjs` — ok (52/52).
- `npx tsx --test tests/playbook-engine-conversation-decision-support-candidate-handler.test.mjs` — ok (54/54).
- `npx tsx --test tests/playbook-engine-conversation-decision-clarification-architecture.test.mjs` — ok (51/51).
- `npx tsx --test tests/playbook-engine-conversation-general-pm-advice-boundary.test.mjs` — ok (45/45).
- `npx tsx --test tests/playbook-engine-conversation-intent-golden-evaluation.test.mjs` — ok (21/21).
- `npx tsx --test tests/playbook-engine-conversation-intent-compatibility.test.mjs` — ok (21/21).
- `npx tsx --test tests/conversational-brain-intent-classifier.test.mjs` — ok (32/32).
- `npx tsx --test tests/playbook-engine-conversation-intent-vocabulary-calibration.test.mjs` — ok (46/46).
- `npm run lint:aoc-boundaries` — pasó.
- `npx tsc --noEmit` repo-wide no pudo evaluarse (`node_modules` no está instalado en este entorno —
  preexistente, no relacionado); los dos archivos nuevos de este sprint, revisados de forma aislada,
  no producen ningún error de tipos.
- `git diff --name-only` — confirma que no se tocó `intentClassifier.rules.ts`,
  `intent-patterns.ts`, `intentCompatibilityAdapter.ts`, el router, el composer, ningún handler
  productivo, ni el endpoint.

### 23.6 Recomendación siguiente

Per el heurístico propio (sin modificar) del nuevo planner, el siguiente sprint debería ser
**Sprint 24R — Decision Support Shadow Mode Prep**: `hybrid_shadow_then_clarify` limpia todos los
umbrales de seguridad (0 outcomes inseguros, 0 riesgo crítico, 100% preservación de rutas existentes)
combinando el candidate handler en modo sombra para los casos con confianza alta/media y la estrategia
de clarificación para el resto — sin requerir ningún cambio de producción en este sprint.

## §24R — Decision Support Shadow Mode Prep

Sprint 24R construyó `decisionSupportShadowModePrep.ts`, el contrato técnico offline y determinístico
para correr `hybrid_shadow_then_clarify` en un futuro shadow mode: define qué inputs recibe, qué gates
de elegibilidad/seguridad aplica (12 gates, 8 bloqueantes), cuándo corre el Decision Support Candidate
Handler (Sprint 19R) vs. la Clarification Response Strategy (Sprint 22R), qué metadata captura, y qué
se devuelve a un caller offline. Contra el corpus del Sprint 18R (79 casos): `shadowEligibleCount` 69,
`decisionCandidateGeneratedCount` 18, `clarificationCandidateGeneratedCount` 51,
`existingRoutePreservedCount` 10, `acceptableShadowPrepRunRate` 100%, `allBlockingGatesPassedRate`
100%, y todos los conteos de side-effect (`shouldReturnCandidateToUser`/`shouldPersistShadowResult`/
`shouldExecuteAction`/`shouldSendEmail`/`shouldCreateTask`/`shouldWriteToDb`) en 0.
`recommendedNextSprint`: **"Sprint 25R — Decision Support Shadow Capture Harness"**. No se activó
shadow mode real, no se conectó `decision_support` al router, no se activó ningún feature flag, y no
se persistió ningún shadow output — ver
`docs/conversational-brain-decision-support-shadow-mode-prep.md` para el contrato completo.

## §25R — Decision Support Shadow Capture Harness

Sprint 25R construyó `decisionSupportShadowCaptureHarness.ts`, un harness offline/test-only/in-memory
que convierte un `DecisionSupportShadowModeRun` (Sprint 24R) en un capture record minimizado y
redactado: preview de input sanitizado + hash local (`sanitizeDecisionSupportShadowInput()` /
`createDecisionSupportShadowInputHash()`), resumen estructural del candidato (nunca el texto completo
de la recomendación o de la respuesta de clarificación), safety snapshot, y diez gates bloqueantes más
dos informativos. Dos modos: `dry_run` (default, nunca escribe a ningún lado) y
`test_only_in_memory` (requiere `allowInMemoryCaptureForTests: true` Y `policyAcknowledged: true`;
escribe a un sink en memoria, de un solo proceso, nunca a una base de datos real). Contra el corpus del
Sprint 18R (79 casos), en ambos modos: `acceptableCaptureRate` 100%, `allBlockingGatesPassedRate`
100%, `decisionCandidateCaptureCount` 18, `clarificationCandidateCaptureCount` 51,
`existingRouteCaptureCount` 10, y todos los conteos de retención/side-effect
(`rawInputRetainedCount`/`fullDecisionCandidateRetainedCount`/`fullClarificationCandidateRetainedCount`/
`userVisibleOutputRetainedCount`/`dbWriteAttemptedCount`/`supabaseWriteAttemptedCount`/
`shouldReturnCandidateToUserCount`/`shouldPersistShadowResultCount`/`shouldExecuteActionCount`) en 0.
`recommendedNextSprint`: **"Sprint 26R — Shadow Capture Storage Policy / Default-Off Persistence
Plan"**. No se escribió ninguna base de datos ni Supabase, no se mostró ningún capture record a un
usuario, no se retuvo input crudo ni candidatos completos, no se conectó `decision_support` al router,
y no se activó ningún feature flag — ver
`docs/conversational-brain-decision-support-shadow-capture-harness.md` para el contrato completo.

## §26R — Decision Support Shadow Capture Storage Policy / Default-Off Persistence Plan

Sprint 26R construyó `decisionSupportShadowCaptureStoragePolicy.ts`, una política pura,
offline/determinística — no una implementación de storage — que clasifica cada campo que un capture
record (Sprint 25R) podría llegar a cargar hacia un futuro storage persistente:
`allowed`/`prohibited`/`allowed_with_hashing`/`allowed_with_redaction`/`allowed_with_minimization`/
`allowed_only_test_memory`/`allowed_only_future_default_off`/`requires_explicit_policy_exception` (30
campos permitidos, 24 prohibidos explícitos + 3 reglas dinámicas de prohibición, 1 campo
[`inputPreview`] que requiere excepción explícita). Define una retention policy estricta
(`ephemeral_only`, 0 días hoy, propuesta futura de 7/30 días documentada pero no activada), una
deletion policy (`hardDeleteRequired`, sin soft delete, purga obligatoria de cualquier raw payload/full
candidate que aparezca por bug futuro), y un default-off persistence plan que nombra — sin implementar
— un futuro feature flag (`ENABLE_DECISION_SUPPORT_SHADOW_CAPTURE_STORAGE`, default `false`). Evalúa
21 readiness gates (14 bloqueantes, 5 de advertencia, 2 informativos) contra capture records reales del
harness Sprint 25R sobre el corpus del Sprint 18R (79 casos): `prohibitedFieldObservedCount` 0, todos
los conteos de violación (`rawInputViolationCount`/`fullCandidateViolationCount`/
`userVisibleOutputViolationCount`/`dbWriteViolationCount`/`supabaseWriteViolationCount`/
`sideEffectViolationCount`) en 0, `captureHarnessCleanRate` 100%, `blockingReadinessGateFailureCount`
0, `storageReadinessStatus` **`ready_for_storage_adapter_design`**. `recommendedNextSprint`: **"Sprint
27R — Shadow Capture Storage Adapter Plan"**. No se creó ninguna base de datos, migración, storage
adapter, ni cliente de Supabase; no se implementó ningún feature flag real; no se conectó
`decision_support` al router; no se cambió ningún comportamiento de producción — ver
`docs/conversational-brain-decision-support-shadow-storage-policy.md` para la política completa.

## §27R — Decision Support Shadow Capture Storage Adapter Plan

Sprint 27R construyó `decisionSupportShadowCaptureStorageAdapterPlan.ts`, un plan/contrato de adapter
puro, offline/determinístico — no una implementación — que diseña cómo sería un futuro Shadow Capture
Storage Adapter: nombra y policy-gatea sus 8 métodos (`validatePolicy`/`mapCaptureRecordToStorageDraft`/
`validateStorageDraft` implementados como funciones puras este sprint; `writeCaptureDraft`/
`deleteByCaptureId`/`deleteByWorkspace`/`purgeExpired`/`listByPolicyVersion` marcados `futureOnly`),
propone (sin crear) un schema de 21 columnas permitidas/minimizadas/hasheadas más 22 columnas
prohibidas explícitas para una tabla `decision_support_shadow_captures`, documenta (sin crear) una
migration proposal, mapea capture records reales del Sprint 25R a un storage draft policy-clean
reutilizando la política del Sprint 26R, valida ese draft contra 23 gates (15 bloqueantes, 8
informativos), y simula el contrato del adapter con un no-op que nunca escribe nada real. Contra el
corpus del Sprint 18R (79 casos): `totalDraftsCreated` 79, `validDraftRate` 100%, `invalidDraftCount`
0, todos los conteos de write/campo-prohibido (`writeAttemptedCount`/`realPersistenceAttemptedCount`/
`dbWriteAttemptedCount`/`supabaseWriteAttemptedCount`/`rawInputIncludedCount`/
`inputPreviewIncludedCount`/`fullCandidateIncludedCount`/`userVisibleOutputIncludedCount`/
`projectNameIncludedCount`/`emailAddressIncludedCount`/`phoneNumberIncludedCount`) en 0,
`migrationCreated`/`tableCreated`/`storageAdapterRealImplemented` en `false`, `readinessStatus`
**`ready_for_noop_adapter_implementation`** (dry_run) o **`ready_for_fake_adapter_implementation`**
(con pase `test_only_in_memory`). `recommendedNextSprint`: **"Sprint 28R — Shadow Capture Storage
Adapter Fake Implementation"**. No se creó ninguna base de datos, migración, archivo SQL, tabla,
storage adapter real, ni repository real; no se implementó ningún feature flag real; no se conectó
`decision_support` al router; no se cambió ningún comportamiento de producción — ver
`docs/conversational-brain-decision-support-shadow-storage-adapter-plan.md` para el plan completo.

## §28R — Decision Support Shadow Capture Storage Adapter Fake Implementation

Sprint 28R construyó `decisionSupportShadowCaptureStorageFakeAdapter.ts`, la primera implementación
real (aunque fake, solo en memoria) de los cinco métodos que el Sprint 27R dejó `futureOnly`:
`writeDraft`/`deleteByCaptureId`/`deleteByWorkspace`/`purgeExpired`/`listByPolicyVersion`, todos
implementados contra un array privado en memoria (`records`) que vive solo dentro del closure de una
instancia de adapter — nunca una base de datos, migración, tabla, o cliente de Supabase.
`writeDraft()` revalida cada draft con el validador del Sprint 27R, re-chequea de forma independiente
(defensa en profundidad) los nueve campos prohibidos y cualquier campo dentro de `draft.fields`
clasificado como `"prohibited"` por `classifyDecisionSupportShadowStorageField()` (Sprint 26R,
reutilizado directamente), y rechaza `storageEnabled`/`realPersistenceAllowed: true` como una
violación de política distinta de una violación de contenido. Contra el corpus del Sprint 18R (79
casos): `fakeWriteAttemptCount`/`fakeWriteAcceptedCount` 79/79, `fakeWriteRejectedCount` 0,
`fakeWriteAcceptedRate`/`validDraftRate` 100%/100%, `invalidDraftRejectedCount` 11 (de 11 drafts
inválidos sintéticos escritos y rechazados en cada evaluación),
`policyViolationRejectedCount` 2, todos los conteos real/db/supabase/external/forbidden-content-stored
en 0, `fakeAdapterSafetyRate` 100%, `readinessStatus` **`ready_for_persistence_readiness_review`**.
`recommendedNextSprint`: **"Sprint 29R — Shadow Capture Storage Adapter Persistence Readiness
Review"**. No se creó ninguna base de datos, migración, archivo SQL, tabla, storage adapter real, ni
repository real — cada registro almacenado vive únicamente en el closure de una instancia de adapter y
desaparece al llamar `clear()` o al terminar el proceso; no se implementó ningún feature flag real; no
se conectó `decision_support` al router; no se cambió ningún comportamiento de producción — ver
`docs/conversational-brain-decision-support-shadow-storage-fake-adapter.md` para el adapter fake
completo.
