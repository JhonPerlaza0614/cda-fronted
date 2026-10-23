import React from 'react'
import { 
  Clock, 
  Sparkles, 
  CheckCircle2, 
  ShieldCheck, 
  BookOpen, 
  Layers, 
  LogOut,
  GraduationCap
} from 'lucide-react'

export default function DedicatedInProgressView({ user, onNavigate, onLogout }) {
  const isCoordinador = user?.rol === 2
  const isDocente = user?.rol === 3

  const roleTitle = isCoordinador 
    ? 'Coordinador(a) de Programa' 
    : (isDocente ? 'Docente' : (user?.rolNombre || 'Usuario Institucional'))

  return (
    <div className="dedicated-progress-wrapper">
      <div className="dedicated-progress-card">
        {/* Encabezado con insignia animada */}
        <div className="dedicated-progress-header">
          <div className="dedicated-progress-badge">
            <Clock size={16} className="animate-spin-slow text-univalle" />
            <span>En Desarrollo Activo</span>
          </div>

          <div className="dedicated-icon-halo">
            <GraduationCap size={44} className="dedicated-main-icon" />
          </div>

          {/* MENSAJE LITERAL SOLICITADO */}
          <h1 className="dedicated-progress-title">
            Páginas dedicadas en progreso de creación
          </h1>

          <p className="dedicated-progress-subtitle">
            {isDocente && (
              <>
                Bienvenido(a), <strong>{user?.nombre} {user?.apellido}</strong>. Tu acceso al sistema de Pensum y Gestión Académica de la Universidad del Valle Sede Palmira ha sido habilitado con éxito.
              </>
            )}
            {isCoordinador && (
              <>
                Bienvenido(a), <strong>{user?.nombre} {user?.apellido}</strong>. Tu acceso como Coordinador(a) de Programa ha sido habilitado. Las herramientas de gestión avanzada están en construcción.
              </>
            )}
            {!isDocente && !isCoordinador && (
              <>
                Bienvenido(a), <strong>{user?.nombre} {user?.apellido}</strong>. Tu cuenta institucional ha sido verificada.
              </>
            )}
          </p>
        </div>

        {/* Tarjeta de estado de perfil institucional */}
        <div className="dedicated-user-summary">
          <div className="summary-item">
            <span className="summary-label">Rol en el Sistema</span>
            <span className="summary-value role-badge">{roleTitle}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Correo Institucional</span>
            <span className="summary-value">{user?.email || 'No disponible'}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Estado de la Cuenta</span>
            <span className="summary-value status-active">
              <ShieldCheck size={16} /> Verificada y Activa
            </span>
          </div>
        </div>

        {/* Sección explicativa de próximas funciones */}
        <div className="dedicated-features-preview">
          <h3 className="preview-heading">
            <Sparkles size={18} className="text-warning" />
            ¿Qué estará disponible en tu portal dedicado?
          </h3>
          <div className="preview-grid">
            {isDocente && (
              <>
                <div className="preview-card">
                  <div className="preview-card-icon">📚</div>
                  <h4>Carga y Asignaturas</h4>
                  <p>Consulta tus asignaturas asignadas, horarios semanales y salones de clase.</p>
                </div>
                <div className="preview-card">
                  <div className="preview-card-icon">👥</div>
                  <h4>Listas de Estudiantes</h4>
                  <p>Visualiza y gestiona las listas de estudiantes inscritos en tus cursos.</p>
                </div>
                <div className="preview-card">
                  <div className="preview-card-icon">📄</div>
                  <h4>Microcurrículos</h4>
                  <p>Descarga y consulta los contenidos temáticos y competencias de cada materia.</p>
                </div>
              </>
            )}

            {isCoordinador && (
              <>
                <div className="preview-card">
                  <div className="preview-card-icon">🎓</div>
                  <h4>Gestión de Programa</h4>
                  <p>Administra los períodos académicos, cupos y oferta semestral de tu carrera.</p>
                </div>
                <div className="preview-card">
                  <div className="preview-card-icon">👨‍🏫</div>
                  <h4>Asignación Docente</h4>
                  <p>Distribuye la carga académica entre docentes de planta y hora cátedra.</p>
                </div>
                <div className="preview-card">
                  <div className="preview-card-icon">📊</div>
                  <h4>Reportes de Pensum</h4>
                  <p>Genera informes de avance curricular y cumplimiento de créditos.</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Acciones permitidas actualmente */}
        <div className="dedicated-actions-footer">
          {isCoordinador && onNavigate && (
            <div className="coordinador-quick-actions">
              <span className="quick-actions-hint">Actualmente puedes explorar:</span>
              <button 
                type="button" 
                className="btn-primary btn-sm"
                onClick={() => onNavigate('pensum')}
              >
                <Layers size={16} /> Ver Mallas Curriculares
              </button>
              <button 
                type="button" 
                className="btn-secondary btn-sm"
                onClick={() => onNavigate('asignaturas')}
              >
                <BookOpen size={16} /> Ver Banco de Asignaturas
              </button>
            </div>
          )}

          {onLogout && (
            <button 
              type="button" 
              className="btn-ghost btn-sm"
              onClick={onLogout}
            >
              <LogOut size={16} /> Cerrar Sesión
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
