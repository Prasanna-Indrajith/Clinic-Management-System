import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointApi, doctorsApi, patientsApi } from '../api/client';
import Modal from '../components/ui/Modal';
import AppointmentReportModal from '../components/appointments/AppointmentReportModal';
import toast from 'react-hot-toast';
import styles from './AppointmentsPage.module.css';

const RANGE_OPTIONS = [
  { value: 'upcoming', label: 'Today & Upcoming' },
  { value: 'today', label: 'Today Only' },
  { value: 'all', label: 'All Dates (History)' },
];

const getLocalDateString = (dateInput = new Date()) => {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getLocalDateTimeInputValue = (dateInput) => {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${getLocalDateString(d)}T${hours}:${minutes}`;
};

const getLocalStartOfDayISO = (dateStr) => {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
};

export default function AppointmentsPage({ mode = 'default' }) {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', range: 'upcoming', date: '', doctor_id: '', search: '' });
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [reportAppointment, setReportAppointment] = useState(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('book');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  const [bookingDoctorId, setBookingDoctorId] = useState('');
  const [bookingDate, setBookingDate] = useState(() => getLocalDateString());
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState(null);

  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loadingDoctors, setLoadingDoctors] = useState(false);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const [finishModalOpen, setFinishModalOpen] = useState(false);
  const [finishAppointment, setFinishAppointment] = useState(null);
  const [clinicalForm, setClinicalForm] = useState({ diagnosis: '', prescription: '', notes: '' });
  const [clinicalErrors, setClinicalErrors] = useState({});
  const [finishingAppointment, setFinishingAppointment] = useState(false);

  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';
  const isHistory = isPatient && mode === 'history';
  const canWrite = user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'receptionist';
  const canBook = isPatient || canWrite;

  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current === mode) return;
    prevModeRef.current = mode;
    setFilters({ status: '', range: 'upcoming', date: '', doctor_id: '', search: '' });
    setSearchInput('');
    setShowFilters(false);
    setPage(1);
  }, [mode]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (isHistory) {
        params.status = filters.status || 'completed,cancelled';
        params.sortBy = 'date_time';
        params.sortDir = 'desc';
        if (filters.date) {
          params.date = filters.date;
          params.tzOffset = new Date().getTimezoneOffset();
        }
      } else if (isPatient) {
        if (filters.status) params.status = filters.status;
        params.startDate = getLocalStartOfDayISO(getLocalDateString());
      } else {
        if (filters.status) params.status = filters.status;
        if (filters.date) {
          params.date = filters.date;
          params.tzOffset = new Date().getTimezoneOffset();
        } else if (filters.range === 'today') {
          params.date = getLocalDateString();
          params.tzOffset = new Date().getTimezoneOffset();
        } else if (filters.range === 'upcoming') {
          params.startDate = getLocalStartOfDayISO(getLocalDateString());
        }
        if (filters.doctor_id) params.doctor_id = filters.doctor_id;
      }
      if (filters.search) params.search = filters.search;
      const { data } = await appointApi.list(params);
      setAppointments(data.data || []);
      setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.message || 'Failed to load appointments');
    } finally {
      setLoading(false);
    }
  }, [page, filters, isHistory, isPatient]);

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
    if (user?.role === 'admin' || user?.role === 'receptionist') {
      fetchDoctors();
    }
  }, [user?.role, fetchDoctors]);

  useEffect(() => {
    if (modalOpen && (modalMode === 'book' || modalMode === 'edit')) {
      fetchDoctors();
      fetchPatients();
    }
  }, [modalOpen, modalMode, fetchDoctors, fetchPatients]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
      ...(field === 'range' ? { date: '' } : {}),
    }));
    setPage(1);
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
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
        const { data } = await doctorsApi.getAvailability(bookingDoctorId, {
          date: bookingDate,
          tzOffset: new Date().getTimezoneOffset(),
        });
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
    setBookingDate(getLocalDateString());
    setSelectedSlot(null);
    setAvailabilitySlots([]);
    setModalOpen(true);
  };

  const handleEdit = (apt) => {
    setModalMode('edit');
    setSelectedAppointment(apt);
    setFormErrors({});
    setBookingDoctorId(apt.doctor_id ? String(apt.doctor_id) : '');
    setBookingDate(apt.date_time ? getLocalDateString(apt.date_time) : '');
    setSelectedSlot(null);
    setModalOpen(true);
  };

  const handleFinish = (apt) => {
    setFinishAppointment(apt);
    setClinicalForm({ diagnosis: '', prescription: '', notes: '' });
    setClinicalErrors({});
    setFinishModalOpen(true);
  };

  const handleConfirmFinish = async (e) => {
    e.preventDefault();
    const diagnosis = clinicalForm.diagnosis.trim();
    if (!diagnosis) {
      setClinicalErrors({ diagnosis: 'Diagnosis is required' });
      toast.error('Diagnosis is required');
      return;
    }

    setClinicalErrors({});
    setFinishingAppointment(true);
    try {
      await appointApi.complete(finishAppointment.appointment_id, {
        diagnosis,
        prescription: clinicalForm.prescription.trim() || undefined,
        notes: clinicalForm.notes.trim() || undefined,
      });
      toast.success('Appointment completed and clinical entry added');
      setFinishModalOpen(false);
      setFinishAppointment(null);
      fetchAppointments();
    } catch (err) {
      if (err.response?.data?.details) {
        const fieldErrors = {};
        err.response.data.details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setClinicalErrors(fieldErrors);
      } else {
        toast.error(err.message || 'Failed to complete appointment');
      }
    } finally {
      setFinishingAppointment(false);
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const doctorId = parseInt(bookingDoctorId || formData.get('doctor_id'), 10);
    const remarks = formData.get('remarks')?.trim() || null;
    const rawDateTime = selectedSlot ? selectedSlot.dateTime : formData.get('date_time');
    const dateTime = selectedSlot
      ? selectedSlot.dateTime
      : rawDateTime
      ? new Date(rawDateTime).toISOString()
      : '';

    const errors = {};
    if (!isPatient && modalMode === 'book') {
      const patientId = parseInt(formData.get('patient_id'), 10);
      if (!patientId || isNaN(patientId)) errors.patient_id = 'Patient is required';
    }
    if (!doctorId || isNaN(doctorId)) errors.doctor_id = 'Doctor is required';
    if (!dateTime) {
      errors.date_time = 'Please select an available consultation slot';
    } else if (modalMode === 'book' && new Date(dateTime).getTime() <= Date.now()) {
      errors.date_time = 'Selected consultation time has already passed. Please choose an upcoming slot.';
    }

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
    const statusValue = formData.get('status');
    if (modalMode === 'edit' && canWrite && statusValue) {
      payload.status = statusValue;
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
      ...(isHistory ? { year: 'numeric' } : {}),
    });
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'completed':
        return (
          <span className={`${styles.statusBadge} ${styles.statusBadgeCompleted}`}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className={`${styles.statusBadge} ${styles.statusBadgeCancelled}`}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>Cancelled</span>
          </span>
        );
      default:
        return (
          <span className={`${styles.statusBadge} ${styles.statusBadgeScheduled}`}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            <span>Scheduled</span>
          </span>
        );
    }
  };

  const hasExtraFilters = Boolean(filters.date || filters.doctor_id || filters.range !== 'upcoming');

  return (
    <div className={styles.pageContainer}>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.headerTitle}>
          {isHistory ? 'Appointment History' : isPatient ? 'My Appointments' : 'Appointments'}
        </h1>
        {canBook && !isHistory && (
          <button
            className={`btn btn-primary ${styles.headerActionBtn}`}
            onClick={handleBook}
            type="button"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{isPatient ? 'Book Appointment' : 'New Appointment'}</span>
          </button>
        )}
      </div>

      {/* ── Search & Quick Status Toolbar ────────────────────────────────── */}
      <div className={styles.toolbar}>
        <form className={styles.searchBar} onSubmit={handleSearchSubmit}>
          <button
            type="submit"
            className={styles.searchIconBtn}
            aria-label="Search"
            title="Search"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
          <input
            id="filter-search"
            aria-label="Search appointments"
            type="text"
            className={styles.searchField}
            placeholder={isPatient ? 'Search doctor' : 'Search patient or doctor'}
            value={searchInput}
            onChange={(e) => {
              const val = e.target.value;
              setSearchInput(val);
              if (val === '' && filters.search !== '') {
                setFilters((prev) => ({ ...prev, search: '' }));
                setPage(1);
              }
            }}
          />
          {searchInput && (
            <button
              type="button"
              className={styles.searchClearBtn}
              aria-label="Clear search"
              onClick={() => {
                setSearchInput('');
                setFilters((prev) => ({ ...prev, search: '' }));
                setPage(1);
              }}
            >
              ×
            </button>
          )}
        </form>

        <div className={styles.toolbarRight}>
          <div className={styles.statusSegment} role="group" aria-label="Filter by status">
            <button
              type="button"
              className={`${styles.segmentBtn} ${filters.status === '' ? styles.segmentBtnActive : ''}`}
              onClick={() => handleFilterChange('status', '')}
              aria-label="All Statuses"
              title="All Statuses"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
              </svg>
            </button>
            {!isHistory && (
              <button
                type="button"
                className={`${styles.segmentBtn} ${filters.status === 'scheduled' ? styles.segmentBtnActive : ''}`}
                onClick={() => handleFilterChange('status', 'scheduled')}
                aria-label="Scheduled"
                title="Scheduled"
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <polyline points="12 7 12 12 15 14" />
                </svg>
                <span className={styles.segmentLabel}>Scheduled</span>
              </button>
            )}
            <button
              type="button"
              className={`${styles.segmentBtn} ${filters.status === 'completed' ? styles.segmentBtnActive : ''}`}
              onClick={() => handleFilterChange('status', 'completed')}
              aria-label="Completed"
              title="Completed"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9" />
                <polyline points="9 12 11 14 15 10" />
              </svg>
              <span className={styles.segmentLabel}>Completed</span>
            </button>
            <button
              type="button"
              className={`${styles.segmentBtn} ${filters.status === 'cancelled' ? styles.segmentBtnActive : ''}`}
              onClick={() => handleFilterChange('status', 'cancelled')}
              aria-label="Cancelled"
              title="Cancelled"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="16" y1="8" x2="8" y2="16" />
                <line x1="8" y1="8" x2="16" y2="16" />
              </svg>
              <span className={styles.segmentLabel}>Cancelled</span>
            </button>
          </div>

          {isHistory && (
            <div className={styles.historyDateWrap}>
              <input
                id="history-filter-date"
                type="date"
                aria-label="Filter history by date"
                className={styles.historyDateInput}
                value={filters.date}
                onChange={(e) => handleFilterChange('date', e.target.value)}
              />
              {filters.date && (
                <button
                  type="button"
                  className={styles.historyDateClear}
                  aria-label="Clear date filter"
                  title="Clear date filter"
                  onClick={() => handleFilterChange('date', '')}
                >
                  ×
                </button>
              )}
            </div>
          )}

          {!isPatient && (
            <button
              type="button"
              className={`${styles.filterToggleBtn} ${showFilters ? styles.filterToggleBtnActive : ''}`}
              onClick={() => setShowFilters((prev) => !prev)}
              aria-label="Filters"
              aria-expanded={showFilters}
              title="More Filters"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              {hasExtraFilters && <span className={styles.filterDot} aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>

      {/* ── Collapsible Secondary Filters Drawer (Staff Only) ────────────── */}
      {!isPatient && showFilters && (
        <div className={styles.filterDrawer}>
          <div className={styles.filterGroup}>
            <label className={styles.filterLabel} htmlFor="filter-range">Schedule</label>
            <select
              id="filter-range"
              className="form-input"
              value={filters.date ? '' : filters.range}
              onChange={(e) => handleFilterChange('range', e.target.value)}
            >
              {filters.date && <option value="">Selected Date</option>}
              {RANGE_OPTIONS.map((opt) => (
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

          {(user?.role === 'admin' || user?.role === 'receptionist') && (
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

          <div className={styles.filterAction}>
            <button
              className={styles.clearBtn}
              onClick={() => {
                setSearchInput('');
                setFilters({ status: '', range: 'upcoming', date: '', doctor_id: '', search: '' });
                setPage(1);
              }}
              type="button"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
              <span>Reset Filters</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Appointments List Card ───────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center" style={{ padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : appointments.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>
            {isHistory ? 'No appointment history found' : 'No appointments found'}
          </p>
          <p className={styles.emptySubtitle}>
            {isHistory
              ? 'Completed and cancelled consultations will appear here.'
              : 'Try adjusting your filters or book a new appointment.'}
          </p>
        </div>
      ) : (
        <>
          <div className={styles.listCard}>
            <div className={styles.listHeader} role="row">
              <span>Time</span>
              <span>Date</span>
              <span>{isPatient ? 'Doctor' : 'Patient'}</span>
              <span>{isPatient ? 'Specialty' : 'Doctor'}</span>
              <span>Status</span>
              <span className={styles.headerActionsCol}>Actions</span>
            </div>
            {appointments.map((row) => (
              <div key={row.appointment_id} className={styles.listRow}>
                <div className={styles.colTime}>{formatTime(row.date_time)}</div>

                <div className={styles.colDate}>{formatDate(row.date_time)}</div>

                <div className={styles.colPrimary}>
                  {isPatient
                    ? row.doctor?.name || 'Physician'
                    : row.patient?.name || '—'}
                </div>

                <div className={styles.colSecondary}>
                  {isPatient
                    ? row.doctor?.specialization || 'Consultation'
                    : row.doctor?.name || '—'}
                </div>

                <div className={styles.rowStatus}>{renderStatusBadge(row.status)}</div>

                <div className={styles.rowActions}>
                  {canWrite && row.status !== 'cancelled' && (
                    <>
                      {isDoctor && row.status === 'scheduled' && (
                        <button
                          className={`${styles.iconActionBtn} ${styles.iconActionSuccess}`}
                          onClick={() => handleFinish(row)}
                          type="button"
                          aria-label="Finish"
                          title="Finish appointment and add clinical entry"
                        >
                          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </button>
                      )}
                      {row.status === 'completed' &&
                        (isDoctor || user?.role === 'admin' || user?.role === 'receptionist') && (
                          <button
                            className={`${styles.iconActionBtn} ${styles.iconActionAccent}`}
                            onClick={() => setReportAppointment(row)}
                            type="button"
                            aria-label="View Report"
                            title="View consultation report"
                          >
                            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                              <line x1="16" y1="13" x2="8" y2="13" />
                              <line x1="16" y1="17" x2="8" y2="17" />
                            </svg>
                          </button>
                        )}
                      <button
                        className={styles.iconActionBtn}
                        onClick={() => handleEdit(row)}
                        type="button"
                        aria-label="Edit"
                        title="Edit appointment details"
                      >
                        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                      </button>
                      {row.status === 'scheduled' && (
                        <button
                          className={`${styles.iconActionBtn} ${styles.iconActionDanger}`}
                          onClick={() => handleCancel(row)}
                          type="button"
                          aria-label="Cancel"
                          title="Cancel appointment"
                        >
                          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      )}
                    </>
                  )}
                  {isPatient && row.status === 'scheduled' && (
                    <button
                      className={`${styles.iconActionBtn} ${styles.iconActionDanger}`}
                      onClick={() => handleCancel(row)}
                      type="button"
                      aria-label="Cancel"
                      title="Cancel appointment"
                    >
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                  {isPatient && row.status === 'completed' && (
                    <button
                      className={`${styles.iconActionBtn} ${styles.iconActionAccent}`}
                      onClick={() => setReportAppointment(row)}
                      type="button"
                      aria-label="View Report"
                      title="View consultation report"
                    >
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {pagination.totalPages > 1 && (
            <div className={styles.paginationBar}>
              <button
                type="button"
                className={styles.pageIconBtn}
                onClick={() => setPage(page - 1)}
                disabled={page <= 1}
                aria-label="Previous page"
                title="Previous page"
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
              <span className="pagination-info">
                {pagination.page || page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                className={styles.pageIconBtn}
                onClick={() => setPage(page + 1)}
                disabled={page >= pagination.totalPages}
                aria-label="Next page"
                title="Next page"
              >
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          )}
        </>
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
              min={getLocalDateString()}
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
                  <span><span className={styles.legendDotPast} /> Passed</span>
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
                    const isPast = slot.reason === 'Past' || new Date(slot.dateTime).getTime() <= Date.now();
                    const isAvailable = Boolean(slot.available) && !isPast;
                    const slotStatusLabel = isSelected
                      ? 'Selected'
                      : !slot.available && slot.reason !== 'Past'
                      ? 'Booked'
                      : isPast
                      ? 'Passed'
                      : 'Open';
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={!isAvailable}
                        onClick={() => {
                          setSelectedSlot(slot);
                          setFormErrors((prev) => ({ ...prev, date_time: null }));
                        }}
                        className={`${styles.slotBtn} ${
                          isSelected
                            ? styles.slotBtnSelected
                            : isAvailable
                            ? styles.slotBtnAvailable
                            : styles.slotBtnBooked
                        }`}
                        title={
                          isAvailable
                            ? `Book slot at ${slot.time}`
                            : isPast
                            ? `Time ${slot.time} has already passed`
                            : 'Booked / Unavailable'
                        }
                      >
                        <span className={styles.slotTime}>{slot.time}</span>
                        <span className={styles.slotStatus}>{slotStatusLabel}</span>
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
                defaultValue={getLocalDateTimeInputValue(selectedAppointment?.date_time)}
              />
            </div>
          )}

          {modalMode === 'edit' && canWrite && selectedAppointment?.status !== 'completed' && (
            <div className="form-group">
              <label className="form-label" htmlFor="status">Appointment Status</label>
              <select
                id="status"
                name="status"
                className="form-input"
                defaultValue={selectedAppointment?.status || 'scheduled'}
              >
                <option value="scheduled">Scheduled</option>
                <option value="cancelled">Cancelled</option>
              </select>
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

      {/* ── Finish Appointment & Add New Clinical Entry Modal (Doctor Only) ─ */}
      <Modal
        isOpen={finishModalOpen}
        title={`Finish Appointment — ${finishAppointment?.patient?.name || 'Patient'}`}
        onClose={() => setFinishModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleConfirmFinish} noValidate className={styles.modalForm}>
          {finishAppointment && (
            <div className={styles.patientInfoBox}>
              <div className={styles.patientAvatar}>
                {finishAppointment.patient?.name
                  ? finishAppointment.patient.name.slice(0, 2).toUpperCase()
                  : 'PT'}
              </div>
              <div>
                <div className={styles.patientName}>{finishAppointment.patient?.name || 'Patient'}</div>
                <div className={styles.patientMeta}>
                  {formatDate(finishAppointment.date_time)} at {formatTime(finishAppointment.date_time)} • Appointment #{finishAppointment.appointment_id}
                </div>
              </div>
            </div>
          )}

          <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, margin: 0, color: 'var(--color-text)' }}>
            Add New Clinical Entry
          </h4>

          <div className="form-group">
            <label className="form-label" htmlFor="finish-diagnosis">Diagnosis *</label>
            <input
              id="finish-diagnosis"
              className={`form-input ${clinicalErrors.diagnosis ? 'error' : ''}`}
              placeholder="e.g. Acute bronchitis, Hypertension stage 1"
              value={clinicalForm.diagnosis}
              onChange={(e) => {
                setClinicalForm((prev) => ({ ...prev, diagnosis: e.target.value }));
                setClinicalErrors((prev) => ({ ...prev, diagnosis: null }));
              }}
              required
            />
            {clinicalErrors.diagnosis && (
              <span className="form-error" role="alert">{clinicalErrors.diagnosis}</span>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="finish-prescription">Prescription</label>
            <textarea
              id="finish-prescription"
              className="form-input"
              rows={2}
              placeholder="e.g. Amoxicillin 500mg tid x 7 days"
              value={clinicalForm.prescription}
              onChange={(e) => setClinicalForm((prev) => ({ ...prev, prescription: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="finish-notes">Clinical Notes</label>
            <textarea
              id="finish-notes"
              className="form-input"
              rows={2}
              placeholder="Additional clinical observations or follow-up instructions..."
              value={clinicalForm.notes}
              onChange={(e) => setClinicalForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>

          <div className={styles.modalFooter}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFinishModalOpen(false)}
              disabled={finishingAppointment}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={finishingAppointment}>
              {finishingAppointment ? 'Saving...' : 'Finish & Save Clinical Entry'}
            </button>
          </div>
        </form>
      </Modal>

      <AppointmentReportModal
        isOpen={Boolean(reportAppointment)}
        appointment={reportAppointment}
        onClose={() => setReportAppointment(null)}
      />
    </div>
  );
}
