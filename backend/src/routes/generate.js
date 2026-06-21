import express from 'express'
import multer from 'multer'
import archiver from 'archiver'
import { MODULE_SPECS } from '../config/modules.js'
import { analyzeProduct, generateModuleCopy, testConnection } from '../services/nvidia.js'
import { generateImage } from '../services/imageGen.js'
import { resizeToSpec } from '../services/imageProcessor.js'
import { checkAllModuleCopy } from '../services/compliance.js'
import { extractKeywords } from '../services/keywords.js'
import { getUsageSummary } from '../services/costLogger.js'

const router = express.Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are accepted'))
    }
  },
})

// POST /api/generate
router.post('/generate', upload.single('productImage'), async (req, res) => {
  try {
    const {
      mode = 'standard',
      keywords = '',
      productName = '',
      brandName = '',
      brandMission = '',
    } = req.body

    if (!req.file) {
      return res.status(400).json({ error: 'Product image is required' })
    }

    const validModes = Object.keys(MODULE_SPECS)
    if (!validModes.includes(mode)) {
      return res.status(400).json({ error: `Invalid mode. Must be one of: ${validModes.join(', ')}` })
    }

    const specs = MODULE_SPECS[mode]
    const imageBase64 = req.file.buffer.toString('base64')
    const mimeType = req.file.mimetype

    console.log(`[Generate] mode=${mode} file=${req.file.originalname} size=${req.file.size}`)

    // 1 — Vision analysis
    console.log('[Generate] Step 1: Analyzing product image...')
    const productAnalysis = await analyzeProduct(imageBase64, mimeType)

    // 2 — Keywords
    console.log('[Generate] Step 2: Resolving keywords...')
    const resolvedKeywords = await extractKeywords(
      productName || productAnalysis.category || 'product',
      keywords
    )

    // 3 — Copy generation
    console.log(`[Generate] Step 3: Generating copy for ${specs.modules.length} modules...`)
    const moduleCopy = await generateModuleCopy({
      productAnalysis: { ...productAnalysis, productName, brandName, brandMission },
      moduleSpecs: specs,
      keywords: resolvedKeywords,
      mode,
    })

    // 4 — Compliance check on generated copy
    const complianceResults = checkAllModuleCopy(moduleCopy)
    const hasViolations = Object.values(complianceResults).some(v => v.length > 0)
    if (hasViolations) {
      console.warn('[Generate] Compliance flags detected — flagging for manual review')
    }

    // 5 — Image generation + resize for each module
    console.log('[Generate] Step 4: Generating and resizing module images...')
    const moduleImages = {}

    for (const moduleSpec of specs.modules) {
      console.log(`  ${moduleSpec.id} (${moduleSpec.width}×${moduleSpec.height})`)
      try {
        const rawImageData = await generateImage({
          moduleSpec,
          productAnalysis,
          copyData: moduleCopy[moduleSpec.id],
        })
        const resized = await resizeToSpec(rawImageData, moduleSpec.width, moduleSpec.height, specs.maxFileSizeBytes)
        moduleImages[moduleSpec.id] = {
          base64: resized.base64,
          mimeType: resized.mimeType,
          width: resized.width,
          height: resized.height,
          sizeBytes: resized.sizeBytes,
        }
      } catch (imgErr) {
        console.error(`  Failed ${moduleSpec.id}:`, imgErr.message)
        moduleImages[moduleSpec.id] = { error: imgErr.message }
      }
    }

    console.log('[Generate] Done.')

    res.json({
      success: true,
      mode,
      productAnalysis,
      keywords: resolvedKeywords,
      modules: specs.modules.map(spec => ({
        ...spec,
        copy: moduleCopy[spec.id] || {},
        image: moduleImages[spec.id] || {},
        complianceIssues: complianceResults[spec.id] || [],
      })),
      compliance: { hasViolations, details: complianceResults },
    })
  } catch (err) {
    console.error('[Generate] Error:', err.message)
    res.status(500).json({ error: err.message || 'Generation failed' })
  }
})

// GET /api/test-connection — quick smoke-test for the NVIDIA API key
router.get('/test-connection', async (_req, res) => {
  try {
    const result = await testConnection()
    res.json({ ok: true, ...result })
  } catch (err) {
    const status = err.response?.status
    const detail = err.response?.data?.detail || err.response?.data?.message || err.message
    res.status(status || 500).json({ ok: false, error: detail })
  }
})

// GET /api/usage
router.get('/usage', (_req, res) => {
  try {
    res.json(getUsageSummary())
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve usage data' })
  }
})

// POST /api/download — zip of all images + copy text
router.post('/download', express.json({ limit: '200mb' }), (req, res) => {
  const { modules = [], mode = 'content' } = req.body

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', `attachment; filename="aplus-${mode}-${Date.now()}.zip"`)

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', err => { throw err })
  archive.pipe(res)

  for (const mod of modules) {
    if (mod.image?.base64) {
      const buf = Buffer.from(mod.image.base64, 'base64')
      archive.append(buf, { name: `images/${mod.id}_${mod.width}x${mod.height}.jpg` })
    }
  }

  const copyText = modules.map(mod => {
    const c = mod.copy || {}
    return [
      `=== ${mod.name} (${mod.id}) — ${mod.width}×${mod.height}px ===`,
      `Headline:     ${c.headline || ''}`,
      `Subheadline:  ${c.subheadline || ''}`,
      `Body Text:    ${c.bodyText || ''}`,
      `Alt Text:     ${c.altText || ''}`,
      '',
    ].join('\n')
  }).join('\n')

  archive.append(copyText, { name: 'copy.txt' })
  archive.finalize()
})

export default router
