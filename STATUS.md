# System Status & Quick-Start Guide

> Project: Clinic Appointment & Patient Tracker  
> Version: v0.5.0 (Phase 5 complete)

---

## 1. Services & Ports

| Service | Technology | Port | URL |
|---|---|---|---|
| **Backend API** | Node.js / Express | 5000 | `http://localhost:5000` |
| **API Documentation** | Swagger UI (OpenAPI 3.0) | 5000 | `http://localhost:5000/api/docs` |
| **Frontend Application** | React 19 / Vite | 5173 | `http://localhost:5173` |

---

## 2. Credentials for Testing & Development

### Automated Test Credential
- **Email**: `jane.smith@clinic.local`
- **Password**: `SecurePass123!`
- **Role**: `doctor`

### Local Development Accounts
To access the system in local development:
1. Register an initial admin user via the UI at `http://localhost:5173/register` or API `POST /api/auth/register` with role `admin`.
2. Existing demo doctors and receptionists can be invited or registered directly via the admin panel (`/admin/users`).

---

## 3. Registered API Endpoints

### Authentication (`/api/auth` or `/api`)
- `POST /api/auth/register` — Register a new user (`admin`, `doctor`, `receptionist`)
- `POST /api/auth/login` — Authenticate and receive signed JWT
- `GET /api/auth/me` — Retrieve current authenticated user profile

### Patients (`/api/patients`)
- `GET /api/patients` — List patients (supports `search`, `page`, `limit`)
- `GET /api/patients/:id` — Get single patient details
- `POST /api/patients` — Create patient (Admin / Receptionist)
- `PUT /api/patients/:id` — Update patient details
- `DELETE /api/patients/:id` — Soft or hard delete patient (Admin only)

### Doctors (`/api/doctors`)
- `GET /api/doctors` — List all active doctors
- `GET /api/doctors/:id` — Doctor profile by ID
- `POST /api/doctors` — Add doctor (Admin only)
- `PUT /api/doctors/:id` — Update doctor (Admin only)
- `DELETE /api/doctors/:id` — Remove doctor (Admin only)

### Appointments (`/api/appointments`)
- `GET /api/appointments` — List appointments (filters: `doctor_id`, `patient_id`, `status`, `date`)
- `POST /api/appointments` — Book appointment (with concurrency conflict check)
- `PATCH /api/appointments/:id/cancel` — Cancel appointment

### Medical Records (`/api/medical-records`)
- `GET /api/medical-records` — Fetch patient medical records
- `POST /api/medical-records` — Add diagnosis / prescription notes

### Reports (`/api/reports`)
- `POST /api/reports/daily` — Generate daily appointments summary (`format=json|csv|pdf`)
- `POST /api/reports/monthly` — Generate monthly clinic performance summary (`format=json|csv|pdf`)

### User Administration (`/api/users`)
- `GET /api/users` — List users (Admin only)
- `PATCH /api/users/:id/role` — Update user role (Admin only)
- `PATCH /api/users/:id/status` — Deactivate / activate user (Admin only)

---

## 4. How to Run & Verify

### Run All Automated Tests
```bash
# Backend unit & integration test suites (51 tests)
npm test

# Frontend route guard tests (9 tests)
npm --prefix frontend test -- --run
```

### Run Linters
```bash
# Backend linter
npm --prefix backend run lint

# Frontend linter
npm --prefix frontend run lint
```

### Start Development Servers
```bash
# Backend server (port 5000)
npm --prefix backend run dev

# Frontend dev server (port 5173)
npm --prefix frontend run dev
```
