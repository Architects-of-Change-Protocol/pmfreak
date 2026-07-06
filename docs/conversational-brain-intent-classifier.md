# Conversational Brain — Intent Classifier (Sprint 9)

> **Estado:** implementado como módulo puro y standalone en `src/lib/conversational-brain/`. No está cableado a ningún endpoint ni a la pieza equivalente ya existente en `src/lib/playbook-engine/conversation/` (ver §6).

## 1. Propósito

El Intent Classifier es la primera pieza del bloque Conversational Brain que corre después del Conversation Gateway (Sprint 8). Toma el input normalizado de una sola vuelta de conversación y devuelve una **intención estructurada**: familia, tipo, confianza, señales detectadas, banderas de riesgo/aprobación y rutas candidatas — sin resolver contexto de proyecto, sin decidir una ruta final, y sin ejecutar nada.

## 2. Arquitectura

```
NormalizedConversationInput (Sprint 8: workspaceId, userId, projectId?, threadId?, message, attachments?)
        │
        ▼
classifyConversationIntent()
        │  1. normalizeIntentText() — minúsculas, sin acentos, sin puntuación
        │  2. scoreFamilies() — evalúa cada familia contra INTENT_FAMILY_PATTERNS
        │  3. pickWinningFamily() — score máximo + tie-break determinístico
        │  4. pickIntentType() — tipo de la señal de mayor peso dentro de la familia ganadora
        │  5. flags (requiresProjectContext, requiresEvidence, mayRequireApproval, ...)
        │  6. missingClarifications (si aplica)
        ▼
IntentClassificationResult { intent: ConversationIntent, normalizedMessage, familyScores }
```

Archivos:

| Archivo | Responsabilidad |
|---|---|
| `intent-classifier-types.ts` | Todos los tipos: `ConversationIntentFamily`, `ConversationIntentType`, `IntentConfidence`, `CandidateRoute`, `IntentSignal`, `MissingClarification`, `ConversationIntent`, `IntentClassificationResult`. |
| `intent-patterns.ts` | `INTENT_FAMILY_PATTERNS` (reglas por familia, pesos 5/3/1) y `normalizeIntentText()`. |
| `intent-classifier.ts` | `classifyConversationIntent()` — scoring, tie-break, flags, clarifications. |
| `explain.ts` | `explainIntentClassifierCapability()` — explicación de capacidad para debug/demo. |
| `index.ts` | Barrel export. |

## 3. Intent families

| Familia | requiresProjectContext | requiresEvidence | mayRequireApproval | candidateRoutes |
|---|---|---|---|---|
| `general_pm_advice` | no | no | no | `general_pm_advisor` |
| `project_status` | sí | sí | no | `project_brain` |
| `playbook_analysis` | sí | sí | no | `playbook_engine` |
| `communication_draft` | sí | no | sí | `communications_engine` |
| `closure_billing` | sí | sí | sí | `closure_billing_engine` |
| `governance_audit` | sí | sí | no | `governance_engine` |
| `risk_issue_dependency` | sí | sí | no | `project_brain` |
| `decision_support` | sí | sí | no | `playbook_engine`, `governance_engine` |
| `task_action` | sí | no | sí | `task_action_engine` |
| `needs_clarification` | no | no | no | `clarification` |
| `unknown` | no | no | no | `unsupported` |

`isActionRequest` es `true` únicamente para `task_action`. `isExternalCommunicationRequest` es `true` únicamente para `communication_draft`. `isReadOnly` es `true` para todas las familias salvo `task_action`.

## 4. Intent types

Cada familia real (todas menos `needs_clarification`/`unknown`) tiene 3-6 tipos específicos definidos en `intent-classifier-types.ts` (p. ej. `closure_billing` → `billing_blocker_check | billing_readiness_check | closure_readiness_check | reception_status_check | acceptance_status_check`). Ver el archivo de tipos para la lista completa por familia. `clarification_needed` y `unrecognized_intent` son tipos de reserva usados solo cuando no hubo ninguna señal (score 0).

## 5. Scoring, confidence y tie-breaking

- Cada patrón tiene peso **5** (señal fuerte/frase explícita), **3** (señal media/palabra genérica) o **1** (señal débil).
- El score de una familia es la suma de los pesos de todos sus patrones que matchean el mensaje normalizado.
- Confidence a partir del score de la familia ganadora: `>=7` → `high`, `4-6` → `medium`, `1-3` → `low`, `0` → `unknown`.
- **Tie-break** (solo si dos o más familias empatan en el score máximo): `task_action` > `communication_draft` > `closure_billing` > `playbook_analysis` > `project_status`. Si el empate no involucra a ninguna de esas familias, el resultado es `needs_clarification` (con `confidence: "low"`, para reflejar que hubo señales pero conflictivas).
- Si ninguna familia obtuvo score (mensaje sin ningún patrón conocido): mensajes de ≤3 palabras se clasifican como `needs_clarification` (mensaje demasiado corto/ambiguo); mensajes más largos se clasifican como `unknown`.

## 6. Missing clarifications

Si `requiresProjectContext` es `true` y `normalizedInput.projectId` no está presente, se agrega:

```json
{ "type": "missing_project", "message": "Necesito saber de qué proyecto estás hablando para continuar." }
```

Esto **no bloquea** la clasificación — el Context Resolver (próximo sprint) es quien decide si es seguro rutear (`safeToRoute`) con o sin ese contexto.

## 7. Relación con el pipeline ya existente

Este repo ya tiene, desde Sprint 8 (commit `253f6d1`), un pipeline conversacional **completo y cableado a producción** en `src/lib/playbook-engine/conversation/` (classifier → context resolver → router → composer → handlers), usado en vivo por `POST /api/command-center/chat`. Ese clasificador usa un modelo de intents más simple (11 categorías planas, sin familias/tipos/candidateRoutes/scoring por pesos documentado).

El módulo de este sprint (`src/lib/conversational-brain/`) es **intencionalmente independiente**: implementa el modelo más granular pedido para Sprint 9 (familias + tipos + candidate routes + missing clarifications estructuradas) sin tocar ni reemplazar el pipeline existente. Consolidar ambos — o migrar el pipeline existente a este modelo más rico — es una decisión de producto pendiente, fuera del alcance de este sprint.

## 8. Límites (qué NO hace este sprint)

- No resuelve contexto de proyecto (Context Resolver es el próximo sprint).
- No decide una ruta final (`candidateRoutes` es solo sugerencia por familia).
- No llama adaptadores de dominio ni compone respuestas.
- No usa un LLM externo — 100% determinístico, basado en patrones de texto (regex sobre texto normalizado).
- No lee ni escribe en base de datos, no llama a Supabase, no hace fetch de red.
- No envía correos, no crea tareas, no escribe RAID ni decisiones, no ejecuta ninguna acción.

## 9. Próximos sprints

- **Sprint 10 — Context Resolver:** dado un `ConversationIntent` + el `NormalizedConversationInput`, resuelve qué evidencia de proyecto está realmente disponible y decide `safeToRoute`.
- **Sprint 11 (o posterior) — Route Decision:** traduce `candidateRoutes` + el contexto resuelto en una decisión de ruteo final hacia uno de los 7 dominios (General PM Advisor, Project Brain, Playbook Engine, Communications Engine, Closure/Billing Engine, Governance Engine, Task/Action Engine).
