import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Plus,
  BookOpen,
  ChevronRight,
  ChevronLeft,
  Trash2,
  Printer,
  Sparkles,
  ArrowRightLeft,
  X,
  HelpCircle,
  Search,
  Building2,
  Layers,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Award,
  Save,
  History,
  Archive,
  RotateCcw,
  AlertTriangle,
  Edit3,
  FilePlus2,
  Eye,
  FileText
} from 'lucide-react'
import {
  createAsignatura,
  getFacultades,
  savePensumVersion,
  updatePensumVersion,
  getPensumHistory,
  getPensumVersion,
  deactivatePensum,
  reactivatePensum
} from '../services/academicService'

function inferTipoAsignatura(item) {
  if (item?.tipo_asignatura) return item.tipo_asignatura
  if (item?.es_complementaria) return 'Electiva complementaria'
  if (item?.is_elective) return 'Act. extracurricular'
  if (item?.es_basica) return 'Asignatura básica'
  return 'Profesional'
}

export default function PensumView({
  programas,
  asignaturas,
  selectedProgramCode,
  setSelectedProgramCode,
  pensumList,
  onRefresh,
  onShowToast,
  onNavigateToAsignaturas,
  onNavigateToProgramas,
  canEdit = true
}) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [selectedSemesterForAdd, setSelectedSemesterForAdd] = useState(1)
  const [selectedCourseForAdd, setSelectedCourseForAdd] = useState('')
  const [courseSearchModal, setCourseSearchModal] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [movingCourse, setMovingCourse] = useState(null)
  const [targetSemester, setTargetSemester] = useState(1)
  const [draftPensum, setDraftPensum] = useState([])
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyItems, setHistoryItems] = useState([])
  const [selectedHistoryVersion, setSelectedHistoryVersion] = useState(null)
  const [historyDetail, setHistoryDetail] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)

  // Vista en modo consulta de una malla inactiva desde el historial (HU-032 Criterio 1)
  const [viewingInactiveVersion, setViewingInactiveVersion] = useState(null)
  const [inactiveVersionCourses, setInactiveVersionCourses] = useState([])

  // =========================================================================
  // ESTADO DE METADATOS DE RESOLUCIÓN / EDICIÓN DE MALLA (HU-017 & HU-032)
  // Semestres y asignaturas se gestionan directamente en las columnas.
  // =========================================================================
  // editorMode: null | 'edit' (HU-032 Editar malla activa) | 'create' (HU-017 Registrar resolución)
  const [editorMode, setEditorMode] = useState(null)
  const [isResolutionFormOpen, setIsResolutionFormOpen] = useState(false)
  const [resolutionForm, setResolutionForm] = useState({
    numero_resolucion: '',
    numero_semestre: '10',
    name_program: '',
    descripcion: '',
    jornada: 'DIURNA',
    periodo_oferta: 'SEMESTRAL'
  })
  const [initialEditSnapshot, setInitialEditSnapshot] = useState(null)
  const [formErrors, setFormErrors] = useState({})
  const [bannerMessage, setBannerMessage] = useState(null)
  const [confirmDialog, setConfirmDialog] = useState(null)

  // Elective form mode & state in modal
  const [addMode, setAddMode] = useState('catalog')
  const [electiveCode, setElectiveCode] = useState('')
  const [electiveName, setElectiveName] = useState('')
  const [electiveCredits, setElectiveCredits] = useState('')

  // Estado para la barra de electivas disponibles
  const [facultadesList, setFacultadesList] = useState([])
  const [programFacultyId, setProgramFacultyId] = useState('')
  const [electivesSearch, setElectivesSearch] = useState('')
  const [isElectivesDockExpanded, setIsElectivesDockExpanded] = useState(true)
  const [electivesTabFilter, setElectivesTabFilter] = useState('all')

  // Program search combobox
  const [programSearch, setProgramSearch] = useState('')
  const [programDropdownOpen, setProgramDropdownOpen] = useState(false)
  const programInputRef = useRef(null)
  const comboboxRef = useRef(null)

  // Current active program
  const currentProgram = useMemo(() => {
    return programas.find(p => p.code_program === selectedProgramCode) || programas[0] || null
  }, [programas, selectedProgramCode])

  // Filtered programs for search dropdown
  const filteredProgramas = useMemo(() => {
    const q = programSearch.trim().toLowerCase()
    if (!q) return programas
    return programas.filter(p =>
      p.name_program?.toLowerCase().includes(q) ||
      p.code_program?.toLowerCase().includes(q)
    )
  }, [programas, programSearch])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target)) {
        setProgramDropdownOpen(false)
        setProgramSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelectProgram = (code) => {
    setSelectedProgramCode(code)
    setProgramDropdownOpen(false)
    setProgramSearch('')
    setViewingInactiveVersion(null)
    setInactiveVersionCourses([])
    setEditorMode(null)
    setIsResolutionFormOpen(false)
  }

  // Current program's active pensum entries
  const savedPensum = useMemo(() => {
    if (!currentProgram) return []
    return pensumList.filter(item => item.code_program === currentProgram.code_program && item.vigente !== false)
  }, [pensumList, currentProgram])

  // Malla activa vs inactiva (HU-032 Criterio 1)
  const isViewingInactive = viewingInactiveVersion !== null
  const isActiveMalla = !isViewingInactive && savedPensum.length > 0
  const effectiveCanEdit = canEdit && !isViewingInactive && (isActiveMalla || editorMode === 'create')

  const currentPensum = isViewingInactive
    ? inactiveVersionCourses
    : (hasUnsavedChanges ? draftPensum : savedPensum)

  // Datos actuales de la resolución activa o en consulta
  const activeMetaItem = currentPensum[0] || savedPensum[0] || null
  const activeNumeroResolucion = (editorMode && resolutionForm.numero_resolucion)
    ? resolutionForm.numero_resolucion
    : (activeMetaItem?.numero_resolucion || currentProgram?.numero_resolucion || '')
  const isMallaEditada = Boolean(activeMetaItem?.editada)
  const fechaUltimaEdicion = activeMetaItem?.fecha_edicion || null

  useEffect(() => {
    setDraftPensum(savedPensum)
    setHasUnsavedChanges(false)
    setViewingInactiveVersion(null)
    setInactiveVersionCourses([])
    setEditorMode(null)
    setIsResolutionFormOpen(false)
    setBannerMessage(null)
  }, [selectedProgramCode, pensumList])

  // Total credits in program
  const totalProgramCredits = useMemo(() => {
    return currentPensum.reduce((acc, curr) => acc + (curr.credits || 0), 0)
  }, [currentPensum])

  // Total semesters defined for this program or resolution form
  const totalSemesters = useMemo(() => {
    const formSem = editorMode ? parseInt(resolutionForm.numero_semestre, 10) : NaN
    const metaSem = parseInt(activeMetaItem?.numero_semestres, 10)
    const progSem = parseInt(currentProgram?.numero_semestre, 10) || 10
    const definedSemesters = !isNaN(formSem) && formSem >= 1
      ? formSem
      : (!isNaN(metaSem) && metaSem >= 1 ? metaSem : progSem)
    if (currentPensum.length === 0) return definedSemesters
    const highestInPensum = Math.max(...currentPensum.map(p => p.semestre || 1))
    return Math.max(definedSemesters, highestInPensum)
  }, [currentProgram, currentPensum, editorMode, resolutionForm.numero_semestre, activeMetaItem])

  // Group courses by semester up to totalSemesters (las columnas de la malla)
  const semesterMap = useMemo(() => {
    const map = {}
    for (let s = 1; s <= totalSemesters; s++) {
      map[s] = []
    }
    currentPensum.forEach(item => {
      if (!map[item.semestre]) {
        map[item.semestre] = []
      }
      map[item.semestre].push(item)
    })
    return map
  }, [currentPensum, totalSemesters])

  // Set of courses already in this pensum
  const assignedCourseCodes = useMemo(() => {
    return new Set(currentPensum.map(item => item.code_course))
  }, [currentPensum])

  // Courses available to be added
  const availableCourses = useMemo(() => {
    return asignaturas.filter(a => !assignedCourseCodes.has(a.code_course))
  }, [asignaturas, assignedCourseCodes])

  const filteredAvailableCourses = useMemo(() => {
    return availableCourses.filter(a =>
      a.code_course.toLowerCase().includes(courseSearchModal.toLowerCase()) ||
      a.name_course.toLowerCase().includes(courseSearchModal.toLowerCase())
    )
  }, [availableCourses, courseSearchModal])

  // Cargar facultades desde la BD
  useEffect(() => {
    getFacultades()
      .then(data => {
        if (data && data.length > 0) setFacultadesList(data)
      })
      .catch(err => console.warn('Error al cargar facultades:', err))
  }, [])

  // Sincronizar y detectar facultad de la carrera
  useEffect(() => {
    if (!currentProgram) {
      setProgramFacultyId(null)
      return
    }
    if (currentProgram.id_facultad_programa || currentProgram.id_facultad) {
      setProgramFacultyId(String(currentProgram.id_facultad_programa || currentProgram.id_facultad))
      return
    }
    const pName = (currentProgram.name_program || '').toLowerCase()
    if (pName.includes('software') || pName.includes('sistemas') || pName.includes('electromec') || pName.includes('ingenier')) {
      const ingFac = facultadesList.find(f => f.id === 1 || (f.nombre || '').toLowerCase().includes('ingenier'))
      setProgramFacultyId(ingFac ? String(ingFac.id) : '1')
      return
    }
    const matchingFac = facultadesList.find(f =>
      f.id !== 2 && f.id !== 3 && pName.includes((f.nombre || '').toLowerCase())
    )
    if (matchingFac) {
      setProgramFacultyId(String(matchingFac.id))
      return
    }
    setProgramFacultyId(null)
  }, [currentProgram, facultadesList])

  const pensumCourseMap = useMemo(() => {
    const map = new Map()
    for (const item of currentPensum) {
      map.set(item.code_course, item)
    }
    return map
  }, [currentPensum])

  const currentFacultyObj = useMemo(() => {
    if (!programFacultyId) return null
    return facultadesList.find(f => String(f.id) === String(programFacultyId)) || null
  }, [facultadesList, programFacultyId])

  const allElectivasDisponibles = useMemo(() => {
    return asignaturas.filter(a => Boolean(
      a.is_elective ||
      a.es_complementaria ||
      a.name_course?.toLowerCase().includes('electiv') ||
      a.code_course?.toLowerCase().startsWith('ele')
    ))
  }, [asignaturas])

  const electivasComunes = useMemo(() => {
    return allElectivasDisponibles.filter(a => {
      const isComun = Boolean(
        a.es_complementaria ||
        String(a.id_facultad) === '2' ||
        a.name_course?.toLowerCase().includes('complementar')
      )
      if (!isComun) return false
      if (electivesSearch.trim()) {
        const q = electivesSearch.toLowerCase()
        return a.code_course.toLowerCase().includes(q) || a.name_course.toLowerCase().includes(q)
      }
      return true
    })
  }, [allElectivasDisponibles, electivesSearch])

  const electivasEspecializadas = useMemo(() => {
    if (!programFacultyId) return []
    return allElectivasDisponibles.filter(a => {
      const isComun = Boolean(
        a.es_complementaria ||
        String(a.id_facultad) === '2' ||
        a.name_course?.toLowerCase().includes('complementar')
      )
      if (isComun) return false
      if (String(a.id_facultad) !== String(programFacultyId)) return false
      if (electivesSearch.trim()) {
        const q = electivesSearch.toLowerCase()
        return a.code_course.toLowerCase().includes(q) || a.name_course.toLowerCase().includes(q)
      }
      return true
    })
  }, [allElectivasDisponibles, programFacultyId, electivesSearch])

  // =========================================================================
  // LÓGICA DE RESOLUCIÓN (HU-017) Y EDICIÓN DE MALLA (HU-032) CON COLUMNAS
  // =========================================================================

  const buildSnapshotString = (formState, coursesList) => {
    const normalized = {
      numero_resolucion: (formState.numero_resolucion || '').trim().toUpperCase(),
      numero_semestre: String(formState.numero_semestre ?? '').trim(),
      name_program: (formState.name_program || '').trim(),
      descripcion: (formState.descripcion || '').trim(),
      jornada: (formState.jornada || 'DIURNA').trim().toUpperCase(),
      periodo_oferta: (formState.periodo_oferta || 'SEMESTRAL').trim().toUpperCase(),
      courses: (coursesList || [])
        .map(c => `${String(c.code_course || '').trim().toUpperCase()}:${parseInt(c.semestre, 10) || 1}`)
        .sort()
    }
    return JSON.stringify(normalized)
  }

  // Abrir formulario en modo "Editar" (HU-032)
  const handleOpenEditMalla = () => {
    if (!currentProgram || !isActiveMalla) return
    const firstItem = savedPensum[0] || {}
    const resInitial = firstItem.numero_resolucion || currentProgram.numero_resolucion || ''
    const semInitial = String(firstItem.numero_semestres || currentProgram.numero_semestre || 10)
    const descInitial = firstItem.descripcion || `Resolución curricular vigente de ${currentProgram.name_program}`
    const jornadaInitial = (firstItem.jornada || currentProgram.jornada || 'DIURNA').toUpperCase()
    const periodoInitial = (firstItem.periodo_oferta || currentProgram.ingreso || 'SEMESTRAL').toUpperCase()

    const initialForm = {
      numero_resolucion: resInitial,
      numero_semestre: semInitial,
      name_program: currentProgram.name_program || '',
      descripcion: descInitial,
      jornada: jornadaInitial === 'NOCTURNA' ? 'NOCTURNA' : 'DIURNA',
      periodo_oferta: periodoInitial === 'ANUAL' ? 'ANUAL' : 'SEMESTRAL'
    }

    setResolutionForm(initialForm)
    setDraftPensum(savedPensum)
    setHasUnsavedChanges(false)
    setInitialEditSnapshot(buildSnapshotString(initialForm, savedPensum))
    setFormErrors({})
    setBannerMessage(null)
    setEditorMode('edit')
    setIsResolutionFormOpen(true)
  }

  // Abrir formulario en modo "Registrar resolución de programa" (HU-017)
  const handleOpenCreateResolution = () => {
    if (!currentProgram) return
    const initialForm = {
      numero_resolucion: '',
      numero_semestre: String(currentProgram.numero_semestre || 10),
      name_program: currentProgram.name_program || '',
      descripcion: '',
      jornada: (currentProgram.jornada || 'DIURNA').toUpperCase() === 'NOCTURNA' ? 'NOCTURNA' : 'DIURNA',
      periodo_oferta: (currentProgram.ingreso || 'SEMESTRAL').toUpperCase() === 'ANUAL' ? 'ANUAL' : 'SEMESTRAL'
    }
    setResolutionForm(initialForm)
    setDraftPensum(savedPensum)
    setInitialEditSnapshot(buildSnapshotString(initialForm, savedPensum))
    setFormErrors({})
    setBannerMessage(null)
    setEditorMode('create')
    setIsResolutionFormOpen(true)
  }

  // Validar los datos del encabezado de resolución (sin semestres ni asignaturas adentro)
  const validateResolutionHeader = () => {
    const errors = {}
    const numRes = (resolutionForm.numero_resolucion || '').trim()
    const numSemStr = String(resolutionForm.numero_semestre ?? '').trim()
    const progName = (resolutionForm.name_program || '').trim()
    const desc = (resolutionForm.descripcion || '').trim()

    if (!numRes) {
      errors.numero_resolucion = 'El número de resolución es obligatorio'
    } else if (numRes.length > 50 || !/^[A-Za-z0-9\s./-]+$/.test(numRes)) {
      errors.numero_resolucion = 'Formato alfanumérico (máx. 50 caracteres)'
    }

    const numSem = parseInt(numSemStr, 10)
    if (!numSemStr || !/^\d+$/.test(numSemStr) || isNaN(numSem) || numSem < 1 || numSem > 20) {
      errors.numero_semestre = 'El número de semestres debe ser numérico entre 1 y 20'
    }

    if (!progName) {
      errors.name_program = 'El nombre del programa académico es obligatorio'
    } else if (progName.length > 100 || !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s.,()-]+$/.test(progName)) {
      errors.name_program = 'Alfanumérico (máx. 100 caracteres)'
    }

    if (!desc) {
      errors.descripcion = 'La descripción es obligatoria'
    } else if (desc.length > 100 || !/^[A-Za-zÁÉÍÓÚáéíóúÑñÜü0-9\s.,()-]+$/.test(desc)) {
      errors.descripcion = 'Máximo 100 caracteres'
    }

    if (!resolutionForm.jornada) {
      errors.jornada = 'La jornada es obligatoria'
    }
    if (!resolutionForm.periodo_oferta) {
      errors.periodo_oferta = 'El período de oferta es obligatorio'
    }

    setFormErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Detectar asignaturas quitadas en las columnas (HU-032 Criterio 4)
  const getRemovedCoursesInColumns = () => {
    if (editorMode !== 'edit') return []
    const currentCodes = new Set(currentPensum.map(c => (c.code_course || '').toUpperCase()))
    const removed = []
    savedPensum.forEach(orig => {
      const origCode = (orig.code_course || '').toUpperCase()
      if (!currentCodes.has(origCode)) {
        removed.push(`${orig.name_course || origCode} (${origCode})`)
      }
    })
    return removed
  }

  // Presionar Guardar (en el formulario o en la barra superior)
  const handleAttemptSaveResolution = (e) => {
    if (e) e.preventDefault()
    setBannerMessage(null)

    const mode = editorMode || (isActiveMalla ? 'edit' : 'create')

    // Validar encabezado si el formulario de resolución está abierto o activo
    if (editorMode && !validateResolutionHeader()) {
      setBannerMessage({
        type: 'error',
        text: 'Por favor completa correctamente los datos de la resolución marcados en rojo.'
      })
      onShowToast('Revisa los campos marcados en el formulario', 'error')
      return
    }

    // Si está creando una resolución y aún no hay asignaturas en las columnas,
    // cerramos el modal dejando configurados los N semestres en las columnas para que agregue asignaturas
    if (mode === 'create' && currentPensum.length === 0) {
      setIsResolutionFormOpen(false)
      onShowToast(
        `Resolución N.° ${resolutionForm.numero_resolucion} configurada con ${resolutionForm.numero_semestre} semestres. Agrega asignaturas en las columnas y presiona "Guardar malla".`,
        'success'
      )
      return
    }

    if (currentPensum.length === 0) {
      setBannerMessage({
        type: 'error',
        text: 'Se necesita al menos un semestre con una asignatura en las columnas antes de guardar.'
      })
      onShowToast('Agrega al menos una asignatura en las columnas', 'error')
      return
    }

    // Criterio 5 (HU-032): Si no modificó nada en modo Editar, muestra "No hay cambios para guardar"
    if (mode === 'edit') {
      const currentSnap = buildSnapshotString(resolutionForm, currentPensum)
      if (!hasUnsavedChanges && currentSnap === initialEditSnapshot) {
        setBannerMessage({ type: 'info', text: 'No hay cambios para guardar' })
        onShowToast('No hay cambios para guardar', 'error')
        return
      }
    }

    let warningText = null
    if (mode === 'edit') {
      const removedCourses = getRemovedCoursesInColumns()
      if (removedCourses.length > 0) {
        warningText = `Atención: Se quitó ${removedCourses.length === 1 ? 'la asignatura' : 'las asignaturas'} ${removedCourses.join(', ')} de las columnas. Si tiene asignaciones en la programación académica vigente, al aceptar esas asignaciones se eliminarán.`
      }
    } else if (mode === 'create' && savedPensum.length > 0) {
      warningText = `Ya existe una malla activa para el programa ${currentProgram.code_program}. Al confirmar, la malla anterior pasará a estado inactiva.`
    }

    setConfirmDialog({
      title: mode === 'edit' ? 'Confirmar edición de malla' : 'Confirmar registro de resolución',
      message: '¿La información ingresada es correcta?',
      warningText,
      confirmLabel: 'Aceptar',
      cancelLabel: 'Cancelar',
      onConfirm: () => executeSaveResolution(mode)
    })
  }

  const executeSaveResolution = async (mode) => {
    setConfirmDialog(null)
    setSubmitting(true)
    setBannerMessage(null)

    const numSem = parseInt(resolutionForm.numero_semestre, 10) || totalSemesters
    const numRes = (resolutionForm.numero_resolucion || activeNumeroResolucion || '').trim()

    const flatItems = currentPensum.map(c => ({
      code_course: (c.code_course || '').trim().toUpperCase(),
      name_course: (c.name_course || '').trim(),
      credits: parseInt(c.credits, 10) || 0,
      semestre: Math.min(numSem, Math.max(1, parseInt(c.semestre, 10) || 1)),
      horas_clase: c.horas_clase !== undefined ? parseInt(c.horas_clase, 10) : 4,
      horas_independiente: c.horas_independiente !== undefined ? parseInt(c.horas_independiente, 10) : 8,
      tipo_asignatura: inferTipoAsignatura(c)
    }))

    const payload = {
      code_program: currentProgram.code_program,
      numero_resolucion: numRes || undefined,
      numero_semestre: numSem,
      name_program: (resolutionForm.name_program || currentProgram.name_program || '').trim(),
      descripcion: (resolutionForm.descripcion || activeMetaItem?.descripcion || '').trim(),
      jornada: resolutionForm.jornada || currentProgram.jornada || 'DIURNA',
      periodo_oferta: resolutionForm.periodo_oferta || currentProgram.ingreso || 'SEMESTRAL',
      items: flatItems
    }

    try {
      if (mode === 'edit') {
        await updatePensumVersion(currentProgram.code_program, payload)
        onShowToast('Resolución actualizada', 'success')
      } else {
        await savePensumVersion(currentProgram.code_program, payload)
        onShowToast('Resolución registrada exitosamente', 'success')
      }
      setHasUnsavedChanges(false)
      setEditorMode(null)
      setIsResolutionFormOpen(false)
      await onRefresh()
    } catch (err) {
      if (mode === 'create') {
        const msg = 'No se pudo registrar la resolución'
        setBannerMessage({ type: 'error', text: `${msg}: ${err.message || ''}`.trim() })
        onShowToast(msg, 'error')
      } else {
        const msg = err.message || 'Error al actualizar la resolución'
        setBannerMessage({ type: 'error', text: msg })
        onShowToast(msg, 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // Cancelar edición / creación (HU-032 Criterio 7 y HU-017 Criterio 4)
  const handleCancelResolutionForm = () => {
    const currentSnap = buildSnapshotString(resolutionForm, currentPensum)
    const hasModifiedData = hasUnsavedChanges || (initialEditSnapshot && currentSnap !== initialEditSnapshot)
    if (hasModifiedData) {
      setConfirmDialog({
        title: 'Confirmar cancelación',
        message: '¿Está seguro de que desea cancelar? Los cambios no guardados se descartarán y la malla conservará su información original.',
        warningText: null,
        confirmLabel: 'Sí, descartar cambios',
        cancelLabel: 'Seguir editando',
        onConfirm: () => {
          setConfirmDialog(null)
          setDraftPensum(savedPensum)
          setHasUnsavedChanges(false)
          setEditorMode(null)
          setIsResolutionFormOpen(false)
          setFormErrors({})
          setBannerMessage(null)
        }
      })
    } else {
      setEditorMode(null)
      setIsResolutionFormOpen(false)
      setFormErrors({})
      setBannerMessage(null)
    }
  }

  // Generador de nombre consecutivo para electivas
  const getConsecutiveElectiveName = useCallback(() => {
    if (!currentProgram) return 'Electiva Profesional I'
    const existingElectives = currentPensum.filter(item => {
      const name = item.name_course?.toLowerCase() || ''
      const code = item.code_course?.toLowerCase() || ''
      return name.includes('electiv') || code.startsWith('ele')
    })

    const count = existingElectives.length + 1
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV']
    const roman = romanNumerals[count - 1] || `${count}`
    return `Electiva Profesional ${roman}`
  }, [currentProgram, currentPensum])

  const handleSwitchToElective = () => {
    setAddMode('elective')
    setElectiveCode('')
    setElectiveName(getConsecutiveElectiveName())
    setElectiveCredits('')
  }

  const handleOpenAddModal = (semesterNum = 1) => {
    if (!effectiveCanEdit) return
    setSelectedSemesterForAdd(semesterNum)
    setSelectedCourseForAdd(availableCourses[0]?.code_course || '')
    setCourseSearchModal('')
    setAddMode('catalog')
    setElectiveCode('')
    setElectiveName(getConsecutiveElectiveName())
    setElectiveCredits('')
    setIsAddModalOpen(true)
  }

  const handleAddCourse = async (e) => {
    e.preventDefault()
    if (!currentProgram) return

    setSubmitting(true)
    try {
      if (addMode === 'elective') {
        const nameClean = electiveName.trim() || getConsecutiveElectiveName()
        let codeClean = electiveCode.trim().toUpperCase()

        if (!codeClean) {
          const romanPart = nameClean.split(' ').pop().toUpperCase()
          codeClean = `ELE-PROF-${romanPart}`.replace(/[^A-Z0-9-]/g, '')
          if (!codeClean || codeClean === 'ELE-PROF-') {
            codeClean = `ELE-${Date.now().toString().slice(-4)}`
          }
        }

        const parsedCredits = parseInt(electiveCredits, 10)
        const creditsNum = isNaN(parsedCredits) || parsedCredits < 0 ? 0 : Math.min(9, parsedCredits)

        const existingInCatalog = asignaturas.find(a => a.code_course.toUpperCase() === codeClean)
        if (!existingInCatalog) {
          await createAsignatura({
            code_course: codeClean,
            name_course: nameClean,
            credits: creditsNum
          })
        }
        const elective = {
          code_program: currentProgram.code_program,
          code_course: codeClean,
          name_course: nameClean,
          credits: creditsNum,
          semestre: selectedSemesterForAdd,
          is_elective: true,
          activo: true
        }
        setDraftPensum(previous => [...previous, elective])
        setHasUnsavedChanges(true)
        if (!editorMode && isActiveMalla) {
          setEditorMode('edit')
        }
        onShowToast(`Electiva "${nameClean}" agregada al Semestre ${selectedSemesterForAdd}`, 'success')
      } else {
        if (!selectedCourseForAdd) {
          onShowToast('Selecciona una asignatura para agregar', 'error')
          setSubmitting(false)
          return
        }

        const course = asignaturas.find(item => item.code_course === selectedCourseForAdd)
        setDraftPensum(previous => [...previous, {
          ...course,
          code_program: currentProgram.code_program,
          semestre: selectedSemesterForAdd,
          activo: true
        }])
        setHasUnsavedChanges(true)
        if (!editorMode && isActiveMalla) {
          setEditorMode('edit')
        }
        onShowToast(`Asignatura agregada al Semestre ${selectedSemesterForAdd}`, 'success')
      }

      setIsAddModalOpen(false)
    } catch (err) {
      onShowToast(`Error: ${err.message || 'No se pudo agregar la asignatura'}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleShiftSemester = async (item, delta) => {
    if (!effectiveCanEdit) return
    const newSem = item.semestre + delta
    if (newSem < 1 || newSem > totalSemesters) {
      onShowToast(`El semestre debe estar entre 1 y ${totalSemesters}`, 'error')
      return
    }

    setDraftPensum(previous => previous.map(course =>
      course.code_course === item.code_course ? { ...course, semestre: newSem } : course
    ))
    setHasUnsavedChanges(true)
    if (!editorMode && isActiveMalla) setEditorMode('edit')
    onShowToast(`Movida a Semestre ${newSem}`, 'success')
  }

  const handleConfirmMoveSemester = async (e) => {
    e.preventDefault()
    if (!movingCourse || !effectiveCanEdit) return

    setSubmitting(true)
    try {
      setDraftPensum(previous => previous.map(course =>
        course.code_course === movingCourse.code_course
          ? { ...course, semestre: targetSemester }
          : course
      ))
      setHasUnsavedChanges(true)
      if (!editorMode && isActiveMalla) setEditorMode('edit')
      onShowToast(`Asignatura transferida al Semestre ${targetSemester}`, 'success')
      setMovingCourse(null)
    } catch (err) {
      onShowToast(`Error: ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemoveCourse = async (item) => {
    if (!effectiveCanEdit) return
    if (!window.confirm(`¿Quitar "${item.name_course}" del pensum de ${currentProgram.name_program}?`)) {
      return
    }

    setDraftPensum(previous => previous.filter(course => course.code_course !== item.code_course))
    setHasUnsavedChanges(true)
    if (!editorMode && isActiveMalla) setEditorMode('edit')
    onShowToast('Asignatura retirada de la columna', 'success')
  }

  const handleDeactivatePensum = async () => {
    if (hasUnsavedChanges) {
      onShowToast('Guarda o descarta los cambios antes de desactivar la malla', 'error')
      return
    }
    if (!window.confirm(`¿Desactivar la malla vigente de ${currentProgram.name_program}? Podrás consultarla o reactivarla desde el historial.`)) return
    setSubmitting(true)
    try {
      await deactivatePensum(currentProgram.code_program)
      onShowToast('Malla desactivada correctamente', 'success')
      await onRefresh()
    } catch (err) {
      onShowToast(`Error al desactivar la malla: ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenHistory = async () => {
    setHistoryOpen(true)
    setHistoryLoading(true)
    try {
      const history = await getPensumHistory(currentProgram.code_program)
      setHistoryItems(history || [])
      setSelectedHistoryVersion(null)
      setHistoryDetail([])
    } catch (err) {
      onShowToast(`Error al cargar el historial: ${err.message}`, 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleSelectHistory = async (version) => {
    setSelectedHistoryVersion(version)
    setHistoryLoading(true)
    try {
      setHistoryDetail(await getPensumVersion(currentProgram.code_program, version))
    } catch (err) {
      onShowToast(`Error al cargar el detalle: ${err.message}`, 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleInspectInactiveInGrid = () => {
    if (selectedHistoryVersion === null) return
    setViewingInactiveVersion(selectedHistoryVersion)
    setInactiveVersionCourses(historyDetail)
    setHistoryOpen(false)
  }

  const handleReactivatePensum = async (versionToReactivate = selectedHistoryVersion) => {
    if (versionToReactivate === null) return
    const hasCurrent = savedPensum.length > 0
    const message = hasCurrent
      ? 'La malla vigente actual será desactivada. ¿Desea reactivar la versión seleccionada?'
      : '¿Desea reactivar la versión seleccionada como malla vigente?'
    if (!window.confirm(message)) return
    setSubmitting(true)
    try {
      await reactivatePensum(currentProgram.code_program, versionToReactivate)
      setHistoryOpen(false)
      setViewingInactiveVersion(null)
      setInactiveVersionCourses([])
      onShowToast('Malla reactivada correctamente', 'success')
      await onRefresh()
    } catch (err) {
      onShowToast(`Error al reactivar la malla: ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  if (programas.length === 0) {
    return (
      <div className="section-container">
        <div className="empty-state-card">
          <BookOpen size={56} className="empty-icon text-primary" />
          <h2>No hay programas registrados</h2>
          <p>Para visualizar y estructurar una malla curricular, primero debes registrar al menos un programa o carrera.</p>
          <button className="btn-primary" onClick={onNavigateToProgramas}>
            <Plus size={16} /> Crear Primer Programa
          </button>
        </div>
      </div>
    )
  }

  const sortedSemesters = Object.keys(semesterMap).map(Number).sort((a, b) => a - b)

  return (
    <div className="pensum-container">
      {/* Program Selector & Actions Topbar */}
      <div className="pensum-header-card print-hide">
        <div className="program-search-wrapper">
          <label className="selector-label">
            <BookOpen size={18} className="text-primary" />
            <span>Carrera o Programa:</span>
          </label>
          <div className="program-search-combobox" ref={comboboxRef}>
            <div className="program-search-input-row">
              <Search size={16} className="prog-search-icon" />
              <input
                ref={programInputRef}
                type="text"
                className="program-search-input"
                placeholder={
                  currentProgram
                    ? `${currentProgram.code_program} — ${currentProgram.name_program}`
                    : 'Buscar por nombre o código...'
                }
                value={programSearch}
                onChange={(e) => { setProgramSearch(e.target.value); setProgramDropdownOpen(true) }}
                onFocus={() => setProgramDropdownOpen(true)}
              />
              {programSearch && (
                <button
                  className="search-clear-btn"
                  onClick={() => { setProgramSearch(''); setProgramDropdownOpen(true); programInputRef.current?.focus() }}
                  title="Limpiar"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {programDropdownOpen && (
              <div className="program-search-dropdown">
                {filteredProgramas.length === 0 ? (
                  <div className="prog-dropdown-empty">
                    <span>Sin resultados para "{programSearch}"</span>
                  </div>
                ) : (
                  filteredProgramas.map((prog) => (
                    <button
                      key={prog.code_program}
                      className={`prog-dropdown-item ${prog.code_program === currentProgram?.code_program ? 'active' : ''}`}
                      onMouseDown={() => handleSelectProgram(prog.code_program)}
                    >
                      <span className="prog-item-code">{prog.code_program}</span>
                      <span className="prog-item-name">{prog.name_program}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        <div className="pensum-header-actions">
          <button
            className="btn-secondary"
            onClick={handleOpenHistory}
            disabled={submitting}
            title="Consultar mallas inactivas en el historial"
          >
            <History size={16} />
            <span>Historial</span>
          </button>

          {/* HU-032 Criterio 1: Solo las mallas activas muestran "Editar". Las inactivas son de solo consulta. */}
          {canEdit && isActiveMalla && (
            <button
              className="btn-primary"
              onClick={handleOpenEditMalla}
              disabled={submitting}
              title="Editar datos de resolución y malla activa (HU-032)"
            >
              <Edit3 size={16} />
              <span>Editar</span>
            </button>
          )}

          {/* HU-017: Botón "Registrar resolución de programa" */}
          {canEdit && (
            <button
              className="btn-primary"
              onClick={handleOpenCreateResolution}
              disabled={submitting}
              title="Registrar nueva resolución con número de resolución y número de semestres (HU-017)"
            >
              <FilePlus2 size={16} />
              <span>Registrar resolución de programa</span>
            </button>
          )}

          {canEdit && isActiveMalla && (
            <button
              className="btn-secondary"
              onClick={handleDeactivatePensum}
              disabled={submitting || savedPensum.length === 0 || hasUnsavedChanges}
              title={hasUnsavedChanges ? 'Guarda primero los cambios pendientes' : 'Desactivar malla vigente'}
            >
              <Archive size={16} />
              <span>Desactivar malla</span>
            </button>
          )}

          {canEdit && (hasUnsavedChanges || editorMode) && !isViewingInactive && (
            <button
              className="btn-primary"
              onClick={handleAttemptSaveResolution}
              disabled={submitting}
            >
              <Save size={16} />
              <span>{submitting ? 'Guardando...' : (editorMode === 'edit' ? 'Guardar edición' : 'Guardar malla')}</span>
            </button>
          )}

          <button
            className="btn-secondary"
            onClick={handlePrint}
            title="Imprimir o exportar en PDF la malla curricular"
          >
            <Printer size={16} />
            <span>Imprimir / Exportar Malla</span>
          </button>

          {effectiveCanEdit && (
            <button
              className="btn-primary"
              onClick={() => handleOpenAddModal(1)}
              disabled={availableCourses.length === 0}
              title={availableCourses.length === 0 ? 'No hay más asignaturas disponibles para agregar' : 'Agregar materia a este programa'}
            >
              <Plus size={16} />
              <span>Agregar Materia al Pensum</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner de Malla Inactiva — Solo Consulta (HU-032 Criterio 1) */}
      {isViewingInactive && (
        <div className="warning-banner print-hide" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Eye size={18} />
            <span>
              <strong>Malla Inactiva (Versión {viewingInactiveVersion}) — Modo Solo Consulta:</strong> Las mallas inactivas son únicamente de consulta y no pueden ser editadas.
            </span>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {canEdit && (
              <button
                type="button"
                className="btn-primary btn-sm"
                onClick={() => handleReactivatePensum(viewingInactiveVersion)}
                disabled={submitting}
              >
                <RotateCcw size={14} /> Reactivar esta versión
              </button>
            )}
            <button
              type="button"
              className="btn-secondary btn-sm"
              onClick={() => {
                setViewingInactiveVersion(null)
                setInactiveVersionCourses([])
              }}
            >
              Volver a malla activa
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          FORMULARIO DE DATOS DE RESOLUCIÓN / EDICIÓN (SIN SEMESTRES ADENTRO)
          Los semestres y asignaturas se gestionan directamente en las columnas
          ===================================================================== */}
      {isResolutionFormOpen && editorMode && (
        <div className="section-container print-hide" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '14px',
              padding: '1.5rem',
              boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.08)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.85rem' }}>
              <div>
                <span className="banner-tag" style={{ marginBottom: '0.35rem', display: 'inline-block' }}>
                  {editorMode === 'edit' ? 'HU-032 · Editar Malla Activa' : 'HU-017 · Registrar Resolución de Programa'}
                </span>
                <h2 style={{ margin: 0, fontSize: '1.2rem', color: '#0f172a' }}>
                  {editorMode === 'edit'
                    ? `Editar resolución y malla — ${currentProgram?.code_program}`
                    : `Nueva resolución de programa — ${currentProgram?.code_program}`}
                </h2>
                <small style={{ color: '#64748b' }}>
                  Define el número de resolución y el número de semestres; las asignaturas se agregan y organizan directamente en las columnas de abajo.
                </small>
              </div>
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCancelResolutionForm}
                disabled={submitting}
              >
                <X size={16} /> Cancelar
              </button>
            </div>

            {bannerMessage && (
              <div
                className={bannerMessage.type === 'error' ? 'warning-banner' : 'info-banner'}
                style={{
                  marginBottom: '1rem',
                  background: bannerMessage.type === 'error' ? '#fef2f2' : '#eff6ff',
                  borderColor: bannerMessage.type === 'error' ? '#fecaca' : '#bfdbfe',
                  color: bannerMessage.type === 'error' ? '#b91c1c' : '#1e40af'
                }}
              >
                <AlertTriangle size={18} />
                <span><strong>{bannerMessage.text}</strong></span>
              </div>
            )}

            <form onSubmit={handleAttemptSaveResolution} noValidate>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
                  gap: '1rem',
                  background: '#f8fafc',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0'
                }}
              >
                {/* Número de resolución */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="res_numero_resolucion">Número de resolución *</label>
                  <input
                    id="res_numero_resolucion"
                    type="text"
                    maxLength={50}
                    value={resolutionForm.numero_resolucion}
                    onChange={(e) => setResolutionForm(prev => ({ ...prev, numero_resolucion: e.target.value }))}
                    placeholder="Ej. RES-045-2026"
                    style={formErrors.numero_resolucion ? { borderColor: '#dc2626', background: '#fff5f5' } : {}}
                  />
                  {formErrors.numero_resolucion && (
                    <small style={{ color: '#dc2626', fontWeight: 500 }}>{formErrors.numero_resolucion}</small>
                  )}
                </div>

                {/* Número de semestres (define las columnas de la malla) */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="res_numero_semestre">Número de semestres (columnas) *</label>
                  <input
                    id="res_numero_semestre"
                    type="number"
                    min={1}
                    max={20}
                    value={resolutionForm.numero_semestre}
                    onChange={(e) => setResolutionForm(prev => ({ ...prev, numero_semestre: e.target.value }))}
                    placeholder="Ej. 10"
                    style={formErrors.numero_semestre ? { borderColor: '#dc2626', background: '#fff5f5' } : {}}
                  />
                  {formErrors.numero_semestre && (
                    <small style={{ color: '#dc2626', fontWeight: 500 }}>{formErrors.numero_semestre}</small>
                  )}
                </div>

                {/* Nombre del programa */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="res_name_program">Nombre del programa académico *</label>
                  <input
                    id="res_name_program"
                    type="text"
                    maxLength={100}
                    value={resolutionForm.name_program}
                    onChange={(e) => setResolutionForm(prev => ({ ...prev, name_program: e.target.value }))}
                    placeholder="Ej. Tecnología en Desarrollo de Software"
                    style={formErrors.name_program ? { borderColor: '#dc2626', background: '#fff5f5' } : {}}
                  />
                  {formErrors.name_program && (
                    <small style={{ color: '#dc2626', fontWeight: 500 }}>{formErrors.name_program}</small>
                  )}
                </div>

                {/* Descripción */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="res_descripcion">Descripción *</label>
                  <input
                    id="res_descripcion"
                    type="text"
                    maxLength={100}
                    value={resolutionForm.descripcion}
                    onChange={(e) => setResolutionForm(prev => ({ ...prev, descripcion: e.target.value }))}
                    placeholder="Ej. Resolución curricular actualizada"
                    style={formErrors.descripcion ? { borderColor: '#dc2626', background: '#fff5f5' } : {}}
                  />
                  {formErrors.descripcion && (
                    <small style={{ color: '#dc2626', fontWeight: 500 }}>{formErrors.descripcion}</small>
                  )}
                </div>

                {/* Jornada */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="res_jornada">Jornada *</label>
                  <select
                    id="res_jornada"
                    className="select-input"
                    value={resolutionForm.jornada}
                    onChange={(e) => setResolutionForm(prev => ({ ...prev, jornada: e.target.value }))}
                    style={formErrors.jornada ? { borderColor: '#dc2626', background: '#fff5f5' } : {}}
                  >
                    <option value="DIURNA">Diurna</option>
                    <option value="NOCTURNA">Nocturna</option>
                  </select>
                </div>

                {/* Período de oferta */}
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="res_periodo">Período de oferta *</label>
                  <select
                    id="res_periodo"
                    className="select-input"
                    value={resolutionForm.periodo_oferta}
                    onChange={(e) => setResolutionForm(prev => ({ ...prev, periodo_oferta: e.target.value }))}
                    style={formErrors.periodo_oferta ? { borderColor: '#dc2626', background: '#fff5f5' } : {}}
                  >
                    <option value="SEMESTRAL">Semestral</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCancelResolutionForm}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  <Save size={16} />
                  <span>
                    {submitting
                      ? 'Guardando...'
                      : editorMode === 'edit'
                      ? 'Guardar cambios de resolución'
                      : 'Guardar resolución'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Cuadro de diálogo de confirmación */}
      {confirmDialog && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h2>{confirmDialog.title}</h2>
              <button className="modal-close-btn" onClick={() => setConfirmDialog(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '1rem', fontWeight: 600, color: '#0f172a', marginBottom: '0.75rem' }}>
                {confirmDialog.message}
              </p>
              {confirmDialog.warningText && (
                <div
                  className="warning-banner"
                  style={{
                    marginTop: '0.5rem',
                    background: '#fffbeb',
                    borderColor: '#fde68a',
                    color: '#92400e'
                  }}
                >
                  <AlertTriangle size={18} />
                  <span>{confirmDialog.warningText}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setConfirmDialog(null)}
                disabled={submitting}
              >
                {confirmDialog.cancelLabel || 'Cancelar'}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={confirmDialog.onConfirm}
                disabled={submitting}
              >
                {confirmDialog.confirmLabel || 'Aceptar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {hasUnsavedChanges && (
        <div className="warning-banner print-hide">
          <AlertTriangle size={18} />
          <span>Hay cambios sin guardar en las columnas de esta malla curricular.</span>
        </div>
      )}

      {!canEdit && (
        <div className="info-banner print-hide">
          <BookOpen size={18} />
          <span>Modo consulta: puedes visualizar la malla vigente y consultar su historial, pero no modificarla.</span>
        </div>
      )}

      {/* Program Overview Banner */}
      {currentProgram && (
        <div className="program-overview-banner">
          <div className="program-main-info">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <div className="banner-tag">
                {isViewingInactive
                  ? `Malla Curricular Inactiva · Versión ${viewingInactiveVersion} (Solo Consulta)`
                  : isActiveMalla
                  ? 'Malla Curricular Oficial (Activa)'
                  : 'Sin Malla Activa (Solo Consulta)'}
              </div>
              {isMallaEditada && (
                <span
                  className="code-chip"
                  style={{
                    background: '#fef3c7',
                    color: '#92400e',
                    border: '1px solid #fcd34d',
                    fontSize: '0.75rem'
                  }}
                  title={fechaUltimaEdicion ? `Última edición: ${new Date(fechaUltimaEdicion).toLocaleString()}` : 'Esta malla ha sido editada'}
                >
                  Editada {fechaUltimaEdicion ? `(${new Date(fechaUltimaEdicion).toLocaleDateString()})` : ''}
                </span>
              )}
            </div>
            <h1 className="program-banner-title">{currentProgram.name_program}</h1>
            <div className="program-tags-row">
              <span className="code-chip">Código: <strong>{currentProgram.code_program}</strong></span>
              {activeNumeroResolucion && (
                <span className="code-chip">
                  <FileText size={13} style={{ marginRight: '4px', verticalAlign: 'text-bottom' }} />
                  Resolución: <strong>{activeNumeroResolucion}</strong>
                </span>
              )}
              <span className="group-chip">Jornada: <strong>{currentProgram.jornada || 'DIURNA'}</strong></span>
              <span className="group-chip">Oferta: <strong>{currentProgram.ingreso || 'SEMESTRAL'}</strong></span>
              <span className="group-chip">Duración: <strong>{totalSemesters} Semestres</strong></span>
            </div>
          </div>

          <div className="program-stats-row">
            <div className="stat-box">
              <span className="stat-number">{currentPensum.length}</span>
              <span className="stat-label">Materias en Pensum</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{totalProgramCredits}</span>
              <span className="stat-label">Créditos Totales</span>
            </div>
            <div className="stat-box">
              <span className="stat-number">{sortedSemesters.length}</span>
              <span className="stat-label">Semestres Activos</span>
            </div>
          </div>
        </div>
      )}

      {/* Notice if no available courses */}
      {availableCourses.length === 0 && asignaturas.length > 0 && effectiveCanEdit && (
        <div className="info-banner print-hide">
          <Sparkles size={18} className="text-amber" />
          <span>
            Todas las asignaturas registradas ({asignaturas.length}) ya están asignadas en este pensum.
          </span>
          <button className="btn-link" onClick={onNavigateToAsignaturas}>
            Crear nuevas asignaturas en el Banco
          </button>
        </div>
      )}

      {asignaturas.length === 0 && (
        <div className="warning-banner print-hide">
          <HelpCircle size={18} />
          <span>El banco de asignaturas está vacío. Agrega materias al catálogo para incluirlas en las columnas del pensum.</span>
          {canEdit && (
            <button className="btn-secondary btn-sm" onClick={onNavigateToAsignaturas}>
              Ir a Asignaturas
            </button>
          )}
        </div>
      )}

      {currentPensum.length === 0 && !isViewingInactive && (
        <div className="info-banner print-hide">
          <Archive size={18} />
          <span>
            Este programa no tiene una malla activa. Usa "Registrar resolución de programa" y agrega las asignaturas en las columnas de cada semestre.
          </span>
          <button className="btn-link" onClick={handleOpenHistory}>Ver historial</button>
        </div>
      )}

      {/* Malla Curricular Grid (Semesters Columns) */}
      <div className="malla-grid-wrapper">
        <div className="malla-grid">
          {sortedSemesters.map((semNum) => {
            const coursesInSem = semesterMap[semNum] || []
            const semCredits = coursesInSem.reduce((sum, c) => sum + (c.credits || 0), 0)
            return (
              <div key={semNum} className="semester-column">
                <div className="semester-column-header">
                  <div className="semester-title">
                    <span className="semester-badge">Semestre {semNum}</span>
                    <div className="semester-sub-badges">
                      <span className="semester-count-badge">
                        {coursesInSem.length} {coursesInSem.length === 1 ? 'materia' : 'materias'}
                      </span>
                      <span className="semester-credits-badge">
                        • {semCredits} {semCredits === 1 ? 'crédito' : 'créditos'}
                      </span>
                    </div>
                  </div>
                  {effectiveCanEdit && (
                    <button
                      className="btn-quick-add print-hide"
                      onClick={() => handleOpenAddModal(semNum)}
                      title={`Agregar materia al semestre ${semNum}`}
                    >
                      <Plus size={14} />
                    </button>
                  )}
                </div>

                <div className="semester-courses-list">
                  {coursesInSem.length === 0 ? (
                    <div className="semester-empty-placeholder">
                      <span>Semestre sin materias</span>
                      {effectiveCanEdit && (
                        <button
                          className="btn-add-ghost print-hide"
                          onClick={() => handleOpenAddModal(semNum)}
                        >
                          + Asignar materia
                        </button>
                      )}
                    </div>
                  ) : (
                    coursesInSem.map((item) => {
                      const isElective =
                        item.name_course?.toLowerCase().includes('electiv') ||
                        item.code_course?.toLowerCase().startsWith('ele')
                      return (
                        <div key={item.code_course} className="pensum-course-card">
                          <div className="pensum-course-card-top">
                            <div className="pensum-card-badge-row">
                              <span className="course-code-pill">{item.code_course}</span>
                              {isElective && (
                                <span className="pensum-elective-pill" title="Asignatura Electiva">
                                  <Sparkles size={10} /> Electiva
                                </span>
                              )}
                              <span className="pensum-credit-pill" title={`${item.credits ?? 0} créditos académicos`}>
                                {item.credits ?? 0} {item.credits === 1 ? 'créd' : 'créds'}
                              </span>
                            </div>
                            {effectiveCanEdit && (
                              <div className="pensum-card-tools print-hide">
                                <button
                                  className="btn-card-tool"
                                  onClick={() => {
                                    setMovingCourse(item)
                                    setTargetSemester(item.semestre)
                                  }}
                                  title="Cambiar de semestre"
                                >
                                  <ArrowRightLeft size={13} />
                                </button>
                                <button
                                  className="btn-card-tool tool-danger"
                                  onClick={() => handleRemoveCourse(item)}
                                  title="Quitar del pensum"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            )}
                          </div>

                          <h4 className="pensum-course-name">{item.name_course}</h4>

                          {effectiveCanEdit && (
                            <div className="pensum-card-navigation print-hide">
                              <button
                                className="btn-nav-shift"
                                disabled={semNum <= 1}
                                onClick={() => handleShiftSemester(item, -1)}
                                title="Mover a semestre anterior"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <span className="sem-indicator">S{semNum}</span>
                              <button
                                className="btn-nav-shift"
                                disabled={semNum >= totalSemesters}
                                onClick={() => handleShiftSemester(item, 1)}
                                title="Mover a semestre siguiente"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* =====================================================================
          BARRA / PANEL DE ELECTIVAS DISPONIBLES DEBAJO DEL PENSUM
          ===================================================================== */}
      <div className="electives-dock-section print-hide">
        <div className="electives-dock-header">
          <div className="electives-dock-title-group">
            <div className="dock-icon-wrapper">
              <Sparkles size={20} className="text-purple" />
            </div>
            <div>
              <div className="electives-dock-heading-row">
                <h3 className="electives-dock-title">
                  Banco de Electivas Disponibles para la Carrera
                </h3>
                <span className="dock-badge-total">
                  {electivasEspecializadas.length + electivasComunes.length} disponibles
                </span>
              </div>
              <p className="electives-dock-desc">
                {currentFacultyObj
                  ? <>Electivas especializadas de la facultad <strong>{currentFacultyObj.nombre || currentFacultyObj.Nombre}</strong> y electivas comunes / complementarias institucionales.</>
                  : <>Electivas especializadas de la propia carrera y electivas comunes / complementarias institucionales.</>
                }
              </p>
            </div>
          </div>

          <div className="electives-dock-controls">
            {currentFacultyObj && (
              <div className="dock-faculty-tag" title="Facultad a la que pertenece esta carrera">
                <Building2 size={14} />
                <span>Facultad: <strong>{currentFacultyObj.nombre || currentFacultyObj.Nombre}</strong></span>
              </div>
            )}

            <div className="dock-search-box">
              <Search size={14} className="dock-search-icon" />
              <input
                type="text"
                placeholder="Buscar electiva..."
                value={electivesSearch}
                onChange={(e) => setElectivesSearch(e.target.value)}
              />
              {electivesSearch && (
                <button className="dock-search-clear" onClick={() => setElectivesSearch('')}>×</button>
              )}
            </div>

            <div className="dock-tabs-group">
              <button
                type="button"
                className={`dock-tab-btn ${electivesTabFilter === 'all' ? 'active' : ''}`}
                onClick={() => setElectivesTabFilter('all')}
              >
                Todas ({electivasEspecializadas.length + electivasComunes.length})
              </button>
              <button
                type="button"
                className={`dock-tab-btn ${electivesTabFilter === 'especializadas' ? 'active' : ''}`}
                onClick={() => setElectivesTabFilter('especializadas')}
              >
                Especializadas ({electivasEspecializadas.length})
              </button>
              <button
                type="button"
                className={`dock-tab-btn ${electivesTabFilter === 'comunes' ? 'active' : ''}`}
                onClick={() => setElectivesTabFilter('comunes')}
              >
                Comunes ({electivasComunes.length})
              </button>
            </div>

            <button
              type="button"
              className="btn-dock-toggle"
              onClick={() => setIsElectivesDockExpanded(!isElectivesDockExpanded)}
              title={isElectivesDockExpanded ? 'Minimizar barra' : 'Expandir barra'}
            >
              {isElectivesDockExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>
          </div>
        </div>

        {isElectivesDockExpanded && (
          <div className="electives-dock-body">
            <div className="electives-split-grid">
              {(electivesTabFilter === 'all' || electivesTabFilter === 'especializadas') && (
                <div className="electives-dock-column column-especializadas">
                  <div className="dock-column-header">
                    <div className="dock-column-header-title">
                      <span className="dock-pill-tag tag-especializada">
                        <Layers size={13} /> Especializadas
                      </span>
                      <h4>{currentFacultyObj ? `Facultad de ${currentFacultyObj.nombre || currentFacultyObj.Nombre}` : 'Especializadas de la Carrera'}</h4>
                    </div>
                    <span className="dock-count-badge">{electivasEspecializadas.length} materias</span>
                  </div>

                  <div className="dock-cards-scroll">
                    {electivasEspecializadas.length === 0 ? (
                      <div className="dock-empty-state">
                        <p>No hay electivas especializadas registradas para la facultad de esta carrera.</p>
                        <button className="btn-link" onClick={onNavigateToAsignaturas}>
                          + Crear electiva especializada en Asignaturas
                        </button>
                      </div>
                    ) : (
                      electivasEspecializadas.map(el => {
                        const inPensum = pensumCourseMap.get(el.code_course)
                        return (
                          <div key={el.code_course} className="dock-elective-card card-especializada">
                            <div className="dock-card-top">
                              <span className="dock-course-code">{el.code_course}</span>
                              <span className="dock-credits-badge">
                                <Award size={11} /> {el.credits ?? 0} {el.credits === 1 ? 'créd' : 'créds'}
                              </span>
                            </div>
                            <h5 className="dock-course-name">{el.name_course}</h5>
                            <div className="dock-card-actions">
                              {inPensum ? (
                                <span className="dock-assigned-badge">
                                  <CheckCircle2 size={13} /> En Semestre {inPensum.semestre}
                                </span>
                              ) : (
                                <span className="dock-available-badge">Disponible</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}

              {(electivesTabFilter === 'all' || electivesTabFilter === 'comunes') && (
                <div className="electives-dock-column column-comunes">
                  <div className="dock-column-header">
                    <div className="dock-column-header-title">
                      <span className="dock-pill-tag tag-comun">
                        <Sparkles size={13} /> Comunes / Complementarias
                      </span>
                      <h4>Transversales Institucionales</h4>
                    </div>
                    <span className="dock-count-badge">{electivasComunes.length} materias</span>
                  </div>

                  <div className="dock-cards-scroll">
                    {electivasComunes.length === 0 ? (
                      <div className="dock-empty-state">
                        <p>No hay electivas comunes o complementarias registradas.</p>
                        <button className="btn-link" onClick={onNavigateToAsignaturas}>
                          + Crear electiva complementaria en Asignaturas
                        </button>
                      </div>
                    ) : (
                      electivasComunes.map(el => {
                        const inPensum = pensumCourseMap.get(el.code_course)
                        return (
                          <div key={el.code_course} className="dock-elective-card card-comun">
                            <div className="dock-card-top">
                              <span className="dock-course-code">{el.code_course}</span>
                              <span className="dock-credits-badge">
                                <Award size={11} /> {el.credits ?? 0} {el.credits === 1 ? 'créd' : 'créds'}
                              </span>
                            </div>
                            <h5 className="dock-course-name">{el.name_course}</h5>
                            <div className="dock-card-actions">
                              {inPensum ? (
                                <span className="dock-assigned-badge">
                                  <CheckCircle2 size={13} /> En Semestre {inPensum.semestre}
                                </span>
                              ) : (
                                <span className="dock-available-badge">Disponible</span>
                              )}
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal: Historial de mallas inactivas (Solo consulta + Reactivar + Registro de edición) */}
      {historyOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '760px' }}>
            <div className="modal-header">
              <h2>Historial de mallas (Inactivas — Solo consulta)</h2>
              <button className="modal-close-btn" onClick={() => setHistoryOpen(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {historyLoading ? (
                <p>Cargando historial...</p>
              ) : historyItems.length === 0 ? (
                <div className="empty-picker-notice">
                  <p>No hay mallas históricas para este programa.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(210px, 0.9fr) 1.5fr', gap: '1rem' }}>
                  <div className="course-picker-list">
                    {historyItems.map(item => (
                      <button
                        key={item.version}
                        type="button"
                        className={`course-picker-item ${selectedHistoryVersion === item.version ? 'selected' : ''}`}
                        onClick={() => handleSelectHistory(item.version)}
                        style={{ textAlign: 'left', border: 0 }}
                      >
                        <div className="picker-item-details">
                          <strong>
                            Versión {item.version} {item.numero_resolucion ? `· Res. ${item.numero_resolucion}` : ''}
                          </strong>
                          <small>
                            Desactivada: {item.fechaDesactivacion
                              ? new Date(item.fechaDesactivacion).toLocaleString()
                              : 'Sin fecha'}
                          </small>
                          <small>
                            {item.totalAsignaturas} asignaturas
                            {item.editada
                              ? ` · Editada (${item.fecha_edicion ? new Date(item.fecha_edicion).toLocaleDateString() : 'Sí'})`
                              : ' · Sin ediciones'}
                          </small>
                        </div>
                      </button>
                    ))}
                  </div>
                  <div>
                    {selectedHistoryVersion === null ? (
                      <div className="empty-picker-notice">
                        <p>Selecciona una versión para consultar sus asignaturas.</p>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.4rem' }}>
                          <h3 style={{ margin: 0 }}>
                            Detalle de la versión {selectedHistoryVersion}
                            {historyDetail[0]?.numero_resolucion ? ` (Resolución ${historyDetail[0].numero_resolucion})` : ''}
                          </h3>
                          <span className="code-chip">Solo consulta</span>
                        </div>
                        <div className="course-picker-list">
                          {historyDetail.map(item => (
                            <div key={item.code_course} className="course-picker-item">
                              <div className="picker-item-details">
                                <strong>{item.name_course}</strong>
                                <small>
                                  {item.code_course} · Semestre {item.semestre} · {item.credits ?? 0} créditos
                                </small>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleInspectInactiveInGrid}
                          >
                            <Eye size={16} />
                            Ver en columnas (Solo consulta)
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              className="btn-primary"
                              onClick={() => handleReactivatePensum(selectedHistoryVersion)}
                              disabled={submitting}
                            >
                              <RotateCcw size={16} />
                              {submitting ? 'Reactivando...' : 'Reactivar malla'}
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agregar Asignatura a la columna del Semestre */}
      {isAddModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Agregar Materia a {currentProgram?.code_program}</h2>
              <button className="modal-close-btn" onClick={() => setIsAddModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCourse}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Semestre Destino</label>
                  <select
                    value={selectedSemesterForAdd}
                    onChange={(e) => setSelectedSemesterForAdd(parseInt(e.target.value, 10))}
                    className="select-input"
                  >
                    {Array.from({ length: totalSemesters }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>Semestre {num}</option>
                    ))}
                  </select>
                </div>

                <div className="add-mode-tabs">
                  <button
                    type="button"
                    className={`add-mode-tab ${addMode === 'catalog' ? 'active' : ''}`}
                    onClick={() => setAddMode('catalog')}
                  >
                    <BookOpen size={16} />
                    <span>Del Catálogo</span>
                  </button>

                  <button
                    type="button"
                    className={`add-mode-tab mode-elective ${addMode === 'elective' ? 'active' : ''}`}
                    onClick={handleSwitchToElective}
                  >
                    <Sparkles size={16} />
                    <span>Elegir que sea Electiva</span>
                  </button>
                </div>

                {addMode === 'catalog' ? (
                  <>
                    <div className="form-group">
                      <label>Seleccionar Asignatura del Catálogo</label>
                      <input
                        type="text"
                        placeholder="Filtrar por código o nombre..."
                        value={courseSearchModal}
                        onChange={(e) => setCourseSearchModal(e.target.value)}
                        className="search-input-modal"
                      />
                    </div>

                    <div className="course-picker-list">
                      {filteredAvailableCourses.length === 0 ? (
                        <div className="empty-picker-notice">
                          <p>No hay asignaturas disponibles que coincidan con la búsqueda.</p>
                          <button
                            type="button"
                            className="btn-link"
                            onClick={() => {
                              setIsAddModalOpen(false)
                              onNavigateToAsignaturas()
                            }}
                          >
                            Crear una nueva asignatura en el Banco
                          </button>
                        </div>
                      ) : (
                        filteredAvailableCourses.map((c) => (
                          <label
                            key={c.code_course}
                            className={`course-picker-item ${selectedCourseForAdd === c.code_course ? 'selected' : ''}`}
                          >
                            <input
                              type="radio"
                              name="coursePicker"
                              value={c.code_course}
                              checked={selectedCourseForAdd === c.code_course}
                              onChange={() => setSelectedCourseForAdd(c.code_course)}
                            />
                            <div className="picker-item-details">
                              <div className="picker-item-info">
                                <span className="picker-code">{c.code_course}</span>
                                <span className="picker-name">{c.name_course}</span>
                              </div>
                              <span className="picker-credits-tag">
                                {c.credits && c.credits > 0 ? `${c.credits} ${c.credits === 1 ? 'crédito' : 'créditos'}` : '? créditos'}
                              </span>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </>
                ) : (
                  <div className="elective-form-card">
                    <div className="elective-info-banner">
                      <Sparkles size={18} className="text-purple" />
                      <div>
                        <strong>Campos para Asignatura Electiva</strong>
                        <p>Nombre consecutivo ("Electiva Profesional I, II..."), código especial "ELE-PROF-I, II..." y créditos de 1 dígito.</p>
                      </div>
                    </div>

                    <div className="form-group">
                      <label htmlFor="modal_elective_code">Código de la Electiva</label>
                      <input
                        id="modal_elective_code"
                        type="text"
                        placeholder="Vacío (se asignará ELE-PROF-I, II... automáticamente)"
                        value={electiveCode}
                        onChange={(e) => setElectiveCode(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="modal_elective_name">Nombre de la Electiva *</label>
                      <input
                        id="modal_elective_name"
                        type="text"
                        placeholder="Ej. Electiva Profesional I"
                        value={electiveName}
                        onChange={(e) => setElectiveName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="modal_elective_credits">Número de Créditos</label>
                      <input
                        id="modal_elective_credits"
                        type="text"
                        maxLength={1}
                        placeholder="3"
                        value={electiveCredits}
                        onChange={(e) => setElectiveCredits(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAddModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className={addMode === 'elective' ? 'btn-primary btn-purple' : 'btn-primary'}
                  disabled={
                    submitting ||
                    (addMode === 'catalog' && !selectedCourseForAdd) ||
                    (addMode === 'elective' && !electiveName.trim())
                  }
                >
                  {submitting
                    ? 'Guardando...'
                    : addMode === 'elective'
                    ? 'Crear Electiva y Asignar'
                    : 'Asignar al Semestre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Cambiar Asignatura de Semestre */}
      {movingCourse && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>Cambiar Semestre de Asignatura</h2>
              <button className="modal-close-btn" onClick={() => setMovingCourse(null)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleConfirmMoveSemester}>
              <div className="modal-body">
                <p>
                  Asignatura: <strong>{movingCourse.name_course}</strong> ({movingCourse.code_course}) • <strong>{movingCourse.credits ?? 0}</strong> {movingCourse.credits === 1 ? 'crédito' : 'créditos'}
                </p>
                <p className="text-muted">
                  Semestre actual: <strong>Semestre {movingCourse.semestre}</strong>
                </p>

                <div className="form-group" style={{ marginTop: '1rem' }}>
                  <label htmlFor="target-sem">Nuevo Semestre (1 - {totalSemesters}):</label>
                  <select
                    id="target-sem"
                    value={targetSemester}
                    onChange={(e) => setTargetSemester(parseInt(e.target.value, 10))}
                    className="select-input"
                  >
                    {Array.from({ length: totalSemesters }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>
                        Semestre {num} {num === movingCourse.semestre ? '(Actual)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setMovingCourse(null)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting || targetSemester === movingCourse.semestre}
                >
                  {submitting ? 'Guardando...' : 'Guardar Cambio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
