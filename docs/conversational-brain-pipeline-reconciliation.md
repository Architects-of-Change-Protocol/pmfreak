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
