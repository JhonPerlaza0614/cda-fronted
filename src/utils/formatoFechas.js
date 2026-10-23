/**
 * Utilidades de formato de fechas para la pantalla de Resoluciones.
 * Formato de salida: DD/MM/YYYY (y "DD/MM/YYYY HH:mm" cuando hay hora).
 *
 * - Fechas con hora (ISO-8601 con zona): se muestran en America/Bogota.
 * - Fechas "YYYY-MM-DD": se formatean SIN conversión de zona horaria
 *   (se reordenan los componentes del texto; nunca pasan por la zona local).
 */

const VACIO = '—'

// formatToParts garantiza el orden DD/MM/YYYY HH:mm sin depender de la versión de ICU.
const partesBogota = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/**
 * Formatea una fecha con hora (ISO-8601 con zona) en America/Bogota.
 * @param {string | null | undefined} iso
 * @returns {string} p. ej. "01/03/2026 08:00", o "—" si es nula/inválida
 */
export function formatearFechaHora(iso) {
  if (!iso) return VACIO
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return VACIO

  const p = Object.fromEntries(
    partesBogota.formatToParts(fecha).map((x) => [x.type, x.value])
  )
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`
}

/**
 * Formatea una fecha "YYYY-MM-DD" sin conversión de zona horaria.
 * @param {string | null | undefined} ymd
 * @returns {string} p. ej. "01/03/2026", o "—" si es nula/inválida
 */
export function formatearFecha(ymd) {
  if (!ymd) return VACIO
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(ymd).trim())
  if (!m) return VACIO

  const anio = Number(m[1])
  const mes = Number(m[2])
  const dia = Number(m[3])

  // Rechaza fechas imposibles (p. ej. 2026-02-31) validando en UTC.
  const control = new Date(Date.UTC(anio, mes - 1, dia))
  if (control.getUTCMonth() !== mes - 1 || control.getUTCDate() !== dia) return VACIO

  return `${m[3]}/${m[2]}/${m[1]}`
}