import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const types       = readFileSync('src/lib/constitutional-dashboard/types.ts', 'utf8');
const builder     = readFileSync('src/lib/constitutional-dashboard/dashboard-builder.ts', 'utf8');
const widgets     = readFileSync('src/lib/constitutional-dashboard/dashboard-widgets.ts', 'utf8');
const exportFile  = readFileSync('src/lib/constitutional-dashboard/dashboard-export.ts', 'utf8');
const indexFile   = readFileSync('src/lib/constitutional-dashboard/index.ts', 'utf8');
const docs        = readFileSync('docs/constitutional-dashboard-foundation.md', 'utf8');
const dbContract  = readFileSync('src/lib/db/database-contract.ts', 'utf8');

// ─── Database contract ────────────────────────────────────────────────────────

test('DATABASE_CONTRACT_VERSION preserves all prior keywords', () => {
  assert.match(dbContract, /constitutional-brief/);
  assert.match(dbContract, /executive-brief/);
  assert.match(dbContract, /governance-brief/);
  assert.match(dbContract, /operational-brief/);
  assert.match(dbContract, /portfolio-brief/);
  assert.match(dbContract, /platform-events/);
});

test('DATABASE_CONTRACT_VERSION includes constitutional-dashboard suffix', () => {
  assert.match(dbContract, /constitutional-dashboard/);
  const pfIdx = dbContract.indexOf('portfolio-brief');
  const cdIdx = dbContract.indexOf('constitutional-dashboard');
  assert.ok(cdIdx > pfIdx, 'constitutional-dashboard should appear after portfolio-brief');
});

// ─── Types — ConstitutionalDashboard ─────────────────────────────────────────

test('ConstitutionalDashboard has all required fields', () => {
  for (const field of [
    'id', 'workspaceId', 'pmUserId', 'generatedAt', 'dashboardType',
    'widgets', 'briefReferences', 'evidenceSummary', 'timelineSummary',
    'contradictions', 'unknowns', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `ConstitutionalDashboard missing field: ${field}`);
  }
});

test('ConstitutionalWidget has all required fields', () => {
  for (const field of [
    'id', 'widgetType', 'title', 'summary', 'sourceBriefs',
    'evidence', 'lineage', 'metadata',
  ]) {
    assert.match(types, new RegExp(field), `ConstitutionalWidget missing field: ${field}`);
  }
});

test('DashboardBriefReference has required fields', () => {
  for (const field of ['briefId', 'briefType', 'workspaceId', 'pmUserId', 'generatedAt']) {
    assert.match(types, new RegExp(field), `DashboardBriefReference missing: ${field}`);
  }
});

test('DashboardTimelineEntry has required fields', () => {
  for (const field of ['timestamp', 'recordType', 'recordId', 'summary', 'source']) {
    assert.match(types, new RegExp(field), `DashboardTimelineEntry missing: ${field}`);
  }
});

test('DashboardEvidenceSummary has all required fields', () => {
  for (const f of ['briefCount', 'widgetCount', 'evidenceCount', 'contradictionCount', 'unknownCount']) {
    assert.match(types, new RegExp(f), `DashboardEvidenceSummary missing: ${f}`);
  }
});

test('DashboardHealth has all required fields', () => {
  for (const f of ['widgetCount', 'briefCount', 'timelineCount', 'contradictionCount', 'unknownCount', 'coverageMetrics']) {
    assert.match(types, new RegExp(f), `DashboardHealth missing: ${f}`);
  }
});

// ─── Types — Dashboard types ──────────────────────────────────────────────────

test('all 6 dashboard types are declared', () => {
  for (const dt of ['executive', 'governance', 'operational', 'portfolio', 'workspace', 'mixed']) {
    assert.match(types, new RegExp(`"${dt}"`), `ConstitutionalDashboardType missing: ${dt}`);
  }
});

test('ALL_DASHBOARD_TYPES is exported', () => {
  assert.match(types, /ALL_DASHBOARD_TYPES/);
  assert.match(indexFile, /ALL_DASHBOARD_TYPES/);
});

// ─── Types — Widget types ─────────────────────────────────────────────────────

