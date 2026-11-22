import React, { useState, useRef, useEffect } from 'react'
import ManualViewer from '../manuals/ManualViewer'
import {
  GraduationCap,
  BookOpen,
  Library,
  LogOut,
  Users,
  Home,
  UserCircle,
  CalendarDays,
  UserCheck,
  CalendarCheck,
  Link2,
  ScrollText,
  ChevronDown,
  Settings2,
  WifiOff
} from 'lucide-react'

const GESTION_GROUPS = [
  {
    label: 'Catálogos y estructura',
    items: [
      { id: 'asignaturas', label: 'Banco de Asignaturas', desc: 'Materias obligatorias y electivas', icon: Library },
      { id: 'programas_coordinadores', label: 'Coordinación de Programas', desc: 'Responsables por programa', icon: UserCheck }
    ]
  },
  {
    label: 'Docentes',
    items: [
      { id: 'plantilla', label: 'Plantilla', desc: 'Docentes y coordinadores', icon: Users },
      { id: 'asociaciones', label: 'Asociaciones Docentes', desc: 'Escuelas, materias y evaluaciones', icon: Link2 }
    ]
  },
  {
    label: 'Período y control',
    items: [
      { id: 'periodos', label: 'Períodos Académicos', desc: 'Vigencia, fechas y plazos', icon: CalendarDays },
      { id: 'bitacora', label: 'Bitácora', desc: 'Auditoría de cambios', icon: ScrollText }
    ]
  }
]

const GESTION_ITEMS_MAP = Object.fromEntries(
  GESTION_GROUPS.flatMap(g => g.items).map(item => [item.id, item])
)

