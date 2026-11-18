import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Modal from '../ui/Modal';
import toast from 'react-hot-toast';
import styles from './SignOutModal.module.css';

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return parts[0].slice(0, 2).toUpperCase();
}

const ROLE_BADGE_MAP = {
  admin: 'badge-danger',
  doctor: 'badge-primary',
  receptionist: 'badge-warning',
  patient: 'badge-success',
};

const ROLE_LABEL_MAP = {
  admin: 'Admin',
  doctor: 'Doctor',
  receptionist: 'Receptionist',
  patient: 'Patient',
};

/**
 * SignOutModal — accessible confirmation dialog for signing out of ClinicMate.
 * Displays active user credentials, role badge, warning note, and clear confirm/cancel actions.
 */
export default function SignOutModal({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleConfirm = () => {
    logout();
    toast.success('Signed out successfully');
    onClose();
    navigate('/login');
  };

  return (
    <Modal
      isOpen={isOpen}
      title="Confirm Sign Out"
      onClose={onClose}
      size="sm"
    >
      <div className={styles.modalContent}>
        <p className={styles.heading}>Sign out of your session?</p>

        {user && (
          <div className={styles.userCard}>
            <div className={styles.avatar} aria-hidden="true">
              {getInitials(user.name)}
            </div>
            <div className={styles.userDetails}>
              <div className={styles.userHeader}>
                <span className={styles.userName}>{user.name || 'Active User'}</span>
                <span className={`badge ${ROLE_BADGE_MAP[user.role] || 'badge-neutral'}`}>
                  {ROLE_LABEL_MAP[user.role] || user.role || 'Staff'}
                </span>
              </div>
              <span className={styles.userEmail}>{user.email}</span>
            </div>
          </div>
        )}

        <div className={styles.actions}>
          <button
            id="btn-cancel-signout"
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onClose}
          >
            Stay Signed In
          </button>
          <button
            id="btn-confirm-signout"
            type="button"
            className="btn btn-danger btn-sm"
            onClick={handleConfirm}
          >
            Yes, Sign Out
          </button>
        </div>
      </div>
    </Modal>
  );
}
