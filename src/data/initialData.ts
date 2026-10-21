import { Member, AttendanceRecord, CashTransaction, AssignmentSubmission } from '../types';

/**
 * ==============================================================================
 * DATA DUMMY / SIMULASI AMAN (SAFE REPOSITORY SEED)
 * ==============================================================================
 * PERHATIAN KEAMANAN & PRIVASI (UU PDP No. 27/2022):
 * Seluruh data di bawah ini adalah data simulasi fiktif / dummy yang aman
 * untuk diunggah ke repository publik (GitHub).
 * 
 * Data anggota asli HANYA dimasukkan saat runtime melalui fitur:
 * "Import Data (CSV/Excel)" oleh Administrator, dan disimpan langsung
 * ke pangkalan data Supabase atau penyimpanan lokal terisolasi pengguna.
 * ==============================================================================
 */

export const INITIAL_MEMBERS: Member[] = [
  {
    id_member: 101,
    timestamp: "01/08/2026 08:00:00",
    email: "pembina@man2kotabekasi.sch.id",
    fullName: "Drs. H. Ahmad Fauzi, M.Pd",
    grade: "Faculty",
    classRoom: "Advisor",
    gender: "Male",
    nisn: "197505121998031001",
    nik: "327501******1001",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0101",
    parentPhone: "-",
    status: "executive_board",
    role: "pembina",
    jabatan: "advisor",
    birthDate: "1975-05-12"
  },
  {
    id_member: 102,
    timestamp: "02/08/2026 09:15:00",
    email: "ketua@man2kotabekasi.sch.id",
    fullName: "Muhammad Rayhan Pratama",
    grade: "XII",
    classRoom: "A",
    gender: "Male",
    nisn: "0110000099",
    nik: "327501******1002",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0102",
    parentPhone: "0813-0000-0102",
    status: "executive_board",
    role: "admin",
    jabatan: "president",
    birthDate: "2008-06-14"
  },
  {
    id_member: 103,
    timestamp: "02/08/2026 09:30:00",
    email: "wakil@man2kotabekasi.sch.id",
    fullName: "Fikri Haikal",
    grade: "XII",
    classRoom: "B",
    gender: "Male",
    nisn: "0110000098",
    nik: "327501******1003",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0103",
    parentPhone: "0813-0000-0103",
    status: "executive_board",
    role: "admin",
    jabatan: "vice_president",
    birthDate: "2008-08-20"
  },
  {
    id_member: 1,
    timestamp: "06/08/2026 10:00:00",
    email: "siswa1@man2kotabekasi.sch.id",
    fullName: "Adinda Putri Rahmawati",
    grade: "X",
    classRoom: "A",
    gender: "Female",
    nisn: "0110000001",
    nik: "327501******0001",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0001",
    parentPhone: "0813-0000-0001",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2010-04-15"
  },
  {
    id_member: 2,
    timestamp: "06/08/2026 10:15:00",
    email: "siswa2@man2kotabekasi.sch.id",
    fullName: "Ahmad Pratama Nugraha",
    grade: "X",
    classRoom: "B",
    gender: "Male",
    nisn: "0110000002",
    nik: "327501******0002",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0002",
    parentPhone: "0813-0000-0002",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2010-07-22"
  },
  {
    id_member: 3,
    timestamp: "06/08/2026 10:30:00",
    email: "siswa3@man2kotabekasi.sch.id",
    fullName: "Bagas Aditya Saputra",
    grade: "XI",
    classRoom: "C",
    gender: "Male",
    nisn: "0110000003",
    nik: "327501******0003",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0003",
    parentPhone: "0813-0000-0003",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2009-03-10"
  },
  {
    id_member: 4,
    timestamp: "06/08/2026 10:45:00",
    email: "siswa4@man2kotabekasi.sch.id",
    fullName: "Cantika Dewi Anggraini",
    grade: "X",
    classRoom: "D",
    gender: "Female",
    nisn: "0110000004",
    nik: "327501******0004",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0004",
    parentPhone: "0813-0000-0004",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2010-09-18"
  },
  {
    id_member: 5,
    timestamp: "06/08/2026 11:00:00",
    email: "siswa5@man2kotabekasi.sch.id",
    fullName: "Dimas Arya Pangestu",
    grade: "XI",
    classRoom: "A",
    gender: "Male",
    nisn: "0110000005",
    nik: "327501******0005",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0005",
    parentPhone: "0813-0000-0005",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2009-11-05"
  },
  {
    id_member: 6,
    timestamp: "06/08/2026 11:15:00",
    email: "siswa6@man2kotabekasi.sch.id",
    fullName: "Farah Nabila Salsabila",
    grade: "XII",
    classRoom: "C",
    gender: "Female",
    nisn: "0110000006",
    nik: "327501******0006",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0006",
    parentPhone: "0813-0000-0006",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2008-05-30"
  },
  {
    id_member: 7,
    timestamp: "06/08/2026 11:30:00",
    email: "siswa7@man2kotabekasi.sch.id",
    fullName: "Gilang Ramadhan Santoso",
    grade: "XI",
    classRoom: "B",
    gender: "Male",
    nisn: "0110000007",
    nik: "327501******0007",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0007",
    parentPhone: "0813-0000-0007",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2009-08-14"
  },
  {
    id_member: 8,
    timestamp: "06/08/2026 11:45:00",
    email: "siswa8@man2kotabekasi.sch.id",
    fullName: "Hani Permata Sari",
    grade: "X",
    classRoom: "C",
    gender: "Female",
    nisn: "0110000008",
    nik: "327501******0008",
    address: "Kota Bekasi, Jawa Barat",
    personalPhone: "0812-0000-0008",
    parentPhone: "0813-0000-0008",
    status: "Aktif",
    role: "member",
    jabatan: "member",
    birthDate: "2010-12-02"
  }
];

