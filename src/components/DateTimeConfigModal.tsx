import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  RotateCcw, 
  X, 
  Check, 
  GraduationCap, 
  Sparkles, 
  CalendarDays,
  CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  DateAcademicConfig, 
  calculateAutoAcademicYear, 
  toDateInputValue, 
  formatFullIndonesianDate 
} from '../utils/dateAcademicConfig';
import { playClickTick, playSuccessChime } from '../utils/audioFeedback';
import { 
  checkAttendanceSchedule, 
  isBypassScheduleEnabled, 
  setBypassScheduleEnabled 
} from '../utils/attendanceWindow';

export interface DateTimeConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: DateAcademicConfig;
  onSave: (newConfig: DateAcademicConfig) => void;
  initialTab?: 'date' | 'academic';
}

export const DateTimeConfigModal: React.FC<DateTimeConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
  initialTab = 'academic'
}) => {
  const [activeTab, setActiveTab] = useState<'date' | 'academic'>(initialTab);

  const [dateMode, setDateMode] = useState<'auto' | 'custom'>(config.dateMode);
  const [customDate, setCustomDate] = useState<string>(config.customDate || toDateInputValue(new Date()));

  const [academicYearMode, setAcademicYearMode] = useState<'auto' | 'custom'>(config.academicYearMode);
  const [customAcademicYear, setCustomAcademicYear] = useState<string>(
    config.customAcademicYear || calculateAutoAcademicYear(new Date())
  );
  const [bypassSchedule, setBypassSchedule] = useState<boolean>(() => isBypassScheduleEnabled());
  const scheduleStatus = checkAttendanceSchedule(new Date(), bypassSchedule);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setDateMode(config.dateMode);
      setCustomDate(config.customDate || toDateInputValue(new Date()));
      setAcademicYearMode(config.academicYearMode);
      setCustomAcademicYear(config.customAcademicYear || calculateAutoAcademicYear(new Date()));
      setActiveTab(initialTab);
    }
  }, [isOpen, config, initialTab]);

  const todayStr = toDateInputValue(new Date());
  const autoYear = calculateAutoAcademicYear(new Date());

  const handleResetToAutoAll = () => {
    playClickTick();
    setDateMode('auto');
    setCustomDate(todayStr);
    setAcademicYearMode('auto');
    setCustomAcademicYear(autoYear);
  };

  const handleSave = () => {
    playSuccessChime();
    onSave({
      dateMode,
      customDate: customDate || todayStr,
      academicYearMode,
      customAcademicYear: customAcademicYear.trim() || autoYear,
    });
    onClose();
  };

  const ACADEMIC_YEAR_PRESETS = [
    '2023/2024',
    '2024/2025',
    '2025/2026',
    '2026/2027',
    '2027/2028',
    '2028/2029'
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div 
          id="dateTimeConfigModalOverlay"
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
          onClick={onClose}
        >
          <motion.div 
            id="dateTimeConfigModalContent"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200/90 overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <CalendarDays className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 leading-tight">
                Date & Academic Year Settings
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Choose automatic (real-time) or custom date & academic term
              </p>
            </div>
          </div>

          <button
            type="button"
            id="closeDateTimeModalBtn"
            onClick={() => {
              playClickTick();
              onClose();
            }}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector: Date vs Academic Year */}
        <div className="p-3 bg-slate-100/70 border-b border-slate-200/80">
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              id="tabAcademicYearBtn"
              onClick={() => {
                playClickTick();
                setActiveTab('academic');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'academic'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <GraduationCap className="w-4 h-4 shrink-0" />
              <span>Academic Year</span>
              {academicYearMode === 'custom' ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white ml-0.5 shrink-0" title="Custom Mode Active" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white ml-0.5 shrink-0" title="Auto Mode Active" />
              )}
            </button>

            <button
              type="button"
              id="tabDateBtn"
              onClick={() => {
                playClickTick();
                setActiveTab('date');
              }}
              className={`flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === 'date'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Clock className="w-4 h-4 shrink-0" />
              <span>Session Date</span>
              {dateMode === 'custom' ? (
                <span className="w-2 h-2 rounded-full bg-amber-400 ring-2 ring-white ml-0.5 shrink-0" title="Custom Mode Active" />
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white ml-0.5 shrink-0" title="Auto Mode Active" />
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* ======================================================== */}
          {/* TAB 1: ACADEMIC YEAR */}
          {/* ======================================================== */}
          {activeTab === 'academic' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <GraduationCap className="w-4 h-4 text-blue-600 shrink-0" />
                    Academic Year Mode
                  </span>
                  {academicYearMode === 'auto' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Real-time Automatic
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Sparkles className="w-3 h-3" />
                      Custom Manual
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  By default, the academic term advances each <strong>July</strong> following the school academic calendar. You can also define custom terms below.
                </p>
              </div>

              {/* Radio Selector */}
              <div className="space-y-2.5">
                {/* Option 1: Automatic */}
                <label 
                  onClick={() => {
                    playClickTick();
                    setAcademicYearMode('auto');
                  }}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    academicYearMode === 'auto'
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="academicYearModeRadio"
                    checked={academicYearMode === 'auto'}
                    onChange={() => setAcademicYearMode('auto')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800">
                        Automatic (Follows Real-time Calendar)
                      </span>
                      <span className="font-mono text-xs font-extrabold text-blue-700 bg-blue-100/70 px-2 py-0.5 rounded-md border border-blue-200">
                        {autoYear}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Automatically calculated from current date without needing manual adjustments.
                    </p>
                  </div>
                </label>

                {/* Option 2: Custom */}
                <label 
                  onClick={() => {
                    playClickTick();
                    setAcademicYearMode('custom');
                  }}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    academicYearMode === 'custom'
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="academicYearModeRadio"
                    checked={academicYearMode === 'custom'}
                    onChange={() => setAcademicYearMode('custom')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 block">
                      Custom Academic Year
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Choose from quick presets or enter any academic period.
                    </p>

                    {/* Presets and text input */}
                    {academicYearMode === 'custom' && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5 animate-in fade-in duration-150">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Quick Presets:
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {ACADEMIC_YEAR_PRESETS.map((yearStr) => {
                            const isSelected = customAcademicYear.trim() === yearStr;
                            return (
                              <button
                                key={yearStr}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  playClickTick();
                                  setCustomAcademicYear(yearStr);
                                }}
                                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-bold transition cursor-pointer border ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {yearStr}
                              </button>
                            );
                          })}
                        </div>

                        <div className="pt-1.5">
                          <label className="text-[11px] font-bold text-slate-600 block mb-1">
                            Or custom term:
                          </label>
                          <input
                            type="text"
                            value={customAcademicYear}
                            onChange={(e) => setCustomAcademicYear(e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Example: 2026/2027"
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* ======================================================== */}
          {/* TAB 2: SESSION DATE */}
          {/* ======================================================== */}
          {activeTab === 'date' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    System Date Mode
                  </span>
                  {dateMode === 'auto' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Real-time Automatic
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      <Sparkles className="w-3 h-3" />
                      Custom Manual
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  By default, the application displays today's actual date based on system time. You can select a custom date to audit past or future club meeting records.
                </p>
              </div>

              {/* Radio Selector */}
              <div className="space-y-2.5">
                {/* Option 1: Automatic */}
                <label 
                  onClick={() => {
                    playClickTick();
                    setDateMode('auto');
                  }}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    dateMode === 'auto'
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="dateModeRadio"
                    checked={dateMode === 'auto'}
                    onChange={() => setDateMode('auto')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 block">
                      Automatic (Follows Today's Date)
                    </span>
                    <div className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-blue-700">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{formatFullIndonesianDate(new Date())}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Header will automatically advance every day at midnight.
                    </p>
                  </div>
                </label>

                {/* Option 2: Custom */}
                <label 
                  onClick={() => {
                    playClickTick();
                    setDateMode('custom');
                  }}
                  className={`flex items-start gap-3 p-3.5 rounded-2xl border cursor-pointer transition ${
                    dateMode === 'custom'
                      ? 'border-blue-500 bg-blue-50/50 shadow-2xs ring-1 ring-blue-500'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                  }`}
                >
                  <input
                    type="radio"
                    name="dateModeRadio"
                    checked={dateMode === 'custom'}
                    onChange={() => setDateMode('custom')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <span className="text-xs font-bold text-slate-800 block">
                      Select Custom Date
                    </span>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Specify an explicit date to display on header and attendance metrics.
                    </p>

                    {dateMode === 'custom' && (
                      <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-2.5 animate-in fade-in duration-150">
                        <label className="text-[11px] font-bold text-slate-600 block">
                          Select Date:
                        </label>
                        <input
                          type="date"
                          value={customDate}
                          onChange={(e) => setCustomDate(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                        {customDate && (
                          <div className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200 flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-blue-600" />
                            <span>Selected: {formatFullIndonesianDate(customDate)}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </label>
              </div>

              {/* Student Self-Attendance Schedule (Wed - Thu 23:59 WIB) */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[#4338CA]" />
                    <span className="text-xs font-bold text-slate-800">
                      Student Self-Attendance Schedule
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold border ${scheduleStatus.statusBadge.bgColor}`}>
                    {scheduleStatus.statusBadge.label}
                  </span>
                </div>

                <div className="bg-white p-3 rounded-xl border border-slate-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Official Window Opens:</span>
                    <span className="font-mono font-bold text-indigo-900">Wednesday 00:00 WIB</span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-500 font-medium">Submission Deadline:</span>
                    <span className="font-mono font-bold text-rose-800">Thursday 23:59 WIB</span>
                  </div>
                  <p className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                    {scheduleStatus.reasonText}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-slate-700 font-medium">
                    Bypass Schedule for Testing (Testing Mode)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      const next = !bypassSchedule;
                      setBypassSchedule(next);
                      setBypassScheduleEnabled(next);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                      bypassSchedule
                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    <span>{bypassSchedule ? 'Active' : 'Disabled'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/80 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            id="resetToAutoAllBtn"
            onClick={handleResetToAutoAll}
            disabled={dateMode === 'auto' && academicYearMode === 'auto'}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-blue-700 bg-white hover:bg-blue-50 border border-slate-200 hover:border-blue-200 rounded-xl transition cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            title="Reset date and academic year to real-time auto mode"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span>Reset to Auto (Real-time)</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              id="cancelDateTimeConfigBtn"
              onClick={() => {
                playClickTick();
                onClose();
              }}
              className="flex-1 sm:flex-none px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              id="saveDateTimeConfigBtn"
              onClick={handleSave}
              className="flex-1 sm:flex-none px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Apply</span>
            </button>
          </div>
        </div>

          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
