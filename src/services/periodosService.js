import { requestBackend } from './academicService'

export const ESTADOS_PERIODO = {
  VIGENTE: 'VIGENTE',
  HISTORIAL: 'HISTORIAL',
  DESACTIVADO: 'DESACTIVADO',
}

export const ESTADO_LABELS = {
  VIGENTE: 'Vigente',
  HISTORIAL: 'Historial',
  DESACTIVADO: 'Desactivado',
}

function normalizarEstado(periodo) {
  const raw = typeof periodo?.estado === 'string' ? periodo.estado.toUpperCase() : ''
  if (raw === 'HISTORICO') return ESTADOS_PERIODO.HISTORIAL
  if (Object.hasOwn(ESTADO_LABELS, raw)) return raw
  return periodo?.vigente ? ESTADOS_PERIODO.VIGENTE : ESTADOS_PERIODO.HISTORIAL
}

export function adaptarPeriodo(periodo) {
  const estado = normalizarEstado(periodo)
  return {
    ...periodo,
    estado,
    vigente: estado === ESTADOS_PERIODO.VIGENTE,
    plazoCoordinadorInicio: periodo.plazoCoordinadorInicio ?? null,
    plazoCoordinadorFin: periodo.plazoCoordinadorFin ?? null,
    enlaceResolucion: periodo.enlaceResolucion ?? null,
  }
}

export function ordenarPeriodos(periodos) {
  return [...periodos].sort((a, b) =>
    String(b.fechaInicioSemestre).localeCompare(String(a.fechaInicioSemestre))
  )
}

export async function getPeriodos() {
  const data = await requestBackend('/periodos')
  if (!Array.isArray(data)) return []
  return ordenarPeriodos(data.map(adaptarPeriodo))
}

export async function desactivarPeriodo(id) {
  return requestBackend(`/periodos/${id}`, { method: 'DELETE' })
}