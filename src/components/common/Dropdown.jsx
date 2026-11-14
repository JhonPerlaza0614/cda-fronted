import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import './Dropdown.css'

const mismoValor = (a, b) => String(a) === String(b)

const normalizarTexto = (valor) =>
  String(valor || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export default function Dropdown({
  value,
  values = [],
  options = [],
  onChange,
  placeholder = 'Selecciona una opción',
  multiple = false,
  disabled = false,
  ariaLabel,
  emptyMessage = 'Sin opciones disponibles',
  searchable = false,
  searchPlaceholder = 'Digita el código o nombre...',
  className = '',
}) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState(null)
  const [query, setQuery] = useState('')
  const triggerRef = useRef(null)
  const panelRef = useRef(null)

  const seleccionados = useMemo(() => {
    if (!multiple) {
      return options.filter((option) => mismoValor(option.value, value))
    }
    return options.filter((option) =>
      values.some((seleccionado) => mismoValor(seleccionado, option.value)),
    )
  }, [multiple, options, value, values])

  const opcionesFiltradas = useMemo(() => {
    const texto = normalizarTexto(query)
    if (!texto) return options
    return options.filter((option) =>
      normalizarTexto(`${option.label} ${option.description || ''} ${option.searchText || ''}`).includes(texto),
    )
  }, [options, query])

  const label = useMemo(() => {
    if (multiple) {
      if (seleccionados.length === 0) return placeholder
      if (seleccionados.length === 1) return seleccionados[0].label
      return `${seleccionados.length} asignaturas seleccionadas`
    }
    return seleccionados[0]?.label || placeholder
  }, [multiple, placeholder, seleccionados])

  const abrir = () => {
    if (disabled) return
    const trigger = triggerRef.current
    if (!trigger) return
    const bounds = trigger.getBoundingClientRect()
    const width = Math.max(bounds.width, 240)
    const spaceBelow = window.innerHeight - bounds.bottom
    const abrirArriba = spaceBelow < 280 && bounds.top > spaceBelow
    setQuery('')
    setRect({
      width,
      left: Math.max(8, Math.min(bounds.left, window.innerWidth - width - 8)),
      ...(abrirArriba
        ? { bottom: window.innerHeight - bounds.top + 6 }
        : { top: bounds.bottom + 6 }),
    })
    setOpen(true)
  }

  const alternar = () => {
    if (open) {
      setOpen(false)
      return
    }
    abrir()
  }

  useEffect(() => {
    if (!open) return undefined

    const cerrarSiEsAfuera = (event) => {
      if (triggerRef.current?.contains(event.target)) return
      if (panelRef.current?.contains(event.target)) return
      setOpen(false)
    }
    const cerrarConEscape = (event) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const cerrarAlDesplazar = (event) => {
      if (panelRef.current?.contains(event.target)) return
      setOpen(false)
    }

    document.addEventListener('mousedown', cerrarSiEsAfuera)
    document.addEventListener('keydown', cerrarConEscape)
    window.addEventListener('resize', cerrarAlDesplazar)
    window.addEventListener('scroll', cerrarAlDesplazar, true)
    return () => {
      document.removeEventListener('mousedown', cerrarSiEsAfuera)
      document.removeEventListener('keydown', cerrarConEscape)
      window.removeEventListener('resize', cerrarAlDesplazar)
      window.removeEventListener('scroll', cerrarAlDesplazar, true)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  const seleccionar = (option) => {
    if (option.disabled) return
    if (multiple) {
      const yaSeleccionado = values.some((seleccionado) => mismoValor(seleccionado, option.value))
      const siguientes = yaSeleccionado
        ? values.filter((seleccionado) => !mismoValor(seleccionado, option.value))
        : [...values, option.value]
      onChange?.(siguientes)
      return
    }
    onChange?.(option.value)
    setQuery('')
    setOpen(false)
  }

  return (
    <div className={`ui-dropdown ${className}`.trim()}>
      <button
        type="button"
        ref={triggerRef}
        className={`ui-dropdown-trigger ${open ? 'is-open' : ''}`}
        onClick={alternar}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <span className={`ui-dropdown-value ${seleccionados.length === 0 ? 'is-placeholder' : ''}`}>
          {label}
        </span>
        <ChevronDown size={16} className={`ui-dropdown-chevron ${open ? 'is-open' : ''}`} />
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            className="ui-dropdown-panel"
            style={{
              width: rect.width,
              left: rect.left,
              ...(rect.top !== undefined ? { top: rect.top } : { bottom: rect.bottom }),
            }}
            role="listbox"
            aria-multiselectable={multiple}
          >
            {searchable && (
              <div className="ui-dropdown-search">
                <Search size={14} />
                <input
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                  aria-label={searchPlaceholder}
                />
              </div>
            )}
            {opcionesFiltradas.length === 0 ? (
              <div className="ui-dropdown-empty">
                {options.length === 0 ? emptyMessage : 'No se encontraron coincidencias'}
              </div>
            ) : (
              opcionesFiltradas.map((option) => {
                const activo = multiple
                  ? values.some((seleccionado) => mismoValor(seleccionado, option.value))
                  : mismoValor(value, option.value)
                return (
                  <button
                    type="button"
                    key={option.value}
                    role="option"
                    aria-selected={activo}
                    className={`ui-dropdown-option ${activo ? 'is-selected' : ''}`}
                    onClick={() => seleccionar(option)}
                    disabled={option.disabled}
                  >
                    <span className="ui-dropdown-option-text">
                      <span className="ui-dropdown-option-label">{option.label}</span>
                      {option.description && (
                        <span className="ui-dropdown-option-description">{option.description}</span>
                      )}
                    </span>
                    {activo && <Check size={15} />}
                  </button>
                )
              })
            )}
            {multiple && opcionesFiltradas.length > 0 && (
              <div className="ui-dropdown-footer">
                <button type="button" className="btn-primary btn-sm" onClick={() => setOpen(false)}>
                  Listo
                </button>
              </div>
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}
