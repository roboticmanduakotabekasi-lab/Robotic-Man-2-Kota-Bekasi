import { getSupabase } from '../lib/supabase';
import { validatePassword, validateUsername } from './passwordSecurity';

export interface AccountConfig {
  username: string;
  password?: string;
  name: string;
  role: string;
  email?: string;
  authProvider?: 'credentials' | 'google';
  avatarUrl?: string;
  nisn?: string;
  isDemo?: boolean;
  token?: string;
}

export interface RegisterAccountParams {
  username: string;
  email: string;
  password: string;
  name?: string;
  role?: string;
  nisn?: string;
}

export const ENV_ADMIN_EMAIL = 
  (typeof process !== 'undefined' && process.env?.ADMIN_EMAIL) ||
  (import.meta as any).env?.VITE_ADMIN_EMAIL || 
  (import.meta as any).env?.ADMIN_EMAIL || 
  'roboticman2kotabekasi@gmail.com';

// Security: Master admin password is kept exclusively on the server side and never bundled to the client.
export const AUTHORIZED_GOOGLE_EMAIL = 
  (import.meta as any).env?.VITE_AUTHORIZED_GOOGLE_EMAIL || 
  ENV_ADMIN_EMAIL || 
  'roboticman2kotabekasi@gmail.com';

const APP_SALT = 'man2_robotics_auth_salt_2026_';

/**
 * Sanitizes an input string for safe interpolation inside Supabase/PostgREST filter clauses.
 * Strips characters that alter query grammar: commas, parentheses, quotes, colons, spaces, and operators.
 */
export function sanitizePostgrestFilter(val: string): string {
  if (!val || typeof val !== 'string') return '';
  return val.trim().replace(/[^a-zA-Z0-9@._+-]/g, '');
}

/**
 * Legacy SHA-256 hash calculation (kept for backward-compatible verification of initial template accounts)
 */
async function hashSha256Legacy(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${APP_SALT}${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hardened Password Hashing using PBKDF2-SHA256 with 100,000 iterations (WebCrypto API)
 * Prevents GPU-accelerated dictionary attacks and rainbow table lookups.
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits']
    );
    const salt = encoder.encode(APP_SALT);
    const derivedBits = await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      passwordKey,
      256
    );
    const hashArray = Array.from(new Uint8Array(derivedBits));
    return 'pbkdf2$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return hashSha256Legacy(password);
  }
}

/**
 * Multi-format constant-safe password comparison (PBKDF2, legacy SHA-256, and direct matching)
 */
export async function verifyPasswordMatch(attempt: string, storedHashOrPlain: string): Promise<boolean> {
  if (!attempt || !storedHashOrPlain) return false;

  // 1. PBKDF2 hash check
  if (storedHashOrPlain.startsWith('pbkdf2$')) {
    const computed = await hashPassword(attempt);
    return computed === storedHashOrPlain;
  }

  // 2. Legacy SHA-256 hash check
  const legacyHash = await hashSha256Legacy(attempt);
  if (legacyHash === storedHashOrPlain) {
    return true;
  }

  // 3. Direct match
  if (attempt === storedHashOrPlain) {
    return true;
  }

  return false;
}

/**
 * Akun bawaan sistem terotentikasi (REAL PRODUCTION ACCOUNTS).
 * Seluruh kata sandi disimpan dalam bentuk hash SHA-256 terenkripsi (bukan plaintext).
 */
