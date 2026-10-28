import { getAuthToken } from './authService'

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
    const message = body?.message || body?.detail || body?.error || `Error ${response.status} al consultar la disponibilidad.`
    throw new DisponibilidadApiError(message, response.status, body)
  }

  return body
}

export function consultarMiDisponibilidad() {
  return request('/disponibilidades/me')
}

export function registrarDisponibilidad({ dia, horaInicio, horaFin }) {
  return request('/disponibilidades/me', {
    method: 'POST',
    body: JSON.stringify({ dia, horaInicio, horaFin }),
  })
}