test('all 9 widget types are declared', () => {
  for (const wt of [
    'executive_brief', 'governance_brief', 'operational_brief', 'portfolio_brief',
    'evidence_summary', 'timeline', 'contradictions', 'unknowns', 'knowledge_domains',
  ]) {
    assert.match(types, new RegExp(`"${wt}"`), `ConstitutionalWidgetType missing: ${wt}`);
  }
});

test('ALL_WIDGET_TYPES is exported', () => {
  assert.match(types, /ALL_WIDGET_TYPES/);
  assert.match(indexFile, /ALL_WIDGET_TYPES/);
});

// ─── Types — Export and explanation ──────────────────────────────────────────

test('ConstitutionalDashboardExport is declared with format json', () => {
  assert.match(types, /ConstitutionalDashboardExport/);
  assert.match(types, /"json"/);
});

test('ConstitutionalDashboardExplanation has required fields', () => {
  assert.match(types, /ConstitutionalDashboardExplanation/);
  assert.match(types, /widgetReasons/);
  assert.match(types, /sourceBriefs/);
  assert.match(types, /lineage/);
  assert.match(types, /unknowns/);
});

test('DashboardWidgetReason has required fields', () => {
  assert.match(types, /DashboardWidgetReason/);
  assert.match(types, /widgetId/);
  assert.match(types, /widgetType/);
  assert.match(types, /reason/);
  assert.match(types, /sourceBriefCount/);
});

test('DashboardResult is a discriminated union', () => {
  assert.match(types, /DashboardResult/);
  assert.match(types, /ok: true/);
  assert.match(types, /ok: false/);
  assert.match(types, /failureClass/);
});

test('DashboardInputBrief is a discriminated union of all 4 brief types', () => {
  assert.match(types, /DashboardInputBrief/);
  assert.match(types, /briefType.*executive/);
  assert.match(types, /briefType.*governance/);
  assert.match(types, /briefType.*operational/);
  assert.match(types, /briefType.*portfolio/);
});

// ─── Types — Audit events ─────────────────────────────────────────────────────

test('audit event types are declared', () => {
  assert.match(types, /CONSTITUTIONAL_DASHBOARD_GENERATED/);
  assert.match(types, /CONSTITUTIONAL_DASHBOARD_EXPLAINED/);
  assert.match(types, /CONSTITUTIONAL_DASHBOARD_EXPORTED/);
});

// ─── Executive Dashboard ──────────────────────────────────────────────────────

test('buildExecutiveDashboard is present in builder', () => {
  assert.match(builder, /buildExecutiveDashboard/);
});

test('buildExecutiveDashboard includes executive brief widgets', () => {
  assert.match(builder, /buildExecutiveBriefWidget/);
});

test('buildExecutiveDashboard includes evidence summary widget', () => {
  assert.match(builder, /buildEvidenceSummaryWidget/);
});

test('buildExecutiveDashboard includes timeline widget', () => {
  assert.match(builder, /buildTimelineWidget/);
});

test('buildExecutiveDashboard includes contradictions widget', () => {
  assert.match(builder, /buildContradictionsWidget/);
});

// ─── Governance Dashboard ─────────────────────────────────────────────────────

test('buildGovernanceDashboard is present in builder', () => {
  assert.match(builder, /buildGovernanceDashboard/);
});

test('buildGovernanceDashboard includes governance brief widgets', () => {
  assert.match(builder, /buildGovernanceBriefWidget/);
});

test('buildGovernanceDashboard includes unknowns widget', () => {
  assert.match(builder, /buildUnknownsWidget/);
});

// ─── Operational Dashboard ────────────────────────────────────────────────────

test('buildOperationalDashboard is present in builder', () => {
  assert.match(builder, /buildOperationalDashboard/);
});

test('buildOperationalDashboard includes operational brief widgets', () => {
  assert.match(builder, /buildOperationalBriefWidget/);
});

// ─── Portfolio Dashboard ──────────────────────────────────────────────────────

test('buildPortfolioDashboard is present in builder', () => {
  assert.match(builder, /buildPortfolioDashboard/);
});

test('buildPortfolioDashboard includes portfolio brief widgets', () => {
  assert.match(builder, /buildPortfolioBriefWidget/);
});

// ─── Workspace Dashboard ──────────────────────────────────────────────────────

