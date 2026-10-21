// src/utils/rbac.ts
// Extracurricular Management Role-Based Access Control (RBAC) System
// Distinct separation between (Executive Board & Advisor) and (General Members)

export type AppRole = 'admin' | 'pembina' | 'ketua' | 'bph' | 'sekretaris' | 'bendahara' | 'anggota' | 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'pr' | 'advisor' | 'member';

export type ExecutiveTitle = 'president' | 'vice_president' | 'secretary' | 'treasurer' | 'pr' | 'advisor' | 'member';

export type Permission =
  // Members Management
  | 'members:view'
  | 'members:create'
  | 'members:edit'
  | 'members:delete'
  | 'members:import'
  | 'members:export'
  | 'members:promote' // Promote members to admin and assign executive titles
  | 'members:view_sensitive' // View unmasked PII (NIK, student birthdate/credential, parent contact)
  // Attendance Module
  | 'attendance:view'
  | 'attendance:create'
  | 'attendance:edit'
  | 'attendance:delete'
  | 'attendance:reset'
  | 'attendance:export'
  // Treasury & Cash Module
  | 'cash:view'
  | 'cash:create'
  | 'cash:edit'
  | 'cash:delete'
  | 'cash:reset'
  | 'cash:export'
  // Calendar & Events
  | 'calendar:view'
  | 'calendar:edit'
  // Assignments & Grading
  | 'assignments:view'
  | 'assignments:create'
  | 'assignments:grade'
  | 'assignments:delete'
  // Announcements
  | 'announcements:view'
  | 'announcements:create'
  | 'announcements:delete'
  // Club Room Maintenance & Configuration
  | 'room:maintenance'
  | 'rbac:manage'
  | 'system:configure';

export type RoleCategory = 'Executive Board & Advisor' | 'Member';

export interface RoleDefinition {
  id: AppRole;
  label: string;
  category: RoleCategory;
  shortTitle: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  iconName: string;
  description: string;
  responsibilities: string[];
  permissions: Permission[];
}

export const EXECUTIVE_TITLES: {
  id: ExecutiveTitle;
  label: string;
  category: RoleCategory;
  badge: string;
  isAdmin: boolean;
  description: string;
}[] = [
  {
    id: 'president',
    label: 'President',
    category: 'Executive Board & Advisor',
    badge: '👑 President',
    isAdmin: true,
    description: 'Club President / Room Creator with full executive authority over members, roles, maintenance, and operations.'
  },
  {
    id: 'vice_president',
    label: 'Vice President',
    category: 'Executive Board & Advisor',
    badge: '⭐ Vice President',
    isAdmin: true,
    description: 'Vice President assisting executive operations, club maintenance, and committee coordination.'
  },
  {
    id: 'secretary',
    label: 'Secretary',
    category: 'Executive Board & Advisor',
    badge: '📝 Secretary',
    isAdmin: true,
    description: 'Secretary in charge of member records, meeting minutes, attendance logs, and assignments.'
  },
  {
    id: 'treasurer',
    label: 'Treasurer',
    category: 'Executive Board & Advisor',
    badge: '💰 Treasurer',
    isAdmin: true,
    description: 'Treasurer managing club fees, component budgets, procurement, and financial reports.'
  },
  {
    id: 'pr',
    label: 'Public Relations',
    category: 'Executive Board & Advisor',
    badge: '📣 Public Relations',
    isAdmin: true,
    description: 'Public Relations with executive authority over external communications, club announcements, member coordination, and club operations.'
  },
  {
    id: 'advisor',
    label: 'Advisor',
    category: 'Executive Board & Advisor',
    badge: '🛡️ Advisor',
    isAdmin: true,
    description: 'Teacher / Faculty Advisor supervising overall governance, safety, audit, and school compliance.'
  },
  {
    id: 'member',
    label: 'Member',
    category: 'Member',
    badge: '👤 Member',
    isAdmin: false,
    description: 'General extracurricular member participating in workshops, self-attendance, and assignments.'
  }
];

