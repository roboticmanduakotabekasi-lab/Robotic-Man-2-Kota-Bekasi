/**
 * Format number to Indonesian Rupiah currency string
 */
export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format phone number for WhatsApp link (e.g. 0858... -> 62858...)
 */
export function formatWhatsAppNumber(phone: string): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  }
  return cleaned;
}

/**
 * Robust date parser supporting Indonesian DD/MM/YYYY, Google Forms, ISO, Excel serials, etc.
 * Avoids Chrome "Invalid Date" bug for DD/MM/YYYY strings where Day > 12.
 */
export function parseDateSafe(raw: unknown): Date | null {
  if (!raw) return null;
  if (raw instanceof Date && !isNaN(raw.getTime())) return raw;

  const str = String(raw).trim();
  if (!str || str === '-' || str.toLowerCase() === 'invalid date') return null;

  // 1. Check Excel serial number (e.g. 45547 or 45547.604)
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    if (num > 30000 && num < 70000) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const ms = Math.round(num * 86400000);
      const date = new Date(excelEpoch.getTime() + ms);
      if (!isNaN(date.getTime())) return date;
    }
  }

  // 2. Clean timezone suffixes common in Google Forms / Indonesian spreadsheets
  const clean = str
    .replace(/GMT\+.*$/i, '')
    .replace(/\b(WIB|WITA|WIT)\b/gi, '')
    .trim();

  // 3. Match DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY (with optional time)
  // Example: "16/09/2026, 20.21.31" or "06/08/2026 20:03:21" or "16-09-2026"
  const dmyMatch = clean.match(
    /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})(?:[,\s]+(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?/
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    const year = parseInt(dmyMatch[3], 10);
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    const minute = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const second = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;

    let finalDay = day;
    let finalMonth = month;
    // Swap if month was placed first and exceeds 12
    if (month > 11 && day <= 12) {
      finalDay = month + 1;
      finalMonth = day - 1;
    }

    const d = new Date(year, finalMonth, finalDay, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }

  // 4. Match YYYY/MM/DD or YYYY-MM-DD with optional time
  // Example: "2026-09-16 20:21:31" or "2026/09/16"
  const ymdMatch = clean.match(
    /^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})(?:[,\s]+(\d{1,2})[:.](\d{1,2})(?:[:.](\d{1,2}))?)?/
  );
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    const hour = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    const minute = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    const second = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    const d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }

  // 5. Standard native Date parse fallback
  const direct = new Date(str);
  if (!isNaN(direct.getTime())) {
    return direct;
  }

  return null;
}

/**
 * Formats member registration timestamp safely, never displaying 'Invalid Date'.
 */
export function formatMemberTimestamp(timestampStr?: string): { date: string; time: string; full: string } {
  if (!timestampStr || timestampStr.trim() === '' || timestampStr.trim() === '-' || timestampStr.toLowerCase() === 'invalid date') {
    return { date: '-', time: '-', full: '-' };
  }

  const d = parseDateSafe(timestampStr);
  if (d) {
    const dateFormatted = d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return {
      date: dateFormatted,
      time: timeFormatted,
      full: `${dateFormatted}, ${timeFormatted}`,
    };
  }

  // If parsing fails, cleanly extract date/time parts without ever saying "Invalid Date"
  const parts = timestampStr.split(/[,\s]+/);
  return {
    date: parts[0] || timestampStr,
    time: parts[1] || '',
    full: timestampStr,
  };
}

/**
 * Format date string (YYYY-MM-DD, ISO, or DD/MM/YYYY) to English localized date
 */
export function formatIndonesianDate(dateStr: string): string {
  if (!dateStr || dateStr === '-') return '-';
  const d = parseDateSafe(dateStr);
  if (d) {
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  return dateStr;
}

/**
 * Sanitizes cell values against CSV Formula Injection / DDE attack (CWE-1236)
 * If a cell value starts with '=', '+', '-', '@', '\t', or '\r', prefix with an apostrophe.
 */
export function sanitizeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let str = String(value).trim();
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return str;
}

/**
 * Generate CSV string from array of objects
 */
export function exportToCsv(filename: string, rows: object[]) {
  if (!rows || !rows.length) return;
  const separator = ',';
  const keys = Object.keys(rows[0]);
  const csvContent =
    keys.join(separator) +
    '\n' +
    rows
      .map(row => {
        return keys
          .map(k => {
            const raw = (row as Record<string, unknown>)[k];
            let cell = sanitizeCsvCell(raw);
            cell = cell.replace(/"/g, '""');
            if (cell.search(/("|,|\n)/g) >= 0) {
              cell = `"${cell}"`;
            }
            return cell;
          })
          .join(separator);
      })
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Trigger file download directly from text content
 */
export function downloadTextFile(filename: string, content: string, mimeType: string = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Utility functions for robust gender & grade normalization across tabs
 */
export function isMaleMember(gender?: string | any): boolean {
  if (!gender) return false;
  const raw = typeof gender === 'object' ? (gender.gender || '') : String(gender || '');
  if (!raw) return false;
  const g = raw.toLowerCase().trim();
  return g === 'male' || g === 'laki-laki' || g === 'laki - laki' || g === 'laki' || g === 'l' || g === 'pria';
}

export function isFemaleMember(gender?: string | any): boolean {
  if (!gender) return false;
  const raw = typeof gender === 'object' ? (gender.gender || '') : String(gender || '');
  if (!raw) return false;
  const g = raw.toLowerCase().trim();
  return g === 'female' || g === 'perempuan' || g === 'p' || g === 'wanita';
}

export function normalizeGrade(grade?: string): string {
  if (!grade) return '';
  const clean = grade.toUpperCase().trim();
  if (clean === 'XII' || clean === '12' || clean.startsWith('XII') || clean.includes('DUA BELAS')) return 'XII';
  if (clean === 'XI' || clean === '11' || clean.startsWith('XI') || clean.includes('SEBELAS')) return 'XI';
  if (clean === 'X' || clean === '10' || clean.startsWith('X') || clean.includes('SEPULUH')) return 'X';
  return clean;
}

export function formatFullClass(grade?: string, classRoom?: string): string {
  const normGrade = normalizeGrade(grade);
  if (!normGrade && !classRoom) return '-';
  if (!classRoom) return normGrade || '-';
  return `${normGrade} ${classRoom}`.trim();
}
