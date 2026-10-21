import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Download, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  XCircle,
  Printer,
  History,
  CheckCheck,
  RotateCcw,
  Sparkles,
  Users,
  Trash2,
  X,
  FileText,
  RefreshCw,
  Upload,
  ShieldAlert,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, AttendanceRecord, AttendanceStatus } from '../types';
import { exportToCsv, formatIndonesianDate } from '../utils/formatters';
import { exportDailyAttendancePdf, exportAttendanceHistoryPdf } from '../utils/pdfExport';
import { normalizeGrade, formatFullClass } from './MembersTab';
import { triggerCelebration, playClickTick, playSuccessChime } from '../utils/audioFeedback';
import { ImportCsvModal } from './ImportCsvModal';
import { hasPermission, getRoleMetadata } from '../utils/rbac';
import { 
  checkAttendanceSchedule, 
  isBypassScheduleEnabled, 
  setBypassScheduleEnabled 
} from '../utils/attendanceWindow';

interface AttendanceTabProps {
  members: Member[];
  attendance: AttendanceRecord[];
  activeDate?: string;
  initialSearchTerm?: string;
  onAddAttendance: (record: Omit<AttendanceRecord, 'id'>) => Promise<void>;
  onBulkAttendance?: (records: Omit<AttendanceRecord, 'id'>[]) => Promise<void>;
  onDeleteAttendance: (id: string, index?: number, record?: AttendanceRecord) => Promise<void> | void;
  onResetMemberAttendance?: (tanggal: string, member: Member) => Promise<void> | void;
  onResetDateAttendance?: (tanggal: string) => Promise<void> | void;
  onResetAllAttendance?: () => Promise<void> | void;
  isSubmitting: boolean;
  onRefreshData?: () => Promise<void> | void;
  isSyncing?: boolean;
  onAttendanceUpdated?: (updated: AttendanceRecord[]) => void;
  isDemo?: boolean;
  currentUserRole?: string;
}

