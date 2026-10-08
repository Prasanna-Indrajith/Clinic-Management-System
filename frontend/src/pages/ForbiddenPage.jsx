import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import SignOutModal from '../components/auth/SignOutModal';

export default function ForbiddenPage({ allowedRoles }) {
  const { user } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: 'var(--space-6)',
        gap: 'var(--space-3)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(252, 92, 101, 0.12)',
          border: '1px solid rgba(252, 92, 101, 0.25)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--color-danger)',
          marginBottom: 'var(--space-2)',
        }}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 24 24"
          width="28"
          height="28"
          stroke="currentColor"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <span className="badge badge-danger" style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        403 — Access Denied
      </span>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-text)' }}>
        Restricted Area
      </h1>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: 460 }}>
        Your account role (<strong>{user?.role || 'Guest'}</strong>) does not have sufficient clearance to access this resource.
        {allowedRoles?.length ? ` Required role: ${allowedRoles.join(' or ')}.` : ''}
      </p>

      <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
        <Link to="/dashboard" className="btn btn-primary">
          Back to Dashboard
        </Link>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setShowSignOutModal(true)}
        >
          Sign in as Different User
        </button>
      </div>

      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
      />
    </div>
  );
}
