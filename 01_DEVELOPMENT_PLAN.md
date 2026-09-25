# Clinic Appointment & Patient Tracker — Phase-by-Phase Delivery Plan

Based on: `Clinic Appointment & Patient Tracker` SRS v0.1 and the Group 05 proposal deck.
Team: Piyumali (Frontend/UI), Bhanuka (Backend/API), Dewmini (Database/Reporting/Testing).
Stack: React SPA → Node.js/Express REST API → MySQL/PostgreSQL, JWT + bcrypt auth.

This plan expands the 7-week Gantt chart in the proposal into concrete, committable
units of work. It is built around three rules that run through every phase:

1. **Security-first** — nothing gets merged that skips auth, validation, or
   parameterized queries, even in "temporary" or "demo" code.
2. **Small, consistent commits** — every commit is one logical change, buildable
   and passing tests on its own. See `.agents/skills/commit-discipline/SKILL.md`.
3. **Test before you call it done** — every phase ends with test cases from
   `02_TEST_PLAN.md` passing, not just "it works on my machine."

Each phase below lists: objective, owner, tasks, Definition of Done (DoD),
expected commit sequence, security checklist, and linked test cases.

---

## Phase 0 — Project Bootstrap (Day 1–2, Week 1)

**Objective:** Everyone can `git clone`, install, and run a "hello world" version
of all three tiers before any real feature work starts.

**Owner:** All three, pair together for this phase.

**Tasks**
- [x] Create Git repo, protected `main` branch, branch naming convention
      (`feat/`, `fix/`, `chore/`, `test/`, `docs/`).
- [x] Scaffold backend: Node.js + Express, folder structure
      (`controllers/`, `services/`, `models/`, `routes/`, `middleware/`, `config/`).
- [x] Scaffold frontend: React SPA (Vite or CRA), folder structure
      (`pages/`, `components/`, `api/`, `hooks/`, `context/`).
- [x] Set up MySQL/PostgreSQL locally (or via Docker/Podman) + `.env.example` (no real
      secrets committed).
- [x] Install and configure Husky + lint-staged + ESLint + Prettier +
      commitlint (see skill file — this is the pre-commit gate for everything after).
- [x] Add `.gitignore` covering `node_modules`, `.env`, build artifacts, logs.
- [x] Set up a minimal CI job (lint + test) on push, even if tests are still empty.

**Definition of Done**
- `npm run dev` starts backend and frontend for all three members without manual fixes.
- A commit that violates lint rules or has no test for changed logic is **rejected locally** by the pre-commit hook.

**Expected commits (small, in order)**
```
chore: initialize backend project structure
chore: initialize frontend project structure
chore: add husky, lint-staged, eslint, prettier config
chore: add commitlint with conventional commit rules
chore: add .env.example and secret-scanning gitignore rules
ci: add lint + test github actions workflow
```

**Security checklist**
- [x] `.env` is gitignored; `.env.example` has placeholder values only.
- [x] No hardcoded DB credentials anywhere in scaffolding.

**Test cases:** none yet — first real tests appear in Phase 1.

---

## Phase 1 — Database & Auth Foundation (Week 1–2)

**Objective:** The data model from the SRS (Patient, Doctor, Appointment,
Medical_Record, Admin) exists as migrations, and authentication is fully
working end-to-end before any business feature is built on top of it.

**Owner:** Dewmini (schema/migrations), Bhanuka (auth logic).

**Tasks**
- [x] Translate the ER diagram into migration files (not hand-edited schema —
      migrations are the source of truth and are themselves committed in small,
      reversible steps: one migration per entity).
- [x] Add FK constraints exactly as specified: Appointment → Patient, Doctor;
      Medical_Record → Patient, Doctor.
- [x] Implement `POST /api/register` and `POST /api/login`.
  - Passwords hashed with bcrypt, salt rounds ≥ 10 (never store or log plaintext).
  - JWT issued on login with short expiry + refresh strategy.
- [x] Add `authMiddleware` (verifies JWT) and `roleMiddleware` (checks Admin/Doctor/Patient role) as separate, independently testable middleware.
- [x] Add server-side input validation (express-validator/Yup schemas) on
      register/login before anything touches the DB.
