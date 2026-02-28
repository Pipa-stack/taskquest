import { useState, useEffect, useCallback } from 'react'
import { previewRepairDb, repairDb } from '../services/repairService.js'

/**
 * DevPanel — developer/debug overlay.
 * Only rendered in App when supabase is not configured (local dev).
 *
 * Features:
 *   - Repair DB: shows preview of changes + confirm modal before applying.
 */
export default function DevPanel({ onClose, onNotify }) {
  const [repairPreview, setRepairPreview] = useState(null)
  const [showConfirm, setShowConfirm] = useState(false)
  const [isRepairing, setIsRepairing] = useState(false)

  const handlePreviewRepair = useCallback(async () => {
    const preview = await previewRepairDb()
    setRepairPreview(preview)
    setShowConfirm(true)
  }, [])

  const handleConfirmRepair = useCallback(async () => {
    setIsRepairing(true)
    try {
      const result = await repairDb()
      const changesText =
        result.playerChanges.length > 0
          ? `${result.playerChanges.length} campo(s) corregido(s)`
          : 'Sin cambios en player'
      const outboxText =
        result.outboxRemoved > 0
          ? `, ${result.outboxRemoved} entradas de outbox eliminadas`
          : ''
      onNotify(`✅ Repair: ${changesText}${outboxText}`)
    } catch (err) {
      onNotify(`❌ Error en repair: ${err?.message ?? err}`)
    } finally {
      setIsRepairing(false)
      setShowConfirm(false)
      setRepairPreview(null)
    }
  }, [onNotify])

  const handleCancelRepair = useCallback(() => {
    setShowConfirm(false)
    setRepairPreview(null)
  }, [])

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const previewText = repairPreview
    ? _formatPreview(repairPreview)
    : null

  return (
    <div
      className="dev-panel-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-label="Panel de desarrollo"
    >
      <div className="dev-panel-box">
        <h3>🛠 Dev Panel</h3>

        {/* ── Repair DB section ─────────────────────────────────────── */}
        <div className="dev-panel-section">
          <h4>Reparación de datos</h4>

          {!showConfirm ? (
            <button
              className="dev-panel-btn"
              onClick={handlePreviewRepair}
              type="button"
            >
              🔧 Repair DB (previsualizar)
            </button>
          ) : (
            <>
              <div className="dev-panel-preview">
                {previewText}
              </div>
              <div className="dev-panel-actions">
                <button
                  className="dev-panel-confirm-btn"
                  onClick={handleConfirmRepair}
                  disabled={isRepairing}
                  type="button"
                >
                  {isRepairing ? 'Reparando…' : '✓ Confirmar reparación'}
                </button>
                <button
                  className="dev-panel-cancel-btn"
                  onClick={handleCancelRepair}
                  type="button"
                >
                  Cancelar
                </button>
              </div>
            </>
          )}
        </div>

        {/* ── Close button ──────────────────────────────────────────── */}
        <div className="dev-panel-actions" style={{ marginTop: '1rem' }}>
          <button
            className="dev-panel-cancel-btn"
            onClick={onClose}
            type="button"
            style={{ flex: 'none', padding: '4px 16px' }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

function _formatPreview(preview) {
  const lines = []
  if (preview.playerChanges.length === 0) {
    lines.push('Player: sin cambios necesarios')
  } else {
    lines.push(`Player — ${preview.playerChanges.length} cambio(s):`)
    for (const c of preview.playerChanges) {
      lines.push(`  • ${c}`)
    }
  }
  if (preview.outboxCorruptCount > 0) {
    lines.push(`Outbox corrupto: ${preview.outboxCorruptCount} entrada(s) a eliminar`)
  }
  if (preview.outboxOverCap > 0) {
    lines.push(`Outbox sobre límite: ${preview.outboxOverCap} entrada(s) antigua(s) a eliminar`)
  }
  if (preview.totalOutbox > 0) {
    lines.push(`Total outbox actual: ${preview.totalOutbox}`)
  }
  return lines.join('\n')
}
