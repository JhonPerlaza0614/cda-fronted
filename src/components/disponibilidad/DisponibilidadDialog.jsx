import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react'

// Cuadros de diálogo del registro de disponibilidad (HU-007 y HU-051).
// Prueba de usabilidad (2026-11-10): confirmación al guardar, éxito y aviso de mínimo 1 hora.
const ICONOS = {
  confirm: { Icono: HelpCircle, color: '#3b58d2' },
  success: { Icono: CheckCircle2, color: '#16a34a' },
  warning: { Icono: AlertCircle, color: '#d97706' },
}

export default function DisponibilidadDialog({ dialog, enviando = false, onAceptar, onCancelar }) {
  if (!dialog) return null

  const esConfirmacion = dialog.type === 'confirm'
  const { Icono, color } = ICONOS[dialog.type] || ICONOS.warning
  const tituloId = 'disponibilidad-dialogo-titulo'
  const mensajeId = 'disponibilidad-dialogo-mensaje'

  return (
    <div className="modal-backdrop">
      <div
        className="modal-card availability-dialog"
        role={esConfirmacion ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={mensajeId}
      >
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <Icono size={24} color={color} aria-hidden="true" />
            <h2 id={tituloId}>{dialog.title}</h2>
          </div>
        </div>
        <div className="modal-body">
          <p id={mensajeId}>{dialog.message}</p>
        </div>
        <div className="modal-footer">
          {esConfirmacion && (
            <button type="button" className="btn-secondary" onClick={onCancelar} disabled={enviando}>
              Cancelar
            </button>
          )}
          <button type="button" className="btn-primary" onClick={onAceptar} disabled={enviando} autoFocus>
            {enviando ? 'Guardando…' : 'Aceptar'}
          </button>
        </div>
      </div>
    </div>
  )
}
