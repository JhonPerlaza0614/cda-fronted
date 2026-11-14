import React, { useState, useEffect } from 'react'
import { Plus, Search, Edit2, Trash2, BookOpen, Layers, AlertTriangle, Award, Building2 , UserCheck} from 'lucide-react'
import { createPrograma, updatePrograma, deletePrograma, getFacultades, createFacultad, getCoordinadores } from '../../services/academicService'

export default function ProgramasView({ 
  programas, 
  pensumList, 
  onRefresh, 
  onShowToast, 
  onSelectProgramForPensum,
  canAssignCoordinator = false,
  // HU-037: programa cuyo modal de edición se abre al entrar (asignar o cambiar coordinador)
  initialEditCode = null,
  onInitialEditHandled
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingProgram, setEditingProgram] = useState(null)
  const [deletingProgram, setDeletingProgram] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [facultadesList, setFacultadesList] = useState([])
  const [coordinadoresList, setCoordinadoresList] = useState([])
  const [loadingCoordinadores, setLoadingCoordinadores] = useState(false)
  const [currentCoordinatorId, setCurrentCoordinatorId] = useState(null)
  const [assignedCoordinator, setAssignedCoordinator] = useState(null)

  // Modal independiente para crear facultad (al lado de Nuevo Programa)
  const [isFacultadModalOpen, setIsFacultadModalOpen] = useState(false)
  const [newFacultadName, setNewFacultadName] = useState('')
  const [newFacultadDesc, setNewFacultadDesc] = useState('')
  const [addingFacultadSubmitting, setAddingFacultadSubmitting] = useState(false)

  // Cargar facultades
  useEffect(() => {
    getFacultades()
      .then(data => {
        if (data && data.length > 0) setFacultadesList(data)
      })
      .catch(err => console.warn('Error al cargar facultades:', err))

    // La lista de coordinadores es solo del administrador (GET /api/coordinadores responde 403 al coordinador)
    if (!canAssignCoordinator) return
    getCoordinadores()
      .then(data => {
        if (data && Array.isArray(data)) setCoordinadoresList(data)
      })
      .catch(err => console.warn('Error al cargar coordinadores:', err))
  }, [canAssignCoordinator])

  // Form state
  const [formData, setFormData] = useState({
    code_program: '',
    name_program: '',
    numero_resolucion: '',
    numero_semestre: 10,
    id_facultad_programa: '',
    apertura: '',
    id_coordinador_nuevo: '',
  })

  // Filtered programs
  const filteredProgramas = programas.filter(p => 
    p.code_program.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.name_program.toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Count courses in pensum for each program
  const getCoursesCount = (code_program) => {
    return pensumList.filter(item => item.code_program === code_program).length
  }

  // Total credits in pensum for each program
  const getProgramCredits = (code_program) => {
    return pensumList
      .filter(item => item.code_program === code_program)
      .reduce((sum, item) => sum + (item.credits || 0), 0)
  }

  const handleOpenFacultadModal = () => {
    setNewFacultadName('')
    setNewFacultadDesc('')
    setIsFacultadModalOpen(true)
  }

  const handleCreateNewFacultadInDb = async (e) => {
    if (e) e.preventDefault()
    if (!newFacultadName.trim()) {
      onShowToast('Ingresa el nombre de la nueva facultad', 'error')
      return
    }

    setAddingFacultadSubmitting(true)
    try {
      await createFacultad({ 
        nombre: newFacultadName.trim(),
        descripcion: newFacultadDesc.trim()
      })
      onShowToast(`Facultad "${newFacultadName.trim()}" creada exitosamente`, 'success')
      setNewFacultadName('')
      setNewFacultadDesc('')
      setIsFacultadModalOpen(false)
      
      const updatedFacultades = await getFacultades()
      if (updatedFacultades) setFacultadesList(updatedFacultades)
    } catch (err) {
      onShowToast(`Error al guardar facultad: ${err.message}`, 'error')
    } finally {
      setAddingFacultadSubmitting(false)
    }
  }

  const handleOpenCreateModal = () => {
    setEditingProgram(null)
    setAssignedCoordinator(null)
    setFormData({
      code_program: '',
      name_program: '',
      numero_resolucion: '',
      numero_semestre: 10,
      id_facultad_programa: '',
      apertura: '',
      id_coordinador_nuevo: '',
    })
    setCurrentCoordinatorId(null)
    setLoadingCoordinadores(false)
    setIsModalOpen(true)
  }

  const handleOpenEditModal = async (prog) => {
    setEditingProgram(prog)
    setFormData({
      code_program: prog.code_program,
      name_program: prog.name_program,
      numero_resolucion: prog.numero_resolucion || '',
      numero_semestre: prog.numero_semestre !== undefined && prog.numero_semestre !== null ? prog.numero_semestre : 10,
      id_facultad_programa: prog.id_facultad_programa ? String(prog.id_facultad_programa) : '',
      apertura: prog.apertura || '',
      id_coordinador_nuevo: '',
    })

    // Localizar coordinador asignado de inmediato si ya está en memoria
    const matchMem = coordinadoresList.find(c => String(c.code_program || '').trim().toUpperCase() === String(prog.code_program || '').trim().toUpperCase())
    if (matchMem) {
      setAssignedCoordinator(matchMem)
    } else {
      setAssignedCoordinator(null)
    }

    setIsModalOpen(true)

    // Si la lista aún no estaba cargada en memoria, consultar el endpoint
    if (canAssignCoordinator && coordinadoresList.length === 0) {
      setLoadingCoordinadores(true)
      try {
        const data = await getCoordinadores()
        const lista = Array.isArray(data) ? data : []
        setCoordinadoresList(lista)
        const asignado = lista.find(c => String(c.code_program || '').trim().toUpperCase() === String(prog.code_program || '').trim().toUpperCase())
        setAssignedCoordinator(asignado || null)
      } catch (err) {
        console.error('Error al cargar coordinador del programa:', err)
      } finally {
        setLoadingCoordinadores(false)
      }
    }
  }

  // HU-037: abre el modal una sola vez cuando el programa pedido ya está en la lista
  useEffect(() => {
    if (!initialEditCode) return
    const prog = programas.find(p => p.code_program === initialEditCode)
    if (prog) handleOpenEditModal(prog)
    onInitialEditHandled?.()
  }, [initialEditCode, programas, handleOpenEditModal, onInitialEditHandled])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.name_program.trim()) {
      onShowToast('El nombre del programa es obligatorio', 'error')
      return
    }

    const numeroResolucion = formData.numero_resolucion.trim()
    if (!numeroResolucion) {
      onShowToast('El número de resolución es obligatorio', 'error')
      return
    }

    if (numeroResolucion.length > 15) {
      onShowToast('El número de resolución no puede superar 15 caracteres', 'error')
      return
    }

    const numSemestres = parseInt(formData.numero_semestre, 10)
    if (isNaN(numSemestres) || numSemestres < 1 || numSemestres > 20) {
      onShowToast('El número de semestres debe estar entre 1 y 20', 'error')
      return
    }

    setSubmitting(true)
    try {
      if (editingProgram) {
        await updatePrograma(editingProgram.code_program, {
          name_program: formData.name_program,
          numero_semestre: numSemestres,
          numero_resolucion: numeroResolucion,
          id_facultad_programa: formData.id_facultad_programa ? parseInt(formData.id_facultad_programa, 10) : null,
          apertura: formData.apertura || null,
        })
        onShowToast('Programa actualizado correctamente', 'success')
      } else {
        if (!formData.code_program.trim()) {
          onShowToast('El código del programa es obligatorio', 'error')
          setSubmitting(false)
          return
        }
        await createPrograma({
          ...formData,
          numero_resolucion: numeroResolucion,
          numero_semestre: numSemestres,
          id_facultad_programa: formData.id_facultad_programa ? parseInt(formData.id_facultad_programa, 10) : null,
          apertura: formData.apertura || null,
        })
        onShowToast('Programa creado exitosamente', 'success')
      }
      setIsModalOpen(false)
      onRefresh()
    } catch (err) {
      onShowToast(`Error: ${err.message || 'No se pudo guardar el programa'}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingProgram) return
    setSubmitting(true)
    try {
      await deletePrograma(deletingProgram.code_program)
      onShowToast(`Programa ${deletingProgram.code_program} desactivado`, 'success')
      setDeletingProgram(null)
      onRefresh()
    } catch (err) {
      onShowToast(`Error al eliminar: ${err.message}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="section-container">
      {/* Header Bar */}
      <div className="section-header">
        <div>
          <h1 className="section-title">Programas Académicos (Carreras)</h1>
          <p className="section-description">
            Gestiona los programas universitarios y facultades en la base de datos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={handleOpenFacultadModal}>
            <Building2 size={18} />
            <span>Nueva Facultad</span>
          </button>
          <button className="btn-primary" onClick={handleOpenCreateModal}>
            <Plus size={18} />
            <span>Nuevo Programa</span>
          </button>
        </div>
      </div>

      {/* Control Bar: Search & Stats */}
      <div className="control-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Buscar por código o nombre de programa..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="stats-pill">
          <span>Total programas: <strong>{programas.length}</strong></span>
        </div>
      </div>

      {/* Programas Grid */}
      {filteredProgramas.length === 0 ? (
        <div className="empty-state-card">
          <BookOpen size={48} className="empty-icon" />
          <h3>No se encontraron programas</h3>
          <p>
            {searchTerm 
              ? 'No hay programas que coincidan con la búsqueda.' 
              : 'Aún no hay carreras registradas. Crea una para comenzar a armar la malla curricular.'}
          </p>
          {!searchTerm && (
            <button className="btn-primary" onClick={handleOpenCreateModal}>
              <Plus size={16} /> Crear primer programa
            </button>
          )}
        </div>
      ) : (
        <div className="cards-grid">
          {filteredProgramas.map((prog) => {
            const count = getCoursesCount(prog.code_program)
            const credits = getProgramCredits(prog.code_program)
            return (
              <div key={prog.code_program} className={`item-card${prog.estado === 'INACTIVO' ? ' item-card-inactive' : ''}`}>
                <div className="item-card-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <div className="badge-code">{prog.code_program}</div>
                    {prog.estado === 'INACTIVO' && (
                      <span className="badge-inactive" title="Programa desactivado">Desactivado</span>
                    )}
                    {prog.id_facultad_programa && (
                      <span className="badge-group" title="Facultad">
                        <Building2 size={12} /> {facultadesList.find(f => f.id === prog.id_facultad_programa)?.nombre || 'Facultad'}
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="item-card-title">{prog.name_program}</h3>

                <div className="item-card-meta">
                  <span className="meta-info">
                    <Layers size={15} />
                    {count} {count === 1 ? 'materia' : 'materias'}
                  </span>
                  <span className="meta-separator">•</span>
                  <span className="meta-info">
                    <Award size={15} />
                    {credits} {credits === 1 ? 'crédito' : 'créditos'}
                  </span>
                  <span className="meta-separator">•</span>
                  <span className="meta-info">
                    <BookOpen size={15} />
                    {prog.numero_semestre || 10} {prog.numero_semestre === 1 ? 'semestre' : 'semestres'}
                  </span>
                </div>

                <div className="item-card-actions">
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => onSelectProgramForPensum(prog.code_program)}
                    title="Ver y estructurar la malla curricular de este programa"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 600,
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.84rem'
                    }}
                  >
                    <Layers size={14} />
                    <span>Ver Malla Curricular</span>
                  </button>

                  <div className="action-buttons-group">
                    <button
                      className="btn-icon"
                      onClick={() => handleOpenEditModal(prog)}
                      title="Editar programa"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      className="btn-icon text-danger"
                      onClick={() => setDeletingProgram(prog)}
                      title="Desactivar programa"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Crear Facultad */}
      {isFacultadModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Nueva Facultad</h2>
              <button className="modal-close-btn" onClick={() => setIsFacultadModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleCreateNewFacultadInDb}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="facultad_nombre">Nombre de la Facultad *</label>
                  <input
                    id="facultad_nombre"
                    type="text"
                    placeholder="Ej. Facultad de Ingeniería y Administración"
                    value={newFacultadName}
                    onChange={(e) => setNewFacultadName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="facultad_descripcion">Descripción (opcional)</label>
                  <input
                    id="facultad_descripcion"
                    type="text"
                    placeholder="Descripción de la facultad"
                    value={newFacultadDesc}
                    onChange={(e) => setNewFacultadDesc(e.target.value)}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsFacultadModalOpen(false)}
                  disabled={addingFacultadSubmitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={addingFacultadSubmitting || !newFacultadName.trim()}
                >
                  {addingFacultadSubmitting ? 'Guardando...' : 'Crear Facultad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Crear / Editar Programa */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <h2>{editingProgram ? 'Editar Programa' : 'Nuevo Programa Académico'}</h2>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)}>×</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                <div className="form-group">
                  <label htmlFor="apertura">Apertura</label>
                  <select
                    id="apertura"
                    value={formData.apertura}
                    onChange={(e) => setFormData({ ...formData, apertura: e.target.value })}
                    className="select-input"
                  >
                    <option value="">-- Sin definir --</option>
                    <option value="SEMESTRAL">Semestral</option>
                    <option value="ANUAL">Anual</option>
                  </select>
                  <small className="form-hint">Campo opcional: indica la frecuencia de apertura del programa.</small>
                </div>

                <div className="form-group">
                  <label htmlFor="code_program">Código del Programa *</label>
                  <input
                    id="code_program"
                    type="text"
                    placeholder="Ej. 3743"
                    value={formData.code_program}
                    onChange={(e) => setFormData({ ...formData, code_program: e.target.value })}
                    disabled={!!editingProgram}
                    required
                  />
                  {editingProgram && (
                    <small className="form-hint">El código de programa es la clave primaria y no puede modificarse.</small>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="name_program">Nombre del Programa / Carrera *</label>
                  <input
                    id="name_program"
                    type="text"
                    placeholder="Ej. Ingeniería de Sistemas y Computación"
                    value={formData.name_program}
                    onChange={(e) => setFormData({ ...formData, name_program: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="numero_resolucion">Número de resolución *</label>
                  <input
                    id="numero_resolucion"
                    type="text"
                    maxLength={15}
                    placeholder="Ej. RES-123-2026"
                    value={formData.numero_resolucion}
                    onChange={(e) => setFormData({ ...formData, numero_resolucion: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="id_facultad_programa">Facultad Perteneciente</label>
                  <select
                    id="id_facultad_programa"
                    value={formData.id_facultad_programa}
                    onChange={(e) => setFormData({ ...formData, id_facultad_programa: e.target.value })}
                    className="select-input"
                    style={{ marginTop: '0.35rem' }}
                  >
                    <option value="">-- Sin facultad asignada --</option>
                    {facultadesList
                      .filter(f => f.id !== 2 && f.id !== 3)
                      .map(f => (
                        <option key={f.id} value={f.id}>
                          {f.nombre || f.Nombre}
                        </option>
                      ))}
                  </select>
                  <small className="form-hint">
                    Las electivas profesionales en el pensum se mostrarán exclusivamente según la facultad seleccionada aquí.
                  </small>
                </div>

                <div className="form-group">
                  <label htmlFor="numero_semestre">Número de Semestres de la Carrera *</label>
                  <input
                    id="numero_semestre"
                    type="number"
                    min="1"
                    max="20"
                    placeholder="Ej. 10"
                    value={formData.numero_semestre}
                    onChange={(e) => setFormData({ ...formData, numero_semestre: e.target.value })}
                    required
                  />
                  <small className="form-hint">
                    Define la duración exacta y el total de semestres que se mostrarán en la malla curricular (ej. 10 para carreras profesionales, 6 para tecnologías).
                  </small>
                </div>

                {editingProgram && (
                  <div className="form-group">
                    <label htmlFor="coordinador_asignado_fijo">Coordinador asignado</label>
                    <div
                      id="coordinador_asignado_fijo"
                      className="readonly-display-box"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.65rem 0.85rem',
                        backgroundColor: '#f8fafc',
                        border: '1.5px solid #e2e8f0',
                        borderRadius: 'var(--radius-sm, 6px)',
                        minHeight: '44px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                        <UserCheck size={18} style={{ color: assignedCoordinator ? '#2563eb' : '#94a3b8', flexShrink: 0 }} />
                        <div style={{ minWidth: 0 }}>
                          <div style={{
                            fontWeight: 600,
                            fontSize: '0.9rem',
                            color: assignedCoordinator ? '#0f172a' : '#64748b',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}>
                            {loadingCoordinadores
                              ? 'Consultando asignación...'
                              : (assignedCoordinator?.nombre_completo || 'Sin coordinador asignado')}
                          </div>
                          {assignedCoordinator?.correo_institucional && (
                            <div style={{ fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {assignedCoordinator.correo_institucional}
                            </div>
                          )}
                        </div>
                      </div>
                      {!loadingCoordinadores && (
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: '0.72rem',
                            padding: '0.2rem 0.55rem',
                            fontWeight: 600,
                            borderRadius: '9999px',
                            backgroundColor: assignedCoordinator ? '#dcfce7' : '#f1f5f9',
                            color: assignedCoordinator ? '#15803d' : '#64748b',
                            border: `1px solid ${assignedCoordinator ? '#bbf7d0' : '#cbd5e1'}`
                          }}
                        >
                          {assignedCoordinator ? 'Asignado' : 'No asignado'}
                        </span>
                      )}
                    </div>
                    <small className="form-hint">
                      El coordinador asignado es de solo lectura en este formulario. Para asignar o reasignar la coordinación, diríjase al módulo de Coordinación de programas.
                    </small>
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={submitting}>
                  {submitting ? 'Guardando...' : editingProgram ? 'Actualizar' : 'Crear Programa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Confirmar Desactivación */}
      {deletingProgram && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-with-icon">
                <AlertTriangle className="text-danger" size={24} />
                <h2>Confirmar Desactivación</h2>
              </div>
              <button className="modal-close-btn" onClick={() => setDeletingProgram(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>
                ¿Estás seguro de que deseas desactivar el programa <strong>{deletingProgram.name_program}</strong> ({deletingProgram.code_program})?
              </p>
              <div className="alert-warning-box">
                <p>
                  El programa quedará marcado como <strong>Desactivado</strong> y se conservarán sus materias y su malla curricular.
                  No se borra información de la base de datos.
                </p>
              </div>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setDeletingProgram(null)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleDelete}
                disabled={submitting}
              >
                {submitting ? 'Desactivando...' : 'Sí, Desactivar Programa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
