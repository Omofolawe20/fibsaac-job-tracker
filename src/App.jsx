import { useEffect, useMemo, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'
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

function App() {
  const [applications, setApplications] = useState([])
  const [activeFilter, setActiveFilter] = useState('All applications')
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [formError, setFormError] = useState('')
  const [apiError, setApiError] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [form, setForm] = useState({ company: '', role: '', location: '', date: todayAsLocalDate(), status: 'Applied' })

  useEffect(() => {
    let isCurrent = true

    async function loadApplications() {
      try {
        const response = await fetch(`${API_URL}/applications`)
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
  }, [])

  const visibleApplications = useMemo(() => applications.filter((application) => {
    const matchesFilter = activeFilter === 'All applications' || application.status === activeFilter
    const query = search.trim().toLowerCase()
    const matchesSearch = !query || `${application.company} ${application.role} ${application.location}`.toLowerCase().includes(query)
    return matchesFilter && matchesSearch
  }), [activeFilter, applications, search])

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
    if (!form.company.trim() || !form.role.trim() || !form.date) {
      setFormError('Add a company, role, and application date to continue.')
      return
    }
    try {
      const isEditing = editingId !== null
      const response = await fetch(`${API_URL}/applications${isEditing ? `/${editingId}` : ''}`, {
        method: isEditing ? 'PATCH' : 'POST',
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
    }
  }

  async function updateApplicationStatus(id, status) {
    try {
      const response = await fetch(`${API_URL}/applications/${id}`, {
        method: 'PATCH',
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
    try {
      const response = await fetch(`${API_URL}/applications/${id}`, { method: 'DELETE' })
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
          <a className="nav-link selected" href="#overview"><span className="nav-icon">▦</span> Overview</a>
          <a className="nav-link" href="#applications"><span className="nav-icon">▤</span> Applications <span className="nav-count">{applications.length}</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="tip-card"><span className="tip-spark">✳</span><strong>Small steps add up.</strong><p>Keep your applications organized and your next opportunity in sight.</p></div>
          <div className="profile"><div className="avatar">F</div><div><strong>FIbsaac</strong><span>Personal workspace</span></div><span className="profile-dots">···</span></div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar"><div className="breadcrumbs">Workspace <span>/</span> <strong>Overview</strong></div><div className="topbar-right"><span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())}</span><div className="top-avatar">F</div></div></header>
        <div className="page-wrap">
          <section className="welcome-row">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> YOUR CAREER, IN FOCUS</div><h1>Good morning, FIbsaac<span className="wave">✳</span></h1><p className="welcome-copy">A clear view of where you are and what’s next.</p></div>
            <button className="primary-button" onClick={openNewForm}><span className="plus">+</span> Add application</button>
          </section>

          <section className="stats-grid" aria-label="Application summary">
            <article className="stat-card total-card"><div className="stat-top"><span>Total applications</span><span className="stat-icon total-icon">▤</span></div><div className="stat-value">{applications.length}</div><div className="stat-foot"><span className="trend-up">↗</span> Applications tracked</div></article>
            <article className="stat-card"><div className="stat-top"><span>In progress</span><span className="stat-icon progress-icon">◷</span></div><div className="stat-value">{countFor('Applied') + countFor('Interview')}</div><div className="stat-foot">Applied or interviewing</div></article>
            <article className="stat-card"><div className="stat-top"><span>Interviews</span><span className="stat-icon interview-icon">✳</span></div><div className="stat-value">{countFor('Interview')}</div><div className="stat-foot">Keep preparing</div></article>
            <article className="stat-card"><div className="stat-top"><span>Offers</span><span className="stat-icon offer-icon">✦</span></div><div className="stat-value">{countFor('Offer')}</div><div className="stat-foot">Good things take time</div></article>
          </section>

          <section className="applications-panel" id="applications">
            <div className="panel-heading"><div><h2>Your applications</h2><p>Keep every opportunity moving forward.</p></div><button className="more-button" aria-label="More application options">···</button></div>
            {apiError && <div className="api-error" role="alert">{apiError}</div>}
            <div className="toolbar"><div className="filter-tabs" role="tablist" aria-label="Filter applications">{filters.map((filter) => <button key={filter} className={`filter-tab ${activeFilter === filter ? 'active' : ''}`} onClick={() => setActiveFilter(filter)} role="tab" aria-selected={activeFilter === filter}>{filter}{filter === 'All applications' && <span className="filter-total">{applications.length}</span>}</button>)}</div><label className="search-box"><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search applications" aria-label="Search applications" /></label></div>
            <div className="table-scroll"><table><thead><tr><th>COMPANY</th><th>ROLE</th><th>LOCATION</th><th>DATE APPLIED</th><th>STATUS</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{visibleApplications.map((application) => <tr key={application.id}><td><div className="company-cell"><span className="company-logo green">{application.company.slice(0, 1)}</span><strong>{application.company}</strong></div></td><td className="role-cell">{application.role}</td><td className="location-cell">{application.location || 'Not specified'}</td><td className="date-cell">{formatDate(application.date)}</td><td><select className={`status-pill status-select ${application.status.toLowerCase()}`} aria-label={`Status for ${application.company}`} value={application.status} onChange={(event) => updateApplicationStatus(application.id, event.target.value)}>{filters.slice(1).map((status) => <option key={status}>{status}</option>)}</select></td><td><div className="row-actions"><button className="row-action" aria-label={`Edit ${application.company}`} onClick={() => openEditForm(application)}>✎</button><button className="row-action remove-action" aria-label={`Remove ${application.company}`} onClick={() => removeApplication(application.id)}>×</button></div></td></tr>)}</tbody></table>
              {isLoading && <div className="empty-state"><strong>Loading applications…</strong></div>}
              {!isLoading && visibleApplications.length === 0 && <div className="empty-state"><span>⌕</span><strong>{applications.length === 0 ? 'No applications yet' : 'No applications found'}</strong><p>{applications.length === 0 ? 'Add your first opportunity to get started.' : 'Try another search or choose a different status.'}</p>{applications.length === 0 && <button className="empty-add-button" onClick={openNewForm}>Add an application</button>}</div>}
            </div>
            <div className="panel-footer"><span>Showing <strong>{visibleApplications.length}</strong> of <strong>{applications.length}</strong> applications</span><span className="footer-note"><span className="footer-dot" /> Up to date</span></div>
          </section>
          <footer className="page-footer"><span>Made for the next opportunity.</span><span>FIbsaac’s Job Tracker <span className="footer-version">• 2026</span></span></footer>
        </div>
      </main>

      {showForm && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) { setShowForm(false); setEditingId(null) } }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="modal-kicker">{editingId ? 'UPDATE OPPORTUNITY' : 'NEW OPPORTUNITY'}</span><h2 id="modal-title">{editingId ? 'Edit application' : 'Add an application'}</h2><p>{editingId ? 'Update the details for this opportunity.' : 'Save the details so you can keep track.'}</p></div><button className="close-button" onClick={() => { setShowForm(false); setEditingId(null) }} aria-label="Close form">×</button></div><form onSubmit={addApplication}><label>Company name<input name="company" value={form.company} onChange={updateForm} placeholder="e.g. Acme Inc." autoFocus /></label><label>Job title<input name="role" value={form.role} onChange={updateForm} placeholder="e.g. Product Designer" /></label><div className="form-row"><label>Location <span className="optional">Optional</span><input name="location" value={form.location} onChange={updateForm} placeholder="Remote or city" /></label><label>Date applied<input name="date" type="date" value={form.date} onChange={updateForm} /></label></div><label>Status<select name="status" value={form.status} onChange={updateForm}><option>Applied</option><option>Interview</option><option>Saved</option><option>Offer</option><option>Rejected</option></select></label>{formError && <p className="form-error" role="alert">{formError}</p>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => { setShowForm(false); setEditingId(null) }}>Cancel</button><button type="submit" className="primary-button">{editingId ? 'Save changes' : 'Save application'}</button></div></form></section></div>}
    </div>
  )
}

export default App