export const ROLE_DEFINITIONS: Record<string, RoleDefinition> = {
  admin: {
    id: 'admin',
    label: 'Administrator (Head Admin)',
    category: 'Executive Board & Advisor',
    shortTitle: 'Admin',
    badgeBg: 'bg-blue-100 text-blue-900',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-300',
    iconName: 'ShieldCheck',
    description: 'System Administrator with full executive authority over members, attendance, treasury, assignments, announcements, and Supabase integration.',
    responsibilities: [
      'Comprehensive administrative access to all extracurricular modules and data',
      'Bypass student verification and manage all member profiles and staging data',
      'Oversee attendance records, treasury accounting, and assignments grading',
      'Configure Supabase database synchronization and academic periods'
    ],
    permissions: [
      'members:view', 'members:create', 'members:edit', 'members:delete', 'members:import', 'members:export', 'members:promote',
      'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete', 'attendance:reset', 'attendance:export',
      'cash:view', 'cash:create', 'cash:edit', 'cash:delete', 'cash:reset', 'cash:export',
      'calendar:view', 'calendar:edit',
      'assignments:view', 'assignments:create', 'assignments:grade', 'assignments:delete',
      'announcements:view', 'announcements:create', 'announcements:delete',
      'room:maintenance', 'rbac:manage', 'system:configure'
    ]
  },
  pembina: {
    id: 'pembina',
    label: 'Faculty Advisor',
    category: 'Executive Board & Advisor',
    shortTitle: 'Advisor',
    badgeBg: 'bg-purple-100 text-purple-900',
    badgeText: 'text-purple-700',
    badgeBorder: 'border-purple-300',
    iconName: 'ShieldCheck',
    description: 'Faculty Advisor with complete supervision, audit oversight, and institutional authority.',
    responsibilities: [
      'Comprehensive audit of all members, attendance records, and treasury accounts',
      'Supervise executive promotions and assigned designations',
      'Oversee academic year settings and system configurations',
      'Access to all official printouts, grading records, and school reports'
    ],
    permissions: [
      'members:view', 'members:create', 'members:edit', 'members:delete', 'members:import', 'members:export', 'members:promote', 'members:view_sensitive',
      'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete', 'attendance:reset', 'attendance:export',
      'cash:view', 'cash:create', 'cash:edit', 'cash:delete', 'cash:reset', 'cash:export',
      'calendar:view', 'calendar:edit',
      'assignments:view', 'assignments:create', 'assignments:grade', 'assignments:delete',
      'announcements:view', 'announcements:create', 'announcements:delete',
      'room:maintenance', 'rbac:manage', 'system:configure'
    ]
  },
  ketua: {
    id: 'ketua',
    label: 'President (Head Admin)',
    category: 'Executive Board & Advisor',
    shortTitle: 'President',
    badgeBg: 'bg-blue-100 text-blue-900',
    badgeText: 'text-blue-700',
    badgeBorder: 'border-blue-300',
    iconName: 'Crown',
    description: 'Club President and room creator with full executive management, member role assignments, and club maintenance privileges.',
    responsibilities: [
      'Coordinate all robotic club divisions, workshops, and competitions',
      'Promote members to Admin and assign executive titles (Vice President, Secretary, etc.)',
      'Perform club maintenance, room customization, and settings',
      'Publish assignments, announcements, and evaluate submissions'
    ],
    permissions: [
      'members:view', 'members:create', 'members:edit', 'members:delete', 'members:import', 'members:export', 'members:promote', 'members:view_sensitive',
      'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete', 'attendance:reset', 'attendance:export',
      'cash:view', 'cash:export',
      'calendar:view', 'calendar:edit',
      'assignments:view', 'assignments:create', 'assignments:grade', 'assignments:delete',
      'announcements:view', 'announcements:create', 'announcements:delete',
      'room:maintenance', 'rbac:manage', 'system:configure'
    ]
  },
  bph: {
    id: 'bph',
    label: 'Vice President / Executive Board',
    category: 'Executive Board & Advisor',
    shortTitle: 'Vice President',
    badgeBg: 'bg-indigo-100 text-indigo-900',
    badgeText: 'text-indigo-700',
    badgeBorder: 'border-indigo-300',
    iconName: 'Award',
    description: 'Executive Board member with operational authority to manage members, attendance, assignments, and club maintenance (Treasury is read-only).',
    responsibilities: [
      'Daily operational management of member records, attendance, and club activities',
      'Club maintenance, assignment coordination, and grading',
      'Validate events, announcements, and periodic club reports',
      'Workshop coordination and student supervision'
    ],
    permissions: [
      'members:view', 'members:create', 'members:edit', 'members:delete', 'members:import', 'members:export',
      'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete', 'attendance:reset', 'attendance:export',
      'cash:view', 'cash:export',
      'calendar:view', 'calendar:edit',
      'assignments:view', 'assignments:create', 'assignments:grade', 'assignments:delete',
      'announcements:view', 'announcements:create', 'announcements:delete',
      'room:maintenance'
    ]
  },
  sekretaris: {
    id: 'sekretaris',
    label: 'Secretary',
    category: 'Executive Board & Advisor',
    shortTitle: 'Secretary',
    badgeBg: 'bg-emerald-100 text-emerald-900',
    badgeText: 'text-emerald-700',
    badgeBorder: 'border-emerald-300',
    iconName: 'FileText',
    description: 'Executive Secretary responsible for member directory records, meeting attendance, assignments, and announcements.',
    responsibilities: [
      'Manage member profiles, registration archives, and class groupings',
      'Track and record daily workshop attendance',
      'Post official announcements and compile assignments',
      'Maintain club schedules, calendar events, and documentation'
    ],
    permissions: [
      'members:view', 'members:create', 'members:edit', 'members:delete', 'members:import', 'members:export', 'members:view_sensitive',
      'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete', 'attendance:reset', 'attendance:export',
      'cash:view', 'cash:export',
      'calendar:view', 'calendar:edit',
      'assignments:view', 'assignments:create', 'assignments:grade',
      'announcements:view', 'announcements:create',
      'room:maintenance'
    ]
  },
  bendahara: {
    id: 'bendahara',
    label: 'Treasurer',
    category: 'Executive Board & Advisor',
    shortTitle: 'Treasurer',
    badgeBg: 'bg-amber-100 text-amber-900',
    badgeText: 'text-amber-700',
    badgeBorder: 'border-amber-300',
    iconName: 'Wallet',
    description: 'Executive Treasurer responsible for member dues, robotics hardware expenses, financial transparency, and cash reports.',
    responsibilities: [
      'Record weekly/monthly club dues and contributions',
      'Document hardware purchases (microcontrollers, sensors, tools)',
      'Generate balance sheets, income/expense reports, and budget audits',
      'Access member lists to verify payment status'
    ],
    permissions: [
      'members:view', 'members:export',
      'attendance:view', 'attendance:export',
      'cash:view', 'cash:create', 'cash:edit', 'cash:delete', 'cash:reset', 'cash:export',
      'calendar:view',
      'announcements:view',
      'room:maintenance'
    ]
  },
  pr: {
    id: 'pr',
    label: 'Public Relations (PR)',
    category: 'Executive Board & Advisor',
    shortTitle: 'Public Relations',
    badgeBg: 'bg-rose-100 text-rose-900',
    badgeText: 'text-rose-700',
    badgeBorder: 'border-rose-300',
    iconName: 'Megaphone',
    description: 'Public Relations officer handling external communications, community partnerships, member coordination, broadcasts, and club operations.',
    responsibilities: [
      'Coordinate public relations, external announcements, and club partner communications',
      'Manage member communications, roster coordination, and community outreach',
      'Access and supervise session attendance, club treasury records, and assignments',
      'Publish official broadcasts, event announcements, and competition updates'
    ],
    permissions: [
      'members:view', 'members:create', 'members:edit', 'members:delete', 'members:import', 'members:export',
      'attendance:view', 'attendance:create', 'attendance:edit', 'attendance:delete', 'attendance:reset', 'attendance:export',
      'cash:view', 'cash:export',
      'calendar:view', 'calendar:edit',
      'assignments:view', 'assignments:create', 'assignments:grade', 'assignments:delete',
      'announcements:view', 'announcements:create', 'announcements:delete',
      'room:maintenance'
    ]
  },
  anggota: {
    id: 'anggota',
    label: 'Club Member',
    category: 'Member',
    shortTitle: 'Member',
    badgeBg: 'bg-slate-100 text-slate-800',
    badgeText: 'text-slate-600',
    badgeBorder: 'border-slate-300',
    iconName: 'UserCheck',
    description: 'General extracurricular member with participant access to attendance self check-in, announcements, learning materials, and assignment submission.',
    responsibilities: [
      'Submit daily self-check-in attendance and view presence history',
      'Access robotics learning materials and turn in assignment solutions',
      'Read official club broadcasts and schedule dates on the calendar',
      'Manage personal student profile and digital ID badge'
    ],
    permissions: [
      'attendance:view',
      'attendance:create',
      'calendar:view',
      'assignments:view',
      'announcements:view'
    ]
  }
};

