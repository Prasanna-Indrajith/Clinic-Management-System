import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];

      if (user?.role === 'patient') {
        const myApptsRes = await appointApi.list({ limit: 100 });
        const myAppts = myApptsRes.data.data || [];
        setTodaySchedule(myAppts.filter((a) => a.status === 'scheduled'));
        setRecentActivity(myAppts.filter((a) => a.status !== 'scheduled'));
        setStats({
          todayAppointments: myAppts.filter((a) => a.status === 'scheduled').length,
          activePatients: myAppts.filter((a) => a.status === 'completed').length,
          doctorsOnDuty: new Set(myAppts.map((a) => a.doctor_id)).size,
          pendingReports: myAppts.length,
        });
      } else {
        // Fetch today's appointments for clinic staff
        const aptRes = await appointApi.list({ date: today, limit: 100 });
        const todayAppts = aptRes.data.data || [];
        setTodaySchedule(todayAppts);

        // Fetch total patients (admin only sees all)
        let patientCount = 0;
        if (user?.role === 'admin' || user?.role === 'receptionist') {
          const patRes = await patientsApi.list({ limit: 1 });
          patientCount = patRes.data.pagination?.total || 0;
        }

        // Fetch total doctors
        const docRes = await doctorsApi.list({ limit: 1 });
        const doctorCount = docRes.data.pagination?.total || 0;

        // Fetch recent appointments for activity feed
        const recentRes = await appointApi.list({ limit: 6 });
        setRecentActivity(recentRes.data.data || []);

        setStats({
          todayAppointments: todayAppts.length,
          activePatients: patientCount,
          doctorsOnDuty: doctorCount,
          pendingReports: todayAppts.filter((a) => a.status === 'scheduled').length,
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const isPatient = user?.role === 'patient';
  const roleName = user?.role ? user.role.charAt(0).toUpperCase() + user.role.slice(1) : 'Staff';

  const statCards = isPatient
    ? [
        {
          label: 'Upcoming Visits',
          value: loading ? '—' : stats.todayAppointments,
          subtext: 'Next scheduled appointments',
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
          label: 'Completed Visits',
          value: loading ? '—' : stats.activePatients,
          subtext: 'Historical clinic consultations',
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          ),
        },
        {
          label: 'Consulted Doctors',
          value: loading ? '—' : stats.doctorsOnDuty,
          subtext: 'Specialists in your care team',
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
              <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
              <circle cx="20" cy="10" r="2" />
            </svg>
          ),
        },
        {
          label: 'Total Records',
          value: loading ? '—' : stats.pendingReports,
          subtext: 'Clinical files & prescriptions',
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
          subtext: 'Scheduled for current clinic date',
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
          subtext: 'Total registered in directory',
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
          label: 'Doctors on Duty',
          value: loading ? '—' : stats.doctorsOnDuty,
          subtext: 'Available practitioner profiles',
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          ),
        },
        {
          label: 'Awaiting Consult',
          value: loading ? '—' : stats.pendingReports,
          subtext: 'Visits ready for physician',
          icon: (
            <svg className={styles.statIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          ),
        },
      ];

  const getStatusClass = (status) => {
    switch (status) {
      case 'scheduled':
        return styles.statusPillWarning;
      case 'confirmed':
      case 'completed':
        return styles.statusPillSuccess;
      case 'cancelled':
      case 'no_show':
        return styles.statusPillDanger;
      case 'in_progress':
        return styles.statusPillInfo;
      default:
        return styles.statusPillInfo;
    }
  };

  return (
    <div className={styles.page}>
      {/* ── Top Header Banner ──────────────────────────────────────────────── */}
      <div className={styles.headerBanner}>
        <div className={styles.greetingGroup}>
          <h1 className={styles.title}>
            {isPatient ? 'Patient Portal' : `${getGreeting()}, ${user?.name || 'Doctor'}`}
            <span className={styles.roleBadge}>{roleName}</span>
          </h1>
          <p className={styles.subtitle}>
            <svg className={styles.calendarIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            {isPatient
              ? 'Review your upcoming clinic appointments, prescriptions, and medical history'
              : new Date().toLocaleDateString('en-GB', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className={styles.headerActions}>
          <Link to="/appointments" className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}>
            <svg className={styles.btnIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>{isPatient ? 'Book Appointment' : 'New Appointment'}</span>
          </Link>

          {!isPatient && (
            <Link to="/patients" className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}>
              <svg className={styles.btnIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              <span>Add Patient</span>
            </Link>
          )}

          {(user?.role === 'admin' || user?.role === 'doctor') && (
            <Link to="/reports" className={`${styles.actionBtn} ${styles.actionBtnSecondary}`}>
              <svg className={styles.btnIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
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

      {/* ── KPI Stats Grid ──────────────────────────────────────────────────── */}
      <div className={styles.statsGrid}>
        {statCards.map((stat) => (
          <div key={stat.label} className={styles.statCard}>
            <div className={styles.statCardHeader}>
              <span className={styles.statLabel}>{stat.label}</span>
              <div className={styles.statIconWrap}>{stat.icon}</div>
            </div>
            <div>
              <div className={styles.statValue}>{stat.value}</div>
              <div className={styles.statSubtext}>{stat.subtext}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Panels: Today's Schedule & Recent Activity ─────────────────────── */}
      <div className={styles.panels}>
        {/* Panel 1: Today's Schedule Queue */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWrap}>
              <h2 className={styles.panelTitle}>
                {isPatient ? 'Upcoming Appointments' : "Today's Appointment Queue"}
              </h2>
              <span className={styles.countBadge}>{todaySchedule.length}</span>
            </div>
            <Link to="/appointments" className={styles.panelLink}>
              View All →
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
                  ? 'Book a consultation with a specialist using the button above.'
                  : 'Front desk can book new visits or review the full calendar.'}
              </p>
            </div>
          ) : (
            <div className={styles.queueList}>
              {todaySchedule.map((apt) => (
                <div key={apt.appointment_id} className={styles.queueItem}>
                  <div className={styles.queueTime}>
                    <span className={styles.timePill}>{formatTime(apt.date_time)}</span>
                  </div>
                  <div className={styles.queueDetails}>
                    <span className={styles.patientName}>
                      {isPatient ? `Dr. ${apt.doctor?.name || 'Physician'}` : (apt.patient?.name || 'Walk-in Patient')}
                    </span>
                    <span className={styles.doctorMeta}>
                      {isPatient
                        ? (apt.doctor?.specialization || 'General Consultation')
                        : `Dr. ${apt.doctor?.name || 'Assigned'} · #${apt.appointment_id}`}
                    </span>
                  </div>
                  <span className={`${styles.statusPill} ${getStatusClass(apt.status)}`}>
                    {apt.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Panel 2: Recent Activity Feed */}
        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitleWrap}>
              <h2 className={styles.panelTitle}>
                {isPatient ? 'Recent Visit History' : 'Recent Activity Feed'}
              </h2>
            </div>
            <Link to={isPatient ? '/appointments' : '/appointments'} className={styles.panelLink}>
              Audit Trail →
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
                {isPatient ? 'No previous visits on record' : 'No recent activity logged'}
              </p>
              <p className={styles.emptyDesc}>
                Appointment status changes and clinical notes will appear here automatically.
              </p>
            </div>
          ) : (
            <div className={styles.activityList}>
              {recentActivity.map((item) => (
                <div key={item.appointment_id} className={styles.activityItem}>
                  <div className={styles.activityDot} aria-hidden="true" />
                  <div className={styles.activityContent}>
                    <div className={styles.activityText}>
                      <strong>{item.patient?.name || 'Patient'}</strong> · #{item.appointment_id}
                    </div>
                    <div className={styles.activityTime}>
                      Dr. {item.doctor?.name || 'Practitioner'} · {formatTime(item.date_time)}
                    </div>
                  </div>
                  <span className={`${styles.statusPill} ${getStatusClass(item.status)}`}>
                    {item.status?.replace('_', ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
