# Robotic MAN 2 Kota Bekasi — CSV Import & Data Schema Specification

Official documentation for CSV formatting, column schemas, automated validation, and data synchronization for the **Robotic MAN 2 Kota Bekasi** Extracurricular Management System (`roboticman2kotabekasi`).

---

## 🔒 Security Notice & Personal Data Protection (PDP Law UU No. 27/2022)

> **CRITICAL SECURITY REQUIREMENT:**
> 1. **Never commit real student personal identifiable information (PII) to public repositories (e.g. GitHub).**
> 2. All sample templates, test fixtures, and source code mock seeds must strictly use synthetic/dummy data (e.g., synthetic `@man2kotabekasi.sch.id` addresses, dummy NISN numbers like `0110000001`, etc.).
> 3. Official student records must only be imported at runtime by authenticated Administrators through the encrypted client interface and stored securely in the private Supabase PostgreSQL database.

---

## 1. Student Member Directory Schema (`members`)

**Upload Path:** Member Directory Tab -> **"Import CSV"** Button -> Select Target: **"Member & Student Roster"**

### A. Column Specification Table

| Column Name (Header) | Required? | Data Type | Accepted Values & Formats | Example Value | System & RBAC Rules |
| :--- | :---: | :---: | :--- | :--- | :--- |
| **`NISN`** / `id_member` | **Required** | String | 10 numeric digits | `0110000001` | Unique student primary key. Used for student portal authentication, attendance check-ins, and 2FA verification. |
| **`Full Name`** / `Nama Lengkap` | **Required** | String | Alphabetical text (2–150 chars) | `Ahmad Fauzan Pratama` | Official student name. Automatic DDE formula injection sanitization (CWE-1236) is applied. |
| **`Class`** / `Kelas` | Optional | String | `X-A` through `XII-IPA 1` | `X-A`, `XI-IPA 1` | Academic grade level and classroom. If provided in combined format (e.g., `X - E-1`), the parser automatically separates grade and classroom code. |
| **`Gender`** / `Jenis Kelamin` | Optional | String | `Male`, `Female`, `Laki-laki`, `Perempuan`, `M`, `F` | `Male` / `Female` | Member gender for demographic and club activity analytics. |
| **`Date of Birth`** / `Tanggal Lahir` | Recommended | Date | `YYYY-MM-DD` or `DD/MM/YYYY` | `2009-05-14` | Used for zero-trust 2FA identity challenge when students log in to the student portal. |
| **`Role`** | Optional | Enum | `admin`, `advisor`, `pembina`, `member` | `admin` | Application authorization clearance level. |
| **`Position`** / `Jabatan` | Optional | Enum | `president`, `vice_president`, `secretary`, `treasurer`, `pr`, `advisor`, `member` | `secretary` | Official club executive title. Indonesian equivalents (`ketua`, `wakil ketua`, `sekretaris`, `bendahara`, `humas`, `pembina`) are automatically mapped. |
| **`Status`** | Optional | Enum | `executive_board`, `Active`, `Alumni`, `Resigned` | `Active` | Enrollment status. Officers and advisors are automatically assigned to `executive_board`. |
| **`Email`** | Recommended | Email | Valid email address (`user@domain.com`) | `student1@man2kotabekasi.sch.id` | Student official email. Automatically synchronized to staging table `allowed_members` for seamless Google OAuth single sign-on. |
| **`Student Phone`** / `No HP Siswa` | Optional | String | Phone / WhatsApp number | `081234567890` | Active WhatsApp contact for club project coordination. |
| **`Parent Phone`** / `No HP Ortu` | Optional | String | Phone number | `081987654321` | Emergency parent/guardian contact number. |
| **`National ID`** / `NIK` | Optional | String | 16 numeric digits | `3275012345670001` | National Identity Number (stored securely with one-way salted hashing). |
| **`Address`** / `Alamat` | Optional | String | Residential address text | `Bekasi Selatan, West Java` | Student home residence and domicile. |

### B. Role & Access Control (RBAC) Synchronization Rules

To prevent accidental privilege disruption when importing rosters:
1. **Executive Board Officers**: Any record with a position of `president`, `vice_president`, `secretary`, `treasurer`, or `pr` (or Indonesian aliases) is automatically granted `role: 'admin'` and `status: 'executive_board'`.
2. **Faculty Advisors**: Any record with position `advisor` or role `pembina` is automatically granted `role: 'pembina'`, `jabatan: 'advisor'`, and `status: 'executive_board'`.
3. **General Members**: Any record with position `member` (or left blank) is granted `role: 'member'`, `jabatan: 'member'`, and `status: 'Active'`.
4. **Google Sign-In Staging**: Any student record with an email address is automatically staged in `allowed_members`. When that student clicks "Sign in with Google", their account is immediately recognized and matched with their enrolled role.

### C. Sample CSV Template (`template_members_robotics.csv`)

```csv
NISN,Full Name,Class,Gender,Date of Birth,Role,Position,Status,Student Phone,Parent Phone,Email,National ID,Address
0110000001,Ahmad Fauzan Pratama,X-A,Male,2009-05-14,member,member,Active,081234567890,081987654321,student1@man2kotabekasi.sch.id,3275012345670001,Bekasi Selatan
0110000002,Adinda Putri Lestari,XI-B,Female,2008-08-22,admin,secretary,executive_board,082134567891,082198765432,secretary@man2kotabekasi.sch.id,3275012345670002,Rawalumbu
0110000003,Fikri Haikal,XI-D,Male,2008-07-19,admin,treasurer,executive_board,081234567892,081398765433,treasurer@man2kotabekasi.sch.id,3275012345670003,Bekasi Timur
0110000099,Muhammad Rayhan Pratama,XII-IPA 1,Male,2007-06-14,admin,president,executive_board,081298765432,081311223344,president@man2kotabekasi.sch.id,3275012345670004,Pekayon
197505121998031001,Abdul Khoir S.Kom,Advisor,Male,1975-05-12,pembina,advisor,executive_board,081200000101,-,advisor@man2kotabekasi.sch.id,3275012345670005,Bekasi
```

