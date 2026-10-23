import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Filter,
  GraduationCap,
  Award,
  Mail,
  Phone,
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  AlertTriangle,
  FileText,
  Star,
  CheckCircle2,
  XCircle,
  Briefcase
} from 'lucide-react'
import {
  getCoordinadores,
  createCoordinador,
  updateCoordinador,
  deleteCoordinador,
  toggleCoordinadorActivo,
  getDocentes,
  createDocente,
  updateDocente,
  toggleDocenteEstado,
  getCategorias,
  getTiposContrato
} from '../services/academicService'

export default function PlantillaView({ programas = [], onShowToast }) {
  // --- Estados de datos ---
  const [coordinadores, setCoordinadores] = useState([])
  const [docentes, setDocentes] = useState([])
  const [categoriasList, setCategoriasList] = useState([])
  const [tiposContratoList, setTiposContratoList] = useState([])
  const [loading, setLoading] = useState(true)

  // --- Filtros y Navegación ---
  const [activeSubTab, setActiveSubTab] = useState('todos') // 'todos' | 'docentes' | 'coordinadores'
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPrograma, setFilterPrograma] = useState('')
  const [filterEstado, setFilterEstado] = useState('todos') // 'todos' | 'activo' | 'inactivo'
  const [filterCategoria, setFilterCategoria] = useState('')

  // --- Modales ---
  const [selectedProfile, setSelectedProfile] = useState(null)
  const [isCoordModalOpen, setIsCoordModalOpen] = useState(false)
  const [editingCoord, setEditingCoord] = useState(null)
  const [deletingCoord, setDeletingCoord] = useState(null)
  const [isDocenteModalOpen, setIsDocenteModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Formulario de Coordinador
  const [coordFormData, setCoordFormData] = useState({
    identificacion: '',
    nombre_completo: '',
    categoria: 'Auxiliar',
    tipo_contrato: 'Nombrado',
    correo_institucional: '',
    correo: '',
    telefono: '',
    code_program: '',
    activo: true,
  })

  // Formulario de Docente
  const [docenteFormData, setDocenteFormData] = useState({
    codigo: '',
    nombres: '',
    apellidos: '',
    tipo_documento: 'CC',
    numero_documento: '',
    correo_institucional: '',
    telefono: '',
    tipo_docente: 'NOMBRADO',
    categoria: 'AUXILIAR',
    code_program: '',
    evaluacion_periodo: '',
    evaluacion_valor: '',
  })

  // --- Carga inicial y recarga ---
  const loadAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [coordsRes, docsRes, catsRes, contratosRes] = await Promise.allSettled([
        getCoordinadores(),
        getDocentes(),
        getCategorias(),
        getTiposContrato(),
      ])

      if (coordsRes.status === 'fulfilled' && Array.isArray(coordsRes.value)) {
        setCoordinadores(coordsRes.value)
      }
      if (docsRes.status === 'fulfilled' && Array.isArray(docsRes.value)) {
        setDocentes(docsRes.value)
      }
      if (catsRes.status === 'fulfilled' && Array.isArray(catsRes.value)) {
        setCategoriasList(catsRes.value)
      }
      if (contratosRes.status === 'fulfilled' && Array.isArray(contratosRes.value)) {
        setTiposContratoList(contratosRes.value)
      }
    } catch (err) {
      console.error('Error al cargar plantilla académica:', err)
      if (onShowToast) onShowToast('Error al cargar datos de la plantilla', 'error')
    } finally {
      setLoading(false)
    }
  }, [onShowToast])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // --- Normalizar y Unificar Lista de Perfiles ---
  const unifiedList = useMemo(() => {
    const coordsUnified = coordinadores.map(c => ({
      id: `coord-${c.id}`,
      rawId: c.id,
      tipoRol: 'COORDINADOR',
      nombre: c.nombre_completo,
      identificacion: c.identificacion,
      tipoDocumento: 'CC',
      numeroDocumento: c.identificacion,
      codigo: null,
      correoInstitucional: c.correo_institucional,
      correoPersonal: c.correo,
      telefono: c.telefono,
      codeProgram: c.code_program,
      nameProgram: c.name_program,
      categoria: c.categoria || 'No asignada',
      tipoContrato: c.tipo_contrato || 'No asignado',
      activo: c.activo !== false,
      createdAt: c.created_at,
      rawObject: c,
    }))

    const docsUnified = docentes.map(d => ({
      id: `doc-${d.id}`,
      rawId: d.id,
      tipoRol: 'DOCENTE',
      nombre: `${d.nombres || ''} ${d.apellidos || ''}`.trim() || d.codigo,
      identificacion: d.numero_documento,
      tipoDocumento: d.tipo_documento || 'CC',
      numeroDocumento: d.numero_documento,
      codigo: d.codigo,
      correoInstitucional: d.correo_institucional,
      correoPersonal: null,
      telefono: d.telefono,
      codeProgram: d.code_program,
      nameProgram: d.nombre_programa || d.name_program,
      categoria: d.categoria || 'No asignada',
      tipoContrato: d.tipo_docente || 'No asignado',
      activo: d.estado !== false,
      fotoUrl: d.foto_url,
      evaluacionPeriodo: d.evaluacion_periodo,
      evaluacionValor: d.evaluacion_valor,
      createdAt: d.created_at,
      rawObject: d,
    }))

    return [...coordsUnified, ...docsUnified]
  }, [coordinadores, docentes])

  // --- Filtros combinados ---
  const filteredProfiles = useMemo(() => {
    return unifiedList.filter(item => {
      // Filtro por subpestaña (Rol)
      if (activeSubTab === 'docentes' && item.tipoRol !== 'DOCENTE') return false
      if (activeSubTab === 'coordinadores' && item.tipoRol !== 'COORDINADOR') return false

      // Filtro por Estado
      if (filterEstado === 'activo' && !item.activo) return false
      if (filterEstado === 'inactivo' && item.activo) return false

      // Filtro por Programa
      if (filterPrograma && item.codeProgram !== filterPrograma) return false

      // Filtro por Categoría
      if (filterCategoria && item.categoria.toLowerCase() !== filterCategoria.toLowerCase()) return false

      // Búsqueda textual
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase().trim()
        const matchName = item.nombre?.toLowerCase().includes(query)
        const matchId = item.identificacion?.toLowerCase().includes(query)
        const matchCode = item.codigo?.toLowerCase().includes(query)
        const matchEmailInst = item.correoInstitucional?.toLowerCase().includes(query)
        const matchEmailPers = item.correoPersonal?.toLowerCase().includes(query)
        const matchProg = item.nameProgram?.toLowerCase().includes(query)
        return matchName || matchId || matchCode || matchEmailInst || matchEmailPers || matchProg
      }

      return true
    })
  }, [unifiedList, activeSubTab, filterEstado, filterPrograma, filterCategoria, searchTerm])

  // --- Métricas de Resumen ---
  const metrics = useMemo(() => {
    const totalPersonal = unifiedList.length
    const totalDocs = docentes.length
    const docsActivos = docentes.filter(d => d.estado !== false).length
    const totalCoords = coordinadores.length
    const coordsActivos = coordinadores.filter(c => c.activo !== false).length
    const programsCovered = new Set(unifiedList.map(p => p.codeProgram).filter(Boolean)).size

    return {
      totalPersonal,
      totalDocs,
      docsActivos,
      totalCoords,
      coordsActivos,
      programsCovered,
    }
  }, [unifiedList, docentes, coordinadores])

  // --- Alternar Estado (Activo / Inactivo) ---
  const handleToggleEstado = async (profile, e) => {
    if (e) e.stopPropagation()
    const nuevoEstado = !profile.activo

    try {
      if (profile.tipoRol === 'COORDINADOR') {
        await toggleCoordinadorActivo(profile.rawId, nuevoEstado)
        setCoordinadores(prev =>
          prev.map(c => (c.id === profile.rawId ? { ...c, activo: nuevoEstado } : c))
        )
      } else {
        await toggleDocenteEstado(profile.rawId, nuevoEstado)
        setDocentes(prev =>
          prev.map(d => (d.id === profile.rawId ? { ...d, estado: nuevoEstado } : d))
        )
      }

      if (selectedProfile && selectedProfile.id === profile.id) {
        setSelectedProfile(prev => ({ ...prev, activo: nuevoEstado }))
      }

      if (onShowToast) {
        onShowToast(
          `${profile.tipoRol === 'COORDINADOR' ? 'Coordinador' : 'Docente'} marcado como ${
            nuevoEstado ? 'Activo' : 'Inactivo'
          }`,
          'success'
        )
      }
    } catch (err) {
      console.error('Error al alternar estado:', err)
      if (onShowToast) onShowToast('No se pudo actualizar el estado: ' + err.message, 'error')
    }
  }

  // --- Manejo de Coordinador: Abrir Modal Crear / Editar ---
  const handleOpenCoordModal = (coord = null) => {
    if (coord) {
      setEditingCoord(coord)
      setCoordFormData({
        identificacion: coord.identificacion || '',
        nombre_completo: coord.nombre_completo || '',
        categoria: coord.categoria || (categoriasList[0]?.nombre || 'Auxiliar'),
        tipo_contrato: coord.tipo_contrato || (tiposContratoList[0]?.nombre || 'Nombrado'),
        correo_institucional: coord.correo_institucional || '',
        correo: coord.correo || '',
        telefono: coord.telefono || '',
        code_program: coord.code_program || '',
        activo: coord.activo !== false,
      })
    } else {
      setEditingCoord(null)
      setCoordFormData({
        identificacion: '',
        nombre_completo: '',
        categoria: categoriasList[0]?.nombre || 'Auxiliar',
        tipo_contrato: tiposContratoList[0]?.nombre || 'Nombrado',
        correo_institucional: '',
        correo: '',
        telefono: '',
        code_program: programas[0]?.code_program || '',
        activo: true,
      })
    }
    setIsCoordModalOpen(true)
  }

  // Guardar Coordinador
  const handleSaveCoordinador = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const catObj = categoriasList.find(
        c => c.nombre?.toLowerCase() === coordFormData.categoria?.toLowerCase()
      )
      const tcObj = tiposContratoList.find(
        t => t.nombre?.toLowerCase() === coordFormData.tipo_contrato?.toLowerCase()
      )

      const payload = {
        ...coordFormData,
        id_categoria: catObj?.id || null,
        categoria: catObj?.nombre || coordFormData.categoria,
        id_tipo_contrato: tcObj?.id || null,
        tipo_contrato: tcObj?.nombre || coordFormData.tipo_contrato,
      }

      if (editingCoord) {
        const updated = await updateCoordinador(editingCoord.id, payload)
        setCoordinadores(prev => prev.map(c => (c.id === editingCoord.id ? updated : c)))
        if (onShowToast) onShowToast('Coordinador actualizado con éxito', 'success')
      } else {
        const created = await createCoordinador(payload)
        setCoordinadores(prev => [created, ...prev])
        if (onShowToast) onShowToast('Coordinador registrado correctamente', 'success')
      }

      setIsCoordModalOpen(false)
      setEditingCoord(null)
    } catch (err) {
      console.error('Error al guardar coordinador:', err)
      if (onShowToast) onShowToast(err.message || 'Error al guardar coordinador', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Eliminar Coordinador
  const handleDeleteCoordinador = async () => {
    if (!deletingCoord) return
    setSubmitting(true)
    try {
      await deleteCoordinador(deletingCoord.id)
      setCoordinadores(prev => prev.filter(c => c.id !== deletingCoord.id))
      if (onShowToast) onShowToast('Coordinador eliminado con éxito', 'success')
      setDeletingCoord(null)
    } catch (err) {
      console.error('Error al eliminar coordinador:', err)
      if (onShowToast) onShowToast(err.message || 'Error al eliminar', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // --- Manejo de Docente: Abrir Modal Crear ---
  const handleOpenDocenteModal = () => {
    setDocenteFormData({
      codigo: '',
      nombres: '',
      apellidos: '',
      tipo_documento: 'CC',
      numero_documento: '',
      correo_institucional: '',
      telefono: '',
      tipo_docente: 'NOMBRADO',
      categoria: 'AUXILIAR',
      code_program: programas[0]?.code_program || '',
      evaluacion_periodo: '',
      evaluacion_valor: '',
    })
    setIsDocenteModalOpen(true)
  }

  // Guardar Docente
  const handleSaveDocente = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const payload = {
        codigo: docenteFormData.codigo.trim(),
        nombres: docenteFormData.nombres.trim(),
        apellidos: docenteFormData.apellidos.trim(),
        tipo_documento: docenteFormData.tipo_documento,
        numero_documento: docenteFormData.numero_documento.trim(),
        correo_institucional: docenteFormData.correo_institucional.trim().toLowerCase(),
        telefono: docenteFormData.telefono.trim() || null,
        tipo_docente: docenteFormData.tipo_docente,
        categoria: docenteFormData.categoria,
        code_program: docenteFormData.code_program,
        evaluacion_periodo: docenteFormData.evaluacion_periodo.trim() || null,
        evaluacion_valor: docenteFormData.evaluacion_valor ? parseFloat(docenteFormData.evaluacion_valor) : null,
      }

      const created = await createDocente(payload)
      setDocentes(prev => [created, ...prev])
      if (onShowToast) onShowToast('Docente registrado exitosamente', 'success')
      setIsDocenteModalOpen(false)
    } catch (err) {
      console.error('Error al registrar docente:', err)
      if (onShowToast) onShowToast(err.message || 'Error al registrar docente', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Auxiliar para iniciales
  const getInitials = (name) => {
    if (!name) return '?'
    const parts = name.trim().split(/\s+/)
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase()
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }

  return (
    <div className="plantilla-container" style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      {/* 1. Header principal */}
      <div
        className="plantilla-header"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              color: '#f9fafb',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              margin: 0,
            }}
          >
            <Users size={28} style={{ color: '#9ca3af' }} />
            Plantilla de Personal Académico
          </h1>
          <p style={{ color: '#9ca3af', margin: '0.35rem 0 0 0', fontSize: '0.95rem' }}>
            Directorio y gestión unificada de perfiles de docentes y coordinadores registrados
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn-secondary"
            onClick={loadAllData}
            title="Recargar plantilla"
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#374151',
              color: '#f3f4f6',
              border: '1px solid #4b5563',
            }}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Actualizar</span>
          </button>

          <button
            className="btn-secondary"
            onClick={handleOpenDocenteModal}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#1e293b',
              color: '#93c5fd',
              border: '1px solid #3b82f6',
            }}
          >
            <Plus size={16} />
            <span>Nuevo Docente</span>
          </button>

          <button
            className="btn-primary"
            onClick={() => handleOpenCoordModal(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#475569',
              color: '#ffffff',
              border: '1px solid #64748b',
            }}
          >
            <Plus size={16} />
            <span>Nuevo Coordinador</span>
          </button>
        </div>
      </div>

      {/* 2. Tarjetas de Métricas (KPIs) en paleta de grises de alto contraste */}
      <div
        className="metrics-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem',
          marginBottom: '1.75rem',
        }}
      >
        {/* Total Personal */}
        <div
          style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#374151',
              color: '#e5e7eb',
              width: '46px',
              height: '46px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Users size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Total Plantilla
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f9fafb' }}>
              {metrics.totalPersonal}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Docentes y Coordinadores</span>
          </div>
        </div>

        {/* Docentes */}
        <div
          style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#1e3a5f',
              color: '#60a5fa',
              width: '46px',
              height: '46px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GraduationCap size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cuerpo Docente
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f9fafb' }}>
              {metrics.totalDocs}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#10b981' }}>
              {metrics.docsActivos} activos • {metrics.totalDocs - metrics.docsActivos} inactivos
            </span>
          </div>
        </div>

        {/* Coordinadores */}
        <div
          style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#3b2d54',
              color: '#c084fc',
              width: '46px',
              height: '46px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Award size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Coordinación
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f9fafb' }}>
              {metrics.totalCoords}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#10b981' }}>
              {metrics.coordsActivos} activos • {metrics.totalCoords - metrics.coordsActivos} inactivos
            </span>
          </div>
        </div>

        {/* Programas con Cobertura */}
        <div
          style={{
            backgroundColor: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '10px',
            padding: '1.1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <div
            style={{
              backgroundColor: '#374151',
              color: '#d1d5db',
              width: '46px',
              height: '46px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BookOpen size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Programas Vinculados
            </span>
            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f9fafb' }}>
              {metrics.programsCovered}
            </div>
            <span style={{ fontSize: '0.78rem', color: '#9ca3af' }}>Con personal asignado</span>
          </div>
        </div>
      </div>

      {/* 3. Barra de Navegación por Sub-Pestañas (Todos | Docentes | Coordinadores) */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #374151',
          marginBottom: '1.25rem',
          gap: '0.5rem',
        }}
      >
        <button
          onClick={() => setActiveSubTab('todos')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'todos' ? '2px solid #e5e7eb' : '2px solid transparent',
            color: activeSubTab === 'todos' ? '#f9fafb' : '#9ca3af',
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Users size={18} />
          <span>Toda la Plantilla ({unifiedList.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('docentes')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'docentes' ? '2px solid #60a5fa' : '2px solid transparent',
            color: activeSubTab === 'docentes' ? '#93c5fd' : '#9ca3af',
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <GraduationCap size={18} />
          <span>Docentes ({docentes.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('coordinadores')}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeSubTab === 'coordinadores' ? '2px solid #c084fc' : '2px solid transparent',
            color: activeSubTab === 'coordinadores' ? '#d8b4fe' : '#9ca3af',
            padding: '0.75rem 1.25rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontSize: '0.95rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <Award size={18} />
          <span>Coordinadores ({coordinadores.length})</span>
        </button>
      </div>

      {/* 4. Barra de Filtros y Búsqueda */}
      <div
        style={{
          backgroundColor: '#1f2937',
          border: '1px solid #374151',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '1rem',
          alignItems: 'center',
        }}
      >
        {/* Buscador */}
        <div style={{ flex: '1 1 280px', position: 'relative' }}>
          <Search
            size={18}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#9ca3af',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre, documento, código o correo..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem 0.55rem 2.4rem',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '0.9rem',
            }}
          />
        </div>

        {/* Filtro por Programa */}
        <div style={{ flex: '1 1 200px' }}>
          <select
            value={filterPrograma}
            onChange={(e) => setFilterPrograma(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '0.9rem',
            }}
          >
            <option value="">Todos los Programas</option>
            {programas.map(p => (
              <option key={p.code_program} value={p.code_program}>
                {p.name_program} ({p.code_program})
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Estado */}
        <div style={{ flex: '0 1 160px' }}>
          <select
            value={filterEstado}
            onChange={(e) => setFilterEstado(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '0.9rem',
            }}
          >
            <option value="todos">Todos los Estados</option>
            <option value="activo">Solo Activos</option>
            <option value="inactivo">Solo Inactivos</option>
          </select>
        </div>

        {/* Filtro por Categoría */}
        <div style={{ flex: '0 1 160px' }}>
          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: '#111827',
              border: '1px solid #374151',
              borderRadius: '6px',
              color: '#f9fafb',
              fontSize: '0.9rem',
            }}
          >
            <option value="">Todas las Categorías</option>
            {categoriasList.map(cat => (
              <option key={cat.id || cat.nombre} value={cat.nombre}>
                {cat.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Reset filtros */}
        {(searchTerm || filterPrograma || filterEstado !== 'todos' || filterCategoria) && (
          <button
            onClick={() => {
              setSearchTerm('')
              setFilterPrograma('')
              setFilterEstado('todos')
              setFilterCategoria('')
            }}
            style={{
              backgroundColor: '#374151',
              border: '1px solid #4b5563',
              color: '#e5e7eb',
              padding: '0.55rem 0.85rem',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.85rem',
            }}
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* 5. Contador de Resultados */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.88rem', color: '#9ca3af' }}>
          Mostrando <strong>{filteredProfiles.length}</strong> de {unifiedList.length} registros en plantilla
        </span>
      </div>

      {/* 6. Listado / Grid de Tarjetas de Perfil */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#9ca3af' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
          <p>Cargando información de plantilla docente y coordinadores...</p>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div
          style={{
            backgroundColor: '#1f2937',
            border: '1px dashed #374151',
            borderRadius: '10px',
            padding: '3rem',
            textAlign: 'center',
            color: '#9ca3af',
          }}
        >
          <UserX size={48} style={{ margin: '0 auto 1rem auto', opacity: 0.5 }} />
          <h3 style={{ color: '#f3f4f6', margin: '0 0 0.5rem 0' }}>No se encontraron registros</h3>
          <p style={{ margin: 0 }}>
            {searchTerm || filterPrograma || filterEstado !== 'todos'
              ? 'Intenta ajustar los filtros de búsqueda para ver más resultados.'
              : 'Aún no hay personal registrado en este módulo.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {filteredProfiles.map(profile => {
            const isCoord = profile.tipoRol === 'COORDINADOR'
            const roleColor = isCoord ? '#c084fc' : '#60a5fa'
            const roleBg = isCoord ? '#3b2d54' : '#1e3a5f'

            return (
              <div
                key={profile.id}
                style={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '10px',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
                  transition: 'transform 0.15s ease, border-color 0.15s ease',
                }}
              >
                <div>
                  {/* Fila superior: Avatar, Nombre, Badges de Rol y Estado */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.85rem', marginBottom: '1rem' }}>
                    {/* Avatar con iniciales */}
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '50%',
                        backgroundColor: roleBg,
                        color: roleColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: '1rem',
                        flexShrink: 0,
                        border: `1px solid ${roleColor}40`,
                      }}
                    >
                      {getInitials(profile.nombre)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: '0.7rem',
                            fontWeight: 700,
                            letterSpacing: '0.05em',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            backgroundColor: roleBg,
                            color: roleColor,
                          }}
                        >
                          {isCoord ? 'COORDINADOR' : 'DOCENTE'}
                        </span>

                        {/* Botón interactivo de Estado (Activo / Inactivo) */}
                        <button
                          onClick={(e) => handleToggleEstado(profile, e)}
                          title="Haga clic para alternar estado"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.3rem',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            padding: '0.15rem 0.5rem',
                            borderRadius: '12px',
                            border: profile.activo ? '1px solid #059669' : '1px solid #4b5563',
                            backgroundColor: profile.activo ? '#064e3b' : '#374151',
                            color: profile.activo ? '#34d399' : '#9ca3af',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              width: '6px',
                              height: '6px',
                              borderRadius: '50%',
                              backgroundColor: profile.activo ? '#10b981' : '#9ca3af',
                            }}
                          ></span>
                          <span>{profile.activo ? 'Activo' : 'Inactivo'}</span>
                        </button>
                      </div>

                      <h3
                        style={{
                          margin: '0.35rem 0 0 0',
                          fontSize: '1.05rem',
                          fontWeight: 600,
                          color: '#f9fafb',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={profile.nombre}
                      >
                        {profile.nombre}
                      </h3>
                    </div>
                  </div>

                  {/* Datos del Perfil */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem',
                      fontSize: '0.85rem',
                      color: '#d1d5db',
                      backgroundColor: '#111827',
                      padding: '0.85rem',
                      borderRadius: '8px',
                      border: '1px solid #374151',
                      marginBottom: '1rem',
                    }}
                  >
                    {/* Documento e Identificación */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Documento:</span>
                      <span style={{ fontWeight: 500, color: '#f3f4f6' }}>
                        {profile.tipoDocumento} {profile.identificacion}
                      </span>
                    </div>

                    {/* Código si es Docente */}
                    {profile.codigo && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#9ca3af' }}>Cód. Docente:</span>
                        <span style={{ fontWeight: 500, color: '#93c5fd' }}>{profile.codigo}</span>
                      </div>
                    )}

                    {/* Programa Académico */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem' }}>
                      <span style={{ color: '#9ca3af', flexShrink: 0 }}>Programa:</span>
                      <span
                        style={{
                          fontWeight: 500,
                          color: '#f3f4f6',
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={profile.nameProgram || 'Sin asignar'}
                      >
                        {profile.nameProgram || 'Sin programa asignado'}
                      </span>
                    </div>

                    {/* Categoría y Contrato */}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Categoría:</span>
                      <span
                        style={{
                          fontWeight: 500,
                          padding: '0.05rem 0.4rem',
                          borderRadius: '4px',
                          backgroundColor: '#374151',
                          color: '#e5e7eb',
                          fontSize: '0.78rem',
                        }}
                      >
                        {profile.categoria}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#9ca3af' }}>Contrato / Tipo:</span>
                      <span style={{ fontWeight: 500, color: '#e5e7eb', fontSize: '0.82rem' }}>
                        {profile.tipoContrato}
                      </span>
                    </div>

                    {/* Correo institucional */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.2rem' }}>
                      <Mail size={14} style={{ color: '#9ca3af', flexShrink: 0 }} />
                      <a
                        href={`mailto:${profile.correoInstitucional}`}
                        style={{
                          color: '#93c5fd',
                          textDecoration: 'none',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={profile.correoInstitucional}
                      >
                        {profile.correoInstitucional}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid #374151',
                    gap: '0.5rem',
                  }}
                >
                  <button
                    className="btn-secondary"
                    onClick={() => setSelectedProfile(profile)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                      padding: '0.4rem 0.75rem',
                      fontSize: '0.82rem',
                      backgroundColor: '#374151',
                      color: '#f9fafb',
                      border: '1px solid #4b5563',
                    }}
                  >
                    <Eye size={14} />
                    <span>Ver Perfil</span>
                  </button>

                  {/* Acciones adicionales si es Coordinador */}
                  {isCoord && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button
                        className="btn-secondary"
                        onClick={() => handleOpenCoordModal(profile.rawObject)}
                        title="Editar coordinador"
                        style={{
                          padding: '0.4rem 0.6rem',
                          backgroundColor: '#374151',
                          color: '#e5e7eb',
                          border: '1px solid #4b5563',
                        }}
                      >
                        <Edit2 size={14} />
                      </button>

                      
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL DE PERFIL COMPLETO (CONSULTA DETALLADA)                         */}
      {/* ========================================================================= */}
      {selectedProfile && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            style={{
              maxWidth: '650px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#f9fafb',
              borderRadius: '12px',
            }}
          >
            {/* Header del Modal */}
            <div
              className="modal-header"
              style={{
                borderBottom: '1px solid #374151',
                padding: '1.25rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#1f2937',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                <div
                  style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    backgroundColor: selectedProfile.tipoRol === 'COORDINADOR' ? '#3b2d54' : '#1e3a5f',
                    color: selectedProfile.tipoRol === 'COORDINADOR' ? '#c084fc' : '#60a5fa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                  }}
                >
                  {getInitials(selectedProfile.nombre)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#f9fafb' }}>
                    {selectedProfile.nombre}
                  </h3>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.2rem', alignItems: 'center' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.45rem',
                        borderRadius: '4px',
                        backgroundColor: selectedProfile.tipoRol === 'COORDINADOR' ? '#3b2d54' : '#1e3a5f',
                        color: selectedProfile.tipoRol === 'COORDINADOR' ? '#c084fc' : '#60a5fa',
                      }}
                    >
                      {selectedProfile.tipoRol}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: selectedProfile.activo ? '#34d399' : '#9ca3af',
                      }}
                    >
                      • {selectedProfile.activo ? 'Registrado y Activo' : 'Inactivo en el Sistema'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                className="btn-close"
                onClick={() => setSelectedProfile(null)}
                style={{ color: '#9ca3af', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {/* Cuerpo del Modal con detalles */}
            <div className="modal-body" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Sección 1: Identificación y Datos Básicos */}
              <div>
                <h4
                  style={{
                    fontSize: '0.85rem',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.6rem',
                    borderBottom: '1px solid #374151',
                    paddingBottom: '0.35rem',
                  }}
                >
                  Datos de Identificación
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.9rem' }}>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.78rem' }}>Tipo y Número de Documento</span>
                    <strong style={{ color: '#f3f4f6' }}>
                      {selectedProfile.tipoDocumento} {selectedProfile.identificacion}
                    </strong>
                  </div>
                  {selectedProfile.codigo && (
                    <div>
                      <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.78rem' }}>Código Docente Univalle</span>
                      <strong style={{ color: '#93c5fd' }}>{selectedProfile.codigo}</strong>
                    </div>
                  )}
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.78rem' }}>Estado en el Sistema</span>
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.15rem 0.5rem',
                        borderRadius: '6px',
                        backgroundColor: selectedProfile.activo ? '#064e3b' : '#374151',
                        color: selectedProfile.activo ? '#34d399' : '#9ca3af',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        marginTop: '0.2rem',
                      }}
                    >
                      {selectedProfile.activo ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                      {selectedProfile.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sección 2: Vinculación Académica */}
              <div>
                <h4
                  style={{
                    fontSize: '0.85rem',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.6rem',
                    borderBottom: '1px solid #374151',
                    paddingBottom: '0.35rem',
                  }}
                >
                  Vinculación Académica y Contratación
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.85rem', fontSize: '0.9rem' }}>
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.78rem' }}>Programa Académico</span>
                    <strong style={{ color: '#f3f4f6' }}>
                      {selectedProfile.nameProgram
                        ? `${selectedProfile.nameProgram} (${selectedProfile.codeProgram})`
                        : 'Sin programa académico asignado'}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.78rem' }}>Categoría (Escalafón)</span>
                    <strong style={{ color: '#f3f4f6' }}>{selectedProfile.categoria}</strong>
                  </div>
                  <div>
                    <span style={{ color: '#9ca3af', display: 'block', fontSize: '0.78rem' }}>Tipo de Contrato / Dedicación</span>
                    <strong style={{ color: '#f3f4f6' }}>{selectedProfile.tipoContrato}</strong>
                  </div>
                </div>
              </div>

              {/* Sección 3: Contacto */}
              <div>
                <h4
                  style={{
                    fontSize: '0.85rem',
                    color: '#9ca3af',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginBottom: '0.6rem',
                    borderBottom: '1px solid #374151',
                    paddingBottom: '0.35rem',
                  }}
                >
                  Información de Contacto
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.9rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Mail size={16} style={{ color: '#9ca3af' }} />
                    <span style={{ color: '#9ca3af' }}>Institucional:</span>
                    <a
                      href={`mailto:${selectedProfile.correoInstitucional}`}
                      style={{ color: '#93c5fd', textDecoration: 'none' }}
                    >
                      {selectedProfile.correoInstitucional}
                    </a>
                  </div>
                  {selectedProfile.correoPersonal && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Mail size={16} style={{ color: '#9ca3af' }} />
                      <span style={{ color: '#9ca3af' }}>Personal:</span>
                      <a
                        href={`mailto:${selectedProfile.correoPersonal}`}
                        style={{ color: '#93c5fd', textDecoration: 'none' }}
                      >
                        {selectedProfile.correoPersonal}
                      </a>
                    </div>
                  )}
                  {selectedProfile.telefono && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Phone size={16} style={{ color: '#9ca3af' }} />
                      <span style={{ color: '#9ca3af' }}>Teléfono:</span>
                      <a
                        href={`tel:${selectedProfile.telefono}`}
                        style={{ color: '#93c5fd', textDecoration: 'none' }}
                      >
                        {selectedProfile.telefono}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Sección 4: Evaluación Docente (Solo para Docentes) */}
              {selectedProfile.tipoRol === 'DOCENTE' && (
                <div>
                  <h4
                    style={{
                      fontSize: '0.85rem',
                      color: '#9ca3af',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      marginBottom: '0.6rem',
                      borderBottom: '1px solid #374151',
                      paddingBottom: '0.35rem',
                    }}
                  >
                    Evaluación Docente Registrada
                  </h4>
                  {selectedProfile.evaluacionPeriodo ? (
                    <div
                      style={{
                        backgroundColor: '#111827',
                        border: '1px solid #374151',
                        borderRadius: '8px',
                        padding: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block' }}>Período Académico</span>
                        <strong style={{ color: '#f3f4f6' }}>{selectedProfile.evaluacionPeriodo}</strong>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{ color: '#9ca3af', fontSize: '0.8rem', display: 'block' }}>Calificación</span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: '#fbbf24' }}>
                          <Star size={18} fill="#fbbf24" />
                          <strong style={{ fontSize: '1.25rem' }}>
                            {selectedProfile.evaluacionValor ? Number(selectedProfile.evaluacionValor).toFixed(2) : 'N/A'}
                          </strong>
                          <span style={{ color: '#9ca3af', fontSize: '0.85rem' }}>/ 5.0</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: '#9ca3af', fontSize: '0.85rem', margin: 0, fontStyle: 'italic' }}>
                      No registra evaluaciones docentes en el periodo actual.
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Footer del Modal */}
            <div className="modal-footer" style={{ borderTop: '1px solid #374151', backgroundColor: '#1f2937',
                padding: '1rem 1.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#1f2937',
              }}
            >
              <button
                className="btn-secondary"
                onClick={(e) => handleToggleEstado(selectedProfile, e)}
                style={{
                  backgroundColor: selectedProfile.activo ? '#374151' : '#064e3b',
                  color: selectedProfile.activo ? '#e5e7eb' : '#34d399',
                  border: '1px solid #4b5563',
                }}
              >
                {selectedProfile.activo ? 'Marcar como Inactivo' : 'Activar Perfil'}
              </button>

              <button
                className="btn-primary"
                onClick={() => setSelectedProfile(null)}
                style={{ backgroundColor: '#475569', border: '1px solid #64748b' }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL DE CREACIÓN / EDICIÓN DE COORDINADOR                             */}
      {/* ========================================================================= */}
      {isCoordModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            style={{
              maxWidth: '560px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#f9fafb',
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #374151' }}>
              <h3 style={{ margin: 0, color: '#f9fafb' }}>
                {editingCoord ? 'Editar Coordinador de Programa' : 'Registrar Nuevo Coordinador'}
              </h3>
              <button
                className="btn-close"
                onClick={() => setIsCoordModalOpen(false)}
                style={{ color: '#9ca3af', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCoordinador}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Identificación */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Identificación / Cédula *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCoord}
                    placeholder="Ej. 1118234567"
                    value={coordFormData.identificacion}
                    onChange={(e) => setCoordFormData({ ...coordFormData, identificacion: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                  {editingCoord && (
                    <small style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                      La identificación no se puede modificar.
                    </small>
                  )}
                </div>

                {/* Nombre completo */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Dra. María Rodríguez Pérez"
                    value={coordFormData.nombre_completo}
                    onChange={(e) => setCoordFormData({ ...coordFormData, nombre_completo: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                </div>

                {/* Fila doble: Categoría y Tipo de Contrato */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Categoría *</label>
                    <select
                      value={coordFormData.categoria}
                      onChange={(e) => setCoordFormData({ ...coordFormData, categoria: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    >
                      {categoriasList.map(cat => (
                        <option key={cat.id || cat.nombre} value={cat.nombre}>
                          {cat.nombre}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Tipo de Contrato *</label>
                    <select
                      value={coordFormData.tipo_contrato}
                      onChange={(e) => setCoordFormData({ ...coordFormData, tipo_contrato: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    >
                      {tiposContratoList.map(tc => (
                        <option key={tc.id || tc.nombre} value={tc.nombre}>
                          {tc.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Correo institucional */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Correo Institucional *</label>
                  <input
                    type="email"
                    required
                    placeholder="Ej. maria.rodriguez@correounivalle.edu.co"
                    value={coordFormData.correo_institucional}
                    onChange={(e) => setCoordFormData({ ...coordFormData, correo_institucional: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                </div>

                {/* Correo personal */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Correo Personal / Alternativo</label>
                  <input
                    type="email"
                    placeholder="Ej. maria.rodriguez@gmail.com"
                    value={coordFormData.correo}
                    onChange={(e) => setCoordFormData({ ...coordFormData, correo: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                </div>

                {/* Teléfono */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Teléfono de Contacto</label>
                  <input
                    type="text"
                    placeholder="Ej. +57 315 123 4567"
                    value={coordFormData.telefono}
                    onChange={(e) => setCoordFormData({ ...coordFormData, telefono: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                </div>

                {/* Programa vinculado */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Programa Académico Vinculado</label>
                  <select
                    value={coordFormData.code_program}
                    onChange={(e) => setCoordFormData({ ...coordFormData, code_program: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  >
                    <option value="">-- Sin programa asignado --</option>
                    {programas.map(p => (
                      <option key={p.code_program} value={p.code_program}>
                        {p.name_program} ({p.code_program})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Activo checkbox */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.4rem' }}>
                  <input
                    type="checkbox"
                    id="coord-chk-activo"
                    checked={coordFormData.activo}
                    onChange={(e) => setCoordFormData({ ...coordFormData, activo: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="coord-chk-activo" style={{ cursor: 'pointer', fontSize: '0.9rem', color: '#e5e7eb' }}>
                    Coordinador activo en el sistema
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #374151', backgroundColor: '#1f2937' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCoordModalOpen(false)}
                  disabled={submitting}
                  style={{ backgroundColor: '#374151', border: '1px solid #4b5563', color: '#e5e7eb' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  style={{ backgroundColor: '#475569', border: '1px solid #64748b' }}
                >
                  {submitting ? 'Guardando...' : editingCoord ? 'Guardar Cambios' : 'Registrar Coordinador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 9. MODAL DE CREACIÓN DE DOCENTE                                           */}
      {/* ========================================================================= */}
      {isDocenteModalOpen && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            style={{
              maxWidth: '600px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#f9fafb',
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #374151' }}>
              <h3 style={{ margin: 0, color: '#f9fafb' }}>Registrar Nuevo Docente</h3>
              <button
                className="btn-close"
                onClick={() => setIsDocenteModalOpen(false)}
                style={{ color: '#9ca3af', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveDocente}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {/* Código Docente */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Código Docente *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. DOC-2024-001"
                    value={docenteFormData.codigo}
                    onChange={(e) => setDocenteFormData({ ...docenteFormData, codigo: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                </div>

                {/* Nombres y Apellidos */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Nombres *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Juan Carlos"
                      value={docenteFormData.nombres}
                      onChange={(e) => setDocenteFormData({ ...docenteFormData, nombres: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Apellidos *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Gómez Pérez"
                      value={docenteFormData.apellidos}
                      onChange={(e) => setDocenteFormData({ ...docenteFormData, apellidos: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    />
                  </div>
                </div>

                {/* Tipo y Número de Documento */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Tipo Doc. *</label>
                    <select
                      value={docenteFormData.tipo_documento}
                      onChange={(e) => setDocenteFormData({ ...docenteFormData, tipo_documento: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    >
                      <option value="CC">CC</option>
                      <option value="CE">CE</option>
                      <option value="PP">PP</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Número de Documento *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. 1118234567"
                      value={docenteFormData.numero_documento}
                      onChange={(e) => setDocenteFormData({ ...docenteFormData, numero_documento: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    />
                  </div>
                </div>

                {/* Correo institucional (@correounivalle.edu.co) */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Correo Institucional Univalle *</label>
                  <input
                    type="email"
                    required
                    placeholder="Ej. juan.gomez@correounivalle.edu.co"
                    value={docenteFormData.correo_institucional}
                    onChange={(e) => setDocenteFormData({ ...docenteFormData, correo_institucional: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                  <small style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                    Debe pertenecer al dominio @correounivalle.edu.co
                  </small>
                </div>

                {/* Teléfono */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Teléfono</label>
                  <input
                    type="text"
                    placeholder="Ej. +57 312 987 6543"
                    value={docenteFormData.telefono}
                    onChange={(e) => setDocenteFormData({ ...docenteFormData, telefono: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  />
                </div>

                {/* Tipo de Docente y Categoría */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Tipo de Docente *</label>
                    <select
                      value={docenteFormData.tipo_docente}
                      onChange={(e) => setDocenteFormData({ ...docenteFormData, tipo_docente: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    >
                      <option value="NOMBRADO">NOMBRADO</option>
                      <option value="HORA_CATEDRA">HORA CÁTEDRA</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label style={{ color: '#e5e7eb' }}>Categoría (Escalafón) *</label>
                    <select
                      value={docenteFormData.categoria}
                      onChange={(e) => setDocenteFormData({ ...docenteFormData, categoria: e.target.value })}
                      style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                    >
                      <option value="AUXILIAR">AUXILIAR</option>
                      <option value="ASISTENTE">ASISTENTE</option>
                      <option value="ASOCIADO">ASOCIADO</option>
                      <option value="TITULAR">TITULAR</option>
                    </select>
                  </div>
                </div>

                {/* Programa de Adscripción */}
                <div className="form-group">
                  <label style={{ color: '#e5e7eb' }}>Programa de Adscripción *</label>
                  <select
                    required
                    value={docenteFormData.code_program}
                    onChange={(e) => setDocenteFormData({ ...docenteFormData, code_program: e.target.value })}
                    style={{ backgroundColor: '#111827', border: '1px solid #374151', color: '#f9fafb' }}
                  >
                    <option value="">-- Seleccionar Programa --</option>
                    {programas.map(p => (
                      <option key={p.code_program} value={p.code_program}>
                        {p.name_program} ({p.code_program})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid #374151', backgroundColor: '#1f2937' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsDocenteModalOpen(false)}
                  disabled={submitting}
                  style={{ backgroundColor: '#374151', border: '1px solid #4b5563', color: '#e5e7eb' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                  style={{ backgroundColor: '#3b82f6', border: '1px solid #2563eb' }}
                >
                  {submitting ? 'Registrando...' : 'Registrar Docente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 10. MODAL DE ELIMINACIÓN DE COORDINADOR                                    */}
      {/* ========================================================================= */}
      {deletingCoord && (
        <div className="modal-backdrop">
          <div
            className="modal-card"
            style={{
              maxWidth: '440px',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#f9fafb',
            }}
          >
            <div className="modal-header" style={{ borderBottom: '1px solid #374151' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f87171', margin: 0 }}>
                <AlertTriangle size={20} /> Eliminar Coordinador
              </h3>
              <button
                className="btn-close"
                onClick={() => setDeletingCoord(null)}
                style={{ color: '#9ca3af', background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <div className="modal-body" style={{ padding: '1.5rem' }}>
              <p style={{ margin: 0 }}>
                ¿Estás seguro de que deseas eliminar al coordinador{' '}
                <strong>{deletingCoord.nombre_completo}</strong> (ID: {deletingCoord.identificacion})?
              </p>
            </div>
            <div className="modal-footer" style={{ borderTop: '1px solid #374151', backgroundColor: '#1f2937' }}>
              <button
                className="btn-secondary"
                onClick={() => setDeletingCoord(null)}
                disabled={submitting}
                style={{ backgroundColor: '#374151', border: '1px solid #4b5563', color: '#e5e7eb' }}
              >
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={handleDeleteCoordinador}
                disabled={submitting}
                style={{ backgroundColor: '#dc2626', border: '1px solid #b91c1c' }}
              >
                {submitting ? 'Eliminando...' : 'Sí, Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
