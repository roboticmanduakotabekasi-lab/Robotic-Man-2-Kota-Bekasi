import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  LogOut, 
  Settings, 
  Users,
  CalendarCheck, 
  Wallet, 
  CalendarDays, 
  ShieldCheck, 
  PanelLeftClose, 
  X, 
  Info, 
  Bell, 
  BookOpen, 
  Megaphone, 
  LayoutDashboard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSession, MainTabType } from '../types';
import { playClickTick } from '../utils/audioFeedback';
import { AppInfoModal } from './AppInfoModal';
import { getRoleMetadata, getCanonicalRole, CanonicalUserRole, canManageAnnouncements } from '../utils/rbac';

export interface SidebarProps {
  session: UserSession | null;
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  membersCount?: number;
  attendanceCount?: number;
  cashCount?: number;
  assignmentsCount?: number;
  onOpenProfileSettings?: () => void;
  onOpenRoleManagement?: () => void;
  onLogout: () => void;
  isOpenDesktop?: boolean;
  onToggleDesktop?: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  onOpenAnnouncements?: () => void;
}

interface NavItemDef {
  id: string;
  tabKey: MainTabType;
  label: string;
  desc: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number | null;
  targetAttr?: string;
}

export const Sidebar: React.FC<SidebarProps> = ({
  session,
  activeTab,
  onTabChange,
  membersCount = 0,
  attendanceCount = 0,
  cashCount = 0,
  assignmentsCount,
  onOpenProfileSettings,
  onOpenRoleManagement,
  onLogout,
  isOpenDesktop = true,
  onToggleDesktop,
  isMobileOpen = false,
  onCloseMobile,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenAnnouncements,
}) => {
  const [isInfoModalOpen, setIsInfoModalOpen] = useState(false);

  // Canonical role resolution: 'admin' | 'executive_board' | 'advisor' | 'member'
  const canonicalRole: CanonicalUserRole = getCanonicalRole(session);
  const canPostAnnouncements = canManageAnnouncements(session);

  // Dynamic navigation items configuration strictly based on canonical role
  const getDynamicNavItems = (): { groupLabel: string; roleBadge: string; badgeColor: string; items: NavItemDef[] } => {
    switch (canonicalRole) {
      case 'admin':
        return {
          groupLabel: 'Administrative Controls',
          roleBadge: 'Admin Clearance',
          badgeColor: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
          items: [
            {
              id: 'sidebarTabDashboardBtn',
              tabKey: 'dashboard',
              label: 'Admin Dashboard',
              desc: 'System overview & live analytics',
              icon: LayoutDashboard,
              count: null,
            },
            {
              id: 'sidebarTabMembersBtn',
              tabKey: 'members',
              label: 'Member Directory',
              desc: 'Student roster & user management',
              icon: Users,
              count: membersCount,
            },
            {
              id: 'sidebarTabAttendanceBtn',
              tabKey: 'attendance',
              label: 'Daily Attendance',
              desc: 'Workshop & session check-ins',
              icon: CalendarCheck,
              count: attendanceCount,
            },
            {
              id: 'sidebarTabAssignmentsBtn',
              tabKey: 'assignments',
              label: 'Tasks & Grading',
              desc: 'Course tasks & student evaluation',
              icon: BookOpen,
              count: assignmentsCount ?? null,
            },
            {
              id: 'sidebarTabCashBtn',
              targetAttr: '#tab-kas',
              tabKey: 'cash',
              label: 'Club Treasury',
              desc: 'Financial balance & dues ledger',
              icon: Wallet,
              count: cashCount,
            },
            {
              id: 'sidebarTabCalendarBtn',
              tabKey: 'calendar',
              label: 'Activity Calendar',
              desc: 'Meeting schedules & event timeline',
              icon: CalendarDays,
              count: null,
            },
          ]
        };

      case 'executive_board':
        return {
          groupLabel: 'Executive Operations',
          roleBadge: 'Executive Board',
          badgeColor: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/20',
          items: [
            {
              id: 'sidebarTabDashboardBtn',
              tabKey: 'dashboard',
              label: 'Executive Dashboard',
              desc: 'Club operations & activity summary',
              icon: LayoutDashboard,
              count: null,
            },
            {
              id: 'sidebarTabMembersBtn',
              tabKey: 'members',
              label: 'Member Directory',
              desc: 'Active student roster & divisions',
              icon: Users,
              count: membersCount,
            },
            {
              id: 'sidebarTabAttendanceBtn',
              tabKey: 'attendance',
              label: 'Daily Attendance',
              desc: 'Session attendance & presence logs',
              icon: CalendarCheck,
              count: attendanceCount,
            },
            {
              id: 'sidebarTabAssignmentsBtn',
              tabKey: 'assignments',
              label: 'Tasks & Grading',
              desc: 'Task submissions & evaluation',
              icon: BookOpen,
              count: assignmentsCount ?? null,
            },
            {
              id: 'sidebarTabCashBtn',
              targetAttr: '#tab-kas',
              tabKey: 'cash',
              label: 'Club Treasury',
              desc: 'Dues collection & club budget',
              icon: Wallet,
              count: cashCount,
            },
            {
              id: 'sidebarTabCalendarBtn',
              tabKey: 'calendar',
              label: 'Activity Calendar',
              desc: 'Workshops & competition calendar',
              icon: CalendarDays,
              count: null,
            },
          ]
        };

      case 'advisor':
        return {
          groupLabel: 'Supervisory Oversight',
          roleBadge: 'Faculty Advisor',
          badgeColor: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
          items: [
            {
              id: 'sidebarTabDashboardBtn',
              tabKey: 'dashboard',
              label: 'Advisory Overview',
              desc: 'Governance metrics & club health',
              icon: LayoutDashboard,
              count: null,
            },
            {
              id: 'sidebarTabMembersBtn',
              tabKey: 'members',
              label: 'Member Directory',
              desc: 'Student enrollment & roster audit',
              icon: Users,
              count: membersCount,
            },
            {
              id: 'sidebarTabAttendanceBtn',
              tabKey: 'attendance',
              label: 'Attendance Audit',
              desc: 'Presence logs & participation rates',
              icon: CalendarCheck,
              count: attendanceCount,
            },
            {
              id: 'sidebarTabAssignmentsBtn',
              tabKey: 'assignments',
              label: 'Curriculum & Grades',
              desc: 'Robotics modules & evaluation records',
              icon: BookOpen,
              count: assignmentsCount ?? null,
            },
            {
              id: 'sidebarTabCashBtn',
              targetAttr: '#tab-kas',
              tabKey: 'cash',
              label: 'Treasury Audit',
              desc: 'Financial balance & dues audit',
              icon: Wallet,
              count: cashCount,
            },
            {
              id: 'sidebarTabCalendarBtn',
              tabKey: 'calendar',
              label: 'Activity Calendar',
              desc: 'Academic calendar & workshop dates',
              icon: CalendarDays,
              count: null,
            },
          ]
        };

      case 'member':
      default:
        return {
          groupLabel: 'Student Workspace',
          roleBadge: 'Club Member',
          badgeColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
          items: [
            {
              id: 'sidebarTabCalendarBtn',
              tabKey: 'calendar',
              label: 'Activity Calendar',
              desc: 'Workshops, competitions & schedule',
              icon: CalendarDays,
              count: null,
            },
            {
              id: 'sidebarTabAttendanceBtn',
              tabKey: 'attendance',
              label: 'My Attendance',
              desc: 'Daily check-in & presence history',
              icon: CalendarCheck,
              count: attendanceCount,
            },
            {
              id: 'sidebarTabAssignmentsBtn',
              tabKey: 'assignments',
              label: 'Tasks & Challenges',
              desc: 'Learning challenges & submissions',
              icon: BookOpen,
              count: assignmentsCount ?? null,
            },
          ]
        };
    }
  };

  const navConfig = getDynamicNavItems();

  // Shared inner navigation content for both desktop and mobile drawer
  const renderSidebarContent = (isMobile = false) => {
    return (
      <div className="flex flex-col h-full justify-between overflow-hidden bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 text-slate-100 select-none">
        {/* Top Scrollable Container */}
        <div className="p-4 flex flex-col flex-1 overflow-y-auto">
          {/* Brand Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-blue-800/40 mb-3.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/30 border border-blue-400/30 shrink-0">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-bold text-white text-xs tracking-tight leading-tight block truncate">
                  Robotic MAN 2 Bekasi
                </span>
                <p className="text-[10px] text-blue-200/70 font-medium truncate mt-0.5">
                  Extracurricular Portal
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">


              {/* Close / Collapse Button */}
              {isMobile ? (
                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    onCloseMobile?.();
                  }}
                  className="p-1.5 rounded-lg border border-blue-700/50 bg-blue-900/60 text-blue-200 hover:text-white hover:bg-blue-800 transition-all cursor-pointer"
                  title="Close Menu"
                  aria-label="Close Menu"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    onToggleDesktop?.();
                  }}
                  className="p-1.5 rounded-lg border border-blue-700/40 bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 hover:text-white transition-all cursor-pointer"
                  title="Collapse Sidebar"
                  aria-label="Collapse Sidebar"
                >
                  <PanelLeftClose className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Role Status Tag */}
          <div className="flex items-center justify-between px-1 mb-2.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-300/70 truncate">
              {navConfig.groupLabel}
            </span>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-md border ${navConfig.badgeColor}`}>
              {navConfig.roleBadge}
            </span>
          </div>

          {/* Dynamic Navigation Links */}
          <nav className="space-y-1">
            {navConfig.items.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.tabKey;
              return (
                <button
                  key={`${isMobile ? 'mobile-' : ''}${item.tabKey}`}
                  id={item.id}
                  data-target={item.targetAttr}
                  type="button"
                  onClick={() => {
                    playClickTick();
                    onTabChange(item.tabKey);
                    if (isMobile) onCloseMobile?.();
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 cursor-pointer group text-left ${
                    isActive
                      ? 'bg-blue-600/35 text-white font-semibold border border-blue-400/40 shadow-xs shadow-blue-950/40'
                      : 'text-blue-100/75 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? 'text-blue-300' : 'text-blue-300/60 group-hover:text-blue-100'
                    }`} />
                    <span className="truncate">{item.label}</span>
                  </div>

                  {item.count !== null && item.count > 0 && (
                    <span 
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-medium leading-none shrink-0 ml-2 ${
                        isActive
                          ? 'bg-blue-500/40 text-blue-100 border border-blue-400/30'
                          : 'bg-blue-950/80 text-blue-200/80 border border-blue-800/50'
                      }`}
                    >
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Communications & System Actions */}
          <div className="pt-3.5 mt-3.5 border-t border-blue-800/40 space-y-1">
            {/* Official Announcements Button */}
            {onOpenAnnouncements && (
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  if (isMobile) onCloseMobile?.();
                  onOpenAnnouncements();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-blue-100/75 hover:text-white hover:bg-white/10 transition cursor-pointer group"
                title={canPostAnnouncements ? 'Post & Manage Club Announcements' : 'View Official Club Announcements'}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Megaphone className="w-4 h-4 text-blue-300/60 shrink-0 group-hover:text-blue-100 transition-colors" />
                  <span className="truncate">Announcements</span>
                </div>
              </button>
            )}

            {/* Notification Center Button */}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  if (isMobile) onCloseMobile?.();
                  onOpenNotifications();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-blue-100/75 hover:text-white hover:bg-white/10 transition cursor-pointer group"
                title="Notifications"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Bell className="w-4 h-4 text-blue-300/60 shrink-0 group-hover:text-blue-100 transition-colors" />
                  <span className="truncate">Notifications</span>
                </div>
                {unreadNotificationsCount !== undefined && unreadNotificationsCount > 0 && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500 text-white font-mono font-bold leading-none shadow-xs">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>
            )}

            {/* Admin Role Management (Only for System Admin) */}
            {canonicalRole === 'admin' && onOpenRoleManagement && (
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  if (isMobile) onCloseMobile?.();
                  onOpenRoleManagement();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-blue-100/75 hover:text-white hover:bg-white/10 transition cursor-pointer group"
                title="Manage Role Access Control (RBAC)"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <ShieldCheck className="w-4 h-4 text-blue-300/60 shrink-0 group-hover:text-blue-100 transition-colors" />
                  <span className="truncate">RBAC Roles</span>
                </div>
                <span className="text-[9px] text-blue-300/60 font-mono">
                  Config
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Bottom User Profile Section */}
        {session && (
          <div className="p-3 bg-blue-950/80 border-t border-blue-800/40 backdrop-blur-xs">
            <div className="flex items-center justify-between gap-2">
              {/* Profile Card Action */}
              <div 
                onClick={() => {
                  playClickTick();
                  if (isMobile) onCloseMobile?.();
                  onOpenProfileSettings?.();
                }}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer group flex-1 p-1 -m-1 rounded-xl hover:bg-white/10 transition"
                title="Account Settings & Profile"
              >
                <div 
                  className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 transition-transform group-hover:scale-105 shadow-sm border border-blue-400/30"
                >
                  {session.name ? session.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate group-hover:text-blue-200 transition">
                    {session.name}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-blue-200/70">
                    <span className="truncate font-medium">{getRoleMetadata(session.role).shortTitle}</span>
                    {session.isDemo && (
                      <span className="text-amber-300 font-mono text-[9px] bg-amber-500/20 px-1.5 py-0.2 rounded border border-amber-500/30 font-bold shrink-0">
                        🧪 Sandbox
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Toolbar Buttons: Info, Settings, Sign Out */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    setIsInfoModalOpen(true);
                  }}
                  className="p-1.5 text-blue-300/70 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                  title="App Information"
                  aria-label="App Information"
                >
                  <Info className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    if (isMobile) onCloseMobile?.();
                    onOpenProfileSettings?.();
                  }}
                  className="p-1.5 text-blue-300/70 hover:text-white hover:bg-white/10 rounded-lg transition cursor-pointer"
                  title="Account Settings"
                  aria-label="Account Settings"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    if (isMobile) onCloseMobile?.();
                    onLogout();
                  }}
                  className="p-1.5 text-blue-300/70 hover:text-rose-300 hover:bg-rose-500/20 rounded-lg transition cursor-pointer"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <>
      {/* 1. Desktop Left Sidebar */}
      <aside 
        aria-label="Main Navigation Sidebar"
        className={`hidden md:flex flex-col bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 border-r border-blue-800/40 h-screen sticky top-0 shrink-0 z-30 select-none shadow-lg text-slate-100 transition-all duration-300 ease-in-out ${
          isOpenDesktop 
            ? 'w-60 lg:w-64 opacity-100' 
            : 'w-0 opacity-0 border-r-0 overflow-hidden pointer-events-none'
        }`}
      >
        <div className="w-60 lg:w-64 h-full">
          {renderSidebarContent(false)}
        </div>
      </aside>

      {/* 2. Mobile Navigation Drawer */}
      <AnimatePresence>
        {isMobileOpen && (
          <div className="md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 cursor-pointer"
              onClick={onCloseMobile}
              aria-hidden="true"
            />

            {/* Slide-out Drawer */}
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 260 }}
              aria-label="Mobile Navigation Drawer"
              className="fixed top-0 bottom-0 left-0 w-64 max-w-[85vw] bg-gradient-to-b from-blue-900 via-blue-950 to-slate-950 text-slate-100 z-50 flex flex-col justify-between shadow-2xl overflow-hidden border-r border-blue-800/40"
            >
              {renderSidebarContent(true)}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* App Info Modal */}
      <AppInfoModal 
        isOpen={isInfoModalOpen} 
        onClose={() => setIsInfoModalOpen(false)} 
      />
    </>
  );
};
