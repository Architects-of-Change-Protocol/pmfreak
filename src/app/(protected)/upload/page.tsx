"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { DragEvent, useEffect, useMemo, useState } from "react";
import { utils, writeFileXLSX } from "xlsx";
import { jsPDF } from "jspdf";

type UploadResponseFile = {
  fileName: string;
  contentType: string;
  size: number;
  extractedText: string;
};

type UploadResponse = {
  ok: true;
  projectId: string;
  projectName: string;
  uploadedCount: number;
  uploadedFileNames: string[];
  ingestion: {
    startedAt: string;
    completedAt: string;
    status: "completed";
    extractedSignals: { risks: number; stakeholders: number };
  };
  files: UploadResponseFile[];
};
type UploadErrorResponse = { ok: false; error: string; code: string };

type ProjectContextResponse = {
  id: string;
  name: string;
};


type BillingStateResponse = {
  subscription: {
    plan: "free" | "pro" | "enterprise";
    subscriptionStatus: string;
  };
  usage: {
    uploadCount: number;
    currentMonth: string;
  };
  limits: {
    uploadLimit: number | null;
    canRunAiAnalysis: boolean;
    canExportReports: boolean;
    canUsePortfolioMemory: boolean;
  };
};

type RuleBasedAnalysisResult = {
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  risks: string[];
  dependencies: string[];
  ambiguousStatements: string[];
  missingInformation: string[];
  suggestedClientQuestions: string[];
  estimatedComplexity: {
    level: "Low" | "Medium" | "High";
    rationale: string;
  };
};

type AIAnalysisResult = {
  executive_summary: string;
  functional_requirements: string[];
  non_functional_requirements: string[];
  risks: string[];
  dependencies: string[];
  ambiguities: string[];
  missing_information: string[];
  client_questions: string[];
  suggested_next_steps: string[];
  complexity: "Low" | "Medium" | "High";
  similar_projects: string[];
  historical_risks: string[];
  estimated_relative_complexity: string;
};
type AIAnalysisErrorResponse = { error: string; redirect?: string };

type DisplayAnalysisResult = {
  executiveSummary: string;
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  risks: string[];
  dependencies: string[];
  ambiguities: string[];
  missingInformation: string[];
  clientQuestions: string[];
  suggestedNextSteps: string[];
  complexityLevel: "Low" | "Medium" | "High";
  complexityRationale: string;
  similarProjects: string[];
  historicalRisks: string[];
  estimatedRelativeComplexity: string;
};

type RequirementMatrixRow = {
  ID: string;
  Requirement: string;
  Type: "Functional" | "Non-Functional";
  Priority: "High" | "Medium";
  Owner: string;
  Notes: string;
};

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
]);

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const SECTION_PATTERNS = [
  /^scope\b/i,
  /^deliverables?\b/i,
  /^timeline\b/i,
  /^assumptions?\b/i,
  /^exclusions?\b/i,
  /^requirements?\b/i,
  /^dependencies?\b/i,
  /^risks?\b/i,
  /^constraints?\b/i,
  /^acceptance criteria\b/i,
  /^out of scope\b/i,
];

const KEYWORDS = {
  functional: [
    /\bshall\b/i,
    /\bmust\b/i,
    /\bwill\b/i,
    /\bprovide\b/i,
    /\bbuild\b/i,
    /\bimplement\b/i,
    /\bintegrate\b/i,
    /\bfeature\b/i,
    /\bworkflow\b/i,
    /\bupload\b/i,
  ],
  nonFunctional: [
    /\bperformance\b/i,
    /\bsecure|security\b/i,
    /\bavailability\b/i,
    /\bscalable|scalability\b/i,
    /\breliable|reliability\b/i,
    /\bcompliance\b/i,
    /\blatency\b/i,
    /\bresponse time\b/i,
    /\buptime\b/i,
    /\baccessibility\b/i,
  ],
  risk: [
    /\brisk\b/i,
    /\bdelay\b/i,
    /\bblocked\b/i,
    /\bunknown\b/i,
    /\buncertain\b/i,
    /\bchallenge\b/i,
    /\bissue\b/i,
    /\bdependency\b/i,
    /\bconstraint\b/i,
  ],
  dependency: [
    /\bthird[- ]party\b/i,
    /\bapi\b/i,
    /\bintegration\b/i,
    /\bvendor\b/i,
    /\bclient\b/i,
    /\bstakeholder\b/i,
    /\bapproval\b/i,
    /\baccess\b/i,
    /\benvironment\b/i,
    /\bdata source\b/i,
  ],
  ambiguous: [
    /\betc\.?\b/i,
    /\bas needed\b/i,
    /\bif possible\b/i,
    /\bquickly\b/i,
    /\buser-friendly\b/i,
    /\bsoon\b/i,
    /\bappropriate\b/i,
    /\brobust\b/i,
    /\boptimi[sz]e\b/i,
    /\bTBD|TBA|to be defined|to be confirmed\b/i,
  ],
};

