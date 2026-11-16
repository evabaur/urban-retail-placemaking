# Architecture — merged app, 3 November 2026

## Runtime boundaries

| Component | Responsibility | Source |
| --- | --- | --- |
| Browser React UI | Sessions, Treks/notes, VPA, Peer reviews, Team, teaching console | `app/`, `components/`, `hooks/` |
| Sites-hosted Worker (Vinext) | API, authentication, permissions, workflow orchestration | `app/api/[...path]/route.ts`, `lib/` |
| D1 (`DB`) | Accounts, sessions, flexible course records, audit and login-attempt tables | `db/`, `drizzle/`, `lib/server.ts` |
| Private R2 (`BUCKET`) | Uploads, imported Canvas materials, generated PDFs, backup copies, activity logs | `lib/object-backup.ts`, `lib/activity-log.ts` |
| Oracle relay + HTTPS | Authenticated, constrained Canvas access; file transfer helpers; scheduled review tick | Not included in this public copy |
| Canvas | Official course roster, groups, assignments, submissions, submission receipts | course 900001 via server-side integration |
| OpenRouter | Optional staff-requested AI analysis; never automatic grading | `lib/` integration/extraction/analysis modules |

The public domain terminates at Sites; there is no browser Canvas token. Sites calls `relay.example.com` with a service credential. Oracle uses its own server-side Canvas token to call CourseWorks. Canvas files are copied into private object storage for authorized review access; links alone are insufficient.

## Persistence model

`users`: UNI, role, course partition, group, password hash, must-change/disabled flags and Canvas identity. `sessions`: hashed opaque token, expiry, optional original staff actor. `records`: kind + course + owner + group/parent + JSON payload. `audit`: compact actions. `attempts`: rate limiting. The SQL migration is the source for initial tables; most workflow additions use new record kinds rather than new tables.

`live`, `sandbox`, `demo` are separate course partitions with additional current-roster and ownership checks. Production historical records being retired does not mean legacy helpers have been removed from source. Staff student-view sessions preserve the original actor, enforce live read-only mutation guards, and do not alter the student's password state.

## Main workflows

1. **Login/status:** own UNI/password -> session -> scoped bootstrap. Student Canvas refresh runs separately; cached status is retained if upstream fails. Failure must not become a false 'not submitted'.
2. **Notes:** per-account, per-trek optional structured boxes -> cloud records with revision/conflict protection -> import matching boxes into the selected VPA. Browser cache is not the only copy.
3. **VPA:** draft -> mandatory slides + notes PDF and/or video -> private objects/backups -> gated server-side Canvas transfer -> confirmed receipt. API authorization and idempotency protect retries.
4. **Canvas-origin work:** metadata sync -> attachment ingestion and integrity checks -> private review materials. Students who upload directly to Canvas are not excluded.
5. **Peer reviews:** after assignment deadline, gated scheduled tick ingests eligible materials and allocates invitations; review window is one week. Completion records participation eligibility; point values are not automatically invented or written to Canvas.
6. **Teams:** shared uploads expose uploader/date to teammates; 1,000,000,000-byte quota includes atomic in-flight reservations. Personal teammate scores are separate and controlled by midterm/final windows.
7. **Teaching console:** aggregate current students only, notebook/draft/confirmed-VPA counts, assignment/student status matrix, read-only Student view.

## Module map

- `lib/server.ts`: DB helpers, sessions, access primitives; route.ts coordinates endpoints.
- `lib/trek-*`, `lib/use-trek-draft.ts`: content, note schema, local/cloud coordination.
- `lib/vpa*`: drafts, validations, PDFs, transfers and review-plan helpers.
- `lib/review-engine.ts`, `lib/review-round-plan.ts`, `lib/review-window.ts`: review lifecycle.
- `lib/integrations.ts`, `lib/personal-canvas.ts`, `lib/canvas-file-ingestion.ts`: Canvas access/status/materials.
- `lib/team-storage.ts`, `lib/team-canvas.ts`, `lib/project-milestones.ts`: team quota/status/stages.
- `lib/teaching-dashboard.ts`, `app/teaching-dashboard.tsx`: staff overview.
- `build/`, `scripts/`, `vite.config.ts`: portable build plus Sites-specific integration.

## Security and recovery

Passwords are hashed; cookies are HttpOnly with HTTPS security; mutations validate origin; permissions run server-side. Object access checks account/course/team or review allocation. Live preview writes are denied. Mutation/activity backup code persists records to private R2; these backups are not a substitute for a tested full infrastructure restore. Course snapshots intentionally omit password hashes/sessions. Rebuilding source does not restore production data or provision hosted resources automatically.
