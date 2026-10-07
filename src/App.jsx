import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001/api' : '/api')
const filters = ['All applications', 'Applied', 'Interview', 'Saved', 'Offer', 'Rejected']

async function getErrorMessage(response) {
  try {
    const data = await response.json()
    const details = data.details ? ` ${Object.values(data.details).join(' ')}` : ''
    return `${data.error || 'The request could not be completed.'}${details}`
  } catch {
    return 'The request could not be completed. Please try again.'
  }
}

function formatDate(date) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${date}T12:00:00`))
}

function todayAsLocalDate() {
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return `${today.getFullYear()}-${month}-${day}`
}

function AuthScreen({ onAuthenticated, message }) {
  const [mode, setMode] = useState('login')
  const [isOwnerSetup, setIsOwnerSetup] = useState(false)
  const [ownerSetupCode, setOwnerSetupCode] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(message || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      const response = await fetch(`${API_URL}/auth/${mode === 'signup' ? 'signup' : 'login'}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, ownerSetupCode: isOwnerSetup ? ownerSetupCode : '' }),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      const data = await response.json()
      onAuthenticated(data.user)
    } catch (requestError) {
      setError(requestError.message || 'Could not connect. Check that the API server is running.')
    } finally {
      setIsSubmitting(false)
    }
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    setIsOwnerSetup(false)
    setOwnerSetupCode('')
    setError('')
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <a className="auth-brand" href="#login" aria-label="FIbsaac Job Tracker">
          <span className="brand-mark">F</span><span className="auth-brand-name">FIbsaac</span>
        </a>
        <span className="auth-kicker">YOUR JOB SEARCH, IN ONE PLACE</span>
        <h1 id="auth-title">{mode === 'signup' ? 'Create your account' : 'Welcome back'}</h1>
        <p className="auth-intro">{mode === 'signup' ? 'Your applications stay separated by account. The app owner can review submitted records.' : 'Sign in to continue tracking your opportunities.'}</p>
        <form className="auth-form" onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required maxLength={254} /></label>
          <label>Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'signup' ? 'At least 12 characters' : 'Your password'} required minLength={mode === 'signup' ? 12 : 1} maxLength={128} /></label>
          {mode === 'signup' && <label className="owner-setup-toggle"><input type="checkbox" checked={isOwnerSetup} onChange={(event) => { setIsOwnerSetup(event.target.checked); setError('') }} /> I’m setting up the app owner account</label>}
          {mode === 'signup' && isOwnerSetup && <label>One-time owner setup code<input type="password" autoComplete="off" value={ownerSetupCode} onChange={(event) => setOwnerSetupCode(event.target.value)} placeholder="Enter the code configured on the server" required /></label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="primary-button auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
        </form>
        <p className="auth-switch">{mode === 'signup' ? 'Already have an account?' : 'New to FIbsaac/track?'} <button type="button" onClick={() => changeMode(mode === 'signup' ? 'login' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button></p>
        <p className="auth-private-note">Member job details are visible to the app owner.</p>
      </section>
    </main>
  )
}

function AdminDashboard() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isCurrent = true
    async function loadReport() {
      try {
        const response = await fetch(`${API_URL}/admin/overview`, { credentials: 'include' })
        if (!response.ok) throw new Error(await getErrorMessage(response))
        const data = await response.json()
        if (isCurrent) setReport(data)
      } catch (requestError) {
        if (isCurrent) setError(requestError.message || 'Could not load the admin report.')
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }
    loadReport()
    return () => { isCurrent = false }
  }, [])

  return (
    <div className="admin-page">
      <section className="admin-welcome">
        <div><div className="eyebrow"><span className="eyebrow-dot" /> OWNER WORKSPACE</div><h1>Community dashboard</h1><p>Accounts and job applications shared with you as the app owner.</p></div>
      </section>
      {error && <div className="api-error" role="alert">{error}</div>}
      <section className="stats-grid admin-stats" aria-label="Community totals">
        <article className="stat-card total-card"><div className="stat-top"><span>Accounts</span><span className="stat-icon total-icon">♙</span></div><div className="stat-value">{report?.users.length ?? '—'}</div><div className="stat-foot">Registered members</div></article>
        <article className="stat-card"><div className="stat-top"><span>Applications</span><span className="stat-icon interview-icon">▤</span></div><div className="stat-value">{report?.totalApplications ?? '—'}</div><div className="stat-foot">Shared by members</div></article>
      </section>
      {isLoading && <div className="admin-loading">Loading account and application details…</div>}
      {report && <>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Accounts</h2><p>People who have created an account.</p></div><span>{report.users.length} accounts</span></div>
          <div className="table-scroll"><table className="admin-table"><thead><tr><th>EMAIL</th><th>ROLE</th><th>APPLICATIONS</th><th>JOINED</th></tr></thead><tbody>
            {report.users.map((member) => <tr key={member.id}><td className="role-cell">{member.email}</td><td>{member.role === 'admin' ? <span className="admin-role">App owner</span> : <span className="member-role">Member</span>}</td><td>{member.applicationCount}</td><td className="date-cell">{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${member.createdAt.slice(0, 10)}T12:00:00`))}</td></tr>)}
            {report.users.length === 0 && <tr><td colSpan="4">No accounts yet.</td></tr>}
          </tbody></table></div>
        </section>
        <section className="admin-panel">
          <div className="admin-panel-heading"><div><h2>Applications from members</h2><p>Member-submitted records are visible to the app owner.</p></div><span>Latest {report.applications.length}</span></div>
          <div className="table-scroll"><table className="admin-table"><thead><tr><th>ACCOUNT</th><th>COMPANY</th><th>ROLE</th><th>DATE</th><th>STATUS</th></tr></thead><tbody>
            {report.applications.map((application) => <tr key={application.id}><td className="role-cell">{application.userEmail}</td><td className="role-cell">{application.company}</td><td>{application.role}</td><td className="date-cell">{formatDate(application.date)}</td><td><span className={`status-pill ${application.status.toLowerCase()}`}>{application.status}</span></td></tr>)}
            {report.applications.length === 0 && <tr><td colSpan="5">No applications have been submitted yet.</td></tr>}
          </tbody></table></div>
        </section>
        <p className="admin-privacy-note">This view includes member-submitted job details. Use it only for the testing and management purpose explained on sign-up.</p>
      </>}
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [authMessage, setAuthMessage] = useState('')
  const [applications, setApplications] = useState([])
  const [activeFilter, setActiveFilter] = useState('All applications')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formError, setFormError] = useState('')
  const [apiError, setApiError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [currentPage, setCurrentPage] = useState('overview')
  const [form, setForm] = useState({ company: '', role: '', location: '', date: todayAsLocalDate(), status: 'Applied' })
  const displayName = user?.email.split('@')[0] || ''
  const userInitial = displayName.slice(0, 1).toUpperCase()

  const visibleApplications = useMemo(() => applications.filter((application) => {
    const matchesFilter = activeFilter === 'All applications' || application.status === activeFilter
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${application.company} ${application.role} ${application.location}`.toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  }), [activeFilter, applications, search])

  useEffect(() => {
    let isCurrent = true

    async function loadSession() {
      try {
        const response = await fetch(`${API_URL}/auth/session`, { credentials: 'include' })
        if (response.ok) {
          const data = await response.json()
          if (isCurrent) setUser(data.user)
        } else if (response.status !== 401) {
          throw new Error(await getErrorMessage(response))
        }
      } catch {
        if (isCurrent) setAuthMessage('Could not connect to the server. Start the API, then try again.')
      } finally {
        if (isCurrent) setIsCheckingSession(false)
      }
    }

    loadSession()
    return () => { isCurrent = false }
  }, [])

  useEffect(() => {
    if (!user) return undefined
    let isCurrent = true
    async function loadApplications() {
      setIsLoading(true)
      try {
        const response = await fetch(`${API_URL}/applications`, { credentials: 'include' })
        if (response.status === 401) {
          setUser(null)
          setAuthMessage('Your session has ended. Sign in to continue.')
          return
        }
        if (!response.ok) throw new Error(await getErrorMessage(response))
        const data = await response.json()
        if (isCurrent) setApplications(data)
      } catch (error) {
        if (isCurrent) setApiError(`Could not load applications. Make sure the API is running. ${error.message}`)
      } finally {
        if (isCurrent) setIsLoading(false)
      }
    }

    loadApplications()
    return () => { isCurrent = false }
  }, [user])

  async function signOut() {
    try {
      const response = await fetch(`${API_URL}/auth/logout`, { method: 'POST', credentials: 'include' })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      setApplications([])
      setIsLoading(false)
      setUser(null)
      setAuthMessage('')
    } catch (error) {
      setApiError(error.message || 'Could not sign out. Check that the API server is running.')
    }
  }

  if (isCheckingSession) {
    return <main className="auth-page"><div className="auth-loading">Opening your workspace…</div></main>
  }
  if (!user) {
    return <AuthScreen onAuthenticated={(signedInUser) => { setAuthMessage(''); setApplications([]); setIsLoading(true); setUser(signedInUser) }} message={authMessage} />
  }

  const countFor = (status) => applications.filter((application) => application.status === status).length

  function updateForm(event) {
    setForm({ ...form, [event.target.name]: event.target.value })
    setFormError('')
  }

  function openNewForm() {
    setEditingId(null)
    setForm({ company: '', role: '', location: '', date: todayAsLocalDate(), status: 'Applied' })
    setFormError('')
    setShowForm(true)
  }

  function openEditForm(application) {
    setEditingId(application.id)
    setForm({ company: application.company, role: application.role, location: application.location || '', date: application.date, status: application.status })
    setFormError('')
    setShowForm(true)
  }

  async function addApplication(event) {
    event.preventDefault()
    if (isSaving) return
    if (!form.company.trim() || !form.role.trim() || !form.date) {
      setFormError('Add a company, role, and application date to continue.')
      return
    }
    setIsSaving(true)
    try {
      const isEditing = editingId !== null
      const response = await fetch(`${API_URL}/applications${isEditing ? `/${editingId}` : ''}`, {
        method: isEditing ? 'PATCH' : 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, company: form.company.trim(), role: form.role.trim(), location: form.location.trim() }),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      const savedApplication = await response.json()
      setApplications((current) => isEditing
        ? current.map((application) => application.id === editingId ? savedApplication : application)
        : [savedApplication, ...current])
      setForm({ company: '', role: '', location: '', date: todayAsLocalDate(), status: 'Applied' })
      setFormError('')
      setApiError('')
      setEditingId(null)
      setShowForm(false)
      if (!isEditing) setActiveFilter('All applications')
    } catch (error) {
      setFormError(error.message || 'Could not save the application. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function updateApplicationStatus(id, status) {
    try {
      const response = await fetch(`${API_URL}/applications/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      const updatedApplication = await response.json()
      setApplications((current) => current.map((application) => application.id === id ? updatedApplication : application))
      setApiError('')
    } catch (error) {
      setApiError(error.message || 'Could not update the application. Please try again.')
    }
  }

  async function removeApplication(id) {
    const application = applications.find((item) => item.id === id)
    if (!application || !window.confirm(`Delete the application for ${application.company}? This cannot be undone.`)) return
    try {
      const response = await fetch(`${API_URL}/applications/${id}`, { method: 'DELETE', credentials: 'include' })
      if (!response.ok) throw new Error(await getErrorMessage(response))
      setApplications((current) => current.filter((application) => application.id !== id))
      setApiError('')
    } catch (error) {
      setApiError(error.message || 'Could not remove the application. Please try again.')
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" aria-label="FIbsaac Job Tracker home">
          <span className="brand-mark">F</span>
          <span>FIbsaac<span className="brand-light">/track</span></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <button className={`nav-link nav-button ${currentPage === 'overview' ? 'selected' : ''}`} onClick={() => setCurrentPage('overview')}><span className="nav-icon">▦</span> Overview</button>
          <a className="nav-link" href="#applications" onClick={() => setCurrentPage('overview')}><span className="nav-icon">▤</span> Applications <span className="nav-count">{applications.length}</span></a>
          {user.role === 'admin' && <button className={`nav-link nav-button ${currentPage === 'admin' ? 'selected' : ''}`} onClick={() => setCurrentPage('admin')}><span className="nav-icon">◫</span> Admin dashboard</button>}
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-card"><span className="tip-spark">✳</span><strong>One step at a time</strong><p>Your applications, all in one place.</p></div>
          <div className="profile"><div className="avatar">{userInitial}</div><div className="profile-copy"><strong>{displayName}</strong><span>{user.email}</span></div><button className="signout-button" type="button" onClick={signOut}>Sign out</button></div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>{currentPage === 'admin' ? 'Admin dashboard' : 'Overview'}</strong></div><div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><div className="top-avatar" aria-label={user.email}>{userInitial}</div><button className="top-signout-button" type="button" onClick={signOut}>Sign out</button></div></header>
        <div className="page-wrap">
          {currentPage === 'admin' && user.role === 'admin' ? <AdminDashboard /> : <>
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR JOB SEARCH</div><h1>Welcome back, {displayName}</h1><p className="welcome-copy">Here’s where things stand with your applications.</p></div>
            <button className="primary-button" onClick={openNewForm}><span className="plus">+</span> Add application</button>
          </section>

          <section className="stats-grid" aria-label="Application summary">
            <article className="stat-card total-card"><div className="stat-top"><span>Total applications</span><span className="stat-icon total-icon">▤</span></div><div className="stat-value">{applications.length}</div><div className="stat-foot"><span className="trend-up">↗</span> Applications tracked</div></article>
            <article className="stat-card"><div className="stat-top"><span>In progress</span><span className="stat-icon progress-icon">◷</span></div><div className="stat-value">{countFor('Applied') + countFor('Interview')}</div><div className="stat-foot">Applied or interviewing</div></article>
            <article className="stat-card"><div className="stat-top"><span>Interviews</span><span className="stat-icon interview-icon">✳</span></div><div className="stat-value">{countFor('Interview')}</div><div className="stat-foot">Keep preparing</div></article>
            <article className="stat-card"><div className="stat-top"><span>Offers</span><span className="stat-icon offer-icon">✦</span></div><div className="stat-value">{countFor('Offer')}</div><div className="stat-foot">Good things take time</div></article>
          </section>

          <section className="applications-panel" id="applications">
            <div className="panel-heading"><div><h2>Your applications</h2><p>Keep your opportunities and next steps together.</p></div><span className="application-count">{applications.length} total</span></div>
            {apiError && <div className="api-error" role="alert">{apiError}</div>}
            <div className="toolbar"><div className="filter-tabs" role="tablist" aria-label="Filter applications">{filters.map((filter) => <button key={filter} className={`filter-tab ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)} role="tab" aria-selected={activeFilter === filter}>{filter}{filter === 'All applications' && <span className="filter-total">{applications.length}</span>}</button>)}</div><label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applications" aria-label="Search applications" /></label></div>
            <div className="table-scroll"><table><thead><tr><th>COMPANY</th><th>ROLE</th><th>LOCATION</th><th>DATE APPLIED</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleApplications.map((application) => <tr key={application.id}><td><div className="company-cell"><span className="company-logo green">{application.company.slice(0, 1)}</span><strong>{application.company}</strong></div></td><td className="role-cell">{application.role}</td><td className="location-cell">{application.location || 'Not specified'}</td><td className="date-cell">{formatDate(application.date)}</td><td><select className={`status-pill status-select ${application.status.toLowerCase()}`} aria-label={`Change status for ${application.company}`} value={application.status} onChange={(event) => updateApplicationStatus(application.id, event.target.value)}>{filters.slice(1).map((status) => <option key={status}>{status}</option>)}</select></td><td><div className="row-actions"><button className="row-action" onClick={() => openEditForm(application)}>Edit</button><button className="row-action remove-action" onClick={() => removeApplication(application.id)}>Delete</button></div></td></tr>)}</tbody></table>
              {isLoading && <div className="empty-state"><strong>Loading applications…</strong></div>}
              {!isLoading && visibleApplications.length === 0 && <div className="empty-state"><span>⌕</span><strong>{applications.length === 0 ? 'No applications yet' : 'No applications found'}</strong><p>{applications.length === 0 ? 'Add your first opportunity to get started.' : 'Try another search or choose a different status.'}</p>{applications.length === 0 && <button className="empty-add-button" onClick={openNewForm}>Add an application</button>}</div>}
            </div>
            <div className="panel-footer"><span>Showing <strong>{visibleApplications.length}</strong> of <strong>{applications.length}</strong> applications</span><span className="footer-note"><span className="footer-dot" /> Up to date</span></div>
          </section>
          <footer className="page-footer"><span>A little progress counts.</span><span>FIbsaac’s Job Tracker <span className="footer-version">• 2026</span></span></footer>
          </>}
        </div>
      </main>

      {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !isSaving) { setShowForm(false); setEditingId(null) } }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="modal-kicker">{editingId ? 'UPDATE OPPORTUNITY' : 'NEW OPPORTUNITY'}</span><h2 id="modal-title">{editingId ? 'Edit application' : 'Add an application'}</h2><p>{editingId ? 'Update the details for this opportunity.' : 'Add a few details to keep it organized.'}</p></div><button type="button" className="close-button" onClick={() => { setShowForm(false); setEditingId(null) }} aria-label="Close form" disabled={isSaving}>×</button></div><form onSubmit={addApplication}><label>Company name<input name="company" value={form.company} onChange={updateForm} placeholder="e.g. Acme Inc." autoFocus required /></label><label>Job title<input name="role" value={form.role} onChange={updateForm} placeholder="e.g. Product Designer" required /></label><div className="form-row"><label>Location <span className="optional">Optional</span><input name="location" value={form.location} onChange={updateForm} placeholder="Remote or city" /></label><label>Date applied<input name="date" type="date" value={form.date} onChange={updateForm} required /></label></div><label>Status<select name="status" value={form.status} onChange={updateForm}><option>Applied</option><option>Interview</option><option>Saved</option><option>Offer</option><option>Rejected</option></select></label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setShowForm(false); setEditingId(null) }} disabled={isSaving}>Cancel</button><button type="submit" className="primary-button" disabled={isSaving}>{isSaving ? 'Saving…' : editingId ? 'Save changes' : 'Save application'}</button></div></form></section></div>}
    </div>
  )
}

export default App
