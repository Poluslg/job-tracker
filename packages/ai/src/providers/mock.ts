import type {
  AICompletionRequest,
  AICompletionResponse,
  AIProvider,
  AIProviderMeta,
} from "@job-ai/types";
import { AIError } from "@job-ai/types";
import type { PromptTaskId } from "../prompts/shared.ts";

export const MOCK_META: AIProviderMeta = {
  id: "mock",
  name: "Demo mode (no API calls)",
  keyUrl: "",
  defaultModel: "demo-fixtures",
  models: ["demo-fixtures"],
  origin: "",
  requiresKey: false,
};

export class MockProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly meta = MOCK_META;
  private readonly latencyMs: number;

  constructor(latencyMs = 450) {
    this.latencyMs = latencyMs;
  }

  async complete(req: AICompletionRequest): Promise<AICompletionResponse> {
    await new Promise((r) => setTimeout(r, this.latencyMs));

    const task = (req.task ?? "") as PromptTaskId | "";
    const text = FIXTURES[task as PromptTaskId];
    if (!text) {
      throw new AIError(
        "invalid-response",
        `Demo mode has no fixture for task "${task}".`,
      );
    }

    return {
      text,
      usage: {
        inputTokens: Math.ceil((req.system.length + req.user.length) / 4),
        outputTokens: Math.ceil(text.length / 4),
        model: "demo-fixtures",
        provider: "mock",
        latencyMs: this.latencyMs,
      },
    };
  }

  async testConnection() {
    return { ok: true as const };
  }

  async listModels(): Promise<string[]> {
    return this.meta.models;
  }
}

