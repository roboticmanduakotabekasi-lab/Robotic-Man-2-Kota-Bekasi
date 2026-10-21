import * as XLSX from 'xlsx';
import * as pdfjsLib from 'pdfjs-dist';
import { Member, AttendanceRecord, CashTransaction, AttendanceStatus, TransactionType } from '../types';
import { parseDateSafe } from './formatters';

// Configure pdfjs worker
// Use a reliable CDN or inline worker configuration for browser compatibility
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch {
    // Fallback if needed
  }
}

export type ImportTargetType = 'members' | 'cash' | 'attendance';

export interface ColumnMapping {
  // Members
  nisn?: number;
  fullName?: number;
  grade?: number;
  classRoom?: number;
  gender?: number;
  personalPhone?: number;
  parentPhone?: number;
  email?: number;
  nik?: number;
  address?: number;
  timestamp?: number;
  role?: number;
  jabatan?: number;
  status?: number;
  birthDate?: number;

  // Cash
  tanggal?: number;
  jumlah?: number;
  keterangan?: number;
  jenis?: number;
  cashMemberNisn?: number;
  cashMemberName?: number;

  // Attendance
  attTanggal?: number;
  attMemberNisn?: number;
  attMemberName?: number;
  attStatus?: number;
}

export interface ParsedRawData {
  fileName: string;
  fileType: 'excel' | 'pdf' | 'csv' | 'paste';
  sheetNames?: string[];
  activeSheet?: string;
  headers: string[];
  rows: string[][];
  detectedTarget: ImportTargetType;
  suggestedMapping: ColumnMapping;
}

/**
 * Extract tabular string data from a PDF ArrayBuffer
 */
export async function parsePdfToRows(buffer: ArrayBuffer): Promise<string[][]> {
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const pdf = await loadingTask.promise;
  const allRows: string[][] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Group text items by their vertical position (y coordinate)
    interface TextItemPos {
      text: string;
      x: number;
      y: number;
      width: number;
    }

    const items: TextItemPos[] = [];
    for (const item of textContent.items) {
      if ('str' in item && item.str.trim()) {
        const tx = item.transform; // [scaleX, skewY, skewX, scaleY, posX, posY]
        items.push({
          text: item.str.trim(),
          x: tx[4],
          y: tx[5],
          width: item.width || 0,
        });
      }
    }

    // Sort top-to-bottom (PDF y is measured from bottom up, so higher y is higher on page)
    items.sort((a, b) => b.y - a.y || a.x - b.x);

    // Group items into lines (tolerance ~5px)
    const lines: TextItemPos[][] = [];
    let currentLine: TextItemPos[] = [];
    let currentY: number | null = null;

    for (const item of items) {
      if (currentY === null || Math.abs(item.y - currentY) <= 4.5) {
        currentLine.push(item);
        if (currentY === null) currentY = item.y;
      } else {
        if (currentLine.length > 0) {
          // Sort items in this line left-to-right
          currentLine.sort((a, b) => a.x - b.x);
          lines.push(currentLine);
        }
        currentLine = [item];
        currentY = item.y;
      }
    }
    if (currentLine.length > 0) {
      currentLine.sort((a, b) => a.x - b.x);
      lines.push(currentLine);
    }

    // Convert lines into string cells
    for (const line of lines) {
      // Split or combine tokens
      const rowCells: string[] = [];
      let lastRight = -1;
      let cellText = '';

      for (const token of line) {
        // If there's a noticeable gap (> 14px), treat as separate column cell
        if (lastRight > 0 && token.x - lastRight > 14) {
          if (cellText) rowCells.push(cellText.trim());
          cellText = token.text;
        } else {
          cellText = cellText ? `${cellText} ${token.text}` : token.text;
        }
        lastRight = token.x + token.width;
      }
      if (cellText) rowCells.push(cellText.trim());

      if (rowCells.length > 0) {
        allRows.push(rowCells);
      }
    }
  }

  return allRows;
}

/**
 * Sanitizes and disarms potential spreadsheet formula injection (CSV/Excel Formula Injection - CWE-1236)
 * Neutralizes leading '=', '+', '-', '@', '\t', '\r' unless the value is a standard number or phone number.
 */
export function disarmFormulaCell(val: string): string {
  if (!val) return '';
  const trimmed = val.trim();
  if (/^[=+\-@\t\r]/.test(trimmed)) {
    // If it's a legitimate numeric value or phone number (e.g. -5000, +62858123456), keep intact
    if (/^[-+]?\d+(\.\d+)?$/.test(trimmed)) {
      return trimmed;
    }
    // Disarm formula execution by prepending a safe apostrophe
    return `'${trimmed}`;
  }
  return trimmed;
}

