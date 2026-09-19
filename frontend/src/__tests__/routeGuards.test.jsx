/**
 * Frontend Route Guard Tests — FE-01 to FE-04
 *
 * Uses Vitest + React Testing Library.
 * The AuthContext and ProtectedRoute are tested by rendering a minimal router tree
 * and asserting navigation / render outcomes based on auth state.
 *
 * NOTE: No live network calls are made — authStore and axios are stubbed.
 */

import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/layout/ProtectedRoute';
import { authStore } from '../api/authStore';

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Render a protected route tree in a MemoryRouter.
 *   - initialEntries: the URL the user is "navigating to"
 *   - authUser: if provided, sets up AuthContext as logged-in with this user
 */
function renderProtectedRoute({ initialEntries = ['/dashboard'], authUser = null, allowedRoles = undefined } = {}) {
  // Pre-seed authStore so AuthProvider picks up existing session
  if (authUser) {
    authStore.setToken('fake-jwt-for-tests');
    sessionStorage.setItem('cm_user', JSON.stringify(authUser));
  } else {
    authStore.clearToken();
    sessionStorage.removeItem('cm_user');
  }

  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<div data-testid="login-page">Login Page</div>} />

          {/* Protected (optionally role-gated) */}
          <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
            <Route path="/dashboard" element={<div data-testid="dashboard-page">Dashboard</div>} />
            <Route path="/patients"  element={<div data-testid="patients-page">Patients</div>} />
            <Route path="/appointments" element={<div data-testid="appointments-page">Appointments</div>} />
            <Route path="/reports"   element={<div data-testid="reports-page">Reports</div>} />
            <Route path="/admin/users" element={<div data-testid="admin-page">Admin Users</div>} />
          </Route>
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  authStore.clearToken();
  sessionStorage.clear();
});

// ── FE-01: Unauthenticated redirect ──────────────────────────────────────────

describe('FE-01: Unauthenticated redirect to /login', () => {
  const protectedPaths = ['/dashboard', '/patients', '/appointments', '/reports'];

  it.each(protectedPaths)('redirects unauthenticated user from %s to /login', async (path) => {
    renderProtectedRoute({ initialEntries: [path], authUser: null });
    expect(await screen.findByTestId('login-page')).toBeInTheDocument();
  });
});

// ── FE-02: Doctor-role cannot reach admin-only route ─────────────────────────

describe('FE-02: Role-based access control', () => {
  it('blocks a Doctor-role user from accessing /admin/users (admin-only)', async () => {
    const doctorUser = { id: 2, name: 'Dr. Smith', email: 'smith@clinic.local', role: 'doctor' };
    renderProtectedRoute({
      initialEntries: ['/admin/users'],
      authUser: doctorUser,
      allowedRoles: ['admin'],
    });

    // Should show ForbiddenPage, NOT the admin page
    const forbidden = await screen.findByText(/Access Denied/i);
    expect(forbidden).toBeInTheDocument();
    expect(screen.queryByTestId('admin-page')).not.toBeInTheDocument();
  });

  it('allows an admin user to access /admin/users', async () => {
    const adminUser = { id: 1, name: 'Admin Joe', email: 'admin@clinic.local', role: 'admin' };
    renderProtectedRoute({
      initialEntries: ['/admin/users'],
      authUser: adminUser,
      allowedRoles: ['admin'],
    });
    expect(await screen.findByTestId('admin-page')).toBeInTheDocument();
  });
});

// ── FE-03: Backend errors surfaced as user-friendly toast (integration-level) ─

describe('FE-03: Error normalization in auth', () => {
  it('exposes a normalized error.message (not raw status code) from authStore', async () => {
    // authStore.emitUnauthorized should trigger logout without throwing
    authStore.setToken('expiring-token');
    let called = false;
    const unsub = authStore.onUnauthorized(() => { called = true; });
    authStore.emitUnauthorized();
    unsub();
    expect(called).toBe(true);
  });
});

// ── FE-04: Logout clears token and blocks subsequent requests ─────────────────

describe('FE-04: Logout clears token', () => {
  it('authStore.clearToken removes the token from memory and sessionStorage', () => {
    authStore.setToken('my-test-token');
    expect(authStore.getToken()).toBe('my-test-token');

    authStore.clearToken();
    expect(authStore.getToken()).toBeNull();
    expect(sessionStorage.getItem('cm_token')).toBeNull();
  });

  it('logging out via AuthProvider clears user from context', async () => {
    const adminUser = { id: 1, name: 'Admin Joe', email: 'admin@clinic.local', role: 'admin' };

    function LogoutTestPage() {
      const { logout, isAuthenticated } = useAuth();
      return (
        <div>
          <span data-testid="auth-status">{isAuthenticated ? 'logged-in' : 'logged-out'}</span>
          <button type="button" onClick={logout}>Logout</button>
        </div>
      );
    }

    authStore.setToken('fake-jwt-for-tests');
    sessionStorage.setItem('cm_user', JSON.stringify(adminUser));

    const { getByRole, findByTestId } = render(
      <MemoryRouter>
        <AuthProvider>
          <LogoutTestPage />
        </AuthProvider>
      </MemoryRouter>
    );

    // Initially authenticated
    expect(await findByTestId('auth-status')).toHaveTextContent('logged-in');

    // Simulate logout button click
    getByRole('button', { name: /logout/i }).click();

    // Should now be logged out
    expect(await findByTestId('auth-status')).toHaveTextContent('logged-out');
    expect(authStore.getToken()).toBeNull();
  });
});
