# Local development

## Requirements

- Git and access to the private GitHub repository.
- Node 24 LTS and npm. macOS/Linux supported by the toolchain; Windows ARM needs the x64 Node runtime because workerd is not native Windows ARM.
- A normal local folder outside OneDrive/shared sync, with space for node_modules and local file storage.

## First run

Clone `merged-app`, then run the commands in README. `npm run build` produces the Worker and Wrangler configuration. `node scripts/setup-local.mjs` creates ignored `.dev.vars` if absent, with a random local administrator password, then applies the base schema to **local** D1 only. It is safe to rerun: an existing users table skips initialization. It will not reset accounts or copy production data.

`npm start` serves the built app on loopback (normally http://127.0.0.1:8787; use the address printed by Wrangler). Open `.dev.vars` locally, copy `ADMIN_INITIAL_PASSWORD`, and log in as `owner01`. This creates a local teaching account. Never use the shared production `urpadmin` password here. Do not send `.dev.vars` to GitHub or paste it into an issue.

Local D1/R2 persist in `.wrangler/state`. Files, backups, audit records and password hashes created locally remain there. Do not delete it if you need your test work. No live data is downloaded by these setup commands.

For hot reload after setup: stop `npm start`, then `npm run dev` (normally port 5173). Both use local Wrangler storage. Rebuild and rerun `node scripts/setup-local.mjs` before switching back to `npm start`: setup copies the ignored local environment beside the generated Wrangler configuration. It preserves your existing local database. Do not run two servers on the same port.

## Local content and accounts

An empty local staff dashboard is expected: runtime content is deliberately not in Git. Staff can create local accounts and groups through the administration UI. To explore the legacy **fictional** fixture, the existing authenticated `/api/seed-demo` endpoint can populate a fresh local database; this is not the current classroom fixture and should never be called on production. Current course templates/trek plans are in `lib/course-plan.ts`, `lib/trek-plan.ts`, and `lib/vpa.ts`; live roster, dates/status snapshots and uploaded material are database/object records.

For full current-term workflow testing, use synthetic fixture data. Never copy production users/password hashes/submissions into Git. Several scripts in `scripts/` are old operational tools that default to the real domain and can write to Canvas; **do not run every script as a test suite**.

## Checks that do not use live services

```sh
npx tsc --noEmit
node scripts/core-tests.mjs
node scripts/vpa-review-plan-tests.mjs
node scripts/canvas-ingestion-tests.mjs
npm run build
```

CI builds/tests only; it does not deploy. The Canvas relay server is not included in this public copy.

Known legacy test drift found during this handoff: `trek-tests.mjs` still asserts an older literal student-entry implementation, and `vpa-tests.mjs` asserts an obsolete literal live/sandbox guard. Both fail against v49 despite their earlier helper checks passing. They are retained transparently for modernization, not included in the verified quick-start list. Do not treat every historical smoke/checklist as a current green test suite.

## Optional integrations

Leave Canvas/OpenRouter secrets absent for ordinary UI/local-data development. In an approved private `.dev.vars`, `CANVAS_TOKEN` enables direct Canvas access, or `CANVAS_RELAY_URL` plus `CANVAS_RELAY_KEY` uses the approved relay. Current code pins that relay URL to the production sync domain, so do not set these values casually: local code can otherwise read real course data. Use a dedicated test course, never a live one. `OPENROUTER_API_KEY` is needed only for AI analysis. `VPA_CANVAS_SUBMIT_ENABLED=false` and `VPA_REVIEW_LIVE_ENABLED=false` remain the local defaults.

## Troubleshooting

- Missing tables: build first, then rerun local setup with the same folder/persist path.
- Missing native workerd on Windows ARM: use Node x64 and reinstall dependencies with that runtime.
- Port busy: stop the previous server or choose another port.
- Changed `.dev.vars`: restart server. Changing the bootstrap password does not reset an already-created local account.
- Canvas disabled/errors with no credentials: expected. Do not enable production write/review gates to fix a local preview.
- Do not run `wrangler ... --remote`, `wrangler deploy`, or modify `.openai/hosting.json` to experiment with production.
