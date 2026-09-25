# Clinic Appointment & Patient Tracker — Test Plan

Referenced by `01_DEVELOPMENT_PLAN.md`. Each phase should not be marked "done"
until its section here passes. Format per case: **ID | Given / When / Then**.
Suggested tools: Jest + Supertest (backend), React Testing Library (frontend),
a seeded test DB (never run destructive tests against dev/prod data).

---

## 1. Authentication (Phase 1)

| ID | Test |
|----|------|
| AUTH-01 | Given valid unique email/password, when POST `/api/register`, then user is created and password is stored as a bcrypt hash (never plaintext) in the DB. |
| AUTH-02 | Given an email already registered, when registering again, then request is rejected with 409, no duplicate row created. |
| AUTH-03 | Given valid credentials, when POST `/api/login`, then response includes a signed JWT and excludes the password hash entirely. |
| AUTH-04 | Given wrong password, when POST `/api/login`, then 401 is returned and the attempt is written to the audit log. |
| AUTH-05 | Given 10+ rapid failed logins for the same account within a short window, then further attempts are rate-limited (429). |
| AUTH-06 | Given an expired JWT, when calling a protected route, then 401 is returned, not a silent pass-through. |
| AUTH-07 | Given a tampered/modified JWT (signature invalid), when calling a protected route, then 401 is returned. |
| AUTH-08 | Given no `Authorization` header, when calling a protected route, then 401 is returned. |
| AUTH-09 | Given a valid token but wrong role (e.g. Doctor token on an Admin-only route), then 403 is returned. |

## 2. Patient Management (Phase 2)

| ID | Test |
|----|------|
| PAT-01 | Given Admin role, when POST `/api/patients` with valid data, then patient is created and returned without extraneous internal fields. |
| PAT-02 | Given Doctor role, when POST `/api/patients`, then 403 (Doctors cannot create patients). |
| PAT-03 | Given missing required field (e.g. name), when POST `/api/patients`, then 400 with a clear validation message, no DB row created. |
| PAT-04 | Given an existing patient, when PUT `/api/patients/:id` with valid changes, then record updates and an audit log entry is written. |
| PAT-05 | Given an existing patient, when DELETE `/api/patients/:id` as Admin, then patient is removed (or soft-deleted per team decision) and no longer appears in `GET /api/patients`. |
| PAT-06 | Given a Doctor querying patients, then only patients assigned to that doctor are returned, not the full clinic roster. |
| PAT-07 | Given a SQL-injection-style string in the name/search field (e.g. `' OR '1'='1`), then the query is treated as literal text, not executed as SQL, and no unauthorized data is returned. |

## 3. Doctor Management (Phase 2)

| ID | Test |
|----|------|
| DOC-01 | Given Admin role, when POST `/api/doctors`, then doctor is created. |
| DOC-02 | Given non-Admin role, when POST/PUT/DELETE `/api/doctors`, then 403. |
| DOC-03 | Given `GET /api/doctors`, then any authenticated role can read the list (read is broader than write, per SRS role table) — confirm this matches the team's actual intended policy before asserting it. |

## 4. Appointment Management (Phase 2)

