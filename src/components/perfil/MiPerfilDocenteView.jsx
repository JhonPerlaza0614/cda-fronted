'use client'

import React, { useState, useEffect } from 'react'
import { UserCircle, Mail, IdCard, Award, Briefcase, BookOpen, CheckCircle2, XCircle, Star } from 'lucide-react'
import { getMiPerfil } from '../../services/docenteService'

const TIPO_DOCENTE_LABEL = { NOMBRADO: 'Nombrado', HORA_CATEDRA: 'Hora cátedra' }
const CATEGORIA_LABEL = { AUXILIAR: 'Auxiliar', ASISTENTE: 'Asistente', ASOCIADO: 'Asociado', TITULAR: 'Titular' }

function Row({ icon, label, children }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.92rem' }}>
            <span style={{ color: '#71717a', display: 'inline-flex' }}>{icon}</span>
            <span style={{ color: '#71717a', minWidth: '130px' }}>{label}</span>
            <span style={{ color: '#27272a' }}>{children}</span>
        </div>
    )
}

export default function MiPerfilDocenteView({ correo, onShowToast }) {
    const [docente, setDocente] = useState(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const [fotoError, setFotoError] = useState(false)

    useEffect(() => {
        if (!correo) {
            setLoading(false)
            return
        }
        let cancelled = false
        setLoading(true)
        setNotFound(false)
        setFotoError(false)

        getMiPerfil(correo)
            .then((data) => {
                if (!cancelled) setDocente(data)
            })
            .catch((err) => {
                if (cancelled) return
                if (err.status === 404) setNotFound(true)
                else onShowToast?.('No se pudo cargar tu perfil. Intenta de nuevo', 'error')
            })
            .finally(() => {
                if (!cancelled) setLoading(false)
            })

        return () => {
            cancelled = true
        }
    }, [correo])

    if (loading) {
        return (
            <div className="loading-state-container">
                <div className="spinner"></div>
                <p>Cargando perfil...</p>
            </div>
        )
    }

    if (!correo || notFound || !docente) {
        return (
            <div className="view-container">
                <div className="empty-state-card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <UserCircle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                    <h3>No se encontró tu perfil de docente</h3>
                    <p style={{ color: '#888' }}>
                        Si crees que es un error, comunícate con el administrador para que registre tu perfil.
                    </p>
                </div>
            </div>
        )
    }

    const tieneEvaluacion = docente.evaluacion_valor !== null && docente.evaluacion_valor !== undefined
    const iniciales = `${docente.nombres?.[0] ?? ''}${docente.apellidos?.[0] ?? ''}`.toUpperCase()

    return (
        <div className="view-container">
            <div className="view-header">
                <div>
                    <h1 className="view-title flex-align-center" style={{ gap: '0.75rem' }}>
                        <UserCircle size={28} className="text-primary" />
                        Mi perfil
                    </h1>
                    <p className="view-subtitle">Información de tu perfil de docente (solo lectura)</p>
                </div>
            </div>

            <div
                style={{
                    background: '#ffffff',
                    border: '1px solid #e4e4e7',
                    borderRadius: '12px',
                    padding: '1.5rem',
                    display: 'flex',
                    gap: '1.5rem',
                    flexWrap: 'wrap',
                    alignItems: 'flex-start'
                }}
            >
                {/* Foto */}
                <div style={{ flexShrink: 0 }}>
                    {docente.foto_url && !fotoError ? (
                        <img
                            src={docente.foto_url}
                            alt={`Foto de ${docente.nombres} ${docente.apellidos}`}
                            onError={() => setFotoError(true)}
                            style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #d4d4d8' }}
                        />
                    ) : (
                        <div
                            style={{
                                width: '120px',
                                height: '120px',
                                borderRadius: '50%',
                                background: '#f4f4f5',
                                border: '2px solid #d4d4d8',
                                color: '#52525b',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '2.2rem',
                                fontWeight: 600
                            }}
                            aria-label="Sin foto"
                        >
                            {iniciales || <UserCircle size={48} />}
                        </div>
                    )}
                </div>

                {/* Datos */}
                <div style={{ flex: 1, minWidth: '280px', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
                        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#18181b' }}>
                            {docente.nombres} {docente.apellidos}
                        </h2>
                        <span
                            style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '0.25rem',
                                padding: '0.25rem 0.6rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: docente.estado ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: docente.estado ? '#10b981' : '#ef4444'
                            }}
                        >
                            {docente.estado ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                            {docente.estado ? 'Activo' : 'Inactivo'}
                        </span>
                    </div>

                    <Row icon={<IdCard size={15} />} label="Código">{docente.codigo}</Row>
                    <Row icon={<Mail size={15} />} label="Correo">{docente.correo_institucional}</Row>
                    <Row icon={<Briefcase size={15} />} label="Tipo de docente">
                        {TIPO_DOCENTE_LABEL[docente.tipo_docente] || docente.tipo_docente}
                    </Row>
                    <Row icon={<Award size={15} />} label="Categoría">
                        {CATEGORIA_LABEL[docente.categoria] || docente.categoria}
                    </Row>
                    <Row icon={<BookOpen size={15} />} label="Programa">
                        {docente.nombre_programa || docente.code_program}
                    </Row>
                    <Row icon={<Star size={15} />} label="Evaluación">
                        {tieneEvaluacion ? (
                            <>
                                {docente.evaluacion_valor}
                                {docente.evaluacion_periodo && (
                                    <span style={{ color: '#52525b' }}> (periodo {docente.evaluacion_periodo})</span>
                                )}
                            </>
                        ) : (
                            <span style={{ color: '#52525b' }}>Sin evaluación registrada</span>
                        )}
                    </Row>
                </div>
            </div>
        </div>
    )
}