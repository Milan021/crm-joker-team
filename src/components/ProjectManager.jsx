import { useState, useEffect } from 'react'

const KANBAN_COLS = [
  { id: 'backlog', label: 'Backlog', color: '#64808b' },
  { id: 'todo', label: 'A faire', color: '#60a5fa' },
  { id: 'in_progress', label: 'En cours', color: '#f59e0b' },
  { id: 'review', label: 'Review', color: '#a78bfa' },
  { id: 'done', label: 'Termine', color: '#34d399' }
]

const PRIORITY = {
  critical: { label: 'Critique', color: '#ef4444', bg: 'rgba(239,68,68,0.15)' },
  high: { label: 'Haute', color: '#f59e0b', bg: 'rgba(245,158,11,0.15)' },
  medium: { label: 'Moyenne', color: '#60a5fa', bg: 'rgba(96,165,250,0.15)' },
  low: { label: 'Basse', color: '#34d399', bg: 'rgba(52,211,153,0.15)' }
}

const TASK_TYPES = {
  feature: { label: 'Feature', icon: '🚀', color: '#60a5fa' },
  bug: { label: 'Bug', icon: '🐛', color: '#f87171' },
  improvement: { label: 'Amelioration', icon: '✨', color: '#D4AF37' },
  deployment: { label: 'Deploiement', icon: '📦', color: '#34d399' }
}

