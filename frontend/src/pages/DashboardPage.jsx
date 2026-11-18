import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { appointApi, patientsApi, doctorsApi } from '../api/client';
import AppointmentReportModal from '../components/appointments/AppointmentReportModal';
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
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [reportAppointment, setReportAppointment] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const tzOffset = now.getTimezoneOffset();
      const startOfTodayMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();

      if (user?.role === 'patient') {
        const myApptsRes = await appointApi.list({ limit: 100 });
        const myAppts = myApptsRes.data.data || [];
        const upcoming = myAppts
          .filter((a) => a.status === 'scheduled' && new Date(a.date_time).getTime() >= startOfTodayMs)
          .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));
        const history = myAppts
          .filter((a) => a.status !== 'scheduled')
          .sort((a, b) => new Date(b.date_time) - new Date(a.date_time));
        setTodaySchedule(upcoming);
        setRecentActivity(history);
        setStats({
          todayAppointments: upcoming.length,
          activePatients: myAppts.filter((a) => a.status === 'completed').length,
          doctorsOnDuty: 0,
          pendingReports: myAppts.length,
        });
      } else {
        // Fetch today's appointments for clinic staff, excluding cancelled bookings, sorted by time
        const aptRes = await appointApi.list({ date: today, tzOffset, limit: 100 });
        const todayAppts = aptRes.data.data || [];
        const activeTodayAppts = todayAppts
          .filter((a) => a.status !== 'cancelled')
          .sort((a, b) => new Date(a.date_time) - new Date(b.date_time));
        setTodaySchedule(activeTodayAppts);

        // Fetch active patient count (role-scoped on backend for doctors; total for admin/receptionist)
        let patientCount = 0;
        if (user?.role === 'admin' || user?.role === 'receptionist' || user?.role === 'doctor') {
          const patRes = await patientsApi.list({ limit: 1 });
          patientCount = patRes.data.pagination?.total || 0;
        }

        // Fetch total doctors
        const docRes = await doctorsApi.list({ limit: 1 });
        const doctorCount = docRes.data.pagination?.total || 0;

        // Fetch most recent appointments for activity feed, sorted newest first
        const recentRes = await appointApi.list({
          endDate: now.toISOString(),
          sortBy: 'date_time',
          sortDir: 'desc',
          limit: 6,
        });
        const recentList = (recentRes.data.data || []).sort(
          (a, b) => new Date(b.date_time) - new Date(a.date_time)
        );
        setRecentActivity(recentList);

        setStats({
          todayAppointments: activeTodayAppts.length,
          activePatients: patientCount,
          doctorsOnDuty: doctorCount,
          pendingReports: activeTodayAppts.filter((a) => a.status === 'scheduled').length,
        });
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load dashboard data');
    } finally {
      setLoading(false);
      setLoadingSchedule(false);
    }
  }, [user]);

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

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    const datePart = d.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    });
    return `${datePart}, ${formatTime(dateStr)}`;
  };

  const renderTimeOfDayIcon = () => {
    const hour = new Date().getHours();
    if (hour < 12) {
      return (
        <svg
          className={`${styles.timeIcon} ${styles.timeIconMorning}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-label="Morning"
          title="Good morning"
        >
          <path d="M12 3a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1zm6.364 2.636a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0zM7.05 7.05a1 1 0 0 1 0 1.414L5.636 7.05A1 1 0 1 1 7.05 5.636L8.464 7.05a1 1 0 0 1-1.414 0zM12 9a5 5 0 0 1 5 5H7a5 5 0 0 1 5-5zm-9 7a1 1 0 0 1 1-1h16a1 1 0 1 1 0 2H4a1 1 0 0 1-1-1zm3 3a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H7a1 1 0 0 1-1-1z" />
        </svg>
      );
    }
    if (hour < 17) {
      return (
        <svg
          className={`${styles.timeIcon} ${styles.timeIconDay}`}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-label="Afternoon"
          title="Good afternoon"
        >
          <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0-5a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 17a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM4.222 4.222a1 1 0 0 1 1.414 0l1.414 1.414A1 1 0 1 1 5.636 7.05L4.222 5.636a1 1 0 0 1 0-1.414zm12.728 12.728a1 1 0 0 1 1.414 0l1.414 1.414a1 1 0 1 1-1.414 1.414l-1.414-1.414a1 1 0 0 1 0-1.414zM2 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1zm17 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1zM7.05 16.95a1 1 0 0 1 0 1.414L5.636 19.778a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0zm12.728-12.728a1 1 0 0 1 0 1.414L18.364 7.05a1 1 0 0 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0z" />
        </svg>
      );
    }
    return (
      <svg
        className={`${styles.timeIcon} ${styles.timeIconEvening}`}
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-label="Evening"
        title="Good evening"
      >
        <path d="M21.05 14.43a1 1 0 0 0-1.14-.22A7.5 7.5 0 0 1 9.79 4.09a1 1 0 0 0-1.22-1.27A9.5 9.5 0 1 0 21.18 15.6a1 1 0 0 0-.13-1.17z" />
      </svg>
    );
  };

  const isPatient = user?.role === 'patient';

  const statCards = isPatient
    ? [
        {
          label: 'Upcoming',
          value: loading ? '—' : stats.todayAppointments,
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
        },
        {
          label: 'Completed',
          value: loading ? '—' : stats.activePatients,
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ),
        },
        {
          label: 'Total Visits',
          value: loading ? '—' : stats.pendingReports,
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          ),
        },
      ]
    : [
        {
          label: "Today's Appointments",
          value: loading ? '—' : stats.todayAppointments,
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          ),
        },
        {
          label: 'Active Patients',
          value: loading ? '—' : stats.activePatients,
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          ),
        },
        {
          label: 'Doctors',
          value: loading ? '—' : stats.doctorsOnDuty,
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          ),
        },
        {
          label: 'Awaiting Consult',
          value: loading ? '—' : stats.pendingReports,
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ),
        },
      ];

  const renderStatusPill = (status) => {
    const label = status?.replace('_', ' ') || 'scheduled';
    switch (status) {
      case 'completed':
      case 'confirmed':
        return (
          <span className={`${styles.statusPill} ${styles.statusPillSuccess}`}>
            <svg className={styles.statusPillIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>{label}</span>
          </span>
        );
      case 'cancelled':
      case 'no_show':
        return (
          <span className={`${styles.statusPill} ${styles.statusPillDanger}`}>
            <svg className={styles.statusPillIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>{label}</span>
          </span>
        );
      case 'scheduled':
        return (
          <span className={`${styles.statusPill} ${styles.statusPillWarning}`}>
            <svg className={styles.statusPillIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            <span>{label}</span>
          </span>
        );
      default:
        return (
          <span className={`${styles.statusPill} ${styles.statusPillInfo}`}>
            <span>{label}</span>
          </span>
        );
    }
  };

  const renderStatusIconOnly = (status) => {
    switch (status) {
      case 'completed':
      case 'confirmed':
        return (
          <span
            className={`${styles.statusCircle} ${styles.statusCircleSuccess}`}
            title="Completed"
            aria-label="Completed"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </span>
        );
      case 'cancelled':
      case 'no_show':
        return (
          <span
            className={`${styles.statusCircle} ${styles.statusCircleDanger}`}
            title="Cancelled"
            aria-label="Cancelled"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </span>
        );
      default:
        return (
          <span
            className={`${styles.statusCircle} ${styles.statusCircleWarning}`}
            title="Scheduled"
            aria-label="Scheduled"
          >
            <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
          </span>
        );
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className={styles.headerBanner}>
        <div className={styles.greetingGroup}>
          <h1 className={styles.title}>
            {renderTimeOfDayIcon()}
            <span>{user?.name || (isPatient ? 'Patient' : 'Doctor')}</span>
          </h1>
          <p className={styles.subtitle}>
            <svg className={styles.calendarIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {new Date().toLocaleDateString('en-GB', {
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </p>
        </div>

        {/* Quick Action Buttons (Icon + Name) */}
        <div className={styles.headerActions}>
          <Link
            to={isPatient ? '/appointments?book=true' : '/appointments'}
            className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
          >
            <svg className={styles.btnIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{isPatient ? 'Book Appointment' : 'New Appointment'}</span>
          </Link>

          {(user?.role === 'admin' || user?.role === 'receptionist') && (
            <Link to="/patients" className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}>
              <svg className={styles.btnIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Add Patient</span>
            </Link>
          )}

          {(user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'receptionist') && (
            <Link to="/reports" className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}>
              <svg className={styles.btnIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Daily Report</span>
            </Link>
          )}
        </div>
      </div>

      {/* ── KPI Stats Grid (Staff Only) ─────────────────────────────────────── */}
      {!isPatient && (
        <div className={styles.statsGrid}>
          {statCards.map((stat) => (
            <div key={stat.label} className={styles.statCard}>
              <div className={styles.statCardHeader}>
                <span className={styles.statLabel}>{stat.label}</span>
                <div className={styles.statIconWrap}>{stat.icon}</div>
              </div>
              <div className={styles.statValue}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Panels: Today's Schedule & Recent Activity ─────────────────────── */}
      <div className={styles.panels}>
        {/* Panel 1: Today's Schedule Queue */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWrap}>
              <h2 className={styles.panelTitle}>
                {isPatient ? 'My Appointments' : "Today's Appointment Queue"}
              </h2>
              <span className={styles.countBadge}>{todaySchedule.length}</span>
            </div>
            <Link
              to="/appointments"
              className={styles.panelIconLink}
              aria-label="View All Appointments"
              title="View All Appointments"
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

          {loadingSchedule ? (
            <div className="flex justify-center items-center" style={{ padding: 'var(--space-8)' }}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : todaySchedule.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap}>
                <svg className={styles.emptyIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className={styles.emptyTitle}>
                {isPatient ? 'No upcoming appointments found' : 'No appointments scheduled for today'}
              </p>
              <p className={styles.emptyDesc}>
                {isPatient
                  ? 'Book a consultation with a specialist using the button below.'
                  : 'Front desk can book new visits or review the full calendar.'}
              </p>
              {isPatient && (
                <Link
                  to="/appointments?book=true"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: 'var(--space-3)' }}
                >
                  Book a Consultation
                </Link>
              )}
            </div>
          ) : (
            <div className={styles.queueList}>
              {todaySchedule.map((apt) => (
                <div key={apt.appointment_id} className={styles.queueItem}>
                  <div className={styles.queueTime}>
                    <span className={styles.timePill}>
                      {isPatient ? formatDateTime(apt.date_time) : formatTime(apt.date_time)}
                    </span>
                  </div>
                  <div className={styles.queueDetails}>
                    <span className={styles.patientName}>
                      {isPatient ? (apt.doctor?.name || 'Physician') : (apt.patient?.name || 'Walk-in Patient')}
                    </span>
                    <span className={styles.doctorMeta}>
                      {isPatient
                        ? (apt.doctor?.specialization || 'Consultation')
                        : (apt.doctor?.name || 'Assigned')}
                    </span>
                  </div>
                  {renderStatusPill(apt.status)}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Panel 2: Recent Activity Feed / Patient Appointment History */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWrap}>
              <h2 className={styles.panelTitle}>
                {isPatient ? 'Appointment History' : 'Recent Activity'}
              </h2>
            </div>
            <Link
              to={isPatient ? '/appointment-history' : '/appointments'}
              className={styles.panelIconLink}
              aria-label={isPatient ? 'View History' : 'View All'}
              title={isPatient ? 'View History' : 'View All'}
            >
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>

          {recentActivity.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyIconWrap}>
                <svg className={styles.emptyIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
              <p className={styles.emptyTitle}>
                {isPatient ? 'No appointment history yet' : 'No recent activity'}
              </p>
            </div>
          ) : (
            <div className={styles.activityList}>
              {recentActivity.map((item) => (
                <div key={item.appointment_id} className={styles.activityItem}>
                  <div className={styles.activityContent}>
                    <div className={styles.activityText}>
                      <strong>
                        {isPatient ? (item.doctor?.name || 'Practitioner') : (item.patient?.name || 'Patient')}
                      </strong>
                    </div>
                    <div className={styles.activityTime}>
                      {isPatient
                        ? `${item.doctor?.specialization || 'Consultation'} · ${formatDateTime(item.date_time)}`
                        : `${item.doctor?.name || 'Practitioner'} · ${formatDateTime(item.date_time)}`}
                    </div>
                  </div>
                  {isPatient && item.status === 'completed' && (
                    <button
                      type="button"
                      className={styles.reportIconBtn}
                      onClick={() => setReportAppointment(item)}
                      aria-label="View Report"
                      title="View consultation report"
                    >
                      <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                      </svg>
                    </button>
                  )}
                  {renderStatusIconOnly(item.status)}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <AppointmentReportModal
        isOpen={Boolean(reportAppointment)}
        appointment={reportAppointment}
        onClose={() => setReportAppointment(null)}
      />
    </div>
  );
}
