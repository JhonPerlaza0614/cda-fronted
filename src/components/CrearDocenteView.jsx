'use client'

import React, { useState } from 'react'
import { UserPlus, AlertTriangle, HelpCircle } from 'lucide-react'
import { createDocente, updateDocente } from '../services/docenteService'

// Opciones (value = lo que espera el backend)
const TIPOS_DOCUMENTO = [
    { value: 'CC', label: 'CC - Cédula de ciudadanía' },
    { value: 'CE', label: 'CE - Cédula de extranjería' },
    { value: 'PP', label: 'PP - Pasaporte' }
]

const TIPOS_DOCENTE = [
    { value: 'NOMBRADO', label: 'Nombrado' },
    { value: 'HORA_CATEDRA', label: 'Hora cátedra' }
]

const CATEGORIAS = [
    { value: 'AUXILIAR', label: 'Auxiliar' },
    { value: 'ASISTENTE', label: 'Asistente' },
    { value: 'ASOCIADO', label: 'Asociado' },
    { value: 'TITULAR', label: 'Titular' }
]

const EMPTY_FORM = {
    codigo: '',
    nombres: '',
    apellidos: '',
    tipo_documento: '',
    numero_documento: '',
    correo_institucional: '',
    telefono: '',
    tipo_docente: '',
    categoria: '',
    code_program: '',
    foto_url: '',
    evaluacion_periodo: '',
    evaluacion_valor: ''
}

const SOLO_LETRAS = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]+$/
const SOLO_NUMEROS = /^[0-9]+$/
const CORREO_UNIVALLE = /^[a-zA-Z0-9._%+-]+@correounivalle\.edu\.co$/

// El backend (Spring) devuelve las claves de validación en camelCase
// (p. ej. "correoInstitucional"); el formulario usa snake_case.
const camelToSnake = (key) => key.replace(/[A-Z]/g, (m) => '_' + m.toLowerCase())

function validate(f) {
    const e = {}

    if (!f.codigo.trim()) e.codigo = 'El código del docente es obligatorio'
    else if (f.codigo.length > 20) e.codigo = 'El código no puede exceder 20 caracteres'

    if (!f.nombres.trim()) e.nombres = 'Los nombres son obligatorios'
    else if (f.nombres.length > 30) e.nombres = 'Los nombres no pueden exceder 30 caracteres'
    else if (!SOLO_LETRAS.test(f.nombres)) e.nombres = 'Los nombres solo pueden contener letras y espacios'

    if (!f.apellidos.trim()) e.apellidos = 'Los apellidos son obligatorios'
    else if (f.apellidos.length > 30) e.apellidos = 'Los apellidos no pueden exceder 30 caracteres'
    else if (!SOLO_LETRAS.test(f.apellidos)) e.apellidos = 'Los apellidos solo pueden contener letras y espacios'

    if (!f.tipo_documento) e.tipo_documento = 'El tipo de documento es obligatorio'

    if (!f.numero_documento.trim()) e.numero_documento = 'El número de documento es obligatorio'
    else if (f.numero_documento.length > 11) e.numero_documento = 'El número de documento no puede exceder 11 caracteres'
    else if (!SOLO_NUMEROS.test(f.numero_documento)) e.numero_documento = 'El número de documento solo puede contener números'

    if (!f.correo_institucional.trim()) e.correo_institucional = 'El correo institucional es obligatorio'
    else if (f.correo_institucional.length > 50) e.correo_institucional = 'El correo no puede exceder 50 caracteres'
    else if (!CORREO_UNIVALLE.test(f.correo_institucional.trim())) e.correo_institucional = 'El correo debe tener dominio @correounivalle.edu.co'

    if (f.telefono.length > 20) e.telefono = 'El teléfono no puede exceder 20 caracteres'

    if (!f.tipo_docente) e.tipo_docente = 'El tipo de docente es obligatorio'
    if (!f.categoria) e.categoria = 'La categoría es obligatoria'
    if (!f.code_program) e.code_program = 'El programa de adscripción es obligatorio'

    if (f.foto_url.trim()) {
        try {
            const u = new URL(f.foto_url.trim())
            if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error()
        } catch {
            e.foto_url = 'Ingresa una URL válida (http o https)'
        }
    }

    if (f.evaluacion_periodo.length > 10) e.evaluacion_periodo = 'El periodo no puede exceder 10 caracteres'
    if (f.evaluacion_valor !== '' && Number.isNaN(Number(f.evaluacion_valor))) {
        e.evaluacion_valor = 'El valor debe ser numérico'
    }
    if (f.evaluacion_valor !== '' && !f.evaluacion_periodo.trim()) {
        e.evaluacion_periodo = 'El periodo es obligatorio si hay un valor de evaluación'
    }

    return e
}

