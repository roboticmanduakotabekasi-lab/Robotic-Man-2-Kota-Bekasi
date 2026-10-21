export type MemberStatus = 'Active' | 'Resigned' | 'Alumni' | 'executive_board' | 'Aktif' | 'Keluar';

export interface Member {
  id_member?: string | number;
  timestamp: string;
  email: string;
  fullName: string;
  grade: string; // 'X' | 'XI' | 'XII'
  classRoom: string; // 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I'
  gender: string; // 'Male' | 'Female' | 'Laki-laki' | 'Perempuan'
  nisn: string;
  nik: string;
  address: string;
  personalPhone: string;
  parentPhone: string;
  status?: MemberStatus | string;
  role?: string;
  full_name?: string;
  jabatan?: string; // president, vice_president, secretary, treasurer, pr, member
  kelas?: string;
  avatar?: string;
  birthDate?: string; // Tanggal lahir format YYYY-MM-DD atau DD/MM/YYYY
  birthPlace?: string; // Tempat lahir (opsional)
  isVerified?: boolean;
}

export type AttendanceStatus = 'Present' | 'Excused' | 'Sick' | 'Unexcused' | 'Hadir' | 'Izin' | 'Sakit' | 'Alpha';

export interface AttendanceRecord {
  id?: string;
  tanggal: string; // YYYY-MM-DD or DD/MM/YYYY
  nisn: string;
  id_member?: string | number;
  namaAnggota: string;
  nama_anggota?: string;
  status: AttendanceStatus;
  notes?: string;
}

export type TransactionType = 'Inflow' | 'Outflow' | 'Masuk' | 'Keluar';

export interface CashTransaction {
  id?: string;
  tanggal: string; // YYYY-MM-DD
  nisn?: string;
  id_member?: string | number;
  namaAnggota?: string;
  nama_anggota?: string;
  namaSiswa?: string;
  jenis: TransactionType;
  jumlah: number;
  keterangan: string;
}

export type MainTabType = 'dashboard' | 'members' | 'attendance' | 'cash' | 'calendar' | 'assignments';

export interface UserSession {
  username: string;
  name: string;
  role: string; // 'admin' | 'member' | label peran
  email?: string;
  token?: string; // Cryptographic session token for server authorization
  authProvider?: 'credentials' | 'google';
  avatarUrl?: string;
  loginTime: string;
  isDemo?: boolean;
  rememberMe?: boolean;
  userId?: string; // UUID from Supabase auth.users
  nis?: string;
  nisn?: string;
  birthDate?: string;
  isVerifiedMember?: boolean;
  bypassNisnVerification?: boolean;
  kelas?: string;
  noHp?: string;
  kontakDarurat?: string;
  membershipStatus?: 'aktif' | 'executive_board' | 'alumni' | 'keluar' | 'pending_approval' | string;
  jabatan?: 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'pr' | 'member' | string;
  isGoogleAuth?: boolean;
  pendingApproval?: boolean;
}

export interface AllowedMember {
  id: string;
  email: string;
  nama_lengkap: string;
  nis_atau_kelas: string;
  jabatan_ekskul: string; // 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'pr' | 'member'
  status_akun: 'unclaimed' | 'claimed';
  created_at?: string;
  claimed_at?: string;
}

export interface UserProfile {
  id: string; // Supabase auth.users id
  email: string;
  full_name: string;
  avatar_url?: string;
  nis: string;
  kelas: string;
  no_hp: string;
  kontak_darurat: string;
  status_keanggotaan: 'aktif' | 'executive_board' | 'alumni' | 'keluar' | 'pending_approval' | string;
  jabatan: 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'pr' | 'member' | string;
  role: 'member' | 'admin';
  created_at?: string;
  updated_at?: string;
}

export interface RegisteredUser {
  id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  membershipStatus?: string;
  jabatan?: string;
  source: 'profiles' | 'user_accounts' | 'both';
  authProvider?: 'credentials' | 'google';
  avatarUrl?: string;
  nis?: string;
  kelas?: string;
  createdAt?: string;
  lastLogin?: string;
  isExecutiveBoard: boolean;
  isAdmin: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  event_date?: string;
  location?: string;
  author_id?: string;
  author_name: string;
  author_role?: string;
  created_at: string;
  channel?: string; // 'announcements' | 'important' | 'workshops' | 'competitions'
  priority?: 'normal' | 'urgent' | 'highlight';
  pinned?: boolean;
  mention?: '@everyone' | '@members' | 'none';
  reactions?: Record<string, string[]>; // emoji -> array of usernames
  attachments?: string[];
  org_id?: string;
}

export interface MaterialAssignment {
  id: string;
  title: string;
  description: string;
  type: 'material' | 'assignment';
  deadline?: string;
  attachment_url?: string;
  attachment_name?: string;
  attachment_type?: 'link' | 'photo' | 'document';
  attachment_data?: string;
  allowed_submission_types?: ('link' | 'photo' | 'document')[];
  grading_type: 'numeric' | 'binary'; // numeric: 0-100, binary: Sudah/Belum Dinilai atau Lulus
  max_score?: number;
  created_by?: string;
  created_at: string;
}

export interface AssignmentSubmission {
  id: string;
  assignment_id: string;
  student_id: string;
  student_email: string;
  student_name: string;
  submission_text?: string;
  submission_link?: string;
  submission_type?: 'link' | 'photo' | 'document' | 'mixed';
  file_name?: string;
  file_size?: number; // bytes
  file_data?: string; // base64 data URL
  file_type?: string; // MIME type or extension like pdf, docx, image/png
  status: 'submitted' | 'graded';
  score_numeric?: number; // 0-100
  score_binary?: 'Lulus' | 'Perlu Perbaikan' | 'Belum Dinilai' | string;
  feedback?: string;
  submitted_at: string;
  graded_at?: string;
  graded_by?: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  category?: 'attendance' | 'cash' | 'member' | 'system' | 'assignment' | 'announcement';
  timestamp: string; // ISO string
  isRead: boolean;
  linkTab?: 'members' | 'attendance' | 'cash' | 'calendar' | 'assignments' | 'announcements' | 'staging';
}
