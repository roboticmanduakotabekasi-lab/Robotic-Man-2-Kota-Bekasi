import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Hash, 
  Calendar, 
  UserCheck, 
  Sparkles, 
  LogOut, 
  HelpCircle,
  School,
  Lock,
  ArrowRight,
  Bot,
  User,
  Eye,
  EyeOff
} from 'lucide-react';
import { Member, UserSession } from '../types';
import { normalizeDateString } from '../utils/universalDataParser';
import { playClickTick, playSuccessChime, playWarningBuzzer } from '../utils/audioFeedback';
import { addOrUpdateAccount, hashPassword } from '../utils/authConfig';

interface StudentVerificationModalProps {
  isOpen: boolean;
  session: UserSession;
  members: Member[];
  onVerificationSuccess: (verifiedMember: Member, updatedSession: UserSession) => void;
  onSkip?: () => void;
  onLogout: () => void;
}

export const StudentVerificationModal: React.FC<StudentVerificationModalProps> = ({
  isOpen,
  session,
  members,
  onVerificationSuccess,
  onSkip,
  onLogout,
}) => {
  const [nameInput, setNameInput] = useState(session.name || '');
  const [passwordInput, setPasswordInput] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [nisnInput, setNisnInput] = useState(session.nisn || '');
  const [birthDateInput, setBirthDateInput] = useState(session.birthDate || '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [successMember, setSuccessMember] = useState<Member | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  if (!isOpen) return null;

  // Auto-fill contoh siswa untuk kemudahan testing
  const handleAutoFillSample = (sampleMember?: Member) => {
    playClickTick();
    const target = sampleMember || members.find(m => m.birthDate && m.nisn) || members[0];
    if (target) {
      setNameInput(target.fullName);
      setPasswordInput('Robotik2026!');
      setNisnInput(target.nisn);
      setBirthDateInput(target.birthDate || '2010-04-15');
      setErrorMsg(null);
    }
  };

  // Sanitasi nomor NISN (hanya digit angka)
  const sanitizeNisn = (val: string) => val.replace(/[^0-9]/g, '').trim();

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault();
    playClickTick();
    setErrorMsg(null);

    // 1. Name validation
    if (!nameInput.trim()) {
      setErrorMsg('Full Name is required to complete student onboarding.');
      playWarningBuzzer();
      return;
    }

    // 2. Password validation (required for secure student portal login)
    if (!passwordInput || passwordInput.length < 6) {
      setErrorMsg('Please create an Account Password of at least 6 characters to secure your student access.');
      playWarningBuzzer();
      return;
    }

    // 3. NISN input validation
    const cleanInputNisn = sanitizeNisn(nisnInput);
    if (!cleanInputNisn || cleanInputNisn.length < 8) {
      setErrorMsg('Enter a valid Student ID / NISN (at least 8-10 digits).');
      playWarningBuzzer();
      return;
    }

    setIsVerifying(true);

    setTimeout(async () => {
      // 4. Strict Identity Validation: Match the entered NISN against imported CSV / roster records
      const matched = members.find((m) => {
        const mNisn = sanitizeNisn(m.nisn || '');
        if (mNisn && mNisn === cleanInputNisn) return true;
        // Member ID tolerance check
        if (m.id_member && sanitizeNisn(String(m.id_member)) === cleanInputNisn) return true;
        return false;
      });

      if (!matched) {
        setIsVerifying(false);
        setErrorMsg(
          `Identity Validation Failed: Student NISN "${cleanInputNisn}" was not found in the official Robotic MAN 2 Kota Bekasi directory or imported CSV records. You must be an active registered member to access the system (anti-bot safeguard).`
        );
        playWarningBuzzer();
        return;
      }

      // 5. Date of birth check (optional, if registered in roster records)
      let cleanInputBirth = '';
      if (birthDateInput) {
        cleanInputBirth = normalizeDateString(birthDateInput);
        const cleanMemberBirth = matched.birthDate ? normalizeDateString(matched.birthDate) : '';
        if (cleanMemberBirth && cleanInputBirth && cleanInputBirth !== cleanMemberBirth) {
          setIsVerifying(false);
          setErrorMsg(
            `Date of birth does not match student records for Student ID ${cleanInputNisn}. Verification rejected to prevent unauthorized access.`
          );
          playWarningBuzzer();
          return;
        }
        if (!cleanMemberBirth && cleanInputBirth) {
          matched.birthDate = cleanInputBirth;
        }
      }

      // 6. Identity Verified!
      setIsVerifying(false);
      setSuccessMember(matched);
      playSuccessChime();

      // Role Escalation Safeguard: Verified students are strictly assigned 'member' role
      const verifiedStudentName = matched.fullName || nameInput.trim() || session.name;
      const studentUsername = session.username || `siswa_${cleanInputNisn}`;

      // Persist user account with their chosen password securely hashed
      const hashedPassword = await hashPassword(passwordInput);
      addOrUpdateAccount({
        username: studentUsername,
        password: hashedPassword,
        name: verifiedStudentName,
        role: 'member',
        email: session.email || `${cleanInputNisn}@man2kotabekasi.sch.id`,
        nisn: cleanInputNisn,
        authProvider: session.authProvider || 'google',
        avatarUrl: session.avatarUrl,
      });

      const updatedSession: UserSession = {
        ...session,
        username: studentUsername,
        nisn: matched.nisn || cleanInputNisn,
        nis: matched.nisn || cleanInputNisn,
        name: verifiedStudentName,
        kelas: `${matched.grade || ''}-${matched.classRoom || ''}`.replace(/^-|-$/, ''),
        birthDate: cleanInputBirth || matched.birthDate,
        isVerifiedMember: true,
        membershipStatus: matched.status || 'aktif',
        role: 'member', // Strictly member role
        jabatan: 'member',
      };

      // Berikan jeda animasi sebelum masuk
      setTimeout(() => {
        onVerificationSuccess(matched, updatedSession);
      }, 1400);
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="bg-white border border-indigo-200 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl relative"
      >
        {/* Header Visual */}
        <div className="bg-gradient-to-br from-[#0F172A] via-[#312E81] to-[#4338CA] p-6 text-white text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-indigo-500/20 rounded-full blur-2xl pointer-events-none" />
          <div className="w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center mx-auto mb-3 shadow-lg">
            <ShieldCheck className="w-8 h-8 text-indigo-200" />
          </div>
          <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-white/15 text-indigo-100 border border-white/20 inline-block mb-1.5">
            Member Identity Verification
          </span>
          <h2 className="text-lg font-black text-white tracking-tight">
            Official Student Validation
          </h2>
          <p className="text-xs text-indigo-100/90 mt-1 max-w-xs mx-auto leading-relaxed">
            To verify you are an enrolled student at MAN 2 Kota Bekasi and prevent unauthorized access, match your student NISN and date of birth.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-4">
          <AnimatePresence mode="wait">
            {successMember ? (
              <motion.div
                key="verified-success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-4 text-center space-y-3"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto border-2 border-emerald-300">
                  <CheckCircle2 className="w-9 h-9" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Student Identity Verified!
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 font-medium">
                    Welcome, <strong className="text-indigo-900">{successMember.fullName}</strong>
                  </p>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-left text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">NISN:</span>
                    <span className="font-mono font-bold text-slate-900">{successMember.nisn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Class:</span>
                    <span className="font-bold text-slate-900">{successMember.grade}-{successMember.classRoom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Status:</span>
                    <span className="text-emerald-700 font-bold">● Active in Robotics Club</span>
                  </div>
                </div>
                <p className="text-[11px] text-slate-400 animate-pulse">
                  Entering Extracurricular Student Portal...
                </p>
              </motion.div>
            ) : (
              <motion.form
                key="verify-form"
                onSubmit={handleVerify}
                className="space-y-4"
              >
                {/* Alert error */}
                {errorMsg && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed">{errorMsg}</div>
                  </div>
                )}

                {/* Input Full Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Student Full Name *</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Official Registered Name</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={nameInput}
                      onChange={(e) => setNameInput(e.target.value)}
                      placeholder="e.g. Adinda Putri Rahmawati"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Input Password */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Account Password *</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Min. 6 Characters</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={passwordInput}
                      onChange={(e) => setPasswordInput(e.target.value)}
                      placeholder="Create secure password"
                      className="w-full px-4 py-2.5 pr-11 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Input NISN */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Hash className="w-3.5 h-3.5 text-indigo-600" />
                      <span>National Student ID (NISN) *</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Example: 0110000001</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={nisnInput}
                      onChange={(e) => setNisnInput(e.target.value)}
                      placeholder="Enter your 10-digit NISN"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-sm placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                    />
                  </div>
                </div>

                {/* Input Tanggal Lahir (Optional verification) */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Student Date of Birth</span>
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">Optional / Roster Record</span>
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={birthDateInput}
                      onChange={(e) => setBirthDateInput(e.target.value)}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition"
                    />
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Standard format: Year-Month-Day (YYYY-MM-DD).
                  </p>
                </div>

                {/* Security Anti-Bot Note */}
                <div className="p-3 bg-indigo-50/60 border border-indigo-100 rounded-xl flex items-start gap-2 text-indigo-900 text-xs">
                  <Bot className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <p className="text-[11px] leading-relaxed">
                    The system matches your NISN and birth date against official school robotics roster records.
                  </p>
                </div>

                {/* Quick Auto-Fill for Testing - Only shown for demo/sandbox accounts */}
                {session.isDemo && (
                  <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span>💡</span>
                      <span>Quick Testing / Demo:</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleAutoFillSample()}
                        className="px-2 py-1 rounded-lg bg-amber-200/70 hover:bg-amber-300 text-amber-900 font-bold transition cursor-pointer text-[10px]"
                        title="Auto-fill with sample student record (Adinda Putri - 0110000001)"
                      >
                        Fill Sample Record
                      </button>
                      {onSkip && (
                        <button
                          type="button"
                          onClick={onSkip}
                          className="px-2 py-1 rounded-lg bg-white border border-amber-300 hover:bg-amber-100/60 text-amber-950 font-bold transition cursor-pointer text-[10px]"
                          title="Skip verification to explore the application"
                        >
                          Skip Demo →
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Submit and Logout Buttons */}
                <div className="pt-2 space-y-2">
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="w-full py-3 px-4 bg-[#4338CA] hover:bg-[#312E81] text-white text-xs font-bold rounded-xl transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Verifying with School Database...</span>
                      </>
                    ) : (
                      <>
                        <UserCheck className="w-4 h-4" />
                        <span>Verify Student Identity</span>
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {/* Tombol Skip Khusus */}
                  {onSkip && (
                    <button
                      type="button"
                      onClick={onSkip}
                      className="w-full py-2.5 px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <span>Skip Verification (Demo Mode)</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  )}

                  <div className="flex items-center justify-between text-xs pt-1">
                    <button
                      type="button"
                      onClick={() => setShowHelp(!showHelp)}
                      className="text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                    >
                      <HelpCircle className="w-3.5 h-3.5" />
                      <span>Need Help?</span>
                    </button>

                    <button
                      type="button"
                      onClick={onLogout}
                      className="text-rose-600 hover:text-rose-700 hover:underline flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                  {showHelp && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1.5"
                    >
                      <p className="font-bold text-slate-900">Verification Guide:</p>
                      <p>1. If you are a new member, ensure the Advisor or Secretary has imported your name into the member directory.</p>
                      <p>2. Your NISN consists of 10 digits as printed on your student ID card or report card.</p>
                      <p>3. If your record is still not found, please contact the club advisor in the robotics lab.</p>
                    </motion.div>
                  )}
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
