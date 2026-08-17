import type { JobPosting, Resume } from '@job-ai/types';
import { nowIso } from '@job-ai/types';
import { parseResumeText } from '../resume/parse.ts';
import { extractRequirements } from '../extraction/requirements.ts';
import { fingerprintFor } from '../extraction/dom.ts';
import { createId } from '../util/id.ts';

export const DEMO_MARKER = '__demo__';

export const SAMPLE_RESUME_TEXT = `Alex Rivera
alex.rivera@example.com | (555) 014-2280 | Austin, TX
linkedin.com/in/alexrivera | github.com/alexrivera

SUMMARY
Frontend-leaning full-stack engineer with 6 years building product interfaces in React and
TypeScript. Comfortable owning a feature from design review through rollout and on-call.

SKILLS
TypeScript, JavaScript, React, Next.js, Node.js, GraphQL, PostgreSQL, Tailwind CSS, Jest,
Playwright, Git, Docker, AWS, CI/CD, Accessibility

EXPERIENCE
Senior Frontend Engineer — Northwind Labs | Mar 2021 - Present
• Led the migration of a 200k-line React application to Next.js App Router, cutting p75 page load by 38%.
• Built a shared design system used by 6 product teams, reducing new-screen build time from days to hours.
• Introduced Playwright end-to-end coverage across checkout, dropping production regressions by 45%.
• Mentored 3 engineers through their first year, including code review and technical design.

Frontend Engineer — Brightpath Software | Jul 2019 - Feb 2021
• Shipped the customer dashboard used by 40k monthly active users, built with React and Redux.
• Rebuilt the data table component for accessibility, reaching WCAG 2.1 AA compliance.
• Partnered with backend engineers on GraphQL schema design for the reporting API.

Junior Web Developer — Cedar Interactive | Aug 2018 - Jun 2019
• Built responsive marketing sites in HTML, CSS and JavaScript for 12 client launches.

PROJECTS
Shiplog — Open-source deployment timeline for small teams. Next.js, PostgreSQL, Tailwind CSS.
• 1.2k GitHub stars, used by roughly 300 teams.

EDUCATION
B.S., Computer Science — University of Texas at Austin | 2014 - 2018

CERTIFICATIONS
AWS Certified Cloud Practitioner — Amazon Web Services, 2022
`;

export const SAMPLE_JOB_DESCRIPTION = `About the role
We are looking for a Senior Frontend Engineer to join the Platform Experience team. You will own
the interfaces our customers use every day and work closely with design, product and backend.

What you'll do
• Build and maintain customer-facing features in React and TypeScript.
• Design and evolve our component library alongside the design team.
• Partner with backend engineers to shape GraphQL APIs.
• Improve frontend performance and Core Web Vitals across the product.
• Participate in code review and mentor engineers earlier in their career.
• Contribute to our on-call rotation for frontend services.

What you'll need
• 5+ years of professional frontend engineering experience.
• Deep experience with React and TypeScript in production.
• Strong understanding of web performance and accessibility (WCAG).
• Experience with automated testing across unit and end-to-end layers.
• Experience working with GraphQL APIs.
• Bachelor's degree in Computer Science or equivalent practical experience.

Nice to have
• Experience with Next.js and server-side rendering.
• Familiarity with AWS and infrastructure as code (Terraform).
• Experience with Kubernetes or container orchestration.
• Prior work on a design system used across multiple teams.

Compensation
$165,000 - $195,000 per year, depending on experience. Hybrid, 2 days per week in Austin, TX.
`;

