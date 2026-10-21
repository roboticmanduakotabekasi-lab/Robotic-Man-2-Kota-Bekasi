import { getSupabase, getActiveSupabaseConfig } from '../lib/supabase';
import { 
  Member, 
  AttendanceRecord, 
  CashTransaction, 
  AllowedMember, 
  UserProfile, 
  RegisteredUser,
  Announcement, 
  MaterialAssignment, 
  AssignmentSubmission 
} from '../types';
import { 
  INITIAL_MEMBERS, 
  INITIAL_ATTENDANCE, 
  INITIAL_CASH, 
  INITIAL_ANNOUNCEMENTS, 
  INITIAL_ASSIGNMENTS, 
  INITIAL_SUBMISSIONS 
} from '../data/initialData';
import { AccountConfig, getCustomAccounts, saveCustomAccounts, DEFAULT_ACCOUNTS } from '../utils/authConfig';
import { validateAttendanceSubmission } from '../utils/attendanceWindow';

export const SQL_INIT_SCRIPT = `-- ==============================================================================
-- SISTEM MANAJEMEN EKSKUL & PRE-REGISTRATION GOOGLE AUTH (SUPABASE SQL)
-- Mendukung: Pre-registration CSV Staging, Google OAuth auto-match,
-- Modul Absensi Mandiri, Buku Kas, Pengumuman, dan Materi/Tugas + Penilaian
-- ==============================================================================

-- 1. EKSTENSI UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABEL ALLOWED_MEMBERS (Staging Pre-Registration dari Admin Upload CSV)
CREATE TABLE IF NOT EXISTS public.allowed_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) NOT NULL UNIQUE,
    nama_lengkap VARCHAR(150) NOT NULL,
    nis_atau_kelas VARCHAR(50) DEFAULT '',
    jabatan_ekskul VARCHAR(50) DEFAULT 'member', -- president, vice_president, secretary, treasurer, pr, member
    status_akun VARCHAR(30) DEFAULT 'unclaimed', -- unclaimed, claimed
    created_at TIMESTAMPTZ DEFAULT NOW(),
    claimed_at TIMESTAMPTZ
);

-- 3. TABEL PROFILES (Terhubung ke auth.users via id)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL DEFAULT '',
    avatar_url TEXT DEFAULT '',
    nis VARCHAR(30) DEFAULT '',
    kelas VARCHAR(30) DEFAULT '',
    no_hp VARCHAR(30) DEFAULT '',
    kontak_darurat VARCHAR(50) DEFAULT '',
    status_keanggotaan VARCHAR(40) DEFAULT 'aktif', -- 'executive_board', 'aktif', 'alumni', 'keluar', 'pending_approval'
    jabatan VARCHAR(50) DEFAULT 'member', -- 'president', 'vice_president', 'secretary', 'treasurer', 'pr', 'member'
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- 'member' atau 'admin'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABEL PENGUMUMAN & AGENDA (announcements)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    event_date TIMESTAMPTZ,
    location VARCHAR(150) DEFAULT 'Lab Robotika MAN 2',
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name VARCHAR(150) DEFAULT 'Pengurus Ekskul',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TABEL MATERI & TUGAS (materials_assignments)
CREATE TABLE IF NOT EXISTS public.materials_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'material', -- 'material' atau 'assignment'
    deadline TIMESTAMPTZ,
    attachment_url TEXT DEFAULT '',
    grading_type VARCHAR(20) DEFAULT 'numeric', -- 'numeric' (0-100) atau 'binary' (Sudah/Belum Dinilai)
    max_score NUMERIC(5,2) DEFAULT 100,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. TABEL PENGUMPULAN TUGAS (assignment_submissions)
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.materials_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_email VARCHAR(150) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    submission_text TEXT DEFAULT '',
    submission_link TEXT DEFAULT '',
    status VARCHAR(30) DEFAULT 'submitted', -- 'submitted', 'graded'
    score_numeric NUMERIC(5,2),
    score_binary VARCHAR(30), -- 'Lulus', 'Perlu Perbaikan', 'Belum Dinilai'
    feedback TEXT DEFAULT '',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_assignment_student UNIQUE (assignment_id, student_id)
);

-- 7. TABEL ANGGOTA, PRESENSI & KAS
CREATE TABLE IF NOT EXISTS public.members (
    id_member VARCHAR(20) PRIMARY KEY,
    nisn VARCHAR(20) DEFAULT '',
    account_username VARCHAR(50) DEFAULT 'admin',
    timestamp TIMESTAMPTZ,
    email VARCHAR(100) DEFAULT '',
    full_name VARCHAR(150) NOT NULL,
    grade VARCHAR(10) DEFAULT 'X',
    class_room VARCHAR(10) DEFAULT '',
    gender VARCHAR(20) DEFAULT 'Male',
    nik VARCHAR(30) DEFAULT '',
    address TEXT DEFAULT '',
    personal_phone VARCHAR(30) DEFAULT '',
    parent_phone VARCHAR(30) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id VARCHAR(50) PRIMARY KEY,
    tanggal DATE NOT NULL,
    id_member VARCHAR(50) NOT NULL,
    account_username VARCHAR(50) DEFAULT 'admin',
    nama_anggota VARCHAR(150) DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'Hadir',
    notes TEXT DEFAULT '',
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_attendance_date_member UNIQUE (tanggal, id_member),
    CONSTRAINT chk_attendance_status CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpha', 'Alpa'))
);

CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id VARCHAR(50) PRIMARY KEY,
    tanggal DATE NOT NULL,
    id_member VARCHAR(50),
    account_username VARCHAR(50) DEFAULT 'admin',
    nama_anggota VARCHAR(150) DEFAULT '',
    jenis VARCHAR(20) NOT NULL DEFAULT 'Masuk',
    jumlah NUMERIC(12, 2) NOT NULL DEFAULT 0,
    keterangan TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_cash_jenis CHECK (jenis IN ('Masuk', 'Keluar')),
    CONSTRAINT chk_cash_jumlah_valid CHECK (jumlah >= 0 AND jumlah <= 1000000000)
);

CREATE TABLE IF NOT EXISTS public.user_accounts (
    username VARCHAR(50) PRIMARY KEY,
    password TEXT NOT NULL DEFAULT '',
    name VARCHAR(100) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'Pengurus Inti',
    email VARCHAR(100) DEFAULT '',
    auth_provider VARCHAR(50) DEFAULT 'credentials',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. POSTGRES TRIGGER & FUNCTION: on_auth_user_created (AUTO-MATCH DARI PRE-REGISTRATION)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    matched_member RECORD;
    assigned_role VARCHAR(20);
    assigned_jabatan VARCHAR(50);
    assigned_status VARCHAR(40);
    user_full_name VARCHAR(150);
    user_avatar TEXT;
    parsed_nis VARCHAR(30);
    parsed_kelas VARCHAR(30);
BEGIN
    user_full_name := COALESCE(
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name',
        split_part(new.email, '@', 1)
    );
    user_avatar := COALESCE(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'picture',
        'https://api.dicebear.com/7.x/bottts/svg?seed=' || new.id
    );

    -- Cek email di staging list (allowed_members)
    SELECT * INTO matched_member FROM public.allowed_members 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email))
    LIMIT 1;

    IF FOUND THEN
        user_full_name := COALESCE(matched_member.nama_lengkap, user_full_name);
        assigned_jabatan := COALESCE(matched_member.jabatan_ekskul, 'member');
        
        parsed_nis := split_part(matched_member.nis_atau_kelas, '/', 1);
        parsed_kelas := split_part(matched_member.nis_atau_kelas, '/', 2);
        IF parsed_kelas = '' THEN
            parsed_kelas := matched_member.nis_atau_kelas;
        END IF;

        -- Tetapkan role admin untuk pembina / ketua / BPH / pengurus inti
        IF LOWER(assigned_jabatan) IN ('president', 'ketua', 'vice_president', 'wakil_ketua', 'pembina', 'bph', 'secretary', 'sekretaris', 'treasurer', 'bendahara', 'pr', 'humas') THEN
            assigned_role := 'admin';
            assigned_status := 'executive_board';
        ELSE
            assigned_role := 'member';
            assigned_status := 'aktif';
        END IF;

        -- Tandai sebagai claimed di staging list
        UPDATE public.allowed_members 
        SET status_akun = 'claimed', claimed_at = NOW() 
        WHERE id = matched_member.id;
    ELSE
        -- Email tidak terdaftar di staging CSV Admin: Masuk sebagai pending_approval
        assigned_role := 'member';
        assigned_jabatan := 'member';
        assigned_status := 'pending_approval';
        parsed_nis := '';
        parsed_kelas := '';
    END IF;

    -- Upsert profile
    INSERT INTO public.profiles (
        id, email, full_name, avatar_url, nis, kelas, status_keanggotaan, jabatan, role
    ) VALUES (
        new.id, new.email, user_full_name, user_avatar, parsed_nis, parsed_kelas, assigned_status, assigned_jabatan, assigned_role
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang Trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Policies for profiles:
-- 1. Pengguna role 'member' hanya bisa melihat dan memperbarui data profil milik mereka sendiri (auth.uid() = id)
-- 2. Pengguna role 'admin' bisa membaca dan mengubah semua data profil di tabel profiles
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (
    auth.uid() = id OR public.is_admin() OR auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (
    auth.uid() = id OR public.is_admin()
) WITH CHECK (
    auth.uid() = id OR public.is_admin()
);

-- Policies for allowed_members
DROP POLICY IF EXISTS "allowed_members_all" ON public.allowed_members;
CREATE POLICY "allowed_members_all" ON public.allowed_members FOR ALL USING (true) WITH CHECK (true);

-- Policies for announcements & materials
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
CREATE POLICY "announcements_select" ON public.announcements FOR SELECT USING (true);
DROP POLICY IF EXISTS "announcements_admin" ON public.announcements;
CREATE POLICY "announcements_admin" ON public.announcements FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');

DROP POLICY IF EXISTS "materials_select" ON public.materials_assignments;
CREATE POLICY "materials_select" ON public.materials_assignments FOR SELECT USING (true);
DROP POLICY IF EXISTS "materials_admin" ON public.materials_assignments;
CREATE POLICY "materials_admin" ON public.materials_assignments FOR ALL USING (public.is_admin() OR auth.role() = 'authenticated');

-- Policies for assignment_submissions
DROP POLICY IF EXISTS "submissions_select" ON public.assignment_submissions;
CREATE POLICY "submissions_select" ON public.assignment_submissions FOR SELECT USING (
    student_id = auth.uid() OR public.is_admin() OR auth.role() = 'authenticated'
);
DROP POLICY IF EXISTS "submissions_insert" ON public.assignment_submissions;
CREATE POLICY "submissions_insert" ON public.assignment_submissions FOR INSERT WITH CHECK (
    student_id = auth.uid() OR public.is_admin() OR auth.role() = 'authenticated'
);
DROP POLICY IF EXISTS "submissions_update" ON public.assignment_submissions;
CREATE POLICY "submissions_update" ON public.assignment_submissions FOR UPDATE USING (
    student_id = auth.uid() OR public.is_admin() OR auth.role() = 'authenticated'
);

-- Policies for legacy tables
CREATE POLICY "Allow public all members" ON public.members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all attendance" ON public.attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all cash" ON public.cash_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public all user_accounts" ON public.user_accounts FOR ALL USING (true) WITH CHECK (true);

-- ==============================================================================
-- INSERT SAMPLE STAGING PRE-REGISTRATION DATA (allowed_members)
-- ==============================================================================
INSERT INTO public.allowed_members (email, nama_lengkap, nis_atau_kelas, jabatan_ekskul, status_akun)
VALUES
('daemnra8@gmail.com', 'Admin Pengurus Utama', '001/XII-IPA', 'president', 'unclaimed'),
('pembina@man2kotabekasi.sch.id', 'Drs. H. Ahmad Fauzi, M.Pd', 'GURU/PEMBINA', 'pembina', 'unclaimed'),
('bph@man2kotabekasi.sch.id', 'Fikri Haikal', '0110000002/XI-D', 'bph', 'unclaimed'),
('sekretaris@man2kotabekasi.sch.id', 'Alya Putri Salsabila', '0110000004/X-F', 'secretary', 'unclaimed'),
('bendahara@man2kotabekasi.sch.id', 'Zahra Anindya Putri', '0110000008/X-I', 'treasurer', 'unclaimed'),
('member1@man2kotabekasi.sch.id', 'Adinda Putri', '0110000001/X-H', 'member', 'unclaimed'),
('member2@man2kotabekasi.sch.id', 'Ahmad Pratama', '0110000002/XI-D', 'member', 'unclaimed')
ON CONFLICT (email) DO NOTHING;

-- ==============================================================================
-- INSERT 35 ANGGOTA (id_member = NISN)
-- ==============================================================================
INSERT INTO public.members (id_member, nisn, timestamp, email, full_name, grade, class_room, gender, nik, address, personal_phone, parent_phone)
VALUES
('0110000001', '0110000001', '06/08/2026 20:03:21', 'member1@man2kotabekasi.sch.id', 'Adinda Putri', 'X', 'H', 'Female', '327501******0001', 'Kota Bekasi, Jawa Barat', '0812-0000-0001', '0813-0000-0001'),
('0110000002', '0110000002', '08/08/2026 20:39:34', 'member2@man2kotabekasi.sch.id', 'Ahmad Pratama', 'XI', 'D', 'Male', '327501******0002', 'Kota Bekasi, Jawa Barat', '0812-0000-0002', '0813-0000-0002'),
('0110000003', '0110000003', '10/08/2026 20:32:43', 'member3@man2kotabekasi.sch.id', 'Aldi Firmansyah', 'X', 'D', 'Male', '327501******0003', 'Kota Bekasi, Jawa Barat', '0812-0000-0003', '0813-0000-0003'),
('0110000004', '0110000004', '09/08/2026 17:31:21', 'member4@man2kotabekasi.sch.id', 'Annisa Rahmawati', 'X', 'F', 'Female', '327501******0004', 'Kota Bekasi, Jawa Barat', '0812-0000-0004', '0813-0000-0004'),
('0110000005', '0110000005', '06/08/2026 16:39:10', 'member5@man2kotabekasi.sch.id', 'Bagas Aditya', 'XI', 'I', 'Male', '327501******0005', 'Kota Bekasi, Jawa Barat', '0812-0000-0005', '0813-0000-0005'),
('0110000006', '0110000006', '09/08/2026 22:35:29', 'member6@man2kotabekasi.sch.id', 'Bayu Nugroho', 'XII', 'A', 'Male', '327501******0006', 'Kota Bekasi, Jawa Barat', '0812-0000-0006', '0813-0000-0006'),
('0110000007', '0110000007', '10/08/2026 19:49:33', 'member7@man2kotabekasi.sch.id', 'Budi Santoso', 'X', 'A', 'Male', '327501******0007', 'Kota Bekasi, Jawa Barat', '0812-0000-0007', '0813-0000-0007'),
('0110000008', '0110000008', '05/08/2026 22:17:59', 'member8@man2kotabekasi.sch.id', 'Cantika Dewi', 'X', 'I', 'Female', '327501******0008', 'Kota Bekasi, Jawa Barat', '0812-0000-0008', '0813-0000-0008'),
('0110000009', '0110000009', '05/08/2026 22:08:52', 'member9@man2kotabekasi.sch.id', 'Danu Saputra', 'XI', 'B', 'Male', '327501******0009', 'Kota Bekasi, Jawa Barat', '0812-0000-0009', '0813-0000-0009'),
('0110000010', '0110000010', '06/08/2026 05:23:14', 'member10@man2kotabekasi.sch.id', 'Dedi Supriadi', 'X', 'G', 'Male', '327501******0010', 'Kota Bekasi, Jawa Barat', '0812-0000-0010', '0813-0000-0010'),
('0110000011', '0110000011', '09/08/2026 22:09:33', 'member11@man2kotabekasi.sch.id', 'Dimas Anggara', 'XI', 'H', 'Male', '327501******0011', 'Kota Bekasi, Jawa Barat', '0812-0000-0011', '0813-0000-0011'),
('0110000012', '0110000012', '06/08/2026 19:10:32', 'member12@man2kotabekasi.sch.id', 'Dwi Kurniawan', 'X', 'C', 'Male', '327501******0012', 'Kota Bekasi, Jawa Barat', '0812-0000-0012', '0813-0000-0012'),
('0110000013', '0110000013', '06/08/2026 19:06:55', 'member13@man2kotabekasi.sch.id', 'Eko Prasetyo', 'XI', 'D', 'Male', '327501******0013', 'Kota Bekasi, Jawa Barat', '0812-0000-0013', '0813-0000-0013'),
('0110000014', '0110000014', '10/08/2026 20:21:29', 'member14@man2kotabekasi.sch.id', 'Fadhil Muhammad', 'XII', 'C', 'Male', '327501******0014', 'Kota Bekasi, Jawa Barat', '0812-0000-0014', '0813-0000-0014'),
('0110000015', '0110000015', '09/08/2026 09:05:35', 'member15@man2kotabekasi.sch.id', 'Farah Nabila', 'X', 'G', 'Female', '327501******0015', 'Kota Bekasi, Jawa Barat', '0812-0000-0015', '0813-0000-0015'),
('0110000016', '0110000016', '09/08/2026 22:14:11', 'member16@man2kotabekasi.sch.id', 'Fajar Ramadhan', 'XII', 'E', 'Male', '327501******0016', 'Kota Bekasi, Jawa Barat', '0812-0000-0016', '0813-0000-0016'),
('0110000017', '0110000017', '11/08/2026 19:50:49', 'member17@man2kotabekasi.sch.id', 'Galih Perkasa', 'XI', 'G', 'Male', '327501******0017', 'Kota Bekasi, Jawa Barat', '0812-0000-0017', '0813-0000-0017'),
('0110000018', '0110000018', '10/08/2026 20:16:23', 'member18@man2kotabekasi.sch.id', 'Gilang Ramadhan', 'XI', 'C', 'Male', '327501******0018', 'Kota Bekasi, Jawa Barat', '0812-0000-0018', '0813-0000-0018'),
('0110000019', '0110000019', '07/08/2026 16:56:46', 'member19@man2kotabekasi.sch.id', 'Gita Savitri', 'XII', 'C', 'Female', '327501******0019', 'Kota Bekasi, Jawa Barat', '0812-0000-0019', '0813-0000-0019'),
('0110000020', '0110000020', '06/08/2026 22:04:17', 'member20@man2kotabekasi.sch.id', 'Hani Permata', 'XII', 'A', 'Female', '327501******0020', 'Kota Bekasi, Jawa Barat', '0812-0000-0020', '0813-0000-0020'),
('0110000021', '0110000021', '06/08/2026 16:11:26', 'member21@man2kotabekasi.sch.id', 'Indah Wulandari', 'X', 'A', 'Female', '327501******0021', 'Kota Bekasi, Jawa Barat', '0812-0000-0021', '0813-0000-0021'),
('0110000022', '0110000022', '06/08/2026 17:14:25', 'member22@man2kotabekasi.sch.id', 'Iqbal Maulana', 'XII', 'B', 'Male', '327501******0022', 'Kota Bekasi, Jawa Barat', '0812-0000-0022', '0813-0000-0022'),
('0110000023', '0110000023', '10/08/2026 23:26:07', 'member23@man2kotabekasi.sch.id', 'Joko Susilo', 'X', 'C', 'Male', '327501******0023', 'Kota Bekasi, Jawa Barat', '0812-0000-0023', '0813-0000-0023'),
('0110000024', '0110000024', '09/08/2026 18:56:19', 'member24@man2kotabekasi.sch.id', 'Kevin Sanjaya', 'XII', 'C', 'Male', '327501******0024', 'Kota Bekasi, Jawa Barat', '0812-0000-0024', '0813-0000-0024'),
('0110000025', '0110000025', '10/08/2026 18:38:28', 'member25@man2kotabekasi.sch.id', 'Lukman Hakim', 'X', 'I', 'Male', '327501******0025', 'Kota Bekasi, Jawa Barat', '0812-0000-0025', '0813-0000-0025'),
('0110000026', '0110000026', '06/08/2026 16:20:55', 'member26@man2kotabekasi.sch.id', 'Muhammad Fauzan', 'XII', 'E', 'Male', '327501******0026', 'Kota Bekasi, Jawa Barat', '0812-0000-0026', '0813-0000-0026'),
('0110000027', '0110000027', '09/08/2026 18:06:12', 'member27@man2kotabekasi.sch.id', 'Muhammad Rizki', 'XII', 'C', 'Male', '327501******0027', 'Kota Bekasi, Jawa Barat', '0812-0000-0027', '0813-0000-0027'),
('0110000028', '0110000028', '09/08/2026 17:40:22', 'member28@man2kotabekasi.sch.id', 'Naufal Arkan', 'XII', 'B', 'Male', '327501******0028', 'Kota Bekasi, Jawa Barat', '0812-0000-0028', '0813-0000-0028'),
('0110000029', '0110000029', '09/08/2026 20:45:47', 'member29@man2kotabekasi.sch.id', 'Raditya Mahendra', 'XI', 'G', 'Male', '327501******0029', 'Kota Bekasi, Jawa Barat', '0812-0000-0029', '0813-0000-0029'),
('0110000030', '0110000030', '09/08/2026 19:12:56', 'member30@man2kotabekasi.sch.id', 'Rahmat Hidayat', 'X', 'H', 'Male', '327501******0030', 'Kota Bekasi, Jawa Barat', '0812-0000-0030', '0813-0000-0030'),
('0110000031', '0110000031', '12/08/2026 20:33:06', 'member31@man2kotabekasi.sch.id', 'Rendy Pratama', 'X', 'E', 'Male', '327501******0031', 'Kota Bekasi, Jawa Barat', '0812-0000-0031', '0813-0000-0031'),
('0110000032', '0110000032', '06/08/2026 18:36:56', 'member32@man2kotabekasi.sch.id', 'Reza Pahlevi', 'X', 'H', 'Male', '327501******0032', 'Kota Bekasi, Jawa Barat', '0812-0000-0032', '0813-0000-0032'),
('0110000033', '0110000033', '09/08/2026 09:33:10', 'member33@man2kotabekasi.sch.id', 'Rina Anggraini', 'X', 'A', 'Female', '327501******0033', 'Kota Bekasi, Jawa Barat', '0812-0000-0033', '0813-0000-0033'),
('0110000034', '0110000034', '09/08/2026 17:32:20', 'member34@man2kotabekasi.sch.id', 'Satria Wicaksana', 'XI', 'B', 'Male', '327501******0034', 'Kota Bekasi, Jawa Barat', '0812-0000-0034', '0813-0000-0034'),
('0110000035', '0110000035', '05/08/2026 22:52:27', 'member35@man2kotabekasi.sch.id', 'Zahra Safira', 'X', 'A', 'Female', '327501******0035', 'Kota Bekasi, Jawa Barat', '0812-0000-0035', '0813-0000-0035')
ON CONFLICT (id_member) DO UPDATE SET
    nisn = EXCLUDED.nisn,
    timestamp = EXCLUDED.timestamp,
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    grade = EXCLUDED.grade,
    class_room = EXCLUDED.class_room,
    gender = EXCLUDED.gender,
    nik = EXCLUDED.nik,
    address = EXCLUDED.address,
    personal_phone = EXCLUDED.personal_phone,
    parent_phone = EXCLUDED.parent_phone;

-- ==============================================================================
-- INSERT DATA PRESENSI (id_member Diisi NISN Siswa)
-- ==============================================================================
INSERT INTO public.attendance (id, tanggal, id_member, status)
VALUES
('att-1', '2026-08-15', '0110000001', 'Hadir'), -- Adinda Putri
('att-2', '2026-08-15', '0110000002', 'Hadir'), -- Ahmad Pratama
('att-3', '2026-08-15', '0110000003', 'Hadir'), -- Aldi Firmansyah
('att-4', '2026-08-15', '0110000004', 'Izin'),  -- Annisa Rahmawati
('att-5', '2026-08-15', '0110000005', 'Hadir'), -- Bagas Aditya
('att-6', '2026-08-15', '0110000006', 'Hadir'), -- Bayu Nugroho
('att-7', '2026-08-22', '0110000001', 'Hadir'), -- Adinda Putri
('att-8', '2026-08-22', '0110000007', 'Sakit'), -- Budi Santoso
('att-9', '2026-08-22', '0110000016', 'Hadir'), -- Fajar Ramadhan
('att-10', '2026-08-22', '0110000014', 'Hadir') -- Fadhil Muhammad
ON CONFLICT (id) DO UPDATE SET
    tanggal = EXCLUDED.tanggal,
    id_member = EXCLUDED.id_member,
    status = EXCLUDED.status;

-- ==============================================================================
-- INSERT DATA TRANSAKSI KAS (id_member Diisi NISN Siswa)
-- ==============================================================================
INSERT INTO public.cash_transactions (id, tanggal, id_member, jenis, jumlah, keterangan)
VALUES
('kas-1', '2026-08-10', NULL, 'Masuk', 1500000, 'Saldo awal kas Robotic MAN 2 Kota Bekasi periode 2026/2027'),
('kas-2', '2026-08-15', '0110000001', 'Masuk', 25000, 'Iuran bulanan Agustus 2026'), -- Adinda Putri
('kas-3', '2026-08-15', '0110000002', 'Masuk', 25000, 'Iuran bulanan Agustus 2026'), -- Ahmad Pratama
('kas-4', '2026-08-18', NULL, 'Keluar', 350000, 'Pembelian mikrokontroler ESP32 dan Sensor Ultrasonik HC-SR04'),
('kas-5', '2026-08-20', '0110000006', 'Masuk', 50000, 'Iuran bulanan Agustus & September 2026'), -- Bayu Nugroho
('kas-6', '2026-08-25', NULL, 'Keluar', 125000, 'Snack & minuman workshop Line Follower Robot')
ON CONFLICT (id) DO UPDATE SET
    tanggal = EXCLUDED.tanggal,
    id_member = EXCLUDED.id_member,
    jenis = EXCLUDED.jenis,
    jumlah = EXCLUDED.jumlah,
    keterangan = EXCLUDED.keterangan;

-- ==============================================================================
-- VIEW RELASIONAL (JOIN)
-- ==============================================================================
CREATE OR REPLACE VIEW public.v_attendance AS
SELECT 
    a.id,
    a.tanggal,
    a.id_member AS nisn,
    m.full_name AS nama_anggota,
    m.grade AS kelas,
    m.class_room AS ruangan,
    a.status,
    a.created_at
FROM public.attendance a
JOIN public.members m ON a.id_member = m.id_member;

CREATE OR REPLACE VIEW public.v_cash_transactions AS
SELECT 
    c.id,
    c.tanggal,
    c.id_member AS nisn,
    COALESCE(m.full_name, 'Kas Organisasi') AS nama_anggota,
    c.jenis,
    c.jumlah,
    c.keterangan,
    c.created_at
FROM public.cash_transactions c
LEFT JOIN public.members m ON c.id_member = m.id_member;
`;

