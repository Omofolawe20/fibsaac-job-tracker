const cors = require('cors')
const Database = require('better-sqlite3')
const express = require('express')
const fs = require('node:fs')
const path = require('node:path')

const app = express()
const port = Number(process.env.PORT) || 3001
const allowedStatuses = new Set(['Applied', 'Interview', 'Saved', 'Offer', 'Rejected'])
const dataDirectory = path.join(__dirname, 'data')

fs.mkdirSync(dataDirectory, { recursive: true })

const database = new Database(path.join(dataDirectory, 'applications.sqlite'))
database.pragma('journal_mode = WAL')
database.exec(`
  CREATE TABLE IF NOT EXISTS applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company TEXT NOT NULL,
    role TEXT NOT NULL,
    location TEXT NOT NULL DEFAULT '',
    date_applied TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Applied', 'Interview', 'Saved', 'Offer', 'Rejected')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`)

const selectAll = database.prepare(
  'SELECT id, company, role, location, date_applied, status, created_at FROM applications ORDER BY date_applied DESC, id DESC',
)
const selectOne = database.prepare(
  'SELECT id, company, role, location, date_applied, status, created_at FROM applications WHERE id = ?',
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

app.use(cors({ origin: /^http:\/\/(localhost|127\.0\.0\.1):\d+$/ }))
app.use(express.json({ limit: '20kb' }))

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', message: 'FIbsaac Job Tracker API is running.' })
})

app.get('/api/applications', (_request, response) => {
  response.json(selectAll.all().map(toApplication))
})

app.get('/api/applications/:id', (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Application ID must be a positive whole number.' })
  }

  const application = selectOne.get(id)
  if (!application) return response.status(404).json({ error: 'Application not found.' })
  return response.json(toApplication(application))
})

app.post('/api/applications', (request, response) => {
  const { values, errors } = validateApplication(request.body || {})
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ error: 'Please correct the application details.', details: errors })
  }

  const result = database.prepare(
    'INSERT INTO applications (company, role, location, date_applied, status) VALUES (?, ?, ?, ?, ?)',
  ).run(values.company, values.role, values.location, values.date, values.status)

  return response.status(201).json(toApplication(selectOne.get(result.lastInsertRowid)))
})

app.patch('/api/applications/:id', (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Application ID must be a positive whole number.' })
  }
  if (!selectOne.get(id)) return response.status(404).json({ error: 'Application not found.' })

  const { values, errors } = validateApplication(request.body || {}, { partial: true })
  if (Object.keys(errors).length > 0) {
    return response.status(400).json({ error: 'Please correct the application details.', details: errors })
  }

  const columnNames = { company: 'company', role: 'role', location: 'location', date: 'date_applied', status: 'status' }
  const keys = Object.keys(values)
  const assignments = keys.map((key) => `${columnNames[key]} = ?`).join(', ')
  database.prepare(`UPDATE applications SET ${assignments} WHERE id = ?`).run(...keys.map((key) => values[key]), id)

  return response.json(toApplication(selectOne.get(id)))
})

app.delete('/api/applications/:id', (request, response) => {
  const id = Number(request.params.id)
  if (!Number.isInteger(id) || id < 1) {
    return response.status(400).json({ error: 'Application ID must be a positive whole number.' })
  }

  const result = database.prepare('DELETE FROM applications WHERE id = ?').run(id)
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

app.listen(port, '127.0.0.1', () => {
  console.log(`FIbsaac Job Tracker API listening at http://localhost:${port}`)
})
