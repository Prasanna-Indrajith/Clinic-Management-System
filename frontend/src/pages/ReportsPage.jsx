import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import toast from 'react-hot-toast';

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
      setMonthlyData(null);
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
      setDailyData(null);
    } catch (err) {
      setError(err.message || 'Failed to generate monthly report');
      setMonthlyData(null);
    } finally {
      setLoadingMonthly(false);
    }
  };

  const setDatePreset = (offsetDays) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setDailyDate(formatLocalDate(d));
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExportDaily = async (format) => {
    if (!dailyDate) {
      toast.error('Please select a date');
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
      toast.error('Please select year and month');
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

  const dailyColumns = [
    {
      key: 'date_time',
      label: 'Time',
      sortable: true,
      render: (val, row) => {
        const dt = val || row?.date_time;
        if (!dt) return '—';
        return new Date(dt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      },
    },
    {
      key: 'patient.name',
      label: 'Patient',
      sortable: true,
      render: (val, row) => val || row?.patient?.name || '—',
    },
    {
      key: 'patient.contact',
      label: 'Contact',
      sortable: false,
      render: (val, row) => val || row?.patient?.contact || '—',
    },
    {
      key: 'doctor.name',
      label: 'Doctor',
      sortable: true,
      render: (val, row) => val || row?.doctor?.name || '—',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (val, row) => {
        const status = (val || row?.status || 'unknown').toLowerCase();
        let badgeColor = 'badge-primary';
        if (status === 'completed') badgeColor = 'badge-success';
        if (status === 'cancelled') badgeColor = 'badge-error';
        if (status === 'scheduled') badgeColor = 'badge-warning';
        return <span className={`badge ${badgeColor}`}>{status.toUpperCase()}</span>;
      },
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
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600 }}>
            Reports & Analytics
          </h2>
          <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
            Generate operational appointment reports and export high-resolution PDF / CSV documents.
          </p>
        </div>

        {isDoctor && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: '#166534' }}>
            🔒 Doctor Mode: Report metrics are automatically scoped to your assigned appointments.
          </div>
        )}
      </div>

      {!canRead && (
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <p className="text-muted">You do not have permission to view or generate reports.</p>
        </div>
      )}

      {canRead && (
        <>
          {/* Daily Report Card */}
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>
                📅 Daily Appointments Report
              </h3>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 220 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1)' }}>
                  <label className="form-label" style={{ marginBottom: 0 }}>Report Date</label>
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={() => setDatePreset(-1)}
                    >
                      Yesterday
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={() => setDatePreset(0)}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ fontSize: '11px', padding: '2px 6px' }}
                      onClick={() => setDatePreset(1)}
                    >
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

              <button
                className="btn btn-primary"
                onClick={handleDaily}
                type="button"
                disabled={loadingDaily}
              >
                {loadingDaily ? 'Loading Report...' : '🔍 View Report'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => handleExportDaily('pdf')}
                type="button"
                disabled={exportingDaily === 'pdf'}
                title="Download high-resolution PDF document"
              >
                {exportingDaily === 'pdf' ? 'Generating PDF...' : '📄 Download PDF'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => handleExportDaily('csv')}
                type="button"
                disabled={exportingDaily === 'csv'}
                title="Download CSV spreadsheet"
              >
                {exportingDaily === 'csv' ? 'Generating CSV...' : '📊 Download CSV'}
              </button>
            </div>

            {error && (
              <div style={{ color: 'var(--color-error)', marginTop: 'var(--space-4)' }} role="alert">
                {error}
              </div>
            )}

            {dailyData && !loadingDaily && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                {/* Metric Summary Ribbon */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Total Appointments</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-primary-600)' }}>{dailyData.summary?.total ?? 0}</div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Scheduled</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#0284c7' }}>{dailyData.summary?.scheduled ?? 0}</div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Completed</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#16a34a' }}>{dailyData.summary?.completed ?? 0}</div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Cancelled</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#dc2626' }}>{dailyData.summary?.cancelled ?? 0}</div>
                  </div>
                </div>

                <div style={{ marginBottom: 'var(--space-3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontWeight: 600, fontSize: 'var(--text-md)' }}>
                    Appointments on {dailyDate} ({sortedDailyAppointments.length} record{sortedDailyAppointments.length === 1 ? '' : 's'})
                  </h4>
                  {sortedDailyAppointments.length > 0 && (
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                      Click any column header to sort
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

          {/* Monthly Report Card */}
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600 }}>
                📈 Monthly Activity Summary
              </h3>
            </div>

            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 140 }}>
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

              <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
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

              <button
                className="btn btn-primary"
                onClick={handleMonthly}
                type="button"
                disabled={loadingMonthly}
              >
                {loadingMonthly ? 'Loading Report...' : '🔍 View Report'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => handleExportMonthly('pdf')}
                type="button"
                disabled={exportingMonthly === 'pdf'}
                title="Download high-resolution PDF document"
              >
                {exportingMonthly === 'pdf' ? 'Generating PDF...' : '📄 Download PDF'}
              </button>

              <button
                className="btn btn-secondary"
                onClick={() => handleExportMonthly('csv')}
                type="button"
                disabled={exportingMonthly === 'csv'}
                title="Download CSV spreadsheet"
              >
                {exportingMonthly === 'csv' ? 'Generating CSV...' : '📊 Download CSV'}
              </button>
            </div>

            {monthlyData && !loadingMonthly && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                {/* Metric Summary Ribbon */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Total Visits</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: 'var(--color-primary-600)' }}>{monthlyData.summary?.total ?? 0}</div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Scheduled</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#0284c7' }}>{monthlyData.summary?.scheduled ?? 0}</div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Completed</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#16a34a' }}>{monthlyData.summary?.completed ?? 0}</div>
                  </div>
                  <div style={{ padding: 'var(--space-3)', background: 'var(--color-surface-subtle, #f8fafc)', borderRadius: 'var(--radius-md)', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Cancelled</div>
                    <div style={{ fontSize: 'var(--text-2xl)', fontWeight: 700, color: '#dc2626' }}>{monthlyData.summary?.cancelled ?? 0}</div>
                  </div>
                </div>

                <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Visits by Doctor</h4>
                <DataTable
                  columns={monthlyDoctorColumns}
                  data={monthlyData.perDoctor || []}
                  pagination={{ page: 1, limit: 50, total: monthlyData.perDoctor?.length || 0, totalPages: 1 }}
                  onPageChange={() => {}}
                />

                <h4 style={{ fontWeight: 600, marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>Visits by Patient</h4>
                <DataTable
                  columns={monthlyPatientColumns}
                  data={monthlyData.perPatient || []}
                  pagination={{ page: 1, limit: 50, total: monthlyData.perPatient?.length || 0, totalPages: 1 }}
                  onPageChange={() => {}}
                />
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
