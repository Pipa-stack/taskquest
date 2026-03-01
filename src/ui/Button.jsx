import { motion, useReducedMotion } from 'framer-motion'

/**
 * Button — design-system button component.
 * variant: 'primary' | 'ghost' | 'gold' | 'danger' | 'ghost-gold' | 'subtle'
 * size: 'sm' | 'md' | 'lg'
 */
export default function Button({
  children,
  variant = 'primary',
  disabled,
  onClick,
  type = 'button',
  fullWidth,
  size = 'md',
  style,
  ...props
}) {
  const reduced = useReducedMotion()

  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.375rem',
    border: 'none',
    borderRadius: '10px',
    fontFamily: 'inherit',
    fontWeight: 700,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: reduced ? 'none' : 'opacity 0.15s, box-shadow 0.15s',
    whiteSpace: 'nowrap',
    opacity: disabled ? 0.35 : 1,
    width: fullWidth ? '100%' : undefined,
    padding:
      size === 'sm' ? '0.3rem 0.7rem'
      : size === 'lg' ? '0.85rem 1.5rem'
      : '0.55rem 1rem',
    fontSize:
      size === 'sm' ? '0.78rem'
      : size === 'lg' ? '1rem'
      : '0.875rem',
    ...style,
  }

  const VARIANTS = {
    primary: {
      background: 'linear-gradient(135deg, #a78bfa, #60a5fa)',
      color: '#fff',
      boxShadow: disabled ? 'none' : '0 2px 8px rgba(167,139,250,0.3)',
    },
    ghost: {
      background: 'transparent',
      border: '1.5px solid #a78bfa',
      color: '#a78bfa',
    },
    gold: {
      background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
      color: '#1a1400',
      boxShadow: disabled ? 'none' : '0 2px 8px rgba(251,191,36,0.3)',
    },
    danger: {
      background: 'linear-gradient(135deg, #f87171, #ef4444)',
      color: '#fff',
    },
    'ghost-gold': {
      background: 'rgba(251,191,36,0.1)',
      border: '1.5px solid rgba(251,191,36,0.5)',
      color: '#fbbf24',
    },
    subtle: {
      background: '#1e1e2e',
      border: '1px solid #2a2a3e',
      color: '#8a8ab0',
    },
  }

  return (
    <motion.button
      type={type}
      disabled={disabled}
      onClick={onClick}
      style={{ ...base, ...(VARIANTS[variant] ?? VARIANTS.primary) }}
      whileHover={disabled || reduced ? {} : { opacity: 0.88, y: -1 }}
      whileTap={disabled || reduced ? {} : { scale: 0.96, y: 0 }}
      {...props}
    >
      {children}
    </motion.button>
  )
}
