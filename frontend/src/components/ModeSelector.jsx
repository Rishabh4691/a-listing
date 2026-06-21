const MODES = [
  {
    id: 'standard',
    label: 'Standard A+',
    badgeClass: 'badge-standard',
    description: 'Classic 970px layout — header, banners, and feature grids. Best for most products.',
    meta: '5 modules · 2 MB limit',
  },
  {
    id: 'premium',
    label: 'Premium A+',
    badgeClass: 'badge-premium',
    description: 'High-res 1464px canvas with hero images, carousels, and hotspot modules.',
    meta: '4 modules · 5 MB limit',
  },
  {
    id: 'brand_story',
    label: 'Brand Story',
    badgeClass: 'badge-brand',
    description: 'Brand-wide carousel reused across all ASINs. Input brand name, mission, and logo.',
    meta: '3 modules · brand-level',
  },
]

export default function ModeSelector({ selected, onChange, disabled }) {
  return (
    <div className="mode-selector">
      {MODES.map(mode => (
        <button
          key={mode.id}
          className={`mode-card${selected === mode.id ? ' selected' : ''}`}
          onClick={() => onChange(mode.id)}
          disabled={disabled}
          type="button"
        >
          <div className={`mode-badge ${mode.badgeClass}`}>{mode.label}</div>
          <h3>{mode.label}</h3>
          <p>{mode.description}</p>
          <div className="mode-meta">{mode.meta}</div>
        </button>
      ))}
    </div>
  )
}
