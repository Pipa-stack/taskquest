import { useRef } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

/**
 * Tabs — animated pill navigation bar.
 *
 * Features:
 *  - layoutId animated indicator (disabled with prefers-reduced-motion)
 *  - keyboard nav: ArrowLeft / ArrowRight / Home / End
 *  - optional sticky on mobile
 *
 * Props:
 *  items    {Array<{id, label}>}  – tab definitions
 *  active   {string}              – currently active tab id
 *  onChange {Function}            – (id) => void
 *  sticky   {boolean}             – stick to top on scroll (default false)
 */
export default function Tabs({ items, active, onChange, sticky = false }) {
  const navRef = useRef(null)
  const reduced = useReducedMotion()

  const handleKeyDown = (e, index) => {
    const count = items.length
    let nextIndex = null

    if (e.key === 'ArrowRight') nextIndex = (index + 1) % count
    else if (e.key === 'ArrowLeft') nextIndex = (index - 1 + count) % count
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = count - 1

    if (nextIndex !== null) {
      e.preventDefault()
      onChange(items[nextIndex].id)
      navRef.current?.children[nextIndex]?.focus()
    }
  }

  return (
    <div
      role="tablist"
      ref={navRef}
      aria-label="Navegación de pestañas"
      style={{
        display: 'flex',
        gap: '0.2rem',
        padding: '0.3rem',
        background: '#16161f',
        border: '1px solid #2a2a3e',
        borderRadius: '999px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
        position: sticky ? 'sticky' : undefined,
        top: sticky ? '0' : undefined,
        zIndex: sticky ? 10 : undefined,
      }}
    >
      {items.map((item, index) => {
        const isActive = active === item.id
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            style={{
              position: 'relative',
              flexShrink: 0,
              padding: '0.42rem 0.9rem',
              background: 'transparent',
              border: 'none',
              borderRadius: '999px',
              color: isActive ? '#e2e2e7' : '#5a5a7a',
              fontSize: '0.82rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'color 0.15s',
              zIndex: 1,
              whiteSpace: 'nowrap',
            }}
          >
            {isActive && (
              <motion.span
                layoutId={reduced ? undefined : 'tabs-indicator'}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '999px',
                  background:
                    'linear-gradient(135deg, rgba(167,139,250,0.22), rgba(96,165,250,0.15))',
                  boxShadow:
                    '0 0 0 1.5px rgba(167,139,250,0.5), 0 0 16px rgba(167,139,250,0.2)',
                  zIndex: -1,
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