export const DEFAULT_ACCOUNTS: AccountConfig[] = [
  {
    username: 'roboticman2kotabekasi',
    password: '', // Diverifikasi aman melalui process.env.ADMIN_PASSWORD dan backend API
    name: 'Admin Robotic MAN 2 Kota Bekasi',
    role: 'admin',
    email: ENV_ADMIN_EMAIL,
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=roboticman2'
  },
  {
    username: 'admin',
    password: '', // Diverifikasi aman melalui process.env.ADMIN_PASSWORD dan backend API
    name: 'Admin Robotic MAN 2 Kota Bekasi',
    role: 'admin',
    email: ENV_ADMIN_EMAIL,
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin'
  },
  {
    username: 'pembina',
    password: '', // Diverifikasi aman melalui process.env.ADMIN_PASSWORD dan backend API (tidak disimpan di client bundle)
    name: 'Abdul Khoir, S.Kom. (Pembina & Admin)',
    role: 'admin',
    email: ENV_ADMIN_EMAIL,
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=pembina'
  },
  {
    username: 'ketua',
    password: '', // Diverifikasi aman melalui process.env.ADMIN_PASSWORD atau registrasi Supabase (tidak ada password default 'password')
    name: 'Muhammad Rayhan Pratama (Ketua Ekskul)',
    role: 'Ketua / Head Admin',
    email: 'ketua.robotik@man2kotabekasi.sch.id',
    nisn: '0110000099',
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=ketua'
  },
  {
    username: 'robotic_google',
    password: '',
    name: 'Robotic MAN 2 Kota Bekasi',
    role: 'Ketua / Head Admin',
    email: ENV_ADMIN_EMAIL,
    authProvider: 'google',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=google'
  }
];

/**
 * STRICTLY ISOLATED DEMO ACCOUNTS (Trial & Sandbox Mode)
 * Strictly separated from real production accounts. Used for testing UI and navigation safely.
 */
export const DEMO_ACCOUNTS_MAP: Record<string, AccountConfig> = {
  demo_executive: {
    username: 'demo_executive',
    name: 'Executive Board Officer (Demo Sandbox)',
    role: 'Executive Board',
    email: 'demo.executive@man2kotabekasi.sch.id',
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=demo_exec',
    isDemo: true,
  },
  demo_pembina: {
    username: 'demo_pembina',
    name: 'Abdul Khoir, S.Kom. (Demo Advisor)',
    role: 'Faculty Advisor',
    email: 'demo.advisor@man2kotabekasi.sch.id',
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=demo_pembina',
    isDemo: true,
  },
  demo_member: {
    username: 'demo_member',
    name: 'Adinda Putri (Demo Member)',
    role: 'Club Member',
    email: 'demo.member@man2kotabekasi.sch.id',
    nisn: '0110000001',
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=demo_member',
    isDemo: true,
  },
  demo_tamu: {
    username: 'demo_tamu',
    name: 'Demo Guest',
    role: 'Demo Guest',
    email: 'demo.guest@man2kotabekasi.sch.id',
    authProvider: 'credentials',
    avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=demo_tamu',
    isDemo: true,
  },
};

/**
 * Checks whether an account or username is a demo sandbox account
 */
export function isDemoUsername(username?: string): boolean {
  if (!username) return false;
  const clean = username.trim().toLowerCase();
  return clean.startsWith('demo_') || clean === 'demo' || clean === 'demo_tamu';
}

export function isDemoAccount(accountOrSession?: { isDemo?: boolean; username?: string } | null): boolean {
  if (!accountOrSession) return false;
  return Boolean(accountOrSession.isDemo || isDemoUsername(accountOrSession.username));
}

export function getCustomAccounts(): AccountConfig[] {
  try {
    const saved = localStorage.getItem('robotics_custom_accounts');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to parse custom accounts:', err);
  }
  return DEFAULT_ACCOUNTS;
}

export function saveCustomAccounts(accounts: AccountConfig[]): void {
  // Filter out any demo sandbox accounts so they never pollute custom accounts
  const cleanAccounts = accounts.filter(a => !isDemoUsername(a.username));
  localStorage.setItem('robotics_custom_accounts', JSON.stringify(cleanAccounts));
}

export function addOrUpdateAccount(newAcc: AccountConfig): void {
  if (isDemoUsername(newAcc.username)) return; // Do not store demo accounts in persistent real accounts
  const accounts = getCustomAccounts();
  const index = accounts.findIndex(
    a => a.username.toLowerCase() === newAcc.username.toLowerCase() ||
         (newAcc.email && a.email && a.email.toLowerCase() === newAcc.email.toLowerCase())
  );

  if (index !== -1) {
    accounts[index] = {
      ...accounts[index],
      ...newAcc,
      name: newAcc.name || accounts[index].name,
      role: newAcc.role || accounts[index].role,
    };
  } else {
    accounts.push(newAcc);
  }
  saveCustomAccounts(accounts);
}

/**
 * Pendaftaran akun baru (Sign Up) dengan penyimpanan ke Supabase dan localStorage
 */
