import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Search, UserCheck, UserPlus, AlertCircle, RefreshCw, BookOpen } from 'lucide-react'
import { getProgramasConCoordinador } from '../services/academicService'

// HU-037: ver programas académicos y sus coordinadores (solo administrador)
const JORNADAS = { DIURNA: 'Diurna', NOCTURNA: 'Nocturna', AMBAS: 'Diurna y nocturna' }

export default function ProgramasCoordinadoresView({ onGestionarCoordinador }) {
  const [busqueda, setBusqueda] = useState('')
  const [sinCoordinador, setSinCoordinador] = useState(false)
  const [programas, setProgramas] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

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
                      <button className="btn-secondary btn-sm" onClick={() => onGestionarCoordinador(p.code_program)}>
                        <UserCheck size={14} /> Cambiar coordinador
                      </button>
                    ) : (
                      <button className="btn-primary btn-sm" onClick={() => onGestionarCoordinador(p.code_program)}>
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
    </div>
  )
}