| ID | Test |
|----|------|
| APT-01 | Given a free doctor/time slot, when booking an appointment, then it succeeds and appears in that doctor's schedule. |
| APT-02 | Given a doctor already booked at that exact date/time, when booking another appointment for the same doctor/slot, then it is rejected (409/400), not silently double-booked. |
| APT-03 | Given two near-simultaneous booking requests for the same doctor/slot (race condition), then exactly one succeeds and the other is rejected — this must be tested with real concurrent requests, not sequential ones, to catch a missing DB-level lock/unique constraint. |
| APT-04 | Given an appointment linked to a Patient/Doctor, when either parent record is deleted, then the FK constraint prevents an orphaned appointment (or cascades per the team's documented policy). |
| APT-05 | Given a cancelled appointment, when queried, then its status correctly reflects "Cancelled" and it's excluded from "upcoming appointments" views. |
| APT-06 | Given a search/filter by date range, doctor, or status, then only matching records return, and the query uses parameterized filters. |

## 5. Integration / End-to-End (Phase 4)

| ID | Test |
|----|------|
| E2E-01 | Register as Admin → log in → add a Doctor → add a Patient → book an Appointment → confirm it appears on the Doctor Dashboard. |
| E2E-02 | Log in as the Doctor created above → view assigned patient → add a diagnosis/prescription note → confirm it's saved and attributed to that doctor. |
| E2E-03 | Log out mid-session, then attempt to navigate directly to a protected URL → redirected to login, no data flashes on screen first. |
| E2E-04 | As a logged-in Doctor, attempt to view a patient record by guessing/incrementing the patient ID in the URL who is **not** assigned to them → blocked server-side (IDOR check), not just hidden in the UI. |

## 6. Reporting (Phase 5)

| ID | Test |
|----|------|
| REP-01 | Given a seeded set of appointments on a known date, when generating the daily report, then the count and details exactly match the seeded data. |
| REP-02 | Given a seeded month of appointments across multiple doctors, when generating the monthly report, then per-doctor/per-patient totals are correct, including edge cases at month start/end. |
| REP-03 | Given a report export (CSV/PDF), then it contains no sensitive fields that shouldn't be there (password hashes, internal-only flags). |
| REP-04 | Given a Doctor role requesting a report, then it is scoped to their own patients only (if that's the team's intended policy) — confirm and assert accordingly. |
| REP-05 | Given zero appointments in the requested range, then the report generates cleanly (empty state), not a 500 error. |

## 7. Security (Phase 6 — run this section explicitly, don't skip)

| ID | Test |
|----|------|
| SEC-01 | SQL injection payloads in every user-input field (login, search, patient fields) are treated as literal strings, never executed. |
| SEC-02 | XSS payloads (`<script>alert(1)</script>`) submitted in patient notes/name fields are stored safely and rendered escaped on the frontend, not executed. |
| SEC-03 | IDOR: any endpoint taking a resource ID (`/api/patients/:id`, `/api/appointments/:id`) enforces that the requester is authorized for that specific resource, not just authenticated. |
| SEC-04 | CORS: requests from an unknown origin are rejected by the API. |
| SEC-05 | Sensitive response fields (password hash, internal tokens) are never present in any API JSON response, checked across all endpoints, not just login. |
| SEC-06 | `npm audit` (or equivalent) run on both frontend and backend shows no unaddressed high/critical vulnerabilities at submission time. |
| SEC-07 | All secrets (DB credentials, JWT secret) load from environment variables; the repo's Git history contains no committed secrets. |
| SEC-08 | Error responses in production mode do not leak stack traces, SQL error text, or file paths to the client. |

## 8. Frontend Auth / Route Guards (Phase 3)

| ID | Test |
|----|------|
| FE-01 | An unauthenticated user hitting `/dashboard`, `/patients`, `/appointments`, or `/reports` directly is redirected to `/login`. |
| FE-02 | A Doctor-role user attempting to navigate to an Admin-only route (e.g. `/admin/users`) is blocked client-side **and** the underlying API call would 403 if forced. |
| FE-03 | Form validation errors from the backend are surfaced clearly to the user, without exposing raw server error text. |
| FE-04 | Logging out clears the stored token/session and subsequent protected API calls fail as unauthenticated. |

---

## Non-functional checks (run once near submission)

| ID | Test |
|----|------|
| NFR-01 | Average API response time stays under 2s under a simulated load of ~20 concurrent users (SRS §4.2). |
| NFR-02 | Server restart recovers cleanly; in-flight data isn't corrupted (kill the process mid-write in a test environment, confirm DB consistency via transactions). |
| NFR-03 | `docker-compose up` (or documented equivalent) brings up the full stack on a clean machine using only the README instructions. |
