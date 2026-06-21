import axios from 'axios'
import { logUsage } from './costLogger.js'

const BASE_URL = 'https://integrate.api.nvidia.com/v1'
const VISION_MODEL = 'meta/llama-3.2-11b-vision-instruct'  // confirmed vision model on NVIDIA NIM
const COPY_MODEL   = 'qwen/qwen3.5-397b-a17b'              // large text model for copywriting

// Injected into every copywriting call — violations cause Amazon rejection
const COMPLIANCE_RULES = `
AMAZON A+ CONTENT COMPLIANCE — MANDATORY RULES (violations = Amazon rejection):
1. NO prices: no dollar/rupee/currency amounts, "X% off", price comparisons
2. NO promotions: "sale", "discount", "limited time", "act now", "coupon", "deal"
3. NO reviews or ratings: no star counts, "customers love", "top rated", testimonials
4. NO competitor names or comparisons: "better than X", "unlike Y", "vs competitor"
5. NO contact info or URLs: no emails, phone numbers, websites, Amazon links
6. NO unverifiable claims: only state facts visible in the product photo
7. NO guarantees: "guaranteed", "money-back", "satisfaction guaranteed"
8. NO shipping claims: "free shipping", "fast delivery"
Write only what can be proven by looking at the product image. When uncertain, omit.
`

function getApiKey() {
  const key = process.env.NVIDIA_API_KEY
  if (!key) throw new Error('NVIDIA_API_KEY is not set. Add it to backend/.env and restart the server.')
  return key
}

function getImageApiKey() {
  const key = process.env.NVIDIA_IMAGE_API_KEY
  if (!key) throw new Error('NVIDIA_IMAGE_API_KEY is not set. Add it to backend/.env and restart the server.')
  return key
}

export async function analyzeProduct(imageBase64, mimeType = 'image/jpeg') {
  const apiKey = getApiKey()

  const prompt = `${COMPLIANCE_RULES}
Analyze this product image and return ONLY valid JSON (no markdown, no explanation):
{
  "category": "product category",
  "materials": ["material1", "material2"],
  "visibleFeatures": ["feature1", "feature2"],
  "useCases": ["use case 1", "use case 2"],
  "style": "design aesthetic",
  "colors": ["color1", "color2"],
  "targetAudience": "who this is for",
  "visibleText": "any text/branding on the product, or empty string"
}`

  const response = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: VISION_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}` },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
      max_tokens: 1024,
      temperature: 0.2,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    }
  )

  const usage = response.data.usage || {}
  logUsage({
    model: VISION_MODEL,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    mode: 'vision_analysis',
    success: true,
  })

  const content = response.data.choices?.[0]?.message?.content
  try {
    if (!content) throw new Error('Empty vision response')
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch ? jsonMatch[0] : content)
  } catch {
    console.warn('Vision response was not clean JSON, returning raw:', content?.substring(0, 200))
    return { raw: content, category: 'product', materials: [], visibleFeatures: [], useCases: [], style: 'modern', colors: [], targetAudience: 'consumers', visibleText: '' }
  }
}

export async function generateModuleCopy({ productAnalysis, moduleSpecs, keywords, mode }) {
  const apiKey = getApiKey()

  const keywordNote = keywords?.length
    ? `Weave these keywords naturally — 1-2 per module max, never forced: ${keywords.slice(0, 8).join(', ')}`
    : 'No keywords provided — write naturally from product analysis.'

  const moduleFields = moduleSpecs.modules.map(m =>
    `  "${m.id}": { "headline": "", "subheadline": "", "bodyText": "", "altText": "" }`
  ).join(',\n')

  const prompt = `${COMPLIANCE_RULES}
You are writing Amazon A+ Content copy for a ${mode.replace('_', ' ')} layout.

Product:
${JSON.stringify(productAnalysis, null, 2)}

${keywordNote}

Rules for text length:
- headline: 3-8 words, punchy and benefit-focused
- subheadline: 5-15 words, expands on the headline
- bodyText: 20-50 words max — concise, no filler
- altText: 10-15 words describing the image for accessibility

Overall layout: ~70% visual / 30% text. Less text is better if it communicates the point.

