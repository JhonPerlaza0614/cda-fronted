// Servicio de Docentes (HU-026 y HU-022)
// Misma URL base que usa el login (ya incluye /api) y mismo token de sesión.
const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api').replace(/\/+$/, '')
const SESSION_KEY = 'cda.auth.session'

function authHeaders() {
    try {
        const raw = window.sessionStorage.getItem(SESSION_KEY)
        const token = raw ? JSON.parse(raw)?.token : null
        return token ? { Authorization: `Bearer ${token}` } : {}
    } catch {
        return {}
    }
}

// Error con status y cuerpo, para que la vista pueda distinguir 400 / 409 / 500
export class ApiError extends Error {
    constructor(message, status, body) {
        super(message)
        this.name = 'ApiError'
        this.status = status
        this.body = body
    }
}

async function request(path, options = {}) {
    let res
    try {
        res = await fetch(`${BACKEND_URL}${path}`, {
            headers: { 'Content-Type': 'application/json', ...authHeaders() },
            ...options
        })
    } catch {
        throw new ApiError('No se pudo conectar con el servidor', 0, null)
    }

    let body = null
    try {
        body = await res.json()
    } catch {
        // respuesta sin cuerpo JSON
    }

    if (!res.ok) {
        throw new ApiError(body?.message || `Error ${res.status}`, res.status, body)
    }
    return body
}

// GET /api/docentes
export const getDocentes = () => request('/docentes')

// POST /api/docentes
export const createDocente = (payload) =>
    request('/docentes', { method: 'POST', body: JSON.stringify(payload) })

// PUT /api/docentes/{id}
export const updateDocente = (id, payload) =>
    request(`/docentes/${id}`, { method: 'PUT', body: JSON.stringify(payload) })

// fetch sin Content-Type JSON (multipart o binario), con el token de sesión
async function rawFetch(path, options = {}) {
    try {
        return await fetch(`${BACKEND_URL}${path}`, {
            ...options,
            headers: { ...authHeaders(), ...(options.headers || {}) }
        })
    } catch {
        throw new ApiError('No se pudo conectar con el servidor', 0, null)
    }
}

async function errorDe(res) {
    let body = null
    try {
        body = await res.json()
    } catch {
        // respuesta sin cuerpo JSON
    }
    return new ApiError(body?.message || `Error ${res.status}`, res.status, body)
}

// GET /api/docentes/me (HU-022). El backend identifica al docente por el token de sesión.
export const getMiPerfil = () => request('/docentes/me')

// PUT /api/docentes/me/contacto (HU-015): correo personal y teléfono
export const updateMiContacto = (payload) =>
    request('/docentes/me/contacto', { method: 'PUT', body: JSON.stringify(payload) })

// PUT /api/docentes/me/foto (HU-015): multipart con la parte "foto".
// Sin Content-Type: el navegador lo pone con el boundary del FormData.
export async function uploadMiFoto(file) {
    const form = new FormData()
    form.append('foto', file)
    const res = await rawFetch('/docentes/me/foto', { method: 'PUT', body: form })
    if (!res.ok) throw await errorDe(res)
    return res.json()
}

// GET /api/docentes/me/foto (HU-015): devuelve un Blob, o null si no hay foto activa
export async function getMiFoto() {
    const res = await rawFetch('/docentes/me/foto')
    if (res.status === 404) return null
    if (!res.ok) throw await errorDe(res)
    return res.blob()
}

// DELETE /api/docentes/me/foto (HU-015): desactiva la foto (204)
export async function deleteMiFoto() {
    const res = await rawFetch('/docentes/me/foto', { method: 'DELETE' })
    if (!res.ok) throw await errorDe(res)
}

// GET /api/coordinadores/me?correo=...
export const getMiPerfilCoordinador = (correo) =>
    request(`/coordinadores/me?correo=${encodeURIComponent(correo)}`)