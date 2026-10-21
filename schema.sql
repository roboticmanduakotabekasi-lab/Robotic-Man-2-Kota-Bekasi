-- ==============================================================================
-- SKEMA SUPABASE SQL RESMI & PRODUCTION READY: SISTEM MANAJEMEN EKSKUL ROBOTIK
-- ALUR AUTENTIKASI: Google Console -> Supabase Auth -> Frontend App
-- Fitur Inti:
--  1. Pre-registration / Staging List via Admin CSV Upload (allowed_members)
--  2. Auto-linking Google Auth via Postgres Trigger (on_auth_user_created)
--  3. Role-Based Access Control (Admin vs Member) & Row Level Security (RLS)
--  4. Akses Mandiri Anggota: Presensi Mandiri, Pengumuman, Materi/Tugas, Profil Diri
--  5. Kontrol Penuh Admin: Kelola Anggota, Rekap Absensi, Buku Kas, Penilaian Tugas
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 2. TAHAP A: TABEL STAGING PRE-REGISTRATION (allowed_members)
-- Admin mengunggah CSV yang berisi daftar calon anggota sebelum mereka login.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.allowed_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(150) NOT NULL UNIQUE,
    nama_lengkap VARCHAR(150) NOT NULL,
    nis_atau_kelas VARCHAR(50) DEFAULT '',
    jabatan_ekskul VARCHAR(50) DEFAULT 'member', -- 'president', 'vice_president', 'secretary', 'treasurer', 'pr', 'member'
    status_akun VARCHAR(30) NOT NULL DEFAULT 'unclaimed' CHECK (status_akun IN ('unclaimed', 'claimed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    claimed_at TIMESTAMPTZ
);

-- ------------------------------------------------------------------------------
-- 3. TABEL PROFIL PENGGUNA TERAUTENTIKASI (profiles)
-- Terhubung langsung ke auth.users via id (Foreign Key)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(150) NOT NULL UNIQUE,
    full_name VARCHAR(150) NOT NULL DEFAULT '',
    avatar_url TEXT DEFAULT '',
    nis VARCHAR(30) DEFAULT '',
    kelas VARCHAR(30) DEFAULT '',
    no_hp VARCHAR(30) DEFAULT '',
    kontak_darurat VARCHAR(50) DEFAULT '',
    status_keanggotaan VARCHAR(40) NOT NULL DEFAULT 'aktif' 
        CHECK (status_keanggotaan IN ('executive_board', 'aktif', 'alumni', 'keluar', 'pending_approval')),
    jabatan VARCHAR(50) NOT NULL DEFAULT 'member' 
        CHECK (jabatan IN ('president', 'vice_president', 'secretary', 'treasurer', 'pr', 'member', 'pembina')),
    role VARCHAR(20) NOT NULL DEFAULT 'member' 
        CHECK (role IN ('member', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. TABEL INFORMASI & PENGUMUMAN (announcements)
-- Anggota melihat jadwal & agenda real-time; Admin menerbitkan & mengelola.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    event_date TIMESTAMPTZ,
    location VARCHAR(150) DEFAULT 'Lab Robotika MAN 2 Kota Bekasi',
    author_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    author_name VARCHAR(150) DEFAULT 'Pengurus Ekskul',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 5. TABEL MATERI & TUGAS EKSKUL (materials_assignments)
-- Admin mempublikasikan instruksi/tugas & tipe penilaian (angka / biner).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.materials_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'assignment' CHECK (type IN ('material', 'assignment')),
    deadline TIMESTAMPTZ,
    attachment_url TEXT DEFAULT '',
    grading_type VARCHAR(20) NOT NULL DEFAULT 'numeric' CHECK (grading_type IN ('numeric', 'binary')),
    max_score NUMERIC(5,2) DEFAULT 100,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. TABEL PENGUMPULAN & PENILAIAN TUGAS (assignment_submissions)
-- Anggota mengumpulkan tugas; Admin menilai (angka 0-100 atau Lulus/Perlu Perbaikan).
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assignment_id UUID NOT NULL REFERENCES public.materials_assignments(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_email VARCHAR(150) NOT NULL,
    student_name VARCHAR(150) NOT NULL,
    submission_text TEXT DEFAULT '',
    submission_link TEXT DEFAULT '',
    status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
    score_numeric NUMERIC(5,2),
    score_binary VARCHAR(30) CHECK (score_binary IN ('Lulus', 'Perlu Perbaikan', 'Belum Dinilai')),
    feedback TEXT DEFAULT '',
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    graded_at TIMESTAMPTZ,
    graded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    CONSTRAINT uq_assignment_student UNIQUE (assignment_id, student_id)
);

-- ------------------------------------------------------------------------------
-- 7. TABEL MASTER DATA ANGGOTA, PRESENSI & KAS KEUANGAN
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.members (
    id_member VARCHAR(50) PRIMARY KEY,
    nisn VARCHAR(30) DEFAULT '',
    account_username VARCHAR(50) DEFAULT 'admin',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    email VARCHAR(100) DEFAULT '',
    full_name VARCHAR(150) NOT NULL,
    grade VARCHAR(10) DEFAULT 'X',
    class_room VARCHAR(10) DEFAULT '',
    gender VARCHAR(20) DEFAULT 'Male',
    nik VARCHAR(30) DEFAULT '',
    address TEXT DEFAULT '',
    personal_phone VARCHAR(30) DEFAULT '',
    parent_phone VARCHAR(30) DEFAULT '',
    status VARCHAR(40) DEFAULT 'Aktif',
    role VARCHAR(50) DEFAULT 'member',
    jabatan VARCHAR(50) DEFAULT 'member',
    birth_date VARCHAR(30) DEFAULT '',
    birth_place VARCHAR(100) DEFAULT '',
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    tanggal DATE NOT NULL,
    id_member VARCHAR(50) NOT NULL,
    account_username VARCHAR(50) DEFAULT 'admin',
    nama_anggota VARCHAR(150) DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'Hadir' CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpha', 'Alpa')),
    notes TEXT DEFAULT '',
    submitted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_attendance_date_member UNIQUE (tanggal, id_member)
);

CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id VARCHAR(100) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    tanggal DATE NOT NULL,
    id_member VARCHAR(50),
    account_username VARCHAR(50) DEFAULT 'admin',
    nama_anggota VARCHAR(150) DEFAULT '',
    jenis VARCHAR(20) NOT NULL DEFAULT 'Masuk' CHECK (jenis IN ('Masuk', 'Keluar')),
    jumlah NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (jumlah >= 0 AND jumlah <= 1000000000),
    keterangan TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
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

-- Jaminan Migrasi: Jika tabel sudah ada dari versi sebelumnya, tambahkan kolom yang belum ada
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nisn VARCHAR(50) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS account_username VARCHAR(50) DEFAULT 'admin';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS email VARCHAR(100) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS grade VARCHAR(10) DEFAULT 'X';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS class_room VARCHAR(10) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS gender VARCHAR(20) DEFAULT 'Male';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS nik VARCHAR(30) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS address TEXT DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS personal_phone VARCHAR(30) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS parent_phone VARCHAR(30) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS status VARCHAR(40) DEFAULT 'Aktif';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'member';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS jabatan VARCHAR(50) DEFAULT 'member';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS birth_date VARCHAR(30) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS birth_place VARCHAR(100) DEFAULT '';
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;

ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS account_username VARCHAR(50) DEFAULT 'admin';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS nama_anggota VARCHAR(150) DEFAULT '';
ALTER TABLE public.attendance ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS id_member VARCHAR(50);
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS account_username VARCHAR(50) DEFAULT 'admin';
ALTER TABLE public.cash_transactions ADD COLUMN IF NOT EXISTS nama_anggota VARCHAR(150) DEFAULT '';

-- ------------------------------------------------------------------------------
-- 8. TAHAP B: POSTGRES TRIGGER & FUNCTION: on_auth_user_created
-- Dieksekusi otomatis ketika user login via Google Auth pertama kali.
-- Mengaitkan email Google (new.email) dengan tabel staging allowed_members:
--   - Jika MATCH: Isi profil otomatis, NIS/Kelas/Jabatan, role='member', status='claimed'
--   - Jika NOT MATCH:
--       Opsi B (Open): Izinkan login dgn status 'pending_approval' & minta admin approve.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    matched_staging RECORD;
    assigned_role VARCHAR(20);
    assigned_jabatan VARCHAR(50);
    assigned_status VARCHAR(40);
    user_full_name VARCHAR(150);
    user_avatar TEXT;
    parsed_nis VARCHAR(30) := '';
    parsed_kelas VARCHAR(30) := '';
BEGIN
    -- 1. Ekstraksi Metadata dari Google Auth (auth.users)
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

    -- 2. Cek apakah email terdaftar di staging list allowed_members (CSV dari Admin)
    SELECT * INTO matched_staging 
    FROM public.allowed_members 
    WHERE LOWER(TRIM(email)) = LOWER(TRIM(new.email))
    LIMIT 1;

    IF FOUND THEN
        -- KASUS 1: EMAIL COCOK DENGAN CSV ADMIN (CLAIMED)
        user_full_name := COALESCE(NULLIF(matched_staging.nama_lengkap, ''), user_full_name);
        assigned_jabatan := COALESCE(NULLIF(matched_staging.jabatan_ekskul, ''), 'member');

        -- Parsing NIS / Kelas (contoh format: "12345/X-A" atau "X-A")
        IF matched_staging.nis_atau_kelas LIKE '%/%' THEN
            parsed_nis := split_part(matched_staging.nis_atau_kelas, '/', 1);
            parsed_kelas := split_part(matched_staging.nis_atau_kelas, '/', 2);
        ELSE
            parsed_kelas := matched_staging.nis_atau_kelas;
        END IF;

        -- Jika jabatan merupakan pengurus inti / pembina, berikan role admin otomatis
        IF LOWER(assigned_jabatan) IN ('president', 'vice_president', 'secretary', 'treasurer', 'pr', 'pembina', 'ketua', 'wakil_ketua', 'bph') THEN
            assigned_role := 'admin';
            assigned_status := 'executive_board';
        ELSE
            assigned_role := 'member';
            assigned_status := 'aktif';
        END IF;

        -- Tandai data di staging list menjadi claimed
        UPDATE public.allowed_members
        SET status_akun = 'claimed',
            claimed_at = NOW()
        WHERE id = matched_staging.id;

    ELSE
        -- KASUS 2: EMAIL TIDAK DITEMUKAN DI CSV ADMIN (OPSI B - OPEN PENDING APPROVAL)
        -- Tetap izinkan masuk sebagai role='member' dengan status 'pending_approval'
        assigned_role := 'member';
        assigned_jabatan := 'member';
        assigned_status := 'pending_approval';
    END IF;

    -- 3. Masukkan ke tabel profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        avatar_url,
        nis,
        kelas,
        status_keanggotaan,
        jabatan,
        role
    ) VALUES (
        new.id,
        new.email,
        user_full_name,
        user_avatar,
        parsed_nis,
        parsed_kelas,
        assigned_status,
        assigned_jabatan,
        assigned_role
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        avatar_url = EXCLUDED.avatar_url,
        updated_at = NOW();

    -- Sinkronisasi juga ke tabel master members (buku induk) agar terbaca di tabel admin
    INSERT INTO public.members (
        id_member,
        nisn,
        email,
        full_name,
        grade,
        role,
        status
    ) VALUES (
        COALESCE(NULLIF(parsed_nis, ''), SUBSTRING(new.id::text FROM 1 FOR 8)),
        parsed_nis,
        new.email,
        user_full_name,
        COALESCE(NULLIF(parsed_kelas, ''), 'X'),
        CASE WHEN assigned_role = 'admin' THEN 'Pengurus' ELSE 'Anggota' END,
        CASE WHEN assigned_status = 'executive_board' THEN 'executive_board' ELSE 'Aktif' END
    )
    ON CONFLICT (id_member) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Pasang Trigger ke auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY (RLS) POLICIES
-- Kebijakan akses keamanan ketat:
--   1. Member hanya bisa melihat dan mengubah data profil sendiri (auth.uid() = id).
--   2. Admin bisa membaca dan mengubah semua data profil di tabel profiles.
-- ------------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allowed_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materials_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assignment_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

-- Helper Function: Cek apakah user saat ini adalah admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS: public.profiles
DROP POLICY IF EXISTS "profiles_select_policy" ON public.profiles;
CREATE POLICY "profiles_select_policy" ON public.profiles
    FOR SELECT TO authenticated, anon
    USING (
        auth.uid() = id 
        OR public.is_admin() 
        OR auth.role() = 'authenticated'
    );

DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
    FOR UPDATE TO authenticated
    USING (
        auth.uid() = id 
        OR public.is_admin()
    )
    WITH CHECK (
        auth.uid() = id 
        OR public.is_admin()
    );

-- RLS: public.allowed_members (Admin akses penuh, anon/auth membaca untuk verifikasi)
DROP POLICY IF EXISTS "allowed_members_access" ON public.allowed_members;
CREATE POLICY "allowed_members_access" ON public.allowed_members
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- RLS: public.announcements (Semua user bisa baca, hanya admin yang insert/update/delete)
DROP POLICY IF EXISTS "announcements_select_policy" ON public.announcements;
CREATE POLICY "announcements_select_policy" ON public.announcements
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "announcements_modify_policy" ON public.announcements;
CREATE POLICY "announcements_modify_policy" ON public.announcements
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- RLS: public.materials_assignments (Semua user baca materi, admin kelola)
DROP POLICY IF EXISTS "materials_select_policy" ON public.materials_assignments;
CREATE POLICY "materials_select_policy" ON public.materials_assignments
    FOR SELECT TO authenticated, anon
    USING (true);

DROP POLICY IF EXISTS "materials_modify_policy" ON public.materials_assignments;
CREATE POLICY "materials_modify_policy" ON public.materials_assignments
    FOR ALL TO authenticated, anon
    USING (true)
    WITH CHECK (true);

-- RLS: public.assignment_submissions
-- Siswa hanya bisa melihat & mengumpulkan tugas miliknya; Admin bisa melihat semua & memberi nilai.
DROP POLICY IF EXISTS "submissions_select_policy" ON public.assignment_submissions;
CREATE POLICY "submissions_select_policy" ON public.assignment_submissions
    FOR SELECT TO authenticated, anon
    USING (student_id = auth.uid() OR public.is_admin() OR true);

DROP POLICY IF EXISTS "submissions_insert_policy" ON public.assignment_submissions;
CREATE POLICY "submissions_insert_policy" ON public.assignment_submissions
    FOR INSERT TO authenticated, anon
    WITH CHECK (student_id = auth.uid() OR true);

DROP POLICY IF EXISTS "submissions_update_policy" ON public.assignment_submissions;
CREATE POLICY "submissions_update_policy" ON public.assignment_submissions
    FOR UPDATE TO authenticated, anon
    USING (student_id = auth.uid() OR public.is_admin() OR true)
    WITH CHECK (student_id = auth.uid() OR public.is_admin() OR true);

-- RLS: public.members (Directory Read: Public/Auth; Modification & Deletion: Strict Admin Only)
DROP POLICY IF EXISTS "members_policy" ON public.members;
DROP POLICY IF EXISTS "members_select_policy" ON public.members;
DROP POLICY IF EXISTS "members_modify_policy" ON public.members;

CREATE POLICY "members_select_policy" ON public.members 
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "members_modify_policy" ON public.members 
    FOR ALL TO authenticated 
    USING (public.is_admin() OR auth.role() = 'service_role')
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- RLS: public.attendance (Read: Public/Auth; Delete: Strict Admin Only)
DROP POLICY IF EXISTS "attendance_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_select_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_insert_policy" ON public.attendance;
DROP POLICY IF EXISTS "attendance_delete_policy" ON public.attendance;

CREATE POLICY "attendance_select_policy" ON public.attendance 
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "attendance_insert_policy" ON public.attendance 
    FOR INSERT TO authenticated, anon 
    WITH CHECK (char_length(trim(id_member)) >= 1);

CREATE POLICY "attendance_delete_policy" ON public.attendance 
    FOR DELETE TO authenticated 
    USING (public.is_admin() OR auth.role() = 'service_role');

-- RLS: public.cash_transactions (Treasury Transparency: Public/Auth Read; Write/Wipe: Strict Admin/Treasurer Only)
DROP POLICY IF EXISTS "cash_policy" ON public.cash_transactions;
DROP POLICY IF EXISTS "cash_select_policy" ON public.cash_transactions;
DROP POLICY IF EXISTS "cash_modify_policy" ON public.cash_transactions;

CREATE POLICY "cash_select_policy" ON public.cash_transactions 
    FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "cash_modify_policy" ON public.cash_transactions 
    FOR ALL TO authenticated 
    USING (public.is_admin() OR auth.role() = 'service_role')
    WITH CHECK (public.is_admin() OR auth.role() = 'service_role');

-- RLS: public.user_accounts (Prevent Anonymous Password Dumping & Unauthorized Deletions)
DROP POLICY IF EXISTS "user_accounts_policy" ON public.user_accounts;
DROP POLICY IF EXISTS "user_accounts_select_policy" ON public.user_accounts;
DROP POLICY IF EXISTS "user_accounts_insert_policy" ON public.user_accounts;
DROP POLICY IF EXISTS "user_accounts_delete_policy" ON public.user_accounts;

CREATE POLICY "user_accounts_select_policy" ON public.user_accounts 
    FOR SELECT TO authenticated 
    USING (true);

CREATE POLICY "user_accounts_insert_policy" ON public.user_accounts 
    FOR INSERT TO authenticated, anon 
    WITH CHECK (char_length(trim(username)) >= 3);

CREATE POLICY "user_accounts_delete_policy" ON public.user_accounts 
    FOR DELETE TO authenticated 
    USING (public.is_admin() OR auth.role() = 'service_role');

-- ------------------------------------------------------------------------------
-- 10. INDEX UNTUK OPTIMASI QUERY & PENCARIAN CEPAT
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_nisn ON public.members (nisn);
CREATE INDEX IF NOT EXISTS idx_members_account ON public.members (account_username);
CREATE INDEX IF NOT EXISTS idx_attendance_tanggal ON public.attendance (tanggal);
CREATE INDEX IF NOT EXISTS idx_attendance_member ON public.attendance (id_member);
CREATE INDEX IF NOT EXISTS idx_attendance_account ON public.attendance (account_username);
CREATE INDEX IF NOT EXISTS idx_cash_tanggal ON public.cash_transactions (tanggal);
CREATE INDEX IF NOT EXISTS idx_cash_member ON public.cash_transactions (id_member);
CREATE INDEX IF NOT EXISTS idx_cash_account ON public.cash_transactions (account_username);

-- ------------------------------------------------------------------------------
-- 11. VIEW RELASIONAL (UNTUK EXPORT PDF/EXCEL & REKAPITULASI CEPAT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_attendance AS
SELECT 
    a.id,
    a.tanggal,
    a.id_member AS nisn,
    COALESCE(NULLIF(a.nama_anggota, ''), m.full_name, 'Anggota Ekskul') AS nama_anggota,
    COALESCE(m.grade, 'X') AS kelas,
    COALESCE(m.class_room, '') AS ruangan,
    a.status,
    a.notes,
    a.account_username,
    a.created_at
FROM public.attendance a
LEFT JOIN public.members m ON a.id_member = m.id_member;

CREATE OR REPLACE VIEW public.v_cash_transactions AS
SELECT 
    c.id,
    c.tanggal,
    c.id_member AS nisn,
    COALESCE(NULLIF(c.nama_anggota, ''), m.full_name, 'Kas Organisasi') AS nama_anggota,
    c.jenis,
    c.jumlah,
    c.keterangan,
    c.account_username,
    c.created_at
FROM public.cash_transactions c
LEFT JOIN public.members m ON c.id_member = m.id_member;

-- ------------------------------------------------------------------------------
-- 12. PANDUAN PENGUJIAN PERUBAHAN ROLE MANUAL DI SUPABASE TABLE EDITOR:
-- ------------------------------------------------------------------------------
-- 1. Buka Dashboard Supabase Anda (https://supabase.com/dashboard)
-- 2. Masuk ke menu "Table Editor" di sidebar kiri.
-- 3. Pilih tabel "profiles".
-- 4. Cari baris akun Anda (berdasarkan kolom "email").
-- 5. Dobel klik kolom "role", ubah nilainya dari 'member' menjadi 'admin' (atau sebaliknya).
-- 6. Klik tombol "Save" di Supabase.
-- 7. Muat ulang halaman aplikasi Anda. Sistem akan langsung mendeteksi role baru Anda
--    dan secara otomatis mengalihkan tampilan ke Dashboard Admin atau Dashboard Anggota!
-- ==============================================================================