Return ONLY valid JSON, no markdown fences, no explanation:
{
${moduleFields}
}`

  const response = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: COPY_MODEL,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2048,
      temperature: 0.7,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 60000,
    }
  )

  const usage = response.data.usage || {}
  logUsage({
    model: COPY_MODEL,
    inputTokens: usage.prompt_tokens || 0,
    outputTokens: usage.completion_tokens || 0,
    mode: `copywriting_${mode}`,
    success: true,
  })

  const content = response.data.choices?.[0]?.message?.content
  try {
    if (!content) throw new Error('Empty response from model')
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    return JSON.parse(jsonMatch ? jsonMatch[0] : content)
  } catch {
    console.warn('Copy response was not clean JSON:', content?.substring(0, 300))
    // Return empty copy shells so the rest of the pipeline continues
    const fallback = {}
    for (const m of moduleSpecs.modules) {
      fallback[m.id] = { headline: '', subheadline: '', bodyText: '', altText: '' }
    }
    return fallback
  }
}

// Scene descriptions per module type — keeps the product unchanged, edits only the environment
const SCENE_INSTRUCTIONS = {
  header:       'Transform the background into a professional lifestyle setting appropriate for this product. Keep the product 100% identical — same shape, color, and design. Expand the composition to a wide banner format with aspirational, clean styling. No text overlays.',
  banner:       'Place this product in a wide panoramic context scene that shows it in use. Product remains completely unchanged. Background and environment only. Professional photography lighting.',
  square_inset: 'Clean studio composition with the product centered on a simple contrasting background. No text, no distracting elements. Product unchanged.',
  grid_large:   'Minimal studio shot of this product on a white or light neutral background. Product centered, slight angle. Clean commercial photography.',
  grid_small:   'Clean product thumbnail: centered on white background, no props. Maximum product visibility at small size.',
  hero:         'Premium lifestyle hero shot. Aspirational setting, cinematic lighting, sophisticated aesthetic. Product unchanged and prominently featured in foreground.',
  feature_large:'Detailed feature showcase highlighting the most distinctive design elements. Professional studio multi-angle lighting showing material quality. Product completely unchanged.',
  carousel:     'Versatile lifestyle shot showing the product in realistic everyday use. Natural lighting, authentic feel. Product unchanged.',
  hotspot:      'Clear detailed shot of the product with key design features clearly visible for annotation. Clean background, sharp detail throughout. Product unchanged.',
  brand_hero:   'Wide aspirational brand lifestyle image. Consistent premium aesthetic, brand-quality feel. Product unchanged.',
  brand_logo:   'Clean brand presentation: product centered on a neutral elegant background. Sophisticated lighting.',
  brand_card:   'Warm inviting lifestyle setting communicating brand approachability and quality.',
}

export async function generateModuleImage({ imageBase64, mimeType = 'image/jpeg', moduleSpec, productAnalysis }) {
  const apiKey = getImageApiKey()

  const sceneBase = SCENE_INSTRUCTIONS[moduleSpec.id] || 'Place this product in a professional clean studio setting. Product completely unchanged.'
  const instruction = `${sceneBase} Style: ${productAnalysis.style || 'modern and clean'}. Target audience: ${productAnalysis.targetAudience || 'general consumers'}.`

  const imageBuffer = Buffer.from(imageBase64, 'base64')

  // Attempt 1 — OpenAI-compatible /v1/images/edits (multipart form)
  // qwen-image-edit conditions on the real product photo so the product stays recognizable
  try {
    const ext = mimeType.split('/')[1] || 'jpeg'
    const form = new FormData()
    form.append('model', IMAGE_EDIT_MODEL)
    form.append('prompt', instruction)
    form.append('n', '1')
    form.append('response_format', 'b64_json')
    form.append('image', new Blob([imageBuffer], { type: mimeType }), `product.${ext}`)

    const response = await axios.post(`${BASE_URL}/images/edits`, form, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 120000,
    })

    logUsage({ model: IMAGE_EDIT_MODEL, imagesGenerated: 1, mode: `image_${moduleSpec.id}`, success: true })

    const item = response.data?.data?.[0]
    if (item?.b64_json) return `data:image/jpeg;base64,${item.b64_json}`
    if (item?.url) {
      const dl = await axios.get(item.url, { responseType: 'arraybuffer', timeout: 30000 })
      return `data:image/jpeg;base64,${Buffer.from(dl.data).toString('base64')}`
    }
  } catch (editErr) {
    console.warn(`[nvidia] images/edits failed for ${moduleSpec.id} — trying chat/completions fallback:`, editErr.response?.data?.detail || editErr.message)
  }

  // Attempt 2 — multimodal chat/completions fallback
  // Some NVIDIA NIM image-edit models embed the output image in the chat response
  const response = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: IMAGE_EDIT_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
            { type: 'text', text: instruction },
          ],
        },
      ],
      max_tokens: 4096,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 120000,
    }
  )

  logUsage({ model: IMAGE_EDIT_MODEL, imagesGenerated: 1, mode: `image_${moduleSpec.id}`, success: true })

  const content = response.data.choices[0].message.content

  // data URI embedded directly in response text
  const dataUriMatch = content.match(/(data:image\/[a-zA-Z+]+;base64,[A-Za-z0-9+/=]+)/)
  if (dataUriMatch) return dataUriMatch[1]

  // Markdown image with data URI  ![alt](data:...)
  const mdDataMatch = content.match(/!\[.*?\]\((data:image\/[^)]+)\)/)
  if (mdDataMatch) return mdDataMatch[1]

  // Plain HTTPS image URL — download and re-encode
  const urlMatch = content.match(/https?:\/\/\S+\.(jpg|jpeg|png|webp)/i)
  if (urlMatch) {
    const dl = await axios.get(urlMatch[0], { responseType: 'arraybuffer', timeout: 30000 })
    return `data:image/jpeg;base64,${Buffer.from(dl.data).toString('base64')}`
  }

  throw new Error(
    `qwen-image-edit: neither /images/edits nor chat/completions returned a recognisable image.\n` +
    `Chat response preview (first 500 chars): ${content.substring(0, 500)}`
  )
}

// Smoke-test both NVIDIA keys and the HF image key
export async function testConnection() {
  const textKey = getApiKey()

  const response = await axios.post(
    `${BASE_URL}/chat/completions`,
    {
      model: COPY_MODEL,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
      max_tokens: 10,
    },
    {
      headers: { Authorization: `Bearer ${textKey}`, 'Content-Type': 'application/json' },
      timeout: 15000,
    }
  )
  const reply = response.data.choices[0].message.content.trim()

  return {
    textModel: reply,
    visionModel: VISION_MODEL,
    copyModel: COPY_MODEL,
    imageProvider: 'Together AI (FLUX.1-schnell)',
    togetherKeyLoaded: !!process.env.TOGETHER_API_KEY,
  }
}
