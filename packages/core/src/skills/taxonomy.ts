import type { SkillCategory } from '@job-ai/types';
import { containsTerm, lower } from '../util/text.ts';

export interface SkillEntry {
  
  canonical: string;
  category: SkillCategory;
  
  aliases?: string[];
  
  parents?: string[];
}

export const SKILL_CATALOG: SkillEntry[] = [
  
  { canonical: 'JavaScript', category: 'technical', aliases: ['js', 'ecmascript', 'es6'] },
  { canonical: 'TypeScript', category: 'technical', aliases: ['ts'], parents: ['JavaScript'] },
  { canonical: 'Python', category: 'technical', aliases: ['python3'] },
  { canonical: 'Java', category: 'technical' },
  { canonical: 'Kotlin', category: 'technical' },
  { canonical: 'Swift', category: 'technical' },
  { canonical: 'Go', category: 'technical', aliases: ['golang'] },
  { canonical: 'Rust', category: 'technical' },
  { canonical: 'Ruby', category: 'technical' },
  { canonical: 'PHP', category: 'technical' },
  { canonical: 'C#', category: 'technical', aliases: ['csharp', 'c sharp'] },
  { canonical: 'C++', category: 'technical', aliases: ['cpp'] },
  { canonical: 'C', category: 'technical' },
  { canonical: 'Scala', category: 'technical' },
  { canonical: 'R', category: 'technical' },
  { canonical: 'SQL', category: 'technical' },
  { canonical: 'HTML', category: 'technical', aliases: ['html5'] },
  { canonical: 'CSS', category: 'technical', aliases: ['css3'] },
  { canonical: 'Sass', category: 'technical', aliases: ['scss'], parents: ['CSS'] },
  { canonical: 'Tailwind CSS', category: 'technical', aliases: ['tailwind', 'tailwindcss'], parents: ['CSS'] },

  { canonical: 'React', category: 'technical', aliases: ['react.js', 'reactjs'], parents: ['JavaScript'] },
  { canonical: 'Next.js', category: 'technical', aliases: ['nextjs', 'next js'], parents: ['React'] },
  { canonical: 'Vue', category: 'technical', aliases: ['vue.js', 'vuejs'], parents: ['JavaScript'] },
  { canonical: 'Nuxt', category: 'technical', aliases: ['nuxt.js'], parents: ['Vue'] },
  { canonical: 'Angular', category: 'technical', aliases: ['angularjs'], parents: ['TypeScript'] },
  { canonical: 'Svelte', category: 'technical', parents: ['JavaScript'] },
  { canonical: 'Redux', category: 'technical', parents: ['React'] },
  { canonical: 'React Native', category: 'technical', aliases: ['react-native'], parents: ['React'] },
  { canonical: 'Webpack', category: 'tool', parents: ['JavaScript'] },
  { canonical: 'Vite', category: 'tool', parents: ['JavaScript'] },
  { canonical: 'Accessibility', category: 'technical', aliases: ['a11y', 'wcag', 'aria'] },
  { canonical: 'Responsive Design', category: 'technical', aliases: ['responsive web design'] },

  { canonical: 'Node.js', category: 'technical', aliases: ['node', 'nodejs'], parents: ['JavaScript'] },
  { canonical: 'Express', category: 'technical', aliases: ['express.js'], parents: ['Node.js'] },
  { canonical: 'NestJS', category: 'technical', aliases: ['nest.js'], parents: ['Node.js'] },
  { canonical: 'Django', category: 'technical', parents: ['Python'] },
  { canonical: 'Flask', category: 'technical', parents: ['Python'] },
  { canonical: 'FastAPI', category: 'technical', parents: ['Python'] },
  { canonical: 'Spring Boot', category: 'technical', aliases: ['spring'], parents: ['Java'] },
  { canonical: 'Rails', category: 'technical', aliases: ['ruby on rails'], parents: ['Ruby'] },
  { canonical: 'Laravel', category: 'technical', parents: ['PHP'] },
  { canonical: '.NET', category: 'technical', aliases: ['dotnet', 'asp.net'], parents: ['C#'] },
  { canonical: 'GraphQL', category: 'technical', aliases: ['graph ql'] },
  { canonical: 'REST APIs', category: 'technical', aliases: ['rest', 'restful', 'rest api'] },
  { canonical: 'gRPC', category: 'technical' },
  { canonical: 'WebSockets', category: 'technical', aliases: ['websocket'] },
  { canonical: 'Microservices', category: 'technical', aliases: ['micro services'] },
  { canonical: 'Event-Driven Architecture', category: 'technical', aliases: ['event driven'] },

  { canonical: 'PostgreSQL', category: 'technical', aliases: ['postgres'], parents: ['SQL'] },
  { canonical: 'MySQL', category: 'technical', parents: ['SQL'] },
  { canonical: 'MongoDB', category: 'technical', aliases: ['mongo'] },
  { canonical: 'Redis', category: 'technical' },
  { canonical: 'Elasticsearch', category: 'technical', aliases: ['elastic search'] },
  { canonical: 'DynamoDB', category: 'technical', parents: ['AWS'] },
  { canonical: 'Snowflake', category: 'technical' },
  { canonical: 'BigQuery', category: 'technical', parents: ['Google Cloud'] },
  { canonical: 'Spark', category: 'technical', aliases: ['apache spark', 'pyspark'] },
  { canonical: 'Airflow', category: 'technical', aliases: ['apache airflow'] },
  { canonical: 'dbt', category: 'technical' },
  { canonical: 'Pandas', category: 'technical', parents: ['Python'] },
  { canonical: 'NumPy', category: 'technical', parents: ['Python'] },
  { canonical: 'Machine Learning', category: 'technical', aliases: ['ml'] },
  { canonical: 'Deep Learning', category: 'technical', parents: ['Machine Learning'] },
  { canonical: 'PyTorch', category: 'technical', parents: ['Deep Learning', 'Python'] },
  { canonical: 'TensorFlow', category: 'technical', parents: ['Deep Learning'] },
  { canonical: 'NLP', category: 'technical', aliases: ['natural language processing'], parents: ['Machine Learning'] },
  { canonical: 'Data Visualization', category: 'technical', aliases: ['dataviz'] },
  { canonical: 'Tableau', category: 'tool', parents: ['Data Visualization'] },
  { canonical: 'Power BI', category: 'tool', aliases: ['powerbi'], parents: ['Data Visualization'] },
  { canonical: 'ETL', category: 'technical', aliases: ['elt'] },
  { canonical: 'Statistics', category: 'technical', aliases: ['statistical analysis'] },
  { canonical: 'A/B Testing', category: 'technical', aliases: ['ab testing', 'experimentation'] },

  { canonical: 'AWS', category: 'technical', aliases: ['amazon web services'] },
  { canonical: 'AWS Lambda', category: 'technical', aliases: ['lambda'], parents: ['AWS', 'Serverless'] },
  { canonical: 'S3', category: 'technical', aliases: ['amazon s3'], parents: ['AWS'] },
  { canonical: 'EC2', category: 'technical', parents: ['AWS'] },
  { canonical: 'Azure', category: 'technical', aliases: ['microsoft azure'] },
  { canonical: 'Google Cloud', category: 'technical', aliases: ['gcp', 'google cloud platform'] },
  { canonical: 'Serverless', category: 'technical' },
  { canonical: 'Docker', category: 'technical', aliases: ['containers', 'containerization'] },

  { canonical: 'Kubernetes', category: 'technical', aliases: ['k8s'] },
  { canonical: 'Terraform', category: 'technical', parents: ['Infrastructure as Code'] },
  { canonical: 'Infrastructure as Code', category: 'technical', aliases: ['iac'] },
  { canonical: 'CI/CD', category: 'technical', aliases: ['ci cd', 'continuous integration', 'continuous delivery'] },
  { canonical: 'GitHub Actions', category: 'tool', parents: ['CI/CD'] },
  { canonical: 'Jenkins', category: 'tool', parents: ['CI/CD'] },
  { canonical: 'Linux', category: 'technical', aliases: ['unix'] },
  { canonical: 'Observability', category: 'technical', aliases: ['monitoring', 'datadog', 'grafana', 'prometheus'] },

  { canonical: 'Git', category: 'tool', aliases: ['github', 'gitlab', 'version control'] },
  { canonical: 'Testing', category: 'technical', aliases: ['unit testing', 'automated testing', 'jest', 'vitest', 'pytest'] },
  { canonical: 'End-to-End Testing', category: 'technical', aliases: ['e2e testing', 'playwright', 'cypress'], parents: ['Testing'] },
  { canonical: 'Agile', category: 'soft', aliases: ['scrum', 'kanban', 'sprint planning'] },
  { canonical: 'Code Review', category: 'soft' },
  { canonical: 'System Design', category: 'technical', aliases: ['architecture', 'distributed systems'] },
  { canonical: 'Performance Optimization', category: 'technical', aliases: ['performance tuning'] },
  { canonical: 'Security', category: 'technical', aliases: ['application security', 'appsec', 'owasp'] },

  { canonical: 'Figma', category: 'tool' },
  { canonical: 'UI Design', category: 'technical', aliases: ['user interface design'] },
  { canonical: 'UX Design', category: 'technical', aliases: ['user experience', 'ux'] },
  { canonical: 'User Research', category: 'technical', parents: ['UX Design'] },
  { canonical: 'Design Systems', category: 'technical', parents: ['UI Design'] },
  { canonical: 'Prototyping', category: 'technical', parents: ['UX Design'] },
  { canonical: 'Product Management', category: 'domain', aliases: ['product strategy', 'roadmap'] },
  { canonical: 'Stakeholder Management', category: 'soft' },

  { canonical: 'Communication', category: 'soft', aliases: ['written communication', 'verbal communication'] },
  { canonical: 'Collaboration', category: 'soft', aliases: ['cross-functional', 'teamwork'] },
  { canonical: 'Leadership', category: 'soft', aliases: ['mentoring', 'mentorship', 'team lead'] },
  { canonical: 'Problem Solving', category: 'soft', aliases: ['analytical thinking'] },
  { canonical: 'Ownership', category: 'soft', aliases: ['self-starter', 'autonomy'] },
  { canonical: 'Project Management', category: 'soft' },
  { canonical: 'Customer Focus', category: 'soft', aliases: ['customer obsession', 'client facing'] },
];

