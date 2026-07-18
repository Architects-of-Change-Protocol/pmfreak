# Auditoría de Arquitectura Conceptual de PMFreak (2026-07-18)

**Alcance:** exclusivamente el modelo mental del producto — entidades, nomenclatura y arquitectura de información. No se modificó código, componentes ni estilos. Este documento es un blueprint para una implementación futura.

**Pregunta que responde:** ¿Un usuario entiende realmente qué es PMFreak y cómo está organizado?

**Veredicto corto:** No. El producto no tiene un modelo mental — tiene cinco modelos mentales superpuestos que nunca se reconciliaron. La causa no es cosmética (nombres distintos para lo mismo); es estructural: la misma fila de base de datos se presenta simultáneamente como cuatro conceptos distintos, y **cuatro registros de navegación independientes** (`NAVIGATION_HIERARCHY`, `DERIVED_LENS_METADATA`, `PM_MODULES`/`OPERATIONAL_FLOW`, y las etiquetas locales de cada página/tab) le asignan nombres distintos a la misma ruta sin que ninguno gane. Un usuario nuevo no tiene ninguna posibilidad razonable de construir un mapa mental coherente en cinco minutos; ni siquiera el propio código tiene uno.

---

## Metodología

Se recorrió el código fuente completo (rutas en `src/app`, componentes de navegación, esquema de base de datos en `supabase/migrations` y `src/lib/db/database-contract.ts`, y ~200 documentos internos en `docs/`), no solo la navegación visible. Se identificaron rutas huérfanas, redirects, código muerto y registros de navegación duplicados. Toda afirmación de este documento está anclada a un archivo y comportamiento verificado, no a inferencia.

---

## FASE 1 — Mapa completo del producto

### 1.1 Los cuatro registros de etiquetas (el hallazgo estructural más importante)

Antes de listar rutas, hay que nombrar el problema raíz de la capa de navegación: **existen cuatro fuentes de verdad independientes que asignan nombre a la misma pantalla**, y ninguna es autoritativa sobre las otras:

| Registro | Archivo | Dónde se ve | Ejemplo en `/command-center` |
|---|---|---|---|
| 1. Jerarquía de navegación (real, renderizada) | `src/lib/workspace/navigation-hierarchy.ts` | Sidebar, sección "Lenses" | **"Execution"** |
| 2. Metadatos de "lens" (breadcrumb) | `src/lib/workspace/derived-lens-metadata.ts` | Línea de breadcrumb bajo el nav móvil | **"Delivery Status"** |
| 3. Registro de módulos (código muerto, pero copiado a mano en el dashboard) | `src/features/navigation/module-registry.ts` | Tarjeta en `/dashboard` | **"Project Brief"** |
| 4. Etiqueta local de cada página/tab | `ProjectTabNav`, `<h1>` de la página, `WorkspaceContextBanner` | La propia pantalla | Tab: **"Execution"** / Banner en pantalla: **"Command Center"** |

Es decir: la **misma URL** (`/command-center`) se llama "Execution" en el sidebar, "Delivery Status" en el breadcrumb, "Project Brief" en la tarjeta del dashboard, y "Command Center" en el propio contenido de la página. Ningún componente de la aplicación decide cuál de estos cuatro nombres es el verdadero.

Este patrón se repite en casi cada ruta compartida (ver tabla completa en Fase 3). No es un problema de "elegir mejores nombres" — es la ausencia de una única capa de nomenclatura.

### 1.2 Mapa de entidades y jerarquía declarada (intención vs. realidad)

Existe un documento interno (`docs/architecture/workspace-pmo-project-hierarchy.md`) que declara una jerarquía intencional:

```
Workspace   (toda la organización; un usuario puede pertenecer a varias)
  └ PMO     (gobierna un conjunto de proyectos; un workspace puede tener varias)
      └ Project (contexto operativo aislado)
```

Esta jerarquía es real en la base de datos (`workspaces` → `pmos.workspace_id` → `projects.pmo_id`), y está parcialmente renderizada en un único componente correcto: `SidebarPmoTree`. Pero **conviven con ella, sin integrarse, al menos tres estructuras conceptuales adicionales**:

1. **"Command Center"** — no es una entidad nueva; es la propia fila de `workspaces`, redecorada con metadata de tipo (`command_center_type`). Documentado explícitamente: *"A workspace row IS a Command Center"* (`database-contract.ts:19-21`). Pero la palabra "Command Center" también se usa para dos tablas completamente distintas (`pmo_command_center_snapshots`, scoped a workspace; `operational_command_centers`, scoped a proyecto), y para una ruta (`/command-center`) que es una cuarta cosa (una consola operativa por proyecto). Cuatro objetos, un nombre.
2. **"Portfolio"** — al menos seis significados distintos y sin relación entre sí (ver Fase 3, tabla de duplicados).
3. **"Program"** — un árbol de datos completamente aislado (`programs → program_epics → program_sprints → program_cards`), sin ninguna clave foránea hacia `projects` ni `pmos`. Es un motor de "convertir un roadmap en un tablero", no un nivel de la jerarquía organizacional, pese a que su nombre sugiere fuertemente que sí lo es.

### 1.3 Inventario de rutas (censo completo, ~90 páginas)

Los tres agentes de investigación recorrieron cada `page.tsx` bajo `src/app`. Resultados agregados:

- **Rutas realmente navegables desde la sidebar principal (`OperationalShell`):** ~20 (Workspace Chat, Create Center, New Project, Workspaces, PMOs-tree, Summary, Execution, Executive, Portfolio, Workspaces, PMOs, Projects, Programs, Upload, Members, + 12 en el cajón "Advanced Runtime").
- **Suite "PMO Ops" completa y funcional pero invisible desde el shell principal:** `/pmo-command-center`, `/pmo-executive-reporting`, `/pmo-governance-compliance`, `/pmo-interventions`, `/pm-registry` (+ `[pmId]`), `/pm-capacity`, `/pm-performance` — 7 rutas construidas, interconectadas entre sí, alcanzables solo mediante un único enlace enterrado en la pestaña "Reports" de una PMO específica.
- **Rutas huérfanas totales (cero referencias en código vivo):** `/founder-program`, `/policy-dry-run-gate`, `/policy-implementation-planning`, `/playground`, `/founder-circle`.
- **Rutas huérfanas efectivas (solo referenciadas por código muerto):** `/copilot` (ni siquiera tiene contenido — es un redirect stub a `/command-center`), `/early-access`, `/message-nudges`, `/escalation-guide`, `/political-risk`, `/project-memory`.
- **Rutas legacy que son puro redirect:** `/workspace` → `/command-center`; `/create-pmo` → `/create-command-center`; `/intelligence` → `/command-center` (llamado literalmente "dead nav node" en el propio código); `/getting-started` y `/onboarding` → `/workspace/setup`.
- **Subsistema construido y sin ningún punto de entrada:** `features/enterprise-ux/` (tour de onboarding + diagnóstico) — nada lo importa salvo su propio índice.
- **Registro de navegación completo y nunca renderizado:** `ContextScopeBar.tsx` + `module-registry.ts` (`PM_MODULES`, `OPERATIONAL_FLOW`) — construido, pero ningún componente vivo lo importa. Sin embargo sus etiquetas fueron copiadas a mano dentro de `/dashboard`, así que el "código muerto" sigue filtrando nombres al producto real.