function buildPayload(f) {
    const opt = (v) => (v && v.trim() ? v.trim() : null)
    return {
        codigo: f.codigo.trim(),
        nombres: f.nombres.trim(),
        apellidos: f.apellidos.trim(),
        tipo_documento: f.tipo_documento,
        numero_documento: f.numero_documento.trim(),
        correo_institucional: f.correo_institucional.trim().toLowerCase(),
        telefono: opt(f.telefono),
        tipo_docente: f.tipo_docente,
        categoria: f.categoria,
        code_program: f.code_program,
        foto_url: opt(f.foto_url),
        evaluacion_periodo: opt(f.evaluacion_periodo),
        evaluacion_valor: f.evaluacion_valor === '' ? null : Number(f.evaluacion_valor)
    }
}

function Field({ label, required, error, children }) {
    return (
        <div className="form-group">
            <label>
                {label} {required && '*'}
            </label>
            {children}
            {error && (
                <small style={{ color: '#ef4444', fontSize: '0.78rem', display: 'block', marginTop: '0.25rem' }}>
                    {error}
                </small>
            )}
        </div>
    )
}

function ConfirmModal({ icon, title, children, confirmLabel, cancelLabel, onConfirm, onCancel, busy }) {
    return (
        <div className="modal-backdrop">
            <div className="modal-card" style={{ maxWidth: '440px' }}>
                <div className="modal-header">
                    <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {icon} {title}
                    </h3>
                </div>
                <div className="modal-body">{children}</div>
                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
                        {cancelLabel}
                    </button>
                    <button type="button" className="btn-primary" onClick={onConfirm} disabled={busy}>
                        {busy ? 'Guardando...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}

export default function CrearDocenteView({ programas = [], onShowToast, onCancel, onSaved }) {
    const [formData, setFormData] = useState(EMPTY_FORM)
    const [errors, setErrors] = useState({})
    const [confirmOpen, setConfirmOpen] = useState(false) // "¿La información es correcta?"
    const [cancelOpen, setCancelOpen] = useState(false) // "¿Seguro que desea cancelar?"
    const [existingId, setExistingId] = useState(null) // 409: docente ya existe
    const [submitting, setSubmitting] = useState(false)

    const isDirty = JSON.stringify(formData) !== JSON.stringify(EMPTY_FORM)

    const update = (name, value) => {
        setFormData((prev) => ({ ...prev, [name]: value }))
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: undefined }))
    }

    const finishSuccess = (saved, message) => {
        onShowToast?.(message, 'success')
        setFormData(EMPTY_FORM)
        setErrors({})
        setExistingId(null)
        onSaved?.(saved)
    }

    const handleApiError = (err) => {
        // 400 con errores por campo
        if (err.status === 400 && err.body?.errors) {
            const mapped = {}
            Object.entries(err.body.errors).forEach(([key, msg]) => {
                mapped[camelToSnake(key)] = msg
            })
            setErrors(mapped)
            onShowToast?.('Revisa los campos marcados', 'warning')
            return
        }
        // 400 con mensaje general (programa inexistente, evaluación incompleta, etc.)
        if (err.status === 400) {
            onShowToast?.(err.message, 'warning')
            return
        }
        // 409 por documento repetido: ofrecer actualizar
        if (err.status === 409 && err.body?.docente_existente_id) {
            setExistingId(err.body.docente_existente_id)
            return
        }
        // 409 por código o correo repetidos
        if (err.status === 409) {
            onShowToast?.(err.message, 'error')
            return
        }
        // 500 o sin conexión: no se borra lo escrito
        onShowToast?.('No se pudo guardar. Intente de nuevo', 'error')
    }

    // Botón "Guardar": valida y pide confirmación
    const handleSave = (e) => {
        e.preventDefault()
        const found = validate(formData)
        setErrors(found)
        if (Object.keys(found).length > 0) {
            onShowToast?.('Revisa los campos marcados', 'warning')
            return
        }
        setConfirmOpen(true)
    }

    // "Sí" en la confirmación: envía el POST
    const submitCreate = async () => {
        setConfirmOpen(false)
        setSubmitting(true)
        try {
            const created = await createDocente(buildPayload(formData))
            finishSuccess(created, 'Perfil de docente creado')
        } catch (err) {
            handleApiError(err)
        } finally {
            setSubmitting(false)
        }
    }

    // 409 → "Sí, actualizar": PUT con los datos nuevos
    const submitUpdate = async () => {
        const id = existingId
        setSubmitting(true)
        try {
            const updated = await updateDocente(id, buildPayload(formData))
            finishSuccess(updated, 'Perfil de docente actualizado')
        } catch (err) {
            setExistingId(null)
            handleApiError(err)
        } finally {
            setSubmitting(false)
        }
    }

    const handleCancelClick = () => {
        if (isDirty) setCancelOpen(true)
        else onCancel?.()
    }

    const confirmCancel = () => {
        setCancelOpen(false)
        setFormData(EMPTY_FORM)
        setErrors({})
        onCancel?.()
    }

    return (
        <div className="view-container">
            <div className="view-header">
                <div>
                    <h1 className="view-title flex-align-center" style={{ gap: '0.75rem' }}>
                        <UserPlus size={28} className="text-primary" />
                        Crear perfil de docente
                    </h1>
                    <p className="view-subtitle">Registra los datos del docente y su programa de adscripción</p>
                </div>
            </div>

            <form onSubmit={handleSave} noValidate>
                <div
                    className="modal-body"
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem' }}
                >
                    <Field label="Código de docente" required error={errors.codigo}>
                        <input
                            type="text"
                            maxLength={20}
                            placeholder="Ej. 1001"
                            value={formData.codigo}
                            onChange={(e) => update('codigo', e.target.value)}
                        />
                    </Field>

                    <Field label="Nombres" required error={errors.nombres}>
                        <input
                            type="text"
                            maxLength={30}
                            placeholder="Ej. Juan Carlos"
                            value={formData.nombres}
                            onChange={(e) => update('nombres', e.target.value)}
                        />
                    </Field>

                    <Field label="Apellidos" required error={errors.apellidos}>
                        <input
                            type="text"
                            maxLength={30}
                            placeholder="Ej. Pérez López"
                            value={formData.apellidos}
                            onChange={(e) => update('apellidos', e.target.value)}
                        />
                    </Field>

                    <Field label="Tipo de documento" required error={errors.tipo_documento}>
                        <select value={formData.tipo_documento} onChange={(e) => update('tipo_documento', e.target.value)}>
                            <option value="">-- Selecciona --</option>
                            {TIPOS_DOCUMENTO.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Número de documento" required error={errors.numero_documento}>
                        <input
                            type="text"
                            inputMode="numeric"
                            maxLength={11}
                            placeholder="Ej. 10234567"
                            value={formData.numero_documento}
                            onChange={(e) => update('numero_documento', e.target.value)}
                        />
                    </Field>

                    <Field label="Correo institucional" required error={errors.correo_institucional}>
                        <input
                            type="email"
                            maxLength={50}
                            placeholder="nombre.apellido@correounivalle.edu.co"
                            value={formData.correo_institucional}
                            onChange={(e) => update('correo_institucional', e.target.value)}
                        />
                    </Field>

                    <Field label="Teléfono" error={errors.telefono}>
                        <input
                            type="text"
                            maxLength={20}
                            placeholder="Ej. 3001234567"
                            value={formData.telefono}
                            onChange={(e) => update('telefono', e.target.value)}
                        />
                    </Field>

                    <Field label="Tipo de docente" required error={errors.tipo_docente}>
                        <select value={formData.tipo_docente} onChange={(e) => update('tipo_docente', e.target.value)}>
                            <option value="">-- Selecciona --</option>
                            {TIPOS_DOCENTE.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Categoría" required error={errors.categoria}>
                        <select value={formData.categoria} onChange={(e) => update('categoria', e.target.value)}>
                            <option value="">-- Selecciona --</option>
                            {CATEGORIAS.map((c) => (
                                <option key={c.value} value={c.value}>
                                    {c.label}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Programa de adscripción" required error={errors.code_program}>
                        <select value={formData.code_program} onChange={(e) => update('code_program', e.target.value)}>
                            <option value="">-- Selecciona --</option>
                            {programas.map((p) => (
                                <option key={p.code_program} value={p.code_program}>
                                    {p.name_program} ({p.code_program})
                                </option>
                            ))}
                        </select>
                    </Field>

                    <Field label="Foto (URL)" error={errors.foto_url}>
                        <input
                            type="url"
                            placeholder="https://ejemplo.com/foto.jpg"
                            value={formData.foto_url}
                            onChange={(e) => update('foto_url', e.target.value)}
                        />
                    </Field>

                    <Field label="Evaluación - Periodo" error={errors.evaluacion_periodo}>
                        <input
                            type="text"
                            maxLength={10}
                            placeholder="Ej. 2025-1"
                            value={formData.evaluacion_periodo}
                            onChange={(e) => update('evaluacion_periodo', e.target.value)}
                        />
                    </Field>

                    <Field label="Evaluación - Valor" error={errors.evaluacion_valor}>
                        <input
                            type="number"
                            step="0.01"
                            placeholder="Ej. 4.5"
                            value={formData.evaluacion_valor}
                            onChange={(e) => update('evaluacion_valor', e.target.value)}
                        />
                    </Field>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn-secondary" onClick={handleCancelClick} disabled={submitting}>
                        Cancelar
                    </button>
                    <button type="submit" className="btn-primary" disabled={submitting}>
                        {submitting ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </form>

            {/* HU-026 punto 7: confirmación antes de enviar */}
            {confirmOpen && (
                <ConfirmModal
                    icon={<HelpCircle size={20} />}
                    title="Confirmar"
                    confirmLabel="Sí"
                    cancelLabel="No"
                    onConfirm={submitCreate}
                    onCancel={() => setConfirmOpen(false)}
                >
                    <p>¿La información es correcta?</p>
                </ConfirmModal>
            )}

            {/* HU-026 punto 8: confirmar cancelación si hay datos */}
            {cancelOpen && (
                <ConfirmModal
                    icon={<AlertTriangle size={20} />}
                    title="Cancelar"
                    confirmLabel="Sí, cancelar"
                    cancelLabel="Volver al formulario"
                    onConfirm={confirmCancel}
                    onCancel={() => setCancelOpen(false)}
                >
                    <p>¿Seguro que desea cancelar? Se perderán los datos ingresados.</p>
                </ConfirmModal>
            )}

            {/* HU-026 punto 6: el documento ya existe */}
            {existingId && (
                <ConfirmModal
                    icon={<AlertTriangle size={20} />}
                    title="Docente existente"
                    confirmLabel="Sí, actualizar"
                    cancelLabel="No"
                    busy={submitting}
                    onConfirm={submitUpdate}
                    onCancel={() => setExistingId(null)}
                >
                    <p>Ya existe esta persona. ¿Desea actualizarla?</p>
                </ConfirmModal>
            )}
        </div>
    )
}