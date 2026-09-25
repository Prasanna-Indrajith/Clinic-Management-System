import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientsApi, medicalRecordsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import styles from './PatientsPage.module.css';

export default function PatientsPage() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add'); // 'add' | 'edit'
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [formErrors, setFormErrors] = useState({});

  // Medical Records Modal State
  const [recordsModalOpen, setRecordsModalOpen] = useState(false);
  const [recordsPatient, setRecordsPatient] = useState(null);
  const [medicalRecords, setMedicalRecords] = useState([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [recordForm, setRecordForm] = useState({ diagnosis: '', prescription: '', notes: '' });
  const [savingRecord, setSavingRecord] = useState(false);

  const canWrite = user?.role === 'admin';
  const canAccessRecords = user?.role === 'admin' || user?.role === 'doctor';

  const fetchPatients = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const { data } = await patientsApi.list(params);
      setPatients(data.data || []);
      setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.message || 'Failed to load patients');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchPatients();
  }, [fetchPatients]);

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

    // Client-side validation
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

  const columns = [
    {
      key: 'name',
      label: 'Patient Name',
      sortable: true,
      render: (val) => (
        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
          {val}
        </span>
      ),
    },
    { key: 'dob', label: 'Date of Birth', sortable: true },
    { key: 'contact', label: 'Contact', sortable: true },
    {
      key: 'patient_id',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className={styles.actionGroup}>
          {canAccessRecords && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}
              onClick={() => handleViewRecords(row)}
              type="button"
              title="View & add medical records"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Records</span>
            </button>
          )}
          <button
            className={`${styles.actionBtn} ${styles.actionBtnGhost}`}
            onClick={() => handleEdit(row)}
            type="button"
            title="Edit patient profile"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            <span>Edit</span>
          </button>
          {canWrite && (
            <button
              className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
              onClick={() => handleDelete(row)}
              type="button"
              title="Delete patient"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              <span>Delete</span>
            </button>
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
          <h1 className={styles.headerTitle}>Patients</h1>
          <p className={styles.headerSubtitle}>
            Manage patient records — {user?.role === 'admin' ? 'full administrative CRUD access' : 'clinical directory view'}
          </p>
        </div>
        {canWrite && (
          <button className={`btn btn-primary ${styles.headerBtn}`} onClick={handleAdd} type="button">
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Patient</span>
          </button>
        )}
      </div>

      {/* ── Search Bar Card ───────────────────────────────────────────────── */}
      <div className={styles.searchCard}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={`form-input ${styles.searchInput}`}
            placeholder="Search patients by name, contact number, or ID..."
            value={search}
            onChange={handleSearch}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center" style={{ padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={patients}
          pagination={pagination}
          onPageChange={setPage}
        />
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
        <div style={{ maxHeight: '65vh', overflowY: 'auto', paddingRight: 'var(--space-2)' }}>
          {loadingRecords ? (
            <div className="flex justify-center items-center" style={{ padding: 'var(--space-8)' }}>
              <div className="spinner" style={{ width: 28, height: 28 }} />
            </div>
          ) : medicalRecords.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)', background: 'var(--color-surface-2)' }}>
              <p className="text-muted">No medical records recorded for this patient yet.</p>
            </div>
          ) : (
            <div className={styles.recordsList}>
              {medicalRecords.map((rec) => (
                <div key={rec.record_id} className={styles.recordCard}>
                  <div className={styles.recordHeader}>
                    <span className={styles.recordDiagnosis}>
                      {rec.diagnosis}
                    </span>
                    <span className={styles.recordDate}>
                      {new Date(rec.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="text-xs text-muted">
                    Attending Physician: Dr. {rec.doctor?.name || 'Staff Practitioner'}
                  </div>
                  {rec.prescription && (
                    <div>
                      <span className={styles.recordPrescription}>
                        Rx: {rec.prescription}
                      </span>
                    </div>
                  )}
                  {rec.notes && (
                    <p className={styles.recordNotes}>{rec.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {canAccessRecords && (
            <div className="card" style={{ marginTop: 'var(--space-4)', background: 'var(--color-surface-2)', padding: 'var(--space-4)' }}>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-3)', color: 'var(--color-text)' }}>
                Add New Clinical Entry
              </h4>
              <form onSubmit={handleAddRecord}>
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
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
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
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
                <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
                  <label className="form-label" htmlFor="record-notes">Clinical Notes</label>
                  <textarea
                    id="record-notes"
                    className="form-input"
                    rows={2}
                    placeholder="Additional clinical observations or follow-up instructions..."
                    value={recordForm.notes}
                    onChange={(e) => setRecordForm((prev) => ({ ...prev, notes: e.target.value }))}
                  />
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="btn btn-primary btn-sm" disabled={savingRecord}>
                    {savingRecord ? 'Saving...' : 'Add Record'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
