import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

import crypto from 'crypto';

// Body parser
app.use(express.json());

// Security headers middleware
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

// In-memory active administrator session store
interface ActiveSession {
  token: string;
  username: string;
  role: string;
  createdAt: number;
  expiresAt: number;
}
const activeAdminSessions = new Map<string, ActiveSession>();

// In-memory brute-force rate limiter store
interface RateLimitRecord {
  attempts: number;
  firstAttemptTime: number;
  lockedUntil?: number;
}
const loginRateLimitMap = new Map<string, RateLimitRecord>();

const MAX_LOGIN_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes window
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes lockout

// Cleanup expired sessions and rate limit records
setInterval(() => {
  const now = Date.now();
  for (const [token, sess] of activeAdminSessions.entries()) {
    if (sess.expiresAt < now) {
      activeAdminSessions.delete(token);
    }
  }
  for (const [key, record] of loginRateLimitMap.entries()) {
    if (record.lockedUntil && record.lockedUntil < now) {
      loginRateLimitMap.delete(key);
    } else if (now - record.firstAttemptTime > RATE_LIMIT_WINDOW_MS && !record.lockedUntil) {
      loginRateLimitMap.delete(key);
    }
  }
}, 10 * 60 * 1000);

// Dynamic admin credentials retriever (reads fresh .env if changed or uploaded, strips quotes and trims)
function getAdminCredentials() {
  try {
    dotenv.config();
  } catch {}
  const rawEmail = process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'roboticman2kotabekasi@gmail.com';
  const rawPass = process.env.ADMIN_PASSWORD || process.env.VITE_ADMIN_PASSWORD || '';
  const adminEmail = rawEmail.replace(/^["']|["']$/g, '').trim().toLowerCase();
  const adminPassword = rawPass.replace(/^["']|["']$/g, '').trim();
  return { adminEmail, adminPassword };
}

// Health check / API status endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const { adminEmail, adminPassword } = getAdminCredentials();
  res.json({
    status: 'ok',
    adminConfigured: Boolean(adminEmail && adminPassword),
    adminEmail,
    timestamp: new Date().toISOString(),
  });
});

// Admin authentication endpoint (validates credentials securely against server-side ENV with rate-limiting)
app.post('/api/auth/login', (req: Request, res: Response) => {
  try {
    const { identifier, password } = req.body || {};

    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username/Email and password are required.',
      });
    }

    const normId = String(identifier).trim().toLowerCase();
    const rawPass = String(password).trim();
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || req.socket.remoteAddress || 'ip_unknown';
    const rateLimitKey = `${clientIp}__${normId}`;
    const now = Date.now();

    // Check active rate limit lockout
    const rateRecord = loginRateLimitMap.get(rateLimitKey);
    if (rateRecord && rateRecord.lockedUntil && rateRecord.lockedUntil > now) {
      const remainingSeconds = Math.ceil((rateRecord.lockedUntil - now) / 1000);
      return res.status(429).json({
        success: false,
        error: 'Too Many Requests',
        message: `Terlalu banyak percobaan login yang gagal. Akun/IP ini diblokir sementara selama ${remainingSeconds} detik untuk melindungi dari serangan brute-force.`,
        retryAfter: remainingSeconds,
      });
    }

    // Check Demo Accounts (Isolated Testing Sandbox)
    if (normId === 'demo_executive' || normId === 'demo_pembina' || normId === 'demo_member' || normId === 'demo_tamu') {
      const demoRoles: Record<string, { name: string; role: string; jabatan?: string; bypass: boolean }> = {
        demo_executive: { name: 'Executive Board Officer (Demo Sandbox)', role: 'Executive Board', jabatan: 'vice_president', bypass: true },
        demo_pembina: { name: 'Abdul Khoir, S.Kom. (Demo Advisor)', role: 'Faculty Advisor', jabatan: 'pembina', bypass: true },
        demo_member: { name: 'Adinda Putri (Demo Member)', role: 'Club Member', jabatan: 'member', bypass: false },
        demo_tamu: { name: 'Demo Guest', role: 'Demo Guest', jabatan: 'guest', bypass: false },
      };
      const info = demoRoles[normId];
      const demoToken = `demo_${crypto.randomBytes(16).toString('hex')}`;
      return res.json({
        success: true,
        message: 'Signed in as Demo Sandbox account (Isolated testing environment).',
        token: demoToken,
        account: {
          username: normId,
          name: info.name,
          role: info.role,
          email: `${normId}@man2kotabekasi.sch.id`,
          authProvider: 'credentials',
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${normId}`,
          isDemo: true,
          bypassNisnVerification: info.bypass,
          isVerifiedMember: true,
          membershipStatus: normId === 'demo_executive' ? 'executive_board' : 'aktif',
          jabatan: info.jabatan,
        },
      });
    }

    const { adminEmail, adminPassword } = getAdminCredentials();
    const envUsername = adminEmail.split('@')[0].toLowerCase();

    // Check if the identifier matches admin email, admin username, 'admin', 'roboticman2kotabekasi', 'pembina', or 'ketua'
    const isMatchedAdminId =
      normId === adminEmail ||
      normId === envUsername ||
      normId === 'admin' ||
      normId === 'roboticman2kotabekasi' ||
      normId === 'pembina' ||
      normId === 'ketua';

    if (isMatchedAdminId && Boolean(adminPassword) && rawPass === adminPassword) {
      // Clear rate limit record upon successful authentication
      loginRateLimitMap.delete(rateLimitKey);

      let username = normId;
      let name = 'Admin Robotic MAN 2 Kota Bekasi';
      let role = 'admin';

      if (normId === 'pembina') {
        username = 'pembina';
        name = 'Abdul Khoir, S.Kom. (Faculty Advisor & Admin)';
        role = 'admin';
      } else if (normId === 'ketua') {
        username = 'ketua';
        name = 'Muhammad Rayhan Pratama (Ketua Ekskul)';
        role = 'Ketua / Head Admin';
      } else if (normId === 'admin' || normId === 'roboticman2kotabekasi') {
        username = normId;
        name = 'Admin Robotic MAN 2 Kota Bekasi';
        role = 'admin';
      } else {
        username = envUsername;
      }

      // Generate cryptographically secure session token
      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = now + (24 * 60 * 60 * 1000); // 24 hours validity

      activeAdminSessions.set(sessionToken, {
        token: sessionToken,
        username,
        role,
        createdAt: now,
        expiresAt,
      });

      return res.json({
        success: true,
        message: 'Administrator login verified successfully via server environment.',
        token: sessionToken,
        account: {
          username,
          name,
          role: 'admin',
          email: adminEmail,
          authProvider: 'credentials',
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${username}`,
          bypassNisnVerification: true,
          isVerifiedMember: true,
          membershipStatus: 'executive_board',
          jabatan: 'president',
        },
      });
    }

    // Record failed attempt for rate limiting
    const existingRate = loginRateLimitMap.get(rateLimitKey);
    if (!existingRate || (now - existingRate.firstAttemptTime > RATE_LIMIT_WINDOW_MS && !existingRate.lockedUntil)) {
      loginRateLimitMap.set(rateLimitKey, { attempts: 1, firstAttemptTime: now });
    } else {
      existingRate.attempts += 1;
      if (existingRate.attempts >= MAX_LOGIN_ATTEMPTS) {
        existingRate.lockedUntil = now + LOCKOUT_DURATION_MS;
        const seconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);
        return res.status(429).json({
          success: false,
          error: 'Account Temporarily Locked',
          message: `Terlalu banyak percobaan kata sandi yang salah (${MAX_LOGIN_ATTEMPTS} kali). Server mengunci percobaan login selama 15 menit.`,
          retryAfter: seconds,
        });
      }
    }

    return res.status(401).json({
      success: false,
      message: 'Invalid administrator credentials.',
    });
  } catch (error) {
    console.error('Error during backend auth verification:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during authentication verification.',
    });
  }
});

