import React from 'react'
import { AlertTriangle } from 'lucide-react'

export default function EliminarPeriodoModal({ periodo, enviando = false, onAceptar, onCancelar }) {
  if (!periodo) return null

  return (
    <div className="modal-backdrop">
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="eliminar-periodo-titulo">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <AlertTriangle className="text-danger" size={24} />
            <h2 id="eliminar-periodo-titulo">Eliminar período</h2>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onCancelar}
            disabled={enviando}
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="modal-body">
          <p>
            ¿Está seguro que desea eliminar el período <strong>{periodo.nombre}</strong>?
          </p>
          <div className="alert-warning-box">
            <p>
              El sistema quedará sin período vigente y los plazos de docentes y coordinadores se cerrarán
            </p>
          </div>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onCancelar}
            disabled={enviando}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onAceptar}
            disabled={enviando}
          >
            Aceptar
          </button>
        </div>
      </div>
    </div>
  )
}