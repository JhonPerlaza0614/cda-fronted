import { requestBackend } from './academicService'

/**
 * HU-058: consulta de la bitácora (solo lectura).
 * Contrato: docs/contratos/HU-058.md del backend, GET /api/bitacora.
 * Respuesta: { contenido, pagina, tamano, totalElementos, totalPaginas }.
 */
export async function consultarBitacora({ usuario, entidad, periodoId, desde, hasta, pagina = 0, tamano = 20 } = {}) {
  const params = new URLSearchParams()
  if (usuario?.trim()) params.set('usuario', usuario.trim())
  if (entidad?.trim()) params.set('entidad', entidad.trim())
  if (periodoId) params.set('periodoId', periodoId)
  if (desde) params.set('desde', desde)
  if (hasta) params.set('hasta', hasta)
  params.set('pagina', String(pagina))
  params.set('tamano', String(tamano))
  return requestBackend(`/bitacora?${params.toString()}`)
}