- [x] Add rate limiting on `/api/login` (brute-force protection) — e.g. `express-rate-limit`.
- [x] Log failed login attempts to the audit log table (per SRS §3.1.6).

**Definition of Done**
- A new user can register, log in, receive a JWT, and hit one protected
  "ping" route that 401s without a token and 403s with the wrong role.
- All Phase 1 test cases (below) pass in CI.

**Expected commits**
```
feat(db): add patient, doctor, admin migrations
feat(db): add appointment and medical_record migrations with FKs
feat(auth): add bcrypt password hashing on register
feat(auth): add JWT login endpoint
feat(auth): add auth middleware for protected routes
feat(auth): add role-based access middleware
feat(security): add rate limiting on login endpoint
feat(logging): record failed login attempts to audit log
test(auth): add unit tests for register/login/middleware
```
*(Each commit above is independently buildable — no "WIP" or "misc fixes" commits.)*

**Security checklist**
- [x] Passwords never appear in logs, error messages, or API responses.
- [x] JWT secret comes from `.env`, never hardcoded.
- [x] JWT has an expiry; expired tokens are rejected, not silently accepted.
- [x] Login endpoint is rate-limited.
- [x] All DB access uses parameterized queries / ORM (Sequelize or equivalent) — no string-concatenated SQL anywhere.

**Test cases:** See `02_TEST_PLAN.md` §1 (Auth), §7 (Security — SQLi, JWT tampering).

---

## Phase 2 — Core Backend APIs (Week 2–3)

**Objective:** CRUD for Patients, Doctors, and Appointments, with business
rules (double-booking prevention, role restrictions) enforced server-side —
never trusted to the frontend alone.

**Owner:** Bhanuka, with Dewmini reviewing queries/indexes.

**Tasks**
- [x] `Patients`: `GET/POST/PUT/DELETE /api/patients` — Admin-only for
      create/update/delete; Doctor gets read access to assigned patients only.
- [x] `Doctors`: CRUD, Admin-only for create/delete.
- [x] `Appointments`: CRUD + conflict check — reject a new appointment if the
      same doctor already has one at that date/time (SRS §3.1.4). This check
      must happen in the same DB transaction as the insert to avoid race
      conditions between two near-simultaneous bookings.
- [x] Search & filter endpoints (by patient name, date, doctor, status —
      SRS §3.1.7), parameterized, not raw query strings.
- [x] Every mutating endpoint writes to the audit log (who, what, when).
- [x] Wrap multi-step operations (e.g. appointment + notification) in DB
      transactions so partial failures don't corrupt data.

**Definition of Done**
- Swagger/OpenAPI doc lists every endpoint with request/response shapes.
- Two concurrent booking requests for the same doctor/slot: exactly one succeeds.
- Non-admin users get 403 on restricted operations, verified by tests, not by inspection.

**Expected commits**
```
feat(patients): add patient CRUD endpoints with role checks
feat(doctors): add doctor CRUD endpoints, admin-only writes
feat(appointments): add appointment creation with double-booking check
feat(appointments): add appointment CRUD (update/cancel/list)
feat(search): add filtering by patient/date/doctor/status
feat(audit): log all CRUD mutations to audit_logs table
docs(api): add swagger/openapi spec for all endpoints
test(patients): add CRUD + RBAC tests
test(appointments): add double-booking race condition test
```

**Security checklist**
- [x] RBAC enforced server-side on every route, not just hidden in the UI.
- [x] All list/search endpoints paginate (no unbounded `SELECT *`).
- [x] Input validated and sanitized before it reaches the query layer.
- [x] Error responses never leak stack traces or DB schema details to the client.

**Test cases:** `02_TEST_PLAN.md` §2 (Patients), §3 (Doctors), §4 (Appointments incl. double-booking).

---

## Phase 3 — Frontend Foundation (Week 2–4, in parallel with Phase 2)

**Objective:** Auth flows, routing, and the app shell exist, backed by real
API calls (not mocked) as soon as Phase 1 endpoints are available.

**Owner:** Piyumali.

**Tasks**
- [x] Login/Register pages wired to `/api/login` and `/api/register`.
- [x] JWT stored in memory / httpOnly cookie strategy decided and documented
      (avoid localStorage for tokens if XSS risk matters to the team — flag
      this as a design decision to confirm together).
