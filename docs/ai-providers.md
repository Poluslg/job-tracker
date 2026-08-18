# AI provider abstraction

Nothing above the provider layer knows which vendor is in use. The application depends on one
interface; swapping OpenAI for Anthropic changes a dropdown, not a code path.

```
AIProvider (interface)
 ├── OpenAIProvider
 ├── AnthropicProvider
 ├── GeminiProvider
 ├── OpenRouterProvider
 └── MockProvider        (demo mode / development fixtures)
```

## The interface

```ts
interface AIProvider {
  readonly id: AIProviderId;
  readonly meta: AIProviderMeta;
  complete(req: AICompletionRequest): Promise<AICompletionResponse>;
  testConnection(signal?: AbortSignal): Promise<{ ok: true } | { ok: false; error: AIError }>;
}
```

Providers do one thing: turn a request into text. They do not know about resumes, scoring or job
descriptions. Everything domain-specific lives in `CareerAI`
([`packages/ai/src/services/career.ts`](../packages/ai/src/services/career.ts)), which exposes the
application-level operations:

```ts
analyzeJob(resume, job, options)
tailorResume(resume, job, analysis, options)
generateCoverLetter(resume, job, options)
generateInterviewPrep(resume, job, analysis, options)
extractJobFromText(url, title, text)
```

## Adding a provider

1. Create `packages/ai/src/providers/<vendor>.ts` exporting a `<Vendor>Provider` class and a
   `<VENDOR>_META` object
2. Add one line to the `switch` in `providers/registry.ts` and one entry to `SELECTABLE_PROVIDERS`
3. Add the API origin to `host_permissions` in the extension manifest

That's the whole change. The meta object drives the settings UI — display name, key URL, model list
and default model are all read from it.

Use `postJson()` from `providers/base.ts` for the request: it applies the timeout, maps HTTP status
codes to typed `AIError`s, and deliberately logs nothing (headers and bodies contain keys and
resumes).

## Error handling

Every failure becomes an `AIError` with a code the UI can act on:

| Code | Retryable | User-facing meaning |
| --- | --- | --- |
| `no-key` | no | No key configured — local analysis still available |
| `invalid-key` | no | Provider rejected the key |
| `rate-limited` | yes | Backed off and retried once |
| `quota-exceeded` | no | Provider account out of credit |
| `unavailable` | yes | Provider 5xx |
| `network` / `timeout` | yes | Connection failed or exceeded 90s |
| `too-large` | no | Input exceeded the model's limit |
| `invalid-response` | yes | Output didn't match the schema |
| `blocked` | no | Provider refused the request |

`AI_ERROR_MESSAGES` maps each to copy that tells the user what to do next. No spinner is ever left
running.

## Structured output

Requests carry a JSON Schema derived from the Zod response schema, and each provider uses whatever
constrained-decoding mechanism it has:

- **OpenAI / OpenRouter** — `response_format: { type: 'json_schema' }`
- **Gemini** — `responseMimeType: 'application/json'` plus `responseSchema` (unsupported keywords
  like `additionalProperties` are stripped rather than failing the request)
- **Anthropic** — no schema mode, so the assistant turn is prefilled with `{` to force a bare object

## Validation, repair, retry

`runPrompt()` never returns a half-parsed object. Models add prose, markdown fences and trailing
commentary even when told not to, so:

1. `repairJson()` strips fences and extracts the outermost balanced object, ignoring braces inside
   strings, and closes objects truncated by a token limit
2. The result is parsed through the Zod schema
3. On failure, one retry restates the format requirement
4. On repeated failure, a typed `AIError` is thrown and the caller falls back to the deterministic
   result

## Prompts

Versioned and separated by task in `packages/ai/src/prompts/`:

```
shared.ts          CORE_RULES, UNTRUSTED_CONTENT_RULES, fencing, redaction
jobExtraction.ts   job-extraction@1.0.0, requirements@1.0.0
resumeParse.ts     resume-parse@1.0.0
matchInsights.ts   match-insights@1.0.0
tailorResume.ts    tailor-resume@1.0.0
coverLetter.ts     cover-letter@1.0.0
interviewPrep.ts   interview-prep@1.0.0
```

The prompt version is stored on each generated record, so output remains attributable after a prompt
is improved.

Every system prompt begins with `CORE_RULES`, which are product rules rather than style preferences:
never invent employment, education, titles, dates, credentials, skills, metrics or outcomes; flag
anything needing unavailable information; never present a broader skill as a specific one; never
encourage keyword stuffing; never imply a prediction of hiring outcomes.

Two prompts are worth reading for how the boundary is drawn:

- **match-insights** is told the score as a *fact* and explicitly instructed not to compute or revise
  it. Its job is interpretation.
- **interview-prep** must produce answer *frameworks*, never first-person answers — the product will
  not hand someone a fabricated story they might repeat in a room where it would be checked.

## Demo mode

`MockProvider` returns schema-valid fixtures for every task, with visible `[Sample]` markers. It is
never selected implicitly: the user must enable demo mode or pick it explicitly, and every surface
rendering demo output shows a banner. This is what makes the full UI testable with no key.
