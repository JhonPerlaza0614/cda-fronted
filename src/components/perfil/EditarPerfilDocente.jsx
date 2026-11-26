import React, { useEffect, useState } from 'react'
import { AlertTriangle, X } from 'lucide-react'
import { updateMiContacto } from '../../services/docenteService'
import { listarEscuelas } from '../../services/asociacionesService'

// HU-015: el docente edita su facultad, correo personal, teléfono, celular y dirección desde "Mi perfil".
// Nombres, apellidos y correo institucional son de solo lectura.

const MSG_SIN_CAMBIOS = 'No hay cambios para guardar'
const MSG_ACTUALIZADO = 'Perfil actualizado'
const MSG_ERROR_GUARDAR = 'No se pudo guardar. Intente de nuevo'
// Celular: opcional, distinto del teléfono, 10 dígitos y empieza por 3.
const MSG_CELULAR_INVALIDO = 'El celular debe tener 10 dígitos y empezar por 3'

const CORREO_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const TELEFONO_REGEX = /^[0-9]{7,10}$/
const CELULAR_REGEX = /^3[0-9]{9}$/
const CAMPOS_NUMERICOS = new Set(['telefono', 'celular'])

// Mismas reglas que el backend (docs/contratos/HU-015.md)
function validar({ correoPersonal, telefono, celular }) {
    const errores = {}
    const correo = correoPersonal.trim()
    if (correo) {
        if (correo.length > 100) {
            errores.correoPersonal = 'El correo personal no puede exceder 100 caracteres'
        } else if (!CORREO_REGEX.test(correo)) {
            errores.correoPersonal = 'El correo personal no tiene un formato válido'
        } else if (correo.toLowerCase().endsWith('@correounivalle.edu.co')) {
            errores.correoPersonal = 'El correo personal no puede ser institucional'
        }
    }
    const tel = telefono.trim()
    if (tel && !TELEFONO_REGEX.test(tel)) {
        errores.telefono = 'El teléfono solo admite de 7 a 10 dígitos'
    }
    const cel = celular.trim()
    if (cel && !CELULAR_REGEX.test(cel)) {
        errores.celular = MSG_CELULAR_INVALIDO
    }
    return errores
}

const normalizar = (valor) => (valor ?? '').trim()

