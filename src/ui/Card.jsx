import { motion } from 'framer-motion'

/**
 * Base Card component.
 * Wraps children in a styled surface with optional hover lift animation.
 *
 * Props:
 *   className  – extra CSS classes
 *   hover      – enable hover lift effect (default false)
 *   as         – element tag (default 'div')
 *   ...rest    – forwarded to the element
 */
export default function Card({ className = '', hover = false, as: Tag = 'div', children, ...rest }) {
  const classes = ['card', className].filter(Boolean).join(' ')

  if (hover) {
    return (
      <motion.div
        className={classes}
        whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <Tag className={classes} {...rest}>
      {children}
    </Tag>
  )
}
