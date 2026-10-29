const ZONA = 'America/Bogota'

export function formatearFecha(valor) {
  if (!valor) return ''
  const [anio, mes, dia] = String(valor).slice(0, 10).split('-')
  if (!anio || !mes || !dia) return String(valor)
  return `${dia}/${mes}/${anio}`
}

const formateadorHora = new Intl.DateTimeFormat('es-CO', {
  timeZone: ZONA,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})

export function formatearFechaHora(valor, sinValor = 'Sin plazo definido') {
  if (!valor) return sinValor
  const fecha = new Date(valor)
  if (Number.isNaN(fecha.getTime())) return sinValor

  const partes = Object.fromEntries(
    formateadorHora.formatToParts(fecha).map((p) => [p.type, p.value])
  )
  return `${partes.day}/${partes.month}/${partes.year} ${partes.hour}:${partes.minute} ${partes.dayPeriod ?? ''}`.trim()
}