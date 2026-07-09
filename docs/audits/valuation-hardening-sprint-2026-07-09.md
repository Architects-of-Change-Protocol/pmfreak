# Valuation Hardening Sprint — PMFreak

**Fecha:** 2026-07-09
**Rol:** CTO / Product Auditor / Technical PM
**Horizonte:** 30 días
**Insumo:** auditoría de valoración previa (auth, Supabase, RLS multi-tenant, Stripe, APIs core y Command Center tienen valor real; código huérfano, mocks, documentación ruido, tests superficiales y naming sobrevendido bajan el valor defendible).

Este documento convierte esa auditoría en un plan ejecutable. Todo lo citado abajo fue verificado directamente en el repo en la fecha de este documento (rutas de archivo reales, no genéricas). No se agregó ninguna feature nueva; este es un plan de *hardening*.

---

## 1. Veredicto de enfoque

**NO hacer todavía:**

- No construir features nuevas (ni "agentes reales", ni nuevos módulos de IA, ni nuevas superficies de producto). El repo ya tiene ~90 subsistemas en `src/lib/*` con nombres ambiciosos (`constitutional-*`, `operational-*`, `governance-*`); la mitad no tiene ninguna referencia desde `src/app`. Agregar más antes de consolidar aumenta la deuda, no el valor.
- No completar el "AOC enterprise runtime" hasta el 100% de lo documentado en `docs/audits/enterprise-runtime-sovereignty-audit-2026-05-17.md` (hoy ~38% completo según esa misma auditoría). Terminarlo es trabajo de producto, no de hardening de valoración.
- No conectar los 5 módulos de IA que hoy están en `mode: "mock"` (`src/lib/ai/gateway/registry.ts`) a un LLM real todavía — eso es una feature nueva (con costo, latencia, prompt-eng, y riesgo), no un fix de honestidad. Lo urgente es que dejen de aparentar ser reales.
- No reescribir los 137 archivos de migración para "arreglar" la duplicación de esquema en este sprint — es riesgo de datos. Este sprint solo audita y propone el plan (PR7); la migración en sí es un sprint aparte.
- No perseguir cobertura de tests al 100%. El objetivo es que las rutas críticas (auth, RLS, Stripe webhook, un flujo end-to-end) tengan *al menos un* test de comportamiento real, no reescribir los ~400 archivos de test existentes.

**SÍ priorizar:**

1. **Honestidad de la demo**: todo lo que hoy se presenta como "live"/"AI"/"agente" pero es mock, debe decir que es mock (o dejar de mostrarse en producción). Esto es lo que más rápido puede tumbar una valuation si un comprador técnico lo descubre solo.
2. **Mapa de qué está vivo vs. muerto**: sin esto, cualquier due diligence técnico va a sobreestimar el esfuerzo de mantenimiento y subestimar la calidad real, porque no puede distinguir 90 módulos activos de 40 módulos fantasma.
3. **Cerrar el único gap de seguridad real encontrado**: protección de rutas dependiendo 100% de que cada uno de los 517 route handlers en `src/app/api` recuerde llamar su propio guard, sin middleware ni red de seguridad central.
4. **Que la narrativa (README, copy de producto, nombres de módulos) dejen de prometer más de lo que el código entrega hoy** — especialmente el tono "sistema de defensa militar" señalado en `PM_LANGUAGE_SOFTENING.txt` y el uso de "AI-powered" en el README cuando 5 de 6 módulos de IA están en modo mock.
5. **Proteger, sin tocar, lo que sí genera valor real**: Supabase Auth, las 148 policies de RLS sobre 61 tablas, la separación client/server/admin (que hoy está bien hecha), Stripe, y el núcleo de Command Center que sí lee datos reales.

---

## 2. Áreas que reducen valuation

