# GrowSharks Project Management

Internal project & task management tool for GrowSharks — Kanban boards per project, employee/task assignment, time tracking, and email notifications for every key event (task assigned, task completed, new comment, account created, password changed).

## Tech stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS + shadcn/ui, @dnd-kit for the Kanban drag-and-drop
- MongoDB + Mongoose
- NextAuth.js (Credentials provider, JWT sessions) — roles: `admin`, `employee`
- nodemailer for transactional email

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values:

   ```bash
   cp .env.example .env.local
   ```

   - `MONGODB_URI` — a local MongoDB instance or an [Atlas](https://www.mongodb.com/atlas) connection string. **If left unset in development**, the app automatically spins up an in-memory MongoDB so you can run it with zero setup — but data won't persist across restarts and won't be shared with one-off scripts like the seed script. For anything beyond a quick look, set a real `MONGODB_URI`. You can start a persistent local one for dev with `npm run dev:mongo` (keep it running in its own terminal) and point `MONGODB_URI` at `mongodb://127.0.0.1:27117/growsharks-pm`.
   - `AUTH_SECRET` — random string, e.g. `openssl rand -base64 32`.
   - `SMTP_*` — leave blank during development; emails are logged to the server console instead of sent. Fill these in with a real SMTP provider (Gmail app password, SendGrid, Mailtrap, Zoho, etc.) before going live.
   - `SEED_ADMIN_*` — used by the seed script below.

3. Create the first admin account:

   ```bash
   npm run seed:admin
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

   Sign in at [http://localhost:3000](http://localhost:3000) with the seeded admin credentials.

## Roles

- **Admin** — creates/manages projects and board columns, adds employee accounts (sends a welcome email with a temporary password), assigns/reassigns tasks to anyone, deletes tasks/projects, sees all projects and the time-tracking report.
- **Employee** — sees only the projects they're a member of, can create tasks in those projects, can move (drag between columns) only tasks they're assigned to or created, can comment and log time.

## Email notifications

Every trigger below writes an in-app notification (bell icon) and sends an email via `src/lib/mailer.ts`:

1. Employee account created → welcome email with temporary password
2. Task assigned/reassigned → email to the new assignee
3. Task moved into a "done" column → email to the task's creator
4. New comment → email to the other participants (assignee + creator)
5. Password changed → confirmation email

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build/start
- `npm run lint` — ESLint
- `npm run seed:admin` — create the first admin account from `SEED_ADMIN_*` env vars
- `npm run dev:mongo` — run a persistent local MongoDB (via mongodb-memory-server) for development
