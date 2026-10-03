# Sodiq School — Online Entrance Test Platform

A clean, modern, mobile-friendly web app where students take a grade-based
entrance test, submit their details, and instantly receive a placement level.
Admins manage tests/questions and review, filter, and export all results.

Built with **Next.js 15 (App Router) + TypeScript**, **PostgreSQL + Prisma**,
**Tailwind CSS**, and JWT-cookie admin authentication.

---

## ✨ Features

**Student side**
- Personal-info form with validation (no empty submissions).
- Grade-based multiple-choice tests (Grades 2–11), each with its own question set.
- Countdown **timer** that auto-submits when time runs out.
- Server-side scoring → total score, percentage, and suggested English level.
- "Thank you" page with the result summary.
- One submission per phone number (duplicate/fake protection) unless an admin allows a retake.

**Admin side** (`/admin`)
- Secure login (bcrypt + signed JWT cookie); all admin routes protected by middleware.
- Dashboard: students tested, average / highest / lowest score, breakdown by grade and by level.
- Students list with **search** (name/phone), **filters** (grade, level, score range, date range), and pagination.
- Per-student detail: full info + every answer marked correct/wrong.
- **Tests & Questions** manager: edit title, timer and active state per grade; add / edit / delete questions (4 options, one correct), and tag each question's **source** (Cambridge / Oxford / Pearson).
- **Export to CSV** (Excel-compatible) — respects the active filters.
- Delete duplicate / fake submissions; toggle "allow retake".

---

## 🧱 Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | Next.js 15 (App Router) + TypeScript |
| Styling    | Tailwind CSS (brand orange / navy / white) |
| Database   | PostgreSQL (local or Supabase)      |
| ORM        | Prisma                              |
| Auth       | JWT (jose) in httpOnly cookie + bcrypt |
| Validation | Zod (shared client + server)        |

---

## 🗂️ Database Schema

Entrance-test tables (see `prisma/schema.prisma`; the attendance tracker adds nine more, listed in its own section below):

- **AdminUser** — dashboard users (email, password hash, name, role).
- **Test** — one per grade; holds `timeLimitSec` and `isActive`.
- **Question** — belongs to a Test; ordered text + optional `source` (publisher).
- **Option** — A/B/C/D choice; `isCorrect` flag (never sent to students).
- **Student** — personal info + `allowRetake`.
- **Submission** — a completed attempt: score, percentage, level, duration.
- **StudentAnswer** — the option a student chose per question + correctness.

---

## 🚀 Run Locally

### 1. Prerequisites
- Node.js 18+ (tested on Node 22)
- A PostgreSQL database (local install or a free Supabase project)

### 2. Install
```bash
npm install
```

### 3. Configure environment
Copy the example file and fill in your values:
```bash
cp .env.example .env
```
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sodiq_school?schema=public"
AUTH_SECRET="<run: openssl rand -base64 32>"
ADMIN_EMAIL="admin@sodiqschool.uz"
ADMIN_PASSWORD="Admin12345!"
ADMIN_NAME="Sodiq School Admin"
```

### 4. Create the schema & seed data
```bash
npm run db:push     # create tables
npm run db:seed     # create admin user + one test per grade with sample questions
```

### 5. Start
```bash
npm run dev
```
- Student test: <http://localhost:3000/test>
- Admin login: <http://localhost:3000/admin/login> (use `ADMIN_EMAIL` / `ADMIN_PASSWORD`)

> **Change `ADMIN_PASSWORD` and `AUTH_SECRET` before deploying.**

---

## 📜 NPM Scripts

| Script             | Description                                  |
| ------------------ | -------------------------------------------- |
| `npm run dev`      | Start the dev server                         |
| `npm run build`    | Generate Prisma client + production build    |
| `npm run start`    | Start the production server                  |
| `npm run db:push`  | Push the Prisma schema to the database       |
| `npm run db:migrate` | Create a versioned migration (prod-grade)  |
| `npm run db:seed`  | Seed admin user + tests/questions            |
| `npm run db:studio`| Open Prisma Studio to browse data            |

---

## ☁️ Deploy

**Recommended: Vercel + a hosted Postgres (Supabase / Neon / Vercel Postgres).**

1. Push this repo to GitHub.
2. On the database provider, create a Postgres database and copy its connection string.
3. Import the repo into **Vercel**. Set environment variables (`DATABASE_URL`,
   `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`).
4. The build command (`npm run build`) runs `prisma generate` automatically.
5. After the first deploy, apply the schema and seed once:
   ```bash
   # from your machine, pointed at the production DATABASE_URL
   npx prisma migrate deploy   # or: npx prisma db push
   npm run db:seed
   ```

Cookies are marked `secure` automatically in production, so the app must be served over HTTPS (Vercel does this by default).

---

## 🎨 Branding & Logo

- Brand colors: **orange `#F58220`** (primary, from the logo), **navy** (dark text/headers), **white** (background). Defined in `tailwind.config.ts` as the `brand` and `navy` tokens.
- The shield logo lives at `public/logo.svg` (also used as the favicon via `src/app/icon.svg`). The committed file is a faithful recreation in brand orange — **replace `public/logo.svg` (and `src/app/icon.svg`) with the official artwork** to use the exact asset; the `<Logo />` component will pick it up automatically.

