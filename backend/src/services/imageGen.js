import axios from 'axios'
import { logUsage } from './costLogger.js'

// Together AI — FLUX.1-schnell, OpenAI-compatible image generations endpoint
// $0.003/image for the paid model; FLUX.1-schnell-Free is free but no custom dimensions
const TOGETHER_BASE = 'https://api.together.xyz/v1'
const PAID_MODEL    = 'black-forest-labs/FLUX.1-schnell'
const FREE_MODEL    = 'black-forest-labs/FLUX.1-schnell-Free'

// FLUX requires dimensions that are multiples of 32, between 256–2048
function snapTo32(n, min = 256, max = 1024) {
  return Math.min(max, Math.max(min, Math.round(n / 32) * 32))
}

// Scene/mood descriptors per module
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
    'photorealistic, high resolution, commercial quality, sRGB, no text overlays',
  ].filter(Boolean).join('. ')
}

const NEGATIVE_PROMPT = 'low quality, blurry, distorted, watermark, text, price tag, sale sign, cartoon, anime, ugly, deformed'

export async function generateImage({ moduleSpec, productAnalysis, copyData }) {
  const togetherKey = process.env.TOGETHER_API_KEY
  if (!togetherKey) {
    throw new Error(
      'TOGETHER_API_KEY is not set. Get a free key at https://api.together.ai — ' +
      'add it to backend/.env as TOGETHER_API_KEY=your_key_here'
    )
  }

  const prompt = buildPrompt(moduleSpec, productAnalysis, copyData)
  console.log(`  [ImageGen] ${moduleSpec.id}: "${prompt.substring(0, 90)}..."`)

  // Snap dimensions to FLUX-compatible multiples of 32, max 1024
  const width  = snapTo32(moduleSpec.width)
  const height = snapTo32(moduleSpec.height)

  const response = await axios.post(
    `${TOGETHER_BASE}/images/generations`,
    {
      model: PAID_MODEL,
      prompt,
      negative_prompt: NEGATIVE_PROMPT,
      n: 1,
      steps: 4,
      width,
      height,
      response_format: 'b64_json',
    },
    {
      headers: {
        Authorization: `Bearer ${togetherKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 90000,
    }
  )

  const b64 = response.data?.data?.[0]?.b64_json
  if (!b64) {
    throw new Error(`Together AI returned no image. Response: ${JSON.stringify(response.data).substring(0, 300)}`)
  }

  logUsage({ model: PAID_MODEL, imagesGenerated: 1, mode: `image_${moduleSpec.id}`, success: true })

  return `data:image/jpeg;base64,${b64}`
}
