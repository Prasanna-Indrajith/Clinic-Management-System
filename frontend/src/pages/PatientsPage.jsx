import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientsApi, medicalRecordsApi } from '../api/client';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import styles from './PatientsPage.module.css';

const formatRecordDate = (rec) => {
  const scheduled = rec?.appointment?.date_time;
  if (scheduled) {
    const d = new Date(scheduled);
    if (!Number.isNaN(d.getTime())) {
      const dateStr = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return `${dateStr} · ${timeStr}`;
    }
  }
  if (rec?.record_date && /^\d{4}-\d{2}-\d{2}$/.test(rec.record_date)) {
    const [y, m, day] = rec.record_date.split('-').map(Number);
    const d = new Date(y, m - 1, day);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  const fallback = rec?.createdAt || rec?.created_at;
  if (fallback) {
    const d = new Date(fallback);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    }
  }
  return '—';
};

const splitPrescriptionLines = (text) => {
  if (!text) return [];
  return String(text)
    .split(/\n+|;\s*|,\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
};

export default function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Medical Records Modal State
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [recordsPatient, setRecordsPatient] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [showAddRecordForm, setShowAddRecordForm] = useState(false);
  const [recordForm, setRecordForm] = useState({ diagnosis: '', prescription: '', notes: '' });
  const [savingRecord, setSavingRecord] = useState(false);

  const canWrite = user?.role === 'admin' || user?.role === 'receptionist';
  const canDelete = user?.role === 'admin';
  const canAccessRecords = user?.role === 'admin' || user?.role === 'doctor';

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const { data } = await patientsApi.list(params);
      const pag = data.pagination || { page, limit: 10, total: 0, totalPages: 1 };
      setPatients(data.data || []);
      setPagination(pag);
      if (!search) {
        setTotalCount(pag.total || 0);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

  const sortedPatients = useMemo(() => {
    return [...patients].sort((a, b) => {
      const cmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        sensitivity: 'base',
      });
      return sortAsc ? cmp : -cmp;
    });
  }, [patients, sortAsc]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleAdd = () => {
    setModalMode('add');
    setSelectedPatient(null);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleEdit = (patient) => {
    setModalMode('edit');
    setSelectedPatient(patient);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleDelete = async (patient) => {
    if (!window.confirm(`Delete patient "${patient.name}"? This cannot be undone.`)) return;
    try {
      await patientsApi.delete(patient.patient_id);
      toast.success('Patient deleted');
      fetchPatients();
    } catch (err) {
      toast.error(err.message || 'Failed to delete patient');
    }
  };

  const handleViewRecords = async (patient) => {
    setRecordsPatient(patient);
    setRecordsModalOpen(true);
    setLoadingRecords(true);
    setShowAddRecordForm(false);
    setRecordForm({ diagnosis: '', prescription: '', notes: '' });
    try {
      const res = await medicalRecordsApi.list(patient.patient_id);
      setMedicalRecords(res.data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load medical records');
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleAddRecord = async (e) => {
    e.preventDefault();
    if (!recordForm.diagnosis.trim()) {
      toast.error('Diagnosis is required');
      return;
    }
    setSavingRecord(true);
    try {
      await medicalRecordsApi.create(recordsPatient.patient_id, {
        diagnosis: recordForm.diagnosis.trim(),
        prescription: recordForm.prescription.trim() || undefined,
        notes: recordForm.notes.trim() || undefined,
      });
      toast.success('Medical record added');
      setRecordForm({ diagnosis: '', prescription: '', notes: '' });
      setShowAddRecordForm(false);
      const res = await medicalRecordsApi.list(recordsPatient.patient_id);
      setMedicalRecords(res.data.data || []);
    } catch (err) {
      toast.error(err.message || 'Failed to add medical record');
    } finally {
      setSavingRecord(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      name: formData.get('name')?.trim(),
      dob: formData.get('dob')?.trim(),
      contact: formData.get('contact')?.trim(),
      address: formData.get('address')?.trim() || null,
      notes: formData.get('notes')?.trim() || null,
    };

    const errors = {};
    if (!payload.name) errors.name = 'Name is required';
    if (!payload.dob) errors.dob = 'Date of birth is required';
    if (!payload.contact) errors.contact = 'Contact is required';
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    try {
      if (modalMode === 'add') {
        await patientsApi.create(payload);
        toast.success('Patient created');
      } else {
        await patientsApi.update(selectedPatient.patient_id, payload);
        toast.success('Patient updated');
      }
      setModalOpen(false);
      fetchPatients();
    } catch (err) {
      if (err.response?.data?.details) {
        const fieldErrors = {};
        err.response.data.details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setFormErrors(fieldErrors);
      } else {
        toast.error(err.message || 'Failed to save patient');
      }
    }
  };

  const formatDob = (dob) => {
    if (!dob) return '—';
    if (/^\d{4}-\d{2}-\d{2}/.test(dob)) return dob.slice(0, 10);
    return dob;
  };

  return (
    <div className={styles.pageContainer}>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.headerTitle}>Patients</h1>
        {canWrite && (
          <button
            className={`btn btn-primary ${styles.headerActionBtn}`}
            onClick={handleAdd}
            type="button"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Patient</span>
          </button>
        )}
      </div>

      {/* ── Minimal Search & Sort Toolbar ────────────────────────────────── */}
      <div className={styles.toolbar}>
        <div className={styles.searchBar}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            aria-label="Search patients"
            className={styles.searchField}
            placeholder="Search by name, contact or ID"
            value={search}
            onChange={handleSearch}
          />
          {search && (
            <button
              type="button"
              className={styles.searchClearBtn}
              aria-label="Clear search"
              onClick={() => {
                setSearch('');
                setPage(1);
              }}
            >
              ×
            </button>
          )}
        </div>

        <button
          type="button"
          className={styles.sortBtn}
          onClick={() => setSortAsc((prev) => !prev)}
          aria-label={sortAsc ? 'Sort Z to A' : 'Sort A to Z'}
          title={sortAsc ? 'Sort Z–A' : 'Sort A–Z'}
        >
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M7 15l5 5 5-5" />
            <path d="M7 9l5-5 5 5" />
          </svg>
        </button>
      </div>

      {/* ── Minimal Patients List Card ───────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center" style={{ padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : sortedPatients.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No patients found</p>
          <p className={styles.emptySubtitle}>Try adjusting your search or add a new patient.</p>
        </div>
      ) : (
        <>
          <div className={styles.listCard}>
            <div className={styles.listHeader} role="row">
              <span className={styles.headerNameCol}>
                <span>Patient</span>
                <span className={styles.listCountPill} data-testid="patients-total-count">
                  {totalCount} {totalCount === 1 ? 'patient' : 'patients'}
                </span>
              </span>
              <span>Contact</span>
              <span className={styles.headerActionsCol}>Actions</span>
            </div>
            {sortedPatients.map((patient) => (
              <div key={patient.patient_id} className={styles.listRow}>
                <div className={styles.rowIdentity}>
                  <span className={styles.rowName}>{patient.name}</span>
                  <span className={styles.rowSubMeta}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" />
                      <line x1="8" y1="2" x2="8" y2="6" />
                      <line x1="3" y1="10" x2="21" y2="10" />
                    </svg>
                    <span>{formatDob(patient.dob)}</span>
                  </span>
                </div>

                <div className={styles.rowContact}>
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span className={patient.contact ? styles.contactValue : styles.contactMuted}>
                    {patient.contact || 'Pending update'}
                  </span>
                </div>

                <div className={styles.rowActions}>
                  {canAccessRecords && (
                    <button
                      className={`${styles.iconActionBtn} ${styles.iconActionAccent}`}
                      onClick={() => handleViewRecords(patient)}
                      type="button"
                      aria-label="Records"
                      title="View & add medical records"
                    >
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </button>
                  )}
                  {canWrite && (
                    <button
                      className={styles.iconActionBtn}
                      onClick={() => handleEdit(patient)}
                      type="button"
                      aria-label="Edit"
                      title="Edit patient profile"
                    >
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </button>
                  )}
                  {canDelete && (
                    <button
                      className={`${styles.iconActionBtn} ${styles.iconActionDanger}`}
                      onClick={() => handleDelete(patient)}
                      type="button"
                      aria-label="Delete"
                      title="Delete patient"
                    >
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
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

      {/* ── Add / Edit Patient Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={modalOpen}
        title={modalMode === 'add' ? 'Add New Patient' : 'Edit Patient'}
        onClose={() => setModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSubmit} noValidate className={styles.modalForm}>
          <div className="form-group">
            <label className="form-label" htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              className={`form-input ${formErrors.name ? 'error' : ''}`}
              placeholder="e.g. John Doe"
              defaultValue={selectedPatient?.name || ''}
              required
            />
            {formErrors.name && <span className="form-error" role="alert">{formErrors.name}</span>}
          </div>

          <div className={styles.modalGrid}>
            <div className="form-group">
              <label className="form-label" htmlFor="dob">Date of Birth</label>
              <input
                id="dob"
                name="dob"
                type="date"
                className={`form-input ${formErrors.dob ? 'error' : ''}`}
                defaultValue={selectedPatient?.dob ? new Date(selectedPatient.dob).toISOString().split('T')[0] : ''}
                required
              />
              {formErrors.dob && <span className="form-error" role="alert">{formErrors.dob}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="contact">Contact Number</label>
              <input
                id="contact"
                name="contact"
                type="tel"
                className={`form-input ${formErrors.contact ? 'error' : ''}`}
                placeholder="e.g. 555-1234"
                defaultValue={selectedPatient?.contact || ''}
                required
              />
              {formErrors.contact && <span className="form-error" role="alert">{formErrors.contact}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="address">Address</label>
            <textarea
              id="address"
              name="address"
              className="form-input"
              placeholder="Street address (optional)"
              rows={2}
              defaultValue={selectedPatient?.address || ''}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="notes">Clinical Notes</label>
            <textarea
              id="notes"
              name="notes"
              className="form-input"
              placeholder="Allergies, chronic conditions, or background notes..."
              rows={3}
              defaultValue={selectedPatient?.notes || ''}
            />
          </div>

          <div className={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {modalMode === 'add' ? 'Create Patient Record' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ── Medical Records Modal ────────────────────────────────────────── */}
      <Modal
        isOpen={recordsModalOpen}
        title={`Medical Records — ${recordsPatient?.name || 'Patient'}`}
        onClose={() => setRecordsModalOpen(false)}
        size="lg"
      >
        <div className={styles.recordsModalBody}>
          {/* Patient Summary Bar + Toggle Add Entry */}
          <div className={styles.recordsSummaryBar}>
            <div className={styles.recordsMetaChips}>
              {recordsPatient?.dob && (
                <span className={styles.recordsMetaItem}>
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                  <span>DOB: {formatDob(recordsPatient.dob)}</span>
                </span>
              )}
              {recordsPatient?.contact && (
                <span className={styles.recordsMetaItem}>
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span>{recordsPatient.contact}</span>
                </span>
              )}
              <span className={styles.recordsCountTag}>
                {medicalRecords.length} {medicalRecords.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>

            {canAccessRecords && (
              <button
                type="button"
                className={showAddRecordForm ? styles.recordToggleBtnGhost : styles.recordToggleBtn}
                onClick={() => setShowAddRecordForm((prev) => !prev)}
              >
                {showAddRecordForm ? (
                  <span>Close Form</span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="5" x2="12" y2="19" />
                      <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    <span>New Entry</span>
                  </>
                )}
              </button>
            )}
          </div>

          {/* Collapsible Add Clinical Entry Form */}
          {canAccessRecords && showAddRecordForm && (
            <form onSubmit={handleAddRecord} className={styles.addRecordForm}>
              <div className={styles.addRecordHeader}>Add New Clinical Entry</div>
              <div className="form-group">
                <label className="form-label" htmlFor="record-diagnosis">Diagnosis *</label>
                <input
                  id="record-diagnosis"
                  className="form-input"
                  placeholder="e.g. Acute bronchitis, Hypertension stage 1"
                  value={recordForm.diagnosis}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, diagnosis: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="record-prescription">Prescription</label>
                <textarea
                  id="record-prescription"
                  className="form-input"
                  rows={2}
                  placeholder="e.g. Amoxicillin 500mg tid x 7 days"
                  value={recordForm.prescription}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, prescription: e.target.value }))}
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="record-notes">Clinical Notes</label>
                <textarea
                  id="record-notes"
                  className="form-input"
                  rows={2}
                  placeholder="Observations or follow-up instructions..."
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              <div className={styles.addRecordActions}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowAddRecordForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm" disabled={savingRecord}>
                  {savingRecord ? 'Saving...' : 'Save Entry'}
                </button>
              </div>
            </form>
          )}

          {/* Records Timeline List */}
          {loadingRecords ? (
            <div className="flex justify-center items-center" style={{ padding: 'var(--space-10)' }}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : medicalRecords.length === 0 ? (
            <div className={styles.recordsEmpty}>
              <p className={styles.recordsEmptyTitle}>No medical records yet</p>
              <p className={styles.recordsEmptySub}>
                Completed consultations and manual clinical entries will appear here.
              </p>
            </div>
          ) : (
            <div className={styles.recordsList}>
              {medicalRecords.map((rec) => {
                const rxLines = splitPrescriptionLines(rec.prescription);
                return (
                  <article key={rec.record_id} className={styles.recordItem}>
                    <div className={styles.recordTopRow}>
                      <div className={styles.recordTitleBlock}>
                        <h4 className={styles.recordDiagnosis}>{rec.diagnosis}</h4>
                        <div className={styles.recordDoctorRow}>
                          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                          </svg>
                          <span>{rec.doctor?.name || 'Staff Practitioner'}</span>
                        </div>
                      </div>
                      <span className={styles.recordDateText}>
                        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                          <line x1="16" y1="2" x2="16" y2="6" />
                          <line x1="8" y1="2" x2="8" y2="6" />
                          <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        <span>{formatRecordDate(rec)}</span>
                      </span>
                    </div>

                    {rxLines.length > 0 && (
                      <div className={styles.recordDetailRow}>
                        <svg
                          className={styles.rxIcon}
                          viewBox="0 0 24 24"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                          <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
                        </svg>
                        <div className={styles.rxLines}>
                          {rxLines.map((line, idx) => (
                            <div key={idx} className={styles.rxLine}>{line}</div>
                          ))}
                        </div>
                      </div>
                    )}

                    {rec.notes && (
                      <div className={styles.recordDetailRow}>
                        <svg
                          className={styles.notesIcon}
                          viewBox="0 0 24 24"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                        <p className={styles.recordNotes}>{rec.notes}</p>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