function ConfirmModal({ titulo, mensaje, textoConfirmar, peligro, procesando, onConfirmar, onCancelar }) {
    return (
        <div className="modal-backdrop">
            <div className="modal-card" role="dialog" aria-modal="true" style={{ maxWidth: '460px', width: '100%' }}>
                <div className="modal-header">
                    <div className="modal-title-with-icon">
                        <AlertTriangle className={peligro ? 'text-danger' : 'text-primary'} size={22} />
                        <h2>{titulo}</h2>
                    </div>
                    <button className="modal-close-btn" onClick={onCancelar} disabled={procesando} aria-label="Cerrar">×</button>
                </div>
                <div className="modal-body">
                    <p style={{ margin: 0 }}>{mensaje}</p>
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onCancelar} disabled={procesando}>
                        Cancelar
                    </button>
                    <button
                        type="button"
                        className={peligro ? 'btn-danger' : 'btn-primary'}
                        onClick={onConfirmar}
                        disabled={procesando}
                    >
                        {procesando ? 'Procesando...' : textoConfirmar}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function EditarPerfilDocente({ docente, onCancel, onSaved, onShowToast }) {
    const [escuelasCatalogo, setEscuelasCatalogo] = useState([])
    const [cargandoEscuelas, setCargandoEscuelas] = useState(true)
    const [busquedaEscuela, setBusquedaEscuela] = useState('')

    const escuelasIniciales = Array.isArray(docente.escuelas)
        ? docente.escuelas.map((e) => String(e.codigo).trim().toUpperCase()).sort()
        : []

    const [original] = useState({
        correoPersonal: normalizar(docente.correo_personal),
        telefono: normalizar(docente.telefono),
        celular: normalizar(docente.celular),
        direccion: normalizar(docente.direccion),
        codigosEscuelas: escuelasIniciales
    })
    const [form, setForm] = useState(original)
    const [errores, setErrores] = useState({})
    const [confirmacion, setConfirmacion] = useState(null) // guardar | descartar
    const [procesando, setProcesando] = useState(false)

    useEffect(() => {
        let isMounted = true
        listarEscuelas()
            .then((data) => {
                if (!isMounted) return
                if (Array.isArray(data)) {
                    setEscuelasCatalogo(data)
                }
            })
            .catch((err) => {
                console.warn('Error al cargar escuelas:', err)
            })
            .finally(() => {
                if (isMounted) setCargandoEscuelas(false)
            })
        return () => {
            isMounted = false
        }
    }, [])

    const toggleEscuela = (codigo) => {
        const cod = String(codigo).trim().toUpperCase()
        setForm((prev) => {
            const existe = prev.codigosEscuelas.includes(cod)
            const siguiente = existe
                ? prev.codigosEscuelas.filter((c) => c !== cod)
                : [...prev.codigosEscuelas, cod].sort()
            return { ...prev, codigosEscuelas: siguiente }
        })
    }

    const escuelasFiltradas = escuelasCatalogo.filter((e) => {
        const q = busquedaEscuela.trim().toLowerCase()
        if (!q) return true
        return `${e.codigo} ${e.nombre}`.toLowerCase().includes(q)
    })

    const hayCambios =
        normalizar(form.correoPersonal).toLowerCase() !== original.correoPersonal.toLowerCase() ||
        normalizar(form.telefono) !== original.telefono ||
        normalizar(form.celular) !== original.celular ||
        normalizar(form.direccion) !== original.direccion ||
        JSON.stringify([...form.codigosEscuelas].sort()) !== JSON.stringify([...original.codigosEscuelas].sort())

    const handleChange = (campo) => (e) => {
        const valor = CAMPOS_NUMERICOS.has(campo) ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value
        setForm((prev) => ({ ...prev, [campo]: valor }))
        setErrores((prev) => ({ ...prev, [campo]: undefined }))
    }

    // Criterio 7 y 8: sin cambios no se guarda; con cambios se pide confirmación
    const handleGuardar = (e) => {
        e.preventDefault()
        if (!hayCambios) {
            onShowToast?.(MSG_SIN_CAMBIOS, 'info')
            return
        }
        const nuevosErrores = validar(form)
        setErrores(nuevosErrores)
        if (Object.keys(nuevosErrores).length === 0) setConfirmacion('guardar')
    }

    const confirmarGuardar = async () => {
        setProcesando(true)
        try {
            const actualizado = await updateMiContacto({
                correo_personal: normalizar(form.correoPersonal) || null,
                telefono: normalizar(form.telefono) || null,
                celular: normalizar(form.celular) || null,
                direccion: form.direccion.trim() || null,
                codigos_escuelas: form.codigosEscuelas
            })
            setConfirmacion(null)
            onShowToast?.(MSG_ACTUALIZADO, 'success')
            onSaved(actualizado)
        } catch (err) {
            setConfirmacion(null)
            // Criterio 12: se conserva lo escrito
            const erroresBackend = err.body?.errors
            if (err.status === 400 && erroresBackend) {
                setErrores({
                    correoPersonal: erroresBackend.correoPersonal || erroresBackend.correo_personal,
                    telefono: erroresBackend.telefono,
                    celular: erroresBackend.celular,
                    direccion: erroresBackend.direccion,
                    idFacultad: erroresBackend.idFacultad || erroresBackend.id_facultad
                })
            } else if (err.status === 400 && err.message === MSG_SIN_CAMBIOS) {
                onShowToast?.(MSG_SIN_CAMBIOS, 'info')
            } else {
                onShowToast?.(MSG_ERROR_GUARDAR, 'error')
            }
        } finally {
            setProcesando(false)
        }
    }

    // Criterio 11: al cancelar con cambios se pide confirmación
    const handleCancelar = () => {
        if (hayCambios) setConfirmacion('descartar')
        else onCancel()
    }

    const cerrarConfirmacion = () => {
        if (procesando) return
        setConfirmacion(null)
    }

    return (
        <form onSubmit={handleGuardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Solo lectura */}
            <div className="form-group">
                <label htmlFor="perfil-nombres">Nombres</label>
                <input id="perfil-nombres" type="text" value={docente.nombres ?? ''} disabled readOnly />
            </div>
            <div className="form-group">
                <label htmlFor="perfil-apellidos">Apellidos</label>
                <input id="perfil-apellidos" type="text" value={docente.apellidos ?? ''} disabled readOnly />
            </div>
            <div className="form-group">
                <label htmlFor="perfil-correo-institucional">Correo institucional</label>
                <input
                    id="perfil-correo-institucional"
                    type="email"
                    value={docente.correo_institucional ?? ''}
                    disabled
                    readOnly
                />
                <span className="form-hint">Estos datos solo los modifica el administrador.</span>
            </div>

            {/* Editables */}
            <div className="form-group">
                <label htmlFor="perfil-escuelas-buscar">Unidades académicas a las que perteneces ({form.codigosEscuelas.length})</label>
                {form.codigosEscuelas.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.45rem' }}>
                        {form.codigosEscuelas.map((cod) => {
                            const esc = escuelasCatalogo.find((e) => e.codigo === cod)
                            return (
                                <span
                                    key={cod}
                                    style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                        padding: '0.25rem 0.6rem',
                                        borderRadius: '999px',
                                        background: '#eff6ff',
                                        border: '1px solid #bfdbfe',
                                        color: '#1d4ed8',
                                        fontSize: '0.8rem',
                                        fontWeight: 600
                                    }}
                                >
                                    <span>{cod}{esc ? ` · ${esc.nombre}` : ''}</span>
                                    <button
                                        type="button"
                                        onClick={() => toggleEscuela(cod)}
                                        disabled={procesando}
                                        aria-label={`Quitar escuela ${cod}`}
                                        style={{
                                            border: 'none',
                                            background: 'transparent',
                                            color: '#1d4ed8',
                                            cursor: 'pointer',
                                            padding: 0,
                                            display: 'inline-flex'
                                        }}
                                    >
                                        <X size={13} />
                                    </button>
                                </span>
                            )
                        })}
                    </div>
                )}
                <input
                    id="perfil-escuelas-buscar"
                    type="text"
                    value={busquedaEscuela}
                    onChange={(e) => setBusquedaEscuela(e.target.value)}
                    placeholder={cargandoEscuelas ? 'Cargando unidades académicas...' : 'Buscar unidad académica por código o nombre...'}
                    disabled={procesando || cargandoEscuelas}
                />
                <div
                    style={{
                        maxHeight: '175px',
                        overflowY: 'auto',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0.4rem',
                        marginTop: '0.35rem',
                        background: '#ffffff',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.2rem'
                    }}
                >
                    {cargandoEscuelas ? (
                        <span className="form-hint" style={{ padding: '0.35rem' }}>Cargando catálogo de unidades académicas...</span>
                    ) : escuelasFiltradas.length === 0 ? (
                        <span className="form-hint" style={{ padding: '0.35rem' }}>Sin unidades académicas que coincidan con la búsqueda.</span>
                    ) : (
                        escuelasFiltradas.map((esc) => {
                            const checked = form.codigosEscuelas.includes(esc.codigo)
                            return (
                                <label
                                    key={esc.codigo}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.5rem',
                                        padding: '0.3rem 0.45rem',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        background: checked ? '#eff6ff' : 'transparent',
                                        fontSize: '0.84rem',
                                        fontWeight: checked ? 600 : 400
                                    }}
                                >
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => toggleEscuela(esc.codigo)}
                                        disabled={procesando}
                                    />
                                    <span><strong>{esc.codigo}</strong> — {esc.nombre}</span>
                                </label>
                            )
                        })
                    )}
                </div>
                <span className="form-hint">Puedes seleccionar una o varias unidades académicas a las que perteneces.</span>
            </div>

            <div className="form-group">
                <label htmlFor="perfil-correo-personal">Correo personal (opcional)</label>
                <input
                    id="perfil-correo-personal"
                    type="email"
                    maxLength={100}
                    value={form.correoPersonal}
                    onChange={handleChange('correoPersonal')}
                    aria-invalid={Boolean(errores.correoPersonal)}
                    className={errores.correoPersonal ? 'input-error' : undefined}
                    disabled={procesando}
                />
                {errores.correoPersonal && <span className="field-error">{errores.correoPersonal}</span>}
            </div>
            <div className="form-group">
                <label htmlFor="perfil-telefono">Teléfono (opcional)</label>
                <input
                    id="perfil-telefono"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={form.telefono}
                    onChange={handleChange('telefono')}
                    aria-invalid={Boolean(errores.telefono)}
                    className={errores.telefono ? 'input-error' : undefined}
                    disabled={procesando}
                />
                {errores.telefono && <span className="field-error">{errores.telefono}</span>}
            </div>
            <div className="form-group">
                <label htmlFor="perfil-celular">Celular (opcional)</label>
                <input
                    id="perfil-celular"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={10}
                    value={form.celular}
                    onChange={handleChange('celular')}
                    aria-invalid={Boolean(errores.celular)}
                    aria-describedby={errores.celular ? 'perfil-celular-error' : 'perfil-celular-ayuda'}
                    className={errores.celular ? 'input-error' : undefined}
                    disabled={procesando}
                />
                {errores.celular
                    ? <span id="perfil-celular-error" className="field-error">{errores.celular}</span>
                    : <span id="perfil-celular-ayuda" className="form-hint">Solo números: 10 dígitos y empieza por 3. Puedes dejarlo vacío.</span>}
            </div>
            <div className="form-group">
                <label htmlFor="perfil-direccion">Dirección de vivienda (opcional)</label>
                <input
                    id="perfil-direccion"
                    type="text"
                    maxLength={150}
                    value={form.direccion}
                    onChange={(e) => setForm({ ...form, direccion: e.target.value })}
                    placeholder="Ej. Calle 30 # 25-10, Palmira"
                    aria-invalid={Boolean(errores.direccion)}
                    className={errores.direccion ? 'input-error' : undefined}
                    disabled={procesando}
                />
                {errores.direccion && <span className="field-error">{errores.direccion}</span>}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="btn-secondary" onClick={handleCancelar} disabled={procesando}>
                    Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={procesando}>
                    Guardar cambios
                </button>
            </div>

            {confirmacion === 'guardar' && (
                <ConfirmModal
                    titulo="Guardar cambios"
                    mensaje="¿Deseas guardar los cambios de tu perfil?"
                    textoConfirmar="Sí, guardar"
                    procesando={procesando}
                    onConfirmar={confirmarGuardar}
                    onCancelar={cerrarConfirmacion}
                />
            )}
            {confirmacion === 'descartar' && (
                <ConfirmModal
                    titulo="Descartar cambios"
                    mensaje="Tienes cambios sin guardar. ¿Deseas descartarlos?"
                    textoConfirmar="Sí, descartar"
                    peligro
                    onConfirmar={onCancel}
                    onCancelar={cerrarConfirmacion}
                />
            )}
        </form>
    )
}