const MISSING_INFO_CHECKS = [
  {
    key: "timeline",
    regex: /\b(timeline|deadline|milestone|go-live|delivery date|schedule)\b/i,
    message: "Timeline and milestone dates are missing or unclear.",
  },
  {
    key: "budget",
    regex: /\b(budget|cost|estimate|pricing|hours|effort)\b/i,
    message: "Budget or effort estimates are not specified.",
  },
  {
    key: "acceptance",
    regex: /\b(acceptance criteria|success criteria|definition of done|sign-off)\b/i,
    message: "Acceptance/success criteria are missing.",
  },
  {
    key: "owners",
    regex: /\b(owner|responsible|RACI|stakeholder|point of contact|approver)\b/i,
    message: "Owners and approvers are not clearly defined.",
  },
  {
    key: "security",
    regex: /\b(security|compliance|privacy|PII|encryption|SOC 2|HIPAA|GDPR)\b/i,
    message: "Security/compliance requirements are not covered.",
  },
  {
    key: "environment",
    regex: /\b(environment|staging|production|deployment|infrastructure)\b/i,
    message: "Environment and deployment expectations are missing.",
  },
];

const DEDUPE_NORMALIZE = /\s+/g;

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const cleanLine = (line: string) => line.replace(/^[-*•\d.)\s]+/, "").trim();

const parseSections = (rawText: string) => {
  const lines = rawText.split(/\r?\n/);
  const sections: { heading: string; lines: string[] }[] = [];

  let current = { heading: "General", lines: [] as string[] };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const looksLikeHeading =
      trimmed.length <= 70 &&
      SECTION_PATTERNS.some((pattern) => pattern.test(trimmed.replace(/:$/, "")));

    if (looksLikeHeading) {
      if (current.lines.length > 0) {
        sections.push(current);
      }
      current = { heading: trimmed.replace(/:$/, ""), lines: [] };
      continue;
    }

    current.lines.push(cleanLine(trimmed));
  }

  if (current.lines.length > 0) {
    sections.push(current);
  }

  return sections;
};

const dedupe = (items: string[]) => {
  const map = new Map<string, string>();

  items.forEach((item) => {
    const normalized = item.toLowerCase().replace(DEDUPE_NORMALIZE, " ").trim();
    if (!normalized || map.has(normalized)) {
      return;
    }
    map.set(normalized, item.trim());
  });

  return Array.from(map.values());
};

const pickComplexity = (input: {
  functionalCount: number;
  riskCount: number;
  dependencyCount: number;
  missingCount: number;
}) => {
  const score =
    input.functionalCount * 1.2 +
    input.riskCount * 1.5 +
    input.dependencyCount * 1.3 +
    input.missingCount * 1.7;

  if (score >= 18) {
    return {
      level: "High" as const,
      rationale:
        "High scope or uncertainty detected from requirement volume, external dependencies, and unresolved details.",
    };
  }

  if (score >= 10) {
    return {
      level: "Medium" as const,
      rationale:
        "Moderate delivery complexity based on the current level of scope definition and project risk indicators.",
    };
  }

  return {
    level: "Low" as const,
    rationale: "Scope appears relatively contained with fewer blockers and open clarification points.",
  };
};

