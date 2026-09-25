'use strict';

const PDFDocument = require('pdfkit');

// ---------------------------------------------------------------------------
// Shared design tokens
// ---------------------------------------------------------------------------

const COLORS = {
  brand: '#0f766e',
  brandDark: '#0b5750',
  heading: '#1e293b',
  subheading: '#475569',
  muted: '#94a3b8',
  border: '#e2e8f0',
  borderStrong: '#cbd5e1',
  rowAlt: '#f8fafc',
  tableHead: '#f1f5f9',
  tableHeadText: '#475569',
  text: '#334155',
  white: '#ffffff',
  status: {
    completed: '#15803d',
    completedBg: '#dcfce7',
    cancelled: '#b91c1c',
    cancelledBg: '#fee2e2',
    scheduled: '#0369a1',
    scheduledBg: '#e0f2fe',
    default: '#475569',
    defaultBg: '#f1f5f9',
  },
};

const PAGE = {
  margin: 40,
  // Keep the bottom margin small so the footer (drawn close to the physical
  // bottom edge) never sits inside pdfkit's "reserved" bottom-margin band —
  // otherwise pdfkit silently auto-inserts extra blank pages when text is
  // written there, both during layout and again when the footer is redrawn
  // on every buffered page at the end.
  marginBottom: 18,
  width: 595.28, // A4 points
  height: 841.89,
};
const CONTENT_LEFT = PAGE.margin;
const CONTENT_RIGHT = PAGE.width - PAGE.margin; // 555.28
const CONTENT_WIDTH = CONTENT_RIGHT - CONTENT_LEFT;
const FOOTER_Y = PAGE.height - 50;
const SAFE_BOTTOM = FOOTER_Y - 15; // last y-coordinate content may start before we paginate

// ---------------------------------------------------------------------------
// Shared building blocks
// ---------------------------------------------------------------------------

/** Draws the branded header. Returns the y position just below it. */
function drawHeader(doc, { title, subtitle, requestedBy, requestedRole }) {
  const top = PAGE.margin;

  // Brand mark
  doc.roundedRect(CONTENT_LEFT, top, 34, 34, 8).fill(COLORS.brand);
  doc
    .fillColor(COLORS.white)
    .font('Helvetica-Bold')
    .fontSize(15)
    .text('CM', CONTENT_LEFT, top + 9, { width: 34, align: 'center' });

  const textX = CONTENT_LEFT + 46;
  doc
    .fillColor(COLORS.heading)
    .font('Helvetica-Bold')
    .fontSize(16)
    .text('ClinicMate Medical Center', textX, top, { width: CONTENT_WIDTH - 46 });
  doc
    .fillColor(COLORS.brandDark)
    .font('Helvetica-Bold')
    .fontSize(11)
    .text(title, textX, top + 20, { width: CONTENT_WIDTH - 46 });

  // Meta line, right aligned
  const generated = new Date().toLocaleString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLORS.muted)
    .text(`Generated ${generated}`, CONTENT_LEFT, top + 2, { width: CONTENT_WIDTH, align: 'right' })
    .text(`Requested by ${requestedBy || 'Staff'} (${requestedRole || 'User'})`, CONTENT_LEFT, top + 14, {
      width: CONTENT_WIDTH,
      align: 'right',
    });

  if (subtitle) {
    doc.fillColor(COLORS.subheading).fontSize(9).text(subtitle, CONTENT_LEFT, top + 40, {
      width: CONTENT_WIDTH,
      align: 'right',
    });
  }

  const dividerY = top + 52;
  doc.strokeColor(COLORS.borderStrong).lineWidth(1).moveTo(CONTENT_LEFT, dividerY).lineTo(CONTENT_RIGHT, dividerY).stroke();

  return dividerY + 22;
}

