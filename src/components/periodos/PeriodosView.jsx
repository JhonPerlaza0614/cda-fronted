import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, Edit3, ExternalLink, Plus, Save, Trash2, X } from 'lucide-react'
import { createPeriodo, updatePeriodo } from '../../services/academicService'
import {
  getPeriodos,
  desactivarPeriodo,
  ESTADO_LABELS,
  ESTADOS_PERIODO,
} from '../../services/periodosService'
import { formatearFecha, formatearFechaHora } from '../../utils/formatoFechas'
import EliminarPeriodoModal from './EliminarPeriodoModal'

const emptyForm = {
  nombre: '',
  numeroResolucion: '',
  fechaResolucion: '',
  fechaInicioSemestre: '',
  fechaFinSemestre: '',
  fechaAdicionInicio: '',
  fechaAdicionFin: '',
  fechaCancelacionInicio: '',
  fechaCancelacionFin: '',
  plazoDocenteInicio: '',
  plazoDocenteFin: '',
  plazoCoordinadorInicio: '',
  plazoCoordinadorFin: '',
  enlaceResolucion: '',
  version: null,
}

function toLocalDateTime(value) {
  if (!value) return ''
  const date = new Date(value)
  const pad = (part) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromApi(periodo) {
  return Object.fromEntries(Object.entries(periodo).map(([key, value]) => (
    ['plazoDocenteInicio', 'plazoDocenteFin', 'plazoCoordinadorInicio', 'plazoCoordinadorFin'].includes(key)
      ? [key, toLocalDateTime(value)]
      : [key, value ?? '']
  )))
}

function toPayload(form) {
  const payload = { ...form }
  for (const key of ['plazoDocenteInicio', 'plazoDocenteFin', 'plazoCoordinadorInicio', 'plazoCoordinadorFin']) {
    payload[key] = payload[key] ? new Date(payload[key]).toISOString() : null
  }
  return payload
}

const dateFields = [
  ['fechaResolucion', 'Fecha de resolución'],
  ['fechaInicioSemestre', 'Inicio del semestre'],
  ['fechaFinSemestre', 'Fin del semestre'],
  ['fechaAdicionInicio', 'Inicio de adiciones y cancelaciones'],
  ['fechaAdicionFin', 'Fin de adiciones y cancelaciones'],
  ['fechaCancelacionInicio', 'Inicio de cancelaciones'],
  ['fechaCancelacionFin', 'Fin de cancelaciones'],
]

function PeriodoForm({ initialValue, onCancel, onSaved, onShowToast }) {
  const [form, setForm] = useState(initialValue || emptyForm)
  const [saving, setSaving] = useState(false)
  const isEditing = Boolean(initialValue?.id)

  useEffect(() => {
    if (form.plazoDocenteInicio && !form.plazoDocenteFin) {
      const end = new Date(form.plazoDocenteInicio)
      end.setDate(end.getDate() + 14)
      setForm((current) => ({ ...current, plazoDocenteFin: toLocalDateTime(end) }))
    }
  }, [form.plazoDocenteInicio, form.plazoDocenteFin])

  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const submit = async (event) => {
    event.preventDefault()
    if (!window.confirm('¿La información es correcta?')) return
    setSaving(true)
    try {
      const saved = isEditing
        ? await updatePeriodo(initialValue.id, toPayload(form))
        : await createPeriodo(toPayload(form))
      onShowToast(isEditing ? 'Período académico actualizado' : 'Período académico creado', 'success')
      onSaved(saved)
    } catch (error) {
      onShowToast(error.message || (isEditing ? 'No se pudo actualizar el período' : 'No se pudo crear el período'), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="periodo-form" onSubmit={submit}>
      <div className="periodo-form-grid">
        <label>Nombre del período<input required maxLength={20} value={form.nombre} onChange={(e) => setField('nombre', e.target.value)} /></label>
        <label>Número de resolución<input required value={form.numeroResolucion} onChange={(e) => setField('numeroResolucion', e.target.value)} /></label>
        {dateFields.map(([key, label]) => (
          <label key={key}>{label}<input required type="date" value={form[key]} onChange={(e) => setField(key, e.target.value)} /></label>
        ))}
        <label>Inicio plazo docente<input required type="datetime-local" value={form.plazoDocenteInicio} onChange={(e) => setField('plazoDocenteInicio', e.target.value)} /></label>
        <label>Fin plazo docente<input required type="datetime-local" value={form.plazoDocenteFin} onChange={(e) => setField('plazoDocenteFin', e.target.value)} /></label>
        <label>Inicio plazo coordinadores (opcional)<input type="datetime-local" value={form.plazoCoordinadorInicio} onChange={(e) => setField('plazoCoordinadorInicio', e.target.value)} /></label>
        <label>Fin plazo coordinadores (opcional)<input type="datetime-local" value={form.plazoCoordinadorFin} onChange={(e) => setField('plazoCoordinadorFin', e.target.value)} /></label>
        <label className="periodo-form-wide">Enlace a la resolución<input type="url" placeholder="https://..." value={form.enlaceResolucion} onChange={(e) => setField('enlaceResolucion', e.target.value)} /></label>
      </div>
      <div className="periodo-form-actions">
        <button type="button" className="btn-secondary" onClick={onCancel}><X size={16} /> Cancelar</button>
        <button type="submit" className="btn-primary" disabled={saving}><Save size={16} /> {saving ? 'Guardando...' : 'Guardar período'}</button>
      </div>
    </form>
  )
}

function Dato({ etiqueta, children }) {
  return (
    <div className="periodo-dato">
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function DetallePeriodo({ id, periodo, puedeGestionar, onEditar, onEliminar }) {
  const esVigente = periodo.estado === ESTADOS_PERIODO.VIGENTE
  const esDesactivado = periodo.estado === ESTADOS_PERIODO.DESACTIVADO

  return (
    <div className="periodo-detalle" id={id}>
      {puedeGestionar && esVigente && (
        <div className="periodo-detalle-acciones">
          <button type="button" className="btn-secondary" onClick={onEditar}><Edit3 size={16} /> Editar</button>
          <button type="button" className="btn-danger" onClick={onEliminar}><Trash2 size={16} /> Eliminar</button>
        </div>
      )}

      <dl className="periodo-detalle-grid">
        <Dato etiqueta="Número de resolución">{periodo.numeroResolucion}</Dato>
        <Dato etiqueta="Fecha de resolución">{formatearFecha(periodo.fechaResolucion)}</Dato>
        <Dato etiqueta="Semestre">{formatearFecha(periodo.fechaInicioSemestre)} a {formatearFecha(periodo.fechaFinSemestre)}</Dato>
        <Dato etiqueta="Adiciones y cancelaciones">{formatearFecha(periodo.fechaAdicionInicio)} a {formatearFecha(periodo.fechaAdicionFin)}</Dato>
        <Dato etiqueta="Cancelaciones">{formatearFecha(periodo.fechaCancelacionInicio)} a {formatearFecha(periodo.fechaCancelacionFin)}</Dato>
        <Dato etiqueta="Plazo docentes (hora de Bogotá)">
          {formatearFechaHora(periodo.plazoDocenteInicio)} a {formatearFechaHora(periodo.plazoDocenteFin)}
        </Dato>
        <Dato etiqueta="Plazo coordinadores (hora de Bogotá)">
          {periodo.plazoCoordinadorInicio && periodo.plazoCoordinadorFin
            ? `${formatearFechaHora(periodo.plazoCoordinadorInicio)} a ${formatearFechaHora(periodo.plazoCoordinadorFin)}`
            : 'Sin plazo definido'}
        </Dato>
        <Dato etiqueta="Resolución en línea">
          {periodo.enlaceResolucion
            ? <a href={periodo.enlaceResolucion} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir resolución</a>
            : 'Sin enlace'}
        </Dato>
      </dl>

      {esDesactivado && (
        <p className="periodo-nota-desactivado">Este período fue desactivado: sus plazos de docentes y coordinadores están cerrados.</p>
      )}
    </div>
  )
}

function PeriodoCard({ periodo, abierto, onToggle, puedeGestionar, onEditar, onEliminar }) {
  const esVigente = periodo.estado === ESTADOS_PERIODO.VIGENTE
  const detalleId = `periodo-detalle-${periodo.id}`

  return (
    <article className={`periodo-card${esVigente ? ' vigente' : ''}`}>
      <div className="periodo-card-top">
        <div>
          <span className={`periodo-status estado-${periodo.estado.toLowerCase()}`}>{ESTADO_LABELS[periodo.estado]}</span>
          <h2>{periodo.nombre}</h2>
          <p>
            Resolución {periodo.numeroResolucion} · Semestre: {formatearFecha(periodo.fechaInicioSemestre)} a {formatearFecha(periodo.fechaFinSemestre)}
          </p>
        </div>
        <button
          type="button"
          className="btn-secondary periodo-toggle"
          onClick={() => onToggle(periodo.id)}
          aria-expanded={abierto}
          aria-controls={detalleId}
        >
          {abierto ? 'Ocultar detalle' : 'Ver detalle'}
          <ChevronDown size={16} className={`periodo-chevron${abierto ? ' abierto' : ''}`} />
        </button>
      </div>

      {abierto && (
        <DetallePeriodo
          id={detalleId}
          periodo={periodo}
          puedeGestionar={puedeGestionar}
          onEditar={() => onEditar(periodo)}
          onEliminar={() => onEliminar(periodo)}
        />
      )}
    </article>
  )
}

export default function PeriodosView({ user, onShowToast }) {
  const [periodos, setPeriodos] = useState([])
  const [editing, setEditing] = useState(null)
  const [loading, setLoading] = useState(true)
  const [abiertos, setAbiertos] = useState([])
  const [aEliminar, setAEliminar] = useState(null)
  const [eliminando, setEliminando] = useState(false)
  const primeraCarga = useRef(true)
  const isAdmin = user?.rol === 1

  // silencioso = true: recarga sin ocultar la lista (evita parpadeo)
  const load = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true)
    try {
      const lista = await getPeriodos()
      setPeriodos(lista)
      // Solo la primera vez: deja desplegado el vigente
      if (primeraCarga.current) {
        primeraCarga.current = false
        const actual = lista.find((periodo) => periodo.estado === ESTADOS_PERIODO.VIGENTE)
        if (actual) setAbiertos([actual.id])
      }
    } catch (error) {
      onShowToast(error.message || 'No se pudieron cargar los períodos', 'error')
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [onShowToast])

  useEffect(() => { load() }, [load])

  const vigente = useMemo(
    () => periodos.find((periodo) => periodo.estado === ESTADOS_PERIODO.VIGENTE),
    [periodos]
  )

  const historial = useMemo(
    () => periodos.filter((periodo) => periodo.estado !== ESTADOS_PERIODO.VIGENTE),
    [periodos]
  )

  const alternarDetalle = (id) => {
    setAbiertos((actuales) => (
      actuales.includes(id) ? actuales.filter((item) => item !== id) : [...actuales, id]
    ))
  }

  const abrirDetalle = (id) => {
    setAbiertos((actuales) => (actuales.includes(id) ? actuales : [...actuales, id]))
  }

  const cancelarEliminacion = () => {
    if (eliminando) return
    setAEliminar(null)
  }

  const confirmarEliminacion = async () => {
    if (!aEliminar || eliminando) return
    const { id } = aEliminar
    setEliminando(true)
    try {
      await desactivarPeriodo(id)
    } catch {
      // Texto fijo: no se muestra el mensaje del backend. No se recarga: la pantalla no cambia.
      onShowToast('No se pudo eliminar el período', 'error')
      setAEliminar(null)
      setEliminando(false)
      return
    }
    abrirDetalle(id)
    await load(true)
    onShowToast('Período eliminado', 'success')
    setAEliminar(null)
    setEliminando(false)
  }

  const propsTarjeta = (periodo) => ({
    periodo,
    abierto: abiertos.includes(periodo.id),
    onToggle: alternarDetalle,
    puedeGestionar: isAdmin,
    onEditar: setEditing,
    onEliminar: setAEliminar,
  })

  if (editing) {
    return (
      <section className="periodos-container">
        <h1>{editing.id ? 'Editar período académico' : 'Crear período académico'}</h1>
        <PeriodoForm
          initialValue={editing.id ? fromApi(editing) : null}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            if (saved?.id) abrirDetalle(saved.id)
            load()
          }}
          onShowToast={onShowToast}
        />
      </section>
    )
  }

  return (
  <div className="section-container">
    {/* Header Bar */}
    <div className="section-header">
      <div>
        <h1 className="section-title">Períodos Académicos</h1>
        <p className="section-description">
          Consulta la resolución académica actual y las históricas.
          </p>
          </div>
          {isAdmin && (
            <button className="btn-primary" onClick={() => setEditing(emptyForm)}>
              <Plus size={18} />
              <span>Nuevo período académico</span>
              </button>
            )}
            </div>

      {loading ? <p>Cargando períodos...</p> : (
        <>
          <h3 className="periodo-seccion-titulo">Período vigente</h3>
          {vigente ? (
            <PeriodoCard {...propsTarjeta(vigente)} />
          ) : (
            <div className="periodo-vacio">No hay período vigente</div>
          )}

          <h3 className="periodo-seccion-titulo">Historial</h3>
          {historial.length === 0 ? (
            <p className="periodo-note">No hay períodos en el historial.</p>
          ) : (
            <div className="periodos-list">
              {historial.map((periodo) => (
                <PeriodoCard key={periodo.id} {...propsTarjeta(periodo)} />
              ))}
            </div>
          )}

          {periodos.length === 0 && <p className="periodo-note">No hay períodos académicos registrados.</p>}
        </>
      )}

      <EliminarPeriodoModal
        periodo={aEliminar}
        enviando={eliminando}
        onAceptar={confirmarEliminacion}
        onCancelar={cancelarEliminacion}
      />
    </div>
  )
}