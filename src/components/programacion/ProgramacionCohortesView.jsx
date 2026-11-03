import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarDays,
  Layers,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  BookOpen,
  Info,
  Sparkles,
  Filter,
  Search,
  Check,
  RotateCcw
} from 'lucide-react'
import { getPeriodos, getProgramas } from '../../services/academicService'
import { getCohortes, guardarCohortes, getPropuestaCohortes } from '../../services/cohortesService'
import { generarProgramacion, getProgramacion, getResumenProgramacion } from '../../services/programacionService'
import './ProgramacionCohortesView.css'

export default function ProgramacionCohortesView({ onShowToast }) {
  const [periodos, setPeriodos] = useState([])
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('')
  const [programas, setProgramas] = useState([])
  const [selectedProgramCode, setSelectedProgramCode] = useState('')

  const [activeTab, setActiveTab] = useState('cohortes') // 'cohortes' | 'generacion' | 'cursos'
  const [loading, setLoading] = useState(false)
  const [savingCohortes, setSavingCohortes] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Datos del periodo actual
  const [allCohortes, setAllCohortes] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cursos, setCursos] = useState([])

  // Estado para edición de cohortes del programa seleccionado
  // Array de { semestre: number, jornada: 'DIURNA'|'NOCTURNA', numeroResolucion: string, activo: boolean, confirmada: boolean }
  const [programCohortes, setProgramCohortes] = useState([])

  // Estado modal propuesta
  const [isPropuestaModalOpen, setIsPropuestaModalOpen] = useState(false)
  const [selectedPeriodoAnteriorId, setSelectedPeriodoAnteriorId] = useState('')
  const [propuestas, setPropuestas] = useState([])
  const [confirmarForzado, setConfirmarForzado] = useState(false)
  const [loadingPropuesta, setLoadingPropuesta] = useState(false)

  // Estado confirmación regenerar
  const [isConfirmRegenerarOpen, setIsConfirmRegenerarOpen] = useState(false)

  // Filtros cursos
  const [filterProgram, setFilterProgram] = useState('')
  const [filterJornada, setFilterJornada] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  // 1. Cargar períodos y programas al montar
  useEffect(() => {
    async function loadInitial() {
      setLoading(true)
      try {
        const [periodosData, programasData] = await Promise.all([
          getPeriodos(),
          getProgramas()
        ])
        setPeriodos(periodosData || [])
        setProgramas(programasData || [])

        // Seleccionar periodo vigente por defecto
        const vigente = periodosData?.find(p => p.vigente) || periodosData?.[0]
        if (vigente) {
          setSelectedPeriodoId(String(vigente.id))
        }
        if (programasData?.length > 0) {
          setSelectedProgramCode(programasData[0].code_program)
        }
      } catch (err) {
        onShowToast?.(err.message || 'Error al cargar datos iniciales', 'error')
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [onShowToast])

  const selectedPeriodo = useMemo(() => {
    return periodos.find(p => String(p.id) === String(selectedPeriodoId))
  }, [periodos, selectedPeriodoId])

  const selectedPrograma = useMemo(() => {
    return programas.find(p => p.code_program === selectedProgramCode)
  }, [programas, selectedProgramCode])

  // 2. Cargar cohortes, resumen y cursos cuando cambia el periodo
  const loadPeriodoData = useCallback(async () => {
    if (!selectedPeriodoId) return
    setLoading(true)
    try {
      const [cohortesData, resumenData, cursosData] = await Promise.all([
        getCohortes(selectedPeriodoId).catch(() => []),
        getResumenProgramacion(selectedPeriodoId).catch(() => null),
        getProgramacion(selectedPeriodoId).catch(() => [])
      ])
      setAllCohortes(cohortesData || [])
      setResumen(resumenData)
      setCursos(cursosData || [])
    } catch (err) {
      onShowToast?.(err.message || 'Error al cargar datos del período', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedPeriodoId, onShowToast])

  useEffect(() => {
    loadPeriodoData()
  }, [loadPeriodoData])

  // 3. Sincronizar el formulario de cohortes del programa seleccionado
  useEffect(() => {
    if (!selectedPrograma) return

    const duracionDiurna = selectedPrograma.numero_semestre || 10
    const duracionNocturna = selectedPrograma.semestres_nocturna || duracionDiurna
    const jornadaProg = selectedPrograma.jornada || 'DIURNA'
    const maxSemestres = jornadaProg === 'NOCTURNA' ? duracionNocturna : duracionDiurna
    const resolucionBase = selectedPrograma.numero_resolucion || 'Resolución Vigente'

    // Cohortes existentes en BD para este programa y periodo
    const existentes = allCohortes.filter(c => c.codeProgram === selectedPrograma.code_program)

    const items = []
    for (let sem = 1; sem <= maxSemestres; sem++) {
      const cohorteExistente = existentes.find(c => c.semestre === sem)
      items.push({
        semestre: sem,
        activo: Boolean(cohorteExistente),
        jornada: cohorteExistente?.jornada || (jornadaProg === 'NOCTURNA' ? 'NOCTURNA' : 'DIURNA'),
        numeroResolucion: cohorteExistente?.numeroResolucion || resolucionBase,
        confirmada: cohorteExistente?.confirmada ?? true,
        enExtincion: cohorteExistente ? cohorteExistente.numeroResolucion !== resolucionBase : false
      })
    }
    setProgramCohortes(items)
  }, [selectedPrograma, allCohortes])

  // Manejadores para edición de cohortes
  const toggleSemestreActivo = (semestre) => {
    setProgramCohortes(prev => prev.map(item => {
      if (item.semestre === semestre) {
        return { ...item, activo: !item.activo }
      }
      return item
    }))
  }

  const updateCohorteField = (semestre, field, value) => {
    setProgramCohortes(prev => prev.map(item => {
      if (item.semestre === semestre) {
        const updated = { ...item, [field]: value }
        if (field === 'numeroResolucion') {
          updated.enExtincion = value !== selectedPrograma?.numero_resolucion
        }
        return updated
      }
      return item
    }))
  }

  const handleGuardarCohortes = async () => {
    if (!selectedPeriodoId || !selectedPrograma) return

    const cohortesAGuardar = programCohortes
      .filter(c => c.activo)
      .map(c => ({
        semestre: c.semestre,
        jornada: c.jornada,
        numeroResolucion: c.numeroResolucion.trim(),
        confirmada: c.confirmada
      }))

    setSavingCohortes(true)
    try {
      await guardarCohortes(selectedPeriodoId, selectedPrograma.code_program, cohortesAGuardar)
      onShowToast?.(`Cohortes guardadas correctamente para ${selectedPrograma.name_program}`, 'success')
      await loadPeriodoData()
    } catch (err) {
      onShowToast?.(err.message || 'Error al guardar las cohortes', 'error')
    } finally {
      setSavingCohortes(false)
    }
  }

  // Manejo de la propuesta automática (HU-043)
  const handleAbrirPropuesta = () => {
    // Buscar periodo anterior por orden de fecha
    const otrosPeriodos = periodos.filter(p => String(p.id) !== String(selectedPeriodoId))
    if (otrosPeriodos.length > 0) {
      setSelectedPeriodoAnteriorId(String(otrosPeriodos[0].id))
    }
    setIsPropuestaModalOpen(true)
    setPropuestas([])
    setConfirmarForzado(false)
  }

  const handleConsultarPropuesta = async () => {
    if (!selectedPeriodoId) return
    setLoadingPropuesta(true)
    try {
      const data = await getPropuestaCohortes(selectedPeriodoId, selectedPeriodoAnteriorId || null, confirmarForzado)
      setPropuestas(data || [])
    } catch (err) {
      onShowToast?.(err.message || 'Error al calcular propuesta', 'error')
    } finally {
      setLoadingPropuesta(false)
    }
  }

  const handleAplicarPropuesta = (propuestaProg) => {
    if (!propuestaProg) return
    const semestresPropuestos = new Map(propuestaProg.cohortesPropuestas.map(i => [i.semestre, i]))

    setProgramCohortes(prev => prev.map(item => {
      const prop = semestresPropuestos.get(item.semestre)
      if (prop) {
        return {
          ...item,
          activo: true,
          jornada: prop.jornada || item.jornada,
          numeroResolucion: prop.numeroResolucion || item.numeroResolucion,
          enExtincion: Boolean(prop.enExtincion)
        }
      } else {
        return { ...item, activo: false }
      }
    }))

    setIsPropuestaModalOpen(false)
    onShowToast?.(`Propuesta de avance cargada para ${propuestaProg.nombrePrograma}. Revise y guarde los cambios.`, 'info')
  }

  // Generación de Programación (HU-045)
  const handleEjecutarGeneracion = async (sobrescribir = false) => {
    if (!selectedPeriodoId) return
    setGenerating(true)
    try {
      const res = await generarProgramacion(selectedPeriodoId, sobrescribir)
      onShowToast?.(res.mensaje || `Programación generada exitosamente con ${res.totalCursos} cursos.`, 'success')
      setIsConfirmRegenerarOpen(false)
      await loadPeriodoData()
      setActiveTab('cursos')
    } catch (err) {
      if (err.status === 409 || err.message?.includes('Requiere confirmación')) {
        setIsConfirmRegenerarOpen(true)
      } else {
        onShowToast?.(err.message || 'Error al generar la programación', 'error')
      }
    } finally {
      setGenerating(false)
    }
  }

  // Filtrado de cursos
  const filteredCursos = useMemo(() => {
    return cursos.filter(c => {
      const matchProg = !filterProgram || c.codeProgram === filterProgram
      const matchJor = !filterJornada || c.jornada === filterJornada
      const q = searchTerm.toLowerCase().trim()
      const matchSearch = !q ||
        c.codeCourse?.toLowerCase().includes(q) ||
        c.nombreAsignatura?.toLowerCase().includes(q) ||
        c.nombrePrograma?.toLowerCase().includes(q)
      return matchProg && matchJor && matchSearch
    })
  }, [cursos, filterProgram, filterJornada, searchTerm])

  return (
    <div className="programacion-cohortes-container">
      {/* 1. Header con Selección de Período */}
      <div className="pc-header">
        <div>
          <h2 className="pc-title">Oferta de Cohortes y Programación Académica</h2>
          <p className="pc-subtitle">
            Configure las cohortes activas por programa y genere automáticamente la oferta de cursos a partir de las mallas curriculares.
          </p>
        </div>

        <div className="pc-periodo-selector">
          <label htmlFor="periodo-select">Período Académico:</label>
          <div className="pc-select-wrapper">
            <CalendarDays size={18} className="pc-select-icon" />
            <select
              id="periodo-select"
              value={selectedPeriodoId}
              onChange={(e) => setSelectedPeriodoId(e.target.value)}
              className="pc-select"
            >
              {periodos.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} {p.vigente ? '★ (Vigente)' : ''} - Res. {p.numeroResolucion}
                </option>
              ))}
            </select>
          </div>
          {selectedPeriodo && (
            <span className={`pc-badge ${selectedPeriodo.vigente ? 'pc-badge-success' : 'pc-badge-neutral'}`}>
              {selectedPeriodo.estado || (selectedPeriodo.vigente ? 'VIGENTE' : 'HISTORIAL')}
            </span>
          )}
        </div>
      </div>

      {/* 2. Barra de Pestañas */}
      <div className="pc-tabs-nav">
        <button
          className={`pc-tab-btn ${activeTab === 'cohortes' ? 'active' : ''}`}
          onClick={() => setActiveTab('cohortes')}
        >
          <Layers size={18} />
          <span>1. Oferta de Cohortes por Programa</span>
        </button>

        <button
          className={`pc-tab-btn ${activeTab === 'generacion' ? 'active' : ''}`}
          onClick={() => setActiveTab('generacion')}
        >
          <Sparkles size={18} />
          <span>2. Generar Programación</span>
          {resumen && resumen.totalCursos > 0 && (
            <span className="pc-tab-counter">{resumen.totalCursos}</span>
          )}
        </button>

        <button
          className={`pc-tab-btn ${activeTab === 'cursos' ? 'active' : ''}`}
          onClick={() => setActiveTab('cursos')}
        >
          <BookOpen size={18} />
          <span>3. Cursos Programados</span>
          <span className="pc-tab-counter">{cursos.length}</span>
        </button>
      </div>

      {/* 3. Contenido de las Pestañas */}
      {activeTab === 'cohortes' && (
        <div className="pc-tab-content">
          <div className="pc-cohortes-layout">
            {/* Panel de Selección de Programa y Acciones */}
            <div className="pc-panel pc-program-header-panel">
              <div className="pc-panel-header">
                <div>
                  <h3 className="pc-panel-title">Configuración de Semestres Ofertados</h3>
                  <p className="pc-panel-desc">
                    Marque los semestres que cursan en este período y confirme la resolución de la malla correspondiente.
                  </p>
                </div>

                <div className="pc-actions-row">
                  <button
                    type="button"
                    className="pc-btn pc-btn-secondary"
                    onClick={handleAbrirPropuesta}
                    title="Proponer automáticamente el avance de semestres desde un período anterior"
                  >
                    <RotateCcw size={16} />
                    <span>Proponer avance desde período anterior</span>
                  </button>

                  <button
                    type="button"
                    className="pc-btn pc-btn-primary"
                    onClick={handleGuardarCohortes}
                    disabled={savingCohortes}
                  >
                    {savingCohortes ? <RefreshCw size={16} className="pc-spin" /> : <Save size={16} />}
                    <span>Guardar Cohortes del Programa</span>
                  </button>
                </div>
              </div>

              {/* Selector de programa */}
              <div className="pc-program-picker">
                <label>Programa Académico:</label>
                <select
                  value={selectedProgramCode}
                  onChange={(e) => setSelectedProgramCode(e.target.value)}
                  className="pc-select"
                >
                  {programas.map(prog => {
                    const count = allCohortes.filter(c => c.codeProgram === prog.code_program).length
                    return (
                      <option key={prog.code_program} value={prog.code_program}>
                        {prog.code_program} - {prog.name_program} ({count > 0 ? `${count} cohortes activas` : 'Sin cohortes'})
                      </option>
                    )
                  })}
                </select>

                {selectedPrograma && (
                  <div className="pc-program-meta">
                    <span><strong>Jornada:</strong> {selectedPrograma.jornada}</span>
                    <span><strong>Duración:</strong> {selectedPrograma.numero_semestre || 10} sem. diurna {selectedPrograma.semestres_nocturna ? `/ ${selectedPrograma.semestres_nocturna} nocturna` : ''}</span>
                    <span><strong>Ingreso:</strong> {selectedPrograma.ingreso || 'SEMESTRAL'}</span>
                    <span><strong>Resolución Vigente:</strong> {selectedPrograma.numero_resolucion || 'Malla Principal'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Matriz de semestres ofertados (1 al N) */}
            <div className="pc-semestres-grid">
              {programCohortes.map((cohorte) => (
                <div
                  key={cohorte.semestre}
                  className={`pc-semestre-card ${cohorte.activo ? 'activo' : 'inactivo'}`}
                >
                  <div className="pc-card-header">
                    <label className="pc-toggle-label">
                      <input
                        type="checkbox"
                        checked={cohorte.activo}
                        onChange={() => toggleSemestreActivo(cohorte.semestre)}
                      />
                      <span className="pc-semestre-num">Semestre {cohorte.semestre}</span>
                    </label>

                    <span className={`pc-badge ${cohorte.activo ? 'pc-badge-success' : 'pc-badge-neutral'}`}>
                      {cohorte.activo ? 'Ofertado' : 'No Ofertado'}
                    </span>
                  </div>

                  {cohorte.activo && (
                    <div className="pc-card-body">
                      <div className="pc-field-group">
                        <label>Jornada:</label>
                        <select
                          value={cohorte.jornada}
                          onChange={(e) => updateCohorteField(cohorte.semestre, 'jornada', e.target.value)}
                          className="pc-select-sm"
                        >
                          <option value="DIURNA">Diurna</option>
                          <option value="NOCTURNA">Nocturna</option>
                        </select>
                      </div>

                      <div className="pc-field-group">
                        <label>Resolución de Malla:</label>
                        <input
                          type="text"
                          value={cohorte.numeroResolucion}
                          onChange={(e) => updateCohorteField(cohorte.semestre, 'numeroResolucion', e.target.value)}
                          placeholder="Ej. Res. 084 de 2021"
                          className="pc-input-sm"
                        />
                      </div>

                      <div className="pc-card-footer">
                        {cohorte.enExtincion ? (
                          <span className="pc-pill pc-pill-warning" title="Esta cohorte cursa una malla en extinción">
                            Malla en extinción
                          </span>
                        ) : (
                          <span className="pc-pill pc-pill-success" title="Malla curricular vigente">
                            Malla vigente
                          </span>
                        )}

                        <label className="pc-confirm-check">
                          <input
                            type="checkbox"
                            checked={cohorte.confirmada}
                            onChange={(e) => updateCohorteField(cohorte.semestre, 'confirmada', e.target.checked)}
                          />
                          <span>Confirmada</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Resumen de estado de programas */}
            <div className="pc-panel pc-programas-status-panel">
              <h4 className="pc-panel-title">Estado Global de Cohortes en el Período</h4>
              <div className="pc-status-table-wrapper">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Programa</th>
                      <th>Jornada</th>
                      <th>Cohortes Activas</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programas.map(prog => {
                      const cohortesProg = allCohortes.filter(c => c.codeProgram === prog.code_program)
                      const semestresStr = cohortesProg.map(c => c.semestre + 'º').join(', ')
                      const configurado = cohortesProg.length > 0

                      return (
                        <tr key={prog.code_program}>
                          <td><strong>{prog.code_program}</strong></td>
                          <td>{prog.name_program}</td>
                          <td>{prog.jornada}</td>
                          <td>{configurado ? semestresStr : <span className="pc-text-muted">Ninguna</span>}</td>
                          <td>
                            <span className={`pc-badge ${configurado ? 'pc-badge-success' : 'pc-badge-warning'}`}>
                              {configurado ? 'Configurado' : 'Pendiente'}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className="pc-btn-link"
                              onClick={() => setSelectedProgramCode(prog.code_program)}
                            >
                              Configurar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pestaña 2: Generar Programación */}
      {activeTab === 'generacion' && (
        <div className="pc-tab-content">
          <div className="pc-generation-card">
            <div className="pc-gen-icon-bg">
              <Sparkles size={32} />
            </div>
            <h3>Generador Automático de Programación</h3>
            <p className="pc-gen-desc">
              Esta operación analiza todas las cohortes confirmadas para el período <strong>{selectedPeriodo?.nombre}</strong>,
              extrae las asignaturas obligatorias desde la malla curricular correspondiente y crea los cursos con sus grupos
              consecutivos (desde el grupo 50). Las electivas profesionales no se generan de forma automática.
            </p>

            <div className="pc-gen-stats">
              <div className="pc-stat-box">
                <span className="pc-stat-num">{allCohortes.filter(c => c.confirmada).length}</span>
                <span className="pc-stat-label">Cohortes Confirmadas</span>
              </div>
              <div className="pc-stat-box">
                <span className="pc-stat-num">{programas.length}</span>
                <span className="pc-stat-label">Programas Académicos</span>
              </div>
              <div className="pc-stat-box">
                <span className="pc-stat-num">{resumen?.totalCursos ?? cursos.length}</span>
                <span className="pc-stat-label">Cursos Actualmente Programados</span>
              </div>
            </div>

            <div className="pc-gen-action">
              <button
                type="button"
                className="pc-btn pc-btn-primary pc-btn-lg"
                onClick={() => handleEjecutarGeneracion(false)}
                disabled={generating}
              >
                {generating ? <RefreshCw size={20} className="pc-spin" /> : <Play size={20} />}
                <span>Generar Programación del Período</span>
              </button>
            </div>

            {/* Resumen detallado si existe */}
            {resumen && resumen.programas && resumen.programas.length > 0 && (
              <div className="pc-resumen-box">
                <div className="pc-resumen-header">
                  <CheckCircle2 size={20} className="pc-text-success" />
                  <h4>Resumen de Cursos Generados ({resumen.totalCursos} cursos en total)</h4>
                </div>
                <div className="pc-resumen-grid">
                  {resumen.programas.map(item => (
                    <div key={item.codeProgram} className="pc-resumen-item">
                      <span className="pc-resumen-prog">{item.nombrePrograma}</span>
                      <span className="pc-resumen-count">{item.totalCursos} cursos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Pestaña 3: Cursos Programados */}
      {activeTab === 'cursos' && (
        <div className="pc-tab-content">
          <div className="pc-panel">
            {/* Filtros */}
            <div className="pc-filters-bar">
              <div className="pc-search-box">
                <Search size={16} className="pc-search-icon" />
                <input
                  type="text"
                  placeholder="Buscar por código, nombre de materia o carrera..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pc-input"
                />
              </div>

              <div className="pc-filter-group">
                <Filter size={16} />
                <select
                  value={filterProgram}
                  onChange={(e) => setFilterProgram(e.target.value)}
                  className="pc-select"
                >
                  <option value="">Todos los programas</option>
                  {programas.map(p => (
                    <option key={p.code_program} value={p.code_program}>
                      {p.name_program}
                    </option>
                  ))}
                </select>

                <select
                  value={filterJornada}
                  onChange={(e) => setFilterJornada(e.target.value)}
                  className="pc-select"
                >
                  <option value="">Todas las jornadas</option>
                  <option value="DIURNA">Diurna</option>
                  <option value="NOCTURNA">Nocturna</option>
                </select>
              </div>
            </div>

            {/* Tabla de cursos */}
            <div className="pc-table-wrapper">
              <table className="pc-table">
                <thead>
                  <tr>
                    <th>Grupo</th>
                    <th>Código</th>
                    <th>Asignatura</th>
                    <th>Semestre</th>
                    <th>Jornada</th>
                    <th>Créditos</th>
                    <th>Programa</th>
                    <th>Resolución</th>
                    <th>Docente</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCursos.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="pc-empty-cell">
                        No hay cursos para mostrar. Vaya a la pestaña "Generar Programación" si aún no ha generado la oferta.
                      </td>
                    </tr>
                  ) : (
                    filteredCursos.map((curso) => (
                      <tr key={curso.id}>
                        <td><span className="pc-grupo-badge">{curso.codeCourse}-{curso.grupo || '50'}</span></td>
                        <td><code>{curso.codeCourse}</code></td>
                        <td><strong>{curso.nombreAsignatura}</strong></td>
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
                          <span className={`pc-badge ${curso.estado === 'ASIGNADO' ? 'pc-badge-success' : 'pc-badge-warning'}`}>
                            {curso.estado}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Propuesta de Avance Automático (HU-043) */}
      {isPropuestaModalOpen && (
        <div className="pc-modal-backdrop">
          <div className="pc-modal">
            <div className="pc-modal-header">
              <h3>Propuesta Automática de Cohortes del Siguiente Período</h3>
              <button
                type="button"
                className="pc-btn-close"
                onClick={() => setIsPropuestaModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="pc-modal-body">
              <p>
                El sistema calcula la sucesión de cohortes rotando cada semestre <em>c $\to$ c + 1</em> y proponiendo
                nuevo ingreso en primer semestre con la resolución vigente. Las cohortes avanzadas conservan su resolución
                histórica hasta extinguirse.
              </p>

              <div className="pc-field-group">
                <label>Tomar como base el período anterior:</label>
                <select
                  value={selectedPeriodoAnteriorId}
                  onChange={(e) => setSelectedPeriodoAnteriorId(e.target.value)}
                  className="pc-select"
                >
                  {periodos
                    .filter(p => String(p.id) !== String(selectedPeriodoId))
                    .map(p => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} ({p.estado || (p.vigente ? 'Vigente' : 'Historial')})
                      </option>
                    ))}
                </select>
              </div>

              {/* Advertencia si periodo fue cancelado */}
              {propuestas.some(p => p.advertenciaPeriodoAnterior) && (
                <div className="pc-alert pc-alert-warning">
                  <AlertTriangle size={18} />
                  <div>
                    <strong>Período anterior con novedad o cancelado:</strong>
                    <p>{propuestas[0].advertenciaPeriodoAnterior}</p>
                    <label className="pc-confirm-check">
                      <input
                        type="checkbox"
                        checked={confirmarForzado}
                        onChange={(e) => setConfirmarForzado(e.target.checked)}
                      />
                      <span>Confirmar y forzar avance de cohortes a pesar de la advertencia</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="pc-modal-actions-bar">
                <button
                  type="button"
                  className="pc-btn pc-btn-primary"
                  onClick={handleConsultarPropuesta}
                  disabled={loadingPropuesta}
                >
                  {loadingPropuesta ? <RefreshCw size={16} className="pc-spin" /> : <Sparkles size={16} />}
                  <span>Calcular Propuesta</span>
                </button>
              </div>

              {/* Resultados calculados de la propuesta */}
              {propuestas.length > 0 && (
                <div className="pc-propuestas-list">
                  {propuestas.map(progProp => {
                    const esSeleccionado = progProp.codeProgram === selectedProgramCode
                    return (
                      <div
                        key={progProp.codeProgram}
                        className={`pc-propuesta-card ${esSeleccionado ? 'highlight' : ''}`}
                      >
                        <div className="pc-prop-header">
                          <div>
                            <strong>{progProp.codeProgram} - {progProp.nombrePrograma}</strong>
                            <div className="pc-text-muted">
                              Cohortes propuestas: {progProp.cohortesPropuestas.length > 0
                                ? progProp.cohortesPropuestas.map(i => `${i.semestre}º (${i.numeroResolucion})`).join(', ')
                                : 'Sin avance automático'}
                            </div>
                          </div>

                          <button
                            type="button"
                            className="pc-btn pc-btn-secondary pc-btn-sm"
                            onClick={() => {
                              setSelectedProgramCode(progProp.codeProgram)
                              handleAplicarPropuesta(progProp)
                            }}
                          >
                            <Check size={14} />
                            <span>Aplicar a {progProp.codeProgram}</span>
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirmación de Regenerar Programación */}
      {isConfirmRegenerarOpen && (
        <div className="pc-modal-backdrop">
          <div className="pc-modal pc-modal-sm">
            <div className="pc-modal-header">
              <div className="pc-modal-title-with-icon">
                <AlertTriangle size={24} className="pc-text-warning" />
                <h3>Regenerar Programación</h3>
              </div>
              <button
                type="button"
                className="pc-btn-close"
                onClick={() => setIsConfirmRegenerarOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="pc-modal-body">
              <p>
                Ya existe una programación generada para el período <strong>{selectedPeriodo?.nombre}</strong>.
              </p>
              <p>
                Al volver a generar, <strong>se conservarán los docentes que ya hayan sido asignados</strong> a los cursos
                cuyas materias sigan ofertándose.
              </p>
              <p className="pc-text-muted">
                ¿Desea sobrescribir la programación actual?
              </p>
            </div>

            <div className="pc-modal-footer">
              <button
                type="button"
                className="pc-btn pc-btn-secondary"
                onClick={() => setIsConfirmRegenerarOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-warning"
                onClick={() => handleEjecutarGeneracion(true)}
                disabled={generating}
              >
                {generating ? <RefreshCw size={16} className="pc-spin" /> : <Play size={16} />}
                <span>Confirmar y Regenerar</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
