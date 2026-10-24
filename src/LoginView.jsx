import { useEffect, useRef, useState } from 'react'
import './Login.css'

const GOOGLE_SCRIPT_ID = 'google-identity-services-script'

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google)
  }

  return new Promise((resolve, reject) => {
    let script = document.getElementById(GOOGLE_SCRIPT_ID)

    const handleLoad = () => {
      if (window.google?.accounts?.id) {
        resolve(window.google)
      } else {
        reject(new Error('Google cargó, pero no se pudo inicializar el servicio de identidad.'))
      }
    }

    const handleError = () => reject(new Error('No se pudo cargar el servicio de inicio de sesión de Google. Revisa tu conexión.'))

    if (script) {
      script.addEventListener('load', handleLoad, { once: true })
      script.addEventListener('error', handleError, { once: true })
      if (window.google?.accounts?.id) handleLoad()
      return
    }

    script = document.createElement('script')
    script.id = GOOGLE_SCRIPT_ID
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.addEventListener('load', handleLoad, { once: true })
    script.addEventListener('error', handleError, { once: true })
    document.head.appendChild(script)
  })
}

export default function LoginView({ onContinue, loading = false, error = null }) {
  const googleButtonRef = useRef(null)
  const [configurationError, setConfigurationError] = useState(null)
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim()

  useEffect(() => {
    let isActive = true

    if (!clientId) {
      setConfigurationError('Falta configurar VITE_GOOGLE_CLIENT_ID en el archivo .env del frontend.')
      return () => { isActive = false }
    }

    setConfigurationError(null)

    loadGoogleIdentityServices()
      .then((google) => {
        if (!isActive || !googleButtonRef.current) return

        const buttonWidth = Math.max(200, Math.floor(googleButtonRef.current.getBoundingClientRect().width))

        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!isActive) return
            if (!response?.credential) {
              setConfigurationError('Google no devolvió una credencial. Inténtalo de nuevo.')
              return
            }
            onContinue(response.credential)
          },
          auto_select: false,
        })

        googleButtonRef.current.replaceChildren()
        google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          text: 'continue_with',
          shape: 'rectangular',
          logo_alignment: 'left',
          width: buttonWidth,
          locale: 'es',
        })
      })
      .catch((loadError) => {
        if (isActive) setConfigurationError(loadError.message || 'No fue posible inicializar Google.')
      })

    return () => {
      isActive = false
      if (googleButtonRef.current) googleButtonRef.current.replaceChildren()
    }
  }, [clientId, onContinue])

  const visibleError = error || configurationError

  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <div className="login-heading">
          <div className="login-symbol" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M12 3.5v17M3.5 12h17" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </div>
          <p className="login-eyebrow">PORTAL DE ACCESO</p>
          <h1 id="login-title">Bienvenido</h1>
          <p className="login-subtitle">
            Inicia sesión con tu cuenta institucional de Google para continuar.
          </p>
        </div>

        <div className={`login-google-button-host${loading ? ' is-loading' : ''}`}>
          <div ref={googleButtonRef} className="login-google-button-mount" aria-label="Continuar con Google" />
          {loading && (
            <div className="login-loading-overlay" role="status" aria-live="polite">
              <span className="login-spinner" />
              <span>Validando tu cuenta...</span>
            </div>
          )}
        </div>

        {visibleError && (
          <p className="login-error" role="alert">
            {visibleError}
          </p>
        )}

        <div className="login-security-note">
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.6" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>Acceso seguro exclusivo para cuentas institucionales autorizadas.</span>
        </div>
      </section>

      <footer className="login-footer">
        <span>¿Tienes problemas para ingresar?</span>
        <span>Contacta al administrador del sistema.</span>
      </footer>
    </main>
  )
}