| Área | Problema | Por qué reduce valuation | Severidad | Acción recomendada |
|---|---|---|---|---|
| Código huérfano | ~45 subsistemas bajo `src/lib/*` (p. ej. `constitutional-workspace`, `operational-decision`, `personal-memory`, `intelligence-bridge` — 0 referencias en todo `src`; más `conversational-brain` (5 archivos) y `src/features/enterprise-ux` (26 archivos), `src/aoc/enterprise` (21 archivos), sin ninguna referencia desde `src/app`) | Un comprador/inversor técnico que audite el repo va a contar LOC y complejidad aparente muy por encima del producto real; también implica riesgo de mantenimiento fantasma (nadie sabe si se puede borrar) | Alta | PR1: inventariar, marcar `@status: orphaned` o mover a `archive/`, borrar lo que no tenga valor de referencia |
| Mocks / hardcoding | `src/app/api/intelligence/operational-live/route.ts` devuelve `mode: "live_telemetry_mock"` consumido en vivo por el dashboard; `follow-up-dashboard-client.tsx` tiene comentarios y "confidence scores" (`0.85, 0.84...`) tecleados directo en JSX; `src/lib/ai/gateway/registry.ts` tiene 5/6 módulos de IA en `mode: "mock", productionReady: false` | Un demo o dashboard que aparenta datos en vivo/IA real cuando son constantes fijas es el hallazgo más dañino posible en due diligence — es la diferencia entre "MVP honesto" y "fraude de producto" a ojos de un inversionista | Crítica | PR2: etiquetar visiblemente todo mock en UI ("Datos de demostración"), remover confidence scores fantasma, o apagar el feature en producción hasta que sea real |
| Módulos decorativos | Los "agentes" del Command Center (Risk Sentinel, Task Builder, Commitment Tracker, Document Librarian, Executive Briefing, Governance Guard) solo mapean conteos de BD a copy/badges fijos vía `deriveAgents()` (`operational-data.ts:139`) — no hay razonamiento ni llamada a LLM | El naming "agente" implica autonomía/IA; lo real es una función de mapeo determinística. Esto es sobreventa de producto, no un bug | Alta | PR2/PR6: renombrar a lo que son ("indicadores operativos") o marcarlos explícitamente como reglas, no agentes |
| Scripts de check superficiales | `scripts/run-launch-smoke-tests.mjs` (ejecutado por `npm run test:launch-smoke`, fuera del `npm test` de CI) solo hace `readFileSync` + `assert.match` sobre 3 archivos fuente — nunca ejecuta código real (ej. "health endpoint exists" solo verifica que el string `status: "ok"` aparezca en el archivo) | Da falsa sensación de que hay smoke tests de lanzamiento cuando en realidad es un grep disfrazado de test | Media | PR5: reemplazar por un smoke test real que levante el endpoint y verifique la respuesta |
| Documentación ruido | 292 archivos `.md` en el repo, 96 solo en `docs/architecture/` — nombres de diseño hiper-específicos (`agent-controlled-execution-finalization-adapter-dispatch-gate.md`) que documentan features aisladas en vez de arquitectura curada. No hay un solo `VALUATION_READINESS.md`, y `ARCHITECTURE.md` real no existe en la raíz | Un revisor técnico no puede formarse un modelo mental del sistema; 292 archivos también inflan la percepción de "documentación completa" cuando es sprawl de sesiones de desarrollo, no curación | Alta | PR4: curar 5 documentos maestros, archivar el resto bajo `docs/archive/design-notes/` |
| Tests regex-only | De ~399 archivos en `tests/`, una fracción significativa (`db-schema-contract.test.mjs`, `auth-redirect-resolution.test.mjs`, `dashboard-authorization-enforcement-runtime.test.mjs`, etc.) solo leen archivos fuente como texto y hacen `assert.match`/`doesNotMatch` contra regex — nunca ejecutan el código real | CI puede estar 100% verde mientras el flujo de auth, RLS, y el webhook de Stripe (`src/app/api/billing/webhook/route.ts`, **cero referencias en `tests/`**) están efectivamente sin verificar en tiempo de ejecución | Crítica | PR5: convertir una muestra crítica (auth, RLS, Stripe webhook, 1 API core) a tests de comportamiento real |
| Falta de middleware | No existe `middleware.ts`. La protección de páginas depende del layout `(protected)`; los 517 `route.ts` bajo `src/app/api` deben auto-protegerse cada uno llamando `requireAuthenticatedUser()`/`getAuthUser()`. Ya se encontraron 2 rutas sin guard (`/api/debug-auth`, `/api/route-debug` — bajo riesgo pero confirman el patrón) | Modelo "confía en cada archivo": cualquier ruta nueva que un desarrollador olvide proteger queda expuesta sin red de seguridad central — esto es exactamente el tipo de brecha que un auditor de seguridad de un comprador encontraría en la primera hora | Alta | PR3: agregar middleware o un chequeo automatizado de "toda ruta bajo /api debe importar un guard conocido" |
| Duplicación de esquema | `operational_memory_records` se crea en dos migraciones distintas; 6 tablas de "memoria" distintas (`operational_memory_entries`, `operational_memory_records`, `organizational_memory`, `constitutional_memory_records`, `personal_pm_memory`, `agent_memory_records`); 4 tablas de "intervention"; ≥5 subsistemas de "pattern" casi idénticos; 3 sistemas de audit log paralelos (`security_events`, `governance_audit_events`, `agent_audit_events`) | Un DBA o comprador técnico revisando el esquema va a ver re-modelado del mismo concepto una y otra vez — señala falta de disciplina de diseño y aumenta el costo de cualquier migración futura | Alta | PR7: auditar y proponer plan de consolidación (sin ejecutar la migración todavía) |
| Brecha UI mockup vs. producto real | Command Center sirve `DEMO_AGENTS`/`DEMO_CHAT`/proyectos falsos (`Banrural`, `MEP`, `Max Peralta`) desde `src/features/command-center/demo-data.ts` cuando `hasRealData` es falso, sin distinguir claramente para el usuario que está viendo datos de ejemplo | Un prospecto o inversionista que navegue la demo puede confundir datos de ejemplo con producto en producción — riesgo reputacional y legal si se usa en ventas | Alta | PR2: banner explícito de "modo demostración" en cualquier vista con `demo-data.ts` |
| Naming IA/agentic no alineado | README dice "AI-powered copilot" para planes Pro/Enterprise; en la práctica solo 1 de 6 módulos de IA (`message-nudges`) llama a un LLM real (OpenAI vía `fetch` crudo); el proveedor `"anthropic"` está declarado en `provider-registry.ts` pero sin adaptador registrado (`router.ts`: "adapters not yet registered"), sin dependencia `anthropic` en `package.json` | Vender "AI-powered" cuando 83% de los módulos de IA son mocks es el tipo de discrepancia que un comprador técnico o inversionista descalifica de inmediato al hacer due diligence | Crítica | PR6: alinear copy con estado real; marcar cada módulo de IA como Disponible/Beta/Mock explícitamente en producto y en docs |
| Transferibilidad baja | Sin `ARCHITECTURE.md`, sin `MODULE_STATUS.md`, sin guía de "cómo correr esto localmente sin el founder" — el conocimiento de qué está vivo, qué es mock, y qué es huérfano vive solo en la cabeza de quien escribió el código | El valor de un repo cae fuertemente si depende de una sola persona para ser entendido y extendido — es un riesgo de llave-en-mano para cualquier adquisición | Alta | PR8: paquete de transferibilidad (setup, arquitectura, module status, runbook) |

