import React from 'react';
import { 
  X, 
  Bot, 
  Users, 
  CalendarCheck, 
  Wallet, 
  CalendarDays, 
  Award,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AppInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AppInfoModal: React.FC<AppInfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden my-6 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-900 via-indigo-950 to-slate-900 p-6 text-white relative shrink-0">
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition cursor-pointer"
              title="Close Info Modal"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center text-white shadow-sm shrink-0">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-mono font-black text-white tracking-tight">
                    roboticman2kotabekasi
                  </h2>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-blue-500/30 text-blue-200 border border-blue-400/30">
                    2026 Term
                  </span>
                </div>
                <p className="text-xs text-blue-200 mt-1">
                  Robotic Club MAN 2 Kota Bekasi
                </p>
              </div>
            </div>
          </div>

          {/* Body Content - Scrollable */}
          <div className="p-6 space-y-6 overflow-y-auto text-slate-700 text-xs leading-relaxed flex-1">
            
            {/* Overview Card */}
            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Application Overview</span>
              </div>
              <p className="text-slate-600 text-xs leading-relaxed">
                An integrated, responsive, and secure platform engineered to manage student member records, weekly workshop attendance, treasurer cashbooks and club dues, assignments, and training calendars for <strong>Robotic MAN 2 Kota Bekasi</strong>.
              </p>
            </div>

            {/* Credits & Developers */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Award className="w-4 h-4 text-indigo-600" />
                  <span>Officers & Leadership</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">2026 Term</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                      IA
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">Inashaura Azkazola Ridalistiyanti</p>
                      <p className="text-[11px] text-indigo-600 font-semibold truncate">Public Relations 1</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">2026 Term</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs shrink-0">
                      DR
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">Daeniesh Raeisya Achmad</p>
                      <p className="text-[11px] text-blue-600 font-semibold truncate">Public Relations 2</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">2026 Term</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Advisor & School Info Card */}
              <div className="p-3.5 rounded-2xl border border-slate-200 bg-white space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800">Faculty Advisor:</span>
                  <span className="font-semibold text-blue-700">Abdul Khoir, S.Kom.</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div>
                  <span className="font-bold text-slate-800 block">MAN 2 Kota Bekasi:</span>
                  <span className="text-slate-600">Jl. Bojong Asih 5, RT.005/RW.018, Bojong Rawalumbu, Rawalumbu, Kota Bekasi, West Java 17116</span>
                </div>
                <div className="h-px bg-slate-100" />
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-slate-600">
                    Email: <a href="mailto:roboticman2kotabekasi@gmail.com" className="text-blue-600 hover:underline font-mono">roboticman2kotabekasi@gmail.com</a>
                  </span>
                  <span className="text-slate-600">
                    Instagram: <a href="https://instagram.com/robotic_man2" target="_blank" rel="noopener noreferrer" className="text-pink-600 hover:underline font-semibold">@robotic_man2</a>
                  </span>
                </div>
              </div>
            </div>

            {/* Core Features Overview */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                  <Bot className="w-4 h-4 text-blue-600" />
                  <span>Core System Modules</span>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">CRUD & Relational 3NF</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <Users className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>1. Member Directory</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Student ID tracking, classes, emergency contacts, digital ID cards, and multi-criteria filters.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <CalendarCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>2. Daily Attendance</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Relational check-ins per session, automatic presence percentage calculation, bulk check-in, and official exports.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <Wallet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>3. Treasury Ledger</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Weekly student dues matrix, cash inflows & outflows, automatic balance calculations, and PDF reports.
                  </p>
                </div>

                <div className="p-3 rounded-xl border border-slate-200/80 bg-white space-y-1">
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-xs">
                    <CalendarDays className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>4. Activity Calendar</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-normal">
                    Weekly workshop schedules (Mechatronics, IoT, Coding, 3D CAD) and competition roadmaps.
                  </p>
                </div>
              </div>
            </div>

          </div>

          {/* Footer Action */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