### 1.4 Breadcrumbs y "usted está aquí"

No existe un componente `Breadcrumb` compartido en todo el código (`grep -i breadcrumb` no devuelve nada). Lo que existe:

- `WorkspaceContextBanner`: literalmente el texto `"Workspace / {lens}"`, con un botón "Workspace" que enlaza a `/workspace` — ruta que solo hace `redirect("/command-center")`. Es decir: en la página de Command Center, el botón "Workspace" te devuelve a la página de Command Center. Solo cubre 4 rutas (`/dashboard`, `/command-center`, `/executive`, `/portfolio`) y nunca muestra PMO ni Proyecto, aun cuando hay un proyecto activo.
- Breadcrumbs de texto plano, copiados a mano por página: `"PMOs / {pmo.name}"`, `"PMOs / {pmo.name} / {project.name}"` — estos sí codifican la jerarquía real, pero solo aparecen en 3 pantallas y desaparecen por completo si el proyecto no tiene PMO asignado.
- La propia caption de breadcrumb del shell (`DERIVED_LENS_METADATA`) es de un solo nivel, sin cadena de ancestros, y solo cubre 4 rutas.

**Conclusión de Fase 1:** el mapa real del producto no es un árbol — es una superposición de al menos cuatro estructuras (Workspace→PMO→Project real; Command Center como redecoración de Workspace; Portfolio como agregado calculado sin tabla propia; Program como árbol aislado), gobernadas por cuatro registros de nomenclatura que no se hablan entre sí, con una suite completa de páginas (PMO Ops) que existe pero es efectivamente invisible.

---

## FASE 2 — Identificación de entidades

Para cada entidad de dominio: qué representa, por qué existe, quién la usa, qué almacena, cómo se relaciona, y si tiene sentido como entidad independiente.

### Workspace
- **Qué representa:** el tenant — la organización completa. Tabla `workspaces`, raíz de toda la jerarquía de datos (todo FK de tenant en el esquema usa `workspace_id`).
- **Por qué existe:** aislamiento multi-tenant (RLS). Es real y necesario en la base de datos.
- **Quién la usa:** todo — es el ancla de scoping de cada tabla del sistema.
- **Qué almacena:** nombre, tipo, `owner_type`, `data_owner`, `visibility_scope`, `confidentiality_level`.
- **Relación:** raíz; contiene N `pmos`, N `projects` directamente (¡proyectos tienen FK directa a workspace, no solo a través de PMO!), N `programs` (árbol aislado), N `personal_portfolios`.
- **¿Tiene sentido como entidad independiente?** Sí, como concepto de backend/tenant. El problema no es que exista — es que además se presenta al usuario bajo tres nombres distintos (Workspace / Command Center / Account, ver Fase 3).

### PMO
- **Qué representa:** depende de la pantalla. Tiene **tres implementaciones de base de datos completamente distintas** bajo el mismo nombre:
  1. Un *valor de enum* (`command_center_type = "company_pmo"`) — ni siquiera es una entidad, es una etiqueta de tipo sobre `workspaces`.
  2. Un *blob JSON* 1:1 con el workspace (`workspace_governance.governance_jsonb`, tipo `PmoTenant`) — el resultado del wizard de configuración inicial.
  3. Una *tabla hija real*, añadida en la migración más reciente de la secuencia (`pmos`, con `workspace_id` FK, y `projects.pmo_id` FK opcional hacia ella) — esta es la única de las tres que agrupa proyectos de verdad.
- **Por qué existe (la número 3):** para permitir subdividir un workspace grande en gobiernos separados (una PMO por cliente, división o programa).
- **Quién la usa:** el flujo de creación (wizard "Command Center") escribe las tres simultáneamente, sin ninguna restricción de base de datos que las mantenga sincronizadas — solo disciplina de código de aplicación.
- **¿Tiene sentido como entidad independiente?** La número 3 sí. Las números 1 y 2 no deberían llamarse "PMO" — son metadata de Workspace.

### Command Center
- **Qué representa:** al menos cuatro cosas distintas: (a) el propio `workspaces` (documentado explícitamente como el mismo objeto), (b) una tabla de snapshot ejecutivo por workspace (`pmo_command_center_snapshots`), (c) una tabla de snapshot operativo por proyecto (`operational_command_centers`), (d) la página `/command-center`, que en el propio código se describe como "consola de operaciones del workspace" pero en la sidebar se etiqueta "Execution".
- **Por qué existe:** aparenta ser un intento de "marca" más amigable para "Workspace" — un nombre de producto en lugar de un nombre de tabla. Pero se filtró simultáneamente a tres capas de datos distintas y a una página con propósito propio, sin que nadie reconciliara los cuatro usos.
- **¿Tiene sentido como entidad independiente?** No. Como concepto de UI para "el Workspace configurado", sí tendría sentido — pero solo si es la única cosa que se llama así.

### Portfolio
- **Qué representa:** al menos seis cosas sin relación entre sí (ver tabla de duplicados en Fase 3): historial de análisis de documentos subidos; sección de "lista de proyectos de una PMO"; panel ejecutivo de cuellos de botella; valor de dropdown que significa "ningún proyecto seleccionado"; tabla `personal_portfolios` (una lista personal tipo watchlist de un solo usuario); y un namespace de API completo (`/api/personal-portfolio/*`) sin ningún consumidor de UI.
- **¿Tiene sentido como entidad independiente?** Como "lista de proyectos que me importan a mí" (watchlist personal), sí, es un concepto útil y distinto de PMO. Como cualquiera de los otros cinco usos, no — son vistas de datos existentes disfrazadas de entidad nueva.

### Program
- **Qué representa:** una herramienta completamente aislada — "convierte un documento de roadmap en un tablero ejecutable de épicas/sprints/tarjetas". Tiene su propio árbol de tablas (`programs → program_epics → program_sprints → program_cards`) con FK solo a `workspace_id`, sin ninguna relación con `projects` ni `pmos`.
- **Por qué existe:** parece un motor de "documento → plan de trabajo estructurado", una capacidad real y valiosa, pero empaquetada bajo un nombre (Program) que en gestión de proyectos tradicionalmente significa "conjunto de proyectos relacionados" — exactamente lo que ya hace PMO en este producto.
- **Quién la usa:** nadie, aparentemente — es de las siete rutas del "PMO Ops Suite" y de `/programs`, ninguna aparece enlazada desde el flujo principal de onboarding.
- **¿Tiene sentido como entidad independiente?** La *capacidad* (parsear un roadmap en tareas) sí. El nombre "Program" como nivel jerárquico, no — genera una expectativa (agrupa proyectos) que la implementación no cumple (no toca `projects` en absoluto).

