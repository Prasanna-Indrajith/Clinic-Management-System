import styles from './DashboardPage.module.css';

export default function AdminPage() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>Admin Settings & User Management</h1>
          <p className={styles.subtitle}>Manage staff accounts, clinic roles, and audit security logs.</p>
        </div>
        <span className="badge badge-primary">Admin Clearance</span>
      </header>

      <div className={styles.statsGrid}>
        <div className="card stat-card">
          <div className="stat-value">Active</div>
          <div className="stat-label">System Security Guard</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">RBAC</div>
          <div className="stat-label">Enforced</div>
        </div>
      </div>
    </div>
  );
}
