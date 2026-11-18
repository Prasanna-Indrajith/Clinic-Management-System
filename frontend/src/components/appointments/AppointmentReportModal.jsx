import { useState, useEffect } from 'react';
import { medicalRecordsApi } from '../../api/client';
import Modal from '../ui/Modal';
import styles from './AppointmentReportModal.module.css';

const formatScheduledDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '—';
  const datePart = d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timePart = d.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${datePart} · ${timePart}`;
};

const splitPrescriptionLines = (text) => {
  if (!text) return [];
  return String(text)
    .split(/\n+|;\s*|,\s+/)
    .map((line) => line.trim())
    .filter(Boolean);
};

export default function AppointmentReportModal({ isOpen, appointment, onClose }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !appointment?.appointment_id) return;
    let isCurrent = true;
    setLoading(true);
    setError(null);
    setReport(null);

    medicalRecordsApi
      .getByAppointment(appointment.appointment_id)
      .then((res) => {
        if (isCurrent) setReport(res.data?.data || null);
      })
      .catch((err) => {
        if (isCurrent) setError(err.message || 'Failed to load appointment report');
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });

    return () => {
      isCurrent = false;
    };
  }, [isOpen, appointment]);

  const appt = report?.appointment || appointment;
  const record = report?.medicalRecord || null;
  const doctorName = record?.doctor?.name || appt?.doctor?.name || 'Physician';
  const specialization = record?.doctor?.specialization || appt?.doctor?.specialization;
  const rxLines = splitPrescriptionLines(record?.prescription);

  return (
    <Modal
      isOpen={isOpen}
      title="Consultation Report"
      onClose={onClose}
      size="md"
    >
      {loading ? (
        <div className="flex justify-center items-center" style={{ padding: 'var(--space-10)' }}>
          <div className="spinner" style={{ width: 28, height: 28 }} />
        </div>
      ) : error ? (
        <div style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)' }} role="alert">
          {error}
        </div>
      ) : (
        <div className={styles.body}>
          <div className={styles.topRow}>
            <div className={styles.titleBlock}>
              <h4 className={styles.diagnosis}>
                {record ? record.diagnosis : 'Consultation Summary'}
              </h4>
              <div className={styles.subMetaRow}>
                <span className={styles.doctorRow}>
                  <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                  </svg>
                  <span>
                    {doctorName}
                    {specialization ? ` · ${specialization}` : ''}
                  </span>
                </span>
                {appt?.patient?.name && (
                  <span className={styles.patientRow}>
                    <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                    <span>{appt.patient.name}</span>
                  </span>
                )}
              </div>
            </div>

            <span className={styles.dateText}>
              <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{formatScheduledDateTime(appt?.date_time)}</span>
            </span>
          </div>

          {record ? (
            <div className={styles.details}>
              {rxLines.length > 0 && (
                <div className={styles.detailRow}>
                  <svg
                    className={styles.rxIcon}
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z" />
                    <line x1="8.5" y1="8.5" x2="15.5" y2="15.5" />
                  </svg>
                  <div className={styles.rxLines}>
                    {rxLines.map((line, idx) => (
                      <div key={idx} className={styles.rxLine}>{line}</div>
                    ))}
                  </div>
                </div>
              )}

              {record.notes && (
                <div className={styles.detailRow}>
                  <svg
                    className={styles.notesIcon}
                    viewBox="0 0 24 24"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                  <p className={styles.notesText}>{record.notes}</p>
                </div>
              )}
            </div>
          ) : (
            <p className={styles.emptyText}>
              No clinical entry was recorded for this visit.
              {appt?.remarks ? ` Remarks: ${appt.remarks}` : ''}
            </p>
          )}

          <div className={styles.footer}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