## 📚 Question Bank Policy

Questions are intended to come **only from Cambridge, Oxford, and Pearson** materials. Each question has an optional **`source`** field (set in the admin question editor) so you can record which publisher it came from. The seed includes a few sample questions for layout/testing only — replace them with your licensed content via the admin panel. To respect copyright, do not paste publisher text verbatim if you cannot license it; enter your own questions aligned to those syllabi and tag the source.

## 🔒 Security Notes
- Correct answers (`isCorrect`) are **never** sent to the browser; scoring is done only on the server.
- Admin API routes verify the session on every request; pages are gated by `src/middleware.ts`.
- Passwords are hashed with bcrypt; sessions are short-lived signed JWTs in httpOnly cookies.
- All forms are validated on both the client and the server with Zod.

---

## 📁 Project Structure
```
prisma/
  schema.prisma        # database schema (entrance test + attendance)
  seed.ts              # admin user + per-grade tests/questions
src/
  middleware.ts        # protects /admin and /attendance routes
  lib/                 # prisma, auth, validation, scoring/levels, csv, stats, filters
  components/          # Brand, Spinner, test/* (student flow), admin/* (dashboard UI)
  app/
    page.tsx           # landing
    test/              # student form + quiz (timer)
    thank-you/         # result page
    admin/             # login, dashboard, students, students/[id], questions
    api/               # tests, submit, admin/{login,logout,stats,students,questions,tests,export}
```

Attendance tracker files:
```
prisma/
  seed-attendance.ts     # staff, groups, timetable, class lists, term
src/
  lib/attendance/        # auth, dates, periods, timetable, register, moves,
                         # dashboard, reports, sheet (Excel), telegram
  components/attendance/ # shell, timetable grid, register table, move dialog,
                         # move queue, uploads, accounts, student directory
  app/attendance/        # login, teacher/*, head/*
  app/api/attendance/    # auth, attendance, moves, telegram, head/*
```

---

# 📋 Attendance Tracker (`/attendance`)

A second app in the same codebase: teachers take daily attendance and marks,
and the head teacher runs the lists, the timetable and the student moves.
It shares the database, the brand styling and the auth approach with the
entrance test, but has its own login, its own tables and its own routes.

## Who signs in where

| Role | Signs in at | Sees |
| ---- | ----------- | ---- |
| Teacher | `/attendance/login` | own timetable, own groups, own registers |
| Head teacher | `/attendance/login` | everything, plus uploads, moves and reports |

Login is a short **login id + password** (no email, no two-step verification).
The head teacher creates every account and can reset any password.

## Teacher side

- **Dashboard** — the lesson running now (or the next one) in a large orange
  card, today's lessons period by period, the weekly timetable, and the
  teacher's groups. Every one of them opens the register in one tap.
- **Group register** — students down the side (first name, then surname), and
  **two columns per lesson**: attendance and the mark for that day.
  - **Everyone present** fills the whole column in one tap; the teacher then
    only changes the students who are missing.
  - Tapping a cell cycles **P → A → L → blank** (present, absent, late).
    Marks are 0–100.
  - **Add notes** turns the grid into note mode: tap a cell to write up to 300
    characters about that student for that lesson. A cell holding a note
    carries an orange dot, and the note shows in its tooltip.
  - Changes save on their own; a badge shows *Saving… / Saved*.
  - Browsed **one month at a time** (a term can run four months), with a
    *Whole term* option. Any lesson that has already happened can be filled
    in, which is how registers first kept on paper get typed up.
  - Future lessons are visible but locked, and the absence count per student
    sits next to the name.
  - A **Move** button sits beside each student's name.
- **Move requests** — a `Move` button on each row asks the head teacher to
  move a student who is on the wrong list, with an optional reason and a
  choice of whether the student's existing records travel with them.
  Nothing changes until the head teacher approves.
- **My requests** — the teacher's own requests and where each one stands.

## Head teacher side

- **Dashboard** — the school's numbers, the classes running right now,
  the registers still missing from earlier today, and the five students
  missing the most classes.
- **Move requests** — approve or reject. Each card says how many records
  would travel with the student. Manual moves the head teacher starts are
  created the same way, so every move is approved and confirmed.
