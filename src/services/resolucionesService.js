import { requestBackend } from './academicService'

/**
 * Servicio de Resoluciones (períodos académicos).
 * Toda la lectura de datos de la pantalla pasa por este archivo,
 * para poder sustituirlo o simularlo sin tocar la vista.
 *
 * Contrato (BACKEND_URL ya incluye /api):
 *   GET /periodos        -> [ResumenPeriodo]
 *   GET /periodos/{id}   -> PeriodoDetalle | 404 { message }
 *
 * A diferencia de los servicios de programas y asignaturas, aquí NO hay
 * fallback a Supabase: si el backend falla, el error llega a la vista
 * para mostrar "No se pudo cargar" con "Reintentar".
 */

/**
 * @returns {Promise<Array<{
 *   id: number|string, nombre: string, estado: 'VIGENTE'|'HISTORICO'|'DESACTIVADO',
 *   inicioSemestre: string, finSemestre: string, fechaDesactivacion: string|null
 * }>>}
 */
export async function getPeriodos() {
  const data = await requestBackend('/periodos')
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
  const data = await requestBackend(`/periodos/${encodeURIComponent(id)}`)
  if (!data || typeof data !== 'object') {
    throw new Error('Respuesta inesperada del servidor al obtener el período')
  }
  return data
}