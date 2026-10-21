-- ==============================================================================
-- SKEMA DDL LENGKAP SUPABASE / POSTGRESQL (MULTI-TENANT ISOLATED PRODUCTION)
-- APLIKASI: roboticman2kotabekasi
-- Fitur: Isolasi ketat account_username, RLS dinamis JWT, Auto-trigger, Foreign Keys,
--        Composite Indexes, dan Relasi auth.users.
-- ==============================================================================

-- 1. BERSIHKAN VIEW & TABEL LAMA (JIKA ADA)
DROP VIEW IF EXISTS public.v_attendance CASCADE;
DROP VIEW IF EXISTS public.v_cash_transactions CASCADE;
DROP TRIGGER IF EXISTS trg_members_set_account ON public.members CASCADE;
DROP TRIGGER IF EXISTS trg_attendance_set_account ON public.attendance CASCADE;
DROP TRIGGER IF EXISTS trg_cash_set_account ON public.cash_transactions CASCADE;
DROP FUNCTION IF EXISTS public.tg_set_account_username CASCADE;
DROP FUNCTION IF EXISTS public.current_account_username CASCADE;
DROP TABLE IF EXISTS public.attendance CASCADE;
DROP TABLE IF EXISTS public.cash_transactions CASCADE;
DROP TABLE IF EXISTS public.members CASCADE;
DROP TABLE IF EXISTS public.user_accounts CASCADE;

