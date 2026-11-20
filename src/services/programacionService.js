import { supabase } from '../supabase'
import { requestBackend, requestBackendBlob } from './academicService'

export async function generarProgramacion(periodoId, sobrescribir = false) {
  return await requestBackend(`/programacion/generar?periodoId=${periodoId}`, {
    method: 'POST',
    body: JSON.stringify({ sobrescribir })
  })
}

export async function getProgramacion(periodoId, { codeProgram = '', codeCourse = '', jornada = '' } = {}) {
  try {
    const params = new URLSearchParams({ periodoId: String(periodoId) })
    if (codeProgram) params.append('codeProgram', codeProgram)
    if (codeCourse) params.append('codeCourse', codeCourse)
    if (jornada) params.append('jornada', jornada)
    return await requestBackend(`/programacion?${params.toString()}`)
  } catch (error) {
    if (error?.status) throw error
    let q = supabase
      .from('cursos_programacion')
      .select('*, programas(name_program)')
      .eq('periodo_id', periodoId)
    if (codeProgram) q = q.eq('code_program', codeProgram)
    if (codeCourse) q = q.eq('code_course', codeCourse)
    if (jornada) q = q.eq('jornada', jornada)
    const { data, error: sbError } = await q.order('semestre', { ascending: true })
    if (sbError) throw sbError
    return (data || []).map(c => ({
      id: c.id,
      periodoId: c.periodo_id,
      codeProgram: c.code_program,
      nombrePrograma: c.programas?.name_program || c.code_program,
      codeCourse: c.code_course,
      nombreAsignatura: c.nombre_asignatura,
      credits: c.credits,
      semestre: c.semestre,
      jornada: c.jornada,
      numeroResolucion: c.numero_resolucion,
      grupo: c.grupo,
      cupos: c.cupos ?? null,
      idDocente: c.id_docente,
      estado: c.estado
    }))
  }
}

export async function getAvanceProgramacion(periodoId) {
  return requestBackend(`/programacion/avance?periodoId=${encodeURIComponent(periodoId)}`)
}

export async function descargarPendientesProgramacion(periodoId) {
  return requestBackendBlob(`/programacion/avance/excel?periodoId=${encodeURIComponent(periodoId)}`)
}

export async function descargarProgramacionExcel(periodoId, codeProgram) {
  let endpoint = `/programacion/exportar-excel?periodoId=${encodeURIComponent(periodoId)}`
  if (codeProgram) {
    endpoint += `&codeProgram=${encodeURIComponent(codeProgram)}`
  }
  return requestBackendBlob(endpoint)
}

export async function getResumenProgramacion(periodoId) {
  try {
    return await requestBackend(`/programacion/resumen?periodoId=${periodoId}`)
  } catch (error) {
    if (error?.status) throw error
    const { data, error: sbError } = await supabase
      .from('cursos_programacion')
      .select('code_program, programas(name_program)')
      .eq('periodo_id', periodoId)
    if (sbError) throw sbError
    const grouped = {}
    for (const c of (data || [])) {
      const code = c.code_program
      const nombre = c.programas?.name_program || code
      if (!grouped[code]) grouped[code] = { codeProgram: code, nombrePrograma: nombre, totalCursos: 0 }
      grouped[code].totalCursos++
    }
    const programas = Object.values(grouped)
    return {
      totalCursos: (data || []).length,
      programas,
      mensaje: 'Resumen consolidado de la programación'
    }
  }
}

// HU-047: ajustes del administrador sobre la programación generada.
// Contrato: docs/contratos/HU-047.md del backend.

/** Cómo quedarían los grupos de la asignatura si se excluye el curso (no guarda nada). */
export async function getVistaPreviaExclusion(cursoId) {
  return requestBackend(`/programacion/cursos/${cursoId}/exclusion/vista-previa`)
}

/** Excluye el curso con justificación y renumera los grupos de la asignatura. */
export async function excluirCurso(cursoId, justificacion) {
  return requestBackend(`/programacion/cursos/${cursoId}/excluir`, {
    method: 'PATCH',
    body: JSON.stringify({ justificacion }),
  })
}

/** Reactiva un curso excluido; toma el siguiente grupo de la serie. */
export async function reactivarCurso(cursoId, justificacion) {
  return requestBackend(`/programacion/cursos/${cursoId}/reactivar`, {
    method: 'PATCH',
    body: JSON.stringify({ justificacion }),
  })
}

// HU-059: cupos de estudiantes por curso/grupo.

