import { supabase } from '../supabase'
import { requestBackend } from './academicService'

export async function getCohortes(periodoId, codeProgram = '') {
  try {
    const query = codeProgram ? `?periodoId=${periodoId}&codeProgram=${codeProgram}` : `?periodoId=${periodoId}`
    return await requestBackend(`/cohortes${query}`)
  } catch (error) {
    if (error?.status) throw error
    let q = supabase
      .from('cohortes_periodo')
      .select('*, programas(name_program)')
      .eq('periodo_id', periodoId)
    if (codeProgram) q = q.eq('code_program', codeProgram)
    const { data, error: sbError } = await q.order('semestre', { ascending: true })
    if (sbError) throw sbError
    return (data || []).map(c => ({
      id: c.id,
      periodoId: c.periodo_id,
      codeProgram: c.code_program,
      nombrePrograma: c.programas?.name_program || c.code_program,
      semestre: c.semestre,
      jornada: c.jornada,
      numeroResolucion: c.numero_resolucion,
      confirmada: c.confirmada
    }))
  }
}

export async function guardarCohortes(periodoId, codeProgram, cohortes) {
  try {
    return await requestBackend(`/cohortes?periodoId=${periodoId}&codeProgram=${codeProgram}`, {
      method: 'POST',
      body: JSON.stringify({ cohortes })
    })
  } catch (error) {
    if (error?.status) throw error
    await supabase.from('cohortes_periodo').delete().eq('periodo_id', periodoId).eq('code_program', codeProgram)
    const inserts = cohortes.map(c => ({
      periodo_id: periodoId,
      code_program: codeProgram,
      semestre: c.semestre,
      jornada: c.jornada,
      numero_resolucion: c.numeroResolucion,
      confirmada: c.confirmada ?? true
    }))
    const { data, error: sbError } = await supabase.from('cohortes_periodo').insert(inserts).select()
    if (sbError) throw sbError
    return data
  }
}

export async function getPropuestaCohortes(periodoActualId, periodoAnteriorId = null, confirmarAvanceForzado = false) {
  const params = new URLSearchParams({
    periodoActualId: String(periodoActualId),
    confirmarAvanceForzado: String(confirmarAvanceForzado)
  })
  if (periodoAnteriorId) params.append('periodoAnteriorId', String(periodoAnteriorId))
  return await requestBackend(`/cohortes/propuesta?${params.toString()}`)
}