- [x] Route guards: unauthenticated users can't reach dashboard routes;
      role-based route guards mirror backend role checks (defense in depth,
      not a replacement for backend checks).
- [x] App shell: Dashboard, Patients, Appointments, Reports nav per the UI sketches.
- [x] Global error boundary + toast/error messaging for failed API calls (no raw error dumps shown to users).
- [x] Form validation client-side (Formik + Yup) matching backend validation rules exactly, so users get fast feedback but the server remains the real gatekeeper.

**Definition of Done**
- A logged-out user hitting any protected URL directly is redirected to login.
- A Doctor-role user cannot navigate to Admin-only screens (verified, not assumed).

**Expected commits**
```
feat(frontend): scaffold routing and app shell
feat(auth): add login/register pages wired to API
feat(auth): add JWT storage and route guards
feat(auth): add role-based route restrictions
feat(ui): add dashboard shell per wireframes
feat(ui): add global error boundary and toast notifications
test(frontend): add route guard tests
```

**Security checklist**
- [x] No sensitive data (tokens, patient data) logged to browser console in production build.
- [x] Token storage decision reviewed against XSS exposure.
- [x] All forms use controlled inputs with client-side validation, but server validation is still authoritative.

**Test cases:** `02_TEST_PLAN.md` §8 (Frontend auth/route guards).

---

## Phase 4 — Feature Integration (Week 4–5)

**Objective:** Patients, Doctors, and Appointments pages are fully functional
end-to-end, matching the wireframes (Patient Login, Doctor Dashboard, Admin
Dashboard, Patient Portal).

**Owner:** Piyumali (UI) + Bhanuka (API adjustments as gaps surface).

**Tasks**
- [x] Patient Management page: list, search, add, edit, delete (Admin).
- [x] Doctor Dashboard: today's appointments, patient records, add diagnosis/prescription.
- [x] Appointment booking flow: select doctor → pick slot → confirm, with
      immediate server-side conflict feedback (not just optimistic UI).
- [x] Patient Portal (optional per SRS): view own appointments/history, read-only.
- [x] Notifications/reminders placeholder (SRS marks SMS/email as future extensibility — build the interface but stub the actual send).

**Definition of Done**
- Full demo path works live: register → login as Admin → add patient/doctor →
  log in as that doctor → book/view appointment → generate a report.

**Expected commits**
```
feat(patients): add patient management page with search
feat(doctor): add doctor dashboard with today's appointments
feat(appointments): add booking flow with conflict feedback
feat(patient-portal): add read-only appointment/history view
chore(notifications): stub notification interface for future SMS/email
test(e2e): add end-to-end booking flow test
```

**Security checklist**
- [x] UI never renders another patient's data by guessing/incrementing an ID in the URL (IDOR check — verify the backend enforces ownership, not just the frontend routing).

**Test cases:** `02_TEST_PLAN.md` §5 (Integration/E2E), §7.3 (IDOR).

---

## Phase 5 — Reporting Module (Week 5)

**Objective:** Daily/monthly reports, exportable as CSV/PDF, per SRS §3.1.5.

**Owner:** Dewmini.

**Tasks**
- [x] `POST /api/reports/daily` — appointments for a given date.
- [x] `POST /api/reports/monthly` — visits per doctor/patient.
- [x] Server-side generation with `pdfkit`/`csv-writer` (per SRS appendix), streamed, not held fully in memory for large datasets.
- [x] Reports page on frontend: date range filter, generate, download.
- [x] Restrict report generation to Admin (and Doctor for their own patients only, if enabled).

**Definition of Done**
- Generated PDF/CSV numbers match a manually-counted sample dataset exactly.

**Expected commits**
```
feat(reports): add daily report generation endpoint
feat(reports): add monthly report generation endpoint
feat(reports): add CSV/PDF export
feat(ui): add reports page with date filters and download
test(reports): add report accuracy tests against seeded data
```

**Security checklist**
- [x] Report endpoints check role before generating — a Doctor can't pull another doctor's full patient list.
- [x] Exported files don't leak more fields than the UI shows (e.g. no password hashes ever serialized, ever — add an explicit test for this).

**Test cases:** `02_TEST_PLAN.md` §6 (Reporting).

---

## Phase 6 — Security Hardening Pass (Week 5–6)

