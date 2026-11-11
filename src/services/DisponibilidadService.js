import { getAuthToken, notifySessionExpired } from './authService'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api').replace(/\/+$/, '')

export class DisponibilidadApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message)
    this.name = 'DisponibilidadApiError'
    this.status = status
    this.body = body
  }
}

async function request(path, options = {}) {
  const token = getAuthToken()
  let response

  try {
    response = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    })
  } catch {
    throw new DisponibilidadApiError('No se pudo conectar con el servidor. Verifica que el backend esté disponible.')
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // Puede haber respuestas sin cuerpo.
  }

  if (!response.ok) {
    if (response.status === 401) {
      notifySessionExpired('Tu sesión ha expirado o ya no es válida. Inicia sesión de nuevo.')
    }
    const message = body?.message || body?.detail || body?.error || `Error ${response.status} al consultar la disponibilidad.`
    throw new DisponibilidadApiError(message, response.status, body)
  }

  return body
}

export function consultarMiDisponibilidad() {
  return request('/disponibilidades/me')
}

export async function consultarPeriodoVigente() {
  try {
    return await request('/periodos/vigente')
  } catch {
    return null
  }
}

export function registrarDisponibilidad({ dia, horaInicio, horaFin }) {
  return request('/disponibilidades/me', {
    method: 'POST',
    body: JSON.stringify({ dia, horaInicio, horaFin }),
  })
}

export function actualizarDisponibilidad(intervalos) {
  return request('/disponibilidades/me', {
    method: 'PUT',
    body: JSON.stringify(intervalos),
  })
}

// Operaciones administrativas sobre el docente seleccionado en Plantilla.
// docenteId debe ser el valor de docentes.id (no usuarios.id).
function rutaDisponibilidadDocente(docenteId) {
  if (docenteId === null || docenteId === undefined || !Number.isInteger(Number(docenteId)) || Number(docenteId) <= 0) {
    throw new DisponibilidadApiError('El ID del docente seleccionado no es válido.')
  }
  return `/admin/docentes/${encodeURIComponent(Number(docenteId))}/disponibilidades`
}

export function consultarDisponibilidadDocente(docenteId) {
  return request(rutaDisponibilidadDocente(docenteId))
}

export function registrarDisponibilidadDocente(docenteId, { dia, horaInicio, horaFin }) {
  return request(rutaDisponibilidadDocente(docenteId), {
    method: 'POST',
    body: JSON.stringify({ dia, horaInicio, horaFin }),
  })
}

export function actualizarDisponibilidadDocente(docenteId, intervalos) {
  return request(rutaDisponibilidadDocente(docenteId), {
    method: 'PUT',
    body: JSON.stringify(intervalos),
  })
}

export async function consultarDisponibilidadesPeriodo(periodoId) {
  try {
    return await request(`/disponibilidades/periodo/${periodoId}`)
  } catch (error) {
    console.warn('Error al consultar disponibilidades del período:', error)
    return {}
  }
}