export const SAMPLE_JOB_VARIANTS: string[] = [
  SAMPLE_JOB_DESCRIPTION,

  `About the role
We're hiring a Full Stack Engineer to own features end to end across our platform.

What you'll do
• Build product features across the React frontend and the Python backend.
• Design and maintain PostgreSQL schemas and the queries that hit them.
• Own deployment of your services and their behaviour in production.
• Work with the platform team on our Kubernetes-based infrastructure.

What you'll need
• 4+ years building web applications in production.
• Strong React and TypeScript experience.
• Production experience with Python, ideally Django or FastAPI.
• Working knowledge of Kubernetes and container orchestration.
• Experience with AWS.

Nice to have
• Terraform or another infrastructure-as-code tool.
• Experience with event-driven architecture.
`,

  `The role
A Senior React Engineer to lead the rebuild of our customer-facing application.

Responsibilities
• Lead the architecture of a large React and TypeScript codebase.
• Set the testing strategy across unit and end-to-end layers.
• Improve accessibility to WCAG 2.1 AA across the product.
• Mentor two mid-level engineers.

Requirements
• 6+ years of frontend engineering experience.
• Deep React, TypeScript and Next.js knowledge.
• Demonstrated experience with GraphQL in production.
• Strong testing background — Jest and Playwright or equivalent.
• Experience with design systems.

Preferred
• Experience with observability tooling such as Datadog or Grafana.
• Familiarity with CI/CD pipelines and GitHub Actions.
`,

  `Product Engineer
Join a small team building developer tooling used by thousands of engineers.

What you'll do
• Ship features across the stack, from the CLI to the web dashboard.
• Talk directly to users and turn what you hear into product decisions.
• Own reliability for the services you build.

What we're looking for
• 3+ years shipping software in a product-focused role.
• Strong TypeScript and Node.js experience.
• Experience designing REST APIs.
• Comfort with Docker and CI/CD.
• Experience with Go is required for parts of our CLI.

Bonus points
• Open source contributions.
• Experience with Kubernetes.
• Experience with observability and on-call ownership.
`,
];

export function createSampleResume(): Resume {
  const now = nowIso();
  const parsed = parseResumeText(SAMPLE_RESUME_TEXT);
  return {
    id: `${DEMO_MARKER}_resume`,
    label: 'Sample Resume (demo)',
    origin: {
      fileName: 'alex-rivera-resume.txt',
      fileType: 'txt',
      fileSize: SAMPLE_RESUME_TEXT.length,
      uploadedAt: now,
      rawText: SAMPLE_RESUME_TEXT,
    },
    parsed,
    profile: parsed,
    needsReview: false,
    isDefault: false,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSampleJob(): JobPosting {
  const now = nowIso();
  const company = 'Acme Technologies';
  const title = 'Senior Frontend Engineer';
  return {
    id: `${DEMO_MARKER}_job`,
    title,
    company,
    location: 'Austin, TX',
    employmentType: 'full-time',
    arrangement: 'hybrid',
    salary: { min: 165000, max: 195000, currency: '$', period: 'year', raw: '$165,000 - $195,000 per year' },
    description: SAMPLE_JOB_DESCRIPTION,
    requirements: extractRequirements(SAMPLE_JOB_DESCRIPTION),
    url: 'https://example.com/careers/senior-frontend-engineer',
    externalId: 'DEMO-4821',
    postedAt: now,
    platform: 'generic',
    source: 'structured-data',
    fieldSources: { title: 'structured-data', company: 'structured-data', description: 'structured-data' },
    fingerprint: fingerprintFor(company, title, SAMPLE_JOB_DESCRIPTION),
    capturedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function isDemoRecord(id: string): boolean {
  return id.startsWith(DEMO_MARKER);
}

export function createSampleApplications(): Array<{
  company: string;
  title: string;
  status: 'saved' | 'applied' | 'interview' | 'offer' | 'rejected' | 'technical-round';
  matchScore: number;
  daysAgo: number;
}> {
  return [
    { company: 'Acme Technologies', title: 'Senior Frontend Engineer', status: 'interview', matchScore: 82, daysAgo: 9 },
    { company: 'Northstar Health', title: 'Frontend Engineer', status: 'applied', matchScore: 74, daysAgo: 4 },
    { company: 'Lumen Analytics', title: 'Full Stack Engineer', status: 'rejected', matchScore: 58, daysAgo: 21 },
    { company: 'Fernway', title: 'Senior React Engineer', status: 'technical-round', matchScore: 88, daysAgo: 14 },
    { company: 'Quill', title: 'Product Engineer', status: 'saved', matchScore: 66, daysAgo: 1 },
    { company: 'Baseline Systems', title: 'Frontend Platform Engineer', status: 'offer', matchScore: 91, daysAgo: 33 },
    { company: 'Orbit Labs', title: 'Web Engineer', status: 'rejected', matchScore: 47, daysAgo: 27 },
    { company: 'Havenly', title: 'Senior Software Engineer', status: 'applied', matchScore: 71, daysAgo: 6 },
  ];
}
