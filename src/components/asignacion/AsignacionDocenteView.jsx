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

// HU-016: filtros de la vista (valores por defecto: DIURNA y TODOS)
const FILTRO_JORNADA_DEFECTO = 'DIURNA'
const FILTRO_DOCENTES_DEFECTO = 'TODOS'

const OPCIONES_JORNADA = [
  { value: 'DIURNA', label: 'Diurna' },
  { value: 'NOCTURNA', label: 'Nocturna' },
  { value: 'AMBAS', label: 'Ambas' }
]

const OPCIONES_DOCENTES = [
  { value: 'TODOS', label: 'Todos los docentes' },
  { value: 'SIN_DOCENTE', label: 'Sin docente asignado' }
]

const ETIQUETA_JORNADA = { DIURNA: 'Diurna', NOCTURNA: 'Nocturna', AMBAS: 'Ambas' }

const normalizarJornada = (jornada) => String(jornada || 'DIURNA').trim().toUpperCase()

/**
 * HU-016: única función de filtrado de materias, usada por la lista del semestre
 * y por los contadores de los botones de semestre.
 * - jornada: DIURNA, NOCTURNA o AMBAS (AMBAS no filtra). Una materia con jornada
 *   AMBAS (solo en la malla de un programa de ambas jornadas) pasa cualquier filtro.
 * - docentes: TODOS o SIN_DOCENTE (solo materias pendientes: sin idDocente).
 *   Los cursos EXCLUIDO ya se descartan al cargar.
 */
function filtrarMaterias(materias, { jornada, docentes }) {
  return materias.filter(m => {
    if (jornada !== 'AMBAS') {
      const jm = normalizarJornada(m.jornada)
      if (jm !== 'AMBAS' && jm !== jornada) return false
    }
    if (docentes === 'SIN_DOCENTE' && m.idDocente) return false
    return true
  })
}

/** Texto del grupo: codigoCurso si existe, si no el número de grupo (HU-046). */
function textoGrupo(materia) {
  if (materia.codigoCurso) return materia.codigoCurso
  if (materia.grupo != null) return `Grupo ${materia.grupo}`
  return 'Sin grupo'
}

