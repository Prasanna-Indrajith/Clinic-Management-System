# Clinic Appointment & Patient Tracker

A full-stack, secure, production-ready clinical operations platform for managing patients, doctor assignments, appointment bookings with transactional race-condition prevention, and clinical performance reporting with automated PDF/CSV export.

---

## 1. System Architecture & Tech Stack

- **Backend**: Node.js (v20+), Express 4, Sequelize ORM (PostgreSQL in production / SQLite in memory for unit testing)
- **Frontend**: React 19, Vite, React Router v6, Axios, React Hot Toast, Lucide Icons
- **Database**: PostgreSQL 16 (with relational constraints, index-backed foreign keys, and connection pooling)
- **Security & Hardening**:
  - JWT Authentication (Bearer tokens stored in memory & `sessionStorage`)
  - Role-Based Access Control (RBAC) with 4 roles: `admin`, `doctor`, `receptionist`, `patient`
  - Helmet HTTP Security Headers (CSP, XSS protection, MIME sniff protection)
  - Rate limiting on authentication endpoints (5 failed attempts per 15 minutes)
  - Password hashing with `bcrypt` (10 salt rounds)
  - Parameterized ORM queries preventing SQL injection
  - In-memory Promise-queue Mutex (`bookingMutex`) preventing concurrent double-booking
- **Containerization & Deployment**: Podman / Docker support, Multi-stage builds, Nginx reverse-proxy and SPA server, Podman Compose / Docker Compose orchestration

---

## 2. Port & Service Mapping

| Service | Port | Description |
|---|---|---|
| **Frontend Web App** | `5173` (dev) / `80` (Container) | Patient portal, doctor dashboard, admin management |
| **Backend REST API** | `5000` | Core clinical APIs and auth endpoints |
| **Swagger API Docs** | `5000` (`/api/docs`) | Interactive OpenAPI 3.0 specification |
| **PostgreSQL Database** | `5432` | Relational persistence with foreign-key constraints |

---

## 3. Getting Started (Local Development)

### Prerequisites
- Node.js (v20 or higher)
- npm (v9 or higher)
- PostgreSQL 16 (optional for dev; SQLite runs automatically for tests)

### 1. Clone & Configure Environment
```bash
git clone <repo-url>
cd clinic_appointment_and_patient_tracker

# Copy environment template
cp backend/.env.example backend/.env
```

### 2. Install Dependencies
```bash
# Root & backend dependencies
npm install

# Frontend dependencies
npm --prefix frontend install
```

### 3. Run Development Servers
```bash
# Terminal 1: Backend API (runs on port 5000)
npm --prefix backend run dev

# Terminal 2: Frontend Client (runs on port 5173)
npm --prefix frontend run dev
```

Visit `http://localhost:5173` to access the application.

---

## 4. Dev Testing & Deployment Modes

### Mode A: Hybrid Local Dev Testing (Fastest & Easiest for Development)
Run PostgreSQL in a Podman container while running the backend (Nodemon) and frontend (Vite HMR) directly on your host machine with immediate code reload:

```bash
# 1. Start PostgreSQL 16 container in the background
npm run db:up

# 2. Seed realistic demo data (admin, doctors, patients, appointments)
npm run db:seed

# 3. Start backend (:5000) and frontend (:5173) with live hot-reloading
npm run dev

# 4. Stop PostgreSQL container when finished
npm run db:down
```

### Mode B: Full-Container Dev Testing with Live Volume Mounts
Run all 3 services in Podman containers with live host volume mounts (changes to `backend/` or `frontend/` instantly reload inside the containers):

```bash
# Start full dev stack with Nodemon & Vite HMR
npm run dev:podman
# (or: podman compose -f docker-compose.dev.yml up --build)
```

### Mode C: Production Deployment Simulation
Spins up production containers (multi-stage production builds, Nginx reverse proxy serving static bundle, production backend):

```bash
podman compose up --build
# (or: podman-compose up --build)
```

The PostgreSQL database initializes automatically, seeds schema tables via Sequelize sync, and establishes networking between containers.
- Access the web interface at `http://localhost`
- Access the API documentation at `http://localhost/api/docs` or `http://localhost:5000/api/docs`

---

## 5. Automated Testing & Code Quality

The codebase enforces a comprehensive automated test suite across unit, integration, security, and UI levels.

```bash
# Run all backend test suites (auth, patients, appointments, reports, e2e, security)
npm test

# Run frontend Vitest suite (route guards, DataTable, Modal components)
npm --prefix frontend test -- --run

# Run ESLint on backend and frontend
npm --prefix backend run lint
npm --prefix frontend run lint
```

### Test Suite Breakdown (79 Automated Tests):
- `backend/__tests__/auth.test.js`: AUTH-01 to AUTH-09 (Registration, login, bcrypt, token verification, RBAC)
- `backend/__tests__/patients.test.js`: PAT-01 to PAT-07, DOC-01 to DOC-03 (CRUD operations, doctor scoping, literal search)
- `backend/__tests__/appointments.test.js`: APT-01 to APT-06 (Slot booking, double-booking rejection, concurrent race condition handling)
- `backend/__tests__/reports.test.js`: REP-01 to REP-05 (Daily/monthly reports, CSV/PDF streaming, role scoping)
- `backend/__tests__/e2e.test.js`: End-to-end user journeys (Admin setup -> Doctor schedule -> Patient booking -> Report generation)
- `backend/__tests__/security.test.js`: SEC-01 to SEC-08 (SQLi injection immunity, XSS handling, IDOR boundaries, CORS headers, zero credential leak)
- `frontend/src/__tests__/routeGuards.test.jsx`: FE-01 to FE-04 (Client-side auth redirects, unauthorized route protection)
- `frontend/src/__tests__/uiComponents.test.jsx`: DataTable sorting, pagination, and Modal lifecycle events

---

## 6. Seed Credentials for Verification

- **Default Test Doctor**: `jane.smith@clinic.local` / `SecurePass123!`
- **Initial Admin Creation**: Available via the self-registration page at `/register` by selecting the `admin` role.

---

## 7. Project Documentation

- [01_DEVELOPMENT_PLAN.md](01_DEVELOPMENT_PLAN.md): Complete phase-by-phase implementation plan and definition of done.
- [02_TEST_PLAN.md](02_TEST_PLAN.md): Formal verification matrices and test IDs (`AUTH`, `PAT`, `DOC`, `APT`, `REP`, `SEC`, `FE`).
- [PROGRESS.md](PROGRESS.md): Live phase completion tracking and milestone statuses.
- [STATUS.md](STATUS.md): Quick reference guide for endpoints, credentials, and local run configurations.