### Project
- **Qué representa:** la unidad de trabajo real, consistente en casi toda la aplicación. Es la entidad mejor diseñada del producto.
- **Por qué existe:** obvio y necesario.
- **Quién la usa:** todos los flujos operativos.
- **Relación:** `workspace_id` obligatorio; `pmo_id` opcional.
- **¿Tiene sentido como entidad independiente?** Sí, sin discusión — es la única entidad de este documento sin ambigüedad conceptual. Su único problema es de rótulo: en `/projects/page.tsx` se le llama "Context"/"Operational Context"; en el wizard de onboarding se le llama "Initiative"; en el resto de la app, "Project". Un mismo objeto, cuatro nombres de UI.

### Otras entidades operativas (Sprint, Task, Meeting, Risk, Stakeholder, Decision, Action, Knowledge)
- **Task:** existe como `execution_tasks`, bien scopeado a `project_id`. Nombre consistente.
- **Risk / Assumption / Issue / Dependency:** unificadas bajo `raid_items` (RAID) — patrón correcto, un nombre técnico consistente aunque no siempre visible al usuario como "RAID".
- **Meeting:** sin tabla dedicada; solo una página `/meetings` (Meeting Transcript Analyzer) que no está scopeada a proyecto — es una utilidad genérica, no una entidad de dominio persistente.
- **Stakeholder:** sin tabla propia (solo aparece embebido en payloads JSON de otras tablas); página `/stakeholder-intel` es un análisis derivado, no una entidad con CRUD propio.
- **Decision:** **fragmentación severa** — al menos 6 tablas distintas (`project_decisions`, `decision_outcomes`, `decision_effectiveness`, `constitutional_decisions`, `operational_decisions`, `operational_decision_records`) más decenas de tablas `agent_pmo_*_decisions` ligadas a flujos de gobernanza de agentes específicos. Esto es un segundo problema de duplicación conceptual, paralelo al de Workspace/PMO/Command Center, pero fuera del alcance visible del usuario (son tablas de backend, no pantallas). Se documenta aquí porque confirma que el patrón de "fragmentar la misma idea en múltiples entidades" no es un incidente aislado sino un hábito del equipo.
- **Program (Sprint/Epic/Card) vs. el resto:** ya cubierto arriba — es un universo de datos aparte.
- **Knowledge/Memory:** `operational_memory_entries`, `project_memories` — existen, con una nota de deuda técnica documentada (identificadores legacy no garantizados como UUID válidos).

---

## FASE 3 — Duplicados conceptuales

### Tabla de duplicados: el "contenedor superior" (Workspace / PMO / Command Center / Portfolio)

| Concepto A | Concepto B | Concepto C | Nivel de duplicidad | Motivo histórico | Problema generado | Recomendación |
|---|---|---|---|---|---|---|
| **Workspace** (tabla raíz) | **Command Center** (mismo `workspaces` row, redecorado) | — | **Total — mismo objeto, mismo id.** Documentado explícitamente en el código: *"A workspace row IS a Command Center."* | "Command Center" nace como intento de nombre de marca más atractivo que "Workspace", pero se introdujo de forma aditiva (nueva columna `command_center_type`) para no arriesgar un rename de 117+ migraciones, en vez de decidir un nombre único y renombrar. | El usuario ve "Workspace" y "Command Center" en la misma pantalla como si fueran cosas distintas (botón "Workspace" dentro de la página "Command Center" que te regresa a la misma página). | **Fusionar. Un solo nombre.** Ver Fase 5 — recomendación: eliminar "Command Center" como palabra de producto; el objeto se llama únicamente **Workspace**. |
| **PMO** (sentido 1: valor de enum de tipo) | **Command Center** (el objeto que ese enum tipifica) | — | Total — es literalmente un valor del campo `command_center_type` de Workspace. | El wizard de creación se llamaba "Create PMO"; se renombró la UI a "Create Command Center" pero se dejó `PmoTenant`, `pmoName`, `PmoWizard` como nombres internos, y se dejó "Company PMO" como una de las opciones del dropdown de "Command Center Type". | El usuario configura un "Command Center Type" y una de las opciones es "PMO" — el nombre del nivel superior aparece como valor de sí mismo. | Eliminar "PMO" como valor de tipo visible; usar categorías de propósito ("Empresa", "Cliente", "Equipo", "Independiente", "Programa de mejora") sin reintroducir la palabra PMO. |
| **PMO** (sentido 2: blob JSON `PmoTenant`) | **Workspace** (fila que lo posee 1:1) | — | Total — 1:1 con `workspace_id`, no tiene identidad propia. | Es el resultado guardado del wizard de onboarding; nunca se independizó como tabla porque en su momento no hacía falta (antes de que existiera la tabla `pmos`). | Es invisible al usuario, pero contamina el código (tipos, claves de localStorage) — riesgo de mantenimiento más que de UX directo. | Absorber como configuración de Workspace; no necesita nombre propio. |
| **PMO** (sentido 3: tabla `pmos` real) | **Portfolio** (sección "Portfolio" dentro de `/pmos/[pmoId]`, que es literalmente la lista de proyectos de esa PMO) | — | Alto — misma pantalla, el título de la página dice "PMO" y la sección de contenido debajo dice "Portfolio", refiriéndose al mismo conjunto de proyectos. | Nombrar la sección de "lista de proyectos" con una palabra distinta a la entidad que la contiene, probablemente por convención de copywriting sin revisión cruzada. | Un usuario en la página de "PMO X" ve la palabra "Portfolio" sin saber si es lo mismo, una subsección, o un enlace a otro lugar (existe una ruta `/portfolio` real y no relacionada). | Renombrar la sección a algo literal ("Proyectos") y **no reutilizar la palabra Portfolio** en ningún otro lugar del producto salvo, si se conserva, para el watchlist personal (ver más abajo). |
| **Portfolio** (`/portfolio`, historial de documentos subidos) | **Portfolio** (panel "Portfolio Overview" en `/executive`) | **Portfolio** (`personal_portfolios`, watchlist personal por usuario) | Alto — tres datasets sin relación bajo el mismo nombre, más un cuarto significado como valor de dropdown ("Portfolio scope" = "ningún proyecto seleccionado"). | Cada equipo/sprint construyó su propia vista agregada y la llamó "Portfolio" porque es la palabra genérica de PM para "conjunto de proyectos", sin comprobar si ya estaba en uso. | Cuatro superficies compiten por la misma palabra; ninguna sabe de la existencia de las otras tres. | Eliminar "Portfolio" como nombre de página genérica. Conservarlo, como mucho, para una función explícita y única: una lista personal guardada de proyectos (equivalente a un "favoritos"), nunca para vistas agregadas de la organización. |
| **Command Center** (`/command-center`, consola por proyecto) | **PMO Command Center** (`/pmo-command-center`, vista de capacidad de PMs) | **Operational Command Center** (`<h1>` de `/projects`, tercera pantalla distinta) | Total en nombre, cero relación en dato/propósito. | Tres equipos/sprints distintos construyeron tres paneles de "vista general operativa" y cada uno reclamó la marca "Command Center" para el suyo. | Un usuario no puede saber, por el nombre, cuál de las tres pantallas "Command Center" necesita — ni siquiera son del mismo nivel de la jerarquía (una es por proyecto, otra es de capacidad de personas, otra es un listado de proyectos). | Eliminar la palabra "Command Center" del producto por completo (ver Fase 5). Cada una de estas tres pantallas recibe un nombre único y literal según lo que realmente muestra. |
| **Program** (`/programs`, motor de roadmap→tablero) | **PMO** (agrupador de proyectos) | — | Aparente (por nombre) pero **nulo en datos** — cero relación FK entre `programs` y `projects`/`pmos`. | "Program" se tomó del vocabulario estándar de gestión de proyectos (conjunto de proyectos relacionados), pero el equipo que construyó esta feature la usó para un motor de generación de planes de trabajo desde documentos, una capacidad distinta. | Un PM que ya sabe qué es un "Programa" en el sentido clásico (PMO gestiona programas, programas contienen proyectos) encuentra un "Program Builder" que no tiene ningún proyecto dentro — rompe la expectativa semántica más fuerte de todo el vocabulario. | Renombrar esta capacidad para dejar de usar la palabra "Program" (ver Fase 5 — propuesta: "Roadmap Builder" o similar), liberando la palabra "Program" por si en el futuro se necesita el sentido clásico (agrupación de proyectos), o eliminarla del vocabulario visible del usuario por completo si PMO ya cumple ese rol. |

