import React, { Fragment, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  RefreshCw,
  ScrollText,
  Search,
  X,
} from 'lucide-react'
import { consultarBitacora } from '../../services/bitacoraService'
import { getPeriodos } from '../../services/periodosService'
import { formatearFechaHora } from '../../utils/formatoFechas'
import Dropdown from '../common/Dropdown'
import './BitacoraView.css'

const TAMANO_PAGINA = 20
const FILTROS_VACIOS = { usuario: '', entidad: '', periodoId: '', desde: '', hasta: '' }

// Etiquetas solo de presentación: el contrato del backend no cambia.
const ACCIONES = {
  CREAR: 'Creación',
  EDITAR: 'Edición',
  DESACTIVAR: 'Desactivación',
  REACTIVAR: 'Reactivación',
  ELIMINAR: 'Eliminación',
  INGRESO: 'Ingreso',
}

const ROLES = {
  ADMIN: 'Administrador',
  COORDINADOR: 'Coordinador',
  DOCENTE: 'Docente',
}

const MOTIVOS = {
  TOKEN_INVALIDO: 'credencial de Google inválida',
  DOMINIO_NO_INSTITUCIONAL: 'correo no institucional',
  CUENTA_NO_REGISTRADA: 'cuenta no registrada',
  SIN_PERFIL_ROL: 'sin perfil para el rol',
  PERFIL_DESACTIVADO: 'perfil desactivado',
  FUERA_DE_VENTANA: 'fuera de las fechas permitidas',
}

const ENTIDADES = {
  SESION: 'Sesión',
  CURSO: 'Curso',
  PERIODO: 'Periodo',
  PROGRAMA: 'Programa',
}

const textoEntidad = (entidad) => {
  if (!entidad) return ''
  if (ENTIDADES[entidad]) return ENTIDADES[entidad]
  const minus = entidad.toLowerCase().replaceAll('_', ' ')
  return minus.charAt(0).toUpperCase() + minus.slice(1)
}

const textoAccion = (registro) => {
  if (registro.accion !== 'INGRESO') return ACCIONES[registro.accion] || registro.accion
  if (registro.resultado === 'ACEPTADO') return 'Ingreso aceptado'
  const motivo = MOTIVOS[registro.motivo]
  return motivo ? `Ingreso rechazado: ${motivo}` : 'Ingreso rechazado'
}

const tieneValores = (registro) => registro.valorAnterior != null || registro.valorNuevo != null

const formatearJson = (valor) => (valor == null ? 'Sin valor' : JSON.stringify(valor, null, 2))