const FIXTURES: Record<PromptTaskId, string> = {
  "job-extraction": JSON.stringify({
    title: "Senior Frontend Engineer",
    company: "Acme Technologies",
    location: "Austin, TX",
    employmentType: "full-time",
    arrangement: "hybrid",
    salaryText: "$165,000 - $195,000 per year",
    isJobPosting: true,
  }),

  requirements: JSON.stringify({
    requirements: [
      {
        text: "5+ years of professional frontend engineering experience.",
        kind: "must-have",
        skills: [],
        yearsRequired: 5,
      },
      {
        text: "Deep experience with React and TypeScript in production.",
        kind: "must-have",
        skills: ["React", "TypeScript"],
        yearsRequired: null,
      },
      {
        text: "Experience working with GraphQL APIs.",
        kind: "must-have",
        skills: ["GraphQL"],
        yearsRequired: null,
      },
      {
        text: "Experience with Kubernetes or container orchestration.",
        kind: "nice-to-have",
        skills: ["Kubernetes"],
        yearsRequired: null,
      },
      {
        text: "Build and maintain customer-facing features in React and TypeScript.",
        kind: "responsibility",
        skills: ["React", "TypeScript"],
        yearsRequired: null,
      },
      {
        text: "The team appears to own its own on-call, so production ownership is expected.",
        kind: "signal",
        skills: [],
        yearsRequired: null,
      },
    ],
  }),

  "resume-parse": JSON.stringify({
    contact: {
      name: "Alex Rivera",
      email: "alex.rivera@example.com",
      phone: "(555) 014-2280",
      location: "Austin, TX",
      linkedin: "linkedin.com/in/alexrivera",
      github: "github.com/alexrivera",
      portfolio: "",
    },
    summary:
      "Frontend-leaning full-stack engineer with 6 years building product interfaces in React and TypeScript.",
    skills: [
      "TypeScript",
      "React",
      "Next.js",
      "Node.js",
      "GraphQL",
      "PostgreSQL",
      "Playwright",
    ],
    experience: [
      {
        title: "Senior Frontend Engineer",
        company: "Northwind Labs",
        location: "",
        startDate: "Mar 2021",
        endDate: "",
        current: true,
        responsibilities: [
          "Mentored 3 engineers through their first year, including code review and technical design.",
        ],
        achievements: [
          "Led the migration of a 200k-line React application to Next.js App Router, cutting p75 page load by 38%.",
        ],
      },
    ],
    education: [
      {
        degree: "B.S.",
        field: "Computer Science",
        institution: "University of Texas at Austin",
        startDate: "2014",
        endDate: "2018",
      },
    ],
    certifications: [
      {
        name: "AWS Certified Cloud Practitioner",
        issuer: "Amazon Web Services",
      },
    ],
    projects: [
      {
        name: "Shiplog",
        description: "Open-source deployment timeline for small teams.",
        technologies: ["Next.js", "PostgreSQL"],
      },
    ],
    languages: [],
  }),

  "match-insights": JSON.stringify({
    hiddenSignals: [
      {
        text: "[Sample] The on-call line suggests the team owns production for its own services, not just the UI layer.",
        why: 'Inferred from "Contribute to our on-call rotation for frontend services".',
      },
      {
        text: '[Sample] "Evolve our component library alongside the design team" reads as ongoing design-system ownership rather than occasional contribution.',
        why: "Inferred from the responsibilities section.",
      },
    ],
    concerns: [
      {
        text: "[Sample] The posting lists Kubernetes as preferred and the resume shows Docker but no orchestration work.",
        severity: "low",
      },
      {
        text: "[Sample] Terraform and infrastructure-as-code are not evidenced anywhere in the resume.",
        severity: "medium",
      },
    ],
    recommendations: [
      {
        title: "[Sample] Put the design-system work in the summary",
        detail:
          "The posting leads with component-library ownership and your Northwind design-system work is buried in the third bullet. Move it up.",
        priority: "high",
        needsUserConfirmation: false,
      },
      {
        title: "[Sample] Quantify the GraphQL work",
        detail:
          "Your Brightpath bullet says you partnered on GraphQL schema design. If you know the scale (number of types, consumers, or query volume), add it.",
        priority: "medium",
        needsUserConfirmation: true,
      },
    ],
    terminologyBridges: [
      {
        jobTerm: "Core Web Vitals",
        resumeTerm: "p75 page load",
        note: "[Sample] Same underlying work; the posting uses the Google metric name.",
      },
    ],
  }),

  "tailor-resume": JSON.stringify({
    summary:
      "[Sample] Frontend engineer with 6 years building production React and TypeScript interfaces, including a 200k-line Next.js migration and a design system used by six product teams.",
    skillOrder: [
      "React",
      "TypeScript",
      "Next.js",
      "GraphQL",
      "Accessibility",
      "Playwright",
      "Node.js",
    ],
    changes: [
      {
        section: "Summary",
        original:
          "Frontend-leaning full-stack engineer with 6 years building product interfaces in React and TypeScript.",
        suggested:
          "[Sample] Frontend engineer with 6 years building production React and TypeScript interfaces, including a 200k-line Next.js migration and a design system used by six product teams.",
        reason:
          "Leads with the two things this posting names first: React/TypeScript depth and component-library ownership.",
        needsUserConfirmation: false,
      },
      {
        section: "Experience — Northwind Labs",
        original:
          "Built a shared design system used by 6 product teams, reducing new-screen build time from days to hours.",
        suggested:
          "[Sample] Owned a shared design system used by 6 product teams, working directly with design to define components and reduce new-screen build time from days to hours.",
        reason:
          "The posting frames this as ongoing ownership with the design team; your existing bullet already describes that work.",
        needsUserConfirmation: false,
      },
    ],
    unverifiable: [
      "[Sample] The posting mentions Terraform. Nothing in the resume evidences infrastructure-as-code, so no change was proposed.",
    ],
  }),

  "cover-letter": JSON.stringify({
    body: `[Sample cover letter — demo mode]

I'm writing about the Senior Frontend Engineer role on the Platform Experience team.

Most of my last three years has been the work this posting describes. At Northwind Labs I led the migration of a 200k-line React application to the Next.js App Router, which cut p75 page load by 38%, and I built the design system that six product teams now use to ship new screens in hours rather than days. Both were long-running efforts done alongside designers rather than handed over to them.

The accessibility and testing requirements are familiar ground too — I rebuilt our data table to WCAG 2.1 AA and introduced the Playwright coverage that took production regressions down by 45%.

I'd welcome the chance to talk about the component-library work in particular.`,
    needsConfirmation: [
      "[Sample] Confirm the 38% and 45% figures match what you can discuss in an interview.",
      "[Sample] Consider naming something specific about this team if you know it — the letter deliberately avoids guessing.",
    ],
  }),

  "interview-prep": JSON.stringify({
    questions: [
      {
        category: "technical",
        question:
          "[Sample] Walk me through the Next.js App Router migration. How did you sequence it against ongoing feature work?",
        answerFramework:
          "Cover: the starting architecture, why the migration was worth doing, how you avoided a big-bang cutover, what broke, and how you measured the result. Interviewers are listening for incremental strategy and rollback thinking, not the framework API.",
        drawFrom: ["Northwind Labs — Next.js App Router migration"],
        difficulty: "hard",
      },
      {
        category: "technical",
        question:
          "[Sample] How do you approach Core Web Vitals regressions after a release?",
        answerFramework:
          "Outline detection (field vs lab data), triage (which metric, which route), common causes (hydration cost, image and font loading, third-party scripts), and how you prevent recurrence with budgets in CI.",
        drawFrom: ["Northwind Labs — p75 page load work"],
        difficulty: "medium",
      },
      {
        category: "behavioral",
        question:
          "[Sample] Tell me about a time you had to bring another team along on a technical change.",
        answerFramework:
          "STAR. Situation: six teams on inconsistent UI patterns. Task: your remit for the design system. Action: how you got adoption without mandate. Result: the build-time reduction you already cite. Keep the Action section longest.",
        drawFrom: ["Northwind Labs — design system across 6 teams"],
        difficulty: "medium",
      },
      {
        category: "resume-based",
        question:
          "[Sample] Your design-system bullet says build time went from days to hours. How was that measured?",
        answerFramework:
          "Say plainly how you measured it and what the sample was. If it was an estimate from the teams rather than instrumented, say that — an honest answer about a rough measure is stronger than a confident one you cannot defend.",
        drawFrom: ["Northwind Labs — design system"],
        difficulty: "medium",
      },
      {
        category: "resume-based",
        question:
          "[Sample] This role prefers Kubernetes experience. Your resume shows Docker but not orchestration. How would you approach that?",
        answerFramework:
          "Do not overstate. State what you have actually done with containers, what you understand conceptually about orchestration, and how you have picked up comparable infrastructure before. Then ask how much of the role genuinely touches it.",
        drawFrom: ["Northwind Labs — Docker usage"],
        difficulty: "medium",
      },
      {
        category: "company-role",
        question:
          "[Sample] How does the frontend on-call rotation actually work day to day?",
        answerFramework:
          "This one is for you to ask. Listen for: page volume, what a typical incident is, whether frontend engineers own backend services too.",
        drawFrom: [],
        difficulty: "easy",
      },
    ],
    talkingPoints: [
      "[Sample] Design-system ownership across six teams — the closest match to how this role is written.",
      "[Sample] The Next.js migration as evidence of large-scale incremental change.",
      "[Sample] Accessibility work as concrete evidence for the WCAG requirement.",
    ],
    questionsToAsk: [
      "[Sample] How is component-library work prioritised against product roadmap work?",
      "[Sample] What does the frontend on-call rotation cover, and how often does it page?",
      "[Sample] What does the first successful 90 days look like for this role?",
    ],
    studyTopics: [
      "[Sample] Kubernetes fundamentals — pods, services, deployments (listed as preferred).",
      "[Sample] Terraform basics and what infrastructure-as-code buys a frontend team.",
      "[Sample] GraphQL schema design trade-offs, since the posting names API partnership.",
    ],
  }),
};
