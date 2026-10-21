import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  ShieldAlert, 
  Lock, 
  ArrowLeft, 
  LogOut, 
  ShieldCheck, 
  UserX, 
  KeyRound,
  AlertOctagon,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { UserSession } from '../types';
import { playClickTick } from '../utils/audioFeedback';
import { getCanonicalRole } from '../utils/rbac';
import { verifySessionWithServer } from '../utils/authConfig';

export interface AdminRouteGuardProps {
  session: UserSession | null;
  children: React.ReactNode;
  allowExecutiveBoard?: boolean;
  onRedirectToPortal: () => void;
  onRedirectToLogin?: () => void;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

/**
 * Strict Route Guard Component for Admin Dashboard & Executive Controls
 * Blocks non-admin users and prevents unauthorized access to executive functions.
 */
export const AdminRouteGuard: React.FC<AdminRouteGuardProps> = ({
  session,
  children,
  allowExecutiveBoard = true,
  onRedirectToPortal,
  onRedirectToLogin,
  fallbackTitle = 'Access Denied: Administrator Clearance Required',
  fallbackMessage = 'This dashboard area is strictly restricted to verified system administrators and executive board officers.',
}) => {
  if (!session) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-md w-full bg-white rounded-3xl border border-rose-200/90 p-6 sm:p-8 shadow-xl text-center space-y-5"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
            <Lock className="w-7 h-7 text-rose-600" />
          </div>

          <div className="space-y-1.5">
            <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-mono font-bold uppercase tracking-wider inline-flex items-center gap-1">
              <ShieldAlert className="w-3 h-3 text-rose-600" />
              <span>Authentication Guard</span>
            </span>
            <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
              Session Required
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              Please sign in with verified administrator credentials to access the Extracurricular Admin Console.
            </p>
          </div>

          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                playClickTick();
                if (onRedirectToLogin) onRedirectToLogin();
                else onRedirectToPortal();
              }}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-md cursor-pointer active:scale-95 flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              <span>Go to Sign In</span>
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const canonicalRole = getCanonicalRole(session);
  const email = (session.email || '').toLowerCase().trim();
  const isAdmin = 
    canonicalRole === 'admin' || 
    session.username === 'admin' || 
    session.username === 'roboticman2kotabekasi' ||
    email === 'roboticman2kotabekasi@gmail.com';

  const isExecutiveBoard = canonicalRole === 'executive_board';

  const [isServerVerified, setIsServerVerified] = useState<boolean | null>(() => {
    if (!session) return false;
    if (session.isDemo) return true;
    const token = session.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('robotics_auth_token') : null);
    return token ? null : false;
  });

  useEffect(() => {
    if (!session || session.isDemo) {
      setIsServerVerified(true);
      return;
    }
    const token = session.token || (typeof localStorage !== 'undefined' ? localStorage.getItem('robotics_auth_token') : null);
    if (!token) {
      setIsServerVerified(false);
      return;
    }
    let isMounted = true;
    verifySessionWithServer(token).then((valid) => {
      if (isMounted) setIsServerVerified(valid);
    });
    return () => {
      isMounted = false;
    };
  }, [session?.username, session?.token]);

  // Demo / Trial Accounts: relaxed for UI & navigation testing as requested
  if (session.isDemo) {
    return (
      <div className="space-y-4">
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/90 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-900 shadow-2xs">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-200 text-amber-950 font-mono text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0">
              <Sparkles className="w-3 h-3 text-amber-700" />
              <span>Trial Sandbox Mode</span>
            </span>
            <p className="text-xs text-amber-900/90 font-medium">
              You are testing the Admin Dashboard with a <strong>Trial / Demo Account</strong> (@{session.username} • {session.role}). Production route restriction is relaxed for test accounts so you can verify functions and navigation.
            </p>
          </div>
          <span className="text-[10px] font-mono px-2.5 py-1 rounded-lg bg-white text-amber-800 border border-amber-200 font-bold shrink-0">
            🧪 Demo Preview
          </span>
        </div>
        {children}
      </div>
    );
  }

  // Real Accounts: Show loading state during backend verification
  if (isAdmin && isServerVerified === null) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
          <span className="text-xs font-bold font-mono">Verifying Administrator Clearance with Server...</span>
        </div>
      </div>
    );
  }

  // Real Accounts: Strict clearance enforcement - must be admin (with valid server session) or executive board
  const isAuthorized = (isAdmin && isServerVerified === true) || (allowExecutiveBoard && isExecutiveBoard);

  if (!isAuthorized) {
    const customMessage = (isAdmin && isServerVerified === false)
      ? 'Administrator session token is missing, expired, or was altered. For security against credential tampering, please sign in with your official administrator password.'
      : fallbackMessage;
    return (
      <div className="min-h-[75vh] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="max-w-lg w-full bg-white rounded-3xl border border-rose-200/90 shadow-2xl overflow-hidden"
        >
          {/* Header Banner */}
          <div className="p-6 bg-gradient-to-r from-slate-950 via-rose-950 to-slate-900 text-white relative">
            <div className="flex items-center justify-between gap-3">
              <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-400/30 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                <span>Strict Route Security Guard</span>
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                HTTP 403 Forbidden
              </span>
            </div>

            <div className="mt-4 flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-600/30 border border-rose-400/40 text-rose-300 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-6 h-6 text-rose-300" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-white tracking-tight">
                  {fallbackTitle}
                </h2>
                <p className="text-xs text-rose-200/80 mt-0.5 font-normal">
                  Unauthorized role attempted access to Admin Dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-5">
            <p className="text-xs text-slate-600 leading-relaxed">
              {customMessage}
            </p>

            {/* Account Clearance Audit Box */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-slate-500 font-medium">Logged-in User:</span>
                <span className="font-bold text-slate-900 font-mono">@{session.username}</span>
              </div>
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                <span className="text-slate-500 font-medium">Current Role:</span>
                <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 font-bold font-mono text-[11px]">
                  {session.role || 'member'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Required Clearance:</span>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-900 font-bold font-mono text-[11px]">
                  admin {allowExecutiveBoard ? 'or executive_board' : ''}
                </span>
              </div>
            </div>

            {/* Instruction Notice */}
            <div className="bg-blue-50/70 rounded-xl p-3.5 border border-blue-200/80 text-[11px] text-blue-900 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span>
                To manage members, promote officers, or configure Supabase databases, please sign in with head administrator credentials configured in <code className="font-mono bg-blue-100 px-1 py-0.2 rounded font-bold">.env</code>.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  onRedirectToPortal();
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Student Portal</span>
              </button>

              {onRedirectToLogin && (
                <button
                  type="button"
                  onClick={() => {
                    playClickTick();
                    onRedirectToLogin();
                  }}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition shadow-md cursor-pointer flex items-center justify-center gap-2 active:scale-95"
                >
                  <KeyRound className="w-4 h-4 text-amber-300" />
                  <span>Switch to Admin Login</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // User is authorized -> Render protected admin children
  return <>{children}</>;
};