export default function BitacoraView() {
  const [filtros, setFiltros] = useState(FILTROS_VACIOS)
  const [aplicados, setAplicados] = useState(FILTROS_VACIOS)
  const [pagina, setPagina] = useState(0)
  const [resultado, setResultado] = useState(null)
  const [periodos, setPeriodos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandido, setExpandido] = useState(null)
  // Se incrementa para volver a consultar con los mismos filtros (Actualizar / Reintentar).
  const [intento, setIntento] = useState(0)

  useEffect(() => {
    let vigente = true
    consultarBitacora({ ...aplicados, pagina, tamano: TAMANO_PAGINA })
      .then((data) => {
        if (!vigente) return
        setResultado(data)
        setError(null)
        setExpandido(null)
      })
      .catch((err) => {
        if (!vigente) return
        // Los 400 traen el mensaje del backend (p. ej. rango de fechas invertido).
        setError(err?.status === 400 && err.message ? err.message : 'No se pudo cargar')
      })
      .finally(() => {
        if (vigente) setLoading(false)
      })
    // Descarta respuestas de consultas anteriores si los filtros cambian antes de que lleguen.
    return () => {
      vigente = false
    }
  }, [aplicados, pagina, intento])

  const cargar = () => {
    setLoading(true)
    setIntento((i) => i + 1)
  }

  useEffect(() => {
    getPeriodos()
      .then(setPeriodos)
      .catch(() => setPeriodos([]))
  }, [])

  const periodoOptions = useMemo(
    () => [
      { value: '', label: 'Todos los periodos' },
      ...periodos.map((p) => ({ value: String(p.id), label: p.nombre })),
    ],
    [periodos],
  )

  const nombrePeriodo = useMemo(() => {
    const mapa = new Map(periodos.map((p) => [String(p.id), p.nombre]))
    return (id) => (id == null ? '' : mapa.get(String(id)) || `#${id}`)
  }, [periodos])

  const hayFiltros = Object.values(aplicados).some(Boolean)
  const registros = resultado?.contenido ?? []
  const totalPaginas = resultado?.totalPaginas ?? 0

  const cambiarFiltro = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }))

  const buscar = (e) => {
    e.preventDefault()
    setPagina(0)
    setAplicados({ ...filtros })
    cargar()
  }

  const limpiar = () => {
    setFiltros(FILTROS_VACIOS)
    setPagina(0)
    setAplicados(FILTROS_VACIOS)
    cargar()
  }

  const irAPagina = (nueva) => {
    setLoading(true)
    setPagina(nueva)
  }

  return (
    <div className="bita-container">
      <div className="bita-header">
        <div>
          <h2 className="bita-title">
            <ScrollText size={26} /> Bitácora
          </h2>
          <p className="bita-subtitle">
            Auditoría de cambios e ingresos al sistema. Solo lectura: los registros no se pueden modificar ni borrar.
          </p>
        </div>
        <button type="button" className="btn-secondary bita-btn" onClick={cargar} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} /> Actualizar
        </button>
      </div>

      <form className="bita-filters" onSubmit={buscar}>
        <label className="bita-field">
          <span>Usuario</span>
          <input
            type="text"
            className="bita-input"
            value={filtros.usuario}
            onChange={cambiarFiltro('usuario')}
            placeholder="Correo o nombre"
          />
        </label>
        <label className="bita-field">
          <span>Entidad</span>
          <input
            type="text"
            className="bita-input"
            value={filtros.entidad}
            onChange={cambiarFiltro('entidad')}
            placeholder="Ej. CURSO, SESION"
          />
        </label>
        <div className="bita-field">
          <span>Periodo</span>
          <Dropdown
            className="bita-dropdown"
            value={filtros.periodoId}
            options={periodoOptions}
            onChange={(valor) => setFiltros((f) => ({ ...f, periodoId: valor ?? '' }))}
            ariaLabel="Filtrar por periodo académico"
          />
        </div>
        <label className="bita-field bita-field-sm">
          <span>Desde</span>
          <input type="date" className="bita-input" value={filtros.desde} onChange={cambiarFiltro('desde')} />
        </label>
        <label className="bita-field bita-field-sm">
          <span>Hasta</span>
          <input type="date" className="bita-input" value={filtros.hasta} onChange={cambiarFiltro('hasta')} />
        </label>
        <div className="bita-filter-actions">
          <button type="submit" className="btn-primary bita-btn" disabled={loading}>
            <Search size={15} /> Buscar
          </button>
          <button type="button" className="btn-secondary bita-btn" onClick={limpiar} disabled={loading}>
            <X size={15} /> Limpiar
          </button>
        </div>
      </form>

      {error && (
        <div className="bita-error" role="alert">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="btn-secondary btn-sm" onClick={cargar}>
            Reintentar
          </button>
        </div>
      )}

      <div className={`bita-table-wrap ${loading ? 'is-loading' : ''}`}>
        <table className="bita-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Periodo</th>
              <th className="bita-detail-col">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loading && !resultado ? (
              <tr>
                <td colSpan={7} className="bita-empty">
                  <RefreshCw size={18} className="spin" /> Cargando bitácora…
                </td>
              </tr>
            ) : registros.length === 0 ? (
              <tr>
                <td colSpan={7} className="bita-empty">
                  <ScrollText size={22} />
                  {error ? 'No se pudo cargar' : hayFiltros ? 'Sin resultados' : 'No hay registros en la bitácora'}
                </td>
              </tr>
            ) : (
              registros.map((r) => {
                const abierto = expandido === r.id
                const rechazado = r.resultado === 'RECHAZADO'
                return (
                  <Fragment key={r.id}>
                    <tr className={rechazado ? 'bita-row-rechazado' : ''}>
                      <td className="bita-nowrap">{formatearFechaHora(r.fecha, '')}</td>
                      <td>
                        <div className="bita-user">
                          <strong>{r.usuarioCorreo || 'Sin correo registrado'}</strong>
                          {r.operadorNombre && <span>Operó: {r.operadorNombre}</span>}
                        </div>
                      </td>
                      <td>{ROLES[r.usuarioRol] || r.usuarioRol || '—'}</td>
                      <td>
                        <span
                          className={`bita-badge ${
                            r.accion === 'INGRESO' ? (rechazado ? 'is-danger' : 'is-success') : 'is-info'
                          }`}
                        >
                          {textoAccion(r)}
                        </span>
                      </td>
                      <td>
                        <div className="bita-user">
                          <strong>{textoEntidad(r.entidad)}</strong>
                          {r.entidadId && <span className="bita-code">{r.entidadId}</span>}
                        </div>
                      </td>
                      <td>{nombrePeriodo(r.periodoId) || '—'}</td>
                      <td className="bita-detail-col">
                        {tieneValores(r) ? (
                          <button
                            type="button"
                            className="btn-secondary btn-sm bita-btn"
                            onClick={() => setExpandido(abierto ? null : r.id)}
                            aria-expanded={abierto}
                          >
                            {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                            {abierto ? 'Ocultar' : 'Ver cambios'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                    {abierto && (
                      <tr className="bita-values-row">
                        <td colSpan={7}>
                          <div className="bita-values">
                            <div>
                              <span className="bita-values-label">Valor anterior</span>
                              <pre>{formatearJson(r.valorAnterior)}</pre>
                            </div>
                            <div>
                              <span className="bita-values-label">Valor nuevo</span>
                              <pre>{formatearJson(r.valorNuevo)}</pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {resultado && resultado.totalElementos > 0 && (
        <div className="bita-pagination">
          <span>
            {resultado.totalElementos} {resultado.totalElementos === 1 ? 'registro' : 'registros'} · Página{' '}
            {pagina + 1} de {Math.max(totalPaginas, 1)}
          </span>
          <div className="bita-pagination-actions">
            <button
              type="button"
              className="btn-secondary btn-sm bita-btn"
              onClick={() => irAPagina(pagina - 1)}
              disabled={loading || pagina === 0}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm bita-btn"
              onClick={() => irAPagina(pagina + 1)}
              disabled={loading || pagina + 1 >= totalPaginas}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
