import React, { useEffect, useState } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { getCargaDocente } from '../../services/docenteService'
import './CargaDocente.css'

// Barra "X / L h": verde, ámbar desde el 80 % y roja al llegar al límite.
export function CargaBarra({ total, limite }) {
    const max = limite > 0 ? limite : 20
    const pct = Math.min(100, Math.round((total / max) * 100))
    const nivel = total >= max ? 'lleno' : pct >= 80 ? 'alto' : 'normal'
    return (
        <div className="carga-barra" title={`${total} de ${max} horas`}>
            <div className="carga-barra-texto">
                <strong>{total}</strong> / {max} h
            </div>
            <div className="carga-barra-pista">
                <div className={`carga-barra-relleno carga-${nivel}`} style={{ width: `${pct}%` }} />
            </div>
        </div>
    )
}

// Detalle de la carga de un docente en un período.
// Admin: todos los programas. Coordinador: su programa + "Otros programas: N h".
export default function CargaDocente({ docenteId, periodoId }) {
    const [carga, setCarga] = useState(null)
    const [error, setError] = useState(null)
    const [cargando, setCargando] = useState(false)

    useEffect(() => {
        if (!docenteId || !periodoId) {
            setCarga(null)
            return undefined
        }
        let cancelado = false
        setCargando(true)
        setError(null)
        getCargaDocente(docenteId, periodoId)
            .then((data) => { if (!cancelado) setCarga(data) })
            .catch((err) => { if (!cancelado) setError(err.message || 'No se pudo consultar la carga') })
            .finally(() => { if (!cancelado) setCargando(false) })
        return () => { cancelado = true }
    }, [docenteId, periodoId])

    if (!periodoId) return <p className="carga-vacio">Selecciona un período para ver la carga.</p>
    if (cargando) return <p className="carga-vacio">Consultando carga…</p>
    if (error) return <p className="carga-error">{error}</p>
    if (!carga) return null

    const sinHoras = carga.cursos.filter((c) => c.sin_horas).length

    return (
        <div className="carga-docente">
            <CargaBarra total={carga.total_horas} limite={carga.limite} />
            <p className="carga-resumen">
                {carga.disponibles > 0
                    ? `Le quedan ${carga.disponibles} h disponibles en este período.`
                    : 'Llegó al límite de horas de este período.'}
            </p>

            {carga.cursos.length === 0 ? (
                <p className="carga-vacio">
                    {carga.otros_programas_horas > 0
                        ? 'Sin cursos en tu programa en este período.'
                        : 'Sin cursos asignados en este período.'}
                </p>
            ) : (
                <table className="carga-tabla">
                    <thead>
                        <tr><th>Programa</th><th>Curso</th><th>Grupo</th><th>Horas</th></tr>
                    </thead>
                    <tbody>
                        {carga.cursos.map((c) => (
                            <tr key={c.curso_id}>
                                <td>{c.code_program}</td>
                                <td>{c.nombre_asignatura} <span className="carga-codigo">({c.code_course})</span></td>
                                <td>{c.grupo ?? '—'}</td>
                                <td>
                                    {c.sin_horas
                                        ? <span className="carga-sin-horas" title="La asignatura no tiene horas definidas"><AlertTriangle size={12} /> sin definir</span>
                                        : <><Clock size={12} /> {c.horas}</>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {carga.otros_programas_horas > 0 && (
                <p className="carga-otros">Otros programas: <strong>{carga.otros_programas_horas} h</strong></p>
            )}
            {sinHoras > 0 && (
                <p className="carga-aviso">
                    {sinHoras} {sinHoras === 1 ? 'curso no tiene' : 'cursos no tienen'} horas definidas y no se está sumando.
                </p>
            )}
        </div>
    )
}