/** Plazo del coordinador abierto (HU-002 criterio 3: sin fechas definidas, solo consulta). */
function plazoCoordinadorAbierto(periodo, ahora = Date.now()) {
  const inicio = periodo?.plazoCoordinadorInicio ? new Date(periodo.plazoCoordinadorInicio).getTime() : NaN
  const fin = periodo?.plazoCoordinadorFin ? new Date(periodo.plazoCoordinadorFin).getTime() : NaN
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return false
  return ahora >= inicio && ahora <= fin
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
  // HU-016 criterio 6: el coordinador solo ve su programa; sin programa asignado no se toma otro.
  const defaultProgramCode = isCoordinador
    ? (coordinadorPerfil?.code_program || '')
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
  const [periodosCargando, setPeriodosCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  const [hayProgramacion, setHayProgramacion] = useState(false)

  // HU-016: filtros (no se guardan en localStorage)
  const [filtroJornada, setFiltroJornada] = useState(FILTRO_JORNADA_DEFECTO)
  const [filtroDocentes, setFiltroDocentes] = useState(FILTRO_DOCENTES_DEFECTO)

  // 4. Modal de designación de docente
  const [materiaParaDesignar, setMateriaParaDesignar] = useState(null)
  const [busquedaDocente, setBusquedaDocente] = useState('')
  const [soloDelPrograma, setSoloDelPrograma] = useState(true) // Por defecto solo docentes del programa/facultad
  const [soloConDisponibilidad, setSoloConDisponibilidad] = useState(false)
  const [asignandoId, setAsignandoId] = useState(null)

  // Sincronizar código de programa cuando se carga el perfil del coordinador
  useEffect(() => {
    if (isCoordinador) {
      const codigo = coordinadorPerfil?.code_program || ''
      if (codigo !== selectedProgramCode) {
        setSelectedProgramCode(codigo)
        setFiltroJornada(FILTRO_JORNADA_DEFECTO)
        setFiltroDocentes(FILTRO_DOCENTES_DEFECTO)
      }
    } else if (!selectedProgramCode && programas.length > 0) {
      setSelectedProgramCode(programas[0].code_program)
    }
  }, [isCoordinador, coordinadorPerfil, programas, selectedProgramCode])

  // HU-016: al cambiar de programa se vuelve a los filtros por defecto
  const handleCambiarPrograma = (codigo) => {
    setSelectedProgramCode(codigo)
    setFiltroJornada(FILTRO_JORNADA_DEFECTO)
    setFiltroDocentes(FILTRO_DOCENTES_DEFECTO)
  }

  // Cargar períodos
  const cargarPeriodos = useCallback(async () => {
    setPeriodosCargando(true)
    setErrorCarga(false)
    try {
      const data = await getPeriodos()
      const lista = Array.isArray(data) ? data : []
      setPeriodos(lista)
      const vigente = lista.find(p => p.vigente) || lista[0]
      setPeriodoActivo(vigente || null)
    } catch (err) {
      console.error('Error al cargar períodos:', err)
      setErrorCarga(true)
    } finally {
      setPeriodosCargando(false)
    }
  }, [])

  useEffect(() => {
    cargarPeriodos()
  }, [cargarPeriodos])

  // Cargar facultades
  useEffect(() => {
    getFacultades()
      .then(data => {
        if (Array.isArray(data)) setFacultadesList(data)
      })
      .catch(() => {})
  }, [])

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
      // HU-016 criterio 7: el error de la programación no se oculta; la disponibilidad sí puede faltar.
      const [cursos, disps] = await Promise.all([
        getProgramacion(periodoActivo.id, { codeProgram: selectedProgramCode }),
        consultarDisponibilidadesPeriodo(periodoActivo.id).catch(() => ({}))
      ])

      const lista = Array.isArray(cursos) ? cursos : []
      // Criterio 5: hay programación iniciada si el período tiene cursos del programa (aunque estén excluidos).
      setHayProgramacion(lista.length > 0)
      setCursosProgramados(lista.filter(c => c.estado !== 'EXCLUIDO'))
      setDisponibilidadesMap(disps || {})
      setErrorCarga(false)
    } catch (err) {
      console.error('Error al cargar programación académica:', err)
      setErrorCarga(true)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [periodoActivo, selectedProgramCode])

  // Reintentar (criterio 7): si fallaron los períodos, se recargan; si no, la programación.
  const handleReintentar = () => {
    if (!periodoActivo) cargarPeriodos()
    else cargarDatosProgramacion()
  }

  useEffect(() => {
    cargarDatosProgramacion()
  }, [cargarDatosProgramacion])

  // Programa actual
  const programaActual = useMemo(() => {
    return programas.find(p => p.code_program === selectedProgramCode) || null
  }, [programas, selectedProgramCode])

  const totalSemestres = programaActual?.numero_semestre || 10

  // HU-016 criterio 3: el coordinador asigna solo con su plazo abierto; el administrador conserva
  // el comportamiento actual. Pendiente: el backend aún no valida este plazo.
  const puedeAsignar = isAdmin || (isCoordinador && plazoCoordinadorAbierto(periodoActivo))
  const soloConsultaCoordinador = isCoordinador && !isAdmin && !puedeAsignar

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

  // Materias de cada semestre: cursos programados + asignaturas de la malla que aún no tienen curso.
  const materiasPorSemestre = useMemo(() => {
    const porSemestre = {}
    for (let s = 1; s <= totalSemestres; s++) porSemestre[s] = []

    // 1. Cursos que ya existen en cursos_programacion. La clave combina código y jornada:
    //    con un programa de ambas jornadas una asignatura tiene un curso por jornada y no se pisan.
    const cursosMap = new Map()
    cursosProgramados.forEach(c => {
      const semestre = Number(c.semestre)
      if (!porSemestre[semestre]) porSemestre[semestre] = []
      const jornada = normalizarJornada(c.jornada)
      cursosMap.set(`${c.codeCourse}|${jornada}`, c)
      porSemestre[semestre].push({
        clave: c.id != null ? `curso-${c.id}` : `${c.codeCourse}|${jornada}|${c.grupo ?? ''}`,
        id: c.id,
        codeCourse: c.codeCourse,
        nameCourse: c.nombreAsignatura || c.name_course,
        credits: c.credits,
        semestre: c.semestre,
        // El grupo lo asigna HU-046; no se inventa un número.
        grupo: c.grupo ?? null,
        codigoCurso: c.codigoCurso || null,
        jornada,
        idDocente: c.idDocente,
        nombreDocente: c.nombreDocente,
        estado: c.idDocente ? 'ASIGNADO' : 'PROGRAMADO',
        existeEnProgramacion: true,
      })
    })

    // 2. Asignaturas de la malla sin curso en ninguna jornada (por ejemplo, la malla cambió después
    //    de generar). Toman la jornada del programa; con AMBAS aparecen con cualquier filtro.
    const codigosConCurso = new Set([...cursosMap.values()].map(c => c.codeCourse))
    const jornadaPrograma = normalizarJornada(programaActual?.jornada)
    materiasPensumPrograma.forEach(p => {
      const semestre = Number(p.semestre)
      if (codigosConCurso.has(p.code_course)) return
      if (!porSemestre[semestre]) porSemestre[semestre] = []
      porSemestre[semestre].push({
        clave: `malla-${p.code_course}-${semestre}`,
        id: null,
        codeCourse: p.code_course,
        nameCourse: p.name_course,
        credits: p.credits,
        semestre: p.semestre,
        grupo: null,
        codigoCurso: null,
        jornada: jornadaPrograma,
        idDocente: null,
        nombreDocente: null,
        estado: 'PROGRAMADO',
        existeEnProgramacion: false,
      })
    })

    return porSemestre
  }, [cursosProgramados, materiasPensumPrograma, programaActual, totalSemestres])

  // Materias del semestre escogido, con los filtros aplicados
  const materiasDelSemestre = useMemo(
    () => filtrarMaterias(materiasPorSemestre[selectedSemestre] || [], {
      jornada: filtroJornada,
      docentes: filtroDocentes
    }),
    [materiasPorSemestre, selectedSemestre, filtroJornada, filtroDocentes]
  )

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
    if (!puedeAsignar) return
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
    if (!materiaParaDesignar || !periodoActivo?.id || !puedeAsignar) return
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
    if (!materia.id || !puedeAsignar) return
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

  // Conteo por semestre para los botones superiores. Usa el mismo filtro de la lista:
  // siempre la jornada elegida; los pendientes son las materias sin docente.
  const resumenPorSemestre = useMemo(() => {
    const mapa = {}
    for (let s = 1; s <= totalSemestres; s++) {
      const enJornada = filtrarMaterias(materiasPorSemestre[s] || [], {
        jornada: filtroJornada,
        docentes: 'TODOS'
      })
      const pendientes = filtrarMaterias(enJornada, { jornada: 'AMBAS', docentes: 'SIN_DOCENTE' }).length
      mapa[s] = {
        total: enJornada.length,
        asignados: enJornada.length - pendientes,
        pendientes
      }
    }
    return mapa
  }, [totalSemestres, materiasPorSemestre, filtroJornada])

  // Criterio 1: total de pendientes del programa (en la jornada elegida)
  const totalPendientesPrograma = useMemo(
    () => Object.values(resumenPorSemestre).reduce((acc, r) => acc + r.pendientes, 0),
    [resumenPorSemestre]
  )

  const soloPendientes = filtroDocentes === 'SIN_DOCENTE'
  const coordinadorSinPrograma = isCoordinador && !coordinadorPerfil?.code_program
  const cargandoVista = periodosCargando || loading
  const mostrarLista = !coordinadorSinPrograma && !cargandoVista && !errorCarga && hayProgramacion
  const asignadasEnSemestre = materiasDelSemestre.filter(m => m.idDocente).length

  const textoPendientes = (n) => `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`

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

      {/* HU-016 criterio 6: coordinador sin programa asignado */}
      {coordinadorSinPrograma && (
        <div className="asig-doc-estado-vacio">
          <AlertCircle size={36} className="asig-doc-estado-icono" />
          <h3>Aún no tiene un programa asignado. Contacte al administrador</h3>
        </div>
      )}

      {!coordinadorSinPrograma && (<>
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
              onChange={(e) => handleCambiarPrograma(e.target.value)}
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

      {/* 3. Barra de Selección de Semestre + filtros de HU-016 */}
      <div className="asig-doc-semestres-row">
        <div className="asig-doc-semestres-bar" role="tablist" aria-label="Semestres del programa">
          {Array.from({ length: totalSemestres }, (_, i) => i + 1).map(sem => {
            const res = resumenPorSemestre[sem] || { total: 0, asignados: 0, pendientes: 0 }
            const isActive = selectedSemestre === sem
            let subtitulo
            let atenuado = false
            if (soloPendientes) {
              subtitulo = res.pendientes > 0 ? textoPendientes(res.pendientes) : 'Sin pendientes'
              atenuado = res.pendientes === 0
            } else {
              subtitulo = res.total > 0 ? `${res.asignados}/${res.total} asignadas` : 'Sin materias'
            }
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
                <span className={`asig-doc-semestre-sub ${atenuado ? 'atenuado' : ''}`}>
                  {subtitulo}
                </span>
              </button>
            )
          })}
        </div>

        <div className="asig-doc-filtros">
          <div className="asig-doc-filtro">
            <span className="asig-doc-filtro-label">Jornada</span>
            <div className="asig-doc-segmentado" role="group" aria-label="Filtrar por jornada">
              {OPCIONES_JORNADA.map(op => (
                <button
                  key={op.value}
                  type="button"
                  className={`asig-doc-segmento ${filtroJornada === op.value ? 'active' : ''}`}
                  aria-pressed={filtroJornada === op.value}
                  onClick={() => setFiltroJornada(op.value)}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
          <div className="asig-doc-filtro">
            <span className="asig-doc-filtro-label">Docentes</span>
            <div className="asig-doc-segmentado" role="group" aria-label="Filtrar por docente asignado">
              {OPCIONES_DOCENTES.map(op => (
                <button
                  key={op.value}
                  type="button"
                  className={`asig-doc-segmento ${filtroDocentes === op.value ? 'active' : ''}`}
                  aria-pressed={filtroDocentes === op.value}
                  onClick={() => setFiltroDocentes(op.value)}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Materias desplegadas para ese semestre */}
      <div className="asig-doc-materias-section">
        {mostrarLista && (
          <div className="asig-doc-materias-header">
            <div className="asig-doc-materias-title">
              <Layers size={18} style={{ color: '#c8102e' }} />
              <span>Materias de Semestre {selectedSemestre}</span>
              <span className="badge badge-neutral" style={{ fontSize: '0.78rem' }}>
                {materiasDelSemestre.length} {materiasDelSemestre.length === 1 ? 'materia' : 'materias'}
              </span>
            </div>
            {soloPendientes ? (
              <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                {materiasDelSemestre.length} {materiasDelSemestre.length === 1 ? 'materia pendiente' : 'materias pendientes'} en el semestre · Total del programa: {textoPendientes(totalPendientesPrograma)}
              </div>
            ) : materiasDelSemestre.length > 0 && (
              <div style={{ fontSize: '0.84rem', color: '#64748b' }}>
                {asignadasEnSemestre} de {materiasDelSemestre.length} materias con docente designado
              </div>
            )}
          </div>
        )}

        {mostrarLista && soloConsultaCoordinador && (
          <div className="asig-doc-aviso-consulta" role="status">
            <AlertCircle size={16} />
            <span>Fuera del período habilitado: solo consulta</span>
          </div>
        )}

        {cargandoVista ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '0.5rem', color: '#c8102e' }} />
            <p>Cargando materias del semestre y estado de asignaciones...</p>
          </div>
        ) : errorCarga ? (
          <div className="asig-doc-estado-vacio" role="alert">
            <AlertCircle size={36} className="asig-doc-estado-icono error" />
            <h3>No se pudo cargar</h3>
            <button type="button" className="btn-primary btn-sm" onClick={handleReintentar}>
              <RefreshCw size={14} />
              <span>Reintentar</span>
            </button>
          </div>
        ) : !hayProgramacion ? (
          <div className="asig-doc-estado-vacio">
            <BookOpen size={36} className="asig-doc-estado-icono" />
            <h3>Aún no hay programación iniciada</h3>
          </div>
        ) : materiasDelSemestre.length === 0 ? (
          <div className="asig-doc-estado-vacio">
            <BookOpen size={36} className="asig-doc-estado-icono" />
            <h3>
              {soloPendientes
                ? 'No hay materias pendientes de asignación'
                : filtroJornada === 'AMBAS'
                  ? `No hay materias registradas en el Semestre ${selectedSemestre}`
                  : `No hay materias de la jornada ${ETIQUETA_JORNADA[filtroJornada]} en el Semestre ${selectedSemestre}`}
            </h3>
          </div>
        ) : (
          <div className="asig-doc-materias-grid">
            {materiasDelSemestre.map((mat) => {
              const tieneDocente = Boolean(mat.idDocente)
              const horariosDoc = tieneDocente ? formatearHorariosDocente(mat.idDocente) : null

              return (
                <div
                  key={mat.clave}
                  className={`asig-doc-materia-card ${tieneDocente ? 'asignado' : 'sin-asignar'}`}
                >
                  <div>
                    <div className="asig-doc-card-top">
                      <span className="asig-doc-course-code">{mat.codeCourse}</span>
                      <span className="asig-doc-group-badge">{textoGrupo(mat)}</span>
                    </div>

                    <h4 className="asig-doc-materia-name">{mat.nameCourse}</h4>

                    <div className="asig-doc-materia-meta">
                      <span><strong>{mat.credits}</strong> créditos</span>
                      <span>•</span>
                      <span>Jornada {ETIQUETA_JORNADA[mat.jornada] || mat.jornada}</span>
                      <span>•</span>
                      <span>Semestre {mat.semestre}</span>
                    </div>

                    {/* Información del Docente asignado o pendiente */}
                    <div className={`asig-doc-docente-box ${tieneDocente ? 'con-docente' : ''}`}>
                      <div className="asig-doc-docente-header">
                        <span className="asig-doc-docente-label">Docente Responsable</span>
                        <span
                          className={`badge ${tieneDocente ? 'badge-success' : 'asig-doc-badge-pendiente'}`}
                          style={{ fontSize: '0.72rem', padding: '0.15rem 0.45rem' }}
                        >
                          {tieneDocente ? 'Designado' : 'Sin docente asignado'}
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

                  {/* Acciones: con el plazo cerrado la vista es solo de consulta (criterio 3) */}
                  {puedeAsignar && (
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
                        <span>Asignar docente</span>
                      </button>
                    )}
                  </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
      </>)}

      {/* 5. Modal de Designación de Docentes con Horarios */}
      {materiaParaDesignar && (
        <div className="asig-modal-backdrop" onClick={() => setMateriaParaDesignar(null)}>
          <div className="asig-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="asig-modal-header">
              <div>
                <h3 className="asig-modal-title">Designar Docente a la Materia</h3>
                <div className="asig-modal-target">
                  <strong>{materiaParaDesignar.codeCourse} - {materiaParaDesignar.nameCourse}</strong> ({textoGrupo(materiaParaDesignar)} · Jornada {ETIQUETA_JORNADA[materiaParaDesignar.jornada] || materiaParaDesignar.jornada} · Semestre {selectedSemestre})
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
