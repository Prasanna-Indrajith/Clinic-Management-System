import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import styles from './AdminPage.module.css';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'doctor', label: 'Doctor' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'patient', label: 'Patient' },
];

export default function AdminPage() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 1 });

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [newRole, setNewRole] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await usersApi.list({ page, limit: 10 });
      setUsers(data.data || []);
      setPagination(data.pagination || { page, limit: 10, total: 0, totalPages: 1 });
    } catch (err) {
      toast.error(err.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleRoleChange = (u, role) => {
    setSelectedUser(u);
    setNewRole(role);
    setModalOpen(true);
  };

  const handleDelete = async (u) => {
    if (u.user_id === user?.id) {
      toast.error('You cannot delete your own account');
      return;
    }
    if (!window.confirm(`Delete user "${u.name}" (${u.email})? This cannot be undone.`)) return;
    try {
      await usersApi.delete(u.user_id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to delete user');
    }
  };

  const handleSubmitRole = async (e) => {
    e.preventDefault();
    try {
      await usersApi.updateRole(selectedUser.user_id, newRole);
      toast.success(`Role updated to ${newRole}`);
      setModalOpen(false);
      fetchUsers();
    } catch (err) {
      toast.error(err.message || 'Failed to update role');
    }
  };

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
      label: 'Staff Member',
      sortable: true,
      render: (val) => <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{val}</span>,
    },
    {
      key: 'email',
      label: 'System Email',
      sortable: true,
      render: (val) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{val}</span>,
    },
    {
      key: 'role',
      label: 'Assigned Role',
      sortable: true,
      render: (val) => getRoleBadge(val),
    },
    {
      key: 'user_id',
      label: 'Security & Access Actions',
      sortable: false,
      render: (_, row) => (
        <div className={styles.actionRow}>
          <select
            className={styles.roleSelect}
            value=""
            onChange={(e) => e.target.value && handleRoleChange(row, e.target.value)}
            aria-label="Change user role"
          >
            <option value="">Change role…</option>
            {ROLE_OPTIONS.filter((opt) => opt.value !== row.role).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {row.user_id !== user?.id && (
            <button
              className={styles.deleteBtn}
              onClick={() => handleDelete(row)}
              type="button"
              title="Revoke and delete account"
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
    <div className={styles.container}>
      <header className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>System Admin & Role Governance</h1>
          <p className={styles.headerSubtitle}>
            Manage authenticated clinical accounts, role privileges, and security boundaries.
          </p>
        </div>
        <div className={styles.adminBadge}>
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>Admin Clearance Active</span>
        </div>
      </header>

      <div className={styles.kpiRow}>
        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Total Accounts</span>
            <span className={styles.kpiValue}>{loading ? '—' : pagination.total}</span>
          </div>
          <div className={styles.kpiIconWrap}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={styles.kpiContent}>
            <span className={styles.kpiLabel}>Access Model</span>
            <span className={styles.kpiValue} style={{ fontSize: 'var(--text-2xl)' }}>Strict RBAC</span>
          </div>
          <div className={styles.kpiIconWrap}>
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>User Accounts Directory</h2>
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

      <Modal
        isOpen={modalOpen}
        title={`Change Role: ${selectedUser?.name || ''}`}
        onClose={() => setModalOpen(false)}
        size="sm"
      >
        <form onSubmit={handleSubmitRole}>
          <p style={{ marginBottom: 'var(--space-4)', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
            Are you sure you want to change the security role for <strong>{selectedUser?.name}</strong> to{' '}
            <strong style={{ color: 'var(--color-accent)' }}>{newRole}</strong>?
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm">
              Confirm Role Change
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
