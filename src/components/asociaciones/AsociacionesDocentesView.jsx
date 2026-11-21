import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  FileSpreadsheet,
  Info,
  Link2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react'
import { getAsignaturas, getDocentes, getPeriodos } from '../../services/academicService'
import { importarEvaluacionesExcel } from '../../services/docenteService'
import {
  cambiarEstadoAsociacion,
  crearAsociacion,
  listarAsociaciones,
  listarEscuelas,
  quitarAsociacion,
} from '../../services/asociacionesService'
import Dropdown from '../common/Dropdown'
import './AsociacionesDocentesView.css'

const nombreDocente = (docente) =>
  `${docente?.nombres || ''} ${docente?.apellidos || ''}`.trim() || docente?.codigo || 'Docente'

const mismoId = (a, b) => a !== null && a !== undefined && b !== null && b !== undefined && String(a) === String(b)

const prefijoEscuela = (codeCourse) => {
  const clean = String(codeCourse || '').trim().toUpperCase()
  return clean.length >= 3 ? clean.slice(0, 3) : ''
}

export default function AsociacionesDocentesView({ onShowToast }) {
  const [vista, setVista] = useState('docente')
  const [asociaciones, setAsociaciones] = useState([])
  const [asociacionesDocente, setAsociacionesDocente] = useState([])
  const [docentes, setDocentes] = useState([])
  const [asignaturas, setAsignaturas] = useState([])
  const [escuelas, setEscuelas] = useState([])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const [busqueda, setBusqueda] = useState('')
  const [filtroDocente, setFiltroDocente] = useState('')
  const [filtroAsignatura, setFiltroAsignatura] = useState('')
  const [filtroEscuela, setFiltroEscuela] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('todos')

  const [isAsociarOpen, setIsAsociarOpen] = useState(false)
  const [confirmQuitar, setConfirmQuitar] = useState(null)
  const [form, setForm] = useState({ docenteId: '', codigoEscuela: '', codeCourses: [] })
  const [periodoActivo, setPeriodoActivo] = useState(null)

  // Modal de carga masiva de calificaciones docentes (Excel)
  const [modalImportarExcel, setModalImportarExcel] = useState(false)
  const [archivoExcel, setArchivoExcel] = useState(null)
  const [subiendoExcel, setSubiendoExcel] = useState(false)
  const [resultadoExcel, setResultadoExcel] = useState(null)
  const [errorExcel, setErrorExcel] = useState('')
  const inputExcelRef = useRef(null)

  const cargarCatalogos = useCallback(async () => {
    try {
      const [docs, asigs, escs, periodos] = await Promise.all([
        getDocentes(),
        getAsignaturas(),
        listarEscuelas().catch(() => []),
        getPeriodos().catch(() => []),
      ])
      setDocentes(Array.isArray(docs) ? docs : [])
      setAsignaturas(Array.isArray(asigs) ? asigs : [])
      setEscuelas(Array.isArray(escs) ? escs : [])
      const listaPeriodos = Array.isArray(periodos) ? periodos : []
      const vigente = listaPeriodos.find((p) => p.vigente || p.estado === 'VIGENTE') || listaPeriodos[0] || null
      setPeriodoActivo(vigente)
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
        codigoEscuela: filtroEscuela || undefined,
        activo: filtroEstado === 'todos' ? undefined : filtroEstado === 'activo',
      })
      setAsociaciones(Array.isArray(data) ? data : [])
    } catch (err) {
      setError(err.message || 'No fue posible cargar las asociaciones')
    } finally {
      setLoading(false)
    }
  }, [filtroDocente, filtroAsignatura, filtroEscuela, filtroEstado])

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

  const escuelasPorCodigo = useMemo(() => {
    const mapa = new Map()
    escuelas.forEach((e) => {
      if (e?.codigo) {
        mapa.set(String(e.codigo).trim().toUpperCase(), e.nombre || `Escuela ${e.codigo}`)
      }
    })
    return mapa
  }, [escuelas])

  const escuelasConAsignaturas = useMemo(() => {
    const prefijosPresentes = new Set(
      asignaturasDisponibles.map((a) => prefijoEscuela(a.code_course)).filter(Boolean),
    )
    const lista = escuelas
      .filter((e) => prefijosPresentes.size === 0 || prefijosPresentes.has(String(e.codigo).trim().toUpperCase()))
      .map((e) => ({
        value: String(e.codigo).trim().toUpperCase(),
        label: `${e.codigo} - ${e.nombre}`,
      }))
    return lista.length > 0
      ? lista
      : escuelas.map((e) => ({
          value: String(e.codigo).trim().toUpperCase(),
          label: `${e.codigo} - ${e.nombre}`,
        }))
  }, [escuelas, asignaturasDisponibles])

  const asignaturasPorCodigo = useMemo(
    () => new Map(asignaturas.map((a) => [a.code_course, a])),
    [asignaturas],
  )

  const docenteSeleccionado = useMemo(
    () => docentesDisponibles.find((docente) => mismoId(docente.id, form.docenteId)),
    [docentesDisponibles, form.docenteId],
  )

  const opcionesAsignatura = useMemo(() => {
    if (!docenteSeleccionado || !form.codigoEscuela) return []

    const prefijo = String(form.codigoEscuela).trim().toUpperCase()
    const yaActivas = new Set(
      asociacionesDocente
        .filter((asociacion) => asociacion.activo)
        .map((asociacion) => asociacion.code_course),
    )

    return asignaturasDisponibles
      .filter(
        (asignatura) =>
          prefijoEscuela(asignatura.code_course) === prefijo &&
          !yaActivas.has(asignatura.code_course),
      )
      .map((asignatura) => ({
        value: asignatura.code_course,
        label: `${asignatura.code_course} - ${asignatura.name_course}`,
        description: escuelasPorCodigo.get(prefijo) || '',
      }))
  }, [
    asignaturasDisponibles,
    asociacionesDocente,
    docenteSeleccionado,
    form.codigoEscuela,
    escuelasPorCodigo,
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

  const escuelaOptions = useMemo(
    () => [{ value: '', label: 'Todas las escuelas' }, ...escuelasConAsignaturas],
    [escuelasConAsignaturas],
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
        asociacion.codigo_escuela,
        asociacion.nombre_escuela,
        escuelasPorCodigo.get(prefijoEscuela(asociacion.code_course)),
      ]
        .filter(Boolean)
        .some((valor) => String(valor).toLowerCase().includes(texto)),
    )
  }, [asociaciones, busqueda, escuelasPorCodigo])

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
    setFiltroEscuela('')
    setFiltroEstado('todos')
    setBusqueda('')
  }

  const abrirAsociar = () => {
    setForm({ docenteId: '', codigoEscuela: '', codeCourses: [] })
    setAsociacionesDocente([])
    setIsAsociarOpen(true)
  }

  const handleAsociar = async (event) => {
    event.preventDefault()
    if (!form.docenteId || !form.codigoEscuela || form.codeCourses.length === 0) {
      onShowToast?.('Selecciona un docente, una escuela y al menos una asignatura', 'error')
      return
    }

    setSubmitting(true)
    const errores = []

    for (const codeCourse of form.codeCourses) {
      try {
        await crearAsociacion({
          docenteId: form.docenteId,
          codeCourse,
          codigoEscuela: form.codigoEscuela,
        })
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

  const abrirModalImportarExcel = () => {
    setArchivoExcel(null)
    setResultadoExcel(null)
    setErrorExcel('')
    setModalImportarExcel(true)
  }

  const cerrarModalImportarExcel = () => {
    if (subiendoExcel) return
    setModalImportarExcel(false)
    setArchivoExcel(null)
    setResultadoExcel(null)
    setErrorExcel('')
  }

  const handleSubirExcel = async () => {
    if (!periodoActivo?.id || !archivoExcel || subiendoExcel) return
    setSubiendoExcel(true)
    setErrorExcel('')
    try {
      const resp = await importarEvaluacionesExcel(periodoActivo.id, archivoExcel)
      setResultadoExcel(resp)
      onShowToast?.(
        `Calificaciones cargadas: ${resp.total_registros_guardados} registros guardados (${resp.total_promediados} promediados, ${resp.total_no_evaluados} no evaluados).`,
        'success'
      )
      await cargarAsociaciones()
    } catch (err) {
      const msg = err?.message || 'No se pudo procesar el archivo Excel de calificaciones'
      setErrorExcel(msg)
      onShowToast?.(msg, 'error')
    } finally {
      setSubiendoExcel(false)
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
          <button
            type="button"
            className="btn-primary aso-btn-subir-excel"
            onClick={abrirModalImportarExcel}
            disabled={!periodoActivo}
            title="Subir archivo Excel con las calificaciones docentes"
          >
            <Upload size={16} />
            Subir Calificaciones (Excel)
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
            placeholder="Buscar por docente, documento, asignatura o escuela..."
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
          value={filtroEscuela}
          options={escuelaOptions}
          onChange={setFiltroEscuela}
          ariaLabel="Filtrar por escuela"
          searchable
          searchPlaceholder="Buscar escuela..."
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
              <th>Escuela</th>
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
                    <td data-label="Escuela">
                      <div className="aso-person">
                        <strong>
                          {asociacion.nombre_escuela ||
                            escuelasPorCodigo.get(prefijoEscuela(asociacion.code_course)) ||
                            'Sin escuela'}
                        </strong>
                        {(asociacion.codigo_escuela || prefijoEscuela(asociacion.code_course)) && (
                          <span className="aso-code">
                            Cód. {asociacion.codigo_escuela || prefijoEscuela(asociacion.code_course)}
                          </span>
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
                        setForm((prev) => ({ ...prev, docenteId, codeCourses: [] }))
                      }
                      placeholder="Selecciona un docente"
                      ariaLabel="Docente"
                      searchable
                      searchPlaceholder="Buscar docente..."
                      emptyMessage="No hay docentes activos"
                    />
                  </div>
                  <div className="aso-field">
                    <span>Escuela</span>
                    <Dropdown
                      value={form.codigoEscuela}
                      options={escuelasConAsignaturas}
                      onChange={(codigoEscuela) =>
                        setForm((prev) => ({ ...prev, codigoEscuela, codeCourses: [] }))
                      }
                      placeholder="Selecciona una escuela"
                      ariaLabel="Escuela"
                      searchable
                      searchPlaceholder="Buscar escuela por código o nombre..."
                      emptyMessage="No hay escuelas disponibles"
                    />
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
                        : !form.codigoEscuela
                          ? 'Selecciona una escuela'
                          : 'Selecciona una o varias asignaturas'
                    }
                    ariaLabel="Asignaturas"
                    disabled={!docenteSeleccionado || !form.codigoEscuela || opcionesAsignatura.length === 0}
                    emptyMessage="No hay asignaturas disponibles para la escuela seleccionada"
                  />
                </div>

                {docenteSeleccionado && form.codigoEscuela && opcionesAsignatura.length === 0 && (
                  <p className="aso-hint">
                    No quedan asignaturas de esta escuela por asociar al docente seleccionado.
                  </p>
                )}
                <p className="aso-hint">
                  Solo se muestran asignaturas pertenecientes a la escuela seleccionada que aún no están activas en el histórico del docente.
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
                  disabled={submitting || !form.docenteId || !form.codigoEscuela || form.codeCourses.length === 0}
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
                <strong>
                  {confirmQuitar.nombre_escuela ||
                    escuelasPorCodigo.get(prefijoEscuela(confirmQuitar.code_course)) ||
                    'su escuela'}
                </strong>.
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

      {/* Modal para subir calificaciones docentes desde Excel */}
      {modalImportarExcel && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) cerrarModalImportarExcel()
          }}
        >
          <div className="modal-card aso-excel-modal" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <FileSpreadsheet size={22} style={{ color: '#16a34a' }} />
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Subir Calificaciones Docentes (Excel)</h2>
                  <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#64748b', fontWeight: 400 }}>
                    Carga masiva de evaluaciones docentes {periodoActivo?.nombre ? `· Período activo: ${periodoActivo.nombre}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="modal-close-btn"
                onClick={cerrarModalImportarExcel}
                disabled={subiendoExcel}
                aria-label="Cerrar modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="aso-excel-info-box">
                <div style={{ fontWeight: 600, marginBottom: '0.35rem', color: '#1e3a8a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Info size={15} />
                  <span>Orden requerido de columnas en el archivo Excel (.xlsx / .xls):</span>
                </div>
                <div className="aso-excel-columns-pill-list">
                  <span>1. Número de identificación</span>
                  <span>2. Nombre</span>
                  <span>3. Código</span>
                  <span>4. Grupo</span>
                  <span>5. Nombre de asignatura</span>
                  <span>6. Calificación</span>
                </div>
                <ul className="aso-excel-rules-list">
                  <li>Si el docente dictó la misma asignatura en varios grupos, se calcula automáticamente el <strong>promedio</strong> de sus calificaciones.</li>
                  <li>Si la calificación está vacía o es <strong>0</strong>, el docente quedará registrado como <strong>«No evaluado»</strong>.</li>
                </ul>
              </div>

              <div className="aso-excel-dropzone">
                <input
                  ref={inputExcelRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    setArchivoExcel(f)
                    setErrorExcel('')
                    setResultadoExcel(null)
                  }}
                />
                <FileSpreadsheet size={28} style={{ color: archivoExcel ? '#16a34a' : '#64748b' }} />
                {archivoExcel ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>{archivoExcel.name}</div>
                    <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '0.15rem' }}>
                      {(archivoExcel.size / 1024).toFixed(1)} KB
                    </div>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: '#475569', fontSize: '0.88rem' }}>
                    Seleccione el archivo Excel con las calificaciones docentes
                  </div>
                )}
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => inputExcelRef.current?.click()}
                  disabled={subiendoExcel}
                >
                  <Upload size={14} />
                  <span>{archivoExcel ? 'Cambiar archivo' : 'Seleccionar archivo Excel'}</span>
                </button>
              </div>

              {errorExcel && (
                <div className="aso-excel-error">
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{errorExcel}</span>
                </div>
              )}

              {resultadoExcel && (
                <div className="aso-excel-result">
                  <div className="aso-excel-result-header">
                    <CheckCircle2 size={18} style={{ color: '#16a34a' }} />
                    <span>
                      Importación completada (Período registrado: <strong>{resultadoExcel.periodo_nombre}</strong>)
                    </span>
                  </div>
                  <div className="aso-excel-stats">
                    <div className="aso-excel-stat">
                      <span>Filas leídas</span>
                      <strong>{resultadoExcel.total_filas_leidas}</strong>
                    </div>
                    <div className="aso-excel-stat">
                      <span>Guardados</span>
                      <strong>{resultadoExcel.total_registros_guardados}</strong>
                    </div>
                    <div className="aso-excel-stat">
                      <span>Promediados</span>
                      <strong>{resultadoExcel.total_promediados}</strong>
                    </div>
                    <div className="aso-excel-stat">
                      <span>No evaluados</span>
                      <strong>{resultadoExcel.total_no_evaluados}</strong>
                    </div>
                  </div>

                  {resultadoExcel.detalles?.length > 0 && (
                    <div className="aso-excel-table-wrap">
                      <table className="aso-excel-table">
                        <thead>
                          <tr>
                            <th>Identificación</th>
                            <th>Docente</th>
                            <th>Asignatura</th>
                            <th>Grupos</th>
                            <th>Calificación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {resultadoExcel.detalles.map((d, idx) => (
                            <tr key={`${d.numero_documento}-${d.code_course}-${idx}`}>
                              <td>{d.numero_documento}</td>
                              <td>{d.nombre_docente}</td>
                              <td>{d.code_course} - {d.nombre_asignatura}</td>
                              <td style={{ textAlign: 'center' }}>{d.cantidad_grupos}</td>
                              <td style={{ textAlign: 'center' }}>
                                <span className={`aso-excel-grade-pill ${d.etiqueta === 'No evaluado' ? 'no-evaluado' : 'evaluado'}`}>
                                  {d.etiqueta === 'No evaluado' ? 'No evaluado' : `${Number(d.calificacion).toFixed(2)} / 5.00`}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {resultadoExcel.errores?.length > 0 && (
                    <div className="aso-excel-warnings">
                      <strong>Observaciones ({resultadoExcel.errores.length}):</strong>
                      <ul>
                        {resultadoExcel.errores.map((errMsg, idx) => (
                          <li key={idx}>{errMsg}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={cerrarModalImportarExcel}
                disabled={subiendoExcel}
              >
                {resultadoExcel ? 'Cerrar' : 'Cancelar'}
              </button>
              <button
                type="button"
                className="btn-primary aso-btn-subir-excel"
                onClick={handleSubirExcel}
                disabled={!archivoExcel || subiendoExcel}
              >
                {subiendoExcel ? (
                  <>
                    <RefreshCw size={14} className="spin" />
                    <span>Procesando Excel...</span>
                  </>
                ) : (
                  <>
                    <Upload size={14} />
                    <span>Cargar Calificaciones</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
