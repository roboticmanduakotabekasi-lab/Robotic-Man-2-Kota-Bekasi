import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  FileText, 
  Calendar, 
  Send, 
  UserCheck, 
  ShieldCheck, 
  Check, 
  Sparkles,
  HelpCircle,
  Timer,
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, AttendanceRecord, AttendanceStatus, UserSession } from '../types';
import { playClickTick, playSuccessChime } from '../utils/audioFeedback';

export type MemberSelfAttendanceStatus = 'Present' | 'Permitted' | 'Sick' | 'Absent';

export interface MemberAttendanceViewProps {
  member?: Member | null;
  session?: UserSession | null;
  todayDate?: string; // YYYY-MM-DD
  existingAttendance?: AttendanceRecord | null;
  onSaveAttendance?: (record: {
    tanggal: string;
    nisn: string;
    namaAnggota: string;
    status: AttendanceStatus;
    notes?: string;
  }) => Promise<void> | void;
  // Optional window parameters (default: 23:59:59 of active date or custom window)
  windowEndTime?: string; // e.g. "17:00:00" or ISO timestamp
  isWindowOpen?: boolean;
}

export const MemberAttendanceView: React.FC<MemberAttendanceViewProps> = ({
  member,
  session,
  todayDate,
  existingAttendance,
  onSaveAttendance,
  windowEndTime,
  isWindowOpen = true,
}) => {
  // Current active date (YYYY-MM-DD)
  const activeDate = useMemo(() => {
    return todayDate || new Date().toISOString().split('T')[0];
  }, [todayDate]);

  // Resolve current member's personal identity
  const memberName = member?.fullName || member?.full_name || session?.name || session?.username || 'Club Member';
  const memberNisn = member?.nisn || session?.nisn || session?.nis || '-';
  const memberClass = member ? `${member.grade || ''} ${member.classRoom || ''}`.trim() : (session?.kelas || 'Member');

  // Local state for self-service action and notes
  const [selectedStatus, setSelectedStatus] = useState<MemberSelfAttendanceStatus | null>(() => {
    if (existingAttendance?.status) {
      const s = existingAttendance.status.toLowerCase();
      if (s === 'present' || s === 'hadir') return 'Present';
      if (s === 'permitted' || s === 'excused' || s === 'izin') return 'Permitted';
      if (s === 'sick' || s === 'sakit') return 'Sick';
      if (s === 'absent' || s === 'unexcused' || s === 'alpha') return 'Absent';
    }
    return null;
  });

  const [notes, setNotes] = useState<string>(existingAttendance?.notes || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submittedRecord, setSubmittedRecord] = useState<AttendanceRecord | null>(existingAttendance || null);
  const [isTimeFrameExpired, setIsTimeFrameExpired] = useState<boolean>(false);
  const [remainingTimeText, setRemainingTimeText] = useState<string>('');
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Ref to avoid double auto-absent triggers
  const autoAbsentTriggeredRef = useRef<boolean>(false);

  // Time frame configuration (Defaults to 23:59:59 WIB of active date if not explicitly supplied)
  const deadlineDate = useMemo(() => {
    if (windowEndTime && windowEndTime.includes('T')) {
      return new Date(windowEndTime);
    }
    const [year, month, day] = activeDate.split('-').map(Number);
    if (windowEndTime && windowEndTime.includes(':')) {
      const [h, m, s = 0] = windowEndTime.split(':').map(Number);
      return new Date(year, month - 1, day, h, m, s);
    }
    // Default deadline: End of the scheduled day (23:59:59)
    return new Date(year, month - 1, day, 23, 59, 59);
  }, [activeDate, windowEndTime]);

  // Real-time evaluation of the designated time frame
  useEffect(() => {
    const evaluateTimeFrame = () => {
      const now = new Date();
      const diffMs = deadlineDate.getTime() - now.getTime();

      if (!isWindowOpen || diffMs <= 0) {
        setIsTimeFrameExpired(true);
        setRemainingTimeText('Time frame expired');

        // Logic 2: If member has not selected a status within the time frame, default to 'Absent'
        if (!submittedRecord && !selectedStatus && !autoAbsentTriggeredRef.current) {
          autoAbsentTriggeredRef.current = true;
          setSelectedStatus('Absent');
          const autoNotes = 'Automated: Defaulted to Absent (check-in deadline passed)';
          setNotes(autoNotes);

          const autoRecord: AttendanceRecord = {
            id: `att_auto_${Date.now()}`,
            tanggal: activeDate,
            nisn: memberNisn,
            namaAnggota: memberName,
            status: 'Alpha',
            notes: autoNotes,
          };

          setSubmittedRecord(autoRecord);
          if (onSaveAttendance) {
            onSaveAttendance({
              tanggal: activeDate,
              nisn: memberNisn,
              namaAnggota: memberName,
              status: 'Alpha',
              notes: autoNotes,
            });
          }
          setToastMessage({
            type: 'info',
            text: 'Designated time frame closed. Status has defaulted to Absent.',
          });
        }
      } else {
        setIsTimeFrameExpired(false);
        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
        setRemainingTimeText(`${hours}h ${minutes}m ${seconds}s remaining`);
      }
    };

    evaluateTimeFrame();
    const interval = setInterval(evaluateTimeFrame, 1000);
    return () => clearInterval(interval);
  }, [deadlineDate, isWindowOpen, submittedRecord, selectedStatus, activeDate, memberNisn, memberName, onSaveAttendance]);

  // Synchronize when external record updates
  useEffect(() => {
    if (existingAttendance) {
      setSubmittedRecord(existingAttendance);
      if (existingAttendance.status) {
        const s = existingAttendance.status.toLowerCase();
        if (s === 'present' || s === 'hadir') setSelectedStatus('Present');
        else if (s === 'permitted' || s === 'excused' || s === 'izin') setSelectedStatus('Permitted');
        else if (s === 'sick' || s === 'sakit') setSelectedStatus('Sick');
        else if (s === 'absent' || s === 'unexcused' || s === 'alpha') setSelectedStatus('Absent');
      }
      if (existingAttendance.notes) setNotes(existingAttendance.notes);
    }
  }, [existingAttendance]);

  // Status button selection handler
  const handleSelectStatus = (status: 'Present' | 'Permitted' | 'Sick') => {
    if (isTimeFrameExpired && !submittedRecord) return;
    playClickTick();
    setSelectedStatus(status);
  };

  // Submit attendance record
  const handleSubmitAttendance = async () => {
    if (!selectedStatus) {
      setToastMessage({ text: 'Please select an attendance status first.', type: 'error' });
      return;
    }

    if (isTimeFrameExpired && !submittedRecord) {
      setToastMessage({ text: 'Designated time frame has expired.', type: 'error' });
      return;
    }

    setIsSubmitting(true);
    playClickTick();

    try {
      // Map to standard internal status representation
      const statusMapping: Record<MemberSelfAttendanceStatus, AttendanceStatus> = {
        Present: 'Hadir',
        Permitted: 'Izin',
        Sick: 'Sakit',
        Absent: 'Alpha',
      };

      const finalStatus = statusMapping[selectedStatus] || 'Hadir';

      const payload = {
        tanggal: activeDate,
        nisn: memberNisn,
        namaAnggota: memberName,
        status: finalStatus,
        notes: notes.trim() || undefined,
      };

      if (onSaveAttendance) {
        await onSaveAttendance(payload);
      }

      const updatedRec: AttendanceRecord = {
        id: submittedRecord?.id || `att_${Date.now()}`,
        ...payload,
      };

      setSubmittedRecord(updatedRec);
      playSuccessChime();
      setToastMessage({
        text: `Attendance recorded successfully as ${selectedStatus}!`,
        type: 'success',
      });
    } catch {
      setToastMessage({ text: 'Failed to record attendance. Please try again.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Toast Feedback */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`p-3.5 rounded-xl border text-sm font-medium flex items-center justify-between shadow-xs ${
              toastMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                : toastMessage.type === 'info'
                ? 'bg-blue-50 text-blue-900 border-blue-200'
                : 'bg-rose-50 text-rose-900 border-rose-200'
            }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{toastMessage.text}</span>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-xs font-bold hover:underline opacity-70 hover:opacity-100"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Self-Service Check-In Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
        {/* Header: Member Identity Summary ONLY (Strictly No Other Member Records) */}
        <div className="p-5 sm:p-6 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center font-bold text-lg text-indigo-200">
              {memberName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  Individual Member Check-In
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                  <UserCheck className="w-3 h-3" />
                  Self-Service
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white mt-0.5">
                {memberName}
              </h2>
              <div className="flex items-center gap-3 text-xs text-slate-300 mt-1">
                <span>NISN: <span className="font-mono text-slate-200 font-semibold">{memberNisn}</span></span>
                <span>•</span>
                <span>Class: <span className="text-slate-200 font-semibold">{memberClass}</span></span>
              </div>
            </div>
          </div>

          {/* Date & Countdown Badge */}
          <div className="bg-slate-800/80 rounded-xl p-3 border border-slate-700 flex flex-col sm:items-end">
            <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>{activeDate}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <Timer className={`w-3.5 h-3.5 ${isTimeFrameExpired ? 'text-rose-400' : 'text-amber-400'}`} />
              <span className={`text-xs font-mono font-semibold ${isTimeFrameExpired ? 'text-rose-300' : 'text-amber-300'}`}>
                {remainingTimeText}
              </span>
            </div>
          </div>
        </div>

        {/* Current Status Notification Banner */}
        {submittedRecord && (
          <div className={`px-5 py-3 border-b flex items-center justify-between text-xs font-semibold ${
            submittedRecord.status === 'Hadir' || submittedRecord.status === 'Present'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-100'
              : submittedRecord.status === 'Izin' || submittedRecord.status === 'Permitted' || submittedRecord.status === 'Excused'
              ? 'bg-amber-50 text-amber-900 border-amber-100'
              : submittedRecord.status === 'Sakit' || submittedRecord.status === 'Sick'
              ? 'bg-rose-50 text-rose-900 border-rose-100'
              : 'bg-slate-100 text-slate-800 border-slate-200'
          }`}>
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>
                Current Status: <strong>{selectedStatus || submittedRecord.status}</strong>
                {submittedRecord.notes ? ` — "${submittedRecord.notes}"` : ''}
              </span>
            </div>
            <span className="text-[11px] opacity-75 font-normal">
              {isTimeFrameExpired ? 'Window Closed' : 'Editable while window is open'}
            </span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-5 sm:p-6 space-y-6">
          {/* Section 1: Core 3 Action Buttons (Present, Permitted, Sick) */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600">
              Select Attendance Status <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Button 1: Present */}
              <button
                type="button"
                onClick={() => handleSelectStatus('Present')}
                disabled={isTimeFrameExpired && !submittedRecord}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center relative ${
                  selectedStatus === 'Present'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-900 shadow-sm ring-2 ring-emerald-500/20'
                    : 'border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-slate-700 bg-slate-50/50'
                } ${isTimeFrameExpired && !submittedRecord ? 'opacity-50 cursor-not-allowed' : 'active:scale-98'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  selectedStatus === 'Present' ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm">Present</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Attending session</span>
                {selectedStatus === 'Present' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                )}
              </button>

              {/* Button 2: Permitted */}
              <button
                type="button"
                onClick={() => handleSelectStatus('Permitted')}
                disabled={isTimeFrameExpired && !submittedRecord}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center relative ${
                  selectedStatus === 'Permitted'
                    ? 'border-amber-600 bg-amber-50 text-amber-900 shadow-sm ring-2 ring-amber-500/20'
                    : 'border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-slate-700 bg-slate-50/50'
                } ${isTimeFrameExpired && !submittedRecord ? 'opacity-50 cursor-not-allowed' : 'active:scale-98'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  selectedStatus === 'Permitted' ? 'bg-amber-600 text-white' : 'bg-amber-100 text-amber-700'
                }`}>
                  <FileText className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm">Permitted</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Prior permission requested</span>
                {selectedStatus === 'Permitted' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                )}
              </button>

              {/* Button 3: Sick */}
              <button
                type="button"
                onClick={() => handleSelectStatus('Sick')}
                disabled={isTimeFrameExpired && !submittedRecord}
                className={`flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer text-center relative ${
                  selectedStatus === 'Sick'
                    ? 'border-rose-600 bg-rose-50 text-rose-900 shadow-sm ring-2 ring-rose-500/20'
                    : 'border-slate-200 hover:border-rose-300 hover:bg-rose-50/40 text-slate-700 bg-slate-50/50'
                } ${isTimeFrameExpired && !submittedRecord ? 'opacity-50 cursor-not-allowed' : 'active:scale-98'}`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${
                  selectedStatus === 'Sick' ? 'bg-rose-600 text-white' : 'bg-rose-100 text-rose-700'
                }`}>
                  <AlertCircle className="w-5 h-5" />
                </div>
                <span className="font-bold text-sm">Sick</span>
                <span className="text-[11px] text-slate-500 mt-0.5">Medical recovery</span>
                {selectedStatus === 'Sick' && (
                  <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-rose-600 animate-pulse" />
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Optional Notes/Description text field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="attendance-notes" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Notes / Reason <span className="text-slate-400 font-normal lowercase">(optional)</span>
              </label>
              {(selectedStatus === 'Permitted' || selectedStatus === 'Sick') && (
                <span className="text-[11px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  Recommended for {selectedStatus}
                </span>
              )}
            </div>
            <textarea
              id="attendance-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isTimeFrameExpired && !submittedRecord}
              placeholder={
                selectedStatus === 'Permitted'
                  ? 'E.g., Participating in school Olympiad, family emergency...'
                  : selectedStatus === 'Sick'
                  ? 'E.g., Flu and fever, doctor rest note submitted...'
                  : 'Add any optional remarks or workshop notes...'
              }
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition disabled:bg-slate-100 disabled:text-slate-500"
            />
          </div>

          {/* Section 3: System Logic Rule Notice */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-xs text-slate-600">
            <Clock className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-slate-800">Automated System Policy: </span>
              Attendance must be selected before the designated time frame ends. If no status is selected within the window, your attendance will automatically be logged as <strong className="text-rose-600">Absent</strong>.
            </div>
          </div>

          {/* Action Trigger Button */}
          <button
            type="button"
            onClick={handleSubmitAttendance}
            disabled={!selectedStatus || isSubmitting || (isTimeFrameExpired && !submittedRecord)}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm text-white bg-indigo-600 hover:bg-indigo-700 active:scale-98 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <span className="inline-block w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            <span>
              {submittedRecord ? 'Update My Attendance' : 'Submit Attendance'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default MemberAttendanceView;