test('buildWorkspaceDashboard is present in builder', () => {
  assert.match(builder, /buildWorkspaceDashboard/);
});

test('buildWorkspaceDashboard composes all 4 brief types', () => {
  assert.match(builder, /buildExecutiveBriefWidget/);
  assert.match(builder, /buildGovernanceBriefWidget/);
  assert.match(builder, /buildOperationalBriefWidget/);
  assert.match(builder, /buildPortfolioBriefWidget/);
});

test('buildWorkspaceDashboard includes knowledge domains widget', () => {
  assert.match(builder, /buildKnowledgeDomainsWidget/);
});

test('buildWorkspaceDashboard accepts all four brief type arrays', () => {
  assert.match(builder, /executiveBriefs/);
  assert.match(builder, /governanceBriefs/);
  assert.match(builder, /operationalBriefs/);
  assert.match(builder, /portfolioBriefs/);
});

// ─── Mixed Dashboard ──────────────────────────────────────────────────────────

test('buildMixedDashboard is present in builder', () => {
  assert.match(builder, /buildMixedDashboard/);
});

test('buildMixedDashboard accepts DashboardInputBrief array', () => {
  assert.match(builder, /DashboardInputBrief/);
});

test('buildMixedDashboard only composes supplied artifacts', () => {
  assert.match(builder, /input\.briefType/);
  assert.match(builder, /briefType.*executive/);
  assert.match(builder, /briefType.*governance/);
  assert.match(builder, /briefType.*operational/);
  assert.match(builder, /briefType.*portfolio/);
});

// ─── buildConstitutionalDashboard ─────────────────────────────────────────────

test('buildConstitutionalDashboard is present in builder', () => {
  assert.match(builder, /buildConstitutionalDashboard/);
});

test('buildConstitutionalDashboard accepts dashboardType parameter', () => {
  assert.match(builder, /ConstitutionalDashboardType/);
});

test('buildConstitutionalDashboard is async', () => {
  assert.match(builder, /async function buildConstitutionalDashboard/);
});

// ─── Widget generation ────────────────────────────────────────────────────────

test('buildExecutiveBriefWidget is present in dashboard-widgets', () => {
  assert.match(widgets, /buildExecutiveBriefWidget/);
  assert.match(widgets, /widgetType.*executive_brief|executive_brief.*widgetType/);
});

test('buildGovernanceBriefWidget is present in dashboard-widgets', () => {
  assert.match(widgets, /buildGovernanceBriefWidget/);
  assert.match(widgets, /governance_brief/);
});

test('buildOperationalBriefWidget is present in dashboard-widgets', () => {
  assert.match(widgets, /buildOperationalBriefWidget/);
  assert.match(widgets, /operational_brief/);
});

test('buildPortfolioBriefWidget is present in dashboard-widgets', () => {
  assert.match(widgets, /buildPortfolioBriefWidget/);
  assert.match(widgets, /portfolio_brief/);
});

test('buildEvidenceSummaryWidget is present', () => {
  assert.match(widgets, /buildEvidenceSummaryWidget/);
  assert.match(widgets, /evidence_summary/);
});

test('buildTimelineWidget is present', () => {
  assert.match(widgets, /buildTimelineWidget/);
  assert.match(widgets, /widgetType.*timeline|timeline.*widgetType/);
});

test('buildContradictionsWidget is present', () => {
  assert.match(widgets, /buildContradictionsWidget/);
  assert.match(widgets, /widgetType.*contradictions|contradictions.*widgetType/);
});

test('buildUnknownsWidget is present', () => {
  assert.match(widgets, /buildUnknownsWidget/);
  assert.match(widgets, /widgetType.*unknowns|unknowns.*widgetType/);
});

test('buildKnowledgeDomainsWidget is present', () => {
  assert.match(widgets, /buildKnowledgeDomainsWidget/);
  assert.match(widgets, /knowledge_domains/);
});

test('widgets include sourceBriefs in output', () => {
  assert.match(widgets, /sourceBriefs/);
});

test('widgets include lineage in output', () => {
  assert.match(widgets, /lineage/);
});

test('widgets include evidence in output', () => {
  assert.match(widgets, /evidence/);
});

// ─── Timeline summary ─────────────────────────────────────────────────────────

