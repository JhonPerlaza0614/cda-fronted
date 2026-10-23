// Servicio de Docentes (HU-026 y HU-022)
// Ajusta API_URL si ya usas otra variable de entorno para la URL del backend.
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'

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
        res = await fetch(`${API_URL}${path}`, {
            headers: { 'Content-Type': 'application/json' },
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

// POST /api/docentes
export const createDocente = (payload) =>
    request('/api/docentes', { method: 'POST', body: JSON.stringify(payload) })

// PUT /api/docentes/{id}
export const updateDocente = (id, payload) =>
    request(`/api/docentes/${id}`, { method: 'PUT', body: JSON.stringify(payload) })

// GET /api/docentes/me?correo=...
export const getMiPerfil = (correo) =>
    request(`/api/docentes/me?correo=${encodeURIComponent(correo)}`)