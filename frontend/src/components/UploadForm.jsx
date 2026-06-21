import { useState, useRef } from 'react'

const MODE_LABELS = {
  standard: 'Standard A+ Content',
  premium: 'Premium A+ Content',
  brand_story: 'Brand Story',
}

export default function UploadForm({ mode, onGenerate, generating }) {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [keywords, setKeywords] = useState('')
  const [productName, setProductName] = useState('')
  const [brandName, setBrandName] = useState('')
  const [brandMission, setBrandMission] = useState('')
  const [dragOver, setDragOver] = useState(false)

  const fileInputRef = useRef(null)

  function handleFile(file) {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      alert('Please upload a JPEG, PNG, or WebP image.')
      return
    }
    setImage(file)
    const url = URL.createObjectURL(file)
    setPreview(prev => { if (prev) URL.revokeObjectURL(prev); return url })
  }

  function handleDrop(e) {
    e.preventDefault()
    setDragOver(false)
    handleFile(e.dataTransfer.files[0])
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!image) return
    onGenerate({ image, keywords, productName, brandName, brandMission })
  }

  const isBrandStory = mode === 'brand_story'

  return (
    <form className="upload-form" onSubmit={handleSubmit}>
      <div
        className={`dropzone${dragOver ? ' drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={e => handleFile(e.target.files[0])}
        />
        <div className="dropzone-icon">{preview ? '✓' : '📷'}</div>
        {preview ? (
          <>
            <img src={preview} alt="Selected product" className="preview-img" />
            <p style={{ marginTop: 8 }}>
              <strong>{image?.name}</strong> · Click to change
            </p>
          </>
        ) : (
          <>
            <p><strong>Click to upload</strong> or drag &amp; drop</p>
            <p>JPEG · PNG · WebP &nbsp;·&nbsp; max 10 MB</p>
          </>
        )}
      </div>

      <div className="form-group">
        <label>
          Product name <span>(helps with keyword extraction)</span>
        </label>
        <input
          type="text"
          placeholder={isBrandStory ? 'Your main product or brand name' : 'e.g. Stainless Steel French Press 1L'}
          value={productName}
          onChange={e => setProductName(e.target.value)}
        />
      </div>

      {isBrandStory && (
        <div className="form-row">
          <div className="form-group" style={{ marginTop: 0 }}>
            <label>Brand name</label>
            <input
              type="text"
              placeholder="e.g. BrewMaster Co."
              value={brandName}
              onChange={e => setBrandName(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginTop: 0 }}>
            <label>
              Mission / tagline <span>(optional)</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Crafting better mornings since 2015"
              value={brandMission}
              onChange={e => setBrandMission(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="form-group">
        <label>
          Keywords <span>(optional — one per line or comma-separated. Leave blank to auto-extract.)</span>
        </label>
        <textarea
          placeholder="Paste from Helium 10, SellerSprite, etc."
          value={keywords}
          onChange={e => setKeywords(e.target.value)}
        />
      </div>

      <button
        type="submit"
        className="btn btn-generate"
        disabled={!image || generating}
      >
        {generating ? 'Generating...' : `Generate ${MODE_LABELS[mode]}`}
      </button>
    </form>
  )
}
