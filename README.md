# Clinic Appointment & Patient Tracker (ClinicMate)

A secure, full-stack clinical operations and patient management platform built with Node.js, Express, Sequelize, and React. Features strict Role-Based Access Control (RBAC), conflict-free appointment scheduling with timezone-aware slot availability, doctor-led consultation completion with electronic medical records, a focused patient portal (**My Appointments** & **Appointment History**), automated Daily/Monthly PDF & CSV reporting, and a minimalist flat-outlined Light/Dark design system.

---

## 1. System Architecture & Tech Stack

- **Backend**: Node.js (v20+), Express 4, Sequelize ORM (PostgreSQL in production / SQLite in-memory for automated tests)
- **Frontend**: React 19, Vite, React Router v6, Axios, React Hot Toast, CSS Modules & Design Tokens
- **Database**: PostgreSQL 16 (relational schema, foreign keys, migrations, index-backed lookups, transactional locks)
- **Security & Clinical Access Controls**:
  - **Login-only entry** (public self-signup disabled; Admin creates any role via **Admin Panel**, Receptionist creates patient and doctor accounts within role limits)
  - **Full-day clinical JWT sessions** (`JWT_EXPIRES_IN=12h` default; Bearer tokens stored in memory & `sessionStorage`)
  - **Role-Based Access Control (RBAC)** across 4 roles: `admin`, `doctor`, `receptionist`, `patient`
  - Helmet HTTP security headers, rate limiting on authentication endpoints, `bcrypt` password hashing (10 salt rounds), and parameterized ORM queries
  - In-memory Promise-queue Mutex (`bookingMutex`) preventing concurrent double-booking
  - Minimal sign-out confirmation dialog preventing accidental session loss

---

## 2. Core Features by Role

- **Appointments & Scheduling**:
  - Real-time doctor slot availability with timezone offset (`tzOffset`) handling that disables elapsed time slots for the current day
  - Default **Today & Upcoming** view sorted chronologically with separate Time, Date, Patient, Doctor, Status (icon + label), and icon-only Actions columns
  - Case-insensitive search across patient and doctor first/last names, plus Doctor & Date filtering for staff
  - **Doctor-only completion workflow**: Finishing a scheduled appointment requires adding a clinical entry (diagnosis, prescription, notes) linked to that appointment
- **Patient Experience**:
  - Focused two-tab navigation (**My Appointments** from today onwards + **Appointment History** for completed and cancelled consultations with optional date filtering)
  - Self-booking with live doctor availability slots and instant access to **Consultation Reports** for completed visits
- **Patients, Doctors & Medical Records**:
  - Minimalist list views with table headers, live counts in the table header, A–Z/Z–A sorting, and clean divider-separated Medical Records & Consultation Report dialogs
- **Reports & Exports**:
  - **Daily** and **Monthly** clinic appointment reports with CSV & PDF exports available to `admin`, `doctor`, and `receptionist` roles

---

## 3. Port & Service Mapping

| Service | Port | Description |
|---|---|---|
| **Frontend Web App** | `5173` | Patient portal and clinical staff workspace |
| **Backend REST API** | `5000` | Core clinical APIs, auth, medical records, reporting, and audit logs |
| **Swagger API Docs** | `5000` (`/api/docs`) | Interactive OpenAPI 3.0 specification |
| **PostgreSQL Database** | `5432` | Relational persistence with foreign-key constraints |

---

## 4. Quick Start (Local Development)

### Prerequisites
- Node.js (v20 or higher)
- npm (v9 or higher)
- PostgreSQL 16 (or local database container)

### 1. Configure Environment
```bash
# Required: Backend environment configuration
cp backend/.env.example backend/.env

# Optional: Frontend API override (defaults to http://localhost:5000/api)
# cp frontend/.env.example frontend/.env
```

### 2. Install Dependencies
```bash
# Root & backend dependencies
npm install
npm --prefix backend install

# Frontend dependencies
npm --prefix frontend install
```

### 3. Seed Database
```bash
# Clears prior appointment/record data and seeds Sri Lankan staff, 12 patients,
# and 3-5 appointments per doctor per day across October 1 - November 30
npm run db:seed
```

### 4. Start Development Servers
```bash
# Run both backend (:5000) and frontend (:5173) concurrently:
npm run dev

# Or run them in separate terminals:
npm run dev:backend
npm run dev:frontend
```

Visit `http://localhost:5173` to access the application.

---

## 5. Demo Accounts (1-Click Login)

The Sign-In page provides 1-click credential presets for each clinical role:

| Role | Email | Password | Name / Specialization |
|---|---|---|---|
| **Patient** | `patient@clinic.local` | `PatientPass123!` | Ruwan Bandara |
| **Receptionist** | `receptionist@clinic.local` | `ReceptionPass123!` | Kumari Dissanayake |
| **Doctor** | `dr.smith@clinic.local` | `DoctorPass123!` | Dr. Sanduni Perera (Cardiology) |
| **Admin** | `admin@clinic.local` | `AdminPass123!` | Pasan Jayasuriya (Clinic Admin) |

