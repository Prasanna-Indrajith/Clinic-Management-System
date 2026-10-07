import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointApi, doctorsApi, patientsApi, notificationsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import styles from './AppointmentsPage.module.css';

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function AppointmentsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', date: '', doctor_id: '' });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('book');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const isPatient = user?.role === 'patient';
  const canWrite = user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'receptionist';
  const canBook = isPatient || canWrite;

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

  // Check doctor availability whenever modal is open and doctor/date are selected
  useEffect(() => {
    if (!modalOpen || !bookingDoctorId || !bookingDate) {
      setAvailabilitySlots([]);
      return;
    }
    let isCurrent = true;
    const fetchSlots = async () => {
      setLoadingAvailability(true);
      try {
        const { data } = await doctorsApi.getAvailability(bookingDoctorId, { date: bookingDate });
        if (isCurrent) {
          setAvailabilitySlots(data.slots || []);
        }
      } catch {
        if (isCurrent) {
          setAvailabilitySlots([]);
        }
      } finally {
        if (isCurrent) {
          setLoadingAvailability(false);
        }
      }
    };
    fetchSlots();
    return () => {
      isCurrent = false;
    };
  }, [modalOpen, bookingDoctorId, bookingDate]);

  // Support ?book=true query parameter to trigger booking modal from dashboard
  useEffect(() => {
    if (searchParams.get('book') === 'true') {
      handleBook();
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('book');
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams]);

  const handleBook = () => {
    setModalMode('book');
    setSelectedAppointment(null);
    setFormErrors({});
    setBookingDoctorId('');
    setBookingDate(new Date().toISOString().split('T')[0]);
    setSelectedSlot(null);
    setAvailabilitySlots([]);
    setModalOpen(true);
  };

  const handleEdit = (apt) => {
    setModalMode('edit');
    setSelectedAppointment(apt);
    setFormErrors({});
    setBookingDoctorId(apt.doctor_id ? String(apt.doctor_id) : '');
    setBookingDate(apt.date_time ? new Date(apt.date_time).toISOString().split('T')[0] : '');
    setSelectedSlot(null);
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
    const doctorId = parseInt(bookingDoctorId || formData.get('doctor_id'), 10);
    const remarks = formData.get('remarks')?.trim() || null;
    const dateTime = selectedSlot ? selectedSlot.dateTime : formData.get('date_time');

    const errors = {};
    if (!isPatient && modalMode === 'book') {
      const patientId = parseInt(formData.get('patient_id'), 10);
      if (!patientId || isNaN(patientId)) errors.patient_id = 'Patient is required';
    }
    if (!doctorId || isNaN(doctorId)) errors.doctor_id = 'Doctor is required';
    if (!dateTime) errors.date_time = 'Please select an available consultation slot';

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload = {
      doctor_id: doctorId,
      date_time: dateTime,
      remarks,
    };
    if (!isPatient && modalMode === 'book') {
      payload.patient_id = parseInt(formData.get('patient_id'), 10);
    }

    try {
      if (modalMode === 'book') {
        await appointApi.create(payload);
        toast.success('Appointment booked successfully!');
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'scheduled':
        return <span className={`${styles.statusBadge} ${styles.statusBadgeScheduled}`}>Scheduled</span>;
      case 'completed':
        return <span className={`${styles.statusBadge} ${styles.statusBadgeCompleted}`}>Completed</span>;
      case 'cancelled':
        return <span className={`${styles.statusBadge} ${styles.statusBadgeCancelled}`}>Cancelled</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  const columns = [
    {
      key: 'patient',
      label: 'Patient',
      sortable: false,
      render: (_, row) => (
        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
          {row.patient?.name || '—'}
        </span>
      ),
    },
    {
      key: 'doctor',
      label: 'Doctor',
      sortable: false,
      render: (_, row) => (
        <span style={{ color: 'var(--color-text-muted)' }}>
          {row.doctor?.name ? `Dr. ${row.doctor.name}` : '—'}
        </span>
      ),
    },
    { key: 'date_time', label: 'Date', sortable: false, render: (val) => formatDate(val) },
    {
      key: 'date_time',
      label: 'Time',
      sortable: false,
      render: (val) => <span className={styles.timePill}>{formatTime(val)}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val) => getStatusBadge(val),
    },
    {
      key: 'appointment_id',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className={styles.actionGroup}>
          {canWrite && row.status !== 'cancelled' && (
            <>
              {row.status === 'scheduled' && (
                <button
                  className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
                  onClick={() => handleSendReminder(row)}
                  type="button"
                  title="Send reminder to patient"
                >
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                  </svg>
                  <span>Remind</span>
                </button>
              )}
              <button
                className={`${styles.actionBtn} ${styles.actionBtnGhost}`}
                onClick={() => handleEdit(row)}
                type="button"
                title="Edit appointment details"
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Edit</span>
              </button>
              <button
                className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                onClick={() => handleCancel(row)}
                type="button"
                title="Cancel appointment"
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Cancel</span>
              </button>
            </>
          )}
          {isPatient && row.status === 'scheduled' && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => handleCancel(row)}
              type="button"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Cancel</span>
            </button>
          )}
          {isPatient && row.status !== 'scheduled' && (
            <span className="text-xs text-muted">Read-only</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>
            {isPatient ? 'My Appointments & History' : 'Appointments'}
          </h1>
          <p className={styles.headerSubtitle}>
            {isPatient
              ? 'View your upcoming appointments and healthcare visit records'
              : 'Book, manage, reschedule, and monitor clinical appointments'}
          </p>
        </div>
        {canBook && (
          <button className={`btn btn-primary ${styles.headerBtn}`} onClick={handleBook} type="button">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Book Appointment</span>
          </button>
        )}
      </div>

      {/* ── Filters Card ─────────────────────────────────────────────────── */}
      <div className={styles.filterCard}>
        <div className={styles.filterGrid}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="filter-status">Status</label>
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

          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="filter-date">Date</label>
            <input
              id="filter-date"
              type="date"
              className="form-input"
              value={filters.date}
              onChange={(e) => handleFilterChange('date', e.target.value)}
            />
          </div>

          {user?.role === 'admin' && (
            <div className={styles.filterGroup}>
              <label className={styles.filterLabel} htmlFor="filter-doctor">Doctor</label>
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
              className={styles.clearBtn}
              onClick={() => {
                setFilters({ status: '', date: '', doctor_id: '' });
                setPage(1);
              }}
              type="button"
            >
              <svg style={{ width: 12, height: 12, stroke: 'currentColor', fill: 'none', strokeWidth: 2 }} viewBox="0 0 24 24">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              <span>Reset Filters</span>
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

      {/* ── Booking / Edit Modal ─────────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        title={
          modalMode === 'book'
            ? isPatient
              ? 'Book a Consultation'
              : 'Book New Appointment'
            : 'Edit Appointment'
        }
        onClose={() => setModalOpen(false)}
        size="lg"
      >
        <form onSubmit={handleSubmit} noValidate className={styles.modalForm}>
          {/* Patient Card (if logged in as patient) or Patient Dropdown (if staff) */}
          {modalMode === 'book' && (
            <>
              {isPatient ? (
                <div className={styles.patientInfoBox}>
                  <div className={styles.patientAvatar}>
                    {user?.name ? user.name.slice(0, 2).toUpperCase() : 'PT'}
                  </div>
                  <div>
                    <div className={styles.patientName}>{user?.name}</div>
                    <div className={styles.patientMeta}>Personal Consultation • {user?.email}</div>
                  </div>
                </div>
              ) : (
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
              )}
            </>
          )}

          {/* Doctor Selection */}
          <div className="form-group">
            <label className="form-label" htmlFor="doctor_id">Doctor & Specialist</label>
            <select
              id="doctor_id"
              name="doctor_id"
              className={`form-input ${formErrors.doctor_id ? 'error' : ''}`}
              value={bookingDoctorId}
              onChange={(e) => {
                setBookingDoctorId(e.target.value);
                setSelectedSlot(null);
                setFormErrors((prev) => ({ ...prev, doctor_id: null }));
              }}
              disabled={loadingDoctors}
              required
            >
              <option value="">Choose a medical specialist...</option>
              {doctors.map((d) => (
                <option key={d.doctor_id} value={d.doctor_id}>
                  {d.name} — {d.specialization}
                </option>
              ))}
            </select>
            {formErrors.doctor_id && <span className="form-error" role="alert">{formErrors.doctor_id}</span>}
          </div>

          {/* Consultation Date */}
          <div className="form-group">
            <label className="form-label" htmlFor="booking_date">Appointment Date</label>
            <input
              id="booking_date"
              name="booking_date"
              type="date"
              className="form-input"
              min={new Date().toISOString().split('T')[0]}
              value={bookingDate}
              onChange={(e) => {
                setBookingDate(e.target.value);
                setSelectedSlot(null);
                setFormErrors((prev) => ({ ...prev, date_time: null }));
              }}
              required
            />
          </div>

          {/* Doctor Availability Slots Grid */}
          {bookingDoctorId && bookingDate ? (
            <div className={styles.availabilityBox}>
              <div className={styles.availabilityHeader}>
                <span className={styles.availabilityTitle}>
                  Doctor Availability Slots
                </span>
                <div className={styles.availabilityLegend}>
                  <span><span className={styles.legendDotAvailable} /> Available</span>
                  <span><span className={styles.legendDotBooked} /> Booked</span>
                </div>
              </div>

              {loadingAvailability ? (
                <div className={styles.availabilityLoading}>
                  <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                  <span>Checking doctor consultation availability...</span>
                </div>
              ) : availabilitySlots.length === 0 ? (
                <div className={styles.noSlotsMessage}>
                  No slot definitions found for this date.
                </div>
              ) : (
                <div className={styles.slotGrid}>
                  {availabilitySlots.map((slot) => {
                    const isSelected = selectedSlot?.dateTime === slot.dateTime;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!slot.available}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setFormErrors((prev) => ({ ...prev, date_time: null }));
                        }}
                        className={`${styles.slotBtn} ${
                          isSelected
                            ? styles.slotBtnSelected
                            : slot.available
                            ? styles.slotBtnAvailable
                            : styles.slotBtnBooked
                        }`}
                        title={slot.available ? `Book slot at ${slot.time}` : 'Booked / Unavailable'}
                      >
                        <span className={styles.slotTime}>{slot.time}</span>
                        <span className={styles.slotStatus}>
                          {slot.available ? (isSelected ? 'Selected' : 'Open') : 'Booked'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedSlot && (
                <div className={styles.selectedSlotNotice}>
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  <span>
                    Selected Slot: <strong>{selectedSlot.time}</strong> on <strong>{bookingDate}</strong>
                  </span>
                </div>
              )}

              {formErrors.date_time && (
                <span className="form-error" role="alert">{formErrors.date_time}</span>
              )}
            </div>
          ) : (
            <div className={styles.selectPrompt}>
              Select a doctor and appointment date to view available consultation slots.
            </div>
          )}

          {/* Fallback DateTime input for edit mode if rescheduling without slot picker */}
          {modalMode === 'edit' && !selectedSlot && (
            <div className="form-group">
              <label className="form-label" htmlFor="date_time">Or Custom Date & Time</label>
              <input
                id="date_time"
                name="date_time"
                type="datetime-local"
                className={`form-input ${formErrors.date_time ? 'error' : ''}`}
                defaultValue={selectedAppointment?.date_time ? new Date(selectedAppointment.date_time).toISOString().slice(0, 16) : ''}
              />
            </div>
          )}

          {/* Clinical Remarks */}
          <div className="form-group">
            <label className="form-label" htmlFor="remarks">Clinical Remarks / Symptoms</label>
            <textarea
              id="remarks"
              name="remarks"
              className="form-input"
              placeholder="Reason for consultation, current symptoms, or special clinical notes..."
              rows={3}
              defaultValue={selectedAppointment?.remarks || ''}
            />
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {modalMode === 'book' ? 'Confirm Appointment' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
