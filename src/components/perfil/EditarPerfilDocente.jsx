import React, { useRef, useState } from 'react'
import { AlertTriangle, Camera, Trash2, UserCircle } from 'lucide-react'
import { deleteMiFoto, updateMiContacto, uploadMiFoto } from '../../services/docenteService'

// HU-015: el docente edita su foto, correo personal y teléfono desde "Mi perfil".
// Nombres, apellidos y correo institucional son de solo lectura.

const FOTO_TAMANO_MAXIMO = 5 * 1024 * 1024
const FOTO_TIPOS = ['image/jpeg', 'image/png']

const MSG_SIN_CAMBIOS = 'No hay cambios para guardar'
const MSG_ACTUALIZADO = 'Perfil actualizado'
const MSG_ERROR_GUARDAR = 'No se pudo guardar. Intente de nuevo'
const MSG_FOTO_INVALIDA = 'Formato o tamaño no válido'
const MSG_ERROR_FOTO = 'No se pudo cargar la imagen'

const CORREO_REGEX = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/
const TELEFONO_REGEX = /^[0-9]{7,10}$/

// Mismas reglas que el backend (docs/contratos/HU-015.md)
function validar({ correoPersonal, telefono }) {
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

export default function EditarPerfilDocente({ docente, fotoSrc, onCancel, onSaved, onFotoChange, onShowToast }) {
    const original = {
        correoPersonal: normalizar(docente.correo_personal),
        telefono: normalizar(docente.telefono)
    }
    const [form, setForm] = useState(original)
    const [errores, setErrores] = useState({})
    const [confirmacion, setConfirmacion] = useState(null) // guardar | descartar | reemplazar-foto | eliminar-foto
    const [procesando, setProcesando] = useState(false)
    const [fotoPendiente, setFotoPendiente] = useState(null)
    const fileInputRef = useRef(null)

    const hayCambios =
        normalizar(form.correoPersonal).toLowerCase() !== original.correoPersonal.toLowerCase() ||
        normalizar(form.telefono) !== original.telefono

    const handleChange = (campo) => (e) => {
        const valor = campo === 'telefono' ? e.target.value.replace(/\D/g, '').slice(0, 10) : e.target.value
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
                telefono: normalizar(form.telefono) || null
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
                    telefono: erroresBackend.telefono
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

    // Criterio 5: JPG o PNG de máximo 5 MB
    const handleFotoSeleccionada = (e) => {
        const archivo = e.target.files?.[0]
        e.target.value = ''
        if (!archivo) return
        if (!FOTO_TIPOS.includes(archivo.type) || archivo.size === 0 || archivo.size > FOTO_TAMANO_MAXIMO) {
            onShowToast?.(MSG_FOTO_INVALIDA, 'error')
            return
        }
        setFotoPendiente(archivo)
        // Criterio 6: reemplazar una foto existente pide confirmación
        if (docente.tiene_foto) setConfirmacion('reemplazar-foto')
        else subirFoto(archivo)
    }

    const subirFoto = async (archivo) => {
        setProcesando(true)
        try {
            const actualizado = await uploadMiFoto(archivo)
            onShowToast?.(MSG_ACTUALIZADO, 'success')
            onFotoChange(actualizado)
        } catch (err) {
            onShowToast?.(err.status === 400 ? MSG_FOTO_INVALIDA : MSG_ERROR_FOTO, 'error')
        } finally {
            setProcesando(false)
            setFotoPendiente(null)
            setConfirmacion(null)
        }
    }

    const confirmarEliminarFoto = async () => {
        setProcesando(true)
        try {
            await deleteMiFoto()
            onShowToast?.(MSG_ACTUALIZADO, 'success')
            onFotoChange({ ...docente, tiene_foto: false })
        } catch {
            onShowToast?.(MSG_ERROR_GUARDAR, 'error')
        } finally {
            setProcesando(false)
            setConfirmacion(null)
        }
    }

    const cerrarConfirmacion = () => {
        if (procesando) return
        setConfirmacion(null)
        setFotoPendiente(null)
    }

    const iniciales = `${docente.nombres?.[0] ?? ''}${docente.apellidos?.[0] ?? ''}`.toUpperCase()

    return (
        <form onSubmit={handleGuardar} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            {/* Foto */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                {fotoSrc ? (
                    <img
                        src={fotoSrc}
                        alt="Tu foto de perfil"
                        style={{ width: '88px', height: '88px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4d4d8' }}
                    />
                ) : (
                    <div
                        aria-label="Sin foto"
                        style={{
                            width: '88px',
                            height: '88px',
                            borderRadius: '50%',
                            background: '#f4f4f5',
                            border: '2px solid #d4d4d8',
                            color: '#52525b',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.6rem',
                            fontWeight: 600
                        }}
                    >
                        {iniciales || <UserCircle size={40} />}
                    </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button
                            type="button"
                            className="btn-secondary btn-sm flex-align-center"
                            style={{ gap: '0.35rem' }}
                            onClick={() => fileInputRef.current?.click()}
                            disabled={procesando}
                        >
                            <Camera size={15} />
                            {docente.tiene_foto ? 'Cambiar foto' : 'Subir foto'}
                        </button>
                        {docente.tiene_foto && (
                            <button
                                type="button"
                                className="btn-danger btn-sm flex-align-center"
                                style={{ gap: '0.35rem' }}
                                onClick={() => setConfirmacion('eliminar-foto')}
                                disabled={procesando}
                            >
                                <Trash2 size={15} />
                                Eliminar foto
                            </button>
                        )}
                    </div>
                    <span className="form-hint">JPG o PNG, máximo 5 MB.</span>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleFotoSeleccionada}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>

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
            {confirmacion === 'reemplazar-foto' && fotoPendiente && (
                <ConfirmModal
                    titulo="Reemplazar foto"
                    mensaje={`¿Deseas reemplazar tu foto de perfil por «${fotoPendiente.name}»?`}
                    textoConfirmar="Sí, reemplazar"
                    procesando={procesando}
                    onConfirmar={() => subirFoto(fotoPendiente)}
                    onCancelar={cerrarConfirmacion}
                />
            )}
            {confirmacion === 'eliminar-foto' && (
                <ConfirmModal
                    titulo="Eliminar foto"
                    mensaje="¿Deseas eliminar tu foto de perfil? Se mostrará la imagen por defecto."
                    textoConfirmar="Sí, eliminar"
                    peligro
                    procesando={procesando}
                    onConfirmar={confirmarEliminarFoto}
                    onCancelar={cerrarConfirmacion}
                />
            )}
        </form>
    )
}
