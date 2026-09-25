import { useState, useEffect, useCallback } from 'react';
import { doctorsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import toast from 'react-hot-toast';
import styles from './DoctorsPage.module.css';

function getInitials(name) {
  if (!name) return 'DR';
  const clean = name.replace(/^Dr\.\s*/i, '').trim();
  const parts = clean.split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

export default function DoctorsPage() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const fetchDoctors = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const { data } = await doctorsApi.list(params);
      setDoctors(data.data || []);
      setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.message || 'Failed to load doctors');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };

  const columns = [
    {
      key: 'name',
      label: 'Physician Name',
      sortable: true,
      render: (val) => (
        <div className={styles.doctorCell}>
          <div className={styles.doctorAvatar}>
            {getInitials(val)}
          </div>
          <span className={styles.doctorName}>
            {val?.startsWith('Dr.') ? val : `Dr. ${val}`}
          </span>
        </div>
      ),
    },
    {
      key: 'specialization',
      label: 'Specialty & Department',
      sortable: true,
      render: (val) => (
        <span className={styles.specBadge}>
          {val || 'General Medicine'}
        </span>
      ),
    },
    {
      key: 'contact',
      label: 'Phone Contact',
      sortable: true,
      render: (val) => <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{val || '—'}</span>,
    },
    {
      key: 'email',
      label: 'Clinic Email',
      sortable: true,
      render: (val) => <span style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-xs)' }}>{val || '—'}</span>,
    },
  ];

  return (
    <div>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>Physician Roster</h1>
          <p className={styles.headerSubtitle}>
            Specialist directory, contact lines, and medical department affiliations
          </p>
        </div>
      </div>

      <div className={styles.searchCard}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className={`form-input ${styles.searchInput}`}
            placeholder="Search physicians by name, clinical specialty, or email..."
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
          data={doctors}
          pagination={pagination}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
