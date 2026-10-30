import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, UserCheck, UserPlus, AlertCircle, RefreshCw, BookOpen, X } from 'lucide-react'
import { getProgramasConCoordinador, getCoordinadores, updatePrograma } from '../../services/academicService'

// HU-037: ver programas académicos y sus coordinadores (solo administrador)
const JORNADAS = { DIURNA: 'Diurna', NOCTURNA: 'Nocturna', AMBAS: 'Diurna y nocturna' }

export default function ProgramasCoordinadoresView({ onShowToast, onRefresh }) {
  const [busqueda, setBusqueda] = useState('')
  const [sinCoordinador, setSinCoordinador] = useState(false)
  const [programas, setProgramas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  // Modal de asignación directa de coordinador
  const [programaSeleccionado, setProgramaSeleccionado] = useState(null)
  const [coordinadores, setCoordinadores] = useState([])
  const [loadingCoordinadores, setLoadingCoordinadores] = useState(false)
  const [selectedCoordId, setSelectedCoordId] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Evita que una respuesta lenta pise a una búsqueda más reciente
  const loadSeq = useRef(0)

  const cargar = useCallback(async (q, soloSin) => {
    const seq = ++loadSeq.current
    setLoading(true)
    setError(false)
    try {
      const data = await getProgramasConCoordinador({ q, sinCoordinador: soloSin })
      if (seq !== loadSeq.current) return
      setProgramas(Array.isArray(data) ? data : [])
    } catch (err) {
      if (seq !== loadSeq.current) return
      console.error('Error al cargar programas y coordinadores:', err)
      setError(true)
    } finally {
      if (seq === loadSeq.current) setLoading(false)
    }
  }, [])

  // Criterio 2: la búsqueda va al servidor; se espera a que el usuario deje de escribir
  useEffect(() => {
    const t = setTimeout(() => cargar(busqueda, sinCoordinador), 300)
    return () => clearTimeout(t)
  }, [busqueda, sinCoordinador, cargar])

  const abrirModalCoordinador = async (prog) => {
    setProgramaSeleccionado(prog)
    const actualId = prog.coordinador?.id != null ? String(prog.coordinador.id) : ''
    setSelectedCoordId(actualId)
    setCoordinadores([])
    setLoadingCoordinadores(true)

    try {
      const data = await getCoordinadores()
      const lista = Array.isArray(data) ? data.filter(c => c.activo !== false) : []
      setCoordinadores(lista)
      if (!actualId) {
        const match = lista.find(c => String(c.code_program || '') === String(prog.code_program))
        if (match?.id != null) setSelectedCoordId(String(match.id))
      }
    } catch (err) {
      console.error('Error al cargar coordinadores:', err)
      onShowToast?.(`No se pudo cargar la lista de coordinadores: ${err.message || 'Error desconocido'}`, 'error')
    } finally {
      setLoadingCoordinadores(false)
    }
  }

  const cerrarModalCoordinador = () => {
    if (submitting) return
    setProgramaSeleccionado(null)
    setSelectedCoordId('')
  }

  const handleGuardarAsignacion = async (e) => {
    e.preventDefault()
    if (!programaSeleccionado || !selectedCoordId) {
      onShowToast?.('Selecciona un coordinador de la lista', 'error')
      return
    }

    setSubmitting(true)
    try {
      await updatePrograma(programaSeleccionado.code_program, {
        id_coordinador_nuevo: parseInt(selectedCoordId, 10)
      })
      onShowToast?.(`Coordinador asignado a ${programaSeleccionado.name_program}`, 'success')
      setProgramaSeleccionado(null)
      setSelectedCoordId('')
      await cargar(busqueda, sinCoordinador)
      onRefresh?.()
    } catch (err) {
      onShowToast?.(`Error al asignar coordinador: ${err.message || 'No se pudo guardar'}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const formatProgramaLabel = (coord) => {
    if (coord.name_program) return coord.name_program
    if (coord.code_program) {
      const match = programas.find(p => p.code_program === coord.code_program)
      return match?.name_program || coord.code_program
    }
    return 'no asignado'
  }

  const hayFiltros = busqueda.trim() !== '' || sinCoordinador

  return (
    <div className="section-container">
      <div className="section-header">
        <div>
          <h1 className="section-title">Programas y coordinadores</h1>
          <p className="section-description">
            Consulta qué programas académicos tienen coordinador y gestiona su asignación.
          </p>
        </div>
      </div>

      <div className="control-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por programa o coordinador..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            aria-label="Buscar por programa o coordinador"
          />
        </div>
        <label className="prog-coord-filter">
          <input
            type="checkbox"
            checked={sinCoordinador}
            onChange={(e) => setSinCoordinador(e.target.checked)}
          />
          <span>Sin coordinador</span>
        </label>
      </div>

      {error ? (
        // Criterio 5
        <div className="empty-state-card">
          <AlertCircle size={48} className="empty-icon" />
          <h3>No se pudo cargar</h3>
          <button className="btn-primary" onClick={() => cargar(busqueda, sinCoordinador)}>
            <RefreshCw size={16} /> Reintentar
          </button>
        </div>
      ) : loading && programas.length === 0 ? (
        <div className="loading-state-container">
          <div className="spinner"></div>
          <p>Cargando programas...</p>
        </div>
      ) : programas.length === 0 ? (
        // Criterio 4
        <div className="empty-state-card">
          <BookOpen size={48} className="empty-icon" />
          <h3>{hayFiltros ? 'Sin resultados' : 'No hay programas registrados'}</h3>
        </div>
      ) : (
        <div className={`prog-coord-table-wrap${loading ? ' is-loading' : ''}`}>
          <table className="prog-coord-table">
            <thead>
              <tr>
                <th>Código</th>
                <th>Programa</th>
                <th>Jornada</th>
                <th>Coordinador</th>
                <th><span className="sr-only">Acción</span></th>
              </tr>
            </thead>
            <tbody>
              {programas.map((p) => (
                <tr key={p.code_program}>
                  <td data-label="Código"><span className="badge-code">{p.code_program}</span></td>
                  <td data-label="Programa">{p.name_program}</td>
                  <td data-label="Jornada">{JORNADAS[p.jornada] || p.jornada}</td>
                  {/* Criterio 1 */}
                  <td data-label="Coordinador">
                    {p.tiene_coordinador && p.coordinador ? (
                      <div className="prog-coord-person">
                        <span>{p.coordinador.nombre_completo}</span>
                        <span className="prog-coord-email">{p.coordinador.correo_institucional}</span>
                      </div>
                    ) : (
                      <span className="badge-inactive">Sin coordinador</span>
                    )}
                  </td>
                  {/* Criterio 3 */}
                  <td className="prog-coord-action">
                    {p.tiene_coordinador ? (
                      <button className="btn-secondary btn-sm" onClick={() => abrirModalCoordinador(p)}>
                        <UserCheck size={14} /> Cambiar coordinador
                      </button>
                    ) : (
                      <button className="btn-primary btn-sm" onClick={() => abrirModalCoordinador(p)}>
                        <UserPlus size={14} /> Asignar coordinador
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal para seleccionar directamente al coordinador */}
      {programaSeleccionado && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <div>
                <h2 style={{ margin: 0 }}>
                  {programaSeleccionado.tiene_coordinador ? 'Cambiar coordinador' : 'Asignar coordinador'}
                </h2>
                <small style={{ color: '#64748b' }}>
                  {programaSeleccionado.code_program} — {programaSeleccionado.name_program}
                </small>
              </div>
              <button className="modal-close-btn" onClick={cerrarModalCoordinador} disabled={submitting}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleGuardarAsignacion}>
              <div className="modal-body">
                {loadingCoordinadores ? (
                  <div className="loading-state-container" style={{ padding: '1.5rem 0' }}>
                    <div className="spinner"></div>
                    <p>Cargando lista de coordinadores...</p>
                  </div>
                ) : coordinadores.length === 0 ? (
                  <p style={{ color: '#64748b', margin: 0 }}>
                    No hay coordinadores activos registrados en la plantilla.
                  </p>
                ) : (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="select-coord-programa">Selecciona un coordinador *</label>
                    <select
                      id="select-coord-programa"
                      className="select-input"
                      value={selectedCoordId}
                      onChange={(e) => setSelectedCoordId(e.target.value)}
                      required
                    >
                      <option value="">-- Seleccionar coordinador --</option>
                      {coordinadores.map((c) => (
                        <option key={c.id} value={String(c.id)}>
                          {c.nombre_completo} ({formatProgramaLabel(c)})
                        </option>
                      ))}
                    </select>
                    <small className="form-hint" style={{ marginTop: '0.5rem', display: 'block' }}>
                      Entre paréntesis se muestra si el coordinador no está asignado o el nombre del programa que coordina actualmente.
                    </small>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={cerrarModalCoordinador}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || loadingCoordinadores || !selectedCoordId}
                >
                  {submitting ? 'Guardando...' : 'Guardar asignación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