/** Máximo de cupos y si el plazo de edición está abierto para el usuario. */
export async function getCuposConfig(periodoId) {
  return requestBackend(`/programacion/cupos/config?periodoId=${periodoId}`)
}

/** Guarda los cupos de los cursos activos. No hay respaldo Supabase para escrituras. */
export async function actualizarCupos(periodoId, cursos) {
  return requestBackend('/programacion/cupos', {
    method: 'PATCH',
    body: JSON.stringify({
      periodoId: Number(periodoId),
      cursos: (cursos || []).map((c) => ({
        cursoId: Number(c.cursoId),
        cupos: Number(c.cupos)
      }))
    })
  })
}

/** Designa o desasigna un docente a un curso programado existente. */
export async function asignarDocenteACurso(cursoId, idDocente, reemplazarDocente = false, horarioData = null) {
  const payload = {
    idDocente: idDocente ? Number(idDocente) : null,
    reemplazarDocente: Boolean(reemplazarDocente)
  }
  if (horarioData) {
    if (horarioData.dia != null) payload.dia = Number(horarioData.dia)
    if (horarioData.horaInicio) payload.horaInicio = horarioData.horaInicio
    if (horarioData.horaFin) payload.horaFin = horarioData.horaFin
    if (horarioData.dia2 != null) payload.dia2 = Number(horarioData.dia2)
    if (horarioData.horaInicio2) payload.horaInicio2 = horarioData.horaInicio2
    if (horarioData.horaFin2) payload.horaFin2 = horarioData.horaFin2
    if (horarioData.horario) payload.horario = horarioData.horario
  }
  return await requestBackend(`/programacion/cursos/${cursoId}/docente`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
}

/** Designa o desasigna un docente a una materia asegurando el curso programado. */
export async function asignarDocentePorMateria({
  periodoId, codeProgram, codeCourse, semestre, idDocente, reemplazarDocente = false,
  dia = null, horaInicio = null, horaFin = null,
  dia2 = null, horaInicio2 = null, horaFin2 = null, horario = null
}) {
  const payload = {
    periodoId: Number(periodoId),
    codeProgram,
    codeCourse,
    semestre: Number(semestre),
    idDocente: idDocente ? Number(idDocente) : null,
    reemplazarDocente: Boolean(reemplazarDocente)
  }
  if (dia != null) payload.dia = Number(dia)
  if (horaInicio) payload.horaInicio = horaInicio
  if (horaFin) payload.horaFin = horaFin
  if (dia2 != null) payload.dia2 = Number(dia2)
  if (horaInicio2) payload.horaInicio2 = horaInicio2
  if (horaFin2) payload.horaFin2 = horaFin2
  if (horario) payload.horario = horario
  return await requestBackend('/programacion/asignar-docente', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
}

// --- Electivas profesionales y complementarias programadas por el coordinador ---

// GET /api/programacion/electivas?codeProgram=
//   → { periodoId, plazoAbierto, puedeEditar, electivas: [...], escuelasBanco: [...],
//       complementarias: [...], bancoComplementarias: [{ codeCourse, nombre, credits }] }
export async function getElectivasProgramadas(codeProgram) {
  return await requestBackend(`/programacion/electivas?codeProgram=${encodeURIComponent(codeProgram)}`)
}

// POST /api/programacion/electivas  → electiva creada (incluye `alerta` si no hay docentes asociados, HU-051)
//  - electiva profesional / complementaria del semestre 1: codeEspacio = espacio de la malla (ELE-PROF-I, ...)
//  - complementaria propuesta por el coordinador: codeEspacio = 'COMPLEMENTARIA' y jornada obligatoria
export async function programarElectiva({ codeProgram, codeEspacio, codeCourse, cupos, jornada }) {
  return await requestBackend('/programacion/electivas', {
    method: 'POST',
    body: JSON.stringify({ codeProgram, codeEspacio, codeCourse, cupos: Number(cupos), jornada: jornada || null })
  })
}

// PATCH /api/programacion/electivas/{cursoId}  (solo sin docente asignado)
export async function modificarElectiva(cursoId, { codeCourse, cupos }) {
  return await requestBackend(`/programacion/electivas/${cursoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ codeCourse, cupos: Number(cupos) })
  })
}

// DELETE /api/programacion/electivas/{cursoId}  (solo sin docente asignado)
export async function quitarElectiva(cursoId) {
  return await requestBackend(`/programacion/electivas/${cursoId}`, { method: 'DELETE' })
}