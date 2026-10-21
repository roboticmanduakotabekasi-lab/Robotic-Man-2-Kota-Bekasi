import React, { useState } from 'react';
import { 
  Bot, 
  LogOut, 
  RefreshCw, 
  Check, 
  Settings, 
  Users,
  CalendarCheck, 
  Wallet, 
  CalendarDays, 
  BookOpen,
  LayoutDashboard,
  ShieldCheck,
  Bell,
  Calendar,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft
} from 'lucide-react';
import { motion } from 'motion/react';
import { UserSession, MainTabType } from '../types';
import { ThemeColor, THEMES } from '../utils/theme';
import { Organization } from '../utils/organizerStore';
import { getCanonicalRole, CanonicalUserRole, getRoleMetadata } from '../utils/rbac';
import { playClickTick } from '../utils/audioFeedback';

export interface NavbarProps {
  session: UserSession | null;
  activeTab?: MainTabType;
  onTabChange?: (tab: MainTabType) => void;
  membersCount?: number;
  attendanceCount?: number;
  cashCount?: number;
  assignmentsCount?: number;
  isSyncing?: boolean;
  isSupabaseConnected?: boolean;
  onRefreshData?: () => Promise<void> | void;
  onOpenProfileSettings?: () => void;
  onOpenSupabaseModal?: () => void;
  onOpenRoleManagement?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  onLogout?: () => void;
  // Layout & Contextual Navigation
  activeOrganization?: Organization;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  displayDateStr?: string;
  onOpenDateConfig?: () => void;
  // Theme & Appearance
  currentTheme?: ThemeColor;
  onThemeChange?: (theme: ThemeColor) => void;
  showAllTabs?: boolean;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  activeTab = 'dashboard',
  onTabChange,
  membersCount = 0,
  attendanceCount = 0,
  cashCount = 0,
  assignmentsCount = 0,
  isSyncing = false,
  isSupabaseConnected = true,
  onRefreshData,
  onOpenProfileSettings,
  onOpenSupabaseModal,
  onOpenRoleManagement,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  onLogout,
  activeOrganization,
  isSidebarOpen,
  onToggleSidebar,
  displayDateStr,
  onOpenDateConfig,
  currentTheme = 'indigo',
  showAllTabs = false,
  className = '',
}) => {
  const [justRefreshed, setJustRefreshed] = useState(false);
  const themeConfig = THEMES[currentTheme] || THEMES.indigo;

  // Resolve role dynamically (admin, executive_board, advisor, member)
  const canonicalRole: CanonicalUserRole = getCanonicalRole(session);

  const handleRefreshClick = async () => {
    if (!onRefreshData || isSyncing) return;
    playClickTick();
    try {
      await onRefreshData();
      setJustRefreshed(true);
      setTimeout(() => setJustRefreshed(false), 2000);
    } catch (e) {
      console.error('Navbar refresh error:', e);
    }
  };

  // Role-filtered navigation tab items
  const getNavTabs = () => {
    if (canonicalRole === 'member') {
      return [
        {
          key: 'calendar' as const,
          label: 'Calendar',
          icon: CalendarDays,
          count: null,
          title: 'Activity Calendar & Events'
        },
        {
          key: 'attendance' as const,
          label: 'My Attendance',
          icon: CalendarCheck,
          count: attendanceCount > 0 ? attendanceCount : null,
          title: 'Daily Attendance Check-ins'
        },
        {
          key: 'assignments' as const,
          label: 'Tasks & Challenges',
          icon: BookOpen,
          count: assignmentsCount > 0 ? assignmentsCount : null,
          title: 'Challenges & Course Submissions'
        },
      ];
    }

    // Admin, Executive Board, and Advisor tabs
    return [
      {
        key: 'dashboard' as const,
        label: 'Dashboard',
        icon: LayoutDashboard,
        count: null,
        title: 'System Overview & Realtime Analytics'
      },
      {
        key: 'members' as const,
        label: 'Members',
        icon: Users,
        count: membersCount > 0 ? membersCount : null,
        title: 'Student Master Directory'
      },
      {
        key: 'attendance' as const,
        label: 'Attendance',
        icon: CalendarCheck,
        count: attendanceCount > 0 ? attendanceCount : null,
        title: 'Meeting Attendance Tracking'
      },
      {
        key: 'assignments' as const,
        label: canonicalRole === 'advisor' ? 'Curriculum' : 'Tasks & Grading',
        icon: BookOpen,
        count: assignmentsCount > 0 ? assignmentsCount : null,
        title: 'Assignments & Student Evaluations'
      },
      {
        key: 'cash' as const,
        label: 'Treasury',
        icon: Wallet,
        count: cashCount > 0 ? cashCount : null,
        title: 'Financial Ledger & Club Dues'
      },
      {
        key: 'calendar' as const,
        label: 'Calendar',
        icon: CalendarDays,
        count: null,
        title: 'Activity Schedule & Timelines'
      },
    ];
  };

  const navTabs = getNavTabs();

  return (
    <header className={`hidden md:block sticky top-0 z-20 w-full bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-2xs select-none ${className}`}>
      <div className="w-full px-3 sm:px-4 lg:px-6">
        <div className="flex items-center justify-between h-14 sm:h-15 gap-2 sm:gap-3">
          
          {/* ========================================================= */}
          {/* LEFT: Sidebar Toggle + Brand Identity + Active Club Room */}
          {/* ========================================================= */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
            {/* Optional Sidebar Toggle Button */}
            {onToggleSidebar && (
              <button
                type="button"
                id="navbarSidebarToggleBtn"
                onClick={() => {
                  playClickTick();
                  onToggleSidebar();
                }}
                className="p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-slate-50/80 hover:bg-slate-100 text-slate-600 hover:text-slate-900 transition-all cursor-pointer flex items-center justify-center shrink-0 active:scale-95"
                title={isSidebarOpen ? 'Collapse Navigation Sidebar' : 'Expand Navigation Sidebar'}
                aria-label={isSidebarOpen ? 'Collapse Navigation Sidebar' : 'Expand Navigation Sidebar'}
              >
                {isSidebarOpen ? (
                  <PanelLeftClose className="w-4 h-4 text-blue-600" />
                ) : (
                  <PanelLeftOpen className="w-4 h-4 text-slate-600" />
                )}
              </button>
            )}

            {/* Breadcrumb & Active Section Indicator */}
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight truncate">
                Robotic MAN 2 Kota Bekasi
              </span>
              <span className="text-slate-300 hidden sm:inline" aria-hidden="true">/</span>
              <span className="text-xs text-blue-600 font-semibold hidden sm:inline truncate capitalize bg-blue-50/80 px-2 py-0.5 rounded-md border border-blue-200/60">
                {activeTab ? activeTab.replace('_', ' ') : 'Dashboard'}
              </span>
            </div>
          </div>

          {/* ========================================================= */}
          {/* CENTER: Clean Navigation Links (Visible when collapsed)   */}
          {/* ========================================================= */}
          {session && onTabChange && (!isSidebarOpen || showAllTabs) && (
            <nav 
              aria-label="Primary Navigation Bar" 
              className="hidden lg:flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200/80 gap-1 overflow-x-auto"
            >
              {navTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    id={`navTab-${tab.key}`}
                    type="button"
                    onClick={() => {
                      playClickTick();
                      onTabChange(tab.key);
                    }}
                    title={tab.title}
                    className={`relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer select-none whitespace-nowrap ${
                      isActive
                        ? 'bg-white text-slate-900 shadow-2xs font-semibold'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span>{tab.label}</span>
                    {tab.count !== null && tab.count > 0 && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] font-mono text-slate-500 bg-slate-200/60 shrink-0">
                        {tab.count > 99 ? '99+' : tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          )}

          {/* ========================================================= */}
          {/* RIGHT: Quick Tools & Account Controls                     */}
          {/* ========================================================= */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Date Academic Config Trigger Pill */}
            {onOpenDateConfig && displayDateStr && (
              <button
                type="button"
                id="navbarDateSelectBtn"
                onClick={() => {
                  playClickTick();
                  onOpenDateConfig();
                }}
                className="hidden md:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer shadow-2xs"
                title="Configure active date and academic term"
              >
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span className="hidden xl:inline font-mono text-[11px] font-semibold">{displayDateStr}</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>
            )}

            {/* Realtime Supabase Sync Button */}
            {onRefreshData && (
              <button
                type="button"
                id="navbarRefreshDataBtn"
                onClick={handleRefreshClick}
                disabled={isSyncing}
                title={isSupabaseConnected ? 'Synchronize live records with Supabase Cloud' : 'Cloud sync paused'}
                className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all duration-150 cursor-pointer select-none whitespace-nowrap active:scale-95 ${
                  isSyncing || justRefreshed
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs'
                    : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700 shadow-2xs'
                }`}
              >
                <div className="w-3.5 h-3.5 flex items-center justify-center shrink-0">
                  {isSyncing ? (
                    <RefreshCw className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                  ) : justRefreshed ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                  )}
                </div>
                <span className="hidden sm:inline font-medium text-[11px]">
                  {isSyncing ? 'Syncing...' : justRefreshed ? 'Synced' : 'Sync'}
                </span>
              </button>
            )}



            {/* Notification Bell Center */}
            {onOpenNotifications && (
              <button 
                type="button"
                id="navbarNotificationBellBtn"
                onClick={() => {
                  playClickTick();
                  onOpenNotifications();
                }}
                className="relative p-1.5 sm:p-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-2xs"
                title="Notifications & System Broadcasts"
                aria-label="Notification Center"
              >
                <Bell className="w-3.5 h-3.5 text-slate-600" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-mono font-bold flex items-center justify-center ring-2 ring-white">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin RBAC Access Button (Strictly Admin Clearance Only) */}
            {canonicalRole === 'admin' && onOpenRoleManagement && (
              <button
                type="button"
                id="navbarRbacBtn"
                onClick={() => {
                  playClickTick();
                  onOpenRoleManagement();
                }}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer shadow-2xs"
                title="Role-Based Access Control (RBAC & SOP Roles)"
              >
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span className="font-bold text-[11px]">RBAC</span>
              </button>
            )}

            {/* User Profile Pill & Sign Out */}
            {session && (
              <div className="flex items-center gap-1.5 pl-1.5 border-l border-slate-200">
                <button
                  type="button"
                  id="navbarProfilePillBtn"
                  onClick={() => {
                    playClickTick();
                    onOpenProfileSettings?.();
                  }}
                  title="Profile & Account Settings"
                  className="flex items-center gap-2 p-1 sm:px-2 sm:py-1 rounded-xl hover:bg-slate-100/90 border border-transparent hover:border-slate-200 text-left transition group cursor-pointer"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold ring-2 ring-slate-200 shrink-0 shadow-2xs">
                    {session.name ? session.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div className="hidden xl:block min-w-0 max-w-[130px]">
                    <div className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition truncate flex items-center gap-1">
                      <span className="truncate">{session.name}</span>
                      {session.isDemo && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-100 text-amber-800 font-bold shrink-0">
                          Demo
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate">
                      {getRoleMetadata(session.role).shortTitle}
                    </div>
                  </div>
                  <Settings className="w-3.5 h-3.5 text-slate-400 group-hover:rotate-45 transition-transform duration-300 hidden sm:block shrink-0" />
                </button>

                {/* Direct Sign Out Button */}
                {onLogout && (
                  <button
                    type="button"
                    id="navbarSignOutBtn"
                    onClick={() => {
                      playClickTick();
                      onLogout();
                    }}
                    title="Sign Out"
                    className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-semibold transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden lg:inline ml-1">Sign Out</span>
                  </button>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
