# AGENTS.md

## Cursor Cloud specific instructions

Helix Admin is a **Next.js 16 (App Router, Turbopack)** dashboard (`package.json` name `helix`). It is primarily a **UI + proxy layer over an external backend**: most feature pages (Roles, Staff, Patients, Escalation, Teams, Audit, Analytics, etc.) fetch through `/api/proxy/*`, which forwards to the backend at `NEXT_PUBLIC_API_BASE_URL`.

### Commands (root project)
- Dev server: `npm run dev` (http://localhost:3000). Use this for development.
- Lint: `npm run lint`. Typecheck: `npx tsc --noEmit`. Build: `npm run build`.
- These scripts live in `package.json`; there is no test runner configured.

### Required local env (`.env.local`, gitignored)
Create `/workspace/.env.local` with at least:
```
NEXT_PUBLIC_API_BASE_URL=https://api-prod.helixhealth.app
DATABASE_URL=postgresql://neon:npg@ep-local-dev-000000.us-east-2.aws.neon.tech/helix
JWT_SECRET=dev-local-secret-change-me
```
- `NEXT_PUBLIC_API_BASE_URL` is the real backend. Without it, `/api/proxy/*` falls back to `http://localhost:3000` (the app points at itself) and every proxy-backed page breaks.
- There is **no Neon database** for the proxy flows. `DATABASE_URL` is only used by the legacy direct routes (`/api/auth/login`, `/api/departments`, `/api/roles`, `/api/me`, `/api/hospital`) via `src/lib/db.ts`, which calls `neon(process.env.DATABASE_URL!)` **at import**. Because `next build` collects every route, the build **fails with "No database connection string was provided to neon()"** if `DATABASE_URL` is unset — so keep a placeholder Neon-style URL even though it is never connected to. `npm run dev` does not need it unless you actually hit those direct routes.

### Auth / how to reach facility pages
- Real authentication goes through the backend (not the local `neon` DB).
- Internal admin: `/internal/login` → email + password → a **6-digit OTP is emailed** → `/internal/dashboard`. The internal session cookie (`helix-internal-session`) is httpOnly and set by the proxy on the same-origin `verify-otp` call, so the login must complete in the browser.
- From the internal dashboard, click **"Access"** on a facility to enter **support mode ("Act as")** and view that facility's admin pages (Home, Departments, Roles, Escalation Config, Staff, Patients, …).
- Facility admin login is at `/login` (also password + email OTP).

### Non-obvious notes
- Role display names are **facility-prefixed**, e.g. `WGH - Doctor On Duty - A&E` where `WGH` = Worawora Government Hospital. Escalation ladder targets reference other roles by these prefixed names.
- Escalation policies for the Roles page come from `/api/proxy/escalation-policies` (facility-scoped list) and are hydrated/backfilled per role via `/api/proxy/escalation-policies/by-role/{roleId}`. The list can omit a policy, key it under a different `role_id`, or return stale/empty `steps`; join/unwrap/backfill logic lives in `src/lib/escalation-policy-join.ts`.
- `next build` (Next 16) runs TypeScript but **not** ESLint, so a lint error does not fail the build. There is a pre-existing `prefer-const` lint error (`deptMap` in `src/components/RolesBuilderAssignment.tsx`) unrelated to feature work.
