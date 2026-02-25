import { useState } from 'react'
import { useAuth } from '../hooks/useAuth.js'

export default function AuthPanel() {
  const { user, loading, signIn, signUp, signOut } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  if (loading) {
    return <div className="auth-panel"><p className="auth-loading">Cargando...</p></div>
  }

  if (user) {
    return (
      <div className="auth-panel">
        <p className="auth-user-email">Logueado como: <strong>{user.email}</strong></p>
        <button
          className="auth-btn auth-btn-logout"
          onClick={async () => {
            try { await signOut() } catch (e) { setError(e.message) }
          }}
        >
          Logout
        </button>
        {error && <p className="auth-error">{error}</p>}
      </div>
    )
  }

  async function handleLogin() {
    setError(null)
    setBusy(true)
    try {
      await signIn(email, password)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRegister() {
    setError(null)
    setBusy(true)
    try {
      await signUp(email, password)
      setError('Revisa tu email para confirmar el registro.')
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-panel">
      <h2 className="auth-title">Accede a tu cuenta</h2>
      <div className="auth-form">
        <input
          className="auth-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={busy}
        />
        <input
          className="auth-input"
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={busy}
        />
        {error && <p className="auth-error">{error}</p>}
        <div className="auth-actions">
          <button
            className="auth-btn auth-btn-login"
            onClick={handleLogin}
            disabled={busy}
          >
            Login
          </button>
          <button
            className="auth-btn auth-btn-register"
            onClick={handleRegister}
            disabled={busy}
          >
            Register
          </button>
        </div>
      </div>
      <p className="auth-hint">La app funciona sin cuenta. Auth es opcional.</p>
    </div>
  )
}
