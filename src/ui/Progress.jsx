import { motion } from 'framer-motion'

/**
 * Animated progress bar.
 *
 * Props:
 *   value      – current value (0..max)
 *   max        – maximum value (default 100)
 *   label      – optional accessible label string
 *   variant    – 'primary' | 'gold' | 'green' | 'teal' (default 'primary')
 *   size       – 'sm' | 'md' | 'lg' (default 'md')
 *   className  – extra CSS classes on the wrapper
 */
export default function Progress({
  value = 0,
  max = 100,
  label,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0

  const wrapClasses = ['ui-progress', `ui-progress--${size}`, className].filter(Boolean).join(' ')
  const fillClasses = ['ui-progress__fill', `ui-progress__fill--${variant}`].join(' ')

  return (
    <div
      className={wrapClasses}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      {...rest}
    >
      <motion.div
        className={fillClasses}
        animate={{ width: `${pct}%` }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
        style={{ minWidth: pct > 0 ? 4 : 0 }}
      />
    </div>
  )
}
