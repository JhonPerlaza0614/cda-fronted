import { requestBackend } from './academicService'
import { getAuthToken } from './authService'

/**
 * Servicio de Resoluciones (períodos académicos).
 * Contrato (BACKEND_URL ya incluye /api):
 *   GET /periodos        -> [ResumenPeriodo]
 *   GET /periodos/{id}   -> PeriodoDetalle | 404 { message }
 *
 * Requiere sesión: envía "Authorization: Bearer <token>".
 * Los errores llevan `error.status` (401 sin sesión/expirada, 403 sin permiso).
 * Sin fallback a Supabase: el error llega a la vista.
 */

function opcionesAutenticadas() {
  const token = getAuthToken()
  if (!token) {
    // Sin sesión vigente: no se llama al backend.
    const error = new Error('Tu sesión expiró. Inicia sesión de nuevo.')
    error.status = 401
    throw error
  }
  return { headers: { Authorization: `Bearer ${token}` } }
}

/**
 * @returns {Promise<Array<{
 *   id: number|string, nombre: string, estado: 'VIGENTE'|'HISTORICO'|'DESACTIVADO',
 *   inicioSemestre: string, finSemestre: string, fechaDesactivacion: string|null
 * }>>}
 */
export async function getPeriodos() {
  const data = await requestBackend('/periodos', opcionesAutenticadas())
  if (!Array.isArray(data)) {
    throw new Error('Respuesta inesperada del servidor al listar períodos')
  }
  return data
}

/**
 * @param {number|string} id
 * @returns {Promise<object>} PeriodoDetalle
 */
export async function getPeriodo(id) {
  if (id === undefined || id === null || id === '') {
    throw new Error('Falta el identificador del período')
  }
  const data = await requestBackend(`/periodos/${encodeURIComponent(id)}`, opcionesAutenticadas())
  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta inesperada del servidor al obtener el período')
  }
  return data
}