export const AttendanceTab: React.FC<AttendanceTabProps> = ({
  members,
  attendance,
  activeDate,
  initialSearchTerm,
  onAddAttendance,
  onBulkAttendance,
  onDeleteAttendance,
  onResetMemberAttendance,
  onResetDateAttendance,
  onResetAllAttendance,
  isSubmitting,
  onRefreshData,
  isSyncing = false,
  onAttendanceUpdated,
  isDemo = false,
  currentUserRole,
}) => {
  // RBAC Permission checks
  const canInputAttendance = hasPermission(currentUserRole, 'attendance:create');
  const canResetAttendance = hasPermission(currentUserRole, 'attendance:reset');
  const roleMeta = getRoleMetadata(currentUserRole);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(activeDate || todayStr);
  const [searchMember, setSearchMember] = useState(initialSearchTerm || '');
  const [filterGrade, setFilterGrade] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [viewSubTab, setViewSubTab] = useState<'daily' | 'history'>('daily');
  const [historySearch, setHistorySearch] = useState(initialSearchTerm || '');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('ALL');
  const [resetConfirmOpen, setResetConfirmOpen] = useState<boolean>(false);
  const [resetAllHistoryConfirmOpen, setResetAllHistoryConfirmOpen] = useState<boolean>(false);
  const [resetAllConfirmationInput, setResetAllConfirmationInput] = useState<string>('');
  const [attendanceToDelete, setAttendanceToDelete] = useState<AttendanceRecord | null>(null);

  // Jadwal Presensi Mandiri Siswa (Rabu 00:00 s/d Kamis 23:59 WIB)
  const [bypassSchedule, setBypassSchedule] = useState<boolean>(() => isBypassScheduleEnabled());

  React.useEffect(() => {
    const handleScheduleChange = (e: CustomEvent<boolean>) => {
      setBypassSchedule(e.detail);
    };
    window.addEventListener('robotics-attendance-schedule-change' as any, handleScheduleChange);
    return () => window.removeEventListener('robotics-attendance-schedule-change' as any, handleScheduleChange);
  }, []);

  const attendanceSchedule = useMemo(() => {
    return checkAttendanceSchedule(new Date(), bypassSchedule);
  }, [bypassSchedule]);

  const handleOpenResetModal = () => {
    playClickTick();
    setResetConfirmOpen(true);
  };

  const handleConfirmReset = async () => {
    setResetConfirmOpen(false);
    if (onResetDateAttendance) {
      await onResetDateAttendance(selectedDate);
    }
  };

  React.useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchMember(initialSearchTerm);
      setHistorySearch(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  const handleToggleStatusFilter = (status: string) => {
    playClickTick();
    if (status === 'Kehadiran' || status === 'Attendance Rate' || status === 'ALL') {
      setFilterStatus('ALL');
      return;
    }
    setFilterStatus((prev) => (prev === status ? 'ALL' : status));
  };

  // Step Date forward or backward
  const handleDateOffset = (offset: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + offset);
    setSelectedDate(d.toISOString().split('T')[0]);
  };

  // Helper string normalizers
  const normStr = (str?: string) => (str || '').trim().toLowerCase();
  const normDate = (d?: string) => (d || '').slice(0, 10).trim();

  // Map of selected date's attendance: Map<string, AttendanceStatus>
  const dayAttendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceStatus>();
    const curDate = normDate(selectedDate);

    attendance.forEach((rec) => {
      if (normDate(rec.tanggal) === curDate) {
        const recNisn = (rec.nisn || '').trim();
        const recName = normStr(rec.namaAnggota);

        if (recNisn && recNisn !== '-') {
          map.set(`nisn:${recNisn}`, rec.status);
        }
        if (recName) {
          map.set(`name:${recName}`, rec.status);
        }
      }
    });
    return map;
  }, [attendance, selectedDate]);

  // Helper to retrieve status for any member reliably
  const getMemberStatus = (m: Member): AttendanceStatus | undefined => {
    const mNisn = (m.nisn || '').trim();
    const mName = normStr(m.fullName);
    if (mNisn && mNisn !== '-' && dayAttendanceMap.has(`nisn:${mNisn}`)) {
      return dayAttendanceMap.get(`nisn:${mNisn}`);
    }
    if (mName && dayAttendanceMap.has(`name:${mName}`)) {
      return dayAttendanceMap.get(`name:${mName}`);
    }
    return undefined;
  };

  // Statistics for selected date
  const stats = useMemo(() => {
    let hadir = 0;
    let izin = 0;
    let sakit = 0;
    let alpha = 0;
    let belumAbsen = 0;

    members.forEach((m) => {
      const st = getMemberStatus(m);
      if (st === 'Hadir') hadir++;
      else if (st === 'Izin') izin++;
      else if (st === 'Sakit') sakit++;
      else if (st === 'Alpha') alpha++;
      else belumAbsen++;
    });

    const total = members.length;
    const persentaseHadir = total > 0 ? Math.round((hadir / total) * 100) : 0;

    return { hadir, izin, sakit, alpha, belumAbsen, total, persentaseHadir };
  }, [members, dayAttendanceMap]);

  // Filtered members for daily attendance
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchMember.toLowerCase().trim();
      const mFullName = (m.fullName || (m as any).full_name || '').toLowerCase();
      const mNisn = (m.nisn || '').toLowerCase();
      const mClass = (m.classRoom || '').toLowerCase();
      const mGrade = (m.grade || '').toLowerCase();
      const mFullClass = formatFullClass(m.grade, m.classRoom).toLowerCase();
      const rawStatus = getMemberStatus(m);
      const activeStatus = rawStatus || 'Unrecorded';
      const currentStatus = activeStatus.toLowerCase();

      const matchSearch =
        !q ||
        mFullName.includes(q) ||
        mNisn.includes(q) ||
        mClass.includes(q) ||
        mGrade.includes(q) ||
        mFullClass.includes(q) ||
        currentStatus.includes(q);

      const matchGrade =
        filterGrade === 'ALL' ||
        normalizeGrade(m.grade) === normalizeGrade(filterGrade) ||
        m.grade === filterGrade;

      const matchStatus = 
        filterStatus === 'ALL' || 
        activeStatus === filterStatus ||
        (filterStatus === 'Unrecorded' && (!rawStatus || (rawStatus as string) === 'Belum Absen')) ||
        (filterStatus === 'Present' && (rawStatus === 'Present' || rawStatus === 'Hadir')) ||
        (filterStatus === 'Permitted' && ((rawStatus as string) === 'Permitted' || rawStatus === 'Excused' || rawStatus === 'Izin')) ||
        (filterStatus === 'Sick' && (rawStatus === 'Sick' || rawStatus === 'Sakit')) ||
        (filterStatus === 'Absent' && ((rawStatus as string) === 'Absent' || rawStatus === 'Unexcused' || rawStatus === 'Alpha'));

      return matchSearch && matchGrade && matchStatus;
    });
  }, [members, searchMember, filterGrade, filterStatus, dayAttendanceMap]);

  // Filtered attendance records for history tab
  const filteredHistory = useMemo(() => {
    return attendance
      .filter((rec) => {
        const q = historySearch.toLowerCase().trim();
        const recName = (rec.namaAnggota || (rec as any).nama_anggota || '').toLowerCase();
        const recNisn = (rec.nisn || '').toLowerCase();
        const recDate = (rec.tanggal || '').toLowerCase();
        const recStatus = (rec.status || '').toLowerCase();

        const matchSearch =
          !q ||
          recName.includes(q) ||
          recNisn.includes(q) ||
          recDate.includes(q) ||
          recStatus.includes(q);

        const matchStatus = historyStatusFilter === 'ALL' || rec.status === historyStatusFilter;
        return matchSearch && matchStatus;
      })
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [attendance, historySearch, historyStatusFilter]);

  // Status changer for single member with instant synchronous execution & audio feedback
  const handleStatusChange = (member: Member, status: AttendanceStatus) => {
    playSuccessChime();
    onAddAttendance({
      tanggal: normDate(selectedDate),
      nisn: (member.nisn || '').trim(),
      namaAnggota: (member.fullName || '').trim(),
      status: status,
    });
  };

  // Bulk mark all members as Hadir with celebratory effects
  const handleMarkAllHadir = async () => {
    if (members.length === 0) return;
    triggerCelebration(['#10B981', '#4338CA', '#38BDF8', '#F59E0B']);
    const records = members.map((m) => ({
      tanggal: selectedDate,
      nisn: m.nisn,
      namaAnggota: m.fullName,
      status: 'Hadir' as AttendanceStatus,
    }));

    if (onBulkAttendance) {
      await onBulkAttendance(records);
    } else {
      for (const r of records) {
        await onAddAttendance(r);
      }
    }
  };

  const handleExportCsv = () => {
    if (viewSubTab === 'daily') {
      const recordsToExport = attendance.filter((a) => a.tanggal === selectedDate);
      exportToCsv(`absensi_robotic_man_2_kota_bekasi_${selectedDate}.csv`, recordsToExport);
    } else {
      exportToCsv(`semua_riwayat_absensi_robotic_man_2_kota_bekasi.csv`, filteredHistory);
    }
  };

  const handleExportPdf = () => {
    if (viewSubTab === 'daily') {
      exportDailyAttendancePdf({
        dateStr: selectedDate,
        members,
        attendanceRecords: attendance,
      });
    } else {
      exportAttendanceHistoryPdf({
        title: 'REKAPITULASI RIWAYAT PRESENSI ANGGOTA',
        subtitle: historyStatusFilter !== 'ALL' ? `Filter Status: ${historyStatusFilter}` : '',
        records: filteredHistory,
      });
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="space-y-4 w-full"
    >
      
      {/* Top Header Controls: Sub-Tabs & Date Navigator */}
      <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-[#C7D2FE] shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-2.5">
        
        {/* Sub Navigation: Presensi Harian vs Riwayat Rekap */}
        <div className="flex items-center gap-1 bg-[#EEF2FF] p-1 rounded-xl border border-[#C7D2FE]">
          <button
            type="button"
            onClick={() => setViewSubTab('daily')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewSubTab === 'daily'
                ? 'bg-[#4338CA] text-white shadow-2xs'
                : 'text-slate-600 hover:text-[#4338CA]'
            }`}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Daily Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setViewSubTab('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              viewSubTab === 'history'
                ? 'bg-[#4338CA] text-white shadow-2xs'
                : 'text-slate-600 hover:text-[#4338CA]'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>History &amp; Logs</span>
            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono ${
              viewSubTab === 'history' ? 'bg-[#312E81] text-[#C7D2FE]' : 'bg-[#C7D2FE]/60 text-[#312E81]'
            }`}>
              {attendance.length}
            </span>
          </button>
        </div>

        {/* Action Tools: Direct PDF Export, CSV Export (Outline / Secondary) */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleExportPdf}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs"
            title="Download Official Attendance Report in PDF Format"
          >
            <FileText className="w-3.5 h-3.5 text-slate-500" />
            <span>Print PDF</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition cursor-pointer active:scale-95 shadow-2xs"
            title="Download table data in CSV / Excel format"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Upload CSV Presensi */}
          <button
            id="openUploadCsvAttendanceBtn"
            type="button"
            onClick={() => {
              playClickTick();
              setIsImportModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#4338CA] shadow-2xs transition cursor-pointer active:scale-95"
            title="Upload attendance records CSV file"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload CSV</span>
          </button>
        </div>

      </div>

      {/* RBAC Read-Only Notice Banner */}
      {!canInputAttendance && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">Attendance Review Mode (Read-Only RBAC):</span>
              <span className="text-amber-800 ml-1">
                Your account as <strong>{roleMeta.label}</strong> is restricted to viewing attendance. Recording and modifying attendance is managed by <strong>President</strong>, <strong>Faculty Advisor</strong>, or <strong>Executive Board</strong>.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300 uppercase tracking-wide shrink-0">
            Limited Access
          </span>
        </div>
      )}

      {/* Smart Automated Attendance Window Banner (Wed 00:00 - Thu 23:59 WIB) */}
      <div className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs shadow-2xs transition-all ${
        attendanceSchedule.isOpen
          ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
          : 'bg-white border-[#C7D2FE] text-slate-800'
      }`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            attendanceSchedule.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-50 border border-blue-200 text-[#4338CA]'
          }`}>
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-slate-900">Smart Attendance Window:</span>
              <span className="font-mono font-bold text-blue-900">Wed 00:00 to Thu 23:59 WIB</span>
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold border ${attendanceSchedule.statusBadge.bgColor}`}>
                {attendanceSchedule.statusBadge.label}
              </span>
              {attendanceSchedule.remainingTimeText && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200">
                  ⏳ {attendanceSchedule.remainingTimeText}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              {attendanceSchedule.reasonText} Submissions outside this timeframe are automatically blocked.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button
            type="button"
            onClick={() => {
              playClickTick();
              const next = !bypassSchedule;
              setBypassSchedule(next);
              setBypassScheduleEnabled(next);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 shadow-2xs ${
              bypassSchedule
                ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-300'
            }`}
            title="Allow students to mark self-attendance outside regular schedule for testing"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>{bypassSchedule ? 'Testing Bypass: Active' : 'Bypass Schedule'}</span>
          </button>
        </div>
      </div>

      {viewSubTab === 'daily' ? (
        <>
          {/* Daily Date Navigator Bar */}
          <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-[#C7D2FE] shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center bg-[#EEF2FF] p-0.5 rounded-xl border border-[#C7D2FE]">
                <button
                  type="button"
                  onClick={() => handleDateOffset(-1)}
                  className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition cursor-pointer"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>

                <div className="px-3 py-1 bg-white rounded-lg shadow-2xs font-bold text-xs text-[#141414] flex items-center gap-1.5 border border-[#C7D2FE]/50">
                  <Calendar className="w-3.5 h-3.5 text-[#4338CA]" />
                  <span>{formatIndonesianDate(selectedDate)}</span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDateOffset(1)}
                  className="p-1.5 hover:bg-white text-slate-700 rounded-lg transition cursor-pointer"
                  title="Next Day"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-2.5 py-1.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#312E81] focus:outline-none focus:border-[#4338CA] focus:ring-1 focus:ring-[#4338CA]/20 cursor-pointer"
              />

              {selectedDate !== todayStr && (
                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] rounded-xl text-xs font-bold hover:bg-[#C7D2FE]/40 transition cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Today</span>
                </button>
              )}
            </div>

            {/* Bulk Action Buttons: 1 Primary Action (Mark All Present) & Secondary Outline */}
            <div className="flex items-center gap-2 flex-wrap">
              {canInputAttendance && (
                <button
                  type="button"
                  onClick={handleMarkAllHadir}
                  disabled={isSubmitting || members.length === 0}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4338CA] hover:bg-[#312E81] text-white rounded-xl text-xs font-bold transition shadow-sm shadow-[#4338CA]/25 active:scale-95 cursor-pointer disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Mark All Present ({members.length})</span>
                </button>
              )}

              {canResetAttendance && onResetDateAttendance && (
                <button
                  id="resetAttendanceBtn"
                  type="button"
                  onClick={handleOpenResetModal}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-300 rounded-xl text-xs font-semibold transition shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Reset attendance status and clear records for this date from database"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                  <span>Reset Attendance</span>
                </button>
              )}
            </div>

          </div>

          {/* Daily Attendance Summary Cards - Interactive Click-to-Filter */}
          <div className="space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {[
                { label: 'Present', val: stats.hadir, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', activeRing: 'ring-2 ring-emerald-500 shadow-sm scale-[1.02]', icon: CheckCircle2 },
                { label: 'Permitted', val: stats.izin, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', activeRing: 'ring-2 ring-amber-500 shadow-sm scale-[1.02]', icon: AlertCircle },
                { label: 'Sick', val: stats.sakit, color: 'text-[#4338CA]', bg: 'bg-[#EEF2FF]', border: 'border-[#C7D2FE]', activeRing: 'ring-2 ring-[#4338CA] shadow-sm scale-[1.02]', icon: HelpCircle },
                { label: 'Absent', val: stats.alpha, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', activeRing: 'ring-2 ring-rose-500 shadow-sm scale-[1.02]', icon: XCircle },
                { label: 'Unrecorded', val: stats.belumAbsen, color: 'text-[#2B2B2B]', bg: 'bg-slate-100', border: 'border-slate-200', activeRing: 'ring-2 ring-slate-700 shadow-sm scale-[1.02]', icon: Users },
                { label: 'Attendance Rate', val: `${stats.persentaseHadir}%`, color: 'text-[#4338CA]', bg: 'bg-[#EEF2FF]', border: 'border-[#C7D2FE]', activeRing: 'ring-2 ring-[#4338CA] shadow-sm', icon: Sparkles },
              ].map((st) => {
                const IconComp = st.icon;
                const isSelected = filterStatus === st.label;
                return (
                  <button
                    key={st.label}
                    type="button"
                    onClick={() => handleToggleStatusFilter(st.label)}
                    className={`px-2.5 py-1.5 sm:py-2 rounded-xl bg-white border ${st.border} shadow-2xs transition-all flex items-center gap-2 cursor-pointer text-left ${
                      isSelected 
                        ? `${st.activeRing} bg-slate-50 font-bold` 
                        : 'hover:border-[#4338CA]/50 hover:shadow-xs hover:scale-[1.01]'
                    }`}
                    title={st.label === 'Attendance Rate' ? 'Click to reset filter' : `Click to filter ${st.label} status`}
                  >
                    <div className={`w-7 h-7 rounded-lg ${st.bg} border border-black/5 flex items-center justify-center ${st.color} shrink-0`}>
                      <IconComp className="w-3.5 h-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold text-[#2B2B2B]/75 uppercase tracking-wider block truncate leading-tight">
                        {st.label}
                      </span>
                      <span className={`text-base font-black font-mono leading-none ${st.color} block mt-0.5`}>
                        {st.val}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Visual Attendance Progress Bar */}
            <div className="bg-white rounded-xl p-2.5 border border-[#C7D2FE] flex items-center gap-3 shadow-2xs">
              <span className="text-[11px] font-bold text-[#312E81] uppercase tracking-wider shrink-0 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#4338CA]" />
                <span className="hidden sm:inline">Attendance Rate:</span>
                <span>{stats.persentaseHadir}%</span>
              </span>
              <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-500 ${
                    stats.persentaseHadir >= 80 
                      ? 'bg-linear-to-r from-emerald-500 to-teal-500' 
                      : stats.persentaseHadir >= 50 
                      ? 'bg-linear-to-r from-amber-500 to-emerald-500' 
                      : 'bg-linear-to-r from-rose-500 to-amber-500'
                  }`}
                  style={{ width: `${stats.persentaseHadir}%` }}
                />
              </div>
              <span className="text-xs font-mono font-bold text-slate-600 shrink-0">
                {stats.hadir} / {stats.total} Students
              </span>
              {filterStatus !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    setFilterStatus('ALL');
                  }}
                  className="text-[10px] font-bold text-[#4338CA] bg-[#EEF2FF] px-2 py-0.5 rounded-md border border-[#C7D2FE] hover:bg-[#C7D2FE]/50 cursor-pointer ml-1"
                >
                  Reset ({filterStatus})
                </button>
              )}
            </div>
          </div>

          {/* Member Attendance List Table */}
          <div className="bg-white rounded-2xl border border-[#C7D2FE] shadow-xs overflow-hidden">
            
            {/* Filter Bar */}
            <div className="p-3.5 sm:p-4 border-b border-[#C7D2FE] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#EEF2FF]/80">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  placeholder="Search student name or class..."
                  className="w-full pl-9 pr-8 py-2 bg-white border border-[#C7D2FE] rounded-xl text-xs sm:text-sm text-[#141414] placeholder-slate-400 focus:outline-none focus:border-[#4338CA] focus:ring-1 focus:ring-[#4338CA]/20 transition"
                />
                {searchMember && (
                  <button
                    type="button"
                    onClick={() => setSearchMember('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="px-3 py-2 bg-white border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#312E81] focus:outline-none focus:border-[#4338CA] cursor-pointer"
                >
                  <option value="ALL">All Classes</option>
                  <option value="X">Grade X</option>
                  <option value="XI">Grade XI</option>
                  <option value="XII">Grade XII</option>
                </select>

                {onRefreshData && (
                  <button
                    type="button"
                    onClick={onRefreshData}
                    disabled={isSyncing}
                    title="Refresh attendance records"
                    className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-[#4338CA] px-2.5 py-2 rounded-xl bg-white border border-[#C7D2FE] hover:bg-[#EEF2FF] transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#4338CA]' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
              </div>
            </div>

            {/* Attendance Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#EEF2FF] border-b border-[#C7D2FE] text-[#312E81] font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Student Name &amp; NISN</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4 text-center">Attendance Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredMembers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400 font-medium text-xs">
                        No students match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredMembers.map((member, index) => {
                      const currentStatus = getMemberStatus(member);

                      return (
                        <tr key={member.nisn || index} className="hover:bg-[#EEF2FF]/50 transition duration-150">
                          <td className="py-2.5 px-4 text-center font-mono text-xs text-slate-400 font-bold">
                            {index + 1}
                          </td>

                          <td className="py-2.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] text-[#4338CA] font-bold text-xs flex items-center justify-center shrink-0">
                                {member.fullName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-[#141414] leading-tight">{member.fullName}</div>
                                <div className="text-[11px] font-mono text-slate-400 mt-0.5">NISN: {member.nisn || '-'}</div>
                              </div>
                            </div>
                          </td>

                          <td className="py-2.5 px-4">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] text-[#312E81] font-bold text-xs font-mono shadow-2xs">
                              {formatFullClass(member.grade, member.classRoom)}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-center">
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <div className="relative inline-block">
                                <select
                                  disabled={!canInputAttendance}
                                  value={currentStatus || ''}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    if (!val) {
                                      if (currentStatus && onResetMemberAttendance) {
                                        onResetMemberAttendance(selectedDate, member);
                                      }
                                    } else {
                                      handleStatusChange(member, val as AttendanceStatus);
                                    }
                                  }}
                                  className={`appearance-none pl-3.5 pr-8 py-1.5 rounded-xl text-xs font-bold border transition-all duration-150 shadow-2xs focus:outline-none focus:ring-2 select-none ${
                                    !canInputAttendance ? 'opacity-80 cursor-not-allowed bg-slate-100 text-slate-600 border-slate-300' : 'cursor-pointer'
                                  } ${
                                    currentStatus === 'Hadir'
                                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 focus:ring-emerald-400'
                                      : currentStatus === 'Izin'
                                      ? 'bg-amber-50 text-amber-800 border-amber-300 focus:ring-amber-400'
                                      : currentStatus === 'Sakit'
                                      ? 'bg-[#EEF2FF] text-[#312E81] border-[#C7D2FE] focus:ring-[#4338CA]'
                                      : currentStatus === 'Alpha'
                                      ? 'bg-rose-50 text-rose-800 border-rose-300 focus:ring-rose-400'
                                      : 'bg-white text-slate-500 border-slate-300 hover:border-slate-400 focus:ring-slate-300'
                                  }`}
                                  title={canInputAttendance ? `Attendance status for ${member.fullName}` : `View-Only Access (Read-Only) - Executive Access`}
                                >
                                  <option value="" className="text-slate-500 bg-white">-- Unrecorded --</option>
                                  <option value="Hadir" className="text-emerald-700 font-bold bg-white">Present</option>
                                  <option value="Izin" className="text-amber-700 font-bold bg-white">Permitted</option>
                                  <option value="Sakit" className="text-[#4338CA] font-bold bg-white">Sick</option>
                                  <option value="Alpha" className="text-rose-700 font-bold bg-white">Absent</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2.5 text-slate-400">
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </div>
                              </div>

                              {currentStatus && onResetMemberAttendance && canInputAttendance && (
                                <button
                                  type="button"
                                  onClick={() => onResetMemberAttendance(selectedDate, member)}
                                  title={`Remove / cancel attendance for ${member.fullName}`}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer active:scale-90"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </>
      ) : (
        /* REKAP & RIWAYAT LENGKAP */
        <div className="bg-white rounded-2xl border border-[#C7D2FE] shadow-xs overflow-hidden space-y-4 p-4">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Search student name, NISN, or date..."
                className="w-full pl-9 pr-8 py-2 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl text-xs sm:text-sm text-[#141414] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#4338CA] transition"
              />
              {historySearch && (
                <button
                  type="button"
                  onClick={() => setHistorySearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={historyStatusFilter}
                onChange={(e) => setHistoryStatusFilter(e.target.value)}
                className="px-3 py-2 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#312E81] focus:outline-none focus:border-[#4338CA] cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="Hadir">Present</option>
                <option value="Izin">Permitted</option>
                <option value="Sakit">Sick</option>
                <option value="Alpha">Absent</option>
              </select>

              {onRefreshData && (
                <button
                  type="button"
                  onClick={onRefreshData}
                  disabled={isSyncing}
                  title="Refresh attendance records from database"
                  className="flex items-center gap-1.5 px-3 py-2 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE] rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              )}

              {/* Upload CSV in History Toolbar */}
              <button
                type="button"
                id="openUploadCsvAttendanceHistoryBtn"
                onClick={() => {
                  playClickTick();
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-[#EEF2FF] hover:bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE] rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs"
                title="Upload attendance records CSV file"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV</span>
              </button>

              {onResetAllAttendance && attendance.length > 0 && (
                <button
                  type="button"
                  id="btnResetAllAttendance"
                  onClick={() => {
                    playClickTick();
                    setResetAllHistoryConfirmOpen(true);
                  }}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Reset and clear all attendance records from database"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset History ({attendance.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* History Records Table */}
          <div className="overflow-hidden border border-[#C7D2FE] rounded-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#EEF2FF] border-b border-[#C7D2FE] text-[#312E81] font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4 w-12 text-center">No</th>
                    <th className="py-3 px-4">Attendance Date</th>
                    <th className="py-3 px-4">Student Name</th>
                    <th className="py-3 px-4">NISN</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400 font-medium text-xs">
                        No attendance history saved yet.
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((item, index) => (
                      <tr key={item.id || index} className="hover:bg-[#EEF2FF]/50 transition">
                        <td className="py-3 px-4 text-center font-mono text-xs text-slate-400">
                          {index + 1}
                        </td>
                        <td className="py-3 px-4 font-mono font-semibold text-[#312E81]">
                          {formatIndonesianDate(item.tanggal)}
                        </td>
                        <td className="py-3 px-4 font-bold text-[#141414]">
                          {item.namaAnggota}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">
                          {item.nisn || '-'}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <select
                            disabled={!canInputAttendance}
                            value={item.status}
                            onChange={(e) => {
                              onAddAttendance({
                                tanggal: item.tanggal,
                                nisn: item.nisn,
                                namaAnggota: item.namaAnggota,
                                status: e.target.value as AttendanceStatus,
                              });
                            }}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border focus:outline-none ${
                              !canInputAttendance ? 'opacity-80 cursor-not-allowed bg-slate-100' : 'cursor-pointer'
                            } ${
                              item.status === 'Hadir'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : item.status === 'Izin'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : item.status === 'Sakit'
                                ? 'bg-[#EEF2FF] text-[#4338CA] border-[#C7D2FE]'
                                : 'bg-rose-50 text-rose-700 border-rose-200'
                            }`}
                          >
                            <option value="Hadir">Present</option>
                            <option value="Izin">Permitted</option>
                            <option value="Sakit">Sick</option>
                            <option value="Alpha">Absent</option>
                          </select>
                        </td>
                        <td className="py-3 px-4 text-right">
                          {canResetAttendance ? (
                            <button
                              type="button"
                              id={`deleteAttendanceRowBtn_${item.id || index}`}
                              onClick={() => {
                                playClickTick();
                                setAttendanceToDelete(item);
                              }}
                              className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 font-bold px-2.5 py-1 rounded-lg hover:bg-rose-50 border border-rose-200/80 transition cursor-pointer active:scale-95 shadow-2xs"
                              title="Delete this attendance record permanently from database"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-mono italic">Read-Only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* In-App Confirmation Modal for Reset Date Attendance */}
      <AnimatePresence>
        {resetConfirmOpen && (
          <div 
            id="resetAttendanceModalOverlay"
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => !isSubmitting && setResetConfirmOpen(false)}
          >
            <motion.div
              id="resetAttendanceModalContent"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative overflow-hidden"
            >
              {/* Top Danger Accent */}
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                <Trash2 className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Reset Attendance for This Date?
              </h3>
              
              <div className="inline-block px-3 py-1 bg-slate-100 rounded-lg text-xs font-bold text-slate-700 mb-3 border border-slate-200">
                📅 {formatIndonesianDate(selectedDate)}
              </div>

              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-left mb-4 text-xs space-y-2">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Current status:</span>
                  <span className="font-bold text-slate-800">
                    {stats.hadir + stats.izin + stats.sakit + stats.alpha} recorded / {members.length} students
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5 pt-1 text-center font-bold">
                  <div className="bg-emerald-50 text-emerald-700 py-1 rounded-lg border border-emerald-200">
                    {stats.hadir} Present
                  </div>
                  <div className="bg-amber-50 text-amber-700 py-1 rounded-lg border border-amber-200">
                    {stats.izin} Permitted
                  </div>
                  <div className="bg-[#EEF2FF] text-[#4338CA] py-1 rounded-lg border border-[#C7D2FE]">
                    {stats.sakit} Sick
                  </div>
                  <div className="bg-rose-50 text-rose-700 py-1 rounded-lg border border-rose-200">
                    {stats.alpha} Absent
                  </div>
                </div>
                <p className="text-[11px] text-slate-500 pt-1 leading-relaxed">
                  All students on this date will be reset to <strong>'Unrecorded'</strong> status and corresponding records will be <strong>permanently deleted</strong>.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="cancelResetAttendanceBtn"
                  onClick={() => setResetConfirmOpen(false)}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirmResetAttendanceBtn"
                  onClick={handleConfirmReset}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Yes, Reset Now</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* In-App Confirmation Modal for Deleting Single Attendance Record */}
      <AnimatePresence>
        {attendanceToDelete && (
          <div 
            id="deleteAttendanceRecordModalOverlay"
            className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
            onClick={() => !isSubmitting && setAttendanceToDelete(null)}
          >
            <motion.div
              id="deleteAttendanceRecordModalContent"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-center relative overflow-hidden"
            >
              {/* Danger Accent Icon */}
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                <Trash2 className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Delete Attendance Record?
              </h3>

              <div className="my-3.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200 text-left space-y-1.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Student Name:</span>
                  <span className="font-bold text-slate-800">{attendanceToDelete.namaAnggota}</span>
                </div>
                {attendanceToDelete.nisn && (
                  <div className="flex justify-between items-center">
                    <span className="text-slate-500">NISN:</span>
                    <span className="font-mono text-slate-600">{attendanceToDelete.nisn}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Date:</span>
                  <span className="font-semibold text-[#312E81]">{formatIndonesianDate(attendanceToDelete.tanggal)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Attendance Status:</span>
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    attendanceToDelete.status === 'Hadir'
                      ? 'bg-emerald-100 text-emerald-800'
                      : attendanceToDelete.status === 'Izin'
                      ? 'bg-amber-100 text-amber-800'
                      : attendanceToDelete.status === 'Sakit'
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-rose-100 text-rose-800'
                  }`}>
                    {attendanceToDelete.status === 'Hadir' ? 'Present' : attendanceToDelete.status === 'Izin' ? 'Permitted' : attendanceToDelete.status === 'Sakit' ? 'Sick' : 'Absent'}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                This attendance record will be permanently deleted from local storage and the database.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="cancelDeleteRecordAttendanceBtn"
                  onClick={() => setAttendanceToDelete(null)}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirmDeleteRecordAttendanceBtn"
                  onClick={async () => {
                    const toDelete = attendanceToDelete;
                    setAttendanceToDelete(null);
                    await onDeleteAttendance(toDelete.id, undefined, toDelete);
                  }}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Deleting...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Yes, Delete Now</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* In-App Confirmation Modal for Resetting All Attendance History (Protected with Typing Verification) */}
      <AnimatePresence>
        {resetAllHistoryConfirmOpen && (
          <div 
            id="resetAllAttendanceModalOverlay"
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => {
              if (!isSubmitting) {
                setResetAllHistoryConfirmOpen(false);
                setResetAllConfirmationInput('');
              }
            }}
          >
            <motion.div
              id="resetAllAttendanceModalContent"
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-center relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                <RotateCcw className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Reset Seluruh Riwayat Presensi?
              </h3>
              
              <div className="inline-block px-3 py-1 bg-rose-50 text-rose-800 rounded-lg text-xs font-bold mb-3 border border-rose-200">
                ⚠️ Akan menghapus {attendance.length} catatan kehadiran
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left">
                Tindakan ini akan <strong>menghapus seluruh riwayat presensi</strong> secara permanen dari basis data Supabase dan penyimpanan lokal. Data siswa tetap tersimpan.
              </p>

              {/* Security Verification Input */}
              <div className="mb-5 text-left">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ketik kata <span className="text-rose-600 font-mono font-black">RESET</span> untuk mengonfirmasi:
                </label>
                <input
                  type="text"
                  value={resetAllConfirmationInput}
                  onChange={(e) => setResetAllConfirmationInput(e.target.value)}
                  placeholder="Ketik RESET di sini..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs font-mono font-bold uppercase transition outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="cancelResetAllAttendanceBtn"
                  onClick={() => {
                    setResetAllHistoryConfirmOpen(false);
                    setResetAllConfirmationInput('');
                  }}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="confirmResetAllAttendanceBtn"
                  onClick={async () => {
                    if (resetAllConfirmationInput.trim().toUpperCase() !== 'RESET') return;
                    setResetAllHistoryConfirmOpen(false);
                    setResetAllConfirmationInput('');
                    if (onResetAllAttendance) {
                      await onResetAllAttendance();
                    }
                  }}
                  disabled={isSubmitting || resetAllConfirmationInput.trim().toUpperCase() !== 'RESET'}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mereset...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Reset Sekarang</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV / Excel Universal Import Modal for Attendance */}
      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultTarget="attendance"
        existingMembers={members}
        existingAttendance={attendance}
        isDemo={isDemo}
        onAttendanceSuccess={(count, updated) => {
          if (onAttendanceUpdated) {
            onAttendanceUpdated(updated);
          }
          if (onRefreshData) {
            onRefreshData();
          }
        }}
      />

    </motion.div>
  );
};
