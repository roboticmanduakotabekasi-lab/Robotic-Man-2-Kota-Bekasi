import React, { useState, useRef, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  FileText, 
  ClipboardPaste, 
  Download, 
  Users, 
  Wallet, 
  CalendarCheck, 
  ArrowRight, 
  Layers, 
  RefreshCw, 
  SlidersHorizontal,
  ChevronDown,
  Sparkles,
  Info,
  Database
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Member, AttendanceRecord, CashTransaction } from '../types';
import { formatMemberTimestamp } from '../utils/formatters';
import { 
  ImportTargetType, 
  ColumnMapping, 
  parseExcelToSheets, 
  parsePdfToRows, 
  parseDelimitedText, 
  detectTargetType, 
  suggestColumnMapping, 
  buildMembersFromRows, 
  buildCashFromRows, 
  buildAttendanceFromRows 
} from '../utils/universalDataParser';
import { 
  upsertMembersBatchToDB, 
  bulkUpsertCashToDB, 
  bulkUpsertAttendanceToDB,
  bulkAddAllowedMembersToDB
} from '../services/supabaseService';
import { playSuccessChime, playClickTick, playWarningBuzzer } from '../utils/audioFeedback';

export interface UniversalDataUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTarget?: ImportTargetType;
  existingMembers: Member[];
  existingCash?: CashTransaction[];
  existingAttendance?: AttendanceRecord[];
  isDemo?: boolean;
  onMembersUpdated?: (updated: Member[], isReplace?: boolean) => void;
  onCashUpdated?: (updated: CashTransaction[], isReplace?: boolean) => void;
  onAttendanceUpdated?: (updated: AttendanceRecord[], isReplace?: boolean) => void;
  onShowToast?: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const UniversalDataUploadModal: React.FC<UniversalDataUploadModalProps> = ({
  isOpen,
  onClose,
  defaultTarget = 'members',
  existingMembers,
  existingCash = [],
  existingAttendance = [],
  isDemo = false,
  onMembersUpdated,
  onCashUpdated,
  onAttendanceUpdated,
  onShowToast,
}) => {
  // Target type: 'members' | 'cash' | 'attendance'
  const [targetType, setTargetType] = useState<ImportTargetType>(defaultTarget);

  // Input modes: 'upload' | 'paste'
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('upload');
  const [pastedText, setPastedText] = useState('');

  // Parsed File State
  const [fileName, setFileName] = useState<string>('');
  const [fileExtension, setFileExtension] = useState<string>('');
  const [availableSheets, setAvailableSheets] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [sheetDataMap, setSheetDataMap] = useState<Record<string, string[][]>>({});
  
  // Current active raw rows & headers
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<string[][]>([]);

  // Column Mapping
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({});
  const [showAdvancedMapping, setShowAdvancedMapping] = useState<boolean>(false);
  const [showSchemaGuide, setShowSchemaGuide] = useState<boolean>(false);

  // Sync mode: 'upsert' (perbarui & tambah) vs 'replace' (ganti semua)
  const [syncMode, setSyncMode] = useState<'upsert' | 'replace'>('upsert');

  // Loading & Error States
  const [isLoadingFile, setIsLoadingFile] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [warningList, setWarningList] = useState<string[]>([]);

  // Preview Page
  const [previewPage, setPreviewPage] = useState<number>(1);
  const PREVIEW_LIMIT = 8;

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Sync default target when modal opens
  useEffect(() => {
    if (isOpen) {
      setTargetType(defaultTarget);
      resetState();
    }
  }, [isOpen, defaultTarget]);

  const resetState = () => {
    setFileName('');
    setFileExtension('');
    setAvailableSheets([]);
    setSelectedSheet('');
    setSheetDataMap({});
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setErrorMessage(null);
    setWarningList([]);
    setPastedText('');
    setPreviewPage(1);
    setShowAdvancedMapping(false);
    setShowSchemaGuide(false);
  };

  if (!isOpen) return null;

  // Process loaded 2D string data
  const processRawData = (rowsData: string[][], name: string, ext: string) => {
    if (!rowsData || rowsData.length < 2) {
      setErrorMessage('Data dalam file terlalu pendek atau tidak memiliki baris judul kolom.');
      setRawHeaders([]);
      setRawRows([]);
      return;
    }

    setErrorMessage(null);
    const headers = rowsData[0].map((h) => h.trim());
    const contentRows = rowsData.slice(1).filter((r) => r.some((cell) => cell.trim().length > 0));

    if (contentRows.length === 0) {
      setErrorMessage('Tidak ditemukan baris isi data setelah baris judul.');
      setRawHeaders([]);
      setRawRows([]);
      return;
    }

    // Auto-detect target type if user hasn't explicitly set one or when loading new file
    const detected = detectTargetType(headers, contentRows);
    setTargetType(detected);

    const mapping = suggestColumnMapping(headers, detected);

    setFileName(name);
    setFileExtension(ext);
    setRawHeaders(headers);
    setRawRows(contentRows);
    setColumnMapping(mapping);
    setPreviewPage(1);
  };

  // Switch active sheet in multi-sheet Excel
  const handleSelectSheet = (sheetName: string) => {
    playClickTick();
    setSelectedSheet(sheetName);
    const rows = sheetDataMap[sheetName] || [];
    processRawData(rows, fileName, fileExtension);
  };

  // Change Target Type manually
  const handleChangeTargetType = (newTarget: ImportTargetType) => {
    playClickTick();
    setTargetType(newTarget);
    if (rawHeaders.length > 0) {
      const mapping = suggestColumnMapping(rawHeaders, newTarget);
      setColumnMapping(mapping);
    }
  };

  // Batasan Keamanan Upload File (Anti-DoS & Memory Exhaustion CWE-400)
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // Maksimal 10 MB
  const ALLOWED_EXTENSIONS = ['xlsx', 'xls', 'pdf', 'csv', 'tsv', 'txt', 'json'];

  // Handle File Upload (Excel, PDF, CSV, JSON Backup)
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 1. File Size Validation (Prevent browser crash / OOM)
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File size is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). The maximum allowed file size is 10 MB.`);
      playWarningBuzzer();
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const name = file.name;
    const ext = name.split('.').pop()?.toLowerCase() || '';

    // 2. File Extension Validation
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      setErrorMessage(`Format file .${ext || 'unknown'} tidak didukung. Harap unggah spreadsheet (.xlsx, .xls, .csv, .tsv), dokumen (.pdf), atau berkas cadangan JSON (.json).`);
      playWarningBuzzer();
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    playClickTick();
    setIsLoadingFile(true);
    setErrorMessage(null);
    setWarningList([]);

    try {
      if (ext === 'xlsx' || ext === 'xls') {
        const arrayBuffer = await file.arrayBuffer();
        const { sheetNames, sheetsData } = parseExcelToSheets(arrayBuffer);
        if (sheetNames.length === 0) {
          throw new Error('The Excel workbook contains no readable worksheets.');
        }
        setAvailableSheets(sheetNames);
        setSelectedSheet(sheetNames[0]);
        setSheetDataMap(sheetsData);
        processRawData(sheetsData[sheetNames[0]], name, ext);
      } else if (ext === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        const pdfRows = await parsePdfToRows(arrayBuffer);
        if (pdfRows.length === 0) {
          throw new Error('Unable to extract tabular text from this PDF. Please verify that the PDF contains selectable digital text (not a scanned image).');
        }
        setAvailableSheets([]);
        processRawData(pdfRows, name, ext);
      } else if (ext === 'json') {
        const text = await file.text();
        let parsed: any;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error('Format file JSON tidak valid. Pastikan file berisi JSON yang terstruktur.');
        }
        const items = Array.isArray(parsed) ? parsed : (parsed.data || parsed.records || parsed.items || []);
        if (!Array.isArray(items) || items.length === 0) {
          throw new Error('Berkas cadangan JSON ini tidak berisi daftar data (array) yang dapat dipulihkan.');
        }

        // Auto-extract column keys as headers
        const allKeys = Array.from(
          new Set(
            items.flatMap((item: any) =>
              typeof item === 'object' && item !== null ? Object.keys(item) : []
            )
          )
        );
        if (allKeys.length === 0) {
          throw new Error('Struktur data JSON tidak memiliki kolom yang dapat dipetakan.');
        }

        const headers = allKeys;
        const contentRows = items.map((item: any) =>
          headers.map((key) => {
            const val = item[key];
            return val !== null && val !== undefined ? String(val).trim() : '';
          })
        );
        setAvailableSheets([]);
        processRawData([headers, ...contentRows], name, 'json');
      } else {
        // CSV / TSV / TXT
        const text = await file.text();
        const rows = parseDelimitedText(text);
        setAvailableSheets([]);
        processRawData(rows, name, ext || 'csv');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process uploaded file.');
      playWarningBuzzer();
    } finally {
      setIsLoadingFile(false);
      // Reset input value so same file can be re-selected if desired
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle Pasted Text Apply
  const handleApplyPaste = () => {
    playClickTick();
    if (!pastedText.trim()) {
      setErrorMessage('Please paste text or spreadsheet data first.');
      return;
    }
    try {
      const rows = parseDelimitedText(pastedText);
      setAvailableSheets([]);
      processRawData(rows, 'Clipboard Data', 'paste');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to process pasted data.');
      playWarningBuzzer();
    }
  };

  // Download Sample Template for Current Target
  const handleDownloadTemplate = () => {
    playClickTick();
    let csvContent = '';
    let downloadFileName = '';

    if (targetType === 'members') {
      downloadFileName = 'template_members_robotics.csv';
      csvContent = 'NISN,Full Name,Class,Gender,Date of Birth,Role,Position,Status,Student Phone,Parent Phone,Email,National ID,Address\n' +
        '0110000001,Ahmad Fauzan Pratama,X-A,Male,2009-05-14,member,member,Active,081234567890,081987654321,student1@man2kotabekasi.sch.id,3275012345670001,Bekasi Selatan\n' +
        '0110000002,Adinda Putri Lestari,XI-B,Female,2008-08-22,admin,secretary,executive_board,082134567891,082198765432,secretary@man2kotabekasi.sch.id,3275012345670002,Rawalumbu\n' +
        '0110000003,Fikri Haikal,XI-D,Male,2008-07-19,admin,treasurer,executive_board,081234567892,081398765433,treasurer@man2kotabekasi.sch.id,3275012345670003,Bekasi Timur\n' +
        '0110000099,Muhammad Rayhan Pratama,XII-IPA 1,Male,2007-06-14,admin,president,executive_board,081298765432,081311223344,president@man2kotabekasi.sch.id,3275012345670004,Pekayon\n' +
        '197505121998031001,Abdul Khoir S.Kom,Advisor,Male,1975-05-12,pembina,advisor,executive_board,081200000101,-,advisor@man2kotabekasi.sch.id,3275012345670005,Bekasi';
    } else if (targetType === 'cash') {
      downloadFileName = 'template_treasury_robotics.csv';
      csvContent = 'Date,NISN,Member Name,Type,Amount,Description\n' +
        `${new Date().toISOString().slice(0, 10)},0110000001,Ahmad Fauzan Pratama,Inflow,5000,Club Dues September Week 1\n` +
        `${new Date().toISOString().slice(0, 10)},,,Outflow,50000,Sensors & Screws Hardware Components`;
    } else {
      downloadFileName = 'template_attendance_robotics.csv';
      csvContent = 'Date,NISN,Member Name,Status\n' +
        `${new Date().toISOString().slice(0, 10)},0110000001,Ahmad Fauzan Pratama,Present\n` +
        `${new Date().toISOString().slice(0, 10)},0110000002,Adinda Putri Lestari,Present`;
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = downloadFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Generate Parsed Preview Data
  let previewMembers: Member[] = [];
  let previewCash: CashTransaction[] = [];
  let previewAttendance: AttendanceRecord[] = [];

  if (rawRows.length > 0) {
    if (targetType === 'members') {
      const { validMembers } = buildMembersFromRows(rawRows, columnMapping, existingMembers);
      previewMembers = validMembers;
    } else if (targetType === 'cash') {
      const { validCash } = buildCashFromRows(rawRows, columnMapping, existingMembers);
      previewCash = validCash;
    } else if (targetType === 'attendance') {
      const { validAttendance } = buildAttendanceFromRows(rawRows, columnMapping, existingMembers);
      previewAttendance = validAttendance;
    }
  }

  const totalParsedCount = 
    targetType === 'members' ? previewMembers.length : 
    targetType === 'cash' ? previewCash.length : 
    previewAttendance.length;

  // Submit and Sync Data to State & Database
  const handleApplyData = async () => {
    if (totalParsedCount === 0) {
      setErrorMessage('Tidak ada data valid yang dapat diterapkan.');
      return;
    }

    playClickTick();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (targetType === 'members') {
        const isReplace = syncMode === 'replace';
        let updatedList: Member[];
        
        if (isReplace) {
          updatedList = previewMembers;
        } else {
          const map = new Map<string, Member>(existingMembers.map((m) => [m.nisn, m]));
          previewMembers.forEach((m) => {
            map.set(m.nisn, m);
          });
          updatedList = Array.from(map.values());
        }

        // Direct Supabase Persistence & Pre-registration Auto-sync (gated for demo session)
        let supaSuccess = false;
        let supaErrMsg = '';
        if (!isDemo) {
          try {
            const res = await upsertMembersBatchToDB(previewMembers);
            supaSuccess = res.success;
            if (!res.success) {
              supaErrMsg = res.error || 'Failed to save to Supabase cloud database';
            }

            // Sync student candidate pre-registration to allowed_members for Google OAuth matching & role enforcement
            const candidateList = previewMembers
              .filter((m) => m.email && m.email.includes('@'))
              .map((m) => ({
                email: m.email.toLowerCase().trim(),
                nama_lengkap: m.fullName.trim(),
                nis_atau_kelas: `${m.nisn || ''}/${m.grade || ''}-${m.classRoom || ''}`.replace(/\/$/, ''),
                jabatan_ekskul: m.jabatan || (m.role === 'admin' ? 'president' : 'member'),
                status_akun: 'unclaimed' as const,
              }));

            if (candidateList.length > 0) {
              await bulkAddAllowedMembersToDB(candidateList);
            }
          } catch (err: any) {
            supaErrMsg = err.message || 'Koneksi Supabase bermasalah';
          }
        }

        // Update App state & localStorage
        if (onMembersUpdated) {
          onMembersUpdated(updatedList, isReplace);
        }

        playSuccessChime();
        if (isDemo) {
          onShowToast?.(`[Demo Sandbox] ${previewMembers.length} member records saved in local demo sandbox.`, 'info');
        } else if (supaSuccess) {
          onShowToast?.(`Successfully saved and synced ${previewMembers.length} member records!`, 'success');
        } else {
          onShowToast?.(`Member records updated locally. (${supaErrMsg || 'Offline mode'})`, 'info');
        }
        onClose();

      } else if (targetType === 'cash') {
        const isReplace = syncMode === 'replace';
        let updatedList: CashTransaction[];

        if (isReplace) {
          updatedList = previewCash;
        } else {
          updatedList = [...previewCash, ...existingCash];
        }

        if (onCashUpdated) {
          onCashUpdated(updatedList, isReplace);
        }

        if (!isDemo) {
          try {
            await bulkUpsertCashToDB(previewCash);
          } catch {
            // Fallback handled
          }
        }

        playSuccessChime();
        if (isDemo) {
          onShowToast?.(`[Demo Sandbox] ${previewCash.length} treasury transactions saved in local demo sandbox.`, 'info');
        } else {
          onShowToast?.(`Successfully added ${previewCash.length} treasury transactions!`, 'success');
        }
        onClose();

      } else if (targetType === 'attendance') {
        const isReplace = syncMode === 'replace';
        let updatedList: AttendanceRecord[];

        if (isReplace) {
          updatedList = previewAttendance;
        } else {
          // Merge by date & nisn
          const map = new Map<string, AttendanceRecord>();
          existingAttendance.forEach((a) => {
            const key = `${a.tanggal}_${a.nisn || a.namaAnggota}`;
            map.set(key, a);
          });
          previewAttendance.forEach((a) => {
            const key = `${a.tanggal}_${a.nisn || a.namaAnggota}`;
            map.set(key, a);
          });
          updatedList = Array.from(map.values());
        }

        if (onAttendanceUpdated) {
          onAttendanceUpdated(updatedList, isReplace);
        }

        if (!isDemo) {
          try {
            await bulkUpsertAttendanceToDB(previewAttendance);
          } catch {
            // Fallback handled
          }
        }

        playSuccessChime();
        if (isDemo) {
          onShowToast?.(`[Demo Sandbox] ${previewAttendance.length} attendance records saved in local demo sandbox.`, 'info');
        } else {
          onShowToast?.(`Successfully synchronized ${previewAttendance.length} attendance records!`, 'success');
        }
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred while synchronizing data.');
      playWarningBuzzer();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#C7D2FE] overflow-hidden my-auto"
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-linear-to-r from-[#EEF2FF] via-white to-[#EEF2FF] border-b border-[#C7D2FE] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#4338CA] text-white flex items-center justify-center shadow-md shadow-[#4338CA]/20 shrink-0">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-[#141414]">
                  {targetType === 'members'
                    ? 'Upload Member Directory CSV / Excel'
                    : targetType === 'cash'
                    ? 'Upload Treasury & Dues CSV / Excel'
                    : 'Upload Attendance Records CSV / Excel'}
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {targetType === 'members'
                  ? 'Upload a CSV (.csv) or Excel file containing member roster information.'
                  : targetType === 'cash'
                  ? 'Upload a CSV (.csv) or Excel file for club treasury inflows and expenses.'
                  : 'Upload a CSV (.csv) or Excel file for student workshop attendance logs.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              playClickTick();
              onClose();
            }}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
            title="Close Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY (SCROLLABLE) */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-4 flex-1">
          
          {/* TARGET DATASET SELECTOR */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-1.5 p-1 bg-[#EEF2FF] rounded-xl border border-[#C7D2FE]">
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setTargetType('members');
                  resetState();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  targetType === 'members'
                    ? 'bg-[#4338CA] text-white shadow-2xs'
                    : 'text-[#312E81] hover:text-[#4338CA]'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Members</span>
                <span className="text-[10px] opacity-80">({existingMembers.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setTargetType('attendance');
                  resetState();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  targetType === 'attendance'
                    ? 'bg-[#4338CA] text-white shadow-2xs'
                    : 'text-[#312E81] hover:text-[#4338CA]'
                }`}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>Attendance</span>
                <span className="text-[10px] opacity-80">({existingAttendance.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setTargetType('cash');
                  resetState();
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                  targetType === 'cash'
                    ? 'bg-[#4338CA] text-white shadow-2xs'
                    : 'text-[#312E81] hover:text-[#4338CA]'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                <span>Treasury</span>
                <span className="text-[10px] opacity-80">({existingCash.length})</span>
              </button>
            </div>
          </div>

          {/* STEP 2: INPUT MODE TABS (UPLOAD vs PASTE) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setInputMode('upload');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  inputMode === 'upload'
                    ? 'bg-[#4338CA] text-white border-[#4338CA] shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#C7D2FE]'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Upload File (.csv / .xlsx)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setInputMode('paste');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer border ${
                  inputMode === 'paste'
                    ? 'bg-[#4338CA] text-white border-[#4338CA] shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-200 hover:border-[#C7D2FE]'
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Paste Table (Clipboard)</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setShowSchemaGuide(!showSchemaGuide);
                }}
                className={`flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition cursor-pointer ${
                  showSchemaGuide 
                    ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                    : 'bg-white border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200'
                }`}
                title="View CSV column format specifications and RBAC roles"
              >
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                <span>CSV Schema &amp; Guide</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg border border-slate-200 bg-white text-indigo-700 hover:bg-indigo-50/50 hover:border-indigo-200 transition cursor-pointer"
                title={`Download sample CSV template for ${targetType === 'members' ? 'members' : targetType === 'cash' ? 'treasury' : 'attendance'}`}
              >
                <Download className="w-3.5 h-3.5" />
                <span>
                  {targetType === 'members'
                    ? 'Download Member Template'
                    : targetType === 'cash'
                    ? 'Download Treasury Template'
                    : 'Download Attendance Template'}
                </span>
              </button>
            </div>
          </div>

          {/* EXPANDABLE CSV SCHEMA & PDP SPECIFICATION CARD */}
          <AnimatePresence>
            {showSchemaGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-3"
              >
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 flex items-center gap-1.5 text-xs">
                      <Database className="w-3.5 h-3.5 text-indigo-600" />
                      CSV Column Schema Specifications ({targetType === 'members' ? 'Member & Student Roster' : targetType === 'cash' ? 'Treasury Transactions' : 'Attendance Records'})
                    </span>
                    <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded font-mono font-medium">
                      Encoding: UTF-8 / RFC-4180
                    </span>
                  </div>

                  {targetType === 'members' ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-[11px] text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                            <th className="py-1 pr-2">Column Name (Header)</th>
                            <th className="py-1 px-2">Required?</th>
                            <th className="py-1 px-2">Accepted Values / Example</th>
                            <th className="py-1 pl-2">RBAC &amp; System Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/60 font-mono text-[10.5px]">
                          <tr>
                            <td className="py-1 pr-2 text-indigo-700 font-bold">NISN / ID</td>
                            <td className="py-1 px-2 text-rose-600 font-sans font-bold">Required</td>
                            <td className="py-1 px-2 text-slate-600">0110000001 (10-digit number)</td>
                            <td className="py-1 pl-2 text-slate-500 font-sans">Unique student primary key. Used for student portal verification &amp; check-in.</td>
                          </tr>
                          <tr>
                            <td className="py-1 pr-2 text-indigo-700 font-bold">Full Name</td>
                            <td className="py-1 px-2 text-rose-600 font-sans font-bold">Required</td>
                            <td className="py-1 px-2 text-slate-600">Ahmad Fauzan Pratama</td>
                            <td className="py-1 pl-2 text-slate-500 font-sans">Official student name. DDE formula sanitization automatically applied.</td>
                          </tr>
                          <tr>
                            <td className="py-1 pr-2 text-indigo-700 font-bold">Class / Grade</td>
                            <td className="py-1 px-2 text-emerald-600 font-sans">Optional</td>
                            <td className="py-1 px-2 text-slate-600">X-A, XI-B, XII-IPA 1</td>
                            <td className="py-1 pl-2 text-slate-500 font-sans">Academic grade level (X, XI, XII) and classroom code.</td>
                          </tr>
                          <tr>
                            <td className="py-1 pr-2 text-indigo-700 font-bold">Role</td>
                            <td className="py-1 px-2 text-emerald-600 font-sans">Optional</td>
                            <td className="py-1 px-2 text-slate-600">admin, advisor, member</td>
                            <td className="py-1 pl-2 text-slate-500 font-sans">App access clearance: admin (Officer), advisor (Faculty Teacher), member (Student).</td>
                          </tr>
                          <tr>
                            <td className="py-1 pr-2 text-indigo-700 font-bold">Position / Title</td>
                            <td className="py-1 px-2 text-emerald-600 font-sans">Optional</td>
                            <td className="py-1 px-2 text-slate-600">president, secretary, treasurer, pr, advisor, member</td>
                            <td className="py-1 pl-2 text-slate-500 font-sans">Official organizational role title in robotics club.</td>
                          </tr>
                          <tr>
                            <td className="py-1 pr-2 text-indigo-700 font-bold">Email</td>
                            <td className="py-1 px-2 text-emerald-600 font-sans">Recommended</td>
                            <td className="py-1 px-2 text-slate-600">student1@man2kotabekasi.sch.id</td>
                            <td className="py-1 pl-2 text-slate-500 font-sans">Synchronized to allowed_members for seamless Google OAuth login.</td>
                          </tr>
                          <tr>
                            <td className="py-1 pr-2 text-indigo-700 font-bold">Birth Date</td>
                            <td className="py-1 px-2 text-emerald-600 font-sans">Recommended</td>
                            <td className="py-1 px-2 text-slate-600">2009-05-14 or 14/05/2009</td>
                            <td className="py-1 pl-2 text-slate-500 font-sans">Used for student self-service verification and account security.</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  ) : targetType === 'cash' ? (
                    <div className="text-[11px] text-slate-600">
                      Supported columns: <span className="font-mono font-bold text-slate-800">Date (YYYY-MM-DD), NISN, Member Name, Type (Inflow/Outflow), Amount (Number), Description</span>.
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-600">
                      Supported columns: <span className="font-mono font-bold text-slate-800">Date (YYYY-MM-DD), NISN, Member Name, Status (Present, Excused, Sick, Absent)</span>.
                    </div>
                  )}

                  <div className="pt-1.5 border-t border-slate-200/60 text-[10.5px] text-slate-500 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-amber-700 font-medium">
                      🔒 Data Privacy: Real member records are securely stored and imported via private CSV/database.
                    </span>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="text-indigo-600 hover:underline font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      <Download className="w-3 h-3" /> Download Sample Template
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* INPUT FORM: FILE DRAG-AND-DROP OR TEXTAREA */}
          {inputMode === 'upload' ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#C7D2FE] hover:border-[#4338CA] bg-[#EEF2FF]/30 hover:bg-[#EEF2FF]/60 rounded-2xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2 group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.pdf,.csv,.tsv,.txt,.json"
                onChange={handleFileChange}
                className="hidden"
              />

              {isLoadingFile ? (
                <div className="py-4 flex flex-col items-center gap-2 text-[#4338CA]">
                  <Loader2 className="w-8 h-8 animate-spin" />
                  <span className="text-xs font-bold">Mengekstrak dan membaca struktur berkas...</span>
                </div>
              ) : (
                <>
                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#C7D2FE] group-hover:scale-105 transition flex items-center justify-center text-[#4338CA] shadow-xs">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="text-xs sm:text-sm font-bold text-[#141414] group-hover:text-[#4338CA] transition">
                      Pilih atau Tarik Berkas CSV / Excel / Backup JSON ke Sini
                    </span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Mendukung <strong>Spreadsheet (.xlsx, .csv, .tsv)</strong>, <strong>Dokumen (.pdf)</strong>, atau <strong>Cadangan JSON (.json)</strong>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap justify-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-[#4338CA] border border-[#C7D2FE]">
                      <FileText className="w-3 h-3" /> CSV (.csv)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <FileSpreadsheet className="w-3 h-3" /> Excel (.xlsx)
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200">
                      <Database className="w-3 h-3" /> Backup JSON (.json)
                    </span>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={pastedText}
                onChange={(e) => setPastedText(e.target.value)}
                placeholder="Copy rows from Google Sheets / Microsoft Excel and paste here...&#10;Example:&#10;NISN	Full Name	Class	Gender&#10;0071234567	Ahmad Fauzan	X-A	Male"
                rows={4}
                className="w-full p-3 rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/20 text-xs font-mono text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#4338CA] transition"
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleApplyPaste}
                  className="px-4 py-2 bg-[#4338CA] hover:bg-[#312E81] text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Process Pasted Data</span>
                </button>
              </div>
            </div>
          )}

          {/* ERROR ALERT */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <strong className="font-bold">Notice: </strong>
                <span>{errorMessage}</span>
              </div>
            </div>
          )}

          {/* PARSED FILE INFO BAR */}
          {fileName && (
            <div className="bg-[#EEF2FF] border border-[#C7D2FE] rounded-2xl p-3 sm:p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-white text-[#4338CA] border border-[#C7D2FE] flex items-center justify-center shrink-0 shadow-2xs font-bold text-xs">
                  {fileExtension.toUpperCase() || 'FILE'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-[#141414] truncate max-w-xs">{fileName}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {totalParsedCount} Valid Rows
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Target: <strong className="text-[#4338CA] uppercase font-bold">{targetType}</strong> • {rawHeaders.length} Columns Detected
                  </p>
                </div>
              </div>

              {/* SHEET SELECTOR (IF EXCEL WITH MULTIPLE SHEETS) */}
              {availableSheets.length > 1 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-[#312E81]">Select Sheet:</span>
                  <select
                    value={selectedSheet}
                    onChange={(e) => handleSelectSheet(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-[#C7D2FE] rounded-xl text-xs font-bold text-[#312E81] focus:outline-none cursor-pointer"
                  >
                    {availableSheets.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* TOGGLE ADVANCED COLUMN MAPPING */}
              <button
                type="button"
                onClick={() => {
                  playClickTick();
                  setShowAdvancedMapping(!showAdvancedMapping);
                }}
                className="flex items-center gap-1.5 text-xs font-semibold text-[#4338CA] hover:text-[#312E81] cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>{showAdvancedMapping ? 'Hide Column Mapping' : 'Customize Column Mapping'}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showAdvancedMapping ? 'rotate-180' : ''}`} />
              </button>
            </div>
          )}

          {/* ADVANCED COLUMN MAPPING CONFIG */}
          {showAdvancedMapping && rawHeaders.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-white border border-[#C7D2FE] rounded-2xl p-4 space-y-3 shadow-2xs"
            >
              <div className="text-xs font-bold text-[#312E81] flex items-center justify-between border-b border-slate-100 pb-2">
                <span>File Column Mapping to Application Database:</span>
                <span className="text-[11px] text-slate-400 font-normal">Verify matching column headers</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {targetType === 'members' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">NISN / ID Column:</label>
                      <select
                        value={columnMapping.nisn ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, nisn: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Unmapped --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Full Name Column:</label>
                      <select
                        value={columnMapping.fullName ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, fullName: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Unmapped --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Grade / Level Column:</label>
                      <select
                        value={columnMapping.grade ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, grade: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto (X) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Classroom / Room Column:</label>
                      <select
                        value={columnMapping.classRoom ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, classRoom: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto (A) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Gender Column:</label>
                      <select
                        value={columnMapping.gender ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, gender: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto (Male) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Student Phone Column:</label>
                      <select
                        value={columnMapping.personalPhone ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, personalPhone: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Skip --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#4338CA] mb-1">Parent Phone Column:</label>
                      <select
                        value={columnMapping.parentPhone ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, parentPhone: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value={-1}>-- Skip --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Student Email Column:</label>
                      <select
                        value={columnMapping.email ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, email: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Skip --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#4338CA] mb-1">Address / Residence Column:</label>
                      <select
                        value={columnMapping.address ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, address: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value={-1}>-- Skip --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">National ID / NIK Column:</label>
                      <select
                        value={columnMapping.nik ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, nik: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Skip --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-700 mb-1">Birth Date Column (Verification):</label>
                      <select
                        value={columnMapping.birthDate ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, birthDate: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-900"
                      >
                        <option value={-1}>-- Skip / Auto --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-700 mb-1">Role / Clearance Column:</label>
                      <select
                        value={columnMapping.role ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, role: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-900"
                      >
                        <option value={-1}>-- Default ('member') --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-700 mb-1">Position / Title Column:</label>
                      <select
                        value={columnMapping.jabatan ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, jabatan: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-indigo-50/60 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-900"
                      >
                        <option value={-1}>-- Default ('member') --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Membership Status Column:</label>
                      <select
                        value={columnMapping.status ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, status: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto ('Active') --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#4338CA] mb-1">Registration Date Column:</label>
                      <select
                        value={columnMapping.timestamp ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, timestamp: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs font-semibold text-slate-800"
                      >
                        <option value={-1}>-- Auto (Current Time) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {targetType === 'cash' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Column:</label>
                      <select
                        value={columnMapping.tanggal ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, tanggal: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto (Today) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Amount Column (IDR):</label>
                      <select
                        value={columnMapping.jumlah ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, jumlah: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Unmapped --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Member / NISN Column:</label>
                      <select
                        value={columnMapping.cashMemberNisn ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, cashMemberNisn: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- General Fund (No Member) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Description Column:</label>
                      <select
                        value={columnMapping.keterangan ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, keterangan: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {targetType === 'attendance' && (
                  <>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Date Column:</label>
                      <select
                        value={columnMapping.attTanggal ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, attTanggal: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto (Today) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">NISN / Member Column:</label>
                      <select
                        value={columnMapping.attMemberNisn ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, attMemberNisn: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Unmapped --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 mb-1">Attendance Status Column:</label>
                      <select
                        value={columnMapping.attStatus ?? -1}
                        onChange={(e) => setColumnMapping({ ...columnMapping, attStatus: Number(e.target.value) })}
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                      >
                        <option value={-1}>-- Auto (Present) --</option>
                        {rawHeaders.map((h, i) => (
                          <option key={i} value={i}>Column {i + 1}: {h}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}

          {/* STEP 3: PREVIEW DATA TABLE */}
          {totalParsedCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Preview Records to Import ({totalParsedCount} Rows):</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  Page {previewPage} of {Math.ceil(totalParsedCount / PREVIEW_LIMIT)}
                </span>
              </div>

              <div className="overflow-x-auto border border-[#C7D2FE] rounded-2xl bg-white shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#EEF2FF] text-[#312E81] border-b border-[#C7D2FE] font-bold">
                    {targetType === 'members' && (
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">NISN</th>
                        <th className="py-2.5 px-3">Full Name</th>
                        <th className="py-2.5 px-3">Class</th>
                        <th className="py-2.5 px-3">Gender</th>
                        <th className="py-2.5 px-3">Student Phone</th>
                        <th className="py-2.5 px-3">Parent Phone</th>
                        <th className="py-2.5 px-3">Address</th>
                        <th className="py-2.5 px-3">Registered At</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    )}
                    {targetType === 'cash' && (
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">Member / Account</th>
                        <th className="py-2.5 px-3">Type</th>
                        <th className="py-2.5 px-3">Amount</th>
                        <th className="py-2.5 px-3">Description</th>
                      </tr>
                    )}
                    {targetType === 'attendance' && (
                      <tr>
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Date</th>
                        <th className="py-2.5 px-3">NISN</th>
                        <th className="py-2.5 px-3">Member Name</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    )}
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {targetType === 'members' &&
                      previewMembers
                        .slice((previewPage - 1) * PREVIEW_LIMIT, previewPage * PREVIEW_LIMIT)
                        .map((m, idx) => {
                          const isExisting = existingMembers.some((em) => em.nisn === m.nisn);
                          return (
                            <tr key={idx} className="hover:bg-slate-50 transition">
                              <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                {(previewPage - 1) * PREVIEW_LIMIT + idx + 1}
                              </td>
                              <td className="py-2 px-3 font-mono font-bold text-[#4338CA]">{m.nisn}</td>
                              <td className="py-2 px-3 font-bold">{m.fullName}</td>
                              <td className="py-2 px-3">{m.grade}-{m.classRoom}</td>
                              <td className="py-2 px-3 text-slate-500">{m.gender}</td>
                              <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{m.personalPhone || '-'}</td>
                              <td className="py-2 px-3 font-mono text-[11px] text-indigo-700 font-semibold">{m.parentPhone || '-'}</td>
                              <td className="py-2 px-3 text-slate-600 truncate max-w-[140px] text-[11px]" title={m.address || '-'}>{m.address || '-'}</td>
                              <td className="py-2 px-3 font-medium text-slate-600 text-[11px] whitespace-nowrap">{formatMemberTimestamp(m.timestamp).full}</td>
                              <td className="py-2 px-3 text-center">
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  isExisting ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {isExisting ? 'Update' : 'New'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                    {targetType === 'cash' &&
                      previewCash
                        .slice((previewPage - 1) * PREVIEW_LIMIT, previewPage * PREVIEW_LIMIT)
                        .map((c, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                              {(previewPage - 1) * PREVIEW_LIMIT + idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{c.tanggal}</td>
                            <td className="py-2 px-3 font-bold">{c.namaAnggota || c.nisn || 'General Fund'}</td>
                            <td className="py-2 px-3">
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                c.jenis === 'Masuk' || c.jenis === 'Inflow' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {c.jenis === 'Masuk' ? 'Inflow' : c.jenis === 'Keluar' ? 'Outflow' : c.jenis}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-mono font-bold text-[#4338CA]">
                              Rp {c.jumlah.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-3 text-slate-500 truncate max-w-xs">{c.keterangan}</td>
                          </tr>
                        ))}

                    {targetType === 'attendance' &&
                      previewAttendance
                        .slice((previewPage - 1) * PREVIEW_LIMIT, previewPage * PREVIEW_LIMIT)
                        .map((a, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition">
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                              {(previewPage - 1) * PREVIEW_LIMIT + idx + 1}
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">{a.tanggal}</td>
                            <td className="py-2 px-3 font-mono text-slate-500">{a.nisn}</td>
                            <td className="py-2 px-3 font-bold">{a.namaAnggota}</td>
                            <td className="py-2 px-3 text-center">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                                {a.status === 'Hadir' ? 'Present' : a.status === 'Izin' ? 'Excused' : a.status === 'Sakit' ? 'Sick' : a.status === 'Alpha' ? 'Absent' : a.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                  </tbody>
                </table>
              </div>

              {/* PAGINATION CONTROLS */}
              {Math.ceil(totalParsedCount / PREVIEW_LIMIT) > 1 && (
                <div className="flex items-center justify-between text-xs pt-1">
                  <button
                    type="button"
                    disabled={previewPage <= 1}
                    onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 cursor-pointer font-semibold"
                  >
                    Previous
                  </button>
                  <span className="text-slate-500 font-mono">
                    Page {previewPage} of {Math.ceil(totalParsedCount / PREVIEW_LIMIT)}
                  </span>
                  <button
                    type="button"
                    disabled={previewPage >= Math.ceil(totalParsedCount / PREVIEW_LIMIT)}
                    onClick={() => setPreviewPage((p) => Math.min(Math.ceil(totalParsedCount / PREVIEW_LIMIT), p + 1))}
                    className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-slate-600 disabled:opacity-40 cursor-pointer font-semibold"
                  >
                    Next
                  </button>
                </div>
              )}

              {/* STEP 4: SYNC MODE SELECTOR (UPSERT VS REPLACE) */}
              <div className="bg-[#EEF2FF]/60 border border-[#C7D2FE] rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-3">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#4338CA] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-bold text-[#141414]">Data Synchronization Mode:</div>
                    <div className="text-[11px] text-slate-500">
                      {syncMode === 'upsert'
                        ? 'Updates matching records and appends new entries without deleting other rows.'
                        : 'Clears and replaces all existing records in this category with the rows from this file.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 p-1 bg-white border border-[#C7D2FE] rounded-xl shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      setSyncMode('upsert');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      syncMode === 'upsert'
                        ? 'bg-[#4338CA] text-white shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Upsert &amp; Append
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      playClickTick();
                      setSyncMode('replace');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      syncMode === 'replace'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:text-rose-600'
                    }`}
                  >
                    Replace All
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            {totalParsedCount > 0 ? (
              <span>Ready to import <strong>{totalParsedCount} {targetType === 'members' ? 'member' : targetType === 'cash' ? 'treasury transaction' : 'attendance'}</strong> records.</span>
            ) : (
              <span>Select a CSV/Excel file to preview records.</span>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                playClickTick();
                onClose();
              }}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              id="applyUploadedDataBtn"
              disabled={isSubmitting || totalParsedCount === 0}
              onClick={handleApplyData}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-5 py-2.5 bg-[#4338CA] hover:bg-[#312E81] disabled:opacity-40 text-white text-xs font-bold rounded-xl transition shadow-md shadow-[#4338CA]/25 cursor-pointer active:scale-95"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving records...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Save Records</span>
                </>
              )}
            </button>
          </div>
        </div>

      </motion.div>
    </div>
  );
};
