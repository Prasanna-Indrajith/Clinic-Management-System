import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import Modal from '../components/ui/Modal';
import toast from 'react-hot-toast';
import styles from './DashboardPage.module.css';

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

  const columns = [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'email', label: 'Email', sortable: true },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (val) => (
        <span className={`badge badge-${val === 'admin' ? 'info' : val === 'doctor' ? 'warning' : 'success'}`}>
          {val}
        </span>
      ),
    },
    {
      key: 'user_id',
      label: 'Actions',
      sortable: false,
      render: (_, row) => (
        <div className="flex gap-2">
          <select
            className="form-input"
            style={{ minWidth: 120, padding: 'var(--space-1) var(--space-3)', fontSize: 'var(--text-xs)' }}
            value=""
            onChange={(e) => e.target.value && handleRoleChange(row, e.target.value)}
          >
            <option value="">Change role…</option>
            {ROLE_OPTIONS.filter((opt) => opt.value !== row.role).map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {row.user_id !== user?.id && (
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
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Settings & User Management</h1>
          <p className={styles.subtitle}>Manage staff accounts, clinic roles, and audit security logs.</p>
        </div>
        <span className="badge badge-info">Admin Clearance</span>
      </header>

      <div className={styles.statsGrid}>
        <div className="card stat-card">
          <div className="stat-value">{loading ? '—' : pagination.total}</div>
          <div className="stat-label">Total Users</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">RBAC</div>
          <div className="stat-label">Enforced</div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 'var(--space-6)' }}>
        <h3 className={styles.panelTitle}>User Accounts</h3>
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
        <form onSubmit={handleSubmitRole} noValidate>
          <div className="form-group">
            <label className="form-label" htmlFor="new_role">New Role</label>
            <select
              id="new_role"
              className="form-input"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              required
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} disabled={opt.value === selectedUser?.role}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-between" style={{ marginTop: 'var(--space-6)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save Role
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
