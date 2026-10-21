import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  Users, 
  CalendarCheck, 
  Wallet, 
  CheckCircle2, 
  AlertCircle, 
  Database, 
  LogOut, 
  X, 
  Sparkles, 
  ArrowRight, 
  CalendarDays, 
  Calendar, 
  Bell, 
  ChevronDown, 
  Maximize, 
  Minimize, 
  PanelLeftClose, 
  PanelLeftOpen, 
  Compass, 
  Bot, 
  ShieldCheck, 
  ShieldAlert,
  Building2,
  Plus,
  KeyRound,
  Copy,
  Layers,
  Check,
  ArrowLeft,
  Settings,
  School,
  UploadCloud,
  BookOpen,
  MessageSquare,
  Megaphone,
  LayoutDashboard
} from 'lucide-react';
import { playClickTick, playSuccessChime } from './utils/audioFeedback';
import { downloadTextFile } from './utils/formatters';
import { Member, AttendanceRecord, CashTransaction, UserSession, AppNotification, Announcement, MainTabType } from './types';
import { INITIAL_MEMBERS, INITIAL_ATTENDANCE, INITIAL_CASH, INITIAL_ASSIGNMENTS } from './data/initialData';
import { motion, AnimatePresence } from 'motion/react';

// Supabase services
import { getSupabase } from './lib/supabase';
import { 
  fetchAllSupabaseData, 
  upsertMemberToDB, 
  deleteMemberFromDB, 
  upsertAttendanceToDB, 
  bulkUpsertAttendanceToDB, 
  deleteAttendanceFromDB, 
  deleteAttendanceByMemberAndDate, 
  deleteAttendanceByDate, 
  deleteAllAttendanceFromDB, 
  upsertCashToDB, 
  bulkUpsertCashToDB, 
  deleteCashFromDB, 
  deleteMultipleCashFromDB, 
  deleteAllMembersCashFromDB, 
  deleteAllCashFromDB, 
  deleteCashByMemberAndPeriod, 
  syncAllLocalDataToSupabase, 
  mapMemberFromDB, 
  mapAttendanceFromDB, 
  mapCashFromDB, 
  deduplicateAttendance, 
  sanitizeRealName,
  fetchAnnouncementsFromDB,
  createAnnouncementInDB,
  deleteAnnouncementInDB,
  fetchMaterialsAssignmentsFromDB
} from './services/supabaseService';

// Components
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { MobileHeader } from './components/MobileHeader';
import { MobileBottomNav } from './components/MobileBottomNav';
import { LoginView } from './components/LoginView';
import { ProfileSettingsModal } from './components/ProfileSettingsModal';
import { saveCustomAccounts, addOrUpdateAccount } from './utils/authConfig';
import { MembersTab } from './components/MembersTab';
import { AttendanceTab } from './components/AttendanceTab';
import { CashTab } from './components/CashTab';
import { CalendarTab } from './components/CalendarTab';
import { MemberFormModal } from './components/MemberFormModal';
import { MemberDetailModal } from './components/MemberDetailModal';
import { SupabaseSetupModal } from './components/SupabaseSetupModal';
import { DateTimeConfigModal } from './components/DateTimeConfigModal';
import { NotificationModal } from './components/NotificationModal';
import { RoleManagementModal } from './components/RoleManagementModal';
import { StudentAssignmentsView } from './components/StudentAssignmentsView';
import { AdminPreRegistrationModal } from './components/AdminPreRegistrationModal';
import { AnnouncementsModal } from './components/AnnouncementsModal';
import { AdminTasksGradingView } from './components/AdminTasksGradingView';
import { AdminDashboardOverview } from './components/AdminDashboardOverview';
import { AdminRouteGuard } from './components/AdminRouteGuard';
import { MemberAttendanceView } from './components/MemberAttendanceView';
import { 
  AppRole, 
  normalizeRole, 
  getRoleMetadata, 
  ROLE_DEFINITIONS, 
  hasPermission, 
  isExecutiveRole,
  canViewJoinCode,
  isRoomCreator,
  isExecutiveOrAdvisor,
  formatTitleLabel,
  getCanonicalRole,
  canManageAnnouncements,
  hasSessionPermission,
  maskNik,
  maskParentPhone
} from './utils/rbac';

// Sistem Manajemen Ekstrakurikuler Robotic MAN 2 Kota Bekasi Store & Modals
import { 
  Organization, 
  getUserOrganizations, 
  saveUserOrganizations, 
  getActiveOrganizationId, 
  setActiveOrganizationId, 
  DEFAULT_ORGANIZATIONS,
  registerKnownOrganization,
  updateKnownOrganization
} from './utils/organizerStore';
import { EditOrganizationModal } from './components/EditOrganizationModal';
import { StudentVerificationModal } from './components/StudentVerificationModal';
import { UniversalDataUploadModal } from './components/UniversalDataUploadModal';
import { AppFooter } from './components/AppFooter';

const INITIAL_SEED_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notif-welcome',
    title: 'Robotics Management Active',
    message: 'Welcome to roboticman2kotabekasi. Member directory, meeting attendance, and club treasury books are live and synchronized.',
    type: 'success',
    category: 'system',
    timestamp: new Date().toISOString(),
    isRead: false,
    linkTab: 'members'
  },
  {
    id: 'notif-sync',
    title: 'Unified Synchronization',
    message: 'All attendance records, club dues, and student profiles synchronize seamlessly across devices.',
    type: 'info',
    category: 'system',
    timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    isRead: false
  },
  {
    id: 'notif-academic',
    title: 'Academic Calendar Active',
    message: 'Academic year 2026/2027 is active. Customize workshop schedules and dates anytime via the calendar icon.',
    type: 'info',
    category: 'attendance',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    isRead: true,
    linkTab: 'calendar'
  }
];
import { 
  DateAcademicConfig, 
  getInitialDateAcademicConfig, 
  saveDateAcademicConfigToStorage, 
  calculateAutoAcademicYear,
  formatCompactDate
} from './utils/dateAcademicConfig';
import { ThemeColor, THEMES, getStoredTheme, saveStoredTheme } from './utils/theme';

