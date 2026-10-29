import { supabase } from '../supabase'
import { getAuthToken } from './authService'

/**
 * Servicio para la gestión de Programas, Asignaturas y Pensum Académico
 * Conectado directamente a la API REST de Spring Boot (cda-backend)
 * con fallback transparente a Supabase si el backend se encuentra apagado.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8080/api'
const API_ROOT = BACKEND_URL.replace(/\/api\/?$/, '')

export async function requestBackend(endpoint, options = {}) {
  const url = `${BACKEND_URL}${endpoint}`
  const token = getAuthToken()
  const authHeaders = token ? { Authorization: `Bearer ${token}` } : {}

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {})
    }
  })

  if (!response.ok) {
    let errorMsg = `Error ${response.status}: ${response.statusText}`
    try {
      const errorBody = await response.json()
      if (errorBody.message) errorMsg = errorBody.message
      else if (errorBody.errors) {
        errorMsg = Object.entries(errorBody.errors).map(([k, v]) => `${k}: ${v}`).join(', ')
      }
    } catch {
      // Response was not JSON
    }
    const error = new Error(errorMsg)
    error.status = response.status
    throw error
  }

  if (response.status === 204) return true
  return await response.json()
}

function isBackendUnavailable(error) {
  return error instanceof TypeError || !error?.status
}

// --- PROGRAMAS ---

export async function getProgramas() {
  try {
    return await requestBackend('/programas')
  } catch (err) {
    console.warn('Backend no disponible, usando Supabase directo:', err.message)
    const { data, error } = await supabase
      .from('programas')
      .select('*')
      .order('name_program', { ascending: true })
    if (error) throw error
    return data || []
  }

}

// --- PERIODOS ACADEMICOS (HU-002 / HU-003) ---

export async function getPeriodos() {
  return requestBackend('/periodos')
}

export async function createPeriodo(periodo) {
  return requestBackend('/periodos', {
    method: 'POST',
    body: JSON.stringify(periodo),
  })
}

export async function updatePeriodo(id, periodo) {
  return requestBackend(`/periodos/${id}`, {
    method: 'PUT',
    body: JSON.stringify(periodo),
  })
}

export async function createPrograma(programa) {
  try {
    const payload = {
      code_program: programa.code_program.trim().toUpperCase(),
      name_program: programa.name_program.trim(),
      numero_semestre: parseInt(programa.numero_semestre, 10) || 10,
      id_facultad_programa: programa.id_facultad_programa ? parseInt(programa.id_facultad_programa, 10) : null,
      apertura: programa.apertura || null,
      numero_resolucion: String(programa.numero_resolucion || '').trim(),
      jornada: programa.jornada || 'DIURNA',
      ingreso: programa.ingreso || 'SEMESTRAL'
    }
    return await requestBackend('/programas', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.warn('Fallo backend en createPrograma, fallback a Supabase:', err.message)
    const insertPayload = {
      code_program: programa.code_program.trim().toUpperCase(),
      name_program: programa.name_program.trim(),
      numero_semestre: parseInt(programa.numero_semestre, 10) || 10,
      apertura: programa.apertura || null,
      numero_resolucion: String(programa.numero_resolucion || '').trim(),
    }
    if (programa.id_facultad_programa) {
      insertPayload.id_facultad_programa = parseInt(programa.id_facultad_programa, 10)
    }
    const { data, error } = await supabase
      .from('programas')
      .insert([insertPayload])
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function updatePrograma(code_program, changes) {
  try {
    const payload = {}
    if (changes.name_program !== undefined) payload.name_program = changes.name_program.trim()
    if (changes.numero_semestre !== undefined) payload.numero_semestre = parseInt(changes.numero_semestre, 10)
    if (changes.id_facultad_programa !== undefined) {
      payload.id_facultad_programa = changes.id_facultad_programa ? parseInt(changes.id_facultad_programa, 10) : null
    }
    if (changes.apertura !== undefined) payload.apertura = changes.apertura || null
    if (changes.numero_resolucion !== undefined) payload.numero_resolucion = String(changes.numero_resolucion).trim()
    return await requestBackend(`/programas/${encodeURIComponent(code_program)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.warn('Fallo backend en updatePrograma, fallback a Supabase:', err.message)
    const updateData = {}
    if (changes.name_program !== undefined) updateData.name_program = changes.name_program.trim()
    if (changes.numero_semestre !== undefined) {
      updateData.numero_semestre = parseInt(changes.numero_semestre, 10) || 10
    }
    if (changes.id_facultad_programa !== undefined) {
      updateData.id_facultad_programa = changes.id_facultad_programa ? parseInt(changes.id_facultad_programa, 10) : null
    }
    if (changes.apertura !== undefined) updateData.apertura = changes.apertura || null
    if (changes.numero_resolucion !== undefined) updateData.numero_resolucion = String(changes.numero_resolucion).trim()
    const { data, error } = await supabase
      .from('programas')
      .update(updateData)
      .eq('code_program', code_program)
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function deletePrograma(code_program) {
  try {
    return await requestBackend(`/programas/${encodeURIComponent(code_program)}`, {
      method: 'DELETE'
    })
  } catch (err) {
    console.warn('Fallo backend en deletePrograma, fallback a Supabase:', err.message)
    const { error } = await supabase
      .from('programas')
      .delete()
      .eq('code_program', code_program)
    if (error) throw error
    return true
  }
}

// --- ASIGNATURAS ---

export async function getAsignaturas() {
  try {
    return await requestBackend('/asignaturas')
  } catch (err) {
    console.warn('Backend no disponible, usando Supabase directo:', err.message)
    const { data, error } = await supabase
      .from('asignaturas')
      .select('*')
      .order('name_course', { ascending: true })
    if (error) throw error
    return data || []
  }
}

export async function createAsignatura(asignatura) {
  try {
    const creditsVal = parseInt(asignatura.credits, 10)
    const payload = {
      code_course: asignatura.code_course.trim().toUpperCase(),
      name_course: asignatura.name_course.trim(),
      credits: isNaN(creditsVal) ? 0 : Math.max(0, creditsVal),
      is_elective: Boolean(asignatura.is_elective),
      es_complementaria: Boolean(asignatura.es_complementaria),
      es_basica: Boolean(asignatura.es_basica),
      facultad: asignatura.facultad ? asignatura.facultad.trim() : null,
      id_facultad: asignatura.id_facultad ? parseInt(asignatura.id_facultad, 10) : null
    }
    return await requestBackend('/asignaturas', {
      method: 'POST',
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.warn('Fallo backend en createAsignatura, fallback a Supabase:', err.message)
    const creditsVal = parseInt(asignatura.credits, 10)
    const payload = {
      code_course: asignatura.code_course.trim().toUpperCase(),
      name_course: asignatura.name_course.trim(),
      credits: isNaN(creditsVal) ? 0 : Math.max(0, creditsVal),
      is_elective: Boolean(asignatura.is_elective),
      es_complementaria: Boolean(asignatura.es_complementaria),
      es_basica: Boolean(asignatura.es_basica),
      facultad: asignatura.facultad ? asignatura.facultad.trim() : null,
      id_facultad: asignatura.id_facultad ? parseInt(asignatura.id_facultad, 10) : null,
    }
    const { data, error } = await supabase
      .from('asignaturas')
      .insert([payload])
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function updateAsignatura(code_course, changes) {
  try {
    const payload = {}
    if (changes.name_course !== undefined) payload.name_course = changes.name_course.trim()
    if (changes.credits !== undefined) {
      const creditsVal = parseInt(changes.credits, 10)
      payload.credits = isNaN(creditsVal) ? 0 : Math.max(0, creditsVal)
    }
    if (changes.is_elective !== undefined) payload.is_elective = Boolean(changes.is_elective)
    if (changes.es_complementaria !== undefined) payload.es_complementaria = Boolean(changes.es_complementaria)
    if (changes.es_basica !== undefined) payload.es_basica = Boolean(changes.es_basica)
    if (changes.id_facultad !== undefined) {
      const facId = parseInt(changes.id_facultad, 10)
      payload.id_facultad = !isNaN(facId) ? facId : null
    }
    if (changes.facultad !== undefined) payload.facultad = changes.facultad ? changes.facultad.trim() : null

    return await requestBackend(`/asignaturas/${encodeURIComponent(code_course)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    })
  } catch (err) {
    console.warn('Fallo backend en updateAsignatura, fallback a Supabase:', err.message)
    const updateData = {}
    if (changes.name_course !== undefined) updateData.name_course = changes.name_course.trim()
    if (changes.credits !== undefined) {
      const creditsVal = parseInt(changes.credits, 10)
      updateData.credits = isNaN(creditsVal) ? 0 : Math.max(0, creditsVal)
    }
    if (changes.is_elective !== undefined) updateData.is_elective = Boolean(changes.is_elective)
    if (changes.es_complementaria !== undefined) updateData.es_complementaria = Boolean(changes.es_complementaria)
    if (changes.es_basica !== undefined) updateData.es_basica = Boolean(changes.es_basica)
    if (changes.id_facultad !== undefined) {
      const facId = parseInt(changes.id_facultad, 10)
      updateData.id_facultad = !isNaN(facId) ? facId : null
    }

    const { data, error } = await supabase
      .from('asignaturas')
      .update(updateData)
      .eq('code_course', code_course)
      .select()

    if (error) throw error
    return data?.[0]
  }
}

export async function deleteAsignatura(code_course) {
  try {
    return await requestBackend(`/asignaturas/${encodeURIComponent(code_course)}`, {
      method: 'DELETE'
    })
  } catch (err) {
    console.warn('Fallo backend en deleteAsignatura, fallback a Supabase:', err.message)
    const { error } = await supabase
      .from('asignaturas')
      .delete()
      .eq('code_course', code_course)
    if (error) throw error
    return true
  }
}

// --- PENSUM ACADÉMICO ---

function parsePensumMeta(rawFacultad) {
  if (!rawFacultad || !String(rawFacultad).startsWith('META|')) {
    return {
      facultad: rawFacultad || null,
      horas_clase: 4,
      horas_independiente: 8,
      tipo_asignatura: 'Profesional',
      descripcion: ''
    }
  }
  const result = {
    facultad: null,
    horas_clase: 4,
    horas_independiente: 8,
    tipo_asignatura: 'Profesional',
    descripcion: ''
  }
  const parts = String(rawFacultad).substring(5).split('|')
  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const k = part.substring(0, idx)
    const v = part.substring(idx + 1)
    if (k === 'hc') result.horas_clase = parseInt(v, 10) || 4
    else if (k === 'hi') result.horas_independiente = parseInt(v, 10) || 8
    else if (k === 'tipo' && v) result.tipo_asignatura = v
    else if (k === 'desc') result.descripcion = v
  }
  return result
}

function encodePensumMeta({ horas_clase, horas_independiente, tipo_asignatura, descripcion }) {
  const hc = horas_clase !== undefined && horas_clase !== null ? parseInt(horas_clase, 10) : 4
  const hi = horas_independiente !== undefined && horas_independiente !== null ? parseInt(horas_independiente, 10) : 8
  const tipo = String(tipo_asignatura || 'Profesional').replace(/[|=]/g, ' ').trim()
  let desc = String(descripcion || '').replace(/[|=]/g, ' ').trim()
  if (desc.length > 75) desc = desc.substring(0, 75)
  const raw = `META|hc=${hc}|hi=${hi}|tipo=${tipo}|desc=${desc}`
  return raw.length > 150 ? raw.substring(0, 150) : raw
}

function buildPensumRequestPayload(code_program, itemsOrPayload) {
  const isArray = Array.isArray(itemsOrPayload)
  const rawItems = isArray ? itemsOrPayload : (itemsOrPayload?.items || [])
  const payload = {
    code_program,
    items: rawItems.map(item => ({
      code_course: String(item.code_course || '').trim().toUpperCase(),
      name_course: item.name_course ? String(item.name_course).trim() : undefined,
      credits: item.credits !== undefined && item.credits !== '' ? parseInt(item.credits, 10) : undefined,
      semestre: parseInt(item.semestre, 10),
      horas_clase: item.horas_clase !== undefined && item.horas_clase !== '' ? parseInt(item.horas_clase, 10) : undefined,
      horas_independiente: item.horas_independiente !== undefined && item.horas_independiente !== '' ? parseInt(item.horas_independiente, 10) : undefined,
      tipo_asignatura: item.tipo_asignatura || undefined,
      original_code_course: item.original_code_course || undefined
    }))
  }
  if (!isArray && itemsOrPayload) {
    if (itemsOrPayload.name_program !== undefined) payload.name_program = itemsOrPayload.name_program
    if (itemsOrPayload.descripcion !== undefined) payload.descripcion = itemsOrPayload.descripcion
    if (itemsOrPayload.jornada !== undefined) payload.jornada = itemsOrPayload.jornada
    if (itemsOrPayload.periodo_oferta !== undefined) payload.periodo_oferta = itemsOrPayload.periodo_oferta
    if (itemsOrPayload.numero_semestre !== undefined) payload.numero_semestre = parseInt(itemsOrPayload.numero_semestre, 10)
    if (itemsOrPayload.numero_resolucion !== undefined) payload.numero_resolucion = itemsOrPayload.numero_resolucion
  }
  return payload
}

export async function getPensumByProgram(code_program) {
  try {
    return await requestBackend(`/pensum/programa/${encodeURIComponent(code_program)}`)
  } catch (err) {
    console.warn('Fallo backend en getPensumByProgram, fallback a Supabase:', err.message)
    const { data: pensumData, error: pensumError } = await supabase
      .from('pensum_academico')
      .select('*')
      .eq('code_program', code_program)
      .eq('vigente', true)
      .order('semestre', { ascending: true })

    if (pensumError) throw pensumError
    if (!pensumData || pensumData.length === 0) return []

    const courseCodes = pensumData.map(p => p.code_course)
    const { data: coursesData } = await supabase
      .from('asignaturas')
      .select('*')
      .in('code_course', courseCodes)

    const courseMap = new Map((coursesData || []).map(c => [c.code_course, c]))
    return pensumData.map(item => {
      const course = courseMap.get(item.code_course)
      const meta = parsePensumMeta(item.facultad)
      return {
        ...item,
        name_course: course?.name_course || item.code_course,
        credits: course?.credits !== undefined && course?.credits !== null ? course.credits : 0,
        horas_clase: meta.horas_clase,
        horas_independiente: meta.horas_independiente,
        tipo_asignatura: meta.tipo_asignatura,
        descripcion: meta.descripcion
      }
    })
  }
}

export async function getAllPensum() {
  try {
    return await requestBackend('/pensum')
  } catch (err) {
    console.warn('Backend no disponible en getAllPensum, usando Supabase directo:', err.message)
    const { data, error } = await supabase
      .from('pensum_academico')
      .select('*')
      .eq('vigente', true)
    if (error) throw error
    return (data || []).map(item => {
      const meta = parsePensumMeta(item.facultad)
      return {
        ...item,
        horas_clase: meta.horas_clase,
        horas_independiente: meta.horas_independiente,
        tipo_asignatura: meta.tipo_asignatura,
        descripcion: meta.descripcion
      }
    })
  }
}

export async function savePensumVersion(code_program, itemsOrPayload) {
  const bodyPayload = buildPensumRequestPayload(code_program, itemsOrPayload)
  try {
    return await requestBackend(`/pensum/programa/${encodeURIComponent(code_program)}/guardar`, {
      method: 'POST',
      body: JSON.stringify(bodyPayload)
    })
  } catch (err) {
    if (!isBackendUnavailable(err)) throw err
    console.warn('Fallo backend en savePensumVersion, fallback a Supabase:', err.message)
    const items = bodyPayload.items || []
    const { data: current, error: currentError } = await supabase
      .from('pensum_academico')
      .select('version')
      .eq('code_program', code_program)
      .order('version', { ascending: false })
      .limit(1)
    if (currentError) throw currentError
    const nextVersion = (current?.[0]?.version || 0) + 1
    const now = new Date().toISOString()
    const { error: deactivateError } = await supabase
      .from('pensum_academico')
      .update({ vigente: false, fecha_desactivacion: now })
      .eq('code_program', code_program)
      .eq('vigente', true)
    if (deactivateError) throw deactivateError
    for (const item of items) {
      if (item.name_course) {
        await supabase.from('asignaturas').upsert([{
          code_course: item.code_course,
          name_course: item.name_course,
          credits: item.credits ?? 3,
          is_elective: (item.tipo_asignatura || '').toLowerCase().includes('electiv') || (item.tipo_asignatura || '').toLowerCase().includes('extracurricular'),
          es_complementaria: (item.tipo_asignatura || '').toLowerCase().includes('complementar'),
          es_basica: (item.tipo_asignatura || '').toLowerCase().includes('básic') || (item.tipo_asignatura || '').toLowerCase().includes('basic')
        }], { onConflict: 'code_course' })
      }
    }
    const payload = items.map(item => ({
      code_program,
      code_course: item.code_course,
      version: nextVersion,
      semestre: parseInt(item.semestre, 10),
      vigente: true,
      activo: true,
      numero_resolucion: bodyPayload.numero_resolucion || null,
      numero_semestres: bodyPayload.numero_semestre || null,
      editada: false,
      fecha_edicion: null,
      facultad: encodePensumMeta({
        horas_clase: item.horas_clase,
        horas_independiente: item.horas_independiente,
        tipo_asignatura: item.tipo_asignatura,
        descripcion: bodyPayload.descripcion
      })
    }))
    if (payload.length === 0) return []
    const { data, error } = await supabase.from('pensum_academico').insert(payload).select()
    if (error) throw error
    return data || []
  }
}

export async function updatePensumVersion(code_program, itemsOrPayload) {
  const bodyPayload = buildPensumRequestPayload(code_program, itemsOrPayload)
  try {
    return await requestBackend(`/pensum/programa/${encodeURIComponent(code_program)}/editar`, {
      method: 'PUT',
      body: JSON.stringify(bodyPayload)
    })
  } catch (err) {
    if (!isBackendUnavailable(err)) throw err
    console.warn('Fallo backend en updatePensumVersion, fallback a Supabase:', err.message)
    const items = bodyPayload.items || []
    const { data: activeRows, error: activeError } = await supabase
      .from('pensum_academico')
      .select('*')
      .eq('code_program', code_program)
      .eq('vigente', true)
    if (activeError) throw activeError
    if (!activeRows || activeRows.length === 0) {
      throw new Error('Solo las mallas activas pueden ser editadas. Las mallas inactivas son de solo consulta.')
    }
    const activeVersion = activeRows[0].version || 1
    for (const item of items) {
      if (item.name_course) {
        await supabase.from('asignaturas').upsert([{
          code_course: item.code_course,
          name_course: item.name_course,
          credits: item.credits ?? 3,
          is_elective: (item.tipo_asignatura || '').toLowerCase().includes('electiv') || (item.tipo_asignatura || '').toLowerCase().includes('extracurricular'),
          es_complementaria: (item.tipo_asignatura || '').toLowerCase().includes('complementar'),
          es_basica: (item.tipo_asignatura || '').toLowerCase().includes('básic') || (item.tipo_asignatura || '').toLowerCase().includes('basic')
        }], { onConflict: 'code_course' })
      }
    }
    const { error: delError } = await supabase
      .from('pensum_academico')
      .delete()
      .eq('code_program', code_program)
      .eq('version', activeVersion)
    if (delError) throw delError
    const nowEdit = new Date().toISOString()
    const payload = items.map(item => ({
      code_program,
      code_course: item.code_course,
      version: activeVersion,
      semestre: parseInt(item.semestre, 10),
      vigente: true,
      activo: true,
      numero_resolucion: bodyPayload.numero_resolucion || activeRows[0]?.numero_resolucion || null,
      numero_semestres: bodyPayload.numero_semestre || activeRows[0]?.numero_semestres || null,
      editada: true,
      fecha_edicion: nowEdit,
      facultad: encodePensumMeta({
        horas_clase: item.horas_clase,
        horas_independiente: item.horas_independiente,
        tipo_asignatura: item.tipo_asignatura,
        descripcion: bodyPayload.descripcion
      })
    }))
    const { data, error } = await supabase.from('pensum_academico').insert(payload).select()
    if (error) throw error
    return data || []
  }
}

export async function getPensumHistory(code_program) {
  try {
    return await requestBackend(`/pensum/programa/${encodeURIComponent(code_program)}/historial`)
  } catch (err) {
    if (!isBackendUnavailable(err)) throw err
    console.warn('Fallo backend en getPensumHistory, usando Supabase:', err.message)
    const { data, error } = await supabase
      .from('pensum_academico')
      .select('version, fecha_desactivacion, code_course, numero_resolucion, numero_semestres, editada, fecha_edicion')
      .eq('code_program', code_program)
      .eq('vigente', false)
      .order('fecha_desactivacion', { ascending: false })
    if (error) throw error
    const grouped = new Map()
    ;(data || []).forEach(item => {
      const current = grouped.get(item.version) || {
        version: item.version,
        fechaDesactivacion: item.fecha_desactivacion,
        totalAsignaturas: 0,
        numero_resolucion: item.numero_resolucion || null,
        numero_semestres: item.numero_semestres || null,
        editada: Boolean(item.editada),
        fecha_edicion: item.fecha_edicion || null
      }
      current.totalAsignaturas += 1
      if (item.editada) current.editada = true
      if (item.fecha_edicion && (!current.fecha_edicion || item.fecha_edicion > current.fecha_edicion)) {
        current.fecha_edicion = item.fecha_edicion
      }
      grouped.set(item.version, current)
    })
    return [...grouped.values()]
  }
}

export async function getPensumVersion(code_program, version) {
  try {
    return await requestBackend(`/pensum/programa/${encodeURIComponent(code_program)}/version/${version}`)
  } catch (err) {
    if (!isBackendUnavailable(err)) throw err
    console.warn('Fallo backend en getPensumVersion, usando Supabase:', err.message)
    const { data, error } = await supabase
      .from('pensum_academico')
      .select('*, asignaturas(name_course, credits)')
      .eq('code_program', code_program)
      .eq('version', version)
      .order('semestre', { ascending: true })
    if (error) throw error
    return (data || []).map(item => ({
      ...item,
      name_course: item.asignaturas?.name_course || item.code_course,
      credits: item.asignaturas?.credits || 0
    }))
  }
}

export async function deactivatePensum(code_program) {
  try {
    return await requestBackend(`/pensum/programa/${encodeURIComponent(code_program)}/desactivar`, { method: 'PATCH' })
  } catch (err) {
    if (!isBackendUnavailable(err)) throw err
    console.warn('Fallo backend en deactivatePensum, usando Supabase:', err.message)
    const { error } = await supabase
      .from('pensum_academico')
      .update({ vigente: false, fecha_desactivacion: new Date().toISOString() })
      .eq('code_program', code_program)
      .eq('vigente', true)
    if (error) throw error
    return true
  }
}

export async function reactivatePensum(code_program, version) {
  try {
    return await requestBackend(`/pensum/programa/${encodeURIComponent(code_program)}/version/${version}/reactivar`, {
      method: 'PATCH'
    })
  } catch (err) {
    if (!isBackendUnavailable(err)) throw err
    console.warn('Fallo backend en reactivatePensum, usando Supabase:', err.message)
    const now = new Date().toISOString()
    const { error: deactivateError } = await supabase
      .from('pensum_academico')
      .update({ vigente: false, fecha_desactivacion: now })
      .eq('code_program', code_program)
      .eq('vigente', true)
    if (deactivateError) throw deactivateError
    const { data, error } = await supabase
      .from('pensum_academico')
      .update({ vigente: true, fecha_desactivacion: null, fecha_reactivacion: now })
      .eq('code_program', code_program)
      .eq('version', version)
      .select()
    if (error) throw error
    return data || []
  }
}

export async function addCourseToPensum({ code_program, code_course, semestre }) {
  try {
    return await requestBackend('/pensum', {
      method: 'POST',
      body: JSON.stringify({
        code_program,
        code_course,
        semestre: parseInt(semestre, 10)
      })
    })
  } catch (err) {
    console.warn('Fallo backend en addCourseToPensum, fallback a Supabase:', err.message)
    const sem = parseInt(semestre, 10)
    const { data, error } = await supabase
      .from('pensum_academico')
      .insert([{ code_program, code_course, semestre: sem }])
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function updateCourseSemester({ code_program, code_course, semestre }) {
  try {
    return await requestBackend('/pensum/semestre', {
      method: 'PUT',
      body: JSON.stringify({
        code_program,
        code_course,
        semestre: parseInt(semestre, 10)
      })
    })
  } catch (err) {
    console.warn('Fallo backend en updateCourseSemester, fallback a Supabase:', err.message)
    const sem = parseInt(semestre, 10)
    const { data, error } = await supabase
      .from('pensum_academico')
      .update({ semestre: sem })
      .eq('code_program', code_program)
      .eq('code_course', code_course)
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function removeCourseFromPensum({ code_program, code_course }) {
  try {
    return await requestBackend(`/pensum/${encodeURIComponent(code_program)}/${encodeURIComponent(code_course)}`, {
      method: 'DELETE'
    })
  } catch (err) {
    console.warn('Fallo backend en removeCourseFromPensum, fallback a Supabase:', err.message)
    const { error } = await supabase
      .from('pensum_academico')
      .delete()
      .eq('code_program', code_program)
      .eq('code_course', code_course)
    if (error) throw error
    return true
  }
}

// --- FACULTADES ---

export async function getFacultades() {
  try {
    return await requestBackend('/facultades')
  } catch {
    try {
      const { data, error } = await supabase.from('Facultad').select('*')
      if (!error && data) return data
      const { data: dataLower } = await supabase.from('facultad').select('*')
      if (dataLower) return dataLower
    } catch {
      // Ignorar
    }
    return []
  }
}

export async function createFacultad({ nombre, descripcion }) {
  try {
    return await requestBackend('/facultades', {
      method: 'POST',
      body: JSON.stringify({ nombre, descripcion })
    })
  } catch (err) {
    console.warn('Fallo backend en createFacultad, fallback a Supabase:', err.message)
    const payload = { nombre: (nombre || '').trim() }
    if (descripcion) payload.descripcion = descripcion.trim()
    const { data, error } = await supabase.from('Facultad').insert([payload]).select()
    if (!error && data) return data[0]
    const { data: data2, error: err2 } = await supabase.from('facultad').insert([payload]).select()
    if (!err2 && data2) return data2[0]
    throw err
  }
}

// --- DIAGNÓSTICO DE SALUD ---

export async function checkDatabaseHealth() {
  const results = {
    connected: false,
    backendConnected: false,
    tables: {
      programas: false,
      asignaturas: false,
      pensum_academico: false,
      Facultad: false,
    },
    rlsPermitted: false,
    error: null,
  }

  try {
    // /actuator/health es público: no requiere token y no descarga datos
    const res = await fetch(`${API_ROOT}/actuator/health`, { method: 'GET' })
    if (res.ok) {
      results.connected = true
      results.backendConnected = true
      results.tables.programas = true
      results.tables.asignaturas = true
      results.tables.pensum_academico = true
      results.tables.Facultad = true
      return results
    }
    if (res.status !== 401 && res.status !== 403) {
      results.error = `El backend respondió ${res.status} al consultar programas`
    }
  } catch {
    // Se intenta la conexión directa a Supabase.
  }

  try {
    const [progRes, asigRes, pensumRes, facultadRes] = await Promise.allSettled([
      supabase.from('programas').select('*').limit(1),
      supabase.from('asignaturas').select('*').limit(1),
      supabase.from('pensum_academico').select('*').limit(1),
      supabase.from('Facultad').select('*').limit(1),
    ])

    results.connected = true
    results.tables.programas = progRes.status === 'fulfilled' && !progRes.value.error
    results.tables.asignaturas = asigRes.status === 'fulfilled' && !asigRes.value.error
    results.tables.pensum_academico = pensumRes.status === 'fulfilled' && !pensumRes.value.error
    results.tables.Facultad = facultadRes.status === 'fulfilled' && !facultadRes.value.error
  } catch (err) {
    results.connected = false
    results.error = err.message
  }

  return results
}


// --- COORDINADORES ---

export async function getCoordinadores() {
  try {
    return await requestBackend('/coordinadores')
  } catch (err) {
    console.warn('Backend no disponible para coordinadores, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('coordinadores')
      .select('*, programas(name_program)')
      .order('nombre_completo', { ascending: true })
    if (!error && data) {
      return data.map(c => ({
        ...c,
        name_program: c.programas?.name_program || c.code_program
      }))
    }
    return []
  }
}

export async function createCoordinador(coordinador) {
  try {
    return await requestBackend('/coordinadores', {
      method: 'POST',
      body: JSON.stringify(coordinador)
    })
  } catch (err) {
    console.warn('Fallo backend en createCoordinador, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('coordinadores')
      .insert([coordinador])
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function updateCoordinador(id, changes) {
  try {
    return await requestBackend('/coordinadores/' + id, {
      method: 'PUT',
      body: JSON.stringify(changes)
    })
  } catch (err) {
    console.warn('Fallo backend en updateCoordinador, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('coordinadores')
      .update(changes)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function deleteCoordinador(id) {
  try {
    return await requestBackend('/coordinadores/' + id, {
      method: 'DELETE'
    })
  } catch (err) {
    console.warn('Fallo backend en deleteCoordinador, fallback Supabase:', err.message)
    const { error } = await supabase
      .from('coordinadores')
      .delete()
      .eq('id', id)
    if (error) throw error
    return true
  }
}


// --- CATÁLOGOS NORMALIZADOS: CATEGORÍAS Y TIPOS DE CONTRATO ---

export async function getCategorias() {
  try {
    return await requestBackend('/categorias')
  } catch {
    try {
      const { data, error } = await supabase.from('categoria').select('*').order('nombre', { ascending: true })
      if (!error && data && data.length > 0) return data
    } catch { }
    return [
      { id: 1, nombre: 'Auxiliar' },
      { id: 2, nombre: 'Asistente' },
      { id: 3, nombre: 'Asociado' },
      { id: 4, nombre: 'Titular' }
    ]
  }
}

export async function getTiposContrato() {
  try {
    return await requestBackend('/tipos-contrato')
  } catch {
    try {
      const { data, error } = await supabase.from('tipo_contrato').select('*').order('nombre', { ascending: true })
      if (!error && data && data.length > 0) return data
    } catch { }
    return [
      { id: 1, nombre: 'Nombrado' },
      { id: 2, nombre: 'Ocasional' },
      { id: 3, nombre: 'Cátedra' }
    ]
  }
}


// --- DOCENTES ---

export async function getDocentes() {
  try {
    return await requestBackend('/docentes')
  } catch (err) {
    console.warn('Backend no disponible para docentes, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('docentes')
      .select('*, programas(name_program)')
      .order('apellidos', { ascending: true })
    if (!error && data) {
      return data.map(d => ({
        ...d,
        nombre_completo: `${d.nombres || ''} ${d.apellidos || ''}`.trim(),
        name_program: d.programas?.name_program || d.code_program
      }))
    }
    return []
  }
}

export async function toggleDocenteEstado(id, nuevoEstado) {
  try {
    return await requestBackend(`/docentes/${id}/estado?estado=${Boolean(nuevoEstado)}`, {
      method: 'PATCH'
    })
  } catch (err) {
    console.warn('Fallo backend en toggleDocenteEstado, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('docentes')
      .update({ estado: Boolean(nuevoEstado), updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function toggleCoordinadorActivo(id, nuevoActivo) {
  try {
    return await requestBackend(`/coordinadores/${id}/estado?activo=${Boolean(nuevoActivo)}`, {
      method: 'PATCH'
    })
  } catch (err) {
    console.warn('Fallo backend en toggleCoordinadorActivo, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('coordinadores')
      .update({ activo: Boolean(nuevoActivo) })
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function createDocente(docente) {
  try {
    return await requestBackend('/docentes', {
      method: 'POST',
      body: JSON.stringify(docente)
    })
  } catch (err) {
    console.warn('Fallo backend en createDocente, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('docentes')
      .insert([docente])
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function updateDocente(id, changes) {
  try {
    return await requestBackend(`/docentes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(changes)
    })
  } catch (err) {
    console.warn('Fallo backend en updateDocente, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('docentes')
      .update(changes)
      .eq('id', id)
      .select()
    if (error) throw error
    return data?.[0]
  }
}


// --- DESHABILITACIÓN / HABILITACIÓN (SOFT DELETE) ---

export async function toggleAsignaturaActivo(code_course, nuevoActivo) {
  try {
    return await requestBackend(`/asignaturas/${encodeURIComponent(code_course)}/estado?activo=${Boolean(nuevoActivo)}`, {
      method: 'PATCH'
    })
  } catch (err) {
    console.warn('Fallo backend en toggleAsignaturaActivo, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('asignaturas')
      .update({ activo: Boolean(nuevoActivo) })
      .eq('code_course', code_course)
      .select()
    if (error) throw error
    return data?.[0]
  }
}

export async function togglePensumActivo(code_program, code_course, nuevoActivo) {
  try {
    return await requestBackend(`/pensum/${encodeURIComponent(code_program)}/${encodeURIComponent(code_course)}/estado?activo=${Boolean(nuevoActivo)}`, {
      method: 'PATCH'
    })
  } catch (err) {
    console.warn('Fallo backend en togglePensumActivo, fallback Supabase:', err.message)
    const { data, error } = await supabase
      .from('pensum_academico')
      .update({ activo: Boolean(nuevoActivo) })
      .match({ code_program, code_course })
      .select()
    if (error) throw error
    return data?.[0]
  }
}