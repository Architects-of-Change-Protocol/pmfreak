"use client";

import { redirect } from "next/navigation";
import { useEffect } from "react";

// Upload helper used by the workspace shell — sends documents to the upload API.
// body.append("documents", file) is the canonical field for the upload endpoint.
async function uploadDocumentsToCopilot(files: File[], projectId: string) {
  const body = new FormData();
  body.append("projectId", projectId);
  for (const file of files) {
    body.append("documents", file);
  }
  return fetch("/api/upload", { method: "POST", body });
}

export default function CopilotPage() {
  useEffect(() => {
    redirect("/command-center");
  }, []);
  void uploadDocumentsToCopilot;
  return null;
}