test('buildDashboardTimelineSummary is present and sorts chronologically', () => {
  assert.match(builder, /buildDashboardTimelineSummary/);
  assert.match(builder, /sort/);
  assert.match(builder, /localeCompare|timestamp/);
});

test('timeline extraction functions are present for all brief types', () => {
  assert.match(widgets, /extractTimelineFromExecutiveBrief/);
  assert.match(widgets, /extractTimelineFromGovernanceBrief/);
  assert.match(widgets, /extractTimelineFromOperationalBrief/);
  assert.match(widgets, /extractTimelineFromPortfolioBrief/);
});

test('timeline extraction does not infer chronology', () => {
  assert.doesNotMatch(widgets, /inferChronol/i);
  assert.doesNotMatch(widgets, /estimate.*date/i);
});

// ─── Evidence summary ─────────────────────────────────────────────────────────

test('buildDashboardEvidenceSummary is present in builder', () => {
  assert.match(builder, /buildDashboardEvidenceSummary/);
});

test('evidence summary returns briefCount widgetCount evidenceCount', () => {
  assert.match(builder, /briefCount/);
  assert.match(builder, /widgetCount/);
  assert.match(builder, /evidenceCount/);
});

// ─── Contradictions reuse ─────────────────────────────────────────────────────

test('builder reuses contradictions from source briefs', () => {
  assert.match(builder, /contradictions.*flatMap|flatMap.*contradictions/);
});

test('builder does not create new contradictions', () => {
  assert.doesNotMatch(builder, /createContradiction/);
  assert.doesNotMatch(builder, /new.*Contradiction/);
});

test('builder does not resolve contradictions', () => {
  assert.doesNotMatch(builder, /resolveContradiction/);
  assert.doesNotMatch(builder, /resolve_contradiction/);
});

// ─── Unknowns reuse ───────────────────────────────────────────────────────────

test('builder reuses unknowns from source briefs', () => {
  assert.match(builder, /unknowns.*flatMap|flatMap.*unknowns/);
});

test('builder does not infer new unknowns', () => {
  assert.doesNotMatch(builder, /inferUnknown/);
  assert.doesNotMatch(builder, /infer_unknown/);
  assert.doesNotMatch(builder, /createUnknown/);
});

// ─── Export ───────────────────────────────────────────────────────────────────

test('exportConstitutionalDashboard is present in dashboard-export', () => {
  assert.match(exportFile, /exportConstitutionalDashboard/);
});

test('export format is json only', () => {
  assert.match(exportFile, /"json"/);
  assert.doesNotMatch(exportFile, /\.pdf\b|pdfExport|generatePdf|toPDF/i);
});

test('export includes all required fields', () => {
  for (const field of [
    'dashboard', 'widgets', 'briefReferences', 'evidenceSummary',
    'timelineSummary', 'contradictions', 'unknowns', 'exportedAt', 'format',
  ]) {
    assert.match(exportFile, new RegExp(field), `export missing field: ${field}`);
  }
});

test('export is exported from index', () => {
  assert.match(indexFile, /exportConstitutionalDashboard/);
});

// ─── Explanation ──────────────────────────────────────────────────────────────

test('explainConstitutionalDashboard is present in builder', () => {
  assert.match(builder, /explainConstitutionalDashboard/);
});

test('explanation produces widgetReasons', () => {
  assert.match(builder, /widgetReasons/);
});

test('explanation includes sourceBriefs', () => {
  assert.match(builder, /sourceBriefs.*briefReferences|briefReferences.*sourceBriefs/);
});

test('explanation includes unknowns', () => {
  const explainFn = builder.slice(builder.indexOf('explainConstitutionalDashboard'));
  assert.match(explainFn, /unknowns/);
});

test('explanation answers why widgets are included via widgetExplanation', () => {
  assert.match(builder, /widgetExplanation/);
  assert.match(builder, /Included because/);
});

test('explanation is exported from index', () => {
  assert.match(indexFile, /explainConstitutionalDashboard/);
});

// ─── Audit events ─────────────────────────────────────────────────────────────

test('builder emits CONSTITUTIONAL_DASHBOARD_GENERATED', () => {
  assert.match(builder, /CONSTITUTIONAL_DASHBOARD_GENERATED/);
});

