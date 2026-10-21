import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Users,
  Search,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Crown,
  UserCheck,
  User,
  Mail,
  CheckCircle2,
  AlertCircle,
  Database,
  ArrowUpRight,
  Filter,
  Check,
  X,
  ExternalLink,
  Lock,
  Layers,
  ChevronRight,
  Award,
  Star,
  Info,
  Clock,
  RotateCcw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { RegisteredUser, UserSession } from '../types';
import { 
  fetchRegisteredUsersFromDB, 
  promoteUserToExecutiveBoard, 
  demoteUserToMember 
} from '../services/supabaseService';
import { playClickTick, playSuccessChime } from '../utils/audioFeedback';
import { formatCompactDate } from '../utils/dateAcademicConfig';
import { hasSessionPermission } from '../utils/rbac';

interface AdminRegisteredUsersSectionProps {
  currentUserSession: UserSession;
  isSupabaseConnected: boolean;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onUserPromoted?: (user: RegisteredUser) => void;
}

export const AdminRegisteredUsersSection: React.FC<AdminRegisteredUsersSectionProps> = ({
  currentUserSession,
  isSupabaseConnected,
  onShowToast,
  onUserPromoted,
}) => {
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'members' | 'executive_board' | 'admin'>('all');
  const [promotingUserId, setPromotingUserId] = useState<string | null>(null);
  const [demotingUserId, setDemotingUserId] = useState<string | null>(null);
  const [userToConfirmPromote, setUserToConfirmPromote] = useState<RegisteredUser | null>(null);
  const [userToConfirmDemote, setUserToConfirmDemote] = useState<RegisteredUser | null>(null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());

  // Strict RBAC Authority: Only Head Admin, President, or Faculty Advisor (Pembina) can promote/demote officers
  const canManageRoles = Boolean(
    currentUserSession.role === 'admin' ||
    currentUserSession.jabatan === 'president' ||
    currentUserSession.role === 'advisor' ||
    currentUserSession.jabatan === 'pembina' ||
    hasSessionPermission(currentUserSession, 'members:promote')
  );

  // Load registered users from Supabase DB
  const loadRegisteredUsers = useCallback(async (showNotification = false) => {
    setIsLoading(true);
    try {
      const data = await fetchRegisteredUsersFromDB();
      setUsers(data);
      setLastRefreshedAt(new Date());
      if (showNotification) {
        playSuccessChime();
        onShowToast(`Successfully loaded ${data.length} registered accounts from Supabase database.`, 'success');
      }
    } catch (err: any) {
      console.warn('Failed to load registered users:', err);
      onShowToast('Failed to load registered users from Supabase.', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [onShowToast]);

  useEffect(() => {
    loadRegisteredUsers(false);
  }, [loadRegisteredUsers]);

  // Statistics calculation
  const stats = useMemo(() => {
    const total = users.length;
    const regularMembers = users.filter((u) => !u.isExecutiveBoard && !u.isAdmin).length;
    const executiveBoard = users.filter((u) => u.isExecutiveBoard).length;
    const admins = users.filter((u) => u.isAdmin).length;
    return { total, regularMembers, executiveBoard, admins };
  }, [users]);

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return users.filter((user) => {
      // 1. Role Filter
      if (roleFilter === 'members' && (user.isExecutiveBoard || user.isAdmin)) return false;
      if (roleFilter === 'executive_board' && !user.isExecutiveBoard) return false;
      if (roleFilter === 'admin' && !user.isAdmin) return false;

      // 2. Search Term Filter
      if (!term) return true;
      const matchName = user.name.toLowerCase().includes(term);
      const matchUsername = user.username.toLowerCase().includes(term);
      const matchEmail = (user.email || '').toLowerCase().includes(term);
      const matchRole = user.role.toLowerCase().includes(term);
      const matchNis = (user.nis || '').toLowerCase().includes(term);
      const matchKelas = (user.kelas || '').toLowerCase().includes(term);

      return matchName || matchUsername || matchEmail || matchRole || matchNis || matchKelas;
    });
  }, [users, searchTerm, roleFilter]);

  // Execute promotion of member to executive_board
  const handlePromoteConfirm = async () => {
    if (!canManageRoles) {
      onShowToast('Akses ditolak: Hanya Ketua Ekskul atau Pembina yang berwenang mengangkat pengurus.', 'error');
      return;
    }
    if (!userToConfirmPromote) return;
    const target = userToConfirmPromote;
    setUserToConfirmPromote(null);
    setPromotingUserId(target.id);
    playClickTick();

    try {
      const res = await promoteUserToExecutiveBoard(target);
      if (res.success) {
        // Trigger celebratory confetti
        try {
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#4f46e5', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b']
          });
        } catch {}

        playSuccessChime();
        onShowToast(
          `🎉 Success! ${target.name} has been promoted to 'executive_board'. Executive privileges are active upon next login.`,
          'success'
        );

        // Optimistically update local users list
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === target.id || u.username === target.username || (target.email && u.email === target.email)) {
              return {
                ...u,
                role: 'executive_board',
                membershipStatus: 'executive_board',
                isExecutiveBoard: true,
              };
            }
            return u;
          })
        );

        onUserPromoted?.({
          ...target,
          role: 'executive_board',
          membershipStatus: 'executive_board',
          isExecutiveBoard: true,
        });
      } else {
        onShowToast(`Failed to promote member: ${res.error || 'System error occurred'}`, 'error');
      }
    } catch (err: any) {
      onShowToast(`Failed to promote member: ${err.message}`, 'error');
    } finally {
      setPromotingUserId(null);
    }
  };

  // Revert / demote to regular member
  const handleDemoteConfirm = async () => {
    if (!canManageRoles) {
      onShowToast('Akses ditolak: Hanya Ketua Ekskul atau Pembina yang berwenang mengubah jabatan pengurus.', 'error');
      return;
    }
    if (!userToConfirmDemote) return;
    const target = userToConfirmDemote;
    setUserToConfirmDemote(null);
    setDemotingUserId(target.id);
    playClickTick();

    try {
      const res = await demoteUserToMember(target);
      if (res.success) {
        playSuccessChime();
        onShowToast(`Role for ${target.name} reverted to Regular Member.`, 'info');

        setUsers((prev) =>
          prev.map((u) => {
            if (u.id === target.id || u.username === target.username || (target.email && u.email === target.email)) {
              return {
                ...u,
                role: 'Member / Viewer',
                membershipStatus: 'aktif',
                isExecutiveBoard: false,
              };
            }
            return u;
          })
        );
      } else {
        onShowToast(`Failed to update role: ${res.error || 'System error occurred'}`, 'error');
      }
    } catch (err: any) {
      onShowToast(`Failed to update role: ${err.message}`, 'error');
    } finally {
      setDemotingUserId(null);
    }
  };

  return (
    <div id="admin-registered-users-section" className="bg-white rounded-xl border border-slate-200/90 shadow-2xs overflow-hidden">
      
      {/* 1. Header Section */}
      <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-900">User Accounts Directory</span>
            <span aria-hidden="true">·</span>
            <span>Database Authentication</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums text-slate-500">{stats.total} accounts registered</span>
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Registered Users &amp; Executive Board Management
          </h2>

          <p className="text-xs text-slate-500 max-w-2xl leading-relaxed">
            Audit registered student accounts and promote qualified members to executive board positions with elevated permissions.
          </p>
        </div>

        {/* Refresh Action */}
        <div className="shrink-0 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              playClickTick();
              loadRegisteredUsers(true);
            }}
            disabled={isLoading}
            className="py-1.5 px-3 rounded-lg bg-white hover:bg-slate-50 text-slate-700 font-medium text-xs border border-slate-200 shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Refresh user accounts from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Loading...' : 'Refresh Users'}</span>
          </button>
        </div>
      </div>

      {/* 2. Mini Metric Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-50/50 border-b border-slate-100">
        <div className="bg-white rounded-lg p-3 border border-slate-200/80">
          <span className="text-[11px] text-slate-500 block font-medium">Total Accounts</span>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.total}
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-slate-200/80">
          <span className="text-[11px] text-slate-500 block font-medium">Regular Members</span>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.regularMembers}
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-slate-200/80">
          <span className="text-[11px] text-blue-600 block font-medium">Executive Board</span>
          <div className="text-lg font-bold text-blue-700 font-mono tabular-nums mt-0.5">
            {stats.executiveBoard}
          </div>
        </div>

        <div className="bg-white rounded-lg p-3 border border-slate-200/80">
          <span className="text-[11px] text-slate-500 block font-medium">Admins &amp; Advisors</span>
          <div className="text-lg font-bold text-slate-900 font-mono tabular-nums mt-0.5">
            {stats.admins}
          </div>
        </div>
      </div>

      {/* 3. Search and Role Filter Toolbar */}
      <div className="p-4 sm:p-5 border-b border-slate-100 bg-slate-50/70 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search members by name, email, @username, NIS, or class..."
              className="w-full pl-9 pr-8 py-2 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition shadow-2xs"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                title="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-bold text-slate-400 mr-1 flex items-center gap-1 hidden sm:flex">
              <Filter className="w-3 h-3" />
              <span>Filter:</span>
            </span>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                setRoleFilter('all');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                roleFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              All ({stats.total})
            </button>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                setRoleFilter('members');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                roleFilter === 'members'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Regular Members ({stats.regularMembers})
            </button>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                setRoleFilter('executive_board');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-1 ${
                roleFilter === 'executive_board'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-purple-700 hover:bg-purple-50 border border-purple-200'
              }`}
            >
              <Star className="w-3 h-3" />
              <span>Executive Board ({stats.executiveBoard})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                setRoleFilter('admin');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                roleFilter === 'admin'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              Admins ({stats.admins})
            </button>
          </div>
        </div>

        {/* Informative Guidance Banner */}
        <div className="bg-indigo-50/80 rounded-xl px-3.5 py-2 border border-indigo-100 text-[11px] text-indigo-900 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              {canManageRoles ? (
                <>Klik <strong>"Promote to Executive Board"</strong> pada anggota untuk menetapkan wewenang pengurus. Perubahan tersimpan langsung ke Supabase.</>
              ) : (
                <>Direktori Akun Anggota &amp; Pengurus. Penetapan hak akses dan promosi jabatan dikhususkan bagi <strong>Ketua Ekskul (President)</strong> &amp; <strong>Pembina</strong>.</>
              )}
            </span>
          </div>
          <span className="text-[10px] text-indigo-600 font-mono shrink-0 hidden md:inline">
            Last Synced: {formatCompactDate(lastRefreshedAt.toISOString())}
          </span>
        </div>
      </div>

      {/* 4. Registered Users Table / List */}
      <div className="divide-y divide-slate-100 overflow-x-auto">
        {filteredUsers.length === 0 ? (
          <div className="text-center py-12 px-4 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <Users className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-700">No matching users found</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {searchTerm
                  ? `No registered accounts matched the query "${searchTerm}". Please verify the search term or clear filters.`
                  : 'No registered accounts available in this category.'}
              </p>
            </div>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="py-1.5 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
              >
                Clear Search Query
              </button>
            )}
          </div>
        ) : (
          <div className="min-w-full">
            {/* Desktop Table Header (hidden on mobile) */}
            <div className="hidden sm:grid bg-slate-50/80 px-4 sm:px-6 py-2.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider grid-cols-12 gap-3 border-b border-slate-100">
              <div className="col-span-5 sm:col-span-4">User Identity</div>
              <div className="col-span-3 sm:col-span-3">Account Status &amp; Class</div>
              <div className="col-span-3 sm:col-span-2">Assigned Role</div>
              <div className="col-span-4 sm:col-span-3 text-right">Authority Actions</div>
            </div>

            {/* User List */}
            {filteredUsers.map((user) => {
              const isCurrentUser = user.username === currentUserSession.username;
              const isPromotingThis = promotingUserId === user.id;
              const isDemotingThis = demotingUserId === user.id;

              return (
                <div
                  key={user.id || user.username}
                  className={`px-4 sm:px-6 py-3.5 border-b border-slate-100 text-xs transition-colors hover:bg-slate-50/80 ${
                    user.isExecutiveBoard ? 'bg-indigo-50/20' : ''
                  }`}
                >
                  {/* MOBILE VIEW CARD (< sm) */}
                  <div className="block sm:hidden space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                          user.isAdmin 
                            ? 'bg-blue-600 text-white' 
                            : user.isExecutiveBoard 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 truncate">
                              {user.name}
                            </span>
                            {isCurrentUser && (
                              <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold shrink-0">
                                You
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono truncate">
                            @{user.username}
                          </div>
                        </div>
                      </div>

                      {/* Mobile Role Badge */}
                      <div className="shrink-0">
                        {user.isExecutiveBoard ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200">
                            <Star className="w-3 h-3 text-purple-600 fill-purple-600" />
                            <span>Executive</span>
                          </span>
                        ) : user.isAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Crown className="w-3 h-3 text-blue-600" />
                            <span>Admin</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            <User className="w-3 h-3 text-slate-500" />
                            <span>Member</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 bg-slate-50/80 px-2.5 py-1.5 rounded-lg border border-slate-100">
                      <span className="truncate">{user.email || 'No email registered'}</span>
                      <span className="font-semibold text-slate-700 shrink-0">
                        {user.kelas ? `Class ${user.kelas}` : 'Robotics'}
                      </span>
                    </div>

                    {/* Mobile Authority Actions */}
                    <div>
                      {user.isAdmin ? (
                        <div className="text-right text-[11px] font-semibold text-slate-400 py-1">
                          Head Administrator
                        </div>
                      ) : user.isExecutiveBoard ? (
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                            Executive Active
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              playClickTick();
                              setUserToConfirmDemote(user);
                            }}
                            disabled={isDemotingThis}
                            className="px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition cursor-pointer active:scale-95 disabled:opacity-50"
                          >
                            {isDemotingThis ? 'Updating...' : 'Revert Role'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            playClickTick();
                            setUserToConfirmPromote(user);
                          }}
                          disabled={isPromotingThis}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xs shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isPromotingThis ? 'animate-spin' : ''}`} />
                          <span>{isPromotingThis ? 'Saving...' : 'Promote to Executive Board'}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* DESKTOP TABLE ROW (sm+) */}
                  <div className="hidden sm:grid grid-cols-12 gap-3 items-center">
                    {/* Column 1: Identity & Email */}
                    <div className="col-span-5 sm:col-span-4 flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shadow-2xs ${
                          user.isAdmin 
                            ? 'bg-blue-600 text-white' 
                            : user.isExecutiveBoard 
                            ? 'bg-purple-600 text-white' 
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}>
                          {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        {user.isExecutiveBoard && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[9px] font-bold ring-1 ring-white shadow-2xs">
                            ★
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-900 truncate block">
                            {user.name}
                          </span>
                          {isCurrentUser && (
                            <span className="px-1.5 py-0.2 rounded-md bg-emerald-100 text-emerald-800 text-[9px] font-bold shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-slate-400 truncate">
                          <span className="font-mono text-slate-500">@{user.username}</span>
                          <span>•</span>
                          <span className="truncate">{user.email}</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 2: Status & Class */}
                    <div className="col-span-3 sm:col-span-3">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-slate-700">
                            {user.kelas ? `Class ${user.kelas}` : 'Robotics Roster'}
                          </span>
                          {user.nis && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              (NIS: {user.nis})
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                          <span className="capitalize">{user.authProvider || 'credentials'}</span>
                          <span>•</span>
                          <span className="text-slate-400">Source: {user.source}</span>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Current Role Badge */}
                    <div className="col-span-3 sm:col-span-2">
                      {user.isExecutiveBoard ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs">
                          <Star className="w-3 h-3 text-purple-600 fill-purple-600" />
                          <span>executive_board</span>
                        </span>
                      ) : user.isAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          <Crown className="w-3 h-3 text-blue-600" />
                          <span>admin</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>Regular Member</span>
                        </span>
                      )}
                    </div>

                    {/* Column 4: Authority Actions (Promote / Demote) */}
                    <div className="col-span-4 sm:col-span-3 text-right">
                      {user.isAdmin ? (
                        <span className="text-[11px] font-bold text-slate-400 px-2 py-1">
                          Head Administrator
                        </span>
                      ) : user.isExecutiveBoard ? (
                        <div className="flex items-center justify-end gap-1.5">
                          <span className="hidden lg:inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                            <Check className="w-3 h-3" />
                            <span>Executive Active</span>
                          </span>
                          
                          {/* Demote option */}
                          <button
                            type="button"
                            onClick={() => {
                              playClickTick();
                              setUserToConfirmDemote(user);
                            }}
                            disabled={isDemotingThis}
                            className="px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-600 text-[11px] font-semibold transition cursor-pointer active:scale-95 disabled:opacity-50"
                            title="Revert role to Regular Member"
                          >
                            {isDemotingThis ? 'Updating...' : 'Revert Role'}
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            playClickTick();
                            setUserToConfirmPromote(user);
                          }}
                          disabled={isPromotingThis}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                          title="Promote this member to Executive Board"
                        >
                          <Sparkles className={`w-3.5 h-3.5 text-amber-300 ${isPromotingThis ? 'animate-spin' : ''}`} />
                          <span>{isPromotingThis ? 'Saving...' : 'Promote to Executive Board'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 5. Footer Summary */}
      <div className="p-3.5 sm:p-4 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            Displaying <strong>{filteredUsers.length}</strong> of <strong>{users.length}</strong> registered accounts from Supabase
          </span>
        </div>
        <div className="text-slate-400">
          Role upgrades are saved permanently in Supabase and take effect automatically upon next login.
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. Confirmation Modal: Promote to Executive Board                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {userToConfirmPromote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-md w-full p-6 shadow-2xl space-y-5 relative"
            >
              <button
                type="button"
                onClick={() => setUserToConfirmPromote(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition cursor-pointer"
                title="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto shadow-xs">
                <Sparkles className="w-6 h-6 text-indigo-600" />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight">
                  Promote to Executive Board?
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Confirm role promotion for <strong>{userToConfirmPromote.name}</strong> (@{userToConfirmPromote.username}).
                </p>
              </div>

              {/* Privileges summary box */}
              <div className="bg-gradient-to-br from-indigo-50/70 to-purple-50/70 rounded-2xl p-4 border border-indigo-100/80 space-y-2 text-xs">
                <span className="font-bold text-indigo-950 block">Privileges Granted to this User:</span>
                <ul className="space-y-1.5 text-slate-700 text-[11px]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Full access to Admin Dashboard &amp; Extracurricular Workspace</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Authority to record, edit, and export student attendance</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Authority to manage club treasury dues and balance ledgers</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Create robotics assignments and grade student submissions</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Bypasses standard student portal verification restrictions</span>
                  </li>
                </ul>
              </div>

              <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  The updated role is committed directly to Supabase. The promoted user receives executive privileges automatically upon their <strong>next login</strong>.
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setUserToConfirmPromote(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handlePromoteConfirm}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-600/20 transition active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Star className="w-3.5 h-3.5 text-amber-300" />
                  <span>Confirm Promotion</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 7. Confirmation Modal: Revert to Regular Member (Demote)                  */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {userToConfirmDemote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl border border-slate-200 max-w-sm w-full p-6 shadow-2xl space-y-4 text-center relative"
            >
              <button
                type="button"
                onClick={() => setUserToConfirmDemote(null)}
                className="absolute top-4 right-4 p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition cursor-pointer"
                title="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-center mx-auto">
                <RotateCcw className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Revert to Regular Member?</h3>
                <p className="text-xs text-slate-500 mt-1">
                  The role for <strong>{userToConfirmDemote.name}</strong> will be reverted to Regular Member. Executive board clearance will be revoked upon next login.
                </p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setUserToConfirmDemote(null)}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDemoteConfirm}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition active:scale-95 cursor-pointer"
                >
                  Yes, Revert Role
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
