import { useState } from 'react';
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

  const [dailyDate, setDailyDate] = useState(new Date().toISOString().split('T')[0]);
  const [monthYear, setMonthYear] = useState(String(new Date().getFullYear()));
  const [monthMonth, setMonthMonth] = useState(String(new Date().getMonth() + 1));

  const handleDaily = async () => {
    if (!dailyDate) {
      toast.error('Please select a date');
      return;
    }
    setLoadingDaily(true);
    setError(null);
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
      render: (row) => (row.date_time ? new Date(row.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'),
    },
    { key: 'patient.name', label: 'Patient', sortable: true },
    { key: 'patient.contact', label: 'Contact', sortable: false, render: (row) => row.patient?.contact || '—' },
    { key: 'doctor.name', label: 'Doctor', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        let badgeColor = 'badge-primary';
        if (row.status === 'completed') badgeColor = 'badge-success';
        if (row.status === 'cancelled') badgeColor = 'badge-error';
        return <span className={`badge ${badgeColor}`}>{row.status}</span>;
      },
    },
  ];

  const monthlyDoctorColumns = [
    { key: 'name', label: 'Doctor', sortable: true },
    { key: 'specialization', label: 'Specialization', sortable: true },
    { key: 'total', label: 'Total Visits', sortable: true },
  ];

  const monthlyPatientColumns = [
    { key: 'patient_id', label: 'Patient ID', sortable: true },
    { key: 'name', label: 'Patient', sortable: true },
    { key: 'total', label: 'Total Visits', sortable: true },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600 }}>
            Reports & Analytics
          </h2>
          <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
            Generate executive summaries and export professional PDF / CSV reports.
          </p>
        </div>

        {isDoctor && (
          <div style={{ background: 'var(--color-primary-50, #f0fdf4)', border: '1px solid var(--color-primary-200, #bbf7d0)', padding: 'var(--space-2) var(--space-4)', borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)', color: '#166534' }}>
            🔒 Doctor Mode: Data restricted to your assigned appointments only.
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
                <label className="form-label">Report Date</label>
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
                {loadingDaily ? 'Generating...' : 'View Report'}
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

                <DataTable
                  columns={dailyColumns}
                  data={dailyData.appointments || []}
                  pagination={{ page: 1, limit: 50, total: dailyData.appointments?.length || 0, totalPages: 1 }}
                  onPageChange={() => {}}
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
                {loadingMonthly ? 'Generating...' : 'View Report'}
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
