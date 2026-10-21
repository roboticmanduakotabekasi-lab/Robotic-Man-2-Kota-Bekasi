/**
 * src/utils/attendanceWindow.ts
 * Aturan Jadwal Presensi Otomatis (Smart Attendance Window):
 * Dibuka: Hari Rabu (00:00:00 WIB)
 * Ditutup: Hari Kamis (23:59:59 WIB)
 * Diblokir: Hari Jumat 00:00 WIB s/d Selasa 23:59:59 WIB
 */

export interface AttendanceScheduleStatus {
  isOpen: boolean;
  dayIndex: number; // 0 = Minggu, 1 = Senin, ..., 3 = Rabu, 4 = Kamis, ..., 6 = Sabtu
  dayName: string;
  timeString: string;
  scheduleDescription: string;
  remainingTimeText?: string;
  statusBadge: {
    label: string;
    bgColor: string;
    textColor: string;
    borderColor: string;
  };
  reasonText: string;
  nextSessionInfo: string;
  isTestingBypass: boolean;
}

export const BYPASS_ATTENDANCE_STORAGE_KEY = 'robotics_attendance_bypass_schedule';

/**
 * Checks if the attendance bypass is enabled.
 * Strictly restricted to verified Administrator, Faculty Advisor, or Executive Board accounts
 * to prevent unauthorized attendance submission by general students outside allowed days.
 */
export function isBypassScheduleEnabled(userSession?: { role?: string; username?: string; jabatan?: string } | null): boolean {
  try {
    const rawVal = localStorage.getItem(BYPASS_ATTENDANCE_STORAGE_KEY) === 'true';
    if (!rawVal) return false;

    let session = userSession;
    if (!session && typeof localStorage !== 'undefined') {
      try {
        const savedAuth = localStorage.getItem('robotics_auth');
        if (savedAuth) session = JSON.parse(savedAuth);
      } catch {}
    }

    if (!session) return false;

    const cleanRole = (session.role || '').toLowerCase();
    const cleanUser = (session.username || '').toLowerCase();
    const isExecutiveOrAdmin =
      cleanRole === 'admin' ||
      cleanRole === 'executive_board' ||
      cleanRole.includes('executive') ||
      cleanRole.includes('pembina') ||
      cleanRole.includes('ketua') ||
      cleanUser === 'admin' ||
      cleanUser === 'pembina';

    return isExecutiveOrAdmin;
  } catch {
    return false;
  }
}

export function setBypassScheduleEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BYPASS_ATTENDANCE_STORAGE_KEY, String(enabled));
    window.dispatchEvent(new CustomEvent('robotics-attendance-schedule-change', { detail: enabled }));
  } catch {}
}

const ENGLISH_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Checks whether the current time is within the official attendance window (Wednesday 00:00:00 to Thursday 23:59:59 WIB)
 * Submissions outside this timeframe are blocked.
 */