---

## 3. Activos que debemos proteger

| Activo | Valor | Riesgo | Cómo protegerlo |
|---|---|---|---|
| Supabase Auth | Alto — flujo de auth real, usado por 70+ archivos bajo `src/lib/auth` | Que el hardening de rutas (PR3) introduzca middleware que rompa el flujo de sesión basado en cookies | Cambios de PR3 deben ser aditivos (capa de verificación extra), nunca reemplazar `requireAuthUser()`/el layout `(protected)`; correr el flujo de login/logout manualmente antes y después de cada cambio |
| RLS multi-tenant | Alto — 148 `CREATE POLICY` sobre 61 tablas, con al menos 3 pasadas de "hardening" dedicadas (`20260514143000_rls_tenant_hardening.sql`, `20260515100000_rls_governance_fixes.sql`, `20260627000001_authority_registry_hardening.sql`) | Que PR7 (consolidación de esquema) toque tablas con policies activas sin re-crear las policies en la tabla consolidada | PR7 es solo de *auditoría y propuesta* este sprint — ninguna migración de consolidación se ejecuta sin un checklist explícito de policies a preservar |
| Separación client/server/admin | Alto — ya está bien implementada: `supabase/admin.ts` exige `PrivilegedAccessContext` y llama `logSecurityEvent("privileged_client_used", ...)` en cada instanciación; no se encontró la service-role key en ningún archivo `"use client"` | Que una futura feature client-side importe accidentalmente el admin client | Agregar un lint rule / check de CI que falle si `admin.ts` o `SUPABASE_SERVICE_ROLE_KEY` aparecen en un archivo con `"use client"` |
| Logging de privileged access | Medio-Alto — existe y es automático (`logSecurityEvent`), pero triplicado (`security_events`, `governance_audit_events`, `agent_audit_events`) | Que la consolidación de PR7 elimine sin querer uno de los tres sistemas y se pierda historial de auditoría | Tratar los 3 audit logs como "activo a fusionar, no a borrar" — el plan de PR7 debe proponer una vista unificada antes de tocar las tablas fuente |
| Stripe billing | Alto — webhook maneja `Stripe.Subscription`, `constructEvent`, idempotencia vía `tryRecordProcessedBillingWebhookEvent`, pero **0 tests** lo cubren | Que un cambio futuro rompa el webhook sin que ningún test lo detecte — es dinero real | PR5 agrega al menos un test que construya un evento Stripe simulado y ejercite la ruta completa antes de tocar nada más en billing |
| APIs core | Alto — 517 route handlers, la mayoría con guards correctos | Que el endurecimiento de middleware (PR3) rompa rutas públicas intencionales (`/api/health`, `/api/login`, `/api/build-info`, `/api/billing/webhook`) | PR3 debe incluir una allowlist explícita y versionada de rutas públicas, revisada por un humano, no inferida automáticamente |
| Dashboard | Medio-Alto — partes leen datos reales; partes (follow-up dashboard) mezclan datos reales con mocks sin distinguir | Que limpiar mocks (PR2) rompa la parte que sí es real | Separar explícitamente, componente por componente, qué está en modo real vs. mock antes de tocar código (usar el inventario de PR1) |
| Projects | Alto — datos reales conectados a Supabase | Ninguno identificado directamente en esta ronda de investigación | Incluir en el smoke test de PR5 como flujo núcleo |
| Command Center | Alto — la lógica base (`command-center-client.tsx`, rutas `/api/copilot`, `/context`, `/memory`) sí lee `OperationalGovernanceBrief` real; el riesgo está en los "agentes" decorativos y `demo-data.ts`, no en el núcleo | Que al limpiar lo decorativo (PR2/PR6) se rompa la parte real que sí agrega valor | Separar quirúrgicamente: renombrar/etiquetar lo decorativo, no tocar `command-center-client.tsx` ni las rutas API reales |
| Governance core | Medio-Alto — 148 policies y 60+ migraciones de governance muestran inversión real, pero con duplicación conceptual fuerte (governance/constitutional/authority-registry) | Que la auditoría de esquema (PR7) se lea como "borrar governance" en vez de "consolidar naming" | El mensaje interno y externo debe ser: gobernanza es un activo, el problema es que está modelada 3 veces, no que no exista |
| Copilot real | Medio — rutas reales existen (`/api/copilot/*`), pero solo 1 de 6 módulos de IA llama a un LLM real (`message-nudges` vía OpenAI) | Sobreventa como "AI-powered copilot" en README cuando la mayoría es mock | PR6 debe reetiquetar el copiloto real vs. los módulos en mock sin apagar el que sí funciona |
| Lógica PM/PMO con datos reales | Alto — `pm-capacity`, `pm-performance`, `pm-registry`, `pmo-executive-reporting` tienen referencias reales desde `src/app` (5-7 cada uno) | Que se confunda con los subsistemas huérfanos `constitutional-*`/`operational-*` durante la limpieza de PR1 | El inventario de PR1 debe basarse en referencias reales medidas (import graph), no en similitud de nombre |

