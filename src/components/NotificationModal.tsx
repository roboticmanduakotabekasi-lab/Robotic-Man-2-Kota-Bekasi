import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  Users, 
  CalendarCheck, 
  Wallet, 
  ShieldCheck, 
  Database, 
  AlertCircle, 
  CheckCircle2, 
  Calendar,
  ExternalLink,
  Filter,
  Clock,
  BookOpen
} from 'lucide-react';
import { AppNotification } from '../types';
import { playClickTick } from '../utils/audioFeedback';

export interface NotificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: AppNotification[];
  onMarkAsRead: (id: string) => void;
  onMarkAllAsRead: () => void;
  onClearAll: () => void;
  onDeleteNotification: (id: string) => void;
  onNavigateToTab?: (tab: 'members' | 'attendance' | 'cash' | 'calendar' | 'assignments') => void;
}

type FilterCategory = 'all' | 'unread' | 'assignment' | 'attendance' | 'cash' | 'member' | 'system';

export const NotificationModal: React.FC<NotificationModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAllAsRead,
  onClearAll,
  onDeleteNotification,
  onNavigateToTab
}) => {
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Calculate unread count
  const unreadCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    return notifications.filter(item => {
      if (filter === 'unread') return !item.isRead;
      if (filter === 'assignment') return item.category === 'assignment';
      if (filter === 'attendance') return item.category === 'attendance';
      if (filter === 'cash') return item.category === 'cash';
      if (filter === 'member') return item.category === 'member';
      if (filter === 'system') return item.category === 'system';
      return true;
    });
  }, [notifications, filter]);

  if (!isOpen) return null;

  // Format relative timestamp
  const formatTimestamp = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      const diffDay = Math.floor(diffHour / 24);

      if (diffSec < 60) return 'Just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      if (diffHour < 24) return `${diffHour}h ago`;
      if (diffDay === 1) return 'Yesterday';
      if (diffDay < 7) return `${diffDay}d ago`;

      return date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Moments ago';
    }
  };

  // Helper to render category/type icon and styles
  const getItemIcon = (item: AppNotification) => {
    if (item.category === 'assignment') {
      return {
        icon: <BookOpen className="w-4 h-4 text-amber-600" />,
        bg: 'bg-amber-50 border-amber-100 text-amber-800',
        badge: 'Tasks'
      };
    }
    if (item.category === 'attendance') {
      return {
        icon: <CalendarCheck className="w-4 h-4 text-emerald-600" />,
        bg: 'bg-emerald-50 border-emerald-100 text-emerald-800',
        badge: 'Attendance'
      };
    }
    if (item.category === 'cash') {
      return {
        icon: <Wallet className="w-4 h-4 text-indigo-600" />,
        bg: 'bg-indigo-50 border-indigo-100 text-indigo-800',
        badge: 'Treasury'
      };
    }
    if (item.category === 'member') {
      return {
        icon: <Users className="w-4 h-4 text-blue-600" />,
        bg: 'bg-blue-50 border-blue-100 text-blue-800',
        badge: 'Members'
      };
    }
    if (item.type === 'error') {
      return {
        icon: <AlertCircle className="w-4 h-4 text-rose-600" />,
        bg: 'bg-rose-50 border-rose-100 text-rose-800',
        badge: 'Alert'
      };
    }
    if (item.type === 'success') {
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
        bg: 'bg-emerald-50 border-emerald-100 text-emerald-800',
        badge: 'Success'
      };
    }
    return {
      icon: <Database className="w-4 h-4 text-slate-600" />,
      bg: 'bg-slate-100 border-slate-200 text-slate-800',
      badge: 'System'
    };
  };

  return (
    <AnimatePresence>
      <div 
        role="dialog"
        aria-modal="true"
        aria-labelledby="notificationModalTitle"
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 12 }}
          transition={{ duration: 0.18 }}
          className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-50 to-blue-50/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-md shadow-blue-600/20">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="notificationModalTitle" className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    Notification & Activity Center
                  </h2>
                  {unreadCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold font-mono">
                      {unreadCount} new
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  System logs, workshop attendance, club treasury, and member rosters
                </p>
              </div>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                playClickTick();
                onClose();
              }}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              title="Close (Esc)"
              aria-label="Close notification modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Action Toolbar & Filters */}
          <div className="px-4 sm:px-5 py-2.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full no-scrollbar">
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setFilter('all');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                  filter === 'all'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                All ({notifications.length})
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setFilter('unread');
                }}
                className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer shrink-0 ${
                  filter === 'unread'
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                Unread ({unreadCount})
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setFilter('assignment');
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer shrink-0 ${
                  filter === 'assignment'
                    ? 'bg-amber-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                Tasks ({notifications.filter(n => n.category === 'assignment').length})
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setFilter('attendance');
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer shrink-0 ${
                  filter === 'attendance'
                    ? 'bg-emerald-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                Attendance
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setFilter('cash');
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer shrink-0 ${
                  filter === 'cash'
                    ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                Treasury
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setFilter('member');
                }}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer shrink-0 ${
                  filter === 'member'
                    ? 'bg-blue-600 text-white shadow-2xs font-bold'
                    : 'text-slate-600 hover:bg-white hover:text-slate-900'
                }`}
              >
                Members
              </button>
            </div>

            {/* Mass Actions */}
            <div className="flex items-center gap-1.5 shrink-0 ml-auto">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    onMarkAllAsRead();
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:border-blue-300 transition cursor-pointer font-medium shadow-2xs"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Mark Read</span>
                </button>
              )}

              {notifications.length > 0 && !showClearConfirm && (
                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    setShowClearConfirm(true);
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition cursor-pointer font-medium"
                  title="Clear all notifications"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Clear All</span>
                </button>
              )}

              {showClearConfirm && (
                <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 p-0.5 rounded-lg">
                  <span className="text-[11px] text-rose-700 font-bold px-1.5">Clear all?</span>
                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      onClearAll();
                      setShowClearConfirm(false);
                    }}
                    className="px-2 py-0.5 bg-rose-600 text-white rounded font-bold text-[11px] hover:bg-rose-700 transition cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      setShowClearConfirm(false);
                    }}
                    className="px-1.5 py-0.5 text-slate-500 hover:text-slate-700 text-[11px] font-medium cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Notification List Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 divide-y divide-slate-100">
            {filteredNotifications.length === 0 ? (
              <div className="py-12 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                  <Bell className="w-6 h-6 stroke-[1.5]" />
                </div>
                <h3 className="text-sm font-bold text-slate-700">
                  No Notifications
                </h3>
                <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                  {filter === 'unread' 
                    ? "You've read all your notifications."
                    : 'No activity records in this category.'}
                </p>
                {filter !== 'all' && (
                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      setFilter('all');
                    }}
                    className="mt-3 text-xs font-bold text-blue-600 hover:text-blue-700 underline cursor-pointer"
                  >
                    Show All Notifications
                  </button>
                )}
              </div>
            ) : (
              filteredNotifications.map((item) => {
                const meta = getItemIcon(item);
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      if (!item.isRead) {
                        onMarkAsRead(item.id);
                      }
                    }}
                    className={`pt-2.5 first:pt-0 group relative flex items-start gap-3 p-3 rounded-xl transition-all cursor-pointer ${
                      item.isRead 
                        ? 'bg-white hover:bg-slate-50/80 border border-transparent hover:border-slate-200' 
                        : 'bg-blue-50/50 hover:bg-blue-50/80 border border-blue-100/80 shadow-2xs'
                    }`}
                  >
                    {/* Icon container */}
                    <div className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${meta.bg}`}>
                      {meta.icon}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-800 group-hover:text-blue-700 transition leading-snug">
                            {item.title}
                          </span>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded-md border ${meta.bg}`}>
                            {meta.badge}
                          </span>
                          {!item.isRead && (
                            <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" title="Unread" />
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 shrink-0">
                          <Clock className="w-3 h-3 text-slate-300" />
                          <span>{formatTimestamp(item.timestamp)}</span>
                        </div>
                      </div>

                      {/* Detail message - fully visible */}
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed break-words">
                        {item.message}
                      </p>

                      {/* Navigation Link Button if attached */}
                      {item.linkTab && onNavigateToTab && (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              playClickTick();
                              if (!item.isRead) onMarkAsRead(item.id);
                              onClose();
                              onNavigateToTab(item.linkTab as any);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-blue-600 border border-slate-200 hover:border-blue-600 text-slate-700 hover:text-white text-[11px] font-bold shadow-2xs transition-all cursor-pointer"
                          >
                            <span>Open {item.linkTab.charAt(0).toUpperCase() + item.linkTab.slice(1)}</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Delete single notification */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        playClickTick();
                        onDeleteNotification(item.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded-lg text-slate-300 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer shrink-0"
                      title="Delete this notification"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span className="font-medium">
              Showing {filteredNotifications.length} of {notifications.length} notifications
            </span>
            <button
              type="button"
              onClick={() => {
                playClickTick();
                onClose();
              }}
              className="px-4 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold text-xs shadow-2xs transition cursor-pointer active:scale-95"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