### Tabla de duplicados: la unidad de trabajo (Project)

| Concepto A | Concepto B | Concepto C | Nivel de duplicidad | Motivo histórico | Problema generado | Recomendación |
|---|---|---|---|---|---|---|
| **Project** (nombre en el 95% de la app) | **Context** / "Operational Context" (`/projects` página, formulario propio) | **Initiative** (wizard de onboarding y el formulario del estado vacío) | Total — mismo objeto (`projects` table, mismo id), tres nombres de formulario. | Copys distintos escritos en sprints distintos sin glosario compartido. | Un usuario que crea su primer "Initiative" en el onboarding, luego ve "Projects" en la sidebar, y luego encuentra un formulario de "Add Context" — tres términos para la acción más básica del producto. | Un solo nombre: **Project**, en cada formulario, botón y encabezado sin excepción. |

### Tabla de duplicados: dashboards / vistas agregadas

| Ruta | Nombre en sidebar | Nombre en breadcrumb | Nombre en tarjeta de dashboard | Nombre en `<h1>` propio | Propósito declarado |
|---|---|---|---|---|---|
| `/dashboard` | Summary | Overview | Home | "Summary" | Vista operativa general |
| `/command-center` | Execution | Delivery Status | Project Brief | (ninguno propio; banner dice "Command Center") | Consola de proyecto |
| `/executive` | Executive | Leadership View | Executive View | "Executive" | Vista para liderazgo |
| `/portfolio` | Portfolio | Project Controls | — | "Portfolio" | Historial de documentos + riesgo |
| `/pmo-command-center` | *(fuera del nav)* | — | — | "PMO Command Center" | Capacidad de PMs |
| `/pmo-executive-reporting` | *(fuera del nav)* | — | — | "PMO Executive Reporting & Alerts" | Reportes ejecutivos derivados |
| `/intelligence` | Intelligence | — | — | *(ninguno — puro redirect)* | Nodo muerto, redirige a Command Center |

**Diez superficies "tipo dashboard" en total** compiten por el rol de "pantalla principal", cada una con nombre distinto según qué capa de la app la nombre. El propio código interno (`lensOrder` en `operational-shell.tsx`) trata Dashboard/Command Center/Executive/Portfolio como "lentes" intercambiables sobre el mismo dato — es decir, el propio equipo ya reconoce implícitamente que son variaciones de una misma cosa, pero nunca llegó a fusionarlas ni a nombrarlas de forma consistente.

**No tengas miedo de concluir que una entidad debe desaparecer — aplicado:** de las diez superficies "dashboard", la recomendación de este documento (Fase 5/6) es que sobrevivan **dos**: una vista de Workspace ("Resumen") y una vista de Proyecto ("Resumen del Proyecto"). El resto —Executive, Portfolio, PMO Command Center, PMO Executive Reporting, Intelligence— se elimina o se funde como filtro/pestaña dentro de esas dos.

---

## FASE 4 — Modelo mental del usuario (simulación)

Perfil: un Project Manager nuevo, sin leer documentación, que acaba de crear su cuenta.

**Minuto 0 — Onboarding.** La pantalla dice *"Start building your command center"*. El usuario no sabe qué es un "command center" todavía — nunca se le explicó. Hace clic en el único botón habilitado: **"Create Command Center"**. El botón vecino, "Create Project", está deshabilitado con el tooltip *"Create a Command Center first to give your projects governance, objectives, and agent context"* — la primera explicación que recibe usa una palabra ("governance") más abstracta que la que intenta explicar.

**Minuto 1 — El wizard.** Se abre un formulario. Le pide: "Command Center Name", "Command Center Type" (con una opción llamada, sin explicación, "Company PMO"), y también un campo separado llamado **"Organization Name"** — el usuario ahora tiene dos campos de nombre en la misma pantalla (¿Command Center y Organization no son lo mismo?) y una palabra nueva, "PMO", que no fue mencionada antes y que aparece solo como una opción dentro de otra cosa.

**Minuto 2 — Activación.** Pulsa "Activate Command Center →". Es redirigido a una pantalla que dice *"Your **PMO Brain** is active"* e invita a *"introduce your **PMO team**"*. Este es el único momento del flujo entero donde aparece la palabra "PMO" en el copy visible — y aparece como si el usuario ya supiera que "Command Center" y "PMO" son la misma cosa, sin decirlo nunca.

**Minuto 3 — El shell principal.** Ahora ve una sidebar con: un bloque "Workspace" (su empresa), un árbol "PMOs" (vacío o con una PMO recién creada), una sección "Lenses" con cuatro opciones (Summary, Execution, Executive, Portfolio) y una sección "Utilities" con más enlaces (Workspaces, PMOs, Projects, Programs...). En este punto el usuario ha visto, sin ninguna explicación de relación entre ellas: **Workspace, Command Center, PMO, Portfolio, Program, Project, Organization** — siete sustantivos de alto nivel en menos de tres minutos.