/** Draws a row of stat cards. Returns the y position just below them. */
function drawSummaryCards(doc, y, cards) {
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap * (cards.length - 1)) / cards.length;
  const cardHeight = 54;

  cards.forEach((card, i) => {
    const x = CONTENT_LEFT + i * (cardWidth + gap);
    doc.roundedRect(x, y, cardWidth, cardHeight, 6).fillAndStroke(COLORS.rowAlt, COLORS.border);
    doc.roundedRect(x, y, 4, cardHeight, 2).fill(card.color);
    doc
      .fillColor(card.color)
      .font('Helvetica-Bold')
      .fontSize(20)
      .text(String(card.count), x + 10, y + 10, { width: cardWidth - 16 });
    doc
      .fillColor(COLORS.subheading)
      .font('Helvetica')
      .fontSize(8.5)
      .text(card.label.toUpperCase(), x + 10, y + 34, { width: cardWidth - 16, characterSpacing: 0.3 });
  });

  return y + cardHeight + 26;
}

/** Draws a section title with a small accent bar. Returns y below it. */
function drawSectionTitle(doc, y, label) {
  doc.roundedRect(CONTENT_LEFT, y + 2, 3, 12, 1.5).fill(COLORS.brand);
  doc.fillColor(COLORS.heading).font('Helvetica-Bold').fontSize(11.5).text(label, CONTENT_LEFT + 10, y);
  return y + 22;
}

/** Draws a table header row for a given column layout. Returns y below it. */
function drawTableHead(doc, y, columns) {
  const headHeight = 22;
  doc.roundedRect(CONTENT_LEFT, y, CONTENT_WIDTH, headHeight, 3).fill(COLORS.tableHead);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.tableHeadText);
  columns.forEach((col) => {
    doc.text(col.label.toUpperCase(), col.x, y + 7, { width: col.width, align: col.align || 'left', characterSpacing: 0.2 });
  });
  return y + headHeight + 4;
}

/** Renders a small pill for a status value. */
function drawStatusPill(doc, status, x, y, width) {
  const key = (status || 'unknown').toLowerCase();
  const fg = COLORS.status[key] || COLORS.status.default;
  const bg = COLORS.status[`${key}Bg`] || COLORS.status.defaultBg;
  const label = (status || 'UNKNOWN').toUpperCase();
  const pillWidth = Math.min(width, doc.widthOfString(label, { font: 'Helvetica-Bold', size: 7.5 }) + 16);
  const pillX = x + width - pillWidth; // right align within column
  doc.roundedRect(pillX, y - 2, pillWidth, 14, 7).fill(bg);
  doc.font('Helvetica-Bold').fontSize(7.5).fillColor(fg).text(label, pillX, y + 1, { width: pillWidth, align: 'center' });
}

/** Draws the confidentiality footer + page number on the current page. */
function drawFooter(doc, pageLabel) {
  doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(CONTENT_LEFT, FOOTER_Y).lineTo(CONTENT_RIGHT, FOOTER_Y).stroke();
  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLORS.muted)
    .text('Confidential Medical Record — ClinicMate System. All rights reserved.', CONTENT_LEFT, FOOTER_Y + 8, {
      width: CONTENT_WIDTH - 60,
    });
  doc.text(pageLabel, CONTENT_RIGHT - 60, FOOTER_Y + 8, { width: 60, align: 'right' });
}

/** Adds page-number footers to every buffered page once the doc is complete. */
function finalizeWithPageNumbers(doc) {
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    drawFooter(doc, `Page ${i + 1} of ${range.count}`);
  }
}

// ---------------------------------------------------------------------------
// Daily report
// ---------------------------------------------------------------------------

