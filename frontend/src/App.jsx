import { useState } from 'react'
import ModeSelector from './components/ModeSelector'
import UploadForm from './components/UploadForm'
import ResultsGallery from './components/ResultsGallery'
import './styles/app.css'

export default function App() {
  const [mode, setMode] = useState('standard')
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)

  async function handleGenerate({ image, keywords, productName, brandName, brandMission }) {
    setGenerating(true)
    setError(null)
    setResults(null)

    try {
      const formData = new FormData()
      formData.append('productImage', image)
      formData.append('mode', mode)
      formData.append('keywords', keywords || '')
      formData.append('productName', productName || '')
      if (brandName) formData.append('brandName', brandName)
      if (brandMission) formData.append('brandMission', brandMission)

      const response = await fetch('/api/generate', { method: 'POST', body: formData })
      const data = await response.json()

      if (!response.ok) throw new Error(data.error || 'Generation failed')
      setResults(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setGenerating(false)
    }
  }

  async function handleDownloadAll() {
    if (!results) return
    try {
      const response = await fetch('/api/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modules: results.modules, mode: results.mode }),
      })
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `aplus-${results.mode}-content.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError('Download failed: ' + err.message)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>A-Listing</h1>
        <p>Generate Amazon A+ Content from a single product photo</p>
      </header>

      <main className="app-main">
        <section className="section">
          <h2>1. Select Content Type</h2>
          <ModeSelector selected={mode} onChange={setMode} disabled={generating} />
        </section>

        <section className="section">
          <h2>2. Upload &amp; Configure</h2>
          <UploadForm mode={mode} onGenerate={handleGenerate} generating={generating} />
        </section>

        {error && (
          <div className="error-banner">
            <strong>Error:</strong> {error}
          </div>
        )}

        {generating && (
          <div className="loading-state">
            <div className="spinner" />
            <p>Generating your A+ content...</p>
            <small>Analyzing product → Writing copy → Generating images → Resizing to spec</small>
          </div>
        )}

        {results && (
          <section className="section">
            <div className="results-header">
              <h2>3. Your A+ Content</h2>
              <button className="btn btn-primary" onClick={handleDownloadAll}>
                Download All (ZIP)
              </button>
            </div>

            {results.compliance?.hasViolations && (
              <div className="compliance-warning">
                <strong>Compliance review needed:</strong> Some generated copy was flagged.
                Review highlighted modules before uploading to Seller Central.
              </div>
            )}

            <ResultsGallery modules={results.modules} />
          </section>
        )}
      </main>

      <footer className="app-footer">
        <a href="/api/usage" target="_blank" rel="noreferrer">API Usage &amp; Cost Log</a>
        <span>Standard A+ · Premium A+ · Brand Story</span>
      </footer>
    </div>
  )
}