/**
 * Normalizes any free-form role or title string to canonical AppRole
 */
export function normalizeRole(roleStr?: string | null): AppRole {
  if (!roleStr) return 'anggota';
  const clean = roleStr.toLowerCase().trim();

  if (clean === 'admin' || clean === 'head admin' || clean.includes('admin')) {
    return 'admin';
  }
  if (clean.includes('pembina') || clean.includes('advisor') || clean.includes('guru') || clean.includes('counselor')) {
    return 'pembina';
  }
  if (clean.includes('president') || clean.includes('presiden') || clean.includes('ketua')) {
    return 'ketua';
  }
  if (clean.includes('pr') || clean.includes('humas') || clean.includes('public relation') || clean.includes('public relations')) {
    return 'pr';
  }
  if (clean.includes('vice') || clean.includes('wakil') || clean.includes('bph') || clean.includes('executive')) {
    return 'bph';
  }
  if (clean.includes('sekretaris') || clean.includes('secretary')) {
    return 'sekretaris';
  }
  if (clean.includes('bendahara') || clean.includes('treasurer') || clean.includes('finance')) {
    return 'bendahara';
  }
  if (clean.includes('pengurus') || clean.includes('lead') || clean.includes('coordinator')) {
    return 'bph';
  }
  return 'anggota';
}

