import React from 'react';
import { Users, CalendarCheck, Wallet, CalendarDays, BookOpen, LayoutDashboard } from 'lucide-react';
import { motion } from 'motion/react';
import { playClickTick } from '../utils/audioFeedback';
import { MainTabType, UserSession } from '../types';
import { getCanonicalRole, CanonicalUserRole } from '../utils/rbac';

interface MobileBottomNavProps {
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  membersCount?: number;
  attendanceCount?: number;
  cashCount?: number;
  assignmentsCount?: number;
  session?: UserSession | null;
  isMember?: boolean;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  onTabChange,
  membersCount,
  attendanceCount,
  cashCount,
  assignmentsCount,
  session,
  isMember = false,
}) => {
  const canonicalRole: CanonicalUserRole = session ? getCanonicalRole(session) : (isMember ? 'member' : 'admin');

  const getTabs = () => {
    if (canonicalRole === 'member') {
      return [
        { key: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
        { key: 'attendance' as const, label: 'Attendance', icon: CalendarCheck, count: attendanceCount },
        { key: 'assignments' as const, label: 'Tasks', icon: BookOpen, count: assignmentsCount },
      ];
    }

    return [
      { key: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
      { key: 'members' as const, label: 'Members', icon: Users, count: membersCount },
      { key: 'attendance' as const, label: 'Attendance', icon: CalendarCheck, count: attendanceCount },
      { key: 'assignments' as const, label: 'Tasks', icon: BookOpen, count: assignmentsCount },
      { key: 'cash' as const, label: 'Treasury', icon: Wallet, count: cashCount },
      { key: 'calendar' as const, label: 'Calendar', icon: CalendarDays },
    ];
  };

  const tabs = getTabs();

  return (
    <nav 
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] px-2 py-1 pb-[calc(env(safe-area-inset-bottom,0px)+6px)] flex items-center justify-around"
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.key;
        return (
          <motion.button
            key={tab.key}
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={() => {
              playClickTick();
              onTabChange(tab.key);
            }}
            className={`flex-1 min-h-[48px] flex flex-col items-center justify-center py-1 px-1 rounded-xl transition-colors cursor-pointer relative ${
              isActive
                ? 'text-[#2563EB] font-bold bg-blue-50/90'
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 transition-transform duration-200 ${isActive ? 'scale-110 stroke-[2.25]' : 'stroke-[1.75]'}`} />
              {tab.count !== undefined && tab.count > 0 && (
                <motion.span 
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#2563EB] text-white text-[9px] font-mono font-bold flex items-center justify-center shadow-xs"
                >
                  {tab.count > 99 ? '99+' : tab.count}
                </motion.span>
              )}
            </div>
            <span className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'font-bold text-[#2563EB]' : 'font-medium'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.span 
                layoutId="activeMobileIndicator"
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className="w-5 h-0.5 rounded-full bg-[#2563EB] mt-0.5" 
              />
            )}
          </motion.button>
        );
      })}
    </nav>
  );
};
