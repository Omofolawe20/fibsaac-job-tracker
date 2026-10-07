# FIbsaac’s Job Tracker

A full-stack job search app for tracking applications, interviews, and offers. Members create accounts and manage their own applications. The app owner has a read-only dashboard of all submitted accounts and applications for testing and moderation.

## Features

- Create an account, sign in, and sign out
- View all member accounts and submitted applications in the owner dashboard
- Store passwords as salted hashes and keep sign-in sessions in SQLite
- Keep each user’s job applications private to that account
- Add, edit, search, filter, and delete applications
- Change an application’s status and see summary counts
- Validate form data and show loading and error messages
- Use the responsive wine and burgundy dashboard on desktop or mobile

## Built with

- React 19, Vite, JavaScript, and ESLint
- Node.js and Express 5
- SQLite with better-sqlite3
- Node.js built-in `crypto` for password hashing and random session tokens

## Run on your computer

You need Node.js 24 and npm installed. Open the project folder in VS Code and use two integrated terminal tabs. The terminal profile can be **zsh**; `npm` is a command you run inside it.

### Terminal 1: API server

```bash
cd ~/Documents/Codex/fibsaac-job-tracker/server
npm install
npm start
```

Leave this terminal open. The API runs at `http://localhost:3001`. To check it, open `http://localhost:3001/api/health`; the page should show `"status":"ok"`.

### Terminal 2: React website

```bash
cd ~/Documents/Codex/fibsaac-job-tracker
npm install
npm run dev -- --port 5175
```

Open the **Local** address Vite prints. Create your owner account before sharing the app with testers:

1. In a third terminal, from the project folder, create a one-time owner setup code:

   ```bash
   openssl rand -hex 32
   ```

2. Copy `server/.env.example` to `server/.env`. Replace the placeholder for `ADMIN_SETUP_TOKEN` with the generated code. Keep this file private; it is ignored by Git.
3. Restart the API terminal. On the create-account screen, select **I’m setting up the app owner account**, then enter the same code. Use an email you control and a password of at least 12 characters.
4. Use the **Admin dashboard** link to view accounts and job applications submitted by testers.
5. Share the site URL with testers. They create regular accounts and do not enter the owner code.

The owner setup code is accepted only while the database has no administrator account. Keep tester data private and tell testers that the app owner can review their submitted job details; the sign-up page also states this.

The database is created automatically at `server/data/applications.sqlite` and is ignored by Git. If it contains applications from before account support was added, they remain unassigned until the owner account is set up; the owner account then adopts them. A regular tester account cannot claim those records.

## Account and privacy details

- Passwords are hashed with a unique salt using Node.js `scrypt`; the original password is not stored.
- The browser receives a random, HTTP-only session cookie. The server stores only its hash and expires sessions after seven days.
- Application list, view, edit, and delete queries are scoped to the signed-in user.
- Only the owner account can open the read-only owner dashboard. It can see member email addresses and application details; members are told this before sign-up.
- Sign-up and sign-in are limited to eight attempts per 15 minutes per IP address in this single server process.
- The app does not yet have email verification or password recovery. Use a password you do not use elsewhere, and do not use sensitive job-search data until you have decided how you will host and maintain the service.

## Publishing for tester feedback

The repository includes a Render Blueprint in `render.yaml` that builds and serves the React site and API from one web service, uses HTTPS, and stores SQLite data under `/var/data`. The persistent disk is required to keep tester accounts and applications through restarts and deploys. Render requires a paid web-service plan for persistent disks; free web services have an ephemeral filesystem. The current blueprint uses a Starter service and 1 GB disk; check Render’s current pricing before creating it. Do not create the service until you are ready for that hosting cost.

During setup, set `FRONTEND_ORIGIN` to the exact HTTPS address Render assigns to the service and set `ADMIN_SETUP_TOKEN` to a long random value. Create the owner account once using that code, then share the HTTPS site URL with testers. The code stays in the hosting provider’s environment settings and is never committed to this repository.

This is suitable for a small, supervised feedback round, not a mature public service. It does not yet include email verification, password recovery, admin audit logs, or a support/privacy policy. The in-memory sign-in attempt limiter also assumes a single running service instance. Tell testers what data you collect and how you will use it before sharing the link.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check that the API is running |
| `GET` | `/api/auth/session` | Check the current sign-in session |
| `POST` | `/api/auth/signup` | Create an account and sign in |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | End the current session |
| `GET` | `/api/admin/overview` | Read the owner-only account and application report |
| `GET` | `/api/applications` | List the signed-in user’s applications |
| `GET` | `/api/applications/:id` | Get one of that user’s applications |
| `POST` | `/api/applications` | Create an application for that user |
| `PATCH` | `/api/applications/:id` | Update that user’s application |
| `DELETE` | `/api/applications/:id` | Delete that user’s application |

## Code checks

From the project root:

```bash
npm run lint
npm run build
node --check server/index.js
```
