import assert from "node:assert/strict";
import test from "node:test";

import {
  Application,
  DEFAULT_SETTINGS,
  JobPosting,
  UpdateApplicationRequest,
  UserSettings,
} from "../src/index.ts";

test("settings parse from an empty object and never ship a key", () => {
  const settings = UserSettings.parse({});
  assert.equal(settings.authMode, "guest");
  assert.equal(settings.ai.apiKey, "");
  assert.equal(settings.demoMode, false, "demo mode must never be implicit");
  assert.equal(
    settings.privacy.redactContactInfo,
    true,
    "redaction is on by default",
  );
  assert.equal(
    settings.privacy.shareAnonymousUsage,
    false,
    "telemetry is opt-in",
  );
  assert.equal(settings.privacy.syncEnabled, false, "sync is opt-in");
});

test("default scoring weights sum to 1", () => {
  const total = Object.values(DEFAULT_SETTINGS.scoring).reduce(
    (a, b) => a + b,
    0,
  );
  assert.ok(Math.abs(total - 1) < 1e-9, `weights sum to ${total}`);
});

test("a partial patch schema re-applies defaults for absent fields", () => {
  const parsed = UpdateApplicationRequest.parse({ status: "applied" });

  assert.equal(parsed.status, "applied");
  assert.equal(
    parsed.company,
    "",
    "absent fields come back at their default, not undefined",
  );
  assert.equal(parsed.matchScore, null);
  assert.ok(
    Object.keys(parsed).length > 5,
    "PATCH handlers must narrow to the keys the client actually sent",
  );
});

test("a job posting parses from a bare description", () => {
  const job = JobPosting.parse({
    id: "job_1",
    description: "Some description",
    capturedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  assert.equal(job.platform, "generic");
  assert.equal(job.employmentType, "unknown");
  assert.deepEqual(job.requirements, []);
  assert.equal(job.salary.raw, "");
});

test("an application requires a discovery timestamp and defaults to saved", () => {
  const now = new Date().toISOString();
  const app = Application.parse({
    id: "a",
    jobId: "j",
    discoveredAt: now,
    createdAt: now,
    updatedAt: now,
  });
  assert.equal(app.status, "saved");
  assert.equal(app.appliedAt, null);
  assert.deepEqual(app.timeline, []);
});
