import React from 'react'
import {
  Sparkles,
  ShieldCheck,
  BookOpen,
  Layers,
  LogOut,
  GraduationCap,
  CalendarDays,
  Users,
  UserCheck,
  UserCircle,
  Library
} from 'lucide-react'

export default function DedicatedInProgressView({ user, coordinadorPerfil, onNavigate, onLogout }) {
  const rol = Number(user?.rol ?? 1)
  const isAdmin = rol === 1
  const isCoordinador = rol === 2
  const isDocente = rol === 3

  const roleTitle = isAdmin
    ? 'Administrador'
    : isCoordinador
      ? 'Coordinador(a) de Programa'
      : isDocente
        ? 'Docente'
        : (user?.rolNombre || 'Usuario Institucional')

  const programaAsignado = coordinadorPerfil?.code_program
    ? `${coordinadorPerfil.code_program}${coordinadorPerfil.name_program ? ` — ${coordinadorPerfil.name_program}` : ''}`
    : null

  return (
    <div className="dedicated-progress-wrapper">
      <div className="dedicated-progress-card">
        {/* Encabezado de bienvenida institucional */}
        <div className="dedicated-progress-header">
          <div className="dedicated-progress-badge">
            <Sparkles size={16} className="text-univalle" />
            <span>Universidad del Valle — Sede Palmira</span>
          </div>

          <div className="dedicated-icon-halo">
            <GraduationCap size={44} className="dedicated-main-icon" />
          </div>

          <h1 className="dedicated-progress-title">
            Bienvenido a CDA
          </h1>

          <p className="dedicated-progress-subtitle">
            {isAdmin && (
              <>
                Hola, <strong>{user?.nombre} {user?.apellido}</strong>. Has ingresado como <strong>Administrador</strong> al sistema de Gestión Académica y Curricular.
              </>
            )}
            {isCoordinador && (
              <>
                Hola, <strong>{user?.nombre} {user?.apellido}</strong>. Has ingresado como <strong>Coordinador(a) de Programa</strong>
                {programaAsignado ? <> asignado(a) a <strong>{programaAsignado}</strong></> : ''}.
              </>
            )}
            {isDocente && (
              <>
                Hola, <strong>{user?.nombre} {user?.apellido}</strong>. Has ingresado como <strong>Docente</strong> al sistema de Gestión Académica y Disponibilidad Horaria.
              </>
            )}
            {!isAdmin && !isCoordinador && !isDocente && (
              <>
                Hola, <strong>{user?.nombre} {user?.apellido}</strong>. Tu cuenta institucional ha sido verificada.
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
          {isCoordinador && (
            <div className="summary-item">
              <span className="summary-label">Malla / Programa Asignado</span>
              <span className="summary-value" style={{ fontWeight: 600 }}>
                {programaAsignado || 'Sin programa asignado'}
              </span>
            </div>
          )}
          <div className="summary-item">
            <span className="summary-label">Estado de la Cuenta</span>
            <span className="summary-value status-active">
              <ShieldCheck size={16} /> Verificada y Activa
            </span>
          </div>
        </div>

        {/* Sección de módulos según el rol */}
        <div className="dedicated-features-preview">
          <h3 className="preview-heading">
            <Sparkles size={18} className="text-warning" />
            Módulos disponibles en tu cuenta
          </h3>
          <div className="preview-grid">
            {isAdmin && (
              <>
                <div className="preview-card" onClick={() => onNavigate?.('pensum')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">🎓</div>
                  <h4>Mallas Curriculares</h4>
                  <p>Estructura, edita y consulta el pensum y las resoluciones de cada programa académico.</p>
                </div>
                <div className="preview-card" onClick={() => onNavigate?.('programas')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">🏛️</div>
                  <h4>Programas y Coordinación</h4>
                  <p>Administra las carreras de la sede y asigna sus respectivos coordinadores.</p>
                </div>
                <div className="preview-card" onClick={() => onNavigate?.('periodos')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">📅</div>
                  <h4>Períodos y Plantilla</h4>
                  <p>Configura fechas de calendario académico, plazos docentes y plantilla institucional.</p>
                </div>
              </>
            )}

            {isCoordinador && (
              <>
                <div className="preview-card" onClick={() => onNavigate?.('pensum')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">🎓</div>
                  <h4>Malla de tu Programa</h4>
                  <p>
                    {programaAsignado
                      ? `Consulta y gestiona el pensum curricular de ${programaAsignado}.`
                      : 'Consulta la malla curricular del programa asignado a tu coordinación.'}
                  </p>
                </div>
                <div className="preview-card" onClick={() => onNavigate?.('asignaturas')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">📚</div>
                  <h4>Banco de Asignaturas</h4>
                  <p>Explora el catálogo de asignaturas, créditos y horas académicas.</p>
                </div>
                <div className="preview-card" onClick={() => onNavigate?.('mi-perfil')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">👤</div>
                  <h4>Mi Perfil</h4>
                  <p>Revisa tu información institucional y los datos de tu coordinación.</p>
                </div>
              </>
            )}

            {isDocente && (
              <>
                <div className="preview-card" onClick={() => onNavigate?.('disponibilidad')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">📅</div>
                  <h4>Disponibilidad Horaria</h4>
                  <p>Registra y actualiza tus bloques de disponibilidad para el período académico activo.</p>
                </div>
                <div className="preview-card" onClick={() => onNavigate?.('mi-perfil')} style={{ cursor: 'pointer' }}>
                  <div className="preview-card-icon">👤</div>
                  <h4>Mi Perfil Docente</h4>
                  <p>Consulta tu categoría, tipo de vinculación y actualiza tus datos de contacto y foto.</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Acciones rápidas */}
        <div className="dedicated-actions-footer">
          {isAdmin && onNavigate && (
            <div className="coordinador-quick-actions">
              <span className="quick-actions-hint">Accesos rápidos:</span>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => onNavigate('pensum')}
              >
                <Layers size={16} /> Ir a Malla Curricular
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onNavigate('programas')}
              >
                <BookOpen size={16} /> Programas
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onNavigate('periodos')}
              >
                <CalendarDays size={16} /> Períodos Académicos
              </button>
            </div>
          )}

          {isCoordinador && onNavigate && (
            <div className="coordinador-quick-actions">
              <span className="quick-actions-hint">Accesos rápidos:</span>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => onNavigate('pensum')}
              >
                <Layers size={16} /> Ver Mi Malla Curricular
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onNavigate('asignaturas')}
              >
                <Library size={16} /> Banco de Asignaturas
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onNavigate('mi-perfil')}
              >
                <UserCircle size={16} /> Mi Perfil
              </button>
            </div>
          )}

          {isDocente && onNavigate && (
            <div className="coordinador-quick-actions">
              <span className="quick-actions-hint">Accesos rápidos:</span>
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => onNavigate('disponibilidad')}
              >
                <CalendarDays size={16} /> Registrar disponibilidad
              </button>
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={() => onNavigate('mi-perfil')}
              >
                <UserCircle size={16} /> Mi Perfil
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
