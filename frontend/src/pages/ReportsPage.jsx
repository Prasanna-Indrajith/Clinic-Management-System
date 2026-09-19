import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { reportsApi } from '../api/client';
import DataTable from '../components/ui/DataTable';
import toast from 'react-hot-toast';

const MONTHS = [
  { value: '', label: 'All' },
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

  const [loading, setLoading] = useState(false);
  const [dailyData, setDailyData] = useState(null);
  const [monthlyData, setMonthlyData] = useState(null);
  const [error, setError] = useState(null);

  const [dailyDate, setDailyDate] = useState('');
  const [monthYear, setMonthYear] = useState('');
  const [monthMonth, setMonthMonth] = useState('');

  const handleDaily = async () => {
    if (!dailyDate) {
      toast.error('Please select a date');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.daily({ date: dailyDate });
      setDailyData(res.data);
      setMonthlyData(null);
    } catch (err) {
      setError(err.message || 'Failed to generate daily report');
      setDailyData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleMonthly = async () => {
    if (!monthYear || !monthMonth) {
      toast.error('Please select year and month');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await reportsApi.monthly({ year: parseInt(monthYear, 10), month: parseInt(monthMonth, 10) });
      setMonthlyData(res.data);
      setDailyData(null);
    } catch (err) {
      setError(err.message || 'Failed to generate monthly report');
      setMonthlyData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadDailyCSV = () => {
    if (!dailyData) return;
    const rows = [
      ['Date', dailyData.date],
      ['Total', dailyData.summary.total],
      ['Scheduled', dailyData.summary.scheduled],
      ['Completed', dailyData.summary.completed],
      ['Cancelled', dailyData.summary.cancelled],
      [],
      ['Patient ID', 'Patient Name', 'Contact', 'Doctor', 'Status', 'Date/Time'],
      ...dailyData.appointments.map((a) => [
        a.patient.patient_id,
        a.patient.name,
        a.patient.contact || '',
        a.doctor.name,
        a.status,
        a.date_time,
      ]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daily-report-${dailyData.date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const handleDownloadMonthlyCSV = () => {
    if (!monthlyData) return;
    const rows = [
      ['Month', monthlyData.year, '-', monthlyData.month],
      ['Total', monthlyData.summary.total],
      ['Scheduled', monthlyData.summary.scheduled],
      ['Completed', monthlyData.summary.completed],
      ['Cancelled', monthlyData.summary.cancelled],
      [],
      ['Doctor ID', 'Doctor Name', 'Specialization', 'Total Visits'],
      ...monthlyData.perDoctor.map((d) => [d.doctor_id, d.name, d.specialization, d.total]),
      [],
      ['Patient ID', 'Patient Name', 'Total Visits'],
      ...monthlyData.perPatient.map((p) => [p.patient_id, p.name, p.total]),
    ];
    const csv = rows.map((r) => r.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-report-${monthlyData.year}-${String(monthlyData.month).padStart(2, '0')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV downloaded');
  };

  const dailyColumns = [
    { key: 'patient.name', label: 'Patient', sortable: true },
    { key: 'doctor.name', label: 'Doctor', sortable: true },
    { key: 'status', label: 'Status', sortable: true },
    { key: 'date_time', label: 'Date/Time', sortable: true },
  ];

  const monthlyDoctorColumns = [
    { key: 'name', label: 'Doctor', sortable: true },
    { key: 'specialization', label: 'Specialization', sortable: true },
    { key: 'total', label: 'Total Visits', sortable: true },
  ];

  const monthlyPatientColumns = [
    { key: 'name', label: 'Patient', sortable: true },
    { key: 'total', label: 'Total Visits', sortable: true },
  ];

  return (
    <div>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-3xl)', fontWeight: 600 }}>
        Reports
      </h2>
      <p className="text-muted" style={{ marginTop: 'var(--space-1)' }}>
        Generate daily and monthly reports with CSV export.
      </p>

      {!canRead && (
        <div className="card" style={{ marginTop: 'var(--space-6)' }}>
          <p className="text-muted">You do not have permission to view reports.</p>
        </div>
      )}

      {canRead && (
        <>
          {/* Daily Report */}
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              Daily Report
            </h3>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 200 }}>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={dailyDate}
                  onChange={(e) => setDailyDate(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleDaily} type="button" disabled={loading}>
                {loading ? 'Generating...' : 'Generate Daily Report'}
              </button>
              {dailyData && (
                <button className="btn btn-secondary" onClick={handleDownloadDailyCSV} type="button">
                  Download CSV
                </button>
              )}
            </div>

            {error && (
              <div style={{ color: 'var(--color-error)', marginTop: 'var(--space-4)' }} role="alert">
                {error}
              </div>
            )}

            {dailyData && !loading && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                  <div>Total: <strong>{dailyData.summary.total}</strong></div>
                  <div>Scheduled: <strong>{dailyData.summary.scheduled}</strong></div>
                  <div>Completed: <strong>{dailyData.summary.completed}</strong></div>
                  <div>Cancelled: <strong>{dailyData.summary.cancelled}</strong></div>
                </div>
                <DataTable
                  columns={dailyColumns}
                  data={dailyData.appointments}
                  pagination={{ page: 1, limit: 50, total: dailyData.appointments.length, totalPages: 1 }}
                  onPageChange={() => {}}
                />
              </div>
            )}
          </div>

          {/* Monthly Report */}
          <div className="card" style={{ marginTop: 'var(--space-6)' }}>
            <h3 style={{ fontSize: 'var(--text-xl)', fontWeight: 600, marginBottom: 'var(--space-4)' }}>
              Monthly Report
            </h3>
            <div style={{ display: 'flex', gap: 'var(--space-4)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
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
              <div className="form-group" style={{ flex: 1, minWidth: 150 }}>
                <label className="form-label">Month</label>
                <select
                  className="form-input"
                  value={monthMonth}
                  onChange={(e) => setMonthMonth(e.target.value)}
                >
                  <option value="">Select month</option>
                  {MONTHS.filter((m) => m.value).map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <button className="btn btn-primary" onClick={handleMonthly} type="button" disabled={loading}>
                {loading ? 'Generating...' : 'Generate Monthly Report'}
              </button>
              {monthlyData && (
                <button className="btn btn-secondary" onClick={handleDownloadMonthlyCSV} type="button">
                  Download CSV
                </button>
              )}
            </div>

            {error && (
              <div style={{ color: 'var(--color-error)', marginTop: 'var(--space-4)' }} role="alert">
                {error}
              </div>
            )}

            {monthlyData && !loading && (
              <div style={{ marginTop: 'var(--space-6)' }}>
                <div style={{ display: 'flex', gap: 'var(--space-6)', marginBottom: 'var(--space-6)', flexWrap: 'wrap' }}>
                  <div>Total: <strong>{monthlyData.summary.total}</strong></div>
                  <div>Scheduled: <strong>{monthlyData.summary.scheduled}</strong></div>
                  <div>Completed: <strong>{monthlyData.summary.completed}</strong></div>
                  <div>Cancelled: <strong>{monthlyData.summary.cancelled}</strong></div>
                </div>

                <h4 style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Visits per Doctor</h4>
                <DataTable
                  columns={monthlyDoctorColumns}
                  data={monthlyData.perDoctor}
                  pagination={{ page: 1, limit: 50, total: monthlyData.perDoctor.length, totalPages: 1 }}
                  onPageChange={() => {}}
                />

                <h4 style={{ fontWeight: 600, marginTop: 'var(--space-6)', marginBottom: 'var(--space-2)' }}>Visits per Patient</h4>
                <DataTable
                  columns={monthlyPatientColumns}
                  data={monthlyData.perPatient}
                  pagination={{ page: 1, limit: 50, total: monthlyData.perPatient.length, totalPages: 1 }}
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
