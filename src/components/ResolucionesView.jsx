import React, { useState, useEffect, useMemo } from 'react'
import { FileText, AlertCircle, RefreshCw, Plus, Edit2, Trash2, ExternalLink } from 'lucide-react'
import { getPeriodos, getPeriodo } from '../services/resolucionesService'
import { estadoPlazo } from '../utils/estadoPlazo'
import { formatearFecha, formatearFechaHora } from '../utils/formatoFechas'

// Mapeo único de estado del backend -> etiqueta visible (criterio 1).
const ETIQUETA_ESTADO = {
  VIGENTE: 'Vigente',
  HISTORICO: 'Historial',
  DESACTIVADO: 'Desactivado',
}

const etiquetaEstado = (estado) => ETIQUETA_ESTADO[estado] || estado || '—'

// Más reciente primero. Las fechas "YYYY-MM-DD" se ordenan bien como texto.
const porInicioDesc = (a, b) =>
  String(b.inicioSemestre || '').localeCompare(String(a.inicioSemestre || ''))

// Solo se muestra como enlace si es http/https.
function esUrlHttp(valor) {
  try {
    const u = new URL(valor)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

/* ---------- Subcomponentes ---------- */

function EstadoBadge({ estado }) {
  return (
    <span className={`res-badge res-badge-${String(estado).toLowerCase()}`}>
      {etiquetaEstado(estado)}
    </span>
  )
}

function ErrorCarga({ mensaje, onReintentar }) {
  return (
    <div className="res-error" role="alert">
      <AlertCircle size={20} className="text-danger" />
      <div className="res-error-text">
        <strong>No se pudo cargar</strong>
        {mensaje && <small>{mensaje}</small>}
      </div>
      <button type="button" className="btn-primary btn-sm" onClick={onReintentar}>
        <RefreshCw size={14} /> Reintentar
      </button>
    </div>
  )
}

function Cargando({ texto }) {
  return (
    <div className="loading-state-container">
      <div className="spinner"></div>
      <p>{texto}</p>
    </div>
  )
}

function PeriodoItem({ periodo, seleccionado, onSelect, destacado = false }) {
  return (
    <button
      type="button"
      className={`res-item ${destacado ? 'res-item-destacado' : ''} ${seleccionado ? 'res-item-activo' : ''}`}
      onClick={() => onSelect(periodo.id)}
      aria-pressed={seleccionado}
    >
      <span className="res-item-nombre">{periodo.nombre}</span>
      <EstadoBadge estado={periodo.estado} />
    </button>
  )
}

function PeriodoVigente({ vigente, seleccionadoId, onSelect }) {
  return (
    <section className="res-bloque">
      <h2 className="res-subtitulo">Período vigente</h2>
      {vigente ? (
        <PeriodoItem
          periodo={vigente}
          destacado
          seleccionado={seleccionadoId === vigente.id}
          onSelect={onSelect}
        />
      ) : (
        <div className="res-sin-vigente">No hay período vigente</div>
      )}
    </section>
  )
}

function ListaHistorial({ items, seleccionadoId, onSelect }) {
  return (
    <section className="res-bloque">
      <h2 className="res-subtitulo">Historial</h2>
      {items.length === 0 ? (
        <p className="res-vacio-texto">Aún no hay períodos en el historial.</p>
      ) : (
        <ul className="res-lista">
          {items.map((p) => (
            <li key={p.id}>
              <PeriodoItem
                periodo={p}
                seleccionado={seleccionadoId === p.id}
                onSelect={onSelect}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Campo({ etiqueta, children }) {
  return (
    <div className="res-campo">
      <span className="res-campo-etiqueta">{etiqueta}</span>
      <span className="res-campo-valor">{children}</span>
    </div>
  )
}

// DEPENDE-HU:plazos
// Único lugar que conoce la estructura de los plazos (docentes / coordinadores).
// Si la otra HU cambia el contrato, solo se toca este subcomponente.
function PlazosDetalle({ plazos, estadoPeriodo }) {
  const filas = [
    { clave: 'docentes', etiqueta: 'Docentes' },
    { clave: 'coordinadores', etiqueta: 'Coordinadores' },
  ]
  return (
    <div className="res-plazos">
      <h3 className="res-subtitulo">Plazos</h3>
      {filas.map(({ clave, etiqueta }) => {
        const plazo = plazos?.[clave]
        const estado = estadoPlazo(plazo, estadoPeriodo)
        return (
          <div key={clave} className="res-plazo-fila">
            <strong>{etiqueta}</strong>
            <span>Inicio: {formatearFechaHora(plazo?.inicio)}</span>
            <span>Fin: {formatearFechaHora(plazo?.fin)}</span>
            <span className={`res-badge res-plazo-${estado.toLowerCase()}`}>{estado}</span>
          </div>
        )
      })}
    </div>
  )
}

function PanelDetalle({ estado, detalle, error, onReintentar }) {
  const handleEditar = () => {
    // TODO DEPENDE-HU:editar
  }
  const handleEliminar = () => {
    // TODO DEPENDE-HU:desactivar
  }

  if (estado === 'cargando') return <Cargando texto="Cargando detalle del período..." />
  if (estado === 'error') return <ErrorCarga mensaje={error} onReintentar={onReintentar} />
  if (!detalle) return null

  const enlace = detalle.enlaceResolucion

  return (
    <div className="res-detalle">
      <div className="res-detalle-header">
        <div>
          <h2 className="res-detalle-titulo">{detalle.nombre}</h2>
          <EstadoBadge estado={detalle.estado} />
        </div>
        {/* Solo el vigente se puede editar o eliminar (criterio 3) */}
        {detalle.estado === 'VIGENTE' && (
          <div className="res-acciones">
            <button type="button" className="btn-secondary btn-sm" onClick={handleEditar}>
              <Edit2 size={14} /> Editar
            </button>
            <button type="button" className="btn-danger btn-sm" onClick={handleEliminar}>
              <Trash2 size={14} /> Eliminar
            </button>
          </div>
        )}
      </div>

      <div className="res-campos">
        <Campo etiqueta="Número de resolución">{detalle.numeroResolucion || '—'}</Campo>
        <Campo etiqueta="Enlace">
          {enlace && esUrlHttp(enlace) ? (
            <a href={enlace} target="_blank" rel="noopener noreferrer">
              Ver resolución <ExternalLink size={13} />
            </a>
          ) : (
            enlace || '—'
          )}
        </Campo>
        <Campo etiqueta="Inicio del semestre">{formatearFecha(detalle.inicioSemestre)}</Campo>
        <Campo etiqueta="Fin del semestre">{formatearFecha(detalle.finSemestre)}</Campo>
        <Campo etiqueta="Fecha de adición">{formatearFecha(detalle.fechaAdicion)}</Campo>
        <Campo etiqueta="Fecha de cancelación">{formatearFecha(detalle.fechaCancelacion)}</Campo>
      </div>

      <PlazosDetalle plazos={detalle.plazos} estadoPeriodo={detalle.estado} />
    </div>
  )
}

/* ---------- Contenido principal ---------- */

function ResolucionesContenido() {
  // Lista
  const [periodos, setPeriodos] = useState([])
  const [estadoLista, setEstadoLista] = useState('cargando') // cargando | ok | error
  const [errorLista, setErrorLista] = useState('')
  const [intentoLista, setIntentoLista] = useState(0)

  // Detalle
  const [seleccionadoId, setSeleccionadoId] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [estadoDetalle, setEstadoDetalle] = useState('cargando')
  const [errorDetalle, setErrorDetalle] = useState('')
  const [intentoDetalle, setIntentoDetalle] = useState(0)

  useEffect(() => {
    let activo = true
    setEstadoLista('cargando')
    getPeriodos()
      .then((data) => {
        if (!activo) return
        setPeriodos(data)
        setEstadoLista('ok')
      })
      .catch((err) => {
        if (!activo) return
        setErrorLista(err.message || '')
        setEstadoLista('error')
      })
    return () => {
      activo = false
    }
  }, [intentoLista])

  useEffect(() => {
    if (seleccionadoId === null) return
    let activo = true
    setEstadoDetalle('cargando')
    setDetalle(null)
    getPeriodo(seleccionadoId)
      .then((data) => {
        if (!activo) return
        setDetalle(data)
        setEstadoDetalle('ok')
      })
      .catch((err) => {
        if (!activo) return
        setErrorDetalle(err.message || '')
        setEstadoDetalle('error')
      })
    return () => {
      activo = false
    }
  }, [seleccionadoId, intentoDetalle])

  // Ordena en cliente y separa el vigente del resto.
  const { vigente, historial } = useMemo(() => {
    const ordenados = [...periodos].sort(porInicioDesc)
    const v = ordenados.find((p) => p.estado === 'VIGENTE') || null
    return { vigente: v, historial: ordenados.filter((p) => p !== v) }
  }, [periodos])

  const handleCrearPeriodo = () => {
    // TODO DEPENDE-HU:crear-periodo
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <div>
          <h1 className="section-title">Resoluciones</h1>
          <p className="section-description">
            Consulta el período académico vigente y el historial de resoluciones.
          </p>
        </div>
      </div>

      {estadoLista === 'cargando' && <Cargando texto="Cargando períodos académicos..." />}

      {estadoLista === 'error' && (
        <ErrorCarga mensaje={errorLista} onReintentar={() => setIntentoLista((n) => n + 1)} />
      )}

      {estadoLista === 'ok' && periodos.length === 0 && (
        <div className="empty-state-card">
          <FileText size={48} className="empty-icon" />
          <h3>No hay períodos académicos registrados</h3>
          <button type="button" className="btn-primary" onClick={handleCrearPeriodo}>
            <Plus size={16} /> Crear período
          </button>
        </div>
      )}

      {estadoLista === 'ok' && periodos.length > 0 && (
        <div className="res-layout">
          <div className="res-columna-lista">
            <PeriodoVigente
              vigente={vigente}
              seleccionadoId={seleccionadoId}
              onSelect={setSeleccionadoId}
            />
            <ListaHistorial
              items={historial}
              seleccionadoId={seleccionadoId}
              onSelect={setSeleccionadoId}
            />
          </div>

          <div className="res-columna-detalle">
            {seleccionadoId === null ? (
              <p className="res-vacio-texto">Selecciona un período para ver su detalle.</p>
            ) : (
              <PanelDetalle
                estado={estadoDetalle}
                detalle={detalle}
                error={errorDetalle}
                onReintentar={() => setIntentoDetalle((n) => n + 1)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Pantalla "Resoluciones" (solo lectura, HU-A).
 * TODO: conectar `esAdmin` al sistema de roles cuando exista (login y roles
 * están en desarrollo por otro equipo). Por ahora el default es true.
 */
export default function ResolucionesView({ esAdmin = true }) {
  if (!esAdmin) {
    return (
      <div className="section-container">
        <div className="empty-state-card">
          <h3>Acceso restringido</h3>
          <p>Esta sección es solo para administradores.</p>
        </div>
      </div>
    )
  }
  return <ResolucionesContenido />
}