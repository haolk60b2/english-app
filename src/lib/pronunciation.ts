export function normalizeSpeech(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[’']/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

export function matchesSpokenWord(target: string, alternatives: string[]): boolean {
  const expected = normalizeSpeech(target);
  return !!expected && alternatives.some(text => normalizeSpeech(text) === expected);
}

// Text similarity is a recognition score, not an acoustic/IPA assessment.
export function scoreSpokenWord(target: string, transcript: string): number {
  const expected = normalizeSpeech(target);
  const heard = normalizeSpeech(transcript);
  if (!expected || !heard) return 0;
  if (expected === heard) return 100;

  let previous = Array.from({ length: heard.length + 1 }, (_, index) => index);
  for (let i = 1; i <= expected.length; i++) {
    const current = [i];
    for (let j = 1; j <= heard.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (expected[i - 1] === heard[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return Math.max(0, Math.min(99, Math.round((1 - previous[heard.length] / Math.max(expected.length, heard.length)) * 100)));
}
