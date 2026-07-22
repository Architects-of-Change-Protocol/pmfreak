import {
  MailIcon,
  DocumentIcon,
  NotesIcon,
  ChatIcon,
} from "@/modules/workspace/presentation/command-center/icons";

type IconProps = { className?: string };

const base = "h-4 w-4 shrink-0";

export function ContractIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <path d="M7 3.5h7l4 4V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V5A1.5 1.5 0 0 1 7 3.5Z" strokeLinejoin="round" />
      <path d="M9 12.3 11 14.3l4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InvoiceIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <path d="M7 3.5h10v17l-2.5-1.5L12 20.5l-2.5-1.5L7 20.5Z" strokeLinejoin="round" />
      <path d="M9.5 8h5M9.5 11h5M9.5 14h3" strokeLinecap="round" />
    </svg>
  );
}

export function ImageIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m5 17 4.5-4.5 3 3 3.5-4L20 16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScreenshotIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <path d="M4.5 9V6a1.5 1.5 0 0 1 1.5-1.5h3M19.5 9V6A1.5 1.5 0 0 0 18 4.5h-3M4.5 15v3A1.5 1.5 0 0 0 6 19.5h3M19.5 15v3a1.5 1.5 0 0 1-1.5 1.5h-3" strokeLinecap="round" />
      <rect x="9" y="9" width="6" height="6" rx="0.8" />
    </svg>
  );
}

export function VideoIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <rect x="3.5" y="6" width="12" height="12" rx="1.5" />
      <path d="m15.5 10.5 5-2.5v8l-5-2.5" strokeLinejoin="round" />
    </svg>
  );
}

export function AudioIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <rect x="9.5" y="3.5" width="5" height="9" rx="2.5" />
      <path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9.5 20.5h5" strokeLinecap="round" />
    </svg>
  );
}

export function SpreadsheetIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <rect x="4" y="4.5" width="16" height="15" rx="1.5" />
      <path d="M4 9.5h16M4 14.5h16M9.5 4.5v15M14.5 4.5v15" />
    </svg>
  );
}

export function PresentationIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden>
      <rect x="3.5" y="5" width="17" height="11" rx="1.5" />
      <path d="M12 16v3.5M9 19.5h6M8 10.5l2.5 2.5L14 9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export { MailIcon, DocumentIcon, NotesIcon, ChatIcon };

export type EvidenceSourceCategoryId =
  | "email"
  | "document"
  | "contract"
  | "meeting"
  | "invoice"
  | "image"
  | "screenshot"
  | "video"
  | "audio"
  | "pdf"
  | "chat"
  | "slack"
  | "teams"
  | "whatsapp"
  | "sms"
  | "csv"
  | "spreadsheet"
  | "presentation"
  | "note";

// Every category the drop zone advertises. This is a UI-only catalog — most
// of these sources aren't ingestible yet (see the "Coming soon" quick-capture
// actions); it exists so users immediately see the full range of evidence
// PMFreak is built to eventually learn from.
export const EVIDENCE_SOURCE_CATEGORIES: Array<{
  id: EvidenceSourceCategoryId;
  label: string;
  Icon: (props: IconProps) => React.JSX.Element;
}> = [
  { id: "email", label: "Emails", Icon: MailIcon },
  { id: "document", label: "Documents", Icon: DocumentIcon },
  { id: "contract", label: "Contracts", Icon: ContractIcon },
  { id: "meeting", label: "Meeting Notes", Icon: NotesIcon },
  { id: "invoice", label: "Invoices", Icon: InvoiceIcon },
  { id: "image", label: "Images", Icon: ImageIcon },
  { id: "screenshot", label: "Screenshots", Icon: ScreenshotIcon },
  { id: "video", label: "Videos", Icon: VideoIcon },
  { id: "audio", label: "Audio Recordings", Icon: AudioIcon },
  { id: "pdf", label: "PDFs", Icon: DocumentIcon },
  { id: "chat", label: "Chat Exports", Icon: ChatIcon },
  { id: "slack", label: "Slack Conversations", Icon: ChatIcon },
  { id: "teams", label: "Teams Messages", Icon: ChatIcon },
  { id: "whatsapp", label: "WhatsApp Conversations", Icon: ChatIcon },
  { id: "sms", label: "SMS", Icon: ChatIcon },
  { id: "csv", label: "CSV", Icon: SpreadsheetIcon },
  { id: "spreadsheet", label: "Spreadsheets", Icon: SpreadsheetIcon },
  { id: "presentation", label: "Presentations", Icon: PresentationIcon },
];
