import { useEffect, useRef } from 'react'

/**
 * ShortcutsOverlay — opened with `?`, closed with Esc or the × button.
 * Uses native <dialog> for top-layer rendering and focus management.
 */

const SHORTCUT_GROUPS = [
  {
    title: 'Navegación',
    items: [
      { key: 'Alt + 1 … 8', desc: 'Ir a cada sección (Base, Tareas…)' },
    ],
  },
  {
    title: 'Acciones globales',
    items: [
      { key: 'Ctrl + K',   desc: 'Abrir paleta de comandos' },
      { key: 'Ctrl + I',   desc: 'Reclamar monedas idle' },
      { key: 'Ctrl + S',   desc: 'Sincronizar ahora' },
      { key: '?',          desc: 'Mostrar / ocultar esta ayuda' },
      { key: 'Esc',        desc: 'Cerrar paleta / overlay' },
    ],
  },
]

export default function ShortcutsOverlay({ open, onClose }) {
  const dialogRef = useRef(null)

  // Sync dialog open state with native <dialog> API
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      if (!dialog.open) dialog.showModal()
    } else {
      if (dialog.open) dialog.close()
    }
  }, [open])

  // Forward native Esc (cancel event) to the controlled state
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e) => { e.preventDefault(); onClose() }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  const handleBackdropClick = (e) => {
    if (e.target === dialogRef.current) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="shortcuts-dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
      onClick={handleBackdropClick}
    >
      <div className="shortcuts-panel">
        <div className="shortcuts-header">
          <h2 id="shortcuts-title" className="shortcuts-title">
            Atajos de teclado
          </h2>
          <button
            className="shortcuts-close"
            onClick={onClose}
            aria-label="Cerrar ayuda de atajos"
            type="button"
          >
            ✕
          </button>
        </div>

        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title} className="shortcuts-group">
            <h3 className="shortcuts-group-title">{group.title}</h3>
            <ul className="shortcuts-list">
              {group.items.map((item) => (
                <li key={item.key} className="shortcuts-item">
                  <kbd className="shortcuts-kbd">{item.key}</kbd>
                  <span className="shortcuts-desc">{item.desc}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </dialog>
  )
}