/**
 * Extract tabular string data from an Excel ArrayBuffer
 */
export function parseExcelToSheets(buffer: ArrayBuffer): { sheetNames: string[]; sheetsData: Record<string, string[][]> } {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetNames = workbook.SheetNames || [];
  const sheetsData: Record<string, string[][]> = {};

  for (const name of sheetNames) {
    const sheet = workbook.Sheets[name];
    if (!sheet) continue;
    // Extract as 2D string array
    const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
    const stringRows = rawRows
      .map((row) => (Array.isArray(row) ? row.map((cell) => disarmFormulaCell(String(cell !== null && cell !== undefined ? cell : ''))) : []))
      .filter((row) => row.some((cell) => cell.length > 0));
    sheetsData[name] = stringRows;
  }

  return { sheetNames, sheetsData };
}

/**
 * Parse CSV or delimited string into 2D string array
 */
export function parseDelimitedText(text: string): string[][] {
  const cleanText = text.replace(/^\uFEFF/, '').trim();
  const sampleLine = cleanText.split(/\r?\n/).find((l) => l.trim().length > 0) || '';
  let separator = ',';
  if (sampleLine.includes('\t')) {
    separator = '\t';
  } else if (sampleLine.includes(';') && (sampleLine.match(/;/g) || []).length > (sampleLine.match(/,/g) || []).length) {
    separator = ';';
  }

  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i];
    const nextChar = cleanText[i + 1];

    if (insideQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"';
        i++;
      } else if (char === '"') {
        insideQuotes = false;
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        insideQuotes = true;
      } else if (char === separator) {
        currentRow.push(disarmFormulaCell(currentField));
        currentField = '';
      } else if (char === '\r' && nextChar === '\n') {
        currentRow.push(disarmFormulaCell(currentField));
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
        i++;
      } else if (char === '\n' || char === '\r') {
        currentRow.push(disarmFormulaCell(currentField));
        rows.push(currentRow);
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(disarmFormulaCell(currentField));
    rows.push(currentRow);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

/**
 * Auto-detect data target type (members, cash, attendance) based on headers & content
 */
export function detectTargetType(headers: string[], rows: string[][]): ImportTargetType {
  const joinedHeaders = headers.join(' ').toLowerCase();
  const sampleContent = rows.slice(0, 5).map((r) => r.join(' ')).join(' ').toLowerCase();
  const allText = `${joinedHeaders} ${sampleContent}`;

  // Check for Cash / Keuangan
  const cashKeywords = ['kas', 'nominal', 'rupiah', 'debit', 'kredit', 'pemasukan', 'pengeluaran', 'saldo', 'iuran', 'mutasi', 'biaya'];
  const cashScore = cashKeywords.reduce((acc, k) => (allText.includes(k) ? acc + 1 : acc), 0);

  // Check for Attendance / Presensi
  const attKeywords = ['presensi', 'absensi', 'hadir', 'alpha', 'alpa', 'izin', 'sakit', 'pertemuan'];
  const attScore = attKeywords.reduce((acc, k) => (allText.includes(k) ? acc + 1 : acc), 0);

  // Check for Members
  const memberKeywords = ['nisn', 'siswa', 'anggota', 'rombel', 'jurusan', 'gender', 'nik', 'orang tua', 'wali', 'alamat'];
  const memberScore = memberKeywords.reduce((acc, k) => (allText.includes(k) ? acc + 1 : acc), 0);

  if (cashScore > memberScore && cashScore > attScore) return 'cash';
  if (attScore > memberScore && attScore > cashScore) return 'attendance';
  return 'members';
}

/**
 * Auto-detect column mapping based on header names
 */
export function suggestColumnMapping(headers: string[], target: ImportTargetType): ColumnMapping {
  const cleanHeaders = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const findCol = (keywords: string[], excludeKeywords: string[] = []) => {
    return cleanHeaders.findIndex((h) => {
      if (excludeKeywords.some((ex) => h.includes(ex))) return false;
      return keywords.some((k) => h.includes(k));
    });
  };

  const mapping: ColumnMapping = {};

  if (target === 'members') {
    const parentIndicators = ['orangtua', 'ortu', 'wali', 'ayah', 'ibu', 'parent', 'guardian', 'keluarga', 'darurat', 'emergency'];
    const contactIndicators = ['hp', 'wa', 'telepon', 'telp', 'phone', 'kontak', 'nomor', 'no', 'mobile', 'handphone'];
    const rejectForPhone = ['nama', 'name', 'pekerjaan', 'job', 'pendidikan', 'penghasilan', 'gaji', 'status', 'alamat', 'address', 'mail'];

    mapping.nisn = findCol(['nisn', 'idmember', 'noinduk', 'nomorinduk', 'nis', 'id']);
    mapping.fullName = findCol(['fullname', 'namalengkap', 'namasiswa', 'namaanggota', 'nama', 'peserta', 'name'], ['orangtua', 'ortu', 'wali', 'ayah', 'ibu']);
    mapping.grade = findCol(['grade', 'tingkat', 'jenjang', 'tingkatkelas', 'kelas']);
    mapping.classRoom = findCol(['classroom', 'class', 'rombel', 'ruangan', 'ruang', 'subkelas']);
    mapping.gender = findCol(['gender', 'jeniskelamin', 'kelamin', 'jk', 'sex']);

    // 1. Email Column
    mapping.email = findCol(['email', 'surel', 'alamatemail', 'emailaddress', 'mail']);

    // 2. Parent / Guardian Phone Column (Must NOT be matched with student phone or parent name)
    mapping.parentPhone = cleanHeaders.findIndex((h) => {
      if (rejectForPhone.some((r) => h.includes(r))) return false;
      const hasParent = parentIndicators.some((p) => h.includes(p));
      const hasContact = contactIndicators.some((c) => h.includes(c));
      return hasParent && hasContact;
    });

    if (mapping.parentPhone === -1) {
      mapping.parentPhone = cleanHeaders.findIndex((h) => {
        if (rejectForPhone.some((r) => h.includes(r))) return false;
        return parentIndicators.some((p) => h.includes(p));
      });
    }

    // 3. Personal Phone (Student) - STRICTLY EXCLUDE parent indicators
    mapping.personalPhone = cleanHeaders.findIndex((h, idx) => {
      if (idx === mapping.parentPhone) return false;
      if (parentIndicators.some((p) => h.includes(p))) return false;
      return [
        'nohpsiswa',
        'teleponsiswa',
        'wasiswa',
        'kontaksiswa',
        'phonesiswa',
        'personalphone',
        'nohp',
        'nowa',
        'telepon',
        'telp',
        'handphone',
        'whatsapp',
        'kontak',
        'phone',
        'mobile',
      ].some((k) => h.includes(k));
    });

    mapping.nik = findCol(['nik', 'noktp', 'ktp', 'kependudukan']);

    // 4. Address / Domisili - CRITICAL: STRICTLY EXCLUDE email / surel / mail columns!
    mapping.address = cleanHeaders.findIndex((h, idx) => {
      if (idx === mapping.email) return false;
      if (h.includes('email') || h.includes('surel') || h.includes('mail')) return false;
      return [
        'domisili',
        'tempattinggal',
        'alamatrumah',
        'alamattinggal',
        'alamatlengkap',
        'alamatdomisili',
        'tempattinggalsiswa',
        'kelurahan',
        'kecamatan',
        'kabupaten',
        'kota',
        'rt',
        'rw',
        'alamat',
        'address',
      ].some((k) => h.includes(k));
    });

    // 5. Registration Timestamp
    mapping.timestamp = cleanHeaders.findIndex((h) => {
      if (h.includes('lahir') || h.includes('birth') || h.includes('dob')) return false;
      return [
        'timestamp',
        'waktupendaftaran',
        'waktudaftar',
        'tanggaldaftar',
        'tgldaftar',
        'waktusubmit',
        'submittedat',
        'createdat',
        'waktu',
        'tanggal',
        'date',
        'time',
      ].some((k) => h.includes(k));
    });

    // 6. Role & Status & Jabatan
    mapping.role = findCol(['role', 'peran', 'hakakses', 'otoritas', 'levelakses', 'userrole']);
    mapping.jabatan = findCol(['jabatan', 'posisi', 'struktur', 'position', 'title', 'organizationaltitle']);
    mapping.status = findCol(['status', 'keanggotaan', 'statuskeanggotaan', 'membership', 'statusanggota']);

    // 7. Birth Date (Tanggal Lahir - Digunakan untuk verifikasi siswa anti-bot)
    mapping.birthDate = cleanHeaders.findIndex((h) => {
      return [
        'tanggallahir',
        'tgllahir',
        'tgl_lahir',
        'tgllhr',
        'lahir',
        'birthdate',
        'dateofbirth',
        'dob',
        'ttl',
        'tempattanggallahir'
      ].some((k) => h.includes(k));
    });

  } else if (target === 'cash') {
    mapping.tanggal = findCol(['tanggal', 'tgl', 'date', 'waktu']);
    mapping.jumlah = findCol(['jumlah', 'nominal', 'rupiah', 'total', 'besar', 'uang', 'rp', 'amount']);
    mapping.keterangan = findCol(['keterangan', 'ket', 'uraian', 'deskripsi', 'catatan', 'keperluan', 'note']);
    mapping.jenis = findCol(['jenis', 'tipe', 'type', 'kategori', 'status']);
    mapping.cashMemberNisn = findCol(['nisn', 'idmember', 'id', 'nis']);
    mapping.cashMemberName = findCol(['namasiswa', 'namaanggota', 'nama', 'fullname', 'penyetor', 'anggota']);
  } else if (target === 'attendance') {
    mapping.attTanggal = findCol(['tanggal', 'tgl', 'date', 'waktu']);
    mapping.attMemberNisn = findCol(['nisn', 'idmember', 'id', 'nis']);
    mapping.attMemberName = findCol(['namasiswa', 'namaanggota', 'nama', 'fullname', 'peserta']);
    mapping.attStatus = findCol(['status', 'kehadiran', 'presensi', 'absensi', 'keterangan']);
  }

  return mapping;
}

/**
 * Transform raw rows into structured Member records
 */
export function buildMembersFromRows(
  rows: string[][],
  mapping: ColumnMapping,
  existingMembers: Member[]
): { validMembers: Member[]; warnings: string[] } {
  const warnings: string[] = [];
  const validMembers: Member[] = [];
  const existingMap = new Map<string, Member>(existingMembers.map((m) => [String(m.nisn).trim(), m]));
  const seenCsvNisns = new Set<string>();

  // Sanitize text against CSV / spreadsheet formula injection (CWE-1236)
  const sanitizeFormula = (str: string): string => {
    if (!str) return '';
    const trimmed = str.trim();
    if (/^[=+@\t\r]/.test(trimmed)) {
      return `'${trimmed}`;
    }
    return trimmed;
  };

  rows.forEach((cols, idx) => {
    if (cols.length === 0 || cols.every((c) => !c.trim())) return;

    const rawNisn = mapping.nisn !== undefined && mapping.nisn !== -1 ? cols[mapping.nisn] || '' : '';
    let cleanNisn = rawNisn.replace(/[^0-9]/g, '').trim() || rawNisn.trim();
    if (cleanNisn.length === 9 && /^\d+$/.test(cleanNisn)) {
      cleanNisn = '0' + cleanNisn;
    }

    const rawName = mapping.fullName !== undefined && mapping.fullName !== -1 ? cols[mapping.fullName] || '' : '';
    const fullName = sanitizeFormula(rawName.trim());

    if (!fullName && !cleanNisn) {
      warnings.push(`Row ${idx + 2}: Skipped because Student ID/NISN and Name are empty.`);
      return;
    }

    if (cleanNisn) {
      if (seenCsvNisns.has(cleanNisn)) {
        warnings.push(`Row ${idx + 2}: Duplicate Student ID/NISN "${cleanNisn}" in file. Updating existing record.`);
      }
      seenCsvNisns.add(cleanNisn);
    }

    // Grade & Class
    let grade = 'X';
    let classRoom = mapping.classRoom !== undefined && mapping.classRoom !== -1 ? (cols[mapping.classRoom] || '').trim() : '';
    const rawGrade = mapping.grade !== undefined && mapping.grade !== -1 ? (cols[mapping.grade] || '').trim().toUpperCase() : '';

    if (rawGrade.includes('XII') || rawGrade.startsWith('12')) grade = 'XII';
    else if (rawGrade.includes('XI') || rawGrade.startsWith('11')) grade = 'XI';
    else if (rawGrade.includes('X') || rawGrade.startsWith('10')) grade = 'X';

    // If combined grade e.g. "X - E-1", "XI - F-2", "X-C"
    if (!classRoom && rawGrade) {
      const compoundMatch = rawGrade.match(/^(?:X{1,3}|1[0-2])\s*[-./\s]\s*(.+)$/i);
      if (compoundMatch && compoundMatch[1]) {
        classRoom = compoundMatch[1].trim().toUpperCase();
      } else {
        const m = rawGrade.match(/(?:X{1,3}|1[0-2])\s*[-./\s]?\s*([A-Za-z0-9-]+)/i);
        if (m && m[1]) classRoom = m[1].toUpperCase();
      }
    }
    if (!classRoom) classRoom = 'A';

    // Gender
    const rawGender = mapping.gender !== undefined && mapping.gender !== -1 ? (cols[mapping.gender] || '').trim().toLowerCase() : '';
    let gender = 'Male';
    if (rawGender.includes('p') || rawGender.includes('perempuan') || rawGender.includes('female') || rawGender === 'wanita') {
      gender = 'Female';
    }

    // Phone parsing & cleaning
    let personalPhone = mapping.personalPhone !== undefined && mapping.personalPhone !== -1 ? (cols[mapping.personalPhone] || '').trim() : '';
    let parentPhone = mapping.parentPhone !== undefined && mapping.parentPhone !== -1 ? (cols[mapping.parentPhone] || '').trim() : '';

    // Address & Email parsing with smart fail-safe
    let email = mapping.email !== undefined && mapping.email !== -1 ? (cols[mapping.email] || '').trim() : '';
    let address = mapping.address !== undefined && mapping.address !== -1 ? (cols[mapping.address] || '').replace(/\r?\n+/g, ' ').trim() : '';

    // BUG FIX 1: If address was mistakenly filled with an email address (contains @ and no spaces)
    if (address && address.includes('@') && !address.includes(' ')) {
      if (!email) {
        email = address;
      }
      address = '';
    }

    // BUG FIX 3: Registration Timestamp parsing & normalization
    let finalTimestamp = '';
    if (mapping.timestamp !== undefined && mapping.timestamp !== -1 && cols[mapping.timestamp]) {
      const rawTimestamp = (cols[mapping.timestamp] || '').trim();
      const parsedDate = parseDateSafe(rawTimestamp);
      if (parsedDate) {
        finalTimestamp = parsedDate.toISOString();
      } else if (rawTimestamp && rawTimestamp !== '-') {
        finalTimestamp = rawTimestamp;
      }
    }

    const finalNisn = cleanNisn || `ID-${Date.now()}-${idx + 1}`;
    const existing = existingMap.get(finalNisn);

    if (!finalTimestamp) {
      finalTimestamp = existing?.timestamp || new Date().toISOString();
    }

    // Parse Birth Date (Tanggal Lahir)
    let birthDate = '';
    let birthPlace = '';
    if (mapping.birthDate !== undefined && mapping.birthDate !== -1 && cols[mapping.birthDate]) {
      const rawBirth = (cols[mapping.birthDate] || '').trim();
      if (rawBirth && rawBirth !== '-') {
        // Cek apakah ada koma memisahkan tempat lahir dan tanggal (misal: "Bekasi, 12-05-2008" atau "Jakarta, 2008-05-12")
        if (rawBirth.includes(',')) {
          const parts = rawBirth.split(',');
          birthPlace = parts[0].trim();
          const datePart = parts.slice(1).join(' ').trim();
          birthDate = normalizeDateString(datePart) || datePart;
        } else {
          birthDate = normalizeDateString(rawBirth) || rawBirth;
        }
      }
    }
    const cleanNik = mapping.nik !== undefined && mapping.nik !== -1 ? (cols[mapping.nik] || '').replace(/[^0-9]/g, '') : existing?.nik || '';
    if (!birthDate && cleanNik.length === 16) {
      const rawDay = parseInt(cleanNik.slice(6, 8), 10);
      const rawMonth = cleanNik.slice(8, 10);
      const rawYear = cleanNik.slice(10, 12);
      if (!isNaN(rawDay) && parseInt(rawMonth, 10) >= 1 && parseInt(rawMonth, 10) <= 12) {
        const day = rawDay > 40 ? rawDay - 40 : rawDay;
        const currentCenturyYear = parseInt(rawYear, 10) <= 30 ? `20${rawYear}` : `19${rawYear}`;
        birthDate = `${currentCenturyYear}-${rawMonth}-${String(day).padStart(2, '0')}`;
      }
    }
    if (!birthDate && existing?.birthDate) {
      birthDate = existing.birthDate;
    }
    if (!birthPlace && existing?.birthPlace) {
      birthPlace = existing.birthPlace;
    }

    // Parse Role & Jabatan & Status with bidirectional RBAC synchronization
    const rawRole = mapping.role !== undefined && mapping.role !== -1 ? (cols[mapping.role] || '').trim().toLowerCase() : '';
    const rawJab = mapping.jabatan !== undefined && mapping.jabatan !== -1 ? (cols[mapping.jabatan] || '').trim().toLowerCase() : '';

    let role = existing?.role || 'member';
    let jabatan = existing?.jabatan || 'member';

    // 1. Normalize Jabatan from input
    if (rawJab) {
      if (rawJab.includes('ketua') || rawJab.includes('president') || rawJab.includes('presiden')) jabatan = 'president';
      else if (rawJab.includes('wakil') || rawJab.includes('vice')) jabatan = 'vice_president';
      else if (rawJab.includes('sekretaris') || rawJab.includes('secretary')) jabatan = 'secretary';
      else if (rawJab.includes('bendahara') || rawJab.includes('treasurer') || rawJab.includes('keuangan')) jabatan = 'treasurer';
      else if (rawJab.includes('pr') || rawJab.includes('humas') || rawJab.includes('public')) jabatan = 'pr';
      else if (rawJab.includes('pembina') || rawJab.includes('advisor') || rawJab.includes('guru')) jabatan = 'advisor';
      else jabatan = 'member';
    }

    // 2. Normalize Role from input
    if (rawRole) {
      if (rawRole.includes('pembina') || rawRole.includes('advisor') || rawRole.includes('guru')) {
        role = 'pembina';
      } else if (
        rawRole.includes('ketua') ||
        rawRole.includes('president') ||
        rawRole.includes('admin') ||
        rawRole.includes('head') ||
        rawRole.includes('sekretaris') ||
        rawRole.includes('secretary') ||
        rawRole.includes('bendahara') ||
        rawRole.includes('treasurer') ||
        rawRole.includes('pr') ||
        rawRole.includes('humas') ||
        rawRole.includes('pengurus') ||
        rawRole.includes('bph') ||
        rawRole.includes('executive')
      ) {
        role = 'admin';
        // If jabatan was not specified, infer corresponding executive title from role
        if (!rawJab || jabatan === 'member') {
          if (rawRole.includes('sekretaris') || rawRole.includes('secretary')) jabatan = 'secretary';
          else if (rawRole.includes('bendahara') || rawRole.includes('treasurer')) jabatan = 'treasurer';
          else if (rawRole.includes('pr') || rawRole.includes('humas')) jabatan = 'pr';
          else if (rawRole.includes('wakil') || rawRole.includes('vice')) jabatan = 'vice_president';
          else if (rawRole.includes('ketua') || rawRole.includes('president')) jabatan = 'president';
          else jabatan = 'president';
        }
      } else {
        role = 'member';
      }
    }

    // 3. Bidirectional Role-Jabatan mutual enforcement (Guarantees no role regression)
    if (jabatan === 'advisor' || role === 'pembina') {
      role = 'pembina';
      jabatan = 'advisor';
    } else if (['president', 'vice_president', 'secretary', 'treasurer', 'pr'].includes(jabatan)) {
      role = 'admin';
    } else if (role === 'admin' && jabatan === 'member') {
      jabatan = 'president';
    } else if (role === 'member' && jabatan !== 'member') {
      role = 'admin';
    }

    // 4. Status mapping
    let status = existing?.status || (role === 'admin' || role === 'pembina' ? 'executive_board' : 'Aktif');
    if (mapping.status !== undefined && mapping.status !== -1 && cols[mapping.status]) {
      const rawStat = (cols[mapping.status] || '').trim();
      if (rawStat) {
        if (/executive/i.test(rawStat) || /pengurus/i.test(rawStat) || /bph/i.test(rawStat)) status = 'executive_board';
        else if (/alumni/i.test(rawStat)) status = 'Alumni';
        else if (/keluar/i.test(rawStat) || /resigned/i.test(rawStat)) status = 'Keluar';
        else status = 'Aktif';
      }
    }

    // Executive board members and advisors must have status 'executive_board'
    if (role === 'admin' || role === 'pembina' || jabatan !== 'member') {
      status = 'executive_board';
    }

    // Email validation
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        warnings.push(`Row ${idx + 2} (${fullName || cleanNisn}): Invalid email format "${email}". Format should be user@domain.com.`);
      }
    }

    const member: Member = {
      id_member: finalNisn,
      nisn: finalNisn,
      fullName: fullName || existing?.fullName || 'Unnamed',
      grade: grade || existing?.grade || 'X',
      classRoom: classRoom || existing?.classRoom || 'A',
      gender: gender || existing?.gender || 'Male',
      nik: cleanNik,
      address: address || existing?.address || '',
      personalPhone: personalPhone || existing?.personalPhone || '',
      parentPhone: parentPhone || existing?.parentPhone || '',
      email: email || existing?.email || '',
      timestamp: finalTimestamp,
      role: role,
      jabatan: jabatan,
      status: status,
      birthDate: birthDate,
      birthPlace: birthPlace,
      isVerified: existing?.isVerified ?? Boolean(birthDate && finalNisn)
    };

    validMembers.push(member);
  });

  return { validMembers, warnings };
}