---

## 4. PRs recomendados del sprint

### PR 1 — Repo Reality Map

- **Objetivo:** inventario verificable de qué está vivo, huérfano, experimental o archivable.
- **Problema que resuelve:** hoy nadie puede distinguir, sin grepear manualmente, cuáles de los ~90 subsistemas en `src/lib/*` están conectados a `src/app` y cuáles no.
- **Archivos/carpetas probables:** nuevo `scripts/check-module-liveness.mjs` (grafo de imports desde `src/app` hacia `src/lib`, `src/features`, `src/aoc`); salida a `docs/MODULE_STATUS.md`.
- **Qué debe cambiar:** se agrega el script y el reporte generado; ningún módulo se borra en este PR.
- **Qué NO debe cambiar:** cero código de producto. Este PR es puramente de análisis y tooling.
- **Criterios de aceptación:** el script corre en CI (o vía `npm run check:module-liveness`) y produce una tabla con columnas `módulo | referencias desde src/app | referencias transitivas | veredicto (vivo/huérfano/no determinado)`; cubre al menos los 45+ subsistemas ya identificados como sospechosos (`constitutional-workspace`, `operational-decision`, `personal-memory`, `intelligence-bridge`, `conversational-brain`, `src/features/enterprise-ux`, `src/aoc/enterprise`, el subsistema de 38 archivos en `decision-support`, etc.).
- **Tests requeridos:** test unitario del script contra un mini-repo fixture con casos conocidos (módulo importado, módulo huérfano, módulo importado solo transitivamente).
- **Riesgo:** bajo — solo lectura de código.
- **Impacto esperado en valuation:** alto — es el prerequisito de todos los demás PRs y la primera evidencia concreta de disciplina técnica para un revisor externo.

### PR 2 — Demo Integrity Cleanup

- **Objetivo:** que ningún dato hardcodeado se presente como real/en vivo/IA sin etiqueta.
- **Problema que resuelve:** `operational-live/route.ts` devuelve `mode: "live_telemetry_mock"` consumido silenciosamente por el dashboard; `follow-up-dashboard-client.tsx` tiene confidence scores tecleados en JSX; 5/6 módulos de `ai/gateway/registry.ts` están en `mode: "mock"`; `command-center/demo-data.ts` sirve proyectos y chats falsos.
- **Archivos/carpetas probables:** `src/app/api/intelligence/operational-live/route.ts`, `src/features/follow-up/follow-up-dashboard-client.tsx`, `src/lib/ai/gateway/registry.ts`, `src/lib/ai/gateway/gateway.ts`, `src/lib/ai/mock-data.ts`, `src/features/command-center/demo-data.ts`, `src/features/command-center/command-center-layout.tsx`.
- **Qué debe cambiar:** cada respuesta/UI que use datos mock debe (a) mostrar una etiqueta visible "Datos de demostración" / "Modo simulado", y (b) el payload debe declarar explícitamente `mode: "mock"` de forma consistente (ya existe el patrón en `operational-live`, hay que generalizarlo). Los confidence scores hardcodeados en JSX se mueven a un archivo de fixture claramente nombrado `*.demo-fixture.ts`.
- **Qué NO debe cambiar:** no se conecta ningún módulo mock a un LLM real (eso es feature nueva, fuera de este sprint); no se borra `demo-data.ts` — sigue siendo útil para desarrollo/ventas, solo debe quedar inconfundiblemente etiquetado.
- **Criterios de aceptación:** ningún componente de producción puede renderizar datos de `demo-data.ts` o de un módulo `mode: "mock"` sin un badge visible; grep de CI que falle si aparece un nuevo uso de `mock-data.ts`/`demo-data.ts` sin el badge asociado.
- **Tests requeridos:** test de UI (render) que verifique que el badge de "modo demostración" aparece cuando `hasRealData` es falso o cuando `mode === "mock"`.
- **Riesgo:** medio — toca componentes visibles; verificar manualmente en navegador antes de mergear.
- **Impacto esperado en valuation:** crítico — es la mitigación directa del riesgo de mayor severidad (mocks presentados como reales).