export default function Navbar({ activeTab, setActiveTab, isConnected, user, onLogout }) {
  const [showManual, setShowManual] = useState(false)
  const [gestionOpen, setGestionOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const gestionRef = useRef(null)
  const userMenuRef = useRef(null)

  const rol = Number(user?.rol ?? 1) // 1: Admin, 2: Coordinador, 3: Docente
  const isAdmin = rol === 1
  const isCoordinador = rol === 2
  const isDocente = rol === 3

  const canSeeProgramas = isAdmin || isCoordinador
  const canSeeProgramacion = isAdmin || isCoordinador
  const canSeeAsignacionDocente = isAdmin || isCoordinador

  const rolLabel = rol === 1
    ? 'Administrador'
    : (rol === 2 ? 'Coordinador' : (rol === 3 ? 'Docente' : (user?.rolNombre || 'Usuario')))

  const isHomeActive = activeTab === 'inicio' || activeTab === 'docente_portal' || activeTab === 'coordinador_portal'
  const activeGestionItem = GESTION_ITEMS_MAP[activeTab] || null

  const initials = user
    ? `${(user.nombre || '').trim().charAt(0)}${(user.apellido || '').trim().charAt(0)}`.toUpperCase() || 'U'
    : 'U'

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (gestionRef.current && !gestionRef.current.contains(e.target)) {
        setGestionOpen(false)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setUserMenuOpen(false)
      }
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setGestionOpen(false)
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const navigateTo = (tab) => {
    setActiveTab(tab)
    setGestionOpen(false)
    setUserMenuOpen(false)
  }

  return (
    <>
      <ManualViewer
        role={rol}
        activeTab={activeTab}
        isOpen={showManual}
        onClose={() => setShowManual(false)}
      />

      <header className="navbar">
        {/* Nivel superior: Marca institucional y menú de usuario */}
        <div className="navbar-top-bar">
          <div className="navbar-top-container">
            <div className="navbar-brand" onClick={() => navigateTo('inicio')} title="Coordinación y Dirección Académica">
              <div className="brand-icon-bg">
                <GraduationCap size={24} className="brand-icon" />
              </div>
              <div className="brand-text">
                <span className="brand-title">Coordinación y Dirección Académica</span>
                <span className="brand-subtitle">
                  Pensum Académico Universitario
                  <span
                    className={`brand-status-dot ${isConnected ? 'online' : 'offline'}`}
                    title={isConnected ? 'Conectado al servidor' : 'Sin conexión'}
                  />
                </span>
              </div>
            </div>

            <div className="navbar-actions">
              {!isConnected && (
                <div className="status-pill offline" title="Sin conexión con el servidor">
                  <WifiOff size={14} />
                  <span>Sin conexión</span>
                </div>
              )}

              <button
                type="button"
                className="navbar-icon-btn"
                onClick={() => setShowManual(true)}
                title="Abrir manual de usuario"
                aria-label="Abrir manual de usuario"
              >
                <BookOpen size={16} />
                <span>Manual</span>
              </button>

              {user && (
                <div className="navbar-dropdown-wrapper" ref={userMenuRef}>
                  <button
                    type="button"
                    className={`navbar-user-trigger ${userMenuOpen || activeTab === 'mi-perfil' ? 'active' : ''}`}
                    onClick={() => {
                      setUserMenuOpen(prev => !prev)
                      setGestionOpen(false)
                    }}
                    aria-expanded={userMenuOpen}
                    aria-haspopup="menu"
                  >
                    <span className="navbar-user-avatar">{initials}</span>
                    <div className="navbar-user">
                      <span className="navbar-user-name">{user.nombre} {user.apellido}</span>
                      <span className="navbar-user-role">{rolLabel}</span>
                    </div>
                    <ChevronDown size={15} className={`navbar-chevron ${userMenuOpen ? 'open' : ''}`} />
                  </button>

                  {userMenuOpen && (
                    <div className="navbar-popover navbar-user-popover" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className={`navbar-popover-item ${activeTab === 'mi-perfil' ? 'active' : ''}`}
                        onClick={() => navigateTo('mi-perfil')}
                      >
                        <UserCircle size={16} />
                        <span>Mi perfil</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="navbar-popover-item"
                        onClick={() => {
                          setUserMenuOpen(false)
                          setShowManual(true)
                        }}
                      >
                        <BookOpen size={16} />
                        <span>Manual de usuario</span>
                      </button>
                      {onLogout && (
                        <>
                          <div className="navbar-popover-divider" />
                          <button
                            type="button"
                            role="menuitem"
                            className="navbar-popover-item danger"
                            onClick={() => {
                              setUserMenuOpen(false)
                              onLogout()
                            }}
                          >
                            <LogOut size={16} />
                            <span>Cerrar sesión</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Nivel inferior: Navegación híbrida (acceso directo a lo frecuente + Gestión ▾ para Admin) */}
        <div className="navbar-nav-bar">
          <div className="navbar-nav-container">
            <nav className="navbar-links" aria-label="Navegación principal">
              <button
                type="button"
                className={`nav-tab-btn ${isHomeActive ? 'active' : ''}`}
                onClick={() => navigateTo('inicio')}
                title="Inicio"
              >
                <Home size={17} />
                <span>Inicio</span>
              </button>

              {canSeeProgramas && (
                <button
                  type="button"
                  className={`nav-tab-btn ${activeTab === 'programas' ? 'active' : ''}`}
                  onClick={() => navigateTo('programas')}
                  title="Programas y Mallas Curriculares"
                >
                  <BookOpen size={17} />
                  <span>Programas</span>
                </button>
              )}

              {canSeeProgramacion && (
                <button
                  type="button"
                  className={`nav-tab-btn ${activeTab === 'programacion_cohortes' ? 'active' : ''}`}
                  onClick={() => navigateTo('programacion_cohortes')}
                  title={isCoordinador ? 'Cupos de estudiantes' : 'Programación y Cohortes'}
                >
                  <CalendarDays size={17} />
                  <span>{isCoordinador ? 'Cupos de estudiantes' : 'Programación'}</span>
                </button>
              )}

              {canSeeAsignacionDocente && (
                <button
                  type="button"
                  className={`nav-tab-btn ${activeTab === 'asignacion_docente' ? 'active' : ''}`}
                  onClick={() => navigateTo('asignacion_docente')}
                  title="Asignación y Designación Docente"
                >
                  <CalendarCheck size={17} />
                  <span>Asignación Docente</span>
                </button>
              )}

              {isAdmin && (
                <div className="navbar-dropdown-wrapper" ref={gestionRef}>
                  <button
                    type="button"
                    className={`nav-tab-btn nav-tab-dropdown ${activeGestionItem || gestionOpen ? 'active' : ''}`}
                    onClick={() => {
                      setGestionOpen(prev => !prev)
                      setUserMenuOpen(false)
                    }}
                    aria-expanded={gestionOpen}
                    aria-haspopup="menu"
                    title="Catálogos, docentes, períodos y bitácora"
                  >
                    <Settings2 size={17} />
                    <span>
                      Gestión
                      {activeGestionItem && (
                        <span className="nav-tab-subactive"> · {activeGestionItem.label}</span>
                      )}
                    </span>
                    <ChevronDown size={15} className={`navbar-chevron ${gestionOpen ? 'open' : ''}`} />
                  </button>

                  {gestionOpen && (
                    <div className="navbar-popover navbar-gestion-popover" role="menu">
                      {GESTION_GROUPS.map((group, idx) => (
                        <div key={group.label} className="navbar-popover-group">
                          {idx > 0 && <div className="navbar-popover-divider" />}
                          <div className="navbar-popover-group-label">{group.label}</div>
                          {group.items.map((item) => {
                            const Icon = item.icon
                            const isActive = activeTab === item.id
                            return (
                              <button
                                key={item.id}
                                type="button"
                                role="menuitem"
                                className={`navbar-popover-item rich ${isActive ? 'active' : ''}`}
                                onClick={() => navigateTo(item.id)}
                              >
                                <span className="navbar-popover-icon">
                                  <Icon size={16} />
                                </span>
                                <span className="navbar-popover-text">
                                  <span className="navbar-popover-title">{item.label}</span>
                                  <span className="navbar-popover-desc">{item.desc}</span>
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {isDocente && (
                <>
                  <button
                    type="button"
                    className={`nav-tab-btn ${activeTab === 'disponibilidad' ? 'active' : ''}`}
                    onClick={() => navigateTo('disponibilidad')}
                    title="Disponibilidad"
                  >
                    <CalendarDays size={17} />
                    <span>Disponibilidad</span>
                  </button>

                  <button
                    type="button"
                    className={`nav-tab-btn ${activeTab === 'mis_cursos' ? 'active' : ''}`}
                    onClick={() => navigateTo('mis_cursos')}
                    title="Mis cursos asignados"
                  >
                    <BookOpen size={17} />
                    <span>Mis cursos</span>
                  </button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>
    </>
  )
}
