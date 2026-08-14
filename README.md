# GrowSharks Project Management

Internal project & task management tool for GrowSharks — Kanban boards per project, employee/task assignment, time tracking, and email notifications for every key event (task assigned, task completed, new comment, account created, password changed).

## Tech stack

- Next.js 16 (App Router, TypeScript), Tailwind CSS + shadcn/ui, @dnd-kit for the Kanban drag-and-drop
- MongoDB + Mongoose
- Redis (ioredis) — optional read-through cache in front of the list/detail API routes
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
   - `REDIS_URL` — optional. Leave unset and the app runs exactly as before, just without caching. To enable it locally: `docker compose up -d redis`, then set `REDIS_URL=redis://127.0.0.1:6379`.

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

- **Admin** — creates/manages projects and board columns, adds employee accounts (sends a welcome email with a temporary password), assigns/reassigns tasks to anyone, deletes tasks/projects, sees all projects and the time-tracking report, reimburses any employee's expense.
- **Employee** — sees only the projects they're a member of, can create tasks in those projects, can move (drag between columns) only tasks they're assigned to or created, can comment and log time, can submit and self-reimburse their own expenses.

## Expenses & reimbursement

Anyone can submit an out-of-pocket expense at `/expenses` (employees: expenses only; admins may also submit their own reimbursable expenses from the same page — regular company income/expense entries stay on the admin-only `/finance` page and are never reimbursable). A submitted expense can be marked reimbursed by an admin, or by the employee themselves (e.g. they were already paid back in cash and are just recording it) — `src/lib/permissions.ts`'s `canReimburseFinanceEntry`. Every entry records `reimbursedBy`/`reimbursedAt`, and reimbursing someone else's expense sends them a notification + email.

## Audit trail

Every create/update/delete on tasks and projects — plus create/update/delete/reimburse on finance entries — is recorded to the `AuditLog` collection (`src/lib/audit.ts`) with who did it, when, and a field-level diff for updates. View it in the task detail drawer, a project's Settings page, or an expense's history icon. Writing an audit entry never blocks or fails the action it's describing — a logging failure is caught and logged, not thrown.

## Email notifications

Every trigger below writes an in-app notification (bell icon) and sends an email via `src/lib/mailer.ts`:

1. Employee account created → welcome email with temporary password
2. Task assigned/reassigned → email to the new assignee
3. Task moved into a "done" column → email to the task's creator
4. New comment → email to the other participants (assignee + creator)
5. Password changed → confirmation email
6. Expense reimbursed → email to the employee (skipped when they reimbursed themselves)

In-app notifications are pushed live over SSE (`/api/notifications/stream`, `src/lib/notifyBus.ts`) instead of the client polling — an in-process `EventEmitter` handles delivery on a single instance, and when `REDIS_URL` is set it goes through Redis pub/sub instead so it fans out correctly across multiple instances.

## Caching

Read-heavy list/detail endpoints (projects, tasks, finance entries, notifications, users) and the dashboard's aggregate queries (`src/lib/dashboardData.ts`) are wrapped in a Redis read-through cache (`src/lib/cache.ts`, `src/lib/cacheKeys.ts`):

- Every cached key is written with a TTL (15–60s depending on how often that data changes) — there are no permanent keys.
- Every route that mutates data explicitly deletes the relevant cache key(s)/prefix on write, so reads are never stale beyond the TTL window even between invalidations. The one exception is the dashboard cache (`dashboard:admin`, `dashboard:employee:<id>`) — its aggregates touch nearly every collection, so it relies on its TTL alone (30s/20s) rather than trying to invalidate it from every task/project/finance/user mutation in the app.
- If `REDIS_URL` is unset, or Redis is unreachable, `src/lib/redis.ts` returns `null` and every cache helper silently falls back to hitting MongoDB directly — a cache outage degrades performance, it never breaks a request.

**Eviction policy**: because nothing is ever cached without a TTL, `maxmemory-policy` can safely be `allkeys-lru` (evict least-recently-used keys once `maxmemory` is hit) — this is what `docker-compose.yml` sets for local dev (`256mb` / `allkeys-lru`). Configure the same on your production Redis instance (Upstash, Redis Cloud, ElastiCache, etc). `volatile-lru` also works today since every key has a TTL, but `allkeys-lru` is the safer default in case a future key is ever added without one.

## Scripts

- `npm run dev` — start the dev server
- `npm run build` / `npm run start` — production build/start
- `npm run lint` — ESLint
- `npm run seed:admin` — create the first admin account from `SEED_ADMIN_*` env vars
- `npm run dev:mongo` — run a persistent local MongoDB (via mongodb-memory-server) for development
- `docker compose up -d redis` — run a local Redis instance for the cache layer
