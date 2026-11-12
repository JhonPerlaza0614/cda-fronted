import React from 'react'
import { GraduationCap, BookOpen, Library, Layers, LogOut, Users, Home, UserCircle, CalendarDays, UserCheck, CalendarCheck, Link2, ScrollText } from 'lucide-react'

export default function Navbar({ activeTab, setActiveTab, isConnected, user, onLogout }) {
  const rol = Number(user?.rol ?? 1) // 1: Admin, 2: Coordinador, 3: Docente
  const isAdmin = rol === 1
  const isCoordinador = rol === 2
  const isDocente = rol === 3

  const canSeePensum = isAdmin || isCoordinador
  const canSeeProgramas = isAdmin || isCoordinador
  const canSeeAsignaturas = isAdmin
  const canSeeProgramasCoordinadores = isAdmin
  const canSeeAsignacionDocente = isCoordinador || isAdmin
  const canSeePlantilla = isAdmin
  const canSeeAsociaciones = isAdmin
  const canSeePeriodos = isAdmin
  const canSeeProgramacion = isAdmin || isCoordinador
  const canSeeBitacora = isAdmin

  const rolLabel = rol === 1
    ? 'Administrador'
    : (rol === 2 ? 'Coordinador' : (rol === 3 ? 'Docente' : (user?.rolNombre || 'Usuario')))

  const isHomeActive = activeTab === 'inicio' || activeTab === 'docente_portal' || activeTab === 'coordinador_portal'

  const handleBrandClick = () => {
    setActiveTab('inicio')
  }

  return (
    <header className="navbar">
      {/* Nivel superior: Identidad institucional y Perfil / Acciones */}
      <div className="navbar-top-bar">
        <div className="navbar-top-container">
          <div className="navbar-brand" onClick={handleBrandClick} title="Coordinación y Dirección Académica">
            <div className="brand-icon-bg">
              <GraduationCap size={24} className="brand-icon" />
            </div>
            <div className="brand-text">
              <span className="brand-title">Coordinación y Dirección Académica</span>
              <span className="brand-subtitle">Pensum Académico Universitario</span>
            </div>
          </div>

          <div className="navbar-actions">
            {user && (
              <div className="navbar-user-group">
                <button
                  type="button"
                  className={`navbar-user-card ${activeTab === 'mi-perfil' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mi-perfil')}
                  title="Ver Mi Perfil"
                >
                  <div className="navbar-user">
                    <span className="navbar-user-name">{user.nombre} {user.apellido}</span>
                    <span className="navbar-user-role">{rolLabel}</span>
                  </div>
                </button>
                <button
                  type="button"
                  className={`navbar-profile-btn ${activeTab === 'mi-perfil' ? 'active' : ''}`}
                  onClick={() => setActiveTab('mi-perfil')}
                  title="Acceder a Mi Perfil"
                >
                  <UserCircle size={17} />
                  <span>Mi perfil</span>
                </button>
              </div>
            )}
            <div className={`status-pill ${isConnected ? 'online' : 'offline'}`} title="Estado de Conexión">
              <span className="status-dot"></span>
              <span>{isConnected ? 'Conectado' : 'Sin Conexión'}</span>
            </div>
            {onLogout && (
              <button type="button" className="navbar-logout-btn" onClick={onLogout} title="Cerrar sesión">
                <LogOut size={16} />
                <span>Cerrar sesión</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Nivel inferior: Apartados de Navegación grandes y cómodos */}
      <div className="navbar-nav-bar">
        <div className="navbar-nav-container">
          <nav className="navbar-links">
            <button
              className={`nav-tab-btn ${isHomeActive ? 'active' : ''}`}
              onClick={() => setActiveTab('inicio')}
              title="Inicio"
            >
              <Home size={18} />
              <span>Inicio</span>
            </button>

            

            {canSeeProgramas && (
              <button
                className={`nav-tab-btn ${activeTab === 'programas' ? 'active' : ''}`}
                onClick={() => setActiveTab('programas')}
                title="Programas (Carreras)"
              >
                <BookOpen size={18} />
                <span>Programas (Carreras)</span>
              </button>
            )}

            {canSeeAsignacionDocente && (
              <button
                className={`nav-tab-btn ${activeTab === 'asignacion_docente' ? 'active' : ''}`}
                onClick={() => setActiveTab('asignacion_docente')}
                title="Asignación y Designación Docente"
              >
                <CalendarCheck size={18} />
                <span>Asignación Docente</span>
              </button>
            )}

            {/* HU-037 */}
            {canSeeProgramasCoordinadores && (
              <button
                className={`nav-tab-btn ${activeTab === 'programas_coordinadores' ? 'active' : ''}`}
                onClick={() => setActiveTab('programas_coordinadores')}
                title="Coordinación de programas"
              >
                <UserCheck size={18} />
                <span>Coordinación de programas</span>
              </button>
            )}

            {canSeeAsignaturas && (
              <button
                className={`nav-tab-btn ${activeTab === 'asignaturas' ? 'active' : ''}`}
                onClick={() => setActiveTab('asignaturas')}
                title="Banco de Asignaturas"
              >
                <Library size={18} />
                <span>Banco de Asignaturas</span>
              </button>
            )}

            {canSeePlantilla && (
              <button
                className={`nav-tab-btn ${activeTab === 'plantilla' ? 'active' : ''}`}
                onClick={() => setActiveTab('plantilla')}
                title="Plantilla"
              >
                <Users size={18} />
                <span>Plantilla</span>
              </button>
            )}

            {canSeeAsociaciones && (
              <button
                className={`nav-tab-btn ${activeTab === 'asociaciones' ? 'active' : ''}`}
                onClick={() => setActiveTab('asociaciones')}
                title="Asociaciones docentes"
              >
                <Link2 size={18} />
                <span>Asociaciones docentes</span>
              </button>
            )}

            {canSeePeriodos && (
              <button
                className={`nav-tab-btn ${activeTab === 'periodos' ? 'active' : ''}`}
                onClick={() => setActiveTab('periodos')}
                title="Períodos académicos"
              >
                <CalendarDays size={18} />
                <span>Períodos académicos</span>
              </button>
            )}

            {canSeeProgramacion && (
              <button
                className={`nav-tab-btn ${activeTab === 'programacion_cohortes' ? 'active' : ''}`}
                onClick={() => setActiveTab('programacion_cohortes')}
                title={isCoordinador ? 'Cupos de estudiantes' : 'Programación y Cohortes'}
              >
                <CalendarCheck size={18} />
                <span>{isCoordinador ? 'Cupos de estudiantes' : 'Programación y Cohortes'}</span>
              </button>
            )}

            {/* HU-058: bitácora, solo administrador */}
            {canSeeBitacora && (
              <button
                className={`nav-tab-btn ${activeTab === 'bitacora' ? 'active' : ''}`}
                onClick={() => setActiveTab('bitacora')}
                title="Bitácora"
              >
                <ScrollText size={18} />
                <span>Bitácora</span>
              </button>
            )}

            {isDocente && (
              <button
                className={`nav-tab-btn ${activeTab === 'disponibilidad' ? 'active' : ''}`}
                onClick={() => setActiveTab('disponibilidad')}
                title="Disponibilidad"
              >
                <CalendarDays size={18} />
                <span>Disponibilidad</span>
              </button>
            )}

            
          </nav>
        </div>
      </div>
    </header>
  )
}
