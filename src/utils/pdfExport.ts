import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Member, AttendanceRecord, CashTransaction } from '../types';
import { formatIndonesianDate, formatRupiah } from './formatters';

interface DailyAttendancePdfOptions {
  dateStr: string;
  members: Member[];
  attendanceRecords: AttendanceRecord[];
}

interface HistoryAttendancePdfOptions {
  title?: string;
  subtitle?: string;
  records: AttendanceRecord[];
}

interface MembersListPdfOptions {
  members: Member[];
  filterGrade?: string;
  filterGender?: string;
}

interface WeeklyCashPdfOptions {
  monthLabel: string;
  weekNum: number;
  weekRange: string;
  members: Member[];
  cash: CashTransaction[];
  standardNominal?: number;
  selectedMonthKey: string;
}

interface CashLedgerPdfOptions {
  cash: CashTransaction[];
  periodLabel?: string;
  filterType?: string;
}

/**
 * Helper: Add official School / Organization PDF Header
 */
function drawOfficialHeader(doc: jsPDF, title: string, subtitle: string) {
  doc.setFillColor(30, 58, 138); // Navy Blue 900
  doc.rect(0, 0, 210, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ROBOTIC MAN 2 KOTA BEKASI', 105, 10, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(title, 105, 16, { align: 'center' });

  if (subtitle) {
    doc.setFontSize(8);
    doc.text(subtitle, 105, 21, { align: 'center' });
  }
}

/**
 * Helper: Add official dual signature block at bottom
 */
function drawSignatureBlock(
  doc: jsPDF,
  finalY: number,
  nowStr: string,
  leftRole: string = 'Club Faculty Advisor',
  rightRole: string = 'Club Secretary / Officer'
) {
  let signY = finalY + 12;
  if (signY > 250) {
    doc.addPage();
    signY = 30;
  }

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  // Left Signature: Advisor
  doc.text('Acknowledged by,', 24, signY);
  doc.text(leftRole, 24, signY + 5);
  doc.text('( ......................................... )', 24, signY + 28);
  doc.setFontSize(8);
  doc.text('Staff ID: ....................................', 24, signY + 33);

  // Right Signature: Officer
  doc.setFontSize(9);
  doc.text(`Bekasi, ${nowStr}`, 145, signY);
  doc.text(rightRole, 145, signY + 5);
  doc.text('( ......................................... )', 145, signY + 28);
  doc.setFontSize(8);
  doc.text('Student ID: ...................................', 145, signY + 33);
}

/**
 * 1. Generate and download official Daily Attendance PDF
 */
export function exportDailyAttendancePdf({
  dateStr,
  members,
  attendanceRecords,
}: DailyAttendancePdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const formattedDate = formatIndonesianDate(dateStr);
  const nowStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Calculate statistics
  const attMap = new Map<string, string>();
  attendanceRecords.forEach((r) => {
    if (r.tanggal === dateStr) {
      if (r.nisn && r.nisn !== '-') {
        attMap.set(r.nisn.trim(), r.status);
      }
      attMap.set(r.namaAnggota.toLowerCase().trim(), r.status);
    }
  });

  let hadir = 0;
  let izin = 0;
  let sakit = 0;
  let alpa = 0;

  members.forEach((m) => {
    const mNisn = (m.nisn || '').trim();
    const mName = m.fullName.toLowerCase().trim();
    const status = (mNisn && attMap.get(mNisn)) || attMap.get(mName) || 'Unexcused';

    if (status === 'Present' || status === 'Hadir') hadir++;
    else if (status === 'Excused' || status === 'Izin') izin++;
    else if (status === 'Sick' || status === 'Sakit') sakit++;
    else alpa++;
  });

  const totalMembers = members.length;
  const attendanceRate = totalMembers > 0 ? Math.round((hadir / totalMembers) * 100) : 0;

  // Header Banner
  drawOfficialHeader(doc, 'DAILY ATTENDANCE ROSTER & SESSION LOG', '');

  // Metadata Box
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.text('Session Date :', 14, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(`${formattedDate} (${dateStr})`, 48, 31);

  doc.setFont('helvetica', 'bold');
  doc.text('Printed On :', 140, 31);
  doc.setFont('helvetica', 'normal');
  doc.text(nowStr, 166, 31);

  // Statistics Mini Cards
  const boxY = 35;
  const boxHeight = 12;

  // Present
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, boxY, 42, boxHeight, 2, 2, 'FD');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('PRESENT', 18, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(`${hadir} Members (${attendanceRate}%)`, 18, boxY + 9.5);

  // Excused
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(60, boxY, 42, boxHeight, 2, 2, 'FD');
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('EXCUSED', 64, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(`${izin} Members`, 64, boxY + 9.5);

  // Sick
  doc.setFillColor(254, 243, 199);
  doc.setDrawColor(253, 230, 138);
  doc.roundedRect(106, boxY, 42, boxHeight, 2, 2, 'FD');
  doc.setTextColor(146, 64, 14);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('SICK', 110, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(`${sakit} Members`, 110, boxY + 9.5);

  // Unexcused
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(152, boxY, 44, boxHeight, 2, 2, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('UNEXCUSED / ABSENT', 156, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(`${alpa} Members`, 156, boxY + 9.5);

  // Table Body Rows
  const tableRows = members.map((m, index) => {
    const mNisn = (m.nisn || '').trim();
    const mName = m.fullName.toLowerCase().trim();
    let status = (mNisn && attMap.get(mNisn)) || attMap.get(mName) || 'Unexcused';
    if (status === 'Hadir') status = 'Present';
    if (status === 'Izin') status = 'Excused';
    if (status === 'Sakit') status = 'Sick';
    if (status === 'Alpha' || status === 'Alpa') status = 'Unexcused';

    const className = `Grade ${m.grade} - ${m.classRoom || '-'}`;
    const gender = m.gender === 'Female' || m.gender === 'Perempuan' ? 'F' : 'M';

    return [
      (index + 1).toString(),
      m.fullName,
      m.nisn || '-',
      className,
      gender,
      status,
      status === 'Present' ? '✓ Present' : status,
    ];
  });

  autoTable(doc, {
    startY: 51,
    head: [['No', 'Student Name', 'Student ID', 'Class', 'Gender', 'Status', 'Notes']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'center', cellWidth: 12 },
      5: { halign: 'center', cellWidth: 28 },
      6: { halign: 'center', cellWidth: 26 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const cellVal = String(data.cell.raw);
        if (cellVal === 'Present') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellVal === 'Excused') {
          data.cell.styles.textColor = [37, 99, 235];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellVal === 'Sick') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellVal === 'Unexcused') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 220;
  drawSignatureBlock(doc, finalY, nowStr, 'Robotics Faculty Advisor', 'Club Secretary');

  doc.save(`Attendance_Robotic_MAN_2_${dateStr}.pdf`);
}

/**
 * 2. Generate and download Attendance History / Recap PDF
 */
export function exportAttendanceHistoryPdf({
  title = 'ROBOTICS ATTENDANCE RECAPITULATION & LOGS',
  subtitle = '',
  records,
}: HistoryAttendancePdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const nowStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  drawOfficialHeader(doc, title, subtitle);

  // Metadata
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Records: ${records.length} Attendance Entries`, 14, 30);
  doc.text(`Printed On: ${nowStr}`, 145, 30);

  const sortedRecords = [...records].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  );

  const tableRows = sortedRecords.map((r, idx) => {
    const rawStat = String(r.status || '');
    let stat = rawStat;
    if (rawStat === 'Hadir') stat = 'Present';
    else if (rawStat === 'Izin') stat = 'Excused';
    else if (rawStat === 'Sakit') stat = 'Sick';
    else if (rawStat === 'Alpha' || rawStat === 'Alpa') stat = 'Unexcused';

    return [
      (idx + 1).toString(),
      formatIndonesianDate(r.tanggal),
      r.namaAnggota || '-',
      r.nisn || '-',
      stat,
    ];
  });

  autoTable(doc, {
    startY: 35,
    head: [['No', 'Date', 'Student Name', 'Student ID', 'Status']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 12 },
      1: { halign: 'center', cellWidth: 32 },
      2: { halign: 'left', fontStyle: 'bold' },
      3: { halign: 'center', cellWidth: 30 },
      4: { halign: 'center', cellWidth: 26 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const cellVal = String(data.cell.raw);
        if (cellVal === 'Present') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellVal === 'Excused') {
          data.cell.styles.textColor = [37, 99, 235];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellVal === 'Sick') {
          data.cell.styles.textColor = [217, 119, 6];
          data.cell.styles.fontStyle = 'bold';
        } else if (cellVal === 'Unexcused') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 220;
  drawSignatureBlock(doc, finalY, nowStr, 'Robotics Faculty Advisor', 'Club Secretary');

  doc.save(`Attendance_Recap_Robotic_MAN_2_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * 3. Generate and download official Members Master List PDF (Data Anggota)
 */
export function exportMembersListPdf({
  members,
  filterGrade = 'ALL',
  filterGender = 'ALL',
}: MembersListPdfOptions) {
  const doc = new jsPDF({
    orientation: 'landscape', // Landscape for full member info (NIK, NISN, Phone, Address)
    unit: 'mm',
    format: 'a4',
  });

  const nowStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Calculate stats
  let gradeX = 0;
  let gradeXI = 0;
  let gradeXII = 0;
  let male = 0;
  let female = 0;

  members.forEach((m) => {
    if (m.grade === 'X') gradeX++;
    else if (m.grade === 'XI') gradeXI++;
    else if (m.grade === 'XII') gradeXII++;

    if (m.gender === 'Female' || m.gender === 'Perempuan' || m.gender === 'P') female++;
    else male++;
  });

  // Header Banner Landscape (Width 297mm)
  doc.setFillColor(30, 58, 138); // Blue 900
  doc.rect(0, 0, 297, 24, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('ROBOTIC MAN 2 KOTA BEKASI', 148.5, 10, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('OFFICIAL MEMBER DIRECTORY & ROSTER', 148.5, 16, { align: 'center' });

  // Metadata
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Members : ${members.length} Students`, 14, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Filter: ${filterGrade !== 'ALL' ? `Grade ${filterGrade}` : 'All Grades'}, ${
      filterGender !== 'ALL' ? (filterGender === 'Male' ? 'Male' : 'Female') : 'All Genders'
    }`,
    70,
    30
  );
  doc.text(`Printed On: ${nowStr}`, 235, 30);

  // Stats Card (Landscape)
  const statBoxY = 34;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, statBoxY, 269, 10, 1.5, 1.5, 'FD');

  // Total
  doc.setFontSize(8);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary:', 18, statBoxY + 6.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total: ${members.length}`, 38, statBoxY + 6.5);

  // Grade breakdown
  doc.text(`Grade X: ${gradeX} | Grade XI: ${gradeXI} | Grade XII: ${gradeXII}`, 70, statBoxY + 6.5);

  // Gender breakdown
  doc.text(`Male: ${male} | Female: ${female}`, 180, statBoxY + 6.5);

  // Table Body Rows
  const tableRows = members.map((m, idx) => {
    const rawGender = m.gender || '';
    const isFemale = rawGender.toLowerCase().startsWith('f') || rawGender.toLowerCase().startsWith('p');
    const genderBadge = isFemale ? 'F' : 'M';

    return [
      (idx + 1).toString(),
      m.fullName,
      m.nisn || '-',
      m.nik || '-',
      `Grade ${m.grade} - ${m.classRoom || '-'}`,
      genderBadge,
      m.personalPhone || '-',
      m.parentPhone || '-',
      m.address || '-',
    ];
  });

  autoTable(doc, {
    startY: 47,
    head: [
      [
        'No',
        'Full Name',
        'Student ID',
        'National ID',
        'Grade',
        'Gender',
        'Student Phone',
        'Parent Phone',
        'Address',
      ],
    ],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold', cellWidth: 44 },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 32 },
      4: { halign: 'center', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 12 },
      6: { halign: 'center', cellWidth: 30 },
      7: { halign: 'center', cellWidth: 30 },
      8: { halign: 'left' },
    },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 160;
  
  let signY = finalY + 10;
  if (signY > 165) {
    doc.addPage();
    signY = 25;
  }

  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);

  // Left Signature
  doc.text('Acknowledged by,', 30, signY);
  doc.text('Faculty Advisor Robotic MAN 2', 30, signY + 5);
  doc.text('( ......................................... )', 30, signY + 24);
  doc.setFontSize(8);
  doc.text('Staff ID: ....................................', 30, signY + 29);

  // Right Signature
  doc.setFontSize(9);
  doc.text(`Bekasi, ${nowStr}`, 210, signY);
  doc.text('Club President Robotic MAN 2', 210, signY + 5);
  doc.text('( ......................................... )', 210, signY + 24);
  doc.setFontSize(8);
  doc.text('Student ID: ...................................', 210, signY + 29);

  doc.save(`Member_Roster_Robotic_MAN_2_${new Date().toISOString().split('T')[0]}.pdf`);
}

/**
 * 4. Generate and download Weekly Treasurer Dues PDF (Iuran Kas Mingguan)
 */
export function exportWeeklyCashPdf({
  monthLabel,
  weekNum,
  weekRange,
  members,
  cash,
  standardNominal = 5000,
  selectedMonthKey,
}: WeeklyCashPdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const nowStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Calculate payment status for each member for the target week
  const getMemberWeekStatusForPDF = (m: Member) => {
    const mNisn = (m.nisn || '').trim();
    const mName = m.fullName.toLowerCase().trim();
    const stdFee = standardNominal || 5000;

    const monthName = (monthLabel || '').split(' ')[0].toLowerCase();
    const memberMonthTxs = cash.filter((tx) => {
      if (tx.jenis !== 'Inflow' && (tx.jenis as any) !== 'Masuk') return false;
      const nisn = (tx.nisn || '').trim();
      const name = (tx.namaAnggota || tx.namaSiswa || '').toLowerCase().trim();
      const isMatch = (mNisn && mNisn !== '-' && nisn === mNisn) || (mName && name === mName);
      if (!isMatch) return false;

      const txDate = (tx.tanggal || '').trim();
      const txKet = (tx.keterangan || '').toLowerCase();
      return txDate.startsWith(selectedMonthKey) || (monthName && txKet.includes(monthName));
    });

    const totalPaidInMonth = memberMonthTxs.reduce((sum, tx) => sum + (Number(tx.jumlah) || 0), 0);
    const qualifiedWeeks = Math.floor(totalPaidInMonth / stdFee);

    let matchingTx: CashTransaction | undefined = undefined;

    for (const tx of memberMonthTxs) {
      const txAmount = Number(tx.jumlah) || 0;
      const txKetLower = (tx.keterangan || '').toLowerCase();
      const txDate = (tx.tanggal || '').trim();

      const regex = /\b(?:minggu\s*(?:ke-?|\s*)?|mg\s*|m|w|week\s*)(\d+)\b/gi;
      let match;
      const mentionedWeeks: number[] = [];
      while ((match = regex.exec(txKetLower)) !== null) {
        const w = parseInt(match[1], 10);
        if (w >= 1 && w <= 5 && !mentionedWeeks.includes(w)) {
          mentionedWeeks.push(w);
        }
      }

      let explicitWeek = mentionedWeeks.length > 0 ? Math.min(...mentionedWeeks) : undefined;
      if (!explicitWeek && txDate.startsWith(selectedMonthKey)) {
        const day = parseInt(txDate.split('-')[2], 10) || 1;
        explicitWeek = day <= 7 ? 1 : day <= 14 ? 2 : day <= 21 ? 3 : day <= 28 ? 4 : 5;
      }
      const startW = explicitWeek || 1;
      const weeksCovered = Math.max(1, Math.floor(txAmount / stdFee));

      if (weekNum >= startW && weekNum < startW + weeksCovered) {
        matchingTx = tx;
        break;
      }
    }

    const isPaid = !!matchingTx || weekNum <= qualifiedWeeks;
    return {
      isPaid,
      tx: matchingTx || (isPaid ? memberMonthTxs[0] : undefined),
    };
  };

  let paidCount = 0;
  let totalCollected = 0;

  const rows = members.map((m, idx) => {
    const { isPaid, tx } = getMemberWeekStatusForPDF(m);

    if (isPaid) {
      paidCount++;
      totalCollected += Number(tx?.jumlah) || standardNominal;
    }

    return [
      (idx + 1).toString(),
      m.fullName,
      m.nisn || '-',
      `Grade ${m.grade} - ${m.classRoom || '-'}`,
      isPaid ? 'PAID' : 'UNPAID',
      isPaid ? formatRupiah(tx?.jumlah || standardNominal) : formatRupiah(0),
      isPaid && tx?.tanggal ? formatIndonesianDate(tx.tanggal) : '-',
    ];
  });

  const unpaidCount = members.length - paidCount;
  const targetAmount = members.length * standardNominal;
  const percentage = targetAmount > 0 ? Math.round((totalCollected / targetAmount) * 100) : 0;

  // Header Banner
  drawOfficialHeader(
    doc,
    'WEEKLY CLUB DUES COLLECTION REPORT',
    `Period: ${monthLabel} - Week ${weekNum} (${weekRange})`
  );

  // Metadata
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Weekly Rate: ${formatRupiah(standardNominal)} / Week`, 14, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`Printed On: ${nowStr}`, 145, 30);

  // Statistics Summary Mini Boxes
  const boxY = 34;
  const boxHeight = 12;

  // Collected
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, boxY, 44, boxHeight, 2, 2, 'FD');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL COLLECTED', 18, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(formatRupiah(totalCollected), 18, boxY + 9.5);

  // Target
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(62, boxY, 42, boxHeight, 2, 2, 'FD');
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TARGET DUES', 66, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(formatRupiah(targetAmount), 66, boxY + 9.5);

  // Paid
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(108, boxY, 42, boxHeight, 2, 2, 'FD');
  doc.setTextColor(22, 101, 52);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS: PAID', 112, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(`${paidCount} Members (${percentage}%)`, 112, boxY + 9.5);

  // Unpaid
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(154, boxY, 42, boxHeight, 2, 2, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('STATUS: UNPAID', 158, boxY + 4.5);
  doc.setFontSize(10);
  doc.text(`${unpaidCount} Members`, 158, boxY + 9.5);

  autoTable(doc, {
    startY: 50,
    head: [['No', 'Student Name', 'Student ID', 'Class', 'Status', 'Amount Paid', 'Payment Date']],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left', fontStyle: 'bold' },
      2: { halign: 'center', cellWidth: 26 },
      3: { halign: 'center', cellWidth: 26 },
      4: { halign: 'center', cellWidth: 26 },
      5: { halign: 'right', fontStyle: 'bold', cellWidth: 26 },
      6: { halign: 'center', cellWidth: 26 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 4) {
        const cellVal = String(data.cell.raw);
        if (cellVal === 'PAID') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 220;
  drawSignatureBlock(doc, finalY, nowStr, 'Robotics Faculty Advisor', 'Club Treasurer');

  doc.save(`Treasury_Dues_${selectedMonthKey}_Week_${weekNum}.pdf`);
}

/**
 * 5. Generate and download Cash Ledger / Mutasi Kas PDF (Buku Kas Umum)
 */
export function exportCashLedgerPdf({
  cash,
  periodLabel = 'All Transactions',
  filterType = 'ALL',
}: CashLedgerPdfOptions) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const nowStr = new Date().toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  let totalMasuk = 0;
  let totalKeluar = 0;

  cash.forEach((tx) => {
    const val = Number(tx.jumlah) || 0;
    if (tx.jenis === 'Inflow' || (tx.jenis as any) === 'Masuk') totalMasuk += val;
    else if (tx.jenis === 'Outflow' || (tx.jenis as any) === 'Keluar') totalKeluar += val;
  });

  const saldoAkhir = totalMasuk - totalKeluar;

  // Header Banner
  drawOfficialHeader(
    doc,
    'CLUB GENERAL TREASURY & FINANCIAL LEDGER',
    `Filter / Period: ${periodLabel}`
  );

  // Metadata
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(`Total Transactions: ${cash.length} Entries`, 14, 30);
  doc.setFont('helvetica', 'normal');
  doc.text(`Printed On: ${nowStr}`, 145, 30);

  // Financial KPI Cards
  const boxY = 34;
  const boxHeight = 12;

  // Total Inflow
  doc.setFillColor(236, 253, 245);
  doc.setDrawColor(167, 243, 208);
  doc.roundedRect(14, boxY, 56, boxHeight, 2, 2, 'FD');
  doc.setTextColor(6, 95, 70);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL INFLOW (+)', 18, boxY + 4.5);
  doc.setFontSize(10.5);
  doc.text(formatRupiah(totalMasuk), 18, boxY + 9.5);

  // Total Outflow
  doc.setFillColor(254, 226, 226);
  doc.setDrawColor(254, 202, 202);
  doc.roundedRect(74, boxY, 56, boxHeight, 2, 2, 'FD');
  doc.setTextColor(153, 27, 27);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL OUTFLOW (-)', 78, boxY + 4.5);
  doc.setFontSize(10.5);
  doc.text(formatRupiah(totalKeluar), 78, boxY + 9.5);

  // Treasury Balance
  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(134, boxY, 62, boxHeight, 2, 2, 'FD');
  doc.setTextColor(30, 64, 175);
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.text('CLOSING TREASURY BALANCE', 138, boxY + 4.5);
  doc.setFontSize(10.5);
  doc.text(formatRupiah(saldoAkhir), 138, boxY + 9.5);

  // Table Body Rows
  const sortedCash = [...cash].sort(
    (a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime()
  );

  const tableRows = sortedCash.map((tx, idx) => {
    const isMasuk = tx.jenis === 'Inflow' || (tx.jenis as any) === 'Masuk';
    const partyName = tx.namaAnggota || tx.namaSiswa || '-';

    return [
      (idx + 1).toString(),
      formatIndonesianDate(tx.tanggal),
      tx.keterangan || (isMasuk ? 'Club Inflow' : 'Club Expense'),
      partyName,
      isMasuk ? formatRupiah(tx.jumlah) : '-',
      !isMasuk ? formatRupiah(tx.jumlah) : '-',
    ];
  });

  autoTable(doc, {
    startY: 50,
    head: [['No', 'Date', 'Description / Purpose', 'Source / Recipient', 'Inflow (IDR)', 'Outflow (IDR)']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    styles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [30, 41, 59],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'center', cellWidth: 26 },
      2: { halign: 'left', fontStyle: 'bold' },
      3: { halign: 'left', cellWidth: 36 },
      4: { halign: 'right', cellWidth: 28 },
      5: { halign: 'right', cellWidth: 28 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        if (data.column.index === 4 && String(data.cell.raw) !== '-') {
          data.cell.styles.textColor = [5, 150, 105];
          data.cell.styles.fontStyle = 'bold';
        } else if (data.column.index === 5 && String(data.cell.raw) !== '-') {
          data.cell.styles.textColor = [220, 38, 38];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 220;
  drawSignatureBlock(doc, finalY, nowStr, 'Robotics Faculty Advisor', 'Club Treasurer');

  doc.save(`Treasury_Ledger_${new Date().toISOString().split('T')[0]}.pdf`);
}
