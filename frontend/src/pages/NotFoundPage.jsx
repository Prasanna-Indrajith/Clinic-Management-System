import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-4)' }}>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-4xl)', fontWeight: 700, color: 'var(--color-accent)' }}>404</h1>
      <p style={{ color: 'var(--color-text-muted)' }}>This page doesn&apos;t exist.</p>
      <Link to="/dashboard" className="btn btn-secondary">Go to Dashboard</Link>
    </div>
  );
}