### PR 3 — Route Protection Hardening

- **Objetivo:** dejar de depender únicamente de que cada uno de los 517 `route.ts` recuerde llamar su propio guard.
- **Problema que resuelve:** no existe `middleware.ts`; ya se confirmaron 2 rutas sin guard (`/api/debug-auth`, `/api/route-debug`, bajo riesgo hoy pero evidencia del patrón).
- **Archivos/carpetas probables:** nuevo `src/middleware.ts`; o alternativamente `scripts/check-api-route-guards.mjs` corriendo en CI.
- **Qué debe cambiar:** agregar una capa central (middleware de Next.js, o un chequeo estático en CI) que verifique que todo archivo bajo `src/app/api/**/route.ts` importa uno de los guards conocidos (`requireAuthenticatedUser`, `getAuthUser`) o está en una allowlist explícita y versionada de rutas públicas (`/api/health`, `/api/login`, `/api/build-info`, `/api/billing/webhook`, etc.).
- **Qué NO debe cambiar:** el mecanismo de auth de páginas vía el layout `(protected)` sigue igual; no se reemplaza `requireAuthUser()`; no se toca la lógica interna de cada guard, solo se agrega la verificación de que se está llamando.
- **Criterios de aceptación:** el chequeo falla en CI si una ruta API nueva no llama ningún guard conocido y no está en la allowlist; `/api/debug-auth` y `/api/route-debug` quedan explícitamente en la allowlist (documentando que solo devuelven datos de sesión propia/build info) o se les agrega el guard si se decide que no deberían ser públicas.
- **Tests requeridos:** test que simula agregar una ruta sin guard y confirma que el check la detecta; test de regresión que confirma que las rutas protegidas existentes siguen pasando.
- **Riesgo:** medio — un middleware mal configurado puede romper rutas legítimas; probar manualmente login, logout, y 3-5 rutas API críticas antes de mergear.
- **Impacto esperado en valuation:** alto — cierra el único gap de seguridad arquitectónico real encontrado en esta investigación.

### PR 4 — Documentation Reset

- **Objetivo:** documentación curada y honesta en vez de 292 archivos de diseño sin jerarquía.
- **Problema que resuelve:** no existe `ARCHITECTURE.md` en la raíz; 96 archivos en `docs/architecture/` documentan features individuales sin un mapa general; no existe ningún documento de valuation/production readiness.
- **Archivos/carpetas probables:** `README.md`, nuevo `ARCHITECTURE.md`, `PRODUCTION_READINESS.md`, `VALUATION_READINESS.md`, `MODULE_STATUS.md` (generado por PR1), `docs/archive/design-notes/` (destino de los 96+ archivos de diseño puntual).
- **Qué debe cambiar:** los 5 documentos maestros se crean/actualizan; los archivos de `docs/architecture/` que documentan una feature específica ya implementada se mueven a `docs/archive/design-notes/` con un índice que explique qué son (no se borran — tienen valor histórico).
- **Qué NO debe cambiar:** los audits reales existentes (`docs/audits/*.md`) permanecen donde están, no se archivan (son evidencia de proceso serio); AGENTS.md/CLAUDE.md no se tocan.
- **Criterios de aceptación:** un desarrollador nuevo puede leer README + ARCHITECTURE.md + MODULE_STATUS.md en menos de 30 minutos y entender qué está vivo, qué es mock, y cómo correr el proyecto; `docs/architecture/` baja de 96 a un número manejable (<20) de documentos vigentes.
- **Tests requeridos:** ninguno de código; validación manual de que los links internos entre documentos no queden rotos (`scripts/check-doc-links.mjs` opcional).
- **Riesgo:** bajo — es reorganización de docs, reversible con git.
- **Impacto esperado en valuation:** alto — directamente aborda "transferibilidad baja" y "documentación ruido".

### PR 5 — Test Quality Upgrade