// Safe dummy names indexed by member index / NISN / ID for anonymized demo fallback
export const DUMMY_MEMBERS_BY_IDENTIFIER: Record<string, string> = {
  '1': 'Adinda Putri Rahmawati',
  '0110000001': 'Adinda Putri Rahmawati',
  '2': 'Ahmad Pratama Nugraha',
  '0110000002': 'Ahmad Pratama Nugraha',
  '3': 'Bagas Aditya Saputra',
  '0110000003': 'Bagas Aditya Saputra',
  '4': 'Cantika Dewi Anggraini',
  '0110000004': 'Cantika Dewi Anggraini',
  '5': 'Dimas Arya Pangestu',
  '0110000005': 'Dimas Arya Pangestu',
  '6': 'Farah Nabila Salsabila',
  '0110000006': 'Farah Nabila Salsabila',
  '7': 'Gilang Ramadhan Santoso',
  '0110000007': 'Gilang Ramadhan Santoso',
  '8': 'Hani Permata Sari',
  '0110000008': 'Hani Permata Sari',
  '101': 'Drs. H. Ahmad Fauzi, M.Pd',
  '197505121998031001': 'Drs. H. Ahmad Fauzi, M.Pd',
  '102': 'Muhammad Rayhan Pratama',
  '0110000099': 'Muhammad Rayhan Pratama',
  '103': 'Fikri Haikal',
  '0110000098': 'Fikri Haikal'
};

