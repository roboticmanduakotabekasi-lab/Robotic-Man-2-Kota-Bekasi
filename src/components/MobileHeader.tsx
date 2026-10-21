import React from 'react';
import { 
  Bot, 
  LogOut, 
  Menu, 
  Bell
} from 'lucide-react';
import { UserSession } from '../types';
import { ThemeColor, THEMES } from '../utils/theme';
import { playClickTick } from '../utils/audioFeedback';
import { getRoleMetadata } from '../utils/rbac';
import { Organization } from '../utils/organizerStore';

export interface MobileHeaderProps {
  session: UserSession | null;
  currentTheme?: ThemeColor;
  onThemeChange?: (theme: ThemeColor) => void;
  isSupabaseConnected: boolean;
  onOpenSupabaseModal?: () => void;
  onOpenProfileSettings?: () => void;
  onLogout: () => void;
  onOpenMobileMenu?: () => void;
  onOpenRoleManagement?: () => void;
  unreadNotificationsCount?: number;
  onOpenNotifications?: () => void;
  activeOrganization?: Organization;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  session,
  currentTheme = 'indigo',
  onOpenProfileSettings,
  onOpenRoleManagement,
  onLogout,
  onOpenMobileMenu,
  unreadNotificationsCount = 0,
  onOpenNotifications,
  activeOrganization,
}) => {
  const themeConfig = THEMES[currentTheme] || THEMES.indigo;

  return (
    <header className="md:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        
        {/* Left: Mobile Menu Toggle Button + Brand */}
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            id="mobileMenuToggleBtn"
            onClick={() => {
              playClickTick();
              onOpenMobileMenu?.();
            }}
            className="p-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 transition-all cursor-pointer active:scale-95 shrink-0"
            title="Open Navigation Menu"
            aria-label="Open Navigation Menu"
          >
            <Menu className="w-4 h-4" />
          </button>

          <div
            className="flex items-center gap-2 min-w-0 text-left"
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-700 to-indigo-600 text-white flex items-center justify-center shadow-2xs shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight leading-tight block truncate max-w-[150px] sm:max-w-[200px]">
                Robotic MAN 2
              </span>
              <span className="text-[10px] text-blue-700 block truncate font-medium">
                Kota Bekasi
              </span>
            </div>
          </div>
        </div>

        {/* Right Tools: Notification Bell & Profile Avatar */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Notification Bell Button */}
          <button
            type="button"
            id="mobileNotificationBellBtn"
            onClick={() => {
              playClickTick();
              onOpenNotifications?.();
            }}
            className="relative p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition cursor-pointer shadow-2xs"
            title="Open Notification Center"
            aria-label="Notification Center"
          >
            <Bell className="w-4 h-4 text-slate-600" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-mono font-bold flex items-center justify-center ring-2 ring-white">
                {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
              </span>
            )}
          </button>



          {/* Profile Avatar & RBAC Role Badge */}
          {session && (
            <>
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  onOpenRoleManagement?.();
                }}
                className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer"
                title="Manage Role-Based Access Control (RBAC)"
              >
                {getRoleMetadata(session.role).shortTitle}
              </button>

              <button
                type="button"
                id="mobileProfileAvatarBtn"
                onClick={() => {
                  playClickTick();
                  onOpenProfileSettings?.();
                }}
                className="w-7 h-7 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shadow-2xs cursor-pointer hover:opacity-95 transition"
                title={`Profile: ${session.name} (${session.role})`}
              >
                {session.name.charAt(0)}
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  onLogout();
                }}
                title="Sign Out"
                className="hidden sm:flex p-1.5 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-200 transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

      </div>
    </header>
  );
};