function streamDailyReportPDF(res, data) {
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: PAGE.margin, bottom: PAGE.marginBottom, left: PAGE.margin, right: PAGE.margin },
  });
  doc.pipe(res);

  let y = drawHeader(doc, {
    title: 'Daily Appointments Report',
    subtitle: `Report Date: ${data.date}`,
    requestedBy: data.requestedBy,
    requestedRole: data.requestedRole,
  });

  y = drawSummaryCards(doc, y, [
    { label: 'Total', count: data.summary?.total ?? 0, color: COLORS.brand },
    { label: 'Scheduled', count: data.summary?.scheduled ?? 0, color: COLORS.status.scheduled },
    { label: 'Completed', count: data.summary?.completed ?? 0, color: COLORS.status.completed },
    { label: 'Cancelled', count: data.summary?.cancelled ?? 0, color: COLORS.status.cancelled },
  ]);

  y = drawSectionTitle(doc, y, 'Appointment Details');

  const columns = [
    { key: 'time', label: 'Time', x: CONTENT_LEFT + 6, width: 52 },
    { key: 'patient', label: 'Patient', x: CONTENT_LEFT + 62, width: 135 },
    { key: 'contact', label: 'Contact', x: CONTENT_LEFT + 200, width: 100 },
    { key: 'doctor', label: 'Doctor', x: CONTENT_LEFT + 303, width: 110 },
    { key: 'status', label: 'Status', x: CONTENT_LEFT + 416, width: CONTENT_RIGHT - (CONTENT_LEFT + 416), align: 'right' },
  ];

  const rowHeight = 20;
  let currentY = drawTableHead(doc, y, columns);
  const appointments = data.appointments || [];

  const ensureSpace = () => {
    if (currentY + rowHeight > SAFE_BOTTOM) {
      doc.addPage();
      currentY = PAGE.margin;
      currentY = drawTableHead(doc, currentY, columns);
    }
  };

  if (appointments.length === 0) {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(9.5)
      .text('No appointments recorded for this date.', CONTENT_LEFT, currentY + 10, { align: 'center', width: CONTENT_WIDTH });
  } else {
    appointments.forEach((apt, i) => {
      ensureSpace();

      if (i % 2 === 1) {
        doc.rect(CONTENT_LEFT, currentY, CONTENT_WIDTH, rowHeight).fill(COLORS.rowAlt);
      }

      const timeStr = apt.date_time
        ? new Date(apt.date_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : '—';
      const patientName = apt.patient?.name || 'Unknown Patient';
      const contact = apt.patient?.contact || '—';
      const doctorName = apt.doctor?.name || 'Unknown Doctor';
      const status = apt.status || 'unknown';

      const textY = currentY + 5;
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
      doc.text(timeStr, columns[0].x, textY, { width: columns[0].width });
      doc.font('Helvetica-Bold').text(patientName, columns[1].x, textY, { width: columns[1].width });
      doc.font('Helvetica').fillColor(COLORS.subheading).text(contact, columns[2].x, textY, { width: columns[2].width });
      doc.fillColor(COLORS.text).text(doctorName, columns[3].x, textY, { width: columns[3].width });

      drawStatusPill(doc, status, columns[4].x, textY, columns[4].width);

      currentY += rowHeight;
    });

    // bottom border under last row
    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(CONTENT_LEFT, currentY).lineTo(CONTENT_RIGHT, currentY).stroke();
  }

  finalizeWithPageNumbers(doc);
  doc.end();
}

// ---------------------------------------------------------------------------
// Monthly report
// ---------------------------------------------------------------------------