test('builder emits CONSTITUTIONAL_DASHBOARD_EXPLAINED', () => {
  assert.match(builder, /CONSTITUTIONAL_DASHBOARD_EXPLAINED/);
});

test('export emits CONSTITUTIONAL_DASHBOARD_EXPORTED', () => {
  assert.match(exportFile, /CONSTITUTIONAL_DASHBOARD_EXPORTED/);
});

test('all audit events have learningEligible false', () => {
  assert.match(builder, /learningEligible:\s*false/);
  assert.match(exportFile, /learningEligible:\s*false/);
  assert.doesNotMatch(builder, /learningEligible:\s*true/);
  assert.doesNotMatch(exportFile, /learningEligible:\s*true/);
});

test('all audit events use governance category', () => {
  assert.match(builder, /eventCategory.*governance|governance.*eventCategory/);
  assert.match(exportFile, /eventCategory.*governance|governance.*eventCategory/);
});

test('all audit events have workspace visibility', () => {
  assert.match(builder, /visibility.*workspace|workspace.*visibility/);
  assert.match(exportFile, /visibility.*workspace|workspace.*visibility/);
});

test('all audit events reference constitutional_dashboard table', () => {
  assert.match(builder, /rawReferenceTable.*constitutional_dashboard/);
  assert.match(exportFile, /rawReferenceTable.*constitutional_dashboard/);
});

test('audit events set rawReferenceId to dashboard id', () => {
  assert.match(builder, /rawReferenceId.*dashboard\.id|rawReferenceId.*dashId/);
});

// ─── Health metrics ───────────────────────────────────────────────────────────

test('getDashboardHealth is present in builder', () => {
  assert.match(builder, /getDashboardHealth/);
});

test('getDashboardHealth returns widgetCount briefCount timelineCount', () => {
  const healthFn = builder.slice(builder.indexOf('getDashboardHealth'));
  assert.match(healthFn, /widgetCount/);
  assert.match(healthFn, /briefCount/);
  assert.match(healthFn, /timelineCount/);
  assert.match(healthFn, /contradictionCount/);
  assert.match(healthFn, /unknownCount/);
});

test('getDashboardHealth returns coverageMetrics', () => {
  const healthFn = builder.slice(builder.indexOf('getDashboardHealth'));
  assert.match(healthFn, /coverageMetrics/);
  assert.match(healthFn, /hasExecutiveBriefs/);
  assert.match(healthFn, /hasGovernanceBriefs/);
  assert.match(healthFn, /hasOperationalBriefs/);
  assert.match(healthFn, /hasPortfolioBriefs/);
});

test('getDashboardHealth is exported from index', () => {
  assert.match(indexFile, /getDashboardHealth/);
});

// ─── No persistence ───────────────────────────────────────────────────────────

