import React, { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Ban, Filter, RefreshCw, RotateCcw, Search, UserX } from 'lucide-react'
import { excluirCurso, getVistaPreviaExclusion, reactivarCurso } from '../../services/programacionService'
import { formatearFechaHora } from '../../utils/formatoFechas'

const MAX_JUSTIFICACION = 500
const MSG_JUSTIFICACION_OBLIGATORIA = 'La justificación es obligatoria'

/**
 * HU-047: submódulo 3 «Cursos Programados».
 * Consolida los cursos del periodo con filtros, resalta los que requieren revisión y permite excluir
 * (con vista previa de grupos) o reactivar un curso. No hay forma de agregar cursos (criterio 3).
 */
export default function CursosProgramadosPanel({ cursos, programas, onCambio, onShowToast }) {
  const [busqueda, setBusqueda] = useState('')
  const [filtroPrograma, setFiltroPrograma] = useState('')
  const [filtroAsignatura, setFiltroAsignatura] = useState('')
  const [filtroJornada, setFiltroJornada] = useState('')

  // Modal de ajuste: { tipo: 'excluir' | 'reactivar', curso, vistaPrevia }
  const [ajuste, setAjuste] = useState(null)
  const [justificacion, setJustificacion] = useState('')
  const [errorAjuste, setErrorAjuste] = useState(null)
  const [cargandoAjuste, setCargandoAjuste] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [confirmarDocente, setConfirmarDocente] = useState(false)

  const asignaturas = useMemo(() => {
    const mapa = new Map()
    for (const c of cursos) {
      if (!mapa.has(c.codeCourse)) mapa.set(c.codeCourse, c.nombreAsignatura)
    }
    return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'es'))
  }, [cursos])

  const filtrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim()
    return cursos.filter((c) => {
      if (filtroPrograma && c.codeProgram !== filtroPrograma) return false
      if (filtroAsignatura && c.codeCourse !== filtroAsignatura) return false
      if (filtroJornada && c.jornada !== filtroJornada) return false
      if (!q) return true
      return (
        c.codeCourse?.toLowerCase().includes(q) ||
        c.codigoCurso?.toLowerCase().includes(q) ||
        c.nombreAsignatura?.toLowerCase().includes(q) ||
        c.nombrePrograma?.toLowerCase().includes(q)
      )
    })
  }, [cursos, busqueda, filtroPrograma, filtroAsignatura, filtroJornada])

  const totalRevision = cursos.filter((c) => c.requiereRevision).length
  const totalExcluidos = cursos.filter((c) => c.estado === 'EXCLUIDO').length

  const cerrarAjuste = () => {
    setAjuste(null)
    setJustificacion('')
    setErrorAjuste(null)
    setConfirmarDocente(false)
  }

  const abrirExclusion = async (curso) => {
    setAjuste({ tipo: 'excluir', curso, vistaPrevia: null })
    setJustificacion('')
    setErrorAjuste(null)
    setCargandoAjuste(true)
    try {
      const vistaPrevia = await getVistaPreviaExclusion(curso.id)
      setAjuste({ tipo: 'excluir', curso, vistaPrevia })
    } catch (err) {
      setErrorAjuste(err.message || 'No se pudo cargar la vista previa')
    } finally {
      setCargandoAjuste(false)
    }
  }

  const abrirReactivacion = (curso) => {
    const activos = cursos.filter(
      (c) => c.codeCourse === curso.codeCourse && c.estado !== 'EXCLUIDO' && c.grupo != null,
    )
    const siguiente = activos.length ? Math.max(...activos.map((c) => c.grupo)) + 1 : 50
    setAjuste({ tipo: 'reactivar', curso, grupoEstimado: siguiente })
    setJustificacion('')
    setErrorAjuste(null)
  }

  const validar = () => {
    const texto = justificacion.trim()
    if (!texto) {
      setErrorAjuste(MSG_JUSTIFICACION_OBLIGATORIA)
      return null
    }
    return texto
  }

  const confirmar = () => {
    const texto = validar()
    if (!texto) return
    // Si el curso tiene docente, se avisa antes de quitar la asignación (decisión 2026-11-06).
    if (ajuste.tipo === 'excluir' && ajuste.vistaPrevia?.tieneDocente && !confirmarDocente) {
      setConfirmarDocente(true)
      return
    }
    aplicar(texto)
  }

  const aplicar = async (texto) => {
    setGuardando(true)
    setErrorAjuste(null)
    try {
      if (ajuste.tipo === 'excluir') {
        await excluirCurso(ajuste.curso.id, texto)
        onShowToast?.(`Grupo ${ajuste.curso.grupo} de ${ajuste.curso.nombreAsignatura} excluido`, 'success')
      } else {
        const r = await reactivarCurso(ajuste.curso.id, texto)
        const nuevo = r?.cursos?.find((g) => g.id === ajuste.curso.id)?.grupoDespues
        onShowToast?.(
          `Curso de ${ajuste.curso.nombreAsignatura} reactivado${nuevo ? ` como grupo ${nuevo}` : ''}`,
          'success',
        )
      }
      cerrarAjuste()
      await onCambio?.()
    } catch (err) {
      setConfirmarDocente(false)
      setErrorAjuste(err.message || 'No se pudo guardar el ajuste')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="pc-panel">
      <div className="pc-filters-bar">
        <div className="pc-search-box">
          <Search size={16} className="pc-search-icon" />
          <input
            type="text"
            placeholder="Buscar por código, curso, materia o carrera..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pc-input"
          />
        </div>

        <div className="pc-filter-group">
          <Filter size={16} />
          <select
            value={filtroPrograma}
            onChange={(e) => setFiltroPrograma(e.target.value)}
            className="pc-select"
            aria-label="Filtrar por programa"
          >
            <option value="">Todos los programas</option>
            {programas.map((p) => (
              <option key={p.code_program} value={p.code_program}>
                {p.name_program}
              </option>
            ))}
          </select>

          <select
            value={filtroAsignatura}
            onChange={(e) => setFiltroAsignatura(e.target.value)}
            className="pc-select"
            aria-label="Filtrar por asignatura"
          >
            <option value="">Todas las asignaturas</option>
            {asignaturas.map(([codigo, nombre]) => (
              <option key={codigo} value={codigo}>
                {codigo} - {nombre}
              </option>
            ))}
          </select>

          <select
            value={filtroJornada}
            onChange={(e) => setFiltroJornada(e.target.value)}
            className="pc-select"
            aria-label="Filtrar por jornada"
          >
            <option value="">Todas las jornadas</option>
            <option value="DIURNA">Diurna</option>
            <option value="NOCTURNA">Nocturna</option>
          </select>
        </div>
      </div>

      {(totalRevision > 0 || totalExcluidos > 0) && (
        <div className="pc-ajuste-resumen">
          {totalRevision > 0 && (
            <span className="pc-badge pc-badge-revision">
              <AlertTriangle size={13} /> {totalRevision} {totalRevision === 1 ? 'curso requiere' : 'cursos requieren'} revisión
            </span>
          )}
          {totalExcluidos > 0 && (
            <span className="pc-badge pc-badge-excluido">
              <Ban size={13} /> {totalExcluidos} {totalExcluidos === 1 ? 'curso excluido' : 'cursos excluidos'}
            </span>
          )}
        </div>
      )}

      <div className="pc-table-wrapper">
        <table className="pc-table">
          <thead>
            <tr>
              <th>Grupo</th>
              <th>Asignatura</th>
              <th>Semestre</th>
              <th>Jornada</th>
              <th>Créditos</th>
              <th>Programa</th>
              <th>Resolución</th>
              <th>Docente</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={10} className="pc-empty-cell">
                  {cursos.length === 0
                    ? 'No hay cursos para mostrar. Vaya a la pestaña "Generar Programación" si aún no ha generado la oferta.'
                    : 'Sin resultados'}
                </td>
              </tr>
            ) : (
              filtrados.map((curso) => {
                const excluido = curso.estado === 'EXCLUIDO'
                return (
                  <tr
                    key={curso.id}
                    className={excluido ? 'pc-row-excluido' : curso.requiereRevision ? 'pc-row-revision' : ''}
                  >
                    <td>
                      {/* Solo el número de grupo (decisión 2026-11-06); el curso se sigue identificando por su id */}
                      {excluido || curso.grupo == null ? (
                        <span className="pc-text-muted" aria-label="Sin grupo">—</span>
                      ) : (
                        <span className="pc-grupo-badge">{curso.grupo}</span>
                      )}
                    </td>
                    <td>
                      <strong>{curso.nombreAsignatura}</strong>
                      {curso.requiereRevision && (
                        <div className="pc-revision-motivo">
                          <AlertTriangle size={12} /> {curso.motivoRevision}
                        </div>
                      )}
                      {excluido && (
                        <div className="pc-exclusion-detalle">
                          <span>Justificación: {curso.justificacionExclusion}</span>
                          <span className="pc-text-muted">
                            {curso.excluidoPor} · {formatearFechaHora(curso.fechaExclusion, '')}
                          </span>
                        </div>
                      )}
                    </td>
                    <td>{curso.semestre}º</td>
                    <td>
                      <span className={`pc-badge ${curso.jornada === 'NOCTURNA' ? 'pc-badge-purple' : 'pc-badge-blue'}`}>
                        {curso.jornada}
                      </span>
                    </td>
                    <td>{curso.credits}</td>
                    <td>{curso.nombrePrograma}</td>
                    <td><small className="pc-text-muted">{curso.numeroResolucion}</small></td>
                    <td>
                      {curso.nombreDocente ? (
                        <span className="pc-docente-assigned">{curso.nombreDocente}</span>
                      ) : (
                        <span className="pc-text-muted">Sin docente asignado</span>
                      )}
                    </td>
                    <td>
                      {excluido ? (
                        <span className="pc-badge pc-badge-excluido">Excluido</span>
                      ) : curso.requiereRevision ? (
                        <span className="pc-badge pc-badge-revision" title={curso.motivoRevision}>Requiere revisión</span>
                      ) : (
                        <span className={`pc-badge ${curso.estado === 'ASIGNADO' ? 'pc-badge-success' : 'pc-badge-warning'}`}>
                          {curso.estado}
                        </span>
                      )}
                    </td>
                    <td>
                      {excluido ? (
                        <button
                          type="button"
                          className="pc-btn pc-btn-secondary pc-btn-sm"
                          onClick={() => abrirReactivacion(curso)}
                        >
                          <RotateCcw size={14} />
                          <span>Reactivar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="pc-btn pc-btn-danger-outline pc-btn-sm"
                          onClick={() => abrirExclusion(curso)}
                        >
                          <Ban size={14} />
                          <span>Excluir</span>
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {ajuste && (
        <div className="pc-modal-backdrop">
          <div className="pc-modal" role="dialog" aria-modal="true">
            <div className="pc-modal-header">
              <div className="pc-modal-title-with-icon">
                {ajuste.tipo === 'excluir' ? (
                  <Ban size={22} className="pc-text-warning" />
                ) : (
                  <RotateCcw size={22} />
                )}
                <h3>
                  {ajuste.tipo === 'excluir'
                    ? `Excluir grupo ${ajuste.curso.grupo} de ${ajuste.curso.nombreAsignatura}`
                    : `Reactivar curso de ${ajuste.curso.nombreAsignatura}`}
                </h3>
              </div>
              <button type="button" className="pc-btn-close" onClick={cerrarAjuste} disabled={guardando}>
                ✕
              </button>
            </div>

            <div className="pc-modal-body">
              <p>
                <strong>{ajuste.curso.nombreAsignatura}</strong> · {ajuste.curso.nombrePrograma} · {ajuste.curso.jornada}
              </p>

              {ajuste.tipo === 'excluir' && (
                <>
                  <h4 className="pc-ajuste-subtitulo">Así quedarán los grupos de {ajuste.curso.nombreAsignatura}</h4>
                  {cargandoAjuste ? (
                    <p className="pc-text-muted">
                      <RefreshCw size={14} className="pc-spin" /> Calculando vista previa…
                    </p>
                  ) : ajuste.vistaPrevia ? (
                    <table className="pc-table pc-table-compacta">
                      <thead>
                        <tr>
                          <th>Programa</th>
                          <th>Jornada</th>
                          <th>Antes</th>
                          <th />
                          <th>Después</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ajuste.vistaPrevia.cursos.map((g) => {
                          const cambia = g.grupoAntes !== g.grupoDespues
                          return (
                            <tr
                              key={g.id}
                              className={g.id === ajuste.curso.id ? 'pc-row-excluido' : cambia ? 'pc-row-cambio' : ''}
                            >
                              <td>{g.nombrePrograma}</td>
                              <td>{g.jornada}</td>
                              <td>{g.grupoAntes != null ? `Grupo ${g.grupoAntes}` : '—'}</td>
                              <td><ArrowRight size={14} /></td>
                              <td>
                                {g.excluido ? (
                                  <span className="pc-badge pc-badge-excluido">Excluido</span>
                                ) : (
                                  <strong>Grupo {g.grupoDespues}</strong>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : null}
                </>
              )}

              {ajuste.tipo === 'reactivar' && (
                <div className="pc-alert pc-alert-info-ajuste">
                  <span>
                    El curso volverá a la programación sin docente y tomará el siguiente grupo de la serie
                    (<strong>Grupo {ajuste.grupoEstimado}</strong>). Los demás cursos no cambian.
                  </span>
                </div>
              )}

              <div className="pc-field-group">
                <label htmlFor="pc-justificacion">Justificación (obligatoria)</label>
                <textarea
                  id="pc-justificacion"
                  className="pc-textarea"
                  rows={3}
                  maxLength={MAX_JUSTIFICACION}
                  value={justificacion}
                  onChange={(e) => {
                    setJustificacion(e.target.value)
                    if (errorAjuste) setErrorAjuste(null)
                  }}
                  placeholder={
                    ajuste.tipo === 'excluir'
                      ? 'Ej. El programa no tiene estudiantes que vean esta asignatura en el periodo'
                      : 'Ej. Se confirmaron estudiantes del programa para esta asignatura'
                  }
                  disabled={guardando}
                />
                <small className="pc-text-muted">{justificacion.length}/{MAX_JUSTIFICACION}</small>
              </div>

              {errorAjuste && (
                <div className="pc-alert pc-alert-warning" role="alert">
                  <AlertTriangle size={18} />
                  <span>{errorAjuste}</span>
                </div>
              )}
            </div>

            <div className="pc-modal-footer">
              <button type="button" className="pc-btn pc-btn-secondary" onClick={cerrarAjuste} disabled={guardando}>
                Cancelar
              </button>
              <button
                type="button"
                className={`pc-btn ${ajuste.tipo === 'excluir' ? 'pc-btn-warning' : 'pc-btn-primary'}`}
                onClick={confirmar}
                disabled={guardando || cargandoAjuste || (ajuste.tipo === 'excluir' && !ajuste.vistaPrevia)}
              >
                {guardando ? <RefreshCw size={16} className="pc-spin" /> : null}
                <span>{ajuste.tipo === 'excluir' ? 'Confirmar exclusión' : 'Confirmar reactivación'}</span>
              </button>
            </div>
          </div>

          {/* Alerta emergente: el curso tiene docente asignado */}
          {confirmarDocente && (
            <div className="pc-modal-backdrop pc-modal-backdrop-top">
              <div className="pc-modal pc-modal-sm" role="alertdialog" aria-modal="true">
                <div className="pc-modal-header">
                  <div className="pc-modal-title-with-icon">
                    <UserX size={22} className="pc-text-warning" />
                    <h3>El curso tiene docente asignado</h3>
                  </div>
                </div>
                <div className="pc-modal-body">
                  <p>
                    <strong>{ajuste.curso.nombreDocente || 'Un docente'}</strong> está asignado al grupo{' '}
                    {ajuste.curso.grupo} de {ajuste.curso.nombreAsignatura}. Al excluir el curso se quitará esta
                    asignación.
                  </p>
                  <p className="pc-text-muted">¿Desea continuar?</p>
                </div>
                <div className="pc-modal-footer">
                  <button
                    type="button"
                    className="pc-btn pc-btn-secondary"
                    onClick={cerrarAjuste}
                    disabled={guardando}
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    className="pc-btn pc-btn-warning"
                    onClick={() => aplicar(justificacion.trim())}
                    disabled={guardando}
                  >
                    {guardando ? <RefreshCw size={16} className="pc-spin" /> : null}
                    <span>Quitar docente y excluir</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
