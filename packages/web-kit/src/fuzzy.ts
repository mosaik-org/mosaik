/**
 * Scores how well `query` matches `text` as an in-order subsequence (like most editor
 * pickers): consecutive characters and word starts score higher, earlier matches win.
 * Returns `null` when not every query character is found.
 */
export const fuzzyScore = (query: string, text: string): number | null => {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return 0
  const haystack = text.toLowerCase()
  let score = 0
  let position = -1
  let previous = -2
  for (const char of needle) {
    if (char === " ") continue
    const index = haystack.indexOf(char, position + 1)
    if (index === -1) return null
    const wordStart = index === 0 || /[\s\-_/.:]/.test(haystack[index - 1] ?? "")
    score += index === previous + 1 ? 10 : wordStart ? 8 : 1
    if (position === -1) score -= Math.min(index, 10)
    previous = index
    position = index
  }
  // Prefer shorter texts when the match is equally good.
  return score - haystack.length / 100
}

/** Best score across a title and its keywords. */
export const bestScore = (query: string, texts: ReadonlyArray<string>): number | null =>
  texts.reduce<number | null>((best, text) => {
    const score = fuzzyScore(query, text)
    return score === null ? best : best === null ? score : Math.max(best, score)
  }, null)