- **Groups / Students / Teachers** — groups with their teacher and size and
  a **New group** button, the searchable student list with a manual move,
  and the account manager
  (create an account, change a name, login id, password or role). A group's
  teacher can be changed from the Groups page on its own, without touching
  any other detail: the timetable from today follows the new teacher, while
  past lessons keep whoever taught them.
- **Timetable** — every uploaded version with an editable start date, which
  one is in force today, the teacher load for the week (7+ periods in a day
  shown in red), and the whole-school grid (days down the side, periods 1–8
  across the top). Moving a version's start date earlier is how lessons
  appear for dates earlier in the term.
- **Uploads** — the three Excel uploads, each with a downloadable template.
- **Reports** — students missing the most classes, highest first, filtered
  by date range and grade, with an Excel export.

## Three tracks, and what a move can do

Every student has a **General English** group (IELTS groups live here too —
a student takes one or the other, never both). On top of that they may have a
**SAT English** group, a **SAT Math** group, or both.

A move only ever happens inside one track. The register offers the other
groups of the same band and track, so a student in `5-E1` can go to `5-E2`,
`5-E3` or `5-E4`, and a student in `SAT - M1` can only go to `SAT - M2`.
Nobody can be moved from SAT English into General English.

A student with no group in a track is **added** to one rather than moved.
The student list says *Add to a group* instead of *Move* for a student with
no groups at all, and once a destination is chosen the request spells out
what approving will do — "Munisa has no SAT Math group. Approving puts them
in SAT - M1" — with no mention of carrying records, because there are none
to carry.

Bands follow the school's timetable: `5-E*` covers grades 5 and 6, `11-E*`
covers grades 10 and 11, and every group in a band meets at the same periods,
so a move never needs a time change.

## How a move keeps the old marks straight

1. A teacher requests the move (or the head teacher starts one).
2. The head teacher approves it, in the app or in Telegram.
3. The student's enrollment in the old group closes **today** and a new one
   opens in the new group, so the old group's past registers never change.
4. If the student has records, they stay attached to the lessons they were
   taken in and are stamped with the group they came from. The new group's
   register shows them **faded and in italics**, with a tooltip saying
   *"Taken in 5 LONDON"* — so everyone can tell those marks were given in the
   previous class. A student with no records simply appears on the new list.

Because all groups in a grade meet at the same periods (the school's
parallel-block timetable), a move never needs a time change.

## Excel uploads

Download each template from **Uploads** — column names are matched loosely,
so `First name`, `FIRST NAME` and `first_name` all work, and the Uzbek
headings `Ism`, `Familiya`, `Sinf` and `Guruh` are understood too. `.xlsx`,
`.xls` and `.csv` are accepted, up to 5 MB.

The headings do not have to be on the first row. Every sheet in the workbook
is checked, and in each one the first 20 rows, so a cover sheet, a title
line, blank rows and headings repeated part-way down a long list all work.
Every upload reports back which sheet and which heading row it used, with
the headings it found, plus what was added, what was updated and which rows
were rejected and why.

A long upload shows its progress as it runs — the stage it is on and how
many rows it has done — because the page streams the work back line by line
instead of waiting in silence. The student list is written in bulk, so a
250-student file takes a handful of database queries rather than one per
row.

| Upload | Columns |
| ------ | ------- |
| Groups and teachers | Group · Teacher · Room |
| Students | First Name · Last Name · UID · Grade · Class Name · Group \| Q1 · SAT Eng · SAT Math |
| Timetable | Group · Day · Period · Teacher · Room |

Upload in this order: **groups** → **students** → **timetable**.

**Groups and teachers.** The sheet the school already keeps puts two
Group/Teacher blocks side by side on each row, and that is read as well as a
single pair. Teachers are matched on their login id, their full name, or any
one part of it, so a column of first names (`Nika`, `Rayxona`) works. A
teacher with no account gets one, with a starting password the upload report
prints — switch that off with the checkbox if you would rather create
accounts by hand.

A group's name says what it is, so there is no Subject column:

| Name | Means |
| ---- | ----- |
| `5-E1` | General English, grades 5–6 |
| `7-E2` | General English, grade 7 |
| `11-E3` | General English, grades 10–11 |
| `SAT - E1` | SAT English |
| `SAT - M1` | SAT Math |

**Students.** One row per student, with up to three groups: `Group | Q1` is
their General English group, `SAT Eng` and `SAT Math` are optional and
independent — a student can take one, both or neither.

Nobody is created twice. Rows are matched on UID where there is one and on
name + grade otherwise, both against the students already on file and
against the other rows of the same upload. Two rows for one student — a
second row carrying their SAT groups, or the same child typed twice — become
one student with the groups from every row, and the report names both rows.
Where two different children really do share a name and a grade, the upload
says so and asks for UIDs to tell them apart.

