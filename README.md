# FIbsaac's Job Tracker

A full-stack job search dashboard for keeping applications, interviews, and offers organized. The React interface talks to an Express API, which stores each application in a local SQLite database.

## Features

- Add, view, edit, and delete job applications
- Update an application's status from the dashboard
- Search by company, role, or location and filter by status
- See application, in-progress, interview, and offer counts
- Validate required fields and show clear loading and error states
- Keep application records in SQLite between visits
- Use a responsive layout on desktop and mobile

## Technology

- React 19 and Vite
- JavaScript and ESLint
- Node.js and Express 5
- SQLite with better-sqlite3

## Run locally

You need Node.js and npm installed.

1. Install the frontend packages from the project root:

   ```bash
   npm install
   ```

2. In one terminal, start the API:

   ```bash
   cd server
   npm install
   npm run dev
   ```

   The API listens at `http://localhost:3001`.

3. In a second terminal, from the project root, start the frontend:

   ```bash
   npm run dev -- --port 5175
   ```

   Open the **Local** URL Vite prints. The API terminal must remain open while the app is in use.

The SQLite file is created automatically at `server/data/applications.sqlite` the first time the API starts. It is ignored by Git, so each fresh clone starts with an empty database.

To use a different API address, copy `.env.example` to `.env.local` and set `VITE_API_URL` to the API's `/api` address. For example:

```text
VITE_API_URL=http://localhost:3001/api
```

## API routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Check that the API is running |
| `GET` | `/api/applications` | List applications |
| `GET` | `/api/applications/:id` | Get one application |
| `POST` | `/api/applications` | Create an application |
| `PATCH` | `/api/applications/:id` | Update application details or status |
| `DELETE` | `/api/applications/:id` | Delete an application |

New applications require a company, job title, valid application date, and supported status. Location is optional.

## Project layout

```text
src/                 React interface
server/index.js      Express API and SQLite setup
server/data/         Local database created at runtime
```

## Code checks

From the project root:

```bash
npm run lint
npm run build
```
