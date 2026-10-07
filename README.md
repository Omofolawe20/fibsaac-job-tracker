# FIbsaac’s Job Tracker

A full-stack job search app for tracking applications, interviews, and offers. People can create an account and sign in; each account can only see and change its own applications.

## Features

- Create an account, sign in, and sign out
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

You need Node.js and npm installed. Open the project folder in VS Code and use two integrated terminal tabs. The terminal profile can be **zsh**; `npm` is a command you run inside it.

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

Open the **Local** address Vite prints. Create an account with an email and a password of at least 12 characters. Sign in again after closing or refreshing the page; your session and applications are stored in SQLite.

The database is created automatically at `server/data/applications.sqlite` and is ignored by Git. If this database already has applications from before account support was added, the first account created on it will own those existing applications.

## Account and privacy details

- Passwords are hashed with a unique salt using Node.js `scrypt`; the original password is not stored.
- The browser receives a random, HTTP-only session cookie. The server stores only its hash and expires sessions after seven days.
- Application list, view, edit, and delete queries are scoped to the signed-in user.
- Sign-up and sign-in are limited to eight attempts per 15 minutes per IP address in this single server process.
- The app does not yet have email verification or password recovery. Use a password you do not use elsewhere, and do not use sensitive job-search data until you have decided how you will host and maintain the service.

## Publishing

You can publish this as a portfolio demo. A private GitHub repository controls who can view the **source code**; it does not automatically make a deployed website private. For real accounts and private data, deploy the React site and API over HTTPS, set `FRONTEND_ORIGIN` to the exact website address and `VITE_API_URL` to the API’s `/api` address, set `HOST=0.0.0.0` for a hosted API, use persistent protected database storage, and add email verification and account recovery. Use website and API addresses on the same site (for example, `app.example.com` and `api.example.com`) so the sign-in cookie works across them. The local SQLite setup is for development and is not by itself a complete hosting setup.

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check that the API is running |
| `GET` | `/api/auth/session` | Check the current sign-in session |
| `POST` | `/api/auth/signup` | Create an account and sign in |
| `POST` | `/api/auth/login` | Sign in |
| `POST` | `/api/auth/logout` | End the current session |
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
