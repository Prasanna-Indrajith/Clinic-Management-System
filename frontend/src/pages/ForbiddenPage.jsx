import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ForbiddenPage({ allowedRoles }) {
  const { user, logout } = useAuth();

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
      <span
        style={{
          fontSize: 'var(--text-4xl)',
          lineHeight: 1,
          marginBottom: 'var(--space-2)',
        }}
        role="img"
        aria-label="Access Restricted"
      >
        🛡️
      </span>
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
        <button type="button" className="btn btn-secondary" onClick={logout}>
          Sign in as Different User
        </button>
      </div>
    </div>
  );
}