---

## 2. Pre-Registration & Google OAuth Staging Schema (`allowed_members`)

**Upload Path:** Admin Settings -> **"Pre-Registration & CSV Import"** Modal

### A. Column Specification Table

| Column Name (Header) | Required? | Accepted Values | Example Value |
| :--- | :---: | :--- | :--- |
| **`email`** | **Required** | Valid Google account email address | `student1@man2kotabekasi.sch.id` |
| **`nama_lengkap`** / `full_name` | **Required** | Student full name | `Budi Santoso` |
| **`nis_atau_kelas`** / `nisn_class` | Optional | Combined NISN and Class code | `0110000007/X-A` |
| **`jabatan_ekskul`** / `position` | Optional | `member`, `secretary`, `treasurer`, `president`, `vice_president`, `pr`, `advisor` | `member` |

### B. Sample CSV Template (`template_pre_registration_robotics.csv`)

```csv
email,nama_lengkap,nis_atau_kelas,jabatan_ekskul
student1@man2kotabekasi.sch.id,Budi Santoso,0110000007/X-A,member
student2@man2kotabekasi.sch.id,Annisa Rahmawati,0110000004/X-F,secretary
treasurer@man2kotabekasi.sch.id,Fikri Haikal,0110000003/XI-D,treasurer
president@man2kotabekasi.sch.id,Ahmad Pratama,0110000002/XI-D,president
advisor@man2kotabekasi.sch.id,Abdul Khoir S.Kom,FACULTY_ADVISOR,advisor
```

---

## 3. Daily Attendance Record Schema (`attendance`)

**Upload Path:** Attendance Tab -> **"Import CSV"** Button

| Column Name | Required? | Format | Example Value | Notes |
| :--- | :---: | :--- | :--- | :--- |
| **`Date`** / `Tanggal` | Required | `YYYY-MM-DD` | `2026-09-12` | Workshop meeting date. |
| **`NISN`** | Required | 10 numeric digits | `0110000001` | Unique student identifier. |
| **`Member Name`** / `Nama Siswa` | Optional | Text | `Ahmad Fauzan Pratama` | Matched with directory roster if NISN is omitted. |
| **`Status`** | Required | `Present`, `Excused`, `Sick`, `Absent` (or `Hadir`, `Izin`, `Sakit`, `Alpha`) | `Present` | Attendance status. |

### Sample Attendance CSV:
```csv
Date,NISN,Member Name,Status
2026-09-12,0110000001,Ahmad Fauzan Pratama,Present
2026-09-12,0110000002,Adinda Putri Lestari,Present
2026-09-12,0110000003,Fikri Haikal,Excused
```

---

## 4. Club Treasury & Cash Transactions Schema (`cash_transactions`)

**Upload Path:** Treasury Tab -> **"Import CSV"** Button

| Column Name | Required? | Format | Example Value | Notes |
| :--- | :---: | :--- | :--- | :--- |
| **`Date`** / `Tanggal` | Required | `YYYY-MM-DD` | `2026-09-12` | Transaction date. |
| **`NISN`** | Optional | 10 numeric digits | `0110000001` | Payer NISN for club dues. Left blank for general operating expenses. |
| **`Member Name`** / `Nama Siswa` | Optional | Text | `Ahmad Fauzan Pratama` | Student name or vendor/supplier name. |
| **`Type`** / `Jenis` | Required | `Inflow` (Masuk) or `Outflow` (Keluar) | `Inflow` | Cash direction. |
| **`Amount`** / `Jumlah` | Required | Positive numeric number | `5000` | Transaction value in IDR (no currency symbols). |
| **`Description`** / `Keterangan` | Required | Text | `Club Dues September Week 1` | Memo or purpose description. |

### Sample Treasury CSV:
```csv
Date,NISN,Member Name,Type,Amount,Description
2026-09-12,0110000001,Ahmad Fauzan Pratama,Inflow,5000,Club Dues September Week 1
2026-09-12,0110000002,Adinda Putri Lestari,Inflow,5000,Club Dues September Week 1
2026-09-12,,,Outflow,50000,Sensors & Screws Hardware Components
```

---

## 5. System Resilience & Parser Features

1. **Multi-Delimiter Detection**: Supports comma (`,`), semicolon (`;`), and tab (`\t`) delimited files automatically.
2. **Byte Order Mark (BOM) Sanitization**: Automatically strips UTF-8 BOM headers (`\uFEFF`) generated by Microsoft Excel.
3. **RFC-4180 Escaped Quoting**: Full support for multiline values and quotes within cells (e.g. `"Bekasi, West Java"`).
4. **Formula Injection Sanitization (CWE-1236)**: Any leading dangerous characters (`=`, `+`, `-`, `@`) are escaped with a prepended single quote (`'`).
5. **Deduplication Engine**: Identifies duplicate NISN entries in batch uploads and prompts user for Upsert vs. Skip action.
6. **Schema Fallback**: Gracefully handles missing database columns in legacy tables without aborting valid rows.
