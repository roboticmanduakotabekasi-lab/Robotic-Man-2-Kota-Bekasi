import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, 
  UserPlus, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  Phone, 
  Users, 
  X,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  FileText,
  FileSpreadsheet,
  RefreshCw,
  Filter,
  CheckCircle2,
  AlertCircle,
  GraduationCap,
  Sparkles,
  Clock,
  ArrowUpRight,
  ShieldCheck,
  MoreVertical,
  MapPin,
  TrendingUp,
  List,
  Calendar,
  UserCheck,
  Wallet,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  MessageSquare,
  CheckSquare,
  Square,
  Upload,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, AttendanceRecord, UserSession } from '../types';
import { exportToCsv, formatWhatsAppNumber, formatMemberTimestamp } from '../utils/formatters';
import { exportMembersListPdf } from '../utils/pdfExport';
import { ImportCsvModal } from './ImportCsvModal';
import { playClickTick, playSuccessChime } from '../utils/audioFeedback';
import { hasPermission, getRoleMetadata, isExecutiveOrAdvisor, formatTitleLabel, canViewSensitiveStudentData } from '../utils/rbac';

interface MembersTabProps {
  members: Member[];
  initialSearchTerm?: string;
  attendanceHistory?: AttendanceRecord[];
  isDemo?: boolean;
  onOpenAddModal: () => void;
  onOpenEditModal: (member: Member) => void;
  onOpenDetailModal: (member: Member) => void;
  onDeleteMember: (nisn: string) => void;
  onResetDefaultMembers?: () => void;
  onClearAllMembers?: () => void;
  onMembersUpdated?: (updatedMembers: Member[]) => void;
  onRefreshData?: () => Promise<void> | void;
  isSyncing?: boolean;
  currentAcademicYear?: string;
  isAcademicYearAuto?: boolean;
  onOpenDateAcademicModal?: (initialTab?: 'date' | 'academic') => void;
  onUpdateMemberStatus?: (nisn: string, newStatus: 'Aktif' | 'Keluar' | 'Alumni') => void;
  currentUserRole?: string;
  session?: UserSession | null;
}

// Utility functions for robust gender & grade normalization
export const isMaleMember = (gender?: string | any): boolean => {
  if (!gender) return false;
  const raw = typeof gender === 'object' ? (gender.gender || '') : String(gender || '');
  if (!raw) return false;
  const g = raw.toLowerCase().trim();
  return g === 'male' || g === 'laki-laki' || g === 'laki - laki' || g === 'laki' || g === 'l' || g === 'pria';
};

export const isFemaleMember = (gender?: string | any): boolean => {
  if (!gender) return false;
  const raw = typeof gender === 'object' ? (gender.gender || '') : String(gender || '');
  if (!raw) return false;
  const g = raw.toLowerCase().trim();
  return g === 'female' || g === 'perempuan' || g === 'p' || g === 'wanita';
};

export const normalizeGrade = (grade?: string): string => {
  if (!grade) return '';
  const clean = grade.toUpperCase().trim();
  if (clean === 'XII' || clean === '12' || clean.startsWith('XII') || clean.includes('DUA BELAS')) return 'XII';
  if (clean === 'XI' || clean === '11' || clean.startsWith('XI') || clean.includes('SEBELAS')) return 'XI';
  if (clean === 'X' || clean === '10' || clean.startsWith('X') || clean.includes('SEPULUH')) return 'X';
  return clean;
};

export const formatFullClass = (grade?: string, classRoom?: string): string => {
  const normGrade = normalizeGrade(grade) || (grade ? grade.toUpperCase().trim() : '');
  const cleanRoom = (classRoom || '').trim().toUpperCase();

  if (!cleanRoom && !normGrade) return '-';
  if (!cleanRoom) return `Kelas ${normGrade}`;
  if (!normGrade) return cleanRoom;

  // If cleanRoom already has X/XI/XII prefix (e.g., "X-H", "X H", "XI D", "XII IPA 1")
  if (
    cleanRoom.startsWith('XII ') || 
    cleanRoom.startsWith('XII-') ||
    cleanRoom === 'XII' ||
    cleanRoom.startsWith('XI ') || 
    cleanRoom.startsWith('XI-') ||
    cleanRoom === 'XI' ||
    cleanRoom.startsWith('X ') || 
    cleanRoom.startsWith('X-') ||
    cleanRoom === 'X'
  ) {
    return cleanRoom;
  }

  return `${normGrade} - ${cleanRoom}`;
};