/**
 * Helper to normalize date string to YYYY-MM-DD
 */
export function normalizeDateString(raw: string): string {
  if (!raw) return '';
  const clean = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmYMatch = clean.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmYMatch) {
    const day = dmYMatch[1].padStart(2, '0');
    const month = dmYMatch[2].padStart(2, '0');
    const year = dmYMatch[3];
    return `${year}-${month}-${day}`;
  }
  // YYYY/MM/DD
  const yMDMatch = clean.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$/);
  if (yMDMatch) {
    const year = yMDMatch[1];
    const month = yMDMatch[2].padStart(2, '0');
    const day = yMDMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  // Indonesian month name e.g. "12 Mei 2008" or "14 Juni 2007"
  const indMonthMatch = clean.match(/(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})/);
  if (indMonthMatch) {
    const day = indMonthMatch[1].padStart(2, '0');
    const mStr = indMonthMatch[2].toLowerCase();
    const year = indMonthMatch[3];
    const monthMap: Record<string, string> = {
      januari: '01', jan: '01', january: '01',
      februari: '02', feb: '02', february: '02',
      maret: '03', mar: '03', march: '03',
      april: '04', apr: '04',
      mei: '05', may: '05',
      juni: '06', jun: '06', june: '06',
      juli: '07', jul: '07', july: '07',
      agustus: '08', agu: '08', agt: '08', august: '08',
      september: '09', sep: '09',
      oktober: '10', okt: '10', october: '10',
      november: '11', nov: '11',
      desember: '12', des: '12', december: '12',
    };
    const month = monthMap[mStr] || '01';
    return `${year}-${month}-${day}`;
  }
  return clean;
}

