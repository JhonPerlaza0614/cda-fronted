import { requestBackend } from './academicService'

export async function listarAsociaciones({ docenteId, codeCourse, idFacultad, activo } = {}) {
  const params = new URLSearchParams()
  if (docenteId) params.set('docenteId', docenteId)
  if (codeCourse) params.set('codeCourse', codeCourse)
  if (idFacultad) params.set('idFacultad', idFacultad)
  if (activo !== undefined && activo !== null) params.set('activo', String(activo))
  const query = params.toString()
  return requestBackend(`/docentes-asignaturas${query ? `?${query}` : ''}`)
}

export async function crearAsociacion({ docenteId, codeCourse }) {
  return requestBackend('/docentes-asignaturas', {
    method: 'POST',
    body: JSON.stringify({
      docente_id: Number(docenteId),
      code_course: codeCourse,
    }),
  })
}

export async function cambiarEstadoAsociacion(id, activo) {
  return requestBackend(`/docentes-asignaturas/${id}/estado?activo=${Boolean(activo)}`, {
    method: 'PATCH',
  })
}

export async function quitarAsociacion(id) {
  return requestBackend(`/docentes-asignaturas/${id}`, { method: 'DELETE' })
}
