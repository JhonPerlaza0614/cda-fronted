import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  ClipboardList,
  Download,
  FileSpreadsheet,
  Mail,
  RefreshCw,
  Search,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import {
  descargarPendientesProgramacion,
  getAvanceProgramacion,
} from '../../services/programacionService'
import { formatearFechaHora } from '../../utils/formatoFechas'
import './AvanceProgramacionView.css'

export default function AvanceProgramacionView({ periodoId, onShowToast }) {
  const [avance, setAvance] = useState(null)
  const [loading, setLoading] = useState(false)
  const [descargando, setDescargando] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  const cargarAvance = useCallback(async () => {
    if (!periodoId) {
      setAvance(null)
      setError('')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      const data = await getAvanceProgramacion(periodoId)
      setAvance(data)
    } catch (err) {
      setAvance(null)
      setError(err.message || 'No se pudo consultar el avance de la programación')
    } finally {
      setLoading(false)
    }
  }, [periodoId])

  useEffect(() => {
    cargarAvance()
  }, [cargarAvance])

  const docentesFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLowerCase()
    const docentes = avance?.docentesSinDisponibilidad || []
    if (!termino) return docentes
    return docentes.filter((docente) => [
      docente.codigo,
      docente.nombreCompleto,
      docente.correoInstitucional,
      docente.facultad,
      docente.programa,
    ].some((valor) => String(valor || '').toLowerCase().includes(termino)))
  }, [avance, busqueda])

  const handleDescargar = async () => {
    if (!periodoId || descargando) return
    setDescargando(true)
    try {
      const { blob, filename } = await descargarPendientesProgramacion(periodoId)
      const url = URL.createObjectURL(blob)
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = filename || `avance-programacion-${periodoId}.xlsx`
      enlace.style.display = 'none'
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 0)
      onShowToast?.('Excel de pendientes generado correctamente', 'success')
    } catch (err) {
      onShowToast?.(err.message || 'No se pudo descargar el Excel de pendientes', 'error')
    } finally {
      setDescargando(false)
    }
  }

  if (!periodoId) {
    return (
      <div className="pc-tab-content">
        <div className="ap-empty">
          <CalendarDays size={34} />
          <h3>Seleccione un período académico</h3>
          <p>El tablero mostrará el avance de la programación del período seleccionado.</p>
        </div>
      </div>
    )
  }

  if (loading && !avance) {
    return (
      <div className="pc-tab-content">
        <div className="ap-empty">
          <RefreshCw size={30} className="pc-spin" />
          <h3>Consultando el avance del período...</h3>
        </div>
      </div>
    )
  }

  if (error && !avance) {
    return (
      <div className="pc-tab-content">
        <div className="ap-empty ap-empty-error">
          <AlertTriangle size={34} />
          <h3>No se pudo cargar el tablero</h3>
          <p>{error}</p>
          <button type="button" className="pc-btn pc-btn-primary" onClick={cargarAvance}>
            <RefreshCw size={16} />
            <span>Reintentar</span>
          </button>
        </div>
      </div>
    )
  }

  if (!avance) return null

  const ventanas = avance.periodo?.ventanas
  const totales = avance.totales || {}
  const programas = avance.programas || []
  const docentesSinDisponibilidad = avance.docentesSinDisponibilidad || []

  const kpis = [
    { label: 'Cursos generados', value: totales.generados, icon: ClipboardList, tone: 'blue' },
    { label: 'Con docente asignado', value: totales.conDocente, icon: UserCheck, tone: 'green' },
    { label: 'Pendientes de asignación', value: totales.pendientesAsignacion, icon: Users, tone: 'amber' },
    { label: 'Pendientes de contratación', value: totales.pendientesContratacion, icon: UserPlus, tone: 'red' },
    { label: 'Docentes sin disponibilidad', value: totales.docentesSinDisponibilidad, icon: Mail, tone: 'violet' },
  ]

  const ventanaDocente = {
    titulo: 'Ventana de disponibilidad docente',
    inicio: ventanas?.docenteInicio,
    fin: ventanas?.docenteFin,
    abierta: ventanas?.docenteAbierta,
  }
  const ventanaCoordinador = {
    titulo: 'Ventana de asignación de docentes',
    inicio: ventanas?.coordinadorInicio,
    fin: ventanas?.coordinadorFin,
    abierta: ventanas?.coordinadorAbierta,
  }

  return (
    <div className="pc-tab-content ap-avance">
      <div className="ap-header">
        <div>
          <div className="ap-title-row">
            <h3 className="ap-title">Avance de la programación del período</h3>
            <span className="pc-badge pc-badge-blue">{avance.periodo?.estado || 'SIN ESTADO'}</span>
          </div>
          <p className="ap-subtitle">
            {avance.periodo?.nombre} · Información generada el {formatearFechaHora(avance.generadoEn)}
          </p>
        </div>
        <div className="ap-actions">
          <button type="button" className="pc-btn pc-btn-secondary" onClick={cargarAvance} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'pc-spin' : ''} />
            <span>Actualizar</span>
          </button>
          <button
            type="button"
            className="pc-btn pc-btn-primary"
            onClick={handleDescargar}
            disabled={descargando || loading}
          >
            {descargando ? <RefreshCw size={16} className="pc-spin" /> : <Download size={16} />}
            <span>{descargando ? 'Generando Excel...' : 'Descargar pendientes'}</span>
          </button>
        </div>
      </div>

      <div className="ap-windows-grid">
        {[ventanaDocente, ventanaCoordinador].map((ventana) => (
          <div key={ventana.titulo} className={`ap-window-card ${ventana.abierta ? 'abierta' : 'cerrada'}`}>
            <div className="ap-window-heading">
              <CalendarDays size={20} />
              <span>{ventana.titulo}</span>
            </div>
            <div className="ap-window-date">
              <span>Cierre</span>
              <strong>{formatearFechaHora(ventana.fin)}</strong>
            </div>
            <div className="ap-window-footer">
              <span className={`pc-badge ${ventana.fin ? (ventana.abierta ? 'pc-badge-success' : 'pc-badge-neutral') : 'pc-badge-neutral'}`}>
                {ventana.fin ? (ventana.abierta ? 'Abierta' : 'Cerrada') : 'No definida'}
              </span>
              <span className="ap-window-inicio">
                Inicio: {formatearFechaHora(ventana.inicio)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="ap-kpis">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className={`ap-kpi ap-kpi-${tone}`}>
            <div className="ap-kpi-icon">
              <Icon size={22} />
            </div>
            <div>
              <span className="ap-kpi-label">{label}</span>
              <strong className="ap-kpi-value">{value ?? 0}</strong>
            </div>
          </div>
        ))}
      </div>

      <div className="pc-panel">
        <div className="ap-section-header">
          <div>
            <h4 className="pc-panel-title">Resumen por programa</h4>
            <p className="pc-panel-desc">
              Los cursos excluidos no se contabilizan como generados ni como pendientes.
            </p>
          </div>
          <span className="ap-count-badge">{programas.length} programas</span>
        </div>

        {programas.length === 0 ? (
          <div className="ap-inline-empty">No hay programas con programación en este período.</div>
        ) : (
          <div className="ap-table-wrapper">
            <table className="pc-table ap-table">
              <thead>
                <tr>
                  <th>Programa</th>
                  <th>Código</th>
                  <th className="ap-num">Generados</th>
                  <th className="ap-num">Con docente</th>
                  <th className="ap-num">Pend. asignación</th>
                  <th className="ap-num">Pend. contratación</th>
                  <th className="ap-num">Excluidos</th>
                </tr>
              </thead>
              <tbody>
                {programas.map((programa) => (
                  <tr key={programa.codeProgram}>
                    <td><strong>{programa.nombrePrograma}</strong></td>
                    <td>{programa.codeProgram}</td>
                    <td className="ap-num">{programa.generados}</td>
                    <td className="ap-num ap-value-green">{programa.conDocente}</td>
                    <td className="ap-num ap-value-amber">{programa.pendientesAsignacion}</td>
                    <td className="ap-num ap-value-red">{programa.pendientesContratacion}</td>
                    <td className="ap-num ap-value-muted">{programa.excluidos}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>Total del período</strong></td>
                  <td className="ap-num"><strong>{totales.generados ?? 0}</strong></td>
                  <td className="ap-num ap-value-green"><strong>{totales.conDocente ?? 0}</strong></td>
                  <td className="ap-num ap-value-amber"><strong>{totales.pendientesAsignacion ?? 0}</strong></td>
                  <td className="ap-num ap-value-red"><strong>{totales.pendientesContratacion ?? 0}</strong></td>
                  <td className="ap-num ap-value-muted"><strong>{totales.excluidos ?? 0}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <div className="pc-panel">
        <div className="ap-section-header">
          <div>
            <h4 className="pc-panel-title">Docentes sin disponibilidad registrada</h4>
            <p className="pc-panel-desc">
              Docentes activos que aún no tienen ninguna franja registrada en este período.
            </p>
          </div>
          <span className="ap-count-badge ap-count-warning">
            {docentesSinDisponibilidad.length} docentes
          </span>
        </div>

        <div className="ap-search">
          <Search size={17} />
          <input
            type="search"
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar por nombre, código, correo, facultad o programa..."
            aria-label="Buscar docentes sin disponibilidad"
          />
        </div>

        {docentesSinDisponibilidad.length === 0 ? (
          <div className="ap-inline-empty ap-inline-success">
            Todos los docentes activos registraron disponibilidad en este período.
          </div>
        ) : docentesFiltrados.length === 0 ? (
          <div className="ap-inline-empty">No hay docentes que coincidan con la búsqueda.</div>
        ) : (
          <div className="ap-table-wrapper">
            <table className="pc-table ap-table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Docente</th>
                  <th>Correo institucional</th>
                  <th>Facultad</th>
                  <th>Programa</th>
                </tr>
              </thead>
              <tbody>
                {docentesFiltrados.map((docente) => (
                  <tr key={docente.id || docente.codigo}>
                    <td><strong>{docente.codigo || '—'}</strong></td>
                    <td>{docente.nombreCompleto}</td>
                    <td>{docente.correoInstitucional || '—'}</td>
                    <td>{docente.facultad || '—'}</td>
                    <td>{docente.programa || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ap-note">
        <FileSpreadsheet size={16} />
        <span>
          El archivo Excel incluye el resumen, los cursos pendientes y los docentes sin disponibilidad.
        </span>
      </div>
    </div>
  )
}
