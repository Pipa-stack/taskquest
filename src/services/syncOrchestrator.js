/**
 * syncOrchestrator.js
 *
 * Centralises the sync loop: push outbox → pull remote, with:
 *   - error classification (auth, network, validation)
 *   - backoff: 15s → 30s → 60s (cap) on repeated errors
 *   - authRequired flag: stops loop on 401/403 until re-login
 *   - persists sync meta to player record (lastSyncAt/OkAt/ErrorAt/ErrorMessage)
 *   - getSyncSnapshot(db) for UI state
 *   - merge note detection (remote overwrote local player)
 */

import { pushOutbox, pullRemote } from './taskSyncService.js'
import { pushPlayerOutbox, pullPlayerRemote } from './playerSyncService.js'
import db from '../db/db.js'

// ─── Backoff configuration ────────────────────────────────────────────────────
export const BACKOFF_STEPS_MS = [15_000, 30_000, 60_000]

/** Module-level sync state (reset on page load, acceptable for SPA) */
const state = {
  consecutiveErrors: 0,
  /** True when a 401/403 was received — loop pauses until resetAuthRequired() */
  authRequired: false,
  /** Pending merge note (set when remote overwrote local player, cleared after read) */
  pendingMergeNote: null,
}

/**
 * Returns the next interval in ms based on consecutive error count.
 * 0 errors → 15s, 1 error → 15s, 2 errors → 30s, 3+ errors → 60s
 *
 * Exported as a pure function so tests can verify backoff progression.
 *
 * @param {number} consecutiveErrors
 * @returns {number} milliseconds
 */
export function getBackoffInterval(consecutiveErrors) {
  if (consecutiveErrors <= 1) return BACKOFF_STEPS_MS[0]
  if (consecutiveErrors === 2) return BACKOFF_STEPS_MS[1]
  return BACKOFF_STEPS_MS[2]
}

/**
 * Returns a shallow copy of the current backoff/auth state for testing.
 * @returns {{ consecutiveErrors: number, authRequired: boolean }}
 */
export function getSyncState() {
  return { consecutiveErrors: state.consecutiveErrors, authRequired: state.authRequired }
}

/**
 * Resets the authRequired flag (call after successful re-login).
 */
export function resetAuthRequired() {
  state.authRequired = false
  state.consecutiveErrors = 0
}

/**
 * Resets all module-level state to initial values.
 * Intended for use in tests only.
 */
export function _resetStateForTests() {
  state.consecutiveErrors = 0
  state.authRequired = false
  state.pendingMergeNote = null
}

/**
 * Returns and clears the pending merge note (call after showing toast).
 * Returns null if no merge happened since last call.
 * @returns {string|null}
 */
export function getAndClearMergeNote() {
  const note = state.pendingMergeNote
  state.pendingMergeNote = null
  return note
}

// ─── Error classification ─────────────────────────────────────────────────────

/**
 * Returns 'auth' | 'network' | 'validation' | 'unknown' for a given error.
 *
 * @param {unknown} err
 * @returns {'auth'|'network'|'validation'|'unknown'}
 */
export function classifyError(err) {
  if (!err) return 'unknown'
  const status = err.status ?? err.statusCode ?? err.code ?? 0
  if (status === 401 || status === 403) return 'auth'
  // Supabase uses message strings too
  const msg = String(err.message ?? err.error ?? '').toLowerCase()
  if (msg.includes('jwt') || msg.includes('unauthorized') || msg.includes('forbidden')) return 'auth'
  if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) return 'network'
  if (status >= 400 && status < 500) return 'validation'
  return 'unknown'
}

// ─── Sync meta persistence ────────────────────────────────────────────────────

async function persistSyncMeta(fields, dbInstance = db) {
  try {
    const player = await dbInstance.players.get(1)
    if (player) {
      await dbInstance.players.update(1, fields)
    } else {
      // No player yet, store in localStorage as fallback
      for (const [k, v] of Object.entries(fields)) {
        try { localStorage.setItem(`taskquest.syncMeta.${k}`, JSON.stringify(v)) } catch (_) {}
      }
    }
  } catch (_) {
    // Non-critical, best-effort
  }
}

// ─── Snapshot ────────────────────────────────────────────────────────────────

/**
 * Returns a sync status snapshot for UI consumption.
 *
 * Shape:
 * {
 *   pendingCount:         number,
 *   errorCount:           number,
 *   authRequired:         boolean,
 *   consecutiveErrors:    number,
 *   lastSyncAt:           string|null,  // ISO, last attempt
 *   lastSyncOkAt:         string|null,  // ISO, last success
 *   lastSyncErrorAt:      string|null,  // ISO, last error
 *   lastSyncErrorMessage: string|null,
 * }
 *
 * @param {import('dexie').Dexie} [dbInstance] – defaults to imported db
 * @returns {Promise<object>}
 */
