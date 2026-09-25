'use strict';

const PDFDocument = require('pdfkit');

/**
 * Stream a styled Daily Report PDF directly to an HTTP response stream.
 *
 * @param {object} res - Express response stream
 * @param {object} data - { date, summary, appointments, requestedBy, requestedRole }
 */
function streamDailyReportPDF(res, data) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  // Header
  doc.fillColor('#0f766e').fontSize(22).text('ClinicMate Medical Center', { align: 'left' });
  doc.fillColor('#334155').fontSize(14).text('Daily Appointments Report', { align: 'left' });
  doc.fillColor('#64748b').fontSize(10).text(`Report Date: ${data.date} | Generated: ${new Date().toISOString()}`, { align: 'left' });
  doc.text(`Requested By: ${data.requestedBy || 'Staff'} (${data.requestedRole || 'User'})`, { align: 'left' });
  doc.moveDown(0.8);

  // Horizontal divider
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.8);

  // Summary Cards
  const summaryY = doc.y;
  const cardWidth = 115;
  const cardHeight = 45;
  const cards = [
    { label: 'Total', count: data.summary?.total ?? 0, color: '#0f766e' },
    { label: 'Scheduled', count: data.summary?.scheduled ?? 0, color: '#0284c7' },
    { label: 'Completed', count: data.summary?.completed ?? 0, color: '#16a34a' },
    { label: 'Cancelled', count: data.summary?.cancelled ?? 0, color: '#dc2626' },
  ];

  cards.forEach((card, index) => {
    const x = 40 + index * (cardWidth + 5);
    doc.roundedRect(x, summaryY, cardWidth, cardHeight, 4).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor(card.color).fontSize(16).text(String(card.count), x, summaryY + 8, { width: cardWidth, align: 'center' });
    doc.fillColor('#64748b').fontSize(9).text(card.label, x, summaryY + 28, { width: cardWidth, align: 'center' });
  });

  doc.y = summaryY + cardHeight + 20;

  // Appointments Table
  doc.fillColor('#1e293b').fontSize(12).text('Appointment Details', 40, doc.y);
  doc.moveDown(0.4);

  const tableTop = doc.y;
  doc.rect(40, tableTop, 515, 20).fill('#f1f5f9');
  doc.fillColor('#334155').fontSize(9);
  doc.text('Time', 45, tableTop + 5, { width: 50 });
  doc.text('Patient', 100, tableTop + 5, { width: 130 });
  doc.text('Contact', 235, tableTop + 5, { width: 85 });
  doc.text('Doctor', 325, tableTop + 5, { width: 110 });
  doc.text('Status', 440, tableTop + 5, { width: 80, align: 'right' });

  let currentY = tableTop + 22;
  const appointments = data.appointments || [];

  if (appointments.length === 0) {
    doc.fillColor('#64748b').fontSize(10).text('No appointments recorded for this date.', 45, currentY + 10, { align: 'center', width: 505 });
    currentY += 35;
  } else {
    appointments.forEach((apt, i) => {
      if (currentY > 730) {
        doc.addPage();
        currentY = 40;
      }

      if (i % 2 === 1) {
        doc.rect(40, currentY, 515, 18).fill('#f8fafc');
      }

      const timeStr = apt.date_time ? new Date(apt.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
      const patientName = apt.patient?.name || 'Unknown Patient';
      const contact = apt.patient?.contact || '—';
      const doctorName = apt.doctor?.name || 'Unknown Doctor';
      const status = apt.status || 'unknown';

      doc.fillColor('#334155').fontSize(8.5);
      doc.text(timeStr, 45, currentY + 4, { width: 50 });
      doc.text(patientName, 100, currentY + 4, { width: 130 });
      doc.text(contact, 235, currentY + 4, { width: 85 });
      doc.text(doctorName, 325, currentY + 4, { width: 110 });

      let statusColor = '#334155';
      if (status === 'completed') statusColor = '#16a34a';
      else if (status === 'cancelled') statusColor = '#dc2626';
      else if (status === 'scheduled') statusColor = '#0284c7';

      doc.fillColor(statusColor).text(status.toUpperCase(), 440, currentY + 4, { width: 80, align: 'right' });
      currentY += 19;
    });
  }

  // Footer
  const footerY = 780;
  doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, footerY).lineTo(555, footerY).stroke();
  doc.fillColor('#94a3b8').fontSize(8).text('Confidential Medical Record — ClinicMate System. All rights reserved.', 40, footerY + 6, { align: 'center', width: 515 });

  doc.end();
}

/**
 * Stream a styled Monthly Report PDF directly to an HTTP response stream.
 *
 * @param {object} res - Express response stream
 * @param {object} data - { year, month, summary, perDoctor, perPatient, requestedBy, requestedRole }
 */
