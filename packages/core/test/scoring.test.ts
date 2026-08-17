import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DataStore,
  MemoryAdapter,
  SCORING_ENGINE_VERSION,
  applicationFromJob,
  buildResumeSkillIndex,
  compareSkills,
  computeAnalysis,
  computeAnalytics,
  createSampleJob,
  createSampleResume,
  detectSkills,
  exportTrackerCsv,
  exportTrackerXlsx,
  extractRequirements,
  matchSkill,
  normalizeWeights,
  parseResumeText,
  scoreBand,
  toAnalysisRecord,
  totalExperienceYears,
} from '../src/index.ts';
import { DEFAULT_SETTINGS } from '@job-ai/types';

const resume = createSampleResume();
const job = createSampleJob();

test('resume parser extracts contact, experience and education', () => {
  const profile = parseResumeText(resume.origin.rawText);
  assert.equal(profile.contact.email, 'alex.rivera@example.com');
  assert.match(profile.contact.name, /Alex Rivera/);
  assert.ok(profile.contact.linkedin.includes('linkedin.com/in/alexrivera'));
  assert.ok(profile.experience.length >= 3, 'expected three roles');
  assert.equal(profile.experience[0]?.current, true);
  assert.ok(profile.education.length >= 1);
  assert.ok(profile.skills.some((s) => s.name === 'TypeScript'));
});

test('total experience merges overlapping roles', () => {
  const years = totalExperienceYears(resume.profile);
  assert.ok(years !== null && years > 5 && years < 20, `unexpected years: ${years}`);
});

test('requirement extraction separates must-have from nice-to-have', () => {
  const reqs = extractRequirements(job.description);
  const must = reqs.filter((r) => r.kind === 'must-have');
  const nice = reqs.filter((r) => r.kind === 'nice-to-have');
  const resp = reqs.filter((r) => r.kind === 'responsibility');

  assert.ok(must.length >= 4, `must-have: ${must.length}`);
  assert.ok(nice.length >= 3, `nice-to-have: ${nice.length}`);
  assert.ok(resp.length >= 4, `responsibilities: ${resp.length}`);
  assert.ok(must.some((r) => r.yearsRequired === 5), 'should read "5+ years"');
});

test('broader resume skill yields a PARTIAL match, not a strong one', () => {
  const index = buildResumeSkillIndex(
    { ...resume.profile, skills: [{ name: 'AWS', category: 'technical', years: null }] },
    'Worked with AWS.',
  );
  const match = matchSkill(index, 'AWS Lambda', true, 'Experience with AWS Lambda required.');
  assert.equal(match.quality, 'partial');
  assert.match(match.rationale, /AWS/);
});

test('more specific resume skill satisfies the broader requirement', () => {
  const index = buildResumeSkillIndex(
    { ...resume.profile, skills: [{ name: 'React Native', category: 'technical', years: null }] },
    'Built apps in React Native.',
  );
  const match = matchSkill(index, 'React', true, 'React experience required.');
  assert.equal(match.quality, 'strong');
});

test('missing skills are reported as missing with no invented evidence', () => {
  const index = buildResumeSkillIndex(resume.profile, resume.origin.rawText);
  const match = matchSkill(index, 'Kubernetes', true, 'Kubernetes experience.');
  assert.equal(match.quality, 'missing');
  assert.deepEqual(match.resumeEvidence, []);
});

test('scoring is deterministic and explainable', () => {
  const input = { profile: resume.profile, resumeText: resume.origin.rawText, job };
  const a = computeAnalysis(input);
  const b = computeAnalysis(input);

  assert.equal(a.score.overall, b.score.overall);
  assert.equal(a.score.engineVersion, SCORING_ENGINE_VERSION);
  assert.equal(a.score.components.length, 7);
  for (const c of a.score.components) {
    assert.ok(c.explanation.length > 10, `component ${c.key} must explain itself`);
    assert.ok(c.score >= 0 && c.score <= 100);
  }
  const weightSum = a.score.components.reduce((s, c) => s + c.weight, 0);
  assert.ok(Math.abs(weightSum - 1) < 1e-9, `weights must sum to 1, got ${weightSum}`);
  assert.ok(a.score.overall > 45, `sample resume should match sample job well: ${a.score.overall}`);
});

test('weights are normalised even when misconfigured', () => {
  const w = normalizeWeights({ ...DEFAULT_SETTINGS.scoring, requiredSkills: 3 });
  const sum = Object.values(w).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
});

