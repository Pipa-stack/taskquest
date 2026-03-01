/**
 * Chip — interactive pill tag.
 * variant: 'neutral' | 'primary' | 'gold' | 'teal' | 'warn' | 'green'
 * rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'
 * If onClick is provided, renders as a button; otherwise as a span.
 */
const RARITY_COLORS = {
  common:    { bg: 'rgba(148,163,184,0.12)', color: '#94a3b8', border: 'rgba(148,163,184,0.3)' },
  uncommon:  { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80', border: 'rgba(74,222,128,0.3)'  },
  rare:      { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa', border: 'rgba(96,165,250,0.3)'  },
  epic:      { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
  legendary: { bg: 'rgba(251,191,36,0.18)',  color: '#fbbf24', border: 'rgba(251,191,36,0.45)' },
}

const VARIANT_COLORS = {
  neutral: { bg: '#1e1e2e',                    color: '#8a8ab0', border: '#2a2a3e' },
  primary: { bg: 'rgba(167,139,250,0.15)',     color: '#a78bfa', border: 'rgba(167,139,250,0.3)' },
  gold:    { bg: 'rgba(251,191,36,0.15)',      color: '#fbbf24', border: 'rgba(251,191,36,0.35)' },
  teal:    { bg: 'rgba(34,211,238,0.12)',      color: '#22d3ee', border: 'rgba(34,211,238,0.3)'  },
  warn:    { bg: 'rgba(248,113,113,0.12)',     color: '#f87171', border: 'rgba(248,113,113,0.3)' },
  green:   { bg: 'rgba(74,222,128,0.12)',      color: '#4ade80', border: 'rgba(74,222,128,0.3)'  },
}

export default function Chip({ children, variant, rarity, active, onClick, style, ...props }) {
  const colors = rarity
    ? (RARITY_COLORS[rarity] ?? RARITY_COLORS.common)
    : (VARIANT_COLORS[variant] ?? VARIANT_COLORS.neutral)

  const isInteractive = Boolean(onClick)

  const chipStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.25rem 0.7rem',
    borderRadius: '999px',
    fontSize: '0.72rem',
    fontWeight: 700,
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
    border: `1px solid ${colors.border}`,
    background: active || !isInteractive ? colors.bg : 'transparent',
    color: colors.color,
    cursor: isInteractive ? 'pointer' : 'default',
    fontFamily: 'inherit',
    transition: 'background 0.15s, border-color 0.15s, opacity 0.15s',
    opacity: isInteractive && !active ? 0.6 : 1,
    ...style,
  }

  if (!isInteractive) {
    return (
      <span style={chipStyle} {...props}>
        {children}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      style={chipStyle}
      {...props}
    >
      {children}
    </button>
  )
}
