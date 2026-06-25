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
- **Tests & Questions** manager: edit title, timer and active state per grade; add / edit / delete questions (4 options, one correct).
- **Export to CSV** (Excel-compatible) — respects the active filters.
- Delete duplicate / fake submissions; toggle "allow retake".

---

## 🧱 Tech Stack

| Layer      | Technology                          |
| ---------- | ----------------------------------- |
| Framework  | Next.js 15 (App Router) + TypeScript |
| Styling    | Tailwind CSS (navy / white / gold)  |
| Database   | PostgreSQL (local or Supabase)      |
| ORM        | Prisma                              |
| Auth       | JWT (jose) in httpOnly cookie + bcrypt |
| Validation | Zod (shared client + server)        |

---

## 🗂️ Database Schema

7 tables (see `prisma/schema.prisma`):

- **AdminUser** — dashboard users (email, password hash, name, role).
- **Test** — one per grade; holds `timeLimitSec` and `isActive`.
- **Question** — belongs to a Test; ordered text.
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

## 🔒 Security Notes
- Correct answers (`isCorrect`) are **never** sent to the browser; scoring is done only on the server.
- Admin API routes verify the session on every request; pages are gated by `src/middleware.ts`.
- Passwords are hashed with bcrypt; sessions are short-lived signed JWTs in httpOnly cookies.
- All forms are validated on both the client and the server with Zod.

---

## 📁 Project Structure
```
prisma/
  schema.prisma        # database schema (7 tables)
  seed.ts              # admin user + per-grade tests/questions
src/
  middleware.ts        # protects /admin routes
  lib/                 # prisma, auth, validation, scoring/levels, csv, stats, filters
  components/          # Brand, Spinner, test/* (student flow), admin/* (dashboard UI)
  app/
    page.tsx           # landing
    test/              # student form + quiz (timer)
    thank-you/         # result page
    admin/             # login, dashboard, students, students/[id], questions
    api/               # tests, submit, admin/{login,logout,stats,students,questions,tests,export}
```
