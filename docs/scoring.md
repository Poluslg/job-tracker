# Scoring methodology

The match score is computed **locally and deterministically** from extracted facts. No language
model produces the number.

That is a deliberate architectural choice, for three reasons:

1. **Reproducibility.** The same resume and posting always yield the same score. A model asked to
   "rate this 0-100" will not do that, and a score that drifts between runs cannot be reasoned about.
2. **Explainability.** Every point is traceable to a component, a weight and a sentence of
   justification. The UI shows the arithmetic, not just the result.
3. **Availability.** The core value of the product works with no API key, no network and no cost.

The model's role is interpretation — inferring unstated expectations, spotting vocabulary
mismatches, and writing specific advice — layered *on top of* a score it is given as a fact.

Implementation: [`packages/core/src/scoring/engine.ts`](../packages/core/src/scoring/engine.ts).
The engine version is stored on every analysis so historic scores stay interpretable.

---

## Components and default weights

| Component | Weight | What it measures |
| --- | ---: | --- |
| Required skills | 30% | Coverage of skills in must-have requirements |
| Preferred skills | 15% | Coverage of nice-to-have and contextual skills |
| Experience | 20% | Total years vs. what the posting asks for |
| Responsibilities | 15% | Whether the resume evidences the day-to-day work |
| Keyword / ATS coverage | 10% | Share of high-signal terms present in the resume |
| Education & certifications | 5% | Degree level vs. stated requirement |
| Domain alignment | 5% | Shared industry context |

Weights are user-configurable in Settings and are **normalised to sum to 1** before use, so a
misconfigured weight cannot inflate the total. The overall score is the weighted sum, clamped to
0-100.

```
overall = Σ (component.score × component.weight)
```

---

## Skill matching

The comparison is deliberately conservative. Skills are resolved through a taxonomy
([`packages/core/src/skills/taxonomy.ts`](../packages/core/src/skills/taxonomy.ts)) that knows
aliases (`js` → JavaScript) and parent/child relationships.

| Situation | Result | Why |
| --- | --- | --- |
| Resume names the exact skill | **Strong** | Direct evidence |
| Resume has a *more specific* skill | **Strong** | React Native demonstrates React |
| Resume has only a *broader* skill | **Partial** | AWS does not demonstrate AWS Lambda |
| No evidence | **Missing** | Reported as a gap, never softened |

`partial` is a first-class outcome with its own rationale string ("Your resume shows AWS, but not
AWS Lambda specifically"). Coverage counts a partial match as half.

Some relationships are deliberately *not* modelled: Kubernetes is not a child of Docker, because
container experience is not orchestration experience and treating it as one would inflate the score.

Every match carries verbatim evidence from both documents, so the UI can show *why* rather than
asserting.

---

## Requirement extraction

Descriptions are split into `must-have`, `nice-to-have`, `responsibility` and `signal` items by a
rule-based pass that follows section headings ("What you'll need", "Nice to have") and inline cues
("required", "a plus", "ideally").

`signal` items are AI interpretation of expectations the posting implies but does not state. They
are always labelled as interpretation in the UI, never as requirements.

When a provider is configured, the model refines this classification; the rule-based result is the
fallback and the starting point, never discarded blindly.

---

## Experience

Employment ranges are parsed from loose resume date formats and **merged before summing**, so
concurrent roles are not double counted. The requirement side takes the highest explicit
years-of-experience demand found in the posting.

| Ratio (resume ÷ required) | Verdict |
| --- | --- |
| ≥ 1.25 | Above |
| ≥ 1.00 | Meets |
| ≥ 0.75 | Near |
| < 0.75 | Below |

When dates can't be read, the verdict is `unknown`, the component scores 40, and the UI says the
estimate is unreliable and asks you to correct your dates — rather than quietly guessing.

---

## ATS analysis

Terms are ranked by a weighted signal rather than raw frequency: multi-word phrases and known
catalog skills outrank incidental repetition, and n-grams contained in a higher-scoring phrase are
dropped ("machine" is not reported alongside "machine learning").

Coverage is the share of the *important* terms (top third, minimum eight) that appear anywhere in
the resume. The analysis also reports title alignment and structural parsing problems (multi-column
spacing, missing standard headings, no detected email, too few bullets).

Missing keywords are shown with an explicit warning: **do not add a keyword unless you genuinely
have that experience.** Padding a resume with terms you cannot discuss does not survive an
interview, and the product will not help you do it.

---

## Bands

| Score | Label |
| --- | --- |
| 80-100 | Strong match |
| 65-79 | Good match |
| 45-64 | Partial match |
| 0-44 | Limited match |

Band labels are checked by a test that asserts none of them contain the words *interview*, *hire*,
*offer*, *chance* or *likely*. The disclaimer shipped alongside every score reads:

> An analytical estimate of how your resume aligns with this posting. It is not a prediction of
> whether you will be contacted, interviewed or hired.

---

## Analytics

`computeAnalytics` derives the funnel from each application's status timeline, using the *furthest
stage reached* rather than the current status — so a rejection after an interview still counts as
having reached the interview stage.

The match-score-versus-outcome chart is descriptive only. It reports what happened in one person's
own history and makes no causal claim; bands with fewer than three applications are rendered at
reduced opacity so a 100% built from a single application does not read as a strong signal. The
surrounding copy states that it cannot account for timing, referrals or applicant volume.
