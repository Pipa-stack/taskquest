/**
 * StatRow — label / value row with optional icon and hint.
 * Used in HUD panels, shop headers, and card summaries.
 */
export default function StatRow({ icon, label, value, valueColor, hint, style }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.5rem 0.75rem',
        borderRadius: '10px',
        background: '#1e1e2e',
        border: '1px solid #2a2a3e',
        ...style,
      }}
    >
      {icon && (
        <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1 }}>{icon}</span>
      )}
      <span style={{ flex: 1, fontSize: '0.78rem', color: '#8a8ab0', fontWeight: 500 }}>
        {label}
      </span>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <span style={{ fontSize: '0.95rem', fontWeight: 700, color: valueColor ?? '#e2e2e7' }}>
          {value}
        </span>
        {hint && (
          <div style={{ fontSize: '0.62rem', color: '#5a5a7a', marginTop: '1px' }}>{hint}</div>
        )}
      </div>
    </div>
  )
}
