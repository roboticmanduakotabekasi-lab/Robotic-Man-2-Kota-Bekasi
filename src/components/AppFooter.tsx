import React, { useState } from 'react';
import { 
  Bot, 
  Mail, 
  Instagram, 
  MapPin, 
  UserCheck, 
  School, 
  KeyRound, 
  Copy, 
  Check, 
  ExternalLink, 
  ShieldCheck, 
  Sparkles,
  Award,
  ChevronRight,
  Lock
} from 'lucide-react';
import { playSuccessChime, playClickTick } from '../utils/audioFeedback';

interface AppFooterProps {
  className?: string;
  compact?: boolean;
  onOpenJoinModal?: () => void;
}

export const AppFooter: React.FC<AppFooterProps> = ({ 
  className = '', 
  onOpenJoinModal
}) => {
  const [copiedEmail, setCopiedEmail] = useState(false);

  const officialEmail = 'roboticman2kotabekasi@gmail.com';

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.preventDefault();
    navigator.clipboard?.writeText(officialEmail).catch(() => {});
    setCopiedEmail(true);
    playSuccessChime();
    setTimeout(() => setCopiedEmail(false), 2200);
  };

  return (
    <footer 
      aria-label="Official Footer Robotic MAN 2 Kota Bekasi"
      className={`w-full bg-slate-50 border-t border-slate-200/90 text-slate-600 relative overflow-hidden mt-auto ${className}`}
    >
      {/* Subtle light ambient glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-32 bg-blue-100/50 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[500px] h-32 bg-indigo-100/40 rounded-full blur-3xl pointer-events-none" />

      {/* Edge-to-edge container */}
      <div className="w-full px-5 sm:px-8 lg:px-12 xl:px-16 pt-10 pb-7 relative z-10">

        {/* 4-Column Architectural Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10">
          
          {/* Column 1: Brand & System Mission */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20 shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <span className="text-base font-mono font-bold tracking-tight text-slate-900 block">
                  roboticman2kotabekasi
                </span>
                <span className="text-xs text-slate-500 font-medium block">
                  Robotics Management System
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Integrated extracurricular management platform for Robotic MAN 2 Kota Bekasi. Powers member roster directories, attendance tracking, club treasury ledgers, mechatronics assignments, and official broadcasts.
            </p>

            <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-1.5 pt-1">
              <span>Academic Year 2026/2027</span>
              <span aria-hidden="true">·</span>
              <span>Technology &amp; Robotics Division</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 font-semibold">Official Platform</span>
            </div>
          </div>

          {/* Column 2: Advisor & Development Team */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Advisor &amp; Development
            </h4>

            {/* Advisor Details */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-2 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <UserCheck className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                    Advisor
                  </span>
                  <span className="text-sm font-bold text-slate-900 block">
                    Abdul Khoir, S.Kom.
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Robotics Extracurricular Club Advisor
              </p>
            </div>

            {/* Creators & Development Team */}
            <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 space-y-1.5 shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block leading-tight">
                Development Team &amp; Creators
              </span>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                  <span>Inashaura Azkazola Ridalistiyanti</span>
                </div>
                <div className="flex items-center gap-1.5 font-medium text-slate-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
                  <span>Daeniesh Raeisya Achmad</span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 pt-0.5">
                Public Relations &amp; Web Development Team (2026 Term)
              </p>
            </div>
          </div>

          {/* Column 3: Institutional Campus & Laboratory */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Campus &amp; Laboratories
            </h4>

            <div className="space-y-2.5">
              <div className="flex items-start gap-2 text-xs">
                <School className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-900 block font-semibold">MAN 2 Kota Bekasi</strong>
                  <span className="text-slate-500 text-[11px] leading-relaxed block mt-0.5">
                    Jl. Bojong Asih 5, RT.005/RW.018, Bojong Rawalumbu, Rawalumbu, Bekasi City, West Java 17116
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-2 text-xs pt-2 border-t border-slate-200/80">
                <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                <div>
                  <span className="text-slate-800 block font-medium">Lab IT</span>
                  <span className="text-slate-500 text-[11px] block mt-0.5">
                    Computer Laboratory &amp; Robotics Prototyping Workshop
                  </span>
                </div>
              </div>

              <div className="text-[11px] text-slate-500 pt-1">
                <span>Schedule: Weekly Workshop Sessions &amp; Competition Drills</span>
              </div>
            </div>
          </div>

          {/* Column 4: Official Communication & Access */}
          <div className="space-y-3.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Connect &amp; Access
            </h4>

            {/* Email Contact with Copy Button */}
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold block">
                Official Inquiries
              </span>
              <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-slate-200/90 text-xs shadow-2xs">
                <div className="flex items-center gap-2 min-w-0">
                  <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <a 
                    href={`mailto:${officialEmail}`}
                    className="text-blue-700 hover:text-blue-800 font-mono text-[11px] truncate transition hover:underline"
                    title="Send official inquiry email"
                  >
                    {officialEmail}
                  </a>
                </div>
                <button
                  type="button"
                  onClick={handleCopyEmail}
                  className="p-1 rounded text-slate-400 hover:text-slate-700 transition cursor-pointer shrink-0 ml-1.5 hover:bg-slate-100"
                  title="Copy email address"
                  aria-label="Copy official email address"
                >
                  {copiedEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Official Instagram */}
            <div className="space-y-1.5">
              <span className="text-[11px] uppercase tracking-wide text-slate-500 font-semibold block">
                Social Media
              </span>
              <a 
                href="https://instagram.com/robotic_man2"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between p-2 rounded-xl bg-white hover:bg-pink-50/50 border border-slate-200/90 hover:border-pink-300 text-xs transition group cursor-pointer shadow-2xs"
                title="Open official Instagram @robotic_man2"
              >
                <div className="flex items-center gap-2">
                  <Instagram className="w-3.5 h-3.5 text-pink-600 group-hover:scale-110 transition-transform" />
                  <span className="text-slate-800 group-hover:text-pink-700 font-medium">@robotic_man2</span>
                </div>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-pink-600 transition" />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Sub-Footer Bar */}
        <div className="pt-6 mt-8 border-t border-slate-200/90 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <div className="text-center md:text-left space-y-0.5">
            <p className="font-semibold text-slate-700">
              &copy; 2026 Robotic MAN 2 Kota Bekasi. All rights reserved.
            </p>
            <p className="text-[11px] text-slate-500">
              Developed &amp; Created by Inashaura Azkazola Ridalistiyanti &amp; Daeniesh Raeisya Achmad • Advisor: Abdul Khoir, S.Kom.
            </p>
          </div>

          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
            <span className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 shadow-2xs">
              MAN 2 Kota Bekasi • Robotics Portal
            </span>
          </div>
        </div>

      </div>
    </footer>
  );
};

