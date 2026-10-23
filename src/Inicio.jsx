import { useCallback, useEffect, useRef, useState } from 'react'
import Login from './LoginView.jsx'
import App from './App.jsx'
import { getCurrentSession, loginWithGoogle, logout } from './services/authService.js'

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

  const handleLogout = useCallback(() => {
    logout()
    setSession(null)
    setLoginError(null)
  }, [])

  useEffect(() => {
    const handleUnauthorized = () => {
      logout()
      setSession(null)
      setLoginError('Tu sesión expiró o dejó de ser válida. Inicia sesión otra vez.')
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized)
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized)
  }, [])

  if (!session) {
    return (
      <Login
        onContinue={handleGoogleCredential}
        loading={loginLoading}
        error={loginError}
      />
    )
  }

  return <App user={session.user} onLogout={handleLogout} />
}