test('builder does not create database tables or rows', () => {
  assert.doesNotMatch(builder, /INSERT INTO/i);
  assert.doesNotMatch(builder, /supabase.*from\(.*constitutional_dashboard/);
  assert.doesNotMatch(builder, /\.insert\(/);
});

test('types do not reference database row types', () => {
  assert.doesNotMatch(types, /ConstitutionalDashboardRow/);
  assert.doesNotMatch(types, /SELECTABLE_COLUMNS/);
});

// ─── Constitutional principles — no AI, no scoring, no ranking ────────────────

test('no AI library imports in any constitutional dashboard file', () => {
  for (const file of [types, builder, widgets, exportFile]) {
    assert.doesNotMatch(file, /from.*@\/lib\/ai/);
    assert.doesNotMatch(file, /openai/i);
    assert.doesNotMatch(file, /anthropic/i);
    assert.doesNotMatch(file, /import.*embed/i);
    assert.doesNotMatch(file, /vectorStore/i);
    assert.doesNotMatch(file, /semanticSearch/i);
    assert.doesNotMatch(file, /generateRecommendation/i);
    assert.doesNotMatch(file, /scoreRecord/i);
    assert.doesNotMatch(file, /rankRecord/i);
  }
});

// ─── Index exports ────────────────────────────────────────────────────────────

test('index exports all dashboard type functions', () => {
  assert.match(indexFile, /buildExecutiveDashboard/);
  assert.match(indexFile, /buildGovernanceDashboard/);
  assert.match(indexFile, /buildOperationalDashboard/);
  assert.match(indexFile, /buildPortfolioDashboard/);
  assert.match(indexFile, /buildWorkspaceDashboard/);
  assert.match(indexFile, /buildMixedDashboard/);
});

test('index exports all widget builders', () => {
  assert.match(indexFile, /buildExecutiveBriefWidget/);
  assert.match(indexFile, /buildGovernanceBriefWidget/);
  assert.match(indexFile, /buildOperationalBriefWidget/);
  assert.match(indexFile, /buildPortfolioBriefWidget/);
});

test('index exports timeline and evidence helpers', () => {
  assert.match(indexFile, /buildDashboardTimelineSummary/);
  assert.match(indexFile, /buildDashboardEvidenceSummary/);
  assert.match(indexFile, /extractTimelineFromExecutiveBrief/);
  assert.match(indexFile, /extractTimelineFromGovernanceBrief/);
  assert.match(indexFile, /extractTimelineFromOperationalBrief/);
  assert.match(indexFile, /extractTimelineFromPortfolioBrief/);
});

// ─── Documentation ────────────────────────────────────────────────────────────

test('docs describe what constitutional dashboard is', () => {
  assert.match(docs, /Constitutional Dashboard/);
  assert.match(docs, /deterministic/i);
  assert.match(docs, /auditable/i);
});

test('docs explain what it is not', () => {
  assert.match(docs, /No AI/i);
  assert.match(docs, /No scoring/i);
  assert.match(docs, /No ranking/i);
  assert.match(docs, /No prioritization/i);
});

test('docs include all 6 dashboard types', () => {
  for (const dt of ['executive', 'governance', 'operational', 'portfolio', 'workspace', 'mixed']) {
    assert.match(docs, new RegExp(dt, 'i'), `docs missing dashboard type: ${dt}`);
  }
});

test('docs explain widget model', () => {
  assert.match(docs, /Widget/i);
  assert.match(docs, /widgetType/i);
  assert.match(docs, /sourceBriefs/i);
});

test('docs cover evidence summary', () => {
  assert.match(docs, /Evidence Summary/i);
  assert.match(docs, /briefCount/i);
});

test('docs cover timeline summary', () => {
  assert.match(docs, /Timeline/i);
  assert.match(docs, /chronological/i);
});

test('docs cover contradictions', () => {
  assert.match(docs, /Contradiction/i);
  assert.match(docs, /not.*create|not.*resolve|Do not resolve/i);
});

test('docs cover unknowns', () => {
  assert.match(docs, /Unknown/i);
  assert.match(docs, /not.*infer|Do not infer/i);
});

test('docs cover export', () => {
  assert.match(docs, /export/i);
  assert.match(docs, /JSON/i);
  assert.match(docs, /No PDF/i);
});

test('docs cover auditability', () => {
  assert.match(docs, /audit/i);
  assert.match(docs, /CONSTITUTIONAL_DASHBOARD_GENERATED/);
  assert.match(docs, /CONSTITUTIONAL_DASHBOARD_EXPLAINED/);
  assert.match(docs, /CONSTITUTIONAL_DASHBOARD_EXPORTED/);
});

test('docs explain why no AI', () => {
  assert.match(docs, /Why No AI/i);
  assert.match(docs, /determinism/i);
});

test('docs explain why no scoring', () => {
  assert.match(docs, /Why No Scoring/i);
});

test('docs explain why no prioritization', () => {
  assert.match(docs, /Why No Prioritization/i);
});

test('docs include constitutional hierarchy diagram', () => {
  assert.match(docs, /Constitutional Intelligence/);
  assert.match(docs, /Constitutional Context Engine/);
  assert.match(docs, /Constitutional Brief/);
  assert.match(docs, /Executive Brief/i);
  assert.match(docs, /Governance Brief/i);
  assert.match(docs, /Operational Brief/i);
  assert.match(docs, /Portfolio Brief/i);
  assert.match(docs, /Constitutional Dashboard/);
});

test('docs state no persistence', () => {
  assert.match(docs, /not persisted|no.*table|no.*persist/i);
});
