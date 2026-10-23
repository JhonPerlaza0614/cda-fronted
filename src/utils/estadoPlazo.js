/**
 * Regla Abierto/Cerrado de los plazos de un período académico.
 * Función pura: no consulta el reloj salvo por el valor por defecto de `ahora`.
 * DEPENDE-HU:plazos (la estructura final de los plazos puede cambiar).
 */

export const ESTADO_PLAZO = {
  ABIERTO: 'Abierto',
  CERRADO: 'Cerrado',
}

/**
 * @param {{ inicio: string, fin: string } | null | undefined} plazo  ISO-8601 con zona
 * @param {string} estadoPeriodo  "VIGENTE" | "HISTORICO" | "DESACTIVADO"
 * @param {Date} [ahora=new Date()]
 * @returns {'Abierto' | 'Cerrado'}
 */
export function estadoPlazo(plazo, estadoPeriodo, ahora = new Date()) {
  // Un período desactivado cierra todos sus plazos sin alterar las fechas originales.
  if (estadoPeriodo === 'DESACTIVADO') return ESTADO_PLAZO.CERRADO

  if (!plazo) return ESTADO_PLAZO.CERRADO

  const inicio = new Date(plazo.inicio).getTime()
  const fin = new Date(plazo.fin).getTime()
  const t = ahora instanceof Date ? ahora.getTime() : new Date(ahora).getTime()

  // Fechas ausentes o inválidas: se considera cerrado.
  if (Number.isNaN(inicio) || Number.isNaN(fin) || Number.isNaN(t)) {
    return ESTADO_PLAZO.CERRADO
  }

  // Bordes inclusivos: inicio <= ahora <= fin
  return t >= inicio && t <= fin ? ESTADO_PLAZO.ABIERTO : ESTADO_PLAZO.CERRADO
}