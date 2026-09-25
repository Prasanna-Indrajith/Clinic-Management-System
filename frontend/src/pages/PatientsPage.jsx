import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { patientsApi, medicalRecordsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';


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
    { key: 'name', label: 'Name', sortable: true },
    { key: 'dob', label: 'DOB', sortable: true },
    { key: 'contact', label: 'Contact', sortable: true },
    {
      key: 'patient_id',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          {canAccessRecords && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleViewRecords(row)}
              type="button"
            >
              Records
            </button>
          )}
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => handleEdit(row)}
            type="button"
          >
            Edit
          </button>
          {canWrite && (
            <button
              className="btn btn-danger btn-sm"
              onClick={() => handleDelete(row)}
              type="button"
            >
              Delete
            </button>
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
            Patients
          </h2>
          <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
            Manage patient records — {user?.role === 'admin' ? 'full CRUD access' : 'read-only view'}
          </p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={handleAdd} type="button">
            + Add Patient
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search patients by name or contact..."
          value={search}
          onChange={handleSearch}
        />
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

      <Modal
        isOpen={modalOpen}
        title={modalMode === 'add' ? 'Add New Patient' : 'Edit Patient'}
        onClose={() => setModalOpen(false)}
        size="md"
      >
        <form onSubmit={handleSubmit} noValidate>
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

          <div className="form-group">
            <label className="form-label" htmlFor="address">Address</label>
            <textarea
              id="address"
              name="address"
              className="form-input"
              placeholder="Street address (optional)"
              rows={3}
              defaultValue={selectedPatient?.address || ''}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="notes">Notes</label>
            <textarea
              id="notes"
              name="notes"
              className="form-input"
              placeholder="Medical notes (optional)"
              rows={3}
              defaultValue={selectedPatient?.notes || ''}
            />
          </div>

          <div className="flex justify-between" style={{ marginTop: 'var(--space-6)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {modalMode === 'add' ? 'Create Patient' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Medical Records Modal */}
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
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)', background: 'var(--color-bg-subtle)' }}>
              <p className="text-muted">No medical records recorded for this patient yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
              {medicalRecords.map((rec) => (
                <div
                  key={rec.record_id}
                  className="card"
                  style={{
                    padding: 'var(--space-4)',
                    borderLeft: '4px solid var(--color-primary)',
                    background: 'var(--color-surface)',
                  }}
                >
                  <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
                      Dr. {rec.doctor?.name || 'Practitioner'}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(rec.created_at).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                  <div style={{ marginBottom: 'var(--space-2)' }}>
                    <span className="text-xs font-semibold text-muted uppercase">Diagnosis:</span>
                    <p style={{ marginTop: '2px', fontWeight: 500 }}>{rec.diagnosis}</p>
                  </div>
                  {rec.prescription && (
                    <div style={{ marginBottom: 'var(--space-2)' }}>
                      <span className="text-xs font-semibold text-muted uppercase">Prescription:</span>
                      <p style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>{rec.prescription}</p>
                    </div>
                  )}
                  {rec.notes && (
                    <div>
                      <span className="text-xs font-semibold text-muted uppercase">Notes:</span>
                      <p className="text-muted text-sm" style={{ marginTop: '2px', whiteSpace: 'pre-wrap' }}>{rec.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {canAccessRecords && (
            <div className="card" style={{ marginTop: 'var(--space-4)', background: 'var(--color-bg-subtle)', padding: 'var(--space-4)' }}>
              <h4 style={{ fontSize: 'var(--text-md)', fontWeight: 600, marginBottom: 'var(--space-3)' }}>
                Add Clinical Entry
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