export default function App() {
  // Session authentication state (Dipersistensi aman agar pengguna tidak ter-logout saat refresh/tutup tab)
  const [session, setSession] = useState<UserSession | null>(() => {
    try {
      const saved = localStorage.getItem('robotics_auth') || localStorage.getItem('robotics_saved_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.username) {
          return parsed;
        }
      }
      return null;
    } catch {
      return null;
    }
  });

  // Sinkronisasi otomatis session ke localStorage setiap kali state session berubah
  useEffect(() => {
    if (session) {
      try {
        localStorage.setItem('robotics_auth', JSON.stringify(session));
        localStorage.setItem('robotics_saved_session', JSON.stringify(session));
      } catch (e) {
        console.warn('Failed to save login session:', e);
      }
    }
  }, [session]);

  // Strict Role Escalation Prevention: Sanitize session state and revert forged roles
  useEffect(() => {
    if (session) {
      const canonical = getCanonicalRole(session);
      if (canonical === 'member') {
        const cleanRole = (session.role || '').toLowerCase();
        if (cleanRole === 'admin' || cleanRole.includes('admin') || cleanRole === 'executive_board' || cleanRole.includes('executive')) {
          console.warn('[Security Guard] Unauthorized role escalation attempt detected. Reverting to member.');
          const sanitized: UserSession = {
            ...session,
            role: 'member',
            membershipStatus: 'aktif',
            jabatan: 'member',
          };
          setSession(sanitized);
          localStorage.setItem('robotics_auth', JSON.stringify(sanitized));
        }
      }
    }
  }, [session]);

  // Visual Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeColor>(() => getStoredTheme());

  const handleThemeChange = (newTheme: ThemeColor) => {
    setCurrentTheme(newTheme);
    saveStoredTheme(newTheme);
  };

  // Navigation / Modal states
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);
  const [isRoleManagementOpen, setIsRoleManagementOpen] = useState(false);

  // New Admin Feature Modals
  const [isPreRegistrationOpen, setIsPreRegistrationOpen] = useState(false);
  const [isUniversalUploadOpen, setIsUniversalUploadOpen] = useState(false);
  const [isAnnouncementsOpen, setIsAnnouncementsOpen] = useState(false);
  const [assignmentsCount, setAssignmentsCount] = useState<number>(() => {
    return INITIAL_ASSIGNMENTS.filter(m => m.type === 'assignment').length;
  });

  // Keep assignments count synchronized across sidebar, navbar, and mobile navigation
  useEffect(() => {
    let isMounted = true;
    const syncCount = async () => {
      try {
        const mats = await fetchMaterialsAssignmentsFromDB();
        if (!isMounted) return;
        if (mats && mats.length > 0) {
          setAssignmentsCount(mats.filter(m => m.type === 'assignment').length);
        } else {
          setAssignmentsCount(INITIAL_ASSIGNMENTS.filter(m => m.type === 'assignment').length);
        }
      } catch {
        if (isMounted) setAssignmentsCount(INITIAL_ASSIGNMENTS.filter(m => m.type === 'assignment').length);
      }
    };
    syncCount();

    const handleUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ count?: number }>;
      if (custom.detail && typeof custom.detail.count === 'number') {
        setAssignmentsCount(custom.detail.count);
      } else {
        syncCount();
      }
    };

    window.addEventListener('robotics_assignments_updated', handleUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('robotics_assignments_updated', handleUpdate);
    };
  }, []);

  // Check Supabase session on mount & subscribe to auth state changes
  useEffect(() => {
    let isMounted = true;
    const supa = getSupabase();

    const checkSupabaseSession = async () => {
      try {
        const { data: { session: supaSession } } = await supa.auth.getSession();
        if (supaSession?.user && isMounted) {
          const { data: profile } = await supa
            .from('profiles')
            .select('*')
            .eq('id', supaSession.user.id)
            .maybeSingle();

          const userEmail = supaSession.user.email || profile?.email || '';
          const userFullName = profile?.full_name || supaSession.user.user_metadata?.full_name || supaSession.user.user_metadata?.name || userEmail.split('@')[0];
          const rawRole = profile?.role || 'member';
          const userStatus = profile?.status_keanggotaan || 'aktif';
          const isExec = userStatus === 'executive_board' || rawRole === 'executive_board' || (profile?.jabatan && ['president', 'vice_president', 'secretary', 'treasurer', 'pr'].includes(profile.jabatan));
          const userRole = isExec ? 'executive_board' : rawRole;
          const userJabatan = profile?.jabatan || (isExec ? 'vice_president' : 'member');

          const activeSess: UserSession = {
            username: userEmail.split('@')[0],
            name: userFullName,
            role: userRole,
            email: userEmail,
            authProvider: 'google',
            userId: supaSession.user.id,
            avatarUrl: profile?.avatar_url || supaSession.user.user_metadata?.avatar_url || supaSession.user.user_metadata?.picture,
            loginTime: new Date().toISOString(),
            isGoogleAuth: true,
            membershipStatus: isExec ? 'executive_board' : userStatus,
            jabatan: userJabatan,
            bypassNisnVerification: isExec,
            nis: profile?.nis || '',
            kelas: profile?.kelas || '',
            noHp: profile?.no_hp || '',
            kontakDarurat: profile?.kontak_darurat || '',
            pendingApproval: userStatus === 'pending_approval'
          };

          setSession(activeSess);
          localStorage.setItem('robotics_auth', JSON.stringify(activeSess));
        }
      } catch (err) {
        console.warn('Error reading Supabase session on mount:', err);
      }
    };

    checkSupabaseSession();

    const { data: { subscription } } = supa.auth.onAuthStateChange(async (event, newSupaSession) => {
      if (event === 'SIGNED_IN' && newSupaSession?.user && isMounted) {
        const { data: profile } = await supa
          .from('profiles')
          .select('*')
          .eq('id', newSupaSession.user.id)
          .maybeSingle();

        const userEmail = newSupaSession.user.email || profile?.email || '';
        const userFullName = profile?.full_name || newSupaSession.user.user_metadata?.full_name || userEmail.split('@')[0];
        const rawRole = profile?.role || 'member';
        const userStatus = profile?.status_keanggotaan || 'aktif';
        const isExec = userStatus === 'executive_board' || rawRole === 'executive_board' || (profile?.jabatan && ['president', 'vice_president', 'secretary', 'treasurer', 'pr'].includes(profile.jabatan));
        const userRole = isExec ? 'executive_board' : rawRole;
        const userJabatan = profile?.jabatan || (isExec ? 'vice_president' : 'member');

        const activeSess: UserSession = {
          username: userEmail.split('@')[0],
          name: userFullName,
          role: userRole,
          email: userEmail,
          authProvider: 'google',
          userId: newSupaSession.user.id,
          avatarUrl: profile?.avatar_url || newSupaSession.user.user_metadata?.avatar_url,
          loginTime: new Date().toISOString(),
          isGoogleAuth: true,
          membershipStatus: isExec ? 'executive_board' : userStatus,
          jabatan: userJabatan,
          bypassNisnVerification: isExec,
          nis: profile?.nis || '',
          kelas: profile?.kelas || '',
          noHp: profile?.no_hp || '',
          kontakDarurat: profile?.kontak_darurat || '',
          pendingApproval: userStatus === 'pending_approval'
        };

        setSession(activeSess);
        localStorage.setItem('robotics_auth', JSON.stringify(activeSess));
        showToast(`Welcome, ${userFullName}! Signed in as ${isExec || userRole === 'admin' ? 'Executive Board / Officer' : 'Club Member'}.`, 'success');
      } else if (event === 'SIGNED_OUT' && isMounted) {
        // PERBAIKAN: Hanya bersihkan sesi jika akun login saat ini adalah otentikasi Google Supabase!
        // Jangan pernah me-logout pengguna yang login via Kredensial / ENV Admin / Password / Demo
        try {
          const currentSaved = localStorage.getItem('robotics_auth') || localStorage.getItem('robotics_saved_session');
          if (currentSaved) {
            const parsed = JSON.parse(currentSaved);
            if (parsed && (parsed.authProvider === 'google' || parsed.isGoogleAuth)) {
              setSession(null);
              localStorage.removeItem('robotics_auth');
              localStorage.removeItem('robotics_saved_session');
            }
          }
        } catch {
          // Tetap pertahankan sesi jika terjadi kesalahan baca JSON
        }
      }
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Instantly switch session role for testing / RBAC verification (Gated for admin only)
  const handleSessionRoleSwitch = (newRoleKey: AppRole) => {
    if (!session) return;
    if (canonicalRole !== 'admin') {
      showToast('Akses ditolak: Hanya Administrator Utama yang berwenang mengganti role sesi.', 'error');
      return;
    }

    const roleDef = ROLE_DEFINITIONS[newRoleKey];
    const updated: UserSession = {
      ...session,
      role: roleDef.label
    };
    setSession(updated);
    try {
      localStorage.setItem('robotics_auth', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to update local session storage:', e);
    }
    showToast(`Session role switched to: ${roleDef.label} (${roleDef.permissions.length} permissions)`, 'info');
  };

  // Active Tab: 'dashboard' | 'members' | 'attendance' | 'cash' | 'calendar' | 'assignments'
  const [activeTab, setActiveTab] = useState<MainTabType>('dashboard');
  const [activeAttendanceDate, setActiveAttendanceDate] = useState<string | undefined>(undefined);
  const [activeCashMonthKey, setActiveCashMonthKey] = useState<string | undefined>(undefined);

  // Strictly align navigation tabs with logged-in user canonical role ('admin' | 'executive_board' | 'advisor' | 'member')
  const canonicalRole = getCanonicalRole(session);
  useEffect(() => {
    if (canonicalRole === 'member' && (activeTab === 'dashboard' || activeTab === 'members' || activeTab === 'cash')) {
      setActiveTab('calendar');
    }
  }, [canonicalRole, activeTab]);

  // Announcements State for Official Club Broadcasts
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  useEffect(() => {
    fetchAnnouncementsFromDB().then((data) => setAnnouncements(data));
  }, []);

  // Real-time vs Custom Date & Academic Year State
  const [dateAcademicConfig, setDateAcademicConfig] = useState<DateAcademicConfig>(() => getInitialDateAcademicConfig());
  const [isDateAcademicModalOpen, setIsDateAcademicModalOpen] = useState(false);
  const [dateAcademicModalTab, setDateAcademicModalTab] = useState<'date' | 'academic'>('academic');

  // Real-time tick to update clock/calendar live every minute
  const [nowDate, setNowDate] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowDate(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const isDateAuto = dateAcademicConfig.dateMode === 'auto';
  const displayDateStr = isDateAuto
    ? nowDate.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
    : formatCompactDate(dateAcademicConfig.customDate);

  const isAcademicYearAuto = dateAcademicConfig.academicYearMode === 'auto';
  const effectiveDateForAcademic = isDateAuto ? nowDate : new Date(dateAcademicConfig.customDate + 'T00:00:00');
  const currentAcademicYear = isAcademicYearAuto
    ? calculateAutoAcademicYear(effectiveDateForAcademic)
    : (dateAcademicConfig.customAcademicYear || calculateAutoAcademicYear(effectiveDateForAcademic));

  const handleSaveDateAcademicConfig = (newConfig: DateAcademicConfig) => {
    setDateAcademicConfig(newConfig);
    saveDateAcademicConfigToStorage(newConfig);
    const dateDesc = newConfig.dateMode === 'auto' ? 'Automatic (Real-time)' : `Custom (${newConfig.customDate})`;
    const academicDesc = newConfig.academicYearMode === 'auto' ? `Automatic (${calculateAutoAcademicYear(nowDate)})` : `Custom (${newConfig.customAcademicYear})`;
    showToast(`Settings saved: Date ${dateDesc}, Academic Year ${academicDesc}.`, 'success');
  };

  // Master Data Versioning to ensure client preview always syncs with safe repository seed
  const DATA_VERSION = 'v2026_10_13_safe_dummy_seed_v4';

  // Otomatis bersihkan cache lawas agar pengguna mendapatkan seed aman baru dan isolasi penuh
  try {
    const cachedVer = localStorage.getItem('robotics_master_data_version');
    if (cachedVer !== DATA_VERSION) {
      localStorage.setItem('robotics_master_data_version', DATA_VERSION);
      localStorage.removeItem('robotics_members');
      localStorage.removeItem('robotics_admin_members');
      localStorage.removeItem('robotics_attendance');
      localStorage.removeItem('robotics_admin_attendance');
      localStorage.removeItem('robotics_cash');
      localStorage.removeItem('robotics_admin_cash');
      localStorage.removeItem('robotics_custom_accounts');
      const allKeys = Object.keys(localStorage);
      for (const k of allKeys) {
        if (k.startsWith('org_') && (k.endsWith('_members') || k.endsWith('_attendance') || k.endsWith('_cash'))) {
          localStorage.removeItem(k);
        }
        if (k.startsWith('robotics_demo_sandbox_')) {
          localStorage.removeItem(k);
        }
      }
    }
  } catch {}

  // Helper to ensure any cached member records have sanitized names
  const sanitizeMemberList = (list: Member[]): Member[] => {
    return list.map(m => {
      const rawName = m.fullName || (m as any).full_name || '';
      const safeName = sanitizeRealName(rawName, String(m.id_member || m.nisn || ''));
      return {
        ...m,
        fullName: safeName,
        full_name: safeName,
      };
    });
  };

  // Helper to ensure any cached attendance records have sanitized names
  const sanitizeAttendanceList = (list: AttendanceRecord[]): AttendanceRecord[] => {
    return list.map(a => {
      const rawName = a.namaAnggota || (a as any).nama_anggota || '';
      const safeName = sanitizeRealName(rawName, String(a.id_member || a.nisn || ''));
      return {
        ...a,
        namaAnggota: safeName,
        nama_anggota: safeName,
      };
    });
  };

  // Helper to ensure any cached cash records have sanitized names
  const sanitizeCashList = (list: CashTransaction[]): CashTransaction[] => {
    return list.map(c => {
      const rawName = c.namaAnggota || (c as any).nama_anggota || '';
      const safeName = sanitizeRealName(rawName, String(c.id_member || c.nisn || ''));
      return {
        ...c,
        namaAnggota: safeName,
        nama_anggota: safeName,
        namaSiswa: safeName,
      };
    });
  };

  // Helper to isolate localStorage data per account
  const getAccountStorageKey = (username: string | undefined, key: 'members' | 'attendance' | 'cash') => {
    const cleanUser = (username || 'guest').trim().toLowerCase();
    return `robotics_${cleanUser}_${key}`;
  };

  // User's joined organizations list
  const [userOrganizations, setUserOrganizations] = useState<Organization[]>(() => {
    return getUserOrganizations(session?.username);
  });

  // Active organization ID
  const [activeOrgId, setActiveOrgId] = useState<string>(() => {
    return getActiveOrganizationId(session?.username);
  });

  const activeOrganization = useMemo(() => {
    const found = userOrganizations.find((o) => o.id === activeOrgId);
    return found || userOrganizations[0] || DEFAULT_ORGANIZATIONS[0];
  }, [userOrganizations, activeOrgId]);

  // Organization modals
  const [isCreateOrgModalOpen, setIsCreateOrgModalOpen] = useState(false);
  const [isJoinOrgModalOpen, setIsJoinOrgModalOpen] = useState(false);
  const [isEditOrgModalOpen, setIsEditOrgModalOpen] = useState(false);
  const [orgToEdit, setOrgToEdit] = useState<Organization | null>(null);

  // Helper to isolate localStorage data per organization & account
  // Helper to isolate localStorage data per organization & account (Strict Demo Sandbox Isolation)
  const loadOrgMembers = (orgId: string, username?: string, isDemo?: boolean): Member[] => {
    try {
      if (isDemo) {
        const cleanUser = (username || 'demo').trim().toLowerCase();
        const demoScoped = localStorage.getItem(`robotics_demo_sandbox_${cleanUser}_members`);
        if (demoScoped) {
          const parsed = JSON.parse(demoScoped);
          if (Array.isArray(parsed) && parsed.length > 0) return sanitizeMemberList(parsed);
        }
        return INITIAL_MEMBERS;
      }
      const scoped = localStorage.getItem(`org_${orgId}_members`);
      if (scoped) {
        const parsed = JSON.parse(scoped);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeMemberList(parsed);
      }
      const legacy = localStorage.getItem('robotics_admin_members') || localStorage.getItem('robotics_members');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeMemberList(parsed);
      }
      return INITIAL_MEMBERS;
    } catch {
      return INITIAL_MEMBERS;
    }
  };

  const loadOrgAttendance = (orgId: string, username?: string, isDemo?: boolean): AttendanceRecord[] => {
    try {
      if (isDemo) {
        const cleanUser = (username || 'demo').trim().toLowerCase();
        const demoScoped = localStorage.getItem(`robotics_demo_sandbox_${cleanUser}_attendance`);
        if (demoScoped) {
          const parsed = JSON.parse(demoScoped);
          if (Array.isArray(parsed) && parsed.length > 0) return deduplicateAttendance(sanitizeAttendanceList(parsed));
        }
        return deduplicateAttendance(INITIAL_ATTENDANCE);
      }
      const scoped = localStorage.getItem(`org_${orgId}_attendance`);
      if (scoped) {
        const parsed = JSON.parse(scoped);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateAttendance(sanitizeAttendanceList(parsed));
      }
      const legacy = localStorage.getItem('robotics_admin_attendance') || localStorage.getItem('robotics_attendance');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) return deduplicateAttendance(sanitizeAttendanceList(parsed));
      }
      return deduplicateAttendance(INITIAL_ATTENDANCE);
    } catch {
      return deduplicateAttendance(INITIAL_ATTENDANCE);
    }
  };

  const loadOrgCash = (orgId: string, username?: string, isDemo?: boolean): CashTransaction[] => {
    try {
      if (isDemo) {
        const cleanUser = (username || 'demo').trim().toLowerCase();
        const demoScoped = localStorage.getItem(`robotics_demo_sandbox_${cleanUser}_cash`);
        if (demoScoped) {
          const parsed = JSON.parse(demoScoped);
          if (Array.isArray(parsed) && parsed.length > 0) return sanitizeCashList(parsed);
        }
        return INITIAL_CASH;
      }
      const scoped = localStorage.getItem(`org_${orgId}_cash`);
      if (scoped) {
        const parsed = JSON.parse(scoped);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeCashList(parsed);
      }
      const legacy = localStorage.getItem('robotics_admin_cash') || localStorage.getItem('robotics_cash');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeCashList(parsed);
      }
      return INITIAL_CASH;
    } catch {
      return INITIAL_CASH;
    }
  };

  // Data collections with Per-Organization LocalStorage persistence & Sandbox Isolation
  const [members, setMembers] = useState<Member[]>(() => {
    return loadOrgMembers(activeOrgId, session?.username, session?.isDemo);
  });

  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => {
    return loadOrgAttendance(activeOrgId, session?.username, session?.isDemo);
  });

  const [cash, setCash] = useState<CashTransaction[]>(() => {
    return loadOrgCash(activeOrgId, session?.username, session?.isDemo);
  });

  // Resolve member object corresponding to the current logged-in user
  const currentMemberForSession = useMemo(() => {
    if (!session) return null;
    return (
      members.find(
        (m) =>
          (session.nisn && m.nisn === session.nisn) ||
          (session.nis && m.nisn === session.nis) ||
          (session.email && m.email && m.email.toLowerCase() === session.email.toLowerCase()) ||
          (m.fullName && session.name && m.fullName.toLowerCase() === session.name.toLowerCase())
      ) || null
    );
  }, [session, members]);

  // Find attendance record for the active date for the current member
  const currentMemberExistingAttendance = useMemo(() => {
    if (!session) return null;
    const targetDate = String(activeAttendanceDate || new Date().toISOString().split('T')[0]).slice(0, 10).trim();
    const nisn = session.nisn || session.nis || currentMemberForSession?.nisn || '';
    const name = session.name || session.username || '';
    return (
      attendance.find((a) => {
        const aDate = String(a.tanggal || '').slice(0, 10).trim();
        if (aDate !== targetDate) return false;
        if (nisn && a.nisn && a.nisn === nisn) return true;
        if (name && a.namaAnggota && a.namaAnggota.toLowerCase() === name.toLowerCase()) return true;
        return false;
      }) || null
    );
  }, [attendance, activeAttendanceDate, session, currentMemberForSession]);

  // Supabase Database Connection State
  const [isSupabaseConnected, setIsSupabaseConnected] = useState(true);
  const [isTablesCreated, setIsTablesCreated] = useState(false);

  // Async sync status
  const [isSyncing, setIsSyncing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Notifications State & Persistence
  const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const storageKey = session?.username ? `robotics_notifications_${session.username}` : 'robotics_notifications_default';
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      return INITIAL_SEED_NOTIFICATIONS;
    } catch {
      return INITIAL_SEED_NOTIFICATIONS;
    }
  });

  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    try {
      const storageKey = session?.username ? `robotics_notifications_${session.username}` : 'robotics_notifications_default';
      localStorage.setItem(storageKey, JSON.stringify(notifications));
    } catch {}
  }, [notifications, session?.username]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleClearAllNotifications = () => {
    setNotifications([]);
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  // Modals state
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false);
  const [memberToEdit, setMemberToEdit] = useState<Member | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedMemberDetail, setSelectedMemberDetail] = useState<Member | null>(null);

  // Desktop Sidebar toggle state (open/close) with local storage persistence
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('robotics_sidebar_open');
      if (saved !== null) return saved === 'true';
      return typeof window !== 'undefined' ? window.innerWidth >= 1024 : true;
    } catch {
      return true;
    }
  });
  
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem('robotics_sidebar_open', String(isSidebarOpen));
    } catch {}
  }, [isSidebarOpen]);

  const openSidebar = () => {
    setIsSidebarOpen(true);
  };

  const closeSidebar = () => {
    setIsSidebarOpen(false);
  };

  const toggleSidebar = () => {
    setIsSidebarOpen((prev) => !prev);
  };

  const handleSidebarTabSelect = (tab: MainTabType) => {
    setActiveTab(tab);
    setIsSidebarOpen(true); // Mutually exclusive: using sidebar keeps sidebar open
    setIsMobileSidebarOpen(false);
  };

  // Keyboard shortcut Ctrl+B or Cmd+B to toggle desktop sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((e.ctrlKey || e.metaKey) && (e.key === 'b' || e.key === 'B')) {
        if (!isInput) {
          e.preventDefault();
          playClickTick();
          toggleSidebar();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Save changes to localStorage scoped per organization & per account with Strict Demo Sandbox Isolation
  useEffect(() => {
    // Privacy Safeguard (UU PDP): Redact other students' sensitive NIK and parent contact details
    // in browser storage if the current user session is a general student member (not Executive/Advisor)
    const isElevated = isExecutiveOrAdvisor(session?.role, session?.jabatan);
    const storageMembers = isElevated ? members : members.map((m) => {
      const isSelf = (session?.nisn && m.nisn === session.nisn) || 
                     (session?.email && m.email && m.email.toLowerCase() === session.email.toLowerCase()) ||
                     (session?.name && m.fullName && m.fullName.toLowerCase() === session.name.toLowerCase());
      if (isSelf) return m;
      return {
        ...m,
        nik: m.nik ? maskNik(m.nik) : '',
        parentPhone: m.parentPhone ? maskParentPhone(m.parentPhone) : '',
        birthDate: undefined,
      };
    });

    if (session?.isDemo) {
      const cleanUser = (session.username || 'demo').trim().toLowerCase();
      localStorage.setItem(`robotics_demo_sandbox_${cleanUser}_members`, JSON.stringify(storageMembers));
      return;
    }
    if (activeOrgId) {
      localStorage.setItem(`org_${activeOrgId}_members`, JSON.stringify(storageMembers));
    }
    if (session?.username) {
      const key = getAccountStorageKey(session.username, 'members');
      localStorage.setItem(key, JSON.stringify(storageMembers));
      if (session.username === 'admin') {
        localStorage.setItem('robotics_members', JSON.stringify(storageMembers));
      }
    }
  }, [members, session?.username, session?.isDemo, session?.role, session?.jabatan, session?.nisn, session?.email, session?.name, activeOrgId]);

  useEffect(() => {
    if (session?.isDemo) {
      const cleanUser = (session.username || 'demo').trim().toLowerCase();
      localStorage.setItem(`robotics_demo_sandbox_${cleanUser}_attendance`, JSON.stringify(attendance));
      return;
    }
    if (activeOrgId) {
      localStorage.setItem(`org_${activeOrgId}_attendance`, JSON.stringify(attendance));
    }
    if (session?.username) {
      const key = getAccountStorageKey(session.username, 'attendance');
      localStorage.setItem(key, JSON.stringify(attendance));
      if (session.username === 'admin') {
        localStorage.setItem('robotics_attendance', JSON.stringify(attendance));
      }
    }
  }, [attendance, session?.username, session?.isDemo, activeOrgId]);

  useEffect(() => {
    if (session?.isDemo) {
      const cleanUser = (session.username || 'demo').trim().toLowerCase();
      localStorage.setItem(`robotics_demo_sandbox_${cleanUser}_cash`, JSON.stringify(cash));
      return;
    }
    if (activeOrgId) {
      localStorage.setItem(`org_${activeOrgId}_cash`, JSON.stringify(cash));
    }
    if (session?.username) {
      const key = getAccountStorageKey(session.username, 'cash');
      localStorage.setItem(key, JSON.stringify(cash));
      if (session.username === 'admin') {
        localStorage.setItem('robotics_cash', JSON.stringify(cash));
      }
    }
  }, [cash, session?.username, session?.isDemo, activeOrgId]);

  const showToast = (
    text: string, 
    type: 'success' | 'error' | 'info' = 'success',
    options?: {
      title?: string;
      category?: 'attendance' | 'cash' | 'member' | 'system';
      linkTab?: 'members' | 'attendance' | 'cash' | 'calendar';
    }
  ) => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);

    // Save into persistent notification history so user can view all notifications anytime
    try {
      const lower = text.toLowerCase();
      let category: 'attendance' | 'cash' | 'member' | 'system' = options?.category || 'system';
      let linkTab: 'members' | 'attendance' | 'cash' | 'calendar' | undefined = options?.linkTab;
      let title = options?.title || '';

      if (!options?.category) {
        if (lower.includes('presensi') || lower.includes('kehadiran') || lower.includes('absen') || lower.includes('hadir') || lower.includes('attendance') || lower.includes('present')) {
          category = 'attendance';
          linkTab = linkTab || 'attendance';
          title = title || (type === 'error' ? 'Attendance Issue' : 'Attendance Update');
        } else if (lower.includes('kas') || lower.includes('iuran') || lower.includes('bayar') || lower.includes('transaksi') || lower.includes('cash') || lower.includes('treasury')) {
          category = 'cash';
          linkTab = linkTab || 'cash';
          title = title || (type === 'error' ? 'Transaction Failed' : 'Treasury Update');
        } else if (lower.includes('anggota') || lower.includes('siswa') || lower.includes('member') || lower.includes('student')) {
          category = 'member';
          linkTab = linkTab || 'members';
          title = title || (type === 'error' ? 'Member Data Failed' : 'Member Data');
        } else if (lower.includes('welcome') || lower.includes('selamat datang') || lower.includes('keluar') || lower.includes('logout') || lower.includes('login')) {
          category = 'system';
          title = title || 'Account Activity';
        } else {
          category = 'system';
          title = title || (type === 'error' ? 'System Alert' : 'System Notification');
        }
      }

      const cleanText = text.replace(/^[✅⚠️❌ℹ️\s]+/, '').trim();
      const newNotif: AppNotification = {
        id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        title: title || (type === 'error' ? 'Alert' : 'Notification'),
        message: cleanText,
        type,
        category,
        timestamp: new Date().toISOString(),
        isRead: false,
        linkTab
      };

      setNotifications(prev => [newNotif, ...prev.slice(0, 79)]);
    } catch {
      // safe fallback
    }
  };

  // ----------------------------------------------------
  // Sync Data with Supabase Cloud (Scoped per Account)
  // ----------------------------------------------------
  const fetchAllData = useCallback(async () => {
    // 1. ISOLATION: If in Demo Mode, DO NOT fetch or touch Supabase database!
    if (!session || session.isDemo || session.username === 'demo_tamu') {
      setIsSyncing(false);
      setIsSupabaseConnected(true);
      return;
    }

    setIsSyncing(true);
    try {
      const supaResult = await fetchAllSupabaseData(session.username);
      
      if (supaResult.success && !supaResult.needsSetup) {
        setIsTablesCreated(true);
        setIsSupabaseConnected(true);

        const storageKeyPrefix = session.username.trim().toLowerCase();

        if (supaResult.members && supaResult.members.length > 0) {
          const safeMembers = sanitizeMemberList(supaResult.members);
          setMembers(safeMembers);
          localStorage.setItem(`robotics_${storageKeyPrefix}_members`, JSON.stringify(safeMembers));
          if (session.username === 'admin') {
            localStorage.setItem('robotics_members', JSON.stringify(safeMembers));
          }
        }

        if (supaResult.attendance && supaResult.attendance.length > 0) {
          const safeAttendance = sanitizeAttendanceList(supaResult.attendance);
          setAttendance(safeAttendance);
          localStorage.setItem(`robotics_${storageKeyPrefix}_attendance`, JSON.stringify(safeAttendance));
          if (session.username === 'admin') {
            localStorage.setItem('robotics_attendance', JSON.stringify(safeAttendance));
          }
        }

        if (supaResult.cash && supaResult.cash.length > 0) {
          const safeCash = sanitizeCashList(supaResult.cash);
          setCash(safeCash);
          localStorage.setItem(`robotics_${storageKeyPrefix}_cash`, JSON.stringify(safeCash));
          if (session.username === 'admin') {
            localStorage.setItem('robotics_cash', JSON.stringify(safeCash));
          }
        }

        if (supaResult.accounts && supaResult.accounts.length > 0) {
          saveCustomAccounts(supaResult.accounts);
        }
        return;
      }

      if (supaResult.needsSetup) {
        setIsTablesCreated(false);
      }
      setIsSupabaseConnected(!supaResult.error || supaResult.needsSetup);

    } catch (err: unknown) {
      const error = err as Error;
      console.error('Fetch error:', error);
      setIsSupabaseConnected(false);
    } finally {
      setIsSyncing(false);
    }
  }, [session]);

  // Initial Fetch on Login & Realtime Listener (Disabled for Demo Sandbox to prevent cross-leak)
  useEffect(() => {
    if (session) {
      if (session.isDemo || session.username === 'demo_tamu') {
        // Demo sandbox: isolated purely to local storage
        setIsSyncing(false);
        setIsSupabaseConnected(true);
        return;
      }

      fetchAllData();

      const supa = getSupabase();
      // Setup Supabase Realtime Channels for registered accounts
      const channel = supa
        .channel(`realtime_${session.username}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'members' }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMem = mapMemberFromDB(payload.new);
            setMembers((prev) => [newMem, ...prev.filter((m) => m.nisn !== newMem.nisn)]);
          } else if (payload.eventType === 'UPDATE') {
            const updated = mapMemberFromDB(payload.new);
            setMembers((prev) => prev.map((m) => (m.nisn === updated.nisn ? updated : m)));
          } else if (payload.eventType === 'DELETE') {
            const deletedNisn = (payload.old as any)?.id_member || (payload.old as any)?.nisn;
            if (deletedNisn) {
              setMembers((prev) => prev.filter((m) => m.nisn !== deletedNisn && m.id_member !== deletedNisn));
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const rec = mapAttendanceFromDB(payload.new);
            const recDate = String(rec.tanggal || '').slice(0, 10).trim();
            const recNisn = String(rec.nisn || '').trim();
            const recName = String(rec.namaAnggota || '').trim().toLowerCase();

            setAttendance((prev) => {
              const filtered = prev.filter((a) => {
                if (a.id === rec.id) return false;
                const aDate = String(a.tanggal || '').slice(0, 10).trim();
                const aNisn = String(a.nisn || '').trim();
                const aName = String(a.namaAnggota || '').trim().toLowerCase();

                if (aDate !== recDate) return true;
                const matchNisn = recNisn && recNisn !== '-' && aNisn && aNisn === recNisn;
                const matchName = recName && aName && aName === recName;
                return !matchNisn && !matchName;
              });

              return [rec, ...filtered];
            });
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string } | undefined;
            if (deleted?.id) {
              setAttendance((prev) => prev.filter((a) => a.id !== deleted.id));
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_transactions' }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const tx = mapCashFromDB(payload.new);
            setCash((prev) => {
              const idx = prev.findIndex((c) => c.id === tx.id);
              if (idx >= 0) {
                const next = [...prev];
                next[idx] = tx;
                return next;
              }
              return [tx, ...prev];
            });
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id?: string } | undefined;
            if (deleted?.id) {
              setCash((prev) => prev.filter((c) => c.id !== deleted.id));
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'user_accounts' }, (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row: any = payload.new;
            if (row && row.username) {
              const updatedAcc = {
                username: String(row.username || '').trim(),
                password: String(row.password || ''),
                name: String(row.name || '').trim(),
                role: String(row.role || 'Pengurus Inti').trim(),
                email: String(row.email || '').trim(),
                authProvider: (row.auth_provider === 'google' ? 'google' : 'credentials') as 'credentials' | 'google',
                avatarUrl: row.avatar_url || '',
              };
              addOrUpdateAccount(updatedAcc);
            }
          }
        })
        .subscribe();

      return () => {
        supa.removeChannel(channel);
      };
    }
  }, [session, fetchAllData]);

  const handleSyncAllData = async () => {
    setIsSyncing(true);
    try {
      await syncAllLocalDataToSupabase(members, attendance, cash, session?.username);
      await fetchAllData();
      showToast('All data successfully synchronized with Supabase database!', 'success');
    } catch {
      showToast('Supabase sync encountered an issue.', 'error');
    } finally {
      setIsSyncing(false);
    }
  };

  // ----------------------------------------------------
  // Member CRUD Operations
  // ----------------------------------------------------
  const handleSaveMember = async (memberData: Member, originalNisn?: string) => {
    setIsSubmitting(true);
    try {
      const isEditing = Boolean(originalNisn);

      if (!isEditing && !memberData.id_member) {
        const maxId = members.reduce((max, m) => Math.max(max, m.id_member || 0), 0);
        memberData.id_member = maxId + 1;
      }

      // 1. Optimistic Local State Update with robust matching
      if (isEditing) {
        setMembers((prev) => {
          const updated = prev.map((m) => {
            const isMatch = (originalNisn && String(m.nisn).trim() === String(originalNisn).trim()) ||
                            (memberData.id_member && m.id_member === memberData.id_member) ||
                            (memberToEdit && (m.nisn === memberToEdit.nisn || (m.id_member && m.id_member === memberToEdit.id_member)));
            return isMatch ? { ...m, ...memberData } : m;
          });
          try {
            localStorage.setItem('robotics_members', JSON.stringify(updated));
          } catch {}
          return updated;
        });

        // Update attendance records if NISN or name changed
        if (originalNisn) {
          setAttendance((prev) => {
            const updated = prev.map((a) => {
              if (String(a.nisn).trim() === String(originalNisn).trim() || (memberToEdit && a.namaAnggota === memberToEdit.fullName)) {
                return {
                  ...a,
                  nisn: memberData.nisn,
                  namaAnggota: memberData.fullName,
                  kelas: `${memberData.grade}-${memberData.classRoom}`,
                };
              }
              return a;
            });
            try {
              localStorage.setItem('robotics_attendance', JSON.stringify(updated));
            } catch {}
            return updated;
          });
        }

        // Update selected detail modal if currently displaying this member
        setSelectedMemberDetail((prev) => {
          if (!prev) return null;
          const isCurrent = (originalNisn && String(prev.nisn).trim() === String(originalNisn).trim()) ||
                            (memberData.id_member && prev.id_member === memberData.id_member);
          return isCurrent ? { ...prev, ...memberData } : prev;
        });
      } else {
        setMembers((prev) => {
          const updated = [memberData, ...prev.filter(m => String(m.nisn).trim() !== String(memberData.nisn).trim())];
          try {
            localStorage.setItem('robotics_members', JSON.stringify(updated));
          } catch {}
          return updated;
        });
      }

      // If in demo mode, do not write to Supabase database
      if (session?.isDemo) {
        showToast(`✅ [Mode Demo] Data anggota ${memberData.fullName} tersimpan di sandbox lokal akun demo!`, 'success');
        setIsMemberFormOpen(false);
        setMemberToEdit(null);
        return;
      }

      // 2. Write directly to Supabase
      const res = await upsertMemberToDB(memberData, originalNisn);
      if (res.success) {
        setIsTablesCreated(true);
        setIsSupabaseConnected(true);
        showToast(`✅ Data anggota ${memberData.fullName} berhasil tersimpan!`, 'success');
      } else {
        console.warn('Supabase members save error:', res.error);
        showToast(`⚠️ Tersimpan di perangkat, tapi gagal ke Supabase: ${res.error}. Buka menu Setup Supabase untuk buat tabel.`, 'error');
        if (res.error?.includes('does not exist')) {
          setIsTablesCreated(false);
        }
      }

      setIsMemberFormOpen(false);
      setMemberToEdit(null);
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteMember = async (nisn: string) => {
    const member = members.find((m) => m.nisn === nisn || String(m.nisn).trim() === String(nisn).trim());
    const memberName = member?.fullName || 'Anggota';
    const targetNisn = member?.nisn || nisn;

    setIsSubmitting(true);
    try {
      // 1. Optimistic Update (instant UI removal from list and localStorage)
      setMembers((prev) => {
        const updated = prev.filter((m) => m.nisn !== targetNisn && (!member || m.fullName !== member.fullName));
        return updated;
      });

      // Also clean up attendance of deleted member in local state
      setAttendance((prev) => {
        const updated = prev.filter((a) => a.nisn !== targetNisn && (!member || a.namaAnggota !== member.fullName));
        return updated;
      });

      // If in demo mode, do not delete from Supabase database
      if (session?.isDemo) {
        showToast(`✅ [Mode Demo] Data anggota ${memberName} dihapus dari sandbox akun demo.`, 'success');
        return;
      }

      // 2. Delete from Supabase Cloud Database
      const res = await deleteMemberFromDB(targetNisn, member?.fullName);
      if (res.success) {
        showToast(`✅ Data anggota ${memberName} berhasil dihapus permanen dari database!`, 'success');
      } else {
        showToast(`Data ${memberName} berhasil dihapus dari daftar lokal.`, 'info');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Error menghapus: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetDefaultMembers = () => {
    setMembers(INITIAL_MEMBERS);
    if (session?.username) {
      localStorage.setItem(getAccountStorageKey(session.username, 'members'), JSON.stringify(INITIAL_MEMBERS));
      if (session.username === 'admin') {
        localStorage.setItem('robotics_members', JSON.stringify(INITIAL_MEMBERS));
      }
    }
    showToast('Master data anggota berhasil direset ke 35 siswa awal.', 'info');
  };

  const handleClearAllMembers = () => {
    // 0. Safety: Save emergency snapshot and trigger auto-download before clearing members
    if (members.length > 0) {
      try {
        const timeSlug = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        downloadTextFile(`backup_darurat_anggota_${timeSlug}.json`, JSON.stringify(members, null, 2), 'application/json');
        const backupKey = `robotics_backup_members_${timeSlug}`;
        localStorage.setItem(backupKey, JSON.stringify(members));
      } catch (err) {
        console.warn('Emergency members backup note:', err);
      }
    }

    setMembers([]);
    if (session?.username) {
      localStorage.setItem(getAccountStorageKey(session.username, 'members'), JSON.stringify([]));
      if (session.username === 'admin') {
        localStorage.setItem('robotics_members', JSON.stringify([]));
      }
    }
    showToast('Data anggota dibersihkan. Cadangan darurat (JSON) otomatis diunduh ke perangkat Anda.', 'info');
  };

  const handleRoleTitleChange = async (member: Member, newRole: string, newTitle: string) => {
    if (canonicalRole !== 'admin') {
      showToast('Akses ditolak: Hanya Administrator Utama yang berwenang mengubah peran atau jabatan anggota.', 'error');
      return;
    }
    const isPromotedToExec = newTitle !== 'member' || newRole === 'admin';
    const updatedMember: Member = {
      ...member,
      role: newRole,
      jabatan: newTitle,
      status: isPromotedToExec ? 'executive_board' : (member.status === 'executive_board' ? 'Aktif' : (member.status || 'Aktif'))
    };

    setMembers(prev => prev.map(m => (m.nisn === member.nisn || (m.id_member && m.id_member === member.id_member)) ? updatedMember : m));
    setSelectedMemberDetail(updatedMember);

    if (!session?.isDemo) {
      await upsertMemberToDB(updatedMember, member.nisn);
    }

    if (member.email) {
      addOrUpdateAccount({
        username: member.email.split('@')[0],
        password: '',
        name: member.fullName,
        role: newTitle !== 'member' ? `Executive Board (${newTitle})` : 'Club Member',
        email: member.email,
        authProvider: 'credentials',
      });
    }

    showToast(`Role & Title updated: ${member.fullName} is now ${formatTitleLabel(newTitle)} (${newRole === 'admin' ? 'Admin' : 'Member'}).`, 'success');
  };

  const handleMemberStatusChange = async (member: Member, newStatus: string) => {
    const updatedMember: Member = {
      ...member,
      status: newStatus
    };
    setMembers(prev => prev.map(m => (m.nisn === member.nisn || (m.id_member && m.id_member === member.id_member)) ? updatedMember : m));
    setSelectedMemberDetail(updatedMember);
    if (!session?.isDemo) {
      await upsertMemberToDB(updatedMember, member.nisn);
    }
    showToast(`Membership status for ${member.fullName} updated to ${newStatus}.`, 'success');
  };

  // ----------------------------------------------------
  // Attendance Operations
  // ----------------------------------------------------
  const handleAddAttendance = async (record: Omit<AttendanceRecord, 'id'>) => {
    try {
      const targetDate = String(record.tanggal || '').slice(0, 10).trim();
      const targetNisn = String(record.nisn || '').trim();
      const targetName = String(record.namaAnggota || '').trim();
      const targetNameLower = targetName.toLowerCase();

      // Attendance Spoofing Guard: General members can only submit attendance for their own account
      const isElevated = isExecutiveOrAdvisor(session?.role, session?.jabatan);
      if (!isElevated && session && !session.isDemo) {
        const sessionNisn = String(session.nisn || session.nis || '').trim();
        const sessionName = String(session.name || session.username || '').toLowerCase().trim();
        const matchesNisn = Boolean(sessionNisn && targetNisn && sessionNisn === targetNisn);
        const matchesName = Boolean(sessionName && targetNameLower && (sessionName === targetNameLower || targetNameLower.includes(sessionName)));

        if (!matchesNisn && !matchesName) {
          showToast('Security Alert: You can only record attendance for your own verified student profile.', 'error');
          return;
        }
      }

      const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      const newRecord: AttendanceRecord = {
        id,
        tanggal: targetDate,
        nisn: targetNisn,
        namaAnggota: targetName,
        status: record.status,
      };

      // 1. Instant Optimistic State Update: purge ANY previous matching record for this student on this date
      setAttendance((prev) => {
        const filtered = prev.filter((a) => {
          const aDate = String(a.tanggal || '').slice(0, 10).trim();
          const aNisn = String(a.nisn || '').trim();
          const aName = String(a.namaAnggota || '').trim().toLowerCase();

          if (aDate !== targetDate) return true;

          const matchNisn = targetNisn && targetNisn !== '-' && aNisn && aNisn === targetNisn;
          const matchName = targetNameLower && aName && aName === targetNameLower;

          return !matchNisn && !matchName;
        });

        const updated = [newRecord, ...filtered];
        return updated;
      });

      // If in demo mode, do not write to Supabase database
      if (session?.isDemo) {
        return;
      }

      // 2. Synchronize to Supabase asynchronously
      upsertAttendanceToDB(newRecord).then((res) => {
        if (!res.success && res.error) {
          console.warn('Supabase attendance sync note:', res.error);
        }
      }).catch((err) => {
        console.warn('Supabase attendance sync error:', err);
      });

    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Failed to save attendance: ${error.message}`, 'error');
    }
  };

  const handleBulkAttendance = async (records: Omit<AttendanceRecord, 'id'>[]) => {
    setIsSubmitting(true);
    try {
      if (records.length === 0) return;
      const targetDate = String(records[0].tanggal || '').slice(0, 10).trim();
      const generatedRecords: AttendanceRecord[] = records.map((r, idx) => ({
        id: `att_${Date.now()}_${idx}`,
        tanggal: targetDate,
        nisn: String(r.nisn || '').trim(),
        namaAnggota: String(r.namaAnggota || '').trim(),
        status: r.status,
      }));

      // 1. Update local state & localStorage
      setAttendance((prev) => {
        const filtered = prev.filter((a) => String(a.tanggal || '').slice(0, 10).trim() !== targetDate);
        const updated = [...generatedRecords, ...filtered];
        return updated;
      });

      // If in demo mode, do not write to Supabase
      if (session?.isDemo) {
        showToast(`✅ [Demo Mode] ${records.length} students marked Present in demo sandbox!`, 'success');
        return;
      }

      // 2. Batch write to Supabase
      const res = await bulkUpsertAttendanceToDB(generatedRecords, true);
      if (res.success) {
        showToast(`✅ ${records.length} students marked Present in Supabase Cloud!`, 'success');
      } else {
        showToast(`Attendance recorded locally (Supabase: ${res.error})`, 'info');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAttendance = async (id: string, index?: number, record?: AttendanceRecord) => {
    setIsSubmitting(true);
    // 1. Optimistic remove from local state & sync to localStorage
    setAttendance((prev) => {
      const updated = prev.filter((a, idx) => {
        if (id && a.id === id) return false;
        if (record && a.tanggal === record.tanggal && (
          (record.nisn && a.nisn === record.nisn) || 
          (record.namaAnggota && a.namaAnggota === record.namaAnggota)
        )) return false;
        if (index !== undefined && idx === index) return false;
        return true;
      });
      return updated;
    });

    // If in demo mode, do not delete from Supabase
    if (session?.isDemo) {
      setIsSubmitting(false);
      showToast('[Demo Mode] Attendance record deleted from demo sandbox.', 'info');
      return;
    }

    // 2. Delete from Supabase Database
    try {
      const res = await deleteAttendanceFromDB(id, record);
      if (res.success) {
        showToast('✅ Attendance record permanently deleted from Supabase database!', 'success');
      } else {
        showToast('Attendance record deleted locally.', 'info');
      }
    } catch (dbErr: any) {
      console.warn('Supabase delete attendance error:', dbErr);
      showToast('Attendance record deleted locally.', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetMemberAttendance = async (tanggal: string, member: Member) => {
    const targetDate = String(tanggal || '').slice(0, 10).trim();
    const targetNisn = String(member.nisn || '').trim();
    const targetNameLower = String(member.fullName || '').trim().toLowerCase();

    // 1. Optimistic remove from local state and update localStorage
    setAttendance((prev) => {
      const updated = prev.filter((a) => {
        const aDate = String(a.tanggal || '').slice(0, 10).trim();
        const aNisn = String(a.nisn || '').trim();
        const aName = String(a.namaAnggota || '').trim().toLowerCase();

        if (aDate !== targetDate) return true;
        const matchNisn = targetNisn && targetNisn !== '-' && aNisn && aNisn === targetNisn;
        const matchName = targetNameLower && aName && aName === targetNameLower;
        return !matchNisn && !matchName;
      });
      return updated;
    });

    // If in demo mode, do not delete from Supabase
    if (session?.isDemo) {
      showToast(`[Demo Mode] Attendance for ${member.fullName} cancelled in demo sandbox.`, 'info');
      return;
    }

    // 2. Delete from Supabase
    try {
      const res = await deleteAttendanceByMemberAndDate(targetDate, targetNisn, member.fullName);
      if (res.success) {
        showToast(`✅ Attendance for ${member.fullName} on ${targetDate} cancelled from database!`, 'success');
      } else {
        showToast(`Attendance for ${member.fullName} cancelled locally.`, 'info');
      }
    } catch (err) {
      console.warn('Reset member attendance error:', err);
      showToast(`Attendance for ${member.fullName} cancelled locally.`, 'info');
    }
  };

  const handleResetDateAttendance = async (tanggal: string) => {
    const targetDate = String(tanggal || '').slice(0, 10).trim();

    // Collect IDs of all records on this date before removing from local state
    const recordsToDelete = attendance.filter((a) => String(a.tanggal || '').slice(0, 10).trim() === targetDate);
    const targetIds = recordsToDelete.map((a) => a.id).filter(Boolean) as string[];

    // 1. Optimistic instant local removal & localStorage sync
    setAttendance((prev) => {
      const updated = prev.filter((a) => String(a.tanggal || '').slice(0, 10).trim() !== targetDate);
      return updated;
    });

    // If in demo mode, do not delete from Supabase
    if (session?.isDemo) {
      showToast(`[Demo Mode] All attendance for ${targetDate} reset in demo sandbox.`, 'info');
      return;
    }

    // 2. Delete permanently from Supabase Cloud Database
    setIsSubmitting(true);
    try {
      const res = await deleteAttendanceByDate(targetDate, targetIds);
      if (res.success) {
        showToast(`✅ All attendance for ${targetDate} successfully reset and removed from database!`, 'success');
      } else {
        showToast(`Attendance reset locally (database note: ${res.error || 'ok'}).`, 'info');
      }
    } catch (err: any) {
      console.warn('Reset date attendance error:', err);
      showToast(`Attendance reset locally. Sync note: ${err?.message || err}`, 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAllAttendance = async () => {
    setIsSubmitting(true);
    const count = attendance.length;
    const allIds = attendance.map((a) => a.id).filter(Boolean) as string[];

    // 0. Safety: Save emergency snapshot and trigger auto-download before destructive reset
    if (attendance.length > 0) {
      try {
        const timeSlug = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        downloadTextFile(`backup_darurat_presensi_${timeSlug}.json`, JSON.stringify(attendance, null, 2), 'application/json');
        const backupKey = `robotics_backup_attendance_${timeSlug}`;
        localStorage.setItem(backupKey, JSON.stringify(attendance));
      } catch (err) {
        console.warn('Emergency attendance backup note:', err);
      }
    }

    // 1. Optimistic instant local removal & localStorage sync
    setAttendance([]);
    if (session?.username) {
      const key = getAccountStorageKey(session.username, 'attendance');
      localStorage.setItem(key, JSON.stringify([]));
      if (session.username === 'admin') {
        localStorage.setItem('robotics_attendance', JSON.stringify([]));
      }
    }

    // If in demo mode, do not delete from Supabase
    if (session?.isDemo) {
      setIsSubmitting(false);
      showToast(`[Demo Mode] All attendance history (${count} records) reset in demo sandbox.`, 'info');
      return;
    }

    // 2. Delete permanently from Supabase Cloud Database
    try {
      const res = await deleteAllAttendanceFromDB(session?.username, allIds);
      if (res.success) {
        showToast(`✅ All attendance history (${count} records) successfully reset and removed from database!`, 'success');
      } else {
        showToast(`Attendance history reset locally (database note: ${res.error || 'ok'}).`, 'info');
      }
    } catch (err: any) {
      console.warn('Reset all attendance error:', err);
      showToast(`Attendance history reset locally. Sync note: ${err?.message || err}`, 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Cash Operations
  // ----------------------------------------------------
  const handleAddCash = async (transaction: Omit<CashTransaction, 'id'>) => {
    setIsSubmitting(true);
    try {
      const id = `cash_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newTx: CashTransaction = {
        id,
        ...transaction,
      };

      // 1. Optimistic Update
      setCash((prev) => [newTx, ...prev]);

      // If in demo mode, do not write to Supabase
      if (session?.isDemo) {
        showToast(`✅ [Mode Demo] Transaksi Kas ${transaction.jenis} (Rp ${transaction.jumlah.toLocaleString('id-ID')}) tercatat di sandbox demo!`, 'success');
        return;
      }

      // 2. Write to Supabase
      const res = await upsertCashToDB(newTx);
      if (res.success) {
        showToast(`✅ Transaksi Kas ${transaction.jenis} (Rp ${transaction.jumlah.toLocaleString('id-ID')}) berhasil tersimpan!`, 'success');
      } else {
        showToast(`Kas tersimpan lokal (Supabase note: ${res.error})`, 'info');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkAddCash = async (transactions: Omit<CashTransaction, 'id'>[]) => {
    setIsSubmitting(true);
    try {
      if (transactions.length === 0) return;
      const generatedTxs: CashTransaction[] = transactions.map((t, idx) => ({
        id: `cash_${Date.now()}_${idx}_${Math.random().toString(36).substring(2, 5)}`,
        ...t,
      }));

      // 1. Optimistic Update
      setCash((prev) => [...generatedTxs, ...prev]);

      // If in demo mode, do not write to Supabase
      if (session?.isDemo) {
        showToast(`✅ [Mode Demo] ${transactions.length} pembayaran iuran kas dicatat di sandbox demo!`, 'success');
        return;
      }

      // 2. Batch write to Supabase
      const res = await bulkUpsertCashToDB(generatedTxs);
      if (res.success) {
        showToast(`✅ ${transactions.length} pembayaran iuran kas berhasil dicatat di Supabase!`, 'success');
      } else {
        showToast(`Iuran kas tercatat lokal (Supabase note: ${res.error})`, 'info');
      }
    } catch (err: unknown) {
      const error = err as Error;
      showToast(`Error: ${error.message}`, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelMemberCash = async (txId?: string, memberName?: string, txObject?: CashTransaction) => {
    setIsSubmitting(true);
    let targetId = txId;
    let targetObj = txObject;

    setCash((prev) => {
      let next: CashTransaction[];
      if (targetId) {
        if (!targetObj) targetObj = prev.find((c) => c.id === targetId);
        next = prev.filter((c) => c.id !== targetId);
      } else if (targetObj) {
        targetId = targetObj.id;
        next = prev.filter((c) => {
          if (targetObj?.id && c.id === targetObj.id) return false;
          if (c === targetObj) return false;
          const sameNisn = c.nisn && targetObj?.nisn && c.nisn === targetObj.nisn;
          const sameName = c.namaAnggota && targetObj?.namaAnggota && c.namaAnggota === targetObj.namaAnggota;
          const sameDate = c.tanggal === targetObj?.tanggal;
          const sameAmount = Number(c.jumlah) === Number(targetObj?.jumlah);
          if ((sameNisn || sameName) && sameDate && sameAmount) return false;
          return true;
        });
      } else {
        next = prev;
      }
      return next;
    });

    if (session?.isDemo) {
      setIsSubmitting(false);
      showToast(`[Mode Demo] Pembayaran kas ${memberName || 'siswa'} dibatalkan di sandbox demo.`, 'info');
      return;
    }

    try {
      const idToDelete = targetId || targetObj?.id;
      if (idToDelete) {
        await deleteCashFromDB(idToDelete);
      }
    } catch (dbErr) {
      console.warn('Supabase delete cash error:', dbErr);
    } finally {
      setIsSubmitting(false);
    }
    showToast(`Treasury payment for ${memberName || 'student'} cancelled/deleted (status: Unpaid).`, 'info');
  };

  const handleResetPeriodCash = async (periodMonthKey: string, periodLabel: string) => {
    const removedIds: string[] = [];
    setCash((prev) => {
      const next = prev.filter((c) => {
        const isPeriodMatch = c.jenis === 'Masuk' && (
          (c.tanggal && c.tanggal.startsWith(periodMonthKey)) ||
          (c.keterangan && c.keterangan.toLowerCase().includes(periodLabel.toLowerCase()))
        );
        if (isPeriodMatch && c.id) {
          removedIds.push(c.id);
        }
        return !isPeriodMatch;
      });
      return next;
    });

    if (session?.isDemo) {
      showToast(`[Demo Mode] All treasury dues for period ${periodLabel} reset in demo sandbox.`, 'info');
      return;
    }

    try {
      if (removedIds.length > 0) {
        await deleteMultipleCashFromDB(removedIds);
      }
      showToast(`All treasury dues for period ${periodLabel} reset successfully.`, 'success');
    } catch (err) {
      console.warn('Reset period cash error:', err);
    }
  };

  const handleDeleteMultipleCash = async (ids: string[], message?: string) => {
    if (!ids || ids.length === 0) return;
    setIsSubmitting(true);

    setCash((prev) => {
      const idSet = new Set(ids);
      const next = prev.filter((c) => !c.id || !idSet.has(c.id));
      return next;
    });

    if (session?.isDemo) {
      setIsSubmitting(false);
      showToast(message || `[Demo Mode] ${ids.length} cash transactions deleted in demo sandbox.`, 'info');
      return;
    }

    try {
      const res = await deleteMultipleCashFromDB(ids);
      if (res.success) {
        showToast(message || `${ids.length} cash transactions successfully deleted from local data & Supabase.`, 'success');
      } else {
        console.warn('Delete multiple cash warning:', res.error);
        showToast(message || `${ids.length} cash transactions successfully deleted from local data.`, 'info');
      }
    } catch (err) {
      console.warn('Delete multiple cash error:', err);
      showToast(message || `${ids.length} cash transactions successfully deleted from local data.`, 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAllMembersCash = async () => {
    setIsSubmitting(true);
    let memberTxCount = 0;

    setCash((prev) => {
      const next = prev.filter((c) => {
        const isMemberTx = c.jenis === 'Masuk' && (
          (c.nisn && c.nisn.trim() !== '-' && c.nisn.trim() !== '') ||
          (c.namaAnggota && c.namaAnggota !== 'Kas Organisasi') ||
          (c.namaSiswa && c.namaSiswa !== 'Kas Organisasi')
        );
        if (isMemberTx) {
          memberTxCount++;
        }
        return !isMemberTx;
      });
      return next;
    });

    if (session?.isDemo) {
      setIsSubmitting(false);
      showToast(`[Demo Mode] All member dues records (${memberTxCount} transactions) deleted from demo sandbox.`, 'info');
      return;
    }

    try {
      const res = await deleteAllMembersCashFromDB();
      if (res.success) {
        showToast(`All member dues records across all members (${memberTxCount} transactions) successfully deleted from local data & Supabase.`, 'success');
      } else {
        console.warn('Delete all members cash warning:', res.error);
        showToast(`All member dues records across all members (${memberTxCount} transactions) deleted from local data.`, 'info');
      }
    } catch (err) {
      console.warn('Delete all members cash error:', err);
      showToast(`All member dues records deleted from local data.`, 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAllCash = async () => {
    setIsSubmitting(true);
    const count = cash.length;
    const allIds = cash.map((c) => c.id).filter(Boolean) as string[];

    // 0. Safety: Save emergency snapshot and trigger auto-download before destructive reset
    if (cash.length > 0) {
      try {
        const timeSlug = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        downloadTextFile(`backup_darurat_buku_kas_${timeSlug}.json`, JSON.stringify(cash, null, 2), 'application/json');
        const backupKey = `robotics_backup_cash_${timeSlug}`;
        localStorage.setItem(backupKey, JSON.stringify(cash));
      } catch (err) {
        console.warn('Emergency cash backup note:', err);
      }
    }

    // 1. Optimistic instant local removal & localStorage sync
    setCash([]);
    if (session?.username) {
      const key = getAccountStorageKey(session.username, 'cash');
      localStorage.setItem(key, JSON.stringify([]));
      if (session.username === 'admin') {
        localStorage.setItem('robotics_cash', JSON.stringify([]));
      }
    }

    // If in demo mode, do not delete from Supabase
    if (session?.isDemo) {
      setIsSubmitting(false);
      showToast(`[Demo Mode] All treasury transactions (${count} transactions) reset in demo sandbox.`, 'info');
      return;
    }

    // 2. Delete permanently from Supabase Cloud Database
    try {
      const res = await deleteAllCashFromDB(session?.username, allIds);
      if (res.success) {
        showToast(`✅ All treasury transaction records (${count} transactions) reset and permanently deleted from Supabase database!`, 'success');
      } else {
        showToast(`Treasury history reset locally (database note: ${res.error || 'ok'}).`, 'info');
      }
    } catch (err: any) {
      console.warn('Reset all cash error:', err);
      showToast(`Treasury history reset locally. Sync note: ${err?.message || err}`, 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCash = async (id?: string, index?: number, txObject?: CashTransaction) => {
    setIsSubmitting(true);
    let targetId = id;
    let removedItem: CashTransaction | undefined = txObject;

    setCash((prev) => {
      let next: CashTransaction[];
      if (targetId) {
        if (!removedItem) removedItem = prev.find((c) => c.id === targetId);
        next = prev.filter((c) => c.id !== targetId);
      } else if (txObject) {
        targetId = txObject.id;
        next = prev.filter((c) => {
          if (txObject.id && c.id === txObject.id) return false;
          return c !== txObject;
        });
      } else if (index !== undefined && prev[index]) {
        removedItem = prev[index];
        targetId = removedItem?.id;
        next = prev.filter((_, idx) => idx !== index);
      } else {
        next = prev;
      }
      return next;
    });

    if (session?.isDemo) {
      setIsSubmitting(false);
      showToast('[Demo Mode] Cash transaction deleted from demo sandbox.', 'info');
      return;
    }

    try {
      const idToDelete = targetId || removedItem?.id;
      if (idToDelete) {
        const res = await deleteCashFromDB(idToDelete);
        if (res.success) {
          showToast('Cash transaction deleted from local data & Supabase.', 'success');
        } else {
          console.warn('Supabase cash delete note:', res.error);
          showToast('Cash transaction deleted from local data.', 'info');
        }
      } else {
        showToast('Cash transaction deleted successfully.', 'info');
      }
    } catch (dbErr) {
      console.warn('Supabase cash delete error:', dbErr);
      showToast('Cash transaction deleted from local data.', 'info');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Organization Handlers (Ekstrakurikuler Robotic MAN 2 Kota Bekasi)
  // ----------------------------------------------------
  const handleSelectOrganization = (
    org: Organization, 
    initialTab?: MainTabType
  ) => {
    setActiveOrgId(org.id);
    setActiveOrganizationId(session?.username, org.id);

    const loadedM = loadOrgMembers(org.id, session?.username, session?.isDemo);
    const loadedA = loadOrgAttendance(org.id, session?.username, session?.isDemo);
    const loadedC = loadOrgCash(org.id, session?.username, session?.isDemo);
    setMembers(loadedM);
    setAttendance(loadedA);
    setCash(loadedC);

    const userRoleStr = (session?.role || '').toLowerCase();
    const isAdminUser = userRoleStr === 'admin' || session?.bypassNisnVerification || userRoleStr.includes('admin');
    const sessionIsMember = 
      !isAdminUser && (
        userRoleStr === 'member' || 
        userRoleStr === 'club member' || 
        userRoleStr.includes('member') || 
        normalizeRole(session?.role) === 'anggota'
      );

    if (session && !sessionIsMember && org.role) {
      const updatedSession = { ...session, role: isAdminUser ? 'admin' : org.role };
      setSession(updatedSession);
      try {
        localStorage.setItem('robotics_auth', JSON.stringify(updatedSession));
      } catch {}
    } else if (session && sessionIsMember) {
      const updatedSession = { ...session, role: 'Club Member' };
      setSession(updatedSession);
      try {
        localStorage.setItem('robotics_auth', JSON.stringify(updatedSession));
      } catch {}
    }

    if (initialTab) {
      setActiveTab(initialTab);
    } else if (sessionIsMember) {
      setActiveTab('calendar');
    } else if (isAdminUser) {
      setActiveTab('dashboard');
    }
    showToast(`Opening club room: ${org.name}`, 'info');
  };

  const handleCreateOrgSuccess = (newOrg: Organization) => {
    const updated = [newOrg, ...userOrganizations.filter((o) => o.id !== newOrg.id)];
    setUserOrganizations(updated);
    saveUserOrganizations(session?.username, updated);
    handleSelectOrganization(newOrg);
    showToast(`New club room "${newOrg.name}" created successfully!`, 'success');
  };

  const handleJoinOrgSuccess = (org: Organization, selectedRole: string) => {
    const joinedOrg: Organization = {
      ...org,
      role: selectedRole,
    };
    const updated = [joinedOrg, ...userOrganizations.filter((o) => o.id !== org.id)];
    setUserOrganizations(updated);
    saveUserOrganizations(session?.username, updated);
    handleSelectOrganization(joinedOrg);
    showToast(`Successfully joined "${org.name}" as ${selectedRole}!`, 'success');
  };

  const handleSaveOrgCustomization = (updatedOrg: Organization) => {
    const updatedList = userOrganizations.map((o) => (o.id === updatedOrg.id ? updatedOrg : o));
    setUserOrganizations(updatedList);
    saveUserOrganizations(session?.username, updatedList);
    updateKnownOrganization(updatedOrg.id, updatedOrg);

    if (updatedOrg.id === activeOrgId && session && updatedOrg.role) {
      const updatedSession = { ...session, role: updatedOrg.role };
      setSession(updatedSession);
      try {
        localStorage.setItem('robotics_auth', JSON.stringify(updatedSession));
      } catch {}
    }
    showToast(`Room customization for "${updatedOrg.name}" saved!`, 'success');
  };

  const handleResetOrgData = (orgId: string) => {
    localStorage.removeItem(`org_${orgId}_members`);
    localStorage.removeItem(`org_${orgId}_attendance`);
    localStorage.removeItem(`org_${orgId}_cash`);
    if (orgId === activeOrgId) {
      setMembers([]);
      setAttendance([]);
      setCash([]);
    }
    showToast('Roster, attendance, and treasury records for this room have been cleared.', 'info');
  };

  const handleLeaveOrganization = (orgId: string) => {
    if (userOrganizations.length <= 1) {
      showToast('Cannot leave your only club room.', 'error');
      return;
    }
    const targetOrg = userOrganizations.find((o) => o.id === orgId);
    const updated = userOrganizations.filter((o) => o.id !== orgId);
    setUserOrganizations(updated);
    saveUserOrganizations(session?.username, updated);

    if (activeOrgId === orgId) {
      handleSelectOrganization(updated[0]);
    }
    showToast(`You left room "${targetOrg?.name || orgId}".`, 'info');
  };

  // ----------------------------------------------------
  // Auth Handlers
  // ----------------------------------------------------
  const handleLogin = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem('robotics_auth', JSON.stringify(newSession));
    localStorage.setItem('robotics_saved_session', JSON.stringify(newSession));
    
    // Refresh user's organizations
    const orgs = getUserOrganizations(newSession.username);
    setUserOrganizations(orgs);

    const initialOrgId = getActiveOrganizationId(newSession.username) || orgs[0]?.id || DEFAULT_ORGANIZATIONS[0].id;
    setActiveOrgId(initialOrgId);

    // Immediately isolate and load the authenticated account's data
    const loadedMembers = loadOrgMembers(initialOrgId, newSession.username, newSession.isDemo);
    const loadedAtt = loadOrgAttendance(initialOrgId, newSession.username, newSession.isDemo);
    const loadedCash = loadOrgCash(initialOrgId, newSession.username, newSession.isDemo);
    setMembers(loadedMembers);
    setAttendance(loadedAtt);
    setCash(loadedCash);

    // Route dynamic starting tab based strictly on role
    const canonical = getCanonicalRole(newSession);
    if (canonical === 'member') {
      setActiveTab('calendar');
    } else {
      setActiveTab('dashboard');
    }
    showToast(`Welcome, ${newSession.name}! Session signed in successfully.`, 'success');
  };

  const handleLogout = () => {
    setIsLogoutModalOpen(true);
  };

  const confirmLogout = async () => {
    try {
      const supa = getSupabase();
      await supa.auth.signOut();
    } catch (e) {
      console.warn('Supabase sign out error:', e);
    }
    setSession(null);
    localStorage.removeItem('robotics_auth');
    localStorage.removeItem('robotics_saved_session');
    setMembers([]);
    setAttendance([]);
    setCash([]);
    setIsLogoutModalOpen(false);
    setIsProfileModalOpen(false);
    showToast('You have signed out successfully.', 'info');
  };

  // If user is not logged in, render the Login View directly
  if (!session) {
    return <LoginView onLoginSuccess={handleLogin} />;
  }

  // Check whether active session has member role (General Student Member)
  const isMember = (() => {
    if (!session) return false;
    const canonical = getCanonicalRole(session);
    return canonical === 'member';
  })();

  // Cek apakah akun member sudah diverifikasi data NISN dan Tanggal Lahirnya
  // Admin role, credentials bypass, and Demo accounts have relaxed restrictions for UI/navigation testing
  const isMemberVerified = Boolean(
    !isMember ||
    session?.isDemo ||
    session?.role?.toLowerCase() === 'admin' ||
    session?.bypassNisnVerification ||
    session?.isVerifiedMember ||
    (session?.nisn && session?.nisn.trim().length >= 8 && session?.birthDate)
  );

  // Jika akun adalah siswa / member dan belum diverifikasi, tampilkan StudentVerificationModal wajib
  if (isMember && !isMemberVerified) {
    return (
      <div className="min-h-screen w-full bg-[#0F172A] flex items-center justify-center p-4 font-sans">
        {/* Toast Notification */}
        <AnimatePresence>
          {toastMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 max-w-md ${
                toastMessage.type === 'success'
                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20'
                  : toastMessage.type === 'error'
                  ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20'
                  : 'bg-slate-900 text-white border-slate-800 shadow-slate-900/20'
              }`}
            >
              {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
              {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
              {toastMessage.type === 'info' && <Database className="w-4 h-4 shrink-0" />}
              <span className="leading-snug">{toastMessage.text}</span>
            </motion.div>
          )}
        </AnimatePresence>

        <StudentVerificationModal
          isOpen={true}
          session={session}
          members={members}
          onVerificationSuccess={(verifiedMember, updatedSession) => {
            setSession(updatedSession);
            try {
              localStorage.setItem('robotics_auth', JSON.stringify(updatedSession));
            } catch {}
            // Update daftar member lokal agar ter-sync
            setMembers((prev) =>
              prev.map((m) =>
                m.nisn === verifiedMember.nisn || (m.id_member && m.id_member === verifiedMember.id_member)
                  ? { ...m, isVerified: true, birthDate: verifiedMember.birthDate }
                  : m
              )
            );
            showToast(`Student identity for ${verifiedMember.fullName} (NISN: ${verifiedMember.nisn}) has been verified successfully!`, 'success');
          }}
          onSkip={session?.isDemo ? () => {
            const updatedSession: UserSession = {
              ...session,
              isVerifiedMember: true,
            };
            setSession(updatedSession);
            try {
              localStorage.setItem('robotics_auth', JSON.stringify(updatedSession));
            } catch {}
            showToast('Verification skipped temporarily (Demo/Testing mode). You may now access the student portal.', 'info');
          } : undefined}
          onLogout={confirmLogout}
        />
      </div>
    );
  }





  return (
    <div className="min-h-screen w-full bg-[#F8FAFC] text-[#141414] flex flex-col md:flex-row font-sans">
      
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 max-w-md ${
              toastMessage.type === 'success'
                ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-600/20'
                : toastMessage.type === 'error'
                ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20'
                : 'bg-slate-900 text-white border-slate-800 shadow-slate-900/20'
            }`}
          >
            {toastMessage.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            {toastMessage.type === 'info' && <Database className="w-4 h-4 shrink-0" />}
            <span className="leading-snug">{toastMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Top Header (hidden on md+) */}
      <MobileHeader
        session={session}
        currentTheme={currentTheme}
        onThemeChange={handleThemeChange}
        isSupabaseConnected={isSupabaseConnected}
        onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
        onOpenProfileSettings={() => setIsProfileModalOpen(true)}
        onOpenRoleManagement={() => setIsRoleManagementOpen(true)}
        onLogout={handleLogout}
        onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        activeOrganization={activeOrganization}
      />

      {/* Desktop Left Sidebar & Mobile Drawer (collapsible & responsive) */}
      <Sidebar
        session={session}
        activeTab={activeTab}
        onTabChange={handleSidebarTabSelect}
        membersCount={members.length}
        attendanceCount={attendance.length}
        cashCount={cash.length}
        assignmentsCount={assignmentsCount}
        onOpenProfileSettings={() => setIsProfileModalOpen(true)}
        onOpenRoleManagement={() => setIsRoleManagementOpen(true)}
        onLogout={handleLogout}
        isOpenDesktop={isSidebarOpen}
        onToggleDesktop={toggleSidebar}
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        unreadNotificationsCount={unreadNotificationsCount}
        onOpenNotifications={() => setIsNotificationModalOpen(true)}
        onOpenAnnouncements={() => setIsAnnouncementsOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto bg-[#F8FAFC]">
        {/* Desktop & Tablet Top Navigation Bar (md+) */}
        <Navbar
          session={session}
          activeTab={activeTab}
          onTabChange={handleSidebarTabSelect}
          membersCount={members.length}
          attendanceCount={attendance.length}
          cashCount={cash.length}
          assignmentsCount={assignmentsCount}
          isSyncing={isSyncing}
          isSupabaseConnected={isSupabaseConnected}
          onRefreshData={handleSyncAllData}
          onOpenProfileSettings={() => setIsProfileModalOpen(true)}
          onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          onOpenRoleManagement={() => setIsRoleManagementOpen(true)}
          onOpenNotifications={() => setIsNotificationModalOpen(true)}
          unreadNotificationsCount={unreadNotificationsCount}
          onLogout={handleLogout}
          activeOrganization={activeOrganization}
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={toggleSidebar}
          displayDateStr={displayDateStr}
          onOpenDateConfig={() => {
            setDateAcademicModalTab('date');
            setIsDateAcademicModalOpen(true);
          }}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          showAllTabs={false}
        />

        <main className="flex-1 w-full px-3 sm:px-6 lg:px-8 py-3.5 sm:py-6 space-y-4 sm:space-y-5 pb-28 sm:pb-8 max-w-full overflow-x-hidden">
          {/* Demo Sandbox Isolation Banner */}
          {session?.isDemo && (
            <div className="bg-gradient-to-r from-amber-50 via-amber-100/70 to-orange-50 border border-amber-300/90 rounded-2xl p-3 sm:p-3.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950">
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-xl bg-amber-200 border border-amber-300 text-amber-900 flex items-center justify-center shrink-0 font-bold text-sm shadow-2xs mt-0.5">
                  🧪
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap min-w-0">
                    <span className="font-extrabold text-amber-950 text-xs sm:text-sm tracking-tight shrink-0">
                      Demo Sandbox Active:
                    </span>
                    <span 
                      className="inline-block max-w-[140px] xs:max-w-[190px] sm:max-w-xs truncate px-2 py-0.5 rounded-md bg-amber-200/90 text-amber-950 font-mono text-[10px] sm:text-[11px] font-bold border border-amber-300/80 align-middle"
                      title={`${session.role} (${session.username})`}
                    >
                      {session.role} ({session.username})
                    </span>
                    <span className="text-emerald-800 font-semibold bg-emerald-50 px-2 py-0.5 rounded text-[10px] border border-emerald-200 flex items-center gap-1 shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span>Isolated Sandbox</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-amber-900/80 mt-1 leading-relaxed break-words max-w-full">
                    Testing sandbox active. Data is stored strictly in isolated local storage and separated from real production accounts and Supabase.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-xl bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 font-bold text-xs shadow-2xs transition cursor-pointer active:scale-95 text-center flex items-center justify-center"
                >
                  Exit Demo / Switch Account
                </button>
              </div>
            </div>
          )}

          {/* Main Tab Content with Smooth AnimatePresence Transitions */}
          <AnimatePresence mode="wait">

            {/* Tab 0: Admin Dashboard Overview (Protected by Strict AdminRouteGuard) */}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <AdminRouteGuard
                  session={session}
                  allowExecutiveBoard={true}
                  onRedirectToPortal={() => setActiveTab('calendar')}
                  onRedirectToLogin={handleLogout}
                >
                  <AdminDashboardOverview
                    session={session}
                    members={members}
                    attendance={attendance}
                    cash={cash}
                    announcements={announcements}
                    isSupabaseConnected={isSupabaseConnected}
                    onNavigateToTab={(tab) => {
                      playClickTick();
                      setActiveTab(tab);
                    }}
                    onOpenAddMemberModal={() => {
                      setMemberToEdit(null);
                      setIsMemberFormOpen(true);
                    }}
                    onOpenUniversalUploadModal={() => setIsUniversalUploadOpen(true)}
                    onOpenPreRegistrationModal={() => setIsPreRegistrationOpen(true)}
                    onOpenAnnouncementsModal={() => setIsAnnouncementsOpen(true)}
                    onOpenAssignmentsModal={() => setActiveTab('assignments')}
                    onOpenSupabaseModal={() => {
                      if (!hasSessionPermission(session, 'system:configure') && session?.role !== 'admin' && session?.jabatan !== 'president') {
                        showToast('Access restricted: Only Primary Administrator can configure database credentials.', 'error');
                        return;
                      }
                      setIsSupabaseModalOpen(true);
                    }}
                    onSyncAllData={handleSyncAllData}
                    isSyncing={isSyncing}
                    onShowToast={showToast}
                  />
                </AdminRouteGuard>
              </motion.div>
            )}

            {/* Tab 1: Member Directory (Members) */}
            {activeTab === 'members' && (
              <motion.div
                key="members"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <MembersTab
                  members={members}
                  isDemo={Boolean(session?.isDemo)}
                  currentAcademicYear={currentAcademicYear}
                  isAcademicYearAuto={isAcademicYearAuto}
                  onOpenDateAcademicModal={(tab) => {
                    setDateAcademicModalTab(tab || 'academic');
                    setIsDateAcademicModalOpen(true);
                  }}
                  onOpenAddModal={() => {
                    setMemberToEdit(null);
                    setIsMemberFormOpen(true);
                  }}
                  onOpenEditModal={(member) => {
                    setMemberToEdit(member);
                    setIsMemberFormOpen(true);
                  }}
                  onOpenDetailModal={(member) => {
                    setSelectedMemberDetail(member);
                    setIsDetailOpen(true);
                  }}
                  onDeleteMember={handleDeleteMember}
                  onResetDefaultMembers={handleResetDefaultMembers}
                  onClearAllMembers={handleClearAllMembers}
                  onMembersUpdated={(updated) => {
                    setMembers(updated);
                    if (session?.isDemo) {
                      const cleanUser = (session.username || 'demo').trim().toLowerCase();
                      localStorage.setItem(`robotics_demo_sandbox_${cleanUser}_members`, JSON.stringify(updated));
                      showToast(`[Demo Sandbox] Member roster updated (${updated.length} students stored in sandbox).`, 'info');
                      return;
                    }
                    localStorage.setItem('robotics_members', JSON.stringify(updated));
                    if (activeOrgId) {
                      localStorage.setItem(`org_${activeOrgId}_members`, JSON.stringify(updated));
                    }
                    if (session?.username) {
                      const key = getAccountStorageKey(session.username, 'members');
                      localStorage.setItem(key, JSON.stringify(updated));
                    }
                    showToast(`Member roster updated (${updated.length} members enrolled).`, 'success');
                  }}
                  onRefreshData={fetchAllData}
                  isSyncing={isSyncing}
                  currentUserRole={session?.role}
                  session={session}
                />
              </motion.div>
            )}

            {/* Tab 2: Absensi Kehadiran (Attendance) */}
            {activeTab === 'attendance' && (
              <motion.div
                key="attendance"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {canonicalRole === 'member' && session ? (
                  <MemberAttendanceView
                    member={currentMemberForSession}
                    session={session}
                    todayDate={activeAttendanceDate}
                    existingAttendance={currentMemberExistingAttendance}
                    onSaveAttendance={async (record) => {
                      await handleAddAttendance(record);
                      showToast(`Attendance recorded: ${record.status}`, 'success');
                    }}
                  />
                ) : (
                  <AttendanceTab
                    members={members}
                    attendance={attendance}
                    activeDate={activeAttendanceDate}
                    isDemo={Boolean(session?.isDemo)}
                    isSubmitting={isSubmitting}
                    onAddAttendance={handleAddAttendance}
                    onBulkAttendance={handleBulkAttendance}
                    onDeleteAttendance={handleDeleteAttendance}
                    onResetMemberAttendance={handleResetMemberAttendance}
                    onResetDateAttendance={handleResetDateAttendance}
                    onResetAllAttendance={handleResetAllAttendance}
                    onAttendanceUpdated={(updated) => {
                      setAttendance(updated);
                      if (session?.isDemo) {
                        const cleanUser = (session.username || 'demo').trim().toLowerCase();
                        localStorage.setItem(`robotics_demo_sandbox_${cleanUser}_attendance`, JSON.stringify(updated));
                        showToast(`[Demo Sandbox] Attendance records updated (${updated.length} entries stored in sandbox).`, 'info');
                        return;
                      }
                      if (activeOrgId) {
                        localStorage.setItem(`org_${activeOrgId}_attendance`, JSON.stringify(updated));
                      }
                      if (session?.username) {
                        const key = getAccountStorageKey(session.username, 'attendance');
                        localStorage.setItem(key, JSON.stringify(updated));
                        if (session.username === 'admin') {
                          localStorage.setItem('robotics_attendance', JSON.stringify(updated));
                        }
                      } else {
                        localStorage.setItem('robotics_attendance', JSON.stringify(updated));
                      }
                      showToast(`Attendance records updated (${updated.length} entries).`, 'success');
                    }}
                    onRefreshData={fetchAllData}
                    isSyncing={isSyncing}
                    currentUserRole={session?.role}
                  />
                )}
              </motion.div>
            )}

            {/* Tab 3: Kas Bendahara (Cash) */}
            {activeTab === 'cash' && (
              <motion.div
                key="cash"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                id="tab-kas"
                className="space-y-5"
              >
                <CashTab
                  members={members}
                  cash={cash}
                  activeMonthKey={activeCashMonthKey}
                  isDemo={Boolean(session?.isDemo)}
                  isSubmitting={isSubmitting}
                  onAddCash={handleAddCash}
                  onBulkAddCash={handleBulkAddCash}
                  onCancelMemberCash={handleCancelMemberCash}
                  onResetPeriodCash={handleResetPeriodCash}
                  onDeleteCash={handleDeleteCash}
                  onDeleteMultipleCash={handleDeleteMultipleCash}
                  onDeleteAllMembersCash={handleDeleteAllMembersCash}
                  onResetAllCash={handleResetAllCash}
                  onCashUpdated={(updated) => {
                    setCash(updated);
                    if (session?.isDemo) {
                      const cleanUser = (session.username || 'demo').trim().toLowerCase();
                      localStorage.setItem(`robotics_demo_sandbox_${cleanUser}_cash`, JSON.stringify(updated));
                      showToast(`[Demo Sandbox] Treasury records updated (${updated.length} transactions stored in sandbox).`, 'info');
                      return;
                    }
                    if (activeOrgId) {
                      localStorage.setItem(`org_${activeOrgId}_cash`, JSON.stringify(updated));
                    }
                    if (session?.username) {
                      const key = getAccountStorageKey(session.username, 'cash');
                      localStorage.setItem(key, JSON.stringify(updated));
                      if (session.username === 'admin') {
                        localStorage.setItem('robotics_cash', JSON.stringify(updated));
                      }
                    } else {
                      localStorage.setItem('robotics_cash', JSON.stringify(updated));
                    }
                    showToast(`Club treasury records updated (${updated.length} transactions).`, 'success');
                  }}
                  onRefreshData={fetchAllData}
                  isSyncing={isSyncing}
                  currentUserRole={session?.role}
                  currentUserTitle={session?.jabatan}
                  session={session}
                />
              </motion.div>
            )}

            {/* Tab 4: Kalender Kegiatan & Kas (Calendar Dashboard) */}
            {activeTab === 'calendar' && (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                <CalendarTab
                  members={members}
                  attendance={attendance}
                  cash={cash}
                  onNavigateToAttendanceDate={(dateStr) => {
                    setActiveAttendanceDate(dateStr);
                    setActiveTab('attendance');
                  }}
                  onNavigateToCashMonth={(monthKey) => {
                    setActiveCashMonthKey(monthKey);
                    setActiveTab('cash');
                  }}
                />
              </motion.div>
            )}

            {/* Tab 5: Assignments & Challenges (Student View for members, Admin Grading for officers/advisors) */}
            {activeTab === 'assignments' && (
              <motion.div
                key="assignments"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="space-y-5"
              >
                {canonicalRole === 'member' && session ? (
                  <StudentAssignmentsView
                    session={session}
                    onShowToast={showToast}
                    onAssignmentsCountChange={setAssignmentsCount}
                  />
                ) : (
                  <AdminTasksGradingView
                    members={members}
                    session={session}
                    onShowToast={showToast}
                    onAssignmentsCountChange={setAssignmentsCount}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Complete Official Horizontal Footer - Edge to Edge */}
        <AppFooter 
          className="pb-24 md:pb-4" 
          onOpenJoinModal={() => setIsJoinOrgModalOpen(true)} 
        />
      </div>

      {/* Member Form Modal (Add / Edit) */}
      <MemberFormModal
        isOpen={isMemberFormOpen}
        onClose={() => {
          setIsMemberFormOpen(false);
          setMemberToEdit(null);
        }}
        onSave={handleSaveMember}
        memberToEdit={memberToEdit}
        initialData={memberToEdit}
        isSubmitting={isSubmitting}
      />

      {/* Member Detail Modal */}
      <MemberDetailModal
        isOpen={isDetailOpen}
        onClose={() => {
          setIsDetailOpen(false);
          setSelectedMemberDetail(null);
        }}
        member={selectedMemberDetail}
        attendanceHistory={attendance || []}
        currentUserSession={session}
        canManageRoles={canonicalRole === 'admin'}
        onRoleTitleChange={handleRoleTitleChange}
        onStatusChange={handleMemberStatusChange}
        onEdit={hasPermission(session?.role, 'members:edit') ? (member) => {
          setIsDetailOpen(false);
          setMemberToEdit(member);
          setIsMemberFormOpen(true);
        } : undefined}
      />

      {/* Universal Data Upload Modal (Roster, Attendance, Cash) */}
      <UniversalDataUploadModal
        isOpen={isUniversalUploadOpen}
        onClose={() => setIsUniversalUploadOpen(false)}
        defaultTarget="members"
        existingMembers={members}
        existingCash={cash}
        existingAttendance={attendance}
        isDemo={Boolean(session?.isDemo)}
        onMembersUpdated={(updated) => {
          setMembers(updated);
          localStorage.setItem('robotics_members', JSON.stringify(updated));
          showToast(`Member roster updated (${updated.length} members enrolled).`, 'success');
        }}
        onCashUpdated={(updated) => {
          setCash(updated);
          localStorage.setItem('robotics_cash', JSON.stringify(updated));
          showToast(`Club treasury records updated (${updated.length} transactions).`, 'success');
        }}
        onAttendanceUpdated={(updated) => {
          setAttendance(updated);
          localStorage.setItem('robotics_attendance', JSON.stringify(updated));
          showToast(`Attendance records updated (${updated.length} entries).`, 'success');
        }}
        onShowToast={showToast}
      />

      {/* Profile Settings Modal */}
      {session && (
        <ProfileSettingsModal
          isOpen={isProfileModalOpen}
          onClose={() => setIsProfileModalOpen(false)}
          session={session}
          onUpdateSession={setSession}
          onShowToast={showToast}
          currentTheme={currentTheme}
          onThemeChange={handleThemeChange}
          activeOrganization={activeOrganization}
          onOpenJoinModal={() => {
            setIsProfileModalOpen(false);
            setIsJoinOrgModalOpen(true);
          }}
          onOpenCreateModal={() => {
            setIsProfileModalOpen(false);
            setIsCreateOrgModalOpen(true);
          }}
          onOpenEditModal={(org) => {
            setIsProfileModalOpen(false);
            setOrgToEdit(org);
            setIsEditOrgModalOpen(true);
          }}
          onOpenRoleManagement={() => {
            setIsProfileModalOpen(false);
            setIsRoleManagementOpen(true);
          }}
        />
      )}

      {/* Logout Confirmation Modal */}
      <AnimatePresence>
        {isLogoutModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-sm p-6 shadow-2xl space-y-4 text-center relative"
            >
              <button
                onClick={() => setIsLogoutModalOpen(false)}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-xs">
                <LogOut className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Confirm Sign Out
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Are you sure you want to sign out from the session for <strong>{session?.name}</strong>?
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsLogoutModalOpen(false)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="confirmLogoutBtn"
                  onClick={confirmLogout}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition active:scale-95 cursor-pointer"
                >
                  Sign Out
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Supabase Setup & Diagnostics Modal */}
      <SupabaseSetupModal
        isOpen={isSupabaseModalOpen}
        onClose={() => setIsSupabaseModalOpen(false)}
        onRefreshData={fetchAllData}
        isTablesCreated={isTablesCreated}
        members={members}
        attendance={attendance}
        cash={cash}
        isDemo={Boolean(session?.isDemo)}
        onShowToast={showToast}
      />

      {/* Date & Academic Year Configuration Modal */}
      <DateTimeConfigModal
        isOpen={isDateAcademicModalOpen}
        onClose={() => setIsDateAcademicModalOpen(false)}
        config={dateAcademicConfig}
        onSave={handleSaveDateAcademicConfig}
        initialTab={dateAcademicModalTab}
      />

      {/* Persistent Notification Center Modal */}
      <NotificationModal
        isOpen={isNotificationModalOpen}
        onClose={() => setIsNotificationModalOpen(false)}
        notifications={notifications}
        onMarkAsRead={handleMarkAsRead}
        onMarkAllAsRead={handleMarkAllAsRead}
        onClearAll={handleClearAllNotifications}
        onDeleteNotification={handleDeleteNotification}
        onNavigateToTab={(tab) => {
          setActiveTab(tab);
        }}
      />

      {/* RBAC Role & Access Control Management Modal (Strictly Admin Only) */}
      {session && canonicalRole === 'admin' && (
        <RoleManagementModal
          isOpen={isRoleManagementOpen}
          onClose={() => setIsRoleManagementOpen(false)}
          currentUserSession={session}
          onSessionRoleSwitch={handleSessionRoleSwitch}
          onRefreshData={fetchAllData}
        />
      )}

      {/* Organization & Enrollment Modals */}
      <EditOrganizationModal
        isOpen={isEditOrgModalOpen}
        onClose={() => {
          setIsEditOrgModalOpen(false);
          setOrgToEdit(null);
        }}
        organization={orgToEdit || activeOrganization}
        onSave={handleSaveOrgCustomization}
        onResetOrgData={handleResetOrgData}
        currentUserRole={session?.role}
        session={session}
      />

      {/* Admin Pre-Registration CSV Staging Modal */}
      <AdminPreRegistrationModal
        isOpen={isPreRegistrationOpen}
        onClose={() => setIsPreRegistrationOpen(false)}
        onShowToast={showToast}
      />

      {/* Announcements & Agenda Modal */}
      <AnnouncementsModal
        isOpen={isAnnouncementsOpen}
        onClose={() => setIsAnnouncementsOpen(false)}
        onShowToast={showToast}
        session={session}
      />

      {/* Mobile Bottom Navigation Bar */}
      <MobileBottomNav
        activeTab={activeTab}
        onTabChange={handleSidebarTabSelect}
        membersCount={members.length}
        attendanceCount={attendance.length}
        cashCount={cash.length}
        assignmentsCount={assignmentsCount}
        session={session}
        isMember={isMember}
      />

    </div>
  );
}