// Session Verification Endpoint: Verifies if a client token is genuinely authenticated by the backend
app.post('/api/auth/verify-session', (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    const token = (authHeader && authHeader.startsWith('Bearer '))
      ? authHeader.substring(7).trim()
      : (req.body?.token ? String(req.body.token).trim() : '');

    if (!token) {
      return res.status(401).json({ valid: false, message: 'Missing session token.' });
    }

    // Check active session cache
    const sess = activeAdminSessions.get(token);
    if (sess && sess.expiresAt > Date.now()) {
      return res.json({
        valid: true,
        username: sess.username,
        role: sess.role,
        expiresAt: sess.expiresAt,
      });
    }

    return res.status(401).json({ valid: false, message: 'Session token expired or invalid.' });
  } catch {
    return res.status(500).json({ valid: false, message: 'Session verification error.' });
  }
});

/**
 * Strict Admin Authorization Middleware
 * Validates request authorization header or admin credentials to protect administrative routes.
 */
function requireAdminMiddleware(req: Request, res: Response, next: () => void) {
  const authHeader = req.headers.authorization;
  const adminSecret = req.headers['x-admin-key'] || req.headers['x-admin-password'];
  const { adminPassword } = getAdminCredentials();

  // 1. Direct secret match if configured
  if (adminSecret && adminPassword && String(adminSecret).trim() === adminPassword) {
    return next();
  }

  // 2. Token match against active sessions
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token && activeAdminSessions.has(token)) {
      const sess = activeAdminSessions.get(token);
      if (sess && sess.expiresAt > Date.now()) {
        return next();
      }
    }
    if (adminPassword && token === adminPassword) {
      return next();
    }
  }

  return res.status(403).json({
    success: false,
    error: 'Access Denied: Strict Administrator Clearance Required.',
    message: 'You do not have permission to access protected admin routes.',
  });
}

// Protected Admin Verification Route
app.get('/api/admin/verify', requireAdminMiddleware, (_req: Request, res: Response) => {
  const { adminEmail } = getAdminCredentials();
  res.json({
    success: true,
    status: 'authorized',
    clearance: 'administrator',
    adminEmail,
    timestamp: new Date().toISOString(),
  });
});

// Protected Admin Action: Promote User Endpoint
app.post('/api/admin/promote-user', requireAdminMiddleware, (req: Request, res: Response) => {
  const { userId, username, newRole } = req.body || {};
  if (!userId && !username) {
    return res.status(400).json({
      success: false,
      error: 'User ID or username is required for role modification.',
    });
  }

  const roleToAssign = newRole || 'executive_board';
  console.log(`[Admin Guard] User promoted: ${username || userId} -> ${roleToAssign}`);

  return res.json({
    success: true,
    message: `User ${username || userId} successfully granted role '${roleToAssign}'.`,
    assignedRole: roleToAssign,
    updatedAt: new Date().toISOString(),
  });
});

async function startServer() {
  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Mount Vite middleware in development
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // Serve static dist in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    const { adminEmail } = getAdminCredentials();
    console.log(`Server running on port ${PORT} (Admin ENV ready: ${adminEmail})`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
