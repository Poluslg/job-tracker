import type {
  EmploymentType,
  ExtractionSource,
  JobExtractionResult,
  JobPosting,
  SalaryInfo,
  WorkArrangement,
} from '@job-ai/types';
import { nowIso } from '@job-ai/types';
import { detectPlatform, urlLooksLikeJob } from './platforms.ts';
import { extractRequirements } from './requirements.ts';
import { stableHash } from '../util/id.ts';
import { lower, normalize, truncateWords } from '../util/text.ts';

export const MAX_DESCRIPTION_CHARS = 60_000;

export const MIN_DETECTION_CONFIDENCE = 0.45;

type Partial2<T> = { [K in keyof T]?: T[K] };
type Draft = Partial2<JobPosting> & { fieldSources: Record<string, ExtractionSource> };

const NOISE_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'NAV', 'FOOTER', 'HEADER', 'FORM', 'SVG', 'BUTTON', 'IFRAME']);

function visibleText(el: Element): string {
  const clone = el.cloneNode(true) as Element;
  for (const node of [...clone.querySelectorAll('*')]) {
    if (NOISE_TAGS.has(node.tagName)) node.remove();
  }
  
  for (const br of [...clone.querySelectorAll('br')]) br.replaceWith('\n');
  for (const li of [...clone.querySelectorAll('li')]) {
    li.prepend(li.ownerDocument.createTextNode('\n• '));
  }
  for (const block of [...clone.querySelectorAll('p,div,h1,h2,h3,h4,h5,h6,tr')]) {
    block.append(block.ownerDocument.createTextNode('\n'));
  }
  return (clone.textContent ?? '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

function firstText(doc: Document, selectors: string[] | undefined): string {
  if (!selectors) return '';
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      const text = el ? normalize(el.textContent ?? '') : '';
      if (text && text.length < 200) return text;
      if (text) return truncateWords(text, 200);
    } catch {
      
    }
  }
  return '';
}

interface JsonLdJob {
  '@type'?: string | string[];
  title?: string;
  description?: string;
  datePosted?: string;
  employmentType?: string | string[];
  identifier?: unknown;
  hiringOrganization?: { name?: string } | string;
  jobLocation?: unknown;
  jobLocationType?: string;
  baseSalary?: { currency?: string; value?: { minValue?: number; maxValue?: number; unitText?: string } };
}

function collectJsonLd(doc: Document): JsonLdJob[] {
  const out: JsonLdJob[] = [];
  for (const script of [...doc.querySelectorAll('script[type="application/ld+json"]')]) {
    try {
      const parsed: unknown = JSON.parse(script.textContent ?? '');
      const queue: unknown[] = Array.isArray(parsed) ? [...parsed] : [parsed];
      while (queue.length) {
        const node = queue.shift();
        if (!node || typeof node !== 'object') continue;
        const obj = node as Record<string, unknown>;
        if (Array.isArray(obj['@graph'])) queue.push(...(obj['@graph'] as unknown[]));
        const type = obj['@type'];
        const isJob = Array.isArray(type) ? type.includes('JobPosting') : type === 'JobPosting';
        if (isJob) out.push(obj as JsonLdJob);
      }
    } catch {
      
    }
  }
  return out;
}

function htmlToText(html: string): string {
  
  if (!/<[a-z][\s\S]*>/i.test(html)) return html;
  if (typeof DOMParser === 'undefined') return html.replace(/<[^>]+>/g, ' ');
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return visibleText(doc.body);
}

function locationOf(node: unknown): string {
  if (!node) return '';
  const first = Array.isArray(node) ? node[0] : node;
  if (typeof first === 'string') return first;
  if (typeof first !== 'object') return '';
  const addr = (first as Record<string, unknown>)['address'];
  if (typeof addr === 'string') return addr;
  if (addr && typeof addr === 'object') {
    const a = addr as Record<string, unknown>;
    return [a['addressLocality'], a['addressRegion'], a['addressCountry']]
      .filter((v): v is string => typeof v === 'string')
      .join(', ');
  }
  return '';
}