- **Objetivo:** que las rutas críticas tengan verificación de comportamiento real, no solo coincidencia de texto.
- **Problema que resuelve:** gran parte de los ~399 archivos en `tests/` son regex-only (`db-schema-contract.test.mjs`, `auth-redirect-resolution.test.mjs`, etc.); el webhook de Stripe (`src/app/api/billing/webhook/route.ts`) tiene **cero** tests; no hay ningún test que ejecute un flujo de auth, RLS, o una ruta API completa.
- **Archivos/carpetas probables:** `tests/billing-webhook.test.mjs` (nuevo), conversión selectiva de `tests/auth-redirect-resolution.test.mjs` y `tests/db-schema-contract.test.mjs` a pruebas que ejecuten código real, nuevo `tests/smoke-core-flow.test.mjs`.
- **Qué debe cambiar:** se agrega al menos 1 test que construya un evento Stripe simulado y ejecute la ruta de webhook real (`POST` handler) verificando el efecto en BD/idempotencia; se convierte una muestra crítica (2-3 archivos) de regex-only a llamadas reales a las funciones/rutas que dicen probar; se agrega 1 smoke test de extremo a extremo del flujo núcleo (login → ver dashboard → ver un proyecto).
- **Qué NO debe cambiar:** no se reescriben los ~400 archivos existentes; los tests regex-only que sirven como "contratos estructurales" (ej. verificar que una migración no reintroduce un bug ya corregido) pueden quedarse, pero deben re-etiquetarse como `*-contract.test.mjs` para distinguirlos de tests de comportamiento (convención que ya existe parcialmente y hay que hacer consistente).
- **Criterios de aceptación:** `npm test` sigue verde; el webhook de Stripe tiene cobertura real; el smoke test del flujo núcleo pasa en CI; se documenta en `docs/MODULE_STATUS.md` o similar cuántos tests son "contract/regex" vs. "behavioral" para que quede medible.
- **Tests requeridos:** los descritos arriba son el entregable de este PR.
- **Riesgo:** medio — tests de Stripe requieren mockear la librería con cuidado para no depender de la red real.
- **Impacto esperado en valuation:** crítico — es la mitigación directa de "tests regex-only" y "falta de cobertura en flujos de dinero real".

### PR 6 — Product Narrative Alignment

- **Objetivo:** que el lenguaje de producto/marketing (README, copy de UI, nombres de módulos) refleje lo que el repo hace hoy.
- **Problema que resuelve:** README dice "AI-powered copilot" cuando 5/6 módulos de IA están en mock y el proveedor "anthropic" está declarado pero sin adaptador registrado; el tono "sistema de defensa militar" señalado en `PM_LANGUAGE_SOFTENING.txt` ("war room simulator", "escalation infrastructure", "Why PMFreak Intervened") sigue sin confirmarse como corregido; los "agentes" del Command Center son mapeos determinísticos, no IA.
- **Archivos/carpetas probables:** `README.md`, copy en `src/features/command-center/*`, `PM_LANGUAGE_SOFTENING.txt` (verificar qué de su plan ya se aplicó vs. no).
- **Qué debe cambiar:** el README y cualquier copy visible debe distinguir explícitamente: **Disponible hoy** (auth, RLS, Stripe, dashboard con datos reales, PM/PMO con datos reales) vs. **Beta** (Command Center núcleo) vs. **Experimental** (governance core, partes de AOC) vs. **Roadmap** (IA real más allá de `message-nudges`) vs. **No implementado** (adaptador Anthropic, 5 módulos de IA en mock). "AI-powered copilot" se reemplaza por lenguaje que refleje que solo 1 módulo usa un LLM real hoy.
- **Qué NO debe cambiar:** no se apaga ni se renombra el copiloto real que sí funciona (`message-nudges`); no se elimina la ambición de producto documentada en `docs/*-foundation.md` (esos ya se disclaiman correctamente como "no es IA/ML" para "Constitutional Brief" — mantenerlos como ejemplo de buena práctica).
- **Criterios de aceptación:** cero apariciones de "AI-powered" sin calificar qué módulo específico y en qué estado; un checklist Disponible/Beta/Experimental/Roadmap/No-implementado visible en README o `PRODUCTION_READINESS.md`.
- **Tests requeridos:** ninguno de código; revisión editorial cruzada (founder + este documento como checklist).
- **Riesgo:** bajo técnico, medio de producto/ventas — puede requerir alinear con mensajes ya usados con prospectos; coordinar con el equipo comercial antes de publicar cambios de copy externos.
- **Impacto esperado en valuation:** crítico — mitiga directamente el riesgo de "naming sobrevendido", el hallazgo más peligroso frente a due diligence de un inversionista técnico.

### PR 7 — Schema Consolidation Assessment

- **Objetivo:** auditar la duplicación real de tablas de governance/memory y proponer un plan de consolidación, sin ejecutarlo todavía.
- **Problema que resuelve:** `operational_memory_records` creada en 2 migraciones distintas; 6 tablas de "memoria" (`operational_memory_entries`, `operational_memory_records`, `organizational_memory`, `constitutional_memory_records`, `personal_pm_memory`, `agent_memory_records`); 4 tablas de "intervention"; ≥5 subsistemas de "pattern" casi idénticos; 3 sistemas de audit log (`security_events`, `governance_audit_events`, `agent_audit_events`).
- **Archivos/carpetas probables:** `supabase/migrations/*` (solo lectura), nuevo `docs/audits/schema-consolidation-assessment-<fecha>.md`.
- **Qué debe cambiar:** se produce un documento que (a) mapea cada tabla duplicada a su propósito real vía columnas/comentarios, (b) propone qué tablas fusionar y en qué orden, (c) identifica qué policies de RLS hay que preservar/recrear en cada fusión, (d) estima el riesgo de cada consolidación (bajo/medio/alto) según si la tabla tiene datos en producción.
- **Qué NO debe cambiar:** **ninguna migración se ejecuta en este PR.** Cero cambios de esquema. Es puramente un documento de assessment.
- **Criterios de aceptación:** el documento cubre las 6 tablas de memoria, las 4 de intervention, los 5 de pattern, y los 3 audit logs, con una recomendación concreta de consolidación o "no consolidar, es intencional" para cada grupo, revisado y aprobado por el founder antes de convertirse en un sprint de migración aparte.
- **Tests requeridos:** ninguno (es un documento).
- **Riesgo:** ninguno en este PR — el riesgo real vive en el sprint de ejecución posterior, que queda fuera de alcance aquí.
- **Impacto esperado en valuation:** medio-alto — muestra a un comprador que la duplicación ya fue identificada y tiene un plan, aunque no esté resuelta todavía (mejor que fingir que no existe).