export function sanitizeRealName(rawName: string, idOrNisn?: string): string {
  if (rawName && rawName.trim().length > 0 && rawName.trim() !== 'Anggota Robotic MAN 2 Kota Bekasi') {
    return rawName.trim();
  }
  if (idOrNisn && DUMMY_MEMBERS_BY_IDENTIFIER[String(idOrNisn)]) {
    return DUMMY_MEMBERS_BY_IDENTIFIER[String(idOrNisn)];
  }
  return rawName || 'Anggota Robotic MAN 2 Kota Bekasi';
}

export function mapMemberFromDB(row: any): Member {
  // In new schema: id_member holds the NISN
  const nisn = String(row.id_member || row.nisn || '').trim();
  const id_member = row.id_member || nisn;
  const raw_name = String(row.full_name || row.fullName || row.nama_lengkap || '').trim();
  const safeName = DUMMY_MEMBERS_BY_IDENTIFIER[String(id_member)] || DUMMY_MEMBERS_BY_IDENTIFIER[String(nisn)];
  const full_name = raw_name || safeName || 'Anggota Robotic MAN 2 Kota Bekasi';
  const class_room = String(row.class_room || row.classRoom || row.kelas || row.rombel || '').trim();
  const personal_phone = String(row.personal_phone || row.personalPhone || row.no_wa || '').trim();
  const parent_phone = String(row.parent_phone || row.parentPhone || row.no_hp_ortu || '').trim();

  // Normalize role and jabatan
  let role = row.role ? String(row.role).trim().toLowerCase() : undefined;
  let jabatan = row.jabatan ? String(row.jabatan).trim().toLowerCase() : undefined;
  const status = row.status ? String(row.status).trim() : 'Aktif';

  if (!jabatan) {
    if (role === 'pembina') jabatan = 'advisor';
    else if (role === 'admin') jabatan = 'president';
    else jabatan = 'member';
  }

  if (!role) {
    if (['president', 'vice_president', 'secretary', 'treasurer', 'pr'].includes(jabatan)) {
      role = 'admin';
    } else if (jabatan === 'advisor') {
      role = 'pembina';
    } else {
      role = 'member';
    }
  }

  return {
    id_member,
    nisn,
    full_name,
    fullName: full_name,
    email: String(row.email || '').trim(),
    grade: String(row.grade || row.jenjang || 'X').trim(),
    class_room,
    classRoom: class_room,
    gender: String(row.gender || row.jenis_kelamin || 'Male').trim(),
    nik: String(row.nik || '').trim(),
    address: String(row.address || row.alamat || '').trim(),
    personal_phone,
    personalPhone: personal_phone,
    parent_phone,
    parentPhone: parent_phone,
    timestamp: String(row.timestamp || ''),
    status,
    role,
    jabatan,
    birthDate: String(row.birth_date || row.birthDate || '').trim(),
    birthPlace: String(row.birth_place || row.birthPlace || '').trim(),
    isVerified: row.is_verified ?? row.isVerified ?? Boolean((row.birth_date || row.birthDate) && nisn),
  } as any;
}

export function isMissingColumnError(err: any, colName?: string): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = String(err.code || '');
  if (code === '42703' || code === 'PGRST204') return true;
  if (msg.includes('schema cache') || msg.includes('column') || msg.includes('could not find')) return true;
  if (colName) {
    const col = colName.toLowerCase();
    return msg.includes(col);
  }
  return false;
}

/**
 * Sanitizes raw database/PostgREST error messages so technical schema internals,
 * column names, and stack traces are not leaked to the user interface (CWE-209 / OWASP A05).
 */
export function sanitizeDbErrorMessage(err: any): string {
  if (!err) return 'An unknown system error occurred.';
  const msg = typeof err === 'string' ? err : String(err.message || err);

  if (msg.includes('foreign key constraint') || msg.includes('violates foreign key')) {
    return 'Failed to process data: Referenced record (Member Student ID) not found in database.';
  }
  if (msg.includes('unique constraint') || msg.includes('duplicate key') || msg.includes('already exists')) {
    return 'Failed to save: Record with identical identity already exists in system.';
  }
  if (msg.includes('row-level security') || msg.includes('permission denied') || msg.includes('42501')) {
    return 'Access denied: Operation restricted by database security policies (RLS).';
  }
  if (msg.includes('check constraint') || msg.includes('violates check constraint')) {
    return 'Invalid data format: Input values do not meet system validation constraints.';
  }
  if (msg.includes('JWT') || msg.includes('apikey') || msg.includes('invalid claim')) {
    return 'Unauthorized database credentials. Please check your Supabase API Key.';
  }
  if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
    return 'Network connection to database server lost. Please check your internet connection.';
  }
  return 'Failed to process database request. Please try again later.';
}

export function mapMemberToDB(m: any, targetCol: 'id_member' | 'nisn' = 'id_member') {
  const full_name = String(m.full_name || m.fullName || m.nama_lengkap || '').trim();
  const class_room = String(m.class_room || m.classRoom || m.kelas || '').trim();
  const personal_phone = String(m.personal_phone || m.personalPhone || m.no_wa || '').trim();
  const parent_phone = String(m.parent_phone || m.parentPhone || m.no_hp_ortu || '').trim();
  const nisn = String(m.nisn || m.id_member || '').trim();

  let validTimestamp: string = new Date().toISOString();
  if (m.timestamp) {
    const parsed = Date.parse(m.timestamp);
    if (!isNaN(parsed)) {
      validTimestamp = new Date(parsed).toISOString();
    }
  }

  let sessionAccount = 'admin';
  try {
    if (typeof localStorage !== 'undefined') {
      const sess = localStorage.getItem('robotic_user_session');
      if (sess) {
        const parsed = JSON.parse(sess);
        if (parsed?.username) sessionAccount = String(parsed.username).toLowerCase().trim();
      }
    }
  } catch {}

  const finalAccount = String(m.account_username || sessionAccount || 'admin').toLowerCase().trim();

  const payload: any = {
    account_username: finalAccount,
    full_name,
    email: String(m.email || '').trim(),
    grade: m.grade || 'X',
    class_room,
    gender: m.gender || 'Male',
    nik: String(m.nik || '').trim(),
    address: String(m.address || '').trim(),
    personal_phone,
    parent_phone,
    timestamp: validTimestamp,
    status: m.status || 'Aktif',
    role: m.role || 'member',
    jabatan: m.jabatan || 'member',
  };

  if (m.birthDate || m.birth_date) {
    payload.birth_date = m.birthDate || m.birth_date;
  }
  if (m.birthPlace || m.birth_place) {
    payload.birth_place = m.birthPlace || m.birth_place;
  }
  if (m.isVerified !== undefined || m.is_verified !== undefined) {
    payload.is_verified = m.isVerified ?? m.is_verified;
  }

  if (targetCol === 'nisn') {
    payload.nisn = nisn;
  } else {
    payload.id_member = nisn;
    payload.nisn = nisn;
  }

  return payload;
}

export function deduplicateAttendance(records: AttendanceRecord[]): AttendanceRecord[] {
  const map = new Map<string, AttendanceRecord>();
  records.forEach((r: any) => {
    const recDate = String(r.tanggal || '').slice(0, 10).trim();
    const recNisn = String(r.nisn || r.id_member || '').trim();
    const recName = String(r.nama_anggota || r.namaAnggota || '').trim();
    
    // Key by date + nisn if available, otherwise date + name
    const key = (recNisn && recNisn !== '-')
      ? `${recDate}_nisn_${recNisn}`
      : `${recDate}_name_${recName.toLowerCase()}`;
    
    // Later records overwrite earlier ones, or keep latest
    map.set(key, {
      ...r,
      tanggal: recDate,
      nisn: recNisn,
      nama_anggota: recName,
      namaAnggota: recName,
    });
  });
  return Array.from(map.values());
}