function fromJsonLd(job: JsonLdJob): Draft {
  const draft: Draft = { fieldSources: {} };
  const set = <K extends keyof JobPosting>(key: K, value: JobPosting[K] | undefined, truthy = true) => {
    if (value === undefined || (truthy && !value)) return;
    (draft as Record<string, unknown>)[key as string] = value;
    draft.fieldSources[key as string] = 'structured-data';
  };

  set('title', job.title ? normalize(job.title) : undefined);
  const org = typeof job.hiringOrganization === 'string' ? job.hiringOrganization : job.hiringOrganization?.name;
  set('company', org ? normalize(org) : undefined);
  set('location', locationOf(job.jobLocation));
  set('description', job.description ? htmlToText(job.description) : undefined);
  set('postedAt', job.datePosted);
  set('employmentType', normalizeEmploymentType(job.employmentType));
  if (job.jobLocationType && /telecommute|remote/i.test(String(job.jobLocationType))) {
    set('arrangement', 'remote' as WorkArrangement);
  }
  if (typeof job.identifier === 'string') set('externalId', job.identifier);
  else if (job.identifier && typeof job.identifier === 'object') {
    const v = (job.identifier as Record<string, unknown>)['value'];
    if (typeof v === 'string' || typeof v === 'number') set('externalId', String(v));
  }
  if (job.baseSalary?.value) {
    const v = job.baseSalary.value;
    set('salary', {
      min: v.minValue ?? null,
      max: v.maxValue ?? null,
      currency: job.baseSalary.currency ?? '',
      period: normalizeSalaryPeriod(v.unitText),
      raw: '',
    } as SalaryInfo);
  }
  return draft;
}

function normalizeEmploymentType(input: string | string[] | undefined): EmploymentType | undefined {
  if (!input) return undefined;
  const v = lower(Array.isArray(input) ? (input[0] ?? '') : input).replace(/[_\s]/g, '-');
  if (v.includes('full')) return 'full-time';
  if (v.includes('part')) return 'part-time';
  if (v.includes('contract') || v.includes('contractor')) return 'contract';
  if (v.includes('intern')) return 'internship';
  if (v.includes('temp')) return 'temporary';
  return undefined;
}

function normalizeSalaryPeriod(unit: string | undefined): SalaryInfo['period'] {
  const v = lower(unit ?? '');
  if (v.startsWith('hour')) return 'hour';
  if (v.startsWith('day')) return 'day';
  if (v.startsWith('month')) return 'month';
  if (v.startsWith('year') || v.startsWith('annual')) return 'year';
  return 'unknown';
}

