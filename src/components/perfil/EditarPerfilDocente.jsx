import React, { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { updateMiContacto } from '../../services/docenteService'
import { getFacultades } from '../../services/academicService'

// HU-015: el docente edita su facultad, correo personal, teléfono y celular desde "Mi perfil".
// Nombres, apellidos y correo institucional son de solo lectura.

const MSG_SIN_CAMBIOS = 'No hay cambios para guardar'
const MSG_ACTUALIZADO = 'Perfil actualizado'
const MSG_ERROR_GUARDAR = 'No se pudo guardar. Intente de nuevo'
// Celular (2026-11-10): opcional, distinto del teléfono, de 7 a 10 dígitos.
const MSG_CELULAR_INVALIDO = 'Por favor complete este campo correctamente'

const CORREO_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const TELEFONO_REGEX = /^[0-9]{7,10}$/
const CELULAR_REGEX = /^[0-9]{7,10}$/
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
    const [facultades, setFacultades] = useState([])
    const [cargandoFacultades, setCargandoFacultades] = useState(true)

    const [original, setOriginal] = useState({
        correoPersonal: normalizar(docente.correo_personal),
        telefono: normalizar(docente.telefono),
        celular: normalizar(docente.celular),
        idFacultad: docente.id_facultad != null ? String(docente.id_facultad) : ''
    })
    const [form, setForm] = useState(original)
    const [errores, setErrores] = useState({})
    const [confirmacion, setConfirmacion] = useState(null) // guardar | descartar
    const [procesando, setProcesando] = useState(false)

    useEffect(() => {
        let isMounted = true
        getFacultades()
            .then((data) => {
                if (!isMounted) return
                if (Array.isArray(data)) {
                    setFacultades(data)
                    if (docente.id_facultad == null && docente.nombre_facultad) {
                        const encontrada = data.find(
                            (f) => (f.nombre || f.Nombre)?.trim().toLowerCase() === docente.nombre_facultad.trim().toLowerCase()
                        )
                        if (encontrada) {
                            const idStr = String(encontrada.id)
                            setOriginal((prev) => ({ ...prev, idFacultad: idStr }))
                            setForm((prev) => (prev.idFacultad ? prev : { ...prev, idFacultad: idStr }))
                        }
                    }
                }
            })
            .catch((err) => {
                console.warn('Error al cargar facultades:', err)
            })
            .finally(() => {
                if (isMounted) setCargandoFacultades(false)
            })
        return () => {
            isMounted = false
        }
    }, [docente.id_facultad, docente.nombre_facultad])

    const hayCambios =
        normalizar(form.correoPersonal).toLowerCase() !== original.correoPersonal.toLowerCase() ||
        normalizar(form.telefono) !== original.telefono ||
        normalizar(form.celular) !== original.celular ||
        String(form.idFacultad || '') !== String(original.idFacultad || '')

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
                id_facultad: form.idFacultad ? parseInt(form.idFacultad, 10) : null
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
                <label htmlFor="perfil-facultad">Facultad</label>
                <select
                    id="perfil-facultad"
                    value={form.idFacultad}
                    onChange={handleChange('idFacultad')}
                    disabled={procesando || cargandoFacultades}
                    aria-invalid={Boolean(errores.idFacultad)}
                    className={errores.idFacultad ? 'input-error' : undefined}
                >
                    <option value="">
                        {cargandoFacultades ? 'Cargando facultades...' : 'Seleccione una facultad...'}
                    </option>
                    {facultades.map((fac) => (
                        <option key={fac.id} value={fac.id}>
                            {fac.nombre || fac.Nombre}
                        </option>
                    ))}
                </select>
                {errores.idFacultad && <span className="field-error">{errores.idFacultad}</span>}
                <span className="form-hint">Facultad a la que estás adscrito.</span>
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
                    : <span id="perfil-celular-ayuda" className="form-hint">Solo números, de 7 a 10 dígitos. Puedes dejarlo vacío.</span>}
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