A student listed in a different group of the same track leaves the old group
from today. A group named in the sheet that is not on the group list is
created from its name, with a warning.

**Timetable.** Choose what the file holds:

- *Some groups, to add* — the lessons join the timetable in force now, and
  every group not in the file keeps its own. This is how a few groups get
  their times filled in.
- *The whole timetable* — saved as a new version from a date you pick. Any
  group left out has no lessons from that date, so the file must hold them
  all.

Either way the upload warns about teacher clashes, room clashes and
duplicate rows instead of silently accepting them — joint lessons are fine,
so these are warnings, not errors. Uploading the same rows twice adds
nothing the second time.

### A new timetable never rewrites the past

Each timetable upload is saved as a **version with a start date**. The
register for any date uses the version in force on that date, so from the
start date the attendance dates follow the new timetable while every earlier
day keeps the old one, exactly as it was recorded.

## Telegram approvals (optional)

Set `TELEGRAM_BOT_TOKEN`, `TELEGRAM_HEAD_CHAT_ID` and
`TELEGRAM_WEBHOOK_SECRET`, then register the webhook once:

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-host>/api/attendance/telegram/<SECRET>"
```

Every move request then arrives in the bot with **Approve** / **Reject**
buttons, and the decision applies straight away. Only the configured chat can
decide. Without these variables the app behaves the same, minus the
notifications.

## The bell schedule

8 periods a day, Monday to Friday, 09:00–16:05:

| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| - | - | - | - | - | - | - | - |
| 09:00 | 09:50 | 10:50 | 11:45 | 12:40 | 13:35 | 14:30 | 15:25 |

Lunch is not a timetabled period: grades 5–9 take period 5, grades 10–11 take
period 6. Times live in `src/lib/attendance/periods.ts`; "now" is read in
`SCHOOL_TIMEZONE` (Asia/Tashkent by default) so the current lesson is right
even when the server runs abroad.

## Merging duplicate students

If the same student ends up on file twice — an early upload, a name typed
two ways — merge them:

```bash
npm run db:fix:students            # shows what it would do
npm run db:fix:students -- --apply # does it
```

Two records are the same student when they share a UID, or a first name, a
surname and a grade. Everything the copies hold moves onto the one that is
kept: attendance, marks, notes, group places and move requests. Where both
copies have a record for the same lesson, the one with a mark wins, then the
one changed most recently. The kept record takes the spelling and the UID of
the copy that was entered first.

## Set it up

```bash
npm install
cp .env.example .env         # fill in DATABASE_URL and AUTH_SECRET
npm run db:push              # creates the attendance tables too
npm run db:seed:attendance   # staff, groups, timetable, class lists, term
npm run dev                  # http://localhost:3000/attendance
```

The seed prints the login ids and passwords it created. It sets up the head
teacher, the nine teachers, the 22 groups, the weekly timetable blocks and
the 3 September to 26 December tracking period.

Students are not seeded — upload the real list. Set
`ATTENDANCE_SEED_SAMPLE_STUDENTS=true` for a handful of made-up ones to click
around with.

The seed is safe to run again: it tops up any group that has no lessons on
the timetable yet and leaves everything else alone.

The weekly blocks it sets up:

| Groups | Meets |
| ------ | ----- |
| 5-E1 … 5-E4 | Mon 1–2, Wed 6–7, Thu 3–4 |
| 7-E1 … 7-E3 | Tue 3–4, Wed 3–4, Fri 3–4 |
| 8-E1 … 8-E3 | Tue 1–2, Thu 1–2, Fri 7–8 |
| 9-E1 … 9-E4 | Mon 3–4, Wed 1–2, Thu 7–8 |
| 11-E1 … 11-E4 | Mon 5, Mon 7, Tue 7–8, Fri 1–2 |
| SAT - E1 | Tue 1–2, Thu 3–4 |
| SAT - E2 | Tue 3–4, Thu 1–2 |
| SAT - M1 and SAT - M2 | Wed 1–2, Fri 3–4 |

No teacher is double-booked, and no student can be: every combination of a
General English group with a SAT English and a SAT Math group is free of
clashes.

## Attendance tables

- **Staff** — teachers and head teachers (login id, password hash, role).
- **Term** — the period attendance is tracked for (3 September to 26 December).
- **Group** — a teaching group, its band, track, room and teacher.
- **Pupil** — a student: name, grade, homeroom class and UID.
- **Enrollment** — a pupil's membership of a group, with start and end dates.
- **TimetableVersion** / **TimetableSlot** — each upload and its weekly lessons.
- **Lesson** — a dated instance of a slot, created when attendance is first saved.
- **AttendanceRecord** — one pupil's attendance, mark and note for one lesson,
  plus the group it was taken in.
- **MoveRequest** — who asked, for whom, to where, and who decided.
