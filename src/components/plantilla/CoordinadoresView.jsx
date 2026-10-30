import React, { useState, useEffect } from 'react'
import {
  Users,
  Plus,
  Search,
  Edit2,
  Trash2,
  Mail,
  Phone,
  IdCard,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Award,
  Briefcase
} from 'lucide-react'
import {
  getCoordinadores,
  createCoordinador,
  updateCoordinador,
  deleteCoordinador
} from '../../services/academicService'

// Escalafón Docente
const CATEGORIAS = [
  'Auxiliar',
  'Asistente',
  'Asociado',
  'Titular'
]

// Modalidad / Tipo de Contrato
const TIPOS_CONTRATO = [
  'Nombrado',
  'Ocasional',
  'Cátedra'
]

export default function CoordinadoresView({
  programas,
  onShowToast
}) {
  const [coordinadores, setCoordinadores] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [programFilter, setProgramFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')
  const [contractFilter, setContractFilter] = useState('ALL')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCoord, setEditingCoord] = useState(null)
  const [deletingCoord, setDeletingCoord] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    identificacion: '',
    nombre_completo: '',
    correo: '',
    correo_institucional: '',
    telefono: '',
    code_program: '',
    categoria: 'Auxiliar',
    tipo_contrato: 'Nombrado',
    activo: true
  })

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await getCoordinadores()
      setCoordinadores(data || [])
    } catch (err) {
      console.error('Error al cargar coordinadores:', err)
      onShowToast?.('Error al cargar la lista de coordinadores: ' + err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenCreate = () => {
    setEditingCoord(null)
    setFormData({
      identificacion: '',
      nombre_completo: '',
      correo: '',
      correo_institucional: '',
      telefono: '',
      code_program: programas[0]?.code_program || '',
      categoria: 'Auxiliar',
      tipo_contrato: 'Nombrado',
      activo: true
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (coord) => {
    setEditingCoord(coord)
    setFormData({
      identificacion: coord.identificacion || '',
      nombre_completo: coord.nombre_completo || '',
      correo: coord.correo || '',
      correo_institucional: coord.correo_institucional || '',
      telefono: coord.telefono || '',
      code_program: coord.code_program || '',
      categoria: coord.categoria || 'Auxiliar',
      tipo_contrato: coord.tipo_contrato || 'Nombrado',
      activo: coord.activo ?? true
    })
    setIsModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.nombre_completo.trim() || !formData.correo_institucional.trim()) {
      onShowToast?.('El nombre y el correo institucional son obligatorios', 'warning')
      return
    }

    if (!editingCoord && !formData.identificacion.trim()) {
      onShowToast?.('La identificación es obligatoria', 'warning')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        nombre_completo: formData.nombre_completo.trim(),
        correo: formData.correo ? formData.correo.trim() : null,
        correo_institucional: formData.correo_institucional.trim(),
        telefono: formData.telefono ? formData.telefono.trim() : null,
        code_program: formData.code_program || null,
        categoria: formData.categoria || 'Auxiliar',
        tipo_contrato: formData.tipo_contrato || 'Nombrado',
        activo: formData.activo
      }

      if (editingCoord) {
        await updateCoordinador(editingCoord.id, payload)
        onShowToast?.('Coordinador actualizado correctamente', 'success')
      } else {
        await createCoordinador({
          ...payload,
          identificacion: formData.identificacion.trim()
        })
        onShowToast?.('Coordinador registrado exitosamente', 'success')
      }
      setIsModalOpen(false)
      loadData()
    } catch (err) {
      console.error('Error al guardar coordinador:', err)
      onShowToast?.(err.message || 'Error al guardar coordinador', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deletingCoord) return
    setSubmitting(true)
    try {
      await deleteCoordinador(deletingCoord.id)
      onShowToast?.('Coordinador eliminado correctamente', 'success')
      setDeletingCoord(null)
      loadData()
    } catch (err) {
      console.error('Error al eliminar coordinador:', err)
      onShowToast?.(err.message || 'Error al eliminar coordinador', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Filtrado
  const filteredCoordinadores = coordinadores.filter(c => {
    const term = searchTerm.toLowerCase()
    const matchesSearch =
      (c.nombre_completo || '').toLowerCase().includes(term) ||
      (c.identificacion || '').toLowerCase().includes(term) ||
      (c.correo_institucional || '').toLowerCase().includes(term) ||
      (c.name_program || '').toLowerCase().includes(term) ||
      (c.categoria || '').toLowerCase().includes(term) ||
      (c.tipo_contrato || '').toLowerCase().includes(term)

    const matchesProgram =
      programFilter === 'ALL' || c.code_program === programFilter

    const matchesCategory =
      categoryFilter === 'ALL' || (c.categoria || 'Auxiliar') === categoryFilter

    const matchesContract =
      contractFilter === 'ALL' || (c.tipo_contrato || 'Nombrado') === contractFilter

    return matchesSearch && matchesProgram && matchesCategory && matchesContract
  })

  return (
    <div className="view-container">
      {/* Encabezado */}
      <div className="view-header">
        <div>
          <h1 className="view-title flex-align-center" style={{ gap: '0.75rem' }}>
            <Users size={28} className="text-primary" />
            Gestión de Coordinadores
          </h1>
          <p className="view-subtitle">
            Administra los coordinadores académicos, su categoría, tipo de contrato y programa vinculado
          </p>
        </div>
        <button className="btn-primary" onClick={handleOpenCreate}>
          <Plus size={18} />
          <span>Nuevo Coordinador</span>
        </button>
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="view-filters-card" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        <div className="search-box-wrapper" style={{ flex: 1, minWidth: '220px' }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Buscar por nombre, ID, correo, contrato, carrera..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Filtro por Tipo de Contrato */}
        <select
          className="filter-select"
          value={contractFilter}
          onChange={(e) => setContractFilter(e.target.value)}
          style={{ minWidth: '160px' }}
        >
          <option value="ALL">Todos los contratos</option>
          {TIPOS_CONTRATO.map(tc => (
            <option key={tc} value={tc}>Contrato: {tc}</option>
          ))}
        </select>

        {/* Filtro por Categoría */}
        <select
          className="filter-select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ minWidth: '160px' }}
        >
          <option value="ALL">Todas las categorías</option>
          {CATEGORIAS.map(cat => (
            <option key={cat} value={cat}>Categoría: {cat}</option>
          ))}
        </select>

        {/* Filtro por Programa */}
        <select
          className="filter-select"
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          style={{ minWidth: '180px' }}
        >
          <option value="ALL">Todos los programas</option>
          {programas.map(p => (
            <option key={p.code_program} value={p.code_program}>
              {p.name_program} ({p.code_program})
            </option>
          ))}
        </select>
      </div>

      {/* Lista de Coordinadores */}
      {loading ? (
        <div className="loading-state-container">
          <div className="spinner"></div>
          <p>Cargando coordinadores...</p>
        </div>
      ) : filteredCoordinadores.length === 0 ? (
        <div className="empty-state-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
          <Users size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h3>No se encontraron coordinadores</h3>
          <p style={{ color: 'var(--text-muted, #888)', maxWidth: '420px', margin: '0 auto 1.5rem auto' }}>
            {searchTerm || programFilter !== 'ALL' || categoryFilter !== 'ALL' || contractFilter !== 'ALL'
              ? 'No hay registros que coincidan con los filtros aplicados.'
              : 'Aún no se han registrado coordinadores en el sistema. Registra el primero para vincularlo a un programa.'}
          </p>
          <button className="btn-primary" onClick={handleOpenCreate}>
            <Plus size={16} /> Registrar Primer Coordinador
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '1.25rem' }}>
          {filteredCoordinadores.map(coord => (
            <div
              key={coord.id}
              className="card-item"
              style={{
                background: '#5f57575d', /*Color de la tarjeta*/
                border: '1px solid #ffffffff',
                borderRadius: '12px',
                padding: '1.25rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <div>
                {/* Header de la tarjeta */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: '#f4f4f5' }}>{coord.nombre_completo}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.85rem', color: '#a1a1aa' }}>
                      <IdCard size={14} />
                      <span>C.C. / ID: <strong>{coord.identificacion}</strong></span>
                    </div>
                  </div>
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      background: coord.activo ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: coord.activo ? '#10b981' : '#ef4444'
                    }}
                  >
                    {coord.activo ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    {coord.activo ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Categoría, Tipo de Contrato y Programa en tonos grises elegantes */}
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
                  {/* Badge de Categoría */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: '#717172ff',
                      border: '1px solid #3f3f46',
                      color: '#e4e4e7',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 500
                    }}
                    title="Categoría"
                  >
                    <Award size={13} style={{ color: '#a1a1aa' }} />
                    <span>{coord.categoria || 'Auxiliar'}</span>
                  </span>

                  {/* Badge de Tipo de Contrato */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: '#27272a',
                      border: '1px solid #3f3f46',
                      color: '#d4d4d8',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 500
                    }}
                    title="Tipo de Contrato"
                  >
                    <Briefcase size={13} style={{ color: '#a1a1aa' }} />
                    <span>{coord.tipo_contrato || 'Nombrado'}</span>
                  </span>

                  {/* Programa vinculado */}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                      background: '#202024',
                      border: '1px solid #333338',
                      color: '#a1a1aa',
                      padding: '0.25rem 0.6rem',
                      borderRadius: '6px',
                      fontSize: '0.76rem',
                      fontWeight: 500,
                      maxWidth: '220px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={coord.name_program || coord.code_program}
                  >
                    <BookOpen size={13} style={{ color: '#71717a' }} />
                    <span>{coord.name_program || coord.code_program || 'Sin carrera'}</span>
                  </span>
                </div>

                {/* Datos de contacto en escala de grises limpia */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem', fontSize: '0.85rem', color: '#d4d4d8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Mail size={14} style={{ color: '#71717a', flexShrink: 0 }} />
                    <span style={{ color: '#71717a' }}>Institucional:</span>
                    <a href={'mailto:' + coord.correo_institucional} style={{ color: '#cbd5e1', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {coord.correo_institucional}
                    </a>
                  </div>

                  {coord.correo && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Mail size={14} style={{ color: '#71717a', flexShrink: 0 }} />
                      <span style={{ color: '#71717a' }}>Personal:</span>
                      <a href={'mailto:' + coord.correo} style={{ color: '#a1a1aa', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {coord.correo}
                      </a>
                    </div>
                  )}

                  {coord.telefono && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Phone size={14} style={{ color: '#71717a', flexShrink: 0 }} />
                      <span style={{ color: '#71717a' }}>Teléfono:</span>
                      <a href={'tel:' + coord.telefono} style={{ color: '#a1a1aa', textDecoration: 'none' }}>
                        {coord.telefono}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid #27272a' }}>
                <button
                  className="btn-icon"
                  title="Editar coordinador"
                  onClick={() => handleOpenEdit(coord)}
                >
                  <Edit2 size={15} />
                </button>
                <button
                  className="btn-icon btn-icon-danger"
                  title="Eliminar coordinador"
                  onClick={() => setDeletingCoord(coord)}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Creación / Edición */}
      {isModalOpen && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '540px', width: '100%' }}>
            <div className="modal-header">
              <h3>{editingCoord ? 'Editar Coordinador' : 'Nuevo Coordinador'}</h3>
              <button className="btn-close" onClick={() => setIsModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Identificación */}
                <div className="form-group">
                  <label>Identificación / Cédula *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingCoord}
                    placeholder="Ej. 1118234567"
                    value={formData.identificacion}
                    onChange={(e) => setFormData({ ...formData, identificacion: e.target.value })}
                  />
                  {editingCoord && (
                    <small style={{ color: '#9ca3af', fontSize: '0.75rem' }}>
                      La identificación no se puede modificar una vez registrada.
                    </small>
                  )}
                </div>

                {/* Nombre completo */}
                <div className="form-group">
                  <label>Nombre Completo *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Dra. María Rodríguez Pérez"
                    value={formData.nombre_completo}
                    onChange={(e) => setFormData({ ...formData, nombre_completo: e.target.value })}
                  />
                </div>

                {/* Fila doble: Categoría y Tipo de Contrato */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Categoría Seleccionable */}
                  <div className="form-group">
                    <label>Categoría*</label>
                    <select
                      value={formData.categoria}
                      onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
                      style={{ fontWeight: 500 }}
                    >
                      {CATEGORIAS.map(cat => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Tipo de Contrato Seleccionable */}
                  <div className="form-group">
                    <label>Tipo de Contrato *</label>
                    <select
                      value={formData.tipo_contrato}
                      onChange={(e) => setFormData({ ...formData, tipo_contrato: e.target.value })}
                      style={{ fontWeight: 500 }}
                    >
                      {TIPOS_CONTRATO.map(tc => (
                        <option key={tc} value={tc}>
                          {tc}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Correo institucional */}
                <div className="form-group">
                  <label>Correo Institucional *</label>
                  <input
                    type="email"
                    required
                    placeholder="Ej. maria.rodriguez@correounivalle.edu.co"
                    value={formData.correo_institucional}
                    onChange={(e) => setFormData({ ...formData, correo_institucional: e.target.value })}
                  />
                </div>

                {/* Correo personal */}
                <div className="form-group">
                  <label>Correo Personal / Alternativo</label>
                  <input
                    type="email"
                    placeholder="Ej. maria.rodriguez@gmail.com"
                    value={formData.correo}
                    onChange={(e) => setFormData({ ...formData, correo: e.target.value })}
                  />
                </div>

                {/* Teléfono */}
                <div className="form-group">
                  <label>Teléfono de Contacto</label>
                  <input
                    type="text"
                    placeholder="Ej. +57 315 123 4567"
                    value={formData.telefono}
                    onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                  />
                </div>

                {/* Programa vinculado */}
                <div className="form-group">
                  <label>Programa Académico Vinculado</label>
                  <select
                    value={formData.code_program}
                    onChange={(e) => setFormData({ ...formData, code_program: e.target.value })}
                  >
                    <option value="">-- Sin programa asignado --</option>
                    {programas.map(p => (
                      <option key={p.code_program} value={p.code_program}>
                        {p.name_program} ({p.code_program})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Activo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="chk-activo"
                    checked={formData.activo}
                    onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="chk-activo" style={{ cursor: 'pointer', fontSize: '0.9rem' }}>
                    Coordinador activo en el sistema
                  </label>
                </div>
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
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Guardando...' : (editingCoord ? 'Guardar Cambios' : 'Registrar Coordinador')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {deletingCoord && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '420px' }}>
            <div className="modal-header">
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                <AlertTriangle size={20} /> Eliminar Coordinador
              </h3>
              <button className="btn-close" onClick={() => setDeletingCoord(null)}>×</button>
            </div>
            <div className="modal-body">
              <p>
                ¿Estás seguro de que deseas eliminar al coordinador{' '}
                <strong>{deletingCoord.nombre_completo}</strong> (ID: {deletingCoord.identificacion})?
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn-secondary"
                onClick={() => setDeletingCoord(null)}
                disabled={submitting}
              >
                Cancelar
              </button>
              <button
                className="btn-danger"
                onClick={handleDelete}
                disabled={submitting}
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
