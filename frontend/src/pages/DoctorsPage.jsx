import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { doctorsApi } from '../api/client';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import styles from './DoctorsPage.module.css';

export default function DoctorsPage() {
  const { user } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [totalCount, setTotalCount] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const canWrite = user?.role === 'admin' || user?.role === 'receptionist';
  const canDelete = user?.role === 'admin';

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const { data } = await doctorsApi.list(params);
      const pag = data.pagination || { page, limit: 10, total: 0, totalPages: 1 };
      setDoctors(data.data || []);
      setPagination(pag);
      if (!search) {
        setTotalCount(pag.total || 0);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const sortedDoctors = useMemo(() => {
    return [...doctors].sort((a, b) => {
      const cmp = String(a.name || '').localeCompare(String(b.name || ''), undefined, {
        sensitivity: 'base',
      });
      return sortAsc ? cmp : -cmp;
    });
  }, [doctors, sortAsc]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const handleAdd = () => {
    setModalMode('add');
    setSelectedDoctor(null);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleEdit = (doctor) => {
    setModalMode('edit');
    setSelectedDoctor(doctor);
    setFormErrors({});
    setModalOpen(true);
  };

  const handleDelete = async (doctor) => {
    if (!window.confirm(`Delete doctor "${doctor.name}"? This cannot be undone.`)) return;
    try {
      await doctorsApi.delete(doctor.doctor_id);
      toast.success('Doctor deleted');
      fetchDoctors();
    } catch (err) {
      toast.error(err.message || 'Failed to delete doctor');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const payload = {
      name: formData.get('name')?.trim(),
      specialization: formData.get('specialization')?.trim(),
      contact: formData.get('contact')?.trim(),
      email: formData.get('email')?.trim(),
    };
    const password = formData.get('password')?.trim();
    if (modalMode === 'add' && password) {
      payload.password = password;
    }

    const errors = {};
    if (!payload.name) errors.name = 'Doctor name is required';
    if (!payload.specialization) errors.specialization = 'Specialization is required';
    if (!payload.contact) errors.contact = 'Contact is required';
    if (!payload.email) {
      errors.email = 'Valid email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
      errors.email = 'Enter a valid email address';
    }
    if (modalMode === 'add' && password && password.length < 8) {
      errors.password = 'Password must be at least 8 characters';
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setSaving(true);
    try {
      if (modalMode === 'add') {
        await doctorsApi.create(payload);
        toast.success('Doctor added to roster');
      } else {
        await doctorsApi.update(selectedDoctor.doctor_id, payload);
        toast.success('Doctor updated');
      }
      setModalOpen(false);
      fetchDoctors();
    } catch (err) {
      if (err.response?.data?.details) {
        const fieldErrors = {};
        err.response.data.details.forEach((d) => {
          fieldErrors[d.field] = d.message;
        });
        setFormErrors(fieldErrors);
      } else {
        toast.error(err.message || 'Failed to save doctor');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className={styles.pageHeader}>
        <h1 className={styles.headerTitle}>Doctors</h1>
        {canWrite && (
          <button
            id="btn-add-doctor"
            className={`btn btn-primary ${styles.headerActionBtn}`}
            onClick={handleAdd}
            type="button"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Add Doctor</span>
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
            aria-label="Search doctors"
            className={styles.searchField}
            placeholder="Search by name, specialty or email"
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

      {/* ── Minimal Doctors List Card ────────────────────────────────────── */}
      {loading ? (
        <div className="flex justify-center items-center" style={{ padding: 'var(--space-12)' }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
        </div>
      ) : sortedDoctors.length === 0 ? (
        <div className={styles.emptyCard}>
          <p className={styles.emptyTitle}>No doctors found</p>
          <p className={styles.emptySubtitle}>Try adjusting your search or add a new doctor.</p>
        </div>
      ) : (
        <>
          <div className={styles.listCard}>
            <div className={styles.listHeader} role="row">
              <span className={styles.headerNameCol}>
                <span>Doctor</span>
                <span className={styles.listCountPill} data-testid="doctors-total-count">
                  {totalCount} {totalCount === 1 ? 'doctor' : 'doctors'}
                </span>
              </span>
              <span>Contact</span>
              {(canWrite || canDelete) && <span className={styles.headerActionsCol}>Actions</span>}
            </div>
            {sortedDoctors.map((doc) => (
              <div key={doc.doctor_id} className={styles.listRow}>
                <div className={styles.rowIdentity}>
                  <span className={styles.rowName}>{doc.name}</span>
                  <span className={styles.rowSubMeta}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                    </svg>
                    <span>{doc.specialization || 'General Medicine'}</span>
                  </span>
                </div>

                <div className={styles.rowContactGroup}>
                  <span className={styles.rowContact}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    <span className={doc.contact ? styles.contactValue : styles.contactMuted}>
                      {doc.contact || 'Pending update'}
                    </span>
                  </span>
                  {doc.email && (
                    <span className={styles.rowEmail}>
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                        <polyline points="22,6 12,13 2,6" />
                      </svg>
                      <span>{doc.email}</span>
                    </span>
                  )}
                </div>

                {(canWrite || canDelete) && (
                  <div className={styles.rowActions}>
                    {canWrite && (
                      <button
                        className={styles.iconActionBtn}
                        onClick={() => handleEdit(doc)}
                        type="button"
                        aria-label="Edit"
                        title="Edit doctor profile"
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
                        onClick={() => handleDelete(doc)}
                        type="button"
                        aria-label="Delete"
                        title="Delete doctor"
                      >
                        <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
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

      <Modal
        isOpen={modalOpen}
        title={modalMode === 'add' ? 'Add New Doctor' : 'Edit Doctor'}
        onClose={() => setModalOpen(false)}
        size="md"
      >
        <form key={selectedDoctor?.doctor_id || 'new'} onSubmit={handleSubmit} noValidate className={styles.modalForm}>
          <div className="form-group">
            <label className="form-label" htmlFor="doc-name">Doctor Name</label>
            <input
              id="doc-name"
              name="name"
              type="text"
              className={`form-input ${formErrors.name ? 'error' : ''}`}
              placeholder="e.g. Dr. Kavinda Silva"
              defaultValue={selectedDoctor?.name || ''}
              required
            />
            {formErrors.name && <span className="form-error" role="alert">{formErrors.name}</span>}
          </div>

          <div className={styles.modalGrid}>
            <div className="form-group">
              <label className="form-label" htmlFor="doc-specialization">Specialization</label>
              <input
                id="doc-specialization"
                name="specialization"
                type="text"
                className={`form-input ${formErrors.specialization ? 'error' : ''}`}
                placeholder="e.g. Consultant Cardiologist"
                defaultValue={selectedDoctor?.specialization || ''}
                required
              />
              {formErrors.specialization && <span className="form-error" role="alert">{formErrors.specialization}</span>}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="doc-contact">Phone Contact</label>
              <input
                id="doc-contact"
                name="contact"
                type="tel"
                className={`form-input ${formErrors.contact ? 'error' : ''}`}
                placeholder="e.g. 077-234-5678"
                defaultValue={selectedDoctor?.contact || ''}
                required
              />
              {formErrors.contact && <span className="form-error" role="alert">{formErrors.contact}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="doc-email">Clinic Email</label>
            <input
              id="doc-email"
              name="email"
              type="email"
              className={`form-input ${formErrors.email ? 'error' : ''}`}
              placeholder="e.g. dr.kavinda@clinic.local"
              defaultValue={selectedDoctor?.email || ''}
              required
            />
            {formErrors.email && <span className="form-error" role="alert">{formErrors.email}</span>}
          </div>

          {modalMode === 'add' && (
            <div className="form-group">
              <label className="form-label" htmlFor="doc-password">Portal Login Password (Optional)</label>
              <input
                id="doc-password"
                name="password"
                type="password"
                className={`form-input ${formErrors.password ? 'error' : ''}`}
                placeholder="Min 8 chars — leave blank for directory profile only"
                autoComplete="new-password"
              />
              <span className={styles.helperText}>
                Provide a password to also create a login account for this doctor.
              </span>
              {formErrors.password && <span className="form-error" role="alert">{formErrors.password}</span>}
            </div>
          )}

          <div className={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : modalMode === 'add' ? 'Add Doctor' : 'Save Changes'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
