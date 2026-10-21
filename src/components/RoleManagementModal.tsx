import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  ShieldAlert,
  Users,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  X,
  Search,
  UserPlus,
  Trash2,
  Edit,
  Sparkles,
  Info,
  Check,
  RotateCcw,
  Crown,
  FileText,
  Wallet,
  UserCheck,
  Lock,
  ChevronDown,
  ArrowRight,
  Eye,
  SlidersHorizontal,
  ExternalLink
} from 'lucide-react';
import { UserSession } from '../types';
import { 
  AppRole, 
  ROLE_DEFINITIONS, 
  RBAC_MATRIX, 
  normalizeRole, 
  getRoleMetadata,
  getCanonicalRole,
  Permission
} from '../utils/rbac';
import { 
  getCustomAccounts, 
  AccountConfig, 
  updateAccountRole, 
  deleteAccount, 
  registerNewAccount 
} from '../utils/authConfig';
import { playClickTick, playSuccessChime, playWarningBuzzer } from '../utils/audioFeedback';

interface RoleManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserSession: UserSession;
  onSessionRoleSwitch?: (newRole: AppRole) => void;
  onRefreshData?: () => void;
}

export const RoleManagementModal: React.FC<RoleManagementModalProps> = ({
  isOpen,
  onClose,
  currentUserSession,
  onSessionRoleSwitch,
  onRefreshData
}) => {
  const [activeTab, setActiveTab] = useState<'users' | 'matrix' | 'simulate'>('users');
  const [accounts, setAccounts] = useState<AccountConfig[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [accountToDelete, setAccountToDelete] = useState<string | null>(null);
  
  // New User Form State
  const [newUsername, setNewUsername] = useState('');
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('sekretaris');
  const [newPassword, setNewPassword] = useState('Robotik2026!');
  const [isSubmittingNewUser, setIsSubmittingNewUser] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Matrix Filter
  const [matrixCategoryFilter, setMatrixCategoryFilter] = useState<string>('all');

  const canonicalUserRole = getCanonicalRole(currentUserSession);
  const isSuperAdmin = canonicalUserRole === 'admin';

  const loadAccounts = () => {
    const list = getCustomAccounts();
    setAccounts(list);
  };

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      setFeedbackMsg(null);
      setIsAddingUser(false);
    }
  }, [isOpen]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        acc.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (acc.name && acc.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (acc.email && acc.email.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchRole =
        selectedRoleFilter === 'all' ||
        normalizeRole(acc.role) === selectedRoleFilter;
      return matchSearch && matchRole;
    });
  }, [accounts, searchTerm, selectedRoleFilter]);

  const handleRoleChange = async (username: string, newRoleKey: string) => {
    playClickTick();

    // Privilege Escalation Safeguard: Only Primary Administrator can alter roles
    if (!isSuperAdmin) {
      playWarningBuzzer();
      setFeedbackMsg({
        type: 'error',
        text: 'Access Denied: Only the Primary Administrator has permission to modify roles or executive titles.'
      });
      return;
    }

    const roleToSave = newRoleKey.toLowerCase().includes('executive') || newRoleKey === 'bph' ? 'executive_board' : newRoleKey;
    const success = await updateAccountRole(username, roleToSave);
    if (success) {
      playSuccessChime();
      loadAccounts();
      setFeedbackMsg({
        type: 'success',
        text: `User role for @${username} successfully updated to ${newRoleKey}.`
      });
      setTimeout(() => setFeedbackMsg(null), 3500);
    } else {
      setFeedbackMsg({
        type: 'error',
        text: `Failed to update role for @${username}.`
      });
    }
  };

  const handleDeleteUser = (username: string) => {
    if (!isSuperAdmin) {
      playWarningBuzzer();
      setFeedbackMsg({
        type: 'error',
        text: 'Access Denied: Only the Primary Administrator has permission to delete user accounts.'
      });
      return;
    }
    if (username === 'pembina' || username === 'admin') {
      playWarningBuzzer();
      setFeedbackMsg({
        type: 'error',
        text: 'Primary system accounts (@admin, @pembina) cannot be removed to maintain RBAC stability.'
      });
      return;
    }
    playClickTick();
    setAccountToDelete(username);
  };

  const confirmDeleteUser = async () => {
    if (!accountToDelete) return;
    playClickTick();
    const username = accountToDelete;
    setAccountToDelete(null);
    const success = await deleteAccount(username);
    if (success) {
      playSuccessChime();
      loadAccounts();
      setFeedbackMsg({
        type: 'success',
        text: `Account @${username} has been removed from the system.`
      });
      setTimeout(() => setFeedbackMsg(null), 3000);
    } else {
      playWarningBuzzer();
      setFeedbackMsg({
        type: 'error',
        text: `Failed to remove account @${username}.`
      });
    }
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSuperAdmin) {
      playWarningBuzzer();
      setFeedbackMsg({
        type: 'error',
        text: 'Access Denied: Only the Primary Administrator has permission to create or assign roles.'
      });
      return;
    }
    if (!newUsername.trim() || !newEmail.trim() || !newPassword.trim()) {
      setFeedbackMsg({ type: 'error', text: 'All required fields marked with an asterisk must be filled.' });
      return;
    }

    setIsSubmittingNewUser(true);
    playClickTick();

    const roleDef = ROLE_DEFINITIONS[newRole];
    const res = await registerNewAccount({
      username: newUsername.trim().toLowerCase(),
      name: newName.trim() || newUsername.trim(),
      email: newEmail.trim().toLowerCase(),
      password: newPassword,
      role: roleDef.label
    });

    setIsSubmittingNewUser(false);

    if (res.success) {
      playSuccessChime();
      loadAccounts();
      setIsAddingUser(false);
      setNewUsername('');
      setNewName('');
      setNewEmail('');
      setNewPassword('Robotik2026!');
      setFeedbackMsg({
        type: 'success',
        text: `Account @${newUsername} with role ${roleDef.label} registered successfully.`
      });
      setTimeout(() => setFeedbackMsg(null), 4000);
    } else {
      setFeedbackMsg({
        type: 'error',
        text: res.error || 'Failed to register new account.'
      });
    }
  };

  const matrixCategories = useMemo(() => {
    const set = new Set<string>();
    RBAC_MATRIX.forEach((m) => set.add(m.category));
    return ['all', ...Array.from(set)];
  }, []);

  const filteredMatrix = useMemo(() => {
    if (matrixCategoryFilter === 'all') return RBAC_MATRIX;
    return RBAC_MATRIX.filter((m) => m.category === matrixCategoryFilter);
  }, [matrixCategoryFilter]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div 
        className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="bg-white rounded-3xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] my-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-indigo-600/10 text-indigo-700 flex items-center justify-center border border-indigo-200/50 shadow-2xs shrink-0">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                    Role-Based Access Control (RBAC)
                  </h2>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                    Active RBAC
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Role-based access control and privilege distribution for Robotics Club MAN 2 Kota Bekasi.
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                playClickTick();
                onClose();
              }}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Feedback banner */}
          {feedbackMsg && (
            <div className={`mt-3 px-3.5 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-medium animate-in fade-in duration-200 ${
              feedbackMsg.type === 'success' 
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}>
              {feedbackMsg.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackMsg.text}</span>
            </div>
          )}

          {/* Sub Navigation Tabs */}
          <div className="flex items-center justify-between gap-2 mt-4 pb-2 border-b border-slate-100 shrink-0 overflow-x-auto">
            <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setActiveTab('users');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Officer Accounts ({accounts.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setActiveTab('matrix');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'matrix'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Permission Matrix (RBAC)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setActiveTab('simulate');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'simulate'
                    ? 'bg-white text-indigo-700 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Simulate Role UI</span>
              </button>
            </div>

            {activeTab === 'users' && isSuperAdmin && (
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setIsAddingUser(!isAddingUser);
                }}
                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>{isAddingUser ? 'Cancel' : '+ Add Officer Account'}</span>
              </button>
            )}
          </div>

          {/* Modal Body Content */}
          <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1">

            {/* TAB 1: USERS & ROLES */}
            {activeTab === 'users' && (
              <div className="space-y-4">

                {/* Add User Form Drawer */}
                {isAddingUser && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-4 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <UserPlus className="w-4 h-4 text-indigo-600" />
                        <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wide">
                          Register New Officer Account
                        </h4>
                      </div>
                      <span className="text-[11px] text-indigo-600 font-medium">
                        Directly authorized by {currentUserSession.name}
                      </span>
                    </div>

                    <form onSubmit={handleCreateNewUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Login Username <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newUsername}
                          onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                          placeholder="e.g. secretary_two"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Officer Full Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Full name of student or advisor"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Official Email <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          placeholder="name@man2kotabekasi.sch.id"
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Assign Role (RBAC) <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value as AppRole)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-semibold"
                        >
                          <option value="pembina">Club Advisor (Full Supervision)</option>
                          <option value="ketua">President / Head Admin (Full Operations)</option>
                          <option value="pr">Public Relations (Full Authority across roles)</option>
                          <option value="sekretaris">Secretary (Members & Attendance, Treasury Read-Only)</option>
                          <option value="bendahara">Treasurer (Full Treasury, Members Read-Only)</option>
                          <option value="anggota">Member / Viewer (Read-Only Across Modules)</option>
                        </select>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Initial Password <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-mono"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Officers can update their password after signing in via Profile Settings.
                        </p>
                      </div>

                      <div className="sm:col-span-2 flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => setIsAddingUser(false)}
                          className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-200/50 rounded-xl transition cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isSubmittingNewUser}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                        >
                          {isSubmittingNewUser ? (
                            <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          <span>Save & Activate Account</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Filters */}
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="relative flex-1 w-full">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search by name, username, or email..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 text-slate-800"
                    />
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                    <select
                      value={selectedRoleFilter}
                      onChange={(e) => setSelectedRoleFilter(e.target.value)}
                      className="w-full sm:w-auto px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700"
                    >
                      <option value="all">All Roles ({accounts.length})</option>
                      <option value="pembina">Club Advisor</option>
                      <option value="ketua">President / Admin</option>
                      <option value="bph">Executive Board</option>
                      <option value="pr">Public Relations</option>
                      <option value="sekretaris">Secretary</option>
                      <option value="bendahara">Treasurer</option>
                      <option value="anggota">Member</option>
                    </select>
                  </div>
                </div>

                {/* Accounts Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3">User</th>
                          <th className="py-2.5 px-3">Account Email</th>
                          <th className="py-2.5 px-3">Current Role (RBAC)</th>
                          <th className="py-2.5 px-3">Primary Authority</th>
                          <th className="py-2.5 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredAccounts.map((acc) => {
                          const canonical = normalizeRole(acc.role);
                          const meta = getRoleMetadata(canonical);
                          const isCurrentUser = acc.username.toLowerCase() === currentUserSession.username.toLowerCase();
                          const isProtectedMain = acc.username === 'pembina' || acc.username === 'admin';

                          return (
                            <tr key={acc.username} className={`hover:bg-slate-50/60 transition ${isCurrentUser ? 'bg-indigo-50/40' : ''}`}>
                              <td className="py-2.5 px-3">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0 overflow-hidden">
                                    {acc.avatarUrl ? (
                                      <img src={acc.avatarUrl} alt={acc.name} className="w-full h-full object-cover" />
                                    ) : (
                                      acc.name?.charAt(0).toUpperCase() || acc.username.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-semibold text-slate-900">{acc.name || acc.username}</span>
                                      {isCurrentUser && (
                                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-indigo-100 text-indigo-700 rounded-md">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-[11px] text-slate-400 font-mono">@{acc.username}</span>
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 text-slate-600">
                                {acc.email || '-'}
                              </td>

                              <td className="py-2.5 px-3">
                                {isSuperAdmin ? (
                                  <div className="flex items-center gap-1.5">
                                    <select
                                      value={canonical}
                                      disabled={!isSuperAdmin || (acc.username === 'pembina' && currentUserSession.username !== 'pembina')}
                                      onChange={(e) => handleRoleChange(acc.username, ROLE_DEFINITIONS[e.target.value as AppRole].label)}
                                      className={`px-2 py-1 rounded-lg border text-xs font-semibold cursor-pointer ${meta.badgeBg} ${meta.badgeBorder}`}
                                    >
                                      <option value="pembina">Club Advisor</option>
                                      <option value="ketua">President / Head Admin</option>
                                      <option value="bph">Executive Board</option>
                                      <option value="pr">Public Relations (PR)</option>
                                      <option value="sekretaris">Secretary</option>
                                      <option value="bendahara">Treasurer</option>
                                      <option value="anggota">Member / Viewer</option>
                                    </select>
                                  </div>
                                ) : (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-lg border text-xs font-semibold ${meta.badgeBg} ${meta.badgeBorder}`}>
                                    {meta.label}
                                  </span>
                                )}
                              </td>

                              <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                                <span className="line-clamp-1">{meta.description}</span>
                              </td>

                              <td className="py-2.5 px-3 text-right">
                                {isSuperAdmin && !isProtectedMain && !isCurrentUser ? (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUser(acc.username)}
                                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                    title={`Delete account @${acc.username}`}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-400 font-mono italic">
                                    {isProtectedMain ? 'Core Account' : isCurrentUser ? 'Active Session' : '-'}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-800">RBAC Security Note:</span>
                    <p className="mt-0.5 text-slate-500">
                      Applied role adjustments are instantly effective and synchronized across Supabase Cloud database and local sessions. Advisors and Presidents possess administrator authority to modify officer roles.
                    </p>
                  </div>
                </div>

              </div>
            )}

            {/* TAB 2: RBAC MATRIX */}
            {activeTab === 'matrix' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">
                      Access Control Matrix & Authority Distribution (RBAC)
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Standard Operating Procedures (SOP) for data access across Robotics Club MAN 2 Kota Bekasi.
                    </p>
                  </div>

                  {/* Category Filter */}
                  <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl overflow-x-auto w-full sm:w-auto">
                    {matrixCategories.map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          playClickTick();
                          setMatrixCategoryFilter(cat);
                        }}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer shrink-0 ${
                          matrixCategoryFilter === cat
                            ? 'bg-white text-indigo-700 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {cat === 'all' ? 'All Modules' : cat}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Matrix Table */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-semibold text-[11px]">
                          <th className="py-2.5 px-3 min-w-[200px]">Feature & Action</th>
                          <th className="py-2.5 px-2 text-center bg-purple-50/60 text-purple-900 min-w-[85px]">
                            <div className="font-bold">Advisor</div>
                            <span className="text-[9px] font-normal text-purple-700">Supervision</span>
                          </th>
                          <th className="py-2.5 px-2 text-center bg-blue-50/60 text-blue-900 min-w-[85px]">
                            <div className="font-bold">President</div>
                            <span className="text-[9px] font-normal text-blue-700">Core Admin</span>
                          </th>
                          <th className="py-2.5 px-2 text-center bg-rose-50/60 text-rose-900 min-w-[85px]">
                            <div className="font-bold">Public Relations</div>
                            <span className="text-[9px] font-normal text-rose-700">Full Authority</span>
                          </th>
                          <th className="py-2.5 px-2 text-center bg-indigo-50/60 text-indigo-900 min-w-[85px]">
                            <div className="font-bold">Core Board</div>
                            <span className="text-[9px] font-normal text-indigo-700">Officers</span>
                          </th>
                          <th className="py-2.5 px-2 text-center bg-emerald-50/60 text-emerald-900 min-w-[85px]">
                            <div className="font-bold">Secretary</div>
                            <span className="text-[9px] font-normal text-emerald-700">Attendance & Roster</span>
                          </th>
                          <th className="py-2.5 px-2 text-center bg-amber-50/60 text-amber-900 min-w-[85px]">
                            <div className="font-bold">Treasurer</div>
                            <span className="text-[9px] font-normal text-amber-700">Treasury Ledger</span>
                          </th>
                          <th className="py-2.5 px-2 text-center bg-slate-100 text-slate-800 min-w-[85px]">
                            <div className="font-bold">Member</div>
                            <span className="text-[9px] font-normal text-slate-600">Viewer</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredMatrix.map((row, idx) => (
                           <tr key={idx} className="hover:bg-slate-50/50 transition">
                            <td className="py-2.5 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-medium text-slate-900">{row.feature}</span>
                                <span className="text-[9px] text-slate-400 font-mono">({row.category})</span>
                              </div>
                              <p className="text-[10px] text-slate-500 mt-0.5">{row.description}</p>
                            </td>

                            {/* Pembina */}
                            <td className="py-2.5 px-2 text-center bg-purple-50/20">
                              {row.pembina ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* Ketua */}
                            <td className="py-2.5 px-2 text-center bg-blue-50/20">
                              {row.ketua ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* Public Relations */}
                            <td className="py-2.5 px-2 text-center bg-rose-50/20">
                              {row.pr ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* BPH */}
                            <td className="py-2.5 px-2 text-center bg-indigo-50/20">
                              {row.bph ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="text-slate-300 font-mono">-</span>
                              )}
                            </td>

                            {/* Sekretaris */}
                            <td className="py-2.5 px-2 text-center bg-emerald-50/20">
                              {row.sekretaris ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 text-rose-500 text-[11px] font-bold">
                                  ×
                                </span>
                              )}
                            </td>

                            {/* Bendahara */}
                            <td className="py-2.5 px-2 text-center bg-amber-50/20">
                              {row.bendahara ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 text-rose-500 text-[11px] font-bold">
                                  ×
                                </span>
                              )}
                            </td>

                            {/* Anggota */}
                            <td className="py-2.5 px-2 text-center bg-slate-50/40">
                              {row.anggota ? (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 text-emerald-700">
                                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-50 text-rose-500 text-[11px] font-bold">
                                  ×
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Role Responsibility Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {(Object.keys(ROLE_DEFINITIONS) as AppRole[]).map((rKey) => {
                    const r = ROLE_DEFINITIONS[rKey];
                    return (
                      <div key={r.id} className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`px-2 py-0.5 rounded-lg border text-xs font-bold ${r.badgeBg} ${r.badgeBorder}`}>
                            {r.label}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-600 leading-relaxed">{r.description}</p>
                        <div className="pt-1.5 border-t border-slate-200/60 space-y-1">
                          {r.responsibilities.map((res, i) => (
                            <div key={i} className="flex items-start gap-1.5 text-[10px] text-slate-500">
                              <Check className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                              <span className="leading-tight">{res}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: SIMULATE ROLE */}
            {activeTab === 'simulate' && (
              <div className="space-y-4">
                <div className="p-4 bg-indigo-50/60 rounded-2xl border border-indigo-200/60">
                  <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span>Role Simulation Sandbox (Role Switcher)</span>
                  </div>
                  <p className="text-xs text-indigo-700/90 mt-1">
                    This feature enables advisors, evaluators, and administrators to test how the interface automatically adjusts permissions for each role (Advisor, President, Secretary, Treasurer, Member) in real time.
                  </p>
                </div>

                {(() => {
                  const currentRoleCanonical = normalizeRole(currentUserSession?.role);
                  return (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(Object.keys(ROLE_DEFINITIONS) as AppRole[]).map((rKey) => {
                        const r = ROLE_DEFINITIONS[rKey];
                        const isActive = currentRoleCanonical === rKey;

                    return (
                      <div
                        key={rKey}
                        className={`p-4 rounded-2xl border transition-all ${
                          isActive 
                            ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400' 
                            : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-800'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className={`inline-block px-2 py-0.5 rounded-lg text-xs font-bold mb-1 ${
                              isActive ? 'bg-white/20 text-white border border-white/30' : `${r.badgeBg} ${r.badgeBorder}`
                            }`}>
                              {r.label}
                            </span>
                            <h4 className="text-xs font-bold mt-1">{r.shortTitle}</h4>
                          </div>

                          {isActive && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-indigo-700 uppercase tracking-wide">
                              Currently Active
                            </span>
                          )}
                        </div>

                        <p className={`text-[11px] mt-2 leading-relaxed ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>
                          {r.description}
                        </p>

                        <div className="mt-3 pt-3 border-t border-current/10 flex items-center justify-between">
                          <span className={`text-[10px] font-mono ${isActive ? 'text-indigo-200' : 'text-slate-400'}`}>
                            {r.permissions.length} Authority Permissions
                          </span>

                          <button
                            type="button"
                            disabled={isActive}
                            onClick={() => {
                              playClickTick();
                              onSessionRoleSwitch?.(rKey);
                              onClose();
                            }}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                              isActive
                                ? 'opacity-50 cursor-not-allowed bg-white/20 text-white'
                                : 'bg-slate-900 hover:bg-indigo-600 text-white shadow-2xs'
                            }`}
                          >
                            <span>{isActive ? 'In Use' : `Switch to ${r.shortTitle}`}</span>
                            {!isActive && <ArrowRight className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                  );
                })()}
              </div>
            )}

          </div>

          {/* Delete Account Confirmation Dialog */}
          <AnimatePresence>
            {accountToDelete && (
              <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full space-y-3.5 text-center"
                >
                  <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Confirm Account Deletion</h4>
                    <p className="text-xs text-slate-500 mt-1">
                      Are you sure you want to remove account access for <strong>@{accountToDelete}</strong> from the system?
                    </p>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setAccountToDelete(null)}
                      className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={confirmDeleteUser}
                      className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
                    >
                      Remove Account
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 shrink-0">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Your Session: <strong>{currentUserSession.name}</strong> ({currentUserSession.role})</span>
            </div>

            <button
              type="button"
              onClick={() => {
                playClickTick();
                onClose();
              }}
              className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer"
            >
              Close
            </button>
          </div>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