**Preguntas simuladas:**
- *¿Qué cree que es un Workspace?* Probablemente "mi empresa" — es lo más consistente en el copy. Pero también vio un botón llamado "Workspace" dentro de la pantalla "Command Center" que no lo saca de ahí (lo redirige a la misma pantalla), lo cual mina esa hipótesis.
- *¿Qué cree que es un PMO?* No tiene manera de saberlo con confianza — la única mención visible ("PMO Brain") ocurre después de haber creado algo que se llamaba "Command Center", sin conexión explícita.
- *¿Qué cree que es un Command Center?* Cree que es lo que acaba de crear — pero no sabe si es lo mismo que "Workspace" (ambos aparecen como el contenedor de todo) o algo distinto y más pequeño.
- *¿Puede diferenciarlos?* No, de forma fiable. La única evidencia textual real de una jerarquía (*"Workspace → PMO → Project"*) vive en un documento interno de ingeniería (`docs/architecture/workspace-pmo-project-hierarchy.md`) que el usuario nunca ve.
- *¿Necesita leer documentación?* Sí sin remedio, y aun así no hay documentación de cara al usuario — solo documentación de ingeniería.
- *¿Cuántos minutos tarda en comprender la estructura?* Con el flujo actual: **nunca de forma completa**. Puede aprender operativamente "creo un proyecto y trabajo" sin jamás entender qué son Workspace/PMO/Command Center como conceptos distintos — simplemente los tratará como sinónimos intercambiables, lo cual es un modelo mental *incorrecto* que eventualmente le costará (p. ej. al no entender por qué un proyecto "no aparece" si está en la PMO equivocada).
- *¿Cuántos conceptos debe memorizar?* Al menos 7 (Workspace, Command Center, PMO, Portfolio, Program, Project, Organization), de los cuales el análisis de datos (Fase 2-3) muestra que **solo 2 son entidades reales y distintas** (Workspace y Project — con PMO como subdivisión opcional legítima de Workspace).
- *¿Cuáles generan mayor confusión?* Command Center (4 significados de dato distintos bajo un nombre), Portfolio (6 significados), y la pareja PMO/Command Center (mismo flujo de creación, dos nombres, sin nunca decir explícitamente que son lo mismo).

---

## FASE 5 — Modelo mental ideal

Si PMFreak naciera hoy, sin herencia histórica:

### Principio rector
**Una fila de base de datos = un nombre de producto.** Si dos pantallas muestran el mismo dato desde ángulos distintos, son *vistas* o *pestañas* de una misma entidad, nunca entidades nuevas con nombre propio.

### Las entidades finales (de ~12 sustantivos actuales a 4)

1. **Workspace** — la organización. Es lo único que hoy se llama, según la pantalla, Workspace / Command Center / Account / Organization. Se colapsan las cuatro en una: **Workspace**. Se elimina "Command Center" del vocabulario de producto por completo — la palabra desaparece, no se re-explica.
2. **PMO** — se conserva, pero *solo* en su sentido 3 (tabla real, agrupador opcional de proyectos dentro de un Workspace). Se elimina como valor de tipo ("Company PMO") y como blob de configuración con nombre propio. Un Workspace puede tener cero, una o varias PMOs — para equipos pequeños, cero PMOs es un estado válido y no bloqueante (ver Fase 9).
3. **Project** — se conserva sin cambios de significado, pero con nombre único: se eliminan "Context", "Operational Context" e "Initiative" como sinónimos.
4. **Roadmap** (nuevo nombre para lo que hoy es "Program") — se conserva la *capacidad* (documento → plan estructurado con épicas/sprints/tarjetas) pero deja de llamarse "Program", precisamente porque esa palabra ya la necesita PMO en su sentido clásico. Se reencuadra como una herramienta *dentro* de un Project o una PMO ("generar un roadmap ejecutable a partir de un documento"), no como un cuarto nivel jerárquico paralelo.

### Lo que desaparece
- **Command Center** (como nombre) — eliminado. El objeto era siempre Workspace.
- **Portfolio** (como nombre de pantalla genérica) — eliminado en 5 de sus 6 usos actuales; sobrevive, si acaso, únicamente como "Mis proyectos guardados" (favoritos personales), nunca como sinónimo de "todos los proyectos".
- **Program** como nivel jerárquico — eliminado; sobrevive la capacidad bajo el nombre Roadmap.
- **"PMO Brain"**, **"Operating skeleton"**, **"Skeleton"** — jerga de copy sin valor semántico, eliminada.
- **"Intelligence"** como ruta/nav item — ya es un nodo muerto; se elimina formalmente en vez de mantenerse como redirect fantasma.
- Los 4 registros de nomenclatura (`NAVIGATION_HIERARCHY`, `DERIVED_LENS_METADATA`, `PM_MODULES`, etiquetas locales) se colapsan en **uno solo**: una tabla de rutas con un único `label` por ruta, consumida por sidebar, breadcrumb y cualquier tarjeta que la referencie.

### Lo que se fusiona
- Los 10 "dashboards" (Fase 3) se fusionan en 2: **Resumen del Workspace** y **Resumen del Proyecto**. Todo lo demás (Executive, Portfolio, PMO Command Center, PMO Executive Reporting, capacidad de PMs) se convierte en *filtros o pestañas* dentro de esas dos vistas, no en páginas con nombre propio.
- La suite "PMO Ops" (7 páginas invisibles) se fusiona dentro de la vista de PMO existente (`/pmos/[pmoId]`), como pestañas adicionales, no como rutas paralelas sin punto de entrada.

### Lo que queda interno (nunca visible al usuario)
- `workspace_id` como clave técnica — el usuario nunca ve la palabra "workspace_id"; ve "Workspace" como nombre de producto, sin que la tabla se llame distinto.
- `PmoTenant`, `command_center_type`, `owner_type`, `data_owner`, `visibility_scope`, `confidentiality_level` — metadata de gobernanza, útil para el motor de reglas, irrelevante como vocabulario de front-end salvo cuando se traduce a una decisión de UI concreta (p. ej. un badge "Privado" / "Compartido").
- Todo el AOC Protocol / Enterprise Runtime — es plomería de autorización, correctamente ya invisible al usuario; no forma parte del modelo mental de producto y debe seguir así.

---

## FASE 6 — Arquitectura de información (rediseño)

### Jerarquía

