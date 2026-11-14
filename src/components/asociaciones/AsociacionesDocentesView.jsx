import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Link2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Users,
  X,
} from 'lucide-react'
import { getAllPensum, getAsignaturas, getDocentes, getProgramas } from '../../services/academicService'
import {
  cambiarEstadoAsociacion,
  crearAsociacion,
  listarAsociaciones,
  quitarAsociacion,
} from '../../services/asociacionesService'
import Dropdown from '../common/Dropdown'
import './AsociacionesDocentesView.css'

const nombreDocente = (docente) =>
  `${docente?.nombres || ''} ${docente?.apellidos || ''}`.trim() || docente?.codigo || 'Docente'

const mismoId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)

export default function AsociacionesDocentesView({ onShowToast }) {
  const [vista, setVista] = useState('docente')
  const [asociaciones, setAsociaciones] = useState([])
  const [asociacionesDocente, setAsociacionesDocente] = useState([])
  const [docentes, setDocentes] = useState([])
  const [programas, setProgramas] = useState([])
  const [asignaturas, setAsignaturas] = useState([])
  const [pensumList, setPensumList] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroDocente, setFiltroDocente] = useState('')
  const [filtroAsignatura, setFiltroAsignatura] = useState('')
  const [filtroFacultad, setFiltroFacultad] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const [isAsociarOpen, setIsAsociarOpen] = useState(false)
  const [confirmQuitar, setConfirmQuitar] = useState(null)
  const [form, setForm] = useState({ docenteId: '', codeCourses: [] })

  const cargarCatalogos = useCallback(async () => {
    try {
      const [docs, progs, asigs, pensum] = await Promise.all([
        getDocentes(),
        getProgramas(),
        getAsignaturas(),
        getAllPensum(),
      ])
      setDocentes(Array.isArray(docs) ? docs : [])
      setProgramas(Array.isArray(progs) ? progs : [])
      setAsignaturas(Array.isArray(asigs) ? asigs : [])
      setPensumList(Array.isArray(pensum) ? pensum : [])
    } catch (err) {
      onShowToast?.(err.message || 'No fue posible cargar los catálogos', 'error')
    }
  }, [onShowToast])

  const cargarAsociaciones = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listarAsociaciones({
        docenteId: filtroDocente || undefined,
        codeCourse: filtroAsignatura || undefined,
        idFacultad: filtroFacultad || undefined,
        activo: filtroEstado === 'todos' ? undefined : filtroEstado === 'activo',
      })
      setAsociaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'No fue posible cargar las asociaciones')
    } finally {
      setLoading(false)
    }
  }, [filtroDocente, filtroAsignatura, filtroFacultad, filtroEstado])

  const cargarAsociacionesDelDocente = useCallback(async (docenteId) => {
    if (!docenteId) {
      setAsociacionesDocente([])
      return
    }
    try {
      const data = await listarAsociaciones({ docenteId })
      setAsociacionesDocente(Array.isArray(data) ? data : [])
    } catch {
      setAsociacionesDocente([])
    }
  }, [])

  useEffect(() => {
    cargarCatalogos()
  }, [cargarCatalogos])

  useEffect(() => {
    cargarAsociaciones()
  }, [cargarAsociaciones])

  useEffect(() => {
    if (isAsociarOpen) {
      cargarAsociacionesDelDocente(form.docenteId)
    }
  }, [isAsociarOpen, form.docenteId, cargarAsociacionesDelDocente])

  const docentesDisponibles = useMemo(
    () => docentes.filter((d) => d.estado !== false && d.activo !== false),
    [docentes],
  )

  const asignaturasDisponibles = useMemo(
    () => asignaturas.filter((a) => a.activo !== false),
    [asignaturas],
  )

  const facultades = useMemo(() => {
    const mapa = new Map()
    docentes.forEach((docente) => {
      if (docente.id_facultad !== null && docente.id_facultad !== undefined) {
        mapa.set(
          String(docente.id_facultad),
          docente.nombre_facultad || `Facultad ${docente.id_facultad}`,
        )
      }
    })
    asignaturas.forEach((asignatura) => {
      const id = asignatura.id_facultad
      if (id !== null && id !== undefined && !mapa.has(String(id))) {
        mapa.set(String(id), asignatura.facultad || `Facultad ${id}`)
      }
    })
    return [...mapa.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label))
  }, [docentes, asignaturas])

  const asignaturasPorCodigo = useMemo(
    () => new Map(asignaturas.map((a) => [a.code_course, a])),
    [asignaturas],
  )

  const docenteSeleccionado = useMemo(
    () => docentesDisponibles.find((docente) => mismoId(docente.id, form.docenteId)),
    [docentesDisponibles, form.docenteId],
  )

  const facultadDocente =
    docenteSeleccionado?.id_facultad ?? docenteSeleccionado?.facultad?.id ?? null
  const nombreFacultadDocente =
    docenteSeleccionado?.nombre_facultad ||
    facultades.find((facultad) => mismoId(facultad.value, facultadDocente))?.label ||
    ''

  const opcionesAsignatura = useMemo(() => {
    if (!docenteSeleccionado || !facultadDocente) return []

    const programasFacultad = programas
      .filter((programa) => mismoId(programa.id_facultad_programa, facultadDocente))
      .map((programa) => programa.code_program)
    const codigosMalla = new Set(
      pensumList
        .filter((item) => programasFacultad.includes(item.code_program))
        .map((item) => item.code_course),
    )
    const yaActivas = new Set(
      asociacionesDocente
        .filter((asociacion) => asociacion.activo)
        .map((asociacion) => asociacion.code_course),
    )

    return asignaturasDisponibles
      .filter(
        (asignatura) =>
          (mismoId(asignatura.id_facultad, facultadDocente) ||
            codigosMalla.has(asignatura.code_course)) &&
          !yaActivas.has(asignatura.code_course),
      )
      .map((asignatura) => ({
        value: asignatura.code_course,
        label: `${asignatura.code_course} - ${asignatura.name_course}`,
        description: asignatura.facultad || '',
      }))
  }, [
    asignaturasDisponibles,
    asociacionesDocente,
    facultadDocente,
    docenteSeleccionado,
    pensumList,
    programas,
  ])

  const docenteOptions = useMemo(
    () => [
      { value: '', label: 'Todos los docentes' },
      ...docentes.map((docente) => ({
        value: String(docente.id),
        label: `${nombreDocente(docente)} (${docente.numero_documento})`,
      })),
    ],
    [docentes],
  )

  const asignaturaOptions = useMemo(
    () => [
      { value: '', label: 'Todas las asignaturas' },
      ...asignaturas.map((asignatura) => ({
        value: asignatura.code_course,
        label: `${asignatura.code_course} - ${asignatura.name_course}`,
      })),
    ],
    [asignaturas],
  )

  const facultadOptions = useMemo(
    () => [{ value: '', label: 'Todas las facultades' }, ...facultades],
    [facultades],
  )

  const estadoOptions = useMemo(
    () => [
      { value: 'todos', label: 'Todas' },
      { value: 'activo', label: 'Activas' },
      { value: 'inactivo', label: 'Inactivas' },
    ],
    [],
  )

  const formDocenteOptions = useMemo(
    () =>
      docentesDisponibles.map((docente) => ({
        value: String(docente.id),
        label: `${nombreDocente(docente)} - ${docente.numero_documento}`,
        description: docente.nombre_facultad || '',
      })),
    [docentesDisponibles],
  )

  const filtradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase()
    if (!texto) return asociaciones
    return asociaciones.filter((asociacion) =>
      [
        asociacion.docente_nombre,
        asociacion.docente_codigo,
        asociacion.correo_institucional,
        asociacion.numero_documento,
        asociacion.code_course,
        asociacion.name_course,
        asociacion.nombre_facultad,
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto)),
    )
  }, [asociaciones, busqueda])

  const ordenadas = useMemo(() => {
    const copia = [...filtradas]
    if (vista === 'asignatura') {
      copia.sort((a, b) =>
        `${a.code_course} ${a.docente_nombre}`.localeCompare(`${b.code_course} ${b.docente_nombre}`),
      )
    } else {
      copia.sort((a, b) =>
        `${a.docente_nombre} ${a.code_course}`.localeCompare(`${b.docente_nombre} ${b.code_course}`),
      )
    }
    return copia
  }, [filtradas, vista])

  const stats = useMemo(() => {
    const activas = asociaciones.filter((a) => a.activo).length
    const docentesUnicos = new Set(asociaciones.map((a) => a.docente_id)).size
    const asignaturasUnicas = new Set(asociaciones.map((a) => a.code_course)).size
    return {
      total: asociaciones.length,
      activas,
      inactivas: asociaciones.length - activas,
      docentesUnicos,
      asignaturasUnicas,
    }
  }, [asociaciones])

  const limpiarFiltros = () => {
    setFiltroDocente('')
    setFiltroAsignatura('')
    setFiltroFacultad('')
    setFiltroEstado('todos')
    setBusqueda('')
  }

  const abrirAsociar = () => {
    setForm({ docenteId: '', codeCourses: [] })
    setAsociacionesDocente([])
    setIsAsociarOpen(true)
  }

  const handleAsociar = async (event) => {
    event.preventDefault()
    if (!form.docenteId || form.codeCourses.length === 0) {
      onShowToast?.('Selecciona un docente y al menos una asignatura', 'error')
      return
    }

    setSubmitting(true)
    const errores = []

    for (const codeCourse of form.codeCourses) {
      try {
        await crearAsociacion({ docenteId: form.docenteId, codeCourse })
      } catch (err) {
        errores.push(`${codeCourse}: ${err.message || 'No fue posible asociar'}`)
      }
    }

    if (errores.length === 0) {
      onShowToast?.('Asociaciones registradas correctamente', 'success')
      setIsAsociarOpen(false)
    } else {
      setForm((prev) => ({ ...prev, codeCourses: [] }))
      onShowToast?.(errores.join(' · '), 'error')
    }

    try {
      await Promise.all([cargarAsociaciones(), cargarAsociacionesDelDocente(form.docenteId)])
    } finally {
      setSubmitting(false)
    }
  }

  const handleQuitar = async () => {
    if (!confirmQuitar) return
    setSubmitting(true)
    try {
      await quitarAsociacion(confirmQuitar.id)
      onShowToast?.('Asociación desactivada. El histórico se conserva.', 'success')
      setConfirmQuitar(null)
      await cargarAsociaciones()
    } catch (err) {
      onShowToast?.(err.message || 'No fue posible quitar la asociación', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReactivar = async (asociacion) => {
    try {
      await cambiarEstadoAsociacion(asociacion.id, true)
      onShowToast?.('Asociación reactivada', 'success')
      await cargarAsociaciones()
    } catch (err) {
      onShowToast?.(err.message || 'No fue posible reactivar la asociación', 'error')
    }
  }

  return (
    <div className="aso-container">
      <div className="aso-header">
        <div>
          <h1 className="aso-title">
            <Link2 size={26} />
            Asociaciones docentes
          </h1>
          <p className="aso-subtitle">
            Histórico de asignaturas que cada docente ha dictado. Las asociaciones se desactivan, nunca se eliminan.
          </p>
        </div>
        <div className="aso-header-actions">
          <button type="button" className="btn-secondary" onClick={cargarAsociaciones} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            Actualizar
          </button>
          <button type="button" className="btn-primary" onClick={abrirAsociar}>
            <Plus size={16} />
            Asociar docente
          </button>
        </div>
      </div>

      <div className="aso-stats">
        <span className="stats-pill">Total: {stats.total}</span>
        <span className="stats-pill">Activas: {stats.activas}</span>
        <span className="stats-pill">Inactivas: {stats.inactivas}</span>
        <span className="stats-pill">Docentes: {stats.docentesUnicos}</span>
        <span className="stats-pill">Asignaturas: {stats.asignaturasUnicas}</span>
      </div>

      <div className="aso-tabs" role="tablist" aria-label="Vista de asociaciones">
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'docente'}
          className={`aso-tab ${vista === 'docente' ? 'active' : ''}`}
          onClick={() => setVista('docente')}
        >
          <Users size={16} /> Por docente
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={vista === 'asignatura'}
          className={`aso-tab ${vista === 'asignatura' ? 'active' : ''}`}
          onClick={() => setVista('asignatura')}
        >
          <BookOpen size={16} /> Por asignatura
        </button>
      </div>

      <div className="aso-control-bar">
        <div className="aso-search">
          <Search size={18} className="search-icon" />
          <input
            type="search"
            placeholder="Buscar por docente, documento, asignatura o facultad..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <Dropdown
          className="aso-filter-dropdown"
          value={filtroDocente}
          options={docenteOptions}
          onChange={setFiltroDocente}
          ariaLabel="Filtrar por docente"
        />
        <Dropdown
          className="aso-filter-dropdown"
          value={filtroAsignatura}
          options={asignaturaOptions}
          onChange={setFiltroAsignatura}
          ariaLabel="Filtrar por asignatura"
          searchable
          searchPlaceholder="Digita el código de la asignatura..."
        />
        <Dropdown
          className="aso-filter-dropdown"
          value={filtroFacultad}
          options={facultadOptions}
          onChange={setFiltroFacultad}
          ariaLabel="Filtrar por facultad"
        />
        <Dropdown
          className="aso-filter-dropdown aso-filter-dropdown-sm"
          value={filtroEstado}
          options={estadoOptions}
          onChange={setFiltroEstado}
          ariaLabel="Filtrar por estado"
        />
        <button type="button" className="btn-secondary btn-sm" onClick={limpiarFiltros}>
          <X size={14} /> Limpiar
        </button>
      </div>

      {error && (
        <div className="aso-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={cargarAsociaciones}>
            Reintentar
          </button>
        </div>
      )}

      <div className={`aso-table-wrap ${loading ? 'is-loading' : ''}`}>
        <table className="aso-table">
          <thead>
            <tr>
              {vista === 'docente' ? (
                <>
                  <th>Docente</th>
                  <th>Asignatura</th>
                </>
              ) : (
                <>
                  <th>Asignatura</th>
                  <th>Docente</th>
                </>
              )}
              <th>Facultad</th>
              <th>Origen</th>
              <th>Estado</th>
              <th className="aso-actions-col">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="aso-empty">
                  <RefreshCw size={18} className="spin" /> Cargando asociaciones...
                </td>
              </tr>
            ) : ordenadas.length === 0 ? (
              <tr>
                <td colSpan={6} className="aso-empty">
                  <Link2 size={22} />
                  No hay asociaciones para los filtros seleccionados.
                </td>
              </tr>
            ) : (
              ordenadas.map((asociacion) => {
                const asignatura = asignaturasPorCodigo.get(asociacion.code_course)
                const celdaDocente = (
                  <div className="aso-person">
                    <strong>{asociacion.docente_nombre}</strong>
                    <span>{asociacion.correo_institucional}</span>
                    <span>Doc. {asociacion.numero_documento}</span>
                  </div>
                )
                const celdaAsignatura = (
                  <div className="aso-person">
                    <strong className="aso-code">{asociacion.code_course}</strong>
                    <span>{asociacion.name_course || asignatura?.name_course}</span>
                  </div>
                )
                return (
                  <tr key={asociacion.id}>
                    {vista === 'docente' ? (
                      <>
                        <td data-label="Docente">{celdaDocente}</td>
                        <td data-label="Asignatura">{celdaAsignatura}</td>
                      </>
                    ) : (
                      <>
                        <td data-label="Asignatura">{celdaAsignatura}</td>
                        <td data-label="Docente">{celdaDocente}</td>
                      </>
                    )}
                    <td data-label="Facultad">
                      <div className="aso-person">
                        <strong>{asociacion.nombre_facultad || 'Sin facultad'}</strong>
                        {asociacion.id_facultad && (
                          <span className="aso-code">ID {asociacion.id_facultad}</span>
                        )}
                      </div>
                    </td>
                    <td data-label="Origen">
                      <span className={`aso-badge origen-${String(asociacion.origen || '').toLowerCase()}`}>
                        {asociacion.origen}
                      </span>
                      {asociacion.periodo_nombre && <span className="aso-periodo">{asociacion.periodo_nombre}</span>}
                    </td>
                    <td data-label="Estado">
                      <span className={`aso-badge ${asociacion.activo ? 'estado-activo' : 'estado-inactivo'}`}>
                        {asociacion.activo ? 'Activa' : 'Inactiva'}
                      </span>
                    </td>
                    <td data-label="Acciones" className="aso-actions-col">
                      {asociacion.activo ? (
                        <button
                          type="button"
                          className="aso-icon-btn danger"
                          title="Quitar asociación (se conserva el histórico)"
                          onClick={() => setConfirmQuitar(asociacion)}
                        >
                          <Trash2 size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="aso-icon-btn"
                          title="Reactivar asociación"
                          onClick={() => handleReactivar(asociacion)}
                        >
                          <RotateCcw size={16} />
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

      {isAsociarOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setIsAsociarOpen(false)}>
          <div className="modal-card" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <Link2 size={20} />
                <h2>Asociar docente a asignaturas</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setIsAsociarOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAsociar}>
              <div className="modal-body">
                <div className="aso-form-grid">
                  <div className="aso-field">
                    <span>Docente</span>
                    <Dropdown
                      value={form.docenteId}
                      options={formDocenteOptions}
                      onChange={(docenteId) =>
                        setForm({ docenteId, codeCourses: [] })
                      }
                      placeholder="Selecciona un docente"
                      ariaLabel="Docente"
                      emptyMessage="No hay docentes activos"
                    />
                  </div>
                  <div className="aso-field">
                    <span>Facultad de adscripción</span>
                    <div className={`aso-static-value ${!nombreFacultadDocente ? 'is-empty' : ''}`}>
                      {nombreFacultadDocente || 'Selecciona un docente'}
                    </div>
                  </div>
                </div>

                <div className="aso-field">
                  <span>Asignaturas</span>
                  <Dropdown
                    multiple
                    searchable
                    searchPlaceholder="Digita el código de la asignatura..."
                    values={form.codeCourses}
                    options={opcionesAsignatura}
                    onChange={(codeCourses) => setForm((prev) => ({ ...prev, codeCourses }))}
                    placeholder={
                      !docenteSeleccionado
                        ? 'Primero selecciona un docente'
                        : !facultadDocente
                          ? 'El docente no tiene facultad de adscripción'
                          : 'Selecciona una o varias asignaturas'
                    }
                    ariaLabel="Asignaturas"
                    disabled={!docenteSeleccionado || !facultadDocente || opcionesAsignatura.length === 0}
                    emptyMessage="No hay asignaturas disponibles para la facultad del docente"
                  />
                </div>

                {docenteSeleccionado && !facultadDocente && (
                  <p className="aso-hint aso-hint-error">
                    El docente no tiene facultad ni programa de adscripción. Actualiza su perfil antes de asociarlo.
                  </p>
                )}
                {docenteSeleccionado && facultadDocente && opcionesAsignatura.length === 0 && (
                  <p className="aso-hint">
                    No quedan asignaturas de esta facultad por asociar. Revisa el histórico o la malla académica.
                  </p>
                )}
                <p className="aso-hint">
                  Solo se muestran asignaturas de la facultad del docente que aún no están activas en su histórico.
                  Puedes seleccionar varias.
                </p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setIsAsociarOpen(false)}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || !form.docenteId || form.codeCourses.length === 0}
                >
                  {submitting
                    ? 'Guardando...'
                    : `Asociar${form.codeCourses.length > 1 ? ` ${form.codeCourses.length}` : ''}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmQuitar && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setConfirmQuitar(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <AlertTriangle size={20} />
                <h2>Quitar asociación</h2>
              </div>
              <button type="button" className="modal-close-btn" onClick={() => setConfirmQuitar(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p>
                Se desactivará la asociación de <strong>{confirmQuitar.docente_nombre}</strong> con{' '}
                <strong>{confirmQuitar.code_course}</strong> en{' '}
                <strong>{confirmQuitar.nombre_facultad || 'su facultad'}</strong>.
              </p>
              <p className="aso-hint">El registro se conserva en el histórico y puede reactivarse después.</p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={() => setConfirmQuitar(null)}>
                Cancelar
              </button>
              <button type="button" className="btn-primary danger" onClick={handleQuitar} disabled={submitting}>
                {submitting ? 'Quitando...' : 'Quitar asociación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