/**
 * Transform raw rows into structured CashTransaction records
 */
export function buildCashFromRows(
  rows: string[][],
  mapping: ColumnMapping,
  members: Member[]
): { validCash: CashTransaction[]; warnings: string[] } {
  const warnings: string[] = [];
  const validCash: CashTransaction[] = [];
  const memberNameMap = new Map(members.map((m) => [m.fullName.toLowerCase().trim(), m]));
  const memberNisnMap = new Map(members.map((m) => [m.nisn.trim(), m]));

  rows.forEach((cols, idx) => {
    if (cols.length === 0 || cols.every((c) => !c.trim())) return;

    // Nominal
    const rawJumlah = mapping.jumlah !== undefined && mapping.jumlah !== -1 ? cols[mapping.jumlah] || '' : '';
    const cleanJumlah = Number(rawJumlah.replace(/[^0-9.-]/g, '')) || 0;
    if (cleanJumlah <= 0) {
      warnings.push(`Row ${idx + 2}: Amount is 0 or invalid, skipped.`);
      return;
    }

    // Tanggal
    let rawDate = mapping.tanggal !== undefined && mapping.tanggal !== -1 ? (cols[mapping.tanggal] || '').trim() : '';
    // Normalize date YYYY-MM-DD or DD/MM/YYYY
    let cleanDate = new Date().toISOString().slice(0, 10);
    if (rawDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        cleanDate = rawDate;
      } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(rawDate)) {
        const parts = rawDate.split(/[/-]/);
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        cleanDate = `${year}-${month}-${day}`;
      }
    }

    // Jenis
    const rawJenis = mapping.jenis !== undefined && mapping.jenis !== -1 ? (cols[mapping.jenis] || '').trim().toLowerCase() : '';
    let jenis: TransactionType = 'Inflow';
    if (rawJenis.includes('keluar') || rawJenis.includes('out') || rawJenis.includes('pengeluaran') || rawJenis.includes('debit')) {
      jenis = 'Outflow';
    }

    // Member association
    const rawNisn = mapping.cashMemberNisn !== undefined && mapping.cashMemberNisn !== -1 ? (cols[mapping.cashMemberNisn] || '').trim() : '';
    const rawName = mapping.cashMemberName !== undefined && mapping.cashMemberName !== -1 ? (cols[mapping.cashMemberName] || '').trim() : '';

    let matchedMember: Member | undefined;
    if (rawNisn && memberNisnMap.has(rawNisn)) {
      matchedMember = memberNisnMap.get(rawNisn);
    } else if (rawName && memberNameMap.has(rawName.toLowerCase())) {
      matchedMember = memberNameMap.get(rawName.toLowerCase());
    }

    const keterangan = mapping.keterangan !== undefined && mapping.keterangan !== -1 ? (cols[mapping.keterangan] || '').trim() : (jenis === 'Inflow' || (jenis as any) === 'Masuk' ? 'Student Club Dues' : 'Club Expense');

    const tx: CashTransaction = {
      id: `cash_imp_${Date.now()}_${idx + 1}`,
      tanggal: cleanDate,
      nisn: matchedMember?.nisn || (rawNisn ? rawNisn : undefined),
      id_member: matchedMember?.nisn || (rawNisn ? rawNisn : undefined),
      namaAnggota: matchedMember?.fullName || rawName || (jenis === 'Inflow' || (jenis as any) === 'Masuk' ? 'Club Treasury' : 'Club Expense'),
      jenis,
      jumlah: cleanJumlah,
      keterangan: keterangan || 'Treasury Transaction',
    };

    validCash.push(tx);
  });

  return { validCash, warnings };
}

