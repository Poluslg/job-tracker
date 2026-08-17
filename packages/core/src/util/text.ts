export function normalize(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, '-')
    .replace(/ /g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function lower(input: string): string {
  return normalize(input).toLowerCase();
}

export function toLines(input: string): string[] {
  return input
    .split(/\r?\n+/)
    .map((l) => l.replace(/^\s*[•·▪◦*\-–—]\s*/, '').trim())
    .filter((l) => l.length > 0);
}

export function toSentences(input: string): string[] {
  return input
    .split(/(?<=[.!?;])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 2);
}

const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','in','is','it','its','of','on',
  'or','that','the','to','was','were','will','with','you','your','our','we','they','their','this',
  'these','those','but','not','can','able','who','what','which','than','then','them','there','also',
  'all','any','into','over','under','more','most','other','such','some','only','own','same','so',
  'too','very','just','about','across','after','again','against','because','been','before','being',
  'below','between','both','during','each','few','further','how','if','no','nor','once','out','up',
  'while','why','work','working','role','team','teams','job','position','company','experience',
  'years','year','including','include','includes','required','requirements','preferred','plus',
  'strong','excellent','good','great','ability','skills','skill','knowledge','understanding','new',
]);

export function isStopword(w: string): boolean {
  return STOPWORDS.has(w);
}

export function tokenize(input: string): string[] {
  return lower(input)
    .replace(/[^a-z0-9+#./ -]/g, ' ')
    .split(/[\s/]+/)
    .map((t) => t.replace(/^[-.]+|[-.]+$/g, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

export function ngrams(tokens: string[], maxN = 3): string[] {
  const out: string[] = [];
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i + n <= tokens.length; i++) {
      out.push(tokens.slice(i, i + n).join(' '));
    }
  }
  return out;
}

export function countBy(items: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const i of items) m.set(i, (m.get(i) ?? 0) + 1);
  return m;
}

export function termPattern(term: string): RegExp {
  const escaped = term.toLowerCase().trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9+#.])${escaped}(?![a-z0-9+#])(?!\\.[a-z0-9])`, 'gi');
}

export function containsTerm(haystackLower: string, term: string): boolean {
  const t = term.trim();
  if (!t) return false;
  return termPattern(t).test(haystackLower);
}

export function countTerm(haystackLower: string, term: string): number {
  const t = term.trim();
  if (!t) return 0;
  return (haystackLower.match(termPattern(t)) ?? []).length;
}

export function findEvidence(text: string, term: string, limit = 2): string[] {
  const out: string[] = [];
  for (const s of toSentences(text)) {
    if (containsTerm(s.toLowerCase(), term)) {
      out.push(s.length > 240 ? `${s.slice(0, 237)}…` : s);
      if (out.length >= limit) break;
    }
  }
  return out;
}

export function truncateWords(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > maxChars * 0.8 ? lastSpace : maxChars)}…`;
}

export function titleCase(input: string): string {
  return input.replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

export function clamp(n: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, n));
}

export function round(n: number, dp = 0): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
