import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import { authStore } from '../api/authStore';
import App from '../App';
import LoginPage from '../pages/LoginPage';
import AddUserModal from '../components/forms/AddUserModal';
import DoctorsPage from '../pages/DoctorsPage';
import AppLayout from '../components/layout/AppLayout';
import { doctorsApi } from '../api/client';

beforeEach(() => {
  authStore.clearToken();
  sessionStorage.clear();
});

describe('Initial visit & role-scoped user/doctor creation', () => {
  it('LoginPage does not render any sign-up link or registration prompt', () => {
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /sign up/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/don't have an account/i)).not.toBeInTheDocument();
  });

  it('visiting /register unauthenticated redirects to LoginPage without signup form', async () => {
    render(
      <MemoryRouter initialEntries={['/register']}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /create account/i })).not.toBeInTheDocument();
  });

  it('AddUserModal for receptionist only allows Patient (User) and Doctor roles', () => {
    render(
      <AddUserModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        currentUserRole="receptionist"
      />
    );

    const roleSelect = screen.getByLabelText(/account role/i);
    const options = Array.from(roleSelect.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['patient', 'doctor']);
  });

  it('AddUserModal for admin allows Patient, Doctor, Receptionist, and Admin roles', () => {
    render(
      <AddUserModal
        isOpen={true}
        onClose={() => {}}
        onSuccess={() => {}}
        currentUserRole="admin"
      />
    );

    const roleSelect = screen.getByLabelText(/account role/i);
    const options = Array.from(roleSelect.querySelectorAll('option')).map((o) => o.value);
    expect(options).toEqual(['patient', 'doctor', 'receptionist', 'admin']);
  });

  it('DoctorsPage shows Add Doctor button for receptionist and hides it for doctor', async () => {
    vi.spyOn(doctorsApi, 'list').mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 10, total: 0, totalPages: 1 } },
    });

    // Receptionist
    authStore.setToken('fake-jwt');
    sessionStorage.setItem('cm_user', JSON.stringify({ id: 2, name: 'Front Desk', role: 'receptionist' }));

    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <DoctorsPage />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(await screen.findByRole('button', { name: /add doctor/i })).toBeInTheDocument();
    unmount();

    // Doctor
    sessionStorage.setItem('cm_user', JSON.stringify({ id: 3, name: 'Dr. Test', role: 'doctor' }));
    render(
      <MemoryRouter>
        <AuthProvider>
          <DoctorsPage />
        </AuthProvider>
      </MemoryRouter>
    );

    await screen.findByRole('heading', { name: /doctors/i });
    expect(screen.queryByRole('button', { name: /add doctor/i })).not.toBeInTheDocument();

    vi.restoreAllMocks();
  });

  it('AppLayout hides Users from receptionist, shows Reports to receptionist, shows Admin Panel to admin, and hides Portal from patient', () => {
    authStore.setToken('fake-jwt');
    sessionStorage.setItem('cm_user', JSON.stringify({ id: 2, name: 'Front Desk', role: 'receptionist' }));

    const { unmount } = render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /^users$/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^reports$/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /^admin panel$/i })).not.toBeInTheDocument();
    unmount();

    sessionStorage.setItem('cm_user', JSON.stringify({ id: 1, name: 'Admin', role: 'admin' }));
    const { unmount: unmountAdmin } = render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: /^admin panel$/i })).toBeInTheDocument();
    unmountAdmin();

    sessionStorage.setItem('cm_user', JSON.stringify({ id: 5, name: 'Ruwan Bandara', role: 'patient' }));
    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout />
        </AuthProvider>
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: /dashboard|my portal/i })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /my appointments/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /appointment history/i })).toBeInTheDocument();
  });
});
