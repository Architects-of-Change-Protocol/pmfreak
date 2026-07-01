import { redirect } from "next/navigation";

// /workspace is the legacy dark OperationalShell entry point. It is
// permanently quarantined: no normal authenticated journey should render it.
// The proxy already redirects here before this ever executes; this redirect
// is defense-in-depth for any direct or stale link to /workspace.
export default function WorkspacePage() {
  redirect("/command-center");
}
