import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { appointApi, patientsApi, doctorsApi } from '../api/client';
import toast from 'react-hot-toast';
import styles from './DashboardPage.module.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    todayAppointments: 0,
    activePatients: 0,
    doctorsOnDuty: 0,
    pendingReports: 0,
  });
  const [loading, setLoading] = useState(true);
  const [todaySchedule, setTodaySchedule] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      // Fetch today's appointments
      const aptRes = await appointApi.list({ date: today, limit: 100 });
      const todayAppts = aptRes.data.data || [];
      setTodaySchedule(todayAppts);

      // Fetch total patients (admin only sees all)
      let patientCount = 0;
      if (user?.role === 'admin') {
        const patRes = await patientsApi.list({ limit: 1 });
        patientCount = patRes.data.pagination?.total || 0;
      }

      // Fetch total doctors
      const docRes = await doctorsApi.list({ limit: 1 });
      const doctorCount = docRes.data.pagination?.total || 0;

      setStats({
        todayAppointments: todayAppts.length,
        activePatients: patientCount,
        doctorsOnDuty: doctorCount,
        pendingReports: todayAppts.filter((a) => a.status === 'scheduled').length,
      });
    } catch (err) {
      toast.error(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setLoadingSchedule(false);
    }
  }, [user?.role]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statCards = [
    { label: "Today's Appointments", value: loading ? '—' : stats.todayAppointments, accent: 'teal' },
    { label: 'Active Patients', value: loading ? '—' : stats.activePatients, accent: 'teal' },
    { label: 'Doctors on Duty', value: loading ? '—' : stats.doctorsOnDuty, accent: 'teal' },
    { label: 'Pending Reports', value: loading ? '—' : stats.pendingReports, accent: 'amber' },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>Dashboard</h2>
          <p className={styles.subtitle}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
          {user?.role || 'Staff'}
        </span>
      </div>

      {/* Stats */}
      <div className={styles.statsGrid}>
        {statCards.map(({ label, value }) => (
          <div key={label} className={`card ${styles.statCard}`}>
            <p className={styles.statLabel}>{label}</p>
            <p className={styles.statValue}>{value}</p>
          </div>
        ))}
      </div>

      {/* Today's Schedule */}
      <div className={styles.panels}>
        <div className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Today's Schedule</h3>
          {loadingSchedule ? (
            <div className="flex justify-center items-center" style={{ padding: 'var(--space-8)' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : todaySchedule.length === 0 ? (
            <p className="text-muted" style={{ marginTop: 'var(--space-4)' }}>
              No appointments scheduled for today.
            </p>
          ) : (
            <div style={{ marginTop: 'var(--space-4)' }}>
              {todaySchedule.map((apt) => (
                <div
                  key={apt.appointment_id}
                  className="flex justify-between items-center"
                  style={{
                    padding: 'var(--space-3) 0',
                    borderBottom: '1px solid var(--color-border)',
                  }}
                >
                  <div>
                    <p className="font-medium">{apt.patient?.name || 'Unknown Patient'}</p>
                    <p className="text-sm text-muted">
                      Dr. {apt.doctor?.name || 'Unknown'} · {formatTime(apt.date_time)}
                    </p>
                  </div>
                  <span className={`badge badge-${apt.status === 'scheduled' ? 'warning' : apt.status === 'completed' ? 'success' : 'danger'}`}>
                    {apt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={`card ${styles.panel}`}>
          <h3 className={styles.panelTitle}>Recent Activity</h3>
          <p className="text-muted" style={{ marginTop: 'var(--space-4)' }}>
            Audit log feed will appear here in Phase 4.
          </p>
        </div>
      </div>
    </div>
  );
}
