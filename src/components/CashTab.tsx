import React, { useState, useMemo, useEffect } from 'react';
import { 
  Wallet, 
  ArrowDownLeft, 
  ArrowUpRight, 
  Plus, 
  Search, 
  Download, 
  Trash2, 
  Printer,
  Calendar,
  Sparkles,
  Receipt,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  RotateCcw,
  Users,
  CheckCheck,
  CreditCard,
  UserCheck,
  UserX,
  Edit3,
  CalendarDays,
  FileText,
  Info,
  RefreshCw,
  Upload,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, CashTransaction, TransactionType, UserSession } from '../types';
import { formatRupiah, exportToCsv, formatIndonesianDate } from '../utils/formatters';
import { exportWeeklyCashPdf, exportCashLedgerPdf } from '../utils/pdfExport';
import { normalizeGrade, formatFullClass, isMaleMember } from './MembersTab';
import { triggerCelebration, playClickTick, playSuccessChime } from '../utils/audioFeedback';
import { ImportCsvModal } from './ImportCsvModal';
import { hasPermission, hasSessionPermission, getRoleMetadata } from '../utils/rbac';

interface CashTabProps {
  members: Member[];
  cash: CashTransaction[];
  activeMonthKey?: string;
  initialSearchTerm?: string;
  onAddCash: (transaction: Omit<CashTransaction, 'id'>) => Promise<void>;
  onBulkAddCash?: (transactions: Omit<CashTransaction, 'id'>[]) => Promise<void>;
  onCancelMemberCash?: (txId?: string, memberName?: string, txObject?: CashTransaction) => Promise<void> | void;
  onResetPeriodCash?: (periodMonthKey: string, periodLabel: string) => Promise<void> | void;
  onDeleteCash: (id?: string, index?: number, txObject?: CashTransaction) => Promise<void> | void;
  onDeleteMultipleCash?: (ids: string[], message?: string) => Promise<void> | void;
  onDeleteAllMembersCash?: () => Promise<void> | void;
  onResetAllCash?: () => Promise<void> | void;
  onOpenUploadModal?: () => void;
  isSubmitting: boolean;
  onRefreshData?: () => Promise<void> | void;
  isSyncing?: boolean;
  onCashUpdated?: (updated: CashTransaction[]) => void;
  isDemo?: boolean;
  currentUserRole?: string;
  currentUserTitle?: string;
  session?: UserSession | null;
}

// Available standard months for academic cycle 2026/2027
const ACADEMIC_MONTHS = [
  { key: '2026-07', label: 'July 2026' },
  { key: '2026-08', label: 'August 2026' },
  { key: '2026-09', label: 'September 2026' },
  { key: '2026-10', label: 'October 2026' },
  { key: '2026-11', label: 'November 2026' },
  { key: '2026-12', label: 'December 2026' },
  { key: '2027-01', label: 'January 2027' },
  { key: '2027-02', label: 'February 2027' },
  { key: '2027-03', label: 'March 2027' },
  { key: '2027-04', label: 'April 2027' },
  { key: '2027-05', label: 'May 2027' },
  { key: '2027-06', label: 'June 2027' },
];

export interface WeekCalendarInfo {
  weekNum: number;
  label: string;
  range: string;
  startDay: number;
  endDay: number;
  startDateStr: string;
  endDateStr: string;
  representativeDateStr: string;
  daysCount: number;
}

// Function to compute exact real calendar week intervals and dates for any given year-month
export function getWeeksForMonth(monthKey: string): WeekCalendarInfo[] {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  // Total days in this month
  const totalDaysInMonth = new Date(year, month, 0).getDate();

  const monthNamesEn = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  const monthShort = monthNamesEn[month - 1].slice(0, 3);

  const rawWeeks = [
    { weekNum: 1, startDay: 1, endDay: 7 },
    { weekNum: 2, startDay: 8, endDay: 14 },
    { weekNum: 3, startDay: 15, endDay: 21 },
    { weekNum: 4, startDay: 22, endDay: 28 },
    { weekNum: 5, startDay: 29, endDay: totalDaysInMonth },
  ];

  return rawWeeks
    .filter(w => w.startDay <= totalDaysInMonth)
    .map(w => {
      const endDay = Math.min(w.endDay, totalDaysInMonth);
      const daysCount = endDay - w.startDay + 1;
      const startDayPad = String(w.startDay).padStart(2, '0');
      const endDayPad = String(endDay).padStart(2, '0');
      
      const startDateStr = `${monthKey}-${startDayPad}`;
      const endDateStr = `${monthKey}-${endDayPad}`;
      
      // Representative date in the middle/active day of that week
      const midDay = Math.min(w.startDay + 3, endDay);
      const repDateStr = `${monthKey}-${String(midDay).padStart(2, '0')}`;

      const range = w.startDay === endDay 
        ? `${w.startDay} ${monthShort}`
        : `${w.startDay} - ${endDay} ${monthShort}`;

      return {
        weekNum: w.weekNum,
        label: `Week ${w.weekNum}`,
        range,
        startDay: w.startDay,
        endDay,
        startDateStr,
        endDateStr,
        representativeDateStr: repDateStr,
        daysCount,
      };
    });
}

// Find week number (1-5) for a given date YYYY-MM-DD
export function getWeekNumFromDate(dateStr: string): number {
  if (!dateStr) return 1;
  const parts = dateStr.split('-');
  const day = parseInt(parts[2] || '1', 10);
  if (day <= 7) return 1;
  if (day <= 14) return 2;
  if (day <= 21) return 3;
  if (day <= 28) return 4;
  return 5;
}

