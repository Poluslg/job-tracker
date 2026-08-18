# Architecture

## Layout

```
apps/
  extension/    Chrome MV3 extension — detection, analysis, quick actions
packages/
  types/        Zod schemas: the single source of truth for every record
  core/         Deterministic logic: scoring, extraction, parsing, storage, exports
  ai/           Provider abstraction, versioned prompts, response schemas
  ui/           Shared components and design tokens
```

Workspace packages ship raw TypeScript (`"main": "./src/index.ts"`). Vite resolves them directly.

Relative imports carry explicit `.ts`/`.tsx` extensions so the same source runs unmodified under
Vite and `node --test`.

## Responsibility split

| | Extension |
| --- | --- |
| Optimised for | Speed at the point of decision |
| Owns | Detection, quick analysis, save, quick status updates, full tracker, analytics, versions, settings |
| Storage | `chrome.storage.local` |
| Auth | None required |

Both surfaces use the same logic, taxonomy, and schemas.

---

## Data model

```
User
 ├── Resume ──── ResumeVersion
 ├── Job ─────── JobAnalysis
 │                    │
 ├── Application ─────┘
 │     ├── CoverLetter
 │     └── InterviewPreparation
 └── UserSettings + AICredential
```

Notes on shape:

- **Resume keeps four representations**: the original upload text, the machine `parsed` result, the
  user-editable `profile`, and any number of tailored `ResumeVersion`s. The upload is never mutated,
  and `needsReview` stays true until the user confirms the parse.
- **Jobs are de-duplicated** on a content fingerprint (`company | title | first 2000 chars`), so
  re-analyzing the same posting updates one row instead of accumulating rows.
- **Applications denormalise** company, title, score and resume-version name so the tracker table
  and exports render without joins, and survive the job record being cleaned up.
- **Job description snapshots** are stored (opt-out) so the tracker stays readable after a posting is
  taken down.

Each entity promotes the columns used for filtering and sorting, and keeps the full validated record
in a `jsonb` column — the Zod schemas own that payload's shape.

---

## Extension internals

```
content script  ──JOB_DETECTED──►  service worker  ──►  chrome.storage.local
      ▲                                  │
      │ EXTRACT_JOB                      │ ANALYZE_JOB, TAILOR_RESUME, …
      │                                  ▼
   popup / options ─────────────►  AI provider (user's key)
```

**Content script** — reads the page, decides whether it's a posting, renders the floating button and
the manual-selection picker inside a *closed* shadow root. It performs no network I/O and never
touches the page's forms. It re-runs on SPA navigation, which is how Workday, LinkedIn and Ashby
swap postings without a page load.

**Service worker** — the only place that holds the API key or makes network calls. Owns the single
`DataStore`. Every message is request/response with a typed envelope, so a thrown handler still
reaches the UI as a renderable error rather than a hung promise.

**Pages** (popup, options, onboarding) — React. They read and write only through the typed message
bus in `packages/types/src/messages.ts`.

Content scripts can't be ES modules, so they're built separately as a self-contained IIFE
(`vite.content.config.ts`); everything else is an ES-module build.

### Detection strategy

Layered, with results merged per field, preferring the most reliable source available:

1. **Structured data** — schema.org `JobPosting` in JSON-LD
2. **Known selectors** — per-ATS packs (Greenhouse, Lever, Workday, LinkedIn, Indeed, Ashby,
   SmartRecruiters, Workable, BambooHR, Jobvite, iCIMS, Taleo, Wellfound)
3. **Semantic HTML** — `[itemprop]`, `<article>`, `<main>`, `role="main"`
4. **DOM heuristics** — density scoring over job vocabulary, list items and text length, penalising
   link-dense blocks (which are navigation or job *lists*, not a posting)
5. **AI extraction** — only when the above fail and the user opts in
6. **Manual selection** — always available; the guaranteed path

Confidence is scored 0-1; below 0.45 the UI proactively offers manual selection instead of showing
a bad result.

---

## Request flow: analyze a job

```
popup                 service worker              core / ai
  │ ANALYZE_JOB ────────►│
  │                      │ normalize + persist job
  │                      │ extractRequirements() ───────────►  deterministic
  │                      │ (optional) refine via model
  │◄── PROGRESS ─────────│
  │                      │ computeAnalysis() ───────────────►  the score
  │◄── PROGRESS ─────────│
  │                      │ (optional) matchInsights via model
  │◄── {job, analysis, aiError} ─┤
```

If the model step fails, `aiError` is populated and the local analysis is returned anyway. The popup
shows a warning banner above a complete result rather than an error page.

---

## Storage abstraction

```ts
interface KeyValueAdapter { get, set, remove, keys, usage? }
class DataStore { /* resumes, jobs, analyses, applications, … */ }
```

The extension backs `DataStore` with `chrome.storage.local`; tests use an in-memory adapter.
`updateUserData(userId, mutate)` keeps read-modify-write ergonomics but persists a **diff**: only
rows that actually changed are upserted, and only rows that disappeared are deleted.