const analyzeScopeText = (projectName: string, files: UploadResponseFile[]): RuleBasedAnalysisResult => {
  const combinedText = files
    .map((file) => `# ${file.fileName}\n${file.extractedText || ""}`)
    .join("\n\n");

  const sections = parseSections(combinedText);
  const allLines = sections.flatMap((section) => section.lines);

  const functionalRequirements = dedupe(
    allLines.filter((line) => KEYWORDS.functional.some((pattern) => pattern.test(line))),
  ).slice(0, 14);

  const nonFunctionalRequirements = dedupe(
    allLines.filter((line) => KEYWORDS.nonFunctional.some((pattern) => pattern.test(line))),
  ).slice(0, 10);

  const risks = dedupe(allLines.filter((line) => KEYWORDS.risk.some((pattern) => pattern.test(line)))).slice(0, 10);

  const dependencies = dedupe(
    allLines.filter((line) => KEYWORDS.dependency.some((pattern) => pattern.test(line))),
  ).slice(0, 10);

  const ambiguousStatements = dedupe(
    allLines.filter((line) => KEYWORDS.ambiguous.some((pattern) => pattern.test(line))),
  ).slice(0, 10);

  const missingInformation = MISSING_INFO_CHECKS.filter(
    (check) => !check.regex.test(combinedText),
  ).map((check) => check.message);

  const suggestedClientQuestions = dedupe([
    missingInformation.some((item) => item.toLowerCase().includes("timeline"))
      ? "What are the exact target milestone dates and final delivery deadline?"
      : "Can you confirm the order of milestones and their approval gates?",
    missingInformation.some((item) => item.toLowerCase().includes("budget"))
      ? "Do you have a fixed budget or expected effort range for this scope?"
      : "Should this be delivered in phases to manage cost and schedule?",
    missingInformation.some((item) => item.toLowerCase().includes("acceptance"))
      ? "What measurable acceptance criteria define project success?"
      : "Who signs off each deliverable, and what evidence is required for acceptance?",
    missingInformation.some((item) => item.toLowerCase().includes("owners"))
      ? "Who are the primary owner, approver, and day-to-day contact on your side?"
      : "Which stakeholders must be included in weekly review checkpoints?",
    missingInformation.some((item) => item.toLowerCase().includes("security"))
      ? "Are there compliance, security, or data handling standards we must meet?"
      : "Do we need formal security review before production rollout?",
    dependencies.length > 0
      ? "Which third-party systems or client-provided APIs are critical path dependencies?"
      : "Are there any external vendors, systems, or access dependencies not yet listed?",
    `Are there assumptions in ${projectName || "this project"} scope that should be moved into explicit requirements?`,
  ]).slice(0, 8);

  const estimatedComplexity = pickComplexity({
    functionalCount: functionalRequirements.length,
    riskCount: risks.length,
    dependencyCount: dependencies.length,
    missingCount: missingInformation.length,
  });

  return {
    functionalRequirements,
    nonFunctionalRequirements,
    risks,
    dependencies,
    ambiguousStatements,
    missingInformation,
    suggestedClientQuestions,
    estimatedComplexity,
  };
};

const fallbackItems = (items: string[], fallback: string) => (items.length > 0 ? items : [fallback]);

const mapRuleBasedAnalysisToDisplay = (
  uploadResult: UploadResponse,
  analysisResult: RuleBasedAnalysisResult,
): DisplayAnalysisResult => ({
  executiveSummary: `Rule-based extraction completed for ${uploadResult.projectName}. Review the requirement lists, flagged ambiguities, and clarification prompts before estimation.`,
  functionalRequirements: analysisResult.functionalRequirements,
  nonFunctionalRequirements: analysisResult.nonFunctionalRequirements,
  risks: analysisResult.risks,
  dependencies: analysisResult.dependencies,
  ambiguities: analysisResult.ambiguousStatements,
  missingInformation: analysisResult.missingInformation,
  clientQuestions: analysisResult.suggestedClientQuestions,
  suggestedNextSteps: [
    "Confirm timeline, scope boundaries, and acceptance criteria with the client.",
    "Prioritize requirements and convert them into deliverable user stories/tasks.",
    "Validate dependencies and assign clear owners for each critical-path item.",
  ],
  complexityLevel: analysisResult.estimatedComplexity.level,
  complexityRationale: analysisResult.estimatedComplexity.rationale,
  similarProjects: [],
  historicalRisks: [],
  estimatedRelativeComplexity: "Portfolio baseline not available in rule-based mode.",
});

