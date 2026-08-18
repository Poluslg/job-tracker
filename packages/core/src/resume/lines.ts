const MONTH =
  "(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t)?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";

const DATE_POINT = `(?:${MONTH}\\.?\\s*'?\\d{2,4}|\\d{1,2}[/-]\\d{4}|\\d{4}[-/]\\d{1,2}|\\d{4})`;
const DATE_END = `(?:${DATE_POINT}|present|current|now|ongoing|date)`;

const RANGE_SEP = `\\s*(?:-|–|—|‐|‑|~|to|until|through|till)\\s*`;

export const DATE_RANGE_RE = new RegExp(
  `(${DATE_POINT})${RANGE_SEP}(${DATE_END})`,
  "i",
);
const SINGLE_DATE_RE = new RegExp(`\\b(${DATE_POINT})\\b`, "i");

export interface DateRange {
  start: string;
  end: string;
  current: boolean;
  rest: string;
  found: boolean;
}

export function extractDateRange(line: string): DateRange {
  const range = line.match(DATE_RANGE_RE);

  if (range) {
    const end = (range[2] ?? "").trim();
    const isCurrent = /present|current|now|ongoing|date/i.test(end);
    return {
      start: (range[1] ?? "").trim(),
      end: isCurrent ? "" : end,
      current: isCurrent,
      rest: cleanResidue(line.replace(range[0], " ")),
      found: true,
    };
  }

  const single = line.match(SINGLE_DATE_RE);
  if (single) {
    return {
      start: "",
      end: (single[1] ?? "").trim(),
      current: false,
      rest: cleanResidue(line.replace(single[0], " ")),
      found: true,
    };
  }

  return {
    start: "",
    end: "",
    current: false,
    rest: line.trim(),
    found: false,
  };
}

function cleanResidue(text: string): string {
  return text
    .replace(/\(\s*\)|\[\s*\]|\{\s*\}/g, " ")
    .replace(/\(\s*(?=[,|—–\-·•]*\s*$)/g, " ")
    .replace(/[|·•,]\s*$/g, " ")
    .replace(/\s*[-–—|·•]\s*$/g, " ")
    .replace(/^\s*[-–—|·•,]\s*/g, " ")
    .replace(/\s{2,}/g, (m) => (m.length >= 3 ? m : " "))
    .trim();
}

export function splitSegments(line: string): string[] {
  return line
    .split(/\s{3,}|\s*[|•·]\s*|\s+[—–]\s+|\s+-\s+|\s+at\s+/i)
    .map((part) => part.replace(/^[\s,;:–—-]+|[\s,;:–—-]+$/g, "").trim())
    .filter((part) => part.length > 0);
}

const TITLE_WORDS =
  /\b(engineer|developer|designer|architect|manager|director|analyst|scientist|consultant|specialist|administrator|coordinator|officer|lead|intern|associate|assistant|president|founder|owner|head|chief|principal|staff|senior|junior|programmer|researcher|strategist|marketer|writer|editor|producer|recruiter|accountant|attorney|nurse|teacher|instructor|technician|supervisor|executive|partner|advisor|planner|operator|dev\b|sre|devops|qa|pm\b|cto|ceo|cfo|coo|vp\b)/i;

const COMPANY_WORDS =
  /\b(inc|llc|ltd|limited|corp|corporation|company|co|gmbh|ag|bv|nv|plc|s\.?a\.?|pty|labs?|technologies|technology|systems|solutions|software|studios?|group|holdings|partners|ventures|consulting|agency|media|digital|health|bank|university|institute|foundation|networks?|interactive|collective|works?)\b/i;

export function looksLikeTitle(segment: string): boolean {
  return TITLE_WORDS.test(segment);
}

export function looksLikeCompany(segment: string): boolean {
  return COMPANY_WORDS.test(segment);
}

export function looksLikeLocation(
  segment: string,
  isKnownSkill?: (term: string) => boolean,
): boolean {
  const s = segment.trim();
  if (/^(remote|hybrid|on-?site|worldwide|anywhere)$/i.test(s)) return true;
  if (s.length > 46 || s.split(/\s+/).length > 5) return false;
  if (!/^[A-Z][\w.'-]*(?:[\s-][A-Z]?[\w.'-]+)*,\s*[A-Z][\w.]{1,20}$/.test(s))
    return false;
  if (looksLikeTitle(s) || looksLikeCompany(s)) return false;

  if (isKnownSkill) {
    const parts = s.split(",").map((p) => p.trim());
    if (parts.some((p) => isKnownSkill(p))) return false;
  }
  return true;
}

export interface HeaderParts {
  title: string;
  company: string;
  location: string;
}

export function classifyHeaderSegments(
  segments: string[],
  isKnownSkill?: (term: string) => boolean,
): HeaderParts {
  const parts = segments.filter((s) => s.length > 1 && s.length < 120);
  if (parts.length === 0) return { title: "", company: "", location: "" };

  let location = "";
  const remaining: string[] = [];
  for (const part of parts) {
    if (!location && looksLikeLocation(part, isKnownSkill)) location = part;
    else remaining.push(part);
  }

  if (remaining.length === 0) return { title: "", company: "", location };
  if (remaining.length === 1) {
    const only = remaining[0]!;
    return looksLikeTitle(only)
      ? { title: only, company: "", location }
      : { title: "", company: only, location };
  }

  const titleIdx = remaining.findIndex(looksLikeTitle);
  const companyIdx = remaining.findIndex(
    (s, i) => i !== titleIdx && looksLikeCompany(s),
  );

  if (titleIdx >= 0) {
    const company =
      companyIdx >= 0
        ? remaining[companyIdx]!
        : (remaining.find((_, i) => i !== titleIdx) ?? "");
    return { title: remaining[titleIdx]!, company, location };
  }

  if (companyIdx >= 0) {
    const title = remaining.find((_, i) => i !== companyIdx) ?? "";
    return { title, company: remaining[companyIdx]!, location };
  }

  return { title: remaining[0]!, company: remaining[1] ?? "", location };
}

export function isBulletLine(line: string): boolean {
  return /^\s*[•·▪◦*+\-–—►▸●○■✓✦]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line);
}

export function stripBulletMarker(line: string): string {
  return line
    .replace(/^\s*[•·▪◦*+\-–—►▸●○■✓✦]\s+/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .trim();
}

export function looksLikeHeading(line: string): boolean {
  const s = line.trim().replace(/[:：]\s*$/, "");
  if (s.length < 3 || s.length > 42) return false;
  if (isBulletLine(s)) return false;
  if (/[.!?;]$/.test(s)) return false;
  if (/[@]|https?:\/\//.test(s)) return false;
  if (DATE_RANGE_RE.test(s)) return false;

  const letters = s.replace(/[^A-Za-z]/g, "");
  if (letters.length < 3) return false;

  const isAllCaps = letters === letters.toUpperCase();
  const words = s.split(/\s+/);
  return isAllCaps && words.length <= 6;
}
