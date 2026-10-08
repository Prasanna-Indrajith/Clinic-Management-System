# Clinic Appointment & Patient Tracker (ClinicMate)

A secure, full-stack clinical operations and patient management platform built with modern Node.js and React. Features role-based access control (RBAC), conflict-free appointment scheduling with transactional race-condition prevention, patient self-booking with doctor availability slot calculations, interactive clinical dashboards, automated PDF/CSV medical reporting, and persistent Light/Dark mode themes.

---

## 1. System Architecture & Tech Stack

- **Backend**: Node.js (v20+), Express 4, Sequelize ORM (PostgreSQL in production / SQLite in memory for unit testing)
- **Frontend**: React 19, Vite, React Router v6, Axios, React Hot Toast, Vanilla CSS Design System
- **Database**: PostgreSQL 16 (relational schema, foreign keys, index-backed lookups, transactional locks)
- **Security & Hardening**:
  - JWT Authentication (Bearer tokens stored securely in memory & `sessionStorage`)
  - Role-Based Access Control (RBAC) with 4 roles: `admin`, `doctor`, `receptionist`, `patient`
  - Helmet HTTP Security Headers (strict CSP, MIME sniff protection, frameguard)
  - Rate limiting on authentication endpoints (5 failed attempts per 15 minutes)
  - Password hashing with `bcrypt` (10 salt rounds)
  - Parameterized ORM queries preventing SQL injection
  - In-memory Promise-queue Mutex (`bookingMutex`) preventing concurrent double-booking
  - Sign-out confirmation modal preventing accidental session loss

---

## 2. Port & Service Mapping

| Service | Port | Description |
|---|---|---|
| **Frontend Web App** | `5173` | Patient self-booking portal, clinical staff dashboards |
| **Backend REST API** | `5000` | Core clinical APIs, auth, reporting, and audit logs |
| **Swagger API Docs** | `5000` (`/api/docs`) | Interactive OpenAPI 3.0 specification |
| **PostgreSQL Database** | `5432` | Relational persistence with foreign-key constraints |

---

## 3. Quick Start (Local Development)

### Prerequisites
- Node.js (v20 or higher)
- npm (v9 or higher)
- PostgreSQL 16 (or local database container)

### 1. Configure Environment
```bash
# Backend environment setup
cp backend/.env.example backend/.env
```

### 2. Install Dependencies
```bash
# Root & backend dependencies
npm install

# Frontend dependencies
npm --prefix frontend install
```

### 3. Seed Database
```bash
# Seeds realistic Sri Lankan clinical staff, patient profiles, and multi-month appointments
npm run db:seed
```

### 4. Start Development Servers
```bash
# Run both backend (:5000) and frontend (:5173) concurrently:
npm run dev

# Or run them in separate terminals:
# Terminal 1: Backend
npm --prefix backend run dev

# Terminal 2: Frontend
npm --prefix frontend run dev
```

Visit `http://localhost:5173` to access the application.

---

## 4. Demo Accounts (1-Click Login)

The login screen provides 1-click credential presets for testing each clinical role:

| Role | Email | Password | Name / Specialization |
|---|---|---|---|
| **Patient** | `patient@clinic.local` | `PatientPass123!` | Ruwan Bandara |
| **Receptionist** | `receptionist@clinic.local` | `ReceptionPass123!` | Kumari Dissanayake |
| **Doctor** | `dr.smith@clinic.local` | `DoctorPass123!` | Dr. Sanduni Perera (Cardiology) |
| **Admin** | `admin@clinic.local` | `AdminPass123!` | Pasan Jayasuriya (Clinic Admin) |

Additional doctor profiles available in seed data:
- `dr.house@clinic.local` (General Medicine)
- `dr.desilva@clinic.local` (Pediatrics)
- `dr.wickramasinghe@clinic.local` (Dermatology)
- `dr.fernando@clinic.local` (Orthopedics)

---

## 5. Automated Testing & Code Quality

The repository includes **111 automated tests** across unit, integration, RBAC security, UI, and load-testing levels:

```bash
# Run all tests (backend Jest + frontend Vitest)
npm run test:all

# Run backend test suite (86 tests)
npm run test:backend

# Run frontend Vitest suite (25 tests)
npm run test:frontend

# Code quality & linting
npm run lint
```

### Test Suite Summary:
- `backend/__tests__/auth.test.js`: Registration, login, password comparison, token issuance, RBAC enforcement
- `backend/__tests__/patients.test.js`: Patient CRUD operations, doctor assignment scoping, search sanitization
- `backend/__tests__/appointments.test.js`: Slot booking, double-booking rejection, transactional concurrency locks
- `backend/__tests__/patientPortal.test.js`: Doctor availability slot calculation and patient self-booking
- `backend/__tests__/reports.test.js`: Daily/monthly report calculations, CSV & PDF export streaming
- `backend/__tests__/security.test.js`: SQLi injection immunity, XSS handling, IDOR protection, zero credential leakage
- `backend/__tests__/e2e.test.js`: Full patient lifecycle and appointment workflow
- `frontend/src/__tests__/routeGuards.test.jsx`: Client-side route protection, unauthenticated redirects, role boundaries
- `frontend/src/__tests__/themeToggle.test.jsx`: Light/Dark mode state management and localStorage persistence
- `frontend/src/__tests__/signOutModal.test.jsx`: Sign-out confirmation modal interaction and session clearance
- `frontend/src/__tests__/patientBooking.test.jsx`: 1-click patient preset filling and self-booking verification
- `frontend/src/__tests__/uiComponents.test.jsx`: DataTable sorting, pagination, and Modal component behavior

---

## 6. Project Structure

```text
clinic_appointment_and_patient_tracker/
├── backend/
│   ├── src/
│   │   ├── config/          # Database, logger, rate-limiter configuration
│   │   ├── controllers/     # Auth, appointment, patient, doctor, report controllers
│   │   ├── middleware/      # JWT auth, role validation, error handlers
│   │   ├── models/          # Sequelize models (User, Patient, Doctor, Appointment, AuditLog)
│   │   ├── routes/          # Express route definitions & Swagger doc annotations
│   │   ├── utils/           # Audit logger, token generator, PDF streamer
│   │   ├── validators/      # Express-validator input validation schemas
│   │   ├── app.js           # Express app setup and middleware chain
│   │   ├── seed.js          # Realistic Sri Lankan clinical dataset seeder
│   │   └── server.js        # Server bootstrap and graceful shutdown
│   └── __tests__/           # Comprehensive backend Jest test suites
├── frontend/
│   ├── src/
│   │   ├── api/             # Axios client, auth store, API helpers
│   │   ├── components/      # UI components (DataTable, Modal, ThemeToggle, SignOutModal)
│   │   ├── context/         # AuthContext, ThemeContext
│   │   ├── pages/           # Dashboard, Appointments, Patients, Doctors, Reports, Admin, Auth
│   │   ├── App.jsx          # Protected route setup
│   │   ├── index.css        # Clinical design tokens (Light & Dark mode themes)
│   │   └── main.jsx         # App root & context providers
│   └── index.html           # HTML5 entry with favicon and meta tags
├── logs/                    # Live application and error log files
├── untrack/                 # Local docs, setup guides, planning archives, and backups
├── commitlint.config.js     # Commit message linting rules
├── package.json             # Monorepo root scripts & dev dependencies
└── README.md
```