// Presensi awal demo (sampel data simulasi)
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [
  {
    id: "att-demo-1",
    tanggal: "2026-08-15",
    nisn: "0110000001",
    namaAnggota: "Adinda Putri Rahmawati",
    status: "Hadir"
  },
  {
    id: "att-demo-2",
    tanggal: "2026-08-15",
    nisn: "0110000002",
    namaAnggota: "Ahmad Pratama Nugraha",
    status: "Hadir"
  },
  {
    id: "att-demo-3",
    tanggal: "2026-08-15",
    nisn: "0110000003",
    namaAnggota: "Bagas Aditya Saputra",
    status: "Izin"
  }
];

// Kas awal demo (sampel data simulasi)
export const INITIAL_CASH: CashTransaction[] = [
  {
    id: "kas-demo-1",
    tanggal: "2026-08-01",
    nisn: "-",
    namaAnggota: "Kas Awal Organisasi",
    jenis: "Masuk",
    jumlah: 1000000,
    keterangan: "Saldo awal kas ekstra kurikuler Robotik"
  },
  {
    id: "kas-demo-2",
    tanggal: "2026-08-15",
    nisn: "0110000001",
    namaAnggota: "Adinda Putri Rahmawati",
    jenis: "Masuk",
    jumlah: 25000,
    keterangan: "Iuran bulanan Agustus 2026"
  }
];

export const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Selamat Datang di Portal Robotik MAN 2 Kota Bekasi',
    content: 'Gunakan fitur "Import Data (CSV/Excel)" untuk mengunggah master data siswa secara aman ke database.',
    event_date: '2026-10-15T09:00:00.000Z',
    location: 'Lab Robotika MAN 2 Kota Bekasi',
    author_name: 'Administrator Robotik',
    created_at: new Date().toISOString(),
  }
];

export const INITIAL_ASSIGNMENTS = [
  {
    id: 'mat-1',
    title: 'Tugas 1: Pengenalan Mikrokontroler ESP32 & Wiring GPIO',
    description: 'Rancang skema diagram rangkaian sensor ultrasonik HC-SR04 dengan board ESP32 via Tinkercad atau simulasi Wokwi.',
    type: 'assignment' as const,
    deadline: '2026-10-25T23:59:00.000Z',
    attachment_url: 'https://docs.arduino.cc',
    grading_type: 'numeric' as const,
    max_score: 100,
    created_at: new Date().toISOString(),
  }
];

export const INITIAL_SUBMISSIONS: AssignmentSubmission[] = [];
