import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, Clock3, Edit3, Eraser, Info, RotateCcw, AlertCircle, LoaderCircle, X } from 'lucide-react'
import {
  actualizarDisponibilidad,
  consultarMiDisponibilidad,
  consultarPeriodoVigente,
  registrarDisponibilidad,
} from '../services/DisponibilidadService'
import { getPeriodos, ESTADOS_PERIODO } from '../services/periodosService'
import { formatearFechaHora } from '../utils/formatoFechas'
import './DisponibilidadView.css'

const DAYS = [
  { id: 'lunes', value: 1, label: 'Lunes', short: 'L' },
  { id: 'martes', value: 2, label: 'Martes', short: 'M' },
  { id: 'miercoles', value: 3, label: 'Miércoles', short: 'X' },
  { id: 'jueves', value: 4, label: 'Jueves', short: 'J' },
  { id: 'viernes', value: 5, label: 'Viernes', short: 'V' },
  { id: 'sabado', value: 6, label: 'Sábado', short: 'S' },
]

// Cada bloque representa 30 minutos entre las 07:00 y las 21:00.
const SLOTS = Array.from({ length: 28 }, (_, index) => 14 + index)

function slotKey(dayId, slot) {
  return `${dayId}-${slot}`
}

function formatTime(slot) {
  const totalMinutes = slot * 30
  const hour24 = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  const suffix = hour24 >= 12 ? 'p. m.' : 'a. m.'
  const hour12 = hour24 % 12 || 12
  return `${hour12}:${String(minutes).padStart(2, '0')} ${suffix}`
}

function slotToApiTime(slot) {
  const totalMinutes = slot * 30
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

function parseApiTime(value) {
  if (typeof value !== 'string') return null
  const match = value.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3] || 0)
  if (hours < 0 || hours > 23 || minutes > 59 || seconds > 59) return null
  return hours * 60 + minutes + seconds / 60
}

function savedSlotsFromSchedules(schedules) {
  const slots = new Set()
  for (const schedule of schedules || []) {
    const day = DAYS.find((item) => item.value === Number(schedule.dia))
    const start = parseApiTime(schedule.horaInicio)
    const end = parseApiTime(schedule.horaFin)
    // La cuadrícula usa bloques de 30 minutos. Los registros creados desde esta
    // pantalla siempre coinciden con esa granularidad.
    if (!day || start === null || end === null || start % 30 !== 0 || end % 30 !== 0) continue
    for (let slot = start / 30; slot < end / 30; slot += 1) {
      if (SLOTS.includes(slot)) slots.add(slotKey(day.id, slot))
    }
  }
  return slots
}

function getIntervals(selectedSlots, dayId) {
  const daySlots = SLOTS
    .filter((slot) => selectedSlots.has(slotKey(dayId, slot)))
    .sort((a, b) => a - b)
  if (!daySlots.length) return []

  const intervals = []
  let start = daySlots[0]
  let previous = daySlots[0]

  for (let index = 1; index < daySlots.length; index += 1) {
    const current = daySlots[index]
    if (current !== previous + 1) {
      intervals.push({ start, end: previous + 1 })
      start = current
    }
    previous = current
  }
  intervals.push({ start, end: previous + 1 })
  return intervals
}

function toDisplayIntervals(schedules) {
  return (schedules || []).map((schedule) => {
    const day = DAYS.find((item) => item.value === Number(schedule.dia))
    return {
      label: day?.label || `Día ${schedule.dia}`,
      start: schedule.horaInicio?.slice(0, 5) || '',
      end: schedule.horaFin?.slice(0, 5) || '',
    }
  })
}

