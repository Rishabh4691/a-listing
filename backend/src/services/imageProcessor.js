import sharp from 'sharp'

export async function resizeToSpec(imageData, targetWidth, targetHeight, maxFileSizeBytes) {
  let inputBuffer

  if (typeof imageData === 'string') {
    if (imageData.startsWith('data:')) {
      const b64 = imageData.split(',')[1]
      inputBuffer = Buffer.from(b64, 'base64')
    } else {
      throw new Error('Unsupported image data format — expected Buffer or data URI')
    }
  } else if (Buffer.isBuffer(imageData)) {
    inputBuffer = imageData
  } else {
    throw new Error('Unsupported image data type')
  }

  // Resize with cover fit (center crop to fill exact dimensions), convert to sRGB
  const base = sharp(inputBuffer)
    .resize(targetWidth, targetHeight, { fit: 'cover', position: 'center' })
    .toColorspace('srgb')

  // Progressive JPEG; reduce quality until under size limit
  let quality = 90
  let result
  do {
    result = await base.clone().jpeg({ quality, progressive: true }).toBuffer()
    quality -= 10
  } while (maxFileSizeBytes && result.length > maxFileSizeBytes && quality >= 50)

  return {
    buffer: result,
    base64: result.toString('base64'),
    mimeType: 'image/jpeg',
    width: targetWidth,
    height: targetHeight,
    sizeBytes: result.length,
  }
}
