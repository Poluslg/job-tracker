import type { JobSourcePlatform } from '@job-ai/types';

export interface SelectorPack {
  platform: JobSourcePlatform;
  
  match: RegExp;
  title?: string[];
  company?: string[];
  location?: string[];
  description?: string[];
}

export const SELECTOR_PACKS: SelectorPack[] = [
  {
    platform: 'greenhouse',
    match: /(boards|job-boards)\.greenhouse\.io|greenhouse\.io\/embed/,
    title: ['.app-title', 'h1.section-header', '.job__title h1', 'h1'],
    company: ['.company-name', '.job__company', '[class*="company"]'],
    location: ['.location', '.job__location'],
    description: ['#content', '.job__description', '.content'],
  },
  {
    platform: 'lever',
    match: /jobs\.lever\.co/,
    title: ['.posting-headline h2', 'h2'],
    company: ['.main-header-logo img', '.posting-headline .sort-by-time'],
    location: ['.posting-categories .location', '.sort-by-time'],
    description: ['.section-wrapper.page-full-width', '.content', '[data-qa="job-description"]'],
  },
  {
    platform: 'ashby',
    match: /jobs\.ashbyhq\.com/,
    title: ['h1', '._title_ud4nd_34'],
    company: ['[class*="companyName"]', 'header a'],
    location: ['[class*="location"]'],
    description: ['._descriptionText_4fqrp_201', '[class*="description"]', 'main'],
  },
  {
    platform: 'workday',
    match: /myworkdayjobs\.com|workday\.com/,
    title: ['[data-automation-id="jobPostingHeader"]', 'h1'],
    company: ['[data-automation-id="company"]'],
    location: ['[data-automation-id="locations"]', '[data-automation-id="jobPostingLocation"]'],
    description: ['[data-automation-id="jobPostingDescription"]'],
  },
  {
    platform: 'linkedin',
    match: /linkedin\.com\/jobs/,
    title: ['.top-card-layout__title', '.job-details-jobs-unified-top-card__job-title', 'h1'],
    company: ['.topcard__org-name-link', '.job-details-jobs-unified-top-card__company-name'],
    location: ['.topcard__flavor--bullet', '.job-details-jobs-unified-top-card__bullet'],
    description: ['.description__text', '.jobs-description__content', '#job-details'],
  },
  {
    platform: 'indeed',
    match: /indeed\.com/,
    title: ['[data-testid="jobsearch-JobInfoHeader-title"]', '.jobsearch-JobInfoHeader-title', 'h1'],
    company: ['[data-testid="inlineHeader-companyName"]', '[data-company-name]'],
    location: ['[data-testid="inlineHeader-companyLocation"]', '[data-testid="job-location"]'],
    description: ['#jobDescriptionText', '.jobsearch-jobDescriptionText'],
  },
  {
    platform: 'smartrecruiters',
    match: /smartrecruiters\.com|jobs\.smartrecruiters\.com/,
    title: ['h1.job-title', 'h1'],
    company: ['.company-name', '[itemprop="hiringOrganization"]'],
    location: ['[itemprop="jobLocation"]', '.job-location'],
    description: ['.job-sections', '[itemprop="description"]'],
  },
  {
    platform: 'wellfound',
    match: /wellfound\.com|angel\.co/,
    title: ['h1', '[class*="job-title"]'],
    company: ['[class*="company-name"]', 'h2 a'],
    location: ['[class*="location"]'],
    description: ['[class*="job-description"]', '#job-description', 'main'],
  },
  {
    platform: 'workable',
    match: /workable\.com|apply\.workable\.com/,
    title: ['h1', '[data-ui="job-title"]'],
    company: ['[data-ui="company-name"]'],
    location: ['[data-ui="job-location"]'],
    description: ['[data-ui="job-description"]', '.section--text'],
  },
  {
    platform: 'bamboohr',
    match: /bamboohr\.com\/(careers|jobs)/,
    title: ['h1', '.ResAts__jobTitle'],
    company: ['.ResAts__companyName'],
    location: ['.ResAts__jobLocation'],
    description: ['#jobDescriptionText', '.ResAts__jobDescription', 'main'],
  },
  {
    platform: 'jobvite',
    match: /jobvite\.com/,
    title: ['.jv-header', 'h1'],
    company: ['.jv-company-name'],
    location: ['.jv-job-detail-meta'],
    description: ['.jv-job-detail-description'],
  },
  {
    platform: 'icims',
    match: /icims\.com/,
    title: ['.iCIMS_Header', 'h1'],
    company: ['.iCIMS_JobHeaderCompany'],
    location: ['.iCIMS_JobHeaderField'],
    description: ['.iCIMS_JobContent', '#jobDescription'],
  },
  {
    platform: 'taleo',
    match: /taleo\.net/,
    title: ['.requisitionDescriptionInterface .title', 'h1'],
    description: ['.requisitionDescriptionInterface'],
  },
];

export function detectPlatform(url: string): SelectorPack | null {
  return SELECTOR_PACKS.find((p) => p.match.test(url)) ?? null;
}

export const JOB_URL_HINTS =
  /\/(jobs?|careers?|positions?|openings?|vacanc(y|ies)|opportunit(y|ies)|apply|requisition)([/?#-]|$)/i;

export function urlLooksLikeJob(url: string): boolean {
  return JOB_URL_HINTS.test(url) || detectPlatform(url) !== null;
}
