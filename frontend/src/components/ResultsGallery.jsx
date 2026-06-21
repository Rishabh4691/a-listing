function downloadImage(base64, filename) {
  const a = document.createElement('a')
  a.href = `data:image/jpeg;base64,${base64}`
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

function CopyField({ label, value, variant }) {
  if (!value) return null
  return (
    <div className="copy-field">
      <div className="copy-label">{label}</div>
      <div className={`copy-value${variant ? ` ${variant}` : ''}`}>{value}</div>
    </div>
  )
}

function ModuleCard({ mod }) {
  const copy = mod.copy || {}
  const img = mod.image || {}
  const violations = mod.complianceIssues || []

  return (
    <div className="module-card">
      <div className="module-card-header">
        <span className="module-name">{mod.name}</span>
        <span className="module-dims">{mod.width} × {mod.height}</span>
      </div>

      <div className="module-card-body">
        <div className="module-image-area">
          {img.base64 ? (
            <img
              src={`data:image/jpeg;base64,${img.base64}`}
              alt={copy.altText || mod.name}
            />
          ) : img.error ? (
            <div className="module-image-error">Image error:<br />{img.error}</div>
          ) : (
            <div className="module-image-placeholder">No image</div>
          )}
        </div>

        <div className="module-copy">
          <CopyField label="Headline" value={copy.headline} variant="headline" />
          <CopyField label="Subheadline" value={copy.subheadline} variant="subheadline" />
          <CopyField label="Body Text" value={copy.bodyText} />
          <CopyField label="Alt Text" value={copy.altText} />

          {violations.length > 0 && (
            <div className="compliance-flags">
              <div className="compliance-flags-title">Compliance review needed:</div>
              <ul>
                {violations.map((v, i) => (
                  <li key={i}>{v.label} — "{v.matched}"</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {img.base64 && (
        <div className="module-card-footer">
          <button
            className="btn btn-primary"
            onClick={() => downloadImage(img.base64, `${mod.id}_${mod.width}x${mod.height}.jpg`)}
          >
            Download Image
          </button>
          {img.sizeBytes && (
            <span style={{ fontSize: 11, color: '#6e6e73', alignSelf: 'center' }}>
              {(img.sizeBytes / 1024).toFixed(0)} KB
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function ResultsGallery({ modules }) {
  return (
    <div className="results-gallery">
      {modules.map(mod => (
        <ModuleCard key={mod.id} mod={mod} />
      ))}
    </div>
  )
}
