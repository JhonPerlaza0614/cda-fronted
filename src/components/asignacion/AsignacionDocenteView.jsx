import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
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

/**
 * Texto del grupo: solo el número de grupo asignado por HU-046 (ej. «53»), sin el código de
 * la asignatura (no «204133C-53») ni la palabra «Grupo», igual que en «Cursos Programados» (2026-11-06).
 */
function textoGrupo(materia) {
  if (materia.grupo != null) return String(materia.grupo)
  return 'Sin grupo'
}

/** Plazo del coordinador abierto (HU-002 criterio 3: sin fechas definidas, solo consulta). */
function plazoCoordinadorAbierto(periodo, ahora = Date.now()) {
  const inicio = periodo?.plazoCoordinadorInicio ? new Date(periodo.plazoCoordinadorInicio).getTime() : NaN
  const fin = periodo?.plazoCoordinadorFin ? new Date(periodo.plazoCoordinadorFin).getTime() : NaN
  if (Number.isNaN(inicio) || Number.isNaN(fin)) return false
  return ahora >= inicio && ahora <= fin
}

// ---------------------------------------------------------------------------
// HU-016 (ajuste): programa según la jornada
// ---------------------------------------------------------------------------

/** Texto sin tildes, en minúsculas y sin espacios extra, para comparar nombres de programa. */
const normalizarTexto = (texto) => String(texto || '')
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim()

/** Código base del programa: la parte antes del guion (2839-DIU → 2839). Null si no tiene guion. */
function codigoBasePrograma(codigo) {
  const c = String(codigo || '').trim().toUpperCase()
  const i = c.indexOf('-')
  return i > 0 ? c.slice(0, i) : null
}

const esProgramaActivo = (p) => p?.estado == null || String(p.estado).toUpperCase() === 'ACTIVO'

const ORDEN_JORNADA_PROGRAMA = { DIURNA: 0, AMBAS: 1, NOCTURNA: 2 }

/**
 * Programas relacionados: el mismo programa académico en distintas jornadas.
 * - Si el código tiene guion, son los programas activos con el mismo código base
 *   (2839-DIU y 2839-NOC comparten 2839).
 * - Si no tiene guion, los programas activos con el mismo nombre normalizado.
 * El programa de referencia siempre se incluye. Orden: diurna, ambas, nocturna.
 */
function programasRelacionados(programa, programas) {
  if (!programa) return []
  const base = codigoBasePrograma(programa.code_program)
  const nombre = normalizarTexto(programa.name_program)
  const relacionados = (programas || []).filter(p => {
    if (p.code_program === programa.code_program) return true
    if (!esProgramaActivo(p)) return false
    if (base) return codigoBasePrograma(p.code_program) === base
    return nombre !== '' && normalizarTexto(p.name_program) === nombre
  })
  if (!relacionados.some(p => p.code_program === programa.code_program)) relacionados.unshift(programa)
  return relacionados.sort((a, b) =>
    (ORDEN_JORNADA_PROGRAMA[normalizarJornada(a.jornada)] ?? 9) - (ORDEN_JORNADA_PROGRAMA[normalizarJornada(b.jornada)] ?? 9))
}

/** Programas que se muestran con el filtro de jornada: el de esa jornada o el de AMBAS; con AMBAS, todos. */
function programasDeJornada(relacionados, jornada) {
  if (jornada === 'AMBAS') return relacionados
  return relacionados.filter(p => {
    const j = normalizarJornada(p.jornada)
    return j === jornada || j === 'AMBAS'
  })
}

/**
 * Duración del programa con el filtro de jornada: Nocturna usa semestres_nocturna (si falta,
 * numero_semestre); Diurna usa numero_semestre. Con Ambas, la de su propia jornada, o la mayor
 * si el programa es de ambas jornadas.
 */
