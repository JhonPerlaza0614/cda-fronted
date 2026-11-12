const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api').replace(/\/+$/, '')
const SESSION_KEY = 'cda.auth.session'
const ROLES = { 1: 'Administrador', 2: 'Coordinador', 3: 'Docente' }
const resolveRolNombre = (rol, fallback) => ROLES[Number(rol)] || (fallback && fallback !== 'Usuario' ? fallback : 'Usuario')
let volatileSession = null

/**
 * Decodifica la marca de tiempo de expiración (claim `exp`) del JWT en milisegundos.
 */
function decodeJwtExp(token) {
  try {
    const parts = token?.split('.')
    if (parts && parts.length === 3) {
      const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
      if (typeof payload.exp === 'number') {
        return payload.exp * 1000
      }
    }
  } catch {
    // Si no es un JWT estándar legible en base64, se usa el fallback de expiresAt
  }
  return null
}

function readSession() {
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY)
    let session = null
    if (raw) {
      session = JSON.parse(raw)
    } else if (volatileSession) {
      session = volatileSession
    }

    if (!session?.token) {
      logout()
      return null
    }

    const jwtExp = decodeJwtExp(session.token)
    const effectiveExpiresAt = jwtExp || session.expiresAt

    if (!effectiveExpiresAt || effectiveExpiresAt <= Date.now()) {
      logout()
      return null
    }

    session.expiresAt = effectiveExpiresAt
    if (session.user) session.user.rolNombre = resolveRolNombre(session.user.rol, session.user.rolNombre)
    return session
  } catch {
    logout()
    return null
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

/**
 * Notifica que la sesión expiró o fue rechazada con 401 en el backend,
 * limpiando el almacenamiento y redirigiendo automáticamente a la pantalla de login.
 */
export function notifySessionExpired(message = 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.') {
  logout()
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('auth:unauthorized', { detail: { message } }))
  }
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

  const jwtExp = decodeJwtExp(body.token)
  const expiresInSeconds = Number(body.expiresInSeconds) > 0 ? Number(body.expiresInSeconds) : 3600
  const expiresAt = jwtExp || (Date.now() + expiresInSeconds * 1000)

  const session = {
    token: body.token,
    expiresAt,
    user: {
      id: body.id,
      nombre: body.nombre,
      apellido: body.apellido,
      email: body.email,
      rol: body.rol,
      rolNombre: resolveRolNombre(body.rol, body.rolNombre),
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

/**
 * Indica si la URL apunta a la API del backend (BACKEND_URL). Funciona con una URL absoluta
 * (http://localhost:8080/api) o relativa (/<subdominio>/api en SIA).
 */
function esPeticionAlBackend(url) {
  try {
    const base = window.location.href
    const destino = new URL(url, base)
    const api = new URL(BACKEND_URL, base)
    const rutaApi = api.pathname.replace(/\/+$/, '')
    return destino.origin === api.origin
      && (destino.pathname === rutaApi || destino.pathname.startsWith(`${rutaApi}/`))
  } catch {
    return false
  }
}

// Interceptor global: un 401 de la API del backend cierra la sesión y lleva al login.
// Solo cuenta el backend: un 401 de otro servicio (por ejemplo, el respaldo directo a Supabase,
// que responde 401 cuando la clave pública no tiene permiso sobre una tabla) no significa que
// el token de la aplicación haya vencido, y antes cerraba la sesión del coordinador en «Programas».
if (typeof window !== 'undefined' && window.fetch && !window.__cdaAuthInterceptorInstalled) {
  window.__cdaAuthInterceptorInstalled = true
  const originalFetch = window.fetch
  window.fetch = async function (...args) {
    const response = await originalFetch.apply(this, args)
    if (response.status === 401) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0]?.url || String(args[0] || ''))
      // No disparar en el propio flujo de autenticación ni en servicios externos
      if (esPeticionAlBackend(url) && !url.includes('/auth/')) {
        notifySessionExpired('Tu sesión ha expirado o ya no es válida. Inicia sesión de nuevo.')
      }
    }
    return response
  }
}