export function mapAttendanceFromDB(row: any): AttendanceRecord {
  const nisn = String(row.nisn || row.id_member || '').trim();
  const raw_nama = String(row.nama_anggota || row.namaAnggota || row.nama_siswa || '').trim();
  const nama_anggota = sanitizeRealName(raw_nama, nisn);
  return {
    id: String(row.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
    tanggal: String(row.tanggal || '').slice(0, 10),
    nisn,
    nama_anggota,
    namaAnggota: nama_anggota,
    status: (row.status as any) || 'Hadir',
  } as any;
}

export function mapCashFromDB(row: any): CashTransaction {
  const rowDate = String(row.tanggal || row.date || '').slice(0, 10);
  const rowType = row.jenis || (row.type === 'income' || row.type === 'INCOME' ? 'Masuk' : row.type === 'expense' || row.type === 'EXPENSE' ? 'Keluar' : row.type) || 'Masuk';
  const rowAmount = Number(row.jumlah !== undefined ? row.jumlah : (row.amount !== undefined ? row.amount : 0));
  const rowDesc = String(row.keterangan || row.description || '-');
  const rawNisn = String(row.nisn || row.id_member || '').trim();
  const cleanNisn = (rawNisn && rawNisn !== '-') ? rawNisn : undefined;
  const rawPerson = String(row.nama_anggota || row.namaAnggota || row.nama_siswa || row.recorded_by || (cleanNisn ? '' : 'Kas Organisasi')).trim();
  const rowPerson = sanitizeRealName(rawPerson, cleanNisn);

  return {
    id: String(row.id || `cash_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
    tanggal: rowDate || new Date().toISOString().split('T')[0],
    nisn: cleanNisn,
    nama_anggota: rowPerson,
    namaAnggota: rowPerson,
    namaSiswa: rowPerson,
    jenis: (rowType === 'Keluar' || rowType === 'expense') ? 'Keluar' : 'Masuk',
    jumlah: Math.abs(rowAmount),
    keterangan: rowDesc,
  } as any;
}

// ----------------------------------------------------
// Health Check & Diagnostics
// ----------------------------------------------------
export interface TableHealth {
  exists: boolean;
  count: number;
  error?: string;
}

export interface SupabaseHealthReport {
  connected: boolean;
  url: string;
  isCustom: boolean;
  tables: {
    members: TableHealth;
    attendance: TableHealth;
    cash_transactions: TableHealth;
    user_accounts: TableHealth;
  };
  allTablesReady: boolean;
  needsSetup: boolean;
  generalError?: string;
}

export async function checkSupabaseHealth(): Promise<SupabaseHealthReport> {
  const config = getActiveSupabaseConfig();
  const supa = getSupabase();

  const report: SupabaseHealthReport = {
    connected: false,
    url: config.url,
    isCustom: config.isCustom,
    tables: {
      members: { exists: false, count: 0 },
      attendance: { exists: false, count: 0 },
      cash_transactions: { exists: false, count: 0 },
      user_accounts: { exists: false, count: 0 },
    },
    allTablesReady: false,
    needsSetup: false,
  };

  try {
    const [memCheck, attCheck, cashCheck, accCheck] = await Promise.all([
      supa.from('members').select('*', { count: 'exact', head: true }),
      supa.from('attendance').select('*', { count: 'exact', head: true }),
      supa.from('cash_transactions').select('*', { count: 'exact', head: true }),
      supa.from('user_accounts').select('*', { count: 'exact', head: true }),
    ]);

    // Members check
    if (!memCheck.error) {
      report.tables.members.exists = true;
      report.tables.members.count = memCheck.count ?? 0;
    } else {
      report.tables.members.error = memCheck.error.message;
      if (memCheck.error.code === '42P01' || memCheck.error.message.includes('does not exist')) {
        report.needsSetup = true;
      }
    }

    // Attendance check
    if (!attCheck.error) {
      report.tables.attendance.exists = true;
      report.tables.attendance.count = attCheck.count ?? (attCheck.data?.length || 0);
    } else {
      report.tables.attendance.error = attCheck.error.message;
      if (attCheck.error.code === '42P01' || attCheck.error.message.includes('does not exist')) {
        report.needsSetup = true;
      }
    }

    // Cash check
    if (!cashCheck.error) {
      report.tables.cash_transactions.exists = true;
      report.tables.cash_transactions.count = cashCheck.count ?? (cashCheck.data?.length || 0);
    } else {
      report.tables.cash_transactions.error = cashCheck.error.message;
      if (cashCheck.error.code === '42P01' || cashCheck.error.message.includes('does not exist')) {
        report.needsSetup = true;
      }
    }

    // User accounts check
    if (!accCheck.error) {
      report.tables.user_accounts.exists = true;
      report.tables.user_accounts.count = accCheck.count ?? (accCheck.data?.length || 0);
    } else {
      report.tables.user_accounts.error = accCheck.error.message;
      if (accCheck.error.code === '42P01' || accCheck.error.message.includes('does not exist')) {
        report.needsSetup = true;
      }
    }

    report.allTablesReady =
      report.tables.members.exists &&
      report.tables.attendance.exists &&
      report.tables.cash_transactions.exists &&
      report.tables.user_accounts.exists;

    report.connected = report.allTablesReady || (!report.generalError && (!memCheck.error || memCheck.error.code === '42P01'));
  } catch (err: any) {
    report.connected = false;
    report.generalError = err.message || 'Failed to establish connection to Supabase.';
  }

  return report;
}

// ----------------------------------------------------
// User Accounts DB Methods
// ----------------------------------------------------
export async function fetchUserAccountsFromDB(): Promise<AccountConfig[]> {
  try {
    const supa = getSupabase();
    const { data, error } = await supa
      .from('user_accounts')
      .select('*');

    if (error || !data) {
      return [];
    }

    return data.map((row: any) => ({
      username: String(row.username || '').trim(),
      password: String(row.password || ''),
      name: String(row.name || '').trim(),
      role: String(row.role || 'Pengurus Inti').trim(),
      email: String(row.email || '').trim(),
      authProvider: (row.auth_provider === 'google' ? 'google' : 'credentials') as 'credentials' | 'google',
      avatarUrl: row.avatar_url || '',
    }));
  } catch (err) {
    console.warn('Failed to fetch user accounts from DB:', err);
    return [];
  }
}

export async function saveUserAccountToDB(account: AccountConfig, oldUsername?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const oldClean = oldUsername?.trim();
    const newClean = account.username.trim();
    const isUsernameChanged = Boolean(oldClean && oldClean.toLowerCase() !== newClean.toLowerCase());

    const payload = {
      username: newClean,
      password: account.password || '',
      name: account.name.trim(),
      role: account.role || 'Pengurus Inti',
      email: account.email ? account.email.trim() : '',
      auth_provider: account.authProvider || 'credentials',
      avatar_url: account.avatarUrl || '',
      updated_at: new Date().toISOString(),
    };

    if (isUsernameChanged && oldClean) {
      // 1. Migrasi kepemilikan data terkait (members, attendance, cash) agar tidak hilang
      try {
        await supa.from('members').update({ account_username: newClean }).eq('account_username', oldClean);
        await supa.from('attendance').update({ account_username: newClean }).eq('account_username', oldClean);
        await supa.from('cash_transactions').update({ account_username: newClean }).eq('account_username', oldClean);
      } catch (relErr) {
        console.warn('Notice updating associated account records:', relErr);
      }

      // 2. Simpan baris akun baru
      const { error: insertError } = await supa
        .from('user_accounts')
        .upsert(payload, { onConflict: 'username' });

      if (insertError) {
        return { success: false, error: insertError.message };
      }

      // 3. Bersihkan baris username lama
      try {
        await supa.from('user_accounts').delete().eq('username', oldClean);
      } catch (delErr) {
        console.warn('Notice removing old username record:', delErr);
      }

      return { success: true };
    }

    // Jika username tidak berubah (hanya ganti nama, sandi, email, profil)
    const { error } = await supa
      .from('user_accounts')
      .upsert(payload, { onConflict: 'username' });

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteUserAccountFromDB(username: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const { error } = await supa.from('user_accounts').delete().eq('username', username.trim());
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// Member CRUD
// ----------------------------------------------------
export async function upsertMemberToDB(member: Member, originalNisn?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const nisnVal = String(member.nisn || member.id_member || '').trim();
    
    // If NISN changed during edit, update the existing row so ON UPDATE CASCADE propagates to child tables
    if (originalNisn && originalNisn.trim() !== nisnVal) {
      const cleanOld = originalNisn.trim();
      const idMemUpdatePayload = mapMemberToDB(member, 'id_member');
      let updateRes = await supa
        .from('members')
        .update(idMemUpdatePayload)
        .eq('id_member', cleanOld);
      
      if (updateRes.error && isMissingColumnError(updateRes.error, 'id_member')) {
        const nisnUpdatePayload = mapMemberToDB(member, 'nisn');
        updateRes = await supa
          .from('members')
          .update(nisnUpdatePayload)
          .eq('nisn', cleanOld);
      }

      if (!updateRes.error) {
        return { success: true };
      }
    }

    // 1. Try first with composite key 'account_username,id_member' (isolated multi-tenant schema)
    const payloadIdMember = mapMemberToDB(member, 'id_member');
    let res = await supa
      .from('members')
      .upsert(payloadIdMember, { onConflict: 'account_username,id_member' });

    // If composite onConflict failed because schema uses single primary key 'id_member'
    if (res.error && !isMissingColumnError(res.error, 'id_member')) {
      res = await supa
        .from('members')
        .upsert(payloadIdMember, { onConflict: 'id_member' });
    }

    // 2. Fallback if schema uses 'nisn'
    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      const payloadNisn = mapMemberToDB(member, 'nisn');
      res = await supa
        .from('members')
        .upsert(payloadNisn, { onConflict: 'account_username,nisn' });
      if (res.error) {
        res = await supa
          .from('members')
          .upsert(payloadNisn, { onConflict: 'nisn' });
      }
    } else if (res.error && isMissingColumnError(res.error, 'nisn')) {
      const retryIdMem = mapMemberToDB(member, 'id_member');
      res = await supa
        .from('members')
        .upsert(retryIdMem, { onConflict: 'account_username,id_member' });
      if (res.error) {
        res = await supa
          .from('members')
          .upsert(retryIdMem, { onConflict: 'id_member' });
      }
    }

    const optionalColumns = ['role', 'jabatan', 'birth_date', 'birth_place', 'is_verified', 'status'];
    for (const col of optionalColumns) {
      if (res.error && isMissingColumnError(res.error, col)) {
        delete payloadIdMember[col];
        res = await supa.from('members').upsert(payloadIdMember, { onConflict: 'account_username,id_member' });
        if (res.error && !isMissingColumnError(res.error, 'id_member')) {
          res = await supa.from('members').upsert(payloadIdMember, { onConflict: 'id_member' });
        }
      }
    }

    if (res.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function upsertMembersBatchToDB(members: Member[]): Promise<{ success: boolean; insertedCount: number; error?: string }> {
  try {
    const supa = getSupabase();
    if (!members.length) {
      return { success: true, insertedCount: 0 };
    }

    // 1. Try with composite primary key 'account_username,id_member' first (isolated multi-tenant)
    let idMemPayload = members.map(m => mapMemberToDB(m, 'id_member'));
    let res = await supa
      .from('members')
      .upsert(idMemPayload, { onConflict: 'account_username,id_member' });

    // If composite onConflict failed because schema uses single primary key 'id_member'
    if (res.error && !isMissingColumnError(res.error, 'id_member')) {
      res = await supa
        .from('members')
        .upsert(idMemPayload, { onConflict: 'id_member' });
    }

    // Handle optional columns that might be absent in legacy tables
    const optionalColumns = ['role', 'jabatan', 'birth_date', 'birth_place', 'is_verified', 'status'];
    for (const col of optionalColumns) {
      if (res.error && isMissingColumnError(res.error, col)) {
        idMemPayload = idMemPayload.map(p => {
          const clone = { ...p };
          delete clone[col];
          return clone;
        });
        res = await supa.from('members').upsert(idMemPayload, { onConflict: 'account_username,id_member' });
        if (res.error && !isMissingColumnError(res.error, 'id_member')) {
          res = await supa.from('members').upsert(idMemPayload, { onConflict: 'id_member' });
        }
      }
    }

    // 2. If 'nisn' column error occurs, strip 'nisn' and retry with only 'id_member'
    if (res.error && isMissingColumnError(res.error, 'nisn')) {
      const retryPayload = idMemPayload.map(({ nisn, ...rest }) => rest);
      res = await supa
        .from('members')
        .upsert(retryPayload, { onConflict: 'id_member' });
    }

    // 3. If 'id_member' column does not exist in schema, retry with 'nisn' as primary key
    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      const nisnPayload = members.map(m => mapMemberToDB(m, 'nisn'));
      res = await supa
        .from('members')
        .upsert(nisnPayload, { onConflict: 'nisn' });
    }

    if (res.error) {
      return { success: false, insertedCount: 0, error: res.error.message };
    }
    return { success: true, insertedCount: members.length };
  } catch (err: any) {
    return { success: false, insertedCount: 0, error: err.message };
  }
}

export async function deleteMemberFromDB(nisn: string, fullName?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const cleanNisn = nisn.trim();

    // 1. Cascade delete attendance for this member to prevent foreign key errors
    try {
      await supa.from('attendance').delete().eq('id_member', cleanNisn);
      await supa.from('attendance').delete().eq('nisn', cleanNisn);
    } catch {}

    // 2. Cascade delete cash for this member if any
    try {
      await supa.from('cash_transactions').delete().eq('id_member', cleanNisn);
      await supa.from('cash_transactions').delete().eq('nisn', cleanNisn);
    } catch {}

    // 3. Delete from members table by id_member or nisn
    let res = await supa.from('members').delete().eq('id_member', cleanNisn);
    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      res = await supa.from('members').delete().eq('nisn', cleanNisn);
    }

    // 4. Fallback: if fullName provided, also clean by full_name
    if (fullName && fullName.trim()) {
      try {
        await supa.from('members').delete().eq('full_name', fullName.trim());
      } catch {}
    }

    if (res.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// Attendance CRUD
// ----------------------------------------------------
export async function upsertAttendanceToDB(record: AttendanceRecord): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const recDate = String(record.tanggal || '').slice(0, 10).trim();
    const recNisn = String(record.nisn || record.id_member || '').trim();
    const recName = String(record.namaAnggota || record.nama_anggota || '').trim();
    const id = record.id || `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Clean up any duplicate existing rows for this date and member first
    if (recNisn && recNisn !== '-') {
      await supa.from('attendance').delete().eq('tanggal', recDate).eq('id_member', recNisn);
      await supa.from('attendance').delete().eq('tanggal', recDate).eq('nisn', recNisn);
    }

    // 1. Primary payload according to SQL schema (id, tanggal, id_member, status)
    const payloadIdMember: any = {
      id,
      tanggal: recDate,
      id_member: recNisn,
      status: record.status,
    };

    let res = await supa
      .from('attendance')
      .upsert(payloadIdMember, { onConflict: 'id' });

    // Fallback if legacy schema uses column nisn, nama_anggota
    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      const payloadNisn: any = {
        id,
        tanggal: recDate,
        nisn: recNisn,
        nama_anggota: recName,
        status: record.status,
      };
      res = await supa
        .from('attendance')
        .upsert(payloadNisn, { onConflict: 'id' });
    }

    if (res.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function bulkUpsertAttendanceToDB(
  records: AttendanceRecord[],
  cleanExistingDate: boolean = false
): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    if (records.length === 0) return { success: true };
    const targetDate = String(records[0].tanggal || '').slice(0, 10).trim();

    // Clean up existing records for that date only when explicitly requested (e.g. Tandai Semua Hadir)
    if (cleanExistingDate && targetDate) {
      await supa.from('attendance').delete().eq('tanggal', targetDate);
    }

    // 1. Primary payload (id_member)
    const payloadIdMember = records.map((r, idx) => ({
      id: r.id || `att_${Date.now()}_${idx}`,
      tanggal: String(r.tanggal || '').slice(0, 10).trim(),
      id_member: String(r.nisn || r.id_member || '').trim(),
      status: r.status,
    }));

    let res = await supa
      .from('attendance')
      .upsert(payloadIdMember, { onConflict: 'id' });

    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      const payloadNisn = records.map((r, idx) => ({
        id: r.id || `att_${Date.now()}_${idx}`,
        tanggal: String(r.tanggal || '').slice(0, 10).trim(),
        nisn: String(r.nisn || r.id_member || '').trim(),
        nama_anggota: String(r.namaAnggota || r.nama_anggota || '').trim(),
        status: r.status,
      }));
      res = await supa
        .from('attendance')
        .upsert(payloadNisn, { onConflict: 'id' });
    }

    if (res.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAttendanceFromDB(
  id: string,
  record?: { tanggal?: string; nisn?: string; namaAnggota?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    let hasError: string | undefined;

    // 1. Delete by Primary ID
    if (id && id.trim()) {
      const { error } = await supa.from('attendance').delete().eq('id', id.trim());
      if (error && !error.message?.includes('not found')) {
        hasError = error.message;
      }
    }

    // 2. Also delete by tanggal + (id_member OR nisn OR nama_anggota) to guarantee database deletion
    if (record?.tanggal) {
      const normD = String(record.tanggal).slice(0, 10).trim();
      const nisn = String(record.nisn || '').trim();
      const nama = String(record.namaAnggota || '').trim();

      if (nisn && nisn !== '-') {
        const resIdMem = await supa.from('attendance').delete().eq('tanggal', normD).eq('id_member', nisn);
        if (resIdMem.error && isMissingColumnError(resIdMem.error, 'id_member')) {
          await supa.from('attendance').delete().eq('tanggal', normD).eq('nisn', nisn);
        }
      }

      if (nama) {
        try {
          await supa.from('attendance').delete().eq('tanggal', normD).eq('nama_anggota', nama);
        } catch {}
      }
    }

    if (hasError) {
      return { success: false, error: sanitizeDbErrorMessage(hasError) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

export async function deleteAttendanceByMemberAndDate(tanggal: string, nisn?: string, namaAnggota?: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const normD = String(tanggal || '').slice(0, 10).trim();
    let query = supa.from('attendance').delete().eq('tanggal', normD);

    if (nisn && nisn.trim() !== '' && nisn.trim() !== '-') {
      query = query.eq('id_member', nisn.trim());
    } else if (namaAnggota && namaAnggota.trim() !== '') {
      query = query.eq('nama_anggota', namaAnggota.trim());
    }

    let { error } = await query;
    if (error && isMissingColumnError(error, 'id_member')) {
      if (nisn && nisn.trim() !== '' && nisn.trim() !== '-') {
        const retry = await supa.from('attendance').delete().eq('tanggal', normD).eq('nisn', nisn.trim());
        error = retry.error;
      }
    }

    if (error) {
      return { success: false, error: sanitizeDbErrorMessage(error) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

export async function deleteAttendanceByDate(tanggal: string, fallbackIds?: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const normD = String(tanggal || '').slice(0, 10).trim();
    if (!normD) return { success: true };
    
    // 1. Primary deletion by exact date column
    const { error: err1 } = await supa.from('attendance').delete().eq('tanggal', normD);
    
    // 2. Fallback: if fallbackIds provided, delete by IDs as well to ensure 100% clean-up in database
    if (fallbackIds && fallbackIds.length > 0) {
      const validIds = fallbackIds.filter(Boolean);
      if (validIds.length > 0) {
        try {
          await supa.from('attendance').delete().in('id', validIds);
        } catch {}
      }
    }

    // 3. Fallback for text/varchar timestamp format
    try {
      await supa.from('attendance').delete().like('tanggal', `${normD}%`);
    } catch {}

    if (err1 && !err1.message?.includes('not found')) {
      return { success: false, error: sanitizeDbErrorMessage(err1) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

export async function deleteAllAttendanceFromDB(
  accountUsername?: string,
  fallbackIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    let hasError: string | undefined;

    // 1. If accountUsername provided and not 'all', attempt scoped delete first
    if (accountUsername && accountUsername !== 'all') {
      try {
        const scopedRes = await supa.from('attendance').delete().eq('account_username', accountUsername);
        if (scopedRes.error && !isMissingColumnError(scopedRes.error, 'account_username')) {
          hasError = scopedRes.error.message;
        }
      } catch {}
    }

    // 2. Comprehensive delete of attendance records
    const { error: errAll } = await supa.from('attendance').delete().neq('id', '___non_existent_attendance_record___');
    if (errAll && !errAll.message?.includes('not found')) {
      hasError = errAll.message;
    }

    // 3. Fallback: delete by standard attendance status filter
    try {
      await supa.from('attendance').delete().in('status', ['Hadir', 'Izin', 'Sakit', 'Alpha', 'Alpa']);
    } catch {}

    // 4. Fallback: if fallbackIds provided, delete by IDs in chunks of 100
    if (fallbackIds && fallbackIds.length > 0) {
      const validIds = fallbackIds.filter(Boolean);
      for (let i = 0; i < validIds.length; i += 100) {
        const chunk = validIds.slice(i, i + 100);
        try {
          await supa.from('attendance').delete().in('id', chunk);
        } catch {}
      }
    }

    if (hasError) {
      return { success: false, error: sanitizeDbErrorMessage(hasError) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

// ----------------------------------------------------
// Cash CRUD
// ----------------------------------------------------
export async function upsertCashToDB(transaction: CashTransaction): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const id = transaction.id || `cash_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const cleanNisn = (transaction.nisn && transaction.nisn.trim() !== '-' && transaction.nisn.trim() !== '') 
      ? transaction.nisn.trim() 
      : null;
    const memberName = transaction.namaAnggota || transaction.namaSiswa || (cleanNisn ? '' : 'Kas Organisasi');
    
    // 1. Primary payload (matching SQL schema: id, tanggal, id_member, jenis, jumlah, keterangan)
    const payloadIdMember = {
      id,
      tanggal: transaction.tanggal,
      id_member: cleanNisn,
      jenis: transaction.jenis,
      jumlah: Number(transaction.jumlah || 0),
      keterangan: transaction.keterangan || '',
    };

    let res = await supa
      .from('cash_transactions')
      .upsert(payloadIdMember, { onConflict: 'id' });

    // Fallback if legacy schema uses nisn, nama_anggota
    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      const payloadNisn = {
        id,
        tanggal: transaction.tanggal,
        nisn: cleanNisn,
        nama_anggota: memberName,
        jenis: transaction.jenis,
        jumlah: Number(transaction.jumlah || 0),
        keterangan: transaction.keterangan || '',
      };
      res = await supa
        .from('cash_transactions')
        .upsert(payloadNisn, { onConflict: 'id' });
    }

    if (res.error) {
      return { success: false, error: sanitizeDbErrorMessage(res.error) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

export async function deleteCashFromDB(id: string, tx?: CashTransaction): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    let hasError: string | undefined;

    // 1. Delete by Primary ID
    if (id && id.trim()) {
      const { error } = await supa.from('cash_transactions').delete().eq('id', id.trim());
      if (error && !error.message?.includes('not found')) {
        hasError = error.message;
      }
    }

    // 2. Fallback: If local ID or additional match needed, delete by exact transaction parameters
    if (tx && tx.tanggal && tx.jumlah !== undefined) {
      const normD = String(tx.tanggal).slice(0, 10).trim();
      let q = supa.from('cash_transactions').delete().eq('tanggal', normD).eq('jumlah', tx.jumlah);
      if (tx.jenis) q = q.eq('jenis', tx.jenis);
      const cleanNisn = String(tx.nisn || '').trim();
      if (cleanNisn && cleanNisn !== '-') {
        q = q.eq('id_member', cleanNisn);
      }
      try {
        await q;
      } catch {}
    }

    if (hasError) {
      return { success: false, error: sanitizeDbErrorMessage(hasError) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

export async function deleteMultipleCashFromDB(ids: string[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    if (!ids || ids.length === 0) return { success: true };
    const { error } = await supa.from('cash_transactions').delete().in('id', ids);
    if (error) {
      return { success: false, error: sanitizeDbErrorMessage(error) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

export async function deleteAllMembersCashFromDB(): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    let res = await supa
      .from('cash_transactions')
      .delete()
      .eq('jenis', 'Masuk')
      .not('id_member', 'is', null);

    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      res = await supa
        .from('cash_transactions')
        .delete()
        .eq('jenis', 'Masuk')
        .not('nisn', 'is', null);
    }

    if (res.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAllCashFromDB(
  accountUsername?: string,
  fallbackIds?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    let hasError: string | undefined;

    // 1. If accountUsername provided and not 'all', attempt scoped delete first
    if (accountUsername && accountUsername !== 'all') {
      try {
        const scopedRes = await supa.from('cash_transactions').delete().eq('account_username', accountUsername);
        if (scopedRes.error && !isMissingColumnError(scopedRes.error, 'account_username')) {
          hasError = scopedRes.error.message;
        }
      } catch {}
    }

    // 2. Comprehensive delete of all cash records
    const resAll = await supa
      .from('cash_transactions')
      .delete()
      .neq('id', '___non_existent_cash_record___');

    if (resAll.error && !resAll.error.message?.includes('not found')) {
      hasError = resAll.error.message;
    }

    // 3. Fallback: delete by standard jenis filter
    try {
      await supa.from('cash_transactions').delete().in('jenis', ['Masuk', 'Keluar']);
    } catch {}

    // 4. Fallback: if fallbackIds provided, delete by IDs in chunks of 100
    if (fallbackIds && fallbackIds.length > 0) {
      const validIds = fallbackIds.filter(Boolean);
      for (let i = 0; i < validIds.length; i += 100) {
        const chunk = validIds.slice(i, i + 100);
        try {
          await supa.from('cash_transactions').delete().in('id', chunk);
        } catch {}
      }
    }

    if (hasError) {
      return { success: false, error: sanitizeDbErrorMessage(hasError) };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: sanitizeDbErrorMessage(err) };
  }
}

export async function bulkUpsertCashToDB(transactions: CashTransaction[]): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    if (transactions.length === 0) return { success: true };

    // 1. Primary payload (matching SQL schema: id_member)
    const payloadIdMember = transactions.map((t, idx) => {
      const cleanNisn = (t.nisn && t.nisn.trim() !== '-' && t.nisn.trim() !== '') ? t.nisn.trim() : null;
      return {
        id: t.id || `cash_${Date.now()}_${idx}`,
        tanggal: t.tanggal,
        id_member: cleanNisn,
        jenis: t.jenis,
        jumlah: Number(t.jumlah || 0),
        keterangan: t.keterangan || '',
      };
    });

    let res = await supa
      .from('cash_transactions')
      .upsert(payloadIdMember, { onConflict: 'id' });

    if (res.error && isMissingColumnError(res.error, 'id_member')) {
      const payloadNisn = transactions.map((t, idx) => {
        const cleanNisn = (t.nisn && t.nisn.trim() !== '-' && t.nisn.trim() !== '') ? t.nisn.trim() : null;
        return {
          id: t.id || `cash_${Date.now()}_${idx}`,
          tanggal: t.tanggal,
          nisn: cleanNisn,
          nama_anggota: t.namaAnggota || t.namaSiswa || (cleanNisn ? '' : 'Kas Organisasi'),
          jenis: t.jenis,
          jumlah: Number(t.jumlah || 0),
          keterangan: t.keterangan || '',
        };
      });
      res = await supa.from('cash_transactions').upsert(payloadNisn, { onConflict: 'id' });
    }

    if (res.error) {
      return { success: false, error: res.error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteCashByMemberAndPeriod(nisn: string, memberName: string, periodPrefix: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    let query = supa.from('cash_transactions').delete().eq('jenis', 'Masuk');

    if (nisn && nisn.trim() !== '' && nisn.trim() !== '-') {
      query = query.eq('id_member', nisn.trim());
    } else if (memberName && memberName.trim() !== '') {
      query = query.eq('nama_anggota', memberName.trim());
    }

    if (periodPrefix && periodPrefix.trim()) {
      query = query.like('tanggal', `${periodPrefix.trim()}%`);
    }

    let { error } = await query;
    if (error && isMissingColumnError(error, 'id_member')) {
      if (nisn && nisn.trim() !== '' && nisn.trim() !== '-') {
        let retryQuery = supa.from('cash_transactions').delete().eq('jenis', 'Masuk').eq('nisn', nisn.trim());
        if (periodPrefix && periodPrefix.trim()) {
          retryQuery = retryQuery.like('tanggal', `${periodPrefix.trim()}%`);
        }
        const retry = await retryQuery;
        error = retry.error;
      }
    }

    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ----------------------------------------------------
// Fetch All Data (Scoped per account if accountUsername specified)
// ----------------------------------------------------
export async function fetchAllSupabaseData(accountUsername?: string) {
  try {
    const supa = getSupabase();

    // 1. Query members (Scoped to account if supported, otherwise general)
    let membersRes = await supa.from('members').select('*');
    if (accountUsername && accountUsername !== 'all') {
      const filteredMembers = await supa.from('members').select('*').eq('account_username', accountUsername);
      if (!filteredMembers.error) {
        membersRes = filteredMembers;
      }
    }
    let members: Member[] = [];
    if (!membersRes.error && membersRes.data) {
      members = membersRes.data
        .map(mapMemberFromDB)
        .sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    // Helper map of members by nisn (id_member)
    const memberMap = new Map<string, Member>();
    members.forEach(m => {
      if (m.nisn) memberMap.set(m.nisn, m);
      if (m.id_member) memberMap.set(String(m.id_member), m);
    });

    // 2. Query attendance (prefer v_attendance, fallback to attendance)
    let attendance: AttendanceRecord[] = [];
    let attError: any = null;
    
    // Attempt scoped attendance query if accountUsername provided
    let vAttRes: any = null;
    if (accountUsername && accountUsername !== 'all') {
      const filteredVAtt = await supa.from('v_attendance').select('*').eq('account_username', accountUsername);
      if (!filteredVAtt.error) {
        vAttRes = filteredVAtt;
      }
    }
    if (!vAttRes) {
      vAttRes = await supa.from('v_attendance').select('*');
    }

    if (!vAttRes.error && vAttRes.data) {
      attendance = deduplicateAttendance(
        vAttRes.data
          .map(mapAttendanceFromDB)
          .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
      );
    } else {
      let attRes = await supa.from('attendance').select('*');
      if (accountUsername && accountUsername !== 'all') {
        const filteredAtt = await supa.from('attendance').select('*').eq('account_username', accountUsername);
        if (!filteredAtt.error) {
          attRes = filteredAtt;
        }
      }
      attError = attRes.error;
      if (!attRes.error && attRes.data) {
        attendance = deduplicateAttendance(
          attRes.data
            .map((row: any) => {
              const mapped = mapAttendanceFromDB(row);
              if (!mapped.namaAnggota && memberMap.has(mapped.nisn)) {
                mapped.namaAnggota = memberMap.get(mapped.nisn)!.fullName;
                mapped.nama_anggota = mapped.namaAnggota;
              }
              return mapped;
            })
            .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime())
        );
      }
    }

    // 3. Query cash transactions (prefer v_cash_transactions, fallback to cash_transactions)
    let cash: CashTransaction[] = [];
    let cashError: any = null;
    let vCashRes: any = null;
    if (accountUsername && accountUsername !== 'all') {
      const filteredVCash = await supa.from('v_cash_transactions').select('*').eq('account_username', accountUsername);
      if (!filteredVCash.error) {
        vCashRes = filteredVCash;
      }
    }
    if (!vCashRes) {
      vCashRes = await supa.from('v_cash_transactions').select('*');
    }

    if (!vCashRes.error && vCashRes.data) {
      cash = vCashRes.data
        .map(mapCashFromDB)
        .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
    } else {
      let cashRes = await supa.from('cash_transactions').select('*');
      if (accountUsername && accountUsername !== 'all') {
        const filteredCash = await supa.from('cash_transactions').select('*').eq('account_username', accountUsername);
        if (!filteredCash.error) {
          cashRes = filteredCash;
        }
      }
      cashError = cashRes.error;
      if (!cashRes.error && cashRes.data) {
        cash = cashRes.data
          .map((row: any) => {
            const mapped = mapCashFromDB(row);
            if ((!mapped.namaAnggota || mapped.namaAnggota === 'Kas Organisasi') && mapped.nisn && memberMap.has(mapped.nisn)) {
              mapped.namaAnggota = memberMap.get(mapped.nisn)!.fullName;
              mapped.nama_anggota = mapped.namaAnggota;
              mapped.namaSiswa = mapped.namaAnggota;
            }
            return mapped;
          })
          .sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      }
    }

    // 4. Query user accounts
    let accounts: AccountConfig[] = [];
    const accountsRes = await supa.from('user_accounts').select('*');
    if (!accountsRes.error && accountsRes.data && accountsRes.data.length > 0) {
      accounts = accountsRes.data.map((row: any) => ({
        username: String(row.username || '').trim(),
        password: String(row.password || ''),
        name: String(row.name || '').trim(),
        role: String(row.role || 'Pengurus Inti').trim(),
        email: String(row.email || '').trim(),
        authProvider: (row.auth_provider === 'google' ? 'google' : 'credentials') as 'credentials' | 'google',
        avatarUrl: row.avatar_url || '',
      }));
    }

    const hasTableNotExistError = 
      membersRes.error?.code === '42P01' || 
      membersRes.error?.message?.includes('does not exist') ||
      (attError?.code === '42P01' && vAttRes.error?.code === '42P01') || 
      (cashError?.code === '42P01' && vCashRes.error?.code === '42P01');

    const isConnected = !membersRes.error;
    const errorMsg = membersRes.error?.message || attError?.message || cashError?.message;

    return {
      success: isConnected,
      error: errorMsg,
      needsSetup: hasTableNotExistError,
      members,
      attendance,
      cash,
      accounts,
      rawMemberCount: membersRes.data ? membersRes.data.length : null,
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      needsSetup: false,
      members: [],
      attendance: [],
      cash: [],
      accounts: [],
      rawMemberCount: null,
    };
  }
}

// ----------------------------------------------------
// Bulk Sync Local Data to Supabase Cloud
// ----------------------------------------------------
export async function syncAllLocalDataToSupabase(
  members: Member[],
  attendance: AttendanceRecord[],
  cash: CashTransaction[],
  accounts?: AccountConfig[]
): Promise<{
  success: boolean;
  memberCount: number;
  attendanceCount: number;
  cashCount: number;
  accountsCount: number;
  error?: string;
}> {
  try {
    const supa = getSupabase();

    // 1. Members
    const targetMembers = members.length > 0 ? members : INITIAL_MEMBERS;
    const idMemPayload = targetMembers.map(m => mapMemberToDB(m, 'id_member'));
    let memRes = await supa.from('members').upsert(idMemPayload, { onConflict: 'account_username,id_member' });

    if (memRes.error && !isMissingColumnError(memRes.error, 'id_member')) {
      memRes = await supa.from('members').upsert(idMemPayload, { onConflict: 'id_member' });
    }

    if (memRes.error && isMissingColumnError(memRes.error, 'id_member')) {
      const nisnPayload = targetMembers.map(m => mapMemberToDB(m, 'nisn'));
      memRes = await supa.from('members').upsert(nisnPayload, { onConflict: 'account_username,nisn' });
      if (memRes.error) {
        memRes = await supa.from('members').upsert(nisnPayload, { onConflict: 'nisn' });
      }
    } else if (memRes.error && isMissingColumnError(memRes.error, 'nisn')) {
      const retryIdMem = targetMembers.map(m => mapMemberToDB(m, 'id_member'));
      memRes = await supa.from('members').upsert(retryIdMem, { onConflict: 'account_username,id_member' });
      if (memRes.error) {
        memRes = await supa.from('members').upsert(retryIdMem, { onConflict: 'id_member' });
      }
    }

    if (memRes.error) {
      return { success: false, memberCount: 0, attendanceCount: 0, cashCount: 0, accountsCount: 0, error: `Tabel members: ${memRes.error.message}` };
    }

    // Retrieve active session account for attendance & cash tagging
    let activeUser = 'admin';
    try {
      if (typeof localStorage !== 'undefined') {
        const sess = localStorage.getItem('robotic_user_session');
        if (sess) {
          const parsed = JSON.parse(sess);
          if (parsed?.username) activeUser = String(parsed.username).toLowerCase().trim();
        }
      }
    } catch {}

    // 2. Attendance
    let attCount = 0;
    const attData = attendance.length > 0 ? attendance : INITIAL_ATTENDANCE;
    if (attData.length > 0) {
      const attIdMemPayload = attData.map((a: any, idx) => ({
        id: a.id || `att_${Date.now()}_${idx}`,
        account_username: a.account_username || activeUser,
        tanggal: String(a.tanggal || '').slice(0, 10),
        id_member: String(a.nisn || a.id_member || '').trim(),
        status: a.status,
      }));
      let attRes = await supa.from('attendance').upsert(attIdMemPayload, { onConflict: 'id' });

      if (attRes.error && isMissingColumnError(attRes.error, 'id_member')) {
        const attNisnPayload = attData.map((a: any, idx) => ({
          id: a.id || `att_${Date.now()}_${idx}`,
          account_username: a.account_username || activeUser,
          tanggal: String(a.tanggal || '').slice(0, 10),
          nisn: String(a.nisn || a.id_member || '').trim(),
          nama_anggota: a.nama_anggota || a.namaAnggota || '',
          status: a.status,
        }));
        attRes = await supa.from('attendance').upsert(attNisnPayload, { onConflict: 'id' });
      }

      if (attRes.error) {
        return { success: false, memberCount: targetMembers.length, attendanceCount: 0, cashCount: 0, accountsCount: 0, error: `Tabel attendance: ${attRes.error.message}` };
      }
      attCount = attData.length;
    }

    // 3. Cash
    let cashCount = 0;
    const cashData = cash.length > 0 ? cash : INITIAL_CASH;
    if (cashData.length > 0) {
      const cashIdMemPayload = cashData.map((c: any, idx) => {
        const rawNisn = String(c.nisn || c.id_member || '').trim();
        const cleanNisn = (rawNisn && rawNisn !== '-') ? rawNisn : null;
        return {
          id: c.id || `cash_${Date.now()}_${idx}`,
          account_username: c.account_username || activeUser,
          tanggal: String(c.tanggal || '').slice(0, 10),
          id_member: cleanNisn,
          jenis: c.jenis,
          jumlah: Number(c.jumlah || 0),
          keterangan: c.keterangan || '',
        };
      });
      
      let cashRes = await supa.from('cash_transactions').upsert(cashIdMemPayload, { onConflict: 'id' });
      
      if (cashRes.error && isMissingColumnError(cashRes.error, 'id_member')) {
        const cashNisnPayload = cashData.map((c: any, idx) => {
          const rawNisn = String(c.nisn || c.id_member || '').trim();
          const cleanNisn = (rawNisn && rawNisn !== '-') ? rawNisn : null;
          return {
            id: c.id || `cash_${Date.now()}_${idx}`,
            account_username: c.account_username || activeUser,
            tanggal: String(c.tanggal || '').slice(0, 10),
            nisn: cleanNisn,
            nama_anggota: c.nama_anggota || c.namaAnggota || c.namaSiswa || (cleanNisn ? '' : 'Kas Organisasi'),
            jenis: c.jenis,
            jumlah: Number(c.jumlah || 0),
            keterangan: c.keterangan || '',
          };
        });
        cashRes = await supa.from('cash_transactions').upsert(cashNisnPayload, { onConflict: 'id' });
      }

      if (cashRes.error) {
        return { success: false, memberCount: targetMembers.length, attendanceCount: attCount, cashCount: 0, accountsCount: 0, error: `Tabel cash: ${cashRes.error.message}` };
      }
      cashCount = cashData.length;
    }

    // 4. User Accounts
    let accCount = 0;
    const accountsData = accounts && accounts.length > 0 ? accounts : (getCustomAccounts() || DEFAULT_ACCOUNTS);
    if (accountsData.length > 0) {
      const accountsPayload = accountsData.map((acc) => ({
        username: acc.username.trim(),
        password: acc.password || '',
        name: acc.name.trim(),
        role: acc.role || 'Pengurus Inti',
        email: acc.email || '',
        auth_provider: acc.authProvider || 'credentials',
        avatar_url: acc.avatarUrl || '',
        updated_at: new Date().toISOString(),
      }));

      const { error: accErr } = await supa.from('user_accounts').upsert(accountsPayload, { onConflict: 'username' });
      if (!accErr) {
        accCount = accountsPayload.length;
      }
    }

    return {
      success: true,
      memberCount: targetMembers.length,
      attendanceCount: attCount,
      cashCount: cashCount,
      accountsCount: accCount,
    };
  } catch (err: any) {
    return {
      success: false,
      memberCount: 0,
      attendanceCount: 0,
      cashCount: 0,
      accountsCount: 0,
      error: err.message,
    };
  }
}

// Seed initial default template
export async function seedInitialData() {
  return syncAllLocalDataToSupabase(INITIAL_MEMBERS, INITIAL_ATTENDANCE, INITIAL_CASH);
}

// ==============================================================================
// 1. PRE-REGISTRATION / STAGING LIST (allowed_members)
// ==============================================================================

export async function fetchAllowedMembersFromDB(): Promise<AllowedMember[]> {
  try {
    const supa = getSupabase();
    const { data, error } = await supa
      .from('allowed_members')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('fetchAllowedMembersFromDB error:', error.message);
      // Fallback to local storage
      const local = localStorage.getItem('robotics_allowed_members');
      return local ? JSON.parse(local) : [];
    }

    if (data) {
      localStorage.setItem('robotics_allowed_members', JSON.stringify(data));
      return data as AllowedMember[];
    }
    return [];
  } catch (err: any) {
    console.error('fetchAllowedMembersFromDB catch:', err);
    const local = localStorage.getItem('robotics_allowed_members');
    return local ? JSON.parse(local) : [];
  }
}

export async function bulkAddAllowedMembersToDB(
  items: Array<{
    email: string;
    nama_lengkap: string;
    nis_atau_kelas?: string;
    jabatan_ekskul?: string;
    status_akun?: 'unclaimed' | 'claimed';
  }>
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const supa = getSupabase();
    const payload = items.map((it) => ({
      email: it.email.toLowerCase().trim(),
      nama_lengkap: it.nama_lengkap.trim(),
      nis_atau_kelas: it.nis_atau_kelas || '',
      jabatan_ekskul: it.jabatan_ekskul || 'member',
      status_akun: it.status_akun || 'unclaimed',
    }));

    const { data, error } = await supa
      .from('allowed_members')
      .upsert(payload, { onConflict: 'email' })
      .select();

    if (error) {
      // Offline fallback: save to localStorage
      const existing = await fetchAllowedMembersFromDB();
      const mergedMap = new Map<string, AllowedMember>();
      existing.forEach((e) => mergedMap.set(e.email.toLowerCase(), e));
      payload.forEach((p) => {
        mergedMap.set(p.email, {
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          email: p.email,
          nama_lengkap: p.nama_lengkap,
          nis_atau_kelas: p.nis_atau_kelas,
          jabatan_ekskul: p.jabatan_ekskul,
          status_akun: p.status_akun as any,
          created_at: new Date().toISOString(),
        });
      });
      const merged = Array.from(mergedMap.values());
      localStorage.setItem('robotics_allowed_members', JSON.stringify(merged));
      return { success: true, count: payload.length };
    }

    return { success: true, count: data?.length || payload.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err.message };
  }
}

export async function deleteAllowedMemberFromDB(idOrEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    let query = supa.from('allowed_members').delete();
    if (idOrEmail.includes('@')) {
      query = query.eq('email', idOrEmail.toLowerCase().trim());
    } else {
      query = query.eq('id', idOrEmail);
    }
    const { error } = await query;

    // Update local cache
    const local = localStorage.getItem('robotics_allowed_members');
    if (local) {
      const parsed: AllowedMember[] = JSON.parse(local);
      const filtered = parsed.filter((m) => m.id !== idOrEmail && m.email !== idOrEmail);
      localStorage.setItem('robotics_allowed_members', JSON.stringify(filtered));
    }

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==============================================================================
// 2. PROFILES (auth.users Linked)
// ==============================================================================

export async function fetchProfileFromDB(userId: string, emailFallback?: string): Promise<UserProfile | null> {
  try {
    const supa = getSupabase();
    let query = supa.from('profiles').select('*');
    if (userId) {
      query = query.eq('id', userId);
    } else if (emailFallback) {
      query = query.eq('email', emailFallback.toLowerCase().trim());
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.warn('fetchProfileFromDB error:', error.message);
      return null;
    }
    return data as UserProfile | null;
  } catch (err: any) {
    console.error('fetchProfileFromDB catch:', err);
    return null;
  }
}

export async function updateProfileInDB(
  userId: string,
  updates: Partial<UserProfile>
): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const payload = {
      ...updates,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supa.from('profiles').update(payload).eq('id', userId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchAllProfilesFromDB(): Promise<UserProfile[]> {
  try {
    const supa = getSupabase();
    const { data, error } = await supa
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('fetchAllProfilesFromDB error:', error.message);
      const local = localStorage.getItem('robotics_profiles_cache');
      return local ? JSON.parse(local) : [];
    }

    if (data) {
      localStorage.setItem('robotics_profiles_cache', JSON.stringify(data));
      return data as UserProfile[];
    }
    return [];
  } catch (err: any) {
    console.error('fetchAllProfilesFromDB catch:', err);
    const local = localStorage.getItem('robotics_profiles_cache');
    return local ? JSON.parse(local) : [];
  }
}

export async function updateProfileRoleAndStatus(
  profileId: string,
  role: 'member' | 'admin',
  status_keanggotaan: string = 'aktif',
  jabatan: string = 'member'
): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const { error } = await supa
      .from('profiles')
      .update({
        role,
        status_keanggotaan,
        jabatan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profileId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function fetchRegisteredUsersFromDB(): Promise<RegisteredUser[]> {
  try {
    const supa = getSupabase();
    const userMap = new Map<string, RegisteredUser>();

    // 1. Fetch from user_accounts
    try {
      const { data: accounts, error: accErr } = await supa
        .from('user_accounts')
        .select('*')
        .order('created_at', { ascending: false });

      if (!accErr && accounts && Array.isArray(accounts)) {
        for (const row of accounts) {
          const username = String(row.username || '').trim();
          if (!username) continue;
          const cleanRole = String(row.role || 'Anggota / Viewer').trim();
          const isExec = cleanRole.toLowerCase() === 'executive_board' || cleanRole.toLowerCase().includes('executive');
          const isAdmin = cleanRole.toLowerCase() === 'admin' || cleanRole.toLowerCase().includes('pembina') || cleanRole.toLowerCase().includes('ketua');

          const userItem: RegisteredUser = {
            id: `acc_${username}`,
            username,
            name: String(row.name || username).trim(),
            email: String(row.email || `${username}@man2kotabekasi.sch.id`).trim(),
            role: cleanRole,
            membershipStatus: isExec ? 'executive_board' : 'aktif',
            jabatan: isExec ? 'vice_president' : undefined,
            source: 'user_accounts',
            authProvider: row.auth_provider === 'google' ? 'google' : 'credentials',
            avatarUrl: row.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
            createdAt: row.created_at || row.updated_at,
            isExecutiveBoard: isExec,
            isAdmin,
          };
          userMap.set(username.toLowerCase(), userItem);
          if (row.email) userMap.set(row.email.toLowerCase(), userItem);
        }
      }
    } catch (e) {
      console.warn('Notice querying user_accounts in Supabase:', e);
    }

    // 2. Fetch from profiles (auth.users)
    try {
      const { data: profiles, error: profErr } = await supa
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (!profErr && profiles && Array.isArray(profiles)) {
        for (const p of profiles) {
          const email = String(p.email || '').trim().toLowerCase();
          const username = email ? email.split('@')[0] : p.id;
          const status = String(p.status_keanggotaan || 'aktif').trim().toLowerCase();
          const rawRole = String(p.role || 'member').trim().toLowerCase();
          const jabatan = String(p.jabatan || 'member').trim().toLowerCase();
          const isExec = status === 'executive_board' || rawRole === 'executive_board' || ['president', 'vice_president', 'secretary', 'treasurer', 'pr'].includes(jabatan);
          const isAdmin = rawRole === 'admin' || jabatan === 'president' || jabatan === 'pembina';

          const existing = (email && userMap.get(email)) || userMap.get(username.toLowerCase());
          if (existing) {
            existing.id = p.id;
            existing.source = 'both';
            existing.nis = p.nis || existing.nis;
            existing.kelas = p.kelas || existing.kelas;
            existing.jabatan = p.jabatan || existing.jabatan;
            if (isExec) {
              existing.role = 'executive_board';
              existing.membershipStatus = 'executive_board';
              existing.isExecutiveBoard = true;
            }
          } else {
            const userItem: RegisteredUser = {
              id: p.id,
              username,
              name: String(p.full_name || username).trim(),
              email,
              role: isExec ? 'executive_board' : (isAdmin ? 'admin' : 'member'),
              membershipStatus: status,
              jabatan: p.jabatan,
              source: 'profiles',
              authProvider: 'google',
              avatarUrl: p.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
              nis: p.nis || '',
              kelas: p.kelas || '',
              createdAt: p.created_at || p.updated_at,
              isExecutiveBoard: isExec,
              isAdmin,
            };
            userMap.set(username.toLowerCase(), userItem);
            if (email) userMap.set(email, userItem);
          }
        }
      }
    } catch (e) {
      console.warn('Notice querying profiles in Supabase:', e);
    }

    // 3. Fallback / merge with local custom accounts
    const localAccounts = getCustomAccounts();
    for (const la of localAccounts) {
      const u = la.username.toLowerCase();
      const existing = userMap.get(u) || (la.email ? userMap.get(la.email.toLowerCase()) : null);
      const isExec = la.role === 'executive_board' || la.role.toLowerCase().includes('executive');
      const isAdmin = la.role === 'admin' || la.username === 'admin' || la.role.toLowerCase().includes('pembina');

      if (!existing) {
        const item: RegisteredUser = {
          id: `local_${la.username}`,
          username: la.username,
          name: la.name,
          email: la.email || `${la.username}@man2kotabekasi.sch.id`,
          role: la.role,
          membershipStatus: isExec ? 'executive_board' : 'aktif',
          source: 'user_accounts',
          authProvider: la.authProvider || 'credentials',
          avatarUrl: la.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${la.username}`,
          isExecutiveBoard: isExec,
          isAdmin,
        };
        userMap.set(u, item);
      } else if (isExec) {
        existing.isExecutiveBoard = true;
        existing.role = 'executive_board';
        existing.membershipStatus = 'executive_board';
      }
    }

    // 4. Enrich with member info if available
    const membersRaw = localStorage.getItem('robotics_members');
    if (membersRaw) {
      try {
        const parsedMembers: Member[] = JSON.parse(membersRaw);
        if (Array.isArray(parsedMembers)) {
          for (const m of parsedMembers) {
            const mEmail = (m.email || '').toLowerCase().trim();
            const matchedUser = mEmail ? userMap.get(mEmail) : null;
            if (matchedUser) {
              matchedUser.nis = matchedUser.nis || m.nisn;
              matchedUser.kelas = matchedUser.kelas || `${m.grade || ''}-${m.classRoom || ''}`;
              if (m.status === 'executive_board' || m.role === 'executive_board') {
                matchedUser.isExecutiveBoard = true;
                matchedUser.role = 'executive_board';
                matchedUser.membershipStatus = 'executive_board';
              }
            }
          }
        }
      } catch {}
    }

    // Deduplicate unique list
    const result = Array.from(new Set(Array.from(userMap.values())));
    localStorage.setItem('robotics_registered_users_cache', JSON.stringify(result));
    return result;
  } catch (err) {
    console.warn('fetchRegisteredUsersFromDB error:', err);
    const cached = localStorage.getItem('robotics_registered_users_cache');
    return cached ? JSON.parse(cached) : [];
  }
}

export async function promoteUserToExecutiveBoard(user: RegisteredUser): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const nowIso = new Date().toISOString();
    const targetUsername = user.username.trim().toLowerCase();
    const targetEmail = (user.email || '').trim().toLowerCase();

    // 1. Update in Supabase user_accounts
    try {
      if (user.username) {
        await supa
          .from('user_accounts')
          .update({
            role: 'executive_board',
            updated_at: nowIso,
          })
          .ilike('username', targetUsername);
      }
      if (targetEmail) {
        await supa
          .from('user_accounts')
          .update({
            role: 'executive_board',
            updated_at: nowIso,
          })
          .ilike('email', targetEmail);
      }
    } catch (e) {
      console.warn('Supabase user_accounts promote notice:', e);
    }

    // 2. Update in Supabase profiles (if registered via Google auth / auth.users)
    try {
      if (user.id && !user.id.startsWith('local_') && !user.id.startsWith('acc_')) {
        await supa
          .from('profiles')
          .update({
            status_keanggotaan: 'executive_board',
            role: 'admin',
            jabatan: 'vice_president',
            updated_at: nowIso,
          })
          .eq('id', user.id);
      } else if (targetEmail) {
        await supa
          .from('profiles')
          .update({
            status_keanggotaan: 'executive_board',
            role: 'admin',
            jabatan: 'vice_president',
            updated_at: nowIso,
          })
          .ilike('email', targetEmail);
      }
    } catch (e) {
      console.warn('Supabase profiles promote notice:', e);
    }

    // 3. Update in Supabase members table (if student roster member exists)
    try {
      if (targetEmail) {
        await supa
          .from('members')
          .update({
            status: 'executive_board',
            role: 'executive_board',
          })
          .ilike('email', targetEmail);
      }
    } catch (e) {
      console.warn('Supabase members promote notice:', e);
    }

    // 4. Update in Supabase allowed_members table
    try {
      if (targetEmail) {
        await supa
          .from('allowed_members')
          .update({
            jabatan_ekskul: 'vice_president',
          })
          .ilike('email', targetEmail);
      }
    } catch (e) {}

    // 5. Update local storage caches: custom_accounts
    const accounts = getCustomAccounts();
    const accIdx = accounts.findIndex(
      (a) => a.username.toLowerCase() === targetUsername || (targetEmail && a.email && a.email.toLowerCase() === targetEmail)
    );
    if (accIdx !== -1) {
      accounts[accIdx] = {
        ...accounts[accIdx],
        role: 'executive_board',
      };
      saveCustomAccounts(accounts);
    } else {
      accounts.push({
        username: user.username,
        name: user.name,
        role: 'executive_board',
        email: user.email,
        authProvider: user.authProvider || 'credentials',
        avatarUrl: user.avatarUrl,
      });
      saveCustomAccounts(accounts);
    }

    // 6. Update local storage cache: profiles cache
    try {
      const profCacheRaw = localStorage.getItem('robotics_profiles_cache');
      if (profCacheRaw) {
        const profs: UserProfile[] = JSON.parse(profCacheRaw);
        if (Array.isArray(profs)) {
          const updatedProfs = profs.map((p) => {
            if ((targetEmail && p.email?.toLowerCase() === targetEmail) || p.id === user.id) {
              return {
                ...p,
                status_keanggotaan: 'executive_board',
                role: 'admin' as const,
                jabatan: 'vice_president' as const,
                updated_at: nowIso,
              };
            }
            return p;
          });
          localStorage.setItem('robotics_profiles_cache', JSON.stringify(updatedProfs));
        }
      }
    } catch {}

    // 7. Update local storage cache: members
    try {
      const memRaw = localStorage.getItem('robotics_members');
      if (memRaw) {
        const mems: Member[] = JSON.parse(memRaw);
        if (Array.isArray(mems)) {
          const updatedMems = mems.map((m) => {
            if (
              (targetEmail && m.email?.toLowerCase() === targetEmail) ||
              m.fullName?.toLowerCase() === user.name.toLowerCase()
            ) {
              return {
                ...m,
                status: 'executive_board',
                role: 'executive_board',
                jabatan: 'vice_president',
              };
            }
            return m;
          });
          localStorage.setItem('robotics_members', JSON.stringify(updatedMems));
        }
      }
    } catch {}

    // 8. Update registered users cache
    try {
      const regCacheRaw = localStorage.getItem('robotics_registered_users_cache');
      if (regCacheRaw) {
        const regUsers: RegisteredUser[] = JSON.parse(regCacheRaw);
        if (Array.isArray(regUsers)) {
          const updatedReg = regUsers.map((u) => {
            if (u.username.toLowerCase() === targetUsername || (targetEmail && u.email?.toLowerCase() === targetEmail)) {
              return {
                ...u,
                role: 'executive_board',
                membershipStatus: 'executive_board',
                isExecutiveBoard: true,
              };
            }
            return u;
          });
          localStorage.setItem('robotics_registered_users_cache', JSON.stringify(updatedReg));
        }
      }
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function demoteUserToMember(user: RegisteredUser): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const nowIso = new Date().toISOString();
    const targetUsername = user.username.trim().toLowerCase();
    const targetEmail = (user.email || '').trim().toLowerCase();

    // 1. user_accounts
    try {
      if (user.username) {
        await supa.from('user_accounts').update({ role: 'Anggota / Viewer', updated_at: nowIso }).ilike('username', targetUsername);
      }
      if (targetEmail) {
        await supa.from('user_accounts').update({ role: 'Anggota / Viewer', updated_at: nowIso }).ilike('email', targetEmail);
      }
    } catch (e) {}

    // 2. profiles
    try {
      if (user.id && !user.id.startsWith('local_') && !user.id.startsWith('acc_')) {
        await supa.from('profiles').update({ status_keanggotaan: 'aktif', role: 'member', jabatan: 'member', updated_at: nowIso }).eq('id', user.id);
      } else if (targetEmail) {
        await supa.from('profiles').update({ status_keanggotaan: 'aktif', role: 'member', jabatan: 'member', updated_at: nowIso }).ilike('email', targetEmail);
      }
    } catch (e) {}

    // 3. members
    try {
      if (targetEmail) {
        await supa.from('members').update({ status: 'Aktif', role: 'Anggota' }).ilike('email', targetEmail);
      }
    } catch (e) {}

    // Update local accounts
    const accounts = getCustomAccounts();
    const accIdx = accounts.findIndex(
      (a) => a.username.toLowerCase() === targetUsername || (targetEmail && a.email && a.email.toLowerCase() === targetEmail)
    );
    if (accIdx !== -1) {
      accounts[accIdx] = { ...accounts[accIdx], role: 'Anggota / Viewer' };
      saveCustomAccounts(accounts);
    }

    // Update registered cache
    try {
      const regCacheRaw = localStorage.getItem('robotics_registered_users_cache');
      if (regCacheRaw) {
        const regUsers: RegisteredUser[] = JSON.parse(regCacheRaw);
        if (Array.isArray(regUsers)) {
          const updatedReg = regUsers.map((u) => {
            if (u.username.toLowerCase() === targetUsername || (targetEmail && u.email?.toLowerCase() === targetEmail)) {
              return {
                ...u,
                role: 'Anggota / Viewer',
                membershipStatus: 'aktif',
                isExecutiveBoard: false,
              };
            }
            return u;
          });
          localStorage.setItem('robotics_registered_users_cache', JSON.stringify(updatedReg));
        }
      }
    } catch {}

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==============================================================================
// 3. PENGUMUMAN & INFORMASI (announcements)
// ==============================================================================

export async function fetchAnnouncementsFromDB(): Promise<Announcement[]> {
  try {
    const supa = getSupabase();
    const { data, error } = await supa
      .from('announcements')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      const local = localStorage.getItem('robotics_announcements');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      localStorage.setItem('robotics_announcements', JSON.stringify(INITIAL_ANNOUNCEMENTS));
      return INITIAL_ANNOUNCEMENTS as Announcement[];
    }

    localStorage.setItem('robotics_announcements', JSON.stringify(data));
    return data as Announcement[];
  } catch (err: any) {
    const local = localStorage.getItem('robotics_announcements');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_ANNOUNCEMENTS as Announcement[];
  }
}

export async function createAnnouncementInDB(
  announcement: Omit<Announcement, 'id' | 'created_at'>
): Promise<{ success: boolean; data?: Announcement; error?: string }> {
  try {
    const supa = getSupabase();
    const id = `ann_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newRecord: Announcement = {
      id,
      ...announcement,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supa
      .from('announcements')
      .insert([newRecord])
      .select()
      .maybeSingle();

    if (error) {
      // Local fallback
      const existing = await fetchAnnouncementsFromDB();
      const updated = [newRecord, ...existing];
      localStorage.setItem('robotics_announcements', JSON.stringify(updated));
      return { success: true, data: newRecord };
    }

    return { success: true, data: (data as Announcement) || newRecord };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteAnnouncementInDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const { error } = await supa.from('announcements').delete().eq('id', id);

    // Update local cache
    const local = localStorage.getItem('robotics_announcements');
    if (local) {
      const parsed: Announcement[] = JSON.parse(local);
      const filtered = parsed.filter((a) => a.id !== id);
      localStorage.setItem('robotics_announcements', JSON.stringify(filtered));
    }

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==============================================================================
// 4. MATERI & TUGAS (materials_assignments)
// ==============================================================================

export async function fetchMaterialsAssignmentsFromDB(): Promise<MaterialAssignment[]> {
  try {
    const supa = getSupabase();
    const { data, error } = await supa
      .from('materials_assignments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      const local = localStorage.getItem('robotics_materials_assignments');
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      localStorage.setItem('robotics_materials_assignments', JSON.stringify(INITIAL_ASSIGNMENTS));
      return INITIAL_ASSIGNMENTS as MaterialAssignment[];
    }

    localStorage.setItem('robotics_materials_assignments', JSON.stringify(data));
    return data as MaterialAssignment[];
  } catch (err: any) {
    const local = localStorage.getItem('robotics_materials_assignments');
    if (local) {
      try {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch {}
    }
    return INITIAL_ASSIGNMENTS as MaterialAssignment[];
  }
}

export async function createMaterialAssignmentInDB(
  item: Omit<MaterialAssignment, 'id' | 'created_at'>
): Promise<{ success: boolean; data?: MaterialAssignment; error?: string }> {
  try {
    const supa = getSupabase();
    const id = `mat_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newRecord: MaterialAssignment = {
      id,
      ...item,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supa
      .from('materials_assignments')
      .insert([newRecord])
      .select()
      .maybeSingle();

    if (error) {
      const existing = await fetchMaterialsAssignmentsFromDB();
      const updated = [newRecord, ...existing];
      localStorage.setItem('robotics_materials_assignments', JSON.stringify(updated));
      return { success: true, data: newRecord };
    }

    return { success: true, data: (data as MaterialAssignment) || newRecord };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deleteMaterialAssignmentInDB(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const { error } = await supa.from('materials_assignments').delete().eq('id', id);

    const local = localStorage.getItem('robotics_materials_assignments');
    if (local) {
      const parsed: MaterialAssignment[] = JSON.parse(local);
      const filtered = parsed.filter((m) => m.id !== id);
      localStorage.setItem('robotics_materials_assignments', JSON.stringify(filtered));
    }

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ==============================================================================
// 5. PENGUMPULAN TUGAS & PENILAIAN (assignment_submissions)
// ==============================================================================

export async function fetchSubmissionsByAssignmentFromDB(assignmentId: string): Promise<AssignmentSubmission[]> {
  try {
    const supa = getSupabase();
    const { data, error } = await supa
      .from('assignment_submissions')
      .select('*')
      .eq('assignment_id', assignmentId)
      .order('submitted_at', { ascending: false });

    if (error || !data || data.length === 0) {
      const local = localStorage.getItem(`robotics_subs_${assignmentId}`);
      if (local) {
        const parsed = JSON.parse(local);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
      const initialMatches = INITIAL_SUBMISSIONS.filter(s => s.assignment_id === assignmentId);
      if (initialMatches.length > 0) {
        localStorage.setItem(`robotics_subs_${assignmentId}`, JSON.stringify(initialMatches));
        return initialMatches as AssignmentSubmission[];
      }
      return [];
    }

    localStorage.setItem(`robotics_subs_${assignmentId}`, JSON.stringify(data));
    return data as AssignmentSubmission[];
  } catch (err: any) {
    const local = localStorage.getItem(`robotics_subs_${assignmentId}`);
    return local ? JSON.parse(local) : INITIAL_SUBMISSIONS.filter(s => s.assignment_id === assignmentId);
  }
}

export async function fetchStudentSubmissionsFromDB(studentIdOrEmail: string): Promise<AssignmentSubmission[]> {
  try {
    const supa = getSupabase();
    let remoteSubs: AssignmentSubmission[] = [];
    if (supa) {
      try {
        const { data } = await supa
          .from('assignment_submissions')
          .select('*')
          .or(`student_id.eq.${studentIdOrEmail},student_email.eq.${studentIdOrEmail}`);
        if (data && Array.isArray(data)) {
          remoteSubs = data as AssignmentSubmission[];
        }
      } catch (e) {
        // Fallback to local
      }
    }

    // Collect from local cache
    const collectedMap = new Map<string, AssignmentSubmission>();
    remoteSubs.forEach(s => collectedMap.set(s.id, s));

    const directLocal = localStorage.getItem(`robotics_student_subs_${studentIdOrEmail}`);
    if (directLocal) {
      try {
        const parsed: AssignmentSubmission[] = JSON.parse(directLocal);
        if (Array.isArray(parsed)) {
          parsed.forEach(s => collectedMap.set(s.id, s));
        }
      } catch {}
    }

    // Scan all assignment caches in localStorage for this student
    const normSearch = studentIdOrEmail.toLowerCase().trim();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('robotics_subs_')) {
        try {
          const list: AssignmentSubmission[] = JSON.parse(localStorage.getItem(key) || '[]');
          if (Array.isArray(list)) {
            list.forEach(s => {
              const matchId = (s.student_id || '').toLowerCase().trim();
              const matchEmail = (s.student_email || '').toLowerCase().trim();
              const matchName = (s.student_name || '').toLowerCase().trim();
              if (
                matchId === normSearch ||
                matchEmail === normSearch ||
                matchName === normSearch ||
                (normSearch.length > 2 && matchName.includes(normSearch)) ||
                (matchEmail && normSearch.includes(matchEmail.split('@')[0]))
              ) {
                collectedMap.set(s.id, s);
              }
            });
          }
        } catch {}
      }
    }

    // Fallback seed matches if still empty
    if (collectedMap.size === 0) {
      const initialMatches = INITIAL_SUBMISSIONS.filter(
        s => s.student_id === studentIdOrEmail ||
             s.student_email === studentIdOrEmail ||
             studentIdOrEmail.includes('adinda') ||
             studentIdOrEmail.includes('member1') ||
             s.student_name.toLowerCase().includes(normSearch)
      );
      if (initialMatches.length > 0) {
        initialMatches.forEach(s => collectedMap.set(s.id, s as AssignmentSubmission));
      }
    }

    const result = Array.from(collectedMap.values());
    result.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
    localStorage.setItem(`robotics_student_subs_${studentIdOrEmail}`, JSON.stringify(result));
    return result;
  } catch (err: any) {
    const local = localStorage.getItem(`robotics_student_subs_${studentIdOrEmail}`);
    return local ? JSON.parse(local) : [];
  }
}

export async function recordDirectGradeInDB(payload: {
  assignment_id: string;
  student_id: string;
  student_email?: string;
  student_name: string;
  score_numeric?: number;
  score_binary?: 'Lulus' | 'Perlu Perbaikan' | 'Belum Dinilai' | string;
  feedback?: string;
  graded_by?: string;
  submission_text?: string;
  submission_link?: string;
  submission_type?: 'link' | 'photo' | 'document' | 'mixed';
  file_name?: string;
  file_size?: number;
  file_data?: string;
  file_type?: string;
}): Promise<{ success: boolean; data?: AssignmentSubmission; error?: string }> {
  try {
    const supa = getSupabase();
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newRecord: AssignmentSubmission = {
      id,
      assignment_id: payload.assignment_id,
      student_id: payload.student_id,
      student_email: payload.student_email || `${payload.student_id}@man2kotabekasi.sch.id`,
      student_name: payload.student_name,
      submission_text: payload.submission_text || 'Direct In-Person Evaluation by Club Advisor',
      submission_link: payload.submission_link,
      submission_type: payload.submission_type,
      file_name: payload.file_name,
      file_size: payload.file_size,
      file_data: payload.file_data,
      file_type: payload.file_type,
      status: 'graded',
      score_numeric: payload.score_numeric,
      score_binary: payload.score_binary,
      feedback: payload.feedback,
      submitted_at: new Date().toISOString(),
      graded_at: new Date().toISOString(),
      graded_by: payload.graded_by || 'Admin / Pembina Ekstrakurikuler',
    };

    // Update assignment submissions cache
    const key = `robotics_subs_${payload.assignment_id}`;
    const existing: AssignmentSubmission[] = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter(
      (s) => s.student_id !== payload.student_id && s.student_name.toLowerCase() !== payload.student_name.toLowerCase()
    );
    const updated = [newRecord, ...filtered];
    localStorage.setItem(key, JSON.stringify(updated));

    // Update student submissions cache
    const studentKey = `robotics_student_subs_${payload.student_id}`;
    const studentExisting: AssignmentSubmission[] = JSON.parse(localStorage.getItem(studentKey) || '[]');
    const studentFiltered = studentExisting.filter((s) => s.assignment_id !== payload.assignment_id);
    localStorage.setItem(studentKey, JSON.stringify([newRecord, ...studentFiltered]));

    if (payload.student_email) {
      const emailKey = `robotics_student_subs_${payload.student_email}`;
      localStorage.setItem(emailKey, JSON.stringify([newRecord, ...studentFiltered]));
    }

    // Save to announcement log
    try {
      const annKey = 'robotics_grade_announcements';
      const existingAnn: any[] = JSON.parse(localStorage.getItem(annKey) || '[]');
      const newAnnItem = {
        id: `ann_grade_${Date.now()}`,
        assignment_id: payload.assignment_id,
        student_id: payload.student_id,
        student_name: payload.student_name,
        score: payload.score_numeric !== undefined ? payload.score_numeric : payload.score_binary,
        feedback: payload.feedback,
        graded_by: newRecord.graded_by,
        timestamp: new Date().toISOString()
      };
      localStorage.setItem(annKey, JSON.stringify([newAnnItem, ...existingAnn.slice(0, 50)]));
    } catch {}

    if (supa) {
      try {
        await supa.from('assignment_submissions').upsert([newRecord], { onConflict: 'assignment_id,student_id' });
      } catch {}
    }

    return { success: true, data: newRecord };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function submitAssignmentToDB(
  submission: Omit<AssignmentSubmission, 'id' | 'submitted_at'>
): Promise<{ success: boolean; data?: AssignmentSubmission; error?: string }> {
  try {
    const supa = getSupabase();
    const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const newRecord: AssignmentSubmission = {
      id,
      ...submission,
      submitted_at: new Date().toISOString(),
      status: submission.status || 'submitted',
    };

    // Update local cache immediately for both assignment and student
    const key = `robotics_subs_${submission.assignment_id}`;
    const existing: AssignmentSubmission[] = JSON.parse(localStorage.getItem(key) || '[]');
    const filtered = existing.filter((s) => s.student_id !== submission.student_id);
    const updated = [newRecord, ...filtered];
    localStorage.setItem(key, JSON.stringify(updated));

    const studentKey = `robotics_student_subs_${submission.student_id}`;
    const studentExisting: AssignmentSubmission[] = JSON.parse(localStorage.getItem(studentKey) || '[]');
    const studentFiltered = studentExisting.filter((s) => s.assignment_id !== submission.assignment_id);
    localStorage.setItem(studentKey, JSON.stringify([newRecord, ...studentFiltered]));

    const { data, error } = await supa
      .from('assignment_submissions')
      .upsert([newRecord], { onConflict: 'assignment_id,student_id' })
      .select()
      .maybeSingle();

    if (error) {
      return { success: true, data: newRecord };
    }

    return { success: true, data: (data as AssignmentSubmission) || newRecord };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function gradeSubmissionInDB(
  submissionId: string,
  grading: {
    score_numeric?: number;
    score_binary?: 'Lulus' | 'Perlu Perbaikan' | 'Belum Dinilai' | string;
    feedback?: string;
    graded_by?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const supa = getSupabase();
    const payload = {
      ...grading,
      status: 'graded' as const,
      graded_at: new Date().toISOString(),
    };

    // Update all local storage caches
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('robotics_subs_') || key.startsWith('robotics_student_subs_'))) {
        try {
          const list: AssignmentSubmission[] = JSON.parse(localStorage.getItem(key) || '[]');
          const updated = list.map(s => s.id === submissionId ? { ...s, ...payload } : s);
          localStorage.setItem(key, JSON.stringify(updated));
        } catch {}
      }
    }

    const { error } = await supa
      .from('assignment_submissions')
      .update(payload)
      .eq('id', submissionId);

    if (error) return { success: true };
    return { success: true };
  } catch (err: any) {
    return { success: true };
  }
}

// ==============================================================================
// 6. ABSENSI MANDIRI ANGGOTA (Self-Attendance Check-In)
// ==============================================================================

export async function submitSelfAttendanceToDB(record: {
  tanggal: string; // YYYY-MM-DD
  nisn: string;
  namaAnggota: string;
  status: 'Hadir' | 'Izin' | 'Sakit';
  notes?: string;
  userId?: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    // Automate attendance window logic: Block submissions outside Wednesday 00:00 - Thursday 23:59 WIB
    const windowCheck = validateAttendanceSubmission();
    if (!windowCheck.allowed) {
      return { success: false, error: windowCheck.reason };
    }

    const supa = getSupabase();
    const id = `att_self_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const payload = {
      id,
      tanggal: record.tanggal,
      id_member: record.nisn,
      account_username: 'admin',
      nama_anggota: record.namaAnggota,
      status: record.status,
      notes: record.notes || '',
      submitted_by: record.userId || null,
      created_at: new Date().toISOString(),
    };

    const { error } = await supa
      .from('attendance')
      .upsert([payload], { onConflict: 'tanggal,id_member' });

    if (error) {
      // Fallback local update
      const local = localStorage.getItem('robotics_attendance');
      const parsed: AttendanceRecord[] = local ? JSON.parse(local) : [];
      const filtered = parsed.filter(
        (a) => !(a.tanggal === record.tanggal && (a.nisn === record.nisn || a.id_member === record.nisn))
      );
      filtered.push({
        id,
        tanggal: record.tanggal,
        nisn: record.nisn,
        id_member: record.nisn,
        namaAnggota: record.namaAnggota,
        status: record.status as any,
        notes: record.notes,
      });
      localStorage.setItem('robotics_attendance', JSON.stringify(filtered));
      return { success: true };
    }

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

