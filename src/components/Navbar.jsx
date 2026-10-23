import React from 'react'

import { GraduationCap, BookOpen, Library, Layers, LogOut, UserPlus, UserCircle } from 'lucide-react'


export default function Navbar({ activeTab, setActiveTab, isConnected, user, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar-container">
        <div className="navbar-brand" onClick={() => setActiveTab('pensum')}>
          <div className="brand-icon-bg">
            <GraduationCap size={24} className="brand-icon" />
          </div>
          <div className="brand-text">
            <span className="brand-title">Gestión de Mallas Curriculares</span>
            <span className="brand-subtitle">Pensum Académico Universitario</span>
          </div>
        </div>

        <nav className="navbar-links">
          <button
            className={`nav-tab-btn ${activeTab === 'pensum' ? 'active' : ''}`}
            onClick={() => setActiveTab('pensum')}
          >
            <Layers size={18} />
            <span>Malla Curricular</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'programas' ? 'active' : ''}`}
            onClick={() => setActiveTab('programas')}
          >
            <BookOpen size={18} />
            <span>Programas (Carreras)</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'asignaturas' ? 'active' : ''}`}
            onClick={() => setActiveTab('asignaturas')}
          >
            <Library size={18} />
            <span>Banco de Asignaturas</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'coordinadores' ? 'active' : ''}`}
            onClick={() => setActiveTab('coordinadores')}
          >
            <Users size={18} />
            <span>Coordinadores</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'docentes' ? 'active' : ''}`}
            onClick={() => setActiveTab('docentes')}
          >
            <UserPlus size={18} />
            <span>Docentes</span>
          </button>

          <button
            className={`nav-tab-btn ${activeTab === 'mi-perfil' ? 'active' : ''}`}
            onClick={() => setActiveTab('mi-perfil')}
          >
            <UserCircle size={18} />
            <span>Mi perfil</span>
          </button>
        </nav>

        <div className="navbar-actions">
          {user && (
            <div className="navbar-user" title={user.email || ''}>
              <span className="navbar-user-name">{user.nombre} {user.apellido}</span>
              <span className="navbar-user-role">{user.rolNombre || 'Docente'}</span>
            </div>
          )}
          <div className={`status-pill ${isConnected ? 'online' : 'offline'}`} title="Estado de Supabase">
            <span className="status-dot"></span>
            <span>{isConnected ? 'Supabase Conectado' : 'Sin Conexión'}</span>
          </div>
          {onLogout && (
            <button type="button" className="navbar-logout-btn" onClick={onLogout} title="Cerrar sesión">
              <LogOut size={16} />
              <span>Salir</span>
            </button>
          )}
        </div>
      </div>
    </header>
  )
}