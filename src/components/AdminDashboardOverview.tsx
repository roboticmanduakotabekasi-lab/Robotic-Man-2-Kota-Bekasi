import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  CalendarCheck, 
  Wallet, 
  BookOpen, 
  Megaphone, 
  Database, 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Plus, 
  UploadCloud, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  KeyRound, 
  Layers, 
  Calendar,
  Lock,
  ExternalLink,
  ChevronRight,
  Shield,
  FileSpreadsheet,
  Activity,
  Award,
  BarChart3
} from 'lucide-react';
import { 
  Member, 
  AttendanceRecord, 
  CashTransaction, 
  Announcement, 
  UserSession, 
  MainTabType 
} from '../types';
import { formatRupiah } from '../utils/formatters';
import { formatCompactDate } from '../utils/dateAcademicConfig';
import { playClickTick, playSuccessChime } from '../utils/audioFeedback';
import { AdminRegisteredUsersSection } from './AdminRegisteredUsersSection';
import { hasSessionPermission } from '../utils/rbac';

interface AdminDashboardOverviewProps {
  session: UserSession;
  members: Member[];
  attendance: AttendanceRecord[];
  cash: CashTransaction[];
  announcements: Announcement[];
  isSupabaseConnected: boolean;
  onNavigateToTab: (tab: MainTabType) => void;
  onOpenAddMemberModal: () => void;
  onOpenUniversalUploadModal?: () => void;
  onOpenPreRegistrationModal: () => void;
  onOpenAnnouncementsModal: () => void;
  onOpenAssignmentsModal: () => void;
  onOpenSupabaseModal: () => void;
  onSyncAllData: () => Promise<void>;
  isSyncing: boolean;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminDashboardOverview: React.FC<AdminDashboardOverviewProps> = ({
  session,
  members,
  attendance,
  cash,
  announcements,
  isSupabaseConnected,
  onNavigateToTab,
  onOpenAddMemberModal,
  onOpenUniversalUploadModal,
  onOpenPreRegistrationModal,
  onOpenAnnouncementsModal,
  onOpenAssignmentsModal,
  onOpenSupabaseModal,
  onSyncAllData,
  isSyncing,
  onShowToast,
}) => {
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  // Time of day greeting (Bahasa Indonesia)
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat pagi';
    if (hour < 15) return 'Selamat siang';
    if (hour < 18) return 'Selamat sore';
    return 'Selamat malam';
  }, []);

  // 1. Metric: Members Breakdown
  const memberStats = useMemo(() => {
    const total = members.length;
    const active = members.filter(m => !m.status || m.status === 'Active' || m.status === 'Aktif').length;
    const executives = members.filter(m => {
      const j = (m.jabatan || '').toLowerCase();
      const s = (m.status || '').toLowerCase();
      return ['president', 'vice_president', 'secretary', 'treasurer', 'pr'].includes(j) || s.includes('executive');
    }).length;
    const classX = members.filter(m => m.grade === 'X').length;
    const classXI = members.filter(m => m.grade === 'XI').length;
    const classXII = members.filter(m => m.grade === 'XII').length;
    const activeRatio = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, executives, classX, classXI, classXII, activeRatio };
  }, [members]);

  // 2. Metric: Attendance Summary
  const attendanceStats = useMemo(() => {
    const totalRecords = attendance.length;
    // Extract unique dates sorted descending
    const dates = Array.from(new Set(attendance.map(a => a.tanggal))).sort().reverse();
    const latestDate = dates[0] || new Date().toISOString().split('T')[0];
    const latestRecords = attendance.filter(a => a.tanggal === latestDate);

    const hadirCount = latestRecords.filter(a => a.status === 'Present' || a.status === 'Hadir').length;
    const izinCount = latestRecords.filter(a => a.status === 'Excused' || a.status === 'Izin').length;
    const sakitCount = latestRecords.filter(a => a.status === 'Sick' || a.status === 'Sakit').length;
    const alphaCount = latestRecords.filter(a => a.status === 'Unexcused' || a.status === 'Alpha').length;

    const rate = latestRecords.length > 0 ? Math.round((hadirCount / latestRecords.length) * 100) : 0;

    return { totalRecords, latestDate, latestCount: latestRecords.length, hadirCount, izinCount, sakitCount, alphaCount, rate };
  }, [attendance]);

  // 3. Metric: Cash / Treasury Balance
  const cashStats = useMemo(() => {
    let totalInflow = 0;
    let totalOutflow = 0;
    cash.forEach(t => {
      const val = Number(t.jumlah) || 0;
      if (t.jenis === 'Inflow' || t.jenis === 'Masuk') {
        totalInflow += val;
      } else if (t.jenis === 'Outflow' || t.jenis === 'Keluar') {
        totalOutflow += val;
      }
    });
    const balance = totalInflow - totalOutflow;
    return { totalInflow, totalOutflow, balance, count: cash.length };
  }, [cash]);

  // 4. Recent activities
  const recentAttendance = useMemo(() => {
    return attendance.slice(-6).reverse();
  }, [attendance]);

  const recentTransactions = useMemo(() => {
    return cash.slice(-6).reverse();
  }, [cash]);

  const handleManualSyncClick = async () => {
    playClickTick();
    if (session.isDemo) {
      onShowToast('[Demo Sandbox] Cloud synchronization is disabled in Sandbox mode to keep production databases strictly isolated.', 'info');
      return;
    }
    setIsManualSyncing(true);
    try {
      await onSyncAllData();
      playSuccessChime();
      onShowToast('Supabase cloud synchronization completed successfully!', 'success');
    } catch {
      onShowToast('Failed to synchronize with Supabase cloud database.', 'error');
    } finally {
      setIsManualSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. Dynamic Modern Header Banner with Subtle Gradient Mesh & Realtime State*/}
      {/* ========================================================================= */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-4 sm:p-6 lg:p-7 border border-slate-700/60 shadow-xl"
      >
        {/* Subtle ambient lighting orbs */}
        <div className="absolute -top-24 -right-24 w-80 h-80 bg-blue-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-5">
          <div className="space-y-2 min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-white/10 text-blue-200 border border-white/15 backdrop-blur-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Robotic Club Workspace</span>
              </span>

              <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-indigo-500/20 text-indigo-200 border border-indigo-400/30">
                {session.role === 'admin' ? 'System Administrator' : (session.role || 'Executive Board')}
              </span>

              {session.isDemo ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-mono font-bold bg-amber-500/25 text-amber-200 border border-amber-400/40">
                  🧪 Demo Sandbox
                </span>
              ) : isSupabaseConnected ? (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-emerald-500/20 text-emerald-200 border border-emerald-400/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>Cloud Connected</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 rounded-full text-[10px] sm:text-[11px] font-medium bg-slate-700/50 text-slate-300 border border-slate-600">
                  Local Storage Mode
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2 flex-wrap break-words">
              <span>{greeting}, {session.name}</span>
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Real-time management portal for MAN 2 Kota Bekasi Robotics. Track active roster enrollment, laboratory session attendance, and financial treasury health.
            </p>
          </div>

          {/* Quick Actions in Header */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap shrink-0 w-full md:w-auto">
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={handleManualSyncClick}
              disabled={isManualSyncing || isSyncing}
              className="flex-1 md:flex-none justify-center py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs border border-white/20 backdrop-blur-xs transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 shadow-sm whitespace-nowrap"
              title="Synchronize records with Supabase Cloud"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-blue-300 ${isManualSyncing || isSyncing ? 'animate-spin' : ''}`} />
              <span>{isManualSyncing || isSyncing ? 'Syncing...' : 'Sync Cloud'}</span>
            </motion.button>

            {/* Configure Database (Strictly for Head Admin / President) */}
            {(session.role === 'admin' || session.jabatan === 'president' || hasSessionPermission(session, 'system:configure')) && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={onOpenSupabaseModal}
                className="flex-1 md:flex-none justify-center py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all flex items-center gap-2 shadow-md shadow-blue-600/30 cursor-pointer whitespace-nowrap"
                title="Only Head Admin can configure database credentials"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Configure Database</span>
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ========================================================================= */}
      {/* 2. Interactive High-Density Key Metrics Cards                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        
        {/* Metric 1: Member Data */}
        <motion.div 
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            playClickTick();
            onNavigateToTab('members');
          }}
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-indigo-300 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Club Members</span>
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center transition-transform group-hover:scale-110 shrink-0">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums truncate min-w-0">
              {memberStats.total}
            </div>
            <span className="text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 shrink-0">
              <span>Roster</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-semibold truncate min-w-0" title={`${memberStats.active} Active Students`}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
              <span className="truncate">{memberStats.active} Active</span>
            </span>
            <span className="font-medium text-slate-600 truncate min-w-0 text-right" title={`${memberStats.executives} Officers`}>
              {memberStats.executives} Officers
            </span>
          </div>

          {/* Mini engagement progress bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${memberStats.activeRatio}%` }}
            />
          </div>
        </motion.div>

        {/* Metric 2: Attendance Rate */}
        <motion.div 
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            playClickTick();
            onNavigateToTab('attendance');
          }}
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Attendance Rate</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center transition-transform group-hover:scale-110 shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums truncate min-w-0">
              {attendanceStats.rate}%
            </div>
            <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 shrink-0">
              <span>Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          {/* Compact 3-Column Stats Subgrid - Completely bulletproof on all mobile viewports */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 grid grid-cols-3 gap-1 text-center min-w-0 text-[10px] sm:text-[11px]">
            <div className="bg-emerald-50/80 text-emerald-700 font-bold py-0.5 px-1 rounded-md border border-emerald-100 truncate" title={`${attendanceStats.hadirCount} Present`}>
              <span>{attendanceStats.hadirCount}</span> <span className="font-normal text-emerald-600 hidden xs:inline sm:inline">Hadir</span>
            </div>
            <div className="bg-amber-50/80 text-amber-700 font-bold py-0.5 px-1 rounded-md border border-amber-100 truncate" title={`${attendanceStats.izinCount + attendanceStats.sakitCount} Excused`}>
              <span>{attendanceStats.izinCount + attendanceStats.sakitCount}</span> <span className="font-normal text-amber-600 hidden xs:inline sm:inline">Izin</span>
            </div>
            <div className="bg-rose-50/80 text-rose-700 font-bold py-0.5 px-1 rounded-md border border-rose-100 truncate" title={`${attendanceStats.alphaCount} Absent`}>
              <span>{attendanceStats.alphaCount}</span> <span className="font-normal text-rose-600 hidden xs:inline sm:inline">Alpha</span>
            </div>
          </div>

          {/* Mini attendance gauge bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                attendanceStats.rate >= 80 ? 'bg-emerald-500' : attendanceStats.rate >= 60 ? 'bg-blue-500' : 'bg-amber-500'
              }`} 
              style={{ width: `${attendanceStats.rate}%` }}
            />
          </div>
        </motion.div>

        {/* Metric 3: Treasury Balance */}
        <motion.div 
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            playClickTick();
            onNavigateToTab('cash');
          }}
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-amber-300 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Treasury Balance</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center transition-transform group-hover:scale-110 shrink-0">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <div 
              className={`text-xl sm:text-2xl font-extrabold tracking-tight font-mono tabular-nums truncate min-w-0 ${
                cashStats.balance >= 0 ? 'text-slate-900' : 'text-rose-600'
              }`}
              title={formatRupiah(cashStats.balance)}
            >
              {formatRupiah(cashStats.balance)}
            </div>
            <span className="text-xs font-bold text-amber-600 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 shrink-0">
              <span>Ledger</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500 min-w-0">
            <div className="flex items-center gap-1 text-emerald-600 font-semibold min-w-0 truncate" title={`+${formatRupiah(cashStats.totalInflow)} in`}>
              <TrendingUp className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              <span className="truncate min-w-0 font-mono font-bold">+{formatRupiah(cashStats.totalInflow)}</span>
            </div>
            <div className="flex items-center gap-1 text-rose-600 font-medium min-w-0 truncate text-right justify-end" title={`-${formatRupiah(cashStats.totalOutflow)} out`}>
              <TrendingDown className="w-3.5 h-3.5 shrink-0 text-rose-500" />
              <span className="truncate min-w-0 font-mono font-bold">-{formatRupiah(cashStats.totalOutflow)}</span>
            </div>
          </div>

          {/* Mini treasury health bar */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="bg-amber-500 h-full rounded-full transition-all duration-500" 
              style={{ width: `${cashStats.totalInflow > 0 ? Math.min(100, Math.round((cashStats.balance / cashStats.totalInflow) * 100)) : 100}%` }}
            />
          </div>
        </motion.div>

        {/* Metric 4: Tasks & Challenges */}
        <motion.div 
          whileHover={{ y: -3, transition: { duration: 0.2 } }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            playClickTick();
            onNavigateToTab('assignments');
          }}
          className="group bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs hover:shadow-md hover:border-purple-300 transition-all cursor-pointer relative overflow-hidden"
        >
          <div className="flex items-center justify-between mb-3 gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">Curriculum Tasks</span>
            <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center transition-transform group-hover:scale-110 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 min-w-0">
            <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono tabular-nums truncate min-w-0">
              {announcements.length}
            </div>
            <span className="text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform flex items-center gap-0.5 shrink-0">
              <span>Grading</span>
              <ChevronRight className="w-3 h-3" />
            </span>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500 min-w-0">
            <span className="inline-flex items-center gap-1.5 text-purple-700 font-semibold truncate min-w-0">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
              <span className="truncate">Tasks Active</span>
            </span>
            <span className="text-slate-500 font-medium truncate min-w-0 text-right">
              Curriculum Ready
            </span>
          </div>

          {/* Real curriculum activity ratio */}
          <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2.5 overflow-hidden">
            <div 
              className="bg-purple-600 h-full rounded-full transition-all duration-500" 
              style={{ width: `${announcements.length > 0 ? Math.min(100, Math.max(20, announcements.length * 20)) : 0}%` }} 
            />
          </div>
        </motion.div>

      </div>

      {/* ========================================================================= */}
      {/* 3. High-Usability Quick Actions Hub                                       */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <span>Administrative Quick Actions</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Direct shortcuts to everyday extracurricular management operations
            </p>
          </div>
          <span className="text-[11px] font-mono text-slate-400 font-medium hidden sm:inline">
            6 Direct Shortcuts
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              playClickTick();
              onOpenAddMemberModal();
            }}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-indigo-50/50 hover:border-indigo-300 transition-all flex flex-col items-start gap-2 cursor-pointer text-left group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block group-hover:text-indigo-600 transition-colors">
                Add Member
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                New student roster
              </span>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              playClickTick();
              if (onOpenUniversalUploadModal) {
                onOpenUniversalUploadModal();
              } else {
                onOpenPreRegistrationModal();
              }
            }}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-emerald-50/50 hover:border-emerald-300 transition-all flex flex-col items-start gap-2 cursor-pointer text-left group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UploadCloud className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block group-hover:text-emerald-600 transition-colors">
                Import CSV
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Batch roster &amp; data
              </span>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              playClickTick();
              onNavigateToTab('attendance');
            }}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-blue-50/50 hover:border-blue-300 transition-all flex flex-col items-start gap-2 cursor-pointer text-left group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block group-hover:text-blue-600 transition-colors">
                Take Attendance
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Session check-ins
              </span>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              playClickTick();
              onNavigateToTab('cash');
            }}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-amber-50/50 hover:border-amber-300 transition-all flex flex-col items-start gap-2 cursor-pointer text-left group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Wallet className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block group-hover:text-amber-600 transition-colors">
                Record Treasury
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Dues &amp; expenses
              </span>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              playClickTick();
              onOpenAnnouncementsModal();
            }}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-purple-50/50 hover:border-purple-300 transition-all flex flex-col items-start gap-2 cursor-pointer text-left group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block group-hover:text-purple-600 transition-colors">
                Broadcast Notice
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Official broadcasts
              </span>
            </div>
          </motion.button>

          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={() => {
              playClickTick();
              const el = document.getElementById('admin-registered-users-section');
              if (el) {
                el.scrollIntoView({ behavior: 'smooth' });
              }
            }}
            className="p-3.5 rounded-xl border border-slate-200 bg-white hover:bg-sky-50/50 hover:border-sky-300 transition-all flex flex-col items-start gap-2 cursor-pointer text-left group shadow-2xs"
          >
            <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block group-hover:text-sky-600 transition-colors">
                Manage Roles
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                Officer promotions
              </span>
            </div>
          </motion.button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. Registered Users & Executive Board Promotion Interface                 */}
      {/* ========================================================================= */}
      <AdminRegisteredUsersSection
        currentUserSession={session}
        isSupabaseConnected={isSupabaseConnected}
        onShowToast={onShowToast}
      />

      {/* ========================================================================= */}
      {/* 5. Live Activity Feeds: Recent Attendance & Treasury Activity              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Activity 1: Recent Attendance */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <CalendarCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Laboratory Attendance</h3>
                <p className="text-[11px] text-slate-400">Latest workshop student check-ins</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('attendance')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentAttendance.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              <Clock className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No attendance records logged yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentAttendance.map((rec, idx) => (
                <div key={rec.id || `att-${idx}`} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-800 truncate">{rec.namaAnggota}</p>
                    <p className="text-[11px] text-slate-400 font-mono">NISN: {rec.nisn || '-'} • {rec.tanggal}</p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 flex items-center gap-1 ${
                    rec.status === 'Present' || rec.status === 'Hadir'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : rec.status === 'Sick' || rec.status === 'Sakit'
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : rec.status === 'Excused' || rec.status === 'Izin'
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      rec.status === 'Present' || rec.status === 'Hadir' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`} />
                    <span>{rec.status === 'Hadir' ? 'Present' : rec.status === 'Izin' ? 'Excused' : rec.status === 'Sakit' ? 'Sick' : rec.status}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Activity 2: Recent Treasury Activity */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Recent Treasury Activity</h3>
                <p className="text-[11px] text-slate-400">Club dues inflows &amp; component purchases</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigateToTab('cash')}
              className="text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <span>View Ledger</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs font-medium">
              <Wallet className="w-8 h-8 mx-auto mb-2 text-slate-300" />
              No treasury transactions recorded yet.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {recentTransactions.map((tx, idx) => {
                const isInflow = tx.jenis === 'Inflow' || tx.jenis === 'Masuk';
                return (
                  <div key={tx.id || `cash-${idx}`} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-800 truncate">{tx.keterangan || 'Club Member Dues'}</p>
                      <p className="text-[11px] text-slate-400 font-mono">
                        {tx.namaAnggota ? `${tx.namaAnggota} • ` : ''}{tx.tanggal}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-mono font-bold ${isInflow ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isInflow ? '+' : '-'}{formatRupiah(tx.jumlah)}
                      </p>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded ${isInflow ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {isInflow ? 'Income' : 'Expense'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 6. Database Health & Cloud Synchronization Footer Status                  */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900">PostgreSQL Cloud Database</span>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[11px] text-emerald-700 font-semibold">Active Sync</span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Tracking <span className="font-mono font-bold text-slate-600">{members.length} members</span>, <span className="font-mono font-bold text-slate-600">{attendance.length} attendance logs</span>, and <span className="font-mono font-bold text-slate-600">{cash.length} transactions</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleManualSyncClick}
            disabled={isManualSyncing || isSyncing}
            className="px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            {isManualSyncing || isSyncing ? 'Syncing...' : 'Sync Now'}
          </button>
          <button
            type="button"
            onClick={onOpenSupabaseModal}
            className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition cursor-pointer"
          >
            Database Settings
          </button>
        </div>
      </div>

    </div>
  );
};
