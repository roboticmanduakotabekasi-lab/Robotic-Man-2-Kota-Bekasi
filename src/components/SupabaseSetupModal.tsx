import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  X, 
  ShieldCheck, 
  RefreshCw,
  AlertCircle,
  UploadCloud,
  Settings2,
  Table,
  CheckCircle2,
  FileCode2,
  Download,
  KeyRound,
  Globe,
  RotateCcw
} from 'lucide-react';
import { 
  SQL_INIT_SCRIPT, 
  checkSupabaseHealth, 
  SupabaseHealthReport, 
  syncAllLocalDataToSupabase 
} from '../services/supabaseService';
import { 
  getActiveSupabaseConfig, 
  updateSupabaseCredentials, 
  resetSupabaseCredentials 
} from '../lib/supabase';
import { Member, AttendanceRecord, CashTransaction } from '../types';
import { getCustomAccounts } from '../utils/authConfig';

interface SupabaseSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshData: () => Promise<void>;
  isTablesCreated: boolean;
  members: Member[];
  attendance: AttendanceRecord[];
  cash: CashTransaction[];
  isDemo?: boolean;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const SupabaseSetupModal: React.FC<SupabaseSetupModalProps> = ({
  isOpen,
  onClose,
  onRefreshData,
  isTablesCreated,
  members,
  attendance,
  cash,
  isDemo = false,
  onShowToast,
}) => {
  const [activeTab, setActiveTab] = useState<'diagnostics' | 'sql' | 'credentials' | 'sync' | 'testing_guide'>('diagnostics');
  const [copied, setCopied] = useState(false);
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const [healthReport, setHealthReport] = useState<SupabaseHealthReport | null>(null);

  // Custom credentials state
  const [inputUrl, setInputUrl] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [isSavingCreds, setIsSavingCreds] = useState(false);

  // Sync state
  const [isSyncingData, setIsSyncingData] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [showResetDefaultsConfirm, setShowResetDefaultsConfirm] = useState(false);

  // Run health check when modal opens
  const runHealthCheck = async () => {
    setIsCheckingHealth(true);
    try {
      const report = await checkSupabaseHealth();
      setHealthReport(report);
    } catch (err: any) {
      console.error('Health check error:', err);
    } finally {
      setIsCheckingHealth(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      const config = getActiveSupabaseConfig();
      setInputUrl(config.url);
      setInputKey(config.anonKey);
      runHealthCheck();
    }
  }, [isOpen]);

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SQL_INIT_SCRIPT);
    setCopied(true);
    onShowToast('SQL script copied to clipboard successfully!', 'success');
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownloadSQL = () => {
    const blob = new Blob([SQL_INIT_SCRIPT], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'setup_database_robotik.sql';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onShowToast('setup_database_robotik.sql file downloaded successfully!', 'success');
  };

  const handleSaveCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) {
      onShowToast('Supabase URL and Anon API Key are required!', 'error');
      return;
    }

    setIsSavingCreds(true);
    try {
      updateSupabaseCredentials(inputUrl, inputKey);
      onShowToast('Supabase credentials updated successfully!', 'success');
      await runHealthCheck();
      await onRefreshData();
    } catch (err: any) {
      onShowToast(`Failed to update credentials: ${err.message}`, 'error');
    } finally {
      setIsSavingCreds(false);
    }
  };

  const handleResetToDefaultCredentials = () => {
    setShowResetDefaultsConfirm(true);
  };

  const confirmResetToDefaultCredentials = async () => {
    setShowResetDefaultsConfirm(false);
    resetSupabaseCredentials();
    const config = getActiveSupabaseConfig();
    setInputUrl(config.url);
    setInputKey(config.anonKey);
    onShowToast('Supabase connection reset to default.', 'info');
    await runHealthCheck();
    await onRefreshData();
  };

  const handleBulkSyncToSupabase = async () => {
    if (isDemo) {
      onShowToast('Demo Sandbox account cannot upload or modify data on Supabase Cloud database. Please register an official account first.', 'error');
      setSyncStatus('⚠️ Demo Sandbox Account: Modifications and synchronization to Supabase Cloud database are disabled.');
      return;
    }

    setIsSyncingData(true);
    setSyncStatus(null);
    try {
      const customAccounts = getCustomAccounts();
      const res = await syncAllLocalDataToSupabase(members, attendance, cash, customAccounts);
      if (res.success) {
        setSyncStatus(`✅ Successfully uploaded ${res.memberCount} Members, ${res.attendanceCount} Attendance records, ${res.cashCount} Cash Transactions, and ${res.accountsCount || 0} Officer Accounts to Supabase!`);
        onShowToast('Data synchronization to Supabase Cloud succeeded!', 'success');
        await runHealthCheck();
        await onRefreshData();
      } else {
        setSyncStatus(`❌ Failed: ${res.error || 'Please ensure tables have been created in Supabase SQL Editor.'}`);
        onShowToast(`Failed: ${res.error}`, 'error');
      }
    } catch (err: any) {
      setSyncStatus(`❌ Error: ${err.message}`);
      onShowToast(`Error: ${err.message}`, 'error');
    } finally {
      setIsSyncingData(false);
    }
  };

  const currentConfig = getActiveSupabaseConfig();
  const allReady = healthReport?.allTablesReady ?? isTablesCreated;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto font-sans" onClick={onClose}>
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl max-w-3xl w-full p-5 sm:p-7 shadow-2xl border border-[#C7D2FE] relative my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 p-2 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

        {/* Modal Header */}
        <div className="flex items-start sm:items-center gap-3.5 mb-5 pr-8">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/25 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight">
                Supabase Cloud Setup Center
              </h3>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                allReady 
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                  : 'bg-amber-100 text-amber-800 border border-amber-300 animate-pulse'
              }`}>
                {allReady ? (
                  <>
                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                    <span>Database Active & Ready</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>SQL Table Setup Required</span>
                  </>
                )}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Project URL: <span className="font-mono font-semibold text-slate-700">{currentConfig.url}</span>
              {currentConfig.isCustom && <span className="ml-2 text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded font-bold">Custom Project</span>}
            </p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl mb-5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('diagnostics')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'diagnostics'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>1. Status & Diagnostics</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'sql'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5 text-blue-600" />
            <span>2. SQL Table Script</span>
          </button>

          <button
            onClick={() => setActiveTab('sync')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'sync'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5 text-teal-600" />
            <span>3. Upload & Sync Data</span>
          </button>

          <button
            onClick={() => setActiveTab('credentials')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'credentials'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 text-slate-600" />
            <span>4. Change URL & Key</span>
          </button>

          <button
            onClick={() => setActiveTab('testing_guide')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              activeTab === 'testing_guide'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>5. Role Testing Guide</span>
          </button>
        </div>

        {/* TAB 1: DIAGNOSTICS & STATUS */}
        {activeTab === 'diagnostics' && (
          <div className="space-y-4">
            
            {/* Status Summary Banner */}
            <div className={`p-4 rounded-2xl border text-xs flex items-start gap-3 ${
              allReady 
                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                : 'bg-amber-50/80 border-amber-200 text-amber-900'
            }`}>
              {allReady ? (
                <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-1">
                <p className="font-bold text-sm text-slate-900">
                  {allReady 
                    ? '🎉 All 4 Supabase Database Tables Ready & Connected!' 
                    : '⚠️ Supabase Database Tables Need Setup / Incomplete'}
                </p>
                <p className="text-slate-600 leading-relaxed">
                  {allReady 
                    ? 'Every addition or change to Members, Attendance, and Treasury data is permanently saved to the Supabase Cloud PostgreSQL database and automatically synchronized across devices.'
                    : 'The app cannot persist modifications to Supabase yet because tables are not set up in your project. Please open the "2. SQL Table Script" tab to copy and execute the script in Supabase (takes less than 1 minute).'}
                </p>
              </div>
            </div>

            {/* Table Health Grid */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Database Table Status Check:</span>
                <button
                  onClick={runHealthCheck}
                  disabled={isCheckingHealth}
                  className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3 h-3 ${isCheckingHealth ? 'animate-spin' : ''}`} />
                  <span>{isCheckingHealth ? 'Checking...' : 'Re-check Status'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                
                {/* Table: members */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Table className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 font-mono">public.members</div>
                      <div className="text-[11px] text-slate-500">Member Master Roster</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {healthReport?.tables.members.exists ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> {healthReport.tables.members.count} rows
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        Table Missing
                      </span>
                    )}
                  </div>
                </div>

                {/* Table: attendance */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Table className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 font-mono">public.attendance</div>
                      <div className="text-[11px] text-slate-500">Attendance & Activity Logs</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {healthReport?.tables.attendance.exists ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> {healthReport.tables.attendance.count} rows
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        Table Missing
                      </span>
                    )}
                  </div>
                </div>

                {/* Table: cash_transactions */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Table className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 font-mono">public.cash_transactions</div>
                      <div className="text-[11px] text-slate-500">Treasury Cash Ledger</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {healthReport?.tables.cash_transactions.exists ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> {healthReport.tables.cash_transactions.count} rows
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        Table Missing
                      </span>
                    )}
                  </div>
                </div>

                {/* Table: user_accounts */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <Table className="w-4 h-4 text-blue-600" />
                    <div>
                      <div className="text-xs font-bold text-slate-900 font-mono">public.user_accounts</div>
                      <div className="text-[11px] text-slate-500">Officer Accounts & Auth</div>
                    </div>
                  </div>
                  <div className="text-right">
                    {healthReport?.tables.user_accounts.exists ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                        <Check className="w-3 h-3" /> {healthReport.tables.user_accounts.count} rows
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        Table Missing
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Quick action button to SQL tab */}
            {!allReady && (
              <div className="pt-2">
                <button
                  onClick={() => setActiveTab('sql')}
                  className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl font-bold text-xs shadow-md shadow-blue-600/25 flex items-center justify-center gap-2 cursor-pointer transition active:scale-95"
                >
                  <FileCode2 className="w-4 h-4" />
                  <span>Open SQL Script & Create Tables Now (1 Minute)</span>
                </button>
              </div>
            )}

          </div>
        )}

        {/* TAB 2: SQL SCRIPT & INSTRUCTIONS */}
        {activeTab === 'sql' && (
          <div className="space-y-4">
            
            {/* 3 Step Tutorial & Schema Badges */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 text-slate-800 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-blue-950">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>Database Relational Structure (Primary Key & Foreign Key):</span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 bg-white/90 rounded-xl border border-blue-100 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                    <span>1. Master: public.members</span>
                  </div>
                  <p className="text-slate-600">
                    <b>PK (Primary Key):</b> <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold font-mono">nisn</code>
                  </p>
                </div>

                <div className="p-2.5 bg-white/90 rounded-xl border border-blue-100 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                    <span>2. Attendance Transactions: public.attendance</span>
                  </div>
                  <p className="text-slate-600">
                    <b>PK (Primary Key):</b> <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold font-mono">id</code> | <b>FK (Foreign Key):</b> <code className="bg-slate-100 px-1 py-0.5 rounded text-emerald-700 font-bold font-mono">nisn -&gt; members(nisn)</code> (CASCADE)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    <b>Unique Constraint:</b> <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">(tanggal, nisn)</code> — prevents duplicate attendance records on the same date.
                  </p>
                </div>

                <div className="p-2.5 bg-white/90 rounded-xl border border-blue-100 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-teal-600"></span>
                    <span>3. Treasury Cash: public.cash_transactions</span>
                  </div>
                  <p className="text-slate-600">
                    <b>PK (Primary Key):</b> <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700 font-bold font-mono">id</code> | <b>FK (Foreign Key):</b> <code className="bg-slate-100 px-1 py-0.5 rounded text-teal-700 font-bold font-mono">nisn -&gt; members(nisn)</code> (SET NULL)
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Records cash inflows and outflows per member or general organization funds.
                  </p>
                </div>

                <div className="p-2.5 bg-white/90 rounded-xl border border-blue-100 space-y-1">
                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-purple-600"></span>
                    <span>4. Auth: public.user_accounts</span>
                  </div>
                  <p className="text-slate-600">
                    <b>PK:</b> <code className="bg-slate-100 px-1 py-0.5 rounded text-purple-700 font-bold font-mono">username</code>
                  </p>
                </div>
              </div>
            </div>

            {/* SQL Actions Bar */}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-slate-700">SQL Schema Script & RLS:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleDownloadSQL}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
                  title="Download .sql file"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .sql</span>
                </button>
                <button
                  onClick={handleCopySQL}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition shadow-xs cursor-pointer ${
                    copied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                  }`}
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy SQL Script</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* SQL Code Block */}
            <pre className="bg-slate-950 text-slate-200 p-4 rounded-2xl text-[11px] font-mono overflow-x-auto max-h-52 border border-slate-800 leading-relaxed select-all">
              {SQL_INIT_SCRIPT}
            </pre>

            {/* Link to Supabase SQL editor */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <a
                href={`https://supabase.com/dashboard/project/${currentConfig.url.replace('https://', '').split('.')[0]}/sql/new`}
                target="_blank"
                rel="noreferrer"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
              >
                <span>Open SQL Editor in Supabase Dashboard</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>

              <button
                onClick={async () => {
                  await runHealthCheck();
                  await onRefreshData();
                  onShowToast('Database status has been re-checked!', 'info');
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>I have RUN the SQL (Verify Now)</span>
              </button>
            </div>

          </div>
        )}

        {/* TAB 3: BULK SYNC LOCAL DATA TO SUPABASE */}
        {activeTab === 'sync' && (
          <div className="space-y-4">
            
            <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 text-slate-800 text-xs space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-teal-950">
                <UploadCloud className="w-4 h-4 text-teal-600" />
                <span>Upload & Synchronize All Local Data to Supabase Cloud</span>
              </div>
              <p className="text-slate-600 leading-relaxed">
                This feature uploads all data in the application to your Supabase cloud database, guaranteeing that data is safely preserved and accessible from any device.
              </p>
            </div>

            {/* Local Data Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Members Data</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">{members.length}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Attendance Data</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">{attendance.length}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Cash Transactions</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">{cash.length}</div>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase">Officer Accounts</span>
                <div className="text-xl sm:text-2xl font-black text-slate-900 font-mono mt-0.5">{getCustomAccounts().length}</div>
              </div>
            </div>

            {syncStatus && (
              <div className={`p-3 rounded-2xl text-xs font-semibold ${
                syncStatus.includes('✅') 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}>
                {syncStatus}
              </div>
            )}

            <button
              onClick={handleBulkSyncToSupabase}
              disabled={isSyncingData}
              className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSyncingData ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Uploading Data to Supabase Cloud...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-4 h-4" />
                  <span>Upload &amp; Save All {members.length} Records to Supabase Cloud</span>
                </>
              )}
            </button>

          </div>
        )}

        {/* TAB 4: CUSTOM CREDENTIALS */}
        {activeTab === 'credentials' && (
          <form onSubmit={handleSaveCredentials} className="space-y-4">
            
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-slate-800 text-xs space-y-1">
              <p className="font-bold text-sm text-slate-900">Connect to Your Own Supabase Project</p>
              <p className="text-slate-600">
                If you have your own Supabase project, enter your Project URL and Anon Key below. All application data will automatically route to your project.
              </p>
            </div>

            {/* Input URL */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-blue-600" />
                <span>Supabase Project URL</span>
              </label>
              <input
                type="url"
                required
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://xyzabcdefghijklmnop.supabase.co"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>

            {/* Input Anon Key */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5 text-blue-600" />
                <span>Supabase Anon Public API Key</span>
              </label>
              <textarea
                required
                rows={3}
                value={inputKey}
                onChange={(e) => setInputKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-blue-600 focus:ring-2 focus:ring-blue-100 transition"
              />
            </div>

            {/* Save & Reset Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleResetToDefaultCredentials}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition cursor-pointer"
              >
                Use Default Project
              </button>

              <button
                type="submit"
                disabled={isSavingCreds}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-600/25 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {isSavingCreds ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save & Test Connection</span>
                  </>
                )}
              </button>
            </div>

          </form>
        )}

        {/* TAB 5: TESTING GUIDE (Role Member -> Admin & Pre-registration) */}
        {activeTab === 'testing_guide' && (
          <div className="space-y-4 text-xs">
            <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-sm text-indigo-950">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Testing Guide: Changing Roles from 'member' to 'admin' in Supabase</span>
              </div>
              <p className="text-indigo-900 leading-relaxed text-[11px]">
                Official guide to verify Google authentication, pre-registration staging list matching flow, and manual role modification testing in Supabase Table Editor.
              </p>
            </div>

            {/* Step-by-Step Instructions */}
            <div className="space-y-3">
              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    1
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">Open Supabase Dashboard & Navigate to Table Editor</h4>
                </div>
                <p className="text-slate-600 pl-8 leading-relaxed">
                  Open your Supabase project in your browser, click <strong>Table Editor</strong> (table icon on the left navigation bar), and select the <strong><code className="text-indigo-700 bg-slate-100 px-1 py-0.5 rounded">profiles</code></strong> table.
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    2
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">Locate Your User Row & Edit Role Column</h4>
                </div>
                <p className="text-slate-600 pl-8 leading-relaxed">
                  Find your email account row. Double-click the cell in the <strong><code className="text-indigo-700 bg-slate-100 px-1 py-0.5 rounded">role</code></strong> column. Change the value from <code className="bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold">'member'</code> to <code className="bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">'admin'</code>, then press <strong>Save / Enter</strong>.
                </p>
              </div>

              <div className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                    3
                  </span>
                  <h4 className="text-xs font-bold text-slate-900">Refresh Application Page & Observe Interface Changes</h4>
                </div>
                <p className="text-slate-600 pl-8 leading-relaxed">
                  Refresh this application page. In accordance with session checker logic:
                </p>
                <div className="pl-8 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <span className="font-bold text-slate-800 block">If role = 'member'</span>
                    <span className="text-[11px] text-slate-500">
                      The system automatically renders the <strong>Member Portal</strong>: Self-Attendance, Announcements, Learning Materials / Task Submissions, and Digital Member Card.
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-indigo-50/60 border border-indigo-200 space-y-1">
                    <span className="font-bold text-indigo-950 block">If role = 'admin'</span>
                    <span className="text-[11px] text-indigo-800">
                      The system renders the <strong>Admin Dashboard</strong>: Member Roster, CSV Pre-registration Staging, Attendance Recaps, Treasury Cash Ledger, and Task Grading.
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Pre-registration Staging List Workflow (Stages A & B)</span>
                </div>
                <ul className="text-slate-600 space-y-1.5 pl-6 list-disc text-[11px]">
                  <li><strong>Stage A (Admin CSV Upload):</strong> Admin uploads student roster CSV to <code className="font-mono text-emerald-800">allowed_members</code> table. Initial status = <code className="font-mono text-amber-700">'unclaimed'</code>.</li>
                  <li><strong>Stage B (Member Google Sign-in):</strong> When a member signs in with Google for the first time, Postgres trigger <code className="font-mono text-indigo-700">on_auth_user_created</code> matches their Google email against <code className="font-mono">allowed_members</code>. If matched, NIS/class data is copied to <code className="font-mono">profiles</code> and status is updated to <code className="font-mono text-emerald-700">'claimed'</code>!</li>
                  <li>If email is not listed in the CSV, the user receives <code className="font-mono text-amber-700">'pending_approval'</code> status with an informative banner to contact the Club Administrator.</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Reset Connection Confirmation Dialog */}
        <AnimatePresence>
          {showResetDefaultsConfirm && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full space-y-3.5 text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Reset Supabase Connection</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Reset connection credentials back to the default Supabase project?
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowResetDefaultsConfirm(false)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmResetToDefaultCredentials}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition cursor-pointer"
                  >
                    Reset Connection
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