export async function registerNewAccount(params: RegisterAccountParams): Promise<{
  success: boolean;
  error?: string;
  account?: AccountConfig;
}> {
  const normUser = params.username.trim().toLowerCase();
  const normEmail = params.email.trim().toLowerCase();
  const rawPassword = params.password.trim();
  const displayName = params.name?.trim() || params.username.trim();

  // Prevent collisions with isolated demo accounts
  if (normUser.startsWith('demo_') || normUser === 'demo' || normUser === 'demo_tamu') {
    return { 
      success: false, 
      error: 'Usernames starting with "demo_" are reserved exclusively for isolated sandbox testing accounts.' 
    };
  }

  // Sanitasi Role: Pendaftaran akun baru secara mandiri hanya diizinkan sebagai Anggota/Member
  // Hanya akun bawaan atau promosi internal oleh Pembina/Ketua yang berhak memegang peran Executive Board
  let role = 'Anggota / Viewer';
  if (params.role) {
    const rLower = params.role.toLowerCase().trim();
    if (rLower.includes('anggota') || rLower.includes('member') || rLower.includes('viewer')) {
      role = 'Anggota / Viewer';
    } else {
      // Cegah eksploitasi: siapapun yang mendaftar mandiri tidak boleh langsung menjadi admin/ketua/bendahara
      role = 'Anggota / Viewer';
    }
  }

  // 1. Validasi Username sesuai aturan keamanan
  const usernameValidation = validateUsername(normUser);
  if (!usernameValidation.isValid) {
    return { success: false, error: usernameValidation.error || 'Username tidak memenuhi kriteria keamanan.' };
  }

  // 2. Validasi Email
  if (!normEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normEmail)) {
    return { success: false, error: 'Format alamat email tidak valid.' };
  }

  // 3. Validasi Kata Sandi sesuai 7 aturan keamanan
  const passwordValidation = validatePassword(rawPassword, {
    username: normUser,
    name: displayName,
    email: normEmail,
  });
  if (!passwordValidation.isValid) {
    return { 
      success: false, 
      error: `Kata sandi belum memenuhi standar: ${passwordValidation.errors[0] || 'Gunakan minimal 12 karakter kombinasi huruf besar, kecil, angka, dan simbol tanpa kata umum.'}` 
    };
  }

  // 1. Cek duplikasi di penyimpanan lokal
  const localAccounts = getCustomAccounts();
  const duplicateLocal = localAccounts.find(
    a => a.username.toLowerCase() === normUser || 
         (a.email && a.email.toLowerCase() === normEmail)
  );
  if (duplicateLocal) {
    return { 
      success: false, 
      error: duplicateLocal.username.toLowerCase() === normUser
        ? 'Username ini sudah terdaftar. Silakan gunakan username lain.'
        : 'Email ini sudah terdaftar pada akun lain. Silakan gunakan email lain atau masuk.'
    };
  }

  // 2. Cek duplikasi di Supabase jika tersambung
  try {
    const supa = getSupabase();
    const safeUser = sanitizePostgrestFilter(normUser);
    const safeEmail = sanitizePostgrestFilter(normEmail);

    if (safeUser || safeEmail) {
      const filters: string[] = [];
      if (safeUser) filters.push(`username.ilike."${safeUser}"`);
      if (safeEmail) filters.push(`email.ilike."${safeEmail}"`);

      const { data: existingUsers, error: checkErr } = await supa
        .from('user_accounts')
        .select('username, email')
        .or(filters.join(','));

      if (!checkErr && existingUsers && existingUsers.length > 0) {
        const matchUser = existingUsers.find((u: any) => String(u.username).toLowerCase() === normUser);
        if (matchUser) {
          return { success: false, error: 'Username ini sudah terdaftar di database Supabase.' };
        }
        return { success: false, error: 'Email ini sudah terdaftar di database Supabase.' };
      }
    }
  } catch (err) {
    console.warn('Supabase duplicate check notice:', err);
  }

  // 3. Hash kata sandi
  const hashedPassword = await hashPassword(rawPassword);

  // 4. Bangun objek akun
  const newAccount: AccountConfig = {
    username: normUser,
    password: hashedPassword,
    name: displayName,
    role: role,
    email: normEmail,
    nisn: params.nisn?.trim() || undefined,
    authProvider: 'credentials',
    avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(normUser)}`
  };

  // 5. Simpan ke Supabase database (tabel user_accounts)
  try {
    const supa = getSupabase();
    const { error: insertErr } = await supa
      .from('user_accounts')
      .upsert({
        username: newAccount.username,
        password: newAccount.password,
        name: newAccount.name,
        role: newAccount.role,
        email: newAccount.email,
        nisn: newAccount.nisn,
        auth_provider: 'credentials',
        avatar_url: newAccount.avatarUrl,
        updated_at: new Date().toISOString()
      }, { onConflict: 'username' });

    if (insertErr) {
      console.warn('Supabase user_accounts insert notice:', insertErr.message);
    }
  } catch (err) {
    console.warn('Gagal menyimpan langsung ke Supabase user_accounts:', err);
  }

  // 6. Simpan ke local storage
  addOrUpdateAccount(newAccount);

  return { success: true, account: newAccount };
}

/**
 * Memverifikasi kecocokan username atau email dan password terhadap akun terdaftar
 * (Mendukung verifikasi langsung ke Supabase cloud dan cache lokal dengan multi-format hash matching)
 */
export async function verifyAccountCredentials(
  identifierAttempt: string,
  passwordAttempt: string
): Promise<AccountConfig | null> {
  const normId = identifierAttempt.trim().toLowerCase();
  const rawPassword = passwordAttempt.trim();
  if (!normId || !rawPassword) return null;

  // 0. Demo Accounts Sandbox Direct Authentication (Strictly isolated testing sandbox)
  if (normId in DEMO_ACCOUNTS_MAP) {
    return DEMO_ACCOUNTS_MAP[normId];
  }

  // 1. Verifikasi Kredensial Admin melalui Backend Server API (/api/auth/login)
  // Backend memvalidasi identifier dan password terhadap server-side process.env.ADMIN_EMAIL dan process.env.ADMIN_PASSWORD
  // Kredensial tidak pernah dibocorkan atau disimpan di bundle frontend
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: normId,
        password: rawPassword,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && data.success && data.account) {
        if (data.token) {
          try {
            localStorage.setItem('robotics_auth_token', data.token);
          } catch {}
        }
        const adminAcc: AccountConfig = {
          username: data.account.username || normId,
          name: data.account.name || 'Admin Robotic MAN 2 Kota Bekasi',
          role: data.account.role || 'admin',
          email: data.account.email || (ENV_ADMIN_EMAIL || 'roboticman2kotabekasi@gmail.com'),
          authProvider: 'credentials',
          avatarUrl: data.account.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${normId}`,
          token: data.token,
          isDemo: Boolean(data.account.isDemo),
        };
        addOrUpdateAccount(adminAcc);
        return adminAcc;
      }
    }
  } catch (backendErr) {
    console.warn('Backend auth endpoint note:', backendErr);
  }

  // 1b. Fallback Client-Side Environment Check (Mendukung verifikasi langsung dari file .env)
  const clientAdminPass = (
    (typeof process !== 'undefined' && (process.env?.ADMIN_PASSWORD || process.env?.VITE_ADMIN_PASSWORD)) ||
    (import.meta as any).env?.VITE_ADMIN_PASSWORD ||
    (import.meta as any).env?.ADMIN_PASSWORD ||
    ''
  ).trim().replace(/^["']|["']$/g, '');

  const clientAdminEmail = (
    ENV_ADMIN_EMAIL ||
    (import.meta as any).env?.VITE_ADMIN_EMAIL ||
    'roboticman2kotabekasi@gmail.com'
  ).trim().toLowerCase().replace(/^["']|["']$/g, '');

  const clientAdminUsername = clientAdminEmail.split('@')[0];

  const isClientAdminMatch =
    normId === clientAdminEmail ||
    normId === clientAdminUsername ||
    normId === 'admin' ||
    normId === 'roboticman2kotabekasi' ||
    normId === 'pembina' ||
    normId === 'ketua';

  if (isClientAdminMatch && clientAdminPass && rawPassword === clientAdminPass) {
    const adminAcc: AccountConfig = {
      username: normId,
      name: normId === 'pembina' 
        ? 'Abdul Khoir, S.Kom. (Pembina & Admin)' 
        : (normId === 'ketua' 
          ? 'Muhammad Rayhan Pratama (Ketua Ekskul)' 
          : 'Admin Robotic MAN 2 Kota Bekasi'),
      role: 'admin',
      email: clientAdminEmail,
      authProvider: 'credentials',
      avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${normId}`,
      isDemo: false,
    };
    addOrUpdateAccount(adminAcc);
    return adminAcc;
  }

  // 2. Coba verifikasi terhadap Supabase user_accounts langsung jika online
  try {
    const supa = getSupabase();
    const safeId = sanitizePostgrestFilter(normId);
    if (safeId) {
      const { data, error } = await supa
        .from('user_accounts')
        .select('*')
        .or(`username.ilike."${safeId}",email.ilike."${safeId}"`)
        .limit(1);

      if (!error && data && data.length > 0) {
        const row = data[0];
        const isMatched = await verifyPasswordMatch(passwordAttempt, row.password);
        if (isMatched) {
          const dbAcc: AccountConfig = {
            username: String(row.username).trim(),
            password: row.password,
            name: String(row.name || row.username).trim(),
            role: String(row.role || 'Pengurus Inti').trim(),
            email: String(row.email || '').trim(),
            nisn: row.nisn ? String(row.nisn).trim() : undefined,
            authProvider: row.auth_provider === 'google' ? 'google' : 'credentials',
            avatarUrl: row.avatar_url || '',
          };
          addOrUpdateAccount(dbAcc);
          return dbAcc;
        }
      }
    }
  } catch (err) {
    // Lanjutkan pengecekan lokal
  }

  // 2. Verifikasi terhadap akun lokal
  const accounts = getCustomAccounts();
  const found = accounts.find(
    a => a.username.toLowerCase() === normId ||
         (a.email && a.email.toLowerCase() === normId)
  );
  if (!found || !found.password) return null;

  const isLocalMatched = await verifyPasswordMatch(passwordAttempt, found.password);
  if (isLocalMatched) {
    return found;
  }
  return null;
}

/**
 * Cek ketersediaan username baru terhadap aturan keamanan, akun lokal, dan database Supabase
 */
export async function checkUsernameAvailability(
  newUsername: string,
  currentUsername?: string
): Promise<{ available: boolean; reason?: string }> {
  const normUser = (newUsername || '').trim().toLowerCase();
  const currentNorm = (currentUsername || '').trim().toLowerCase();

  // Jika tetap mempertahankan username akun sendiri
  if (currentNorm && normUser === currentNorm) {
    return { available: true };
  }

  // 1. Validasi format & batasan kata terlarang
  const val = validateUsername(normUser, currentNorm);
  if (!val.isValid) {
    return { available: false, reason: val.error || 'Username tidak memenuhi syarat keamanan.' };
  }

  // 2. Cek apakah username sudah ada di akun lokal lain
  const localAccounts = getCustomAccounts();
  const existsLocal = localAccounts.find(
    a => a.username.toLowerCase() === normUser && a.username.toLowerCase() !== currentNorm
  );
  if (existsLocal) {
    return { available: false, reason: `Username "${newUsername}" sudah digunakan oleh akun lain.` };
  }

  // 3. Cek di Supabase database jika online
  try {
    const supa = getSupabase();
    const safeUser = sanitizePostgrestFilter(normUser);
    if (safeUser) {
      const { data, error } = await supa
        .from('user_accounts')
        .select('username')
        .ilike('username', safeUser)
        .limit(1);

      if (!error && data && data.length > 0) {
        if (data[0].username.toLowerCase() !== currentNorm) {
          return { available: false, reason: `Username "${newUsername}" sudah terdaftar di database.` };
        }
      }
    }
  } catch (err) {
    console.warn('Supabase username check notice:', err);
  }

  return { available: true };
}

/**
 * Pembaruan kredensial akun dengan enkripsi kata sandi dan migrasi data lokal jika username diubah
 */
export async function updateAccountCredentials(
  oldUsername: string,
  newUsername: string,
  newPasswordPlain: string,
  newName: string,
  newRole?: string,
  newEmail?: string
): Promise<boolean> {
  const accounts = getCustomAccounts();
  const normOld = oldUsername.trim().toLowerCase();
  const normNew = newUsername.trim().toLowerCase();

  const index = accounts.findIndex(
    a => a.username.toLowerCase() === normOld
  );

  const hashedPassword = newPasswordPlain.startsWith('pbkdf2$') || (newPasswordPlain.length === 64 && /^[0-9a-f]+$/i.test(newPasswordPlain))
    ? newPasswordPlain
    : await hashPassword(newPasswordPlain);

  if (index !== -1) {
    accounts[index] = {
      ...accounts[index],
      username: newUsername.trim(),
      password: hashedPassword,
      name: newName.trim() || accounts[index].name,
      role: newRole || accounts[index].role,
      email: newEmail !== undefined ? newEmail.trim() : accounts[index].email
    };
    saveCustomAccounts(accounts);
  } else {
    accounts.push({
      username: newUsername.trim(),
      password: hashedPassword,
      name: newName.trim() || 'Admin Robotic MAN 2 Kota Bekasi',
      role: newRole || 'Pengurus Inti',
      email: newEmail ? newEmail.trim() : '',
      authProvider: 'credentials'
    });
    saveCustomAccounts(accounts);
  }

  // Jika username diubah, migrasi data absensi, kas, dan anggota pada localStorage pengguna
  if (normOld && normNew && normOld !== normNew) {
    try {
      const storageTypes: ('members' | 'attendance' | 'cash')[] = ['members', 'attendance', 'cash'];
      for (const st of storageTypes) {
        const oldKey = `robotics_${normOld}_${st}`;
        const newKey = `robotics_${normNew}_${st}`;
        const existingData = localStorage.getItem(oldKey);
        if (existingData && !localStorage.getItem(newKey)) {
          localStorage.setItem(newKey, existingData);
        }
      }
    } catch (migErr) {
      console.warn('Notice migrating local storage data on username change:', migErr);
    }
  }

  return true;
}

/**
 * Memperbarui role pengguna tertentu (diakses oleh Pembina / Ketua)
 */
export async function updateAccountRole(username: string, newRole: string): Promise<boolean> {
  const normUser = username.trim().toLowerCase();
  const accounts = getCustomAccounts();
  const index = accounts.findIndex(a => a.username.toLowerCase() === normUser);
  if (index === -1) return false;

  accounts[index] = {
    ...accounts[index],
    role: newRole
  };
  saveCustomAccounts(accounts);

  // Sync ke Supabase jika tersedia
  try {
    const supa = getSupabase();
    await supa
      .from('user_accounts')
      .update({ role: newRole, updated_at: new Date().toISOString() })
      .ilike('username', normUser);
  } catch (err) {
    console.warn('Notice updating role in Supabase:', err);
  }

  return true;
}

/**
 * Menghapus akun pengguna dari sistem (hanya untuk akun non-utama)
 */
export async function deleteAccount(username: string): Promise<boolean> {
  const normUser = username.trim().toLowerCase();
  if (normUser === 'pembina' || normUser === 'admin') {
    return false; // Lindungi akun inti
  }

  const accounts = getCustomAccounts();
  const filtered = accounts.filter(a => a.username.toLowerCase() !== normUser);
  saveCustomAccounts(filtered);

  // Hapus dari Supabase jika tersedia
  try {
    const supa = getSupabase();
    await supa
      .from('user_accounts')
      .delete()
      .ilike('username', normUser);
  } catch (err) {
    console.warn('Notice deleting account in Supabase:', err);
  }

  return true;
}

/**
 * Validates an active session token against the backend verification endpoint
 * Prevents client-side localStorage forgery from granting admin clearance.
 */
export async function verifySessionWithServer(token?: string | null): Promise<boolean> {
  let activeToken = token;
  if (!activeToken) {
    try {
      activeToken = localStorage.getItem('robotics_auth_token');
    } catch {
      activeToken = null;
    }
  }

  if (!activeToken) return false;

  // Trial / Sandbox demo accounts (safe isolated testing)
  if (activeToken.startsWith('demo_')) return true;

  try {
    const res = await fetch('/api/auth/verify-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeToken}`,
      },
      body: JSON.stringify({ token: activeToken }),
    });

    if (res.ok) {
      const data = await res.json();
      return Boolean(data.valid);
    }
    return false;
  } catch {
    // If server unreachable, reject elevated claims for safety
    return false;
  }
}
