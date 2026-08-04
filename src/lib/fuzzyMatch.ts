// Classic edit-distance, used to catch near-miss name spellings for
// conflict-of-interest checks ("Jon Smith" vs "John Smith") that a plain
// SQL LIKE substring match would miss entirely.
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let prevRow = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const currentRow = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow.push(Math.min(prevRow[j] + 1, currentRow[j - 1] + 1, prevRow[j - 1] + cost));
    }
    prevRow = currentRow;
  }
  return prevRow[b.length];
}

// Similarity as a 0-1 fraction of the longer string's length — easier to
// threshold consistently across names of different lengths than a raw
// edit-distance count would be.
export function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) => s.trim().toLowerCase().replace(/[.,]/g, "");
  const normA = normalize(a);
  const normB = normalize(b);
  if (!normA || !normB) return 0;
  const maxLen = Math.max(normA.length, normB.length);
  return 1 - levenshteinDistance(normA, normB) / maxLen;
}
