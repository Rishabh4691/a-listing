import axios from 'axios'
import { logUsage } from './costLogger.js'

// ── Provider 1: fal.ai FLUX Kontext (img2img — your real product in the scene)
// Free $5 credits on signup at fal.ai, ~$0.01/image after that
// Set FAL_API_KEY in .env to enable
const FAL_BASE = 'https://fal.run/fal-ai/flux-pro/kontext'

// ── Provider 2: Pollinations AI (text-to-image, no key, always free)
// Images are lifestyle-style but won't show your exact product
const POLLINATIONS_BASE = 'https://image.pollinations.ai/prompt'

const SCENE_PROMPTS = {
  header:       'wide lifestyle banner, product as hero centerpiece, aspirational setting, soft diffused studio lighting, clean composition',
  banner:       'wide panoramic product-in-use scene, contextual environment, professional commercial photography',
  square_inset: 'clean studio shot, product centered, contrasting neutral background, commercial product photography',
  grid_large:   'minimal studio product shot, soft white background, product at slight angle, sharp detail',
  grid_small:   'crisp product thumbnail, centered on white, maximum clarity',
  hero:         'dramatic cinematic hero shot, premium lifestyle setting, aspirational, professional studio lighting',
  feature_large:'close-up detail showcase, material textures and craftsmanship visible, sharp studio lighting',
  carousel:     'product shown in real-world use, natural warm lighting, authentic lifestyle photography',
  hotspot:      'top-down or 3/4 angle detail shot, every feature clearly visible, clean white background',
  brand_hero:   'wide brand storytelling image, aspirational lifestyle, premium brand aesthetic',
  brand_logo:   'clean minimal brand presentation, product on neutral elegant surface',
  brand_card:   'warm inviting lifestyle shot, approachable, communicates quality and brand values',
}

function buildSceneInstruction(moduleSpec, productAnalysis, copyData) {
  const scene = SCENE_PROMPTS[moduleSpec.id] || 'professional product photography, clean studio background'
  const headline = copyData?.headline ? `Theme: "${copyData.headline}". ` : ''
  return `${headline}${scene}. Target audience: ${productAnalysis.targetAudience || 'consumers'}. No text overlays. No watermarks. Photorealistic, high resolution, Amazon A+ listing quality.`
}

function buildTextPrompt(moduleSpec, productAnalysis, copyData) {
  const productDesc = [
    productAnalysis.category,
    productAnalysis.colors?.length    && `${productAnalysis.colors.slice(0, 2).join(' and ')} color`,
    productAnalysis.materials?.length && `made of ${productAnalysis.materials.slice(0, 2).join(' and ')}`,
    productAnalysis.style             && `${productAnalysis.style} aesthetic`,
    productAnalysis.visibleText       && `branded as "${productAnalysis.visibleText}"`,
  ].filter(Boolean).join(', ')

  const scene = buildSceneInstruction(moduleSpec, productAnalysis, copyData)
  return `Professional Amazon A+ content photography. ${productDesc}. ${scene}`
}

function clampDim(n, max = 2048) {
  return Math.min(max, Math.max(128, Math.round(n)))
}

// ── fal.ai img2img: passes your real product photo so it appears in the output
async function generateWithFal({ moduleSpec, productAnalysis, imageBase64, mimeType, copyData }) {
  const falKey = process.env.FAL_API_KEY
  const instruction = buildSceneInstruction(moduleSpec, productAnalysis, copyData)
  const imageDataUri = `data:${mimeType};base64,${imageBase64}`

  console.log(`  [fal.ai] ${moduleSpec.id}: "${instruction.substring(0, 80)}..."`)

  const response = await axios.post(
    FAL_BASE,
    {
      prompt: instruction,
      image_url: imageDataUri,
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: 'jpeg',
    },
    {
      headers: {
        Authorization: `Key ${falKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    }
  )

  const imageUrl = response.data?.images?.[0]?.url
  if (!imageUrl) throw new Error(`fal.ai returned no image. Response: ${JSON.stringify(response.data).substring(0, 200)}`)

  const dl = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 30000 })
  const b64 = Buffer.from(dl.data).toString('base64')
  logUsage({ model: 'fal-ai/flux-kontext', imagesGenerated: 1, mode: `image_${moduleSpec.id}`, success: true })
  return `data:image/jpeg;base64,${b64}`
}

// ── Pollinations fallback: text-to-image, no key needed
async function generateWithPollinations({ moduleSpec, productAnalysis, copyData }) {
  const prompt = buildTextPrompt(moduleSpec, productAnalysis, copyData)
  const width  = clampDim(moduleSpec.width)
  const height = clampDim(moduleSpec.height)

  console.log(`  [Pollinations] ${moduleSpec.id} ${width}×${height}: "${prompt.substring(0, 80)}..."`)

  const url = `${POLLINATIONS_BASE}/${encodeURIComponent(prompt)}`
  const params = { width, height, model: 'flux', nologo: 'true', enhance: 'true' }

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
        throw new Error(`Non-image response: ${text.substring(0, 200)}`)
      }
      const b64 = Buffer.from(response.data).toString('base64')
      const mime = contentType.split(';')[0].trim()
      logUsage({ model: 'pollinations/flux', imagesGenerated: 1, mode: `image_${moduleSpec.id}`, success: true })
      return `data:${mime};base64,${b64}`
    } catch (err) {
      const status = err.response?.status
      if ((status === 429 || status === 503 || !status) && attempt < 3) {
        await new Promise(r => setTimeout(r, attempt * 8000))
        continue
      }
      throw err
    }
  }
}

export async function generateImage({ moduleSpec, productAnalysis, imageBase64, mimeType, copyData }) {
  const falKey = process.env.FAL_API_KEY

  if (falKey) {
    try {
      return await generateWithFal({ moduleSpec, productAnalysis, imageBase64, mimeType, copyData })
    } catch (err) {
      console.warn(`  [fal.ai] Failed (${err.response?.status || err.message}), falling back to Pollinations`)
    }
  }

  return generateWithPollinations({ moduleSpec, productAnalysis, copyData })
}