export async function getSyncSnapshot(dbInstance = db) {
  const [pendingCount, errorCount, player] = await Promise.all([
    dbInstance.outbox.where('status').equals('pending').count(),
    dbInstance.outbox.where('status').equals('failed').count(),
    dbInstance.players.get(1).catch(() => null),
  ])

  return {
    pendingCount,
    errorCount,
    authRequired: state.authRequired,
    consecutiveErrors: state.consecutiveErrors,
    lastSyncAt: player?.lastSyncAt ?? null,
    lastSyncOkAt: player?.lastSyncOkAt ?? null,
    lastSyncErrorAt: player?.lastSyncErrorAt ?? null,
    lastSyncErrorMessage: player?.lastSyncErrorMessage ?? null,
  }
}

// ─── Core sync ────────────────────────────────────────────────────────────────

/**
 * Runs a full sync cycle: push outbox (tasks + player) then pull remote.
 *
 * Error handling:
 *   - auth errors (401/403): marks outbox items as authRequired, sets
 *     state.authRequired = true, stops further processing.
 *   - network errors: increments consecutiveErrors, persists error meta.
 *   - validation errors: logs and persists, continues with pull.
 *
 * Sets state.pendingMergeNote when remote player overwrites local.
 *
 * @param {{ supabase: object, userId: string, db?: import('dexie').Dexie }} params
 * @returns {Promise<{ ok: boolean, errorType?: string, errorMessage?: string, mergeNote?: string|null }>}
 */
export async function syncNow({ supabase, userId, db: dbInstance = db } = {}) {
  if (!supabase || !userId) return { ok: true }

  const nowISO = new Date().toISOString()

  // Record attempt timestamp
  await persistSyncMeta({ lastSyncAt: nowISO }, dbInstance)

  try {
    // ── 1. Push task outbox ──────────────────────────────────────────────
    await _pushWithAuthCheck({ supabase, userId, dbInstance, type: 'task' })
    if (state.authRequired) {
      return { ok: false, errorType: 'auth', errorMessage: 'Se requiere inicio de sesión' }
    }

    // ── 2. Push player outbox ────────────────────────────────────────────
    await _pushWithAuthCheck({ supabase, userId, dbInstance, type: 'player' })
    if (state.authRequired) {
      return { ok: false, errorType: 'auth', errorMessage: 'Se requiere inicio de sesión' }
    }

    // ── 3. Pull remote tasks ─────────────────────────────────────────────
    await pullRemote({ supabase, userId })

    // ── 4. Pull remote player (detect merge) ─────────────────────────────
    const playerBefore = await dbInstance.players.get(1).catch(() => null)
    const updatedAtBefore = playerBefore?.updatedAt ?? null

    await pullPlayerRemote({ supabase, userId })

    const playerAfter = await dbInstance.players.get(1).catch(() => null)
    const updatedAtAfter = playerAfter?.updatedAt ?? null

    // If updatedAt changed to a newer value, remote won → show merge note
    if (updatedAtAfter && updatedAtBefore && updatedAtAfter !== updatedAtBefore) {
      state.pendingMergeNote = 'Se aplicó la versión más reciente (otro dispositivo)'
    }

    // ── Success ──────────────────────────────────────────────────────────
    state.consecutiveErrors = 0
    const okNow = new Date().toISOString()
    await persistSyncMeta({
      lastSyncOkAt: okNow,
      lastSyncErrorAt: null,
      lastSyncErrorMessage: null,
    }, dbInstance)

    return { ok: true, mergeNote: state.pendingMergeNote }
  } catch (err) {
    const errorType = classifyError(err)
    const errorMessage = _shortMessage(err)

    if (errorType === 'auth') {
      state.authRequired = true
      await _markOutboxAuthRequired(dbInstance)
    }

    state.consecutiveErrors += 1
    const errNow = new Date().toISOString()
    await persistSyncMeta({
      lastSyncErrorAt: errNow,
      lastSyncErrorMessage: errorMessage,
    }, dbInstance)

    console.warn(`[syncOrchestrator] sync failed (${errorType}):`, errorMessage)
    return { ok: false, errorType, errorMessage }
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _pushWithAuthCheck({ supabase, userId, dbInstance, type }) {
  try {
    if (type === 'task') {
      await pushOutbox({ supabase, userId })
    } else {
      await pushPlayerOutbox({ supabase, userId })
    }
  } catch (err) {
    const errorType = classifyError(err)
    if (errorType === 'auth') {
      state.authRequired = true
      await _markOutboxAuthRequired(dbInstance)
      return
    }
    // Re-throw so caller handles other error types
    throw err
  }
}

async function _markOutboxAuthRequired(dbInstance) {
  try {
    await dbInstance.outbox
      .where('status')
      .equals('pending')
      .modify({ authRequired: true })
  } catch (_) {}
}

function _shortMessage(err) {
  if (!err) return 'Error desconocido'
  const msg = err.message ?? err.error ?? String(err)
  return String(msg).slice(0, 120)
}
