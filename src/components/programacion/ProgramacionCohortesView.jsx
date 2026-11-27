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
  Sparkles,
  RotateCcw,
  TrendingUp
} from 'lucide-react'
import { getPeriodos, getProgramas, getPensumByProgram } from '../../services/academicService'
import { getCohortes, guardarCohortes, guardarCohortesLote, getPropuestaCohortes } from '../../services/cohortesService'
import { generarProgramacion, getProgramacion, getResumenProgramacion, getCuposConfig } from '../../services/programacionService'
import CursosProgramadosPanel from './CursosProgramadosPanel'
import AvanceProgramacionView from './AvanceProgramacionView'
import './ProgramacionCohortesView.css'

export default function ProgramacionCohortesView({ onShowToast, user, coordinadorPerfil, onNavigateToPeriodos }) {
  const rol = Number(user?.rol ?? 1)
  const isAdmin = rol === 1
  const isCoordinador = rol === 2
  const coordCode = coordinadorPerfil?.code_program || ''

  const [periodos, setPeriodos] = useState([])
  const [periodosCargados, setPeriodosCargados] = useState(false)
  const [selectedPeriodoId, setSelectedPeriodoId] = useState('')
  const [programas, setProgramas] = useState([])
  const [selectedProgramCode, setSelectedProgramCode] = useState('')

  const [activeTab, setActiveTab] = useState(isCoordinador ? 'cursos' : 'cohortes')
  const [loading, setLoading] = useState(true)
  const [cohortesCargadas, setCohortesCargadas] = useState(false)
  const [savingCohortes, setSavingCohortes] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingCohortes, setGeneratingCohortes] = useState(false)
  const [selectedAdmissionCodes, setSelectedAdmissionCodes] = useState([])
  const [cohortesConfigOpen, setCohortesConfigOpen] = useState(false)
  const [admisionesOpen, setAdmisionesOpen] = useState(false)
  const [cohortesLoadError, setCohortesLoadError] = useState('')
  const [advertenciaGeneracion, setAdvertenciaGeneracion] = useState('')
  const [confirmarAvanceForzado, setConfirmarAvanceForzado] = useState(false)

  // Datos del periodo actual
  const [allCohortes, setAllCohortes] = useState([])
  const [resumen, setResumen] = useState(null)
  const [cursos, setCursos] = useState([])
  // HU-059: máximo de cupos y plazo de edición para el usuario de la sesión.
  const [cuposConfig, setCuposConfig] = useState(null)
  const [cuposConfigCargando, setCuposConfigCargando] = useState(true)

  // Estado para edición de cohortes del programa seleccionado
  // Array de { semestre: number, jornada: 'DIURNA'|'NOCTURNA', numeroResolucion: string, activo: boolean, confirmada: boolean }
  const [programCohortes, setProgramCohortes] = useState([])

  // Resolución vigente obtenida del pensum del programa seleccionado (puede ser null)
  const [resolucionVigentePensum, setResolucionVigentePensum] = useState(null)

  // Estado confirmación regenerar
  const [isConfirmRegenerarOpen, setIsConfirmRegenerarOpen] = useState(false)

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

        // El coordinador solo trabaja con su programa.
        const programasVisibles = isCoordinador
          ? (programasData || []).filter(p => p.code_program === coordCode)
          : (programasData || [])
        setProgramas(programasVisibles)

        // Seleccionar periodo vigente por defecto
        const vigente = periodosData?.find(p => p.vigente)
        if (vigente) {
          setSelectedPeriodoId(String(vigente.id))
        } else {
          setCohortesCargadas(true)
        }
        if (isCoordinador) {
          if (coordCode) setSelectedProgramCode(coordCode)
        } else if (programasData?.length > 0) {
          setSelectedProgramCode(programasData[0].code_program)
        }
      } catch (err) {
        setCohortesCargadas(true)
        onShowToast?.(err.message || 'Error al cargar datos iniciales', 'error')
      } finally {
        setPeriodosCargados(true)
        setLoading(false)
      }
    }
    loadInitial()
  }, [onShowToast, isCoordinador, coordCode])

  const selectedPeriodo = useMemo(() => {
    return periodos.find(p => String(p.id) === String(selectedPeriodoId))
  }, [periodos, selectedPeriodoId])

  const periodoAnterior = useMemo(() => {
    if (!selectedPeriodo) return null
    const fechaActual = selectedPeriodo.fechaInicioSemestre || selectedPeriodo.fecha_inicio_semestre
    if (!fechaActual) return null

    return periodos
      .filter(periodo => {
        const fecha = periodo.fechaInicioSemestre || periodo.fecha_inicio_semestre
        return String(periodo.id) !== String(selectedPeriodoId) && fecha && fecha < fechaActual
      })
      .sort((a, b) => {
        const fechaA = a.fechaInicioSemestre || a.fecha_inicio_semestre
        const fechaB = b.fechaInicioSemestre || b.fecha_inicio_semestre
        return String(fechaB).localeCompare(String(fechaA))
      })[0] || null
  }, [periodos, selectedPeriodo, selectedPeriodoId])

  const selectedPrograma = useMemo(() => {
    return programas.find(p => p.code_program === selectedProgramCode)
  }, [programas, selectedProgramCode])

  const cursosVisibles = useMemo(() => {
    if (!isCoordinador || !coordCode) return cursos
    return cursos.filter(c => c.codeProgram === coordCode)
  }, [cursos, isCoordinador, coordCode])

  // 2. Cargar cohortes, resumen y cursos cuando cambia el periodo
  const loadPeriodoData = useCallback(async () => {
    if (!selectedPeriodoId) {
      setCohortesLoadError('')
      setCuposConfigCargando(false)
      return
    }
    setLoading(true)
    setCohortesLoadError('')
    setCuposConfigCargando(true)
    setCuposConfig(null)
    try {
      const [cohortesData, resumenData, cursosData, cuposData] = await Promise.all([
        getCohortes(selectedPeriodoId),
        getResumenProgramacion(selectedPeriodoId).catch(() => null),
        getProgramacion(
          selectedPeriodoId,
          isCoordinador && coordCode ? { codeProgram: coordCode } : {}
        ).catch(() => []),
        getCuposConfig(selectedPeriodoId).catch(() => null)
      ])
      setAllCohortes(cohortesData || [])
      setResumen(resumenData)
      setCursos(cursosData || [])
      setCuposConfig(cuposData)
    } catch (err) {
      setCohortesLoadError(err.message || 'No fue posible consultar las cohortes del período.')
      onShowToast?.(err.message || 'Error al cargar datos del período', 'error')
    } finally {
      setLoading(false)
      setCohortesCargadas(true)
      setCuposConfigCargando(false)
    }
  }, [selectedPeriodoId, onShowToast, isCoordinador, coordCode])

  useEffect(() => {
    loadPeriodoData()
  }, [loadPeriodoData])

  // 3a. Cargar la resolución vigente real desde el pensum cuando cambia el programa
  useEffect(() => {
    if (!selectedPrograma) {
      setResolucionVigentePensum(null)
      return
    }
    // Si el programa ya trae la resolución, la usamos directamente
    if (selectedPrograma.numero_resolucion) {
      setResolucionVigentePensum(selectedPrograma.numero_resolucion)
      return
    }
    // Fallback: consultar el pensum para extraer la resolución (datos legacy con NULL en programas)
    getPensumByProgram(selectedPrograma.code_program)
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          const res = data.find(p => p.numeroResolucion)?.numeroResolucion || null
          setResolucionVigentePensum(res)
        } else {
          setResolucionVigentePensum(null)
        }
      })
      .catch(() => setResolucionVigentePensum(null))
  }, [selectedPrograma])

  // 3b. Sincronizar el formulario de cohortes del programa seleccionado
  useEffect(() => {
    if (!selectedPrograma) return

    const duracionDiurna = selectedPrograma.numero_semestre || 10
    const duracionNocturna = selectedPrograma.semestres_nocturna || duracionDiurna
    const jornadaProg = selectedPrograma.jornada || 'DIURNA'
    const maxSemestres = jornadaProg === 'NOCTURNA' ? duracionNocturna : duracionDiurna

    // Resolución real del pensum (puede ser null para datos legacy — el backend lo resolverá)
    const resolucionBase = resolucionVigentePensum ?? ''

    // Cohortes existentes en BD para este programa y periodo
    const existentes = allCohortes.filter(c => c.codeProgram === selectedPrograma.code_program)

    const items = []
    for (let sem = 1; sem <= maxSemestres; sem++) {
      const cohorteExistente = existentes.find(c => c.semestre === sem)
      items.push({
        semestre: sem,
        activo: Boolean(cohorteExistente),
        jornada: jornadaProg,
        numeroResolucion: cohorteExistente?.numeroResolucion ?? resolucionBase,
        confirmada: cohorteExistente?.confirmada ?? true,
        enExtincion: cohorteExistente
          ? (resolucionBase ? cohorteExistente.numeroResolucion !== resolucionBase : false)
          : false
      })
    }
    setProgramCohortes(items)
  }, [selectedPrograma, allCohortes, resolucionVigentePensum])

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
          const resRef = resolucionVigentePensum ?? selectedPrograma?.numero_resolucion ?? ''
          updated.enExtincion = resRef ? value !== resRef : false
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
        jornada: selectedPrograma.jornada || 'DIURNA',
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

  const handleGenerarCohortes = async (forzarAvance = false) => {
    if (!selectedPeriodoId || !periodoAnterior) return
    setGeneratingCohortes(true)
    try {
      const propuestasData = await getPropuestaCohortes(
        selectedPeriodoId,
        String(periodoAnterior.id),
        forzarAvance
      )
      const advertencia = propuestasData?.find(item => item.advertenciaPeriodoAnterior)?.advertenciaPeriodoAnterior
      if (advertencia && !forzarAvance) {
        setAdvertenciaGeneracion(advertencia)
        setConfirmarAvanceForzado(false)
        return
      }

      const admisiones = new Set(selectedAdmissionCodes)
      const propuestasPorPrograma = new Map(
        (Array.isArray(propuestasData) ? propuestasData : []).map(item => [item.codeProgram, item])
      )
      const operaciones = programas.flatMap(programa => {
        const propuesta = propuestasPorPrograma.get(programa.code_program)
        const cohortesPropuestas = (propuesta?.cohortesPropuestas || [])
          .filter(cohorte => cohorte.semestre !== 1 || admisiones.has(programa.code_program))
          .map(cohorte => ({
            semestre: cohorte.semestre,
            jornada: cohorte.jornada || programa.jornada || 'DIURNA',
            numeroResolucion: cohorte.numeroResolucion || programa.numero_resolucion || '',
            confirmada: cohorte.confirmada ?? true
          }))

        if (admisiones.has(programa.code_program) && !cohortesPropuestas.some(cohorte => cohorte.semestre === 1)) {
          cohortesPropuestas.push({
            semestre: 1,
            jornada: programa.jornada || 'DIURNA',
            numeroResolucion: programa.numero_resolucion || '',
            confirmada: true
          })
        }

        return cohortesPropuestas.length > 0
          ? [{ codeProgram: programa.code_program, cohortes: cohortesPropuestas }]
          : []
      })

      if (operaciones.length === 0) {
        throw new Error('No hay cohortes para generar desde el período anterior ni programas seleccionados con admisiones.')
      }

      await guardarCohortesLote(selectedPeriodoId, operaciones)
      await loadPeriodoData()

      setAdvertenciaGeneracion('')
      setConfirmarAvanceForzado(false)
      setCohortesConfigOpen(false)
      setAdmisionesOpen(false)
      onShowToast?.(`Cohortes generadas para ${selectedPeriodo?.nombre}.`, 'success')
    } catch (err) {
      onShowToast?.(err.message || 'Error al generar las cohortes', 'error')
    } finally {
      setGeneratingCohortes(false)
    }
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

  return (
    <div className="programacion-cohortes-container">
      {/* 1. Header con Selección de Período */}
      <div className="pc-header">
        <div>
          <h2 className="pc-title">
            {isCoordinador
              ? 'Cupos de estudiantes'
              : activeTab === 'avance'
                ? 'Avance de la Programación Académica'
                : 'Oferta de Cohortes y Programación Académica'}
          </h2>
          <p className="pc-subtitle">
            {isCoordinador
              ? 'Registre el número de cupos de estudiantes de cada materia y grupo de su programa.'
              : activeTab === 'avance'
                ? 'Consulte los cursos generados, los pendientes, los docentes sin disponibilidad y las fechas de cierre de cada ventana.'
                : 'Configure las cohortes activas por programa y genere automáticamente la oferta de cursos a partir de las mallas curriculares.'}
          </p>
        </div>

        <div className="pc-periodo-selector pc-periodo-info-only" title="Período académico activo">
          <span className="pc-periodo-label">Período Académico:</span>
          <div className="pc-periodo-badge-display">
            <CalendarDays size={18} className="pc-periodo-icon" style={{ color: '#2563eb' }} />
            <span className="pc-periodo-name">
              {selectedPeriodo
                ? `${selectedPeriodo.nombre}${selectedPeriodo.numeroResolucion ? ` · Res. ${selectedPeriodo.numeroResolucion}` : ''}`
                : 'Sin período vigente'}
            </span>
            {selectedPeriodo && (
              <span className={`pc-badge ${selectedPeriodo.vigente ? 'pc-badge-success' : 'pc-badge-neutral'}`}>
                {selectedPeriodo.estado || (selectedPeriodo.vigente ? 'VIGENTE' : 'HISTORIAL')}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sin período vigente: guiar al usuario a crear/activar uno */}
      {periodosCargados && !selectedPeriodo ? (
        <div
          className="pc-panel"
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            padding: '3rem 1.5rem',
            gap: '0.85rem'
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: '#eff6ff',
              color: '#2563eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <CalendarDays size={28} />
          </div>
          <h3 className="pc-panel-title" style={{ margin: 0 }}>
            No hay un período académico vigente
          </h3>
          <p className="pc-panel-desc" style={{ maxWidth: '460px', margin: 0 }}>
            {isAdmin
              ? 'Por favor crea un período académico (o activa uno existente) para configurar las cohortes y generar la programación académica.'
              : 'Actualmente no hay un período académico vigente. Comunícate con el administrador para activar uno.'}
          </p>
          {isAdmin && onNavigateToPeriodos && (
            <button
              type="button"
              className="pc-btn pc-btn-primary"
              style={{ marginTop: '0.4rem' }}
              onClick={onNavigateToPeriodos}
            >
              <CalendarDays size={16} />
              <span>Ir a Períodos Académicos</span>
            </button>
          )}
        </div>
      ) : (
      <>
      {/* 2. Barra de Pestañas */}
      <div className="pc-tabs-nav">
        {!isCoordinador && (
          <button
            className={`pc-tab-btn ${activeTab === 'cohortes' ? 'active' : ''}`}
            onClick={() => setActiveTab('cohortes')}
          >
            <Layers size={18} />
            <span>1. Oferta de Cohortes por Programa</span>
          </button>
        )}

        {!isCoordinador && (
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
        )}

        <button
          className={`pc-tab-btn ${activeTab === 'cursos' ? 'active' : ''}`}
          onClick={() => setActiveTab('cursos')}
        >
          <BookOpen size={18} />
          <span>{isCoordinador ? 'Cupos de estudiantes' : '3. Cursos Programados'}</span>
          <span className="pc-tab-counter">{cursosVisibles.length}</span>
        </button>

        {isAdmin && (
          <button
            className={`pc-tab-btn ${activeTab === 'avance' ? 'active' : ''}`}
            onClick={() => setActiveTab('avance')}
          >
            <TrendingUp size={18} />
            <span>4. Avance del Período</span>
          </button>
        )}
      </div>

      {/* 3. Contenido de las Pestañas */}
      {activeTab === 'cohortes' && (
        <div className="pc-tab-content">
          {!cohortesCargadas || (loading && allCohortes.length === 0) ? (
            <div className="pc-panel" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '2rem', justifyContent: 'center', color: '#475569' }}>
              <RefreshCw size={18} className="pc-spin" />
              <span>Cargando cohortes del período...</span>
            </div>
          ) : cohortesLoadError ? (
            <div className="pc-panel">
              <div className="pc-alert pc-alert-warning">
                <AlertTriangle size={18} />
                <span>No se pudo verificar si el paso 1 ya está configurado: {cohortesLoadError}</span>
              </div>
              <button
                type="button"
                className="pc-btn pc-btn-secondary"
                onClick={loadPeriodoData}
                disabled={loading}
              >
                {loading ? <RefreshCw size={16} className="pc-spin" /> : <RotateCcw size={16} />}
                <span>Reintentar consulta</span>
              </button>
            </div>
          ) : allCohortes.length === 0 || admisionesOpen ? (
            <div className="pc-panel pc-admissions-panel">
              <div className="pc-panel-header">
                <div>
                  <h3 className="pc-panel-title">¿Qué programas tendrán admisiones en este período?</h3>
                  <p className="pc-panel-desc">
                    Seleccione los programas que recibirán estudiantes nuevos en primer semestre.
                  </p>
                </div>
                {allCohortes.length > 0 && (
                  <button
                    type="button"
                    className="pc-btn pc-btn-secondary"
                    onClick={() => setAdmisionesOpen(false)}
                  >
                    Volver al resumen
                  </button>
                )}
              </div>

              {periodoAnterior ? (
                <p className="pc-alert pc-alert-info">
                  Las cohortes actuales se calcularán tomando como base el período anterior
                  <strong> {periodoAnterior.nombre}</strong>.
                </p>
              ) : (
                <div className="pc-alert pc-alert-warning">
                  <AlertTriangle size={18} />
                  <span>No se encontró un período anterior con fecha de inicio. No es posible generar cohortes automáticamente.</span>
                </div>
              )}

              <div className="pc-admissions-list">
                {programas.map(programa => {
                  const esNocturna = String(programa.jornada || '').toUpperCase() === 'NOCTURNA'
                    || String(programa.code_program || '').toUpperCase().endsWith('-NOC')
                  return (
                    <label
                      className={`pc-admission-option ${selectedAdmissionCodes.includes(programa.code_program) ? 'selected' : ''}`}
                      key={programa.code_program}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAdmissionCodes.includes(programa.code_program)}
                        onChange={(event) => {
                          setSelectedAdmissionCodes(previous => event.target.checked
                            ? [...previous, programa.code_program]
                            : previous.filter(code => code !== programa.code_program)
                          )
                        }}
                      />
                      <span style={{ flex: 1 }}>{programa.name_program}</span>
                      <span
                        className={`pc-badge ${esNocturna ? 'pc-badge-purple' : 'pc-badge-blue'}`}
                        style={{ flexShrink: 0 }}
                      >
                        {esNocturna ? 'Nocturna' : 'Diurna'}
                      </span>
                    </label>
                  )
                })}
              </div>

              <div className="pc-admissions-footer">
                <span className="pc-text-muted">
                  {selectedAdmissionCodes.length} programa{selectedAdmissionCodes.length === 1 ? '' : 's'} seleccionado{selectedAdmissionCodes.length === 1 ? '' : 's'}
                </span>
                <button
                  type="button"
                  className="pc-btn pc-btn-primary pc-btn-lg"
                  onClick={() => handleGenerarCohortes()}
                  disabled={!periodoAnterior || generatingCohortes}
                >
                  {generatingCohortes ? <RefreshCw size={18} className="pc-spin" /> : <Sparkles size={18} />}
                  <span>Generar cohortes para {selectedPeriodo?.nombre || 'el período'}</span>
                </button>
              </div>
            </div>
          ) : !cohortesConfigOpen ? (
            <div className="pc-panel pc-cohortes-summary">
              <div className="pc-panel-header">
                <div>
                  <h3 className="pc-panel-title">Cohortes de {selectedPeriodo?.nombre}</h3>
                  <p className="pc-panel-desc">Resumen de las cohortes activas por programa.</p>
                </div>
                <div className="pc-actions-row">
                  <button
                    type="button"
                    className="pc-btn pc-btn-secondary"
                    onClick={() => {
                      const conPrimerSemestre = allCohortes
                        .filter(c => c.semestre === 1)
                        .map(c => c.codeProgram)
                      setSelectedAdmissionCodes([...new Set(conPrimerSemestre)])
                      setAdmisionesOpen(true)
                    }}
                  >
                    <Sparkles size={16} />
                    <span>Admisiones</span>
                  </button>
                  <button
                    type="button"
                    className="pc-btn pc-btn-secondary"
                    onClick={() => setCohortesConfigOpen(true)}
                  >
                    <Layers size={16} />
                    <span>Configuración de cohortes</span>
                  </button>
                </div>
              </div>

              <div className="pc-table-wrapper">
                <table className="pc-table">
                  <thead>
                    <tr>
                      <th>Programa</th>
                      <th>Jornada</th>
                      <th>Semestres ofertados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programas.map(programa => {
                      const cohortesPrograma = allCohortes
                        .filter(cohorte => cohorte.codeProgram === programa.code_program)
                        .sort((a, b) => a.semestre - b.semestre)
                      if (cohortesPrograma.length === 0) return null
                      return (
                        <tr key={programa.code_program}>
                          <td>{programa.name_program}</td>
                          <td>{programa.jornada || '—'}</td>
                          <td>
                            <div className="pc-semester-tags">
                              {cohortesPrograma.map(cohorte => (
                                <span className="pc-semester-tag" key={`${programa.code_program}-${cohorte.semestre}`}>
                                  Semestre {cohorte.semestre}
                                </span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="pc-cohortes-layout">
              <div className="pc-panel pc-program-header-panel">
                <div className="pc-panel-header">
                  <div>
                    <h3 className="pc-panel-title">Configuración de cohortes</h3>
                    <p className="pc-panel-desc">
                      Active o desactive semestres para agregar o eliminar cohortes, y edite sus resoluciones.
                    </p>
                  </div>

                  <div className="pc-actions-row">
                    <button
                      type="button"
                      className="pc-btn pc-btn-secondary"
                      onClick={() => setCohortesConfigOpen(false)}
                    >
                      Volver al resumen
                    </button>
                    <button
                      type="button"
                      className="pc-btn pc-btn-primary"
                      onClick={handleGuardarCohortes}
                      disabled={savingCohortes}
                    >
                      {savingCohortes ? <RefreshCw size={16} className="pc-spin" /> : <Save size={16} />}
                      <span>Guardar cambios</span>
                    </button>
                  </div>
                </div>

                <div className="pc-program-picker">
                  <label>Programa Académico:</label>
                  <select
                    value={selectedProgramCode}
                    onChange={(e) => setSelectedProgramCode(e.target.value)}
                    className="pc-select"
                  >
                    {programas.map(prog => (
                      <option key={prog.code_program} value={prog.code_program}>
                        {prog.code_program} - {prog.name_program}
                      </option>
                    ))}
                  </select>

                  {selectedPrograma && (
                    <div className="pc-program-meta">
                      <span><strong>Jornada:</strong> {selectedPrograma.jornada}</span>
                      <span><strong>Duración:</strong> {selectedPrograma.numero_semestre || 10} sem. diurna {selectedPrograma.semestres_nocturna ? `/ ${selectedPrograma.semestres_nocturna} nocturna` : ''}</span>
                      <span><strong>Resolución Vigente:</strong> {resolucionVigentePensum || selectedPrograma.numero_resolucion || <em className="pc-text-muted">Sin resolución (malla legacy)</em>}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="pc-semestres-grid">
                {programCohortes.map(cohorte => (
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
                        {cohorte.activo ? 'Ofertado' : 'No ofertado'}
                      </span>
                    </div>

                    {cohorte.activo && (
                      <div className="pc-card-body">
                        <div className="pc-field-group">
                          <label>Resolución de malla:</label>
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
                            <span className="pc-pill pc-pill-warning">Malla en extinción</span>
                          ) : (
                            <span className="pc-pill pc-pill-success">Malla vigente</span>
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
            </div>
          )}
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

      {/* Pestaña 3: Cursos Programados (HU-047) */}
      {activeTab === 'cursos' && (
        <div className="pc-tab-content">
          <CursosProgramadosPanel
            cursos={cursosVisibles}
            programas={programas}
            onCambio={loadPeriodoData}
            onShowToast={onShowToast}
            periodoId={selectedPeriodoId}
            periodoNombre={selectedPeriodo?.nombre || ''}
            maxCupos={cuposConfig?.maxPorGrupo ?? 60}
            puedeEditarCupos={cuposConfig?.puedeEditar ?? isAdmin}
            plazoAbierto={cuposConfig?.plazoAbierto ?? false}
            cargandoCuposConfig={cuposConfigCargando}
            cargandoCupos={loading || cuposConfigCargando}
            puedeAjustarProgramacion={isAdmin}
          />
        </div>
      )}

      {isAdmin && activeTab === 'avance' && (
        <AvanceProgramacionView
          periodoId={selectedPeriodoId}
          onShowToast={onShowToast}
        />
      )}

      {advertenciaGeneracion && (
        <div className="pc-modal-backdrop">
          <div className="pc-modal pc-modal-sm">
            <div className="pc-modal-header">
              <div className="pc-modal-title-with-icon">
                <AlertTriangle size={22} className="pc-text-warning" />
                <h3>Período anterior con novedad</h3>
              </div>
              <button
                type="button"
                className="pc-btn-close"
                onClick={() => setAdvertenciaGeneracion('')}
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>
            <div className="pc-modal-body">
              <p>{advertenciaGeneracion}</p>
              <label className="pc-confirm-check">
                <input
                  type="checkbox"
                  checked={confirmarAvanceForzado}
                  onChange={event => setConfirmarAvanceForzado(event.target.checked)}
                />
                <span>Confirmo que deseo generar las cohortes usando este período como base.</span>
              </label>
            </div>
            <div className="pc-modal-footer">
              <button
                type="button"
                className="pc-btn pc-btn-secondary"
                onClick={() => setAdvertenciaGeneracion('')}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="pc-btn pc-btn-warning"
                onClick={() => handleGenerarCohortes(true)}
                disabled={!confirmarAvanceForzado || generatingCohortes}
              >
                {generatingCohortes ? <RefreshCw size={16} className="pc-spin" /> : <Sparkles size={16} />}
                <span>Confirmar y generar</span>
              </button>
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
                Al volver a generar, <strong>se conservarán los docentes asignados, los cursos excluidos con su
                justificación y los grupos</strong> de los cursos que sigan ofertándose. Los cursos nuevos se agregan al
                final de la serie de su asignatura. Los que ya no estén en la oferta no se borran: quedan marcados como
                «Requiere revisión».
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
      </>
      )}
    </div>
  )
}
