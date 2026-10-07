const cors = require('cors')
const { promisify } = require('node:util')
const crypto = require('node:crypto')
const Database = require('better-sqlite3')
const express = require('express')
const fs = require('node:fs')
const path = require('node:path')

const app = express()
const port = Number(process.env.PORT) || 3001
const allowedStatuses = new Set(['Applied', 'Interview', 'Saved', 'Offer', 'Rejected'])
const sessionCookie = 'fibsaac_session'
const sessionDurationMs = 7 * 24 * 60 * 60 * 1000
const scrypt = promisify(crypto.scrypt)
const dataDirectory = path.join(__dirname, 'data')

fs.mkdirSync(dataDirectory, { recursive: true })

const database = new Database(path.join(dataDirectory, 'applications.sqlite'))
database.pragma('journal_mode = WAL')
database.pragma('foreign_keys = ON')
database.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    date_applied TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Applied', 'Interview', 'Saved', 'Offer', 'Rejected')),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`)

const applicationColumns = database.prepare('PRAGMA table_info(applications)').all()
if (!applicationColumns.some((column) => column.name === 'user_id')) {
  database.exec('ALTER TABLE applications ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE')
}

const selectAllForUser = database.prepare(
  'SELECT id, company, role, location, date_applied, status, created_at FROM applications WHERE user_id = ? ORDER BY date_applied DESC, id DESC',
)
const selectOneForUser = database.prepare(
  'SELECT id, company, role, location, date_applied, status, created_at FROM applications WHERE id = ? AND user_id = ?',
)

function toApplication(row) {
  return {
    id: row.id,
    company: row.company,
    role: row.role,
    location: row.location,
    date: row.date_applied,
    status: row.status,
    createdAt: row.created_at,
  }
}

function toUser(row) {
  return { id: row.id, email: row.email }
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
}

function validateApplication(body, { partial = false } = {}) {
  const errors = {}
  const values = {}
  const fields = ['company', 'role', 'location', 'date', 'status']

  for (const key of Object.keys(body)) {
    if (!fields.includes(key)) errors[key] = 'This field is not supported.'
  }

  if (!partial || Object.hasOwn(body, 'company')) {
    values.company = typeof body.company === 'string' ? body.company.trim() : ''
    if (!values.company) errors.company = 'Company is required.'
    else if (values.company.length > 100) errors.company = 'Company must be 100 characters or fewer.'
  }

  if (!partial || Object.hasOwn(body, 'role')) {
    values.role = typeof body.role === 'string' ? body.role.trim() : ''
    if (!values.role) errors.role = 'Job title is required.'
    else if (values.role.length > 150) errors.role = 'Job title must be 150 characters or fewer.'
  }

  if (!partial || Object.hasOwn(body, 'location')) {
    values.location = typeof body.location === 'string' ? body.location.trim() : ''
    if (values.location.length > 100) errors.location = 'Location must be 100 characters or fewer.'
  }

  if (!partial || Object.hasOwn(body, 'date')) {
    values.date = body.date
    if (!isValidDate(values.date)) errors.date = 'Enter a valid date in YYYY-MM-DD format.'
  }

  if (!partial || Object.hasOwn(body, 'status')) {
    values.status = body.status
    if (!allowedStatuses.has(values.status)) errors.status = 'Choose a valid application status.'
  }

  if (partial && Object.keys(body).length === 0) errors.application = 'Provide at least one field to update.'
  return { values, errors }
}

function getAllowedOrigin(origin) {
  const configured = process.env.FRONTEND_ORIGIN
  if (configured) return configured.split(',').map((value) => value.trim()).includes(origin)
  return /^https?:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)
}

app.use(cors({
  origin(origin, callback) {
    if (!origin || getAllowedOrigin(origin)) return callback(null, true)
    return callback(null, false)
  },
  credentials: true,
}))
app.use(express.json({ limit: '20kb' }))

app.use('/api', (request, response, next) => {
  if (['POST', 'PATCH', 'DELETE'].includes(request.method) && !getAllowedOrigin(request.get('origin') || '')) {
    return response.status(403).json({ error: 'This request origin is not allowed.' })
  }
  return next()
})

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return ['', '']
    return [part.slice(0, separator).trim(), part.slice(separator + 1).trim()]
  }).filter(([key]) => key))
}

