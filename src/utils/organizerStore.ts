// src/utils/organizerStore.ts
// Sistem Manajemen Ekstrakurikuler Robotic MAN 2 Kota Bekasi

export type OrganizationType = 'eskul' | 'organisasi' | 'kelas' | 'kerja' | 'lainnya';

export interface CustomLabels {
  memberLabel: string; // e.g. "Anggota Ekskul"
  memberLabelPlural: string; // e.g. "Daftar Anggota Ekskul"
  adminLabel: string; // e.g. "Pembina / Ketua"
  attendanceLabel: string; // e.g. "Presensi Kegiatan & Latihan"
  cashLabel: string; // e.g. "Kas Ekstrakurikuler"
  academicOrPeriodLabel: string; // e.g. "Tahun Periode / Akademik"
}

export interface Organization {
  id: string;
  code: string;
  name: string;
  institution: string;
  category: string;
  type: OrganizationType;
  description: string;
  role: string; // The user's role in this organization
  creatorUsername?: string;
  createdAt: string;
  themeGradient: string;
  isDefault?: boolean;
  customLabels: CustomLabels;
}

export const getPresetLabels = (type: OrganizationType = 'eskul'): CustomLabels => {
  return {
    memberLabel: 'Club Member',
    memberLabelPlural: 'Member Directory',
    adminLabel: 'Executive & Advisor',
    attendanceLabel: 'Meeting & Workshop Attendance',
    cashLabel: 'Club Treasury',
    academicOrPeriodLabel: 'Academic Year & Term',
  };
};

export const DEFAULT_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-robotic-man2',
    code: 'ROBOTIC-MAN2',
    name: 'Robotic MAN 2 Kota Bekasi',
    institution: 'MAN 2 Kota Bekasi',
    category: 'Robotics, IoT & Applied Technology Club',
    type: 'eskul',
    description: 'Robotic MAN 2 Kota Bekasi Extracurricular Management System - Member roster, event attendance, treasury accounting, assignments & modules, and official announcements.',
    role: 'Robotic Club Room',
    creatorUsername: 'admin',
    createdAt: '2026-01-10T08:00:00.000Z',
    themeGradient: 'from-blue-600 via-indigo-600 to-purple-700',
    isDefault: true,
    customLabels: getPresetLabels('eskul'),
  },
];

// Helper to generate a clean, random join code
export const generateJoinCode = (prefix?: string): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let randomPart = '';
  for (let i = 0; i < 4; i++) {
    randomPart += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const cleanPrefix = prefix
    ? prefix.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4)
    : 'ORG';
  return `${cleanPrefix || 'ORG'}-${randomPart}`;
};

// Gradient options for organizers
export const GRADIENT_OPTIONS = [
  { id: 'indigo', label: 'Indigo Blue (Technology & Modern)', value: 'from-blue-600 via-indigo-600 to-purple-700' },
  { id: 'emerald', label: 'Emerald Green (Science & Research)', value: 'from-emerald-600 via-teal-600 to-cyan-700' },
  { id: 'rose', label: 'Crimson Red (Competition & Contests)', value: 'from-rose-600 via-pink-600 to-purple-600' },
  { id: 'amber', label: 'Amber Gold (Creativity & Innovation)', value: 'from-amber-600 via-orange-600 to-rose-600' },
  { id: 'violet', label: 'Violet Purple (Robotics Projects)', value: 'from-purple-700 via-violet-600 to-indigo-800' },
  { id: 'cyan', label: 'Ocean Blue (Academic & Hardware)', value: 'from-cyan-600 via-sky-600 to-blue-700' },
  { id: 'slate', label: 'Carbon Slate (Engineering & Mechanics)', value: 'from-slate-700 via-slate-800 to-zinc-900' },
];

// Type categories with icons and info
export const WORKSPACE_TYPES: {
  id: OrganizationType;
  title: string;
  badge: string;
  iconName: string;
  defaultInstitution: string;
  description: string;
}[] = [
  {
    id: 'eskul',
    title: 'Main Extracurricular Robotics Club',
    badge: '⚡ Main Club',
    iconName: 'Bot',
    defaultInstitution: 'MAN 2 Kota Bekasi',
    description: 'Robotic Club MAN 2 Kota Bekasi - Roster records, attendance, treasury, assignments, and announcements.',
  },
  {
    id: 'organisasi',
    title: 'Robotics Division / Special Branch',
    badge: '🤖 Club Division',
    iconName: 'Sparkles',
    defaultInstitution: 'MAN 2 Kota Bekasi',
    description: 'Specialized division such as Software & AI, Mechanical Hardware, IoT Arduino, or Contest Team.',
  },
];

// Get all known organizations across system (for joining by code)
export const getKnownOrganizations = (): Organization[] => {
  try {
    const raw = localStorage.getItem('global_known_organizations');
    if (raw) {
      const parsed: Organization[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const existingCodes = new Set(parsed.map((o) => o.code.toUpperCase()));
        const missingDefaults = DEFAULT_ORGANIZATIONS.filter(
          (o) => !existingCodes.has(o.code.toUpperCase())
        );
        return [...parsed, ...missingDefaults];
      }
    }
  } catch (err) {
    console.warn('Failed to parse global known organizations:', err);
  }
  return DEFAULT_ORGANIZATIONS;
};

