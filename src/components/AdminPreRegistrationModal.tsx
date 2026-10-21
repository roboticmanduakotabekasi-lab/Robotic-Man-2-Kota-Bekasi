import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AllowedMember } from '../types';
import { 
  X, 
  UploadCloud, 
  Check, 
  Trash2, 
  UserPlus, 
  Search, 
  Download, 
  Sparkles, 
  AlertCircle, 
  CheckCircle2, 
  FileSpreadsheet, 
  Clock, 
  KeyRound,
  Filter,
  RefreshCw
} from 'lucide-react';
import { 
  fetchAllowedMembersFromDB, 
  bulkAddAllowedMembersToDB, 
  deleteAllowedMemberFromDB 
} from '../services/supabaseService';
import { playClickTick, playSuccessChime, playWarningBuzzer } from '../utils/audioFeedback';
import { parseDelimitedText } from '../utils/universalDataParser';

interface AdminPreRegistrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShowToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export const AdminPreRegistrationModal: React.FC<AdminPreRegistrationModalProps> = ({
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [list, setList] = useState<AllowedMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unclaimed' | 'claimed'>('all');
  const [candidateToDelete, setCandidateToDelete] = useState<{ id: string; name: string } | null>(null);

  // Manual Add Form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newNisKelas, setNewNisKelas] = useState('');
  const [newJabatan, setNewJabatan] = useState('member');

  // CSV Drag / Drop / Upload
  const [csvPreview, setCsvPreview] = useState<Array<{
    email: string;
    nama_lengkap: string;
    nis_atau_kelas: string;
    jabatan_ekskul: string;
  }> | null>(null);
  const [isProcessingCsv, setIsProcessingCsv] = useState(false);

  const loadAllowedMembers = async () => {
    setIsLoading(true);
    const data = await fetchAllowedMembersFromDB();
    setList(data);
    setIsLoading(false);
  };

  useEffect(() => {
    if (isOpen) {
      loadAllowedMembers();
      setCsvPreview(null);
      setShowAddForm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Handle CSV file selection and parsing
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const rows = parseDelimitedText(text);
        if (rows.length < 2) {
          onShowToast('CSV file is empty or missing data rows.', 'error');
          return;
        }

        const headers = rows[0].map((h) => h.trim().toLowerCase());

        const emailIdx = headers.findIndex((h) => h.includes('email'));
        const nameIdx = headers.findIndex((h) => h.includes('nama') || h.includes('name'));
        const nisIdx = headers.findIndex((h) => h.includes('nis') || h.includes('kelas'));
        const roleIdx = headers.findIndex((h) => h.includes('jabatan') || h.includes('role'));

        const seenEmails = new Set<string>();
        const parsed = rows.slice(1).map((cols) => {
          const email = (emailIdx !== -1 ? cols[emailIdx] : cols[0]) || '';
          const nama_lengkap = (nameIdx !== -1 ? cols[nameIdx] : cols[1]) || 'Siswa Ekskul';
          const nis_atau_kelas = (nisIdx !== -1 ? cols[nisIdx] : cols[2]) || '';
          const rawRole = (roleIdx !== -1 ? cols[roleIdx] : cols[3]) || 'member';

          let jabatan_ekskul = 'member';
          const cleanRole = rawRole.trim().toLowerCase();
          if (cleanRole.includes('ketua') || cleanRole.includes('president') || cleanRole.includes('admin')) jabatan_ekskul = 'president';
          else if (cleanRole.includes('wakil') || cleanRole.includes('vice') || cleanRole.includes('bph')) jabatan_ekskul = 'vice_president';
          else if (cleanRole.includes('sekretaris') || cleanRole.includes('secretary')) jabatan_ekskul = 'secretary';
          else if (cleanRole.includes('bendahara') || cleanRole.includes('treasurer') || cleanRole.includes('keuangan')) jabatan_ekskul = 'treasurer';
          else if (cleanRole.includes('pr') || cleanRole.includes('humas') || cleanRole.includes('public')) jabatan_ekskul = 'pr';
          else if (cleanRole.includes('pembina') || cleanRole.includes('advisor') || cleanRole.includes('guru')) jabatan_ekskul = 'pembina';
          else jabatan_ekskul = 'member';

          return {
            email: email.toLowerCase().trim(),
            nama_lengkap: nama_lengkap.trim(),
            nis_atau_kelas: nis_atau_kelas.trim(),
            jabatan_ekskul,
          };
        }).filter((item) => {
          const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email);
          if (!isValidEmail) return false;
          if (seenEmails.has(item.email)) return false;
          seenEmails.add(item.email);
          return true;
        });

        if (parsed.length === 0) {
          onShowToast('Invalid CSV format. Please ensure valid email addresses are present.', 'error');
          return;
        }

        setCsvPreview(parsed);
        playClickTick();
        onShowToast(`Successfully parsed ${parsed.length} candidate members from CSV.`, 'info');
      } catch (err: any) {
        onShowToast('Failed to process CSV file: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  };

  // Submit parsed CSV to database
  const handleConfirmCsvImport = async () => {
    if (!csvPreview || csvPreview.length === 0) return;
    setIsProcessingCsv(true);
    playClickTick();

    const res = await bulkAddAllowedMembersToDB(csvPreview);
    setIsProcessingCsv(false);

    if (res.success) {
      playSuccessChime();
      onShowToast(`Successfully added ${res.count} candidate members to pre-registration staging!`, 'success');
      setCsvPreview(null);
      loadAllowedMembers();
    } else {
      onShowToast(res.error || 'Failed to save to database.', 'error');
    }
  };

  // Submit manual candidate
  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newName) return;
    playClickTick();

    const res = await bulkAddAllowedMembersToDB([{
      email: newEmail.toLowerCase().trim(),
      nama_lengkap: newName.trim(),
      nis_atau_kelas: newNisKelas.trim(),
      jabatan_ekskul: newJabatan,
      status_akun: 'unclaimed',
    }]);

    if (res.success) {
      playSuccessChime();
      onShowToast(`Candidate member ${newName} added successfully!`, 'success');
      setNewEmail('');
      setNewName('');
      setNewNisKelas('');
      setShowAddForm(false);
      loadAllowedMembers();
    } else {
      onShowToast(res.error || 'Failed to add candidate member.', 'error');
    }
  };

  // Delete candidate trigger
  const handleDeleteCandidate = (id: string, name: string) => {
    playClickTick();
    setCandidateToDelete({ id, name });
  };

  const confirmDeleteCandidate = async () => {
    if (!candidateToDelete) return;
    playClickTick();
    const { id, name } = candidateToDelete;
    setCandidateToDelete(null);
    const res = await deleteAllowedMemberFromDB(id);
    if (res.success) {
      playSuccessChime();
      onShowToast(`Candidate member ${name} removed from whitelist.`, 'info');
      loadAllowedMembers();
    } else {
      playWarningBuzzer();
      onShowToast(res.error || 'Failed to remove candidate.', 'error');
    }
  };

  // Download template CSV
  const handleDownloadTemplate = () => {
    const csvContent = "email,nama_lengkap,nis_atau_kelas,jabatan_ekskul\n" +
      "siswa1@man2kotabekasi.sch.id,Budi Santoso,0110000007/X-A,member\n" +
      "siswa2@man2kotabekasi.sch.id,Annisa Rahmawati,0110000004/X-F,secretary\n" +
      "bendahara@man2kotabekasi.sch.id,Fikri Haikal,0110000003/XI-D,treasurer\n" +
      "ketua@man2kotabekasi.sch.id,Ahmad Pratama,0110000002/XI-D,president\n" +
      "pembina@man2kotabekasi.sch.id,Drs. H. Ahmad Fauzi M.Pd,GURU/PEMBINA,pembina";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'template_pre_registration_robotics.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('CSV template downloaded successfully.', 'success');
  };

  // Filtered list
  const filteredList = list.filter((item) => {
    const matchSearch = item.email.toLowerCase().includes(search.toLowerCase()) ||
      item.nama_lengkap.toLowerCase().includes(search.toLowerCase()) ||
      item.nis_atau_kelas.toLowerCase().includes(search.toLowerCase());

    if (statusFilter === 'unclaimed') return matchSearch && item.status_akun === 'unclaimed';
    if (statusFilter === 'claimed') return matchSearch && item.status_akun === 'claimed';
    return matchSearch;
  });

  const claimedCount = list.filter((i) => i.status_akun === 'claimed').length;
  const unclaimedCount = list.filter((i) => i.status_akun === 'unclaimed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-2xs">
              📋
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Member Pre-Registration / Staging List</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                  allowed_members
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Phase A: Admin uploads student candidate CSV so Google Sign-In (Phase B) automatically matches and activates their profile.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Top Summary Bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Total Staged:</span>
              <span className="font-bold text-slate-900 font-mono">{list.length}</span>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-700">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>Claimed (Google Signed In):</span>
              <span className="font-bold font-mono">{claimedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-700">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Unclaimed (Pending):</span>
              <span className="font-bold font-mono">{unclaimedCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-2.5 py-1 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 transition cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold"
            >
              <Download className="w-3 h-3 text-slate-500" />
              <span>Download CSV Template</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition cursor-pointer flex items-center gap-1.5 text-[11px] font-semibold"
            >
              <UserPlus className="w-3 h-3 text-indigo-600" />
              <span>+ Add Manually</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* CSV Upload Dropzone */}
          <div className="p-4 bg-indigo-50/40 border border-dashed border-indigo-300 rounded-2xl text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
              <span className="text-xs font-bold text-indigo-950">Upload Candidate Members CSV</span>
            </div>
            <p className="text-[11px] text-slate-500 max-w-lg mx-auto">
              Supported column headers: <code className="font-mono bg-white px-1 py-0.5 rounded border border-slate-200 text-indigo-700">email, nama_lengkap, nis_atau_kelas, jabatan_ekskul</code>.
            </p>
            <label className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-2xs transition cursor-pointer">
              <UploadCloud className="w-4 h-4" />
              <span>Select CSV File</span>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* CSV Preview Confirmation Modal / Box */}
          <AnimatePresence>
            {csvPreview && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-950">
                      CSV Data Preview ({csvPreview.length} Candidate Members Ready to Import)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCsvPreview(null)}
                      className="px-2.5 py-1 text-xs text-slate-600 hover:bg-emerald-100/50 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={isProcessingCsv}
                      onClick={handleConfirmCsvImport}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-2xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      {isProcessingCsv ? (
                        <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Save to Staging Table</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="max-h-36 overflow-y-auto bg-white rounded-xl border border-emerald-200 text-[11px]">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                      <tr>
                        <th className="p-2">Email</th>
                        <th className="p-2">Full Name</th>
                        <th className="p-2">Student ID / Class</th>
                        <th className="p-2">Position</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {csvPreview.slice(0, 10).map((row, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2 font-mono text-slate-900">{row.email}</td>
                          <td className="p-2 font-medium text-slate-800">{row.nama_lengkap}</td>
                          <td className="p-2 text-slate-600">{row.nis_atau_kelas}</td>
                          <td className="p-2 font-mono text-indigo-700">{row.jabatan_ekskul}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {csvPreview.length > 10 && (
                    <div className="p-2 text-center text-[10px] text-slate-400 bg-slate-50 border-t border-slate-100">
                      And {csvPreview.length - 10} more records...
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Tambah Manual */}
          <AnimatePresence>
            {showAddForm && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleManualAdd}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3 text-xs"
              >
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span>Manual Candidate Entry (allowed_members)</span>
                  <button type="button" onClick={() => setShowAddForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                    ×
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="student.email@gmail.com"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono"
                  />
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Student Full Name"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                  <input
                    type="text"
                    value={newNisKelas}
                    onChange={(e) => setNewNisKelas(e.target.value)}
                    placeholder="Student ID / Class (e.g. 0110/X-H)"
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  />
                  <select
                    value={newJabatan}
                    onChange={(e) => setNewJabatan(e.target.value)}
                    className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs"
                  >
                    <option value="member">Member</option>
                    <option value="secretary">Secretary (Admin)</option>
                    <option value="treasurer">Treasurer (Admin)</option>
                    <option value="bph">Executive Officer (Admin)</option>
                    <option value="president">President (Admin)</option>
                    <option value="pr">Public Relations (PR)</option>
                  </select>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-2xs cursor-pointer"
                  >
                    + Save to Staging List
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Search & Filter Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search email, name, ID..."
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs self-start sm:self-center">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
                  statusFilter === 'all' ? 'bg-white text-slate-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                All ({list.length})
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('unclaimed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'unclaimed' ? 'bg-white text-amber-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                <span>Pending Login</span>
                <span className="text-[10px] text-amber-600">({unclaimedCount})</span>
              </button>
              <button
                type="button"
                onClick={() => setStatusFilter('claimed')}
                className={`px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  statusFilter === 'claimed' ? 'bg-white text-emerald-900 font-bold shadow-2xs' : 'text-slate-600'
                }`}
              >
                <span>Connected</span>
                <span className="text-[10px] text-emerald-600">({claimedCount})</span>
              </button>
            </div>
          </div>

          {/* Staging List Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                  <tr>
                    <th className="py-2.5 px-3">Google Email</th>
                    <th className="py-2.5 px-3">Full Name</th>
                    <th className="py-2.5 px-3">Student ID / Class</th>
                    <th className="py-2.5 px-3">Position & Role</th>
                    <th className="py-2.5 px-3">Account Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        <span className="inline-block w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-2" />
                        Loading candidate members...
                      </td>
                    </tr>
                  ) : filteredList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-slate-400">
                        No matching candidate members found.
                      </td>
                    </tr>
                  ) : (
                    filteredList.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition">
                        <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-900">
                          {item.email}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {item.nama_lengkap}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {item.nis_atau_kelas || '-'}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded-md font-mono text-[10px] font-bold ${
                            ['president', 'ketua', 'bph', 'secretary', 'treasurer', 'pr'].includes(item.jabatan_ekskul)
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.jabatan_ekskul}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.status_akun === 'claimed' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                              <Check className="w-2.5 h-2.5 text-emerald-600" /> Connected (Claimed)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold">
                              <Clock className="w-2.5 h-2.5 text-amber-600" /> Pending Login
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteCandidate(item.id, item.nama_lengkap)}
                            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete candidate member"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <div className="text-[11px] text-slate-500">
            Postgres Trigger <code className="font-mono text-indigo-700">on_auth_user_created</code> automatically matches this table when students sign in with Google.
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>

        {/* Candidate Deletion Confirmation Modal */}
        <AnimatePresence>
          {candidateToDelete && (
            <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xl max-w-sm w-full space-y-3.5 text-center"
              >
                <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Remove Candidate Member</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Remove candidate <strong>{candidateToDelete.name}</strong> from the pre-registration whitelist?
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setCandidateToDelete(null)}
                    className="flex-1 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeleteCandidate}
                    className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-md shadow-rose-600/20 transition cursor-pointer"
                  >
                    Remove
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