test('analysis surfaces required gaps and never fabricates', () => {
  const analysis = computeAnalysis({
    profile: resume.profile,
    resumeText: resume.origin.rawText,
    job,
  });
  const kubernetes = analysis.skills.find((s) => s.skill === 'Kubernetes');
  assert.ok(kubernetes, 'Kubernetes should be detected in the posting');
  assert.equal(kubernetes?.quality, 'missing');

  const risky = analysis.recommendations.filter((r) => r.needsUserConfirmation);
  assert.ok(risky.length > 0, 'gap-filling advice must be flagged for confirmation');
});

test('score bands never claim a hiring outcome', () => {
  for (const s of [10, 50, 70, 95]) {
    assert.doesNotMatch(scoreBand(s).label, /interview|hire|offer|chance|likel/i);
  }
});

test('ATS analysis reports coverage and missing keywords', () => {
  const analysis = computeAnalysis({
    profile: resume.profile,
    resumeText: resume.origin.rawText,
    job,
  });
  assert.ok(analysis.ats.coverage >= 0 && analysis.ats.coverage <= 100);
  assert.ok(analysis.ats.found.length > 0);
  assert.ok(analysis.ats.missing.every((k) => k.unsupported));
});

test('skill detection handles punctuation-heavy names', () => {
  const found = detectSkills('Experience with C++, C#, Node.js and Next.js.');
  for (const expected of ['C++', 'C#', 'Node.js', 'Next.js']) {
    assert.ok(found.includes(expected), `missing ${expected} in ${found.join(', ')}`);
  }
});

test('compareSkills treats catalog skills outside requirements as preferred', () => {
  const index = buildResumeSkillIndex(resume.profile, resume.origin.rawText);
  const { matches } = compareSkills(index, extractRequirements(job.description), job.description);
  assert.ok(matches.some((m) => m.required), 'expected required matches');
  assert.ok(matches.some((m) => !m.required), 'expected preferred matches');
});

test('data store round-trips applications and records status history', async () => {
  const store = new DataStore(new MemoryAdapter());
  await store.init();
  const savedJob = await store.saveJob(job);
  const app = await store.saveApplication(applicationFromJob(savedJob, { status: 'saved' }));

  const updated = await store.updateApplication(app.id, { status: 'applied' });
  assert.equal(updated?.status, 'applied');
  assert.ok(updated?.appliedAt, 'appliedAt should be stamped automatically');
  assert.equal(updated?.timeline.length, 2);

  await store.saveJob({ ...job, id: 'different-id' });
  assert.equal((await store.getJobs()).length, 1);
});

test('exports excluded the API key and produce valid files', async () => {
  const store = new DataStore(new MemoryAdapter());
  await store.init();
  await store.updateSettings({ ai: { ...DEFAULT_SETTINGS.ai, apiKey: 'sk-secret-value' } });
  const dump = JSON.stringify(await store.exportAll());
  assert.ok(!dump.includes('sk-secret-value'), 'API keys must never appear in exports');
});

test('CSV export escapes formulas and Excel export is a valid zip', () => {
  const app = applicationFromJob(job, { status: 'applied' });
  const evil = { ...app, notes: '=HYPERLINK("http://evil","click")' };

  const csv = exportTrackerCsv([evil]);
  const text = new TextDecoder().decode(csv.bytes);
  assert.ok(text.includes(`"'=HYPERLINK`), 'leading = must be neutralised');

  const xlsx = exportTrackerXlsx([app]);
  assert.equal(xlsx.bytes[0], 0x50); 
  assert.equal(xlsx.bytes[1], 0x4b); 
  assert.ok(xlsx.bytes.length > 500);
});

test('analytics computes a funnel without claiming causation', () => {
  const app = applicationFromJob(job, { status: 'saved' });
  
  const thinProfile = { ...resume.profile, skills: [], experience: [], projects: [] };
  const analysis = toAnalysisRecord(
    computeAnalysis({ profile: thinProfile, resumeText: 'Alex Rivera. Wrote some HTML.', job }),
    job.id,
    resume.id,
  );
  const applied = {
    ...app,
    status: 'interview' as const,
    matchScore: 82,
    appliedAt: new Date().toISOString(),
    timeline: [
      ...app.timeline,
      { id: 'e1', at: new Date().toISOString(), type: 'status-change' as const, from: 'saved' as const, to: 'applied' as const, text: '' },
      { id: 'e2', at: new Date().toISOString(), type: 'status-change' as const, from: 'applied' as const, to: 'interview' as const, text: '' },
    ],
  };

  const analytics = computeAnalytics([applied], [analysis], 1);
  assert.equal(analytics.totals.applications, 1);
  assert.equal(analytics.totals.interviews, 1);
  assert.equal(analytics.interviewRate, 100);
  assert.ok(analytics.funnel.find((f) => f.stage === 'applied')?.count === 1);
  assert.ok(analytics.skillGaps.length > 0, 'expected skill gaps from the analysis');
});
