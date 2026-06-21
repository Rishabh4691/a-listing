import axios from 'axios'

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has',
  'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may',
  'might', 'can', 'this', 'that', 'these', 'those', 'it', 'its', 'from',
  'by', 'about', 'as', 'into', 'through', 'during', 'including', 'until',
  'against', 'among', 'throughout', 'despite', 'towards', 'upon', 'concerning',
])

function extractKeywordsFromText(snippets) {
  const wordFreq = {}
  const allText = snippets.join(' ').toLowerCase()
  const words = allText.match(/\b[a-z]{3,}\b/g) || []

  for (const word of words) {
    if (!STOP_WORDS.has(word)) {
      wordFreq[word] = (wordFreq[word] || 0) + 1
    }
  }

  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word)
}

// Uses DuckDuckGo instant-answers API (snippet-only, no Amazon scraping)
export async function extractKeywords(productName, userKeywords) {
  if (userKeywords && userKeywords.trim()) {
    return userKeywords
      .split(/[\n,;]+/)
      .map(k => k.trim())
      .filter(Boolean)
      .slice(0, 8)
  }

  if (!productName) return []

  try {
    const response = await axios.get('https://api.duckduckgo.com/', {
      params: {
        q: `"${productName}" amazon.in`,
        format: 'json',
        no_html: 1,
        skip_disambig: 1,
      },
      timeout: 5000,
    })

    const snippets = []
    if (response.data.Abstract) snippets.push(response.data.Abstract)
    if (Array.isArray(response.data.RelatedTopics)) {
      response.data.RelatedTopics
        .filter(t => t.Text)
        .slice(0, 6)
        .forEach(t => snippets.push(t.Text))
    }

    if (snippets.length > 0) {
      return extractKeywordsFromText(snippets)
    }
  } catch (err) {
    console.warn('Keyword auto-extract failed, continuing without:', err.message)
  }

  return []
}