**Objective:** A dedicated pass, not an afterthought — treat this like a mini
audit before testing week, because it's cheaper to fix now than after demo.

**Owner:** All three, one focused session.

**Tasks**
- [x] Run `npm audit` / `npm audit fix` on both frontend and backend; document any accepted risk.
- [x] Re-check every route for missing auth/role middleware (grep for routes
      not wrapped by `authMiddleware`).
- [x] Confirm parameterized queries everywhere — grep for raw SQL string concatenation.
- [x] Add security headers (helmet.js): CSP, X-Frame-Options, HSTS if HTTPS.
- [x] Confirm CORS is locked to the known frontend origin, not `*`.
- [x] Confirm audit log retention (30 days per proposal) and that logs don't store sensitive fields (passwords, full card numbers, etc. — n/a here, but check patient notes aren't over-logged).
- [x] Verify `.env` and any seed/test credentials are not committed anywhere in history (`git log -p | grep -i password` type check).

**Definition of Done**
- Security checklist items above are all checked off with evidence (test, grep output, or audit report) attached to the PR, not just a verbal "yeah I checked."

**Expected commits**
```
fix(security): add helmet security headers
fix(security): lock CORS to known frontend origin
fix(security): patch npm audit vulnerabilities
fix(security): add missing auth middleware on [route]
docs(security): document accepted risks from npm audit
```

**Test cases:** `02_TEST_PLAN.md` §7 (full Security section).

---

## Phase 7 — Testing & QA Week (Week 6)

**Objective:** Systematic test pass across unit, integration, and manual UAT,
using `02_TEST_PLAN.md` as the checklist — not ad hoc clicking around.

**Owner:** Dewmini leads, Piyumali/Bhanuka fix issues found.

**Tasks**
- [x] Run full automated test suite (unit + integration), fix failures.
- [x] Manual UAT walkthrough of every wireframe screen against the built app.
- [x] Load-check: confirm ~20 concurrent simulated users (SRS §4.2) doesn't blow up API response times past 2s (simple script with `autocannon` or similar is enough for a student project).
- [x] Bug triage list, fixed in small targeted commits (one bug = one commit).

**Definition of Done**
- All test cases in `02_TEST_PLAN.md` pass or have a documented, deliberate exception.

**Expected commits**
```
test: fix flaky appointment conflict test
fix(patients): correct validation error on empty contact field
fix(reports): correct monthly total off-by-one at month boundary
docs(test): record UAT walkthrough results
```

---

## Phase 8 — Deployment (Week 6–7)

**Objective:** Deployed, reachable instance for the final presentation.

**Owner:** Bhanuka (backend/infra), Dewmini (DB).

**Tasks**
- [x] Dockerize backend + frontend (per SRS §10 portability plan).
- [x] Deploy to Render/Firebase (per proposal) with environment variables set via the platform's secret manager, never committed.
- [x] Point at a production-mode DB with migrations run, not the dev DB.
- [x] Confirm HTTPS is active on the deployed URL.
- [x] Smoke-test the deployed instance against the same checklist as Phase 4's demo path.

**Definition of Done**
- A fresh browser session against the live URL can complete: register → login → book appointment → generate report.

**Expected commits**
```
chore(deploy): add dockerfile for backend
chore(deploy): add dockerfile for frontend
chore(deploy): add render/firebase deployment config
docs(deploy): add deployment runbook to README
```

---

## Phase 9 — Documentation & Submission (Week 7)

**Objective:** Everything a grader (or a new developer) needs is in the repo.

**Tasks**
- [x] README: setup instructions, `.env.example` explained, how to run tests, how to run migrations.
- [x] Finalize Swagger/OpenAPI doc.
- [x] Confirm SRS, ER diagram, and final code match (call out any deviations).
- [ ] Tag a release (`v1.0.0`) in Git.
- [ ] Final presentation rehearsal against the live deployed app, not slides only.

**Expected commits**
```
docs: finalize README with setup and test instructions
docs: finalize API documentation
chore: tag v1.0.0 release
```

---

## Quick-reference: what "small commit" means here

A commit should be revertable on its own without breaking the build. If you
can't describe your commit in one line without using "and", it's probably two
commits. See `.agents/skills/commit-discipline/SKILL.md` for the enforced workflow
(pre-commit hooks, commit message format, PR checklist).
