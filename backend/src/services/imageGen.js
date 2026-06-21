import sharp from 'sharp'
import { logUsage } from './costLogger.js'

// Compose the uploaded product photo into each module's exact canvas dimensions.
// No external API — instant, free, and shows the ACTUAL product (what Amazon wants).
//
// Layout strategy per module type:
//  - Large banners (header/banner/hero): product occupies 60-70% of height, centered,
//    rest of canvas filled with a clean background derived from the image.
//  - Square/grid modules: tight centered crop of the product.
//  - Feature/hotspot: full bleed with contain-fit and background fill.

async function getDominantBackground(imageBuffer) {
  // Sample the corners of the image — usually the background colour
  try {
    const { dominant } = await sharp(imageBuffer).stats()
    // Lighten towards white so the background stays clean and neutral
    return {
      r: Math.round(dominant.r * 0.3 + 245 * 0.7),
      g: Math.round(dominant.g * 0.3 + 245 * 0.7),
      b: Math.round(dominant.b * 0.3 + 245 * 0.7),
    }
  } catch {
    return { r: 245, g: 245, b: 245 }
  }
}

// For wide banners: product sized to fill 65% of canvas height, centered,
// background colour fills the rest.
async function composeBanner(imageBuffer, targetWidth, targetHeight, bg) {
  const productMaxH = Math.round(targetHeight * 0.75)
  const productMaxW = Math.round(targetWidth * 0.60)

  const product = await sharp(imageBuffer)
    .resize(productMaxW, productMaxH, { fit: 'inside', withoutEnlargement: false })
    .toBuffer({ resolveWithObject: true })

  return sharp({
    create: { width: targetWidth, height: targetHeight, channels: 3, background: bg },
  })
    .composite([{ input: product.data, gravity: 'center' }])
    .jpeg({ quality: 92, progressive: true })
    .toBuffer()
}

// For square / small grid tiles: product fills 85% of the canvas, centered on white.
async function composeSquare(imageBuffer, targetWidth, targetHeight, bg) {
  const pad = Math.round(Math.min(targetWidth, targetHeight) * 0.08)
  const maxDim = Math.min(targetWidth, targetHeight) - pad * 2

  const product = await sharp(imageBuffer)
    .resize(maxDim, maxDim, { fit: 'inside', withoutEnlargement: false })
    .toBuffer()

  return sharp({
    create: { width: targetWidth, height: targetHeight, channels: 3, background: bg },
  })
    .composite([{ input: product, gravity: 'center' }])
    .jpeg({ quality: 92, progressive: true })
    .toBuffer()
}

// For tall/portrait modules: product fills width at 80%, centered vertically.
async function composeTall(imageBuffer, targetWidth, targetHeight, bg) {
  const productMaxW = Math.round(targetWidth * 0.80)
  const productMaxH = Math.round(targetHeight * 0.80)

  const product = await sharp(imageBuffer)
    .resize(productMaxW, productMaxH, { fit: 'inside', withoutEnlargement: false })
    .toBuffer()

  return sharp({
    create: { width: targetWidth, height: targetHeight, channels: 3, background: bg },
  })
    .composite([{ input: product, gravity: 'center' }])
    .jpeg({ quality: 92, progressive: true })
    .toBuffer()
}

const WIDE_MODULES  = new Set(['header', 'banner', 'hero', 'carousel', 'brand_hero', 'feature_large', 'hotspot'])
const SQUARE_MODULES = new Set(['square_inset', 'grid_large', 'grid_small', 'brand_logo'])
const TALL_MODULES   = new Set(['brand_card'])

export async function generateImage({ moduleSpec, imageBase64, mimeType }) {
  const imageBuffer = Buffer.from(imageBase64, 'base64')
  const bg = await getDominantBackground(imageBuffer)
  const { id, width, height } = moduleSpec

  let resultBuffer
  if (SQUARE_MODULES.has(id)) {
    resultBuffer = await composeSquare(imageBuffer, width, height, bg)
  } else if (TALL_MODULES.has(id)) {
    resultBuffer = await composeTall(imageBuffer, width, height, bg)
  } else {
    resultBuffer = await composeBanner(imageBuffer, width, height, bg)
  }

  logUsage({ model: 'sharp/compose', imagesGenerated: 1, mode: `image_${id}`, success: true })
  return `data:image/jpeg;base64,${resultBuffer.toString('base64')}`
}
