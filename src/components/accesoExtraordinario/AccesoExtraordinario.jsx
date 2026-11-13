import { useCallback, useEffect, useState } from 'react'
import {
    getAccesoExtraordinario,
    habilitarAccesoExtraordinario,
    revocarAccesoExtraordinario,
} from '../../services/docenteService'
import { formatearFechaHora } from '../../utils/formatoFechas'

const MAX_DIAS = 30

// Valor para <input type="datetime-local"> en hora local
const aInputLocal = (fecha) => {
    const p = (n) => String(n).padStart(2, '0')
    return `${fecha.getFullYear()}-${p(fecha.getMonth() + 1)}-${p(fecha.getDate())}T${p(fecha.getHours())}:${p(fecha.getMinutes())}`
}

export default function AccesoExtraordinario({ docenteId, docenteNombre, onShowToast }) {
    const [acceso, setAcceso] = useState(null)
    const [cargando, setCargando] = useState(true)
    const [formAbierto, setFormAbierto] = useState(false)
    const [fin, setFin] = useState('')
    const [motivo, setMotivo] = useState('')
    const [error, setError] = useState('')
    const [guardando, setGuardando] = useState(false)

    const cargar = useCallback(async () => {
        setCargando(true)
        try {
            setAcceso(await getAccesoExtraordinario(docenteId))
        } catch (e) {
            setAcceso(null)
            onShowToast?.(e.message || 'No se pudo consultar el acceso extraordinario', 'error')
        } finally {
            setCargando(false)
        }
    }, [docenteId, onShowToast])

    useEffect(() => {
        setFormAbierto(false)
        setFin('')
        setMotivo('')
        setError('')
        cargar()
    }, [cargar])

    const habilitar = async (e) => {
        e.preventDefault()
        const fecha = new Date(fin)
        const ahora = new Date()
        if (!fin || Number.isNaN(fecha.getTime()) || fecha <= ahora) {
            setError('La fecha y hora de fin deben ser posteriores al momento actual')
            return
        }
        if (fecha.getTime() > ahora.getTime() + MAX_DIAS * 24 * 3600 * 1000) {
            setError(`El acceso extraordinario no puede durar más de ${MAX_DIAS} días`)
            return
        }
        if (!motivo.trim()) {
            setError('El motivo es obligatorio')
            return
        }
        setError('')
        setGuardando(true)
        try {
            await habilitarAccesoExtraordinario(docenteId, {
                fecha_fin: fecha.toISOString(),
                motivo: motivo.trim(),
            })
            onShowToast?.('Acceso extraordinario habilitado', 'success')
            setFormAbierto(false)
            setFin('')
            setMotivo('')
            await cargar()
        } catch (err) {
            setError(err.message || 'No se pudo habilitar el acceso extraordinario')
        } finally {
            setGuardando(false)
        }
    }

    const revocar = async () => {
        if (!window.confirm(`¿Revocar el acceso extraordinario de ${docenteNombre || 'este docente'}?`)) return
        try {
            await revocarAccesoExtraordinario(docenteId)
            onShowToast?.('Acceso extraordinario revocado', 'success')
            await cargar()
        } catch (err) {
            onShowToast?.(err.message || 'No se pudo revocar el acceso', 'error')
        }
    }

    const caja = { marginTop: 16, padding: 12, border: '1px solid #ddd', borderRadius: 8 }
    const campo = { display: 'block', width: '100%', marginTop: 4, padding: 6, boxSizing: 'border-box' }

    return (
        <div style={caja}>
            <strong>Acceso extraordinario</strong>
            {cargando ? (
                <p>Cargando…</p>
            ) : acceso ? (
                <div>
                    <p style={{ margin: '8px 0 0' }}>Vigente hasta {formatearFechaHora(acceso.fecha_fin)}</p>
                    <p style={{ margin: '4px 0' }}>Motivo: {acceso.motivo}</p>
                    <button type="button" onClick={revocar}>Revocar acceso</button>
                </div>
            ) : formAbierto ? (
                <form onSubmit={habilitar} style={{ marginTop: 8 }}>
                    <label>
                        Fin del acceso (fecha y hora)
                        <input type="datetime-local" value={fin} min={aInputLocal(new Date())}
                            onChange={(e) => setFin(e.target.value)} style={campo} />
                    </label>
                    <label style={{ display: 'block', marginTop: 8 }}>
                        Motivo (obligatorio)
                        <textarea value={motivo} maxLength={500} rows={3}
                            onChange={(e) => setMotivo(e.target.value)} style={campo} />
                    </label>
                    {error && <p role="alert" style={{ color: '#b00020' }}>{error}</p>}
                    <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                        <button type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Habilitar'}</button>
                        <button type="button" onClick={() => { setFormAbierto(false); setError('') }}>Cancelar</button>
                    </div>
                </form>
            ) : (
                <div style={{ marginTop: 8 }}>
                    <button type="button" onClick={() => setFormAbierto(true)}>Habilitar acceso extraordinario</button>
                </div>
            )}
        </div>
    )
}