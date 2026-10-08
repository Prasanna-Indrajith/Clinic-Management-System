import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import toast from 'react-hot-toast';
import styles from './ReportsPage.module.css';

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

/**
 * Returns formatted YYYY-MM-DD for a given date in local timezone
 */
const formatLocalDate = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ReportsPage() {
  const { user } = useAuth();
  const canRead = user?.role === 'admin' || user?.role === 'doctor';
  const isDoctor = user?.role === 'doctor';

  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [exportingDaily, setExportingDaily] = useState(null); // 'pdf' | 'csv' | null
  const [exportingMonthly, setExportingMonthly] = useState(null); // 'pdf' | 'csv' | null

  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [error, setError] = useState(null);

  // Default to today in user's local timezone
  const [dailyDate, setDailyDate] = useState(formatLocalDate(new Date()));
  const [monthYear, setMonthYear] = useState(String(new Date().getFullYear()));
  const [monthMonth, setMonthMonth] = useState(String(new Date().getMonth() + 1));

  // Table sorting & pagination state
  const [dailySortKey, setDailySortKey] = useState('date_time');
  const [dailySortDir, setDailySortDir] = useState('asc');
  const [dailyPage, setDailyPage] = useState(1);
  const pageSize = 10;

  const handleDaily = async () => {
    if (!dailyDate) {
      toast.error('Please select a date');
      return;
    }
    setLoadingDaily(true);
    setError(null);
    setDailyPage(1);
    try {
      const res = await reportsApi.daily({ date: dailyDate });
      setDailyData(res.data?.data || res.data);
    } catch (err) {
      setError(err.message || 'Failed to generate daily report');
      setDailyData(null);
    } finally {
      setLoadingDaily(false);
    }
  };

  const handleMonthly = async () => {
    if (!monthYear || !monthMonth) {
      toast.error('Please select year and month');
      return;
    }
    setLoadingMonthly(true);
    setError(null);
    try {
      const res = await reportsApi.monthly({ year: parseInt(monthYear, 10), month: parseInt(monthMonth, 10) });
      setMonthlyData(res.data?.data || res.data);
    } catch (err) {
      setError(err.message || 'Failed to generate monthly report');
      setMonthlyData(null);
    } finally {
      setLoadingMonthly(false);
    }
  };

  // Automatically fetch reports on initial load so the page is populated immediately
  useEffect(() => {
    let isMounted = true;
    if (canRead && dailyDate) {
      reportsApi.daily({ date: dailyDate })
        .then((res) => {
          if (isMounted) setDailyData(res.data?.data || res.data);
        })
        .catch(() => {});
    }
    if (canRead && monthYear && monthMonth) {
      reportsApi.monthly({ year: parseInt(monthYear, 10), month: parseInt(monthMonth, 10) })
        .then((res) => {
          if (isMounted) setMonthlyData(res.data?.data || res.data);
        })
        .catch(() => {});
    }
    return () => {
      isMounted = false;
    };
  }, [canRead, dailyDate, monthYear, monthMonth]);

  const setDatePreset = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDailyDate(formatLocalDate(d));
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleExportDaily = async (format) => {
    if (!dailyDate) {
      toast.error('Please select a date first');
      return;
    }
    setExportingDaily(format);
    try {
      const response = await reportsApi.exportDaily({ date: dailyDate, format });
      const filename = `daily-report-${dailyDate}.${format}`;
      downloadBlob(new Blob([response.data]), filename);
      toast.success(`Daily report exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingDaily(null);
    }
  };

  const handleExportMonthly = async (format) => {
    if (!monthYear || !monthMonth) {
      toast.error('Please select year and month first');
      return;
    }
    setExportingMonthly(format);
    try {
      const response = await reportsApi.exportMonthly({
        year: parseInt(monthYear, 10),
        month: parseInt(monthMonth, 10),
        format,
      });
      const monthPadded = String(monthMonth).padStart(2, '0');
      const filename = `monthly-report-${monthYear}-${monthPadded}.${format}`;
      downloadBlob(new Blob([response.data]), filename);
      toast.success(`Monthly report exported as ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Export failed: ${err.message || 'Unknown error'}`);
    } finally {
      setExportingMonthly(null);
    }
  };

  const getStatusBadge = (status) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'scheduled':
        return <span className={`${styles.statusPill} ${styles.statusScheduled}`}>Scheduled</span>;
      case 'completed':
        return <span className={`${styles.statusPill} ${styles.statusCompleted}`}>Completed</span>;
      case 'cancelled':
        return <span className={`${styles.statusPill} ${styles.statusCancelled}`}>Cancelled</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  const dailyColumns = [
    {
      key: 'date_time',
      label: 'Time',
      sortable: true,
      render: (val, row) => {
        const dt = val || row?.date_time;
        if (!dt) return '—';
        return <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>{new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>;
      },
    },
    {
      key: 'patient.name',
      label: 'Patient',
      sortable: true,
      render: (val, row) => <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>{val || row?.patient?.name || '—'}</span>,
    },
    {
      key: 'patient.contact',
      label: 'Contact',
      sortable: false,
      render: (val, row) => <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>{val || row?.patient?.contact || '—'}</span>,
    },
    {
      key: 'doctor.name',
      label: 'Doctor',
      sortable: true,
      render: (val, row) => <span style={{ color: 'var(--color-text-muted)' }}>{val || row?.doctor?.name ? `Dr. ${val || row?.doctor?.name}` : '—'}</span>,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => getStatusBadge(val || row?.status),
    },
  ];

  // Sort and paginate daily appointments
  const sortedDailyAppointments = useMemo(() => {
    if (!dailyData?.appointments) return [];
    const appts = [...dailyData.appointments];
    if (!dailySortKey) return appts;

    appts.sort((a, b) => {
      let valA = dailySortKey.includes('.')
        ? dailySortKey.split('.').reduce((acc, p) => acc?.[p], a)
        : a[dailySortKey];
      let valB = dailySortKey.includes('.')
        ? dailySortKey.split('.').reduce((acc, p) => acc?.[p], b)
        : b[dailySortKey];

      if (valA == null) return 1;
      if (valB == null) return -1;
      if (valA < valB) return dailySortDir === 'asc' ? -1 : 1;
      if (valA > valB) return dailySortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return appts;
  }, [dailyData, dailySortKey, dailySortDir]);

  const totalPages = Math.ceil(sortedDailyAppointments.length / pageSize) || 1;
  const paginatedAppointments = sortedDailyAppointments.slice(
    (dailyPage - 1) * pageSize,
    dailyPage * pageSize
  );

  const monthlyDoctorColumns = [
    { key: 'name', label: 'Doctor', sortable: true, render: (val, row) => val || row?.name || '—' },
    { key: 'specialization', label: 'Specialization', sortable: true, render: (val, row) => val || row?.specialization || '—' },
    { key: 'total', label: 'Total Visits', sortable: true, render: (val, row) => val ?? row?.total ?? 0 },
  ];

  const monthlyPatientColumns = [
    { key: 'patient_id', label: 'Patient ID', sortable: true, render: (val, row) => val ?? row?.patient_id ?? '—' },
    { key: 'name', label: 'Patient', sortable: true, render: (val, row) => val || row?.name || '—' },
    { key: 'total', label: 'Total Visits', sortable: true, render: (val, row) => val ?? row?.total ?? 0 },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.headerTitle}>Reports & Analytics</h1>
          <p className={styles.headerSubtitle}>
            Generate operational appointment reports and export high-resolution PDF or CSV documents.
          </p>
        </div>

        {isDoctor && (
          <div className={styles.scopeBadge}>
            <svg className={styles.scopeIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            <span>Doctor Scoped Mode: Filtered to your consultations</span>
          </div>
        )}
      </div>

      {!canRead && (
        <div className="card">
          <p className="text-muted">You do not have permission to view or generate reports.</p>
        </div>
      )}

      {canRead && (
        <>
          {/* ── Daily Report Card ─────────────────────────────────────────── */}
          <div className={styles.reportCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
                <span>Daily Appointments Report</span>
              </h2>
            </div>

            <div className={styles.controlsRow}>
              <div className={styles.dateInputGroup}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Report Date</label>
                  <div className={styles.presetGroup}>
                    <button type="button" className={styles.presetBtn} onClick={() => setDatePreset(-1)}>
                      Yesterday
                    </button>
                    <button type="button" className={styles.presetBtn} onClick={() => setDatePreset(0)}>
                      Today
                    </button>
                    <button type="button" className={styles.presetBtn} onClick={() => setDatePreset(1)}>
                      Tomorrow
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  className="form-input"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                />
              </div>

              <div className={styles.buttonGroup}>
                <button
                  className="btn btn-primary"
                  onClick={handleDaily}
                  type="button"
                  disabled={loadingDaily}
                >
                  <span className={styles.btnWithIcon}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>{loadingDaily ? 'Loading Report...' : 'View Report'}</span>
                  </span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleExportDaily('pdf')}
                  type="button"
                  disabled={exportingDaily === 'pdf'}
                  title="Download high-resolution PDF document"
                >
                  <span className={styles.btnWithIcon}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="12" y2="18" />
                      <line x1="15" y1="15" x2="12" y2="18" />
                    </svg>
                    <span>{exportingDaily === 'pdf' ? 'Generating PDF...' : 'Download PDF'}</span>
                  </span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleExportDaily('csv')}
                  type="button"
                  disabled={exportingDaily === 'csv'}
                  title="Download CSV spreadsheet"
                >
                  <span className={styles.btnWithIcon}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>{exportingDaily === 'csv' ? 'Generating CSV...' : 'Download CSV'}</span>
                  </span>
                </button>
              </div>
            </div>

            {error && (
              <div style={{ color: 'var(--color-danger)', marginTop: 'var(--space-4)' }} role="alert">
                {error}
              </div>
            )}

            {dailyData && !loadingDaily && (
              <div className={styles.resultSection}>
                {/* Metric Summary Ribbon */}
                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Total Appointments</span>
                    <span className={styles.kpiValue}>{dailyData.summary?.total ?? 0}</span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Scheduled</span>
                    <span className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>
                      {dailyData.summary?.scheduled ?? 0}
                    </span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Completed</span>
                    <span className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>
                      {dailyData.summary?.completed ?? 0}
                    </span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Cancelled</span>
                    <span className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>
                      {dailyData.summary?.cancelled ?? 0}
                    </span>
                  </div>
                </div>

                <div style={{ margin: 'var(--space-6) 0 var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className={styles.resultTitle}>
                    Appointments on {dailyDate} ({sortedDailyAppointments.length} record{sortedDailyAppointments.length === 1 ? '' : 's'})
                  </h3>
                  {sortedDailyAppointments.length > 0 && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-dim)' }}>
                      Click column headers to sort
                    </span>
                  )}
                </div>

                <DataTable
                  columns={dailyColumns}
                  data={paginatedAppointments}
                  pagination={{ page: dailyPage, limit: pageSize, total: sortedDailyAppointments.length, totalPages }}
                  onPageChange={(p) => setDailyPage(p)}
                  sortKey={dailySortKey}
                  sortDir={dailySortDir}
                  onSort={(key, dir) => {
                    setDailySortKey(key);
                    setDailySortDir(dir);
                  }}
                />
              </div>
            )}
          </div>

          {/* ── Monthly Report Card ───────────────────────────────────────── */}
          <div className={styles.reportCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>
                <svg className={styles.cardTitleIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 20V10" />
                  <path d="M12 20V4" />
                  <path d="M6 20v-6" />
                </svg>
                <span>Monthly Activity Summary</span>
              </h2>
            </div>

            <div className={styles.controlsRow}>
              <div className="form-group" style={{ flex: 1, minWidth: 140, marginBottom: 0 }}>
                <label className="form-label">Year</label>
                <input
                  type="number"
                  className="form-input"
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  placeholder="2026"
                  min="2000"
                  max="2100"
                />
              </div>

              <div className="form-group" style={{ flex: 1, minWidth: 160, marginBottom: 0 }}>
                <label className="form-label">Month</label>
                <select
                  className="form-input"
                  value={monthMonth}
                  onChange={(e) => setMonthMonth(e.target.value)}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <div className={styles.buttonGroup}>
                <button
                  className="btn btn-primary"
                  onClick={handleMonthly}
                  type="button"
                  disabled={loadingMonthly}
                >
                  <span className={styles.btnWithIcon}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <span>{loadingMonthly ? 'Loading Report...' : 'View Report'}</span>
                  </span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleExportMonthly('pdf')}
                  type="button"
                  disabled={exportingMonthly === 'pdf'}
                  title="Download high-resolution PDF document"
                >
                  <span className={styles.btnWithIcon}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="12" y1="18" x2="12" y2="12" />
                      <line x1="9" y1="15" x2="12" y2="18" />
                      <line x1="15" y1="15" x2="12" y2="18" />
                    </svg>
                    <span>{exportingMonthly === 'pdf' ? 'Generating PDF...' : 'Download PDF'}</span>
                  </span>
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => handleExportMonthly('csv')}
                  type="button"
                  disabled={exportingMonthly === 'csv'}
                  title="Download CSV spreadsheet"
                >
                  <span className={styles.btnWithIcon}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                    </svg>
                    <span>{exportingMonthly === 'csv' ? 'Generating CSV...' : 'Download CSV'}</span>
                  </span>
                </button>
              </div>
            </div>

            {monthlyData && !loadingMonthly && (
              <div className={styles.resultSection}>
                {/* Metric Summary Ribbon for Monthly Activity */}
                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Total Visits</span>
                    <span className={styles.kpiValue}>{monthlyData.summary?.total ?? 0}</span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Scheduled</span>
                    <span className={styles.kpiValue} style={{ color: 'var(--color-warning)' }}>
                      {monthlyData.summary?.scheduled ?? 0}
                    </span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Completed</span>
                    <span className={styles.kpiValue} style={{ color: 'var(--color-success)' }}>
                      {monthlyData.summary?.completed ?? 0}
                    </span>
                  </div>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Cancelled</span>
                    <span className={styles.kpiValue} style={{ color: 'var(--color-danger)' }}>
                      {monthlyData.summary?.cancelled ?? 0}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
                  <div>
                    <h3 className={styles.resultTitle}>
                      Consultations by Physician ({((monthlyData.perDoctor || monthlyData.byDoctor || []).length)} records)
                    </h3>
                    <DataTable
                      columns={monthlyDoctorColumns}
                      data={monthlyData.perDoctor || monthlyData.byDoctor || []}
                      pagination={{ page: 1, limit: 100, total: (monthlyData.perDoctor || monthlyData.byDoctor || []).length, totalPages: 1 }}
                    />
                  </div>
                  <div>
                    <h3 className={styles.resultTitle}>
                      Visits by Patient ({((monthlyData.perPatient || monthlyData.byPatient || []).length)} records)
                    </h3>
                    <DataTable
                      columns={monthlyPatientColumns}
                      data={monthlyData.perPatient || monthlyData.byPatient || []}
                      pagination={{ page: 1, limit: 100, total: (monthlyData.perPatient || monthlyData.byPatient || []).length, totalPages: 1 }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
