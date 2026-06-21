import axios from 'axios'
import { logUsage } from './costLogger.js'

// Pollinations AI — completely free, no API key, no signup required
// Uses FLUX under the hood, returns JPEG directly
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt'

const SCENE_PROMPTS = {
  header:       'wide lifestyle banner scene, product prominently displayed, aspirational setting, soft studio lighting',
  banner:       'wide panoramic product scene, product shown in context of use, professional photography, banner format',
  square_inset: 'clean studio shot, product centered, contrasting background, commercial photography',
  grid_large:   'minimal studio product shot, white or light background, product centered, slight angle',
  grid_small:   'clean product thumbnail, centered on white background, high clarity, commercial',
  hero:         'cinematic hero product shot, aspirational lifestyle, premium aesthetic, dramatic professional lighting',
  feature_large:'detailed feature showcase, material quality and craftsmanship visible, professional studio lighting',
  carousel:     'versatile lifestyle shot, product in realistic use, natural lighting, authentic feel',
  hotspot:      'clear detail shot with key design features visible, clean background, sharp throughout',
  brand_hero:   'wide aspirational brand lifestyle image, premium brand feel, brand story visual',
  brand_logo:   'clean brand presentation, product on neutral elegant background, sophisticated',
  brand_card:   'warm inviting lifestyle, approachable, communicates brand values and quality',
}

function buildPrompt(moduleSpec, productAnalysis, copyData) {
  const scene = SCENE_PROMPTS[moduleSpec.id] || 'professional product photography, clean studio background'

  const productDesc = [
    productAnalysis.category,
    productAnalysis.colors?.length  && `${productAnalysis.colors.slice(0, 2).join(' and ')} color`,
    productAnalysis.materials?.length && `${productAnalysis.materials.slice(0, 2).join(', ')}`,
    productAnalysis.style            && `${productAnalysis.style} design style`,
  ].filter(Boolean).join(', ')

  const headline = copyData?.headline || ''

  return [
    'Professional Amazon product listing photography',
    productDesc,
    headline && `visual theme: "${headline}"`,
    scene,
    `for ${productAnalysis.targetAudience || 'consumers'}`,
    'photorealistic, high resolution, commercial quality, no text overlays, no watermarks',
  ].filter(Boolean).join('. ')
}

// Clamp dimensions to what Pollinations supports well (max 2048)
function clampDim(n) {
  return Math.min(2048, Math.max(128, Math.round(n)))
}

export async function generateImage({ moduleSpec, productAnalysis, copyData }) {
  const prompt = buildPrompt(moduleSpec, productAnalysis, copyData)
  const width  = clampDim(moduleSpec.width)
  const height = clampDim(moduleSpec.height)

  console.log(`  [ImageGen] ${moduleSpec.id} ${width}×${height}: "${prompt.substring(0, 80)}..."`)

  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}`
  const params = { width, height, model: 'flux', nologo: 'true', enhance: 'false' }

  let lastErr
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await axios.get(url, {
        params,
        responseType: 'arraybuffer',
        timeout: 90000,
        headers: { 'User-Agent': 'a-listing/1.0' },
      })

      const contentType = response.headers['content-type'] || ''
      if (!contentType.startsWith('image/')) {
        const text = Buffer.from(response.data).toString('utf8')
        throw new Error(`Pollinations returned non-image (${contentType}): ${text.substring(0, 200)}`)
      }

      const b64 = Buffer.from(response.data).toString('base64')
      const mime = contentType.split(';')[0].trim()

      logUsage({ model: 'pollinations/flux', imagesGenerated: 1, mode: `image_${moduleSpec.id}`, success: true })

      return `data:${mime};base64,${b64}`
    } catch (err) {
      lastErr = err
      const status = err.response?.status
      if (status === 429 || status === 503 || !status) {
        const wait = attempt * 8000
        console.warn(`  [ImageGen] Attempt ${attempt} failed (${status || err.code}), retrying in ${wait/1000}s...`)
        await new Promise(r => setTimeout(r, wait))
        continue
      }
      throw err
    }
  }
  throw lastErr
}
