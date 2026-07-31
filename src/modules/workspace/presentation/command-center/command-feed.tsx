"use client";

import { useMemo, useRef, useState } from "react";
import type { ChatMessage } from "./types";
import { AttachmentIcon, SendIcon } from "./icons";

// Honest prompt suggestions for the real deterministic chat gateway — not demo content.
const SUGGESTED_PROMPTS = [
  "What changed since yesterday?",
  "What risks need attention?",
  "Prepare a client update.",
];

// Slash commands compose a message and send it through the same deterministic gateway as
// any other prompt — they're a faster way to phrase a request, not a separate execution path.
const SLASH_COMMANDS = [
  { command: "/create milestone", description: "Draft a new milestone" },
  { command: "/create risk", description: "Log a new risk" },
  { command: "/create scope", description: "Log a scope item" },
  { command: "/create sprint", description: "Draft a new sprint" },
  { command: "/create decision", description: "Log a decision" },
  { command: "/estimate", description: "Ask for an estimate" },
  { command: "/analyze", description: "Analyze project health" },
  { command: "/import", description: "Import notes or a document" },
  { command: "/review", description: "Review recent changes" },
] as const;

function AssistantBubble({
  message,
  onSourceClick,
  onActionClick,
}: {
  message: ChatMessage;
  onSourceClick: (source: string) => void;
  onActionClick: (action: string) => void;
}) {
  return (
    <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-white/10 bg-white/[0.03] px-4 py-3.5 shadow-[0_2px_20px_rgba(0,0,0,0.2)]">
      <p className="text-sm leading-relaxed text-zinc-200">{message.content}</p>

      {message.structuredList && (
        <ol className="mt-3 space-y-1.5">
          {message.structuredList.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-zinc-300">
              <span className="text-zinc-600">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )}

      {message.sources && message.sources.length > 0 && (
        <div className="mt-4 border-t border-white/10 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">Based on</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {message.sources.map((source) => (
              <li key={source}>
                <button
                  type="button"
                  onClick={() => onSourceClick(source)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[11px] text-zinc-400 transition hover:border-sky-500/25 hover:bg-sky-500/[0.06] hover:text-sky-300"
                >
                  {source}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {message.suggestedActions && message.suggestedActions.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {message.suggestedActions.map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => onActionClick(action)}
              className="rounded-full border border-violet-500/25 bg-violet-500/[0.08] px-3 py-1.5 text-xs font-medium text-violet-300 transition hover:bg-violet-500/[0.14]"
            >
              {action}
            </button>
          ))}
        </div>
      )}

      {message.gatewayMeta?.requiresApproval && (
        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-300">
          Requires your approval before anything is sent or executed
        </div>
      )}

      {message.gatewayMeta && process.env.NODE_ENV !== "production" && (
        <details className="mt-3 border-t border-white/10 pt-2">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">
            Debug: gateway metadata
          </summary>
          <dl className="mt-1.5 space-y-0.5 font-mono text-[11px] text-zinc-500">
            <div>intent: {message.gatewayMeta.intent}</div>
            <div>route: {message.gatewayMeta.route}</div>
            <div>mode: {message.gatewayMeta.mode}</div>
            <div>confidence: {message.gatewayMeta.confidence}</div>
            <div>auditRelevant: {String(message.gatewayMeta.auditRelevant)}</div>
            {message.gatewayMeta.missingContext.length > 0 && <div>missingContext: {message.gatewayMeta.missingContext.join(", ")}</div>}
            {message.gatewayMeta.recommendedNextSteps.length > 0 && (
              <div>recommendedNextSteps: {message.gatewayMeta.recommendedNextSteps.join(" | ")}</div>
            )}
          </dl>
        </details>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="max-w-2xl self-end rounded-2xl rounded-tr-sm bg-gradient-to-br from-sky-500 to-indigo-600 px-4 py-3 text-sm text-white shadow-[0_2px_20px_rgba(56,189,248,0.15)]">
      {content}
    </div>
  );
}

export function CommandFeed({
  messages,
  onSendMessage,
  onSourceClick,
  onActionClick,
  onOpenNotes,
}: {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSourceClick: (source: string) => void;
  onActionClick: (action: string) => void;
  onOpenNotes?: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const slashMatches = useMemo(() => {
    if (!draft.startsWith("/")) return [];
    const typed = draft.toLowerCase();
    return SLASH_COMMANDS.filter((c) => c.command.startsWith(typed) || typed === "/");
  }, [draft]);
  const showSlashMenu = slashMatches.length > 0;

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSendMessage(text);
    setDraft("");
  };

  const pickSlashCommand = (command: string) => {
    setDraft(`${command} `);
    setActiveSuggestion(0);
    inputRef.current?.focus();
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {messages.map((message) =>
          message.role === "assistant" ? (
            <AssistantBubble key={message.id} message={message} onSourceClick={onSourceClick} onActionClick={onActionClick} />
          ) : (
            <div key={message.id} className="flex justify-end">
              <UserBubble content={message.content} />
            </div>
          )
        )}
      </div>

      <div className="relative border-t border-white/10 bg-white/[0.02] px-4 py-3.5 sm:px-6">
        {showSlashMenu && (
          <ul className="absolute bottom-full left-4 right-4 z-10 mb-2 overflow-hidden rounded-xl border border-white/10 bg-[#111114] shadow-[0_20px_60px_rgba(0,0,0,0.45)] sm:left-6 sm:right-6">
            {slashMatches.map((c, i) => (
              <li key={c.command}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSlashCommand(c.command);
                  }}
                  onMouseEnter={() => setActiveSuggestion(i)}
                  className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition ${
                    i === activeSuggestion ? "bg-white/[0.06] text-zinc-100" : "text-zinc-300"
                  }`}
                >
                  <span className="font-mono text-xs text-sky-300">{c.command}</span>
                  <span className="truncate text-xs text-zinc-500">{c.description}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2 shadow-[0_2px_20px_rgba(0,0,0,0.2)] transition focus-within:border-sky-500/40 focus-within:ring-2 focus-within:ring-sky-500/10">
          {onOpenNotes && (
            <button
              type="button"
              onClick={onOpenNotes}
              aria-label="Add project notes"
              title="Add project notes"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-zinc-500 transition hover:bg-white/5 hover:text-zinc-300"
            >
              <AttachmentIcon className="h-4 w-4" />
            </button>
          )}
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setActiveSuggestion(0);
            }}
            onKeyDown={(e) => {
              if (showSlashMenu) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveSuggestion((i) => (i + 1) % slashMatches.length);
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveSuggestion((i) => (i - 1 + slashMatches.length) % slashMatches.length);
                  return;
                }
                if (e.key === "Tab" || (e.key === "Enter" && draft !== slashMatches[activeSuggestion]?.command)) {
                  e.preventDefault();
                  pickSlashCommand(slashMatches[activeSuggestion].command);
                  return;
                }
                if (e.key === "Escape") {
                  setDraft("");
                  return;
                }
              }
              if (e.key === "Enter") submit();
            }}
            placeholder="Ask about status, risks, actions, decisions... or type / for commands"
            className="min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-500"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            aria-label="Send"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-indigo-600 text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-30 disabled:grayscale"
          >
            <SendIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 truncate px-1 text-[11px] text-zinc-500">
          Try: {SUGGESTED_PROMPTS.join(" · ")}
        </p>
        <p className="mt-1 px-1 text-[10px] text-zinc-600" data-testid="chat-determinism-disclosure">
          Structured assistant: answers are composed from your project data by deterministic rules — not generative AI.
        </p>
      </div>
    </div>
  );
}
