'use strict';

export default function DoctorsPage() {
  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600 }}>
        Doctors
      </h2>
      <p className="text-muted" style={{ marginTop: 'var(--space-2)' }}>
        Clinic physician roster and specialties.
      </p>
    </div>
  );
}