-- ------------------------------------------------------------------------------
-- 2. FUNGSI HELPER EKSTRAKSI USERNAME TERAUTENTIKASI (JWT & AUTH CONTEXT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_account_username()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    claim_val text;
BEGIN
    -- A. Ekstraksi dari claims JWT Supabase Auth bawaan
    claim_val := COALESCE(
        auth.jwt() ->> 'preferred_username',
        auth.jwt() -> 'user_metadata' ->> 'username',
        auth.jwt() -> 'app_metadata' ->> 'username',
        auth.jwt() ->> 'email'
    );

    IF claim_val IS NOT NULL AND trim(claim_val) <> '' THEN
        RETURN lower(trim(claim_val));
    END IF;

    -- B. Pemetaan via auth.uid() ke tabel user_accounts
    IF auth.uid() IS NOT NULL THEN
        SELECT lower(username) INTO claim_val
        FROM public.user_accounts
        WHERE auth_user_id = auth.uid()
        LIMIT 1;

        IF claim_val IS NOT NULL AND trim(claim_val) <> '' THEN
            RETURN claim_val;
        END IF;

        RETURN auth.uid()::text;
    END IF;

    -- C. Fallback untuk custom session header (x-account-username)
    BEGIN
        claim_val := current_setting('request.headers', true)::jsonb ->> 'x-account-username';
        IF claim_val IS NOT NULL AND trim(claim_val) <> '' THEN
            RETURN lower(trim(claim_val));
        END IF;
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    RETURN NULL;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. TABEL AUTENTIKASI PENGURUS (user_accounts) DENGAN RUJUKAN auth.users
-- ------------------------------------------------------------------------------
CREATE TABLE public.user_accounts (
    username VARCHAR(50) PRIMARY KEY,
    auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Relasi ke Supabase Auth
    password TEXT NOT NULL DEFAULT '',                              -- Hash SHA-256 kredensial lokal
    name VARCHAR(100) NOT NULL DEFAULT '',
    role VARCHAR(50) NOT NULL DEFAULT 'Pengurus Inti',
    email VARCHAR(100) DEFAULT '',
    auth_provider VARCHAR(50) DEFAULT 'credentials',
    avatar_url TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_username_length CHECK (char_length(trim(username)) >= 3)
);

-- ------------------------------------------------------------------------------
-- 4. TABEL MASTER DATA ANGGOTA (members) - ISOLASI PER AKUN
-- ------------------------------------------------------------------------------
CREATE TABLE public.members (
    id_member VARCHAR(50) NOT NULL,               -- NISN Anggota
    account_username VARCHAR(50) NOT NULL,        -- Akun pemilik data
    nisn VARCHAR(50) DEFAULT '',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    email VARCHAR(100) DEFAULT '',
    full_name VARCHAR(150) NOT NULL,
    grade VARCHAR(10) DEFAULT 'X',                -- X, XI, XII
    class_room VARCHAR(10) DEFAULT '',            -- Ruangan/Jurusan (A, B, C, dst.)
    gender VARCHAR(20) DEFAULT 'Male',
    nik VARCHAR(30) DEFAULT '',
    address TEXT DEFAULT '',
    personal_phone VARCHAR(30) DEFAULT '',
    parent_phone VARCHAR(30) DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT pk_members PRIMARY KEY (account_username, id_member)
);

-- ------------------------------------------------------------------------------
-- 5. TABEL PRESENSI KEGIATAN (attendance) - RELASI DUA KUNCI (ACCOUNT + MEMBER)
-- ------------------------------------------------------------------------------
CREATE TABLE public.attendance (
    id VARCHAR(100) PRIMARY KEY,
    account_username VARCHAR(50) NOT NULL,
    tanggal DATE NOT NULL,
    id_member VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Hadir',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_attendance_account_member 
        FOREIGN KEY (account_username, id_member) 
        REFERENCES public.members(account_username, id_member) 
        ON UPDATE CASCADE 
        ON DELETE CASCADE,
    CONSTRAINT uq_attendance_account_date_member 
        UNIQUE (account_username, tanggal, id_member),
    CONSTRAINT chk_attendance_status 
        CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpa'))
);

-- ------------------------------------------------------------------------------
-- 6. TABEL BUKU KAS BENDAHARA (cash_transactions)
-- ------------------------------------------------------------------------------
CREATE TABLE public.cash_transactions (
    id VARCHAR(100) PRIMARY KEY,
    account_username VARCHAR(50) NOT NULL,
    tanggal DATE NOT NULL,
    id_member VARCHAR(50),                        -- NULL jika kas umum operasional
    jenis VARCHAR(20) NOT NULL DEFAULT 'Masuk',   -- 'Masuk' atau 'Keluar'
    jumlah NUMERIC(12, 2) NOT NULL DEFAULT 0,
    keterangan TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT fk_cash_account_member 
        FOREIGN KEY (account_username, id_member) 
        REFERENCES public.members(account_username, id_member) 
        ON UPDATE CASCADE 
        ON DELETE SET NULL,
    CONSTRAINT chk_cash_jenis 
        CHECK (jenis IN ('Masuk', 'Keluar')),
    CONSTRAINT chk_cash_jumlah_valid 
        CHECK (jumlah >= 0 AND jumlah <= 1000000000)
);

-- ------------------------------------------------------------------------------
-- 7. TRIGGER OTOMATISASI & INTEGRITAS account_username
-- Menjamin account_username selalu terisi dari identitas login yang sah
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.tg_set_account_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    auth_user text;
BEGIN
    auth_user := public.current_account_username();

    -- Jika eksekusi dilakukan oleh service_role (migrasi/seeding backend)
    IF (auth.jwt() ->> 'role') = 'service_role' OR auth.role() = 'service_role' THEN
        IF NEW.account_username IS NULL OR trim(NEW.account_username) = '' THEN
            NEW.account_username := COALESCE(auth_user, 'admin');
        END IF;
        RETURN NEW;
    END IF;

    -- Untuk operasi standar dari client/pengguna:
    -- Jika user terautentikasi, paksa nilainya sesuai akun JWT aktif (mencegah manipulasi payload)
    IF auth_user IS NOT NULL AND trim(auth_user) <> '' THEN
        NEW.account_username := auth_user;
    ELSIF NEW.account_username IS NULL OR trim(NEW.account_username) = '' THEN
        RAISE EXCEPTION 'Operasi ditolak: account_username tidak boleh kosong dan pengguna harus login.';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_members_set_account
    BEFORE INSERT OR UPDATE ON public.members
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_account_username();

CREATE TRIGGER trg_attendance_set_account
    BEFORE INSERT OR UPDATE ON public.attendance
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_account_username();

CREATE TRIGGER trg_cash_set_account
    BEFORE INSERT OR UPDATE ON public.cash_transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.tg_set_account_username();

-- ------------------------------------------------------------------------------
-- 8. ROW LEVEL SECURITY (RLS) - ISOLASI KETAT DATA ANTAR AKUN
-- ------------------------------------------------------------------------------
ALTER TABLE public.user_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

-- Policy user_accounts: Pengguna hanya melihat dan memperbarui profilnya sendiri
CREATE POLICY "user_accounts_select_own" ON public.user_accounts
    FOR SELECT TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(username) = public.current_account_username()
        OR (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
    );

CREATE POLICY "user_accounts_insert_register" ON public.user_accounts
    FOR INSERT TO authenticated, anon
    WITH CHECK (char_length(trim(username)) >= 3);

CREATE POLICY "user_accounts_update_own" ON public.user_accounts
    FOR UPDATE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(username) = public.current_account_username()
        OR (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(username) = public.current_account_username()
        OR (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
    );

CREATE POLICY "user_accounts_delete_own" ON public.user_accounts
    FOR DELETE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(username) = public.current_account_username()
        OR (auth.uid() IS NOT NULL AND auth_user_id = auth.uid())
    );

-- Policy members: Hanya baris data milik akun login aktif
CREATE POLICY "members_select_isolated" ON public.members
    FOR SELECT TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "members_insert_isolated" ON public.members
    FOR INSERT TO authenticated, anon
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "members_update_isolated" ON public.members
    FOR UPDATE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "members_delete_isolated" ON public.members
    FOR DELETE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

-- Policy attendance: Hanya baris data presensi milik akun login aktif
CREATE POLICY "attendance_select_isolated" ON public.attendance
    FOR SELECT TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "attendance_insert_isolated" ON public.attendance
    FOR INSERT TO authenticated, anon
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "attendance_update_isolated" ON public.attendance
    FOR UPDATE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "attendance_delete_isolated" ON public.attendance
    FOR DELETE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

-- Policy cash_transactions: Hanya baris transaksi kas milik akun login aktif
CREATE POLICY "cash_select_isolated" ON public.cash_transactions
    FOR SELECT TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "cash_insert_isolated" ON public.cash_transactions
    FOR INSERT TO authenticated, anon
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "cash_update_isolated" ON public.cash_transactions
    FOR UPDATE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    )
    WITH CHECK (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

CREATE POLICY "cash_delete_isolated" ON public.cash_transactions
    FOR DELETE TO authenticated, anon
    USING (
        (auth.jwt() ->> 'role') = 'service_role'
        OR lower(account_username) = public.current_account_username()
    );

-- ------------------------------------------------------------------------------
-- 9. OPTIMASI INDEKS KOMPOSIT UNTUK QUERY TINGGI & MULTI-TENANT
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_members_account_id 
    ON public.members (account_username, id_member);

CREATE INDEX IF NOT EXISTS idx_members_account_grade 
    ON public.members (account_username, grade, class_room);

CREATE INDEX IF NOT EXISTS idx_attendance_account_tgl 
    ON public.attendance (account_username, tanggal DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_account_member 
    ON public.attendance (account_username, id_member);

CREATE INDEX IF NOT EXISTS idx_cash_account_tgl 
    ON public.cash_transactions (account_username, tanggal DESC);

CREATE INDEX IF NOT EXISTS idx_cash_account_member 
    ON public.cash_transactions (account_username, id_member);

CREATE INDEX IF NOT EXISTS idx_user_accounts_auth_id 
    ON public.user_accounts (auth_user_id);

-- ------------------------------------------------------------------------------
-- 10. VIEW RELASIONAL MULTI-TENANT (JOIN SECURE PER ACCOUNT)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.v_attendance AS
SELECT 
    a.id,
    a.account_username,
    a.tanggal,
    a.id_member AS nisn,
    m.full_name AS nama_anggota,
    m.grade AS kelas,
    m.class_room AS ruangan,
    a.status,
    a.created_at
FROM public.attendance a
JOIN public.members m 
    ON a.account_username = m.account_username 
    AND a.id_member = m.id_member;

CREATE OR REPLACE VIEW public.v_cash_transactions AS
SELECT 
    c.id,
    c.account_username,
    c.tanggal,
    c.id_member AS nisn,
    COALESCE(m.full_name, 'Kas Organisasi') AS nama_anggota,
    c.jenis,
    c.jumlah,
    c.keterangan,
    c.created_at
FROM public.cash_transactions c
LEFT JOIN public.members m 
    ON c.account_username = m.account_username 
    AND c.id_member = m.id_member;
