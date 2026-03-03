import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * CommandPalette — opens via Ctrl+K.
 *
 * Props:
 *   open      {boolean}   – controlled open state
 *   onClose   {() => void} – called when palette should close
 *   actions   {Array}      – flat list of { id, label, shortcut?, onSelect }
 *
 * Keyboard nav: ArrowUp/Down move selection, Enter executes, Esc closes.
 * Uses native <dialog> for top-layer positioning and focus management.
 */
export default function CommandPalette({ open, onClose, actions }) {
  const dialogRef = useRef(null)
  const inputRef  = useRef(null)
  const listRef   = useRef(null)

  const [query,     setQuery]     = useState('')
  const [activeIdx, setActiveIdx] = useState(0)

  // Filter actions by the current query (case-insensitive substring match)
  const filtered = query.trim()
    ? actions.filter((a) => a.label.toLowerCase().includes(query.trim().toLowerCase()))
    : actions

  // Open / close the native dialog when `open` changes
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open) {
      setQuery('')
      setActiveIdx(0)
      if (!dialog.open) dialog.showModal()
      // Defer focus so the dialog is fully in the top layer first
      requestAnimationFrame(() => inputRef.current?.focus())
    } else {
      if (dialog.open) dialog.close()
    }
  }, [open])

  // Native <dialog> fires 'cancel' on Esc — forward to onClose
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleCancel = (e) => { e.preventDefault(); onClose() }
    dialog.addEventListener('cancel', handleCancel)
    return () => dialog.removeEventListener('cancel', handleCancel)
  }, [onClose])

  // Reset active index whenever the filtered list changes
  useEffect(() => { setActiveIdx(0) }, [query])

  // Scroll the highlighted item into view
  useEffect(() => {
    const item = listRef.current?.querySelector('[data-active="true"]')
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const action = filtered[activeIdx]
      if (action) { action.onSelect(); onClose() }
    }
    // Esc is handled natively by <dialog> cancel event above
  }, [filtered, activeIdx, onClose])

  const handleBackdropClick = useCallback((e) => {
    // The <dialog> element itself is the backdrop; its content sits inside .cmd-panel
    if (e.target === dialogRef.current) onClose()
  }, [onClose])

  return (
    <dialog
      ref={dialogRef}
      className="cmd-dialog"
      aria-modal="true"
      aria-labelledby="cmd-palette-title"
      onClick={handleBackdropClick}
    >
      {/* Visually-hidden title for screen readers */}
      <h2 id="cmd-palette-title" className="sr-only">Paleta de comandos</h2>

      <div className="cmd-panel">
        <input
          ref={inputRef}
          className="cmd-input"
          type="text"
          placeholder="Buscar acción…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          aria-label="Buscar acción en la paleta de comandos"
          aria-controls="cmd-listbox"
          aria-activedescendant={filtered[activeIdx] ? `cmd-item-${filtered[activeIdx].id}` : undefined}
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded="true"
          aria-haspopup="listbox"
        />

        <ul
          ref={listRef}
          id="cmd-listbox"
          className="cmd-list"
          role="listbox"
          aria-label="Acciones disponibles"
        >
          {filtered.length === 0 && (
            <li className="cmd-empty" role="option" aria-selected="false">
              Sin resultados para &ldquo;{query}&rdquo;
            </li>
          )}

          {filtered.map((action, i) => (
            <li
              key={action.id}
              id={`cmd-item-${action.id}`}
              className={`cmd-item${i === activeIdx ? ' cmd-item--active' : ''}`}
              role="option"
              aria-selected={i === activeIdx}
              data-active={i === activeIdx ? 'true' : undefined}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => { action.onSelect(); onClose() }}
            >
              <span className="cmd-item-label">{action.label}</span>
              {action.shortcut && (
                <span className="cmd-item-shortcut" aria-hidden="true">
                  {action.shortcut}
                </span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}
