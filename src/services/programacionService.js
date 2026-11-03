import { supabase } from '../supabase'
import { requestBackend } from './academicService'

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
      idDocente: c.id_docente,
      estado: c.estado
    }))
  }
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