```
Workspace                         (mi organización — 1 por tenant activo, el usuario puede pertenecer a varios)
 ├─ Members                       (personas, roles)
 ├─ PMO  (opcional, 0..N)         (agrupación de proyectos por cliente/división/equipo)
 │    └─ Project (0..N)
 └─ Project (0..N, directo)       (para quien no necesita subdividir en PMOs)
      ├─ Overview                 (resumen del proyecto — sustituye Command Center/Brief)
      ├─ Chat
      ├─ Tasks (Execution)
      ├─ Documents / Evidence
      ├─ Roadmap                  (antes "Program" — opcional, generado desde documento)
      ├─ Risks (RAID)
      ├─ Meetings
      └─ Settings
```

### Árbol de navegación propuesto (sidebar, un único registro)

```
[Nombre del Workspace ▾]           ← selector de Workspace (si el usuario pertenece a varios)

RESUMEN
  Resumen del Workspace            (antes: Dashboard/Summary/Executive/Portfolio fusionados, con filtros)

TRABAJO
  Proyectos                        (lista plana + agrupación visual por PMO si existen)
  PMOs                             (solo visible si el usuario ya creó al menos una)

CONFIGURACIÓN
  Miembros
  Roadmaps                         (antes "Programs" — herramienta de generación)
  Ajustes del Workspace

AVANZADO (colapsado por defecto)
  Memoria Operativa, Stakeholders, Detección de Cambios, Reuniones,
  Gobernanza, Políticas, Agentes de Confianza, Auditoría, Capacidades, Trials
```

Dentro de un Proyecto, la navegación cambia a un tab bar local (patrón que ya existe y funciona bien en `ProjectTabNav` — se conserva, pero con nombres de pestaña que coinciden exactamente con el `<h1>` de la pantalla destino, cosa que hoy no ocurre).

### Relaciones (resumen para la Fase 11)

- Workspace 1—N PMO (opcional)
- Workspace 1—N Project (directo, `pmo_id` opcional)
- PMO 1—N Project
- Project 1—1 Roadmap (opcional, generado)
- Project 1—N Task, Risk, Meeting, Document

### Entradas principales / secundarias / avanzadas

- **Principales (siempre visibles):** Resumen del Workspace, Proyectos, Crear Proyecto.
- **Secundarias (visibles tras el primer proyecto):** PMOs, Miembros, Roadmaps.
- **Avanzadas (colapsadas, requieren capability):** Memoria, Stakeholders, Gobernanza, Auditoría, Trials — igual que hoy, este nivel de progressive disclosure ya está bien resuelto en el código actual (`AdvancedDrawer` + `requiresCapability`) y debe conservarse tal cual.

---

## FASE 7 — Nomenclatura (evaluación término por término)

| Término actual | ¿Claro? | ¿Universal? | ¿Lo entiende un PM? | ¿Lo entiende un CEO? | ¿Lo entiende un usuario nuevo? | Veredicto |
|---|---|---|---|---|---|---|
| Workspace | Sí | Sí | Sí | Sí | Sí | **Conservar** como único nombre del contenedor raíz. |
| PMO | Sí (en su sentido clásico) | Parcial — jerga de industria, pero muy extendida entre PMs | Sí | Parcial | No, sin contexto | **Conservar**, pero solo para el agrupador opcional de proyectos; nunca como sinónimo de Workspace. |
| Command Center | No | No — término de marketing sin significado estándar en PM | No | No | No | **Eliminar.** |
| Project Workspace | No (ni siquiera se usa de forma consistente en el código) | No | — | — | — | **Eliminar** — no debe introducirse; es exactamente el tipo de término híbrido que causó el problema. |
| Portfolio | Sí (en su sentido clásico) | Sí | Sí | Sí | Parcial | **Restringir a un solo uso** (lista personal guardada) o eliminar. |
| Program | Sí (en su sentido clásico) | Sí | Sí | Sí | Parcial | **No usar** para la herramienta de roadmap — el nombre ya está prometido al sentido clásico (conjunto de proyectos), que este producto no implementa así. |
| Project | Sí | Sí | Sí | Sí | Sí | **Conservar**, nombre único, sin sinónimos ("Context", "Initiative"). |
| Executive (view) | Parcial | Sí | Sí | Sí | Parcial | **Fusionar** dentro de Resumen del Workspace como un filtro/rol, no una página aparte. |
| Dashboard / Summary / Home / Overview | No (4 nombres para lo mismo) | Sí, cada palabra por separado | Sí | Sí | Sí | **Un solo nombre**: "Resumen". |
| Organization (campo de formulario) | No, redundante con Workspace | Sí | Sí | Sí | Sí | **Eliminar** como campo separado — es el nombre del Workspace. |
| Account | No, en conflicto con Workspace | Sí | Sí | Sí | Sí | **Eliminar** como eyebrow de `/workspaces`; usar "Workspace". |
| Context / Operational Context | No | No — jerga técnica | Parcial | No | No | **Eliminar**, es Project. |
| Initiative | Parcial | Sí, pero es sinónimo evitable | Sí | Sí | Parcial | **Eliminar**, es Project. |
| PMO Brain / Skeleton / Operating skeleton | No | No | No | No | No | **Eliminar** — jerga de copy sin función. |

**Regla aplicada:** evitar jerga interna, terminología técnica y sinónimos innecesarios. Cada fila roja de esta tabla existe porque un sprint distinto escribió su propio copy sin glosario compartido — la recomendación operativa (Fase 12) es congelar un glosario de producto de una sola página antes de escribir cualquier nuevo copy.

---

## FASE 8 — Flujo principal (el recorrido perfecto)

**Desde la creación de cuenta hasta el primer valor obtenido:**

1. **Signup.** El usuario crea su cuenta. Un Workspace se crea automáticamente en segundo plano (ya ocurre hoy — `ensureUserWorkspace`), sin pedirle que entienda qué es un Workspace todavía.
2. **Primera pregunta, una sola:** "¿Cómo se llama tu organización o equipo?" — esto nombra el Workspace, sin usar la palabra "Workspace" ni "Command Center" ni "Organization" como jerga; solo se le pide un nombre.
3. **Segunda pregunta, una sola:** "¿Cuál es tu primer proyecto?" — se crea el primer Project directamente dentro del Workspace, sin exigir la creación de una PMO antes. (Cambio respecto al flujo actual: hoy "Create Project" está bloqueado hasta crear un "Command Center" primero — un paso extra e innecesario para el caso más común, un usuario individual o equipo pequeño.)
4. **Qué obtiene automáticamente:** el proyecto aterriza en su propia vista de Resumen (no en un chat, no en una consola separada) con un estado vacío claro: "sube un documento o describe tu proyecto para que el equipo empiece a trabajar".
5. **Qué hace segundo:** sube un documento o escribe un objetivo. El sistema genera automáticamente una primera lectura (riesgos, tareas sugeridas) — esto ya es una capacidad real hoy (extracción RAID, tareas sugeridas), solo se reordena para que ocurra sin pasar por la fricción conceptual de "Command Center".
6. **Cuándo aparece la IA:** inmediatamente disponible como "Chat" dentro del proyecto — no como una fase separada de "activación", sino como una pestaña más, disponible desde el primer segundo.
7. **Cuándo aparecen funciones avanzadas (PMO, Roadmap, Gobernanza):** solo cuando el usuario crea un *segundo* proyecto — ahí, y solo ahí, se le ofrece (no se le exige) agrupar proyectos en una PMO. Antes de ese punto, la palabra "PMO" no necesita aparecer en absoluto.

