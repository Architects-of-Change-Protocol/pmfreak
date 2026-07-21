"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { Modal } from "@/components/pmfreak/ui/modal";

type CreatedProject = { id: string; name: string };

type FieldErrors = Partial<Record<"name" | "description", string>>;

/**
 * Minimal, canonical "Create project" surface. Every empty-state / onboarding
 * CTA that needs to create a project opens this — no per-surface forms.
 * Only name is required; description is the sole optional field surfaced
 * here (PMO/methodology/icon/color stay on the advanced /projects/new
 * wizard and project settings, not duplicated here).
 */
export function CreateProjectModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated?: (project: CreatedProject) => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [created, setCreated] = useState<CreatedProject | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: description.trim() || null }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        data?: { project: CreatedProject };
        error?: string;
        fieldErrors?: Array<{ field: string; message: string }>;
      };

      if (!json.ok || !json.data) {
        if (json.fieldErrors) {
          const next: FieldErrors = {};
          for (const fe of json.fieldErrors) {
            if (fe.field === "name" || fe.field === "description") next[fe.field] = fe.message;
          }
          setFieldErrors(next);
        }
        setError(json.error ?? "Unable to create project.");
        return;
      }

      void mutate("/api/workspace-activation");
      setCreated(json.data.project);
      onCreated?.(json.data.project);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <Modal title="Project created" onClose={onClose} testId="create-project-modal-success">
        <p className="text-sm text-slate-600">Add the first task to begin tracking execution.</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.push(`/projects/${created.id}`)}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Add first task
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="Create project" onClose={onClose} testId="create-project-modal">
      <form onSubmit={handleSubmit} className="space-y-4" data-testid="create-project-form">
        {error && (
          <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        )}
        <div>
          <label htmlFor="create-project-name" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Project name
          </label>
          <input
            id="create-project-name"
            name="name"
            required
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="ERP Phase 2 rollout"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? "create-project-name-error" : undefined}
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
          />
          {fieldErrors.name && (
            <p id="create-project-name-error" className="mt-1 text-xs text-rose-700">
              {fieldErrors.name}
            </p>
          )}
        </div>
        <div>
          <label htmlFor="create-project-description" className="block text-xs font-medium uppercase tracking-wide text-slate-500">
            Description <span className="normal-case text-slate-400">(optional)</span>
          </label>
          <textarea
            id="create-project-description"
            name="description"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Sponsor expectations, major dependencies, timeline pressure"
            className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300/70"
          />
          {fieldErrors.description && <p className="mt-1 text-xs text-rose-700">{fieldErrors.description}</p>}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Creating project…" : "Create project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