function streamMonthlyReportPDF(res, data) {
  const doc = new PDFDocument({ margin: 40, size: 'A4' });
  doc.pipe(res);

  // Month name helper
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[(data.month || 1) - 1] || `Month ${data.month}`;

  // Header
  doc.fillColor('#0f766e').fontSize(22).text('ClinicMate Medical Center', { align: 'left' });
  doc.fillColor('#334155').fontSize(14).text(`Monthly Activity Report — ${monthName} ${data.year}`, { align: 'left' });
  doc.fillColor('#64748b').fontSize(10).text(`Generated: ${new Date().toISOString()}`, { align: 'left' });
  doc.text(`Requested By: ${data.requestedBy || 'Staff'} (${data.requestedRole || 'User'})`, { align: 'left' });
  doc.moveDown(0.8);

  // Horizontal divider
  doc.strokeColor('#cbd5e1').lineWidth(1).moveTo(40, doc.y).lineTo(555, doc.y).stroke();
  doc.moveDown(0.8);

  // Summary Cards
  const summaryY = doc.y;
  const cardWidth = 115;
  const cardHeight = 45;
  const cards = [
    { label: 'Total Visits', count: data.summary?.total ?? 0, color: '#0f766e' },
    { label: 'Scheduled', count: data.summary?.scheduled ?? 0, color: '#0284c7' },
    { label: 'Completed', count: data.summary?.completed ?? 0, color: '#16a34a' },
    { label: 'Cancelled', count: data.summary?.cancelled ?? 0, color: '#dc2626' },
  ];

  cards.forEach((card, index) => {
    const x = 40 + index * (cardWidth + 5);
    doc.roundedRect(x, summaryY, cardWidth, cardHeight, 4).fillAndStroke('#f8fafc', '#e2e8f0');
    doc.fillColor(card.color).fontSize(16).text(String(card.count), x, summaryY + 8, { width: cardWidth, align: 'center' });
    doc.fillColor('#64748b').fontSize(9).text(card.label, x, summaryY + 28, { width: cardWidth, align: 'center' });
  });

  doc.y = summaryY + cardHeight + 20;

  // Section 1: Visits per Doctor
  doc.fillColor('#1e293b').fontSize(12).text('Visits by Doctor', 40, doc.y);
  doc.moveDown(0.4);

  let currentY = doc.y;
  doc.rect(40, currentY, 515, 20).fill('#f1f5f9');
  doc.fillColor('#334155').fontSize(9);
  doc.text('Doctor Name', 45, currentY + 5, { width: 220 });
  doc.text('Specialization', 270, currentY + 5, { width: 170 });
  doc.text('Total Visits', 445, currentY + 5, { width: 75, align: 'right' });
  currentY += 22;

  const perDoctor = data.perDoctor || [];
  if (perDoctor.length === 0) {
    doc.fillColor('#64748b').fontSize(9).text('No doctor visits recorded for this month.', 45, currentY + 6, { align: 'center', width: 505 });
    currentY += 25;
  } else {
    perDoctor.forEach((docEntry, i) => {
      if (i % 2 === 1) {
        doc.rect(40, currentY, 515, 18).fill('#f8fafc');
      }
      doc.fillColor('#334155').fontSize(8.5);
      doc.text(docEntry.name || 'Unknown', 45, currentY + 4, { width: 220 });
      doc.text(docEntry.specialization || 'General', 270, currentY + 4, { width: 170 });
      doc.fillColor('#0f766e').text(String(docEntry.total), 445, currentY + 4, { width: 75, align: 'right' });
      currentY += 19;
    });
  }

  currentY += 15;
  if (currentY > 650) {
    doc.addPage();
    currentY = 40;
  }

  // Section 2: Visits per Patient
  doc.fillColor('#1e293b').fontSize(12).text('Visits by Patient', 40, currentY);
  currentY += 18;

  doc.rect(40, currentY, 515, 20).fill('#f1f5f9');
  doc.fillColor('#334155').fontSize(9);
  doc.text('Patient ID', 45, currentY + 5, { width: 80 });
  doc.text('Patient Name', 130, currentY + 5, { width: 310 });
  doc.text('Total Visits', 445, currentY + 5, { width: 75, align: 'right' });
  currentY += 22;

  const perPatient = data.perPatient || [];
  if (perPatient.length === 0) {
    doc.fillColor('#64748b').fontSize(9).text('No patient visits recorded for this month.', 45, currentY + 6, { align: 'center', width: 505 });
    currentY += 25;
  } else {
    perPatient.forEach((patEntry, i) => {
      if (currentY > 730) {
        doc.addPage();
        currentY = 40;
      }
      if (i % 2 === 1) {
        doc.rect(40, currentY, 515, 18).fill('#f8fafc');
      }
      doc.fillColor('#334155').fontSize(8.5);
      doc.text(String(patEntry.patient_id || '—'), 45, currentY + 4, { width: 80 });
      doc.text(patEntry.name || 'Unknown', 130, currentY + 4, { width: 310 });
      doc.fillColor('#0f766e').text(String(patEntry.total), 445, currentY + 4, { width: 75, align: 'right' });
      currentY += 19;
    });
  }

  // Footer
  const footerY = 780;
  doc.strokeColor('#e2e8f0').lineWidth(0.5).moveTo(40, footerY).lineTo(555, footerY).stroke();
  doc.fillColor('#94a3b8').fontSize(8).text('Confidential Medical Record — ClinicMate System. All rights reserved.', 40, footerY + 6, { align: 'center', width: 515 });

  doc.end();
}

module.exports = {
  streamDailyReportPDF,
  streamMonthlyReportPDF,
};
