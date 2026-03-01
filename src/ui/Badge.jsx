/**
 * Badge — small uppercase label pill.
 * variant: 'neutral' | 'purple' | 'gold' | 'green' | 'blue' | 'red' | 'cyan' | 'teal'
 */
const VARIANTS = {
  neutral: { background: '#1e1e2e',                    color: '#8a8ab0', border: '1px solid #2a2a3e' },
  purple:  { background: 'rgba(167,139,250,0.15)',     color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' },
  gold:    { background: 'rgba(251,191,36,0.15)',      color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' },
  green:   { background: 'rgba(74,222,128,0.15)',      color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)' },
  blue:    { background: 'rgba(96,165,250,0.15)',      color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' },
  red:     { background: 'rgba(248,113,113,0.15)',     color: '#f87171', border: '1px solid rgba(248,113,113,0.3)' },
  cyan:    { background: 'rgba(34,211,238,0.15)',      color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' },
  teal:    { background: 'rgba(34,211,238,0.12)',      color: '#22d3ee', border: '1px solid rgba(34,211,238,0.3)' },
}

export default function Badge({ children, variant = 'neutral', style, ...props }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.2rem',
        padding: '0.15rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.65rem',
        fontWeight: 700,
        letterSpacing: '0.05em',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
        ...(VARIANTS[variant] ?? VARIANTS.neutral),
        ...style,
      }}
      {...props}
    >
      {children}
    </span>
  )
}
