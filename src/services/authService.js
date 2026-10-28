const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api').replace(/\/+$/, '')
const SESSION_KEY = 'cda.auth.session'
let volatileSession = null

function readSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    if (!raw) {
      return volatileSession?.expiresAt > Date.now() ? volatileSession : null
    }

    const session = JSON.parse(raw)
    if (!session?.token || !session?.expiresAt || session.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(SESSION_KEY)
      return null
    }

    return session
  } catch {
    return volatileSession?.expiresAt > Date.now() ? volatileSession : null
  }
}

function getErrorMessage(body, status, statusText) {
  if (body?.detail) return body.detail
  if (body?.message) return body.message
  if (body?.error) return body.error
  if (body?.errors) {
    return Object.entries(body.errors)
      .map(([field, message]) => `${field}: ${message}`)
      .join(', ')
  }

  if (status === 401) return 'Google no pudo validar tu inicio de sesión. Inténtalo de nuevo.'
  if (status === 403) return 'Tu cuenta no está autorizada para ingresar como docente.'
  return `No se pudo iniciar sesión (${status || statusText || 'error desconocido'}).`
}

export async function loginWithGoogle(credential) {
  if (!credential) {
    throw new Error('Google no devolvió una credencial. Inténtalo de nuevo.')
  }

  let response
  try {
    response = await fetch(`${BACKEND_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential }),
    })
  } catch {
    throw new Error('No se pudo conectar con el backend. Verifica que Spring Boot esté ejecutándose en http://localhost:8080.')
  }

  let body = null
  try {
    body = await response.json()
  } catch {
    // La respuesta del backend puede no contener JSON.
  }

  if (!response.ok) {
    throw new Error(getErrorMessage(body, response.status, response.statusText))
  }

  if (!body?.token) {
    throw new Error('El backend respondió sin un token de acceso. Revisa la respuesta del endpoint de autenticación.')
  }

  const expiresInSeconds = Number(body.expiresInSeconds) > 0 ? Number(body.expiresInSeconds) : 3600
  const session = {
    token: body.token,
    expiresAt: Date.now() + expiresInSeconds * 1000,
    user: {
      id: body.id,
      nombre: body.nombre,
      apellido: body.apellido,
      email: body.email,
      rol: body.rol,
      rolNombre: body.rol === 3 ? 'Docente' : 'Usuario',
    },
  }

  volatileSession = session
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Se conserva la sesión en memoria si el navegador bloquea sessionStorage.
  }

  return session
}

export function getCurrentSession() {
  return readSession()
}

export function getAuthToken() {
  return readSession()?.token || null
}

export function logout() {
  volatileSession = null
  try {
    window.sessionStorage.removeItem(SESSION_KEY)
  } catch {
    // No es necesario realizar ninguna acción adicional al cerrar sesión.
  }
}