export const CashTab: React.FC<CashTabProps> = ({
  members,
  cash,
  activeMonthKey,
  initialSearchTerm,
  onAddCash,
  onBulkAddCash,
  onCancelMemberCash,
  onResetPeriodCash,
  onDeleteCash,
  onDeleteMultipleCash,
  onDeleteAllMembersCash,
  onResetAllCash,
  onOpenUploadModal,
  isSubmitting,
  onRefreshData,
  isSyncing = false,
  onCashUpdated,
  isDemo = false,
  currentUserRole,
  currentUserTitle,
  session,
}) => {
  // RBAC Permission checks: Strict separation of duties (Treasurer & Head Admin solely hold write access)
  const canCreateCash = session
    ? hasSessionPermission(session, 'cash:create')
    : hasPermission(currentUserRole, 'cash:create', currentUserTitle);
  const canDeleteCash = session
    ? hasSessionPermission(session, 'cash:delete')
    : hasPermission(currentUserRole, 'cash:delete', currentUserTitle);
  const canResetCash = session
    ? hasSessionPermission(session, 'cash:reset')
    : hasPermission(currentUserRole, 'cash:reset', currentUserTitle);
  
  // Leadership authority check: Total treasury wipeout requires Head Admin, President, or Pembina
  const canResetEntireCash = Boolean(
    currentUserRole === 'admin' ||
    session?.role === 'admin' ||
    session?.jabatan === 'president' ||
    session?.role === 'advisor' ||
    session?.jabatan === 'pembina' ||
    (canResetCash && (session?.jabatan === 'treasurer' || session?.role === 'Bendahara'))
  );

  const [resetAllCashModalOpen, setResetAllCashModalOpen] = useState(false);
  const [resetAllCashInput, setResetAllCashInput] = useState('');
  const roleMeta = getRoleMetadata(currentUserRole);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const todayStr = new Date().toISOString().split('T')[0];
  const currentMonthKey = todayStr.slice(0, 7); // e.g. "2026-08" or "2026-09"
  
  // Calculate current week of month from today's date
  const defaultWeekNum = getWeekNumFromDate(todayStr);

  // Primary Sub-Tab Switcher: 'checklist' (Daftar Iuran Kas Siswa Per Minggu) vs 'ledger' (Buku Kas & Pengeluaran)
  const [activeSubTab, setActiveSubTab] = useState<'checklist' | 'ledger'>('checklist');

  // Month & Week State for Weekly Kas View
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() => {
    if (activeMonthKey && ACADEMIC_MONTHS.some((p) => p.key === activeMonthKey)) {
      return activeMonthKey;
    }
    return ACADEMIC_MONTHS.some((p) => p.key === currentMonthKey) ? currentMonthKey : '2026-08';
  });
  const [selectedWeekNum, setSelectedWeekNum] = useState<number>(defaultWeekNum);

  // Dynamic real calendar weeks for the currently selected month
  const monthWeeks = useMemo(() => {
    return getWeeksForMonth(selectedMonthKey);
  }, [selectedMonthKey]);

  // Ensure selectedWeekNum is valid for the current month
  const activeWeekInfo = useMemo(() => {
    const found = monthWeeks.find((w) => w.weekNum === selectedWeekNum);
    return found || monthWeeks[0] || {
      weekNum: 1,
      label: 'Minggu 1',
      range: 'Tgl 1 - 7',
      startDay: 1,
      endDay: 7,
      startDateStr: `${selectedMonthKey}-01`,
      endDateStr: `${selectedMonthKey}-07`,
      representativeDateStr: `${selectedMonthKey}-05`,
      daysCount: 7,
    };
  }, [monthWeeks, selectedWeekNum, selectedMonthKey]);

  // Standard fee nominal (Default Rp 5.000 / minggu)
  const [standardNominal, setStandardNominal] = useState<number>(5000);

  // Checklist Search & Filters
  const [searchMember, setSearchMember] = useState(initialSearchTerm || '');
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<'ALL' | 'PAID' | 'UNPAID'>('ALL');
  const [filterGrade, setFilterGrade] = useState<string>('ALL');

  // Ledger Search & Filters
  const [ledgerSearch, setLedgerSearch] = useState(initialSearchTerm || '');
  const [ledgerFilterType, setLedgerFilterType] = useState<string>('ALL');

  // Sync external search term if provided
  useEffect(() => {
    if (initialSearchTerm !== undefined) {
      setSearchMember(initialSearchTerm);
      setLedgerSearch(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // Modal / Form States
  const [isGeneralFormOpen, setIsGeneralFormOpen] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{
    isOpen: boolean;
    member: Member | null;
    currentTx?: CashTransaction;
    targetWeekNum: number;
  }>({
    isOpen: false,
    member: null,
    targetWeekNum: defaultWeekNum,
  });

  // Member Cash History & Correction Modal State (per-person)
  const [memberHistoryModal, setMemberHistoryModal] = useState<{
    isOpen: boolean;
    member: Member | null;
  }>({
    isOpen: false,
    member: null,
  });

  // Custom Confirmation Dialog State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    confirmStyle?: 'danger' | 'primary' | 'warning';
    onConfirm: () => Promise<void> | void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Yes, Delete',
    confirmStyle: 'danger',
    onConfirm: () => {},
  });

  // Custom Alert / Notice Modal State
  const [noticeModal, setNoticeModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  // Modal Input States
  const [modalNominal, setModalNominal] = useState<string>('5000');
  const [modalDate, setModalDate] = useState<string>(todayStr);
  const [modalNote, setModalNote] = useState<string>('');

  // General Transaction Form State
  const [genTanggal, setGenTanggal] = useState<string>(todayStr);
  const [genJenis, setGenJenis] = useState<TransactionType>('Masuk');
  const [genSelectedNisn, setGenSelectedNisn] = useState<string>('');
  const [genCustomName, setGenCustomName] = useState<string>('');
  const [genJumlah, setGenJumlah] = useState<string>('');
  const [genKeterangan, setGenKeterangan] = useState<string>('');

  // Current active month object
  const activeMonthObj = useMemo(() => {
    const found = ACADEMIC_MONTHS.find((p) => p.key === selectedMonthKey);
    if (found) return found;
    return { key: selectedMonthKey, label: `Bulan ${selectedMonthKey}` };
  }, [selectedMonthKey]);

  // Active Week Object & Period Label (e.g. "Agustus 2026 - Minggu 1")
  const activePeriodLabel = useMemo(() => {
    return `${activeMonthObj.label} (Minggu ${selectedWeekNum})`;
  }, [activeMonthObj, selectedWeekNum]);

  // Overall Financial KPI Metrics (Ledger total)
  const generalSummary = useMemo(() => {
    let totalMasuk = 0;
    let totalKeluar = 0;

    cash.forEach((item) => {
      const val = Number(item.jumlah) || 0;
      if (item.jenis === 'Masuk') {
        totalMasuk += val;
      } else if (item.jenis === 'Keluar') {
        totalKeluar += val;
      }
    });

    const saldoAkhir = totalMasuk - totalKeluar;
    return { totalMasuk, totalKeluar, saldoAkhir, count: cash.length };
  }, [cash]);

  // Helper normalizer for member matching
  const normStr = (str?: string) => (str || '').trim().toLowerCase();

  // Helper function to check if a transaction matches a specific Month and Week
  const isTxMatchingMonthAndWeek = (tx: CashTransaction, monthKey: string, weekNum: number): boolean => {
    if (tx.jenis !== 'Masuk') return false;
    const txDate = (tx.tanggal || '').trim(); // e.g. "2026-08-15"
    const txMonth = txDate.slice(0, 7);
    const txKetLower = (tx.keterangan || '').toLowerCase();
    const monthObj = ACADEMIC_MONTHS.find((m) => m.key === monthKey);
    const monthNameLower = (monthObj?.label || '').split(' ')[0].toLowerCase(); // e.g. "agustus"

    // Check if month matches (by date OR description)
    const isMonthMatch = txMonth === monthKey || txKetLower.includes(monthNameLower);
    if (!isMonthMatch) return false;

    // Check week matching:
    // Extract exact week numbers explicitly mentioned in description
    const regex = /\b(?:minggu\s*(?:ke-?|\s*)?|mg\s*|m|w)(\d+)\b/gi;
    let match;
    const mentionedWeeks: number[] = [];
    while ((match = regex.exec(txKetLower)) !== null) {
      const w = parseInt(match[1], 10);
      if (w >= 1 && w <= 5 && !mentionedWeeks.includes(w)) {
        mentionedWeeks.push(w);
      }
    }

    const txAmount = Number(tx.jumlah) || 0;
    const stdFee = standardNominal || 5000;
    // Porsi per minggu 5.000: setiap kelipatan 5.000 melunasi 1 minggu
    // Contoh: 8.000 -> 1 minggu lunas (sisa 3.000 belum cukup kelipatan 5.000, minggu selanjutnya belum lunas)
    //         10.000 -> 2 minggu lunas
    //         15.000 -> 3 minggu lunas
    const weeksCovered = Math.floor(txAmount / stdFee);

    // If payment amount is less than 1 portion (< 5.000), it cannot cover any week on its own
    if (weeksCovered < 1 && txAmount < stdFee) {
      return false;
    }

    if (mentionedWeeks.length > 0) {
      if (mentionedWeeks.includes(weekNum)) {
        return true;
      }
      const startWeek = Math.min(...mentionedWeeks);
      if (weekNum >= startWeek && weekNum < startWeek + Math.max(1, weeksCovered)) {
        return true;
      }
      return false;
    }

    // If no explicit week in note, deduce from transaction date
    let dateWeek: number | undefined = undefined;
    if (txDate.startsWith(monthKey)) {
      dateWeek = getWeekNumFromDate(txDate);
    }
    const startWeek = dateWeek || 1;
    if (weekNum >= startWeek && weekNum < startWeek + Math.max(1, weeksCovered)) {
      return true;
    }

    return false;
  };

  // Helper to check payment across all dynamic weeks of the active month for a student
  // Menghitung status lunas per minggu: porsi 1 minggu = 5.000, setiap kelipatan 5.000 melunasi 1 minggu.
  // Contoh: bayar 8.000 -> minggu 1 lunas (hijau), minggu selanjutnya belum lunas (karena sisa 3.000 belum mencapai kelipatan 5.000)
  //         bayar 10.000 -> minggu 1 & minggu 2 lunas (keduanya langsung berwarna hijau)
  const getMemberMonthlyWeeksStatus = (member: Member) => {
    const mNisn = (member.nisn || '').trim();
    const mName = normStr(member.fullName);
    const stdFee = standardNominal || 5000;

    // 1. Ambil seluruh transaksi uang masuk untuk siswa ini di bulan aktif
    const memberMonthTxs = cash.filter((tx) => {
      if (tx.jenis !== 'Masuk') return false;
      const nisn = (tx.nisn || '').trim();
      const name = normStr(tx.namaAnggota || tx.namaSiswa);
      const isMatchMember = (mNisn && mNisn !== '-' && nisn === mNisn) || (mName && name === mName);
      if (!isMatchMember) return false;

      const txDate = (tx.tanggal || '').trim();
      const txMonth = txDate.slice(0, 7);
      const txKetLower = (tx.keterangan || '').toLowerCase();
      const monthObj = ACADEMIC_MONTHS.find((m) => m.key === selectedMonthKey);
      const monthNameLower = (monthObj?.label || '').split(' ')[0].toLowerCase();

      return txMonth === selectedMonthKey || txKetLower.includes(monthNameLower);
    });

    // 2. Hitung total uang kas yang disetor siswa pada bulan ini
    const totalPaidInMonth = memberMonthTxs.reduce((sum, tx) => sum + (Number(tx.jumlah) || 0), 0);
    // Setiap kelipatan penuh 5.000 melunasi 1 minggu:
    const totalWeeksQualifiedByAmount = Math.floor(totalPaidInMonth / stdFee);

    // 3. Petakan transaksi per minggu
    const weekToTxMap = new Map<number, CashTransaction>();

    // Urutkan transaksi berdasarkan tanggal kronologis
    const sortedTxs = [...memberMonthTxs].sort((a, b) => (a.tanggal || '').localeCompare(b.tanggal || ''));

    sortedTxs.forEach((tx) => {
      const txAmount = Number(tx.jumlah) || 0;
      const txKetLower = (tx.keterangan || '').toLowerCase();
      const txDate = (tx.tanggal || '').trim();

      const regex = /\b(?:minggu\s*(?:ke-?|\s*)?|mg\s*|m|w)(\d+)\b/gi;
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
        explicitWeek = getWeekNumFromDate(txDate);
      }
      const startW = explicitWeek || 1;
      const weeksCovered = Math.max(1, Math.floor(txAmount / stdFee));

      for (let i = 0; i < weeksCovered; i++) {
        const targetW = startW + i;
        if (targetW <= monthWeeks.length && !weekToTxMap.has(targetW)) {
          weekToTxMap.set(targetW, tx);
        }
      }
    });

    // 4. Hitung status untuk tiap minggu di bulan ini
    return monthWeeks.map((wInfo) => {
      const hasExplicitTx = weekToTxMap.has(wInfo.weekNum);
      const isQualifiedByAmount = wInfo.weekNum <= totalWeeksQualifiedByAmount;
      const isPaid = hasExplicitTx || isQualifiedByAmount;

      const tx = weekToTxMap.get(wInfo.weekNum) || (isPaid ? memberMonthTxs[0] : undefined);

      return {
        weekNum: wInfo.weekNum,
        weekInfo: wInfo,
        isPaid,
        tx,
      };
    });
  };

  // Helper to get payment status for a specific member in selected week
  const getMemberWeekPayment = (m: Member, weekNum: number = selectedWeekNum): CashTransaction | undefined => {
    const weeklyStatus = getMemberMonthlyWeeksStatus(m);
    const found = weeklyStatus.find((w) => w.weekNum === weekNum);
    return found?.isPaid ? found.tx : undefined;
  };

  // Total historical payments by each member across all time
  const memberLifetimeStats = useMemo(() => {
    const stats = new Map<string, { totalAmount: number; txCount: number }>();

    cash.forEach((tx) => {
      if (tx.jenis !== 'Masuk') return;
      const val = Number(tx.jumlah) || 0;
      const nisn = (tx.nisn || '').trim();
      const name = normStr(tx.namaAnggota || tx.namaSiswa);

      const keys: string[] = [];
      if (nisn && nisn !== '-') keys.push(`nisn:${nisn}`);
      if (name) keys.push(`name:${name}`);

      keys.forEach((k) => {
        const cur = stats.get(k) || { totalAmount: 0, txCount: 0 };
        stats.set(k, {
          totalAmount: cur.totalAmount + val,
          txCount: cur.txCount + 1,
        });
      });
    });

    return stats;
  }, [cash]);

  const getMemberLifetimeStat = (m: Member) => {
    const mNisn = (m.nisn || '').trim();
    const mName = normStr(m.fullName);

    if (mNisn && mNisn !== '-' && memberLifetimeStats.has(`nisn:${mNisn}`)) {
      return memberLifetimeStats.get(`nisn:${mNisn}`);
    }
    if (mName && memberLifetimeStats.has(`name:${mName}`)) {
      return memberLifetimeStats.get(`name:${mName}`);
    }
    return { totalAmount: 0, txCount: 0 };
  };

  // Total payments by member specifically in the currently selected month
  const getMemberMonthStat = (m: Member) => {
    const mNisn = (m.nisn || '').trim();
    const mName = normStr(m.fullName);
    const stdFee = standardNominal || 5000;

    const memberMonthTxs = cash.filter((tx) => {
      if (tx.jenis !== 'Masuk') return false;
      const nisn = (tx.nisn || '').trim();
      const name = normStr(tx.namaAnggota || tx.namaSiswa);
      const isMatchMember = (mNisn && mNisn !== '-' && nisn === mNisn) || (mName && name === mName);
      if (!isMatchMember) return false;

      const txDate = (tx.tanggal || '').trim();
      const txMonth = txDate.slice(0, 7);
      const txKetLower = (tx.keterangan || '').toLowerCase();
      const monthObj = ACADEMIC_MONTHS.find((p) => p.key === selectedMonthKey);
      const monthNameLower = (monthObj?.label || '').split(' ')[0].toLowerCase();

      return txMonth === selectedMonthKey || txKetLower.includes(monthNameLower);
    });

    const totalAmount = memberMonthTxs.reduce((sum, tx) => sum + (Number(tx.jumlah) || 0), 0);
    const txCount = memberMonthTxs.length;
    const weeksQualified = Math.floor(totalAmount / stdFee);

    return { totalAmount, txCount, weeksQualified, txs: memberMonthTxs };
  };

  // Week Statistics (Sudah Bayar vs Belum Bayar)
  const weekStats = useMemo(() => {
    let paidCount = 0;
    let unpaidCount = 0;
    let totalCollected = 0;

    members.forEach((m) => {
      const tx = getMemberWeekPayment(m);
      if (tx) {
        paidCount++;
        totalCollected += Number(tx.jumlah) || 0;
      } else {
        unpaidCount++;
      }
    });

    const totalMembers = members.length;
    const targetAmount = totalMembers * standardNominal;
    const percentage = totalMembers > 0 ? Math.round((paidCount / totalMembers) * 100) : 0;
    const remainingAmount = unpaidCount * standardNominal;

    return {
      totalMembers,
      paidCount,
      unpaidCount,
      totalCollected,
      targetAmount,
      percentage,
      remainingAmount,
    };
  }, [members, cash, selectedMonthKey, selectedWeekNum, standardNominal]);

  // Total member cash transactions count (excluding general organizational entries)
  const totalMemberTxsCount = useMemo(() => {
    return cash.filter((c) => {
      if (c.jenis !== 'Masuk') return false;
      const isOrg = (c.namaAnggota === 'Kas Organisasi' || c.namaSiswa === 'Kas Organisasi');
      return !isOrg;
    }).length;
  }, [cash]);

  // Filtered members list for Checklist View
  const filteredMembers = useMemo(() => {
    return members.filter((m) => {
      const q = searchMember.toLowerCase().trim();
      const mFullName = (m.fullName || (m as any).full_name || '').toLowerCase();
      const mNisn = (m.nisn || '').toLowerCase();
      const mClass = (m.classRoom || '').toLowerCase();
      const mGrade = (m.grade || '').toLowerCase();
      const mFullClass = formatFullClass(m.grade, m.classRoom).toLowerCase();

      const isPaid = !!getMemberWeekPayment(m);
      const paidStatusStr = isPaid ? 'paid settled completed' : 'unpaid arrears';

      const matchSearch =
        !q ||
        mFullName.includes(q) ||
        mNisn.includes(q) ||
        mClass.includes(q) ||
        mGrade.includes(q) ||
        mFullClass.includes(q) ||
        paidStatusStr.includes(q);

      const matchGrade =
        filterGrade === 'ALL' ||
        normalizeGrade(m.grade) === normalizeGrade(filterGrade) ||
        m.grade === filterGrade;

      const matchStatus =
        filterPaymentStatus === 'ALL' ||
        (filterPaymentStatus === 'PAID' && isPaid) ||
        (filterPaymentStatus === 'UNPAID' && !isPaid);

      return matchSearch && matchGrade && matchStatus;
    });
  }, [members, searchMember, filterGrade, filterPaymentStatus, cash, selectedMonthKey, selectedWeekNum]);

  // Filtered transactions for Ledger View
  const filteredLedger = useMemo(() => {
    return cash
      .filter((item) => {
        const q = ledgerSearch.toLowerCase().trim();
        const personName = (item.namaAnggota || (item as any).nama_anggota || item.namaSiswa || '').toLowerCase();
        const keterangan = (item.keterangan || '').toLowerCase();
        const tanggal = (item.tanggal || '').toLowerCase();
        const jenis = (item.jenis || '').toLowerCase();
        const jumlahStr = String(item.jumlah || '');

        const matchSearch =
          !q ||
          personName.includes(q) ||
          keterangan.includes(q) ||
          tanggal.includes(q) ||
          jenis.includes(q) ||
          jumlahStr.includes(q);

        const matchType = ledgerFilterType === 'ALL' || item.jenis === ledgerFilterType;
        return matchSearch && matchType;
      })
      .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
  }, [cash, ledgerSearch, ledgerFilterType]);

  // ----------------------------------------------------
  // Quick 1-Click Pay for Individual Member
  // ----------------------------------------------------
  const handleQuickPayMember = async (member: Member, weekNum: number = selectedWeekNum) => {
    if (!canCreateCash) return;
    playSuccessChime();
    // Generate real calendar date corresponding to this week
    const targetW = monthWeeks.find((w) => w.weekNum === weekNum) || activeWeekInfo;
    const isTodayInThisWeek = todayStr >= targetW.startDateStr && todayStr <= targetW.endDateStr;
    const paymentDate = isTodayInThisWeek ? todayStr : targetW.representativeDateStr;

    await onAddCash({
      tanggal: paymentDate,
      nisn: member.nisn || '-',
      namaAnggota: member.fullName,
      namaSiswa: member.fullName,
      jenis: 'Masuk',
      jumlah: standardNominal,
      keterangan: `Club Dues ${activeMonthObj.label} - Week ${weekNum}`,
    });
  };

  // ----------------------------------------------------
  // Open Payment / Edit Modal
  // ----------------------------------------------------
  const handleOpenPaymentModal = (member: Member, weekNum: number = selectedWeekNum) => {
    // Check if member already has payment for this week
    let existingTx: CashTransaction | undefined = undefined;
    if (weekNum === selectedWeekNum) {
      existingTx = getMemberWeekPayment(member);
    } else {
      const weeks = getMemberMonthlyWeeksStatus(member);
      const found = weeks.find((w) => w.weekNum === weekNum);
      existingTx = found?.tx;
    }

    setPaymentModal({
      isOpen: true,
      member,
      currentTx: existingTx,
      targetWeekNum: weekNum,
    });

    if (existingTx) {
      setModalNominal(existingTx.jumlah.toString());
      setModalDate(existingTx.tanggal || todayStr);
      setModalNote(existingTx.keterangan || `Club Dues ${activeMonthObj.label} - Week ${weekNum}`);
    } else {
      const targetW = monthWeeks.find((w) => w.weekNum === weekNum) || activeWeekInfo;
      const isTodayInThisWeek = todayStr >= targetW.startDateStr && todayStr <= targetW.endDateStr;
      const defaultDate = isTodayInThisWeek ? todayStr : targetW.representativeDateStr;

      setModalNominal(standardNominal.toString());
      setModalDate(defaultDate);
      setModalNote(`Club Dues ${activeMonthObj.label} - Week ${weekNum}`);
    }
  };

  // ----------------------------------------------------
  // Save Payment from Modal (Add or Edit)
  // ----------------------------------------------------
  const handleSaveModalPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal.member) return;

    const nominalNum = Number(modalNominal);
    if (!nominalNum || nominalNum <= 0) {
      setNoticeModal({
        isOpen: true,
        title: 'Invalid Payment Amount',
        message: 'Please enter a valid cash payment amount greater than 0.',
      });
      return;
    }

    // If editing existing transaction, delete old one first then add new
    if (paymentModal.currentTx && paymentModal.currentTx.id) {
      if (onCancelMemberCash) {
        await onCancelMemberCash(paymentModal.currentTx.id, paymentModal.member.fullName);
      } else {
        onDeleteCash(paymentModal.currentTx.id);
      }
    }

    const std = standardNominal || 5000;
    const weeksToPay = Math.floor(nominalNum / std);
    const remainder = nominalNum % std;
    const startWeek = paymentModal.targetWeekNum;

    if (weeksToPay <= 1) {
      const defaultNote = `Club Dues ${activeMonthObj.label} - Week ${startWeek}`;
      const inputNote = modalNote.trim();
      const finalNote = inputNote || defaultNote;
      const noteWithRemainder = remainder > 0 && weeksToPay === 1
        ? `${finalNote} (Includes remainder ${formatRupiah(remainder)})`
        : finalNote;

      await onAddCash({
        tanggal: modalDate || todayStr,
        nisn: paymentModal.member.nisn || '-',
        namaAnggota: paymentModal.member.fullName,
        namaSiswa: paymentModal.member.fullName,
        jenis: 'Masuk',
        jumlah: nominalNum,
        keterangan: noteWithRemainder,
      });
    } else {
      const transactionsToCreate: Omit<CashTransaction, 'id'>[] = [];

      for (let i = 0; i < weeksToPay; i++) {
        const currentWeekNum = startWeek + i;
        const wInfo = monthWeeks.find((w) => w.weekNum === currentWeekNum) || monthWeeks[monthWeeks.length - 1];
        const isCurrentWeekInFocus = currentWeekNum === startWeek;
        const payDate = (isCurrentWeekInFocus && modalDate) ? modalDate : (wInfo?.representativeDateStr || modalDate || todayStr);
        
        // Fee amount for this week (last week gets remainder if any)
        const weekAmount = (i === weeksToPay - 1 && remainder > 0) ? std + remainder : std;

        // Strip previous week mentions so each week's note has the exact currentWeekNum
        const rawNote = modalNote.trim();
        const cleanBase = rawNote
          ? rawNote.replace(/\b(?:minggu\s*(?:ke-?|\s*)?|week\s*|mg\s*|m|w)\d+\b/gi, '').replace(/[-–—\s]+$/, '').trim()
          : '';

        const noteText = cleanBase
          ? `${cleanBase} - Week ${currentWeekNum} (${weeksToPay}-Week Package)${i === weeksToPay - 1 && remainder > 0 ? ` [Remainder ${formatRupiah(remainder)}]` : ''}`
          : `Club Dues ${activeMonthObj.label} - Week ${currentWeekNum} (${weeksToPay}-Week Package)${i === weeksToPay - 1 && remainder > 0 ? ` [Remainder ${formatRupiah(remainder)}]` : ''}`;

        transactionsToCreate.push({
          tanggal: payDate,
          nisn: paymentModal.member.nisn || '-',
          namaAnggota: paymentModal.member.fullName,
          namaSiswa: paymentModal.member.fullName,
          jenis: 'Masuk',
          jumlah: weekAmount,
          keterangan: noteText,
        });
      }

      if (onBulkAddCash) {
        await onBulkAddCash(transactionsToCreate);
      } else {
        for (const tx of transactionsToCreate) {
          await onAddCash(tx);
        }
      }
    }

    playSuccessChime();
    setPaymentModal({ isOpen: false, member: null, targetWeekNum: selectedWeekNum });
  };

  // ----------------------------------------------------
  // Cancel / Delete Member Payment for Selected Week (Correction)
  // ----------------------------------------------------
  const handleCancelPayment = (member: Member, weekNum: number = selectedWeekNum) => {
    if (!canDeleteCash) return;
    let tx: CashTransaction | undefined = undefined;
    if (weekNum === selectedWeekNum) {
      tx = getMemberWeekPayment(member);
    } else {
      const weeks = getMemberMonthlyWeeksStatus(member);
      tx = weeks.find((w) => w.weekNum === weekNum)?.tx;
    }

    if (!tx) {
      // Fallback 1: search for any cash transaction in this month and week
      const mNisn = (member.nisn || '').trim();
      const mName = normStr(member.fullName);
      tx = cash.find((c) => {
        if (c.jenis !== 'Masuk') return false;
        const nisn = (c.nisn || '').trim();
        const name = normStr(c.namaAnggota || c.namaSiswa);
        const matchesMember = (mNisn && mNisn !== '-' && nisn === mNisn) || (mName && name === mName);
        return matchesMember && isTxMatchingMonthAndWeek(c, selectedMonthKey, weekNum);
      });
    }

    if (!tx) {
      // Fallback 2: search for any cash transaction for this member matching month name in description/date
      const mNisn = (member.nisn || '').trim();
      const mName = normStr(member.fullName);
      tx = cash.find((c) => {
        if (c.jenis !== 'Masuk') return false;
        const nisn = (c.nisn || '').trim();
        const name = normStr(c.namaAnggota || c.namaSiswa);
        const matchesMember = (mNisn && mNisn !== '-' && nisn === mNisn) || (mName && name === mName);
        const matchesMonth = (c.tanggal && c.tanggal.startsWith(selectedMonthKey)) ||
          (c.keterangan && c.keterangan.toLowerCase().includes(activeMonthObj.label.toLowerCase()));
        return matchesMember && matchesMonth;
      });
    }

    if (!tx) {
      setNoticeModal({
        isOpen: true,
        title: 'Payment Record Not Found',
        message: `No cash payment transaction found for ${member.fullName} in Week ${weekNum} (${activeMonthObj.label}).`,
      });
      return;
    }

    const targetTx = tx;
    setConfirmModal({
      isOpen: true,
      title: 'Delete Cash Payment (Correction)?',
      message: `Are you sure you want to cancel/delete the cash payment for ${member.fullName} in Week ${weekNum} (${activeMonthObj.label}) of ${formatRupiah(targetTx.jumlah)}?\n\nThis record will be deleted for correction and the student dues status will revert to Unpaid.`,
      confirmText: 'Yes, Delete Payment',
      confirmStyle: 'danger',
      onConfirm: async () => {
        if (onCancelMemberCash) {
          await onCancelMemberCash(targetTx.id, member.fullName, targetTx);
        } else {
          const txIndex = cash.indexOf(targetTx);
          await onDeleteCash(targetTx.id, txIndex >= 0 ? txIndex : undefined, targetTx);
        }
      },
    });
  };

  // ----------------------------------------------------
  // Delete a single specific transaction of a member (Correction)
  // ----------------------------------------------------
  const handleDeleteSingleMemberTx = (tx: CashTransaction, member: Member) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Student Cash Transaction (Correction)?',
      message: `Delete cash payment record for student ${member.fullName}?\n\n• Date: ${formatIndonesianDate(tx.tanggal)}\n• Note: ${tx.keterangan || '-'}\n• Amount: ${formatRupiah(tx.jumlah)}\n\nThis cash record will be permanently deleted for data correction.`,
      confirmText: 'Yes, Delete This Transaction',
      confirmStyle: 'danger',
      onConfirm: async () => {
        if (onCancelMemberCash) {
          await onCancelMemberCash(tx.id, member.fullName, tx);
        } else {
          const txIndex = cash.indexOf(tx);
          await onDeleteCash(tx.id, txIndex >= 0 ? txIndex : undefined, tx);
        }
      },
    });
  };

  // ----------------------------------------------------
  // Delete all cash transaction records for a specific member only
  // ----------------------------------------------------
  const handleDeleteMemberCashHistory = (member: Member) => {
    const mNisn = (member.nisn || '').trim();
    const mName = normStr(member.fullName);
    const memberTxs = cash.filter((c) => {
      if (c.jenis !== 'Masuk') return false;
      const nisn = (c.nisn || '').trim();
      const name = normStr(c.namaAnggota || c.namaSiswa);
      return (mNisn && mNisn !== '-' && nisn === mNisn) || (mName && name === mName);
    });

    if (memberTxs.length === 0) {
      setNoticeModal({
        isOpen: true,
        title: 'No Cash Transactions',
        message: `Student ${member.fullName} has no recorded cash transactions yet.`,
      });
      return;
    }

    const txIds = memberTxs.map((t) => t.id).filter(Boolean) as string[];
    const totalNominal = memberTxs.reduce((sum, t) => sum + Number(t.jumlah || 0), 0);

    setConfirmModal({
      isOpen: true,
      title: `Delete All Cash History for ${member.fullName}?`,
      message: `Are you sure you want to delete all cash transactions for student ${member.fullName}?\n\n• Total Transactions: ${memberTxs.length} transactions\n• Total Amount: ${formatRupiah(totalNominal)}\n\nThis action ONLY deletes the cash history for ${member.fullName} for correction. All their dues will revert to Unpaid. Other students' data will remain safe.`,
      confirmText: `Yes, Delete Student Cash Records (${memberTxs.length})`,
      confirmStyle: 'danger',
      onConfirm: async () => {
        if (onDeleteMultipleCash && txIds.length > 0) {
          await onDeleteMultipleCash(txIds, `All cash history for ${member.fullName} (${memberTxs.length} transactions) successfully deleted.`);
        } else {
          for (const tx of memberTxs) {
            await onDeleteCash(tx.id, undefined, tx);
          }
        }
        setMemberHistoryModal({ isOpen: false, member: null });
      },
    });
  };

  // ----------------------------------------------------
  // Delete single transaction from general ledger
  // ----------------------------------------------------
  const handleDeleteLedgerItem = (item: CashTransaction) => {
    const itemDesc = item.keterangan || (item.jenis === 'Masuk' ? 'Income' : 'Expense');
    const amountStr = formatRupiah(item.jumlah);
    const sourceStr = item.namaAnggota || item.namaSiswa || 'Club Treasury';

    setConfirmModal({
      isOpen: true,
      title: 'Delete Cash Transaction (Correction)?',
      message: `Are you sure you want to delete the transaction record "${itemDesc}" (${sourceStr}) for ${amountStr}?\n\nThis transaction will be removed from local storage and the database.`,
      confirmText: 'Yes, Delete Transaction',
      confirmStyle: 'danger',
      onConfirm: async () => {
        const masterIndex = cash.indexOf(item);
        await onDeleteCash(item.id, masterIndex >= 0 ? masterIndex : undefined, item);
      },
    });
  };

  // ----------------------------------------------------
  // Bulk Mark All Unpaid Members as Paid for this Week
  // ----------------------------------------------------
  const handleBulkMarkPaid = () => {
    const unpaidList = filteredMembers.filter((m) => !getMemberWeekPayment(m));
    if (unpaidList.length === 0) {
      setNoticeModal({
        isOpen: true,
        title: 'All Members Paid',
        message: `All students in the filtered list are already settled for Week ${selectedWeekNum} (${activeMonthObj.label}).`,
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Bulk Mark as Paid',
      message: `Mark ${unpaidList.length} unpaid students as PAID for ${activePeriodLabel} at @${formatRupiah(standardNominal)}?\nTotal cash collected: ${formatRupiah(unpaidList.length * standardNominal)}`,
      confirmText: `Yes, Mark All Paid (${unpaidList.length} Students)`,
      confirmStyle: 'primary',
      onConfirm: async () => {
        triggerCelebration(['#4338CA', '#10B981', '#F59E0B', '#6366F1']);
        const targetW = monthWeeks.find((w) => w.weekNum === selectedWeekNum) || activeWeekInfo;
        const isTodayInThisWeek = todayStr >= targetW.startDateStr && todayStr <= targetW.endDateStr;
        const paymentDate = isTodayInThisWeek ? todayStr : targetW.representativeDateStr;

        const newTransactions: Omit<CashTransaction, 'id'>[] = unpaidList.map((m) => ({
          tanggal: paymentDate,
          nisn: m.nisn || '-',
          namaAnggota: m.fullName,
          namaSiswa: m.fullName,
          jenis: 'Masuk',
          jumlah: standardNominal,
          keterangan: `Club Dues ${activeMonthObj.label} - Week ${selectedWeekNum}`,
        }));

        if (onBulkAddCash) {
          await onBulkAddCash(newTransactions);
        } else {
          for (const t of newTransactions) {
            await onAddCash(t);
          }
        }
      },
    });
  };

  // ----------------------------------------------------
  // Reset All Payments for Current Week
  // ----------------------------------------------------
  const handleResetCurrentWeek = () => {
    const paidTxs: CashTransaction[] = [];
    members.forEach((m) => {
      const tx = getMemberWeekPayment(m);
      if (tx && tx.id) paidTxs.push(tx);
    });

    if (paidTxs.length === 0) {
      setNoticeModal({
        isOpen: true,
        title: 'No Payments Recorded',
        message: `No payment data in ${activePeriodLabel} to reset.`,
      });
      return;
    }

    setConfirmModal({
      isOpen: true,
      title: 'Reset Payments for This Week?',
      message: `WARNING: You are about to reset all cash payments for ${activePeriodLabel} (${paidTxs.length} transactions). All students will revert to Unpaid.`,
      confirmText: 'Yes, Reset This Week',
      confirmStyle: 'warning',
      onConfirm: async () => {
        const ids = paidTxs.map((t) => t.id).filter(Boolean) as string[];
        if (onDeleteMultipleCash && ids.length > 0) {
          await onDeleteMultipleCash(ids, `Cash dues for ${activePeriodLabel} (${ids.length} transactions) successfully reset.`);
        } else {
          for (const tx of paidTxs) {
            if (tx.id) {
              if (onCancelMemberCash) {
                await onCancelMemberCash(tx.id, tx.namaAnggota);
              } else {
                await onDeleteCash(tx.id);
              }
            }
          }
        }
      },
    });
  };

  // ----------------------------------------------------
  // General Transaction Form Handler (Ledger)
  // ----------------------------------------------------
  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(genJumlah);
    if (!num || num <= 0) {
      setNoticeModal({
        isOpen: true,
        title: 'Nominal Tidak Valid',
        message: 'Silakan masukkan jumlah nominal lebih besar dari 0 untuk transaksi kas ini.',
      });
      return;
    }

    if (num > 50000000) {
      setNoticeModal({
        isOpen: true,
        title: 'Batas Maksimum Terlampaui',
        message: 'Nominal transaksi melebihi batas wajar kas ekstrakurikuler sekolah (Maksimum Rp 50.000.000 per transaksi). Silakan periksa kembali angka yang dimasukkan.',
      });
      return;
    }

    let personName = genCustomName.trim();
    if (!personName && genSelectedNisn) {
      const found = members.find((m) => m.nisn === genSelectedNisn);
      if (found) personName = found.fullName;
    }
    if (!personName) {
      personName = genJenis === 'Masuk' ? 'Club Treasury' : 'Activity Expense';
    }

    const payload = {
      tanggal: genTanggal || todayStr,
      nisn: genSelectedNisn || '-',
      namaAnggota: personName,
      namaSiswa: personName,
      jenis: genJenis,
      jumlah: num,
      keterangan: genKeterangan.trim() || (genJenis === 'Masuk' ? 'Club Income' : 'Club Expense'),
    };

    // Fat-Finger Safeguard: Double confirmation for large expenditures/incomes >= Rp 1.000.000
    if (num >= 1000000) {
      setConfirmModal({
        isOpen: true,
        title: 'Konfirmasi Transaksi Bernominal Besar',
        message: `PERINGATAN NOMINAL BESAR:\n\nAnda akan mencatat transaksi ${genJenis === 'Masuk' ? 'Pemasukan' : 'Pengeluaran'} sebesar ${formatRupiah(num)} untuk "${personName}".\n\nPastikan kuitansi/bukti transaksi fisik sudah diverifikasi sebelum disimpan ke buku kas organisasi.`,
        confirmText: 'Ya, Simpan Transaksi',
        confirmStyle: 'primary',
        onConfirm: async () => {
          await onAddCash(payload);
          setGenJumlah('');
          setGenKeterangan('');
          setGenCustomName('');
          setGenSelectedNisn('');
          setIsGeneralFormOpen(false);
        },
      });
      return;
    }

    await onAddCash(payload);

    // Reset Form
    setGenJumlah('');
    setGenKeterangan('');
    setGenCustomName('');
    setGenSelectedNisn('');
    setIsGeneralFormOpen(false);
  };

  // ----------------------------------------------------
  // Export Weekly Report to CSV
  // ----------------------------------------------------
  const handleExportWeeklyCsv = () => {
    const dataToExport = members.map((m, index) => {
      const monthlyWeeks = getMemberMonthlyWeeksStatus(m);
      const currentTx = getMemberWeekPayment(m);
      const lifetime = getMemberLifetimeStat(m);

      const rowData: Record<string, unknown> = {
        No: index + 1,
        Student_Name: m.fullName,
        NISN: m.nisn || '-',
        Class: formatFullClass(m.grade, m.classRoom),
        Month: activeMonthObj.label,
        Active_Week: `Week ${selectedWeekNum} (${activeWeekInfo.range})`,
        Status_This_Week: currentTx ? 'PAID' : 'UNPAID',
        Paid_Amount_This_Week: currentTx ? currentTx.jumlah : 0,
        Payment_Date_This_Week: currentTx ? currentTx.tanggal : '-',
      };

      // Add each week dynamically
      monthlyWeeks.forEach((w) => {
        rowData[`Week_${w.weekNum}_(${w.weekInfo.range})`] = w.isPaid ? `Paid (${w.tx?.jumlah})` : 'Unpaid';
      });

      rowData.Total_Member_Cash_History = lifetime.totalAmount;
      return rowData;
    });

    exportToCsv(`Robotics_Dues_${selectedMonthKey}_Week_${selectedWeekNum}`, dataToExport);
  };

  const handleExportWeeklyPdf = () => {
    exportWeeklyCashPdf({
      monthLabel: activeMonthObj.label,
      weekNum: selectedWeekNum,
      weekRange: activeWeekInfo.range,
      members: filteredMembers,
      cash,
      standardNominal,
      selectedMonthKey,
    });
  };

  const handleExportLedgerPdf = () => {
    exportCashLedgerPdf({
      cash: filteredLedger,
      periodLabel: ledgerFilterType !== 'ALL' ? `Ledger ${ledgerFilterType}` : 'All Cash Ledger',
      filterType: ledgerFilterType,
    });
  };

  const quickNominalPresets = [5000, 10000, 15000, 20000, 25000, 50000];

  return (
    <motion.div
      id="tab-kas"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 w-full"
    >
      {/* ========================================================================= */}
      {/* 1. TOP HEADER SUMMARY CARD                                               */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#4338CA] text-white rounded-2xl shadow-sm shadow-[#4338CA]/25 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2">
                <h3 className="text-base sm:text-lg font-black text-[#141414] tracking-tight truncate">
                  Robotic Club Weekly Dues
                </h3>
                <span className="w-fit px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-[#EEF2FF] text-[#312E81] border border-[#C7D2FE] shrink-0">
                  Rp 5,000 / Week
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Weekly dues tracking per student &amp; club operational expenditure ledger
              </p>
            </div>
          </div>

          {/* KPI Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 w-full md:w-auto">
            {/* Saldo Akhir */}
            <div className="px-3.5 py-2 rounded-xl bg-slate-900 text-white border border-slate-800">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Treasury Balance</div>
              <div className="text-sm sm:text-base font-black font-mono text-emerald-400 truncate">
                {formatRupiah(generalSummary.saldoAkhir)}
              </div>
            </div>

            {/* Total Masuk */}
            <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                <ArrowDownLeft className="w-3 h-3 shrink-0" />
                <span>Income</span>
              </div>
              <div className="text-xs sm:text-sm font-black font-mono text-emerald-800 truncate">
                {formatRupiah(generalSummary.totalMasuk)}
              </div>
            </div>

            {/* Total Keluar */}
            <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200">
              <div className="text-[10px] font-bold uppercase tracking-wider text-rose-700 flex items-center gap-1">
                <ArrowUpRight className="w-3 h-3 shrink-0" />
                <span>Expenses</span>
              </div>
              <div className="text-xs sm:text-sm font-black font-mono text-rose-800 truncate">
                {formatRupiah(generalSummary.totalKeluar)}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. SUB-TAB SWITCHER & ACTION BUTTONS                                     */}
      {/* ========================================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        
        {/* Toggle between Checklist & General Ledger */}
        <div className="inline-flex p-1 bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl">
          <button
            type="button"
            id="kasChecklistTabBtn"
            onClick={() => setActiveSubTab('checklist')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'checklist'
                ? 'bg-[#4338CA] text-white shadow-2xs'
                : 'text-[#312E81] hover:text-[#4338CA]'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Student Weekly Dues</span>
          </button>

          <button
            type="button"
            id="kasLedgerTabBtn"
            onClick={() => setActiveSubTab('ledger')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeSubTab === 'ledger'
                ? 'bg-[#4338CA] text-white shadow-2xs'
                : 'text-[#312E81] hover:text-[#4338CA]'
            }`}
          >
            <Receipt className="w-3.5 h-3.5" />
            <span>Treasurer Cash History ({cash.length})</span>
          </button>
        </div>

        {/* Action Buttons for active view (Outline / Secondary) */}
        <div className="flex items-center gap-2 flex-wrap">
          {activeSubTab === 'checklist' ? (
            <>
              <button
                type="button"
                id="exportWeeklyPdfBtn"
                onClick={handleExportWeeklyPdf}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95"
                title="Download Official Weekly Dues Report in PDF Format"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Print PDF</span>
              </button>

              <button
                type="button"
                id="exportWeeklyCsvBtn"
                onClick={handleExportWeeklyCsv}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95"
                title="Download weekly dues data to CSV"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>

              {/* Upload CSV Kas Checklist */}
              {canCreateCash && (
                <button
                  type="button"
                  id="openUploadCsvCashBtnChecklist"
                  onClick={() => {
                    playClickTick();
                    if (onOpenUploadModal) {
                      onOpenUploadModal();
                    } else {
                      setIsImportModalOpen(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#C7D2FE] text-[#4338CA] rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                  title="Upload cash dues CSV file"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                </button>
              )}
            </>
          ) : (
            <>
              <button
                type="button"
                id="exportLedgerPdfBtn"
                onClick={handleExportLedgerPdf}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95"
                title="Download Official General Ledger & Financial Report in PDF"
              >
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span>Print PDF</span>
              </button>

              <button
                type="button"
                onClick={() => exportToCsv(`General_Ledger_${todayStr}`, cash)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 rounded-xl text-xs font-semibold transition shadow-2xs cursor-pointer active:scale-95"
              >
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export Ledger CSV</span>
              </button>

              {/* Upload CSV Kas Ledger */}
              {canCreateCash && (
                <button
                  type="button"
                  id="openUploadCsvCashBtnLedger"
                  onClick={() => {
                    playClickTick();
                    if (onOpenUploadModal) {
                      onOpenUploadModal();
                    } else {
                      setIsImportModalOpen(true);
                    }
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#EEF2FF] hover:bg-[#E0E7FF] border border-[#C7D2FE] text-[#4338CA] rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                  title="Upload treasurer cash history CSV"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                </button>
              )}

              {canResetEntireCash && onResetAllCash && cash.length > 0 && (
                <button
                  type="button"
                  id="btnResetAllCashHeader"
                  onClick={() => {
                    playClickTick();
                    setResetAllCashInput('');
                    setResetAllCashModalOpen(true);
                  }}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Reset seluruh riwayat kas dari basis data (Wajib verifikasi pengetikan)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Riwayat Kas ({cash.length})</span>
                </button>
              )}

              {canCreateCash && (
                <button
                  type="button"
                  onClick={() => setIsGeneralFormOpen(!isGeneralFormOpen)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#4338CA] hover:bg-[#312E81] text-white rounded-xl text-xs font-bold transition shadow-sm shadow-[#4338CA]/25 active:scale-95 cursor-pointer"
                >
                  {isGeneralFormOpen ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  <span>{isGeneralFormOpen ? 'Close Form' : 'Record Transaction'}</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* RBAC Read-Only Notice Banner */}
      {!canCreateCash && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">Mode Transparansi Kas (Viewer / Read-Only):</span>
              <span className="text-amber-800 ml-1">
                Akun Anda ({roleMeta.label}) berstatus peninjau (viewer). Sesuai pemisahan tugas (*segregation of duties*), hak mencatat pembayaran iuran kas, mengedit nominal, dan menghapus transaksi khusus dipegang oleh <strong>Bendahara (Treasurer)</strong> &amp; <strong>Administrator Utama</strong>.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300 uppercase tracking-wide shrink-0">
            Read-Only (Viewer)
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW A: CHECKLIST IURAN KAS SISWA PER MINGGU                             */}
      {/* ========================================================================= */}
      {activeSubTab === 'checklist' && (
        <div className="space-y-3">
          
          {/* Unified Compact Period, Progress & Filter Card */}
          <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-[#C7D2FE] shadow-2xs space-y-3">
            
            {/* Top Bar: Period Selection (Month & Week Tabs), Progress, & Primary CTA */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              
              {/* Left Group: Month Dropdown + Slim Week Tabs */}
              <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
                {/* Month Dropdown */}
                <div className="flex items-center gap-1.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl px-2.5 py-1 text-xs font-bold text-[#312E81]">
                  <Calendar className="w-3.5 h-3.5 text-[#4338CA]" />
                  <select
                    value={selectedMonthKey}
                    onChange={(e) => setSelectedMonthKey(e.target.value)}
                    className="bg-transparent border-none text-xs font-bold text-[#312E81] focus:outline-none cursor-pointer pr-1"
                  >
                    {ACADEMIC_MONTHS.map((p) => (
                      <option key={p.key} value={p.key}>
                        {p.label} {p.key === currentMonthKey ? '(This Month)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Slim Week Segment Tabs */}
                <div className="flex items-center p-0.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl">
                  {monthWeeks.map((w) => {
                    const isSelected = selectedWeekNum === w.weekNum;
                    
                    let paidInThisWeek = 0;
                    members.forEach((m) => {
                      const statusList = getMemberMonthlyWeeksStatus(m);
                      const weekStat = statusList.find((item) => item.weekNum === w.weekNum);
                      if (weekStat?.isPaid) paidInThisWeek++;
                    });

                    return (
                      <button
                        key={w.weekNum}
                        type="button"
                        onClick={() => setSelectedWeekNum(w.weekNum)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                          isSelected
                            ? 'bg-[#4338CA] text-white shadow-2xs'
                            : 'text-[#312E81] hover:text-[#4338CA] hover:bg-white/50'
                        }`}
                        title={`${w.label} (${w.range}) - ${paidInThisWeek}/${members.length} Paid`}
                      >
                        <span>W{w.weekNum}</span>
                        <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                          isSelected ? 'bg-[#312E81] text-indigo-100' : 'text-slate-500'
                        }`}>
                          {paidInThisWeek}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Tarif Fee Badge */}
                <span className="hidden xl:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg">
                  Fee: <strong className="text-emerald-700 font-mono">{formatRupiah(standardNominal)}</strong>/wk
                </span>
              </div>

              {/* Right Group: Progress & Actions */}
              <div className="flex items-center gap-2 sm:gap-3 flex-wrap sm:flex-nowrap justify-between lg:justify-end">
                {/* Compact Progress Indicator */}
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs" title={`Target: ${formatRupiah(weekStats.targetAmount)}`}>
                  <div className="w-16 sm:w-20 bg-slate-200 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                      style={{ width: `${weekStats.percentage}%` }}
                    />
                  </div>
                  <span className="font-mono font-bold text-xs text-slate-700 whitespace-nowrap">
                    {weekStats.percentage}% <span className="text-[10px] text-slate-400 font-normal">({formatRupiah(weekStats.totalCollected)})</span>
                  </span>
                </div>

                {/* Primary Solid Action (Single prominent CTA) */}
                {canCreateCash && (
                  <button
                    type="button"
                    id="bulkMarkPaidBtn"
                    onClick={handleBulkMarkPaid}
                    disabled={isSubmitting || weekStats.unpaidCount === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4338CA] hover:bg-[#312E81] disabled:opacity-40 text-white rounded-xl text-xs font-bold transition shadow-2xs active:scale-95 cursor-pointer shrink-0"
                    title="Mark all unpaid members as Paid for this week"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark All Paid ({weekStats.unpaidCount})</span>
                  </button>
                )}

                {/* Reset Button (Outline) */}
                {canResetCash && weekStats.paidCount > 0 && (
                  <button
                    type="button"
                    id="resetCurrentWeekBtn"
                    onClick={handleResetCurrentWeek}
                    disabled={isSubmitting}
                    className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 border border-slate-200 rounded-xl text-xs font-medium transition cursor-pointer active:scale-95 shadow-2xs"
                    title="Reset dues status for this week back to unpaid"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                    <span>Reset This Week</span>
                  </button>
                )}
              </div>

            </div>

            {/* Bottom Bar: Search Box + Spaced-Out Filter Controls (gap-3 sm:gap-4) */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
              
              {/* Search Box */}
              <div className="relative flex-1 min-w-[220px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={searchMember}
                  onChange={(e) => setSearchMember(e.target.value)}
                  placeholder="Search student name, NISN, or class (e.g. X-A, XI-B)..."
                  className="w-full pl-8 pr-8 py-1.5 bg-[#EEF2FF]/40 border border-[#C7D2FE] rounded-xl text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#4338CA] transition"
                />
                {searchMember && (
                  <button
                    type="button"
                    onClick={() => setSearchMember('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Controls Row with Generous Spacing (gap-3 sm:gap-4) */}
              <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                
                {/* Payment Status Segmented Control */}
                <div className="flex items-center p-0.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      setFilterPaymentStatus('ALL');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      filterPaymentStatus === 'ALL'
                        ? 'bg-[#4338CA] text-white shadow-2xs'
                        : 'text-[#312E81] hover:text-[#4338CA]'
                    }`}
                  >
                    All ({members.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      setFilterPaymentStatus('PAID');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      filterPaymentStatus === 'PAID'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-700 hover:bg-emerald-50'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Paid ({weekStats.paidCount})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      setFilterPaymentStatus('UNPAID');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                      filterPaymentStatus === 'UNPAID'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-rose-700 hover:bg-rose-50'
                    }`}
                  >
                    <AlertCircle className="w-3 h-3" />
                    <span>Unpaid ({weekStats.unpaidCount})</span>
                  </button>
                </div>

                {/* Grade Dropdown Filter */}
                <select
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#312E81] focus:outline-none focus:border-[#4338CA] cursor-pointer shadow-2xs"
                >
                  <option value="ALL">All Classes</option>
                  <option value="X">Grade X</option>
                  <option value="XI">Grade XI</option>
                  <option value="XII">Grade XII</option>
                </select>

                {/* Refresh Button */}
                {onRefreshData && (
                  <button
                    type="button"
                    onClick={onRefreshData}
                    disabled={isSyncing}
                    title="Refresh cash data"
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-[#4338CA] px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 hover:border-[#C7D2FE] hover:bg-[#EEF2FF] transition cursor-pointer shadow-2xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#4338CA]' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}

              </div>

            </div>

          </div>

            {/* Member Checklist Table */}
            <div className="overflow-hidden border border-[#C7D2FE] rounded-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="bg-[#EEF2FF] border-b border-[#C7D2FE] text-[#312E81] font-bold text-[11px] uppercase tracking-wider">
                      <th className="py-3 px-3.5 w-10 text-center">No</th>
                      <th className="py-3 px-3.5">Student Name &amp; NISN</th>
                      <th className="py-3 px-3.5">Class</th>
                      <th className="py-3 px-3.5 text-center">Status (Wk {selectedWeekNum})</th>
                      <th className="py-3 px-3.5 text-center">Month Recap ({activeMonthObj.label.split(' ')[0]})</th>
                      <th className="py-3 px-3.5 text-center">Paid This Month</th>
                      <th className="py-3 px-3.5 text-right">Payment Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800">
                    {filteredMembers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400 font-medium text-xs">
                          <Users className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                          No students match the filter criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredMembers.map((member, index) => {
                        const monthlyWeeks = getMemberMonthlyWeeksStatus(member);
                        const currentWeekStatus = monthlyWeeks.find((w) => w.weekNum === selectedWeekNum);
                        const isPaid = !!currentWeekStatus?.isPaid;
                        const tx = currentWeekStatus?.tx;
                        const lifetime = getMemberLifetimeStat(member);
                        const monthStat = getMemberMonthStat(member);
                        const formattedClass = formatFullClass(member.grade, member.classRoom);
                        const isMale = isMaleMember(member.gender);

                        return (
                          <tr
                            key={member.nisn || index}
                            className={`transition duration-150 ${
                              isPaid ? 'bg-emerald-50/20 hover:bg-emerald-50/40' : 'hover:bg-slate-50/60'
                            }`}
                          >
                            {/* No */}
                            <td className="py-3 px-3.5 text-center font-mono text-xs text-slate-400 font-medium">
                              {index + 1}
                            </td>

                            {/* Nama Siswa & Avatar */}
                            <td className="py-2.5 px-3">
                              <div 
                                className="flex items-center gap-2 cursor-pointer group"
                                onClick={() => setMemberHistoryModal({ isOpen: true, member })}
                                title="Click to view payment history & correction for this student"
                              >
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-black shrink-0 transition group-hover:scale-105 ${
                                  isPaid 
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : isMale
                                      ? 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]'
                                      : 'bg-pink-100 text-pink-800'
                                }`}>
                                  {member.fullName.substring(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-slate-900 group-hover:text-[#4338CA] transition truncate flex items-center gap-1.5">
                                    <span>{member.fullName}</span>
                                    {isPaid && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                                  </div>
                                  <div className="text-[10px] font-mono text-slate-400">
                                    NISN: {member.nisn || '-'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* Kelas */}
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-0.5 rounded-md bg-[#EEF2FF] border border-[#C7D2FE] text-[#312E81] font-bold text-[11px]">
                                {formattedClass}
                              </span>
                            </td>

                            {/* Status Minggu Aktif Badge */}
                            <td className="py-2.5 px-3 text-center">
                              {isPaid ? (
                                <div className="inline-flex flex-col items-center">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>Paid ({formatRupiah(tx?.jumlah || standardNominal)})</span>
                                  </span>
                                  {tx?.tanggal && (
                                    <span className="text-[9px] text-slate-400 font-mono mt-0.5">
                                      {formatIndonesianDate(tx.tanggal)}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                  <Clock className="w-3 h-3 text-slate-400" />
                                  <span>Unpaid</span>
                                </span>
                              )}
                            </td>

                            {/* Mini Kalender Status Tiap Minggu */}
                            <td className="py-2.5 px-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                {monthlyWeeks.map((fw) => {
                                  const titleText = `Week ${fw.weekNum} (${fw.weekInfo.range}): ${
                                    fw.isPaid
                                      ? `PAID (${formatRupiah(fw.tx?.jumlah || standardNominal)})`
                                      : 'Unpaid'
                                  }`;
                                  if (canCreateCash) {
                                    return (
                                      <button
                                        key={fw.weekNum}
                                        type="button"
                                        onClick={() => handleOpenPaymentModal(member, fw.weekNum)}
                                        title={`${titleText} - Click to ${fw.isPaid ? 'edit' : 'pay'}`}
                                        className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center transition cursor-pointer ${
                                          fw.isPaid
                                            ? 'bg-emerald-600 text-white shadow-2xs hover:bg-emerald-700'
                                            : fw.weekNum === selectedWeekNum
                                              ? 'bg-rose-100 text-rose-700 border border-rose-300 hover:bg-rose-200'
                                              : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                                        }`}
                                      >
                                        W{fw.weekNum}
                                      </button>
                                    );
                                  }
                                  return (
                                    <span
                                      key={fw.weekNum}
                                      title={titleText}
                                      className={`w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center cursor-default select-none ${
                                        fw.isPaid
                                          ? 'bg-emerald-600 text-white shadow-2xs'
                                          : fw.weekNum === selectedWeekNum
                                            ? 'bg-rose-100 text-rose-700 border border-rose-300'
                                            : 'bg-slate-100 text-slate-400'
                                      }`}
                                    >
                                      W{fw.weekNum}
                                    </span>
                                  );
                                })}
                              </div>
                            </td>

                            {/* Setoran Bulan Ini */}
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setMemberHistoryModal({ isOpen: true, member })}
                                className="inline-flex flex-col items-center px-2.5 py-1 rounded-xl bg-slate-50 hover:bg-[#EEF2FF] border border-slate-200 hover:border-[#C7D2FE] transition cursor-pointer group"
                                title={`Click to view payment history for ${member.fullName}`}
                              >
                                <span className={`font-mono text-xs font-bold ${
                                  monthStat.totalAmount > 0 ? 'text-[#4338CA]' : 'text-slate-400'
                                }`}>
                                  {formatRupiah(monthStat.totalAmount)}
                                </span>
                                {monthStat.totalAmount > 0 ? (
                                  <span className="text-[10px] text-emerald-600 font-semibold">
                                    {monthStat.weeksQualified > 0 ? `${monthStat.weeksQualified} Wks Paid` : `${monthStat.txCount}x paid`}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-slate-400">None yet</span>
                                )}
                              </button>
                            </td>

                            {/* AKSI PEMBAYARAN & KOREKSI */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                {!isPaid ? (
                                  <>
                                    {canCreateCash ? (
                                      <>
                                        {/* Tombol Masuk Pembayaran Langsung */}
                                        <button
                                          type="button"
                                          id={`quick-pay-btn-${member.nisn || index}`}
                                          onClick={() => handleQuickPayMember(member)}
                                          disabled={isSubmitting}
                                          className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-[#EEF2FF] active:bg-[#E0E7FF] text-[#4338CA] border border-[#C7D2FE] hover:border-[#4338CA] rounded-xl text-xs font-semibold transition cursor-pointer disabled:opacity-50 shadow-2xs active:scale-95"
                                          title="Record cash dues Rp 5,000 (1-Click)"
                                        >
                                          <CheckCircle2 className="w-3.5 h-3.5 text-[#4338CA]" />
                                          <span>Pay Rp 5,000</span>
                                        </button>

                                        {/* Tombol Input Kustom */}
                                        <button
                                          type="button"
                                          id={`custom-pay-btn-${member.nisn || index}`}
                                          onClick={() => handleOpenPaymentModal(member, selectedWeekNum)}
                                          className="p-1 text-slate-500 hover:text-[#4338CA] hover:bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl transition cursor-pointer active:scale-95 shadow-2xs"
                                          title="Custom amount input or notes"
                                        >
                                          <CreditCard className="w-3.5 h-3.5" />
                                        </button>
                                      </>
                                    ) : (
                                      <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 select-none">
                                        Read-Only
                                      </span>
                                    )}

                                    {/* Jika siswa punya riwayat sebelumnya, sediakan akses riwayat */}
                                    {lifetime.txCount > 0 && (
                                      <button
                                        type="button"
                                        id={`history-member-cash-btn-${member.nisn || index}`}
                                        onClick={() => setMemberHistoryModal({ isOpen: true, member })}
                                        disabled={isSubmitting}
                                        className="p-1 text-slate-500 hover:text-[#4338CA] hover:bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl transition cursor-pointer active:scale-95 shadow-2xs"
                                        title={`View cash history for ${member.fullName} (${lifetime.txCount} transactions)`}
                                      >
                                        <Receipt className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                ) : (
                                  <>
                                    {/* Tombol Edit Pembayaran */}
                                    {canCreateCash && (
                                      <button
                                        type="button"
                                        id={`edit-member-cash-btn-${member.nisn || index}`}
                                        onClick={() => handleOpenPaymentModal(member, selectedWeekNum)}
                                        className="flex items-center gap-1 px-2 py-1 bg-[#EEF2FF] hover:bg-[#C7D2FE]/40 text-[#312E81] border border-[#C7D2FE] rounded-xl text-xs font-bold transition cursor-pointer active:scale-95"
                                        title="Edit payment amount or note"
                                      >
                                        <Edit3 className="w-3 h-3 text-[#4338CA]" />
                                        <span>Edit</span>
                                      </button>
                                    )}

                                    {/* Tombol Hapus Pembayaran Minggu Ini (Koreksi) */}
                                    {canDeleteCash && (
                                      <button
                                        type="button"
                                        id={`delete-payment-btn-${member.nisn || index}`}
                                        onClick={() => handleCancelPayment(member, selectedWeekNum)}
                                        disabled={isSubmitting}
                                        className="flex items-center gap-1 px-2 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 hover:border-rose-600 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
                                        title="Delete payment for this week for correction (revert to Unpaid)"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        <span>Delete</span>
                                      </button>
                                    )}

                                    {/* Tombol Riwayat Lengkap Siswa jika ada riwayat */}
                                    {lifetime.txCount > 0 && (
                                      <button
                                        type="button"
                                        id={`history-member-cash-btn-${member.nisn || index}`}
                                        onClick={() => setMemberHistoryModal({ isOpen: true, member })}
                                        disabled={isSubmitting}
                                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 border border-slate-200 hover:border-blue-300 rounded-xl transition cursor-pointer active:scale-95 shadow-2xs"
                                        title={`View cash history for ${member.fullName} (${lifetime.txCount} transactions)`}
                                      >
                                        <Receipt className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
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

          </div>
        )}

      {/* ========================================================================= */}
      {/* VIEW B: BUKU KAS & MUTASI LENGKAP (LEDGER VIEW)                           */}
      {/* ========================================================================= */}
      {activeSubTab === 'ledger' && (
        <div className="bg-white rounded-2xl p-3 sm:p-3.5 border border-[#C7D2FE] shadow-2xs space-y-3">
          
          {/* Section Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Treasurer Cash Ledger</span>
                  <span className="text-xs font-normal text-[#312E81] font-mono">
                    ({filteredLedger.length} of {cash.length} transactions)
                  </span>
                </h4>
                <p className="text-[11px] text-slate-400">
                  Income and expense audit journal for Robotic MAN 2 Kota Bekasi
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            {/* Search Box */}
            <div className="relative flex-1 min-w-[240px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                placeholder="Search transaction, notes, or member name..."
                className="w-full pl-8 pr-8 py-1.5 bg-[#EEF2FF]/50 border border-[#C7D2FE] rounded-xl text-xs text-[#141414] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#4338CA] transition"
              />
              {ledgerSearch && (
                <button
                  type="button"
                  onClick={() => setLedgerSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filter by Type & Actions */}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={ledgerFilterType}
                onChange={(e) => setLedgerFilterType(e.target.value)}
                className="px-2.5 py-1.5 bg-[#EEF2FF] border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#312E81] focus:outline-none focus:border-[#4338CA] cursor-pointer"
              >
                <option value="ALL">All Transaction Types</option>
                <option value="Masuk">Income (Cash In)</option>
                <option value="Keluar">Expense (Cash Out)</option>
              </select>

              {onRefreshData && (
                <button
                  type="button"
                  onClick={onRefreshData}
                  disabled={isSyncing}
                  title="Refresh cash data from database"
                  className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-[#4338CA] px-2.5 py-1.5 rounded-xl bg-white border border-[#C7D2FE] hover:bg-[#EEF2FF] transition cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
              )}

              {/* Upload CSV Kas in Ledger Toolbar */}
              <button
                type="button"
                id="openUploadCsvCashLedgerToolbar"
                onClick={() => {
                  playClickTick();
                  if (onOpenUploadModal) {
                    onOpenUploadModal();
                  } else {
                    setIsImportModalOpen(true);
                  }
                }}
                className="flex items-center gap-1 text-[11px] font-bold text-[#4338CA] px-2.5 py-1.5 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] hover:bg-[#E0E7FF] transition cursor-pointer active:scale-95 shadow-2xs"
                title="Upload cash ledger CSV file"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload CSV</span>
              </button>

              {onResetAllCash && cash.length > 0 && (
                <button
                  type="button"
                  id="btnResetAllCashLedgerToolbar"
                  onClick={() => {
                    playClickTick();
                    setConfirmModal({
                      isOpen: true,
                      title: 'Reset All Cash Ledger History?',
                      message: `WARNING: You are about to permanently delete all cash transactions (${cash.length} income & expense records) from both local and cloud databases. Balance will reset to Rp 0. Are you sure?`,
                      confirmText: 'Yes, Reset Cash History',
                      confirmStyle: 'danger',
                      onConfirm: async () => {
                        if (onResetAllCash) {
                          await onResetAllCash();
                        }
                      },
                    });
                  }}
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 text-rose-700 border border-rose-200 rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                  title="Reset all cash transaction history from database"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset Cash History ({cash.length})</span>
                </button>
              )}
            </div>
          </div>

          {/* Collapsible General Transaction Form */}
          <AnimatePresence>
            {isGeneralFormOpen && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleGeneralSubmit}
                className="bg-[#EEF2FF] p-4 sm:p-5 rounded-2xl border border-[#C7D2FE] space-y-4 overflow-hidden"
              >
                <div className="flex items-center justify-between pb-2 border-b border-[#C7D2FE]">
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#4338CA]" />
                    <span>Manual Cash Transaction Entry</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsGeneralFormOpen(false)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {/* Tanggal */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Date</label>
                    <input
                      type="date"
                      value={genTanggal}
                      onChange={(e) => setGenTanggal(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#C7D2FE] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#4338CA]"
                      required
                    />
                  </div>

                  {/* Jenis */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Transaction Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGenJenis('Masuk')}
                        className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                          genJenis === 'Masuk'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'bg-white border border-[#C7D2FE] text-slate-600'
                        }`}
                      >
                        <ArrowDownLeft className="w-3.5 h-3.5" />
                        <span>Income</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setGenJenis('Keluar')}
                        className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer flex items-center justify-center gap-1 ${
                          genJenis === 'Keluar'
                            ? 'bg-rose-600 text-white shadow-2xs'
                            : 'bg-white border border-[#C7D2FE] text-slate-600'
                        }`}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Expense</span>
                      </button>
                    </div>
                  </div>

                  {/* Jumlah */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nominal Amount (Rp)</label>
                    <input
                      type="number"
                      value={genJumlah}
                      onChange={(e) => setGenJumlah(e.target.value)}
                      placeholder="e.g. 5000"
                      className="w-full px-3 py-2 bg-white border border-[#C7D2FE] rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#4338CA]"
                      required
                      min="1"
                    />
                  </div>

                  {/* Pilih Anggota (Jika Masuk) */}
                  {genJenis === 'Masuk' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">Select Student (Optional)</label>
                      <select
                        value={genSelectedNisn}
                        onChange={(e) => {
                          setGenSelectedNisn(e.target.value);
                          const m = members.find((x) => x.nisn === e.target.value);
                          if (m) setGenCustomName(m.fullName);
                        }}
                        className="w-full px-3 py-2 bg-white border border-[#C7D2FE] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#4338CA]"
                      >
                        <option value="">-- Non-Student Payment --</option>
                        {members.map((m) => (
                          <option key={m.nisn} value={m.nisn}>
                            {m.fullName} ({formatFullClass(m.grade, m.classRoom)})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Nama Pihak / Siswa Kustom */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {genJenis === 'Masuk' ? 'Source / Payer Name' : 'Payee / Store Name'}
                    </label>
                    <input
                      type="text"
                      value={genCustomName}
                      onChange={(e) => setGenCustomName(e.target.value)}
                      placeholder={genJenis === 'Masuk' ? 'e.g. Club Treasury / Sponsor' : 'e.g. Electronics Store / Hardware Shop'}
                      className="w-full px-3 py-2 bg-white border border-[#C7D2FE] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#4338CA]"
                    />
                  </div>

                  {/* Keterangan */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Description / Purpose</label>
                    <input
                      type="text"
                      value={genKeterangan}
                      onChange={(e) => setGenKeterangan(e.target.value)}
                      placeholder="e.g. Club dues, jumper wires, sensor modules..."
                      className="w-full px-3 py-2 bg-white border border-[#C7D2FE] rounded-xl text-xs text-slate-900 focus:outline-none focus:border-[#4338CA]"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#C7D2FE]">
                  <button
                    type="button"
                    onClick={() => setIsGeneralFormOpen(false)}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-1.5 bg-[#4338CA] hover:bg-[#312E81] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    Save Transaction
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Ledger Table */}
          <div className="overflow-hidden border border-[#C7D2FE] rounded-2xl">
            <div className="overflow-x-auto">
              <table id="riwayatKasTable" className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#EEF2FF] border-b border-[#C7D2FE] text-[#312E81] font-bold text-[11px] uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-10 text-center">No</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Source / Member</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-center">Type</th>
                    <th className="py-2.5 px-3 text-right">Amount (Rp)</th>
                    <th className="py-2.5 px-3 text-center w-14">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredLedger.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-10 text-center text-slate-400 font-medium text-xs">
                        <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                        No transactions recorded in cash ledger yet.
                      </td>
                    </tr>
                  ) : (
                    filteredLedger.map((item, index) => {
                      const isIncome = item.jenis === 'Masuk';
                      return (
                        <tr key={item.id || index} className="hover:bg-[#EEF2FF]/40 transition">
                          <td className="py-2.5 px-3 text-center font-mono text-xs text-slate-400">
                            {index + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-xs text-slate-600 whitespace-nowrap">
                            {formatIndonesianDate(item.tanggal)}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-900">
                            {item.namaAnggota || item.namaSiswa || 'Club Treasury'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {item.keterangan || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              isIncome
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {isIncome ? (
                                <>
                                  <ArrowDownLeft className="w-3 h-3" />
                                  <span>Income</span>
                                </>
                              ) : (
                                <>
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span>Expense</span>
                                </>
                              )}
                            </span>
                          </td>
                          <td className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                            isIncome ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {isIncome ? '+' : '-'} {formatRupiah(item.jumlah)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {canDeleteCash ? (
                              <button
                                type="button"
                                id={`delete-cash-btn-${item.id || index}`}
                                onClick={() => handleDeleteLedgerItem(item)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                title="Delete this transaction for correction"
                                aria-label="Delete cash transaction"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            ) : (
                              <span className="text-slate-300 text-xs">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: INPUT & EDIT PEMBAYARAN KAS SISWA                                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {paymentModal.isOpen && paymentModal.member && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-2xl max-w-md w-full p-5 border border-[#C7D2FE] shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#4338CA]" />
                    <span>{paymentModal.currentTx ? 'Edit Member Dues Payment' : 'Record Member Dues Payment'}</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Member: <span className="font-bold text-slate-800">{paymentModal.member.fullName}</span> ({formatFullClass(paymentModal.member.grade, paymentModal.member.classRoom)})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPaymentModal({ isOpen: false, member: null, targetWeekNum: selectedWeekNum })}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveModalPayment} className="space-y-3.5">
                
                {/* Target Period (Month & Week) */}
                <div className="p-2.5 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-between text-xs">
                  <span className="font-medium text-[#312E81]">Billing Period:</span>
                  <div className="text-right">
                    <span className="font-bold text-[#4338CA] bg-white px-2.5 py-1 rounded-lg border border-[#C7D2FE]">
                      {activeMonthObj.label} - Week {paymentModal.targetWeekNum}
                    </span>
                    {(() => {
                      const wInfo = monthWeeks.find((w) => w.weekNum === paymentModal.targetWeekNum);
                      return wInfo ? (
                        <div className="text-[10px] text-[#4338CA] font-medium mt-1">
                          Range: {wInfo.range}
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>

                {/* Nominal Input with Quick Presets */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Payment Amount (IDR)</label>
                    <span className="text-[11px] text-slate-400 font-medium">Standard: Rp 5,000 / week</span>
                  </div>
                  <input
                    type="number"
                    value={modalNominal}
                    onChange={(e) => setModalNominal(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#C7D2FE] rounded-xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:border-[#4338CA]"
                    required
                    min="1"
                  />
                  {/* Preset buttons */}
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {[
                      { val: 5000, label: 'Rp 5.000', badge: '1 Wk' },
                      { val: 10000, label: 'Rp 10.000', badge: '2 Wks' },
                      { val: 15000, label: 'Rp 15.000', badge: '3 Wks' },
                      { val: 20000, label: 'Rp 20.000', badge: '4 Wks (1 Mo)' },
                      { val: 25000, label: 'Rp 25.000', badge: '5 Wks' },
                    ].map((preset) => {
                      const isSelected = Number(modalNominal) === preset.val;
                      return (
                        <button
                          key={preset.val}
                          type="button"
                          onClick={() => setModalNominal(String(preset.val))}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-mono transition cursor-pointer flex items-center gap-1.5 border ${
                            isSelected
                              ? 'bg-[#4338CA] text-white font-bold border-[#4338CA] shadow-2xs'
                              : 'bg-[#EEF2FF] hover:bg-[#C7D2FE]/30 text-[#312E81] border-[#C7D2FE]'
                          }`}
                        >
                          <span>{preset.label}</span>
                          <span className={`text-[9px] px-1 py-0.2 rounded font-sans font-bold ${
                            isSelected ? 'bg-[#312E81] text-white' : 'bg-white text-[#312E81] border border-[#C7D2FE]'
                          }`}>
                            {preset.badge}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Multi-week automatic rollover and remainder notice */}
                  {(() => {
                    const nom = Number(modalNominal) || 0;
                    const std = standardNominal || 5000;
                    const numWeeks = Math.floor(nom / std);
                    const remainder = nom % std;
                    const startW = paymentModal.targetWeekNum;
                    const endW = Math.min(monthWeeks.length, startW + numWeeks - 1);
                    
                    if (numWeeks > 1) {
                      return (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span>Automatically Paid for {numWeeks} Weeks! (Multiples of {formatRupiah(std)})</span>
                          </div>
                          <p className="text-[11px] text-emerald-700 leading-relaxed">
                            Payment of <span className="font-bold">{formatRupiah(nom)}</span> covers 
                            <span className="font-bold"> Week {startW} through Week {endW}</span> ({activeMonthObj.label}).
                            {remainder > 0 ? (
                              <span className="block mt-1 text-amber-800 font-medium bg-amber-100/70 p-1.5 rounded-lg border border-amber-200/60">
                                ⚠️ Excess remainder of <span className="font-bold">{formatRupiah(remainder)}</span> does not reach the next interval ({formatRupiah(std * (numWeeks + 1))}), so <strong>Week {endW + 1} remains unpaid</strong>.
                              </span>
                            ) : null}
                          </p>
                        </div>
                      );
                    } else if (nom >= std && remainder > 0) {
                      return (
                        <div className="mt-2.5 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                          <div className="font-bold flex items-center gap-1.5 text-amber-900">
                            <Info className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>Paid 1 Week (Remainder {formatRupiah(remainder)})</span>
                          </div>
                          <p className="text-[11px] text-amber-700 leading-relaxed">
                            Payment of <span className="font-bold">{formatRupiah(nom)}</span> covers <span className="font-bold">Week {startW}</span>. Since weekly dues are <span className="font-bold">{formatRupiah(std)}</span>, <span className="font-bold">Week {startW + 1} remains unpaid</span> until reaching at least {formatRupiah(std * 2)}.
                          </p>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Payment Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={modalDate}
                    onChange={(e) => setModalDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600 cursor-pointer"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Description</label>
                  <input
                    type="text"
                    value={modalNote}
                    onChange={(e) => setModalNote(e.target.value)}
                    placeholder={`Club Dues ${activeMonthObj.label} - Week ${paymentModal.targetWeekNum}`}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:bg-white focus:border-blue-600"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  {canDeleteCash && paymentModal.currentTx ? (
                    <button
                      type="button"
                      id="cancel-from-payment-modal-btn"
                      onClick={() => {
                        if (paymentModal.member) {
                          handleCancelPayment(paymentModal.member, paymentModal.targetWeekNum);
                          setPaymentModal({ isOpen: false, member: null, targetWeekNum: selectedWeekNum });
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 text-rose-700 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs"
                      title="Delete / cancel this payment for correction"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete Payment (Correction)</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentModal({ isOpen: false, member: null, targetWeekNum: selectedWeekNum })}
                      className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    {canCreateCash && (
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-1 px-4 py-2 bg-[#4338CA] hover:bg-[#312E81] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{paymentModal.currentTx ? 'Save Changes' : 'Record Payment'}</span>
                      </button>
                    )}
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL: RIWAYAT & KOREKSI KAS SISWA (PER-ORANG)                           */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {memberHistoryModal.isOpen && memberHistoryModal.member && (() => {
          const mem = memberHistoryModal.member;
          const mNisn = (mem.nisn || '').trim();
          const mName = normStr(mem.fullName);
          const memberTxs = cash.filter((c) => {
            if (c.jenis !== 'Masuk') return false;
            const nisn = (c.nisn || '').trim();
            const name = normStr(c.namaAnggota || c.namaSiswa);
            return (mNisn && mNisn !== '-' && nisn === mNisn) || (mName && name === mName);
          });
          const totalCollected = memberTxs.reduce((sum, t) => sum + Number(t.jumlah || 0), 0);
          const isMale = isMaleMember(mem?.gender);

          return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-3">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="bg-white rounded-2xl max-w-lg w-full p-5 border border-[#C7D2FE] shadow-2xl space-y-4 max-h-[90vh] flex flex-col"
              >
                {/* Header Modal */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 ${
                      isMale ? 'bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE]' : 'bg-pink-100 text-pink-800 border border-pink-200'
                    }`}>
                      {mem.fullName.substring(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{mem.fullName}</span>
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        NISN: {mem.nisn || '-'} • Class: {formatFullClass(mem.grade, mem.classRoom)}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMemberHistoryModal({ isOpen: false, member: null })}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer transition"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Member Dues Summary */}
                <div className="p-3 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-between shrink-0">
                  <div>
                    <div className="text-[11px] font-semibold text-[#312E81] uppercase tracking-wider">
                      Total Dues Collected For This Member
                    </div>
                    <div className="text-base font-black text-[#4338CA] font-mono mt-0.5">
                      {formatRupiah(totalCollected)}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-white text-[#4338CA] border border-[#C7D2FE] shadow-2xs font-mono">
                      {memberTxs.length} transactions
                    </span>
                  </div>
                </div>

                {/* Member Transactions List */}
                <div className="flex-1 overflow-y-auto space-y-2 min-h-36">
                  <div className="text-xs font-bold text-slate-700 flex items-center justify-between px-0.5">
                    <span>Dues Payment History:</span>
                    <span className="text-[11px] font-normal text-slate-400">
                      (Click Delete to correct data if inaccurate)
                    </span>
                  </div>

                  {memberTxs.length === 0 ? (
                    <div className="py-10 text-center text-slate-400 bg-[#EEF2FF]/50 rounded-xl border border-dashed border-[#C7D2FE]">
                      <Receipt className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                      <p className="text-xs font-medium text-slate-500">
                        No dues payment records for this member yet.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-hidden border border-[#C7D2FE] rounded-xl">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-[#EEF2FF] border-b border-[#C7D2FE] text-[#312E81] font-bold text-[10px] uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Description / Period</th>
                            <th className="py-2.5 px-3 text-right">Amount</th>
                            <th className="py-2.5 px-3 text-center w-24">Correction Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {memberTxs.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-[#EEF2FF]/40 transition">
                              <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">
                                {formatIndonesianDate(t.tanggal)}
                              </td>
                              <td className="py-2.5 px-3 text-slate-800 font-medium">
                                {t.keterangan || 'Club Dues'}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700 whitespace-nowrap">
                                +{formatRupiah(t.jumlah)}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {canDeleteCash ? (
                                  <button
                                    type="button"
                                    id={`delete-single-member-tx-${t.id || idx}`}
                                    onClick={() => handleDeleteSingleMemberTx(t, mem)}
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 hover:border-rose-600 rounded-lg text-[11px] font-bold transition cursor-pointer active:scale-95 shadow-2xs disabled:opacity-50"
                                    title="Delete this transaction for correction"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                    <span>Delete</span>
                                  </button>
                                ) : (
                                  <span className="text-slate-300 text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Footer Modal */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100 shrink-0">
                  {canDeleteCash && memberTxs.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => handleDeleteMemberCashHistory(mem)}
                      disabled={isSubmitting}
                      className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-600 hover:text-white text-rose-700 border border-rose-200 hover:border-rose-600 rounded-xl text-xs font-bold transition cursor-pointer active:scale-95 shadow-2xs"
                      title={`Delete all ${memberTxs.length} dues records of ${mem.fullName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete All Dues For This Member ({memberTxs.length})</span>
                    </button>
                  ) : <div />}

                  <button
                    type="button"
                    onClick={() => setMemberHistoryModal({ isOpen: false, member: null })}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

      {/* Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <div 
            id="confirmCashModalOverlay"
            className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
          >
            <motion.div
              id="confirmCashModalBox"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center"
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto mb-3 ${
                confirmModal.confirmStyle === 'danger'
                  ? 'bg-rose-50 text-rose-600'
                  : confirmModal.confirmStyle === 'warning'
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-blue-50 text-blue-600'
              }`}>
                {confirmModal.confirmStyle === 'danger' ? (
                  <Trash2 className="w-6 h-6" />
                ) : confirmModal.confirmStyle === 'warning' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <CheckCircle2 className="w-6 h-6" />
                )}
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {confirmModal.title}
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed whitespace-pre-line">
                {confirmModal.message}
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  id="cancelCashConfirmBtn"
                  onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirmDeleteCashBtn"
                  onClick={async () => {
                    const action = confirmModal.onConfirm;
                    setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                    if (action) {
                      await action();
                    }
                  }}
                  className={`py-2.5 px-4 font-bold text-xs rounded-xl transition cursor-pointer shadow-sm text-white ${
                    confirmModal.confirmStyle === 'danger'
                      ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/25'
                      : confirmModal.confirmStyle === 'warning'
                        ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                        : 'bg-[#4338CA] hover:bg-[#312E81]'
                  }`}
                >
                  {confirmModal.confirmText || 'Yes, Delete'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Entire Cash History Typing Verification Modal (Leadership Gate) */}
      <AnimatePresence>
        {resetAllCashModalOpen && (
          <div 
            id="resetAllCashModalOverlay"
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => {
              setResetAllCashModalOpen(false);
              setResetAllCashInput('');
            }}
          >
            <motion.div
              id="resetAllCashModalBox"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 text-center relative overflow-hidden"
            >
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center mx-auto mb-4 shadow-2xs">
                <RotateCcw className="w-7 h-7" />
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-1">
                Reset Seluruh Buku Kas Ekskul?
              </h3>
              
              <div className="inline-block px-3 py-1 bg-rose-50 text-rose-800 rounded-lg text-xs font-bold mb-3 border border-rose-200">
                ⚠️ Akan menghapus seluruh {cash.length} transaksi pemasukan &amp; pengeluaran
              </div>

              <p className="text-xs text-slate-600 mb-4 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left">
                Tindakan ini akan <strong>menghapus seluruh pembukuan keuangan kas</strong> secara permanen dari basis data Supabase dan lokal. Saldo kas akan kembali menjadi <strong>Rp 0</strong> dan seluruh status iuran siswa akan di-reset menjadi Belum Bayar. Tindakan ini tidak dapat dibatalkan.
              </p>

              {/* Security Verification Input */}
              <div className="mb-5 text-left">
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Ketik frasa <span className="text-rose-600 font-mono font-black">RESET KAS</span> untuk mengonfirmasi:
                </label>
                <input
                  type="text"
                  value={resetAllCashInput}
                  onChange={(e) => setResetAllCashInput(e.target.value)}
                  placeholder="Ketik RESET KAS di sini..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs font-mono font-bold uppercase transition outline-none"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="cancelResetAllCashModalBtn"
                  onClick={() => {
                    setResetAllCashModalOpen(false);
                    setResetAllCashInput('');
                  }}
                  disabled={isSubmitting}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer disabled:opacity-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  id="confirmResetAllCashModalBtn"
                  onClick={async () => {
                    if (resetAllCashInput.trim().toUpperCase() !== 'RESET KAS') return;
                    setResetAllCashModalOpen(false);
                    setResetAllCashInput('');
                    if (onResetAllCash) {
                      await onResetAllCash();
                    }
                  }}
                  disabled={isSubmitting || resetAllCashInput.trim().toUpperCase() !== 'RESET KAS'}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Mereset Kas...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Ya, Reset Buku Kas</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Notice / Info Modal */}
      <AnimatePresence>
        {noticeModal.isOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-[#C7D2FE] text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#EEF2FF] text-[#4338CA] border border-[#C7D2FE] flex items-center justify-center mx-auto mb-3">
                <Info className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                {noticeModal.title}
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed whitespace-pre-line">
                {noticeModal.message}
              </p>
              <button
                type="button"
                onClick={() => setNoticeModal({ isOpen: false, title: '', message: '' })}
                className="w-full py-2.5 px-4 bg-[#4338CA] hover:bg-[#312E81] text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* CSV / Excel Universal Import Modal for Cash */}
      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        defaultTarget="cash"
        existingMembers={members}
        existingCash={cash}
        isDemo={isDemo}
        onCashSuccess={(count, updated) => {
          if (onCashUpdated) {
            onCashUpdated(updated);
          }
          if (onRefreshData) {
            onRefreshData();
          }
        }}
      />

    </motion.div>
  );
};
