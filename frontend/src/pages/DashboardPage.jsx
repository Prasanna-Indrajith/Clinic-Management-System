import styles from './DashboardPage.module.css';

const STAT_CARDS = [
  { label: "Today's Appointments", value: '—', accent: 'teal' },
  { label: 'Active Patients',       value: '—', accent: 'teal' },
  { label: 'Doctors on Duty',       value: '—', accent: 'teal' },
  { label: 'Pending Reports',       value: '—', accent: 'amber' },
];

export default function DashboardPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Dashboard</h2>
          <p className={styles.subtitle}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {STAT_CARDS.map(({ label, value }) => (
          <div key={label} className={`card ${styles.statCard}`}>
            <p className={styles.statLabel}>{label}</p>
            <p className={styles.statValue}>{value}</p>
          </div>
        ))}
      </div>

      {/* Placeholder panels */}
      <div className={styles.panels}>
        <div className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Today&apos;s Schedule</h3>
          <p className="text-muted text-sm" style={{ marginTop: 'var(--space-4)' }}>
            Appointments will appear here in Phase 4.
          </p>
        </div>
        <div className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Recent Activity</h3>
          <p className="text-muted text-sm" style={{ marginTop: 'var(--space-4)' }}>
            Audit log feed will appear here in Phase 4.
          </p>
        </div>
      </div>
    </div>
  );
}
