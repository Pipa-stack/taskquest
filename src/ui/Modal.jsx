import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'

/**
 * Modal — accessible overlay dialog.
 *
 * Features:
 *  - blur overlay backdrop
 *  - close on ESC + click outside
 *  - focus-visible on close button
 *  - aria role="dialog" + aria-modal
 *  - framer-motion fade+scale (disabled when prefers-reduced-motion)
 *
 * Props:
 *  open     {boolean}   – controls visibility
 *  onClose  {Function}  – called when dismissed
 *  title    {string}    – dialog label (also shown in header)
 *  size     {string}    – 'sm' | 'md' | 'lg' | 'xl'
 *  children {ReactNode}
 */
export default function Modal({ open, onClose, title, children, size = 'md', style, ...props }) {
  const overlayRef = useRef(null)
  const closeBtnRef = useRef(null)
  const reduced = useReducedMotion()

  // Close on ESC
  useEffect(() => {
    if (!open) return
    const handle = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [open, onClose])

  // Lock body scroll while open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      // Focus the close button on open
      requestAnimationFrame(() => closeBtnRef.current?.focus())
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose?.()
  }

  const SIZES = { sm: '380px', md: '520px', lg: '680px', xl: '840px' }

  const panelAnim = reduced
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, scale: 0.93 }, animate: { opacity: 1, scale: 1 }, exit: { opacity: 0, scale: 0.96 } }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          onClick={handleOverlayClick}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced ? 0.01 : 0.18 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(8,8,14,0.82)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 3000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            {...panelAnim}
            transition={{ duration: reduced ? 0.01 : 0.22, ease: 'easeOut' }}
            style={{
              width: '100%',
              maxWidth: SIZES[size] ?? SIZES.md,
              maxHeight: '90dvh',
              overflowY: 'auto',
              background: '#16161f',
              border: '1px solid #2a2a3e',
              borderRadius: '18px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(167,139,250,0.08)',
              display: 'flex',
              flexDirection: 'column',
              ...style,
            }}
            {...props}
          >
            {/* Header */}
            {title && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1.25rem 1.5rem 0',
                  flexShrink: 0,
                }}
              >
                <h2
                  style={{
                    fontSize: '1.1rem',
                    fontWeight: 800,
                    color: '#e2e2e7',
                    margin: 0,
                  }}
                >
                  {title}
                </h2>
                <button
                  ref={closeBtnRef}
                  onClick={onClose}
                  aria-label="Cerrar"
                  style={{
                    background: 'transparent',
                    border: '1px solid #2a2a3e',
                    borderRadius: '6px',
                    color: '#5a5a7a',
                    width: '28px',
                    height: '28px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.85rem',
                    fontFamily: 'inherit',
                    flexShrink: 0,
                    transition: 'border-color 0.15s, color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#5a5a7a'
                    e.currentTarget.style.color = '#e2e2e7'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#2a2a3e'
                    e.currentTarget.style.color = '#5a5a7a'
                  }}
                >
                  ✕
                </button>
              </div>
            )}

            {/* Body */}
            <div style={{ padding: '1.25rem 1.5rem 1.5rem', flex: 1 }}>
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