function streamMonthlyReportPDF(res, data) {
  const doc = new PDFDocument({
    size: 'A4',
    bufferPages: true,
    margins: { top: PAGE.margin, bottom: PAGE.marginBottom, left: PAGE.margin, right: PAGE.margin },
  });
  doc.pipe(res);

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const monthName = monthNames[(data.month || 1) - 1] || `Month ${data.month}`;

  let y = drawHeader(doc, {
    title: `Monthly Activity Report — ${monthName} ${data.year}`,
    requestedBy: data.requestedBy,
    requestedRole: data.requestedRole,
  });

  y = drawSummaryCards(doc, y, [
    { label: 'Total Visits', count: data.summary?.total ?? 0, color: COLORS.brand },
    { label: 'Scheduled', count: data.summary?.scheduled ?? 0, color: COLORS.status.scheduled },
    { label: 'Completed', count: data.summary?.completed ?? 0, color: COLORS.status.completed },
    { label: 'Cancelled', count: data.summary?.cancelled ?? 0, color: COLORS.status.cancelled },
  ]);

  // --- Section 1: Visits by Doctor -----------------------------------------
  y = drawSectionTitle(doc, y, 'Visits by Doctor');

  const doctorCols = [
    { key: 'name', label: 'Doctor Name', x: CONTENT_LEFT + 6, width: 220 },
    { key: 'spec', label: 'Specialization', x: CONTENT_LEFT + 230, width: 190 },
    { key: 'total', label: 'Total Visits', x: CONTENT_LEFT + 424, width: CONTENT_RIGHT - (CONTENT_LEFT + 424), align: 'right' },
  ];

  let currentY = drawTableHead(doc, y, doctorCols);
  const rowHeight = 20;
  const perDoctor = data.perDoctor || [];

  const ensureSpace = (columns) => {
    if (currentY + rowHeight > SAFE_BOTTOM) {
      doc.addPage();
      currentY = PAGE.margin;
      currentY = drawTableHead(doc, currentY, columns);
    }
  };

  if (perDoctor.length === 0) {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(9)
      .text('No doctor visits recorded for this month.', CONTENT_LEFT, currentY + 8, { align: 'center', width: CONTENT_WIDTH });
    currentY += 26;
  } else {
    perDoctor.forEach((entry, i) => {
      ensureSpace(doctorCols);
      if (i % 2 === 1) doc.rect(CONTENT_LEFT, currentY, CONTENT_WIDTH, rowHeight).fill(COLORS.rowAlt);

      const textY = currentY + 5;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.text).text(entry.name || 'Unknown', doctorCols[0].x, textY, {
        width: doctorCols[0].width,
      });
      doc
        .font('Helvetica')
        .fillColor(COLORS.subheading)
        .text(entry.specialization || 'General', doctorCols[1].x, textY, { width: doctorCols[1].width });
      doc
        .font('Helvetica-Bold')
        .fillColor(COLORS.brand)
        .text(String(entry.total), doctorCols[2].x, textY, { width: doctorCols[2].width, align: 'right' });

      currentY += rowHeight;
    });
    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(CONTENT_LEFT, currentY).lineTo(CONTENT_RIGHT, currentY).stroke();
  }

  currentY += 28;

  // --- Section 2: Visits by Patient ----------------------------------------
  if (currentY + 60 > SAFE_BOTTOM) {
    doc.addPage();
    currentY = PAGE.margin;
  }
  currentY = drawSectionTitle(doc, currentY, 'Visits by Patient');

  const patientCols = [
    { key: 'id', label: 'Patient ID', x: CONTENT_LEFT + 6, width: 90 },
    { key: 'name', label: 'Patient Name', x: CONTENT_LEFT + 100, width: 330 },
    { key: 'total', label: 'Total Visits', x: CONTENT_LEFT + 434, width: CONTENT_RIGHT - (CONTENT_LEFT + 434), align: 'right' },
  ];

  currentY = drawTableHead(doc, currentY, patientCols);
  const perPatient = data.perPatient || [];

  if (perPatient.length === 0) {
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(9)
      .text('No patient visits recorded for this month.', CONTENT_LEFT, currentY + 8, { align: 'center', width: CONTENT_WIDTH });
  } else {
    perPatient.forEach((entry, i) => {
      ensureSpace(patientCols);
      if (i % 2 === 1) doc.rect(CONTENT_LEFT, currentY, CONTENT_WIDTH, rowHeight).fill(COLORS.rowAlt);

      const textY = currentY + 5;
      doc
        .font('Helvetica')
        .fontSize(8.5)
        .fillColor(COLORS.subheading)
        .text(String(entry.patient_id ?? '—'), patientCols[0].x, textY, { width: patientCols[0].width });
      doc
        .font('Helvetica-Bold')
        .fillColor(COLORS.text)
        .text(entry.name || 'Unknown', patientCols[1].x, textY, { width: patientCols[1].width });
      doc
        .font('Helvetica-Bold')
        .fillColor(COLORS.brand)
        .text(String(entry.total), patientCols[2].x, textY, { width: patientCols[2].width, align: 'right' });

      currentY += rowHeight;
    });
    doc.strokeColor(COLORS.border).lineWidth(0.5).moveTo(CONTENT_LEFT, currentY).lineTo(CONTENT_RIGHT, currentY).stroke();
  }

  finalizeWithPageNumbers(doc);
  doc.end();
}

module.exports = {
  streamDailyReportPDF,
  streamMonthlyReportPDF,
};