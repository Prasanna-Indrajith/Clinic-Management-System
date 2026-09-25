import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointApi, doctorsApi, patientsApi, notificationsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', date: '', doctor_id: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('book');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const isPatient = user?.role === 'patient';
  const canWrite = user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'receptionist';

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (filters.status) params.status = filters.status;
      if (filters.date) params.date = filters.date;
      if (filters.doctor_id) params.doctor_id = filters.doctor_id;
      const { data } = await appointApi.list(params);
      setAppointments(data.data || []);
      setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  const fetchDoctors = useCallback(async () => {
    setLoadingDoctors(true);
    try {
      const { data } = await doctorsApi.list({ limit: 100 });
      setDoctors(data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load doctors');
    } finally {
      setLoadingDoctors(false);
    }
  }, []);

  const fetchPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const { data } = await patientsApi.list({ limit: 100 });
      setPatients(data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load patients');
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  useEffect(() => {
    if (modalOpen && (modalMode === 'book' || modalMode === 'edit')) {
      fetchDoctors();
      fetchPatients();
    }
  }, [modalOpen, modalMode, fetchDoctors, fetchPatients]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setPage(1);
  };

  const handleBook = () => {
    setModalMode('book');
    setSelectedAppointment(null);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleEdit = (apt) => {
    setModalMode('edit');
    setSelectedAppointment(apt);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleCancel = async (apt) => {
    if (!window.confirm(`Cancel appointment #${apt.appointment_id}?`)) return;
    try {
      await appointApi.cancel(apt.appointment_id);
      toast.success('Appointment cancelled');
      fetchAppointments();
    } catch (err) {
      toast.error(err.message || 'Failed to cancel appointment');
    }
  };

  const handleSendReminder = async (apt) => {
    try {
      const { data } = await notificationsApi.sendReminder(apt.appointment_id);
      toast.success(data.message || 'Reminder notification queued');
    } catch (err) {
      toast.error(err.message || 'Failed to send reminder');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      patient_id: parseInt(formData.get('patient_id'), 10),
      doctor_id: parseInt(formData.get('doctor_id'), 10),
      date_time: formData.get('date_time'),
      remarks: formData.get('remarks')?.trim() || null,
    };

    const errors = {};
    if (!payload.patient_id || isNaN(payload.patient_id)) errors.patient_id = 'Patient is required';
    if (!payload.doctor_id || isNaN(payload.doctor_id)) errors.doctor_id = 'Doctor is required';
    if (!payload.date_time) errors.date_time = 'Date and time are required';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (modalMode === 'book') {
        await appointApi.create(payload);
        toast.success('Appointment booked');
      } else {
        await appointApi.update(selectedAppointment.appointment_id, payload);
        toast.success('Appointment updated');
      }
      setModalOpen(false);
      fetchAppointments();
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error('Doctor is already booked at this time. Please choose another slot.');
      } else if (err.response?.data?.details) {
        const fieldErrors = {};
        err.response.data.details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setFormErrors(fieldErrors);
      } else {
        toast.error(err.message || 'Failed to save appointment');
      }
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const columns = [
    { key: 'patient', label: 'Patient', sortable: false, render: (_, row) => row.patient?.name || '—' },
    { key: 'doctor', label: 'Doctor', sortable: false, render: (_, row) => row.doctor?.name || '—' },
    { key: 'date_time', label: 'Date', sortable: false, render: (val) => formatDate(val) },
    { key: 'date_time', label: 'Time', sortable: false, render: (val) => formatTime(val) },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => (
        <span className={`badge badge-${val === 'scheduled' ? 'warning' : val === 'completed' ? 'success' : 'danger'}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'appointment_id',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          {canWrite && row.status !== 'cancelled' && (
            <>
              {row.status === 'scheduled' && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleSendReminder(row)}
                  type="button"
                  title="Send reminder to patient"
                >
                  Remind
                </button>
              )}
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => handleEdit(row)}
                type="button"
              >
                Edit
              </button>
              <button
                className="btn btn-danger btn-sm"
                onClick={() => handleCancel(row)}
                type="button"
              >
                Cancel
              </button>
            </>
          )}
          {isPatient && row.status === 'scheduled' && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleCancel(row)}
              type="button"
            >
              Cancel
            </button>
          )}
          {isPatient && row.status !== 'scheduled' && (
            <span className="text-sm text-muted">Read-only</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-6)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600 }}>
            {isPatient ? 'My Appointments & History' : 'Appointments'}
          </h2>
          <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
            {isPatient
              ? 'View your upcoming appointments and healthcare visit records'
              : 'Book, view, and manage clinic appointments'}
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={handleBook} type="button">
            + Book Appointment
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <div className="flex gap-4" style={{ flexWrap: 'wrap', gap: 'var(--space-4)' }}>
          <div className="form-group" style={{ minWidth: 160, marginBottom: 0 }}>
            <label className="form-label" htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              className="form-input"
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group" style={{ minWidth: 160, marginBottom: 0 }}>
            <label className="form-label" htmlFor="filter-date">Date</label>
            <input
              id="filter-date"
              type="date"
              className="form-input"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
            />
          </div>

          {user?.role === 'admin' && (
            <div className="form-group" style={{ minWidth: 160, marginBottom: 0 }}>
              <label className="form-label" htmlFor="filter-doctor">Doctor</label>
              <select
                id="filter-doctor"
                className="form-input"
                value={filters.doctor_id}
                onChange={(e) => handleFilterChange('doctor_id', e.target.value)}
                disabled={loadingDoctors}
              >
                <option value="">All Doctors</option>
                {doctors.map((doc) => (
                  <option key={doc.doctor_id} value={doc.doctor_id}>{doc.name}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ alignSelf: 'flex-end' }}>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFilters({ status: '', date: '', doctor_id: '' });
                setPage(1);
              }}
              type="button"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center" style={{ padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={appointments}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}

      <Modal
        isOpen={modalOpen}
        title={modalMode === 'book' ? 'Book New Appointment' : 'Edit Appointment'}
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="patient_id">Patient</label>
            <select
              id="patient_id"
              name="patient_id"
              className={`form-input ${formErrors.patient_id ? 'error' : ''}`}
              defaultValue={selectedAppointment?.patient_id || ''}
              disabled={loadingPatients}
              required
            >
              <option value="">Select a patient</option>
              {patients.map((p) => (
                <option key={p.patient_id} value={p.patient_id}>{p.name}</option>
              ))}
            </select>
            {formErrors.patient_id && <span className="form-error" role="alert">{formErrors.patient_id}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="doctor_id">Doctor</label>
            <select
              id="doctor_id"
              name="doctor_id"
              className={`form-input ${formErrors.doctor_id ? 'error' : ''}`}
              defaultValue={selectedAppointment?.doctor_id || ''}
              disabled={loadingDoctors}
              required
            >
              <option value="">Select a doctor</option>
              {doctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>{d.name} ({d.specialization})</option>
              ))}
            </select>
            {formErrors.doctor_id && <span className="form-error" role="alert">{formErrors.doctor_id}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="date_time">Date & Time</label>
            <input
              id="date_time"
              name="date_time"
              type="datetime-local"
              className={`form-input ${formErrors.date_time ? 'error' : ''}`}
              defaultValue={selectedAppointment?.date_time ? new Date(selectedAppointment.date_time).toISOString().slice(0, 16) : ''}
              required
            />
            {formErrors.date_time && <span className="form-error" role="alert">{formErrors.date_time}</span>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="remarks">Remarks</label>
            <textarea
              id="remarks"
              name="remarks"
              className="form-input"
              placeholder="Any notes for this appointment..."
              rows={3}
              defaultValue={selectedAppointment?.remarks || ''}
            />
          </div>

          <div className="flex justify-between" style={{ marginTop: 'var(--space-6)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {modalMode === 'book' ? 'Book Appointment' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