/**
 * Transform raw rows into structured AttendanceRecord records
 */
export function buildAttendanceFromRows(
  rows: string[][],
  mapping: ColumnMapping,
  members: Member[]
): { validAttendance: AttendanceRecord[]; warnings: string[] } {
  const warnings: string[] = [];
  const validAttendance: AttendanceRecord[] = [];
  const memberNameMap = new Map(members.map((m) => [m.fullName.toLowerCase().trim(), m]));
  const memberNisnMap = new Map(members.map((m) => [m.nisn.trim(), m]));

  rows.forEach((cols, idx) => {
    if (cols.length === 0 || cols.every((c) => !c.trim())) return;

    // Member
    const rawNisn = mapping.attMemberNisn !== undefined && mapping.attMemberNisn !== -1 ? (cols[mapping.attMemberNisn] || '').trim() : '';
    const rawName = mapping.attMemberName !== undefined && mapping.attMemberName !== -1 ? (cols[mapping.attMemberName] || '').trim() : '';

    let matchedMember: Member | undefined;
    if (rawNisn && memberNisnMap.has(rawNisn)) {
      matchedMember = memberNisnMap.get(rawNisn);
    } else if (rawName && memberNameMap.has(rawName.toLowerCase())) {
      matchedMember = memberNameMap.get(rawName.toLowerCase());
    }

    if (!matchedMember && !rawName && !rawNisn) {
      warnings.push(`Row ${idx + 2}: Missing student identity (Name/ID empty), skipped.`);
      return;
    }

    // Tanggal
    let rawDate = mapping.attTanggal !== undefined && mapping.attTanggal !== -1 ? (cols[mapping.attTanggal] || '').trim() : '';
    let cleanDate = new Date().toISOString().slice(0, 10);
    if (rawDate) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
        cleanDate = rawDate;
      } else if (/^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(rawDate)) {
        const parts = rawDate.split(/[/-]/);
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        cleanDate = `${year}-${month}-${day}`;
      }
    }

    // Status
    const rawStatus = mapping.attStatus !== undefined && mapping.attStatus !== -1 ? (cols[mapping.attStatus] || '').trim().toLowerCase() : '';
    let status: AttendanceStatus = 'Present';
    if (rawStatus.includes('izin') || rawStatus === 'i' || rawStatus.includes('excused')) status = 'Excused';
    else if (rawStatus.includes('sakit') || rawStatus === 's' || rawStatus.includes('sick')) status = 'Sick';
    else if (rawStatus.includes('alpha') || rawStatus.includes('alpa') || rawStatus === 'a' || rawStatus.includes('unexcused')) status = 'Unexcused';

    const finalNisn = matchedMember?.nisn || rawNisn || `TEMP-${idx + 1}`;
    const finalName = matchedMember?.fullName || rawName || 'Student';

    const record: AttendanceRecord = {
      id: `att_imp_${cleanDate}_${finalNisn}`,
      tanggal: cleanDate,
      nisn: finalNisn,
      id_member: finalNisn,
      namaAnggota: finalName,
      status,
    };

    validAttendance.push(record);
  });

  return { validAttendance, warnings };
}