const mapAIAnalysisToDisplay = (analysisResult: AIAnalysisResult): DisplayAnalysisResult => ({
  executiveSummary: analysisResult.executive_summary,
  functionalRequirements: analysisResult.functional_requirements,
  nonFunctionalRequirements: analysisResult.non_functional_requirements,
  risks: analysisResult.risks,
  dependencies: analysisResult.dependencies,
  ambiguities: analysisResult.ambiguities,
  missingInformation: analysisResult.missing_information,
  clientQuestions: analysisResult.client_questions,
  suggestedNextSteps: analysisResult.suggested_next_steps,
  complexityLevel: analysisResult.complexity,
  complexityRationale: `AI-assessed complexity for this scope is ${analysisResult.complexity}.`,
  similarProjects: analysisResult.similar_projects,
  historicalRisks: analysisResult.historical_risks,
  estimatedRelativeComplexity: analysisResult.estimated_relative_complexity,
});

const createRequirementMatrix = (analysisResult: DisplayAnalysisResult): RequirementMatrixRow[] => {
  const functionalRows = analysisResult.functionalRequirements.map((requirement, index) => ({
    ID: `FR-${index + 1}`,
    Requirement: requirement,
    Type: "Functional" as const,
    Priority: "High" as const,
    Owner: "Product Owner",
    Notes: "Captured from uploaded scope text.",
  }));

  const nonFunctionalRows = analysisResult.nonFunctionalRequirements.map((requirement, index) => ({
    ID: `NFR-${index + 1}`,
    Requirement: requirement,
    Type: "Non-Functional" as const,
    Priority: "Medium" as const,
    Owner: "Tech Lead",
    Notes: "Needs acceptance criteria confirmation.",
  }));

  return [...functionalRows, ...nonFunctionalRows];
};

const toFileSafeName = (projectName: string, fallback: string) =>
  (projectName.trim() || fallback).replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "");

type AnalysisCardProps = {
  title: string;
  items?: string[];
  accent: string;
  description?: string;
};