Additional seeded specialist accounts (`DoctorPass123!`):
- `dr.house@clinic.local` — Dr. Nuwan Jayawardena (General Medicine)
- `dr.desilva@clinic.local` — Dr. Chamari De Silva (Pediatrics)
- `dr.wickramasinghe@clinic.local` — Dr. Dilani Wickramasinghe (Dermatology)
- `dr.fernando@clinic.local` — Dr. Anura Fernando (Orthopedics)

---

## 6. Automated Testing & Code Quality

The repository includes **141 automated tests** across unit, integration, RBAC security, and frontend UI suites:

```bash
# Run all tests (backend Jest + frontend Vitest)
npm run test:all

# Run backend Jest suite (9 suites, 101 tests)
npm run test:backend

# Run frontend Vitest suite (9 test files, 40 tests)
npm run test:frontend

# Code quality & linting (ESLint + oxlint)
npm run lint
```

### Test Suite Summary
- `backend/__tests__/auth.test.js`: Login, JWT issuance/expiration, public signup lock, RBAC & admin/receptionist user creation
- `backend/__tests__/patients.test.js`: Patient CRUD, doctor-scoped access, case-insensitive search sanitization
- `backend/__tests__/appointments.test.js`: Conflict-free slot booking, double-booking rejection, doctor-only completion with medical records, comma-separated status filtering
- `backend/__tests__/patientPortal.test.js`: Timezone-aware doctor availability slot calculations, past-slot disabling, patient self-booking & report retrieval
- `backend/__tests__/reports.test.js`: Daily/monthly report aggregations, receptionist access, CSV & PDF export streaming
- `backend/__tests__/notifications.test.js`: Appointment reminder notification endpoints & audit logging
- `backend/__tests__/security.test.js`: SQLi immunity, XSS handling, IDOR protection, zero credential leakage
- `backend/__tests__/e2e.test.js`: End-to-end patient lifecycle and appointment workflow
- `backend/__tests__/load.test.js`: Concurrent booking and API throughput verification
- `frontend/src/__tests__/accessAndUserCreation.test.jsx`: Role-scoped navigation (Admin Panel, Reports, Patient tabs) and user/doctor creation flows
- `frontend/src/__tests__/appointmentsPage.test.jsx`: Default Today & Upcoming view, local time display, past-slot disabling, doctor-only Finish modal, search & status filters, consultation reports
- `frontend/src/__tests__/dashboardAndTotals.test.jsx`: Staff dashboard KPIs & sorting, patient views, table-top totals, medical records date rendering
- `frontend/src/__tests__/reportsSorting.test.jsx`: Daily report sorting stability without row duplication
- `frontend/src/__tests__/routeGuards.test.jsx`: Client-side route protection, redirects, and role boundaries
- `frontend/src/__tests__/themeToggle.test.jsx`: Light/Dark mode state management and `localStorage` persistence
- `frontend/src/__tests__/signOutModal.test.jsx`: Minimal sign-out confirmation modal and session clearance
- `frontend/src/__tests__/patientBooking.test.jsx`: 1-click demo preset login verification
- `frontend/src/__tests__/uiComponents.test.jsx`: `DataTable` sorting, pagination, and `Modal` behavior

---

## 7. Project Structure

```text
clinic_appointment_and_patient_tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, logger, rate-limiter configuration
│   │   ├── controllers/     # Auth, users, appointments, patients, doctors, medical records, reports
│   │   ├── database/
│   │   │   └── migrations/  # Sequelize schema migrations
│   │   ├── middleware/      # JWT auth, role checks, validation & error handlers
│   │   ├── models/          # Sequelize models (User, Patient, Doctor, Appointment, MedicalRecord, AuditLog)
│   │   ├── routes/          # Express route definitions & OpenAPI/Swagger annotations
│   │   ├── services/        # Business logic & user provisioning services
│   │   ├── utils/           # Audit logger, JWT token helper, case-insensitive search, PDF/CSV export
│   │   ├── validators/      # Express-validator input schemas
│   │   ├── app.js           # Express app setup and middleware chain
│   │   ├── seed.js          # Oct 1 - Nov 30 Sri Lankan clinical dataset seeder
│   │   └── server.js        # Server bootstrap and graceful shutdown
│   ├── __tests__/           # Backend Jest test suites
│   └── .env.example         # Backend environment template
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client, auth store, endpoint helpers
│   │   ├── assets/          # Static visual assets (login background)
│   │   ├── components/      # Appointments, auth, common, forms, layout, and UI components
│   │   ├── context/         # AuthContext, ThemeContext
│   │   ├── pages/           # Dashboard, Appointments/History, Patients, Doctors, Reports, Admin Panel, Login
│   │   ├── __tests__/       # Frontend Vitest test suites
│   │   ├── App.jsx          # Role-protected route definitions
│   │   ├── index.css        # Clinical design tokens (Light & Dark themes)
│   │   └── main.jsx         # App root & context providers
│   ├── .env.example         # Optional frontend API URL template
│   └── index.html           # HTML5 entry point
├── commitlint.config.js     # Conventional Commit linting rules
├── package.json             # Monorepo root scripts & dev dependencies
└── README.md
```