const INITIAL_TASKS = [
  { id: 1, title: 'Configurer domaine crm.joker-team.fr', type: 'deployment', status: 'in_progress', priority: 'high', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-14', notes: 'DNS O2switch + Vercel' },
  { id: 2, title: 'Corriger contacts mal classes (David POTOCKI, etc.)', type: 'bug', status: 'done', priority: 'high', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-13' },
  { id: 3, title: 'RLS sur toutes les tables Supabase', type: 'bug', status: 'done', priority: 'critical', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-13' },
  { id: 4, title: 'Triggers auto-classification contacts', type: 'feature', status: 'done', priority: 'high', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-13' },
  { id: 5, title: 'Rattacher/Detacher/Convertir contacts', type: 'feature', status: 'done', priority: 'high', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-13' },
  { id: 6, title: 'Audit Client API gouv.fr + IA', type: 'feature', status: 'done', priority: 'medium', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-11' },
  { id: 7, title: 'Intercontrat Tracker', type: 'feature', status: 'done', priority: 'high', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-10' },
  { id: 8, title: 'Retry logic API Claude (erreur 529)', type: 'bug', status: 'done', priority: 'medium', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-13' },
  { id: 9, title: 'Service Worker bloque les API', type: 'bug', status: 'done', priority: 'critical', sprint: 'Sprint 1', milestone: 'v1.0 - Production', date: '2026-04-11' },
  { id: 10, title: 'Copilot Commercial (mails IA)', type: 'feature', status: 'backlog', priority: 'medium', sprint: 'Sprint 2', milestone: 'v1.1 - IA Avancee' },
  { id: 11, title: 'Scoring dynamique prospects', type: 'feature', status: 'backlog', priority: 'medium', sprint: 'Sprint 2', milestone: 'v1.1 - IA Avancee' },
  { id: 12, title: 'Alertes intelligentes (signaux faibles)', type: 'feature', status: 'backlog', priority: 'low', sprint: 'Sprint 2', milestone: 'v1.1 - IA Avancee' },
  { id: 13, title: 'Multi-tenant + roles utilisateurs', type: 'feature', status: 'backlog', priority: 'high', sprint: 'Sprint 3', milestone: 'v2.0 - SaaS' },
  { id: 14, title: 'Stripe integration (abonnements)', type: 'feature', status: 'backlog', priority: 'high', sprint: 'Sprint 3', milestone: 'v2.0 - SaaS' },
  { id: 15, title: 'Portail freelance', type: 'feature', status: 'backlog', priority: 'medium', sprint: 'Sprint 3', milestone: 'v2.0 - SaaS' },
  { id: 16, title: 'Nettoyer tables inutilisees Supabase', type: 'improvement', status: 'todo', priority: 'low', sprint: 'Sprint 1', milestone: 'v1.0 - Production' },
  { id: 17, title: 'Tester le CRM pendant 2 semaines', type: 'improvement', status: 'todo', priority: 'critical', sprint: 'Sprint 1', milestone: 'v1.0 - Production' },
  { id: 18, title: 'Mettre a jour Supabase redirect URLs', type: 'deployment', status: 'todo', priority: 'high', sprint: 'Sprint 1', milestone: 'v1.0 - Production', notes: 'Ajouter crm.joker-team.fr dans Supabase Auth redirect URLs' },
]

const MILESTONES = [
  { id: 'v1.0 - Production', label: 'v1.0 - Production', color: '#34d399', target: '2026-04-30', description: 'CRM stable, domaine configure, securise, utilise au quotidien' },
  { id: 'v1.1 - IA Avancee', label: 'v1.1 - IA Avancee', color: '#60a5fa', target: '2026-06-30', description: 'Copilot commercial, scoring prospects, alertes intelligentes' },
  { id: 'v2.0 - SaaS', label: 'v2.0 - SaaS', color: '#D4AF37', target: '2026-09-30', description: 'Multi-tenant, Stripe, portail freelance, commercialisation' },
]

export default function ProjectManager() {
  const [tasks, setTasks] = useState(() => {
    const saved = localStorage.getItem('crm_project_tasks')
    return saved ? JSON.parse(saved) : INITIAL_TASKS
  })
  const [view, setView] = useState('kanban')
  const [showModal, setShowModal] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [filterType, setFilterType] = useState('all')
  const [filterMilestone, setFilterMilestone] = useState('all')
  const [draggedTask, setDraggedTask] = useState(null)
  const [formData, setFormData] = useState({
    title: '', type: 'feature', priority: 'medium', status: 'backlog',
    sprint: 'Sprint 1', milestone: 'v1.0 - Production', notes: '', date: ''
  })

  useEffect(() => {
    localStorage.setItem('crm_project_tasks', JSON.stringify(tasks))
  }, [tasks])

  function addTask() {
    const newTask = { ...formData, id: Date.now() }
    setTasks(prev => [...prev, newTask])
    setShowModal(false)
    resetForm()
  }

  function updateTask() {
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...t, ...formData } : t))
    setShowModal(false)
    setEditingTask(null)
    resetForm()
  }

  function deleteTask(id) {
    if (!confirm('Supprimer cette tache ?')) return
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  function moveTask(taskId, newStatus) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t))
  }

  function openEdit(task) {
    setEditingTask(task)
    setFormData({ title: task.title, type: task.type, priority: task.priority, status: task.status, sprint: task.sprint || '', milestone: task.milestone || '', notes: task.notes || '', date: task.date || '' })
    setShowModal(true)
  }

  function openNew() {
    setEditingTask(null)
    resetForm()
    setShowModal(true)
  }

  function resetForm() {
    setFormData({ title: '', type: 'feature', priority: 'medium', status: 'backlog', sprint: 'Sprint 1', milestone: 'v1.0 - Production', notes: '', date: '' })
  }

  function handleDrop(e, colId) {
    e.preventDefault()
    if (draggedTask) { moveTask(draggedTask, colId); setDraggedTask(null) }
  }

  const filtered = tasks.filter(t => {
    if (filterType !== 'all' && t.type !== filterType) return false
    if (filterMilestone !== 'all' && t.milestone !== filterMilestone) return false
    return true
  })

  const totalTasks = tasks.length
  const doneTasks = tasks.filter(t => t.status === 'done').length
  const bugs = tasks.filter(t => t.type === 'bug').length
  const bugsFixed = tasks.filter(t => t.type === 'bug' && t.status === 'done').length
  const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const card = {
    background: 'linear-gradient(135deg, rgba(18,42,51,0.95) 0%, rgba(26,58,69,0.9) 100%)',
    borderRadius: '16px', border: '1px solid rgba(212,175,55,0.12)',
    backdropFilter: 'blur(12px)', color: '#e2e8f0'
  }

  return (
    <div>
      {/* Header */}
      <div style={{ ...card, padding: '1.5rem 2rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#fff', margin: 0 }}>📋 Chef de Projet</h2>
            <p style={{ color: '#64808b', fontSize: '0.82rem', margin: '0.3rem 0 0' }}>CRM Joker Team — Suivi du projet, sprints, bugs et roadmap</p>
          </div>
          <button onClick={openNew} style={{ background: 'linear-gradient(135deg, #D4AF37, #c9a02e)', border: 'none', borderRadius: '8px', color: '#122a33', padding: '0.6rem 1.4rem', fontWeight: 700, fontSize: '0.9rem', cursor: 'pointer' }}>+ Nouvelle tache</button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { icon: '📊', label: 'Progression', value: `${progress}%`, accent: '#D4AF37' },
          { icon: '✅', label: 'Terminees', value: `${doneTasks}/${totalTasks}`, accent: '#34d399' },
          { icon: '🐛', label: 'Bugs', value: `${bugsFixed}/${bugs} fixes`, accent: '#f87171' },
          { icon: '🚀', label: 'Features', value: tasks.filter(t => t.type === 'feature').length, accent: '#60a5fa' },
        ].map((s, i) => (
          <div key={i} style={{ ...card, padding: '1rem 1.25rem', borderTop: `3px solid ${s.accent}` }}>
            <div style={{ fontSize: '0.78rem', color: '#8ba5b0', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><span>{s.icon}</span> {s.label}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div style={{ ...card, padding: '1rem 1.5rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.82rem', color: '#8ba5b0' }}>Progression globale</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#D4AF37' }}>{progress}%</span>
        </div>
        <div style={{ height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.06)' }}>
          <div style={{ height: '100%', borderRadius: '4px', background: 'linear-gradient(90deg, #D4AF37, #34d399)', width: `${progress}%`, transition: 'width 0.5s ease' }} />
        </div>
      </div>

      {/* View toggle + Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          {[
            { id: 'kanban', label: '📋 Kanban' },
            { id: 'bugs', label: '🐛 Bugs' },
            { id: 'roadmap', label: '🗺️ Roadmap' },
            { id: 'planning', label: '📅 Planning' }
          ].map(v => (
            <button key={v.id} onClick={() => setView(v.id)} style={{
              background: view === v.id ? 'rgba(212,175,55,0.2)' : 'rgba(255,255,255,0.05)',
              border: view === v.id ? '1px solid rgba(212,175,55,0.5)' : '1px solid rgba(255,255,255,0.08)',
              color: view === v.id ? '#D4AF37' : '#8ba5b0',
              padding: '0.4rem 0.9rem', borderRadius: '8px', fontSize: '0.82rem',
              fontWeight: view === v.id ? 600 : 400, cursor: 'pointer'
            }}>{v.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }}>
          {[{ id: 'all', label: 'Tous' }, ...Object.entries(TASK_TYPES).map(([k, v]) => ({ id: k, label: v.icon }))].map(f => (
            <button key={f.id} onClick={() => setFilterType(f.id)} style={{
              background: filterType === f.id ? 'rgba(96,165,250,0.2)' : 'rgba(255,255,255,0.05)',
              border: filterType === f.id ? '1px solid rgba(96,165,250,0.4)' : '1px solid rgba(255,255,255,0.06)',
              color: filterType === f.id ? '#60a5fa' : '#64808b',
              padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.78rem', cursor: 'pointer'
            }}>{f.label}</button>
          ))}
        </div>
      </div>

      {/* KANBAN VIEW */}
      {view === 'kanban' && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${KANBAN_COLS.length}, 1fr)`, gap: '0.75rem', overflowX: 'auto' }}>
          {KANBAN_COLS.map(col => {
            const colTasks = filtered.filter(t => t.status === col.id)
            return (
              <div key={col.id}
                onDragOver={e => e.preventDefault()}
                onDrop={e => handleDrop(e, col.id)}
                style={{ ...card, padding: '0.75rem', minHeight: '300px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', paddingBottom: '0.5rem', borderBottom: `2px solid ${col.color}` }}>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: col.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{col.label}</span>
                  <span style={{ fontSize: '0.7rem', color: '#4a6370', background: 'rgba(255,255,255,0.05)', padding: '0.1rem 0.4rem', borderRadius: '8px' }}>{colTasks.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {colTasks.map(task => {
                    const tt = TASK_TYPES[task.type] || TASK_TYPES.feature
                    const pr = PRIORITY[task.priority] || PRIORITY.medium
                    return (
                      <div key={task.id}
                        draggable
                        onDragStart={() => setDraggedTask(task.id)}
                        onClick={() => openEdit(task)}
                        style={{
                          background: 'rgba(0,0,0,0.2)', borderRadius: '10px', padding: '0.65rem',
                          border: '1px solid rgba(255,255,255,0.04)', cursor: 'grab',
                          transition: 'transform 0.15s, box-shadow 0.15s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.3)' }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.3rem' }}>
                          <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#e2e8f0', lineHeight: 1.3 }}>{tt.icon} {task.title}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.3rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', fontWeight: 600, color: pr.color, background: pr.bg }}>{pr.label}</span>
                          {task.sprint && <span style={{ padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.6rem', color: '#64808b', background: 'rgba(255,255,255,0.05)' }}>{task.sprint}</span>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* BUGS VIEW */}
      {view === 'bugs' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f87171' }}>🐛 Suivi des bugs — {bugsFixed}/{bugs} resolus</span>
          </div>
          {tasks.filter(t => t.type === 'bug').length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: '#34d399' }}>✅ Aucun bug ! Tout fonctionne.</div>
          ) : tasks.filter(t => t.type === 'bug').sort((a, b) => {
            const pOrder = { critical: 0, high: 1, medium: 2, low: 3 }
            return (pOrder[a.priority] || 2) - (pOrder[b.priority] || 2)
          }).map(task => {
            const pr = PRIORITY[task.priority] || PRIORITY.medium
            const isDone = task.status === 'done'
            return (
              <div key={task.id} onClick={() => openEdit(task)} style={{
                padding: '0.85rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                borderBottom: '1px solid rgba(255,255,255,0.03)', cursor: 'pointer',
                opacity: isDone ? 0.5 : 1
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <span style={{ fontSize: '1rem' }}>{isDone ? '✅' : '🐛'}</span>
                  <div>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600, color: '#e2e8f0', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</div>
                    {task.notes && <div style={{ fontSize: '0.72rem', color: '#4a6370', marginTop: '0.15rem' }}>{task.notes}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', fontWeight: 600, color: pr.color, background: pr.bg }}>{pr.label}</span>
                  <span style={{ padding: '0.15rem 0.5rem', borderRadius: '6px', fontSize: '0.68rem', color: KANBAN_COLS.find(c => c.id === task.status)?.color || '#64808b', background: 'rgba(255,255,255,0.05)' }}>{KANBAN_COLS.find(c => c.id === task.status)?.label || task.status}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ROADMAP VIEW */}
      {view === 'roadmap' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {MILESTONES.map(ms => {
            const msTasks = tasks.filter(t => t.milestone === ms.id)
            const msDone = msTasks.filter(t => t.status === 'done').length
            const msProgress = msTasks.length > 0 ? Math.round((msDone / msTasks.length) * 100) : 0
            const daysLeft = ms.target ? Math.floor((new Date(ms.target) - new Date()) / 86400000) : null
            return (
              <div key={ms.id} style={{ ...card, padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <div>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: ms.color }}>{ms.label}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64808b' }}>{ms.description}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: msProgress === 100 ? '#34d399' : '#fff' }}>{msProgress}%</div>
                    {daysLeft !== null && <div style={{ fontSize: '0.7rem', color: daysLeft < 0 ? '#f87171' : daysLeft < 14 ? '#f59e0b' : '#64808b' }}>{daysLeft < 0 ? `${Math.abs(daysLeft)}j de retard` : `${daysLeft}j restants`}</div>}
                    {ms.target && <div style={{ fontSize: '0.65rem', color: '#3a5560' }}>Objectif: {new Date(ms.target).toLocaleDateString('fr-FR')}</div>}
                  </div>
                </div>
                <div style={{ height: '6px', borderRadius: '3px', background: 'rgba(255,255,255,0.06)', marginBottom: '1rem' }}>
                  <div style={{ height: '100%', borderRadius: '3px', background: ms.color, width: `${msProgress}%`, transition: 'width 0.5s' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                  {msTasks.map(task => {
                    const tt = TASK_TYPES[task.type] || TASK_TYPES.feature
                    const isDone = task.status === 'done'
                    return (
                      <div key={task.id} onClick={() => openEdit(task)} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '0.4rem 0.6rem', borderRadius: '6px', cursor: 'pointer',
                        background: isDone ? 'rgba(52,211,153,0.05)' : 'rgba(255,255,255,0.02)',
                        opacity: isDone ? 0.6 : 1
                      }}>
                        <span style={{ fontSize: '0.8rem', color: '#e2e8f0' }}>
                          {isDone ? '✅' : '⬜'} {tt.icon} {task.title}
                        </span>
                        <span style={{ fontSize: '0.65rem', color: '#4a6370' }}>{task.sprint}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* PLANNING VIEW */}
      {view === 'planning' && (
        <div style={{ ...card, overflow: 'hidden' }}>
          <div style={{ padding: '1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#D4AF37' }}>📅 Planning de deploiement</span>
          </div>
          {['Sprint 1', 'Sprint 2', 'Sprint 3'].map(sprint => {
            const sprintTasks = filtered.filter(t => t.sprint === sprint)
            if (sprintTasks.length === 0) return null
            const spDone = sprintTasks.filter(t => t.status === 'done').length
            return (
              <div key={sprint}>
                <div style={{ padding: '0.75rem 1.5rem', background: 'rgba(212,175,55,0.05)', borderBottom: '1px solid rgba(255,255,255,0.04)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#D4AF37' }}>{sprint}</span>
                  <span style={{ fontSize: '0.75rem', color: '#64808b' }}>{spDone}/{sprintTasks.length} terminees</span>
                </div>
                {sprintTasks.sort((a, b) => {
                  const sOrder = { done: 3, review: 2, in_progress: 1, todo: 0, backlog: -1 }
                  return (sOrder[b.status] || 0) - (sOrder[a.status] || 0)
                }).map(task => {
                  const tt = TASK_TYPES[task.type] || TASK_TYPES.feature
                  const pr = PRIORITY[task.priority] || PRIORITY.medium
                  const isDone = task.status === 'done'
                  const statusCol = KANBAN_COLS.find(c => c.id === task.status)
                  return (
                    <div key={task.id} onClick={() => openEdit(task)} style={{
                      padding: '0.7rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      borderBottom: '1px solid rgba(255,255,255,0.02)', cursor: 'pointer',
                      opacity: isDone ? 0.5 : 1
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span>{isDone ? '✅' : tt.icon}</span>
                        <span style={{ fontSize: '0.85rem', color: '#e2e8f0', textDecoration: isDone ? 'line-through' : 'none' }}>{task.title}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, color: pr.color, background: pr.bg }}>{pr.label}</span>
                        <span style={{ padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.65rem', color: statusCol?.color || '#64808b', background: 'rgba(255,255,255,0.05)' }}>{statusCol?.label || task.status}</span>
                        {task.date && <span style={{ fontSize: '0.65rem', color: '#3a5560' }}>{new Date(task.date).toLocaleDateString('fr-FR')}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem', backdropFilter: 'blur(4px)' }} onClick={() => { setShowModal(false); setEditingTask(null) }}>
          <div style={{ ...card, width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '2rem', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#fff', margin: 0 }}>{editingTask ? '✏️ Modifier la tache' : '➕ Nouvelle tache'}</h3>
              <button onClick={() => { setShowModal(false); setEditingTask(null) }} style={{ background: 'none', border: 'none', color: '#64808b', fontSize: '1.4rem', cursor: 'pointer' }}>x</button>
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Titre *</label>
              <input type="text" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} style={inputStyle} placeholder="Decrire la tache..." />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Type</label>
                <select value={formData.type} onChange={e => setFormData({ ...formData, type: e.target.value })} style={inputStyle}>
                  {Object.entries(TASK_TYPES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Priorite</label>
                <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })} style={inputStyle}>
                  {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Statut</label>
                <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} style={inputStyle}>
                  {KANBAN_COLS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Sprint</label>
                <select value={formData.sprint} onChange={e => setFormData({ ...formData, sprint: e.target.value })} style={inputStyle}>
                  <option value="Sprint 1">Sprint 1</option>
                  <option value="Sprint 2">Sprint 2</option>
                  <option value="Sprint 3">Sprint 3</option>
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Milestone</label>
                <select value={formData.milestone} onChange={e => setFormData({ ...formData, milestone: e.target.value })} style={inputStyle}>
                  {MILESTONES.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Date</label>
                <input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} style={inputStyle} />
              </div>
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Notes</label>
              <textarea rows={2} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              {editingTask && <button onClick={() => deleteTask(editingTask.id)} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#f87171', padding: '0.6rem 1rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>🗑️ Supprimer</button>}
              <button onClick={() => { setShowModal(false); setEditingTask(null) }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#8ba5b0', padding: '0.6rem 1.4rem', borderRadius: '8px', fontSize: '0.88rem', cursor: 'pointer' }}>Annuler</button>
              <button onClick={editingTask ? updateTask : addTask} disabled={!formData.title.trim()} style={{ background: formData.title.trim() ? 'linear-gradient(135deg, #D4AF37, #c9a02e)' : 'rgba(212,175,55,0.3)', border: 'none', color: '#122a33', padding: '0.6rem 1.8rem', borderRadius: '8px', fontWeight: 700, fontSize: '0.88rem', cursor: formData.title.trim() ? 'pointer' : 'default' }}>{editingTask ? 'Mettre a jour' : 'Creer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', color: '#8ba5b0', fontSize: '0.78rem', fontWeight: 500, marginBottom: '0.3rem', letterSpacing: '0.03em', textTransform: 'uppercase' }
const inputStyle = { width: '100%', padding: '0.65rem 0.9rem', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#e2e8f0', fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box' }