/**
 * Checks if a role belongs to Executive Board or Advisor category
 */
export function isExecutiveOrAdvisor(roleStr?: string | null, titleStr?: string | null): boolean {
  if (titleStr) {
    const t = titleStr.toLowerCase().trim();
    if (['admin', 'president', 'vice_president', 'secretary', 'treasurer', 'pr', 'advisor', 'pembina', 'ketua', 'executive_board'].includes(t)) {
      return true;
    }
  }
  const clean = (roleStr || '').toLowerCase().trim();
  if (clean === 'executive_board' || clean.includes('executive')) {
    return true;
  }
  const r = normalizeRole(roleStr);
  return r === 'admin' || r === 'ketua' || r === 'pembina' || r === 'bph' || r === 'pr' || r === 'sekretaris' || r === 'bendahara';
}

export function isExecutiveRole(roleStr?: string | null): boolean {
  const clean = (roleStr || '').toLowerCase().trim();
  if (clean === 'executive_board' || clean.includes('executive')) {
    return true;
  }
  const r = normalizeRole(roleStr);
  return r === 'admin' || r === 'ketua' || r === 'pembina' || r === 'bph' || r === 'pr';
}

export function isAdvisor(roleStr?: string | null): boolean {
  return normalizeRole(roleStr) === 'pembina';
}

export function isMember(roleStr?: string | null): boolean {
  return normalizeRole(roleStr) === 'anggota';
}

/**
 * Determines whether the current user is the creator of the club room
 */
export function isRoomCreator(
  org: { creatorUsername?: string; id?: string; isDefault?: boolean } | null | undefined,
  session: { username?: string; email?: string; role?: string; jabatan?: string } | null | undefined
): boolean {
  if (!org || !session) return false;
  const user = (session.username || '').toLowerCase().trim();
  const creator = (org.creatorUsername || 'admin').toLowerCase().trim();

  // If username matches creator
  if (user && user === creator) return true;
  // Default club initial creator check
  if (user === 'admin' && (org.isDefault || !org.creatorUsername || creator === 'admin')) return true;

  return false;
}

/**
 * Checks if the user is authorized to view the private room join/access code.
 * ONLY the room creator / founder admin is allowed to see this code.
 */
export function canViewJoinCode(
  org: { creatorUsername?: string; id?: string; isDefault?: boolean } | null | undefined,
  session: { username?: string; email?: string; role?: string; jabatan?: string } | null | undefined
): boolean {
  return isRoomCreator(org, session);
}

/**
 * Checks whether a given role holds a specific permission
 */
