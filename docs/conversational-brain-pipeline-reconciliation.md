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
