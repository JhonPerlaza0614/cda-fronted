// Servicio de Docentes (HU-026 y HU-022)
// Misma URL base que usa el login (ya incluye /api) y mismo token de sesión.
import { getAuthToken, notifySessionExpired } from './authService'
import { supabase } from '../supabase'

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api').replace(/\/+$/, '')

function authHeaders() {
    const token = getAuthToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
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
        if (res.status === 401) {
            notifySessionExpired('Tu sesión ha expirado o ya no es válida. Inicia sesión de nuevo.')
        }
        throw new ApiError(body?.message || `Error ${res.status}`, res.status, body)
    }
    return body
}

// GET /api/docentes
export const getDocentes = () => request('/docentes')

// Última evaluación registrada en el período anterior para una asignatura.
export async function getEvaluacionesDocentes(periodoId, codeCourse) {
    try {
        return await request(`/docentes/evaluaciones?periodoId=${encodeURIComponent(periodoId)}&codeCourse=${encodeURIComponent(codeCourse)}`)
    } catch (err) {
        console.warn('Backend no disponible para evaluaciones docentes, fallback Supabase:', err.message)
        const { data: periodos, error: periodosError } = await supabase
            .from('periodos_academicos')
            .select('id, nombre, fecha_inicio_semestre')
            .order('fecha_inicio_semestre', { ascending: false })
        if (periodosError) throw periodosError
        const actual = (periodos || []).find(p => String(p.id) === String(periodoId))
        const anterior = (periodos || []).find(p => actual
            && p.fecha_inicio_semestre < actual.fecha_inicio_semestre)
        if (!anterior) return []

        const { data, error } = await supabase
            .from('evaluaciones_docentes')
            .select('docente_id, code_course, periodo_id, calificacion')
            .eq('periodo_id', anterior.id)
            .eq('code_course', codeCourse)
        if (error) throw error
        return (data || []).map(evaluacion => ({
            ...evaluacion,
            periodo_nombre: anterior.nombre
        }))
    }
}

export const getEvaluacionesPorDocente = (docenteId, periodoId) =>
    request(`/docentes/${docenteId}/evaluaciones?periodoId=${encodeURIComponent(periodoId)}`)

export const guardarEvaluacionDocente = (docenteId, periodoId, codeCourse, calificacion) =>
    request(`/docentes/${docenteId}/evaluacion`, {
        method: 'PUT',
        body: JSON.stringify({
            periodoId: Number(periodoId),
            codeCourse,
            calificacion: Number(calificacion),
        }),
    })

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
    if (res.status === 401) {
        notifySessionExpired('Tu sesión ha expirado o ya no es válida. Inicia sesión de nuevo.')
    }
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

// PUT /api/docentes/me/contacto (HU-015): correo personal, teléfono, celular y facultad
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

// GET /api/carga/docentes/{id}?periodoId= (carga horaria de un docente en un período)
export const getCargaDocente = (docenteId, periodoId) =>
    request(`/carga/docentes/${docenteId}?periodoId=${periodoId}`)

// GET /api/carga/docentes?periodoId= (totales de todos los docentes en un período)
export const getCargaPorPeriodo = (periodoId) =>
    request(`/carga/docentes?periodoId=${periodoId}`)

// GET /api/carga/mis-cursos (el docente autenticado, período vigente)
export const getMisCursos = () => request('/carga/mis-cursos')

// GET /api/coordinadores/me?correo=...
export const getMiPerfilCoordinador = (correo) =>
    request(`/coordinadores/me?correo=${encodeURIComponent(correo)}`)

// Acceso extraordinario a la disponibilidad (solo admin)
// GET devuelve el acceso vigente o null (204)
export const getAccesoExtraordinario = (docenteId) =>
    request(`/admin/docentes/${docenteId}/acceso-extraordinario`)

// payload: { fecha_fin: ISO, motivo }
export const habilitarAccesoExtraordinario = (docenteId, payload) =>
    request(`/admin/docentes/${docenteId}/acceso-extraordinario`, {
        method: 'POST',
        body: JSON.stringify(payload)
    })

export const revocarAccesoExtraordinario = (docenteId) =>
    request(`/admin/docentes/${docenteId}/acceso-extraordinario`, { method: 'DELETE' })

