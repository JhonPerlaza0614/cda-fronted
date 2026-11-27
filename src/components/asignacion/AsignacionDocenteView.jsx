import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  CalendarCheck,
  CalendarDays,
  UserCheck,
  UserX,
  Search,
  BookOpen,
  Clock,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Info,
  X,
  Layers,
  UserPlus,
  Building2,
  Plus,
  Trash2,
  Pencil
} from 'lucide-react'
import {
  getDocentes,
  getEvaluacionesDocentes,
  getCargaPorPeriodo
} from '../../services/docenteService'
import { getPeriodos, getFacultades } from '../../services/academicService'
import {
  getProgramacion,
  asignarDocenteACurso,
  getElectivasProgramadas,
  programarElectiva,
  modificarElectiva,
  quitarElectiva
} from '../../services/programacionService'
import { consultarDisponibilidadesPeriodo } from '../../services/DisponibilidadService'
import './AsignacionDocenteView.css'
import './AsignacionDocenteComplementarias.css'

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

// Disponibilidad expresada en horas (incluye franjas de media hora).
function horasRegistradas(franjas) {
  if (!Array.isArray(franjas)) return 0
  return franjas.reduce((total, f) => {
    const inicio = String(f.horaInicio || '').split(':').map(Number)
    const fin = String(f.horaFin || '').split(':').map(Number)
    if (inicio.length < 2 || fin.length < 2) return total
    const minutos = (fin[0] * 60 + fin[1]) - (inicio[0] * 60 + inicio[1])
    return total + Math.max(0, minutos) / 60
  }, 0)
}


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
  onShowToast,
  onNavigateToPeriodos
}) {
  // 1. Estado de selección de Programa y Período
  // HU-016 criterio 6: el coordinador solo ve su programa; sin programa asignado no se toma otro.
  const defaultProgramCode = isCoordinador
    ? (coordinadorPerfil?.code_program || '')
    : (programas[0]?.code_program || '')

  const [selectedProgramCode, setSelectedProgramCode] = useState(defaultProgramCode)
  const [periodoActivo, setPeriodoActivo] = useState(null)
  const [facultadesList, setFacultadesList] = useState([])

  // 2. Semestre seleccionado (donde escojan un semestre)
  const [selectedSemestre, setSelectedSemestre] = useState(1)

  // 3. Datos de cursos programados (por programa visible), docentes y sus disponibilidades
  const [cursosPorPrograma, setCursosPorPrograma] = useState({}) // { codeProgram: [cursos, incluidos excluidos] }
  const [docentesList, setDocentesList] = useState([])
  const [disponibilidadesMap, setDisponibilidadesMap] = useState({}) // { docenteId: [items] }
  const [cargaPorDocente, setCargaPorDocente] = useState({})
  const [cargaDisponible, setCargaDisponible] = useState(false)
  const [evaluacionesMap, setEvaluacionesMap] = useState({}) // { docenteId: evaluation }
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [periodosCargando, setPeriodosCargando] = useState(true)
  const [errorCarga, setErrorCarga] = useState(false)
  // Número de la última carga: una respuesta de una carga anterior (otra jornada) se ignora.
  const cargaSeq = useRef(0)
  // Datos del modal (docentes, disps, carga): se cargan solo la primera vez
  const datosModalCargados = useRef(false)

  // HU-016: filtros (no se guardan en localStorage)
  const [filtroJornada, setFiltroJornada] = useState(FILTRO_JORNADA_DEFECTO)
  const [filtroDocentes, setFiltroDocentes] = useState(FILTRO_DOCENTES_DEFECTO)

  // 4. Modal de designación de docente
  const [materiaParaDesignar, setMateriaParaDesignar] = useState(null)
  const [franjasSeleccionadas, setFranjasSeleccionadas] = useState({}) // { [docenteId]: franjaObj }
  const [franjasSeleccionadasDia2, setFranjasSeleccionadasDia2] = useState({}) // { [docenteId]: franjaObj } (segundo día)
  const [modoDistribucion, setModoDistribucion] = useState('1_DIA') // '1_DIA' | '2_DIAS'
  const [busquedaDocente, setBusquedaDocente] = useState('')
  const [soloDelPrograma, setSoloDelPrograma] = useState(true) // Por defecto solo docentes del programa/facultad
  const [asignandoId, setAsignandoId] = useState(null)

  // 5. Electivas complementarias del período: las propone cada coordinador, no ocupan un espacio de la malla
  const [comp, setComp] = useState({ lista: [], banco: [], pendientesObligatorias: [], puedeEditar: false, cargando: false, error: false })
  const [modalComp, setModalComp] = useState(null) // { cursoId, codeCourse, jornada, cupos }
  const [guardandoComp, setGuardandoComp] = useState(false)

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
      const vigente = lista.find(p => p.vigente || p.estado === 'VIGENTE') || null
      setPeriodoActivo(vigente)
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
      .catch(() => { })
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
      setCargaPorDocente({})
      setCargaDisponible(false)
      setLoading(false)
      setRefreshing(false)
      return
    }

    if (!silencioso) setLoading(true)
    else setRefreshing(true)

    try {
      // HU-016 criterio 7: el error de la programación no se oculta; la disponibilidad sí puede faltar.
      const [listas, disps, cargas] = await Promise.all([
        Promise.all(codigos.map(codeProgram =>
          getProgramacion(periodoActivo.id, { codeProgram, jornada: consultaJornada(filtroJornada) }))),
        consultarDisponibilidadesPeriodo(periodoActivo.id).catch(() => ({})),
        getCargaPorPeriodo(periodoActivo.id).catch(() => null)
      ])
      if (seq !== cargaSeq.current) return // llegó tarde: el usuario ya cambió de jornada

      const mapa = {}
      codigos.forEach((codeProgram, i) => {
        mapa[codeProgram] = Array.isArray(listas[i]) ? listas[i] : []
      })
      setCursosPorPrograma(mapa)
      setDisponibilidadesMap(disps || {})
      setCargaPorDocente(Array.isArray(cargas)
        ? Object.fromEntries(cargas.map(c => [String(c.docente_id), c])) : {})
      setCargaDisponible(Array.isArray(cargas))
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
      const [lista, cargas] = await Promise.all([
        getProgramacion(periodoActivo.id, {
          codeProgram,
          jornada: consultaJornada(filtroJornada)
        }),
        getCargaPorPeriodo(periodoActivo.id).catch(() => null)
      ])
      if (seq !== cargaSeq.current) return
      setCursosPorPrograma(prev => ({ ...prev, [codeProgram]: Array.isArray(lista) ? lista : [] }))
      setCargaPorDocente(Array.isArray(cargas)
        ? Object.fromEntries(cargas.map(c => [String(c.docente_id), c])) : {})
      setCargaDisponible(Array.isArray(cargas))
    } catch (err) {
      if (seq !== cargaSeq.current) return
      console.error('Error al recargar los cursos del programa:', err)
      setErrorCarga(true)
    } finally {
      if (seq === cargaSeq.current) setRefreshing(false)
    }
  }, [periodoActivo, filtroJornada])

  // Complementarias del programa elegido (no dependen de la jornada ni del semestre)
  const codigoProgramaComp = programaBase?.code_program || ''
  const cargarComplementarias = useCallback(async () => {
    if (!codigoProgramaComp) {
      setComp({ lista: [], banco: [], pendientesObligatorias: [], puedeEditar: false, cargando: false, error: false })
      return
    }
    setComp(prev => ({ ...prev, cargando: true, error: false }))
    try {
      const r = await getElectivasProgramadas(codigoProgramaComp)
      setComp({
        lista: Array.isArray(r?.complementarias) ? r.complementarias : [],
        banco: Array.isArray(r?.bancoComplementarias) ? r.bancoComplementarias : [],
        pendientesObligatorias: Array.isArray(r?.pendientesObligatorias) ? r.pendientesObligatorias : [],
        puedeEditar: Boolean(r?.puedeEditar),
        cargando: false,
        error: false
      })
    } catch (err) {
      console.error('Error al cargar las electivas complementarias:', err)
      setComp({ lista: [], banco: [], pendientesObligatorias: [], puedeEditar: false, cargando: false, error: true })
    }
  }, [codigoProgramaComp])

  useEffect(() => {
    cargarComplementarias()
  }, [cargarComplementarias, periodoActivo?.id])

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

  // HU-016 criterio 3: el coordinador asigna solo con su plazo abierto; el backend vuelve a validar
  // la ventana en cada operación para impedir que se omita la restricción desde una petición directa.
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
            horasSemanales: c.horasSemanales,
            semestre: c.semestre,
            // El grupo lo asigna HU-046; no se inventa un número.
            grupo: c.grupo ?? null,
            jornada,
            // Espacio de la malla que ocupa (solo electivas profesionales programadas por el coordinador)
            nombreEspacio: c.nombreEspacio || null,
            idDocente: c.idDocente,
            nombreDocente: c.nombreDocente,
            dia: c.dia,
            horaInicio: c.horaInicio,
            horaFin: c.horaFin,
            dia2: c.dia2,
            horaInicio2: c.horaInicio2,
            horaFin2: c.horaFin2,
            horario: c.horario,
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

  /**
   * Calcula las franjas horarias disponibles de un docente para la materia seleccionada:
   * 1. Descuenta horas y tiempos ya ocupados por otros cursos del docente en el mismo período.
   * 2. Respeta el límite máximo de 20 horas totales.
   * 3. Filtra únicamente aquellas franjas con horas disponibles >= horas presenciales de la materia.
   */
  const calcularFranjasDisponibles = useCallback((docenteId) => {
    const franjas = disponibilidadesMap[docenteId]
    if (!Array.isArray(franjas) || franjas.length === 0) return []

    const carga = cargaPorDocente[String(docenteId)]
    const totalAsignadas = Number(carga?.total_horas || 0)
    const limite = Number(carga?.limite ?? 20)

    const esActual = materiaParaDesignar?.idDocente != null &&
      Number(materiaParaDesignar.idDocente) === Number(docenteId)
    const propias = esActual ? Number(materiaParaDesignar.horasSemanales || 0) : 0
    const ocupadasOtras = Math.max(0, totalAsignadas - propias)
    const horasRestantes20h = Math.max(0, limite - ocupadasOtras)
    const horasRequeridas = modoDistribucion === '2_DIAS'
      ? (Number(materiaParaDesignar?.horasSemanales || 0) / 2.0)
      : Number(materiaParaDesignar?.horasSemanales || 0)

    // Cursos ya asignados a este docente en el período (excluyendo el actual)
    const cursosDelDocente = cursosProgramados.filter(c =>
      c.idDocente != null &&
      Number(c.idDocente) === Number(docenteId) &&
      c.id !== materiaParaDesignar?.id &&
      !c.isExcluido
    )

    const minutosATexto = (min) => {
      const h = Math.floor(min / 60)
      const m = min % 60
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    }

    const franjasAptas = []

    franjas.forEach((f, idx) => {
      const diaNom = DIAS_SEMANA[f.dia] || `Día ${f.dia}`
      const iniStr = f.horaInicio ? f.horaInicio.slice(0, 5) : ''
      const finStr = f.horaFin ? f.horaFin.slice(0, 5) : ''
      const inicioArr = iniStr.split(':').map(Number)
      const finArr = finStr.split(':').map(Number)
      if (inicioArr.length < 2 || finArr.length < 2) return

      const iniMin = inicioArr[0] * 60 + inicioArr[1]
      const finMin = finArr[0] * 60 + finArr[1]
      if (finMin <= iniMin) return

      // Recolectar intervalos ocupados en este día (sesión 1 y sesión 2 de otros cursos)
      const ocupados = []
      cursosDelDocente.forEach(c => {
        if (Number(c.dia) === Number(f.dia) && c.horaInicio && c.horaFin) {
          const cIni = String(c.horaInicio).slice(0, 5).split(':').map(Number)
          const cFin = String(c.horaFin).slice(0, 5).split(':').map(Number)
          const cIniMin = cIni[0] * 60 + cIni[1]
          const cFinMin = cFin[0] * 60 + cFin[1]
          if (cFinMin > iniMin && cIniMin < finMin) {
            ocupados.push([Math.max(iniMin, cIniMin), Math.min(finMin, cFinMin)])
          }
        }
        if (c.dia2 != null && Number(c.dia2) === Number(f.dia) && c.horaInicio2 && c.horaFin2) {
          const cIni2 = String(c.horaInicio2).slice(0, 5).split(':').map(Number)
          const cFin2 = String(c.horaFin2).slice(0, 5).split(':').map(Number)
          const cIniMin2 = cIni2[0] * 60 + cIni2[1]
          const cFinMin2 = cFin2[0] * 60 + cFin2[1]
          if (cFinMin2 > iniMin && cIniMin2 < finMin) {
            ocupados.push([Math.max(iniMin, cIniMin2), Math.min(finMin, cFinMin2)])
          }
        }
      })

      // Ordenar intervalos ocupados y calcular los sub-intervalos realmente libres
      ocupados.sort((a, b) => a[0] - b[0])
      const tramosLibres = []
      let cursor = iniMin
      for (const [oIni, oFin] of ocupados) {
        if (oIni > cursor) {
          tramosLibres.push([cursor, oIni])
        }
        if (oFin > cursor) {
          cursor = oFin
        }
      }
      if (cursor < finMin) {
        tramosLibres.push([cursor, finMin])
      }

      // Evaluar cada sub-tramo libre contra las horas requeridas y el límite de 20h
      tramosLibres.forEach(([subIni, subFin], subIdx) => {
        const horasLibres = (subFin - subIni) / 60.0
        const horasDisponiblesEfectivas = Math.min(horasLibres, horasRestantes20h)

        if (horasDisponiblesEfectivas >= horasRequeridas && horasRequeridas > 0) {
          const subIniStr = minutosATexto(subIni)
          const subFinStr = minutosATexto(subFin)
          const claseFinMin = subIni + Math.round(horasRequeridas * 60)
          const claseFinStr = minutosATexto(claseFinMin)
          const horaFinClase = `${claseFinStr}:00`

          franjasAptas.push({
            id: `${f.id || idx}-${f.dia}-${subIniStr}-${subFinStr}-${subIdx}`,
            dia: f.dia,
            diaNombre: diaNom,
            horaInicio: `${subIniStr}:00`,
            horaFin: `${subFinStr}:00`,
            horaFinClase,
            horasDisponiblesEfectivas,
            textoFranja: `${diaNom} ${subIniStr} - ${subFinStr} (${horasDisponiblesEfectivas.toFixed(1)}h libres)`,
            textoHorarioAsignar: `${diaNom} ${subIniStr} - ${claseFinStr}`
          })
        }
      })
    })

    return franjasAptas
  }, [disponibilidadesMap, cargaPorDocente, materiaParaDesignar, cursosProgramados, modoDistribucion])

  // La carga del API incluye TODOS los programas; si el curso ya pertenece al mismo
  // docente, se excluyen sus horas para no contarlas dos veces al volver a guardar.
  const capacidadDocente = useCallback((docenteId) => {
    const registradas = horasRegistradas(disponibilidadesMap[docenteId])
    const carga = cargaPorDocente[String(docenteId)]
    const asignadas = Number(carga?.total_horas || 0)
    const limite = Number(carga?.limite ?? 20)
    const esActual = materiaParaDesignar?.idDocente != null &&
      Number(materiaParaDesignar.idDocente) === Number(docenteId)
    const propias = esActual ? Number(materiaParaDesignar.horasSemanales || 0) : 0
    const ocupadasSinEsteCurso = Math.max(0, asignadas - propias)
    const restantes = Math.max(0, Math.min(registradas, limite) - ocupadasSinEsteCurso)
    const requeridas = materiaParaDesignar?.horasSemanales == null
      ? NaN : Number(materiaParaDesignar.horasSemanales)
    const valido = cargaDisponible && Number.isFinite(requeridas) && requeridas >= 0 &&
      Array.isArray(disponibilidadesMap[docenteId]) &&
      disponibilidadesMap[docenteId].length > 0 && restantes >= requeridas &&
      (ocupadasSinEsteCurso + requeridas <= limite) &&
      Number(carga?.cursos_sin_horas || 0) === 0
    return { registradas, asignadas, restantes, requeridas, valido }
  }, [disponibilidadesMap, cargaPorDocente, cargaDisponible, materiaParaDesignar])

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

    // 2. HU-013: se muestran docentes con franjas; la capacidad se valida al designar.
    // en el período activo. Se conserva en la lista al docente ya asignado para
    // mostrar su información, aunque sus franjas del período estén vacías.
    lista = lista.filter(d => {
      const disps = disponibilidadesMap[d.id]
      const tieneDisponibilidad = Array.isArray(disps) && disps.length > 0
      const yaEstaAsignado = materiaParaDesignar?.idDocente != null
        && Number(materiaParaDesignar.idDocente) === Number(d.id)
      return tieneDisponibilidad || yaEstaAsignado
    })

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

    // 4. Si hay historial de calificaciones previas (> 0) para esta asignatura, priorizar al inicio
    // a los docentes evaluados en ella (ordenados por mayor calificación).
    // Quienes no tienen calificación o tienen 0 ("No evaluado") se ordenan alfabéticamente después.
    const tieneHistorialEvaluacion = Object.values(evaluacionesMap).some(
      ev => ev?.calificacion != null && Number(ev.calificacion) > 0
    )
    if (tieneHistorialEvaluacion) {
      lista.sort((a, b) => {
        const notaA = Number(evaluacionesMap[String(a.id)]?.calificacion || 0)
        const notaB = Number(evaluacionesMap[String(b.id)]?.calificacion || 0)
        const evalA = notaA > 0
        const evalB = notaB > 0
        if (evalA && !evalB) return -1
        if (!evalA && evalB) return 1
        if (evalA && evalB && notaB !== notaA) return notaB - notaA
        return (a.nombres || '').localeCompare(b.nombres || '')
      })
    } else {
      lista.sort((a, b) => (a.nombres || '').localeCompare(b.nombres || ''))
    }

    return lista
  }, [docentesList, soloDelPrograma, programaModal, facultadModal, materiaParaDesignar, disponibilidadesMap, busquedaDocente, evaluacionesMap])

  // Abrir modal de asignación
  const handleAbrirDesignacion = async (materia) => {
    if (!puedeAsignar) return
    setMateriaParaDesignar(materia)
    setFranjasSeleccionadas({})
    setFranjasSeleccionadasDia2({})
    setModoDistribucion(materia?.dia2 != null ? '2_DIAS' : '1_DIA')
    setBusquedaDocente('')
    // En electivas complementarias, los docentes suelen pertenecer a otra facultad (artes, deporte, idiomas),
    // por eso se abre mostrando todas las facultades por defecto.
    setSoloDelPrograma(!materia?.esComplementaria)
    setEvaluacionesMap({})

    const promesas = []

    if (periodoActivo?.id && materia?.codeCourse) {
      promesas.push(
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
      )
    }

    // Docentes, disponibilidades y carga: solo la primera vez que se abre el modal
    if (!datosModalCargados.current && periodoActivo?.id) {
      promesas.push(
        Promise.all([
          getDocentes().catch(() => []),
          consultarDisponibilidadesPeriodo(periodoActivo.id).catch(() => ({})),
          getCargaPorPeriodo(periodoActivo.id).catch(() => null)
        ]).then(([docData, disps, cargas]) => {
          const lista = Array.isArray(docData) ? docData.filter(d => d.estado !== false) : []
          setDocentesList(lista)
          setDisponibilidadesMap(disps || {})
          setCargaPorDocente(Array.isArray(cargas)
            ? Object.fromEntries(cargas.map(c => [String(c.docente_id), c])) : {})
          setCargaDisponible(Array.isArray(cargas))
          datosModalCargados.current = true
        })
      )
    }

    await Promise.all(promesas)
  }

  // Ejecutar asignación de docente con la franja horaria elegida (1 día o 2 días)
  const handleConfirmarDesignacion = async (docente, franja1, franja2 = null) => {
    if (!capacidadDocente(docente.id).valido) {
      onShowToast?.('Este docente no tiene suficientes horas semanales restantes para la materia', 'error')
      return
    }
    if (!materiaParaDesignar || !periodoActivo?.id || !puedeAsignar) return

    if (modoDistribucion === '2_DIAS') {
      if (!franja1 || !franja2) {
        onShowToast?.('Por favor elija las dos sesiones de clase en días diferentes', 'warning')
        return
      }
      if (Number(franja1.dia) === Number(franja2.dia)) {
        onShowToast?.('Los dos días de clase deben ser diferentes', 'warning')
        return
      }
    } else {
      if (!franja1) {
        onShowToast?.('Por favor elija una franja horaria disponible para la clase', 'warning')
        return
      }
    }

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
      let horarioData = null
      let textoHorarioCompleto = ''
      if (modoDistribucion === '2_DIAS' && franja1 && franja2) {
        textoHorarioCompleto = `${franja1.textoHorarioAsignar} / ${franja2.textoHorarioAsignar}`
        horarioData = {
          dia: franja1.dia,
          horaInicio: franja1.horaInicio,
          horaFin: franja1.horaFinClase,
          dia2: franja2.dia,
          horaInicio2: franja2.horaInicio,
          horaFin2: franja2.horaFinClase,
          horario: textoHorarioCompleto
        }
      } else if (franja1) {
        textoHorarioCompleto = franja1.textoHorarioAsignar
        horarioData = {
          dia: franja1.dia,
          horaInicio: franja1.horaInicio,
          horaFin: franja1.horaFinClase,
          horario: franja1.textoHorarioAsignar
        }
      }

      await asignarDocenteACurso(materiaParaDesignar.id, docente.id, Boolean(reemplazando), horarioData)

      onShowToast?.(`Docente ${docente.nombres} ${docente.apellidos} asignado correctamente a ${materiaParaDesignar.nameCourse} (${textoHorarioCompleto})`, 'success')
      const programaDelCurso = materiaParaDesignar.codeProgram
      setMateriaParaDesignar(null)
      await recargarCursosDePrograma(programaDelCurso)
      await cargarComplementarias()
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
      if (materiaParaDesignar?.id === materia.id) setMateriaParaDesignar(null)
      await recargarCursosDePrograma(materia.codeProgram)
      await cargarComplementarias()
    } catch (err) {
      console.error('Error al desasignar docente:', err)
      onShowToast?.(`Error al desasignar: ${err.message || 'Error desconocido'}`, 'error')
    }
  }

  // ---- Electivas complementarias: proponer, modificar y quitar (solo sin docente) ----
  const abrirProponerComp = () => setModalComp({ cursoId: null, codeCourse: '', jornada: '', cupos: '' })

  const abrirEditarComp = (c) => setModalComp({
    cursoId: c.cursoId,
    codeCourse: c.codeCourse,
    jornada: c.jornada,
    cupos: c.cupos != null ? String(c.cupos) : ''
  })

  const guardarComp = async (e) => {
    e.preventDefault()
    if (!modalComp || guardandoComp) return
    const { cursoId, codeCourse, jornada, cupos } = modalComp
    if (!codeCourse) {
      onShowToast?.('Escoja la electiva complementaria', 'error')
      return
    }
    if (!cursoId && !jornada) {
      onShowToast?.('Debe indicar la jornada (diurna o nocturna)', 'error')
      return
    }
    if (!/^\d+$/.test(String(cupos).trim()) || Number(cupos) <= 0) {
      onShowToast?.('Debe ingresar un número de cupos válido', 'error')
      return
    }
    setGuardandoComp(true)
    try {
      if (cursoId) {
        await modificarElectiva(cursoId, { codeCourse, cupos })
        onShowToast?.('Electiva complementaria actualizada', 'success')
      } else {
        const r = await programarElectiva({
          codeProgram: codigoProgramaComp,
          codeEspacio: 'COMPLEMENTARIA',
          codeCourse,
          cupos,
          jornada
        })
        onShowToast?.('Electiva complementaria programada', 'success')
        if (r?.alerta) onShowToast?.(r.alerta, 'info')
      }
      setModalComp(null)
      await cargarComplementarias()
    } catch (err) {
      onShowToast?.(err.message || 'No se pudo guardar la electiva complementaria', 'error')
    } finally {
      setGuardandoComp(false)
    }
  }

  const quitarComp = async (c) => {
    if (!window.confirm(`¿Desea quitar ${c.nombreAsignatura} de las electivas complementarias del período?`)) return
    try {
      await quitarElectiva(c.cursoId)
      onShowToast?.('Electiva complementaria quitada', 'info')
      await cargarComplementarias()
    } catch (err) {
      onShowToast?.(err.message || 'No se pudo quitar la electiva complementaria', 'error')
    }
  }

  // Misma forma que una materia del semestre, para reutilizar la designación de docente
  const comoMateria = (c) => ({
    id: c.cursoId,
    codeProgram: c.codeProgram,
    codeCourse: c.codeCourse,
    nameCourse: c.nombreAsignatura,
    horasSemanales: c.horasSemanales,
    grupo: c.grupo ?? null,
    jornada: normalizarJornada(c.jornada),
    idDocente: c.idDocente,
    nombreDocente: c.nombreDocente,
    dia: c.dia ?? null,
    horaInicio: c.horaInicio ?? null,
    horaFin: c.horaFin ?? null,
    dia2: c.dia2 ?? null,
    horaInicio2: c.horaInicio2 ?? null,
    horaFin2: c.horaFin2 ?? null,
    horario: c.horario ?? null,
    esComplementaria: true
  })

  // Al editar, la propia asignatura sigue en la lista aunque ya no esté en el banco
  const opcionesBancoComp = useMemo(() => {
    if (!modalComp?.cursoId) return comp.banco
    const actual = comp.lista.find(c => c.cursoId === modalComp.cursoId)
    if (!actual || comp.banco.some(b => b.codeCourse === actual.codeCourse)) return comp.banco
    return [{ codeCourse: actual.codeCourse, nombre: actual.nombreAsignatura }, ...comp.banco]
  }, [modalComp, comp])

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
  const sinPeriodoVigente = !periodosCargando && !errorCarga && !periodoActivo
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

      {/* Sin período vigente */}
      {!coordinadorSinPrograma && sinPeriodoVigente && (
        <div
          className="asig-doc-estado-vacio"
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '3rem 1.5rem',
            gap: '0.75rem'
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
          <h3 style={{ margin: 0 }}>No hay un período académico vigente</h3>
          <p style={{ margin: 0, maxWidth: '460px', color: '#64748b' }}>
            {isAdmin
              ? 'Por favor crea un período académico (o activa uno existente) para asignar docentes a los cursos.'
              : 'Actualmente no hay un período académico vigente. Comunícate con el administrador para activar uno.'}
          </p>
          {isAdmin && onNavigateToPeriodos && (
            <button
              type="button"
              className="btn-primary"
              style={{ marginTop: '0.4rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              onClick={onNavigateToPeriodos}
            >
              <CalendarDays size={16} />
              <span>Ir a Períodos Académicos</span>
            </button>
          )}
        </div>
      )}

      {!coordinadorSinPrograma && !sinPeriodoVigente && (<>
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

        {/* Alerta de electivas obligatorias pendientes de escoger en el período vigente */}
        {!sinProgramaEnJornada && Array.isArray(comp.pendientesObligatorias) && comp.pendientesObligatorias.length > 0 && (
          <div
            role="alert"
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.75rem',
              padding: '0.9rem 1.1rem',
              marginBottom: '1rem',
              borderRadius: '10px',
              background: '#fffbeb',
              border: '1px solid #f59e0b',
              color: '#92400e',
              fontSize: '0.88rem'
            }}
          >
            <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px', color: '#d97706' }} />
            <div>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>
                Electivas obligatorias pendientes de selección para este período ({comp.pendientesObligatorias.length})
              </div>
              <div style={{ marginBottom: '0.45rem' }}>
                Para asignar docente a estas electivas, primero debe escoger la asignatura correspondiente desde <strong>Malla Curricular</strong>. Al iniciar un nuevo período académico, estos espacios se limpian automáticamente.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {comp.pendientesObligatorias.map((p) => (
                  <span
                    key={`${p.codeEspacio}-${p.semestre}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      padding: '0.2rem 0.55rem',
                      borderRadius: '999px',
                      background: '#fef3c7',
                      border: '1px solid #fcd34d',
                      fontWeight: 600,
                      fontSize: '0.8rem',
                      color: '#78350f'
                    }}
                  >
                    {p.nombreEspacio} · Semestre {p.semestre}
                  </span>
                ))}
              </div>
            </div>
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

                      {mat.nombreEspacio && (
                        <div className="asig-doc-espacio-badge">{mat.nombreEspacio}</div>
                      )}

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

                            {/* Horario asignado a la clase */}
                            {mat.horario ? (
                              <div className="asig-doc-horario-asignado">
                                <Clock size={13} style={{ flexShrink: 0, color: '#16a34a' }} />
                                <div>
                                  <strong>Horario de clase:</strong>{' '}
                                  <span>{mat.horario}</span>
                                </div>
                              </div>
                            ) : (
                              /* Horario de disponibilidad del docente */
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
                            )}
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
                              <span>Editar docente</span>
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

        {/* 7. Electivas complementarias del período: las propone cada coordinador y no ocupan un espacio de la malla */}
        {programaBase && (
          <div className="asig-doc-comp-section">
            <div className="asig-doc-materias-header">
              <div className="asig-doc-materias-title">
                <Layers size={18} style={{ color: '#7e22ce' }} />
                <span>Electivas complementarias del período</span>
              </div>
              {comp.puedeEditar && (
                <button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={abrirProponerComp}
                  disabled={!comp.banco.some(b => !b.programadaPor)}
                  title={!comp.banco.some(b => !b.programadaPor) ? 'No hay electivas complementarias disponibles para proponer' : undefined}
                >
                  <Plus size={14} />
                  <span>Proponer complementaria</span>
                </button>
              )}
            </div>
            <p className="asig-doc-comp-ayuda">
              Aquí se proponen las electivas complementarias generales del período: no pertenecen a la malla de ningún
              programa ni ocupan un espacio de ella. Se programan una sola vez en el período y salen en la programación
              académica al final del consolidado. El coordinador que la propone asigna su docente.
            </p>

            {!comp.puedeEditar && !comp.cargando && !comp.error && (
              <div className="asig-doc-aviso-consulta" role="status">
                <AlertCircle size={16} />
                <span>Fuera del período habilitado: solo consulta</span>
              </div>
            )}

            {comp.cargando ? (
              <div className="asig-doc-comp-estado">
                <RefreshCw size={18} className="spin" style={{ color: '#7e22ce' }} />
                <span>Cargando electivas complementarias...</span>
              </div>
            ) : comp.error ? (
              <div className="asig-doc-comp-estado" role="alert">
                <AlertCircle size={18} />
                <span>No se pudieron cargar las electivas complementarias</span>
                <button type="button" className="btn-secondary btn-sm" onClick={cargarComplementarias}>
                  <RefreshCw size={14} />
                  <span>Reintentar</span>
                </button>
              </div>
            ) : comp.lista.length === 0 ? (
              <div className="asig-doc-comp-estado">
                <BookOpen size={18} />
                <span>Aún no hay electivas complementarias propuestas en este período.</span>
              </div>
            ) : (
              <div className="asig-doc-materias-grid">
                {comp.lista.map(c => {
                  const tieneDocente = Boolean(c.idDocente)
                  const horariosDoc = tieneDocente ? formatearHorariosDocente(c.idDocente) : null
                  const materia = comoMateria(c)
                  return (
                    <div
                      key={`comp-${c.cursoId}`}
                      className={`asig-doc-materia-card ${tieneDocente ? 'asignado' : 'sin-asignar'}`}
                    >
                      <div>
                        <div className="asig-doc-card-top">
                          <span className="asig-doc-course-code">{c.codeCourse}</span>
                          <span className="asig-doc-group-badge">{textoGrupo(materia)}</span>
                        </div>
                        <div className="asig-doc-espacio-badge">Electiva complementaria</div>
                        <h4 className="asig-doc-materia-name">{c.nombreAsignatura}</h4>
                        <div className="asig-doc-materia-meta">
                          <span>Jornada {ETIQUETA_JORNADA[materia.jornada] || materia.jornada}</span>
                          <span>•</span>
                          <span>{c.cupos} cupos</span>
                          {c.horasSemanales != null && (
                            <>
                              <span>•</span>
                              <span>{c.horasSemanales} h/semana</span>
                            </>
                          )}
                        </div>

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
                                {c.nombreDocente}
                              </div>
                              {c.horario && (
                                <div style={{
                                  fontSize: '0.78rem',
                                  fontWeight: 650,
                                  color: '#065f46',
                                  background: '#ecfdf5',
                                  border: '1px solid #a7f3d0',
                                  borderRadius: '6px',
                                  padding: '0.25rem 0.55rem',
                                  marginBottom: '0.4rem',
                                  display: 'inline-block'
                                }}>
                                  Horario de clase: {c.horario}
                                </div>
                              )}
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
                          {c.sinDocentesAsociados && !tieneDocente && (
                            <div className="asig-doc-comp-alerta" role="status">
                              <AlertCircle size={14} />
                              <span>{c.alerta}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="asig-doc-card-actions">
                        {puedeAsignar && (
                          <button
                            type="button"
                            className={`${tieneDocente ? 'btn-secondary' : 'btn-primary'} btn-sm`}
                            onClick={() => handleAbrirDesignacion(materia)}
                            style={{ flex: 1, justifyContent: 'center' }}
                          >
                            <UserPlus size={14} />
                            <span>{tieneDocente ? 'Editar docente' : 'Asignar docente'}</span>
                          </button>
                        )}
                        {puedeAsignar && tieneDocente && (
                          <button
                            type="button"
                            className="btn-danger btn-sm"
                            onClick={() => handleDesasignarDocente(materia)}
                            title="Desasignar docente"
                            style={{ padding: '0.45rem 0.65rem' }}
                          >
                            <UserX size={14} />
                          </button>
                        )}
                        {comp.puedeEditar && !tieneDocente && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={() => abrirEditarComp(c)}
                              title="Cambiar la electiva o los cupos"
                              style={{ padding: '0.45rem 0.65rem' }}
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              type="button"
                              className="btn-danger btn-sm"
                              onClick={() => quitarComp(c)}
                              title="Quitar de las complementarias del período"
                              style={{ padding: '0.45rem 0.65rem' }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </>)}

      {/* Modal: proponer o modificar una electiva complementaria */}
      {modalComp && (
        <div className="asig-modal-backdrop" onClick={() => !guardandoComp && setModalComp(null)}>
          <div className="asig-modal-card asig-doc-comp-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={guardarComp}>
              <div className="asig-modal-header">
                <div>
                  <h3 className="asig-modal-title">
                    {modalComp.cursoId ? 'Modificar electiva complementaria' : 'Proponer electiva complementaria'}
                  </h3>
                  <div className="asig-modal-target">Programa {codigoProgramaComp}</div>
                </div>
                <button
                  type="button"
                  className="btn-icon"
                  onClick={() => setModalComp(null)}
                  title="Cerrar ventana"
                  disabled={guardandoComp}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="asig-doc-comp-form">
                <label className="asig-doc-comp-campo">
                  <span>Electiva complementaria</span>
                  <select
                    value={modalComp.codeCourse}
                    onChange={(e) => setModalComp({ ...modalComp, codeCourse: e.target.value })}
                    required
                  >
                    <option value="">Seleccione una electiva...</option>
                    {opcionesBancoComp.map(a => {
                      // Ya programada por otro programa: se ve, pero no se puede elegir
                      const ocupada = Boolean(a.programadaPor) && a.codeCourse !== modalComp.codeCourse
                      return (
                        <option key={a.codeCourse} value={a.codeCourse} disabled={ocupada}>
                          {a.codeCourse} - {a.nombre}{ocupada ? ` (ya propuesta por ${a.programadaPor})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </label>

                <div className="asig-doc-comp-campo">
                  <span>Jornada</span>
                  <div className="asig-doc-segmentado" role="group" aria-label="Jornada de la electiva">
                    {['DIURNA', 'NOCTURNA'].map(j => (
                      <button
                        key={j}
                        type="button"
                        className={`asig-doc-segmento ${modalComp.jornada === j ? 'active' : ''}`}
                        aria-pressed={modalComp.jornada === j}
                        disabled={Boolean(modalComp.cursoId)}
                        onClick={() => setModalComp({ ...modalComp, jornada: j })}
                      >
                        {ETIQUETA_JORNADA[j]}
                      </button>
                    ))}
                  </div>
                  <small>No se programa en la jornada del programa: la elige quien la propone.</small>
                </div>

                <label className="asig-doc-comp-campo">
                  <span>Cupos</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={modalComp.cupos}
                    onChange={(e) => {
                      if (e.target.value === '' || /^\d*$/.test(e.target.value)) {
                        setModalComp({ ...modalComp, cupos: e.target.value })
                      }
                    }}
                    required
                  />
                </label>
              </div>

              <div className="asig-doc-comp-pie">
                <button type="button" className="btn-secondary btn-sm" onClick={() => setModalComp(null)} disabled={guardandoComp}>
                  Cancelar
                </button>
                <button type="submit" className="btn-primary btn-sm" disabled={guardandoComp}>
                  {guardandoComp ? <RefreshCw size={14} className="spin" /> : null}
                  <span>{modalComp.cursoId ? 'Guardar cambios' : 'Proponer'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Modal de Designación de Docentes con Horarios */}
      {materiaParaDesignar && (
        <div className="asig-modal-backdrop" onClick={() => setMateriaParaDesignar(null)}>
          <div className="asig-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="asig-modal-header">
              <div>
                <h3 className="asig-modal-title">{materiaParaDesignar.idDocente ? 'Editar docente asignado' : 'Designar docente a la materia'}</h3>
                <div className="asig-modal-target">
                  <strong>{materiaParaDesignar.codeCourse} - {materiaParaDesignar.nameCourse}</strong> ({textoGrupo(materiaParaDesignar)} · Jornada {ETIQUETA_JORNADA[materiaParaDesignar.jornada] || materiaParaDesignar.jornada} · {materiaParaDesignar.esComplementaria ? 'Electiva complementaria' : `Semestre ${selectedSemestre}`})
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
                <span style={{ fontSize: '0.8rem', color: '#475569' }}>
                  Se muestran únicamente los tramos libres de cada docente (descontando sus cursos ya asignados) que cubran las horas semanales de la materia dentro del límite de 20 h.
                </span>
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {docentesFiltrados.filter(d => capacidadDocente(d.id).valido).length} docentes elegibles
                </span>
              </div>

              {/* Aviso cuando no hay calificaciones previas registradas (> 0) */}
              {!Object.values(evaluacionesMap).some(ev => ev?.calificacion != null && Number(ev.calificacion) > 0) && (
                <div className="asig-modal-notice-info">
                  <Info size={16} style={{ flexShrink: 0 }} />
                  <span>
                    Esta asignatura no registra historial de calificaciones docentes previas. Mostrando todos los profesores de la facultad {facultadModal?.nombre ? `(${facultadModal.nombre})` : ''} para su elección.
                  </span>
                </div>
              )}

              {/* Opciones de distribución del horario: 1 día o 2 días */}
              {Number(materiaParaDesignar?.horasSemanales || 0) >= 2 && (
                <div className="asig-distribucion-box">
                  <div className="asig-distribucion-label">
                    <CalendarDays size={16} style={{ color: '#2563eb' }} />
                    <span>Distribución de las {materiaParaDesignar.horasSemanales}h presenciales:</span>
                  </div>
                  <div className="asig-distribucion-buttons">
                    <button
                      type="button"
                      className={`btn-sm ${modoDistribucion === '1_DIA' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', fontWeight: 650 }}
                      onClick={() => {
                        setModoDistribucion('1_DIA')
                        setFranjasSeleccionadas({})
                        setFranjasSeleccionadasDia2({})
                      }}
                    >
                      1 solo día ({materiaParaDesignar.horasSemanales}h seguidas)
                    </button>
                    <button
                      type="button"
                      className={`btn-sm ${modoDistribucion === '2_DIAS' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ fontSize: '0.78rem', padding: '0.35rem 0.75rem', fontWeight: 650 }}
                      onClick={() => {
                        setModoDistribucion('2_DIAS')
                        setFranjasSeleccionadas({})
                        setFranjasSeleccionadasDia2({})
                      }}
                    >
                      Dividir en 2 días ({(Number(materiaParaDesignar.horasSemanales) / 2.0).toFixed(1).replace('.0', '')}h cada día)
                    </button>
                  </div>
                </div>
              )}

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
                    const esElActual = materiaParaDesignar.idDocente != null && Number(materiaParaDesignar.idDocente) === Number(docente.id)
                    const correoUsuario = String(user?.email || '').trim().toLowerCase()
                    const correoDocente = String(docente.correoInstitucional || '').trim().toLowerCase()
                    const esElCoordinador = isCoordinador && correoUsuario !== '' && correoDocente === correoUsuario
                    const horarios = formatearHorariosDocente(docente.id)
                    const estaAsignando = asignandoId === docente.id
                    const evaluacion = evaluacionesMap[String(docente.id)]
                    const capacidad = capacidadDocente(docente.id)
                    const franjasAptas = calcularFranjasDisponibles(docente.id)
                    const franjaElegida = franjasSeleccionadas[docente.id] || franjasAptas[0] || null

                    // Para modo 2 días: filtrar franjas disponibles en días distintos a la sesión 1
                    const franjasAptasDia2 = modoDistribucion === '2_DIAS'
                      ? franjasAptas.filter(f => !franjaElegida || Number(f.dia) !== Number(franjaElegida.dia))
                      : []
                    const franjaElegidaDia2 = modoDistribucion === '2_DIAS'
                      ? (franjasSeleccionadasDia2[docente.id] || franjasAptasDia2[0] || null)
                      : null

                    const tieneFranjaValida = modoDistribucion === '2_DIAS'
                      ? Boolean(franjaElegida && franjaElegidaDia2 && Number(franjaElegida.dia) !== Number(franjaElegidaDia2.dia))
                      : Boolean(franjaElegida)

                    const mismoHorarioActual = esElActual && (
                      modoDistribucion === '2_DIAS'
                        ? (Number(materiaParaDesignar.dia) === Number(franjaElegida?.dia)
                            && String(materiaParaDesignar.horaInicio || '').slice(0, 5) === String(franjaElegida?.horaInicio || '').slice(0, 5)
                            && String(materiaParaDesignar.horaFin || '').slice(0, 5) === String(franjaElegida?.horaFinClase || '').slice(0, 5)
                            && Number(materiaParaDesignar.dia2) === Number(franjaElegidaDia2?.dia)
                            && String(materiaParaDesignar.horaInicio2 || '').slice(0, 5) === String(franjaElegidaDia2?.horaInicio || '').slice(0, 5)
                            && String(materiaParaDesignar.horaFin2 || '').slice(0, 5) === String(franjaElegidaDia2?.horaFinClase || '').slice(0, 5))
                        : (materiaParaDesignar.dia2 == null
                            && Number(materiaParaDesignar.dia) === Number(franjaElegida?.dia)
                            && String(materiaParaDesignar.horaInicio || '').slice(0, 5) === String(franjaElegida?.horaInicio || '').slice(0, 5)
                            && String(materiaParaDesignar.horaFin || '').slice(0, 5) === String(franjaElegida?.horaFinClase || '').slice(0, 5))
                    )

                    const horasRequeridas = Number(materiaParaDesignar?.horasSemanales || 0)
                    const horasRequeridasSesion = modoDistribucion === '2_DIAS'
                      ? (horasRequeridas / 2.0).toFixed(1).replace('.0', '')
                      : horasRequeridas

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
                            {esElCoordinador && (
                              <span className="badge badge-neutral" style={{ marginLeft: '0.5rem', fontSize: '0.72rem' }}>
                                Tu perfil docente
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

                          <div style={{
                            fontSize: '0.78rem', marginTop: '0.5rem', fontWeight: 600,
                            color: capacidad.valido ? '#166534' : '#b45309'
                          }}>
                            {capacidad.registradas.toFixed(1)} h registradas · {capacidad.asignadas} h asignadas ·
                            {' '}{capacidad.restantes.toFixed(1)} h restantes
                            {' · '}{Number.isFinite(capacidad.requeridas) ? capacidad.requeridas : '?'} h requeridas
                            {!cargaDisponible && ' · No se pudo consultar la carga docente'}
                            {cargaDisponible && !capacidad.valido && ' · Horas insuficientes o datos incompletos'}
                          </div>
                          {/* Horario de disponibilidad desplegado */}
                          <div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', marginBottom: '0.45rem' }}>
                              Última evaluación registrada ({evaluacion?.periodo_nombre || evaluacion?.periodoNombre || 'período anterior'}):{' '}
                              {(() => {
                                const nota = evaluacion?.calificacion != null ? Number(evaluacion.calificacion) : 0
                                const evaluado = Number.isFinite(nota) && nota > 0
                                return (
                                  <strong style={{ color: evaluado ? '#0f766e' : '#64748b' }}>
                                    {evaluado ? `${nota.toFixed(2)} / 5.00` : 'No evaluado'}
                                  </strong>
                                )
                              })()}
                            </div>
                            <div style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Clock size={12} style={{ color: '#2563eb' }} />
                              <span>Horario general de disponibilidad en el período:</span>
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

                            {/* Selector de franja horaria para la clase */}
                            <div className="asig-franjas-selector">
                              <div className="asig-franjas-title">
                                <Clock size={12} style={{ color: '#2563eb' }} />
                                <span>
                                  {modoDistribucion === '2_DIAS'
                                    ? `Elegir 2 días de clase (${horasRequeridasSesion}h por sesión):`
                                    : `Elegir franja de clase (${horasRequeridas}h presenciales requeridas):`}
                                </span>
                              </div>

                              {modoDistribucion === '1_DIA' ? (
                                franjasAptas.length > 0 ? (
                                  <div className="asig-franjas-list">
                                    {franjasAptas.map(franja => {
                                      const isSelected = franjaElegida?.id === franja.id
                                      return (
                                        <label
                                          key={franja.id}
                                          className={`asig-franja-chip ${isSelected ? 'selected' : ''}`}
                                          onClick={() => setFranjasSeleccionadas(prev => ({ ...prev, [docente.id]: franja }))}
                                        >
                                          <div className="asig-franja-radio">
                                            <input
                                              type="radio"
                                              name={`franja-${docente.id}`}
                                              checked={isSelected}
                                              onChange={() => setFranjasSeleccionadas(prev => ({ ...prev, [docente.id]: franja }))}
                                            />
                                            <span>{franja.textoFranja}</span>
                                          </div>
                                          <span className="asig-franja-badge-clase">Clase: {franja.textoHorarioAsignar}</span>
                                        </label>
                                      )
                                    })}
                                  </div>
                                ) : (
                                  <div className="asig-franja-warning-tag">
                                    <AlertCircle size={13} />
                                    <span>Sin franjas con al menos {horasRequeridas}h disponibles (o límite de 20h alcanzado)</span>
                                  </div>
                                )
                              ) : (
                                /* Selector de 2 días */
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                  {/* Sesión Día 1 */}
                                  <div>
                                    <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                                      1. Sesión Día 1 ({horasRequeridasSesion}h):
                                    </div>
                                    {franjasAptas.length > 0 ? (
                                      <div className="asig-franjas-list">
                                        {franjasAptas.map(franja => {
                                          const isSelected = franjaElegida?.id === franja.id
                                          return (
                                            <label
                                              key={`s1-${franja.id}`}
                                              className={`asig-franja-chip ${isSelected ? 'selected' : ''}`}
                                              onClick={() => {
                                                setFranjasSeleccionadas(prev => ({ ...prev, [docente.id]: franja }))
                                                if (franjaElegidaDia2 && Number(franjaElegidaDia2.dia) === Number(franja.dia)) {
                                                  setFranjasSeleccionadasDia2(prev => {
                                                    const copia = { ...prev }
                                                    delete copia[docente.id]
                                                    return copia
                                                  })
                                                }
                                              }}
                                            >
                                              <div className="asig-franja-radio">
                                                <input
                                                  type="radio"
                                                  name={`franja-s1-${docente.id}`}
                                                  checked={isSelected}
                                                  onChange={() => {
                                                    setFranjasSeleccionadas(prev => ({ ...prev, [docente.id]: franja }))
                                                    if (franjaElegidaDia2 && Number(franjaElegidaDia2.dia) === Number(franja.dia)) {
                                                      setFranjasSeleccionadasDia2(prev => {
                                                        const copia = { ...prev }
                                                        delete copia[docente.id]
                                                        return copia
                                                      })
                                                    }
                                                  }}
                                                />
                                                <span>{franja.textoFranja}</span>
                                              </div>
                                              <span className="asig-franja-badge-clase">Clase 1: {franja.textoHorarioAsignar}</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <div className="asig-franja-warning-tag">
                                        <AlertCircle size={13} />
                                        <span>Sin franjas con al menos {horasRequeridasSesion}h disponibles</span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Sesión Día 2 */}
                                  <div>
                                    <div style={{ fontSize: '0.73rem', fontWeight: 700, color: '#334155', marginBottom: '0.25rem' }}>
                                      2. Sesión Día 2 ({horasRequeridasSesion}h) — en día diferente al Día 1:
                                    </div>
                                    {franjasAptasDia2.length > 0 ? (
                                      <div className="asig-franjas-list">
                                        {franjasAptasDia2.map(franja => {
                                          const isSelected = franjaElegidaDia2?.id === franja.id
                                          return (
                                            <label
                                              key={`s2-${franja.id}`}
                                              className={`asig-franja-chip ${isSelected ? 'selected' : ''}`}
                                              onClick={() => setFranjasSeleccionadasDia2(prev => ({ ...prev, [docente.id]: franja }))}
                                            >
                                              <div className="asig-franja-radio">
                                                <input
                                                  type="radio"
                                                  name={`franja-s2-${docente.id}`}
                                                  checked={isSelected}
                                                  onChange={() => setFranjasSeleccionadasDia2(prev => ({ ...prev, [docente.id]: franja }))}
                                                />
                                                <span>{franja.textoFranja}</span>
                                              </div>
                                              <span className="asig-franja-badge-clase">Clase 2: {franja.textoHorarioAsignar}</span>
                                            </label>
                                          )
                                        })}
                                      </div>
                                    ) : (
                                      <div className="asig-franja-warning-tag">
                                        <AlertCircle size={13} />
                                        <span>
                                          {!franjaElegida
                                            ? 'Primero selecciona la sesión del Día 1'
                                            : `Sin franjas disponibles de al menos ${horasRequeridasSesion}h en un día diferente a ${franjaElegida.diaNombre}`}
                                        </span>
                                      </div>
                                    )}
                                  </div>

                                  {/* Resumen unificado */}
                                  {franjaElegida && franjaElegidaDia2 && (
                                    <div style={{
                                      padding: '0.45rem 0.65rem', background: '#ecfdf5',
                                      border: '1px solid #a7f3d0', borderRadius: '6px',
                                      fontSize: '0.78rem', color: '#065f46', fontWeight: 650
                                    }}>
                                      Horario semanal completo: {franjaElegida.textoHorarioAsignar} / {franjaElegidaDia2.textoHorarioAsignar}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        <div>
                          <button
                            type="button"
                            className={mismoHorarioActual ? 'btn-secondary btn-sm' : 'btn-primary btn-sm'}
                            onClick={() => handleConfirmarDesignacion(docente, franjaElegida, franjaElegidaDia2)}
                            disabled={estaAsignando || mismoHorarioActual || !capacidad.valido || !tieneFranjaValida}
                            title={
                              !capacidad.valido
                                ? 'El docente no tiene horas suficientes'
                                : (!tieneFranjaValida
                                  ? (modoDistribucion === '2_DIAS'
                                    ? `El docente debe tener dos franjas libres de al menos ${horasRequeridasSesion}h en días diferentes`
                                    : `El docente no tiene una franja libre con al menos ${horasRequeridas}h`)
                                  : (esElActual ? 'Actualizar el horario del docente asignado' : 'Designar docente a este curso'))
                            }
                            style={{ minWidth: '100px', whiteSpace: 'nowrap' }}
                          >
                            {estaAsignando
                              ? 'Guardando...'
                              : esElActual
                                ? (mismoHorarioActual ? 'Asignado' : 'Actualizar horario')
                                : esElCoordinador
                                  ? 'Asignarme'
                                  : 'Designar'}
                          </button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>

            <div className="asig-modal-footer">
              {materiaParaDesignar.idDocente && (
                <button
                  type="button"
                  className="btn-danger btn-sm"
                  onClick={() => handleDesasignarDocente(materiaParaDesignar)}
                  disabled={Boolean(asignandoId)}
                >
                  Sin docente asignado
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setMateriaParaDesignar(null)}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}