function duracionPrograma(programa, jornada) {
  const diurna = Number(programa?.numero_semestre) || null
  const nocturna = Number(programa?.semestres_nocturna) || null
  const jornadaPrograma = normalizarJornada(programa?.jornada)
  if (jornada === 'NOCTURNA') return nocturna || diurna || 10
  if (jornada === 'DIURNA') return diurna || nocturna || 10
  if (jornadaPrograma === 'NOCTURNA') return nocturna || diurna || 10
  if (jornadaPrograma === 'DIURNA') return diurna || nocturna || 10
  return Math.max(diurna || 0, nocturna || 0) || 10
}

/** Jornada inicial del filtro: Nocturna si el programa es solo nocturno; si no, Diurna. */
const jornadaInicialDe = (programa) =>
  normalizarJornada(programa?.jornada) === 'NOCTURNA' ? 'NOCTURNA' : FILTRO_JORNADA_DEFECTO

const consultaJornada = (filtro) => (filtro === 'AMBAS' ? '' : filtro)

export default function AsignacionDocenteView({
  user,
  isAdmin = false,
  isCoordinador = false,
  coordinadorPerfil = null,
  programas = [],
  // HU-016: todos los programas, para encontrar la versión del programa en la otra jornada
  // (al coordinador `programas` le llega solo con el suyo).
  programasTodos = null,
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

  // 3. Datos de cursos programados (por programa visible), docentes y sus disponibilidades
  const [cursosPorPrograma, setCursosPorPrograma] = useState({}) // { codeProgram: [cursos, incluidos excluidos] }
  const [docentesList, setDocentesList] = useState([])
  const [disponibilidadesMap, setDisponibilidadesMap] = useState({}) // { docenteId: [items] }
  const [evaluacionesMap, setEvaluacionesMap] = useState({}) // { docenteId: evaluation }
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [periodosCargando, setPeriodosCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  // Número de la última carga: una respuesta de una carga anterior (otra jornada) se ignora.
  const cargaSeq = useRef(0)

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
      if (codigo !== selectedProgramCode) setSelectedProgramCode(codigo)
    } else if (!selectedProgramCode && programas.length > 0) {
      setSelectedProgramCode(programas[0].code_program)
    }
  }, [isCoordinador, coordinadorPerfil, programas, selectedProgramCode])

  // Todos los programas disponibles para buscar los relacionados
  const todosLosProgramas = useMemo(
    () => (Array.isArray(programasTodos) && programasTodos.length > 0 ? programasTodos : programas),
    [programasTodos, programas]
  )

  // Programa de referencia: el del coordinador, o el que elige el administrador
  const programaBase = useMemo(
    () => todosLosProgramas.find(p => p.code_program === selectedProgramCode)
      || programas.find(p => p.code_program === selectedProgramCode)
      || null,
    [todosLosProgramas, programas, selectedProgramCode]
  )

  const relacionados = useMemo(
    () => programasRelacionados(programaBase, todosLosProgramas),
    [programaBase, todosLosProgramas]
  )

  // Programas que se muestran con la jornada elegida
  const programasVisibles = useMemo(
    () => programasDeJornada(relacionados, filtroJornada),
    [relacionados, filtroJornada]
  )
  const codigosVisibles = programasVisibles.map(p => p.code_program).join('|')

  // Al entrar o al cambiar de programa: filtros por defecto (Nocturna si el programa es solo nocturno)
  const programaInicializado = useRef(null)
  useEffect(() => {
    const codigo = programaBase?.code_program || null
    if (!codigo || programaInicializado.current === codigo) return
    programaInicializado.current = codigo
    setFiltroJornada(jornadaInicialDe(programaBase))
    setFiltroDocentes(FILTRO_DOCENTES_DEFECTO)
    setSelectedSemestre(1)
  }, [programaBase])

  // HU-016: el administrador cambia de programa; los filtros vuelven a su valor por defecto (efecto anterior)
  const handleCambiarPrograma = (codigo) => {
    setSelectedProgramCode(codigo)
  }

  // Al cambiar de jornada: Semestre 1 y estado de carga; el filtro de docentes se conserva
  const handleCambiarJornada = (jornada) => {
    if (jornada === filtroJornada) return
    setFiltroJornada(jornada)
    setSelectedSemestre(1)
    setLoading(true)
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

  // Cargar los cursos de cada programa visible (con la jornada elegida) y las disponibilidades
  const cargarDatosProgramacion = useCallback(async (silencioso = false) => {
    const seq = ++cargaSeq.current
    const codigos = codigosVisibles ? codigosVisibles.split('|') : []
    if (!periodoActivo?.id || codigos.length === 0) {
      setCursosPorPrograma({})
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    try {
      // HU-016 criterio 7: el error de la programación no se oculta; la disponibilidad sí puede faltar.
      const [listas, disps] = await Promise.all([
        Promise.all(codigos.map(codeProgram =>
          getProgramacion(periodoActivo.id, { codeProgram, jornada: consultaJornada(filtroJornada) }))),
        consultarDisponibilidadesPeriodo(periodoActivo.id).catch(() => ({}))
      ])
      if (seq !== cargaSeq.current) return // llegó tarde: el usuario ya cambió de jornada

      const mapa = {}
      codigos.forEach((codeProgram, i) => {
        mapa[codeProgram] = Array.isArray(listas[i]) ? listas[i] : []
      })
      setCursosPorPrograma(mapa)
      setDisponibilidadesMap(disps || {})
      setErrorCarga(false)
    } catch (err) {
      if (seq !== cargaSeq.current) return
      console.error('Error al cargar programación académica:', err)
      setErrorCarga(true)
    } finally {
      if (seq === cargaSeq.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }, [periodoActivo, codigosVisibles, filtroJornada])

  // Después de asignar o quitar un docente: solo se recargan los cursos de ese programa
  const recargarCursosDePrograma = useCallback(async (codeProgram) => {
    if (!periodoActivo?.id || !codeProgram) return
    const seq = cargaSeq.current
    setRefreshing(true)
    try {
      const lista = await getProgramacion(periodoActivo.id, {
        codeProgram,
        jornada: consultaJornada(filtroJornada)
      })
      if (seq !== cargaSeq.current) return
      setCursosPorPrograma(prev => ({ ...prev, [codeProgram]: Array.isArray(lista) ? lista : [] }))
    } catch (err) {
      if (seq !== cargaSeq.current) return
      console.error('Error al recargar los cursos del programa:', err)
      setErrorCarga(true)
    } finally {
      if (seq === cargaSeq.current) setRefreshing(false)
    }
  }, [periodoActivo, filtroJornada])

  // Reintentar (criterio 7): si fallaron los períodos, se recargan; si no, la programación.
  const handleReintentar = () => {
    if (!periodoActivo) cargarPeriodos()
    else cargarDatosProgramacion()
  }

  useEffect(() => {
    cargarDatosProgramacion()
  }, [cargarDatosProgramacion])

  // Criterio 5: hay programación iniciada si algún programa visible tiene cursos en el período
  // (aunque estén excluidos).
  const hayProgramacion = useMemo(
    () => Object.values(cursosPorPrograma).some(lista => lista.length > 0),
    [cursosPorPrograma]
  )

  // Cursos activos de los programas visibles, cada uno con el programa al que pertenece
  const cursosProgramados = useMemo(() => {
    const lista = []
    Object.entries(cursosPorPrograma).forEach(([codeProgram, cursos]) => {
      cursos.forEach(c => {
        if (c.estado !== 'EXCLUIDO') lista.push({ ...c, codeProgram: c.codeProgram || codeProgram })
      })
    })
    return lista
  }, [cursosPorPrograma])

  // La barra de semestres llega hasta la mayor duración de los programas visibles
  const totalSemestres = useMemo(
    () => programasVisibles.reduce((max, p) => Math.max(max, duracionPrograma(p, filtroJornada)), 0),
    [programasVisibles, filtroJornada]
  )

  // HU-016 criterio 3: el coordinador asigna solo con su plazo abierto; el administrador conserva
  // el comportamiento actual. Pendiente: el backend aún no valida este plazo.
  const puedeAsignar = isAdmin || (isCoordinador && plazoCoordinadorAbierto(periodoActivo))
  const soloConsultaCoordinador = isCoordinador && !isAdmin && !puedeAsignar

  // Facultad de un programa
  const facultadDe = useCallback((programa) => {
    if (!programa?.id_facultad_programa) return null
    return facultadesList.find(f => f.id === programa.id_facultad_programa) || null
  }, [facultadesList])

  // Asignaturas activas de la malla de un programa
  const mallaDe = useCallback(
    (codeProgram) => pensumList.filter(item => item.code_program === codeProgram && item.activo !== false),
    [pensumList]
  )

    // Materias de cada semestre: por cada programa visible, solo sus cursos programados.
  const materiasPorSemestre = useMemo(() => {
    const porSemestre = {}
    for (let s = 1; s <= totalSemestres; s++) porSemestre[s] = []
    const agregar = (semestre, item) => {
      if (!porSemestre[semestre]) porSemestre[semestre] = []
      porSemestre[semestre].push(item)
    }

    // Solo cursos ya generados en cursos_programacion: el backend no asigna docente
    // a materias de la malla sin curso. La clave es el id del curso: con «Ambas» una misma
    // asignatura puede aparecer en dos programas o en dos jornadas y no se pisan.
    programasVisibles.forEach(prog => {
      const codeProgram = prog.code_program
      cursosProgramados
        .filter(c => c.codeProgram === codeProgram)
        .forEach(c => {
          const jornada = normalizarJornada(c.jornada)
          agregar(Number(c.semestre), {
            clave: c.id != null ? `curso-${c.id}` : `${codeProgram}|${c.codeCourse}|${jornada}|${c.grupo ?? ''}`,
            id: c.id,
            codeProgram,
            codeCourse: c.codeCourse,
            nameCourse: c.nombreAsignatura || c.name_course,
            credits: c.credits,
            semestre: c.semestre,
            // El grupo lo asigna HU-046; no se inventa un número.
            grupo: c.grupo ?? null,
            jornada,
            idDocente: c.idDocente,
            nombreDocente: c.nombreDocente,
            estado: c.idDocente ? 'ASIGNADO' : 'PROGRAMADO',
            existeEnProgramacion: true,
          })
        })
    })

    return porSemestre
  }, [cursosProgramados, programasVisibles, totalSemestres])

  // Materias del semestre escogido, con los filtros aplicados
  const materiasDelSemestre = useMemo(
    () => filtrarMaterias(materiasPorSemestre[selectedSemestre] || [], {
      jornada: filtroJornada,
      docentes: filtroDocentes
    }),
    [materiasPorSemestre, selectedSemestre, filtroJornada, filtroDocentes]
  )

  // Programa y facultad de la materia que se está designando (el modal usa el programa del curso)
  const programaModal = useMemo(
    () => todosLosProgramas.find(p => p.code_program === materiaParaDesignar?.codeProgram) || programaBase,
    [todosLosProgramas, materiaParaDesignar, programaBase]
  )
  const facultadModal = useMemo(() => facultadDe(programaModal), [facultadDe, programaModal])

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
    if (soloDelPrograma && programaModal) {
      const progCode = String(programaModal.code_program || '').trim().toUpperCase()
      const idFacultadProg = programaModal.id_facultad_programa != null
        ? Number(programaModal.id_facultad_programa)
        : null
      const nombreFacultadProg = facultadModal?.nombre
        ? facultadModal.nombre.toLowerCase().trim()
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
  }, [docentesList, soloDelPrograma, programaModal, facultadModal, materiaParaDesignar, soloConDisponibilidad, disponibilidadesMap, busquedaDocente])

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
      await asignarDocenteACurso(materiaParaDesignar.id, docente.id, Boolean(reemplazando))

      onShowToast?.(`Docente ${docente.nombres} ${docente.apellidos} asignado correctamente a ${materiaParaDesignar.nameCourse}`, 'success')
      const programaDelCurso = materiaParaDesignar.codeProgram
      setMateriaParaDesignar(null)
      await recargarCursosDePrograma(programaDelCurso)
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
      await recargarCursosDePrograma(materia.codeProgram)
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
  // HU-016: el programa del coordinador no tiene versión en la jornada elegida
  const sinProgramaEnJornada = Boolean(programaBase) && programasVisibles.length === 0
  const mostrarLista = !coordinadorSinPrograma && !sinProgramaEnJornada && !cargandoVista && !errorCarga && hayProgramacion
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
      {/* 2. Barra de filtros de HU-016: la jornada decide qué programa se muestra debajo */}
      <div className="asig-doc-filtros-bar">
        {!isCoordinador && (
          <div className="asig-doc-filtro">
            <span className="asig-doc-filtro-label">Programa</span>
            <select
              className="asig-doc-program-select"
              value={selectedProgramCode}
              onChange={(e) => handleCambiarPrograma(e.target.value)}
              aria-label="Seleccionar programa académico"
            >
              {programas.map(p => (
                <option key={p.code_program} value={p.code_program}>
                  {p.code_program} - {p.name_program}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="asig-doc-filtro">
          <span className="asig-doc-filtro-label">Jornada</span>
          <div className="asig-doc-segmentado" role="group" aria-label="Filtrar por jornada">
            {OPCIONES_JORNADA.map(op => (
              <button
                key={op.value}
                type="button"
                className={`asig-doc-segmento ${filtroJornada === op.value ? 'active' : ''}`}
                aria-pressed={filtroJornada === op.value}
                onClick={() => handleCambiarJornada(op.value)}
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

      {/* 3. Programa(s) de la jornada elegida: una tarjeta por programa */}
      {sinProgramaEnJornada ? (
        <div className="asig-doc-estado-vacio asig-doc-sin-jornada">
          <AlertCircle size={36} className="asig-doc-estado-icono" />
          <h3>Su programa no se oferta en jornada {ETIQUETA_JORNADA[filtroJornada]}</h3>
        </div>
      ) : (
        <div className="asig-doc-programas">
          {programasVisibles.map(prog => {
            const facultad = facultadDe(prog)
            return (
              <div key={prog.code_program} className="asig-doc-program-bar">
                <div className="asig-doc-program-info">
                  <BookOpen size={18} style={{ color: '#c8102e' }} />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#64748b' }}>Programa Académico:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <span className="asig-doc-program-code">{prog.code_program}</span>
                    <span className="asig-doc-program-name">{prog.name_program}</span>
                    {facultad && (
                      <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>
                        <Building2 size={12} style={{ display: 'inline', marginRight: '3px' }} />
                        {facultad.nombre}
                      </span>
                    )}
                    <span className="badge badge-neutral" style={{ fontSize: '0.75rem' }}>Jornada {prog.jornada || 'DIURNA'}</span>
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#64748b', fontWeight: 500 }}>
                  Duración: <strong>{duracionPrograma(prog, filtroJornada)} semestres</strong> · Total materias en malla: <strong>{mallaDe(prog.code_program).length}</strong>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 4. Barra de Selección de Semestre (ancho completo) */}
      {!sinProgramaEnJornada && (
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
      )}

      {/* 5. Materias desplegadas para ese semestre */}
      <div className="asig-doc-materias-section">
        {mostrarLista && (
          <div className="asig-doc-materias-header">
            <div className="asig-doc-materias-title">
              <Layers size={18} style={{ color: '#c8102e' }} />
              <span>Materias de Semestre {selectedSemestre}</span>
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

        {sinProgramaEnJornada ? null : cargandoVista ? (
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
                      {programasVisibles.length > 1 && (
                        <>
                          <span>•</span>
                          <span>Programa {mat.codeProgram}</span>
                        </>
                      )}
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

      {/* 6. Modal de Designación de Docentes con Horarios */}
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
                    Área: <strong>{facultadModal?.nombre || programaModal?.name_program || 'Programa actual'}</strong>
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