const JOB_VOCAB =
  /\b(responsibilities|requirements|qualifications|what you'?ll do|about the role|we are looking for|preferred|nice to have|benefits|you will|experience with|proficien|familiar with)\b/gi;

interface Candidate {
  el: Element;
  text: string;
  score: number;
}

function heuristicDescription(doc: Document): Candidate | null {
  const roots = [...doc.querySelectorAll('main, article, section, div, [role="main"]')];
  let best: Candidate | null = null;

  for (const el of roots) {
    if (NOISE_TAGS.has(el.tagName)) continue;
    const text = visibleText(el);
    if (text.length < 400 || text.length > MAX_DESCRIPTION_CHARS * 2) continue;

    const vocabHits = (text.match(JOB_VOCAB) ?? []).length;
    if (vocabHits === 0) continue;

    const listItems = el.querySelectorAll('li').length;
    const links = el.querySelectorAll('a').length;
    
    const linkPenalty = links / Math.max(1, text.length / 400);

    const score =
      vocabHits * 12 +
      Math.min(listItems, 40) * 2 +
      Math.min(text.length / 300, 30) -
      linkPenalty * 8;

    if (!best || score > best.score) best = { el, text, score };
  }

  if (best) {
    for (const child of [...best.el.querySelectorAll('*')]) {
      const t = visibleText(child);
      if (t.length > best.text.length * 0.85 && t.length < best.text.length) {
        best = { el: child, text: t, score: best.score };
      }
    }
  }
  return best;
}

function guessCompany(doc: Document, url: string): string {
  const metaSelectors = [
    'meta[property="og:site_name"]',
    'meta[name="application-name"]',
    'meta[property="og:title"]',
  ];
  for (const sel of metaSelectors) {
    const content = doc.querySelector(sel)?.getAttribute('content') ?? '';
    if (!content) continue;
    if (sel.includes('og:title')) {
      
      const m = content.match(/\s(?:at|@|\||-|–)\s+([^|\-–]{2,60})$/);
      if (m?.[1]) return normalize(m[1]);
      continue;
    }
    return normalize(content);
  }
  try {
    const host = new URL(url).hostname.replace(/^www\./, '');
    const parts = host.split('.');
    
    const pack = detectPlatform(url);
    if (pack) {
      const seg = new URL(url).pathname.split('/').filter(Boolean)[0];
      if (seg && seg.length < 40) return normalize(seg.replace(/[-_]/g, ' '));
    }
    const base = parts.length > 2 ? parts[parts.length - 2] : parts[0];
    return base ? normalize(base.replace(/[-_]/g, ' ')) : '';
  } catch {
    return '';
  }
}

function guessTitle(doc: Document): string {
  const h1 = doc.querySelector('h1');
  const h1Text = h1 ? normalize(h1.textContent ?? '') : '';
  if (h1Text && h1Text.length >= 3 && h1Text.length <= 120) return h1Text;

  const og = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ?? '';
  if (og) return normalize(og.split(/\s+[|\-–]\s+/)[0] ?? og).slice(0, 120);

  return normalize(doc.title.split(/\s+[|\-–]\s+/)[0] ?? '').slice(0, 120);
}

const SALARY_RE =
  /(?:[$€£₹]\s?\d[\d,.]*\s*(?:k|K)?)(?:\s*(?:-|–|to)\s*(?:[$€£₹]\s?)?\d[\d,.]*\s*(?:k|K)?)?(?:\s*(?:per|\/)\s*(?:hour|hr|year|yr|annum|month|mo))?/;

function guessSalary(text: string): SalaryInfo {
  const m = text.match(SALARY_RE);
  if (!m) return { min: null, max: null, currency: '', period: 'unknown', raw: '' };
  const raw = m[0].trim();
  const nums = [...raw.matchAll(/\d[\d,.]*\s*(k|K)?/g)].map((n) => {
    const value = Number(n[0].replace(/[,\sk K]/g, ''));
    return n[1] ? value * 1000 : value;
  });
  const currency = raw.match(/[$€£₹]/)?.[0] ?? '';
  const period = /hour|hr/i.test(raw) ? 'hour' : /month|mo\b/i.test(raw) ? 'month' : /year|yr|annum/i.test(raw) ? 'year' : 'unknown';
  return {
    min: nums[0] ?? null,
    max: nums[1] ?? null,
    currency,
    period,
    raw,
  };
}

function guessArrangement(text: string): WorkArrangement {
  const t = lower(text.slice(0, 4000));
  if (/\bhybrid\b/.test(t)) return 'hybrid';
  if (/\b(fully remote|remote[- ]first|100% remote|work from home|remote)\b/.test(t)) return 'remote';
  if (/\b(on[- ]?site|in[- ]?office|in person)\b/.test(t)) return 'onsite';
  return 'unknown';
}

function guessEmploymentType(text: string): EmploymentType {
  const t = lower(text.slice(0, 6000));
  if (/\bintern(ship)?\b/.test(t)) return 'internship';
  if (/\b(contract|contractor|freelance|c2c)\b/.test(t)) return 'contract';
  if (/\bpart[- ]time\b/.test(t)) return 'part-time';
  if (/\btemporary\b/.test(t)) return 'temporary';
  if (/\bfull[- ]time\b/.test(t)) return 'full-time';
  return 'unknown';
}

function mergeDraft(base: Draft, incoming: Draft): Draft {
  const out: Draft = { ...base, fieldSources: { ...base.fieldSources } };
  for (const [key, value] of Object.entries(incoming)) {
    if (key === 'fieldSources') continue;
    const current = (out as Record<string, unknown>)[key];
    const isEmpty = current === undefined || current === '' || current === null;
    if (isEmpty && value !== undefined && value !== '' && value !== null) {
      (out as Record<string, unknown>)[key] = value;
      const src = incoming.fieldSources[key];
      if (src) out.fieldSources[key] = src;
    }
  }
  return out;
}

export function extractJobFromDocument(doc: Document, url: string): JobExtractionResult {
  const strategies: string[] = [];
  let draft: Draft = { fieldSources: {} };

  const jsonLd = collectJsonLd(doc);
  if (jsonLd.length) {
    strategies.push('structured-data');
    
    const best = jsonLd.sort((a, b) => (b.description?.length ?? 0) - (a.description?.length ?? 0))[0]!;
    draft = mergeDraft(draft, fromJsonLd(best));
  }

  const pack = detectPlatform(url);
  if (pack) {
    strategies.push(`selectors:${pack.platform}`);
    const packDraft: Draft = { fieldSources: {} };
    const assign = (key: 'title' | 'company' | 'location', value: string) => {
      if (!value) return;
      packDraft[key] = value;
      packDraft.fieldSources[key] = 'known-selector';
    };
    assign('title', firstText(doc, pack.title));
    assign('company', firstText(doc, pack.company));
    assign('location', firstText(doc, pack.location));
    for (const sel of pack.description ?? []) {
      const el = doc.querySelector(sel);
      const text = el ? visibleText(el) : '';
      if (text.length > 300) {
        packDraft.description = text;
        packDraft.fieldSources['description'] = 'known-selector';
        break;
      }
    }
    draft = mergeDraft(draft, packDraft);
  }

  if (!draft.description) {
    const semantic = doc.querySelector('[itemprop="description"], article, main, [role="main"]');
    const text = semantic ? visibleText(semantic) : '';
    if (text.length > 400) {
      strategies.push('semantic-html');
      draft.description = text;
      draft.fieldSources['description'] = 'semantic-html';
    }
  }

  if (!draft.description) {
    const candidate = heuristicDescription(doc);
    if (candidate) {
      strategies.push('heuristic');
      draft.description = candidate.text;
      draft.fieldSources['description'] = 'heuristic';
    }
  }

  if (!draft.title) {
    draft.title = guessTitle(doc);
    draft.fieldSources['title'] = 'heuristic';
  }
  if (!draft.company) {
    draft.company = guessCompany(doc, url);
    draft.fieldSources['company'] = 'heuristic';
  }

  const description = truncateWords(draft.description ?? '', MAX_DESCRIPTION_CHARS);

  if (!draft.location) {
    const locMeta = doc.querySelector('[itemprop="jobLocation"], [class*="location" i]');
    const loc = locMeta ? normalize(locMeta.textContent ?? '') : '';
    if (loc && loc.length < 120) {
      draft.location = loc;
      draft.fieldSources['location'] = 'heuristic';
    }
  }
  if (!draft.salary?.raw) {
    const salary = guessSalary(description);
    if (salary.raw) {
      draft.salary = salary;
      draft.fieldSources['salary'] = 'heuristic';
    }
  }
  if (!draft.arrangement || draft.arrangement === 'unknown') {
    draft.arrangement = guessArrangement(`${draft.location ?? ''} ${description}`);
  }
  if (!draft.employmentType || draft.employmentType === 'unknown') {
    draft.employmentType = guessEmploymentType(description);
  }

  const confidence = scoreConfidence({
    description,
    title: draft.title ?? '',
    company: draft.company ?? '',
    usedStructuredData: strategies.includes('structured-data'),
    usedSelectors: !!pack,
    urlLooksLikeJob: urlLooksLikeJob(url),
  });

  const primarySource: ExtractionSource =
    (draft.fieldSources['description'] as ExtractionSource | undefined) ?? 'heuristic';

  const job: Partial<JobPosting> = {
    ...draft,
    description,
    requirements: description ? extractRequirements(description) : [],
    url,
    platform: pack?.platform ?? 'generic',
    source: primarySource,
    capturedAt: nowIso(),
    fingerprint: fingerprintFor(draft.company ?? '', draft.title ?? '', description),
  };

  return {
    ok: confidence >= MIN_DETECTION_CONFIDENCE,
    job,
    confidence,
    strategiesTried: strategies,
    reason:
      confidence >= MIN_DETECTION_CONFIDENCE
        ? ''
        : description.length < 400
          ? 'Could not find a job description on this page.'
          : 'Found text but could not confirm it is a job posting.',
  };
}

interface ConfidenceInput {
  description: string;
  title: string;
  company: string;
  usedStructuredData: boolean;
  usedSelectors: boolean;
  urlLooksLikeJob: boolean;
}

export function scoreConfidence(input: ConfidenceInput): number {
  let score = 0;
  if (input.usedStructuredData) score += 0.45;
  if (input.usedSelectors) score += 0.2;
  if (input.urlLooksLikeJob) score += 0.1;

  const len = input.description.length;
  if (len >= 2500) score += 0.3;
  else if (len >= 1200) score += 0.22;
  else if (len >= 600) score += 0.14;
  else if (len >= 300) score += 0.05;

  const vocabHits = (input.description.match(JOB_VOCAB) ?? []).length;
  score += Math.min(vocabHits, 4) * 0.05;

  if (input.title) score += 0.05;
  if (input.company) score += 0.05;
  if (len < 300) score -= 0.4;

  return Math.max(0, Math.min(1, Number(score.toFixed(2))));
}

export function fingerprintFor(company: string, title: string, description: string): string {
  return stableHash(`${lower(company)}|${lower(title)}|${lower(description).slice(0, 2000)}`);
}

export function extractFromSelection(doc: Document, url: string, selectedText: string): JobExtractionResult {
  const description = truncateWords(selectedText.trim(), MAX_DESCRIPTION_CHARS);
  const title = guessTitle(doc);
  const company = guessCompany(doc, url);
  const pack = detectPlatform(url);

  return {
    ok: description.length > 100,
    job: {
      title,
      company,
      description,
      requirements: extractRequirements(description),
      url,
      platform: pack?.platform ?? 'generic',
      source: 'manual',
      arrangement: guessArrangement(description),
      employmentType: guessEmploymentType(description),
      salary: guessSalary(description),
      capturedAt: nowIso(),
      fingerprint: fingerprintFor(company, title, description),
      fieldSources: { description: 'manual', title: 'heuristic', company: 'heuristic' },
    },
    confidence: description.length > 100 ? 0.9 : 0.2,
    strategiesTried: ['manual'],
    reason: description.length > 100 ? '' : 'The selected text was too short to analyze.',
  };
}
