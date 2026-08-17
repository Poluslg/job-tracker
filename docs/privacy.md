# Privacy

Privacy is a product feature here, not a policy page. This document describes what the code actually
does.

## Principles

1. **Guest mode is genuinely local.** No account, no server, nothing leaves your machine except the
   requests you explicitly trigger to your own AI provider.
2. **Minimal collection.** Only what a feature needs, stored where the user can see and delete it.
3. **No training, no selling.** Resume data is never used to train models and is never sold. There is
   no code path that sends resume content anywhere except the provider the user configured.
4. **Deletion is real.** Deleting removes rows; there is no soft delete and no retention window.

## Where data lives

| Data | Guest (extension) | Signed in (dashboard) |
| --- | --- | --- |
| Resume text and parsed profile | `chrome.storage.local` | Postgres, RLS-protected |
| Resume versions | `chrome.storage.local` | Postgres |
| Jobs, analyses, applications | `chrome.storage.local` | Postgres |
| Cover letters, interview prep | `chrome.storage.local` | Postgres |
| API key | `chrome.storage.local` | `ai_credentials` — denied to all client roles |
| Settings | `chrome.storage.local` | Postgres |

`chrome.storage.local` rather than `sync`: sync would push career data to Google's servers, which is
not what "your data stays on your device" should mean — and resumes exceed the sync quota anyway.

## What reaches an AI provider

Only when you run a feature that needs one: analysis, tailoring, a cover letter or interview prep.
Nothing is sent while you browse.

Sent: the job description, your resume text, and the deterministic analysis summary.
Not sent: your tracker, your other applications, your other resumes, or your API key to anyone but
that provider.

**Contact redaction is on by default.** Email addresses and phone numbers are replaced with
placeholders before resume text is sent. Turn it off in Settings if you want the model to work with
the full document.

Requests go directly from your browser (or the dashboard server) to the provider you chose, using
your key. There is no proxy, so there is no server of ours that could see the content.

## What is never collected

- No analytics on resume, job or analysis content
- No third-party logging or error-reporting services receive request bodies
- Anonymous usage counts are **opt-in**, off by default, and never include content
- No tracking pixels, no ad networks, no session recording

## Your controls

Extension → Settings → Privacy & data, or Dashboard → Settings:

- **Export** — tracker as CSV or Excel, everything as JSON
- **Delete tracker & saved jobs** — applications, jobs, analyses, cover letters, interview prep
- **Delete resumes & versions**
- **Delete everything** — all local extension data, including the API key and settings
- **Delete account** — removes the account and every row attached to it

Every destructive action requires an explicit confirmation step. Exports exclude the API key.

## Job description snapshots

A point-in-time copy of each description is stored so your tracker stays readable after a posting is
taken down. This can be turned off in Settings; existing snapshots are removed when you clear
tracker data.

## Third parties

| Service | Role | What it sees |
| --- | --- | --- |
| Your AI provider | Analysis and generation | Job descriptions and resume text you submit |
| Supabase | Database and auth (signed-in only) | Your stored records; the operator is you |
| Google | Sign-in only (signed-in only) | That you signed in. Only `openid`, `email`, `profile` are requested |

Guest mode uses none of them except your AI provider.
