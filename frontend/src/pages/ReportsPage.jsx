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

const formatLocalDate = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function ReportsPage() {
  const { user } = useAuth();
  const canRead =
    user?.role === 'admin' || user?.role === 'doctor' || user?.role === 'receptionist';
  const isDoctor = user?.role === 'doctor';

  const [activeTab, setActiveTab] = useState('daily'); // 'daily' | 'monthly'
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingMonthly, setLoadingMonthly] = useState(false);
  const [exportingDaily, setExportingDaily] = useState(null);
  const [exportingMonthly, setExportingMonthly] = useState(null);

  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [dailyError, setDailyError] = useState(null);
  const [monthlyError, setMonthlyError] = useState(null);

  const [dailyDate, setDailyDate] = useState(() => formatLocalDate(new Date()));
  const [monthYear, setMonthYear] = useState(() => String(new Date().getFullYear()));
  const [monthMonth, setMonthMonth] = useState(() => String(new Date().getMonth() + 1));

  const [dailySortKey, setDailySortKey] = useState('date_time');
  const [dailySortDir, setDailySortDir] = useState('asc');
  const [dailyPage, setDailyPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    if (!canRead || !dailyDate) return;
    let isCurrent = true;
    setLoadingDaily(true);
    setDailyError(null);
    setDailyPage(1);

    reportsApi
      .daily({ date: dailyDate })
      .then((res) => {
        if (isCurrent) setDailyData(res.data?.data || res.data);
      })
      .catch((err) => {
        if (isCurrent) {
          setDailyError(err.message || 'Failed to load daily report');
          setDailyData(null);
        }
      })
      .finally(() => {
        if (isCurrent) setLoadingDaily(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canRead, dailyDate]);

  useEffect(() => {
    const yearNum = parseInt(monthYear, 10);
    const monthNum = parseInt(monthMonth, 10);
    if (!canRead || !yearNum || yearNum < 2000 || yearNum > 2100 || !monthNum) return;

    let isCurrent = true;
    setLoadingMonthly(true);
    setMonthlyError(null);

    reportsApi
      .monthly({ year: yearNum, month: monthNum })
      .then((res) => {
        if (isCurrent) setMonthlyData(res.data?.data || res.data);
      })
      .catch((err) => {
        if (isCurrent) {
          setMonthlyError(err.message || 'Failed to load monthly report');
          setMonthlyData(null);
        }
      })
      .finally(() => {
        if (isCurrent) setLoadingMonthly(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [canRead, monthYear, monthMonth]);

  const getOffsetDate = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    return formatLocalDate(d);
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
      downloadBlob(new Blob([response.data]), `daily-report-${dailyDate}.${format}`);
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
      downloadBlob(new Blob([response.data]), `monthly-report-${monthYear}-${monthPadded}.${format}`);
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
        return (
          <span className={`${styles.statusPill} ${styles.statusScheduled}`}>
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="12 7 12 12 15 14" />
            </svg>
            <span>Scheduled</span>
          </span>
        );
      case 'completed':
        return (
          <span className={`${styles.statusPill} ${styles.statusCompleted}`}>
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>Completed</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className={`${styles.statusPill} ${styles.statusCancelled}`}>
            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <span>Cancelled</span>
          </span>
        );
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
        return (
          <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-xs)' }}>
            {new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        );
      },
    },
    {
      key: 'patient.name',
      label: 'Patient',
      sortable: true,
      render: (val, row) => (
        <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
          {val || row?.patient?.name || '—'}
        </span>
      ),
    },
    {
      key: 'patient.contact',
      label: 'Contact',
      sortable: false,
      render: (val, row) => (
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          {val || row?.patient?.contact || '—'}
        </span>
      ),
    },
    {
      key: 'doctor.name',
      label: 'Doctor',
      sortable: true,
      render: (val, row) => (
        <span style={{ color: 'var(--color-text-muted)' }}>
          {val || row?.doctor?.name || '—'}
        </span>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => getStatusBadge(val || row?.status),
    },
  ];

  const sortedDailyAppointments = useMemo(() => {
    if (!dailyData?.appointments) return [];
    const appts = [...dailyData.appointments];
    if (!dailySortKey) return appts;

    appts.sort((a, b) => {
      const valA = dailySortKey.includes('.')
        ? dailySortKey.split('.').reduce((acc, p) => acc?.[p], a)
        : a[dailySortKey];
      const valB = dailySortKey.includes('.')
        ? dailySortKey.split('.').reduce((acc, p) => acc?.[p], b)
        : b[dailySortKey];

      if (valA == null && valB == null) return 0;
      if (valA == null) return 1;
      if (valB == null) return -1;

      if (dailySortKey === 'date_time') {
        const diff = new Date(valA).getTime() - new Date(valB).getTime();
        return dailySortDir === 'asc' ? diff : -diff;
      }

      const cmp = String(valA).localeCompare(String(valB), undefined, { sensitivity: 'base' });
      return dailySortDir === 'asc' ? cmp : -cmp;
    });

    return appts;
  }, [dailyData, dailySortKey, dailySortDir]);

  const totalPages = Math.ceil(sortedDailyAppointments.length / pageSize) || 1;
  const paginatedAppointments = sortedDailyAppointments.slice(
    (dailyPage - 1) * pageSize,
    dailyPage * pageSize
  );

  const monthlyDoctorColumns = [
    { key: 'name', label: 'Doctor', sortable: false, render: (val, row) => val || row?.name || '—' },
    { key: 'specialization', label: 'Specialization', sortable: false, render: (val, row) => val || row?.specialization || '—' },
    { key: 'total', label: 'Visits', sortable: false, render: (val, row) => val ?? row?.total ?? 0 },
  ];

  const monthlyPatientColumns = [
    { key: 'patient_id', label: 'ID', sortable: false, render: (val, row) => val ?? row?.patient_id ?? '—' },
    { key: 'name', label: 'Patient', sortable: false, render: (val, row) => val || row?.name || '—' },
    { key: 'total', label: 'Visits', sortable: false, render: (val, row) => val ?? row?.total ?? 0 },
  ];

  const presets = [
    { label: 'Yesterday', value: getOffsetDate(-1) },
    { label: 'Today', value: getOffsetDate(0) },
    { label: 'Tomorrow', value: getOffsetDate(1) },
  ];

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <h1 className={styles.headerTitle}>Reports</h1>
          {isDoctor && (
            <span className={styles.scopeBadge}>
              <svg className={styles.scopeIcon} viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>My Consultations</span>
            </span>
          )}
        </div>

        {canRead && (
          <div className={styles.tabSwitch} role="tablist" aria-label="Report period">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'daily'}
              className={`${styles.tabBtn} ${activeTab === 'daily' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('daily')}
            >
              Daily
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'monthly'}
              className={`${styles.tabBtn} ${activeTab === 'monthly' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('monthly')}
            >
              Monthly
            </button>
          </div>
        )}
      </div>

      {!canRead && (
        <div className="card">
          <p className="text-muted">You do not have permission to view or generate reports.</p>
        </div>
      )}

      {canRead && activeTab === 'daily' && (
        <div className={styles.reportCard}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarInputs}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="report-daily-date">Date</label>
                <input
                  id="report-daily-date"
                  type="date"
                  className={`form-input ${styles.compactInput}`}
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                />
              </div>

              <div className={styles.fieldGroup}>
                <span className={styles.fieldLabel}>Quick Select</span>
                <div className={styles.presetGroup}>
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={`${styles.presetBtn} ${dailyDate === p.value ? styles.presetBtnActive : ''}`}
                      onClick={() => setDailyDate(p.value)}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Export</span>
              <div className={styles.buttonGroup}>
                <button
                  className={`btn btn-secondary ${styles.exportBtn}`}
                  onClick={() => handleExportDaily('pdf')}
                  type="button"
                  disabled={exportingDaily === 'pdf'}
                  title="Download PDF"
                >
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{exportingDaily === 'pdf' ? 'Exporting...' : 'PDF'}</span>
                </button>

                <button
                  className={`btn btn-secondary ${styles.exportBtn}`}
                  onClick={() => handleExportDaily('csv')}
                  type="button"
                  disabled={exportingDaily === 'csv'}
                  title="Download CSV"
                >
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{exportingDaily === 'csv' ? 'Exporting...' : 'CSV'}</span>
                </button>
              </div>
            </div>
          </div>

          {dailyError && (
            <div className={styles.errorText} role="alert">
              {dailyError}
            </div>
          )}

          {loadingDaily ? (
            <div className={styles.loadingState}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : (
            dailyData && (
              <div className={styles.resultSection}>
                <div className={styles.kpiGrid}>
                  <div className={styles.kpiCard}>
                    <span className={styles.kpiLabel}>Total</span>
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

                <div className={styles.tableSection}>
                  <div className={styles.sectionHeader}>
                    <h3 className={styles.sectionTitle}>Appointments — {dailyDate}</h3>
                    <span className={styles.sectionCount}>
                      {sortedDailyAppointments.length} {sortedDailyAppointments.length === 1 ? 'record' : 'records'}
                    </span>
                  </div>
                  <DataTable
                    columns={dailyColumns}
                    data={paginatedAppointments}
                    pagination={{
                      page: dailyPage,
                      limit: pageSize,
                      total: sortedDailyAppointments.length,
                      totalPages,
                    }}
                    onPageChange={(p) => setDailyPage(p)}
                    sortKey={dailySortKey}
                    sortDir={dailySortDir}
                    onSort={(key, dir) => {
                      setDailySortKey(key);
                      setDailySortDir(dir);
                      setDailyPage(1);
                    }}
                  />
                </div>
              </div>
            )
          )}
        </div>
      )}

      {canRead && activeTab === 'monthly' && (
        <div className={styles.reportCard}>
          <div className={styles.toolbar}>
            <div className={styles.toolbarInputs}>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="report-month-year">Year</label>
                <input
                  id="report-month-year"
                  type="number"
                  className={`form-input ${styles.compactInput}`}
                  style={{ width: 110 }}
                  value={monthYear}
                  onChange={(e) => setMonthYear(e.target.value)}
                  min="2000"
                  max="2100"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel} htmlFor="report-month-select">Month</label>
                <select
                  id="report-month-select"
                  className={`form-input ${styles.compactInput}`}
                  style={{ width: 160 }}
                  value={monthMonth}
                  onChange={(e) => setMonthMonth(e.target.value)}
                >
                  {MONTHS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.fieldGroup}>
              <span className={styles.fieldLabel}>Export</span>
              <div className={styles.buttonGroup}>
                <button
                  className={`btn btn-secondary ${styles.exportBtn}`}
                  onClick={() => handleExportMonthly('pdf')}
                  type="button"
                  disabled={exportingMonthly === 'pdf'}
                  title="Download PDF"
                >
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{exportingMonthly === 'pdf' ? 'Exporting...' : 'PDF'}</span>
                </button>

                <button
                  className={`btn btn-secondary ${styles.exportBtn}`}
                  onClick={() => handleExportMonthly('csv')}
                  type="button"
                  disabled={exportingMonthly === 'csv'}
                  title="Download CSV"
                >
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                  <span>{exportingMonthly === 'csv' ? 'Exporting...' : 'CSV'}</span>
                </button>
              </div>
            </div>
          </div>

          {monthlyError && (
            <div className={styles.errorText} role="alert">
              {monthlyError}
            </div>
          )}

          {loadingMonthly ? (
            <div className={styles.loadingState}>
              <div className="spinner" style={{ width: 24, height: 24 }} />
            </div>
          ) : (
            monthlyData && (
              <div className={styles.resultSection}>
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

                <div className={styles.splitTables}>
                  <div>
                    <h3 className={styles.sectionTitle}>
                      By Doctor ({(monthlyData.perDoctor || monthlyData.byDoctor || []).length})
                    </h3>
                    <DataTable
                      columns={monthlyDoctorColumns}
                      data={monthlyData.perDoctor || monthlyData.byDoctor || []}
                      pagination={{
                        page: 1,
                        limit: 100,
                        total: (monthlyData.perDoctor || monthlyData.byDoctor || []).length,
                        totalPages: 1,
                      }}
                    />
                  </div>
                  <div>
                    <h3 className={styles.sectionTitle}>
                      By Patient ({(monthlyData.perPatient || monthlyData.byPatient || []).length})
                    </h3>
                    <DataTable
                      columns={monthlyPatientColumns}
                      data={monthlyData.perPatient || monthlyData.byPatient || []}
                      pagination={{
                        page: 1,
                        limit: 100,
                        total: (monthlyData.perPatient || monthlyData.byPatient || []).length,
                        totalPages: 1,
                      }}
                    />
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
