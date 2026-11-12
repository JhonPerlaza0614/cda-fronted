import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  UserCheck,
  UserX,
  Search,
  BookOpen,
  Clock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  X,
  Layers,
  ChevronRight,
  UserPlus,
  Building2
} from 'lucide-react'
import { getDocentes, getEvaluacionesDocentes } from '../../services/docenteService'
import { getPeriodos, getFacultades } from '../../services/academicService'
import {
  getProgramacion,
  asignarDocenteACurso,
  asignarDocentePorMateria
} from '../../services/programacionService'
import { consultarDisponibilidadesPeriodo } from '../../services/DisponibilidadService'
import './AsignacionDocenteView.css'

const DIAS_SEMANA = {
  1: 'Lunes',
  2: 'Martes',
  3: 'Miércoles',
  4: 'Jueves',
  5: 'Viernes',
  6: 'Sábado',
  7: 'Domingo'
}

export default function AsignacionDocenteView({
  user,
  isAdmin = false,
  isCoordinador = false,
  coordinadorPerfil = null,
  programas = [],
  pensumList = [],
  onShowToast
}) {
  // 1. Estado de selección de Programa y Período
  const defaultProgramCode = isCoordinador
    ? (coordinadorPerfil?.code_program || programas[0]?.code_program || '')
    : (programas[0]?.code_program || '')

  const [selectedProgramCode, setSelectedProgramCode] = useState(defaultProgramCode)
  const [periodos, setPeriodos] = useState([])
  const [periodoActivo, setPeriodoActivo] = useState(null)
  const [facultadesList, setFacultadesList] = useState([])

  // 2. Semestre seleccionado (donde escojan un semestre)
  const [selectedSemestre, setSelectedSemestre] = useState(1)

  // 3. Datos de cursos programados, docentes y sus disponibilidades
  const [cursosProgramados, setCursosProgramados] = useState([])
  const [docentesList, setDocentesList] = useState([])
  const [disponibilidadesMap, setDisponibilidadesMap] = useState({}) // { docenteId: [items] }
  const [evaluacionesMap, setEvaluacionesMap] = useState({}) // { docenteId: evaluation }
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // 4. Modal de designación de docente
  const [materiaParaDesignar, setMateriaParaDesignar] = useState(null)
  const [busquedaDocente, setBusquedaDocente] = useState('')
  const [soloDelPrograma, setSoloDelPrograma] = useState(true) // Por defecto solo docentes del programa/facultad
  const [soloConDisponibilidad, setSoloConDisponibilidad] = useState(false)
  const [asignandoId, setAsignandoId] = useState(null)

  // Sincronizar código de programa cuando se carga el perfil del coordinador
  useEffect(() => {
    if (isCoordinador && coordinadorPerfil?.code_program) {
      setSelectedProgramCode(coordinadorPerfil.code_program)
    } else if (!selectedProgramCode && programas.length > 0) {
      setSelectedProgramCode(programas[0].code_program)
    }
  }, [isCoordinador, coordinadorPerfil, programas, selectedProgramCode])

  // Cargar períodos y facultades
  useEffect(() => {
    getPeriodos()
      .then(data => {
        const lista = Array.isArray(data) ? data : []
        setPeriodos(lista)
        const vigente = lista.find(p => p.vigente) || lista[0]
        setPeriodoActivo(vigente || null)
      })
      .catch(err => {
        console.error('Error al cargar períodos:', err)
        onShowToast?.('Error al cargar los períodos académicos', 'error')
      })

    getFacultades()
      .then(data => {
        if (Array.isArray(data)) setFacultadesList(data)
      })
      .catch(() => {})
  }, [onShowToast])

  // Cargar lista de docentes
  const cargarDocentes = useCallback(async () => {
    try {
      const data = await getDocentes()
      const lista = Array.isArray(data) ? data.filter(d => d.estado !== false) : []
      setDocentesList(lista)
    } catch (err) {
      console.warn('Error al cargar docentes:', err)
    }
  }, [])

  useEffect(() => {
    cargarDocentes()
  }, [cargarDocentes])

  // Cargar cursos programados y disponibilidades para el período y programa seleccionado
  const cargarDatosProgramacion = useCallback(async (silencioso = false) => {
    if (!periodoActivo?.id || !selectedProgramCode) {
      setLoading(false)
      return
    }

    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    try {
      const [cursos, disps] = await Promise.all([
        getProgramacion(periodoActivo.id, { codeProgram: selectedProgramCode }).catch(() => []),
        consultarDisponibilidadesPeriodo(periodoActivo.id).catch(() => ({}))
      ])

      setCursosProgramados(Array.isArray(cursos) ? cursos.filter(c => c.estado !== 'EXCLUIDO') : [])
      setDisponibilidadesMap(disps || {})
    } catch (err) {
      console.error('Error al cargar programación académica:', err)
      onShowToast?.('No fue posible cargar los cursos programados del período', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [periodoActivo, selectedProgramCode, onShowToast])

  useEffect(() => {
    cargarDatosProgramacion()
  }, [cargarDatosProgramacion])

  // Programa actual
  const programaActual = useMemo(() => {
    return programas.find(p => p.code_program === selectedProgramCode) || null
  }, [programas, selectedProgramCode])

  const totalSemestres = programaActual?.numero_semestre || 10

  // Facultad a la que pertenece el programa
  const facultadPrograma = useMemo(() => {
    if (!programaActual) return null
    if (programaActual.id_facultad_programa) {
      return facultadesList.find(f => f.id === programaActual.id_facultad_programa) || null
    }
    return null
  }, [programaActual, facultadesList])

  // Materias de la malla pensum para este programa
  const materiasPensumPrograma = useMemo(() => {
    return pensumList.filter(item => item.code_program === selectedProgramCode && item.activo !== false)
  }, [pensumList, selectedProgramCode])

  // Cursos / Materias desplegadas para el semestre escogido
  const materiasDelSemestre = useMemo(() => {
    // 1. Cursos que ya existen en cursos_programacion para este semestre
    const cursosDelSem = cursosProgramados.filter(c => Number(c.semestre) === Number(selectedSemestre))

    // 2. Asignaturas de la malla pensum para este semestre
    const pensumDelSem = materiasPensumPrograma.filter(p => Number(p.semestre) === Number(selectedSemestre))

    // Cruzar para asegurar que se muestren todas las materias del semestre
    const items = []
    const cursosMap = new Map()

    cursosDelSem.forEach(c => {
      cursosMap.set(c.codeCourse, c)
      items.push({
        id: c.id,
        codeCourse: c.codeCourse,
        nameCourse: c.nombreAsignatura || c.name_course,
        credits: c.credits,
        semestre: c.semestre,
        grupo: c.grupo || 50,
        jornada: c.jornada || 'DIURNA',
        idDocente: c.idDocente,
        nombreDocente: c.nombreDocente,
        estado: c.idDocente ? 'ASIGNADO' : 'PROGRAMADO',
        existeEnProgramacion: true,
      })
    })

    // Si hay materias en el pensum que no se generaron aún en cursos_programacion, agregarlas para permitir designación
    pensumDelSem.forEach(p => {
      if (!cursosMap.has(p.code_course)) {
        items.push({
          id: null,
          codeCourse: p.code_course,
          nameCourse: p.name_course,
          credits: p.credits,
          semestre: p.semestre,
          grupo: 50,
          jornada: programaActual?.jornada || 'DIURNA',
          idDocente: null,
          nombreDocente: null,
          estado: 'PROGRAMADO',
          existeEnProgramacion: false,
        })
      }
    })

    return items
  }, [cursosProgramados, materiasPensumPrograma, selectedSemestre, programaActual])

  // Formato legible de horario de un docente
  const formatearHorariosDocente = useCallback((docenteId) => {
    const franjas = disponibilidadesMap[docenteId]
    if (!franjas || franjas.length === 0) return null

    // Agrupar por día
    const porDia = {}
    franjas.forEach(f => {
      const diaNom = DIAS_SEMANA[f.dia] || `Día ${f.dia}`
      if (!porDia[diaNom]) porDia[diaNom] = []
      const ini = f.horaInicio ? f.horaInicio.slice(0, 5) : ''
      const fin = f.horaFin ? f.horaFin.slice(0, 5) : ''
      porDia[diaNom].push(`${ini} - ${fin}`)
    })

    return Object.entries(porDia).map(([dia, horas]) => ({
      dia,
      horas: horas.join(', ')
    }))
  }, [disponibilidadesMap])

  // Filtrado de docentes para el modal de asignación: solo relacionados al programa por defecto
  const docentesFiltrados = useMemo(() => {
    let lista = docentesList

    // 1. Filtro estricto por programa / facultad (excluye facultades no afines como Ciencias de la Administración si no corresponden)
    if (soloDelPrograma && programaActual) {
      const progCode = String(programaActual.code_program || '').trim().toUpperCase()
      const idFacultadProg = programaActual.id_facultad_programa != null
        ? Number(programaActual.id_facultad_programa)
        : null
      const nombreFacultadProg = facultadPrograma?.nombre
        ? facultadPrograma.nombre.toLowerCase().trim()
        : ''

      lista = lista.filter(d => {
        // a) El docente está adscrito directamente a este código de programa
        const dProgCode = String(d.code_program || d.codeProgram || '').trim().toUpperCase()
        if (dProgCode && dProgCode === progCode) return true

        // b) El docente pertenece a la misma facultad del programa
        const dIdFacultad = d.id_facultad != null
          ? Number(d.id_facultad)
          : (d.idFacultad != null ? Number(d.idFacultad) : null)

        if (idFacultadProg !== null && dIdFacultad !== null && dIdFacultad === idFacultadProg) {
          return true
        }

        // c) Por coincidencia en nombre de facultad
        const dNomFacultad = (d.nombre_facultad || d.nombreFacultad || '').toLowerCase().trim()
        if (nombreFacultadProg && dNomFacultad && dNomFacultad === nombreFacultadProg) {
          return true
        }

        // d) Si el docente ya es el asignado a esta materia, conservarlo para poder gestionarlo
        if (materiaParaDesignar?.idDocente && Number(materiaParaDesignar.idDocente) === Number(d.id)) {
          return true
        }

        return false
      })
    }

    // 2. Filtro por disponibilidad horaria
    if (soloConDisponibilidad) {
      lista = lista.filter(d => {
        const disps = disponibilidadesMap[d.id]
        return disps && disps.length > 0
      })
    }

    // 3. Filtro por texto de búsqueda
    if (busquedaDocente.trim()) {
      const q = busquedaDocente.toLowerCase().trim()
      lista = lista.filter(d => {
        const nom = `${d.nombres || ''} ${d.apellidos || ''}`.toLowerCase()
        const doc = (d.numeroDocumento || '').toLowerCase()
        const correo = (d.correoInstitucional || '').toLowerCase()
        const cod = (d.codigo || '').toLowerCase()
        const fac = (d.nombre_facultad || d.nombreFacultad || '').toLowerCase()
        return nom.includes(q) || doc.includes(q) || correo.includes(q) || cod.includes(q) || fac.includes(q)
      })
    }

    return lista
  }, [docentesList, soloDelPrograma, programaActual, facultadPrograma, materiaParaDesignar, soloConDisponibilidad, disponibilidadesMap, busquedaDocente])

  // Abrir modal de asignación
  const handleAbrirDesignacion = (materia) => {
    setMateriaParaDesignar(materia)
    setBusquedaDocente('')
    setSoloDelPrograma(true) // Siempre inicia enfocado a los docentes del programa
    setEvaluacionesMap({})
    if (periodoActivo?.id && materia?.codeCourse) {
      getEvaluacionesDocentes(periodoActivo.id, materia.codeCourse)
        .then(evaluaciones => {
          const mapa = {}
          const lista = Array.isArray(evaluaciones) ? evaluaciones : []
          lista.forEach(evaluacion => {
            mapa[String(evaluacion.docente_id ?? evaluacion.docenteId)] = evaluacion
          })
          setEvaluacionesMap(mapa)
        })
        .catch(err => {
          console.error('Error al cargar evaluaciones docentes:', err)
          onShowToast?.('No fue posible cargar las calificaciones docentes', 'error')
        })
    }
  }

  // Ejecutar asignación de docente
  const handleConfirmarDesignacion = async (docente) => {
    if (!materiaParaDesignar || !periodoActivo?.id) return
    const reemplazando = materiaParaDesignar.idDocente
      && Number(materiaParaDesignar.idDocente) !== Number(docente.id)
    if (reemplazando) {
      const confirmar = window.confirm(
        `La materia ya tiene asignado a ${materiaParaDesignar.nombreDocente || 'otro docente'}. ` +
        '¿Desea desactivarlo y asignar al nuevo docente?'
      )
      if (!confirmar) return
    }
    setAsignandoId(docente.id)

    try {
      if (materiaParaDesignar.id) {
        // Curso ya programado
        await asignarDocenteACurso(materiaParaDesignar.id, docente.id, Boolean(reemplazando))
      } else {
        // Materia de pensum que asegura el curso programado
        await asignarDocentePorMateria({
          periodoId: periodoActivo.id,
          codeProgram: selectedProgramCode,
          codeCourse: materiaParaDesignar.codeCourse,
          semestre: selectedSemestre,
          idDocente: docente.id,
          reemplazarDocente: Boolean(reemplazando)
        })
      }

      onShowToast?.(`Docente ${docente.nombres} ${docente.apellidos} asignado correctamente a ${materiaParaDesignar.nameCourse}`, 'success')
      setMateriaParaDesignar(null)
      await cargarDatosProgramacion(true)
    } catch (err) {
      console.error('Error al designar docente:', err)
      onShowToast?.(`Error: ${err.message || 'No fue posible asignar el docente a la materia'}`, 'error')
    } finally {
      setAsignandoId(null)
    }
  }

  // Quitar / Desasignar docente de un curso
  const handleDesasignarDocente = async (materia) => {
    if (!materia.id) return
    const confirmar = window.confirm(`¿Desea desasignar al docente de ${materia.nameCourse}?`)
    if (!confirmar) return

    try {
      await asignarDocenteACurso(materia.id, null)
      onShowToast?.(`Docente desasignado de ${materia.nameCourse}`, 'info')
      await cargarDatosProgramacion(true)
    } catch (err) {
      console.error('Error al desasignar docente:', err)
      onShowToast?.(`Error al desasignar: ${err.message || 'Error desconocido'}`, 'error')
    }
  }

  // Conteo de asignaciones por semestre para los botones superiores
  const resumenPorSemestre = useMemo(() => {
    const mapa = {}
    for (let s = 1; s <= totalSemestres; s++) {
      const mats = materiasPensumPrograma.filter(p => Number(p.semestre) === s)
      const cursos = cursosProgramados.filter(c => Number(c.semestre) === s)
      const asignados = cursos.filter(c => c.idDocente).length
      mapa[s] = {
        total: Math.max(mats.length, cursos.length),
        asignados
      }
    }
    return mapa
  }, [totalSemestres, materiasPensumPrograma, cursosProgramados])

  return (
    <div className="asig-doc-container">
      {/* 1. Cabecera principal */}
      <div className="asig-doc-header-card">
        <div className="asig-doc-header-info">
          <div className="asig-doc-icon-wrapper">
            <CalendarCheck size={26} />
          </div>
          <div>
            <h2 className="asig-doc-title">Designación y Asignación Docente</h2>
            <p className="asig-doc-subtitle">
              Escoja el semestre de su programa para desplegar las materias y designar docentes según su disponibilidad horaria.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {periodoActivo && (
            <div className="asig-doc-periodo-badge">
              <CalendarDays size={16} style={{ color: '#2563eb' }} />
              <span>{periodoActivo.nombre} {periodoActivo.numeroResolucion ? `· Res. ${periodoActivo.numeroResolucion}` : ''}</span>
              <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}>
                {periodoActivo.vigente ? 'VIGENTE' : 'ACTIVO'}
              </span>
            </div>
          )}
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => cargarDatosProgramacion(true)}
            disabled={refreshing}
            title="Refrescar asignaciones"
          >
            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
            <span>{refreshing ? 'Actualizando...' : 'Actualizar'}</span>
          </button>
        </div>
      </div>

      {/* 2. Barra de Programa */}
      <div className="asig-doc-program-bar">
        <div className="asig-doc-program-info">
          <BookOpen size={18} style={{ color: '#c8102e' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Programa Académico:</span>
          {isCoordinador && programaActual ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span className="asig-doc-program-code">{programaActual.code_program}</span>
              <span className="asig-doc-program-name">{programaActual.name_program}</span>
              {facultadPrograma && (
                <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                  <Building2 size={12} style={{ display: 'inline', marginRight: '3px' }} />
                  {facultadPrograma.nombre}
                </span>
              )}
              <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Jornada {programaActual.jornada || 'DIURNA'}</span>
            </div>
          ) : (
            <select
              className="asig-doc-program-select"
              value={selectedProgramCode}
              onChange={(e) => setSelectedProgramCode(e.target.value)}
            >
              {programas.map(p => (
                <option key={p.code_program} value={p.code_program}>
                  {p.code_program} - {p.name_program}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
          Duración: <strong>{totalSemestres} semestres</strong> · Total materias en malla: <strong>{materiasPensumPrograma.length}</strong>
        </div>
      </div>

      {/* 3. Barra de Selección de Semestre (donde escojan un semestre) */}
      <div className="asig-doc-semestres-bar" role="tablist">
        {Array.from({ length: totalSemestres }, (_, i) => i + 1).map(sem => {
          const res = resumenPorSemestre[sem] || { total: 0, asignados: 0 }
          const isActive = selectedSemestre === sem
          return (
            <button
              key={sem}
              type="button"
              className={`asig-doc-semestre-btn ${isActive ? 'active' : ''}`}
              onClick={() => setSelectedSemestre(sem)}
              role="tab"
              aria-selected={isActive}
            >
              <span>Semestre {sem}</span>
              <span className="asig-doc-semestre-sub">
                {res.total > 0 ? `${res.asignados}/${res.total} asignadas` : 'Sin materias'}
              </span>
            </button>
          )
        })}
      </div>

      {/* 4. Materias desplegadas para ese semestre */}
      <div className="asig-doc-materias-section">
        <div className="asig-doc-materias-header">
          <div className="asig-doc-materias-title">
            <Layers size={18} style={{ color: '#c8102e' }} />
            <span>Materias de Semestre {selectedSemestre}</span>
            <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
              {materiasDelSemestre.length} {materiasDelSemestre.length === 1 ? 'materia' : 'materias'}
            </span>
          </div>
          {materiasDelSemestre.length > 0 && (
            <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
              {materiasDelSemestre.filter(m => m.idDocente).length} de {materiasDelSemestre.length} materias con docente designado
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem', color: '#c8102e' }} />
            <p>Cargando materias del semestre y estado de asignaciones...</p>
          </div>
        ) : materiasDelSemestre.length === 0 ? (
          <div style={{
            background: '#ffffff',
            border: '1.5px dashed #cbd5e1',
            borderRadius: '12px',
            padding: '3rem 2rem',
            textAlign: 'center',
            color: '#64748b'
          }}>
            <BookOpen size={36} style={{ color: '#94a3b8', margin: '0 auto 0.75rem' }} />
            <h3 style={{ margin: '0 0 0.5rem', color: '#1e293b' }}>No hay materias registradas en el Semestre {selectedSemestre}</h3>
            <p style={{ margin: 0, fontSize: '0.9rem', maxWidth: '500px', marginLeft: 'auto', marginRight: 'auto' }}>
              Este semestre no contiene asignaturas en la malla curricular activa ni en la oferta de cursos programados de este programa.
            </p>
          </div>
        ) : (
          <div className="asig-doc-materias-grid">
            {materiasDelSemestre.map((mat) => {
              const tieneDocente = Boolean(mat.idDocente)
              const horariosDoc = tieneDocente ? formatearHorariosDocente(mat.idDocente) : null

              return (
                <div
                  key={`${mat.codeCourse}_${mat.grupo}`}
                  className={`asig-doc-materia-card ${tieneDocente ? 'asignado' : 'sin-asignar'}`}
                >
                  <div>
                    <div className="asig-doc-card-top">
                      <span className="asig-doc-course-code">{mat.codeCourse}</span>
                      <span className="asig-doc-group-badge">Grupo {mat.grupo || 50}</span>
                    </div>

                    <h4 className="asig-doc-materia-name">{mat.nameCourse}</h4>

                    <div className="asig-doc-materia-meta">
                      <span><strong>{mat.credits}</strong> créditos</span>
                      <span>•</span>
                      <span>Jornada {mat.jornada}</span>
                      <span>•</span>
                      <span>Semestre {mat.semestre}</span>
                    </div>

                    {/* Información del Docente asignado o pendiente */}
                    <div className={`asig-doc-docente-box ${tieneDocente ? 'con-docente' : ''}`}>
                      <div className="asig-doc-docente-header">
                        <span className="asig-doc-docente-label">Docente Responsable</span>
                        <span
                          className={`badge ${tieneDocente ? 'badge-success' : 'badge-neutral'}`}
                          style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                        >
                          {tieneDocente ? 'Designado' : 'Pendiente'}
                        </span>
                      </div>

                      {tieneDocente ? (
                        <>
                          <div className="asig-doc-docente-nombre">
                            <UserCheck size={14} style={{ display: 'inline', marginRight: '4px', color: '#16a34a' }} />
                            {mat.nombreDocente}
                          </div>

                          {/* Horario de disponibilidad del docente */}
                          <div className="asig-doc-docente-horario-summary">
                            <Clock size={13} style={{ flexShrink: 0, marginTop: '2px', color: '#2563eb' }} />
                            <div>
                              <strong>Disponibilidad registrada:</strong>{' '}
                              {horariosDoc && horariosDoc.length > 0 ? (
                                <span>{horariosDoc.map(h => `${h.dia}: ${h.horas}`).join(' | ')}</span>
                              ) : (
                                <span style={{ color: '#64748b', fontStyle: 'italic' }}>Sin horario registrado en este período</span>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                          Aún no se ha designado un docente para este curso.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="asig-doc-card-actions">
                    {tieneDocente ? (
                      <>
                        <button
                          type="button"
                          className="btn-secondary btn-sm"
                          onClick={() => handleAbrirDesignacion(mat)}
                          style={{ flex: 1 }}
                        >
                          <UserPlus size={14} />
                          <span>Cambiar Docente</span>
                        </button>
                        <button
                          type="button"
                          className="btn-danger btn-sm"
                          onClick={() => handleDesasignarDocente(mat)}
                          title="Desasignar docente"
                          style={{ padding: '0.45rem 0.65rem' }}
                        >
                          <UserX size={14} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn-primary btn-sm"
                        onClick={() => handleAbrirDesignacion(mat)}
                        style={{ width: '100%', justifyContent: 'center' }}
                      >
                        <UserPlus size={15} />
                        <span>Designar Docente</span>
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 5. Modal de Designación de Docentes con Horarios */}
      {materiaParaDesignar && (
        <div className="asig-modal-backdrop" onClick={() => setMateriaParaDesignar(null)}>
          <div className="asig-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="asig-modal-header">
              <div>
                <h3 className="asig-modal-title">Designar Docente a la Materia</h3>
                <div className="asig-modal-target">
                  <strong>{materiaParaDesignar.codeCourse} - {materiaParaDesignar.nameCourse}</strong> (Grupo {materiaParaDesignar.grupo || 50} · Semestre {selectedSemestre})
                </div>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setMateriaParaDesignar(null)}
                title="Cerrar ventana"
              >
                <X size={18} />
              </button>
            </div>

            <div className="asig-modal-body">
              {/* Información de adscripción y filtro de programa */}
              <div style={{
                background: '#f8fafc',
                border: '1.5px solid #e2e8f0',
                borderRadius: '8px',
                padding: '0.65rem 0.85rem',
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.5rem'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Building2 size={16} style={{ color: '#2563eb' }} />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
                    Área: <strong>{facultadPrograma?.nombre || programaActual?.name_program || 'Programa actual'}</strong>
                  </span>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: '#0f172a', fontWeight: 600, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={soloDelPrograma}
                    onChange={(e) => setSoloDelPrograma(e.target.checked)}
                  />
                  <span>Solo docentes relacionados al programa</span>
                </label>
              </div>

              {/* Buscador y filtro de disponibilidad */}
              <div className="asig-search-box">
                <Search size={16} className="asig-search-icon" />
                <input
                  type="text"
                  className="asig-search-input"
                  placeholder="Buscar docente por nombre, documento o correo..."
                  value={busquedaDocente}
                  onChange={(e) => setBusquedaDocente(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.82rem', color: '#475569', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={soloConDisponibilidad}
                    onChange={(e) => setSoloConDisponibilidad(e.target.checked)}
                  />
                  <span>Solo con disponibilidad horaria registrada</span>
                </label>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {docentesFiltrados.length} {docentesFiltrados.length === 1 ? 'docente disponible' : 'docentes disponibles'}
                </span>
              </div>

              {/* Lista de docentes con su horario */}
              <div className="asig-docente-list">
                {docentesFiltrados.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    <p style={{ margin: '0 0 0.5rem', fontWeight: 600 }}>
                      No se encontraron docentes {soloDelPrograma ? 'vinculados a este programa o facultad' : ''} con los filtros aplicados.
                    </p>
                    {soloDelPrograma && (
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setSoloDelPrograma(false)}
                        style={{ fontSize: '0.82rem', cursor: 'pointer' }}
                      >
                        Mostrar docentes de todas las facultades
                      </button>
                    )}
                  </div>
                ) : (
                  docentesFiltrados.map((docente) => {
                    const esElActual = materiaParaDesignar.idDocente === docente.id
                    const horarios = formatearHorariosDocente(docente.id)
                    const estaAsignando = asignandoId === docente.id
                    const evaluacion = evaluacionesMap[String(docente.id)]

                    return (
                      <div
                        key={docente.id}
                        className={`asig-docente-item ${esElActual ? 'is-assigned' : ''}`}
                      >
                        <div className="asig-docente-item-info">
                          <div className="asig-docente-item-name">
                            {docente.nombres} {docente.apellidos}
                            {esElActual && (
                              <span className="badge badge-success" style={{ marginLeft: '0.5rem', fontSize: '0.72rem' }}>
                                Actualmente Designado
                              </span>
                            )}
                          </div>
                          <div className="asig-docente-item-details">
                            <span>{docente.correoInstitucional || 'Sin correo'}</span>
                            <span>•</span>
                            <span>Doc. {docente.numeroDocumento || docente.codigo}</span>
                            {docente.nombre_facultad && (
                              <>
                                <span>•</span>
                                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>
                                  <Building2 size={11} style={{ display: 'inline', marginRight: '3px' }} />
                                  {docente.nombre_facultad}
                                </span>
                              </>
                            )}
                            {docente.categoria && (
                              <>
                                <span>•</span>
                                <span className="badge badge-neutral" style={{ fontSize: '0.72rem' }}>{docente.categoria}</span>
                              </>
                            )}
                          </div>

                          {/* Horario de disponibilidad desplegado */}
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.45rem' }}>
                              Calificación docente de {evaluacion?.periodo_nombre || evaluacion?.periodoNombre || 'período anterior'}:{' '}
                              <strong style={{ color: evaluacion ? '#0f766e' : '#64748b' }}>
                                {evaluacion
                                  ? `${Number(evaluacion.calificacion).toFixed(2)} / 5.00`
                                  : 'Sin registro'}
                              </strong>
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} style={{ color: '#2563eb' }} />
                              <span>Horario de disponibilidad en el período:</span>
                            </div>
                            {horarios && horarios.length > 0 ? (
                              <div className="asig-horario-container">
                                {horarios.map((h, idx) => (
                                  <span key={idx} className="asig-horario-pill">
                                    <strong>{h.dia}:</strong> {h.horas}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="asig-horario-empty">
                                <span>El docente no ha registrado disponibilidad horaria para este período</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            className={esElActual ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                            onClick={() => handleConfirmarDesignacion(docente)}
                            disabled={estaAsignando || esElActual}
                            style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                          >
                            {estaAsignando ? 'Guardando...' : esElActual ? 'Asignado' : 'Designar'}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="asig-modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMateriaParaDesignar(null)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