export function hasPermission(
  roleStr: string | undefined | null,
  permission: Permission,
  titleStr?: string | null
): boolean {
  const cleanRole = (roleStr || '').toLowerCase().trim();
  const cleanTitle = (titleStr || '').toLowerCase().trim();

  // Strict privilege check: Only Primary Administrator can promote members, manage RBAC, or configure system
  if (
    permission === 'members:promote' ||
    permission === 'rbac:manage' ||
    permission === 'system:configure'
  ) {
    return cleanRole === 'admin' || cleanTitle === 'president';
  }

  // Strict segregation of duties: ONLY Treasurer (Bendahara) or Primary Administrator can record, edit, delete, or reset cash
  if (
    permission === 'cash:create' ||
    permission === 'cash:edit' ||
    permission === 'cash:delete' ||
    permission === 'cash:reset'
  ) {
    const isTreasurer =
      cleanTitle === 'treasurer' ||
      cleanRole === 'bendahara' ||
      cleanRole.includes('bendahara') ||
      cleanTitle.includes('treasurer') ||
      cleanRole.includes('treasurer');
    return cleanRole === 'admin' || Boolean(isTreasurer);
  }

  // Any user with role 'admin', 'pr' (Public Relations), or executive titles has operational management permissions
  if (
    cleanRole === 'admin' ||
    cleanRole === 'executive_board' ||
    cleanRole.includes('executive') ||
    cleanRole === 'pr' ||
    cleanRole.includes('public relation') ||
    cleanRole.includes('humas') ||
    cleanTitle === 'president' ||
    cleanTitle === 'vice_president' ||
    cleanTitle === 'executive_board' ||
    cleanTitle === 'advisor' ||
    cleanTitle === 'pr'
  ) {
    if (
      permission === 'room:maintenance' ||
      permission === 'members:view' ||
      permission === 'members:create' ||
      permission === 'members:edit' ||
      permission === 'members:delete' ||
      permission === 'members:import' ||
      permission === 'members:export' ||
      permission === 'attendance:view' ||
      permission === 'attendance:create' ||
      permission === 'attendance:edit' ||
      permission === 'attendance:delete' ||
      permission === 'attendance:reset' ||
      permission === 'attendance:export' ||
      permission === 'cash:view' ||
      permission === 'cash:export' ||
      permission === 'calendar:view' ||
      permission === 'calendar:edit' ||
      permission === 'assignments:view' ||
      permission === 'assignments:create' ||
      permission === 'assignments:grade' ||
      permission === 'assignments:delete' ||
      permission === 'announcements:view' ||
      permission === 'announcements:create' ||
      permission === 'announcements:delete'
    ) {
      return true;
    }
  }

  // Other executive titles also have room maintenance permission
  if (
    (cleanTitle === 'secretary' || cleanTitle === 'treasurer' || cleanTitle === 'pr') &&
    permission === 'room:maintenance'
  ) {
    return true;
  }

  const canonicalRole = normalizeRole(cleanTitle || cleanRole);
  const def = ROLE_DEFINITIONS[canonicalRole];
  if (!def) return false;
  return def.permissions.includes(permission);
}

export function hasAnyPermission(roleStr: string | undefined | null, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(roleStr, p));
}

export function hasAllPermissions(roleStr: string | undefined | null, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(roleStr, p));
}

/**
 * Evaluates permission based directly on the validated session's canonical role.
 * Prevents client-side role tampering or localStorage forgery from granting administrative actions.
 */
export function hasSessionPermission(
  session: { role?: string | null; username?: string | null; email?: string | null; jabatan?: string | null; membershipStatus?: string | null } | null | undefined,
  permission: Permission
): boolean {
  if (!session) return false;
  const canonical = getCanonicalRole(session);
  if (canonical === 'admin') return true;
  if (canonical === 'executive_board') {
    // Specifically for cash management: ONLY Treasurer is allowed to create, edit, delete, or reset cash!
    if (
      permission === 'cash:create' ||
      permission === 'cash:edit' ||
      permission === 'cash:delete' ||
      permission === 'cash:reset'
    ) {
      const isTreasurer =
        session.jabatan === 'treasurer' ||
        (session.role && (session.role.toLowerCase().includes('bendahara') || session.role.toLowerCase().includes('treasurer'))) ||
        session.username?.toLowerCase() === 'bendahara';
      return Boolean(isTreasurer);
    }

    // Executive Board is strictly barred from modifying roles, promoting members, or altering system configurations
    return (
      permission !== 'system:configure' &&
      permission !== 'rbac:manage' &&
      permission !== 'members:promote'
    );
  }
  if (canonical === 'advisor') {
    return permission.endsWith(':view') || permission.endsWith(':export') || permission === 'calendar:edit';
  }
  // Member permissions: strictly limited to viewing attendance/calendar/assignments/announcements and self check-in
  const memberPermissions: Permission[] = [
    'attendance:view',
    'attendance:create',
    'calendar:view',
    'assignments:view',
    'announcements:view',
  ];
  return memberPermissions.includes(permission);
}

/**
 * Returns role display metadata
 */
