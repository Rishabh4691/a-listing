import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_DIR = path.join(__dirname, '../../../logs')
const LOG_FILE = path.join(LOG_DIR, 'usage.jsonl')

// Rough cost estimates per 1M tokens (USD) — update as NVIDIA pricing changes
const COST_PER_1M_TOKENS = {
  'qwen/qwen3.5-397b-a17b': { input: 0.35, output: 0.40 },
}
// Image models billed per image, not per token
const COST_PER_IMAGE = {
  'qwen/qwen-image-edit': 0.04,
}

function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true })
}

export function logUsage({ model, inputTokens = 0, outputTokens = 0, imagesGenerated = 0, mode, success }) {
  ensureLogDir()

  let estimatedCostUSD = 0
  if (COST_PER_1M_TOKENS[model]) {
    const { input, output } = COST_PER_1M_TOKENS[model]
    estimatedCostUSD = (inputTokens / 1_000_000) * input + (outputTokens / 1_000_000) * output
  }
  if (COST_PER_IMAGE[model]) {
    estimatedCostUSD += imagesGenerated * COST_PER_IMAGE[model]
  }

  const entry = {
    timestamp: new Date().toISOString(),
    model,
    mode,
    inputTokens,
    outputTokens,
    imagesGenerated,
    estimatedCostUSD: Number(estimatedCostUSD.toFixed(6)),
    success,
  }

  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n')
  } catch (err) {
    console.warn('Failed to write usage log:', err.message)
  }
  return entry
}

export function getUsageSummary() {
  ensureLogDir()
  if (!fs.existsSync(LOG_FILE)) {
    return { totalCalls: 0, totalEstimatedCostUSD: 0, recentEntries: [] }
  }

  const lines = fs.readFileSync(LOG_FILE, 'utf8').trim().split('\n').filter(Boolean)
  const entries = lines.map(l => {
    try { return JSON.parse(l) } catch { return null }
  }).filter(Boolean)

  const totalEstimatedCostUSD = entries.reduce((sum, e) => sum + (e.estimatedCostUSD || 0), 0)

  return {
    totalCalls: entries.length,
    totalEstimatedCostUSD: Number(totalEstimatedCostUSD.toFixed(4)),
    recentEntries: entries.slice(-10),
  }
}
