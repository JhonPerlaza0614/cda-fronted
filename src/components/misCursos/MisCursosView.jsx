import React, { useEffect, useState } from 'react'
import { BookOpen, Clock, AlertTriangle } from 'lucide-react'
import { getMisCursos } from '../../services/docenteService'
import { CargaBarra } from '../cargaDocente/CargaDocente'

// Cursos que el docente tiene asignados en el período vigente.
export default function MisCursosView({ onShowToast }) {
    const [datos, setDatos] = useState(null)
    const [error, setError] = useState(null)
    const [cargando, setCargando] = useState(true)

    useEffect(() => {
        let cancelado = false
        setCargando(true)
        setError(null)
        getMisCursos()
            .then((data) => { if (!cancelado) setDatos(data) })
            .catch((err) => {
                if (cancelado) return
                const mensaje = err.message || 'No se pudieron consultar tus cursos'
                setError(mensaje)
                onShowToast?.(mensaje, 'error')
            })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
        // onShowToast cambia de identidad en cada render del padre; no debe relanzar la consulta
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const cursos = datos?.cursos ?? []
    const sinHoras = cursos.filter((c) => c.sin_horas).length

    return (
        <div className="carga-docente" style={{ padding: '1.5rem', maxWidth: '1000px', margin: '0 auto' }}>
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0, fontSize: '1.5rem' }}>
                <BookOpen size={26} />
                <span>Mis cursos</span>
            </h1>

            {cargando && <p className="carga-vacio">Consultando tus cursos…</p>}
            {!cargando && error && <p className="carga-error">{error}</p>}

            {!cargando && !error && datos && !datos.periodo && (
                <p className="carga-vacio">No hay un período vigente.</p>
            )}

            {!cargando && !error && datos?.periodo && (
                <>
                    <p className="carga-resumen">
                        Período vigente: <strong>{datos.periodo.nombre}</strong>
                    </p>

                    <CargaBarra total={datos.total_horas} limite={datos.limite} />
                    <p className="carga-resumen">
                        {datos.disponibles > 0
                            ? `Te quedan ${datos.disponibles} h disponibles en este período.`
                            : 'Llegaste al límite de horas de este período.'}
                    </p>

                    {cursos.length === 0 ? (
                        <p className="carga-vacio">No tiene cursos asignados en este periodo</p>
                    ) : (
                        <table className="carga-tabla">
                            <thead>
                                <tr>
                                    <th>Código-Grupo</th>
                                    <th>Asignatura</th>
                                    <th>Programa</th>
                                    <th>Jornada</th>
                                    <th>Horas</th>
                                </tr>
                            </thead>
                            <tbody>
                                {cursos.map((c) => (
                                    <tr key={c.curso_id}>
                                        <td><span className="carga-codigo">{c.codigo_grupo}</span></td>
                                        <td>{c.nombre_asignatura}</td>
                                        <td>{c.nombre_programa}</td>
                                        <td>{c.jornada}</td>
                                        <td>
                                            {c.sin_horas
                                                ? (
                                                    <span className="carga-sin-horas" title="La asignatura aún no tiene horas definidas">
                                                        <AlertTriangle size={12} /> sin definir
                                                    </span>
                                                )
                                                : <><Clock size={12} /> {c.horas}</>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colSpan={4}><strong>Total</strong></td>
                                    <td><strong>{datos.total_horas} / {datos.limite} h</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                    )}

                    {sinHoras > 0 && (
                        <p className="carga-aviso">
                            {sinHoras} {sinHoras === 1 ? 'curso no tiene' : 'cursos no tienen'} horas definidas y no se está sumando.
                        </p>
                    )}
                </>
            )}
        </div>
    )
}