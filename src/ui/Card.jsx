/**
 * Card — surface container.
 * variant: 'default' | 'raised' | 'subtle'
 */
const VARIANTS = {
  default: {
    background: '#16161f',
    border: '1px solid #2a2a3e',
    borderRadius: '14px',
    boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
  },
  raised: {
    background: '#1a1a26',
    border: '1px solid #2a2a3e',
    borderRadius: '14px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
  },
  subtle: {
    background: '#1e1e2e',
    border: '1px solid #2a2a3e',
    borderRadius: '14px',
    boxShadow: 'none',
  },
}

export default function Card({ children, className, style, variant = 'default', ...props }) {
  return (
    <div
      style={{ ...(VARIANTS[variant] ?? VARIANTS.default), ...style }}
      className={className}
      {...props}
    >
      {children}
    </div>
  )
}