export function checkAttendanceSchedule(
  targetDate: Date = new Date(),
  overrideTestingMode?: boolean
): AttendanceScheduleStatus {
  const isOverrideActive = overrideTestingMode !== undefined ? overrideTestingMode : isBypassScheduleEnabled();

  // Attempt to resolve exact time in WIB timezone (Asia/Jakarta, UTC+7)
  let dayIdx = targetDate.getDay();
  let currentHours = targetDate.getHours();
  let currentMinutes = targetDate.getMinutes();
  let currentSeconds = targetDate.getSeconds();

  try {
    const wibFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = wibFormatter.formatToParts(targetDate);
    const wibWeekday = parts.find((p) => p.type === 'weekday')?.value;
    const wibHour = parseInt(parts.find((p) => p.type === 'hour')?.value || '', 10);
    const wibMinute = parseInt(parts.find((p) => p.type === 'minute')?.value || '', 10);
    const wibSecond = parseInt(parts.find((p) => p.type === 'second')?.value || '0', 10);

    if (wibWeekday && !isNaN(wibHour) && !isNaN(wibMinute)) {
      const weekdayMap: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
      };
      if (weekdayMap[wibWeekday] !== undefined) {
        dayIdx = weekdayMap[wibWeekday];
        currentHours = wibHour;
        currentMinutes = wibMinute;
        currentSeconds = isNaN(wibSecond) ? 0 : wibSecond;
      }
    }
  } catch {
    // Fallback to local system time
  }

  const currentDayName = ENGLISH_DAYS[dayIdx] || 'Today';
  const timeFormatted = `${String(currentHours).padStart(2, '0')}:${String(currentMinutes).padStart(2, '0')}:${String(currentSeconds).padStart(2, '0')} WIB`;

  // Official Automation Rules:
  // Wednesday (dayIdx === 3): Open 00:00:00 to 23:59:59 WIB
  // Thursday  (dayIdx === 4): Open 00:00:00 to 23:59:59 WIB
  // Friday, Saturday, Sunday, Monday, Tuesday: Blocked
  const isWednesday = dayIdx === 3;
  const isThursday = dayIdx === 4;
  const isWithinOfficialWindow = isWednesday || isThursday;

  // If testing / bypass mode is active
  if (isOverrideActive) {
    return {
      isOpen: true,
      dayIndex: dayIdx,
      dayName: currentDayName,
      timeString: timeFormatted,
      scheduleDescription: 'Wednesday 00:00 to Thursday 23:59 WIB (Testing Mode Active)',
      remainingTimeText: 'Testing Mode Active (Schedule Bypass)',
      statusBadge: {
        label: 'Attendance Active (Testing Bypass)',
        bgColor: 'bg-amber-100 text-amber-900 border-amber-300',
        textColor: 'text-amber-900',
        borderColor: 'border-amber-300',
      },
      reasonText: 'Session unlocked via testing mode (Schedule Bypass). You can test recording attendance at any time.',
      nextSessionInfo: 'Standard schedule: Every Wednesday 00:00 WIB through Thursday 23:59 WIB.',
      isTestingBypass: true,
    };
  }

  if (isWithinOfficialWindow) {
    // Calculate hours and minutes remaining until Thursday 23:59:59 WIB
    let remainingMinutesUntilClose = 0;
    if (isWednesday) {
      // Remaining on Wednesday + entire Thursday (24h = 1440 mins)
      const minutesLeftWednesday = (23 - currentHours) * 60 + (59 - currentMinutes);
      remainingMinutesUntilClose = minutesLeftWednesday + 24 * 60;
    } else {
      // Remaining on Thursday until 23:59
      remainingMinutesUntilClose = Math.max(0, (23 - currentHours) * 60 + (59 - currentMinutes));
    }

    const remHours = Math.floor(remainingMinutesUntilClose / 60);
    const remMins = remainingMinutesUntilClose % 60;
    const remainingTimeText = `${remHours}h ${remMins}m remaining`;

    return {
      isOpen: true,
      dayIndex: dayIdx,
      dayName: currentDayName,
      timeString: timeFormatted,
      scheduleDescription: 'Wednesdays 00:00 through Thursdays 23:59 WIB',
      remainingTimeText,
      statusBadge: {
        label: isThursday
          ? `Final Day (Closes Tonight at 23:59 WIB • ${remainingTimeText})`
          : `Attendance Window Open (Closes Thu 23:59 WIB • ${remainingTimeText})`,
        bgColor: isThursday ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300',
        textColor: isThursday ? 'text-amber-900' : 'text-emerald-900',
        borderColor: isThursday ? 'border-amber-300' : 'border-emerald-300',
      },
      reasonText: isThursday
        ? `Today is Thursday (${timeFormatted}). Attendance window is active and will automatically close tonight at 23:59 WIB (${remainingTimeText}).`
        : `Today is Wednesday (${timeFormatted}). Weekly attendance window is active through Thursday 23:59 WIB (${remainingTimeText}).`,
      nextSessionInfo: `Submission deadline: Thursday at 23:59 WIB (${remainingTimeText}).`,
      isTestingBypass: false,
    };
  }

  // If Closed (Friday, Saturday, Sunday, Monday, Tuesday)
  // Calculate days & hours until next Wednesday 00:00:00 WIB
  let daysUntilWednesday = (3 - dayIdx + 7) % 7;
  if (daysUntilWednesday === 0) daysUntilWednesday = 7;
  const hoursUntilWednesday = (daysUntilWednesday - 1) * 24 + (24 - currentHours);
  const countdownText = `${daysUntilWednesday} days (${hoursUntilWednesday} hours)`;

  return {
    isOpen: false,
    dayIndex: dayIdx,
    dayName: currentDayName,
    timeString: timeFormatted,
    scheduleDescription: 'Wednesdays 00:00 through Thursdays 23:59 WIB',
    remainingTimeText: `Opens in ${countdownText}`,
    statusBadge: {
      label: 'Attendance Window Closed',
      bgColor: 'bg-rose-50 text-rose-800 border-rose-200',
      textColor: 'text-rose-800',
      borderColor: 'border-rose-200',
    },
    reasonText: `Attendance submissions are currently blocked (${currentDayName}, ${timeFormatted}). The weekly check-in window opens automatically every Wednesday at 00:00 WIB and closes Thursday at 23:59 WIB.`,
    nextSessionInfo: `Next weekly attendance session will open next Wednesday at 00:00 WIB (${countdownText}).`,
    isTestingBypass: false,
  };
}

/**
 * Validates whether an attendance submission is allowed under the smart schedule window
 */
export function validateAttendanceSubmission(isTestingMode?: boolean): { allowed: boolean; reason: string } {
  const status = checkAttendanceSchedule(new Date(), isTestingMode);
  if (status.isOpen) {
    return { allowed: true, reason: status.reasonText };
  }
  return {
    allowed: false,
    reason: `Submission blocked: Outside active attendance window. The weekly window is open from Wednesday 00:00 through Thursday 23:59 WIB. ${status.nextSessionInfo}`,
  };
}
