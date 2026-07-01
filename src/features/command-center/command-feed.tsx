"use client";

import { useState } from "react";
import type { ChatMessage } from "./types";
import { AttachmentIcon, SendIcon } from "./icons";
import { SUGGESTED_PROMPTS } from "./demo-data";

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
    <div className="max-w-2xl rounded-2xl rounded-tl-sm border border-slate-200 bg-white px-4 py-3.5 shadow-[0_2px_10px_rgba(15,23,42,0.04)]">
      <p className="text-sm leading-relaxed text-slate-700">{message.content}</p>

      {message.structuredList && (
        <ol className="mt-3 space-y-1.5">
          {message.structuredList.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-slate-700">
              <span className="text-slate-400">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      )}

      {message.sources && message.sources.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Based on</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {message.sources.map((source) => (
              <li key={source}>
                <button
                  type="button"
                  onClick={() => onSourceClick(source)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-500 transition hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700"
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
              className="rounded-full border border-rose-200/70 bg-rose-50/60 px-3 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-50"
            >
              {action}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div className="max-w-2xl self-end rounded-2xl rounded-tr-sm bg-slate-900 px-4 py-3 text-sm text-white shadow-[0_2px_10px_rgba(15,23,42,0.12)]">
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
  preview = false,
}: {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  onSourceClick: (source: string) => void;
  onActionClick: (action: string) => void;
  onOpenNotes?: () => void;
  preview?: boolean;
}) {
  const [draft, setDraft] = useState("");

  const submit = () => {
    const text = draft.trim();
    if (!text) return;
    onSendMessage(text);
    setDraft("");
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5 sm:px-6">
        {preview && (
          <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-700">
            <span>This is an example conversation. Paste your first notes to make it real.</span>
          </div>
        )}
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

      <div className="border-t border-slate-200 bg-white/70 px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-[0_2px_10px_rgba(15,23,42,0.04)] transition focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-100">
          {onOpenNotes && (
            <button
              type="button"
              onClick={onOpenNotes}
              aria-label="Add project notes"
              title="Add project notes"
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <AttachmentIcon className="h-4 w-4" />
            </button>
          )}
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="Ask this project anything..."
            className="min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!draft.trim()}
            aria-label="Send"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <SendIcon className="h-3.5 w-3.5" />
          </button>
        </div>
        <p className="mt-2 truncate px-1 text-[11px] text-slate-400">
          Try: {SUGGESTED_PROMPTS.join(" · ")}
        </p>
      </div>
    </div>
  );
}
