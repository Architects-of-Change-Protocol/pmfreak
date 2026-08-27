# Startup Readiness

## Static composition checks

- `npm run test:launch-smoke`
- `npm run diag:runtime`

Both inspect **source text only** — they assert that the adapter bootstrap, the
runtime composition helper and the health route are present and shaped as
expected. Neither builds the application, starts a process, or makes a request,
so neither can tell you whether the application actually boots. They exit
non-zero with categorised failure output when a composition invariant is missing.

## Actual startup

Startup itself is proven by `npm run check:production-runtime-acceptance`, which
builds the application, starts it through its supported production entrypoint
(`npm run start` → `next start`), and probes the running process over HTTP:

- `GET /api/health` — liveness: the process is up and the AOC runtime composed.
- `GET /api/ready` — readiness: configuration, governance capability and a real
  database round-trip. Answers `503 not_ready` when a required dependency or a
  production-required variable is missing.

See [P0-LAUNCH-03 — Production Runtime & Deployment Acceptance](./p0-launch-03-production-runtime-acceptance.md)
for the acceptance evidence, the environment the gate requires, and the limits of
what it claims.
