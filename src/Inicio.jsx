import React, { Component, useCallback, useEffect, useRef, useState } from 'react'
import Login from './LoginView.jsx'
import App from './App.jsx'
import { getCurrentSession, loginWithGoogle, logout, notifySessionExpired } from './services/authService.js'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó un error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#111827',
          color: '#f9fafb',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            maxWidth: '520px',
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '16px',
            padding: '32px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '1.4rem', color: '#f87171', marginBottom: '12px' }}>
              Ocurrió un error inesperado
            </h2>
            <p style={{ color: '#9ca3af', fontSize: '0.95rem', lineHeight: '1.5', marginBottom: '20px' }}>
              {this.state.error?.message || 'Hubo un inconveniente al renderizar la aplicación.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  background: '#c8102e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Recargar Aplicación
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default function AppInicial() {
  const [session, setSession] = useState(() => getCurrentSession())
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState(null)
  const loginInProgress = useRef(false)

  const handleGoogleCredential = useCallback(async (credential) => {
    if (loginInProgress.current) return
    loginInProgress.current = true

    setLoginLoading(true)
    setLoginError(null)

    try {
      const authenticatedSession = await loginWithGoogle(credential)
      setSession(authenticatedSession)
    } catch (error) {
      setLoginError(error.message || 'No fue posible iniciar sesión. Inténtalo de nuevo.')
    } finally {
      loginInProgress.current = false
      setLoginLoading(false)
    }
  }, [])

  // Cierre manual de sesión por el usuario
  const handleLogout = useCallback(() => {
    logout()
    setSession(null)
    setLoginError(null)
  }, [])

  // Cierre automático cuando la sesión expira
  const handleSessionExpired = useCallback((message) => {
    logout()
    setSession(null)
    setLoginError(message || 'Tu sesión ha expirado. Por favor, inicia sesión de nuevo.')
  }, [])

  // 1. Escuchar eventos globales de desautorización o expiración de sesión (401 o llamadas a notifySessionExpired)
  useEffect(() => {
    const handleUnauthorizedEvent = (e) => {
      const msg = e?.detail?.message || 'Tu sesión ha expirado o ya no es válida. Inicia sesión de nuevo.'
      handleSessionExpired(msg)
    }

    window.addEventListener('auth:unauthorized', handleUnauthorizedEvent)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorizedEvent)
  }, [handleSessionExpired])

  // 2. Monitoreo activo y temporizador para la expiración de la sesión
  useEffect(() => {
    if (!session) return

    const verifySession = () => {
      const activeSession = getCurrentSession()
      if (!activeSession) {
        handleSessionExpired('Tu sesión ha expirado. Por favor, inicia sesión de nuevo.')
        return false
      }
      return true
    }

    // Comprobación inicial inmediata
    if (!verifySession()) return

    // Temporizador exacto programado para el instante de expiración
    const timeRemaining = (session.expiresAt || 0) - Date.now()
    let timer = null
    if (timeRemaining > 0) {
      timer = setTimeout(() => {
        verifySession()
      }, timeRemaining)
    }

    // Intervalo de respaldo periódico cada 5 segundos (cubre suspensión, hibernación o cambios de reloj)
    const interval = setInterval(() => {
      verifySession()
    }, 5000)

    // Al regresar a la pestaña o ventana del navegador
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        verifySession()
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityOrFocus)
    window.addEventListener('focus', handleVisibilityOrFocus)

    return () => {
      if (timer) clearTimeout(timer)
      clearInterval(interval)
      window.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.removeEventListener('focus', handleVisibilityOrFocus)
    }
  }, [session, handleSessionExpired])

  if (!session) {
    return (
      <Login
        onContinue={handleGoogleCredential}
        loading={loginLoading}
        error={loginError}
      />
    )
  }

  return (
    <ErrorBoundary>
      <App user={session.user} onLogout={handleLogout} />
    </ErrorBoundary>
  )
}
