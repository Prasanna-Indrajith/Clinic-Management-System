import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from '../pages/DashboardPage';
import PatientsPage from '../pages/PatientsPage';
import DoctorsPage from '../pages/DoctorsPage';
import * as AuthContext from '../context/AuthContext';
import { appointApi, patientsApi, doctorsApi, medicalRecordsApi } from '../api/client';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/client', () => ({
  appointApi: {
    list: vi.fn(),
  },
  patientsApi: {
    list: vi.fn(),
  },
  doctorsApi: {
    list: vi.fn(),
  },
  medicalRecordsApi: {
    list: vi.fn(),
    getByAppointment: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Dashboard & Header Totals Bug Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows active patient count for doctor, excludes cancelled from Today Appointments, and sorts by time', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 2, name: 'Dr. Sanduni Perera', email: 'dr.smith@clinic.local', role: 'doctor' },
    });

    const todayBase = new Date();
    const t1400 = new Date(todayBase.getFullYear(), todayBase.getMonth(), todayBase.getDate(), 14, 0, 0).toISOString();
    const t0830 = new Date(todayBase.getFullYear(), todayBase.getMonth(), todayBase.getDate(), 8, 30, 0).toISOString();
    const t1045Cancelled = new Date(todayBase.getFullYear(), todayBase.getMonth(), todayBase.getDate(), 10, 45, 0).toISOString();

    vi.mocked(appointApi.list).mockImplementation((params) => {
      if (params?.date) {
        return Promise.resolve({
          data: {
            data: [
              {
                appointment_id: 2,
                date_time: t1400,
                status: 'scheduled',
                patient: { name: 'Afternoon Patient' },
                doctor: { name: 'Sanduni Perera' },
              },
              {
                appointment_id: 3,
                date_time: t1045Cancelled,
                status: 'cancelled',
                patient: { name: 'Cancelled Patient' },
                doctor: { name: 'Sanduni Perera' },
              },
              {
                appointment_id: 1,
                date_time: t0830,
                status: 'completed',
                patient: { name: 'Morning Patient' },
                doctor: { name: 'Sanduni Perera' },
              },
            ],
          },
        });
      }
      return Promise.resolve({
        data: {
          data: [
            {
              appointment_id: 10,
              date_time: t0830,
              status: 'completed',
              patient: { name: 'Oldest Recent' },
              doctor: { name: 'Sanduni Perera' },
            },
            {
              appointment_id: 11,
              date_time: t1400,
              status: 'scheduled',
              patient: { name: 'Newest Recent' },
              doctor: { name: 'Sanduni Perera' },
            },
          ],
        },
      });
    });

    vi.mocked(patientsApi.list).mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 1, total: 7, totalPages: 7 } },
    });
    vi.mocked(doctorsApi.list).mockResolvedValue({
      data: { data: [], pagination: { page: 1, limit: 1, total: 5, totalPages: 5 } },
    });

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    // Doctor active patient count (7) and Today's Appointments excluding cancelled (2)
    await waitFor(() => {
      expect(patientsApi.list).toHaveBeenCalledWith({ limit: 1 });
    });
    expect(await screen.findByText('7')).toBeInTheDocument();
    expect(screen.getByText('Active Patients')).toBeInTheDocument();

    // Cancelled appointment excluded from Today's Queue; remaining 2 shown in time order (08:30 before 14:00)
    expect(screen.queryByText('Cancelled Patient')).not.toBeInTheDocument();
    const morningEl = screen.getByText('Morning Patient');
    const afternoonEl = screen.getByText('Afternoon Patient');
    expect(morningEl.compareDocumentPosition(afternoonEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Recent Activity sorted newest first (Newest Recent before Oldest Recent)
    const newestEl = screen.getByText('Newest Recent');
    const oldestEl = screen.getByText('Oldest Recent');
    expect(newestEl.compareDocumentPosition(oldestEl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    // Doctor dashboard must NOT render Add Patient button
    expect(screen.queryByRole('link', { name: /add patient/i })).not.toBeInTheDocument();
  });

  it('shows only personal appointments/history and View Report on patient dashboard, and renders valid scheduled date/time in medical records modal', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 5, name: 'Ruwan Bandara', email: 'patient@clinic.local', role: 'patient' },
    });

    const today = new Date();
    const upcomingTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 16, 30, 0).toISOString();
    const completedTime = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1, 9, 30, 0).toISOString();

    vi.mocked(appointApi.list).mockResolvedValue({
      data: {
        data: [
          {
            appointment_id: 301,
            date_time: upcomingTime,
            status: 'scheduled',
            doctor: { name: 'Sanduni Perera', specialization: 'Cardiology' },
          },
          {
            appointment_id: 302,
            date_time: completedTime,
            status: 'completed',
            doctor: { name: 'Nuwan Jayawardena', specialization: 'General' },
          },
        ],
      },
    });
    vi.mocked(medicalRecordsApi.getByAppointment).mockResolvedValue({
      data: {
        data: {
          appointment: { appointment_id: 302, date_time: completedTime, doctor: { name: 'Nuwan Jayawardena' } },
          medicalRecord: { record_id: 11, diagnosis: 'Healthy checkup', prescription: 'None', notes: 'All normal' },
        },
      },
    });

    const { unmount } = render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('My Appointments')).toBeInTheDocument();
    expect(screen.getAllByText('Appointment History').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('link', { name: /book appointment/i })).toBeInTheDocument();
    expect(screen.queryByText(/Consulted Doctors/i)).not.toBeInTheDocument();

    const reportBtn = await screen.findByRole('button', { name: /view report/i });
    fireEvent.click(reportBtn);
    expect(await screen.findByText('Healthy checkup')).toBeInTheDocument();
    unmount();

    // PatientsPage medical records modal must never render Invalid Date and shows scheduled date & time
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 2, name: 'Dr. Sanduni Perera', email: 'dr.smith@clinic.local', role: 'doctor' },
    });
    vi.mocked(patientsApi.list).mockResolvedValue({
      data: {
        data: [{ patient_id: 1, name: 'Ruwan Bandara', dob: '1985-06-14', contact: '077-987-6543' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    vi.mocked(medicalRecordsApi.list).mockResolvedValue({
      data: {
        data: [
          {
            record_id: 55,
            diagnosis: 'Migraine',
            prescription: 'Sumatriptan',
            notes: 'Rest',
            record_date: '2026-11-18',
            createdAt: completedTime,
            appointment: { appointment_id: 302, date_time: completedTime },
          },
        ],
      },
    });

    render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>
    );

    const recordsBtn = await screen.findByRole('button', { name: /records/i });
    fireEvent.click(recordsBtn);
    expect(await screen.findByText('Migraine')).toBeInTheDocument();
    expect(screen.queryByText(/Invalid Date/i)).not.toBeInTheDocument();
    expect(screen.getByText(/09:30/)).toBeInTheDocument();
  });

  it('displays total count badges at the top of Patients and Doctors pages', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 1, name: 'Admin', email: 'admin@clinic.local', role: 'admin' },
    });

    vi.mocked(patientsApi.list).mockResolvedValue({
      data: {
        data: [{ patient_id: 1, name: 'Ruwan Bandara', dob: '1985-06-14', contact: '077-987-6543' }],
        pagination: { page: 1, limit: 10, total: 12, totalPages: 2 },
      },
    });
    vi.mocked(doctorsApi.list).mockResolvedValue({
      data: {
        data: [
          {
            doctor_id: 1,
            name: 'Dr. Sanduni Perera',
            specialization: 'Cardiology',
            contact: '077-234-5678',
            email: 'dr.smith@clinic.local',
          },
        ],
        pagination: { page: 1, limit: 10, total: 5, totalPages: 1 },
      },
    });

    const { unmount } = render(
      <MemoryRouter>
        <PatientsPage />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('patients-total-count')).toHaveTextContent('12 patients');
    unmount();

    render(
      <MemoryRouter>
        <DoctorsPage />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('doctors-total-count')).toHaveTextContent('5 doctors');
  });
});