const byCanonical = new Map<string, SkillEntry>();
const aliasIndex = new Map<string, string>();

for (const entry of SKILL_CATALOG) {
  byCanonical.set(entry.canonical.toLowerCase(), entry);
  aliasIndex.set(entry.canonical.toLowerCase(), entry.canonical);
  for (const a of entry.aliases ?? []) aliasIndex.set(a.toLowerCase(), entry.canonical);
}

export function canonicalizeSkill(term: string): string | null {
  return aliasIndex.get(lower(term)) ?? null;
}

export function getSkillEntry(canonical: string): SkillEntry | undefined {
  return byCanonical.get(canonical.toLowerCase());
}

export function surfaceForms(canonical: string): string[] {
  const e = getSkillEntry(canonical);
  if (!e) return [canonical];
  return [e.canonical, ...(e.aliases ?? [])];
}

export function ancestorsOf(canonical: string, seen = new Set<string>()): string[] {
  const e = getSkillEntry(canonical);
  if (!e?.parents) return [];
  const out: string[] = [];
  for (const p of e.parents) {
    if (seen.has(p)) continue;
    seen.add(p);
    out.push(p, ...ancestorsOf(p, seen));
  }
  return out;
}

export function descendantsOf(canonical: string): string[] {
  const out: string[] = [];
  for (const e of SKILL_CATALOG) {
    if (ancestorsOf(e.canonical).some((a) => a.toLowerCase() === canonical.toLowerCase())) {
      out.push(e.canonical);
    }
  }
  return out;
}

export function detectSkills(text: string): string[] {
  const hay = lower(text);
  const found = new Set<string>();
  for (const entry of SKILL_CATALOG) {
    for (const form of surfaceForms(entry.canonical)) {
      if (containsTerm(hay, form)) {
        found.add(entry.canonical);
        break;
      }
    }
  }
  return [...found];
}
