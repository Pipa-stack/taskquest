import { motion } from 'framer-motion'

/**
 * Base Button component with variants and sizes.
 *
 * Variants: primary | ghost | soft | danger
 * Sizes:    sm | md | lg
 *
 * Always uses motion for whileTap scale 0.98.
 * Respects prefers-reduced-motion via CSS.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  children,
  ...rest
}) {
  const classes = [
    'ui-btn',
    `ui-btn--${variant}`,
    `ui-btn--${size}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <motion.button
      className={classes}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.12, ease: 'easeOut' }}
      {...rest}
    >
      {children}
    </motion.button>
  )
}
