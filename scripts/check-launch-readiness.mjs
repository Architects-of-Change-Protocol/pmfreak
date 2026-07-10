import { execSync } from "node:child_process";
const commands = ["npm run build", "npm test", "npm run check:governance", "node scripts/run-launch-smoke-tests.mjs", "node scripts/runtime-diagnostics-report.mjs"];
const results = [];
// maxBuffer: the full test suite emits >10 MB of TAP output; the 1 MB default
// made this gate fail with spawnSync ENOBUFS instead of a real verdict.
const MAX_OUTPUT_BUFFER = 64 * 1024 * 1024;
for (const cmd of commands) {
  try { execSync(cmd, { stdio: "pipe", maxBuffer: MAX_OUTPUT_BUFFER }); results.push({ cmd, status: "pass" }); }
  catch (e) { results.push({ cmd, status: "fail", error: e.message }); }
}
console.log(JSON.stringify({ category: "Launch Readiness", results }, null, 2));
if (results.some((r) => r.status === "fail")) process.exit(1);