---

## FASE 9 — Progressive disclosure

| Momento | Qué se muestra | Qué permanece oculto |
|---|---|---|
| **Primer minuto** | Nombre del Workspace, crear primer Project, estado vacío del proyecto | PMO, Roadmap, Gobernanza, Auditoría, Trials, Programas, Portfolio |
| **Primer día** | Resumen del Workspace (con 1 proyecto), Chat del proyecto, subir documentos, tareas sugeridas | Todo lo anterior sigue oculto salvo que el usuario invite a alguien más (entonces aparece "Miembros") |
| **Primera semana** | Al crear el 2º proyecto: oferta de agrupar en una PMO (opcional); Roadmap disponible como herramienta dentro de un proyecto | Gobernanza, Auditoría, Trials, capacidades de nivel Enterprise |
| **Usuario avanzado** | PMOs múltiples, Miembros con roles, Roadmaps generados, filtros de Resumen (por PMO, por severidad) | Nada nuevo estructural — solo más profundidad dentro de lo ya visible |
| **Enterprise** | Gobernanza, Políticas, Auditoría, Agentes de Confianza, Trials, tipos de confidencialidad | Nada — esta es la capa final, ya bien resuelta hoy vía `requiresCapability` y debe seguir gated igual |

Esta progresión ya existe parcialmente en el código (`AdvancedDrawer`, capability gating, `PILOT_HIDDEN_HREFS`) — es la parte del sistema mejor diseñada hoy. El problema no es la mecánica de progressive disclosure; es que **antes de llegar a esa mecánica, el usuario ya se enfrentó a 7 sustantivos sin explicación en los primeros 3 minutos** (Fase 4). Arreglar Fase 5-8 hace que esta mecánica, ya sólida, por fin sirva a un modelo mental limpio.

---

## FASE 10 — Simplificación (qué se reduce)

| Categoría | Antes | Después |
|---|---|---|
| Nombres de "contenedor superior" | Workspace, Command Center, PMO (×3 sentidos), Portfolio (×6 sentidos), Program, Organization, Account | Workspace, PMO |
| Nombres para "unidad de trabajo" | Project, Context, Initiative | Project |
| Pantallas tipo "dashboard" | 10 (`/dashboard`, `/command-center`, `/executive`, `/portfolio`, `/pmo-command-center`, `/pmo-executive-reporting`, `/pmo-governance-compliance`, `/pmo-interventions`, `/pm-capacity`, `/pm-performance`) | 2 (Resumen de Workspace, Resumen de Proyecto), con filtros dentro |
| Registros de nomenclatura de navegación | 4 (`NAVIGATION_HIERARCHY`, `DERIVED_LENS_METADATA`, `PM_MODULES`, etiquetas locales) | 1 |
| Pasos obligatorios antes de crear el primer proyecto | 2 (crear Command Center, luego Project) | 1 (crear Project; Workspace ya existe automáticamente) |
| Campos de nombre en el wizard inicial | 2 ("Command Center Name" + "Organization Name") | 1 |
| Rutas huérfanas o de solo-redirect mantenidas activas | ~14 (`/workspace`, `/create-pmo`, `/intelligence`, `/copilot`, `/founder-program`, `/policy-dry-run-gate`, etc.) | 0 — se eliminan o se re-conectan con propósito real |
| Clics para llegar a la suite "PMO Ops" (hoy: PMO → Reports → enlace enterrado) | 3, sin garantía de descubrimiento | 1 (pestaña dentro de la vista de PMO) |

**No se agrega ningún concepto nuevo en esta propuesta** salvo el renombrado de "Program" a "Roadmap" (que es una aclaración, no una adición) y el redimensionamiento de "Portfolio" a un único uso opcional.

---

## FASE 11 — Propuesta final (síntesis)

### Entidades finales (4)
1. **Workspace** — organización/tenant. Único nombre para lo que hoy son Workspace + Command Center + Account + Organization.
2. **PMO** — agrupador opcional de proyectos dentro de un Workspace. Único nombre para lo que hoy son PMO (3 sentidos de datos) + Command Center (en su sentido de gobernanza).
3. **Project** — unidad de trabajo. Único nombre para lo que hoy son Project + Context + Initiative.
4. **Roadmap** — herramienta de generación de plan de trabajo desde documento, vive dentro de un Project. Reemplaza el nombre "Program" sin cambiar la capacidad subyacente.

### Conceptos eliminados
Command Center, Portfolio (en 5 de 6 usos), Program (como nivel jerárquico), Context, Initiative, Organization (como campo separado), Account (como eyebrow), Intelligence (ruta muerta), PMO Brain / Skeleton / Operating skeleton (jerga de copy).

### Conceptos fusionados
Los 10 dashboards → 2 (Resumen de Workspace, Resumen de Proyecto). Los 4 registros de nomenclatura → 1. La suite PMO Ops (7 páginas) → pestañas dentro de la vista de PMO existente.

### Conceptos que permanecen internos (nunca en UI)
`workspace_id`, `PmoTenant`, `command_center_type`, `owner_type`, `data_owner`, `visibility_scope`, `confidentiality_level`, todo el AOC Protocol/Enterprise Runtime.

### Conceptos visibles al usuario (lista final y completa)
Workspace, PMO (opcional), Project, Roadmap (opcional), Task, Risk, Meeting, Document/Evidence, Chat, Members, Settings. Once sustantivos, todos con un único significado cada uno, cero superposición.

### Mapa de navegación final

Ver árbol completo en Fase 6. Resumido: **Resumen → Proyectos (agrupados opcionalmente por PMO) → [dentro de un proyecto: Overview, Chat, Tasks, Documents, Roadmap, Risks, Meetings, Settings] → Avanzado (gated por capability, como hoy).**

### Flujo principal
Ver Fase 8: Signup → nombrar Workspace → crear primer Project (sin bloqueo por "Command Center") → subir contexto → IA disponible de inmediato → PMO ofrecida (no exigida) al segundo proyecto.

---

## FASE 12 — Plan de migración (diseño, no implementación)