export const MembersTab: React.FC<MembersTabProps> = ({
  members,
  initialSearchTerm = '',
  attendanceHistory,
  isDemo = false,
  onOpenAddModal,
  onOpenEditModal,
  onOpenDetailModal,
  onDeleteMember,
  onResetDefaultMembers,
  onClearAllMembers,
  onMembersUpdated,
  onRefreshData,
  isSyncing = false,
  currentAcademicYear = '2026/2027',
  isAcademicYearAuto = true,
  onOpenDateAcademicModal,
  onUpdateMemberStatus,
  currentUserRole,
  session,
}) => {
  // RBAC Permission checks
  const canCreateMember = hasPermission(currentUserRole, 'members:create');
  const canEditMember = hasPermission(currentUserRole, 'members:edit');
  const canDeleteMember = hasPermission(currentUserRole, 'members:delete');
  const canImportMember = hasPermission(currentUserRole, 'members:import');
  const roleMeta = getRoleMetadata(currentUserRole);

  const [searchTerm, setSearchTerm] = useState<string>(initialSearchTerm);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [selectedGrade, setSelectedGrade] = useState<string>('ALL');
  const [selectedGender, setSelectedGender] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<'ALL' | 'EXECUTIVE' | 'MEMBER'>('ALL');
  const [statusDropdownNisn, setStatusDropdownNisn] = useState<string | null>(null);
  const [memberToDelete, setMemberToDelete] = useState<Member | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isConfirmingClearAll, setIsConfirmingClearAll] = useState<boolean>(false);
  const [clearAllConfirmationInput, setClearAllConfirmationInput] = useState<string>('');
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(5);
  const [isFilterExpanded, setIsFilterExpanded] = useState<boolean>(false);
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState<boolean>(false);
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Sorting & Multi-select states
  type SortField = 'code' | 'name' | 'class' | 'status' | 'date';
  type SortOrder = 'asc' | 'desc';

  const [sortField, setSortField] = useState<SortField>('code');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [selectedNisns, setSelectedNisns] = useState<Set<string>>(new Set());
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [filterProfileStatus, setFilterProfileStatus] = useState<'ALL' | 'ACTIVE' | 'PENDING'>('ALL');

  const handleQuickStatusChange = (member: Member, newStatus: 'Aktif' | 'Keluar' | 'Alumni', e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!canEditMember) return;
    playClickTick();
    setStatusDropdownNisn(null);
    setActiveActionMenuId(null);
    if (onUpdateMemberStatus) {
      onUpdateMemberStatus(member.nisn, newStatus);
    } else if (onOpenEditModal) {
      onOpenEditModal({ ...member, status: newStatus });
    }
  };

  const handleSort = (field: SortField) => {
    playClickTick();
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const handleCopyText = (text: string, key: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!text || text === '-') return;
    navigator.clipboard.writeText(text);
    playClickTick();
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey((prev) => (prev === key ? null : prev));
    }, 1600);
  };

  // Keyboard shortcut to focus search input (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (((e.ctrlKey && e.key === 'k') || (e.metaKey && e.key === 'k')) && document.activeElement !== searchInputRef.current) {
        if ((e.target as HTMLElement)?.tagName !== 'INPUT' && (e.target as HTMLElement)?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          searchInputRef.current?.focus();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close menus when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dropdown-container]')) {
        setIsExportDropdownOpen(false);
        setActiveActionMenuId(null);
        setIsFilterExpanded(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleToggleGrade = (grade: string) => {
    playClickTick();
    setSelectedGrade((prev) => (prev === grade ? 'ALL' : grade));
    setCurrentPage(1);
  };

  const handleToggleGender = (gender: string) => {
    playClickTick();
    setSelectedGender((prev) => (prev === gender ? 'ALL' : gender));
    setCurrentPage(1);
  };

  const handleResetFilters = () => {
    playClickTick();
    setSelectedGrade('ALL');
    setSelectedGender('ALL');
    setSelectedStatus('ALL');
    setSearchTerm('');
    setCurrentPage(1);
  };

  // Statistics & Insights
  const stats = useMemo(() => {
    const total = members.length;
    const gradeX = members.filter((m) => normalizeGrade(m.grade) === 'X').length;
    const gradeXI = members.filter((m) => normalizeGrade(m.grade) === 'XI').length;
    const gradeXII = members.filter((m) => normalizeGrade(m.grade) === 'XII').length;
    const male = members.filter((m) => isMaleMember(m.gender)).length;
    const female = members.filter((m) => isFemaleMember(m.gender)).length;
    const aktif = members.filter((m) => (m.status || 'Aktif') === 'Aktif').length;
    const keluar = members.filter((m) => m.status === 'Keluar').length;
    const alumni = members.filter((m) => m.status === 'Alumni').length;
    const withPhone = members.filter((m) => m.personalPhone && m.personalPhone.trim().length >= 8).length;
    const withNisn = members.filter((m) => m.nisn && m.nisn.trim().length >= 5).length;
    const withNik = members.filter((m) => m.nik && m.nik.trim().length >= 5).length;
    const completeProfile = members.filter(
      (m) => m.nisn && m.personalPhone && m.address && m.classRoom
    ).length;
    const execCount = members.filter((m) => isExecutiveOrAdvisor(m.role, m.jabatan)).length;
    const generalMemberCount = members.filter((m) => !isExecutiveOrAdvisor(m.role, m.jabatan)).length;

    return { 
      total, 
      gradeX, 
      gradeXI, 
      gradeXII, 
      male, 
      female,
      aktif,
      keluar,
      alumni,
      withPhone,
      withNisn,
      withNik,
      completeProfile,
      execCount,
      generalMemberCount
    };
  }, [members]);

  // Breakdown distribution per class group for analytics panel
  const classBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    members.forEach((m) => {
      const label = formatFullClass(m.grade, m.classRoom);
      map[label] = (map[label] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [members]);

  // 4 recently added / updated members
  const recentMembers = useMemo(() => {
    return [...members].reverse().slice(0, 4);
  }, [members]);

  // Filtered members list
  const filteredMembers = useMemo(() => {
    const list = members.filter((m) => {
      const search = searchTerm.toLowerCase().trim();
      const fullName = (m.fullName || (m as any).full_name || '').toLowerCase();
      const nisn = (m.nisn || '').toLowerCase();
      const nik = (m.nik || '').toLowerCase();
      const email = (m.email || '').toLowerCase();
      const personalPhone = (m.personalPhone || '').toLowerCase();
      const parentPhone = (m.parentPhone || '').toLowerCase();
      const address = (m.address || '').toLowerCase();
      const classRoom = (m.classRoom || '').toLowerCase();
      const grade = (m.grade || '').toLowerCase();
      const fullClass = formatFullClass(m.grade, m.classRoom).toLowerCase();
      const rawCode = m.id_member ? `rob-${m.id_member}` : '';
      const formattedCode = m.id_member ? `rob-${String(m.id_member).padStart(5, '0')}` : '';

      const matchSearch =
        !search ||
        fullName.includes(search) ||
        nisn.includes(search) ||
        nik.includes(search) ||
        email.includes(search) ||
        personalPhone.includes(search) ||
        parentPhone.includes(search) ||
        address.includes(search) ||
        classRoom.includes(search) ||
        grade.includes(search) ||
        fullClass.includes(search) ||
        rawCode.includes(search) ||
        formattedCode.includes(search);

      const matchGrade =
        selectedGrade === 'ALL' ||
        normalizeGrade(m.grade) === normalizeGrade(selectedGrade) ||
        m.grade === selectedGrade;

      let matchGender = true;
      if (selectedGender === 'Laki-laki' || selectedGender === 'Male') {
        matchGender = isMaleMember(m.gender);
      } else if (selectedGender === 'Perempuan' || selectedGender === 'Female') {
        matchGender = isFemaleMember(m.gender);
      } else if (selectedGender !== 'ALL') {
        matchGender = m.gender === selectedGender;
      }

      const matchStatus =
        selectedStatus === 'ALL' ||
        (m.status || 'Aktif') === selectedStatus;

      const isExec = isExecutiveOrAdvisor(m.role, m.jabatan);
      const matchCategory =
        selectedCategory === 'ALL' ||
        (selectedCategory === 'EXECUTIVE' && isExec) ||
        (selectedCategory === 'MEMBER' && !isExec);

      return matchSearch && matchGrade && matchGender && matchStatus && matchCategory;
    });

    return [...list].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';
      if (sortField === 'name') {
        valA = (a.fullName || '').toLowerCase();
        valB = (b.fullName || '').toLowerCase();
      } else if (sortField === 'class') {
        valA = formatFullClass(a.grade, a.classRoom).toLowerCase();
        valB = formatFullClass(b.grade, b.classRoom).toLowerCase();
      } else if (sortField === 'status') {
        valA = (a.status || 'Aktif').toLowerCase();
        valB = (b.status || 'Aktif').toLowerCase();
      } else if (sortField === 'date') {
        valA = a.timestamp || '';
        valB = b.timestamp || '';
      } else {
        // default 'code'
        valA = a.id_member || 0;
        valB = b.id_member || 0;
      }
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, searchTerm, selectedGrade, selectedGender, selectedStatus, selectedCategory, sortField, sortOrder]);

  const handleExportCsv = () => {
    const formattedData = filteredMembers.map((m, idx) => ({
      'No': idx + 1,
      'Nama Lengkap': m.fullName,
      'NISN': m.nisn,
      'NIK': m.nik || '-',
      'Jenjang': normalizeGrade(m.grade) || m.grade,
      'Kelas': formatFullClass(m.grade, m.classRoom),
      'Status': m.status || 'Aktif',
      'Role': m.role || 'member',
      'Jabatan': m.jabatan || 'member',
      'Tanggal Lahir': m.birthDate || '-',
      'Jenis Kelamin': isFemaleMember(m.gender) ? 'Perempuan' : 'Laki-laki',
      'Email': m.email || '-',
      'No HP Pribadi': m.personalPhone || '-',
      'No HP Orang Tua': m.parentPhone || '-',
      'Alamat': m.address || '-',
      'Waktu Daftar': m.timestamp || '-'
    }));
    exportToCsv('daftar_anggota_robotik_man2.csv', formattedData);
  };

  const handleExportPdf = () => {
    exportMembersListPdf({
      members: filteredMembers,
      filterGrade: selectedGrade,
      filterGender: selectedGender,
    });
  };

  // Pagination calculations
  const effectivePageSize = pageSize === 0 ? filteredMembers.length : pageSize;
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / (effectivePageSize || 1)));

  // Auto-clamp currentPage if filtered list count is smaller than current page
  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedMembers = useMemo(() => {
    if (pageSize === 0) return filteredMembers;
    const validPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (validPage - 1) * pageSize;
    return filteredMembers.slice(startIndex, startIndex + pageSize);
  }, [filteredMembers, currentPage, pageSize, totalPages]);

  const startIndex = (currentPage - 1) * (pageSize === 0 ? filteredMembers.length : pageSize);
  const startEntry = filteredMembers.length === 0 ? 0 : startIndex + 1;
  const endEntry = pageSize === 0 ? filteredMembers.length : Math.min(startIndex + pageSize, filteredMembers.length);

  return (
    <div className="space-y-5 w-full">
      
      {/* Top Header Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1">
        <div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Member Directory • Robotic MAN 2 Kota Bekasi
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Official member roster, attendance overview, and leadership designation management.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            id="academicYearSelectBtn"
            onClick={() => {
              playClickTick();
              onOpenDateAcademicModal?.('academic');
            }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs cursor-pointer transition active:scale-95 group"
            title="Click to change Academic Year or set to automatic (real-time)"
          >
            <Calendar className="w-3.5 h-3.5 text-[#2563EB]" />
            <span>Academic Year {currentAcademicYear}</span>
            {isAcademicYearAuto ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" title="Automatic Mode (Real-time)" />
            ) : (
              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 shrink-0">
                Custom
              </span>
            )}
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 transition shrink-0" />
          </button>
        </div>
      </div>

      {/* RBAC Read-Only Notice Banner */}
      {!canCreateMember && (
        <div className="p-3.5 bg-amber-50/90 border border-amber-200/90 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-amber-950 shadow-2xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold">Directory Review Mode (Read-Only RBAC):</span>
              <span className="text-amber-800 ml-1">
                Your account as <strong>{roleMeta.label}</strong> is in view-only mode. Adding, editing, and deleting student records is managed by <strong>President</strong>, <strong>Faculty Advisor</strong>, or <strong>Executive Board</strong>.
              </span>
            </div>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/80 text-amber-900 border border-amber-300 uppercase tracking-wide shrink-0">
            Limited Access
          </span>
        </div>
      )}

      {/* 4 Interactive Executive Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        {/* CARD 1: TOTAL MEMBERS */}
        <div 
          onClick={handleResetFilters}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between cursor-pointer group"
          title="Click to reset filters & display all members"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB] shrink-0 group-hover:scale-105 transition">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100">
              All Students
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-slate-500 block">Total Members</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight mt-0.5 block">
              {stats.total.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between min-w-0 gap-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 font-semibold text-emerald-600 min-w-0 truncate">
              <TrendingUp className="w-3.5 h-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">{stats.aktif} Active</span>
            </div>
            <span className="font-medium text-slate-400 shrink-0">Total</span>
          </div>
        </div>

        {/* CARD 2: EXECUTIVE BOARD & ADVISOR */}
        <div 
          onClick={() => {
            playClickTick();
            setSelectedCategory('EXECUTIVE');
            setCurrentPage(1);
          }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-amber-200/80 shadow-2xs hover:shadow-xs transition flex flex-col justify-between cursor-pointer group hover:border-amber-400"
          title="Click to view Executive Board & Advisors"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-700 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              Leadership
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-slate-500 block truncate">Executive Board</span>
            <span className="text-2xl sm:text-3xl font-black text-amber-700 font-mono tracking-tight mt-0.5 block">
              {stats.execCount.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between min-w-0 gap-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 font-semibold text-amber-700 min-w-0 truncate">
              <span className="truncate">Officers</span>
            </div>
            <span className="font-medium text-slate-400 shrink-0">Appointed</span>
          </div>
        </div>

        {/* CARD 3: GENERAL MEMBERS */}
        <div 
          onClick={() => {
            playClickTick();
            setSelectedCategory('MEMBER');
            setCurrentPage(1);
          }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between cursor-pointer group hover:border-blue-400"
          title="Click to view General Members"
        >
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
              <UserCheck className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
              General Roster
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-slate-500 block truncate">Club Members</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight mt-0.5 block">
              {stats.generalMemberCount.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between min-w-0 gap-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 font-semibold text-emerald-600 min-w-0 truncate">
              <span className="truncate">Students</span>
            </div>
            <span className="font-medium text-slate-400 shrink-0">Regular</span>
          </div>
        </div>

        {/* CARD 4: COMPLETE PROFILES */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-2xs hover:shadow-xs transition flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div className="w-11 h-11 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
              Verified
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xs font-semibold text-slate-500 block truncate">Verified Profiles</span>
            <span className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight mt-0.5 block">
              {stats.completeProfile.toLocaleString()}
            </span>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between min-w-0 gap-1.5 text-[11px] text-slate-500">
            <div className="flex items-center gap-1 font-semibold text-purple-600 min-w-0 truncate">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">Contact &amp; Bio</span>
            </div>
            <span className="font-medium text-slate-400 shrink-0">Verified</span>
          </div>
        </div>
      </div>

      {/* Main Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden w-full">
        
        {/* Success Banner after CSV Import */}
        {importSuccessMsg && (
          <div className="p-3 bg-emerald-50 border-b border-emerald-200 text-emerald-800 flex items-center justify-between text-xs font-semibold animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{importSuccessMsg}</span>
            </div>
            <button
              type="button"
              onClick={() => setImportSuccessMsg(null)}
              className="text-emerald-600 hover:text-emerald-800 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Card Header with Category Switcher Tabs */}
        <div className="p-4 sm:px-6 py-4 flex flex-col gap-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center font-bold">
                <List className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 leading-tight">Member Directory • Robotic MAN 2 Kota Bekasi</h3>
                <p className="text-[11px] text-slate-400 font-medium leading-none mt-0.5">
                  Official club roster &amp; membership management
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap" data-dropdown-container>
              {/* Filter Toggle Button with Dropdown Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterExpanded(!isFilterExpanded)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition shadow-2xs cursor-pointer ${
                    isFilterExpanded || selectedGrade !== 'ALL' || selectedGender !== 'ALL' || selectedCategory !== 'ALL'
                      ? 'bg-blue-50 border-blue-200 text-[#2563EB]'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Filters</span>
                  {(selectedGrade !== 'ALL' || selectedGender !== 'ALL' || selectedCategory !== 'ALL') && (
                    <span className="w-4 h-4 rounded-full bg-[#2563EB] text-white text-[10px] font-bold flex items-center justify-center">
                      {(selectedGrade !== 'ALL' ? 1 : 0) + (selectedGender !== 'ALL' ? 1 : 0) + (selectedCategory !== 'ALL' ? 1 : 0)}
                    </span>
                  )}
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isFilterExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Filter Dropdown Popover */}
                {isFilterExpanded && (
                  <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1.5 w-72 bg-white rounded-2xl border border-slate-200 shadow-xl p-4 z-30 space-y-3.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-[#2563EB]" />
                        Filter Members
                      </span>
                      {(selectedGrade !== 'ALL' || selectedGender !== 'ALL' || selectedStatus !== 'ALL' || selectedCategory !== 'ALL') && (
                        <button
                          type="button"
                          onClick={handleResetFilters}
                          className="text-[11px] font-semibold text-rose-600 hover:underline cursor-pointer"
                        >
                          Reset
                        </button>
                      )}
                    </div>

                    {/* Filter Category */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                        Role Category
                      </label>
                      <div className="grid grid-cols-1 gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            playClickTick();
                            setSelectedCategory('ALL');
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border text-left ${
                            selectedCategory === 'ALL'
                              ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          All Members ({stats.total})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClickTick();
                            setSelectedCategory('EXECUTIVE');
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border text-left ${
                            selectedCategory === 'EXECUTIVE'
                              ? 'bg-amber-400 text-slate-950 border-amber-400 font-black'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          Executive Board &amp; Advisor ({stats.execCount})
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            playClickTick();
                            setSelectedCategory('MEMBER');
                            setCurrentPage(1);
                          }}
                          className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border text-left ${
                            selectedCategory === 'MEMBER'
                              ? 'bg-[#2563EB] text-white border-[#2563EB] font-bold'
                              : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          👤 General Members ({stats.generalMemberCount})
                        </button>
                      </div>
                    </div>

                    {/* Filter Status Anggota */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                        Membership Status
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['ALL', 'Aktif', 'Keluar', 'Alumni'] as const).map((st) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => {
                              playClickTick();
                              setSelectedStatus(st);
                              setCurrentPage(1);
                            }}
                            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border text-center ${
                              selectedStatus === st
                                ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-2xs font-bold'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {st === 'ALL' ? 'All Statuses' : st === 'Aktif' ? 'Active' : st === 'Keluar' ? 'Resigned' : 'Alumni'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter Tingkat Kelas */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                        Grade Level
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {(['ALL', 'X', 'XI', 'XII'] as const).map((grade) => (
                          <button
                            key={grade}
                            type="button"
                            onClick={() => handleToggleGrade(grade)}
                            className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border text-center ${
                              selectedGrade === grade
                                ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-2xs font-bold'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {grade === 'ALL' ? 'All Grades' : `Grade ${grade}`}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Filter Gender */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1.5 block">
                        Gender
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(['ALL', 'Laki-laki', 'Perempuan'] as const).map((gender) => (
                          <button
                            key={gender}
                            type="button"
                            onClick={() => handleToggleGender(gender)}
                            className={`px-2 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer border text-center ${
                              selectedGender === gender
                                ? 'bg-[#2563EB] text-white border-[#2563EB] shadow-2xs font-bold'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {gender === 'ALL' ? 'All' : gender === 'Laki-laki' ? 'Male' : 'Female'}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-medium text-slate-600">{filteredMembers.length} matching students</span>
                      <button
                        type="button"
                        onClick={() => setIsFilterExpanded(false)}
                        className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition cursor-pointer text-xs"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Add Member (Solid Blue Button) */}
              {canCreateMember && (
                <button
                  id="addNewMemberBtn"
                  type="button"
                  onClick={onOpenAddModal}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#2563EB] hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer active:scale-95"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Add Student</span>
                </button>
              )}

              {/* Upload CSV */}
              {canImportMember && (
                <button
                  id="openUploadCsvMembersBtn"
                  type="button"
                  onClick={() => setIsImportModalOpen(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#EEF2FF] hover:bg-blue-100 border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#4338CA] shadow-2xs transition cursor-pointer active:scale-95"
                  title="Upload CSV roster file"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload CSV</span>
                </button>
              )}

              {/* Reset Roster (Strictly gated to Primary Administrator / President) */}
              {(currentUserRole === 'admin' || session?.role === 'admin' || session?.jabatan === 'president') && (
                <button
                  id="openResetMembersModalBtn"
                  type="button"
                  onClick={() => {
                    playClickTick();
                    setIsConfirmingClearAll(false);
                    setClearAllConfirmationInput('');
                    setIsResetModalOpen(true);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 shadow-2xs transition cursor-pointer active:scale-95"
                  title="Reset robotics member database"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                  <span>Reset Roster</span>
                </button>
              )}

              {/* Export Dropdown Button */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-2xs transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Export</span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {isExportDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1.5 w-52 bg-white rounded-xl border border-slate-200 shadow-lg p-1.5 z-30 space-y-1 animate-in fade-in zoom-in-95 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportDropdownOpen(false);
                        handleExportPdf();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5 text-slate-500" />
                      <span>Export Official PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsExportDropdownOpen(false);
                        handleExportCsv();
                      }}
                      className="w-full text-left px-3 py-2 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100 flex items-center gap-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                      <span>Export CSV (Excel)</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Explicit Category Switcher Tabs: Separating Executive Board & Advisor and Member */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl overflow-x-auto w-fit max-w-full">
            <button
              type="button"
              onClick={() => {
                playClickTick();
                setSelectedCategory('ALL');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer whitespace-nowrap ${
                selectedCategory === 'ALL'
                  ? 'bg-white text-blue-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Members ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => {
                playClickTick();
                setSelectedCategory('EXECUTIVE');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === 'EXECUTIVE'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Executive Board &amp; Advisor ({stats.execCount})</span>
            </button>
            <button
              type="button"
              onClick={() => {
                playClickTick();
                setSelectedCategory('MEMBER');
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 whitespace-nowrap ${
                selectedCategory === 'MEMBER'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>👤 General Members ({stats.generalMemberCount})</span>
            </button>
          </div>
        </div>

        {/* Search Bar & Quick Controls Bar */}
        <div className="p-3.5 sm:px-6 bg-slate-50/60 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Search Input Container */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="memberSearchInput"
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search members (full name, NISN, class, NIK, WhatsApp, address, or ID)..."
              className="w-full pl-9.5 pr-9 py-2 bg-white border border-slate-200 focus:border-[#2563EB] rounded-xl text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/15 transition shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Results Count & Refresh Button */}
          <div className="flex items-center justify-between sm:justify-end gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">
              {filteredMembers.length} <span className="font-normal text-slate-500">of {members.length} members</span>
            </span>
            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isSyncing}
                className="p-2 bg-white border border-slate-200 text-slate-500 hover:text-slate-800 rounded-xl transition cursor-pointer shadow-2xs ml-1"
                title="Refresh table data from database"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-blue-600' : ''}`} />
              </button>
            )}
          </div>
        </div>

        {/* Active Filter & Search Indicators Bar */}
        {(selectedGrade !== 'ALL' || selectedGender !== 'ALL' || selectedStatus !== 'ALL' || searchTerm) && (
          <div className="px-4 sm:px-6 py-2.5 bg-blue-50/40 border-b border-blue-100 flex items-center justify-between gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Active Filters:</span>

              {/* Active Search Term Chip */}
              {searchTerm && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 text-[#2563EB] text-xs font-semibold rounded-xl shadow-2xs">
                  <span>Search: "{searchTerm}"</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchTerm('');
                      setCurrentPage(1);
                    }}
                    className="hover:text-blue-900 cursor-pointer"
                    title="Clear search"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Active Status Filter Chip */}
              {selectedStatus !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 text-[#2563EB] text-xs font-semibold rounded-xl shadow-2xs">
                  <span>Status: {selectedStatus === 'Aktif' ? 'Active' : selectedStatus === 'Keluar' ? 'Resigned' : selectedStatus}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedStatus('ALL');
                      setCurrentPage(1);
                    }}
                    className="hover:text-blue-900 cursor-pointer"
                    title="Clear status filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Active Grade Filter Chip */}
              {selectedGrade !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 text-[#2563EB] text-xs font-semibold rounded-xl shadow-2xs">
                  <span>Grade {selectedGrade}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleGrade(selectedGrade)}
                    className="hover:text-blue-900 cursor-pointer"
                    title="Clear grade filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Active Gender Filter Chip */}
              {selectedGender !== 'ALL' && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-blue-200 text-[#2563EB] text-xs font-semibold rounded-xl shadow-2xs">
                  <span>{selectedGender === 'Laki-laki' ? 'Male' : selectedGender === 'Perempuan' ? 'Female' : selectedGender}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleGender(selectedGender)}
                    className="hover:text-blue-900 cursor-pointer"
                    title="Clear gender filter"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              )}

              {/* Reset All Filters Button */}
              <button
                type="button"
                onClick={handleResetFilters}
                className="p-1 px-2 bg-white border border-slate-200 text-slate-500 hover:text-rose-600 rounded-lg transition cursor-pointer shadow-2xs text-[11px] flex items-center gap-1 font-semibold ml-1"
                title="Reset All Filters &amp; Search"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset All</span>
              </button>
            </div>
          </div>
        )}

        {/* Table View */}
        {filteredMembers.length === 0 ? (
          <div className="bg-slate-50/50 p-12 text-center">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-blue-50 text-[#2563EB] border border-blue-100 flex items-center justify-center mb-3">
              <Users className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              No matching member records found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto mb-3">
              {searchTerm
                ? `No member data found matching "${searchTerm}". Please check spelling of name, NISN, class, or student ID.`
                : 'Try adjusting search keywords or clearing class and gender filters.'}
            </p>
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-[#2563EB] text-xs font-bold transition cursor-pointer shadow-2xs"
            >
              Reset Filters &amp; Search
            </button>
          </div>
        ) : (
          <>
            {/* MOBILE VIEW: Cards for Mobile Viewports (< 768px) with zero cut-off */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedMembers.map((member, index) => {
                const cleanPersonalPhone = formatWhatsAppNumber(member.personalPhone);
                const formattedCode = member.id_member 
                  ? `ROB-${member.id_member}`
                  : `ROB-${String(startIndex + index + 1).padStart(5, '0')}`;
                const currentStatus = (member.status || 'Aktif') as 'Aktif' | 'Keluar' | 'Alumni';

                return (
                  <div
                    key={member.nisn || index}
                    onClick={() => onOpenDetailModal(member)}
                    className="p-4 hover:bg-blue-50/30 transition duration-150 cursor-pointer space-y-2.5"
                  >
                    {/* Top Row: Avatar, Name, Code, WA */}
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] font-bold text-sm flex items-center justify-center shrink-0 shadow-2xs">
                          {member.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 text-sm hover:text-[#2563EB] transition truncate">
                            {member.fullName}
                          </h4>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="font-mono text-[11px] font-bold text-[#2563EB]">
                              {formattedCode}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              NISN: {member.nisn}
                            </span>
                          </div>
                        </div>
                      </div>

                      {member.personalPhone && (
                        <a
                          href={`https://wa.me/${cleanPersonalPhone}?text=Halo%20${encodeURIComponent(member.fullName)}%2C%20dari%20Pengurus%20Robotic%20MAN%202%20Kota%20Bekasi`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="p-2 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-600 transition shrink-0 shadow-2xs"
                          title="Hubungi via WhatsApp"
                        >
                          <Phone className="w-4 h-4 shrink-0" />
                        </a>
                      )}
                    </div>

                    {/* Middle Row: Kelas Badge (shrink-0 + whitespace-nowrap) & Status Dropdown */}
                    <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                      {/* Kelas Badge with GraduationCap */}
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-50 border border-indigo-200/80 text-indigo-800 text-xs font-bold shrink-0 max-w-full">
                        <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                        <span className="whitespace-nowrap truncate">{formatFullClass(member.grade, member.classRoom)}</span>
                      </div>

                      {/* Interactive Status Selector Dropdown */}
                      <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                        {canEditMember ? (
                          <button
                            type="button"
                            onClick={() => {
                              playClickTick();
                              setStatusDropdownNisn(statusDropdownNisn === member.nisn ? null : member.nisn);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition cursor-pointer active:scale-95 shadow-2xs ${
                              currentStatus === 'Keluar'
                                ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                : currentStatus === 'Alumni'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            }`}
                            title="Click to change member status"
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              currentStatus === 'Keluar' ? 'bg-rose-500' : currentStatus === 'Alumni' ? 'bg-purple-500' : 'bg-emerald-500'
                            }`} />
                            <span>{currentStatus === 'Aktif' ? 'Active' : currentStatus === 'Keluar' ? 'Resigned' : currentStatus}</span>
                            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                          </button>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border cursor-default select-none shadow-2xs ${
                              currentStatus === 'Keluar'
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : currentStatus === 'Alumni'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                            title={`Member Status: ${currentStatus === 'Aktif' ? 'Active' : currentStatus === 'Keluar' ? 'Resigned' : currentStatus}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                              currentStatus === 'Keluar' ? 'bg-rose-500' : currentStatus === 'Alumni' ? 'bg-purple-500' : 'bg-emerald-500'
                            }`} />
                            <span>{currentStatus === 'Aktif' ? 'Active' : currentStatus === 'Keluar' ? 'Resigned' : currentStatus}</span>
                          </span>
                        )}

                        {canEditMember && statusDropdownNisn === member.nisn && (
                          <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-xl border border-slate-200 shadow-xl p-1 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-left">
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(member, 'Aktif')}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                currentStatus === 'Aktif' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                              <span>Active</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(member, 'Keluar')}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                currentStatus === 'Keluar' ? 'bg-rose-50 text-rose-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                              <span>Resigned</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleQuickStatusChange(member, 'Alumni')}
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                currentStatus === 'Alumni' ? 'bg-purple-50 text-purple-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                              <span>Alumni</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Actions Row */}
                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs" onClick={(e) => e.stopPropagation()}>
                      <span className="text-[11px] text-slate-400 truncate max-w-[170px]">
                        {member.address || 'Kota Bekasi'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onOpenDetailModal(member)}
                          className="px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:text-blue-600 bg-slate-50 hover:bg-blue-50 border border-slate-200 rounded-lg transition cursor-pointer"
                        >
                          Detail
                        </button>
                        {canEditMember && (
                          <button
                            type="button"
                            onClick={() => onOpenEditModal(member)}
                            className="px-2.5 py-1 text-[11px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition cursor-pointer"
                          >
                            Edit
                          </button>
                        )}
                        {canDeleteMember && (
                          <button
                            type="button"
                            onClick={() => setMemberToDelete(member)}
                            className="p-1 text-rose-500 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg transition cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* DESKTOP TABLE VIEW: For Tablets and Desktop (>= 768px) */}
            <div className="hidden md:block overflow-x-auto w-full">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500 font-bold text-[11px] uppercase tracking-wider bg-[#F8FAFC]">
                    <th 
                      className="py-3 px-4 w-32 cursor-pointer hover:bg-slate-100/80 transition select-none" 
                      onClick={() => handleSort('code')}
                      title="Sort by student code"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>STUDENT CODE</span>
                        {sortField === 'code' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#2563EB]" /> : <ArrowDown className="w-3 h-3 text-[#2563EB]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-4 min-w-[200px] cursor-pointer hover:bg-slate-100/80 transition select-none" 
                      onClick={() => handleSort('name')}
                      title="Sort by member name"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>MEMBER NAME</span>
                        {sortField === 'name' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#2563EB]" /> : <ArrowDown className="w-3 h-3 text-[#2563EB]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-4 min-w-[150px] cursor-pointer hover:bg-slate-100/80 transition select-none" 
                      onClick={() => handleSort('class')}
                      title="Sort by class"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>CLASS & GRADE</span>
                        {sortField === 'class' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#2563EB]" /> : <ArrowDown className="w-3 h-3 text-[#2563EB]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 min-w-[140px]">WHATSAPP CONTACT</th>
                    <th 
                      className="py-3 px-4 min-w-[130px] cursor-pointer hover:bg-slate-100/80 transition select-none" 
                      onClick={() => handleSort('status')}
                      title="Sort by status"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>STATUS</span>
                        {sortField === 'status' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#2563EB]" /> : <ArrowDown className="w-3 h-3 text-[#2563EB]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="py-3 px-4 min-w-[140px] cursor-pointer hover:bg-slate-100/80 transition select-none" 
                      onClick={() => handleSort('date')}
                      title="Sort by registration date"
                    >
                      <div className="flex items-center gap-1.5">
                        <span>JOIN DATE</span>
                        {sortField === 'date' ? (
                          sortOrder === 'asc' ? <ArrowUp className="w-3 h-3 text-[#2563EB]" /> : <ArrowDown className="w-3 h-3 text-[#2563EB]" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-400" />
                        )}
                      </div>
                    </th>
                    <th className="py-3 px-4 text-right w-20">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {paginatedMembers.map((member, index) => {
                    const cleanPersonalPhone = formatWhatsAppNumber(member.personalPhone);
                    const formattedCode = member.id_member 
                      ? `ROB-${member.id_member}`
                      : `ROB-${String(startIndex + index + 1).padStart(5, '0')}`;
                    const currentStatus = (member.status || 'Aktif') as 'Aktif' | 'Keluar' | 'Alumni';

                    const { date: formattedDate, time: formattedTime } = formatMemberTimestamp(member.timestamp);

                    return (
                      <tr 
                        key={member.nisn || index} 
                        onClick={() => onOpenDetailModal(member)}
                        className="hover:bg-blue-50/40 transition duration-150 group cursor-pointer"
                      >
                        {/* KODE SISWA (ROB-xxxxx) */}
                        <td className="py-3.5 px-4 font-mono font-bold text-xs">
                          <button
                            type="button"
                            onClick={() => onOpenDetailModal(member)}
                            className="text-[#2563EB] hover:underline cursor-pointer font-mono"
                          >
                            {formattedCode}
                          </button>
                          <div className="text-[10px] text-slate-400 font-mono font-normal mt-0.5 flex flex-wrap items-center gap-1">
                            <span>NISN: {member.nisn}</span>
                            {member.birthDate && (
                              canViewSensitiveStudentData(session, member) ? (
                                <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200" title={`Tgl Lahir: ${member.birthDate}`}>
                                  📅 {member.birthDate}
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200" title="Kredensial siswa terlindungi (sensor)">
                                  🔒 Terverifikasi
                                </span>
                              )
                            )}
                          </div>
                        </td>

                        {/* NAMA ANGGOTA */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 text-[#2563EB] font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs">
                              {member.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 max-w-[220px]">
                              <button
                                type="button"
                                onClick={() => onOpenDetailModal(member)}
                                className="font-bold text-slate-900 hover:text-[#2563EB] transition text-xs block text-left truncate cursor-pointer"
                                title={member.fullName}
                              >
                                {member.fullName}
                              </button>
                              <div className="text-[11px] text-slate-400 font-normal mt-0.5 truncate">
                                {member.email || `${member.fullName.toLowerCase().replace(/\s+/g, '.')}@man2.sch.id`}
                              </div>
                              {member.jabatan && member.jabatan !== 'member' && (
                                <span className="text-[10px] font-semibold text-slate-700 block mt-0.5">
                                  {formatTitleLabel(member.jabatan)}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* KELAS & DOMISILI with shrink-0 icon */}
                        <td className="py-3.5 px-4">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-indigo-50 border border-indigo-200/80 text-indigo-800 text-xs font-bold shrink-0">
                            <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span className="whitespace-nowrap">{formatFullClass(member.grade, member.classRoom)}</span>
                          </div>
                          <span className="text-[10px] text-slate-400 block mt-1 truncate max-w-[160px]">
                            {member.address || 'Kota Bekasi, Jawa Barat'}
                          </span>
                        </td>

                        {/* KONTAK WA */}
                        <td className="py-3.5 px-4">
                          {member.personalPhone ? (
                            <a
                              href={`https://wa.me/${cleanPersonalPhone}?text=Halo%20${encodeURIComponent(member.fullName)}%2C%20dari%20Pengurus%20Robotic%20MAN%202%20Kota%20Bekasi`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 text-xs font-mono font-medium transition"
                              title="Contact Member via WhatsApp"
                            >
                              <Phone className="w-3 h-3 text-emerald-600 shrink-0" />
                              <span>{member.personalPhone}</span>
                            </a>
                          ) : (
                            <span className="text-slate-400 italic text-xs">-</span>
                          )}
                        </td>

                        {/* STATUS KEAKTIFAN (Interactive dropdown selector) */}
                        <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                          <div className="relative inline-block text-left">
                            {canEditMember ? (
                              <button
                                type="button"
                                onClick={() => {
                                  playClickTick();
                                  setStatusDropdownNisn(statusDropdownNisn === member.nisn ? null : member.nisn);
                                }}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer hover:shadow-xs active:scale-95 ${
                                  currentStatus === 'Keluar'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100'
                                    : currentStatus === 'Alumni'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                }`}
                                title="Click to change membership status"
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  currentStatus === 'Keluar' ? 'bg-rose-500' : currentStatus === 'Alumni' ? 'bg-purple-500' : 'bg-emerald-500'
                                }`} />
                                <span>{currentStatus === 'Aktif' ? 'Active' : currentStatus === 'Keluar' ? 'Resigned' : currentStatus}</span>
                                <ChevronDown className="w-3 h-3 opacity-60 shrink-0" />
                              </button>
                            ) : (
                              <span
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border cursor-default select-none ${
                                  currentStatus === 'Keluar'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : currentStatus === 'Alumni'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                                title={`Member Status: ${currentStatus === 'Aktif' ? 'Active' : currentStatus === 'Keluar' ? 'Resigned' : currentStatus}`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                  currentStatus === 'Keluar' ? 'bg-rose-500' : currentStatus === 'Alumni' ? 'bg-purple-500' : 'bg-emerald-500'
                                }`} />
                                <span>{currentStatus === 'Aktif' ? 'Active' : currentStatus === 'Keluar' ? 'Resigned' : currentStatus}</span>
                              </span>
                            )}

                            {canEditMember && statusDropdownNisn === member.nisn && (
                              <div className="absolute left-0 top-full mt-1 w-32 bg-white rounded-xl border border-slate-200 shadow-xl p-1 z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-100 text-left">
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(member, 'Aktif')}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    currentStatus === 'Aktif' ? 'bg-emerald-50 text-emerald-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                  <span>Active</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(member, 'Keluar')}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    currentStatus === 'Keluar' ? 'bg-rose-50 text-rose-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                                  <span>Resigned</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleQuickStatusChange(member, 'Alumni')}
                                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                                    currentStatus === 'Alumni' ? 'bg-purple-50 text-purple-800 font-bold' : 'text-slate-700 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                                  <span>Alumni</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* TANGGAL DAFTAR */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 text-xs">
                            {formattedDate}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                            {formattedTime}
                          </div>
                        </td>

                        {/* AKSI */}
                        <td className="py-3.5 px-4 text-right" data-dropdown-container>
                          <div className="relative inline-block text-left">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveActionMenuId(activeActionMenuId === member.nisn ? null : member.nisn);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                              title="Actions Menu"
                            >
                              <MoreVertical className="w-4 h-4" />
                            </button>

                            {activeActionMenuId === member.nisn && (
                              <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-xl border border-slate-200 shadow-lg p-1 z-30 space-y-0.5 text-left animate-in fade-in zoom-in-95 duration-100">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveActionMenuId(null);
                                    onOpenDetailModal(member);
                                  }}
                                  className="w-full px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View Details</span>
                                </button>
                                {canEditMember && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveActionMenuId(null);
                                      onOpenEditModal(member);
                                    }}
                                    className="w-full px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-lg flex items-center gap-2 cursor-pointer"
                                  >
                                    <Edit className="w-3.5 h-3.5 text-slate-400" />
                                    <span>Edit Member</span>
                                  </button>
                                )}

                                {canEditMember && (
                                  <div className="border-t border-slate-100 my-1 pt-1">
                                    <div className="px-2 py-0.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                                      Change Status:
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickStatusChange(member, 'Aktif')}
                                      className="w-full px-2.5 py-1 text-xs text-emerald-700 hover:bg-emerald-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                      <span>Set Active</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickStatusChange(member, 'Keluar')}
                                      className="w-full px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                      <span>Set Resigned</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleQuickStatusChange(member, 'Alumni')}
                                      className="w-full px-2.5 py-1 text-xs text-purple-700 hover:bg-purple-50 rounded-lg flex items-center gap-1.5 cursor-pointer"
                                    >
                                      <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                                      <span>Set Alumni</span>
                                    </button>
                                  </div>
                                )}

                                {canDeleteMember && (
                                  <div className="border-t border-slate-100 my-1 pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveActionMenuId(null);
                                        setMemberToDelete(member);
                                      }}
                                      className="w-full px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg flex items-center gap-2 cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                      <span>Delete</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Table Footer: Pagination Bar - Exact match to screenshot */}
        {filteredMembers.length > 0 && (
          <div className="p-4 sm:px-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-white">
            {/* Left: Showing 1 to 5 of 30 entries */}
            <div className="font-medium text-slate-500">
              Showing <span className="font-bold text-slate-800">{startEntry}</span> to{' '}
              <span className="font-bold text-slate-800">{endEntry}</span> of{' '}
              <span className="font-bold text-slate-800">{filteredMembers.length}</span> entries
            </div>

            {/* Center: Pagination numbers */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .map((page, idx, arr) => {
                  const prev = arr[idx - 1];
                  const hasGap = prev && page - prev > 1;
                  return (
                    <React.Fragment key={page}>
                      {hasGap && <span className="px-1 text-slate-300">...</span>}
                      <button
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg font-bold text-xs transition cursor-pointer ${
                          currentPage === page
                            ? 'bg-[#2563EB] text-white shadow-2xs'
                            : 'border border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 rounded-lg border border-slate-200 flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 disabled:pointer-events-none transition cursor-pointer"
                title="Halaman Selanjutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Right: Rows per page selector */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-medium">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-white focus:outline-none focus:border-[#2563EB] cursor-pointer shadow-2xs"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={0}>Semua</option>
              </select>
            </div>
          </div>
        )}

      </div>

      {/* 3 Executive Summary & Insights Panels below Table - 100% Full Width */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
        
        {/* PANEL 1: Classroom Breakdown */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#4338CA] shrink-0 shadow-2xs">
                  <GraduationCap className="w-4 h-4 shrink-0" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-900 truncate">Classroom Breakdown</h4>
                  <p className="text-[10px] text-slate-400 font-medium truncate">Student distribution per class</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-[#4338CA] bg-[#EEF2FF] px-2 py-0.5 rounded-full border border-[#C7D2FE] shrink-0 whitespace-nowrap ml-1">
                {classBreakdown.length} Classes
              </span>
            </div>

            <div className="space-y-2.5 mt-3">
              {classBreakdown.map((item) => {
                const percentage = stats.total > 0 ? Math.round((item.count / stats.total) * 100) : 0;
                return (
                  <div 
                    key={item.name}
                    onClick={() => setSearchTerm(item.name)}
                    className="group cursor-pointer p-1.5 rounded-xl hover:bg-[#EEF2FF]/60 transition"
                    title={`Click to filter by ${item.name}`}
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-bold text-slate-700 group-hover:text-[#4338CA] transition">
                        {item.name}
                      </span>
                      <span className="text-[11px] font-mono text-slate-500 font-semibold">
                        {item.count} members <span className="text-slate-400 font-normal">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${percentage}%` }} 
                        className="bg-[#2563EB] h-full rounded-full group-hover:bg-[#1D4ED8] transition-all"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          <div className="mt-3 pt-2.5 border-t border-slate-100 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Classroom data from directory roster</span>
            <span className="font-semibold text-[#2563EB]">MAN 2 Kota Bekasi</span>
          </div>
        </div>

        {/* PANEL 2: Recent Members */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#EEF2FF] border border-[#C7D2FE] flex items-center justify-center text-[#4338CA]">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Recent Members</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Students enrolled in club system</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                Verified
              </span>
            </div>

            <div className="divide-y divide-slate-100 mt-1">
              {recentMembers.map((member) => (
                <div 
                  key={member.nisn}
                  onClick={() => onOpenDetailModal(member)}
                  className="py-2 flex items-center justify-between hover:bg-[#EEF2FF]/40 rounded-xl px-2 transition cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#EEF2FF] border border-[#C7D2FE] text-[#4338CA] font-bold text-[11px] flex items-center justify-center shrink-0">
                      {member.fullName.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#4338CA] transition">
                        {member.fullName}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {formatFullClass(member.grade, member.classRoom)} • NISN {member.nisn}
                      </div>
                    </div>
                  </div>
                  <Eye className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#4338CA] shrink-0" />
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-400 text-[10px]">Click student for full profile</span>
            <button
              type="button"
              onClick={onOpenAddModal}
              className="text-[#2563EB] font-bold text-[11px] hover:underline flex items-center gap-0.5 cursor-pointer"
            >
              + Add Member
            </button>
          </div>
        </div>

        {/* PANEL 3: Document Center & Export */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-2xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2563EB]">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-900">Document Center &amp; Export</h4>
                  <p className="text-[10px] text-slate-400 font-medium">Quick administrative actions &amp; reports</p>
                </div>
              </div>
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>

            <div className="grid grid-cols-2 gap-2.5 mt-3">
              <button
                type="button"
                onClick={handleExportPdf}
                className="p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-left transition cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-lg bg-white border border-rose-200 text-rose-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition shadow-2xs">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-rose-900 leading-tight">Print PDF</div>
                <div className="text-[9px] text-rose-600/80 mt-0.5">Full Member Roster</div>
              </button>

              <button
                type="button"
                onClick={handleExportCsv}
                className="p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-left transition cursor-pointer group"
              >
                <div className="w-6 h-6 rounded-lg bg-white border border-emerald-200 text-emerald-600 flex items-center justify-center mb-1.5 group-hover:scale-105 transition shadow-2xs">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                </div>
                <div className="text-[11px] font-bold text-emerald-900 leading-tight">Export CSV</div>
                <div className="text-[9px] text-emerald-600/80 mt-0.5">Excel Master Directory</div>
              </button>
            </div>

            <div className="mt-3 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[11px] font-bold text-slate-800">Data Backup &amp; Sync</div>
                <div className="text-[9px] text-slate-500">Cloud synchronization active</div>
              </div>
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-[#2563EB] text-[10px] font-bold hover:bg-[#2563EB] hover:text-white transition shadow-2xs cursor-pointer"
              >
                Import CSV
              </button>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
            <span>Standard Club Master Directory Format</span>
            <span className="text-[#2563EB] font-semibold">v2.4 Ready</span>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {memberToDelete && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl border border-slate-200 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-900 mb-1">
                Delete Member?
              </h3>
              <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                Are you sure you want to permanently delete member{' '}
                <strong className="text-slate-800">{memberToDelete.fullName}</strong> (NISN: {memberToDelete.nisn})?
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setMemberToDelete(null)}
                  className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteMember(memberToDelete.nisn);
                    setMemberToDelete(null);
                  }}
                  className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm shadow-rose-600/25"
                >
                  Delete Member
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Reset Data Confirmation Modal */}
      <AnimatePresence>
        {isResetModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 text-left relative"
            >
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="absolute top-5 right-5 p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {!isConfirmingClearAll ? (
                <>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                      <RotateCcw className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Reset Direktori Anggota MAN 2 Kota Bekasi
                      </h3>
                      <p className="text-xs text-slate-500">
                        Pilih opsi reset data sesuai kebutuhan organisasi
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 mb-5">
                    {/* Option 1: Reset to Starter Template */}
                    <div 
                      onClick={() => {
                        playSuccessChime();
                        onResetDefaultMembers?.();
                        setIsResetModalOpen(false);
                      }}
                      className="p-3.5 rounded-2xl border border-slate-200 hover:border-[#2563EB] hover:bg-blue-50/40 transition cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#2563EB] flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 group-hover:scale-105 transition">
                          35
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-slate-900 group-hover:text-[#2563EB] transition">
                            Reset ke Template Awal (35 Siswa)
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Mengembalikan direktori anggota secara aman ke data awal 35 anggota ekskul.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Option 2: Clear All Member Records (Opens Typing Verification) */}
                    <div 
                      onClick={() => {
                        playClickTick();
                        setIsConfirmingClearAll(true);
                        setClearAllConfirmationInput('');
                      }}
                      className="p-3.5 rounded-2xl border border-rose-200 hover:border-rose-400 hover:bg-rose-50/40 transition cursor-pointer group"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 group-hover:scale-105 transition">
                          <Trash2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1">
                          <div className="text-xs font-bold text-rose-700">
                            Hapus Seluruh Data Siswa ({members.length} Anggota)
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Mengosongkan seluruh tabel untuk persiapan impor CSV bersih. Memerlukan verifikasi pengetikan teks manual.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setIsResetModalOpen(false)}
                      className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Tutup
                    </button>
                  </div>
                </>
              ) : (
                /* Step 2: Destructive Typing Verification Screen */
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 border border-rose-200 flex items-center justify-center shrink-0 shadow-2xs">
                      <ShieldAlert className="w-6 h-6 text-rose-600" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900">
                        Konfirmasi Hapus Seluruh Siswa
                      </h3>
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 inline-block mt-0.5">
                        ⚠️ Tindakan Tidak Dapat Dibatalkan
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 mb-4 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-left">
                    Anda akan <strong>menghapus seluruh {members.length} data siswa</strong> dari sistem direktori, database Supabase, dan penyimpanan lokal. Data yang terhapus tidak dapat dikembalikan.
                  </p>

                  <div className="mb-5 text-left">
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Ketik kata <span className="text-rose-600 font-mono font-black">HAPUS</span> untuk mengaktifkan tombol:
                    </label>
                    <input
                      type="text"
                      value={clearAllConfirmationInput}
                      onChange={(e) => setClearAllConfirmationInput(e.target.value)}
                      placeholder="Ketik HAPUS di sini..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:border-rose-500 focus:ring-2 focus:ring-rose-200 text-xs font-mono font-bold uppercase transition outline-none"
                      autoFocus
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsConfirmingClearAll(false);
                        setClearAllConfirmationInput('');
                      }}
                      className="py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (clearAllConfirmationInput.trim().toUpperCase() !== 'HAPUS') return;
                        playClickTick();
                        onClearAllMembers?.();
                        setIsResetModalOpen(false);
                        setIsConfirmingClearAll(false);
                        setClearAllConfirmationInput('');
                      }}
                      disabled={clearAllConfirmationInput.trim().toUpperCase() !== 'HAPUS'}
                      className="py-2.5 px-4 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hapus Seluruh Data Sekarang</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Import CSV Modal */}
      <ImportCsvModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        existingMembers={members}
        isDemo={isDemo}
        onSuccess={(count, updatedMembers) => {
          setImportSuccessMsg(
            isDemo
              ? `Successfully imported ${count} students into demo session (saved locally)!`
              : `Successfully imported & saved ${count} students!`
          );
          if (onMembersUpdated) {
            onMembersUpdated(updatedMembers);
          }
          if (onRefreshData) {
            onRefreshData();
          }
        }}
      />

    </div>
  );
};