function AnalysisCard({ title, items, accent, description }: AnalysisCardProps) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/15 bg-white/45 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.35)] backdrop-blur">
      <div className={`absolute inset-x-0 top-0 h-1 ${accent}`} />
      <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-100">{title}</h3>
      {description ? <p className="mt-2 text-sm text-slate-300">{description}</p> : null}
      {items && items.length > 0 ? (
        <ul className="mt-3 space-y-2 text-sm text-slate-200">
          {items.map((item) => (
            <li key={item} className="flex gap-2">
              <span className="mt-1 text-cyan-200">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export default function UploadPage() {
  const searchParams = useSearchParams();
  const selectedProjectId = searchParams.get("projectId")?.trim() ?? "";

  const [projectName, setProjectName] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isAiAnalyzing, setIsAiAnalyzing] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<AIAnalysisResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAiUpgradeCta, setShowAiUpgradeCta] = useState(false);
  const [billingState, setBillingState] = useState<BillingStateResponse | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);

  const projectNameIsValid = projectName.trim().length > 0;

  const canUpload = useMemo(
    () => Boolean(selectedProjectId) && projectNameIsValid && selectedFiles.length > 0 && !isUploading,
    [selectedProjectId, projectNameIsValid, selectedFiles.length, isUploading],
  );



  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    const loadProjectContext = async () => {
      try {
        const response = await fetch(`/api/projects/${selectedProjectId}`);
        const payload = (await response.json()) as ProjectContextResponse | { error: string };

        if (!response.ok || "error" in payload) {
          setProjectName("");
          return;
        }

        setProjectName(payload.name);
      } catch {
        setProjectName("");
      }
    };

    void loadProjectContext();
  }, [selectedProjectId]);

  useEffect(() => {
    const loadBillingState = async () => {
      try {
        const response = await fetch("/api/billing/state");
        const payload = (await response.json()) as BillingStateResponse | { error: string };

        if (!response.ok || "error" in payload) {
          setBillingError("Unable to load billing limits.");
          setBillingState(null);
          return;
        }

        setBillingState(payload);
        setBillingError(null);
      } catch {
        setBillingError("Unable to load billing limits.");
        setBillingState(null);
      }
    };

    void loadBillingState();
  }, []);

  const ruleBasedAnalysisResult = useMemo(
    () => (uploadResult ? analyzeScopeText(uploadResult.projectName, uploadResult.files) : null),
    [uploadResult],
  );

  const displayAnalysisResult = useMemo(() => {
    if (!uploadResult || !ruleBasedAnalysisResult) {
      return null;
    }

    if (aiAnalysisResult) {
      return mapAIAnalysisToDisplay(aiAnalysisResult);
    }

    return mapRuleBasedAnalysisToDisplay(uploadResult, ruleBasedAnalysisResult);
  }, [uploadResult, ruleBasedAnalysisResult, aiAnalysisResult]);

  const requirementMatrix = useMemo(
    () => (displayAnalysisResult ? createRequirementMatrix(displayAnalysisResult) : []),
    [displayAnalysisResult],
  );

  const validateFiles = (incomingFiles: File[]) => {
    const validFiles: File[] = [];
    const errors: string[] = [];

    incomingFiles.forEach((file) => {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        errors.push(`\"${file.name}\" is not a supported format.`);
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        errors.push(`\"${file.name}\" exceeds the 10 MB size limit (${formatFileSize(file.size)}).`);
        return;
      }

      validFiles.push(file);
    });

    setValidationErrors(errors);
    setUploadError(null);
    setUploadResult(null);
    setAiAnalysisResult(null);
    setAiError(null);
    setShowAiUpgradeCta(false);
    setSelectedFiles(validFiles);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const droppedFiles = Array.from(event.dataTransfer.files);
    validateFiles(droppedFiles);
  };

  const handleUpload = async () => {
    if (!canUpload) {
      return;
    }

    if (!selectedProjectId) {
      setUploadError("Project context is required. Open Upload from a project.");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", selectedProjectId);
    formData.append("projectName", projectName.trim());

    selectedFiles.forEach((file) => {
      formData.append("documents", file);
    });

    setIsUploading(true);
    setUploadError(null);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as UploadResponse | UploadErrorResponse;

      if (!response.ok || !payload.ok) {
        setUploadResult(null);
        setUploadError(payload.ok ? "Upload failed." : payload.error);
        return;
      }

      setUploadResult(payload);
      setAiAnalysisResult(null);
      setAiError(null);
      setShowAiUpgradeCta(false);
    } catch {
      setUploadError("Unable to upload right now. Please try again.");
      setUploadResult(null);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRunAiAnalysis = async () => {
    if (!uploadResult || isAiAnalyzing) {
      return;
    }

    setIsAiAnalyzing(true);
    setAiError(null);
    setShowAiUpgradeCta(false);

    try {
      const extractedScopeText = uploadResult.files
        .map((file) => `# ${file.fileName}\n${file.extractedText || ""}`)
        .join("\n\n");

      if (!uploadResult?.projectId) {
        setAiError("Missing project context. Please recreate the project.");
        return;
      }

      const response = await fetch("/api/analyze-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          projectId: uploadResult.projectId,
          projectName: uploadResult.projectName,
          extractedScopeText,
          sourceFileNames: uploadResult.files.map((file) => file.fileName),
        }),
      });

      const payload = (await response.json()) as AIAnalysisResult | AIAnalysisErrorResponse;

      if (response.status === 402) {
        setAiAnalysisResult(null);
        setAiError("You’ve reached your free limit. Upgrade to continue.");
        setShowAiUpgradeCta(true);
        return;
      }

      if (!response.ok || "error" in payload) {
        setAiAnalysisResult(null);
        if (response.status === 402) {
          setAiError("You’ve reached your free limit of 3 AI analyses. Upgrade to continue.");
          setShowAiUpgradeCta(true);
          return;
        }
        setAiError(
          "error" in payload
            ? payload.error
            : "AI analysis failed. Showing Sprint 4 rule-based output instead.",
        );
        return;
      }

      setAiAnalysisResult(payload);
      setShowAiUpgradeCta(false);
    } catch {
      setAiAnalysisResult(null);
      setAiError("AI analysis is currently unavailable. Showing Sprint 4 rule-based output.");
      setShowAiUpgradeCta(false);
    } finally {
      setIsAiAnalyzing(false);
    }
  };

  const downloadRequirementMatrix = () => {
    if (!displayAnalysisResult || !uploadResult || !billingState?.limits.canExportReports) {
      return;
    }

    try {
      const workbook = utils.book_new();
      const rows = requirementMatrix.length
        ? requirementMatrix
        : [
            {
              ID: "FR-1",
              Requirement: "No requirement statements were detected in the uploaded text.",
              Type: "Functional" as const,
              Priority: "Medium" as const,
              Owner: "Product Owner",
              Notes: "Add explicit requirements and re-run analysis.",
            },
          ];
      const worksheet = utils.json_to_sheet(rows, {
        header: ["ID", "Requirement", "Type", "Priority", "Owner", "Notes"],
      });
      worksheet["!cols"] = [
        { wch: 10 },
        { wch: 72 },
        { wch: 18 },
        { wch: 12 },
        { wch: 20 },
        { wch: 50 },
      ];
      utils.book_append_sheet(workbook, worksheet, "Requirement Matrix");
      writeFileXLSX(
        workbook,
        `${toFileSafeName(uploadResult.projectName, "pmfreak_project")}_requirement_matrix.xlsx`,
      );
      setExportError(null);
    } catch {
      setExportError("Unable to export Excel file right now. Please try again.");
    }
  };

  const downloadExecutiveSummary = () => {
    if (!displayAnalysisResult || !uploadResult || !billingState?.limits.canExportReports) {
      return;
    }

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 16;
      let y = 20;

      doc.setFontSize(18);
      doc.text("PMFreak AI Executive Summary", marginX, y);
      y += 10;

      doc.setFontSize(11);
      const summaryLines = [
        `Project name: ${uploadResult.projectName}`,
        `Complexity: ${displayAnalysisResult.complexityLevel}`,
      ];

      summaryLines.forEach((line) => {
        doc.text(line, marginX, y);
        y += 7;
      });

      const addSection = (title: string, items: string[]) => {
        if (y > 255) {
          doc.addPage();
          y = 20;
        }
        doc.setFontSize(13);
        doc.text(title, marginX, y);
        y += 6;
        doc.setFontSize(11);
        const content = items.length > 0 ? items : ["None noted."];
        content.forEach((item) => {
          const wrapped = doc.splitTextToSize(`• ${item}`, pageWidth - marginX * 2);
          doc.text(wrapped, marginX, y);
          y += wrapped.length * 5 + 1;
          if (y > 260) {
            doc.addPage();
            y = 20;
          }
        });
        y += 2;
      };

      addSection("Executive summary", [displayAnalysisResult.executiveSummary]);
      addSection("Risks", displayAnalysisResult.risks);
      addSection("Missing info", displayAnalysisResult.missingInformation);
      addSection("Client questions", displayAnalysisResult.clientQuestions);
      addSection("Recommended next actions", displayAnalysisResult.suggestedNextSteps);

      doc.save(`${toFileSafeName(uploadResult.projectName, "pmfreak_project")}_executive_summary.pdf`);
      setExportError(null);
    } catch {
      setExportError("Unable to export PDF file right now. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-16 text-white">
      <main className="mx-auto w-full max-w-6xl space-y-8 rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-xl md:p-12">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">PMFreak AI • Sprint 6</p>
            <Link
              href="/portfolio"
              className="inline-flex h-9 items-center justify-center rounded-full border border-cyan-300/60 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-300/10"
            >
              View Portfolio
            </Link>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Document Intake & Scope Analyzer</h1>
          <p className="text-sm text-slate-300 md:text-base">
            Upload PDF, DOCX, XLSX, PPTX, or TXT files, preview extraction output, then run AI-powered scope analysis.
          </p>
          {billingState ? (
            <p className="text-xs text-slate-400">
              Plan: <span className="font-semibold text-cyan-200">{billingState.subscription.plan}</span>
              {billingState.limits.uploadLimit !== null
                ? ` • Uploads this month: ${billingState.usage.uploadCount}/${billingState.limits.uploadLimit}`
                : " • Unlimited uploads"}
            </p>
          ) : null}
          {billingError ? <p className="text-xs text-rose-200">{billingError}</p> : null}
        </div>

        <section className="space-y-3">
          <label htmlFor="project-name" className="text-sm font-medium text-slate-200">
            Project Name
          </label>
          <input
            id="project-name"
            name="projectName"
            value={projectName}
            onChange={(event) => setProjectName(event.target.value)}
            placeholder="Acme Vendor Contract Review"
            className="w-full rounded-xl border border-white/10 bg-white/20 px-4 py-3 text-sm text-white outline-none ring-cyan-300/50 placeholder:text-slate-400 focus:ring"
          />
        </section>

        <section className="space-y-4">
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${
              isDragging
                ? "border-cyan-300 bg-cyan-300/10"
                : "border-white/20 bg-white/40 hover:border-cyan-200/60"
            }`}
          >
            <p className="text-base font-medium">Drag & drop documents here</p>
            <p className="mt-1 text-sm text-slate-300">or select from your device</p>
            <label className="mt-5 inline-flex cursor-pointer rounded-full border border-cyan-300/60 px-5 py-2 text-sm font-medium text-cyan-200 transition hover:bg-cyan-300/10">
              Choose Files
              <input
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.pptx,.txt"
                onChange={(event) => validateFiles(Array.from(event.target.files ?? []))}
                className="sr-only"
              />
            </label>
            <p className="mt-4 text-xs text-slate-400">Accepted: PDF, DOCX, XLSX, PPTX, TXT • Max 10 MB per file</p>
          </div>

          {validationErrors.length > 0 ? (
            <ul className="space-y-1 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {validationErrors.map((error) => (
                <li key={error}>• {error}</li>
              ))}
            </ul>
          ) : null}

          {selectedFiles.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/20 px-4 py-3">
              <h2 className="text-sm font-medium text-slate-200">Selected Files ({selectedFiles.length})</h2>
              <ul className="mt-2 space-y-2 text-sm text-slate-300">
                {selectedFiles.map((file) => (
                  <li key={`${file.name}-${file.lastModified}`} className="flex items-center justify-between gap-3">
                    <span className="truncate">{file.name}</span>
                    <span className="text-xs text-slate-400">{formatFileSize(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleUpload}
            disabled={!canUpload || (billingState ? billingState.limits.uploadLimit !== null && billingState.usage.uploadCount >= billingState.limits.uploadLimit : false)}
            className="inline-flex h-11 items-center justify-center rounded-full bg-cyan-300 px-6 text-sm font-semibold text-slate-900 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            {isUploading ? "Uploading..." : "Upload Documents"}
          </button>

          {uploadError ? (
            <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
              {uploadError}
            </p>
          ) : null}
        </section>

        {uploadResult ? (
          <section className="space-y-4 rounded-2xl border border-emerald-300/30 bg-emerald-300/10 p-5">
            <h2 className="text-lg font-semibold text-emerald-100">Extracted Preview</h2>
            <p className="text-sm text-emerald-50">
              Project: <span className="font-medium">{uploadResult.projectName}</span>
            </p>
            <p className="text-sm text-emerald-100/90">
              Uploaded {uploadResult.uploadedCount} document(s). Detected {uploadResult.ingestion.extractedSignals.risks} risks and {uploadResult.ingestion.extractedSignals.stakeholders} stakeholders.
            </p>
            <p className="text-xs text-emerald-100/80">Project memory updated. Next recommended action: Run AI Analysis or ask Copilot for a mitigation plan.</p>
            <div className="space-y-4">
              {uploadResult.files.map((file) => (
                <article key={file.fileName} className="rounded-xl border border-white/20 bg-white/20 p-4">
                  <h3 className="text-sm font-semibold text-white">{file.fileName}</h3>
                  <p className="mt-1 text-xs text-slate-300">{file.contentType}</p>
                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap rounded-lg bg-white/80 p-3 text-xs text-slate-200">
                    {file.extractedText || "No readable text was extracted from this file."}
                  </pre>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {uploadResult ? (
          <section className="space-y-3 rounded-2xl border border-violet-300/30 bg-violet-400/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-violet-100">Sprint 5 AI Analysis</h2>
              <button
                type="button"
                onClick={handleRunAiAnalysis}
                disabled={isAiAnalyzing || !uploadResult}
                className="inline-flex h-10 items-center justify-center rounded-full bg-violet-300 px-5 text-sm font-semibold text-slate-900 transition hover:bg-violet-200 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                {isAiAnalyzing ? "Running AI Analysis..." : "Run AI Analysis"}
              </button>
            </div>
            <p className="text-sm text-violet-100/90">
              Generate structured analysis with executive summary, risks, dependencies, and next steps.
            </p>
            {aiError ? (
              <div className="space-y-2 rounded-xl border border-amber-300/40 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
                <p>{aiError}</p>
                {showAiUpgradeCta ? (
                  <a
                    href="/pricing"
                    className="inline-flex h-9 items-center justify-center rounded-full bg-amber-200 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-900 transition hover:bg-amber-100"
                  >
                    Upgrade
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        {displayAnalysisResult ? (
          <section className="space-y-5 rounded-2xl border border-cyan-300/30 bg-cyan-500/5 p-5 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold text-cyan-100">AI Scope Output</h2>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={downloadRequirementMatrix}
                  disabled={!billingState?.limits.canExportReports}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-cyan-200/70 bg-cyan-300/15 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-300/25 disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500"
                >
                  Download Matrix (.xlsx)
                </button>
                <button
                  type="button"
                  onClick={downloadExecutiveSummary}
                  disabled={!billingState?.limits.canExportReports}
                  className="inline-flex h-9 items-center justify-center rounded-full border border-violet-200/70 bg-violet-300/15 px-4 text-xs font-semibold uppercase tracking-[0.12em] text-violet-100 transition hover:bg-violet-300/25 disabled:cursor-not-allowed disabled:border-slate-500 disabled:text-slate-500"
                >
                  Download Executive PDF
                </button>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${
                    displayAnalysisResult.complexityLevel === "High"
                      ? "bg-rose-300/20 text-rose-100"
                      : displayAnalysisResult.complexityLevel === "Medium"
                        ? "bg-amber-300/20 text-amber-100"
                        : "bg-emerald-300/20 text-emerald-100"
                  }`}
                >
                  Complexity: {displayAnalysisResult.complexityLevel}
                </span>
                <span className="rounded-full bg-indigo-300/20 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-indigo-100">
                  {aiAnalysisResult ? "AI Model" : "Fallback: Rule-Based"}
                </span>
              </div>
            </div>
            {!billingState?.limits.canExportReports ? (
              <p className="text-xs text-amber-100">Report exports require a Pro or Enterprise plan.</p>
            ) : null}

            {exportError ? (
              <p className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
                {exportError}
              </p>
            ) : null}

            <AnalysisCard
              title="Executive summary"
              accent="bg-indigo-300"
              description={displayAnalysisResult.executiveSummary}
            />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <AnalysisCard
                title="Functional requirements"
                accent="bg-cyan-300"
                items={fallbackItems(
                  displayAnalysisResult.functionalRequirements,
                  "No explicit functional requirement patterns were found.",
                )}
              />
              <AnalysisCard
                title="Non-functional requirements"
                accent="bg-violet-300"
                items={fallbackItems(
                  displayAnalysisResult.nonFunctionalRequirements,
                  "No explicit non-functional requirement patterns were found.",
                )}
              />
              <AnalysisCard
                title="Risks"
                accent="bg-rose-300"
                items={fallbackItems(
                  displayAnalysisResult.risks,
                  "No obvious risk keywords were detected in extracted text.",
                )}
              />
              <AnalysisCard
                title="Dependencies"
                accent="bg-amber-300"
                items={fallbackItems(
                  displayAnalysisResult.dependencies,
                  "No dependency-specific statements were detected in extracted text.",
                )}
              />
              <AnalysisCard
                title="Ambiguities"
                accent="bg-fuchsia-300"
                items={fallbackItems(
                  displayAnalysisResult.ambiguities,
                  "No major ambiguity markers were found via heuristic matching.",
                )}
              />
              <AnalysisCard
                title="Missing information"
                accent="bg-sky-300"
                items={fallbackItems(
                  displayAnalysisResult.missingInformation,
                  "No major gaps were flagged by baseline completeness checks.",
                )}
              />
              <AnalysisCard
                title="Client questions"
                accent="bg-emerald-300"
                items={displayAnalysisResult.clientQuestions}
              />
              <AnalysisCard
                title="Suggested next steps"
                accent="bg-teal-300"
                items={displayAnalysisResult.suggestedNextSteps}
              />
              <AnalysisCard
                title="Estimated complexity"
                accent="bg-indigo-300"
                description={displayAnalysisResult.complexityRationale}
              />
              <AnalysisCard
                title="Portfolio insights"
                accent="bg-purple-300"
                description={displayAnalysisResult.estimatedRelativeComplexity}
                items={[
                  `Similar projects: ${
                    displayAnalysisResult.similarProjects.length > 0
                      ? displayAnalysisResult.similarProjects.join(", ")
                      : "No close portfolio matches yet."
                  }`,
                  `Historical risks: ${
                    displayAnalysisResult.historicalRisks.length > 0
                      ? displayAnalysisResult.historicalRisks.slice(0, 3).join(" • ")
                      : "No historical risk trends yet."
                  }`,
                ]}
              />

            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
