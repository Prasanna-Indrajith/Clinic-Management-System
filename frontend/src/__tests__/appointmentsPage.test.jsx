import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AppointmentsPage from '../pages/AppointmentsPage';
import * as AuthContext from '../context/AuthContext';
import { appointApi, doctorsApi, patientsApi, medicalRecordsApi } from '../api/client';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../api/client', () => ({
  appointApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
  },
  doctorsApi: {
    list: vi.fn(),
    getAvailability: vi.fn(),
  },
  patientsApi: {
    list: vi.fn(),
  },
  medicalRecordsApi: {
    list: vi.fn(),
    getByAppointment: vi.fn(),
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <AppointmentsPage />
    </MemoryRouter>
  );
}

describe('AppointmentsPage Bug Fixes', () => {
  const todayLocal = new Date();
  const futureToday = new Date(todayLocal.getTime() + 2 * 60 * 60 * 1000);
  const pastToday = new Date(todayLocal.getTime() - 2 * 60 * 60 * 1000);
  const futureFormattedTime = futureToday.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const scheduledRow = {
    appointment_id: 101,
    patient_id: 1,
    doctor_id: 1,
    date_time: futureToday.toISOString(),
    status: 'scheduled',
    remarks: 'Regular checkup',
    patient: { patient_id: 1, name: 'Ruwan Bandara' },
    doctor: { doctor_id: 1, name: 'Sanduni Perera' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 2, name: 'Dr. Sanduni Perera', email: 'dr.smith@clinic.local', role: 'doctor' },
    });
    vi.mocked(appointApi.list).mockResolvedValue({
      data: {
        data: [scheduledRow],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    vi.mocked(doctorsApi.list).mockResolvedValue({
      data: {
        data: [{ doctor_id: 1, name: 'Dr. Sanduni Perera', specialization: 'Cardiology' }],
      },
    });
    vi.mocked(patientsApi.list).mockResolvedValue({
      data: {
        data: [{ patient_id: 1, name: 'Ruwan Bandara' }],
      },
    });
  });

  it('defaults to Today & Upcoming starting from today and shows matching local time', async () => {
    renderPage();

    await waitFor(() => {
      expect(appointApi.list).toHaveBeenCalledTimes(1);
    });

    const callParams = vi.mocked(appointApi.list).mock.calls[0][0];
    expect(callParams.startDate).toBeDefined();
    const expectedStartOfToday = new Date(
      todayLocal.getFullYear(),
      todayLocal.getMonth(),
      todayLocal.getDate(),
      0,
      0,
      0,
      0
    ).toISOString();
    expect(callParams.startDate).toBe(expectedStartOfToday);

    expect(await screen.findByText(futureFormattedTime)).toBeInTheDocument();
  });

  it('does not render Remind buttons in the appointments table for any role', async () => {
    const roles = ['doctor', 'receptionist', 'admin', 'patient'];
    for (const role of roles) {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        user: { id: 1, name: 'Test User', email: 'test@clinic.local', role },
      });
      const { unmount } = renderPage();
      await screen.findByText(/Sanduni Perera/i);
      expect(screen.queryByRole('button', { name: /remind/i })).toBeNull();
      unmount();
    }
  });

  it('allows only doctor to finish a scheduled appointment with Add New Clinical Entry', async () => {
    vi.mocked(appointApi.complete).mockResolvedValue({
      data: { data: { ...scheduledRow, status: 'completed' } },
    });

    // Receptionist, admin, and patient should NOT see the Finish button
    for (const role of ['receptionist', 'admin', 'patient']) {
      vi.mocked(AuthContext.useAuth).mockReturnValue({
        user: { id: 3, name: 'Non-Doctor', email: 'user@clinic.local', role },
      });
      const { unmount } = renderPage();
      await screen.findByText(/Sanduni Perera/i);
      expect(screen.queryByRole('button', { name: /finish/i })).toBeNull();
      unmount();
    }

    // Doctor sees Finish button -> opens Add New Clinical Entry modal -> submits
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 2, name: 'Dr. Sanduni Perera', email: 'dr.smith@clinic.local', role: 'doctor' },
    });
    renderPage();

    const finishBtn = await screen.findByRole('button', { name: /finish/i });
    fireEvent.click(finishBtn);

    expect(await screen.findByText('Add New Clinical Entry')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/diagnosis/i), {
      target: { value: 'Essential hypertension follow-up' },
    });
    fireEvent.change(screen.getByLabelText(/prescription/i), {
      target: { value: 'Losartan 50mg daily' },
    });
    fireEvent.change(screen.getByLabelText(/clinical notes/i), {
      target: { value: 'BP well controlled' },
    });

    fireEvent.click(screen.getByRole('button', { name: /finish & save clinical entry/i }));

    await waitFor(() => {
      expect(appointApi.complete).toHaveBeenCalledWith(101, {
        diagnosis: 'Essential hypertension follow-up',
        prescription: 'Losartan 50mg daily',
        notes: 'BP well controlled',
      });
    });
  });

  it('disables past slots for today and passes tzOffset when fetching availability', async () => {
    const pastTimeLabel = pastToday.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const futureTimeLabel = futureToday.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    vi.mocked(doctorsApi.getAvailability).mockResolvedValue({
      data: {
        slots: [
          {
            time: pastTimeLabel,
            dateTime: pastToday.toISOString(),
            available: false,
            reason: 'Past',
          },
          {
            time: futureTimeLabel,
            dateTime: futureToday.toISOString(),
            available: true,
            reason: 'Available',
          },
        ],
      },
    });

    renderPage();
    await screen.findByText('Ruwan Bandara');

    fireEvent.click(screen.getByRole('button', { name: /new appointment/i }));

    const doctorSelect = await screen.findByLabelText(/doctor & specialist/i);
    fireEvent.change(doctorSelect, { target: { value: '1' } });

    await waitFor(() => {
      expect(doctorsApi.getAvailability).toHaveBeenCalledWith(
        '1',
        expect.objectContaining({
          tzOffset: expect.any(Number),
        })
      );
    });

    const pastSlotBtn = await screen.findByRole('button', { name: new RegExp(pastTimeLabel) });
    const futureSlotBtn = await screen.findByRole('button', { name: new RegExp(futureTimeLabel) });

    expect(pastSlotBtn).toBeDisabled();
    expect(futureSlotBtn).not.toBeDisabled();
  });

  it('shows Doctor filter, Search button, and View Report on completed appointment for receptionist, and View Report for patient', async () => {
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 4, name: 'Front Desk', email: 'rec@clinic.local', role: 'receptionist' },
    });
    vi.mocked(appointApi.list).mockResolvedValue({
      data: {
        data: [{ ...scheduledRow, status: 'completed' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });

    const { unmount } = renderPage();
    await screen.findByText('Ruwan Bandara');

    expect(screen.getByRole('button', { name: /view report/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^filters$/i }));
    expect(screen.getByLabelText(/doctor/i)).toBeInTheDocument();

    const searchInput = screen.getByRole('textbox', { name: /search appointments/i });
    fireEvent.change(searchInput, { target: { value: 'Ruwan' } });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(appointApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ search: 'Ruwan' })
      );
    });

    fireEvent.click(screen.getByRole('button', { name: /^completed$/i }));
    await waitFor(() => {
      expect(appointApi.list).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: 'completed' })
      );
    });
    unmount();

    // Patient sees View Report on completed appointment
    vi.mocked(AuthContext.useAuth).mockReturnValue({
      user: { id: 5, name: 'Ruwan Bandara', email: 'patient@clinic.local', role: 'patient' },
    });
    vi.mocked(appointApi.list).mockResolvedValue({
      data: {
        data: [{ ...scheduledRow, status: 'completed' }],
        pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
      },
    });
    vi.mocked(medicalRecordsApi.getByAppointment).mockResolvedValue({
      data: {
        data: {
          appointment: { ...scheduledRow, status: 'completed' },
          medicalRecord: {
            record_id: 77,
            diagnosis: 'Normal follow-up',
            prescription: 'Vitamin D 1000 IU',
            notes: 'Repeat labs in 3 months',
            doctor: { name: 'Sanduni Perera', specialization: 'Cardiology' },
          },
        },
      },
    });

    renderPage();
    const viewReportBtn = await screen.findByRole('button', { name: /view report/i });
    fireEvent.click(viewReportBtn);

    expect(await screen.findByText('Normal follow-up')).toBeInTheDocument();
    expect(screen.getByText('Vitamin D 1000 IU')).toBeInTheDocument();
  });
});
