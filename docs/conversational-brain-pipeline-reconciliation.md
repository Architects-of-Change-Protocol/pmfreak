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