// Save a newly created organization to global known registry
export const registerKnownOrganization = (org: Organization) => {
  try {
    const existing = getKnownOrganizations();
    const updated = [
      org,
      ...existing.filter((o) => o.id !== org.id && o.code.toUpperCase() !== org.code.toUpperCase()),
    ];
    localStorage.setItem('global_known_organizations', JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save to global known organizations:', err);
  }
};

// Update an existing organization across global registry and user storage
export const updateKnownOrganization = (orgId: string, updates: Partial<Organization>) => {
  try {
    const known = getKnownOrganizations();
    const updatedKnown = known.map((o) => (o.id === orgId ? { ...o, ...updates } : o));
    localStorage.setItem('global_known_organizations', JSON.stringify(updatedKnown));
  } catch (err) {
    console.warn('Failed to update known organization:', err);
  }
};

// Get organizations joined/created by a specific user - strictly only the 1 single official club room
export const getUserOrganizations = (username: string | undefined): Organization[] => {
  return DEFAULT_ORGANIZATIONS;
};

// Save user's joined organizations list
export const saveUserOrganizations = (username: string | undefined, orgs: Organization[]) => {
  const cleanUser = (username || 'guest').trim().toLowerCase();
  try {
    localStorage.setItem(`user_${cleanUser}_organizations`, JSON.stringify(orgs));
  } catch (err) {
    console.warn('Failed to save user organizations:', err);
  }
};

// Get currently active organization ID for a user
export const getActiveOrganizationId = (username: string | undefined): string => {
  const cleanUser = (username || 'guest').trim().toLowerCase();
  try {
    const saved = localStorage.getItem(`user_${cleanUser}_active_org_id`);
    if (saved && (saved === 'org-robotic-man2' || !saved.includes('kelas') && !saved.includes('kerja'))) {
      return saved;
    }
  } catch (err) {
    console.warn('Failed to get active org id:', err);
  }
  return DEFAULT_ORGANIZATIONS[0].id; // Robotic MAN 2
};

// Set currently active organization ID for a user
export const setActiveOrganizationId = (username: string | undefined, orgId: string) => {
  const cleanUser = (username || 'guest').trim().toLowerCase();
  try {
    localStorage.setItem(`user_${cleanUser}_active_org_id`, orgId);
  } catch (err) {
    console.warn('Failed to set active org id:', err);
  }
};

// Find an organization by its Join Code (case-insensitive)
export const findOrganizationByCode = (code: string): Organization | undefined => {
  const normalized = code.trim().toUpperCase();
  const known = getKnownOrganizations();
  return known.find((o) => o.code.toUpperCase() === normalized);
};

// Helper to get stats of members, attendance, and cash for a given org
export const getOrganizationStats = (orgId: string): { membersCount: number; attendanceCount: number; cashBalance: number } => {
  let membersCount = 0;
  let attendanceCount = 0;
  let cashBalance = 0;

  try {
    const memRaw = localStorage.getItem(`org_${orgId}_members`);
    if (memRaw) {
      const parsed = JSON.parse(memRaw);
      if (Array.isArray(parsed)) membersCount = parsed.length;
    } else if (orgId === 'org-robotic-man2') {
      const legacy = localStorage.getItem('robotics_admin_members') || localStorage.getItem('robotics_members');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) membersCount = parsed.length;
      } else {
        membersCount = 20;
      }
    } else {
      membersCount = 12; // Realistic preview count
    }

    const attRaw = localStorage.getItem(`org_${orgId}_attendance`);
    if (attRaw) {
      const parsed = JSON.parse(attRaw);
      if (Array.isArray(parsed)) attendanceCount = parsed.length;
    } else if (orgId === 'org-robotic-man2') {
      const legacy = localStorage.getItem('robotics_admin_attendance') || localStorage.getItem('robotics_attendance');
      if (legacy) {
        const parsed = JSON.parse(legacy);
        if (Array.isArray(parsed)) attendanceCount = parsed.length;
      } else {
        attendanceCount = 15;
      }
    }

    const cashRaw = localStorage.getItem(`org_${orgId}_cash`);
    if (cashRaw) {
      const parsed = JSON.parse(cashRaw);
      if (Array.isArray(parsed)) {
        cashBalance = parsed.reduce((acc: number, item: any) => {
          const nominal = typeof item.nominal === 'number' ? item.nominal : parseInt(item.nominal, 10) || 0;
          return item.jenis === 'keluar' ? acc - nominal : acc + nominal;
        }, 0);
      }
    } else {
      cashBalance = 1680000;
    }
  } catch (err) {
    console.warn('Failed to calculate org stats:', err);
  }

  return { membersCount, attendanceCount, cashBalance };
};
