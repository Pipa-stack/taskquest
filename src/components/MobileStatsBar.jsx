import { Loader2 } from 'lucide-react'
import { XP_PER_LEVEL } from '../domain/gamification.js'

/**
 * Compact info bar shown directly below the topbar on mobile (≤768px).
 * Displays level + XP progress, coin balance, and energy + bar.
 * Pure display component — no actions or CTAs.
 */
export default function MobileStatsBar({ level, xpToNext, coins, energy, energyCap, isSyncing }) {
  const xpIntoLevel = XP_PER_LEVEL - (xpToNext ?? XP_PER_LEVEL)
  const xpPct = Math.round((xpIntoLevel / XP_PER_LEVEL) * 100)
  const cap = energyCap ?? 100
  const energyPct = cap > 0 ? Math.round(((energy ?? 0) / cap) * 100) : 0

  return (
    <div
      className="mstat-bar"
      aria-label="Estadísticas del jugador"
      role="status"
      aria-live="polite"
    >
      {/* Level + XP progress bar */}
      <div className="mstat-group">
        <span className="mstat-label">
          Nv. <strong className="mstat-value">{level ?? 1}</strong>
        </span>
        <div
          className="mstat-track mstat-track--xp"
          role="progressbar"
          aria-valuenow={xpPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`XP: ${xpIntoLevel} de ${XP_PER_LEVEL}`}
        >
          <div className="mstat-fill mstat-fill--xp" style={{ width: `${xpPct}%` }} />
        </div>
      </div>

      <span className="mstat-sep" aria-hidden="true" />

      {/* Coins */}
      <div className="mstat-group mstat-group--row" aria-label={`${coins ?? 0} monedas`}>
        <span aria-hidden="true">🪙</span>
        <span className="mstat-value mstat-value--gold">
          {(coins ?? 0).toLocaleString('es-ES')}
        </span>
      </div>

      <span className="mstat-sep" aria-hidden="true" />

      {/* Energy + bar */}
      <div className="mstat-group">
        <span className="mstat-label">
          ⚡ <span className="mstat-energy-nums">{Math.floor(energy ?? 0)}/{cap}</span>
        </span>
        <div
          className="mstat-track mstat-track--energy"
          role="progressbar"
          aria-valuenow={energyPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Energía: ${Math.floor(energy ?? 0)} de ${cap}`}
        >
          <div className="mstat-fill mstat-fill--energy" style={{ width: `${energyPct}%` }} />
        </div>
      </div>

      {/* Sync indicator — pushed to the trailing edge */}
      {isSyncing && (
        <Loader2
          className="spin mstat-sync"
          size={12}
          aria-label="Sincronizando"
        />
      )}
    </div>
  )
}
