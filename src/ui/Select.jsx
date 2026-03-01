/**
 * Select — styled dropdown with label, hint, error, and optional left icon.
 *
 * Props:
 *  label    {string}    – visible label above the select
 *  hint     {string}    – helper text below (shown when no error)
 *  error    {string}    – error message (overrides hint, changes border to red)
 *  iconLeft {ReactNode} – icon inside the select on the left
 *  id       {string}    – links label and select via htmlFor/id
 */
export default function Select({ label, hint, error, iconLeft, id, children, style, ...selectProps }) {
  const borderColor = error ? '#f87171' : '#2a2a3e'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: '0.75rem',
            fontWeight: 700,
            color: '#8a8ab0',
            letterSpacing: '0.04em',
          }}
        >
          {label}
        </label>
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {iconLeft && (
          <span
            style={{
              position: 'absolute',
              left: '0.75rem',
              fontSize: '0.95rem',
              color: '#5a5a7a',
              pointerEvents: 'none',
              lineHeight: 1,
              zIndex: 1,
            }}
          >
            {iconLeft}
          </span>
        )}

        <select
          id={id}
          style={{
            flex: 1,
            width: '100%',
            padding: `0.65rem 2rem 0.65rem ${iconLeft ? '2.25rem' : '0.875rem'}`,
            background: '#1a1a26',
            border: `1px solid ${borderColor}`,
            borderRadius: '10px',
            color: '#e2e2e7',
            fontSize: '0.9rem',
            outline: 'none',
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'border-color 0.2s, box-shadow 0.2s',
            appearance: 'none',
            WebkitAppearance: 'none',
            ...style,
          }}
          onFocus={(e) => {
            e.target.style.borderColor = error ? '#f87171' : '#a78bfa'
            e.target.style.boxShadow = error
              ? '0 0 0 3px rgba(248,113,113,0.12)'
              : '0 0 0 3px rgba(167,139,250,0.12)'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = error ? '#f87171' : '#2a2a3e'
            e.target.style.boxShadow = 'none'
          }}
          {...selectProps}
        >
          {children}
        </select>

        {/* Custom chevron */}
        <span
          style={{
            position: 'absolute',
            right: '0.75rem',
            fontSize: '0.7rem',
            color: '#5a5a7a',
            pointerEvents: 'none',
            lineHeight: 1,
          }}
        >
          ▾
        </span>
      </div>

      {error && (
        <span style={{ fontSize: '0.72rem', color: '#f87171', fontWeight: 600 }}>{error}</span>
      )}
      {hint && !error && (
        <span style={{ fontSize: '0.72rem', color: '#5a5a7a' }}>{hint}</span>
      )}
    </div>
  )
}
