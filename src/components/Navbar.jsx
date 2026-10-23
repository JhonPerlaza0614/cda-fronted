import React from 'react'
import { GraduationCap, BookOpen, Library, Layers, Users, UserPlus, UserCircle, LogOut } from 'lucide-react'

export default function Navbar({ activeTab, setActiveTab, isConnected, user, onLogout, esAdmin }) {
  const rol = user?.rol ?? 1
  const canSeePensum = rol === 1 || rol === 2
  const canSeeProgramas = rol === 1
  const canSeeAsignaturas = rol === 1 || rol === 2
  const canSeeCoordinadores = rol === 1
  const canSeeDocentes = rol === 1 || rol === 2
  const isDocente = rol === 3

  const handleBrandClick = () => {
    if (isDocente) setActiveTab('docente_portal')
    else if (canSeePensum) setActiveTab('pensum')
    else setActiveTab('plantilla')
  }

  const Tab = ({ id, icon: Icon, label }) => (
    <button
      className={`nav-tab-btn ${activeTab === id ? 'active' : ''}`}
      onClick={() => setActiveTab(id)}
    >
      <Icon size={18} />
      <span>{label}</span>
    </button>
  )

  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={handleBrandClick}>
          <div className="brand-icon-bg">
            <GraduationCap size={24} className="brand-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-title">Gestión de Mallas Curriculares</span>
            <span className="brand-subtitle">Pensum Académico Universitario</span>
          </div>
        </div>

        <nav className="navbar-links">
          {canSeePensum && <Tab id="pensum" icon={Layers} label="Malla Curricular" />}
          {canSeeProgramas && <Tab id="programas" icon={BookOpen} label="Programas (Carreras)" />}
          {canSeeAsignaturas && <Tab id="asignaturas" icon={Library} label="Banco de Asignaturas" />}
          {canSeeCoordinadores && <Tab id="coordinadores" icon={Users} label="Coordinadores" />}
          {canSeeDocentes && <Tab id="docentes" icon={UserPlus} label="Docentes" />}
          <Tab id="mi-perfil" icon={UserCircle} label="Mi perfil" />
        </nav>

        <div className="navbar-actions">
          <div className={`status-pill ${isConnected ? 'online' : 'offline'}`} title="Estado de Supabase">
            <span className="status-dot"></span>
            <span>{isConnected ? 'Supabase Conectado' : 'Sin Conexión'}</span>
          </div>
          {onLogout && (
            <button className="nav-tab-btn" onClick={onLogout}>
              <LogOut size={18} />
              <span>Salir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}