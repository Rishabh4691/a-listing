// Patterns banned by Amazon A+ Content policy
const BANNED_PATTERNS = [
  // Price and monetary claims
  { pattern: /[\$£€₹¥]\s*\d+/g, label: 'price claim' },
  { pattern: /\d+\s*[\$£€₹¥]/g, label: 'price claim' },

  // Promotional language
  { pattern: /\b(on sale|flash sale|limited.?time|time.?sensitive|act now|order now)\b/gi, label: 'promotional language' },
  { pattern: /\b(discount|discounted|save \d+|% off|markdown|clearance)\b/gi, label: 'discount claim' },
  { pattern: /\b(free shipping|ships free|free delivery)\b/gi, label: 'shipping claim' },
  { pattern: /\b(best price|lowest price|price match|cheapest|unbeatable price)\b/gi, label: 'price comparison' },
  { pattern: /\b(promo|promotion|coupon|voucher|rebate)\b/gi, label: 'promotional language' },

  // Unverifiable superlatives
  { pattern: /\b(#1|number one|number 1)\b/gi, label: 'unverifiable ranking' },
  { pattern: /\b(best.?in.?class|top.?rated|highest.?rated|best.?selling)\b/gi, label: 'unverifiable superlative' },
  { pattern: /\b(award.?winning|prize.?winning)\b/gi, label: 'unverifiable award claim' },
  { pattern: /\b(guaranteed|money.?back|satisfaction guarantee)\b/gi, label: 'guarantee claim' },

  // Reviews and ratings
  { pattern: /\b\d[\s,]*star[s]?\b/gi, label: 'star rating mention' },
  { pattern: /\b(reviews?|ratings?|testimonials?)\b/gi, label: 'review mention' },
  { pattern: /\b(customers? (love|say|report|agree|recommend)|verified (purchase|buyer))\b/gi, label: 'customer review reference' },

  // Contact info and external links
  { pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, label: 'email address' },
  { pattern: /https?:\/\/\S+/gi, label: 'external URL' },
  { pattern: /www\.[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/gi, label: 'website reference' },
  { pattern: /\b\d{3}[\s.-]?\d{3}[\s.-]?\d{4}\b/g, label: 'phone number' },

  // Comparative claims
  { pattern: /\b(versus|better than|unlike|outperforms|superior to)\b/gi, label: 'competitor comparison' },
]

export function checkCompliance(text) {
  if (!text) return []
  const violations = []
  for (const { pattern, label } of BANNED_PATTERNS) {
    pattern.lastIndex = 0
    const match = pattern.exec(text)
    if (match) {
      violations.push({ label, matched: match[0] })
    }
  }
  return violations
}

export function checkAllModuleCopy(modules) {
  const results = {}
  for (const [moduleId, copy] of Object.entries(modules)) {
    if (!copy || typeof copy !== 'object') continue
    const allText = Object.values(copy).filter(Boolean).join(' ')
    results[moduleId] = checkCompliance(allText)
  }
  return results
}