### PR 8 — Transferability Pack

- **Objetivo:** que otro desarrollador pueda correr, entender y extender PMFreak sin depender del founder.
- **Problema que resuelve:** hoy el conocimiento de qué está vivo/mock/huérfano vive solo en la cabeza de quien escribió el código; no hay guía de setup local ni runbook de operación.
- **Archivos/carpetas probables:** `SETUP.md` o sección ampliada en README, `docs/RUNBOOK.md`, uso directo de `docs/MODULE_STATUS.md` (PR1) y `ARCHITECTURE.md`/`PRODUCTION_READINESS.md` (PR4).
- **Qué debe cambiar:** documentar el setup local completo (env vars requeridas sin exponer secretos reales, cómo correr Supabase local/migraciones, cómo correr `npm test`, cómo identificar qué feature-flag o modo controla cada módulo mock vs. real); un runbook mínimo de "qué hacer si CI falla en `check:governance`" o similar.
- **Qué NO debe cambiar:** no se documentan credenciales reales ni nada que sea información sensible; no se prometen features que no existen (este documento debe ser tan honesto como PR6 exige para el copy de producto).
- **Criterios de aceptación:** un desarrollador que nunca ha visto el repo puede, siguiendo solo la documentación, levantar el proyecto localmente y correr `npm test` en menos de 1 hora (validar con alguien externo al equipo si es posible).
- **Tests requeridos:** ninguno de código; validación manual del flujo de setup por una persona nueva.
- **Riesgo:** bajo.
- **Impacto esperado en valuation:** alto — es la mitigación directa de "transferibilidad baja", uno de los factores que más deprime el múltiplo de valoración en adquisiciones técnicas.

---

## 5. Backlog priorizado

| Prioridad | Item | Tipo | Impacto valuation | Esfuerzo | Riesgo | Orden recomendado |
|--:|---|---|---|---|---|--:|
| 1 | PR1 — Repo Reality Map | Tooling/análisis | Alto | Bajo | Bajo | 1 |
| 2 | PR2 — Demo Integrity Cleanup | Fix de honestidad | Crítico | Medio | Medio | 2 |
| 3 | PR6 — Product Narrative Alignment | Copy/producto | Crítico | Bajo | Medio (comercial) | 3 |
| 4 | PR3 — Route Protection Hardening | Seguridad | Alto | Medio | Medio | 4 |
| 5 | PR5 — Test Quality Upgrade | Calidad | Crítico | Alto | Medio | 5 |
| 6 | PR4 — Documentation Reset | Documentación | Alto | Medio | Bajo | 6 |
| 7 | PR7 — Schema Consolidation Assessment | Auditoría (solo doc) | Medio-Alto | Medio | Ninguno | 7 |
| 8 | PR8 — Transferability Pack | Documentación/onboarding | Alto | Medio | Bajo | 8 |

Orden justificado por: PR1 desbloquea la evidencia que necesitan PR2, PR4 y PR6; PR2 y PR6 son los de mayor impacto/menor costo (honestidad de demo y narrativa); PR3 y PR5 requieren más cuidado técnico y se benefician de que ya exista el mapa de módulos vivos; PR4 consume el output de PR1; PR7 es solo assessment y puede correr en paralelo con cualquiera de los anteriores; PR8 cierra el sprint consumiendo todo lo anterior.

---

## 6. Definition of Done del sprint

El sprint se considera exitoso cuando, de forma verificable:

- **Menos código huérfano:** `docs/MODULE_STATUS.md` existe y clasifica el 100% de los subsistemas bajo `src/lib`, `src/features`, `src/aoc`; los módulos confirmados como huérfanos (0 referencias en todo `src`) están archivados o borrados, no simplemente señalados.
- **Menos hardcoding:** cero componentes de producción renderizan datos de `demo-data.ts` o de un módulo `mode: "mock"` sin badge visible de "modo demostración"; los confidence scores hardcodeados en JSX fueron movidos a fixtures nombrados explícitamente.
- **Documentación clara:** existen y están actualizados `README.md`, `ARCHITECTURE.md`, `PRODUCTION_READINESS.md`, `VALUATION_READINESS.md`, `MODULE_STATUS.md`; `docs/architecture/` bajó de 96 a <20 documentos vigentes.
- **Demo honesta:** cualquier persona externa (inversionista, comprador, prospecto) que navegue el producto puede distinguir, sin preguntar, qué es real y qué es demostración.
- **Mejor protección de rutas:** existe una verificación automatizada (middleware o check de CI) que garantiza que ninguna ruta API nueva puede quedar sin guard sin que CI falle.
- **Mejor transferibilidad:** un desarrollador externo puede levantar el proyecto y correr `npm test` siguiendo solo la documentación, en menos de 1 hora.
- **Tests más sustantivos:** el webhook de Stripe, el flujo de auth, y al menos 1 flujo núcleo end-to-end tienen tests de comportamiento real (no regex-only); esto queda medido y documentado (cuántos tests son contract vs. behavioral).
- **Narrativa alineada con realidad técnica:** README y copy de producto no usan "AI-powered"/"agente" sin calificar el estado real; existe un checklist Disponible/Beta/Experimental/Roadmap/No-implementado visible.

---

## 7. Métrica de mejora de valuation

Escala 1-5 por dimensión (1 = riesgo severo para un comprador/inversionista técnico, 5 = defendible sin reservas).

| Dimensión | Antes del sprint | Después del sprint (estimado) | Evidencia del "antes" |
|---|--:|--:|---|
| Technical quality | 3 | 4 | Auth, RLS (148 policies/61 tablas) y separación client/server/admin ya sólidas; penalizado por duplicación de esquema y código huérfano |
| Product maturity | 2 | 3 | Core PM/PMO y Command Center conectados a datos reales; penalizado por 5/6 módulos de IA en mock y "agentes" decorativos |
| Transferability | 1 | 3 | Sin `ARCHITECTURE.md`, sin module status, conocimiento concentrado en el founder |
| Demo integrity | 1 | 4 | `mode: "live_telemetry_mock"` presentado sin distinción, confidence scores hardcodeados, demo-data servido sin badge |
| Documentation | 2 | 4 | 292 archivos sin curación, cero documento de valuation/production readiness |
| Test quality | 2 | 3 | Mayoría regex-only; Stripe webhook con 0 tests; ningún test ejecuta auth/RLS/API real |
| Commercial credibility | 2 | 4 | "AI-powered copilot" en README vs. 1/6 módulos de IA reales; tono "sistema de defensa" sin confirmar corrección |
| **Promedio** | **1.9** | **3.6** | — |

La métrica se vuelve a correr al final del sprint por la misma persona (o un tercero) usando la misma evidencia verificable (greps, conteo de archivos, cobertura de tests) para evitar que la mejora sea percibida en vez de medida.

---

## 8. Resultado esperado

**Rango de valuation defendible antes del sprint:** el repo hoy se sostiene como un **MVP técnico temprano con activos reales pero no verificables por un tercero** — el valor de auth/RLS/Stripe/APIs core es real, pero está oscurecido por mocks presentados como reales, código huérfano sin inventariar, y naming que promete más IA de la que existe. Cualquier valuation en este estado va a aplicar un descuento fuerte por "riesgo de honestidad" y "riesgo de llave en mano" (dependencia del founder), independientemente de cuánta ingeniería real haya debajo.

**Rango de valuation defendible después del sprint:** una **beta técnica defendible y transferible**, donde un comprador puede auditar el repo y encontrar que lo que se muestra como real es real, lo que es mock está etiquetado como tal, y existe evidencia escrita (module status, arquitectura, tests de comportamiento en los flujos de dinero) de que el equipo conoce y gestiona activamente su propia deuda técnica. Esto no cambia cuánto código existe — cambia cuánto de ese código un tercero puede confiar sin tener que preguntarle al founder.

**Qué tendría que pasar para llegar al siguiente rango (más allá de este sprint):**
- Completar el "AOC enterprise runtime" documentado más allá del ~38% actual, o retirar la documentación que promete lo que aún no existe.
- Conectar los módulos de IA en `mode: "mock"` a proveedores reales (incluyendo terminar el adaptador "anthropic" ya declarado pero sin implementar), con tests de comportamiento reales.
- Ejecutar (no solo auditar) la consolidación de esquema propuesta en PR7, con migración de datos verificada.
- Cobertura de tests de comportamiento real en la mayoría de las rutas core, no solo en la muestra crítica de este sprint.

**Qué evidencia debería guardarse para inversionistas, socios o compradores:**
- Este documento y los 8 PRs mergeados, como evidencia de que el equipo audita y corrige su propia deuda antes de que un tercero la encuentre.
- `docs/MODULE_STATUS.md`, `ARCHITECTURE.md`, `PRODUCTION_READINESS.md`, `VALUATION_READINESS.md` — el paquete de due diligence técnico ya preparado.
- El historial de CI verde en `ci-governance.yml` post-PR5, junto con la métrica explícita de tests contract vs. behavioral.
- Los audits ya existentes en `docs/audits/` (`enterprise-runtime-sovereignty-audit-2026-05-17.md`, este mismo documento, y los siguientes) como evidencia de un proceso de auto-auditoría continuo, no un ejercicio único de cara a una venta.
