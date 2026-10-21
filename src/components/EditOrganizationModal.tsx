// src/components/EditOrganizationModal.tsx
// Streamlined customization and maintenance modal for extracurricular club rooms

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  RefreshCw,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
  KeyRound,
  ShieldCheck,
  Lock,
  Copy,
  AlertCircle
} from 'lucide-react';
import {
  Organization,
  OrganizationType,
  WORKSPACE_TYPES,
  GRADIENT_OPTIONS,
  generateJoinCode,
  getPresetLabels,
  CustomLabels
} from '../utils/organizerStore';
import { isExecutiveOrAdvisor, isRoomCreator, canViewJoinCode, hasPermission } from '../utils/rbac';
import { playClickTick, playSuccessChime } from '../utils/audioFeedback';
import { UserSession } from '../types';

interface EditOrganizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  organization: Organization | null;
  onSave: (updatedOrg: Organization) => void;
  onResetOrgData?: (orgId: string) => void;
  currentUserRole?: string;
  session?: UserSession | null;
}

export const EditOrganizationModal: React.FC<EditOrganizationModalProps> = ({
  isOpen,
  onClose,
  organization,
  onSave,
  currentUserRole,
  session,
}) => {
  const isCreator = isRoomCreator(organization, session);
  const canEdit = isCreator || 
    isExecutiveOrAdvisor(currentUserRole, session?.jabatan) || 
    hasPermission(currentUserRole, 'room:maintenance', session?.jabatan);

  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('eskul');
  const [institution, setInstitution] = useState('MAN 2 Kota Bekasi');
  const [description, setDescription] = useState('');
  const [selectedGradient, setSelectedGradient] = useState(GRADIENT_OPTIONS[0].value);
  const [code, setCode] = useState('');
  const [showLabels, setShowLabels] = useState(false);
  const [customLabels, setCustomLabels] = useState<CustomLabels>(() => getPresetLabels('eskul'));
  const [isSavedSuccess, setIsSavedSuccess] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    if (organization) {
      setName(organization.name || '');
      setType(organization.type || 'eskul');
      setInstitution(organization.institution || 'MAN 2 Kota Bekasi');
      setDescription(organization.description || '');
      setSelectedGradient(organization.themeGradient || GRADIENT_OPTIONS[0].value);
      setCode(organization.code || '');
      setCustomLabels(organization.customLabels || getPresetLabels(organization.type || 'eskul'));
      setIsSavedSuccess(false);
      setShowLabels(false);
      setCopiedCode(false);
    }
  }, [organization, isOpen]);

  if (!isOpen || !organization) return null;

  const handleTypeChange = (newType: OrganizationType) => {
    if (!canEdit) return;
    setType(newType);
    const presets = getPresetLabels(newType);
    setCustomLabels(presets);
    const typeDef = WORKSPACE_TYPES.find((t) => t.id === newType);
    if (typeDef && (!institution || institution === 'MAN 2 Kota Bekasi')) {
      setInstitution(typeDef.defaultInstitution);
    }
  };

  const handleRegenerateCode = () => {
    if (!isCreator) return;
    playClickTick();
    const prefix = name.trim().replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'ROB';
    setCode(generateJoinCode(prefix));
  };

  const handleCopyCode = () => {
    if (!isCreator) return;
    playClickTick();
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(true);
    playSuccessChime();
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    playClickTick();

    const updated: Organization = {
      ...organization,
      name: name.trim() || organization.name,
      type,
      institution: institution.trim() || organization.institution || 'MAN 2 Kota Bekasi',
      description: description.trim(),
      themeGradient: selectedGradient,
      // Only the room creator can change the access code
      code: isCreator ? (code.trim().toUpperCase() || organization.code) : organization.code,
      customLabels,
    };

    setIsSavedSuccess(true);
    playSuccessChime();

    setTimeout(() => {
      onSave(updated);
      setIsSavedSuccess(false);
      onClose();
    }, 300);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.15 }}
          className="relative w-full max-w-lg bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-600/30 border border-blue-500/40 text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Club Room Maintenance &amp; Customization</h3>
                <p className="text-[11px] text-slate-300">Update room branding, settings, and terminology</p>
              </div>
            </div>
            <button
              onClick={() => {
                playClickTick();
                onClose();
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="p-5 space-y-3.5 overflow-y-auto flex-1 text-xs">
            {!canEdit && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-950">Read-Only Maintenance Mode</p>
                  <p className="text-[11px] text-amber-800 mt-0.5">
                    Only authorized Admins and Executive Board members can maintain and update this club room.
                  </p>
                </div>
              </div>
            )}

            <fieldset disabled={!canEdit} className="space-y-3.5">
              {/* Type Selection */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Extracurricular Category
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {WORKSPACE_TYPES.map((t) => {
                    const isSelected = type === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => handleTypeChange(t.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'border-blue-600 bg-blue-50/50 text-blue-900 ring-1 ring-blue-600 shadow-2xs'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-sm">{t.badge}</span>
                          <span className="font-bold text-xs">{t.title}</span>
                        </div>
                        <p className="text-[10px] text-slate-500 leading-tight">{t.description}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Room Name */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Club Room Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Robotik MAN 2 Kota Bekasi"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Description / Activity Agenda
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Club focus, workshop schedules, and robot assembly projects..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600 resize-none"
                />
              </div>

              {/* School Institution & Confidential Code Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                    School / Institution
                  </label>
                  <input
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Confidential Join Code: Creator ONLY */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                      <KeyRound className="w-3 h-3 text-blue-600" />
                      <span>Access Code</span>
                    </label>
                    {isCreator && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleCopyCode}
                          className="text-[10px] text-blue-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          {copiedCode ? <Check className="w-2.5 h-2.5 text-emerald-600" /> : <Copy className="w-2.5 h-2.5" />}
                          <span>{copiedCode ? 'Copied' : 'Copy'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleRegenerateCode}
                          className="text-[10px] text-indigo-600 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                        >
                          <RefreshCw className="w-2.5 h-2.5" />
                          <span>Random</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {isCreator ? (
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                      className="w-full px-3 py-2 bg-slate-50 border border-blue-300 rounded-lg text-xs font-mono font-black text-blue-900 uppercase focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-600"
                      title="Room Creator access code"
                    />
                  ) : (
                    <div className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 flex items-center gap-1.5 font-mono">
                      <Lock className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate italic text-[11px]">Private (Creator Only)</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Banner Gradient Colors */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1.5">
                  Banner Theme Accent
                </label>
                <div className="flex items-center gap-2">
                  {GRADIENT_OPTIONS.map((g) => {
                    const isSelected = selectedGradient === g.value;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => {
                          playClickTick();
                          setSelectedGradient(g.value);
                        }}
                        className={`w-7 h-7 rounded-full bg-gradient-to-r ${g.value} transition-all cursor-pointer flex items-center justify-center ${
                          isSelected ? 'ring-2 ring-blue-600 ring-offset-2 scale-110' : 'opacity-80 hover:opacity-100'
                        }`}
                        title={g.label}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Collapsible Custom Labels */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLabels(!showLabels)}
                  className="w-full text-left text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center justify-between py-1 cursor-pointer"
                >
                  <span>Customize Terminology (Member, Attendance, Treasury Labels)</span>
                  {showLabels ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showLabels && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Member Designation Label</label>
                      <input
                        type="text"
                        value={customLabels.memberLabel}
                        onChange={(e) => setCustomLabels({ ...customLabels, memberLabel: e.target.value })}
                        placeholder="Club Member / Student"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Leader / Admin Label</label>
                      <input
                        type="text"
                        value={customLabels.adminLabel}
                        onChange={(e) => setCustomLabels({ ...customLabels, adminLabel: e.target.value })}
                        placeholder="President / Lead Admin"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Attendance Label</label>
                      <input
                        type="text"
                        value={customLabels.attendanceLabel}
                        onChange={(e) => setCustomLabels({ ...customLabels, attendanceLabel: e.target.value })}
                        placeholder="Workshop Attendance"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500 mb-0.5">Treasury Label</label>
                      <input
                        type="text"
                        value={customLabels.cashLabel}
                        onChange={(e) => setCustomLabels({ ...customLabels, cashLabel: e.target.value })}
                        placeholder="Club Dues / Budget"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </fieldset>

            {/* Actions */}
            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  onClose();
                }}
                className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                {canEdit ? 'Cancel' : 'Close'}
              </button>

              {canEdit && (
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 transition cursor-pointer shadow-md shadow-blue-600/20 flex items-center gap-1.5"
                >
                  {isSavedSuccess ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Saved!</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
