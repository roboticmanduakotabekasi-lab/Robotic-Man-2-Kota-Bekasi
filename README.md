# Robotic MAN 2 Kota Bekasi Management System (`roboticman2kotabekasi`)

[![Release Year](https://img.shields.io/badge/Release_Year-2026-blue.svg)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6.svg?logo=typescript&logoColor=white)](#)
[![React](https://img.shields.io/badge/React-19.0-61DAFB.svg?logo=react&logoColor=black)](#)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-38B2AC.svg?logo=tailwind-css&logoColor=white)](#)
[![Supabase](https://img.shields.io/badge/Supabase-Database_%26_Auth-3ECF8E.svg?logo=supabase&logoColor=white)](#)
[![Privacy Compliance](https://img.shields.io/badge/Data_Privacy-PDP_UU_27%2F2022-success.svg)](#-data-security-privacy--pdp-compliance)
[![Organization](https://img.shields.io/badge/Organization-MAN_2_Kota_Bekasi-emerald.svg)](#-credits--development-team)

An enterprise-grade, responsive, and secure club management platform designed specifically for the **Robotics Extracurricular Club at MAN 2 Kota Bekasi** (`roboticman2kotabekasi`). The platform unifies student member rosters, laboratory session attendance tracking, treasury cash dues accounting, challenge submissions & grading, academic workshop schedules, and official announcement broadcasts.

---

## 📑 Table of Contents

1. [Executive Overview & Architecture](#-executive-overview--architecture)
2. [Role-Based Access Control (RBAC) & Hierarchy](#-role-based-access-control-rbac--hierarchy)
3. [NISN & Student Identity Verification Workflow](#-nisn--student-identity-verification-workflow)
4. [Environment Variables & Configuration](#-environment-variables--configuration)
5. [Supabase Cloud Database Setup](#-supabase-cloud-database-setup)
6. [Local Development & Installation](#-local-development--installation)
7. [Subdomain & Production Deployment Guide](#-subdomain--production-deployment-guide)
8. [CSV Import Specification & Universal Parser](#-csv-import-specification--universal-parser)
9. [Data Security, Privacy & PDP Compliance](#-data-security-privacy--pdp-compliance)
10. [Core Functional Modules](#-core-functional-modules)
11. [Credits & Development Team](#-credits--development-team)

---

## 🏛️ Executive Overview & Architecture

`roboticman2kotabekasi` bridges administration, faculty advisors, executive student committees, and enrolled club members into a unified, high-density digital workspace. It combines modern SaaS ergonomics with zero-trust security and full offline resilience.

```
+-----------------------------------------------------------------------------------+
|                        roboticman2kotabekasi Unified Portal                       |
+-----------------------------------------+-----------------------------------------+
|        Administrative Workspace         |          Student Member Portal          |
|  (Admin, Executive Board, Advisors)     |           (Enrolled Students)           |
+-----------------------------------------+-----------------------------------------+
| - Real-time KPI Analytics Dashboard     | - NISN + Date of Birth Verification     |
| - Student Master Directory (CRUD)       | - Self Attendance Check-In              |
| - Laboratory Attendance Engine          | - Challenges & Assignment Submissions   |
| - Club Treasury & Monthly Dues Matrix   | - Personal Attendance Recaps            |
| - Curriculum, Challenges & Grading      | - Official Announcements Feed           |
| - Academic Calendar & Workshop Agenda   | - Club ID Card Generator with QR Code   |
| - Role Access Control (RBAC) & SOP      | - Profile & Account Settings            |
+-----------------------------------------+-----------------------------------------+
|                  Persistence & Realtime Synchronization Layer                    |
|      Supabase PostgreSQL + Row Level Security (RLS) + Local Offline Fallback     |
+-----------------------------------------------------------------------------------+
```

### Key Architectural Strengths
- **Dual Interface Modes**: Dedicated *Administrative Workspace* for operators and a streamlined *Student Member Portal* (`StudentAssignmentsView`, `AttendanceTab`, `CalendarTab`) for enrolled students.
- **Strict Role Isolation**: Students cannot access administrative dashboards, financial ledgers, or promotion controls; faculty advisors hold supervisory audit rights; executive board members manage day-to-day club sessions.
- **Offline Resilience**: Local storage caching ensures attendance checks and transaction entries can continue even during intermittent workshop network connectivity.
- **Real-Time Data Streaming**: Supabase Realtime channels push live attendance records and roster updates across connected devices instantly.

---

## 🛡️ Role-Based Access Control (RBAC) & Hierarchy

The application enforces a formal role hierarchy mapped to standard operating procedures (SOP):

```
                        +----------------------------+
                        |      Super Administrator   |
                        |          (`admin`)         |
                        +--------------+-------------+
                                       |
                        +--------------v-------------+
                        |       Executive Board      |
                        |    (`executive_board`)     |
                        +--------------+-------------+
                                       |
                        +--------------v-------------+
                        |       Faculty Advisor      |
                        |        (`advisor`)         |
                        +--------------+-------------+
                                       |
                        +--------------v-------------+
                        |        Club Member         |
                        |        (`member`)          |
                        +----------------------------+
```

### Detailed Role Permission Matrix

| Feature / Action | Super Admin (`admin`) | Executive Board (`executive_board`) | Faculty Advisor (`advisor`) | Club Member (`member`) |
|:---|:---:|:---:|:---:|:---:|
| **Analytics Dashboard** | Full Access | Full Access | Supervisory Overview | Hidden |
| **Member Directory Management** | Full CRUD + Export | Full CRUD + Export | Read-Only Audit | Hidden |
| **Attendance Check-ins** | Full Management | Full Management | Read-Only Audit | Self Check-in Only |
| **Reset Date / Bulk Attendance** | Yes | Yes | No | No |
| **Treasury & Monthly Dues Ledger** | Full CRUD | Full CRUD | Audit View | Hidden |
| **Assignment Creation & Grading** | Full CRUD | Full CRUD | Review & Audit | Submit Solution Only |
| **Broadcast Announcements** | Create & Delete | Create & Delete | Read-Only | Read-Only |
| **Academic Calendar Setup** | Full Control | Full Control | Review | Read-Only |
| **RBAC Role Demotion / Promotion**| Full Control | No | No | No |
| **Pre-Registration CSV Staging** | Full Control | Full Control | No | No |
| **Bypass NISN Verification** | Yes | Yes | Yes | No (Mandatory) |

### Canonical Role Definitions
1. **Super Administrator (`admin`)**: Master system operator. Manages database synchronization, oversees user authentication, audits financial logs, and controls system-level permissions. Authorized to broadcast and delete club announcements.
2. **Executive Board (`executive_board`)**: Student officers (President/Ketua, Vice President/Wakil Ketua, Secretary/Sekretaris, Treasurer/Bendahara, Public Relations/Humas). Manages daily meetings, marks attendance, tracks club dues, creates challenges, and broadcasts official announcements.
3. **Faculty Advisor (`advisor`)**: School mentors and supervising teachers (*Pembina Ekstrakurikuler*). Holds supervisory clearance to inspect attendance records, gradebooks, and financial ledgers. Has read-only clearance on announcements.
4. **Club Member (`member`)**: Enrolled students of MAN 2 Kota Bekasi. Verified via their NISN and date of birth, allowing them to participate in meetings, log attendance, and submit project challenges. Strictly read-only for announcements and treasury.

> 🔒 **Fatal Security Constraint (Announcements & Treasury)**:
> Club members can **never** create, broadcast, or delete announcements, nor view the club treasury cashbook. Only authenticated Administrators and Executive Board officers have clearance to manage these sections.

---

## 🔍 NISN & Student Identity Verification Workflow

To safeguard student privacy and prevent unauthorized account takeovers, the platform implements a zero-trust verification gate:

```
[Student Signs Up / Logs In via Google or Email]
                       │
                       ▼
         [Check Membership Status]
          Is user an Admin/Executive?
          ├── YES ──► Bypass verification ──► Enter Administrative Workspace
          └── NO  ──► Check `isVerified` status in Database
                       │
                       ├─► Already Verified ──► Enter Member Portal
                       │
                       ▼
      [StudentVerificationModal Triggered]
                       │
                       ├─► Student enters 10-digit NISN
                       │   (Nomor Induk Siswa Nasional)
                       │
                       ├─► Student enters Date of Birth
                       │   (Format: YYYY-MM-DD or DD/MM/YYYY)
                       │
                       ▼
       [Cross-Validation Against Master Roster]
       Does NISN match student roster AND
       Does Date of Birth match record?
                       │
       ├── NO  ──► Display detailed mismatch error; restrict access
       │
       └── YES ──► 1. Mark account as `isVerified: true`
                   2. Link profile ID to `id_member`
                   3. Unlock access to Student Member Portal
```

### Verification Security Rules
- **10-Digit NISN Validation**: Validates that the entered identifier consists of exactly 10 numeric digits according to the Indonesian Ministry of Education standard.
- **Dual-Factor Cross Check**: Even if a student's NISN is known to peers, the date of birth prevents fraudulent identity takeover.
- **One-Account Claim Rule**: Each NISN can only be tied to a single verified user session.
- **Admin Emergency Override**: System administrators can manually verify students or correct date-of-birth records via the *Member Directory* detail modal.
- **Demo Sandbox Mode**: Sandbox demo accounts allow instant testing without locking out reviewers, maintaining isolated local mock storage (`robotics_demo_sandbox_*`).

---

## ⚙️ Environment Variables & Configuration

Create a `.env` file in the project root directory. An annotated `.env.example` file is provided:

```bash
cp .env.example .env
```

### Complete Environment Specification

```ini
# ==============================================================================
# PRIMARY ADMINISTRATOR CREDENTIALS (BACKEND & VITE CLIENT)
# ==============================================================================
# Master admin email used for initial authentication and seed verification
ADMIN_EMAIL=roboticman2kotabekasi@gmail.com

# Master admin password
ADMIN_PASSWORD=your_secure_admin_password

# Client-side exposed admin credentials for fallback authentication
VITE_ADMIN_EMAIL=roboticman2kotabekasi@gmail.com
VITE_ADMIN_PASSWORD=your_secure_admin_password

# ==============================================================================
# SUPABASE DATABASE & AUTHENTICATION CONFIGURATION
# ==============================================================================
# Obtain from: Supabase Dashboard -> Project Settings -> API -> Project URL
VITE_SUPABASE_URL=https://your-project-id.supabase.co

# Obtain from: Supabase Dashboard -> Project Settings -> API -> anon public key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Server vs. Client Variable Propagation

| Variable Name | Scope | Default Value | Purpose |
|:---|:---|:---|:---|
| `ADMIN_EMAIL` | Backend (`server.ts`) | `roboticman2kotabekasi@gmail.com` | Master administrative login email for `/api/auth/login` |
| `ADMIN_PASSWORD` | Backend (`server.ts`) | `Configured in .env` | Master password for administrator clearance |
| `VITE_ADMIN_EMAIL` | Frontend (`authConfig.ts`) | `roboticman2kotabekasi@gmail.com` | Client-side admin credential matching |
| `VITE_ADMIN_PASSWORD` | Frontend (`authConfig.ts`) | `Configured in .env` | Client-side admin password verification |
| `VITE_SUPABASE_URL` | Frontend (`supabase.ts`) | *Empty* | Supabase cloud endpoint URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend (`supabase.ts`) | *Empty* | Supabase anonymous API key for queries and auth |

> ⚠️ **Important Security Note**: Never commit the `.env` file with production secrets to public version control. Keep `.env` listed in `.gitignore`.

---

## 🗄️ Supabase Cloud Database Setup

The database uses PostgreSQL with a 3rd Normal Form (3NF) relational design.

### 1. Create a Supabase Project
1. Log in to [supabase.com](https://supabase.com/) and create a new project.
2. Select your preferred region (e.g., `Singapore - ap-southeast-1` for low latency in Indonesia).
3. Copy the **Project URL** and **anon public API Key** into your `.env` file.

### 2. Execute SQL Schema
Navigate to the **SQL Editor** tab in the Supabase Dashboard and run the schema located in `supabase_clean_schema.sql` (or `schema.sql`):

```sql
-- 1. Members Master Table
CREATE TABLE IF NOT EXISTS public.members (
    id_member VARCHAR(20) PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    email VARCHAR(100) DEFAULT '',
    full_name VARCHAR(150) NOT NULL,
    grade VARCHAR(10) DEFAULT 'X',
    class_room VARCHAR(10) DEFAULT '',
    gender VARCHAR(20) DEFAULT 'Male',
    nik VARCHAR(30) DEFAULT '',
    nisn VARCHAR(30) DEFAULT '',
    address TEXT DEFAULT '',
    personal_phone VARCHAR(30) DEFAULT '',
    parent_phone VARCHAR(30) DEFAULT '',
    birth_date VARCHAR(20) DEFAULT '',
    status VARCHAR(30) DEFAULT 'Active',
    account_username VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Daily Attendance Ledger
CREATE TABLE IF NOT EXISTS public.attendance (
    id VARCHAR(50) PRIMARY KEY,
    tanggal DATE NOT NULL,
    id_member VARCHAR(20) NOT NULL REFERENCES public.members(id_member) ON UPDATE CASCADE ON DELETE CASCADE,
    nisn VARCHAR(30) DEFAULT '',
    nama_anggota VARCHAR(150) DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'Hadir',
    notes TEXT DEFAULT '',
    account_username VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_attendance_date_member UNIQUE (tanggal, id_member),
    CONSTRAINT chk_attendance_status CHECK (status IN ('Hadir', 'Izin', 'Sakit', 'Alpha', 'Present', 'Excused', 'Sick', 'Unexcused'))
);

-- 3. Club Treasury & Cash Ledger
CREATE TABLE IF NOT EXISTS public.cash_transactions (
    id VARCHAR(50) PRIMARY KEY,
    tanggal DATE NOT NULL,
    id_member VARCHAR(20) REFERENCES public.members(id_member) ON UPDATE CASCADE ON DELETE SET NULL,
    nisn VARCHAR(30) DEFAULT '',
    nama_anggota VARCHAR(150) DEFAULT '',
    jenis VARCHAR(20) NOT NULL DEFAULT 'Masuk',
    jumlah NUMERIC(12, 2) NOT NULL DEFAULT 0,
    keterangan TEXT DEFAULT '',
    account_username VARCHAR(50) DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_cash_jenis CHECK (jenis IN ('Masuk', 'Keluar', 'Inflow', 'Outflow'))
);

-- 4. Official Announcements Feed
CREATE TABLE IF NOT EXISTS public.announcements (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    author VARCHAR(100) NOT NULL DEFAULT 'Executive Board',
    author_role VARCHAR(50) DEFAULT 'executive_board',
    category VARCHAR(50) DEFAULT 'general',
    is_pinned BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Curriculum Materials & Challenges Table
CREATE TABLE IF NOT EXISTS public.materials_assignments (
    id VARCHAR(50) PRIMARY KEY,
    type VARCHAR(20) NOT NULL DEFAULT 'assignment',
    title VARCHAR(200) NOT NULL,
    description TEXT DEFAULT '',
    category VARCHAR(50) DEFAULT 'Hardware',
    due_date VARCHAR(50) DEFAULT '',
    passing_score NUMERIC(5, 2) DEFAULT 75,
    instructions TEXT DEFAULT '',
    resource_link TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Student Assignment Submissions Table
CREATE TABLE IF NOT EXISTS public.assignment_submissions (
    id VARCHAR(50) PRIMARY KEY,
    assignment_id VARCHAR(50) NOT NULL REFERENCES public.materials_assignments(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL,
    student_email VARCHAR(100) DEFAULT '',
    student_name VARCHAR(150) NOT NULL,
    submission_text TEXT DEFAULT '',
    submission_link TEXT DEFAULT '',
    file_name VARCHAR(255),
    file_data TEXT,
    status VARCHAR(30) DEFAULT 'submitted',
    score_numeric NUMERIC(5, 2),
    feedback TEXT DEFAULT '',
    submitted_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance;
ALTER PUBLICATION supabase_realtime ADD TABLE public.cash_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.materials_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.assignment_submissions;
```

---

## 💻 Local Development & Installation

### Prerequisites
- **Node.js**: `v20.x` or `v22.x`
- **Package Manager**: `npm` (v10+), `bun`, or `pnpm`

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/your-org/roboticman2kotabekasi.git
cd roboticman2kotabekasi

# 2. Install dependencies
npm install

# 3. Setup environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start the full-stack development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your web browser.

### Available Scripts

| Command | Action |
|:---|:---|
| `npm run dev` | Runs the development server with TSX & Vite (`server.ts` on port 3000) |
| `npm run build` | Compiles production assets into the `dist/` directory |
| `npm run preview` | Previews the compiled production build locally |
| `npm run lint` | Runs TypeScript typecheck (`tsc --noEmit`) to validate the codebase |

---

## 🌐 Subdomain & Production Deployment Guide

Deploy `roboticman2kotabekasi` under a custom school subdomain (e.g., `robotik.man2kotabekasi.sch.id` or `app.roboticman2.my.id`).

### Option 1: VPS / Cloud Server Deployment (Nginx + Let's Encrypt SSL)

#### Step 1: DNS Configuration
Add an `A` record in your school's domain registrar / DNS provider:
- **Type**: `A`
- **Name / Host**: `robotik` (or full subdomain `robotik.man2kotabekasi.sch.id`)
- **Target / Value**: `<YOUR_SERVER_PUBLIC_IP>`
- **TTL**: `3600` (or Automatic)

#### Step 2: Build the Application on the Server
```bash
# Clone to server directory
cd /var/www/roboticman2kotabekasi

# Install dependencies and build
npm ci
npm run build
```

#### Step 3: Configure PM2 for Backend Server
```bash
# Install PM2 globally
npm install -g pm2

# Start server using tsx / node
pm2 start server.ts --name "roboticman2" --time
pm2 save
pm2 startup
```

#### Step 4: Configure Nginx Reverse Proxy
Create `/etc/nginx/sites-available/robotik.man2kotabekasi.sch.id`:

```nginx
server {
    listen 80;
    server_name robotik.man2kotabekasi.sch.id;

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name robotik.man2kotabekasi.sch.id;

    # SSL Certificate Paths (generated by Certbot)
    ssl_certificate /etc/letsencrypt/live/robotik.man2kotabekasi.sch.id/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/robotik.man2kotabekasi.sch.id/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;

    root /var/www/roboticman2kotabekasi/dist;
    index index.html;

    # Single Page Application (SPA) Client Routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Proxy to Node.js Backend Server
    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site and obtain free SSL via Certbot:
```bash
sudo ln -s /etc/nginx/sites-available/robotik.man2kotabekasi.sch.id /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt Certificate
sudo certbot --nginx -d robotik.man2kotabekasi.sch.id
```

---

### Option 2: Vercel Deployment

1. Push your repository to GitHub or GitLab.
2. Import the project into the [Vercel Dashboard](https://vercel.com/).
3. In **Project Settings** -> **Domains**, add `robotik.man2kotabekasi.sch.id`.
4. Configure your DNS provider with the CNAME record indicated by Vercel:
   - **Type**: `CNAME`
   - **Name**: `robotik`
   - **Target**: `cname.vercel-dns.com`
5. In **Environment Variables**, provide `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`.
6. SPA routing is automatically handled by the included `vercel.json`:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```

---

## 📊 CSV Import Specification & Universal Parser

Full column specifications, formatting rules, and validation guides are documented in [docs/CSV_IMPORT_SCHEMA.md](docs/CSV_IMPORT_SCHEMA.md).

### Built-in Universal Parser Features (`src/utils/universalDataParser.ts`)
1. **Multi-Format Ingestion**: Parses `.csv`, `.tsv`, `.xlsx`, `.xls`, digital `.pdf` tabular documents, and structured `.json` emergency backup files.
2. **Native JSON Backup Restoration**: Direct 1-click import and restoration of emergency system backups (`backup_darurat_*.json`) for members, cash transactions, or attendance records.
3. **Flexible Header Mapping**: Automatically recognizes English and Indonesian header aliases (e.g. `Full Name`, `Nama Lengkap`, `Date of Birth`, `Tanggal Lahir`, `Student Phone`, `No HP Siswa`, `Jumlah`, `Keterangan`).
4. **Formula Injection Sanitization (CWE-1236)**: Strips and neutralizes unsafe leading characters (`=`, `+`, `-`, `@`, `\t`, `\r`) with a safe apostrophe (`'`) while preserving valid numeric signs and telephone prefixes (`+62`).
5. **Interactive Column Mapper**: Operators can manually review, re-map, and adjust header fields before committing rows.
6. **Upsert vs. Replace Modes**: Operators can selectively merge new student rows or perform a full table reset.

### Downloadable CSV Template Examples
- **Member Roster Template**: `template_members_robotics.csv`
  ```csv
  NISN,Full Name,Class,Gender,Date of Birth,Role,Position,Status,Student Phone,Parent Phone,Email,National ID,Address
  0110000001,Ahmad Fauzan Pratama,X-A,Male,2009-05-14,member,member,Active,081234567890,081987654321,student1@man2kotabekasi.sch.id,3275012345670001,Bekasi Selatan
  ```
- **Treasury Cash Template**: `template_treasury_robotics.csv`
  ```csv
  Date,NISN,Member Name,Type,Amount,Description
  2026-09-12,0110000001,Ahmad Fauzan Pratama,Inflow,5000,Club Dues September Week 1
  ```
- **Attendance Template**: `template_attendance_robotics.csv`
  ```csv
  Date,NISN,Member Name,Status
  2026-09-12,0110000001,Ahmad Fauzan Pratama,Present
  ```

---

## 🔒 Data Security, Privacy & PDP Compliance

1. **PDP Law Compliance (UU No. 27/2022)**: Designed in accordance with Indonesia's Personal Data Protection Act. Student telephone numbers, parent contacts, national ID numbers (NIK), and dates of birth are protected against unauthorized public exposure with granular masking toggles.
2. **Server-Side Credential Isolation & Rate Limiting**: Administrative passwords are kept strictly on the backend (`server.ts` via `process.env.ADMIN_PASSWORD`) and never exposed in client bundles. Login routes enforce IP-based rate limiting and temporary lockouts after 5 consecutive failed attempts.
3. **Hardened Row-Level Security (RLS)**: Public `anon` users cannot delete or modify treasury entries, attendance records, or student rosters. Anonymous password dumping from `user_accounts` is blocked.
4. **Emergency Auto-Download Snapshot**: Before executing any destructive reset (cash ledger wipe, roster clear, or attendance history reset), the application automatically generates and triggers a client download of a timestamped JSON backup (`backup_darurat_*.json`) directly to the operator's computer.
5. **PBKDF2 Password Hashing**: Passwords use PBKDF2-SHA256 salted hashing with 100,000 iterations via the WebCrypto API.
6. **Role Escalation Guards**: Client session states are sanitized against tampered local storage values. Regular students cannot elevate their clearance to `admin` or `executive_board`.
7. **Formula Injection Defense (CWE-1236)**: All inputs from CSV, Excel, and spreadsheet uploads are sanitized upon ingestion to eliminate spreadsheet formula execution risks.
8. **WIB Timezone Synchronization**: All date inputs, attendance windows, and ledger stamps synchronize accurately to the `Asia/Jakarta` (WIB, UTC+7) timezone to prevent cross-day rollover discrepancies.
9. **Clean Telemetry Boundary**: Zero third-party trackers, external ad scripts, or telemetry trackers.

---

## 🚀 Core Functional Modules

### 1. Member Directory & Roster Management
- **Universal Import**: Import rosters from CSV or Excel (`.xlsx`) files with auto-detection of column headers.
- **Student ID Cards**: Generate individual membership cards featuring dynamic QR codes and student credentials.
- **Export Capabilities**: Export filtered rosters to formatted PDF tables or spreadsheet files.

### 2. Daily Attendance Engine
- **Relational Integrity**: Attendance records are bound to student NISN keys with cascade integrity.
- **Quick Actions**: One-click *Mark All Present*, rapid status filtering, and custom notes for excused/sick absences.
- **Auditing & History**: Complete attendance logs with timestamps and operator signatures.

### 3. Treasury & Cash Ledger
- **12-Month Matrix**: Visual grid representing student dues payments across all 12 calendar months.
- **Financial Categorization**: Explicit categorization of operational inflows and outflows (microcontrollers, sensors, 3D printing filaments, competition registrations).
- **Automated Balances**: Real-time balance recalculation with downloadable financial statements.

### 4. Course Tasks, Challenges & Grading
- **Robotics Curriculum**: Practical assignments covering Arduino, ESP32, IoT sensors, line follower algorithms, and CAD mechanics.
- **Student Submission Hub**: Students submit cloud links (Google Drive, GitHub, Tinkercad) and file attachments directly in `StudentAssignmentsView`.
- **Evaluation Matrix**: Executive board and advisors award points and provide qualitative feedback in `AdminTasksGradingView`.

---

## 👥 Credits & Development Team

Developed for the **2026 Term** of **Robotic MAN 2 Kota Bekasi**:

* **Public Relations 1 (2026)**: Inashaura Azkazola Ridalistiyanti
* **Public Relations 2 (2026)**: Daeniesh Raeisya Achmad
* **Supervising Mentors & Advisors**: Pembina & Tim Pelatih Robotik MAN 2 Kota Bekasi
* **Institution**: Madrasah Aliyah Negeri 2 Kota Bekasi, West Java, Indonesia

---

*© 2026 Robotic MAN 2 Kota Bekasi. All rights reserved.*