export function getRoleMetadata(roleStr?: string | null): RoleDefinition {
  const canonical = normalizeRole(roleStr);
  return ROLE_DEFINITIONS[canonical] || ROLE_DEFINITIONS.anggota;
}

/**
 * Format executive title with icon and label
 */
export function formatTitleLabel(title?: string | null): string {
  if (!title) return 'Member';
  const found = EXECUTIVE_TITLES.find(t => t.id === title.toLowerCase().trim());
  if (found) return found.badge;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

export type CanonicalUserRole = 'admin' | 'executive_board' | 'advisor' | 'member';

/**
 * Normalizes any user session strictly into one of four canonical roles:
 * 'admin' | 'executive_board' | 'advisor' | 'member'
 */
export function getCanonicalRole(session?: {
  role?: string | null;
  jabatan?: string | null;
  membershipStatus?: string | null;
  username?: string | null;
  email?: string | null;
  authProvider?: string | null;
} | null): CanonicalUserRole {
  if (!session) return 'member';
  const cleanRole = (session.role || '').toLowerCase().trim();
  const cleanJabatan = (session.jabatan || '').toLowerCase().trim();
  const cleanStatus = (session.membershipStatus || '').toLowerCase().trim();
  const username = (session.username || '').toLowerCase().trim();
  const email = (session.email || '').toLowerCase().trim();

  // 0. Primary Administrator Check: Strictly restricted to verified administrator identifiers & ENV email
  const envAdminEmail = (
    (typeof process !== 'undefined' && (process.env?.VITE_ADMIN_EMAIL || process.env?.ADMIN_EMAIL)) ||
    (typeof import.meta !== 'undefined' && ((import.meta as any).env?.VITE_ADMIN_EMAIL || (import.meta as any).env?.ADMIN_EMAIL)) ||
    'roboticman2kotabekasi@gmail.com'
  ).toLowerCase().trim();
  const envAdminUser = envAdminEmail.split('@')[0].toLowerCase().trim();

  const isVerifiedAdmin =
    (email && (email === envAdminEmail || email === 'roboticman2kotabekasi@gmail.com')) ||
    username === envAdminUser ||
    username === 'admin' ||
    username === 'demo_admin' ||
    username === 'roboticman2kotabekasi' ||
    cleanRole === 'admin';

  if (isVerifiedAdmin) {
    return 'admin';
  }

  // 1. Explicit Student Member / Regular Account check (Strict Privilege Escalation Prevention)
  // Regular students or self-registered accounts are prohibited from claiming Admin or Executive status
  const isExplicitMember = 
    username === 'member' ||
    username === 'demo_member' ||
    username === 'anggota' ||
    username.startsWith('member') ||
    username.startsWith('siswa') ||
    username.startsWith('student') ||
    cleanRole === 'member' ||
    cleanRole === 'club member' ||
    cleanRole === 'anggota' ||
    cleanRole === 'anggota / viewer' ||
    cleanRole === 'siswa' ||
    cleanRole === 'student' ||
    cleanJabatan === 'member' ||
    cleanJabatan === 'anggota';

  if (isExplicitMember) {
    return 'member';
  }

  // 2. Faculty Advisor (Supervisory Oversight - Read-only Announcements)
  if (
    username === 'pembina' ||
    username === 'demo_pembina' ||
    (email && email === 'pembina@man2kotabekasi.sch.id') ||
    cleanRole === 'advisor' ||
    cleanRole === 'faculty advisor' ||
    cleanRole === 'pembina' ||
    cleanJabatan === 'advisor' ||
    cleanJabatan === 'pembina'
  ) {
    return 'advisor';
  }

  // 3. Authorized Executive Board (President, VP, Secretary, Treasurer, PR, BPH)
  // Gated strictly to recognized executive accounts and verified executive officers
  const isAuthorizedExecutive = 
    username === 'executive_board' ||
    username === 'demo_executive' ||
    username === 'ketua' ||
    username === 'wakil' ||
    username === 'bph' ||
    username === 'sekretaris' ||
    username === 'bendahara' ||
    username === 'pr' ||
    email === 'executive@man2kotabekasi.sch.id';

  if (isAuthorizedExecutive) {
    return 'executive_board';
  }

  // 4. Default Strict Security Fallback: Any other user is strictly a regular 'member'
  return 'member';
}

/**
 * Strict Security Guard: Only Admins and Executive Board officers are permitted to broadcast,
 * create, pin, or delete official club announcements.
 * General Club Members and Faculty Advisors are strictly read-only.
 */
export function canManageAnnouncements(session?: {
  role?: string | null;
  jabatan?: string | null;
  membershipStatus?: string | null;
  username?: string | null;
} | null): boolean {
  if (!session) return false;
  const canonical = getCanonicalRole(session);
  return canonical === 'admin' || canonical === 'executive_board';
}

/**
 * Strict Privacy & Identity Protection (UU PDP & Anti-Impersonation Guard):
 * Determines whether the current session is authorized to view unmasked student PII
 * (NIK, Student Birth Date / Login Credential, and Parent Phone Number).
 * 
 * Only:
 * 1. Head Administrator (President / Admin)
 * 2. Faculty Advisor (Pembina)
 * 3. Secretary (Sekretaris) for official school documentation
 * 4. The student themselves viewing their own profile
 * 
 * General members, other students, and guests are provided masked/redacted data.
 */
export function canViewSensitiveStudentData(
  viewerSession?: {
    role?: string | null;
    jabatan?: string | null;
    username?: string | null;
    email?: string | null;
    nisn?: string | null;
    studentId?: string | null;
  } | null,
  targetMember?: {
    nisn?: string | null;
    email?: string | null;
    id_member?: string | null;
  } | null
): boolean {
  if (!viewerSession) return false;

  // 1. If viewer is viewing their own profile
  if (targetMember) {
    if (viewerSession.nisn && targetMember.nisn && String(viewerSession.nisn).trim() === String(targetMember.nisn).trim()) {
      return true;
    }
    if (viewerSession.studentId && targetMember.id_member && String(viewerSession.studentId).trim() === String(targetMember.id_member).trim()) {
      return true;
    }
    if (
      viewerSession.email &&
      targetMember.email &&
      viewerSession.email.toLowerCase().trim() === targetMember.email.toLowerCase().trim()
    ) {
      return true;
    }
  }

  // 2. Canonical role check: Admin and Advisor
  const canonical = getCanonicalRole(viewerSession);
  if (canonical === 'admin' || canonical === 'advisor') {
    return true;
  }

  // 3. Official Executive Secretary or President
  const cleanTitle = (viewerSession.jabatan || '').toLowerCase().trim();
  const cleanRole = (viewerSession.role || '').toLowerCase().trim();
  const cleanUser = (viewerSession.username || '').toLowerCase().trim();

  if (
    cleanTitle === 'president' ||
    cleanTitle === 'secretary' ||
    cleanRole === 'sekretaris' ||
    cleanRole.includes('sekretaris') ||
    cleanRole.includes('secretary') ||
    cleanUser === 'sekretaris' ||
    cleanUser === 'ketua'
  ) {
    return true;
  }

  return false;
}

/**
 * Masks student NIK: keeps first 6 digits and last 4 digits, masks the middle digits with asterisks
 * e.g. "327508******0001"
 */
export function maskNik(nik?: string | null): string {
  if (!nik) return '-';
  const clean = String(nik).trim();
  if (clean.length < 8) return '••••••';
  const prefix = clean.slice(0, 6);
  const suffix = clean.slice(-4);
  const maskedCount = Math.max(4, clean.length - 10);
  return `${prefix}${'*'.repeat(maskedCount)}${suffix}`;
}

/**
 * Masks birth date to prevent student authentication impersonation
 * e.g. "••••-••-••"
 */
export function maskBirthDate(birthDate?: string | null): string {
  if (!birthDate) return '-';
  return '••••-••-••';
}

/**
 * Masks parent phone number to protect student family privacy:
 * e.g. "0812-••••-5678"
 */
export function maskParentPhone(phone?: string | null): string {
  if (!phone) return '-';
  const clean = String(phone).replace(/[^0-9]/g, '');
  if (clean.length < 8) return '••••••••';
  const prefix = clean.slice(0, 4);
  const suffix = clean.slice(-4);
  return `${prefix}-••••-${suffix}`;
}

/**
 * Granular RBAC feature matrix for UI table display (English)
 */
export interface RBACFeatureRow {
  category: string;
  feature: string;
  permission: Permission;
  pembina: boolean;
  ketua: boolean;
  pr: boolean;
  bph: boolean;
  sekretaris: boolean;
  bendahara: boolean;
  anggota: boolean;
  description: string;
}

export const RBAC_MATRIX: RBACFeatureRow[] = [
  // Member Directory
  {
    category: 'Member Directory',
    feature: 'View Member Roster & Profiles',
    permission: 'members:view',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: true, anggota: true,
    description: 'Inspect member list, academic classes, contact details, and club status'
  },
  {
    category: 'Member Directory',
    feature: 'Register & Edit Member Data',
    permission: 'members:create',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: false,
    description: 'Add new members and modify student academic profiles'
  },
  {
    category: 'Member Directory',
    feature: 'Promote to Admin & Assign Titles',
    permission: 'members:promote',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: false, bendahara: false, anggota: false,
    description: 'Grant admin privileges and assign titles (President, VP, Secretary, Treasurer, PR, Advisor)'
  },
  {
    category: 'Member Directory',
    feature: 'Delete & Reset Member Records',
    permission: 'members:delete',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: false,
    description: 'Remove resigned members or purge sandbox member list'
  },
  {
    category: 'Member Directory',
    feature: 'Import CSV & Bulk Roster Upload',
    permission: 'members:import',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: false,
    description: 'Bulk import students from spreadsheets or Google Forms export'
  },

  // Attendance Module
  {
    category: 'Attendance & Tracking',
    feature: 'View Attendance Records & Rates',
    permission: 'attendance:view',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: true, anggota: true,
    description: 'Review presence percentages and meeting log histories'
  },
  {
    category: 'Attendance & Tracking',
    feature: 'Log Meeting Attendance',
    permission: 'attendance:create',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: true,
    description: 'Admins log group presence; Members submit self check-in'
  },
  {
    category: 'Attendance & Tracking',
    feature: 'Reset Meeting Attendance Records',
    permission: 'attendance:reset',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: false,
    description: 'Clear presence logs for specific dates or reset history'
  },
  {
    category: 'Attendance & Tracking',
    feature: 'Export Attendance (PDF & CSV)',
    permission: 'attendance:export',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: true, anggota: false,
    description: 'Download attendance reports for school administration'
  },

  // Treasury & Cashbook
  {
    category: 'Club Treasury',
    feature: 'View Treasury Balance & Ledger',
    permission: 'cash:view',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: true, anggota: true,
    description: 'Inspect transparent income/expense records and current club balance'
  },
  {
    category: 'Club Treasury',
    feature: 'Record Dues & Equipment Expenses',
    permission: 'cash:create',
    pembina: false, ketua: false, pr: false, bph: false, sekretaris: false, bendahara: true, anggota: false,
    description: 'Record member monthly dues and components procurement (Exclusively Treasurer & Head Admin)'
  },
  {
    category: 'Club Treasury',
    feature: 'Revert Transactions & Close Books',
    permission: 'cash:delete',
    pembina: false, ketua: false, pr: false, bph: false, sekretaris: false, bendahara: true, anggota: false,
    description: 'Delete incorrect transactions or close annual financial books (Exclusively Treasurer & Head Admin)'
  },
  {
    category: 'Club Treasury',
    feature: 'Export Financial Ledger (PDF & CSV)',
    permission: 'cash:export',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: true, anggota: false,
    description: 'Generate official accountability financial reports'
  },

  // Assignments & Grading
  {
    category: 'Assignments & Grading',
    feature: 'Create Assignments & Materials',
    permission: 'assignments:create',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: false,
    description: 'Publish robotics tasks, project guidelines, and workshop slides'
  },
  {
    category: 'Assignments & Grading',
    feature: 'Grade Submissions & Provide Feedback',
    permission: 'assignments:grade',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: false,
    description: 'Evaluate student project submissions with numeric/binary scores and remarks'
  },

  // Announcements & Maintenance
  {
    category: 'Club Announcements',
    feature: 'Publish & Manage Announcements',
    permission: 'announcements:create',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: false, anggota: false,
    description: 'Broadcast alerts, competition schedules, and meeting agendas'
  },
  {
    category: 'Club Maintenance',
    feature: 'Club Maintenance & Room Customization',
    permission: 'room:maintenance',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: true, bendahara: true, anggota: false,
    description: 'Perform club maintenance: update name, description, themes, and configuration'
  },
  {
    category: 'System Governance',
    feature: 'RBAC Roles & Pre-Registration',
    permission: 'rbac:manage',
    pembina: true, ketua: true, pr: true, bph: true, sekretaris: false, bendahara: false, anggota: false,
    description: 'Promote users, assign titles, manage login credentials, and access audits'
  }
];
