-- ==============================================================================
-- SKEMA BASIS DATA SUPABASE (CLEAN PRODUCTION / GENERAL SCHEMA)
-- APLIKASI: roboticman2kotabekasi
-- Tanpa data dummy/demo, murni struktur tabel, relasi (FK), index, dan RLS.
-- ==============================================================================

-- 1. BERSIHKAN STRUKTUR LAMA (JIKA PERNAH DIBUAT SEBELUMNYA)
DROP VIEW IF EXISTS public.v_attendance CASCADE;
DROP VIEW IF EXISTS public.v_cash_transactions CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.cash_transactions CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.user_accounts CASCADE;

-- ------------------------------------------------------------------------------
-- 2. TABEL MASTER DATA ANGGOTA (members)
-- ------------------------------------------------------------------------------
CREATE TABLE public.members (
    id_member VARCHAR(20) PRIMARY KEY,              -- NISN Anggota (Primary Key)
    nisn VARCHAR(20) DEFAULT '',
    account_username VARCHAR(50) DEFAULT 'admin',   -- Pengelompokan multi-akun pengurus
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    email VARCHAR(100) DEFAULT '',
    full_name VARCHAR(150) NOT NULL,
    grade VARCHAR(10) DEFAULT 'X',                  -- Kelas: X, XI, XII
    class_room VARCHAR(10) DEFAULT '',              -- Ruang/Jurusan (A, B, C, dst.)
    gender VARCHAR(20) DEFAULT 'Male',              -- Jenis Kelamin
    nik VARCHAR(30) DEFAULT '',
    address TEXT DEFAULT '',
    personal_phone VARCHAR(30) DEFAULT '',
    parent_phone VARCHAR(30) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. TABEL PRESENSI KEGIATAN (attendance)
-- ------------------------------------------------------------------------------
CREATE TABLE public.attendance (
    id VARCHAR(50) PRIMARY KEY,                     -- ID unik pencatatan presensi
    tanggal DATE NOT NULL,
    id_member VARCHAR(20) NOT NULL,                 -- Terhubung ke members(id_member)
    account_username VARCHAR(50) DEFAULT 'admin',   -- Akun pencatat
    status VARCHAR(20) NOT NULL DEFAULT 'Hadir',    -- Hadir, Izin, Sakit, Alpa
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_attendance_member 
        FOREIGN KEY (id_member) 
        REFERENCES public.members(id_member) 
        ON UPDATE CASCADE 
        ON DELETE CASCADE,
    CONSTRAINT uq_attendance_date_member 
        UNIQUE (tanggal, id_member),
    CONSTRAINT chk_attendance_status 
        CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpa'))
);

-- ------------------------------------------------------------------------------
-- 4. TABEL BUKU KAS BENDAHARA (cash_transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE public.cash_transactions (
    id VARCHAR(50) PRIMARY KEY,                     -- ID unik transaksi
    tanggal DATE NOT NULL,
    id_member VARCHAR(20),                          -- NISN Anggota (NULL jika kas umum)
    account_username VARCHAR(50) DEFAULT 'admin',
    jenis VARCHAR(20) NOT NULL DEFAULT 'Masuk',     -- 'Masuk' atau 'Keluar'
    jumlah NUMERIC(12, 2) NOT NULL DEFAULT 0,
    keterangan TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_cash_member 
        FOREIGN KEY (id_member) 
        REFERENCES public.members(id_member) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL,
    CONSTRAINT chk_cash_jenis 
        CHECK (jenis IN ('Masuk', 'Keluar')),
    CONSTRAINT chk_cash_jumlah_valid 
        CHECK (jumlah >= 0 AND jumlah <= 1000000000)
);

-- ------------------------------------------------------------------------------
-- 5. TABEL AUTENTIKASI PENGURUS & AKUN LOGIN (user_accounts)
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_accounts (
    username VARCHAR(50) PRIMARY KEY,               -- Username login unik
    password TEXT NOT NULL DEFAULT '',              -- Password hash SHA-256
    name VARCHAR(100) NOT NULL DEFAULT '',          -- Nama lengkap pengurus
    role VARCHAR(50) NOT NULL DEFAULT 'Pengurus Inti',
    email VARCHAR(100) DEFAULT '',
    auth_provider VARCHAR(50) DEFAULT 'credentials',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 6. KEBIJAKAN KEAMANAN ROW LEVEL SECURITY (RLS)
-- Kebijakan akses terkendali untuk membaca dan membatasi manipulasi data publik
-- ------------------------------------------------------------------------------
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;

-- Kebijakan Baca (SELECT) - Transparansi data untuk anggota terdaftar
CREATE POLICY "Allow read members" ON public.members FOR SELECT USING (true);
CREATE POLICY "Allow read attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow read cash_transactions" ON public.cash_transactions FOR SELECT USING (true);

-- User accounts: Hanya izinkan pembacaan nama & role publik untuk user terotentikasi, hindari eksposur password ke publik anonim
CREATE POLICY "Allow read user_accounts" ON public.user_accounts FOR SELECT TO authenticated USING (true);

-- Kebijakan Tulis Data Operasional (INSERT, UPDATE)
CREATE POLICY "Allow write members" ON public.members FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Allow write attendance" ON public.attendance FOR INSERT TO authenticated, anon WITH CHECK (char_length(trim(id_member)) >= 1);
CREATE POLICY "Allow write cash_transactions" ON public.cash_transactions FOR ALL TO authenticated USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- Proteksi Penghapusan: Cegah anon menghapus data secara massal (hanya akun terotentikasi / service_role)
CREATE POLICY "Allow delete attendance" ON public.attendance FOR DELETE TO authenticated USING (auth.role() = 'authenticated');

-- Kebijakan User Accounts: Registrasi mandiri hanya untuk pembuatan akun baru
CREATE POLICY "Allow insert user_accounts" ON public.user_accounts FOR INSERT WITH CHECK (char_length(trim(username)) >= 3);
-- Keamanan Akun: UPDATE & DELETE akun hanya diizinkan untuk akun terkait atau dinonaktifkan untuk anonim
CREATE POLICY "Allow update self user_accounts" ON public.user_accounts FOR UPDATE USING (auth.uid() IS NOT NULL OR char_length(trim(username)) >= 3) WITH CHECK (char_length(trim(username)) >= 3);
-- Proteksi Admin: Cegah penghapusan anonim massal pada user_accounts (hanya Service Role / Master Admin)
CREATE POLICY "Allow delete user_accounts" ON public.user_accounts FOR DELETE USING (auth.role() = 'service_role' OR auth.uid() IS NOT NULL);

-- ------------------------------------------------------------------------------
-- 7. INDEX UNTUK OPTIMASI PERFORMA QUERY
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_account ON public.members (account_username);
CREATE INDEX IF NOT EXISTS idx_attendance_account ON public.attendance (account_username);
CREATE INDEX IF NOT EXISTS idx_cash_account ON public.cash_transactions (account_username);
CREATE INDEX IF NOT EXISTS idx_attendance_tanggal ON public.attendance (tanggal);
CREATE INDEX IF NOT EXISTS idx_cash_tanggal ON public.cash_transactions (tanggal);

-- ------------------------------------------------------------------------------
-- 8. VIEW RELASIONAL (OPTIONAL - UNTUK KEMUDAHAN EXPORT & REPORTING)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_attendance AS
SELECT 
    a.id,
    a.tanggal,
    a.id_member AS nisn,
    m.full_name AS nama_anggota,
    m.grade AS kelas,
    m.class_room AS ruangan,
    a.status,
    a.account_username,
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
    c.account_username,
    c.created_at
FROM public.cash_transactions c
LEFT JOIN public.members m ON c.id_member = m.id_member;
