/**
 * Base Badge component.
 *
 * Variants: neutral | primary | gold | teal | warn
 */
export default function Badge({ variant = 'neutral', className = '', children, ...rest }) {
  const classes = ['badge', `badge--${variant}`, className].filter(Boolean).join(' ')
  return (
    <span className={classes} {...rest}>
      {children}
    </span>
  )
}
