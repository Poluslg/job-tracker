export interface ResumeFixture {
  name: string;
  text: string;
  expect: {
    name?: string;
    email?: string;
    phone?: boolean;
    location?: string;
    linkedin?: boolean;
    github?: boolean;
    roles: number;
    requireTitleAndCompany?: boolean;
    rolesWithDates?: number;
    bullets: number;
    education: number;
    minSkills: number;
    skills?: string[];
    summary?: boolean;
    projects?: number;
    certifications?: number;
  };
}

export const PIPE_SINGLE_LINE: ResumeFixture = {
  name: "single-line pipe header",
  text: `Priya Raman
priya.raman@example.com | (415) 555-0132 | San Francisco, CA
linkedin.com/in/priyaraman | github.com/priyaraman

PROFESSIONAL SUMMARY
Backend engineer with 7 years building distributed systems in Go and Python.
Comfortable owning services from design through production support.

TECHNICAL SKILLS
Languages: Go, Python, SQL, TypeScript
Infrastructure: AWS, Docker, Kubernetes, Terraform
Data: PostgreSQL, Redis, Kafka

PROFESSIONAL EXPERIENCE
Staff Software Engineer | Meridian Systems | Jan 2022 - Present
• Led the redesign of the billing pipeline, cutting reconciliation time by 60%.
• Owned three production services with a combined 12k requests per second.
• Mentored four engineers through promotion.

Senior Backend Engineer | Cobalt Health | Jun 2019 - Dec 2021
• Built the FHIR ingestion service processing 4 million records daily.
• Reduced p99 API latency from 800ms to 120ms through query optimization.

Backend Engineer | Trellis Software | Aug 2017 - May 2019
• Developed internal tooling in Python used by 40 engineers.

EDUCATION
B.S. in Computer Science | University of California, Berkeley | 2013 - 2017

CERTIFICATIONS
AWS Certified Solutions Architect - Associate, Amazon Web Services, 2021
`,
  expect: {
    name: "Priya Raman",
    email: "priya.raman@example.com",
    phone: true,
    location: "San Francisco, CA",
    linkedin: true,
    github: true,
    roles: 3,
    requireTitleAndCompany: true,
    rolesWithDates: 3,
    bullets: 6,
    education: 1,
    minSkills: 8,
    skills: ["Go", "Python", "Kubernetes", "PostgreSQL", "Terraform"],
    summary: true,
    certifications: 1,
  },
};

export const TWO_LINE_HEADER: ResumeFixture = {
  name: "two-line header (title, then company + dates)",
  text: `MARCUS OKONKWO
Berlin, Germany · marcus.okonkwo@example.com · +49 151 234 5678
github.com/mokonkwo

SUMMARY
Full-stack engineer focused on React and Node.js products.

EXPERIENCE

Senior Frontend Engineer
Lumen Interactive, Berlin — March 2021 to Present
• Rebuilt the customer portal in React and TypeScript, used by 90,000 accounts.
• Introduced Playwright end-to-end tests covering the checkout flow.
• Cut bundle size by 42% through code splitting.

Frontend Engineer
Havelock Digital, Munich — July 2018 to February 2021
• Shipped a design system adopted by five product teams.
• Improved Lighthouse accessibility scores from 68 to 97.

Junior Web Developer
Studio Nord, Hamburg — September 2016 to June 2018
• Built responsive marketing sites in HTML, CSS and JavaScript.

SKILLS
React, TypeScript, JavaScript, Node.js, GraphQL, Jest, Playwright, CSS, Accessibility

EDUCATION

B.Sc. Computer Science
Technical University of Berlin — 2013 to 2016
`,
  expect: {
    name: "MARCUS OKONKWO",
    email: "marcus.okonkwo@example.com",
    phone: true,
    github: true,
    roles: 3,
    requireTitleAndCompany: true,
    rolesWithDates: 3,
    bullets: 6,
    education: 1,
    minSkills: 7,
    skills: ["React", "TypeScript", "Node.js", "GraphQL"],
    summary: true,
  },
};

