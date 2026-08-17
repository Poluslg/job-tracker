# AI Career Copilot

Your AI career copilot, inside every job listing.

A Chrome extension and web dashboard that tell you how your resume actually lines up with a job —
what matches, what's missing, and what to do about it — then help you tailor honestly, prepare for
the interview, and track every application.

**Discover → Analyze → Tailor → Apply → Prepare → Track → Improve**

---

## What it does

Open any job posting. The extension detects the role, compares it against your resume, and gives you:

- an explainable **match score** with the reasoning behind every component
- **strong / partial / missing** skill analysis — a partial match is never dressed up as a full one
- **ATS keyword coverage**, job-title alignment and resume parsing issues
- **experience and education alignment** against what the posting actually asks for
- **specific recommendations**, with anything speculative flagged for your confirmation
- **resume tailoring** with a review step, **cover letters**, and **interview preparation**
- an **application tracker** you can export to CSV or Excel

### What it deliberately does not do

The score is an *analytical estimate of alignment*. It is never presented as a prediction of whether
you will be contacted, interviewed or hired, and the copy throughout says so.

Nothing fabricates experience. No suggestion adds a skill, employer, date, credential or metric that
isn't already in your resume — if a rewrite would need a fact the tool doesn't have, it says
"needs your confirmation" instead of inventing one. Keyword advice is refused when the resume shows
no evidence for the term.

The extension never submits an application or touches a third-party form.

---

## Quick start

```bash
npm install
```

### Run the dashboard

```bash
npm run dev:web
```

Open <http://localhost:3000>. With no configuration it runs against a local JSON store
(`apps/web/.data/db.json`) under a fixed development identity — enough to explore the whole product.
Use **Load sample data** on the empty Overview page to populate it.

To use the real stack, see [docs/setup-supabase.md](docs/setup-supabase.md).

### Build and load the extension

```bash
npm run build:ext
```

Then in Chrome:

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `apps/extension/dist`
4. Onboarding opens automatically — upload a resume and you're ready

Open any job listing and click the extension icon.

### Everything else

```bash
npm run typecheck     # whole workspace, strict mode
npm test              # 34 unit tests (scoring, parsing, exports, AI layer)
npm run build         # extension + dashboard
```

---

## Architecture

```
job-tracker/
  apps/
    extension/          Chrome extension (MV3, React, Vite)
    web/                Next.js dashboard (App Router) + REST API
  packages/
    types/              Zod schemas — the single source of truth
    core/               Scoring, extraction, resume parsing, storage, exports
    ai/                 Provider abstraction, prompts, response schemas
    ui/                 Shared components and design tokens
  supabase/migrations/  Database schema and row-level security
  docs/                 Architecture, scoring, providers, security, privacy
```

Packages ship raw TypeScript and are consumed directly by both apps, so there is no build step
between changing a shared type and seeing it enforced on both surfaces.

| Doc | What's in it |
| --- | --- |
| [docs/architecture.md](docs/architecture.md) | Data model, request flows, extension internals |
| [docs/scoring.md](docs/scoring.md) | The scoring engine, weights and why it isn't an LLM |
| [docs/ai-providers.md](docs/ai-providers.md) | The provider abstraction and how to add one |
| [docs/security.md](docs/security.md) | Threat model, prompt injection, API-key handling |
| [docs/privacy.md](docs/privacy.md) | What is stored where, and what leaves the device |
| [docs/setup-supabase.md](docs/setup-supabase.md) | Database and Google sign-in setup |

### Two ideas hold the design together

**The score is computed locally, not by a model.** `packages/core/src/scoring/engine.ts` produces
the number from extracted facts using configurable weights. That's what makes it reproducible,
explainable and improvable — and it's why the product works fully with no API key. The model's job
is interpretation: inferring unstated expectations, spotting vocabulary mismatches, writing prose.

**Every feature degrades instead of failing.** No provider configured, provider down, rate limited,
malformed response — you still get the full local analysis and a clear message about what was
unavailable. No screen can end in a spinner that never resolves.

---

## Modes

### Guest mode (extension)

No account. Resume, tracker, analyses and API key live in `chrome.storage.local` on your machine.
Everything works: analysis, tailoring, cover letters, interview prep, CSV/Excel export.

Local data doesn't sync across devices, and clearing the extension's data removes it permanently.

### Signed in (dashboard)

Google sign-in via Supabase adds cross-device sync, the full application table, resume version
management, analytics and account-level export/deletion. It is never required to use the extension.

### Demo mode

Turn on in Settings to explore every AI-backed feature with bundled sample responses and no API
calls. Demo output is labelled `[Sample]` and the UI shows a persistent banner. It is never enabled
implicitly.

---

## Bring your own key

Choose OpenAI, Anthropic, Gemini or OpenRouter and supply your own key.

- In the extension, the key stays in local extension storage and is sent only to that provider's API
- In the dashboard, it's stored in a table that denies all client roles — reachable only server-side
- It is never logged, never placed in a URL, and is excluded from every export
- Usage is billed to your own provider account, which the UI states plainly

Adding a provider means adding one file and one line in the registry — see
[docs/ai-providers.md](docs/ai-providers.md).

---

## Status

The complete flow works end to end: install → upload resume → configure provider → open a job page →
detect → analyze → score → skills/gaps/ATS → save → track → tailor → cover letter → interview prep →
export.

Known limits, stated honestly:

- **Job detection** uses structured data, per-ATS selectors, semantic HTML and DOM heuristics, with
  AI extraction as a fallback and manual selection always available. Career sites change constantly;
  manual selection is the guaranteed path, not an afterthought.
- **Resume parsing** is best-effort against wildly inconsistent layouts. Parsed fields are always
  presented for correction before they're relied on, and the resume is marked "needs review" until
  you confirm it.
- **The PDF writer** is dependency-free and text-only; it folds accents to ASCII. DOCX export
  preserves full Unicode.
- **The local JSON store** is for development only. Production requires Supabase.