function setSessionCookie(response, token) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${sessionCookie}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${Math.floor(sessionDurationMs / 1000)}${secure}`)
}

function clearSessionCookie(response) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  response.setHeader('Set-Cookie', `${sessionCookie}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`)
}

function createSession(userId, response) {
  const token = crypto.randomBytes(32).toString('base64url')
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, Date.now() + sessionDurationMs)
  setSessionCookie(response, token)
}

function getUserFromSession(request) {
  const token = parseCookies(request.get('cookie'))[sessionCookie]
  if (!token) return null
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  const session = database.prepare(`
    SELECT users.id, users.email, sessions.expires_at
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ?
  `).get(tokenHash)
  if (!session) return null
  if (session.expires_at <= Date.now()) {
    database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    return null
  }
  return toUser(session)
}

function requireAuth(request, response, next) {
  const user = getUserFromSession(request)
  if (!user) return response.status(401).json({ error: 'Please sign in to continue.' })
  request.user = user
  return next()
}

const dummySalt = 'FIbsaacJobTrackerDummySalt'
const dummyHash = crypto.scryptSync('not-a-real-password', dummySalt, 64)
const authAttempts = new Map()
const authWindowMs = 15 * 60 * 1000

function limitAuthAttempts(request, response, next) {
  const now = Date.now()
  const key = `${request.ip}:${request.path}`
  const recentAttempts = (authAttempts.get(key) || []).filter((time) => now - time < authWindowMs)
  if (recentAttempts.length >= 8) {
    response.setHeader('Retry-After', '900')
    return response.status(429).json({ error: 'Too many attempts. Wait a little and try again.' })
  }
  recentAttempts.push(now)
  authAttempts.set(key, recentAttempts)
  for (const [attemptKey, times] of authAttempts) {
    if (times.every((time) => now - time >= authWindowMs)) authAttempts.delete(attemptKey)
  }
  return next()
}

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', message: 'FIbsaac Job Tracker API is running.' })
})

app.get('/api/auth/session', (request, response) => {
  const user = getUserFromSession(request)
  if (!user) return response.status(401).json({ error: 'Please sign in.' })
  return response.json({ user })
})

app.post('/api/auth/signup', limitAuthAttempts, async (request, response, next) => {
  try {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const password = typeof request.body?.password === 'string' ? request.body.password : ''
    const errors = {}
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) errors.email = 'Enter a valid email address.'
    if (password.length < 12 || password.length > 128) errors.password = 'Use a password between 12 and 128 characters.'
    if (Object.keys(errors).length) return response.status(400).json({ error: 'Please check your details.', details: errors })

    const salt = crypto.randomBytes(16).toString('base64url')
    const hash = await scrypt(password, salt, 64)
    let userId
    try {
      const transaction = database.transaction(() => {
        const result = database.prepare('INSERT INTO users (email, password_hash, password_salt) VALUES (?, ?, ?)')
          .run(email, Buffer.from(hash).toString('base64url'), salt)
        userId = Number(result.lastInsertRowid)
        database.prepare('UPDATE applications SET user_id = ? WHERE user_id IS NULL').run(userId)
      })
      transaction()
    } catch (error) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return response.status(409).json({ error: 'An account with that email already exists. Sign in instead.' })
      throw error
    }
    createSession(userId, response)
    return response.status(201).json({ user: toUser({ id: userId, email }) })
  } catch (error) {
    return next(error)
  }
})

app.post('/api/auth/login', limitAuthAttempts, async (request, response, next) => {
  try {
    const email = typeof request.body?.email === 'string' ? request.body.email.trim().toLowerCase() : ''
    const password = typeof request.body?.password === 'string' ? request.body.password : ''
    const account = database.prepare('SELECT id, email, password_hash, password_salt FROM users WHERE email = ?').get(email)
    const suppliedHash = Buffer.from(await scrypt(password, account?.password_salt || dummySalt, 64))
    const storedHash = account ? Buffer.from(account.password_hash, 'base64url') : dummyHash
    const valid = suppliedHash.length === storedHash.length && crypto.timingSafeEqual(suppliedHash, storedHash)
    if (!account || !valid) return response.status(401).json({ error: 'Email or password is incorrect.' })
    createSession(account.id, response)
    return response.json({ user: toUser(account) })
  } catch (error) {
    return next(error)
  }
})

app.post('/api/auth/logout', requireAuth, (request, response) => {
  const token = parseCookies(request.get('cookie'))[sessionCookie]
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
  database.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
  clearSessionCookie(response)
  return response.status(204).end()
})

app.get('/api/applications', requireAuth, (request, response) => {
  response.json(selectAllForUser.all(request.user.id).map(toApplication))
})

app.get('/api/applications/:id', requireAuth, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Application ID must be a positive whole number.' })
  }

  const application = selectOneForUser.get(id, request.user.id)
  if (!application) return response.status(404).json({ error: 'Application not found.' })
  return response.json(toApplication(application))
})

app.post('/api/applications', requireAuth, (request, response) => {
  const { values, errors } = validateApplication(request.body || {})
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ error: 'Please correct the application details.', details: errors })
  }

  const result = database.prepare(
    'INSERT INTO applications (company, role, location, date_applied, status, user_id) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(values.company, values.role, values.location, values.date, values.status, request.user.id)

  return response.status(201).json(toApplication(selectOneForUser.get(result.lastInsertRowid, request.user.id)))
})

app.patch('/api/applications/:id', requireAuth, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Application ID must be a positive whole number.' })
  }
  if (!selectOneForUser.get(id, request.user.id)) return response.status(404).json({ error: 'Application not found.' })

  const { values, errors } = validateApplication(request.body || {}, { partial: true })
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ error: 'Please correct the application details.', details: errors })
  }

  const columnNames = { company: 'company', role: 'role', location: 'location', date: 'date_applied', status: 'status' }
  const keys = Object.keys(values)
  const assignments = keys.map((key) => `${columnNames[key]} = ?`).join(', ')
  database.prepare(`UPDATE applications SET ${assignments} WHERE id = ? AND user_id = ?`)
    .run(...keys.map((key) => values[key]), id, request.user.id)

  return response.json(toApplication(selectOneForUser.get(id, request.user.id)))
})

app.delete('/api/applications/:id', requireAuth, (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Application ID must be a positive whole number.' })
  }

  const result = database.prepare('DELETE FROM applications WHERE id = ? AND user_id = ?').run(id, request.user.id)
  if (result.changes === 0) return response.status(404).json({ error: 'Application not found.' })
  return response.status(204).end()
})

app.use((_request, response) => {
  response.status(404).json({ error: 'API route not found.' })
})

app.use((error, _request, response, _next) => {
  console.error(error)
  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({ error: 'Request body must contain valid JSON.' })
  }
  if (error.type === 'entity.too.large') {
    return response.status(413).json({ error: 'Request body is too large.' })
  }
  response.status(500).json({ error: 'Something went wrong on the server.' })
})

app.listen(port, process.env.HOST || '127.0.0.1', () => {
  console.log(`FIbsaac Job Tracker API listening at http://localhost:${port}`)
})