export const RIGHT_ALIGNED_DATES: ResumeFixture = {
  name: "right-aligned dates from PDF extraction",
  text: `Elena Vasquez
elena.vasquez@example.com  •  (212) 555-0198  •  New York, NY

PROFILE
Data engineer with 6 years designing pipelines and analytics platforms.

WORK EXPERIENCE

Acme Analytics                                                    New York, NY
Senior Data Engineer                                       February 2021 – Present
• Designed the Airflow orchestration layer running 400 daily jobs.
• Migrated the warehouse from Redshift to Snowflake with zero downtime.
• Cut pipeline compute spend by 35%.

Northwind Retail                                                   Boston, MA
Data Engineer                                             June 2018 – January 2021
• Built dbt models powering the executive reporting suite.
• Owned data quality monitoring across 60 source tables.

SKILLS
Python · SQL · Spark · Airflow · dbt · Snowflake · AWS · Docker

EDUCATION
Master of Science, Data Science                                          2018
Columbia University                                              New York, NY
`,
  expect: {
    name: "Elena Vasquez",
    email: "elena.vasquez@example.com",
    phone: true,
    roles: 2,
    requireTitleAndCompany: true,
    rolesWithDates: 2,
    bullets: 5,
    education: 1,
    minSkills: 6,
    skills: ["Python", "Spark", "Airflow", "Snowflake"],
    summary: true,
  },
};

export const COMPANY_FIRST_COMPACT: ResumeFixture = {
  name: "company-first, compact spacing, hyphen bullets",
  text: `DAVID CHEN
Toronto, ON | david.chen@example.com | 416-555-0177 | linkedin.com/in/davidchen

Objective
Product designer moving into design engineering.

Relevant Experience
Fintech Collective - Senior Product Designer (2020 - Present)
- Led design for the mobile app, growing weekly active users from 12k to 80k.
- Established the design system now used across four products.
Brightline Studio - Product Designer (2017 - 2020)
- Designed onboarding flows that raised activation by 22%.
- Ran user research sessions with 60+ participants.
Pixelworks - UI Designer (2015 - 2017)
- Produced marketing and product interfaces for six client launches.

Core Skills
Figma, UI Design, UX Design, Design Systems, Prototyping, User Research, HTML, CSS

Education
OCAD University - Bachelor of Design, Interaction Design (2011 - 2015)

Projects
Palette — Open-source colour contrast checker. React, TypeScript.
- 800 GitHub stars.
`,
  expect: {
    name: "DAVID CHEN",
    email: "david.chen@example.com",
    phone: true,
    linkedin: true,
    roles: 3,
    requireTitleAndCompany: true,
    rolesWithDates: 3,
    bullets: 5,
    education: 1,
    minSkills: 6,
    skills: ["Figma", "UI Design", "Design Systems", "User Research"],
    summary: true,
    projects: 1,
  },
};

export const MINIMAL_NO_HEADINGS: ResumeFixture = {
  name: "sparse resume with unconventional headings",
  text: `Sam Whitfield
sam.whitfield@example.com

WHAT I DO
Site reliability engineer, 5 years, mostly Kubernetes and observability.

WHERE I'VE WORKED
Orbital Cloud — Site Reliability Engineer — 2021 to Present
• Run the Kubernetes platform serving 200 microservices.
• Built the Prometheus and Grafana observability stack.
Vantage Networks — Systems Engineer — 2019 to 2021
• Automated provisioning with Terraform and Ansible.

WHAT I KNOW
Kubernetes, Docker, Terraform, Linux, Prometheus, Grafana, Python, Go

SCHOOLING
B.Eng. Computer Engineering, University of Leeds, 2019
`,
  expect: {
    name: "Sam Whitfield",
    email: "sam.whitfield@example.com",
    roles: 2,
    requireTitleAndCompany: true,
    rolesWithDates: 2,
    bullets: 3,
    education: 1,
    minSkills: 5,
    skills: ["Kubernetes", "Terraform", "Linux"],
    summary: true,
  },
};

export const ALL_FIXTURES: ResumeFixture[] = [
  PIPE_SINGLE_LINE,
  TWO_LINE_HEADER,
  RIGHT_ALIGNED_DATES,
  COMPANY_FIRST_COMPACT,
  MINIMAL_NO_HEADINGS,
];
