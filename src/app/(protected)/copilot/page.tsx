import { redirect } from "next/navigation";

async function uploadDocumentsToCopilot(files: File[], projectId: string): Promise<void> {
  for (const file of files) {
    const body = new FormData();
    body.append("documents", file);
    body.append("projectId", projectId);
    await fetch("/api/upload", { method: "POST", body });
  }
}

void uploadDocumentsToCopilot;

export default function CopilotPage() {
  redirect("/workspace");
}
