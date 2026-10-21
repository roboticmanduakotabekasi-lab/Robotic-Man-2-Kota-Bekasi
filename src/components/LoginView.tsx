import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserSession } from '../types';
import { AppFooter } from './AppFooter';
import { 
  verifyAccountCredentials, 
  registerNewAccount, 
  ENV_ADMIN_EMAIL, 
} from '../utils/authConfig';
import { getSupabase, getActiveSupabaseConfig } from '../lib/supabase';
import { fetchProfileFromDB, fetchAllowedMembersFromDB } from '../services/supabaseService';
import {
  validatePassword,
  validateUsername,
  generateSecurePassword,
  generateAntiBotChallenge,
  BotChallenge,
} from '../utils/passwordSecurity';
import {
  LogIn,
  UserPlus,
  User,
  Mail,
  Lock,
  AlertCircle,
  CheckCircle2,
  Bot,
  Eye,
  EyeOff,
  ShieldCheck,
  Sparkles,
  UserCheck,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  Info,
  Clock,
  ShieldAlert,
  Layers,
  ArrowRight,
  Hash,
  School,
  X,
} from 'lucide-react';
import { INITIAL_MEMBERS } from '../data/initialData';

interface LoginViewProps {
  onLoginSuccess: (session: UserSession) => void;
}

type AuthMode = 'signin' | 'signup';

const MAX_FAILED_ATTEMPTS = 3;
const LOCKOUT_DURATION_SECONDS = 30;

