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
        <div className={styles.iconWrapper} aria-hidden="true">
          <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
        </div>

        <div className={styles.textGroup}>
          <h4 className={styles.heading}>Sign out of your session?</h4>
          <p className={styles.description}>
            You will be securely signed out of ClinicMate. Any unsaved edits or draft clinical notes will be lost.
          </p>
        </div>

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
            className="btn btn-secondary"
            onClick={onClose}
          >
            Stay Signed In
          </button>
          <button
            id="btn-confirm-signout"
            type="button"
            className="btn btn-danger"
            onClick={handleConfirm}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Yes, Sign Out
          </button>
        </div>
      </div>
    </Modal>
  );
}