### Sprint 1 — Congelar el vocabulario y eliminar el código muerto de navegación
- **Objetivo:** una sola fuente de verdad de nomenclatura antes de tocar cualquier pantalla visible.
- **Cambios:** fusionar `NAVIGATION_HIERARCHY`, `DERIVED_LENS_METADATA` y `PM_MODULES`/`OPERATIONAL_FLOW` en un único registro de rutas con un solo `label` por ruta. Eliminar `module-registry.ts` y `ContextScopeBar.tsx` (código muerto confirmado) o, si se conserva por algún uso oculto no detectado, verificarlo explícitamente antes de tocar nada más. Formalizar el redirect de `/intelligence` como eliminación de ruta, no como redirect fantasma.
- **Riesgos:** bajo — es trabajo de "plomería" de nomenclatura, sin tocar datos ni flujos de usuario todavía.
- **Dependencias:** ninguna; es la base de todos los sprints siguientes.
- **Migración de usuarios:** ninguna visible.
- **Migración de URLs:** ninguna todavía.
- **Migración de nomenclatura:** publicar internamente el glosario de producto (Fase 7) como documento de referencia obligatorio para cualquier copy nuevo.
- **Compatibilidad:** total — cambio invisible al usuario final.

### Sprint 2 — Eliminar "Command Center" del vocabulario visible
- **Objetivo:** que el usuario deje de ver dos nombres para el mismo Workspace.
- **Cambios:** renombrar todo copy visible de "Command Center" a "Workspace" (wizard de creación, banners, botones, tooltips de onboarding). La ruta técnica `/command-center` puede mantenerse por ahora (evita romper enlaces/bookmarks/tests), pero su contenido pasa a llamarse "Resumen del Proyecto" en pantalla. Eliminar el campo duplicado "Organization Name" del wizard, dejando solo el nombre del Workspace.
- **Riesgos:** medio — hay usuarios ya onboarded que reconocen "Command Center" como el nombre de su producto diario; requiere aviso de cambio de marca dentro de la app (banner temporal "Command Center ahora se llama Workspace").
- **Dependencias:** Sprint 1 (registro de nomenclatura único ya debe existir).
- **Migración de usuarios:** banner in-app no descartable durante 2 semanas explicando el rename.
- **Migración de URLs:** ninguna todavía (se pospone a Sprint 4).
- **Migración de nomenclatura:** todo el copy de `create-pmo-wizard.tsx`, `getting-started-flow.tsx`, `command-center-context-banner.tsx`.
- **Compatibilidad:** alta — solo texto, ninguna ruta ni tabla cambia.

### Sprint 3 — Consolidar dashboards y la suite PMO Ops
- **Objetivo:** pasar de 10 pantallas tipo "dashboard" a 2, y de 7 páginas huérfanas de PMO Ops a pestañas dentro de `/pmos/[pmoId]`.
- **Cambios:** fusionar `/dashboard`, `/executive`, `/portfolio` en una sola vista de Resumen de Workspace con filtros (Ejecutivo / Cartera / Riesgo como tabs internos, no rutas). Mover `/pmo-command-center`, `/pmo-executive-reporting`, `/pmo-governance-compliance`, `/pmo-interventions`, `/pm-registry`, `/pm-capacity`, `/pm-performance` a pestañas dentro de la vista de PMO. Eliminar rutas huérfanas confirmadas (`/founder-program`, `/policy-dry-run-gate`, `/policy-implementation-planning`, `/playground` si sigue sin uso, `/founder-circle` si no forma parte de un programa activo).
- **Riesgos:** alto — es el sprint de mayor cambio estructural; requiere verificar que ningún flujo de negocio activo (p. ej. reportes ejecutivos enviados por email/export) dependa de las URLs actuales de la suite PMO Ops.
- **Dependencias:** Sprints 1 y 2.
- **Migración de usuarios:** tour guiado de "qué cambió" en el primer login posterior al despliegue, para usuarios que ya tenían hábitos de navegación con las 10 pantallas antiguas.
- **Migración de URLs:** redirects 301/302 de las 7 rutas de PMO Ops y de `/executive`, `/portfolio` hacia las nuevas ubicaciones (evitar el patrón actual de redirects silenciosos sin explicación — cada redirect debe ir acompañado de un mensaje breve "esto ahora vive aquí").
- **Migración de nomenclatura:** aplicar la Fase 7 en bloque a las pantallas fusionadas.
- **Compatibilidad:** media — requiere mantener redirects indefinidamente para enlaces guardados/emails antiguos.

### Sprint 4 — Renombrar Program → Roadmap y limpiar el flujo de creación de Proyecto
- **Objetivo:** eliminar el falso nivel jerárquico "Program" y quitar el bloqueo de "crear Command Center antes de crear Project".
- **Cambios:** renombrar toda la superficie visible de `/programs` a "Roadmap", reencuadrada como herramienta dentro de un proyecto (o accesible desde la creación de un proyecto: "¿Tienes un documento de roadmap? Conviértelo en tareas"). Quitar el bloqueo del botón "Create Project" en el estado vacío inicial — un usuario nuevo puede crear su primer proyecto sin haber configurado nada más; el Workspace ya existe automáticamente.
- **Riesgos:** medio — el motor de parsing de `/programs` es una pieza técnica compleja (roadmap sources → parse results → materializations); el riesgo no es de dato (no se toca el esquema) sino de descubrimiento (asegurar que la capacidad, ya construida, se vuelva más visible en vez de menos).
- **Dependencias:** Sprints 1–3 (el vocabulario y la IA de navegación ya deben estar unificados).
- **Migración de usuarios:** ninguna crítica — `/programs` era efectivamente huérfana; muy pocos usuarios activos tendrán hábito formado ahí.
- **Migración de URLs:** redirect de `/programs` → nueva ubicación dentro del flujo de proyecto; conservar `/programs/[id]/*` como alias técnico si hace falta preservar enlaces existentes.
- **Migración de nomenclatura:** aplicar Fase 7 a todo el copy de `program-builder/*`.
- **Compatibilidad:** alta para datos (ningún cambio de esquema requerido para este documento — es un rename de superficie), media para hábito de usuario (bajo riesgo dado el orfanato actual de la ruta).

### Nota transversal a los 4 sprints
Ninguno de estos sprints requiere, para lograr el objetivo de este documento, cambios al esquema de base de datos (`workspaces`, `pmos`, `projects` ya reflejan la jerarquía correcta desde `20260828000001_workspace_pmo_project_hierarchy.sql`). El trabajo es enteramente de **capa de presentación y nomenclatura** — la arquitectura de datos subyacente para el modelo de 4 entidades (Fase 11) ya existe; lo que falta es que la superficie de UI deje de contradecirla.

---

## Resumen ejecutivo de una línea

PMFreak ya construyó, en su base de datos, el modelo de 3 niveles correcto (Workspace → PMO → Project) — el problema no es de arquitectura de datos, es que encima de ese modelo correcto se apilaron cuatro registros de nomenclatura que nunca se pusieron de acuerdo, y una palabra de marketing ("Command Center") que se filtró a cuatro tablas y páginas distintas sin que nadie decidiera cuál era la real.
