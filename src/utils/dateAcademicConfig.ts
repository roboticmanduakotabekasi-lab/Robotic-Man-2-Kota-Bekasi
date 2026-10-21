/**
 * Utilities for Realtime & Custom Date & Academic Year
 */

export interface DateAcademicConfig {
  dateMode: 'auto' | 'custom';
  customDate: string; // YYYY-MM-DD
  academicYearMode: 'auto' | 'custom';
  customAcademicYear: string; // e.g. '2026/2027'
}

/**
 * Automatically compute Academic Year (Tahun Ajaran) in Indonesia:
 * New academic year begins in July (Month index 6).
 * July 2026 - June 2027 => "2026/2027"
 * January 2026 - June 2026 => "2025/2026"
 */
export function calculateAutoAcademicYear(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0 = Jan, 6 = Jul
  return month >= 6 ? `${year}/${year + 1}` : `${year - 1}/${year}`;
}

/**
 * Format Date object to YYYY-MM-DD string accurately in Asia/Jakarta (WIB, UTC+7) timezone.
 * Prevents UTC day rollover discrepancies late at night / early in the morning in Indonesia.
 */
export function getWibTodayDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(date); // en-CA format is standard YYYY-MM-DD
  } catch {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/**
 * Format Date object to YYYY-MM-DD string (standardized to WIB timezone)
 */
export function toDateInputValue(date: Date = new Date()): string {
  return getWibTodayDateString(date);
}

/**
 * Format date for full header display (English)
 */
export function formatFullIndonesianDate(dateStrOrObj: string | Date): string {
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return String(dateStrOrObj);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  } catch {
    return String(dateStrOrObj);
  }
}

/**
 * Format date for compact header pill (e.g. "Sep 16, 2026")
 */
export function formatCompactDate(dateStrOrObj: string | Date): string {
  try {
    const d = typeof dateStrOrObj === 'string' ? new Date(dateStrOrObj) : dateStrOrObj;
    if (isNaN(d.getTime())) return String(dateStrOrObj);
    return d.toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch {
    return String(dateStrOrObj);
  }
}

const STORAGE_KEY = 'robotics_date_academic_config';

export function getInitialDateAcademicConfig(): DateAcademicConfig {
  const todayStr = toDateInputValue(new Date());
  const autoYear = calculateAutoAcademicYear(new Date());

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        dateMode: parsed.dateMode === 'custom' ? 'custom' : 'auto',
        customDate: parsed.customDate || todayStr,
        academicYearMode: parsed.academicYearMode === 'custom' ? 'custom' : 'auto',
        customAcademicYear: parsed.customAcademicYear || autoYear,
      };
    }
  } catch {}

  return {
    dateMode: 'auto',
    customDate: todayStr,
    academicYearMode: 'auto',
    customAcademicYear: autoYear,
  };
}

export function saveDateAcademicConfigToStorage(config: DateAcademicConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    window.dispatchEvent(new CustomEvent('robotics-date-academic-change', { detail: config }));
  } catch {}
}