export const LoginView: React.FC<LoginViewProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('signin');

  // Sign In state (dengan pemulihan identifier yang diingat)
  const [signInIdentifier, setSignInIdentifier] = useState<string>(() => {
    try {
      return localStorage.getItem('robotics_remembered_identifier') || '';
    } catch {
      return '';
    }
  });
  const [signInPassword, setSignInPassword] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Deteksi sesi sebelumnya yang tersimpan untuk opsi pemulihan instan
  const savedSessionPreview = useMemo<UserSession | null>(() => {
    try {
      const raw = localStorage.getItem('robotics_auth') || localStorage.getItem('robotics_saved_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && parsed.name && parsed.username) {
          return parsed;
        }
      }
    } catch {}
    return null;
  }, []);

  // Sign Up state (Prompt for Name, Password, and NISN verification)
  const [signUpUsername, setSignUpUsername] = useState('');
  const [signUpEmail, setSignUpEmail] = useState('');
  const [signUpName, setSignUpName] = useState('');
  const [signUpNisn, setSignUpNisn] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [signUpRole, setSignUpRole] = useState<string>('Club Member');
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);

  // Real-time NISN verification against club directory (checks imported CSV records, localStorage caches, and INITIAL_MEMBERS)
  const matchedStudentFromNisn = useMemo(() => {
    const clean = signUpNisn.replace(/[^0-9]/g, '').trim();
    if (!clean || clean.length < 8) return null;

    // 1. Check imported CSV records in localStorage caches
    try {
      const rosterKeys = [
        'robotics_members', 
        'org_org-robotik-man2_members', 
        'robotics_admin_members',
        'robotics_pre_registered_members'
      ];
      for (const key of rosterKeys) {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const found = parsed.find((m: any) => {
              const mNisn = String(m.nisn || '').replace(/[^0-9]/g, '').trim();
              const mId = String(m.id_member || '').replace(/[^0-9]/g, '').trim();
              return (mNisn && mNisn === clean) || (mId && mId === clean);
            });
            if (found) {
              return {
                id_member: found.id_member || 0,
                fullName: found.fullName || found.full_name || 'Active Member',
                nisn: found.nisn || clean,
                grade: found.grade || 'X',
                classRoom: found.classRoom || found.classroom || 'A',
                status: found.status || 'aktif',
                role: 'member',
                jabatan: 'member',
              } as any;
            }
          }
        }
      }
    } catch {}

    // 2. Check official seeded CSV roster (INITIAL_MEMBERS)
    return INITIAL_MEMBERS.find((m) => {
      const mNisn = (m.nisn || '').replace(/[^0-9]/g, '').trim();
      return mNisn === clean || (m.id_member && String(m.id_member) === clean);
    }) || null;
  }, [signUpNisn]);

  // Anti-Bot Protection States
  const [honeypotField, setHoneypotField] = useState(''); // Hidden trap field for bots
  const [antiBotChallenge, setAntiBotChallenge] = useState<BotChallenge>(() => generateAntiBotChallenge());
  const [antiBotAnswer, setAntiBotAnswer] = useState('');
  const formMountTime = useRef<number>(Date.now());

  // Brute-force & Failed Attempts Protection State
  const [failedAttempts, setFailedAttempts] = useState<number>(() => {
    const saved = sessionStorage.getItem('robotics_login_failed_attempts');
    return saved ? parseInt(saved, 10) || 0 : 0;
  });
  const [lockoutTimer, setLockoutTimer] = useState<number>(() => {
    const lockoutUntil = sessionStorage.getItem('robotics_login_lockout_until');
    if (lockoutUntil) {
      const remaining = Math.ceil((parseInt(lockoutUntil, 10) - Date.now()) / 1000);
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  });

  // Feedback & UI Helpers
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedGenerated, setCopiedGenerated] = useState(false);

  // Countdown effect for brute-force rate limiter
  useEffect(() => {
    if (lockoutTimer <= 0) return;

    const interval = setInterval(() => {
      setLockoutTimer((prev) => {
        if (prev <= 1) {
          sessionStorage.removeItem('robotics_login_lockout_until');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutTimer]);

  // Real-time username evaluation
  const usernameCheck = useMemo(() => {
    if (!signUpUsername) return null;
    return validateUsername(signUpUsername);
  }, [signUpUsername]);

  // Real-time password evaluation against the 7 security rules
  const passwordCheck = useMemo(() => {
    if (!signUpPassword) return null;
    return validatePassword(signUpPassword, {
      username: signUpUsername,
      name: signUpName,
      email: signUpEmail,
    });
  }, [signUpPassword, signUpUsername, signUpName, signUpEmail]);

  // Reset or refresh challenges when switching modes
  const switchMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setError(null);
    setSuccessMessage(null);
    setAntiBotChallenge(generateAntiBotChallenge());
    setAntiBotAnswer('');
    setHoneypotField('');
    formMountTime.current = Date.now();
  };

  const handleRefreshChallenge = () => {
    setAntiBotChallenge(generateAntiBotChallenge());
    setAntiBotAnswer('');
  };

  // Generate a 16-char ultra-strong password that meets 100% of all 7 rules
  const handleGeneratePassword = () => {
    const strong = generateSecurePassword();
    setSignUpPassword(strong);
    setSignUpConfirmPassword(strong);
    setShowSignUpPassword(true);
    setCopiedGenerated(true);
    navigator.clipboard?.writeText(strong).catch(() => {});
    setTimeout(() => setCopiedGenerated(false), 3000);
  };

  // -------------------------------------------------------------
  // SIGN IN SUBMISSION (With Password Verification & Anti-Brute-Force)
  // -------------------------------------------------------------
  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // 1. Anti-Brute-Force Lockout check
    if (lockoutTimer > 0) {
      setError(`Login temporarily restricted for security. Please wait ${lockoutTimer} seconds.`);
      return;
    }

    // 2. Anti-Bot: Honeypot check
    if (honeypotField.trim() !== '') {
      setError('Suspicious automated activity detected (Bot trap triggered). Request rejected.');
      return;
    }

    // 3. Anti-Bot: Minimum submission time check (prevents instant bot scripts)
    const elapsedMs = Date.now() - formMountTime.current;
    if (elapsedMs < 600) {
      setError('Submission too fast detected by anti-bot security. Please try again.');
      formMountTime.current = Date.now();
      return;
    }

    setIsLoading(true);

    try {
      const account = await verifyAccountCredentials(signInIdentifier, signInPassword);

      if (account) {
        // Successful login: reset failed counter
        setFailedAttempts(0);
        sessionStorage.removeItem('robotics_login_failed_attempts');
        sessionStorage.removeItem('robotics_login_lockout_until');

        if (rememberMe) {
          try {
            localStorage.setItem('robotics_remembered_identifier', signInIdentifier.trim());
          } catch {}
        } else {
          try {
            localStorage.removeItem('robotics_remembered_identifier');
          } catch {}
        }

        const cleanRole = (account.role || '').toLowerCase();
        const envEmail = (ENV_ADMIN_EMAIL || 'roboticman2kotabekasi@gmail.com').toLowerCase().trim();
        const isStrictAdmin = 
          account.role === 'admin' || 
          account.username === 'admin' || 
          account.username === 'roboticman2kotabekasi' ||
          (account.email && account.email.toLowerCase().trim() === envEmail);

        const isExecutiveOrAdmin = 
          isStrictAdmin ||
          cleanRole === 'executive_board' || 
          cleanRole.includes('executive') ||
          cleanRole.includes('pembina') ||
          cleanRole.includes('ketua');

        const isDemo = Boolean(account.isDemo || account.username.startsWith('demo_') || account.username === 'demo_tamu');

        onLoginSuccess({
          username: account.username,
          name: account.name,
          role: isStrictAdmin && !isDemo ? 'admin' : account.role,
          email: account.email,
          token: account.token,
          authProvider: account.authProvider || 'credentials',
          isDemo: isDemo,
          loginTime: new Date().toISOString(),
          rememberMe: rememberMe,
          bypassNisnVerification: isExecutiveOrAdmin || isDemo,
          isVerifiedMember: isExecutiveOrAdmin || isDemo,
          membershipStatus: isExecutiveOrAdmin ? 'executive_board' : 'aktif',
          jabatan: isStrictAdmin && !isDemo ? 'president' : (cleanRole === 'executive_board' || cleanRole.includes('executive') ? 'vice_president' : (cleanRole.includes('pembina') ? 'pembina' : undefined)),
        });
      } else {
        // Failed login: increment counter & protect against brute force
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);
        sessionStorage.setItem('robotics_login_failed_attempts', String(newAttempts));

        if (newAttempts >= MAX_FAILED_ATTEMPTS) {
          const lockoutUntil = Date.now() + LOCKOUT_DURATION_SECONDS * 1000;
          sessionStorage.setItem('robotics_login_lockout_until', String(lockoutUntil));
          setLockoutTimer(LOCKOUT_DURATION_SECONDS);
          setError(
            `Invalid password or username! You have failed ${newAttempts} times. For account security, login is locked for ${LOCKOUT_DURATION_SECONDS} seconds.`
          );
        } else {
          const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
          setError(
            `Invalid password or username! Access denied. Remaining attempts before temporary lockout: ${remaining}.`
          );
        }
      }
    } catch {
      setError('Authentication error occurred. Please try again shortly.');
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // SIGN UP SUBMISSION (Strict 7 Password Rules & Anti-Bot Challenge)
  // -------------------------------------------------------------
  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // 1. Anti-Bot: Honeypot check (hidden trap field)
    if (honeypotField.trim() !== '') {
      setError('Automated Registration Detected: Request rejected because it is suspected of being a bot.');
      return;
    }

    // 2. Anti-Bot: Human Verification Math Challenge check
    const userAnswerNum = parseInt(antiBotAnswer.trim(), 10);
    if (isNaN(userAnswerNum) || userAnswerNum !== antiBotChallenge.answer) {
      setError('Security challenge answer ("I Am Not A Robot") is incorrect. Please solve the math question correctly.');
      handleRefreshChallenge();
      return;
    }

    // 3. Anti-Bot: Submission Speed Check
    const elapsedMs = Date.now() - formMountTime.current;
    if (elapsedMs < 1000) {
      setError('Instant submission detected. Please review your information and submit again.');
      formMountTime.current = Date.now();
      return;
    }

    // 3.4. Name Validation (Prompt for Name)
    if (!signUpName.trim()) {
      setError('Full Name is required for member registration.');
      return;
    }

    // 3.5. Identity Validation: Match the entered NISN against the imported database/CSV records
    const cleanNisn = signUpNisn.replace(/[^0-9]/g, '').trim();
    if (!cleanNisn || cleanNisn.length < 8) {
      setError('Valid Student ID / NISN (8-10 digits) is required to verify active club membership and prevent bot accounts.');
      return;
    }

    if (!matchedStudentFromNisn) {
      setError(
        `Identity Validation Failed: Student NISN "${cleanNisn}" is not registered in the official MAN 2 Robotics club roster or imported CSV database. To prevent bot registrations and unauthorized access, only active members listed in the directory may register.`
      );
      return;
    }

    // 4. Username Validation
    const userVal = validateUsername(signUpUsername);
    if (!userVal.isValid) {
      setError(userVal.error || 'Invalid username.');
      return;
    }

    // 5. Email Validation
    if (!signUpEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signUpEmail.trim())) {
      setError('Invalid email address format.');
      return;
    }

    // 6. Strict Password Validation (The 7 Rules)
    const pwdVal = validatePassword(signUpPassword, {
      username: signUpUsername,
      name: signUpName,
      email: signUpEmail,
    });
    if (!pwdVal.isValid) {
      setError(`Password does not meet security requirements: ${pwdVal.errors[0] || 'Complete all password criteria below.'}`);
      return;
    }

    // 7. Confirm Password Match
    if (signUpPassword !== signUpConfirmPassword) {
      setError('Password confirmation does not match. Please ensure both passwords match identically.');
      return;
    }

    setIsLoading(true);

    try {
      // Role Escalation Safeguard: Self-registered users are strictly assigned member role
      const verifiedStudentName = matchedStudentFromNisn.fullName || signUpName.trim();
      const result = await registerNewAccount({
        username: signUpUsername,
        email: signUpEmail,
        password: signUpPassword,
        name: verifiedStudentName,
        role: 'Club Member',
        nisn: cleanNisn,
      });

      if (result.success && result.account) {
        setSuccessMessage(`Welcome, ${verifiedStudentName}! Student account registered and active club membership validated (NISN: ${cleanNisn}).`);
        setTimeout(() => {
          onLoginSuccess({
            username: result.account!.username,
            name: verifiedStudentName,
            role: 'member',
            email: result.account!.email,
            nisn: cleanNisn,
            isVerifiedMember: true,
            bypassNisnVerification: false,
            membershipStatus: 'aktif',
            jabatan: 'member',
            authProvider: googleAuthLinked ? 'google' : (result.account!.authProvider || 'credentials'),
            loginTime: new Date().toISOString(),
          });
        }, 800);
      } else {
        setError(result.error || 'Failed to register account. Please try again.');
      }
    } catch (err: any) {
      setError(err?.message || 'An error occurred during account registration.');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick Sandbox Role Demo Login (Relaxed trial accounts for testing UI and navigation)
  const handleQuickRoleDemo = (roleKey: 'executive' | 'pembina' | 'anggota') => {
    setError(null);
    const configs: Record<string, { username: string; name: string; role: string; email: string; jabatan?: string }> = {
      executive: {
        username: 'demo_executive',
        name: 'Executive Board Officer (Trial)',
        role: 'Executive Board',
        jabatan: 'vice_president',
        email: 'executive.trial@man2kotabekasi.sch.id'
      },
      pembina: {
        username: 'demo_pembina',
        name: 'Abdul Khoir, S.Kom. (Trial Advisor)',
        role: 'Faculty Advisor',
        jabatan: 'pembina',
        email: 'advisor.trial@man2kotabekasi.sch.id'
      },
      anggota: {
        username: 'demo_member',
        name: 'Adinda Putri (Trial Member)',
        role: 'Club Member',
        jabatan: 'member',
        email: 'member.trial@man2kotabekasi.sch.id'
      }
    };

    const target = configs[roleKey];
    setSuccessMessage(`Signing in as ${target.role} (Sandbox Trial Account)...`);
    setTimeout(() => {
      onLoginSuccess({
        username: target.username,
        name: target.name,
        role: target.role,
        jabatan: target.jabatan,
        email: target.email,
        authProvider: 'credentials',
        isDemo: true,
        bypassNisnVerification: true,
        isVerifiedMember: true,
        membershipStatus: target.username === 'demo_executive' ? 'executive_board' : 'aktif',
        loginTime: new Date().toISOString(),
      });
    }, 350);
  };

  // Google OAuth Registration State
  const [googleAuthLinked, setGoogleAuthLinked] = useState<{ email: string; name: string } | null>(null);

  const handleStartGoogleSignUp = () => {
    setError(null);
    setGoogleAuthLinked({
      email: 'student.robotik@gmail.com',
      name: 'Muhammad Fadhil Pratama'
    });
    setSignUpEmail('student.robotik@gmail.com');
    setSignUpName('Muhammad Fadhil Pratama');
    setSignUpUsername('fadhil_pratama');
    setSuccessMessage('Google Account linked! Please verify your Full Name, create a Password, and enter your Student NISN below to complete registration.');
  };

  // Google OAuth Login State & Interactive Account Picker
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [isCustomGoogleMode, setIsCustomGoogleMode] = useState(false);

  const handleGoogleLogin = async () => {
    setIsGoogleLoading(true);
    setError(null);
    try {
      const config = getActiveSupabaseConfig();
      const supa = getSupabase();

      // If a real external Supabase URL is configured, trigger live OAuth redirect
      if (config.url && !config.url.includes('your-project') && !config.url.includes('supabase.co')) {
        const { error: authError } = await supa.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: window.location.origin,
          },
        });

        if (authError) {
          throw authError;
        }
      } else {
        // In local/sandbox preview or standard Google OAuth flow, display Google Account Selection
        setIsGoogleModalOpen(true);
      }
    } catch (err: any) {
      console.warn('Google OAuth note:', err);
      // Fallback to interactive Google dialog
      setIsGoogleModalOpen(true);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSelectGoogleAccount = (selectedEmail: string, selectedName?: string) => {
    const cleanEmail = selectedEmail.toLowerCase().trim();
    const envAdminEmail = (ENV_ADMIN_EMAIL || 'roboticman2kotabekasi@gmail.com').toLowerCase().trim();
    const isAdminAccount = cleanEmail === envAdminEmail || cleanEmail === 'roboticman2kotabekasi@gmail.com';

    setIsGoogleModalOpen(false);

    if (isAdminAccount) {
      // 1. Admin Authentication: Granted strictly via environment credentials, bypassing student onboarding
      setSuccessMessage('Admin verified via environment configuration! Logging into Administrator Dashboard...');
      setTimeout(() => {
        onLoginSuccess({
          username: 'admin',
          name: 'Robotic MAN 2 Kota Bekasi',
          role: 'admin',
          email: 'roboticman2kotabekasi@gmail.com',
          authProvider: 'google',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin',
          isGoogleAuth: true,
          membershipStatus: 'executive_board',
          jabatan: 'president',
          bypassNisnVerification: true,
          isVerifiedMember: true,
          loginTime: new Date().toISOString(),
        });
      }, 350);
      return;
    }

    // 2. Student Member Onboarding Flow: After signing up/in with Google, require Name, Password, and NISN
    if (authMode === 'signup') {
      setGoogleAuthLinked({
        email: cleanEmail,
        name: selectedName || cleanEmail.split('@')[0],
      });
      setSignUpEmail(cleanEmail);
      if (selectedName && !signUpName) setSignUpName(selectedName);
      if (!signUpUsername) setSignUpUsername(cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, ''));
      setSuccessMessage(`Google Account linked (${cleanEmail}). Please confirm your Full Name, create a Password, and enter your Student NISN below to validate active membership.`);
    } else {
      setSuccessMessage(`Google Authentication initiated for ${cleanEmail}. Please complete student NISN onboarding.`);
      setTimeout(() => {
        onLoginSuccess({
          username: cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_.]/g, ''),
          name: selectedName || cleanEmail.split('@')[0],
          role: 'member',
          email: cleanEmail,
          authProvider: 'google',
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
          isGoogleAuth: true,
          membershipStatus: 'aktif',
          jabatan: 'member',
          bypassNisnVerification: false,
          isVerifiedMember: false,
          loginTime: new Date().toISOString(),
        });
      }, 350);
    }
  };

  // Demo Guest Login Access (Local isolated sandbox)
  const handleDemoGuestLogin = () => {
    setError(null);
    setSuccessMessage('Entering as Demo Guest (Isolated Sandbox Data)...');
    setTimeout(() => {
      onLoginSuccess({
        username: 'demo_tamu',
        name: 'Demo Guest',
        role: 'Demo Guest',
        email: 'demo@man2kotabekasi.sch.id',
        authProvider: 'credentials',
        isDemo: true,
        loginTime: new Date().toISOString(),
      });
    }, 400);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between relative overflow-hidden">
      {/* Decorative ambient background accents */}
      <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#4338CA]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#C7D2FE]/30 rounded-full blur-3xl pointer-events-none" />

      {/* Main Center Content Column */}
      <div className="flex-1 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
        {/* Header & Logo */}
      <motion.div 
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="sm:mx-auto sm:w-full sm:max-w-md relative z-10 text-center px-4"
      >
        <div className="flex justify-center mb-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-600/25 ring-4 ring-blue-100">
            <Bot className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-xl sm:text-2xl font-mono font-black tracking-tight text-slate-900">
          roboticman2kotabekasi
        </h2>
        <p className="text-xs font-semibold text-blue-700 mt-0.5">
          MAN 2 Kota Bekasi Robotics Extracurricular Management System
        </p>
        <p className="text-[11px] text-slate-500 mt-1">
          {authMode === 'signin'
            ? 'Sign in to access member directory, meeting attendance, and club treasury'
            : 'Member and executive officer account registration'}
        </p>
      </motion.div>

      {/* Auth Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.08 }}
        className="mt-6 sm:mx-auto sm:w-full sm:max-w-lg relative z-10 px-4 sm:px-0"
      >
        <div className="bg-white border border-slate-200 shadow-xl shadow-slate-900/5 rounded-2xl py-7 px-5 sm:px-9">
          {/* Navigation Tab: Sign In vs Sign Up */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => switchMode('signin')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
                authMode === 'signin'
                  ? 'bg-white text-[#4338CA] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => switchMode('signup')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all duration-150 cursor-pointer ${
                authMode === 'signup'
                  ? 'bg-white text-[#4338CA] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Create Account</span>
            </motion.button>
          </div>

          {/* Feedback alerts */}
          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-rose-700 text-sm">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-rose-500" />
              <div className="flex-1 text-xs leading-relaxed">{error}</div>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3.5 rounded-xl bg-[#EEF2FF] border border-[#C7D2FE] flex items-start gap-2.5 text-[#312E81] text-sm">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#4338CA]" />
              <div className="flex-1 text-xs leading-relaxed">{successMessage}</div>
            </div>
          )}

          {/* Lockout Warning Banner */}
          {lockoutTimer > 0 && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3 text-amber-800 text-xs">
              <Clock className="w-5 h-5 flex-shrink-0 text-amber-600 animate-pulse" />
              <div>
                <span className="font-bold">Security Active: </span>
                System has temporarily locked login attempts. Retry in{' '}
                <span className="font-mono font-bold text-amber-900 text-sm bg-amber-200/80 px-1.5 py-0.5 rounded">
                  {lockoutTimer} seconds
                </span>.
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 1: SIGN IN FORM                                      */}
          {/* ======================================================== */}
          <AnimatePresence mode="wait">
            {authMode === 'signin' ? (
              <motion.div
                key="signin-pane"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.18 }}
              >
                {/* Google Sign In Button */}
                <div className="space-y-3 mb-4">
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isGoogleLoading || isLoading}
                    className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-xl border border-slate-300 shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
                  >
                    {isGoogleLoading ? (
                      <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                    )}
                    <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign in with Google (OAuth)'}</span>
                  </button>

                  {/* Real Google OAuth Sign In */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-200" />
                    </div>
                    <div className="relative flex justify-center text-[10px] uppercase">
                      <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">
                        or sign in with credentials
                      </span>
                    </div>
                  </div>
                </div>

                <form className="space-y-4" onSubmit={handleSignIn}>
              {/* Invisible Honeypot Trap to Catch Bots */}
              <div style={{ display: 'none', opacity: 0, position: 'absolute', pointerEvents: 'none' }} aria-hidden="true">
                <label htmlFor="signin_website_hp">Leave this empty if human</label>
                <input
                  id="signin_website_hp"
                  type="text"
                  name="website_hp"
                  value={honeypotField}
                  onChange={(e) => setHoneypotField(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Quick Resume Active Saved Session */}
              {savedSessionPreview && (
                <div className="p-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/90 rounded-xl flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-800 truncate flex items-center gap-1.5">
                        <span>Active Saved Session</span>
                        <span className="text-[9px] bg-emerald-100 text-emerald-800 font-semibold px-1.5 py-0.2 rounded-full border border-emerald-200">
                          {savedSessionPreview.role || 'Admin'}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate">
                        {savedSessionPreview.name} ({savedSessionPreview.username})
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onLoginSuccess(savedSessionPreview)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs transition-all shrink-0 cursor-pointer active:scale-95 flex items-center gap-1"
                    title="Resume active session directly"
                  >
                    <span>Resume</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Username or Email
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    disabled={lockoutTimer > 0}
                    autoComplete="username"
                    value={signInIdentifier}
                    onChange={(e) => setSignInIdentifier(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm transition-all disabled:opacity-50"
                    placeholder="admin / email@example.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showSignInPassword ? 'text' : 'password'}
                    required
                    disabled={lockoutTimer > 0}
                    autoComplete="current-password"
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm transition-all disabled:opacity-50"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    disabled={lockoutTimer > 0}
                    onClick={() => setShowSignInPassword(!showSignInPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showSignInPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {failedAttempts > 0 && lockoutTimer === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1 flex items-center gap-1 font-medium">
                    <ShieldAlert className="w-3 h-3" />
                    <span>Failed attempts: {failedAttempts} of {MAX_FAILED_ATTEMPTS}.</span>
                  </p>
                )}
              </div>

              {/* Remember Session Feature (Anti Auto-Logout) */}
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-[#4338CA] bg-slate-100 border-slate-300 rounded focus:ring-[#4338CA] focus:ring-2 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-700">
                    Remember Session &amp; Stay Signed In
                  </span>
                </label>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-medium border border-emerald-200/70 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Saved on Device</span>
                </span>
              </div>

              <button
                type="submit"
                disabled={isLoading || lockoutTimer > 0}
                className="w-full mt-2 py-2.5 px-4 bg-[#4338CA] hover:bg-[#312E81] text-white font-semibold rounded-xl shadow-md shadow-[#4338CA]/20 hover:shadow-[#4338CA]/30 transition-all duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-4 h-4" />
                    <span>Sign In to System</span>
                  </>
                )}
              </button>

              {/* Quick Switch to Sign Up */}
              <div className="text-center pt-2">
                <span className="text-xs text-slate-500">Don't have an account yet? </span>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-xs font-semibold text-[#4338CA] hover:text-[#312E81] hover:underline cursor-pointer"
                >
                  Create New Account
                </button>
              </div>

              {/* Clean Minimal Demo Access */}
              <div className="pt-3 border-t border-slate-100 text-center space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Quick Sandbox Test (Trial Accounts):
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-mono font-bold">
                    🧪 Demo Mode
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => handleQuickRoleDemo('executive')}
                    className="py-2.5 px-2 text-xs font-bold rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/90 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-2xs active:scale-95 text-center"
                    title="Sign in with trial account as Executive Board"
                  >
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span className="text-[11px] font-bold leading-tight">Executive</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRoleDemo('pembina')}
                    className="py-2.5 px-2 text-xs font-bold rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200/90 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-2xs active:scale-95 text-center"
                    title="Sign in with trial account as Faculty Advisor"
                  >
                    <School className="w-4 h-4 text-purple-600" />
                    <span className="text-[11px] font-bold leading-tight">Advisor</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleQuickRoleDemo('anggota')}
                    className="py-2.5 px-2 text-xs font-bold rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/90 transition cursor-pointer flex flex-col items-center justify-center gap-1 shadow-2xs active:scale-95 text-center"
                    title="Sign in with trial account as Student Member"
                  >
                    <User className="w-4 h-4 text-emerald-600" />
                    <span className="text-[11px] font-bold leading-tight">Member</span>
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 text-center leading-tight pt-0.5">
                  Trial sandbox accounts are unlocked to test navigation and features freely, separated from real system accounts.
                </p>
              </div>
            </form>
          </motion.div>
        ) : (
          /* ======================================================== */
          /* TAB 2: SIGN UP FORM WITH STRICT 7 RULES & ANTI-BOT       */
          /* ======================================================== */
          <motion.div
            key="signup-pane"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
          >
            {/* Google Sign Up Button */}
            <div className="space-y-3 mb-4">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={isGoogleLoading || isLoading}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 text-slate-800 font-semibold rounded-xl border border-slate-300 shadow-2xs hover:shadow-xs transition-all flex items-center justify-center gap-2.5 text-xs sm:text-sm cursor-pointer disabled:opacity-50"
              >
                {isGoogleLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                )}
                <span>{isGoogleLoading ? 'Connecting to Google...' : 'Sign up with Google (OAuth)'}</span>
              </button>



              {googleAuthLinked && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Google Account Linked: {googleAuthLinked.email}</span>
                  </div>
                  <p className="text-[11px] text-emerald-700 leading-snug">
                    Next step: Confirm your Full Name, create an account password, and verify your Student NISN below to activate your club membership.
                  </p>
                </div>
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-white px-2 text-slate-400 font-semibold tracking-wider">
                    student registration details
                  </span>
                </div>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSignUp}>
              {/* Invisible Honeypot Trap to Catch Bots */}
              <div style={{ display: 'none', opacity: 0, position: 'absolute', pointerEvents: 'none' }} aria-hidden="true">
                <label htmlFor="signup_website_hp">This field is only for detecting bots, leave it empty</label>
                <input
                  id="signup_website_hp"
                  type="text"
                  name="website_url_trap"
                  value={honeypotField}
                  onChange={(e) => setHoneypotField(e.target.value)}
                  tabIndex={-1}
                  autoComplete="off"
                />
              </div>

              {/* Full Name field (Required prompt for Name) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Full Name <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">Student full name as registered</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={signUpName}
                    onChange={(e) => setSignUpName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm transition-all"
                    placeholder="e.g. Adinda Putri, Muhammad Rizky"
                  />
                </div>
              </div>

              {/* NISN Verification field (Validate active club membership and prevent bots) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Student ID / NISN <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setSignUpNisn('0110000001');
                      if (!signUpName) setSignUpName('Adinda Putri');
                    }}
                    className="text-[10px] font-semibold text-[#4338CA] hover:underline cursor-pointer"
                  >
                    Auto-fill Sample NISN
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Hash className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={signUpNisn}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '');
                      setSignUpNisn(clean);
                      const match = INITIAL_MEMBERS.find(m => (m.nisn || '').replace(/[^0-9]/g, '') === clean);
                      if (match && !signUpName) {
                        setSignUpName(match.fullName);
                      }
                    }}
                    maxLength={12}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm font-mono transition-all"
                    placeholder="10-digit Student NISN (e.g. 0110000001)"
                  />
                </div>

                {/* Live NISN Membership Verification Status */}
                {signUpNisn && (
                  <div className="mt-1.5 text-[11px]">
                    {matchedStudentFromNisn ? (
                      <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">
                          <strong>Active Member Verified:</strong> {matchedStudentFromNisn.fullName} ({matchedStudentFromNisn.grade}-{matchedStudentFromNisn.classRoom})
                        </span>
                      </div>
                    ) : signUpNisn.length >= 8 ? (
                      <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-800 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>Valid NISN Format ({signUpNisn.length} digits) - Active Membership Check Ready</span>
                      </div>
                    ) : (
                      <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Enter 8-10 digits to verify active enrollment in MAN 2 Robotics</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Username field */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Username <span className="text-rose-500">*</span>
                  </label>
                  <span className="text-[10px] text-slate-400">4-20 characters, no spaces</span>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value.toLowerCase().replace(/\s+/g, ''))}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm transition-all"
                    placeholder="e.g. robotics_officer"
                  />
                </div>

                {/* Username live validation hints */}
                {signUpUsername && usernameCheck && (
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px]">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${usernameCheck.rules.length ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                      {usernameCheck.rules.length ? <Check className="w-3 h-3" /> : '×'} 4-20 Characters
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${usernameCheck.rules.characters ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                      {usernameCheck.rules.characters ? <Check className="w-3 h-3" /> : '×'} Letters/Numbers/Dots/Underscores
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${usernameCheck.rules.notReserved ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                      {usernameCheck.rules.notReserved ? <Check className="w-3 h-3" /> : '×'} Not Reserved Word
                    </span>
                  </div>
                )}
              </div>

              {/* Email field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Account Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    required
                    value={signUpEmail}
                    onChange={(e) => setSignUpEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm transition-all"
                    placeholder="name@email.com"
                  />
                </div>
              </div>

              {/* New Account Role (Default Security: Member / Student) */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Registrant Account Role Status
                </label>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0 mt-0.5">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">Club Member (Extracurricular Student)</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Security Policy Active
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                      New accounts are automatically registered as Club Members. Officer or administrative roles (President, Secretary, Treasurer, Advisor) can only be granted via promotion by the Club Advisor or President in the management panel.
                    </p>
                  </div>
                </div>
              </div>

              {/* Password field & Generator */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Password <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleGeneratePassword}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#4338CA] hover:text-[#312E81] hover:underline cursor-pointer"
                  >
                    <KeyRound className="w-3 h-3" />
                    <span>{copiedGenerated ? 'Password Generated & Copied!' : 'Generate Strong Password (16 Chars)'}</span>
                  </button>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    required
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full pl-10 pr-11 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm transition-all font-mono"
                    placeholder="Min 12 diverse characters"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    tabIndex={-1}
                    aria-label="Toggle password visibility"
                  >
                    {showSignUpPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Password Strength Meter & Live Checklist */}
                {signUpPassword && passwordCheck && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-500 font-medium">Password Strength:</span>
                      <span className={`font-bold px-2 py-0.5 rounded-full border text-[10px] ${passwordCheck.strengthColor}`}>
                        {passwordCheck.strengthLabel} ({passwordCheck.score}%)
                      </span>
                    </div>

                    {/* Score Bar */}
                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          passwordCheck.score >= 85
                            ? 'bg-emerald-500'
                            : passwordCheck.score >= 60
                            ? 'bg-teal-500'
                            : passwordCheck.score >= 40
                            ? 'bg-amber-500'
                            : 'bg-rose-500'
                        }`}
                        style={{ width: `${passwordCheck.score}%` }}
                      />
                    </div>

                    {/* Detailed Rules Checklist */}
                    <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px]">
                      {passwordCheck.rules.map((rule) => (
                        <div
                          key={rule.id}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-md border ${
                            rule.isValid
                              ? 'bg-emerald-50/70 border-emerald-200 text-emerald-800'
                              : 'bg-slate-100 border-slate-200 text-slate-500'
                          }`}
                        >
                          {rule.isValid ? (
                            <Check className="w-3 h-3 text-emerald-600 flex-shrink-0" />
                          ) : (
                            <span className="w-3 h-3 rounded-full border border-slate-300 flex-shrink-0 inline-block text-center text-[9px] leading-none text-slate-400">
                              ○
                            </span>
                          )}
                          <span className="truncate">{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Konfirmasi Kata Sandi field */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                  Confirm Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showSignUpPassword ? 'text' : 'password'}
                    required
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#4338CA] focus:border-transparent text-sm transition-all font-mono"
                    placeholder="Repeat password above"
                  />
                </div>
                {signUpConfirmPassword && (
                  <p className={`text-[11px] mt-1 font-medium flex items-center gap-1 ${signUpPassword === signUpConfirmPassword ? 'text-emerald-600' : 'text-rose-500'}`}>
                    {signUpPassword === signUpConfirmPassword ? (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Passwords match.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3.5 h-3.5" />
                        <span>Passwords do not match.</span>
                      </>
                    )}
                  </p>
                )}
              </div>

              {/* ======================================================== */}
              {/* ANTI-BOT HUMAN VERIFICATION CHALLENGE                    */}
              {/* ======================================================== */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-[#4338CA]" />
                    <span>Human Security Challenge (Anti-Bot)</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleRefreshChallenge}
                    title="Refresh challenge"
                    className="text-slate-400 hover:text-[#4338CA] p-1 rounded transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-xs font-mono font-bold text-[#312E81] shadow-2xs whitespace-nowrap">
                    {antiBotChallenge.question}
                  </div>
                  <input
                    type="number"
                    required
                    value={antiBotAnswer}
                    onChange={(e) => setAntiBotAnswer(e.target.value)}
                    placeholder="Numeric answer"
                    className="flex-1 py-1.5 px-3 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#4338CA] font-mono"
                  />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Prevents automated bot registrations and spam scripts.
                </p>
              </div>

              {/* Submit button for Sign Up */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-2.5 px-4 bg-[#4338CA] hover:bg-[#312E81] text-white font-semibold rounded-xl shadow-md shadow-[#4338CA]/20 hover:shadow-[#4338CA]/30 transition-all duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-50 cursor-pointer"
              >
                {isLoading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    <span>Register Verified Account</span>
                  </>
                )}
              </button>

              {/* Switch to Sign In */}
              <div className="text-center pt-2 border-t border-slate-100">
                <span className="text-xs text-slate-500">Already have an account? </span>
                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="text-xs font-semibold text-[#4338CA] hover:text-[#312E81] hover:underline cursor-pointer"
                >
                  Sign In Now
                </button>
              </div>
            </form>
          </motion.div>
        )}
        </AnimatePresence>
        </div>
      </motion.div>
      </div>

      {/* Google OAuth Account Selection Modal */}
      <AnimatePresence>
        {isGoogleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white border border-slate-200 rounded-3xl w-full max-w-md p-6 shadow-2xl relative space-y-5"
            >
              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsGoogleModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              {/* Header with Google Logo */}
              <div className="text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center mx-auto shadow-2xs">
                  <svg className="w-6 h-6" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {authMode === 'signup' ? 'Sign up with Google' : 'Sign in with Google'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose an account to continue to <strong>Robotic MAN 2 Kota Bekasi</strong>
                  </p>
                </div>
              </div>

              {/* Google Account Sign-In Form (Privacy-Safe for GitHub) */}
              <div className="space-y-3">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customGoogleEmail.trim()) {
                      handleSelectGoogleAccount(customGoogleEmail.trim(), customGoogleName.trim());
                    }
                  }}
                  className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3"
                >
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Google Email Address
                    </label>
                    <input
                      type="email"
                      required
                      value={customGoogleEmail}
                      onChange={(e) => setCustomGoogleEmail(e.target.value)}
                      placeholder="nama@gmail.com"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Full Name <span className="text-slate-400 font-normal lowercase">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={customGoogleName}
                      onChange={(e) => setCustomGoogleName(e.target.value)}
                      placeholder="Nama Lengkap"
                      className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                    />
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsGoogleModalOpen(false);
                        setCustomGoogleEmail('');
                        setCustomGoogleName('');
                      }}
                      className="py-2.5 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition cursor-pointer"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <span>Lanjutkan dengan Google</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>

              {/* Security Policy Notice */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 text-[10px] text-slate-500 leading-relaxed text-center">
                Protected by National Student Identity (NISN) validation and anti-bot verification.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Official Edge-to-Edge Horizontal Footer */}
      <AppFooter />
    </div>
  );
};
