import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import AddUserModal from '../components/forms/AddUserModal';
import toast from 'react-hot-toast';
import styles from './AdminPage.module.css';

export default function UsersPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });
  const [addModalOpen, setAddModalOpen] = useState(false);

  const isAdmin = user?.role === 'admin';

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const { data } = await usersApi.list(params);
      setUsers(data.data || []);
      setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, roleFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin':
        return <span className={`${styles.roleBadge} ${styles.roleAdmin}`}>Admin</span>;
      case 'doctor':
        return <span className={`${styles.roleBadge} ${styles.roleDoctor}`}>Doctor</span>;
      case 'receptionist':
        return <span className={`${styles.roleBadge} ${styles.roleReceptionist}`}>Receptionist</span>;
      case 'patient':
        return <span className={`${styles.roleBadge} ${styles.rolePatient}`}>Patient</span>;
      default:
        return <span className="badge badge-info">{role}</span>;
    }
  };

  const columns = [
    {
      key: 'name',
      label: 'Full Name',
      sortable: true,
      render: (val) => <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{val}</span>,
    },
    {
      key: 'email',
      label: 'Email Address',
      sortable: true,
      render: (val) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{val}</span>,
    },
    {
      key: 'role',
      label: 'Account Role',
      sortable: true,
      render: (val) => getRoleBadge(val),
    },
    {
      key: 'createdAt',
      label: 'Created',
      sortable: true,
      render: (val) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {val ? new Date(val).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </span>
      ),
    },
  ];

  return (
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>User Registration & Directory</h1>
        </div>
        <button
          id="btn-open-add-user"
          type="button"
          className="btn btn-primary"
          onClick={() => setAddModalOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>Add User</span>
        </button>
      </header>

      <div className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            {isAdmin ? 'All Clinic Accounts' : 'Patient & Doctor Accounts'}
          </h2>
          <div className={styles.toolbar}>
            <input
              type="text"
              className={`form-input ${styles.searchField}`}
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              className={`form-input ${styles.filterSelect}`}
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by role"
            >
              <option value="">All Roles</option>
              <option value="patient">Patient</option>
              <option value="doctor">Doctor</option>
              {isAdmin && <option value="receptionist">Receptionist</option>}
              {isAdmin && <option value="admin">Admin</option>}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center" style={{ padding: 'var(--space-12)' }}>
            <div className="spinner" style={{ width: 32, height: 32 }} />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={users}
            pagination={pagination}
            onPageChange={setPage}
          />
        )}
      </div>

      <AddUserModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
        onSuccess={fetchUsers}
        currentUserRole={user?.role}
      />
    </div>
  );
}
