import React, { useState, useMemo, useEffect } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  CalendarDays, 
  Clock, 
  Users, 
  Wallet, 
  CheckCircle2, 
  XCircle, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  ArrowRight,
  Filter,
  Sparkles,
  Search,
  X
} from 'lucide-react';
import { Member, AttendanceRecord, CashTransaction } from '../types';
import { formatRupiah, formatIndonesianDate } from '../utils/formatters';

interface CalendarTabProps {
  members: Member[];
  attendance: AttendanceRecord[];
  cash: CashTransaction[];
  initialSearchTerm?: string;
  onNavigateToAttendanceDate?: (dateStr: string) => void;
  onNavigateToCashMonth?: (monthKey: string) => void;
}

const CALENDAR_MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const CalendarTab: React.FC<CalendarTabProps> = ({
  members,
  attendance,
  cash,
  initialSearchTerm,
  onNavigateToAttendanceDate,
  onNavigateToCashMonth,
}) => {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Current view date (year and month)
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });

  const [selectedDayStr, setSelectedDayStr] = useState<string>(todayStr);
  const [calendarSearch, setCalendarSearch] = useState<string>(initialSearchTerm || '');

  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setCalendarSearch(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0 - 11
  const currentMonthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

  // Navigation functions
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleGoToday = () => {
    const now = new Date();
    setCurrentDate(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDayStr(now.toISOString().split('T')[0]);
  };

  // Pre-calculate month days & calendar cells (including padding for starting day of week)
  const calendarGrid = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const cells: {
      day: number;
      dateStr: string;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // 1. Previous month trailing days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const prevDate = new Date(year, month, -i);
      const prevY = prevDate.getFullYear();
      const prevM = String(prevDate.getMonth() + 1).padStart(2, '0');
      const prevD = String(prevDate.getDate()).padStart(2, '0');
      const dateStr = `${prevY}-${prevM}-${prevD}`;
      cells.push({
        day: prevDate.getDate(),
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // 2. Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({
        day: d,
        dateStr,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // 3. Next month leading days to complete full grid (multiple of 7, up to 35 or 42)
    const totalCellsNeeded = Math.ceil(cells.length / 7) * 7;
    const remaining = totalCellsNeeded - cells.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const nextY = nextDate.getFullYear();
      const nextM = String(nextDate.getMonth() + 1).padStart(2, '0');
      const nextD = String(nextDate.getDate()).padStart(2, '0');
      const dateStr = `${nextY}-${nextM}-${nextD}`;
      cells.push({
        day: nextDate.getDate(),
        dateStr,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return cells;
  }, [year, month, todayStr]);

  // Aggregate stats per date for fast lookup
  const dateDataMap = useMemo(() => {
    const map = new Map<
      string,
      {
        attendanceCount: number;
        hadirCount: number;
        izinCount: number;
        sakitCount: number;
        alpaCount: number;
        cashIn: number;
        cashOut: number;
        cashTxs: CashTransaction[];
        attendanceRecords: AttendanceRecord[];
      }
    >();

    // Index attendance
    attendance.forEach((att) => {
      if (!att.tanggal) return;
      const existing = map.get(att.tanggal) || {
        attendanceCount: 0,
        hadirCount: 0,
        izinCount: 0,
        sakitCount: 0,
        alpaCount: 0,
        cashIn: 0,
        cashOut: 0,
        cashTxs: [],
        attendanceRecords: [],
      };

      existing.attendanceCount += 1;
      if (att.status === 'Hadir') existing.hadirCount += 1;
      else if (att.status === 'Izin') existing.izinCount += 1;
      else if (att.status === 'Sakit') existing.sakitCount += 1;
      else if (att.status === 'Alpa') existing.alpaCount += 1;

      existing.attendanceRecords.push(att);
      map.set(att.tanggal, existing);
    });

    // Index cash transactions
    cash.forEach((tx) => {
      if (!tx.tanggal) return;
      const existing = map.get(tx.tanggal) || {
        attendanceCount: 0,
        hadirCount: 0,
        izinCount: 0,
        sakitCount: 0,
        alpaCount: 0,
        cashIn: 0,
        cashOut: 0,
        cashTxs: [],
        attendanceRecords: [],
      };

      if (tx.jenis === 'Masuk') {
        existing.cashIn += Number(tx.jumlah) || 0;
      } else {
        existing.cashOut += Number(tx.jumlah) || 0;
      }
      existing.cashTxs.push(tx);
      map.set(tx.tanggal, existing);
    });

    return map;
  }, [attendance, cash]);

  // Summary stats for the whole current month
  const monthSummary = useMemo(() => {
    let totalAttendanceDays = 0;
    let totalHadir = 0;
    let totalIzin = 0;
    let totalSakit = 0;
    let totalAlpa = 0;
    let totalCashIn = 0;
    let totalCashOut = 0;
    const meetingDatesSet = new Set<string>();

    dateDataMap.forEach((data, dateStr) => {
      if (dateStr.startsWith(currentMonthKey)) {
        if (data.attendanceCount > 0) {
          meetingDatesSet.add(dateStr);
          totalHadir += data.hadirCount;
          totalIzin += data.izinCount;
          totalSakit += data.sakitCount;
          totalAlpa += data.alpaCount;
        }
        totalCashIn += data.cashIn;
        totalCashOut += data.cashOut;
      }
    });

    totalAttendanceDays = meetingDatesSet.size;

    return {
      meetingsCount: totalAttendanceDays,
      totalHadir,
      totalIzin,
      totalSakit,
      totalAlpa,
      totalCashIn,
      totalCashOut,
      netCash: totalCashIn - totalCashOut,
    };
  }, [dateDataMap, currentMonthKey]);

  // Selected Day Details
  const selectedDayData = useMemo(() => {
    return (
      dateDataMap.get(selectedDayStr) || {
        attendanceCount: 0,
        hadirCount: 0,
        izinCount: 0,
        sakitCount: 0,
        alpaCount: 0,
        cashIn: 0,
        cashOut: 0,
        cashTxs: [],
        attendanceRecords: [],
      }
    );
  }, [dateDataMap, selectedDayStr]);

  // Search matching dates & items across attendance and cash
  const searchResults = useMemo(() => {
    const q = calendarSearch.toLowerCase().trim();
    if (!q) return { matchingDates: new Set<string>(), count: 0 };

    const matchingDates = new Set<string>();
    let count = 0;

    attendance.forEach((rec) => {
      const name = (rec.namaAnggota || (rec as any).nama_anggota || '').toLowerCase();
      const nisn = (rec.nisn || '').toLowerCase();
      const date = (rec.tanggal || '').toLowerCase();
      const status = (rec.status || '').toLowerCase();
      if (name.includes(q) || nisn.includes(q) || date.includes(q) || status.includes(q)) {
        matchingDates.add(rec.tanggal);
        count++;
      }
    });

    cash.forEach((item) => {
      const name = (item.namaAnggota || (item as any).nama_anggota || item.namaSiswa || '').toLowerCase();
      const ket = (item.keterangan || '').toLowerCase();
      const date = (item.tanggal || '').toLowerCase();
      const jenis = (item.jenis || '').toLowerCase();
      const amount = String(item.jumlah || '');
      if (name.includes(q) || ket.includes(q) || date.includes(q) || jenis.includes(q) || amount.includes(q)) {
        matchingDates.add(item.tanggal);
        count++;
      }
    });

    return { matchingDates, count };
  }, [calendarSearch, attendance, cash]);

  return (
    <div className="space-y-4">
      {/* Header Month Navigation & Summary */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-[#C7D2FE] shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] flex items-center justify-center font-bold">
                <CalendarDays className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Activity & Treasury Calendar Dashboard
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Monitor meeting schedules, member attendance records, and daily & monthly club treasury cash flow.
            </p>
          </div>

          {/* Search bar & Month Selector Controls */}
          <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
            {/* Calendar Search Input */}
            <div className="relative min-w-[200px] sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={calendarSearch}
                onChange={(e) => setCalendarSearch(e.target.value)}
                placeholder="Search attendance, name, or cash flow..."
                className="w-full pl-8 pr-8 py-1.5 bg-[#EEF2FF]/60 border border-[#C7D2FE] rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#4338CA] transition"
              />
              {calendarSearch && (
                <button
                  type="button"
                  onClick={() => setCalendarSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Month Navigation Prev/Next */}
            <div className="flex items-center bg-[#EEF2FF] rounded-xl border border-[#C7D2FE] p-0.5">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#312E81] hover:text-[#4338CA] hover:bg-white transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="px-3 text-xs sm:text-sm font-bold text-slate-800 whitespace-nowrap min-w-[130px] text-center">
                {CALENDAR_MONTHS[month]} {year}
              </div>
              <button
                type="button"
                onClick={handleNextMonth}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-[#312E81] hover:text-[#4338CA] hover:bg-white transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Search Results Notice Banner when searching */}
        {calendarSearch && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between text-xs text-amber-900">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                Search <strong>"{calendarSearch}"</strong>: found on{' '}
                <strong>{searchResults.matchingDates.size}</strong> dates ({searchResults.count} entries). Matching dates are highlighted on the calendar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setCalendarSearch('')}
              className="font-bold underline hover:text-amber-700 cursor-pointer"
            >
              Reset
            </button>
          </div>
        )}

        {/* Month Quick Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 pt-4">
          <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-[11px] font-bold text-[#312E81] uppercase tracking-wider truncate">Attendance Sessions</div>
              <div className="text-sm sm:text-base font-extrabold text-[#4338CA] mt-0.5 font-mono truncate">
                {monthSummary.meetingsCount} <span className="text-xs font-medium text-[#312E81]">Days</span>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#C7D2FE]/40 text-[#4338CA] flex items-center justify-center shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-[11px] font-bold text-emerald-700 uppercase tracking-wider truncate">Treasury Income</div>
              <div className="text-sm sm:text-base font-extrabold text-emerald-900 mt-0.5 font-mono truncate" title={formatRupiah(monthSummary.totalCashIn)}>
                {formatRupiah(monthSummary.totalCashIn)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center shrink-0">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-[11px] font-bold text-rose-700 uppercase tracking-wider truncate">Treasury Expenses</div>
              <div className="text-sm sm:text-base font-extrabold text-rose-900 mt-0.5 font-mono truncate" title={formatRupiah(monthSummary.totalCashOut)}>
                {formatRupiah(monthSummary.totalCashOut)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="text-[10px] sm:text-[11px] font-bold text-[#312E81] uppercase tracking-wider truncate">Net Monthly Balance</div>
              <div className={`text-sm sm:text-base font-extrabold mt-0.5 font-mono truncate ${monthSummary.netCash >= 0 ? 'text-[#4338CA]' : 'text-rose-700'}`} title={formatRupiah(monthSummary.netCash)}>
                {formatRupiah(monthSummary.netCash)}
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#C7D2FE]/40 text-[#4338CA] flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Calendar Grid (Left/Top) & Date Detail Inspector (Right/Bottom) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Calendar Grid (7 cols) */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-4 sm:p-5 border border-[#C7D2FE] shadow-xs space-y-3">
          
          {/* Day Names Header */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
            {DAY_NAMES.map((name, i) => (
              <div
                key={name}
                className={`py-1.5 text-xs font-extrabold uppercase tracking-wider rounded-lg ${
                  i === 0 ? 'text-rose-600 bg-rose-50/50' : i === 6 ? 'text-[#4338CA] bg-[#EEF2FF]' : 'text-slate-500 bg-[#EEF2FF]/60'
                }`}
              >
                {name}
              </div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarGrid.map((cell, idx) => {
              const data = dateDataMap.get(cell.dateStr);
              const isSelected = cell.dateStr === selectedDayStr;
              const isSearchMatch = searchResults.matchingDates.has(cell.dateStr);
              const hasAttendance = data && data.attendanceCount > 0;
              const hasCash = data && (data.cashIn > 0 || data.cashOut > 0);

              return (
                <button
                  key={`${cell.dateStr}-${idx}`}
                  type="button"
                  onClick={() => setSelectedDayStr(cell.dateStr)}
                  className={`min-h-[72px] sm:min-h-[88px] p-1.5 rounded-xl border text-left flex flex-col justify-between transition relative cursor-pointer group ${
                    isSelected
                      ? 'bg-[#EEF2FF] border-[#4338CA] ring-2 ring-[#4338CA]/30 shadow-xs'
                      : isSearchMatch
                      ? 'bg-amber-50/80 border-amber-400 ring-2 ring-amber-400/40 shadow-xs'
                      : cell.isToday
                      ? 'bg-amber-50/50 border-amber-300 hover:border-amber-400'
                      : cell.isCurrentMonth
                      ? 'bg-white hover:bg-[#EEF2FF]/50 border-[#C7D2FE] hover:border-[#4338CA]/40'
                      : 'bg-slate-50/40 border-slate-100 text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {/* Day Number and Today/Match Badge */}
                  <div className="flex items-center justify-between w-full">
                    <span
                      className={`text-xs sm:text-sm font-bold ${
                        isSelected
                          ? 'text-[#4338CA] font-extrabold'
                          : isSearchMatch
                          ? 'text-amber-900 font-extrabold'
                          : cell.isToday
                          ? 'text-amber-800 font-black'
                          : cell.isCurrentMonth
                          ? 'text-slate-800'
                          : 'text-slate-400'
                      }`}
                    >
                      {cell.day}
                    </span>

                    {isSearchMatch && !cell.isToday && (
                      <span className="text-[8px] font-black bg-amber-500 text-white px-1 py-0.2 rounded leading-tight">
                        Match
                      </span>
                    )}

                    {cell.isToday && (
                      <span className="text-[9px] font-extrabold bg-amber-500 text-white px-1.5 py-0.2 rounded-md leading-tight">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Day Activity Indicators */}
                  <div className="space-y-1 mt-1 w-full">
                    {hasAttendance && (
                      <div className="flex items-center gap-1 bg-emerald-50 border border-emerald-200 px-1 py-0.5 rounded text-[9px] font-bold text-emerald-800 truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="truncate">{data.hadirCount} Present</span>
                      </div>
                    )}

                    {hasCash && (
                      <div className={`flex items-center gap-1 px-1 py-0.5 rounded text-[9px] font-bold truncate border ${
                        data.cashIn > 0 
                          ? 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]' 
                          : 'bg-rose-50 text-rose-800 border-rose-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${data.cashIn > 0 ? 'bg-[#4338CA]' : 'bg-rose-500'}`} />
                        <span className="truncate">
                          {data.cashIn > 0 ? `+${data.cashIn / 1000}k` : `-${data.cashOut / 1000}k`}
                        </span>
                      </div>
                    )}

                    {!hasAttendance && !hasCash && cell.isCurrentMonth && (
                      <div className="h-3" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="pt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-500 border-t border-slate-100">
            <span className="font-bold text-slate-700">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              <span>Attendance Recorded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4338CA]" />
              <span>Treasury Income Recorded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              <span>Treasury Expense Recorded</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span>Today</span>
            </div>
          </div>
        </div>

        {/* Right Side: Selected Day Inspector & Quick Actions */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-4 sm:p-5 border border-[#C7D2FE] shadow-xs flex flex-col justify-between space-y-4">
          <div>
            {/* Header Selected Date */}
            <div className="pb-3 border-b border-slate-100">
              <div className="text-[11px] font-bold text-[#4338CA] uppercase tracking-wider flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                <span>Selected Date Details:</span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900 mt-1">
                {formatIndonesianDate(selectedDayStr)}
              </h3>
              <p className="text-xs text-slate-500 font-mono mt-0.5">{selectedDayStr}</p>
            </div>

            {/* Attendance Box for this Date */}
            <div className="mt-4 p-3.5 rounded-xl bg-[#EEF2FF]/50 border border-[#C7D2FE] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  Attendance Summary
                </span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                  {selectedDayData.attendanceCount} Students
                </span>
              </div>

              {selectedDayData.attendanceCount > 0 ? (
                <div className="grid grid-cols-4 gap-1.5 text-center pt-1">
                  <div className="bg-emerald-100/70 p-1.5 rounded-lg border border-emerald-200">
                    <div className="text-[10px] font-bold text-emerald-800">Present</div>
                    <div className="text-sm font-extrabold text-emerald-900">{selectedDayData.hadirCount}</div>
                  </div>
                  <div className="bg-[#EEF2FF] p-1.5 rounded-lg border border-[#C7D2FE]">
                    <div className="text-[10px] font-bold text-[#4338CA]">Excused</div>
                    <div className="text-sm font-extrabold text-[#312E81]">{selectedDayData.izinCount}</div>
                  </div>
                  <div className="bg-amber-100/70 p-1.5 rounded-lg border border-amber-200">
                    <div className="text-[10px] font-bold text-amber-800">Sick</div>
                    <div className="text-sm font-extrabold text-amber-900">{selectedDayData.sakitCount}</div>
                  </div>
                  <div className="bg-rose-100/70 p-1.5 rounded-lg border border-rose-200">
                    <div className="text-[10px] font-bold text-rose-800">Absent</div>
                    <div className="text-sm font-extrabold text-rose-900">{selectedDayData.alpaCount}</div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No attendance records on this date.</p>
              )}

              {onNavigateToAttendanceDate && (
                <button
                  type="button"
                  onClick={() => onNavigateToAttendanceDate(selectedDayStr)}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-[#4338CA] hover:bg-[#312E81] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span>Open / Record Attendance for Date</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Cash Box for this Date */}
            <div className="mt-3.5 p-3.5 rounded-xl bg-[#EEF2FF]/50 border border-[#C7D2FE] space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-[#4338CA]" />
                  Treasury on this Date
                </span>
                <span className="text-xs font-extrabold px-2 py-0.5 rounded-full bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]">
                  {selectedDayData.cashTxs.length} Transactions
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="bg-white p-2 rounded-lg border border-[#C7D2FE]">
                  <div className="text-[10px] font-semibold text-slate-500">Income</div>
                  <div className="text-xs sm:text-sm font-extrabold text-emerald-700">
                    {formatRupiah(selectedDayData.cashIn)}
                  </div>
                </div>
                <div className="bg-white p-2 rounded-lg border border-[#C7D2FE]">
                  <div className="text-[10px] font-semibold text-slate-500">Expense</div>
                  <div className="text-xs sm:text-sm font-extrabold text-rose-700">
                    {formatRupiah(selectedDayData.cashOut)}
                  </div>
                </div>
              </div>

              {selectedDayData.cashTxs.length > 0 && (
                <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1 text-xs">
                  {selectedDayData.cashTxs.map((tx, i) => (
                    <div
                      key={tx.id || i}
                      className="p-1.5 rounded-lg bg-white border border-[#C7D2FE] flex items-center justify-between text-[11px]"
                    >
                      <div className="truncate max-w-[140px]">
                        <span className="font-bold text-slate-800 block truncate">
                          {tx.namaAnggota || tx.namaSiswa || tx.keterangan || 'Transaction'}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">{tx.keterangan}</span>
                      </div>
                      <span
                        className={`font-extrabold whitespace-nowrap ${
                          tx.jenis === 'Masuk' ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {tx.jenis === 'Masuk' ? '+' : '-'}
                        {formatRupiah(tx.jumlah)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {onNavigateToCashMonth && (
                <button
                  type="button"
                  onClick={() => onNavigateToCashMonth(selectedDayStr.slice(0, 7))}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-[#4338CA] hover:bg-[#312E81] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-xs"
                >
                  <span>Open Treasury for {CALENDAR_MONTHS[month]}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