export default function DisponibilidadView() {
  const [selectedSlots, setSelectedSlots] = useState(() => new Set())
  const [savedSlots, setSavedSlots] = useState(() => new Set())
  const [schedules, setSchedules] = useState([])
  const [status, setStatus] = useState(null)
  const [plazoDocente, setPlazoDocente] = useState({ inicio: null, fin: null })
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState(null)
  const [notice, setNotice] = useState(null)
  const dragMode = useRef(null)

  const loadAvailability = useCallback(async ({ showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    setLoadError(null)
    try {
      const [availResult, listaPeriodos, periodoVigenteDirecto] = await Promise.all([
        consultarMiDisponibilidad().catch((err) => ({ __error: err })),
        getPeriodos().catch(() => null),
        consultarPeriodoVigente(),
      ])

      const response = availResult?.__error ? null : availResult

      // Filtrar estrictamente por estado de período: solo se toma el que esté VIGENTE (activo),
      // descartando los que estén DESACTIVADO o en HISTORIAL.
      const esPeriodoVigenteActivo = (p) => {
        if (!p) return false
        const estadoNorm = String(p.estado ?? '').trim().toUpperCase()
        if (estadoNorm === ESTADOS_PERIODO.DESACTIVADO || estadoNorm === ESTADOS_PERIODO.HISTORIAL || estadoNorm === 'HISTORICO') {
          return false
        }
        if (p.vigente === false) return false
        return estadoNorm === ESTADOS_PERIODO.VIGENTE || p.vigente === true
      }

      let periodoActivo = null
      if (Array.isArray(listaPeriodos)) {
        periodoActivo = listaPeriodos.find(esPeriodoVigenteActivo) || null
      } else if (esPeriodoVigenteActivo(periodoVigenteDirecto)) {
        periodoActivo = periodoVigenteDirecto
      }

      const hayPeriodoActivo = Boolean(periodoActivo) || (
        !Array.isArray(listaPeriodos) &&
        !periodoVigenteDirecto &&
        response &&
        response.estado !== 'SIN_PERIODO'
      )

      const inicio = hayPeriodoActivo
        ? (periodoActivo?.plazoDocenteInicio ??
           periodoActivo?.plazo_docente_inicio ??
           response?.plazoDocenteInicio ??
           response?.plazo_docente_inicio ??
           null)
        : null
      const fin = hayPeriodoActivo
        ? (periodoActivo?.plazoDocenteFin ??
           periodoActivo?.plazo_docente_fin ??
           response?.plazoDocenteFin ??
           response?.plazo_docente_fin ??
           null)
        : null

      setPlazoDocente({ inicio, fin })

      if (availResult?.__error) {
        throw availResult.__error
      }

      const horarios = Array.isArray(response?.horarios) ? response.horarios : []
      setStatus({ estado: response?.estado, mensaje: response?.mensaje || 'No se recibió el estado del registro.' })
      setSchedules(horarios)
      setSavedSlots(savedSlotsFromSchedules(horarios))
      setSelectedSlots(new Set())
      return response
    } catch (error) {
      setLoadError(error.message || 'No fue posible consultar tu disponibilidad.')
      return null
    } finally {
      if (showLoading) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  useEffect(() => {
    const stopDragging = () => { dragMode.current = null }
    window.addEventListener('pointerup', stopDragging)
    window.addEventListener('pointercancel', stopDragging)
    return () => {
      window.removeEventListener('pointerup', stopDragging)
      window.removeEventListener('pointercancel', stopDragging)
    }
  }, [])

  const isPeriodEnabled = status?.estado === 'HABILITADO' && !loading && !saving
  const hasSavedSchedule = savedSlots.size > 0
  // Si ya hay un horario registrado, la tabla permanece bloqueada hasta que el docente pulse "Editar" en el resumen inferior.
  const canEdit = isPeriodEnabled && (!hasSavedSchedule || isEditing)
  const displaySlots = useMemo(
    () => (isEditing ? new Set(selectedSlots) : new Set([...savedSlots, ...selectedSlots])),
    [isEditing, savedSlots, selectedSlots]
  )
  const displayedIntervalCount = DAYS.reduce((total, day) => total + getIntervals(displaySlots, day.id).length, 0)
  const totalHours = displaySlots.size / 2
  const pendingIntervals = useMemo(() => DAYS.flatMap((day) =>
    getIntervals(selectedSlots, day.id).map((interval) => ({
      dia: day.value,
      dayLabel: day.label,
      ...interval,
    })),
  ), [selectedSlots])
  const savedIntervalLabels = toDisplayIntervals(schedules)

  const setSlot = (dayId, slot, selected) => {
    const key = slotKey(dayId, slot)
    if (!isEditing && savedSlots.has(key)) return
    setSelectedSlots((previous) => {
      const next = new Set(previous)
      if (selected) next.add(key)
      else next.delete(key)
      return next
    })
    setNotice(null)
  }

  const handlePointerDown = (event, day, slot) => {
    const key = slotKey(day.id, slot)
    if (!canEdit || (!isEditing && savedSlots.has(key))) return
    if (event.button !== 0 && event.pointerType === 'mouse') return
    event.preventDefault()
    dragMode.current = !selectedSlots.has(key)
    setSlot(day.id, slot, dragMode.current)
  }

  const handlePointerEnter = (day, slot) => {
    if (!canEdit || dragMode.current === null) return
    setSlot(day.id, slot, dragMode.current)
  }

  const handleKeyboardClick = (event, day, slot) => {
    const key = slotKey(day.id, slot)
    if (!canEdit || event.detail !== 0 || (!isEditing && savedSlots.has(key))) return
    setSlot(day.id, slot, !selectedSlots.has(key))
  }

  const handleStartEdit = () => {
    if (!isPeriodEnabled) return
    dragMode.current = null
    setSelectedSlots(new Set(savedSlots))
    setIsEditing(true)
    setNotice({
      type: 'info',
      text: 'Modo edición activado: se desbloquearon todas las casillas de la tabla (marcadas y no marcadas). Realiza tus ajustes y pulsa "Guardar cambios".',
    })
  }

  const handleCancelEdit = () => {
    dragMode.current = null
    setIsEditing(false)
    setSelectedSlots(new Set())
    setNotice(null)
  }

  const clearSelection = () => {
    dragMode.current = null
    setSelectedSlots(new Set())
    setNotice({
      type: 'success',
      text: isEditing
        ? 'Se desmarcaron todas las casillas de la tabla. Pulsa "Guardar cambios" para confirmar o "Cancelar edición" para revertir.'
        : 'Se limpiaron los intervalos nuevos que aún no se han guardado.',
    })
  }

  const handleEstablish = async () => {
    if (!canEdit) return
    if (!isEditing && !pendingIntervals.length) {
      setNotice({ type: 'info', text: 'Marca al menos un intervalo antes de guardar.' })
      return
    }

    setSaving(true)
    setNotice(null)

    if (isEditing) {
      try {
        const payload = pendingIntervals.map((interval) => ({
          dia: interval.dia,
          horaInicio: slotToApiTime(interval.start),
          horaFin: slotToApiTime(interval.end),
        }))
        await actualizarDisponibilidad(payload)
        await loadAvailability({ showLoading: false })
        setIsEditing(false)
        setSaving(false)
        setNotice({
          type: 'success',
          text: 'Horario actualizado correctamente. La tabla se ha vuelto a bloquear.',
        })
      } catch (error) {
        setSaving(false)
        setNotice({
          type: 'error',
          text: `No se pudo actualizar la disponibilidad: ${error.message || 'Error en el servidor.'}`,
        })
      }
      return
    }

    let savedCount = 0
    let errorMessage = null
    try {
      for (const interval of pendingIntervals) {
        await registrarDisponibilidad({
          dia: interval.dia,
          horaInicio: slotToApiTime(interval.start),
          horaFin: slotToApiTime(interval.end),
        })
        savedCount += 1
      }
    } catch (error) {
      errorMessage = error.message || 'No fue posible guardar todos los intervalos.'
    }

    await loadAvailability({ showLoading: false })
    setIsEditing(false)
    setSaving(false)

    if (errorMessage) {
      setNotice({
        type: 'error',
        text: savedCount
          ? `Se guardaron ${savedCount} ${savedCount === 1 ? 'intervalo' : 'intervalos'}. Los demás no se guardaron: ${errorMessage}`
          : `No se pudo guardar la disponibilidad: ${errorMessage}`,
      })
    } else {
      setNotice({
        type: 'success',
        text: `Se guardaron ${savedCount} ${savedCount === 1 ? 'intervalo' : 'intervalos'} de disponibilidad correctamente.`,
      })
    }
  }

  const noPeriod = status?.estado === 'SIN_PERIODO'
  const tienePlazoDefinido = Boolean(plazoDocente.inicio && plazoDocente.fin) && !noPeriod
  const plazoAbierto = useMemo(() => {
    if (!tienePlazoDefinido) return false
    if (status?.estado) return status.estado === 'HABILITADO'
    const now = Date.now()
    const startMs = new Date(plazoDocente.inicio).getTime()
    const endMs = new Date(plazoDocente.fin).getTime()
    return !Number.isNaN(startMs) && !Number.isNaN(endMs) && now >= startMs && now <= endMs
  }, [tienePlazoDefinido, status?.estado, plazoDocente.inicio, plazoDocente.fin])

  if (loading) {
    return (
      <section className="availability-page">
        <div className="availability-state-card" role="status"><LoaderCircle className="availability-spinner" size={22} /><span>Consultando el período y tus horarios registrados…</span></div>
      </section>
    )
  }

  const renderPlazoBanner = () => {
    if (!tienePlazoDefinido) {
      return (
        <div className="availability-deadline-card is-undefined" role="status">
          <div className="availability-deadline-header">
            <span className="availability-deadline-title">
              <Clock3 size={17} /> Plazo para digitar horarios
            </span>
          </div>
          <p className="availability-deadline-empty">
            El plazo para digitar horarios no ha sido definido
          </p>
        </div>
      )
    }

    return (
      <div
        className={`availability-deadline-card ${plazoAbierto ? 'is-open' : 'is-closed'}`}
        role="status"
      >
        <div className="availability-deadline-header">
          <span className="availability-deadline-title">
            <Clock3 size={17} /> Plazo para digitar horarios
          </span>
          <span className={`availability-deadline-badge ${plazoAbierto ? 'badge-open' : 'badge-closed'}`}>
            {plazoAbierto ? 'Abierto' : 'Cerrado'}
          </span>
        </div>
        <div className="availability-deadline-dates">
          <div className="availability-deadline-date-item">
            <span className="availability-deadline-label">Fecha de inicio:</span>
            <strong>{formatearFechaHora(plazoDocente.inicio)}</strong>
          </div>
          <div className="availability-deadline-date-item">
            <span className="availability-deadline-label">Fecha de fin:</span>
            <strong>{formatearFechaHora(plazoDocente.fin)}</strong>
          </div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <section className="availability-page">
        <div className="availability-heading">
          <div><div className="availability-eyebrow"><CalendarDays size={15} /> PLANIFICACIÓN DOCENTE</div><h1>Registra tu disponibilidad</h1><p>Consulta el estado del registro de disponibilidad.</p></div>
        </div>
        {renderPlazoBanner()}
        <div className="availability-state-card availability-state-error" role="alert"><AlertCircle size={20} /><span>{loadError}</span><button type="button" onClick={() => loadAvailability()} className="availability-retry-button"><RotateCcw size={15} /> Reintentar</button></div>
      </section>
    )
  }

  return (
    <section className="availability-page">
      <div className="availability-heading">
        <div>
          <div className="availability-eyebrow"><CalendarDays size={15} /> PLANIFICACIÓN DOCENTE</div>
          <h1>Registra tu disponibilidad</h1>
          <p>Selecciona los días y los intervalos en los que puedes impartir clases.</p>
        </div>
        <div className="availability-heading-icon" aria-hidden="true"><CalendarDays size={27} /></div>
      </div>

      {renderPlazoBanner()}

      {status?.mensaje && !noPeriod && (
        <div className={`availability-period-status ${status.estado === 'HABILITADO' ? 'is-enabled' : 'is-blocked'}`} role="status">
          {status.estado === 'HABILITADO' ? <Check size={18} /> : <Info size={18} />}
          <div><strong>{status.mensaje}</strong><span>{status.estado === 'HABILITADO' ? 'Puedes seleccionar y registrar nuevos intervalos durante el plazo habilitado.' : 'El registro de nuevos intervalos no está disponible en este momento.'}</span></div>
        </div>
      )}

      {notice && <div className={`availability-notice ${notice.type}`} role="status"><span className="availability-notice-icon">{notice.type === 'success' ? <Check size={17} /> : notice.type === 'error' ? <AlertCircle size={17} /> : <Info size={17} />}</span><span>{notice.text}</span><button type="button" aria-label="Cerrar aviso" onClick={() => setNotice(null)}>×</button></div>}

      {!noPeriod && (status?.estado === 'HABILITADO' || schedules.length > 0) && (
        <>
          <div className="availability-instructions">
            <span className="availability-info-icon"><Info size={18} /></span>
            <div><strong>¿Cómo funciona?</strong><span>Cada casilla representa 30 minutos. Haz clic o arrastra para seleccionar un intervalo continuo; las casillas consecutivas del mismo día se agrupan en un solo horario. Al guardar tu horario la tabla se bloquea; si necesitas modificar casillas marcadas o no marcadas, pulsa el botón <strong>“Editar”</strong> en el resumen inferior.</span></div>
          </div>

          <div className="availability-card">
            <div className="availability-card-top">
              <div className="availability-card-title"><span className="availability-card-title-icon"><Clock3 size={18} /></span><div><h2>Horario semanal</h2><p>Lunes a sábado · bloques de 30 minutos</p></div></div>
              <div className="availability-selected-count"><span /> {displayedIntervalCount} {displayedIntervalCount === 1 ? 'intervalo' : 'intervalos'} · {totalHours} h</div>
            </div>

            <div className="availability-table-scroll">
              <table className="availability-table">
                <thead><tr><th className="availability-time-heading" scope="col">HORA</th>{DAYS.map((day) => <th key={day.id} scope="col"><span className="availability-day-short">{day.short}</span><span className="availability-day-name">{day.label}</span></th>)}</tr></thead>
                <tbody>{SLOTS.map((slot) => {
                  const isHourStart = slot % 2 === 0
                  return <tr key={slot} className={isHourStart ? 'availability-hour-start' : 'availability-half-hour-row'}>
                    <th scope="row" className="availability-hour-label">{formatTime(slot)}</th>
                    {DAYS.map((day) => {
                      const key = slotKey(day.id, slot)
                      const isSaved = !isEditing && savedSlots.has(key)
                      const isPending = selectedSlots.has(key)
                      const selected = isSaved || isPending
                      return <td key={day.id}><button type="button" className={`availability-slot ${selected ? 'is-selected' : ''} ${isSaved ? 'is-saved' : ''} ${!canEdit ? 'is-readonly' : ''}`} aria-label={`${day.label}, ${formatTime(slot)} a ${formatTime(slot + 1)}${isSaved ? ', ya registrada' : isPending ? ', seleccionada para guardar' : ''}`} aria-pressed={selected} aria-disabled={!canEdit || isSaved} onPointerDown={(event) => handlePointerDown(event, day, slot)} onPointerEnter={() => handlePointerEnter(day, slot)} onClick={(event) => handleKeyboardClick(event, day, slot)} onContextMenu={(event) => event.preventDefault()} title={`${day.label}: ${formatTime(slot)} – ${formatTime(slot + 1)}${isSaved ? ' (guardado - pulsa Editar abajo para modificar)' : isPending ? ' (seleccionado)' : ''}`}>{selected && <Check size={12} strokeWidth={2.8} />}</button></td>
                    })}
                  </tr>
                })}</tbody>
              </table>
              <div className="availability-end-time"><span>9:00 p. m.</span><span>Fin del horario disponible</span></div>
            </div>

            <div className="availability-legend"><span className="availability-legend-swatch" /><span>Horario registrado</span><span className="availability-legend-pending" /><span>{isEditing ? 'Casilla en edición (marcada)' : 'Nuevo intervalo pendiente'}</span><span className="availability-legend-empty" /><span>Sin seleccionar</span></div>

            {canEdit && (
              <div className="availability-actions">
                <div className="availability-actions-help">
                  {isEditing
                    ? `Modo edición activo: ${pendingIntervals.length} ${pendingIntervals.length === 1 ? 'intervalo' : 'intervalos'} · ${(selectedSlots.size / 2)} horas seleccionadas.`
                    : selectedSlots.size
                      ? `${pendingIntervals.length} ${pendingIntervals.length === 1 ? 'intervalo nuevo' : 'intervalos nuevos'} · ${(selectedSlots.size / 2)} horas pendientes de guardar.`
                      : 'Aún no has marcado nuevos intervalos.'}
                </div>
                <div className="availability-action-buttons">
                  {isEditing && (
                    <button type="button" className="availability-clear-button" onClick={handleCancelEdit} disabled={saving}>
                      <X size={17} /> Cancelar edición
                    </button>
                  )}
                  <button type="button" className="availability-clear-button" onClick={clearSelection} disabled={!selectedSlots.size || saving}>
                    <Eraser size={17} /> Limpiar selección
                  </button>
                  <button type="button" className="availability-set-button" onClick={handleEstablish} disabled={saving}>
                    {saving ? <LoaderCircle className="availability-spinner" size={17} /> : <Check size={17} />} {saving ? 'Guardando…' : (isEditing ? 'Guardar cambios' : 'Guardar disponibilidad')}
                  </button>
                </div>
              </div>
            )}
            {!canEdit && (
              <div className="availability-readonly-note">
                <Info size={15} />
                <span>
                  {hasSavedSchedule && isPeriodEnabled
                    ? 'La tabla está bloqueada porque ya registraste tu horario. Pulsa el botón "Editar" en el resumen de abajo para desbloquear todas las casillas.'
                    : 'Vista de consulta: no se pueden registrar ni editar intervalos en este momento.'}
                </span>
              </div>
            )}
          </div>

          {savedIntervalLabels.length > 0 && (
            <div className="availability-saved-summary">
              <div className="availability-saved-summary-header">
                <strong>Horarios registrados en este período</strong>
                {isPeriodEnabled && !isEditing && (
                  <button
                    type="button"
                    className="availability-edit-button"
                    onClick={handleStartEdit}
                  >
                    <Edit3 size={15} /> Editar
                  </button>
                )}
              </div>
              <ul>
                {savedIntervalLabels.map((item, index) => (
                  <li key={`${item.label}-${item.start}-${item.end}-${index}`}>
                    <span>{item.label}</span>
                    <span>{item.start} – {item.end}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      {noPeriod && <div className="availability-state-card availability-state-error"><Info size={20} /><div><strong>No hay un período académico vigente</strong><span>Por ahora no puedes registrar disponibilidades. Intenta nuevamente cuando se habilite un período.</span></div></div>}
      {!noPeriod && schedules.length === 0 && status?.estado !== 'HABILITADO' && <div className="availability-state-card"><Info size={20} /><div><strong>Sin horarios registrados</strong><span>No tienes disponibilidades registradas para el período vigente.</span></div></div>}

      <p className="availability-footnote"><RotateCcw size={14} /> Los nuevos intervalos se guardan en el servidor al pulsar “Guardar disponibilidad”. Los horarios existentes se muestran como consulta; la eliminación o edición de horarios requiere endpoints adicionales en el backend.</p>
    </section>
  )
}
