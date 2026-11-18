import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportsPage from '../pages/ReportsPage';
import * as AuthContext from '../context/AuthContext';
import { reportsApi } from '../api/client';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/client', () => ({
  reportsApi: {
    daily: vi.fn(),
    monthly: vi.fn(),
    exportDaily: vi.fn(),
    exportMonthly: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ReportsPage Daily Table Sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 1, name: 'Admin User', email: 'admin@clinic.local', role: 'admin' },
    });

    vi.mocked(reportsApi.daily).mockResolvedValue({
      data: {
        data: {
          date: '2026-11-18',
          summary: { total: 3, scheduled: 2, completed: 1, cancelled: 0 },
          appointments: [
            {
              appointment_id: 201,
              patient_id: 5,
              doctor_id: 1,
              date_time: '2026-11-18T03:00:00.000Z',
              status: 'completed',
              patient: { patient_id: 5, name: 'Ruwan Bandara', contact: '077-987-6543' },
              doctor: { doctor_id: 1, name: 'Sanduni Perera', specialization: 'Cardiology' },
            },
            {
              appointment_id: 202,
              patient_id: 5,
              doctor_id: 2,
              date_time: '2026-11-18T05:15:00.000Z',
              status: 'scheduled',
              patient: { patient_id: 5, name: 'Ruwan Bandara', contact: '077-987-6543' },
              doctor: { doctor_id: 2, name: 'Nuwan Jayawardena', specialization: 'General' },
            },
            {
              appointment_id: 203,
              patient_id: 8,
              doctor_id: 1,
              date_time: '2026-11-18T08:30:00.000Z',
              status: 'scheduled',
              patient: { patient_id: 8, name: 'Amaya Silva', contact: '071-111-2222' },
              doctor: { doctor_id: 1, name: 'Sanduni Perera', specialization: 'Cardiology' },
            },
          ],
        },
      },
    });

    vi.mocked(reportsApi.monthly).mockResolvedValue({
      data: {
        data: {
          year: 2026,
          month: 11,
          summary: { total: 3, scheduled: 2, completed: 1, cancelled: 0 },
          perDoctor: [],
          perPatient: [],
        },
      },
    });
  });

  it('does not duplicate rows when clicking the Patient header repeatedly even with shared patient_id', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    );

    const firstRowText = await screen.findByText('Amaya Silva');
    const dailyTable = firstRowText.closest('table');
    expect(dailyTable).not.toBeNull();

    const patientHeader = within(dailyTable).getByText(/Patient/);

    const getBodyRowCount = () => within(dailyTable).getAllByRole('row').length - 1;
    expect(getBodyRowCount()).toBe(3);

    for (let i = 0; i < 6; i++) {
      fireEvent.click(patientHeader);
      expect(getBodyRowCount()).toBe(3);
    }

    const keyWarnings = consoleErrorSpy.mock.calls.filter((args) =>
      args.some((a) => typeof a === 'string' && a.includes('same key'))
    );
    expect(keyWarnings).toHaveLength(0);
    expect(screen.queryByRole('button', { name: /view report/i })).not.toBeInTheDocument();

    // Switching to Monthly tab renders monthly view without View Report button
    fireEvent.click(screen.getByRole('tab', { name: /monthly/i }));
    expect(await screen.findByText(/Total Visits/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view report/i })).not.toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });
});
