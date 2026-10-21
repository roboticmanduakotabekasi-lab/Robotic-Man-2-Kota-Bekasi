import React, { useState, useEffect } from 'react';
import { X, Save, User, Mail, GraduationCap, MapPin, Phone, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member } from '../types';

interface MemberFormModalProps {
  isOpen: boolean;
  memberToEdit?: Member | null;
  initialData?: Member | null;
  onClose: () => void;
  onSave: (member: Member, originalNisn?: string) => Promise<void>;
  isSubmitting: boolean;
}

export const MemberFormModal: React.FC<MemberFormModalProps> = ({
  isOpen,
  memberToEdit,
  initialData,
  onClose,
  onSave,
  isSubmitting,
}) => {
  const activeMember = memberToEdit || initialData || null;

  const [formData, setFormData] = useState<Partial<Member>>({
    fullName: '',
    email: '',
    grade: 'X',
    classRoom: 'A',
    gender: 'Male',
    status: 'Aktif',
    nisn: '',
    nik: '',
    address: '',
    personalPhone: '',
    parentPhone: '',
    birthDate: '',
  });

  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (activeMember) {
      setFormData({
        fullName: activeMember.fullName || '',
        email: activeMember.email || '',
        grade: activeMember.grade || 'X',
        classRoom: activeMember.classRoom || 'A',
        gender: activeMember.gender || 'Male',
        status: activeMember.status || 'Aktif',
        nisn: activeMember.nisn || '',
        nik: activeMember.nik || '',
        address: activeMember.address || '',
        personalPhone: activeMember.personalPhone || '',
        parentPhone: activeMember.parentPhone || '',
        birthDate: activeMember.birthDate || '',
        id_member: activeMember.id_member,
        role: activeMember.role,
        jabatan: activeMember.jabatan,
        timestamp: activeMember.timestamp,
      });
    } else {
      setFormData({
        fullName: '',
        email: '',
        grade: 'X',
        classRoom: 'A',
        gender: 'Male',
        status: 'Aktif',
        nisn: '',
        nik: '',
        address: '',
        personalPhone: '',
        parentPhone: '',
        birthDate: '',
      });
    }
    setValidationError('');
  }, [memberToEdit, initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!formData.fullName?.trim()) {
      setValidationError('Student full name is required!');
      return;
    }
    if (!formData.nisn?.trim()) {
      setValidationError('NISN is required!');
      return;
    }
    if (!formData.personalPhone?.trim()) {
      setValidationError('WhatsApp / personal phone number is required!');
      return;
    }

    const timestamp = activeMember?.timestamp || new Date().toLocaleString('en-US');
    const completeMember: Member = {
      id_member: activeMember?.id_member,
      role: activeMember?.role,
      timestamp,
      email: formData.email?.trim() || '',
      fullName: formData.fullName.trim(),
      grade: formData.grade || 'X',
      classRoom: (formData.classRoom || 'A').toUpperCase().trim(),
      gender: formData.gender || 'Male',
      status: (formData.status as any) || 'Aktif',
      nisn: formData.nisn.trim(),
      nik: formData.nik?.trim() || '',
      birthDate: formData.birthDate?.trim() || '',
      address: formData.address?.trim() || '',
      personalPhone: formData.personalPhone.trim(),
      parentPhone: formData.parentPhone?.trim() || '',
    };

    await onSave(completeMember, activeMember ? activeMember.nisn : undefined);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white border border-[#C7D2FE] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl my-8"
        >
          
          {/* Modal Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#C7D2FE] bg-[#EEF2FF]">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {activeMember ? 'Edit Member Information' : 'Enroll New Club Member'}
              </h2>
              <p className="text-xs text-slate-500">
                {activeMember 
                  ? `Updating profile for ${activeMember.fullName}` 
                  : 'Register a new member to Robotic MAN 2 Kota Bekasi'}
              </p>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Validation Error Alert */}
          {validationError && (
            <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-semibold">
              {validationError}
            </div>
          )}

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
            
            {/* Row 1: Full Name & Gender */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>Student Full Name *</span>
                </label>
                <input
                  id="formFullName"
                  type="text"
                  required
                  placeholder="e.g. Muhammad Rayhan Pratama"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Gender</label>
                <select
                  id="formGender"
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                >
                  <option value="Male">Male (L)</option>
                  <option value="Female">Female (P)</option>
                </select>
              </div>
            </div>

            {/* Row 2: Status & Grade */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Membership Status *</label>
                <select
                  id="formStatus"
                  value={formData.status || 'Aktif'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-xl font-bold focus:outline-none focus:bg-white transition ${
                    formData.status === 'Keluar'
                      ? 'bg-rose-50 border-rose-200 text-rose-700'
                      : formData.status === 'Alumni'
                        ? 'bg-purple-50 border-purple-200 text-purple-700'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}
                >
                  <option value="Aktif">🟢 Active (Enrolled)</option>
                  <option value="Keluar">🔴 Resigned (Inactive)</option>
                  <option value="Alumni">🟣 Alumni (Graduated)</option>
                </select>
              </div>

              <div>
                <label className="flex items-center gap-1.5 font-semibold text-slate-700 mb-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span>Grade Level *</span>
                </label>
                <select
                  id="formGrade"
                  value={formData.grade}
                  onChange={(e) => setFormData({ ...formData, grade: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-semibold focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                >
                  <option value="X">Grade X (Tenth)</option>
                  <option value="XI">Grade XI (Eleventh)</option>
                  <option value="XII">Grade XII (Twelfth)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5">Classroom / Section</label>
                <input
                  id="formClassRoom"
                  type="text"
                  placeholder="e.g. A, B, IPA 1"
                  value={formData.classRoom}
                  onChange={(e) => setFormData({ ...formData, classRoom: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 uppercase font-semibold focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>
            </div>

            {/* Row 3: NISN & Date of Birth & NIK */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>NISN (Student ID) *</span>
                </label>
                <input
                  id="formNisn"
                  type="text"
                  required
                  placeholder="e.g. 0110000001"
                  value={formData.nisn}
                  onChange={(e) => setFormData({ ...formData, nisn: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <span className="text-emerald-600 font-bold">📅</span>
                  <span>Date of Birth (Verification)</span>
                </label>
                <input
                  id="formBirthDate"
                  type="date"
                  value={formData.birthDate}
                  onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                  title="Used to verify student account identity"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-slate-400" />
                  <span>Citizen ID (NIK)</span>
                </label>
                <input
                  id="formNik"
                  type="text"
                  placeholder="16-Digit NIK"
                  value={formData.nik}
                  onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>
            </div>

            {/* Row 4: Phone & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Student WhatsApp Phone *</span>
                </label>
                <input
                  id="formPersonalPhone"
                  type="tel"
                  required
                  placeholder="0812xxxxxxxx"
                  value={formData.personalPhone}
                  onChange={(e) => setFormData({ ...formData, personalPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span>Parent / Guardian Phone</span>
                </label>
                <input
                  id="formParentPhone"
                  type="tel"
                  placeholder="08xxxxxxxxxx"
                  value={formData.parentPhone}
                  onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-mono placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span>Student Email Address</span>
                </label>
                <input
                  id="formEmail"
                  type="email"
                  placeholder="student@gmail.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                />
              </div>
            </div>

            {/* Row 5: Address */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>Complete Residential Address</span>
              </label>
              <textarea
                id="formAddress"
                rows={2}
                placeholder="Street address, district, Bekasi, West Java..."
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              
              <button
                id="saveMemberSubmitBtn"
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-[#4338CA] hover:bg-[#312E81] rounded-xl shadow-md transition active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>{activeMember ? 'Save Changes' : 'Enroll Member'}</span>
                  </>
                )}
              </button>
            </div>

          </form>

        </motion.div>
      </div>
    </AnimatePresence>
  );
};
