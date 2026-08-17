import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const userId = process.argv[2];
  if (!userId) {
    console.error('Error: Please provide the UUID of the dummy user.');
    console.error('Usage: npx tsx apps/web/prisma/migrate.ts <UUID>');
    process.exit(1);
  }

  const dbPath = path.join(process.cwd(), 'apps', 'web', '.data', 'db.json');
  if (!fs.existsSync(dbPath)) {
    console.error(`Error: Data file not found at ${dbPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dbPath, 'utf8');
  const parsed = JSON.parse(rawData);
  const localData = parsed.data['local-dev-user'];

  if (!localData) {
    console.error('Error: "local-dev-user" data not found in db.json');
    process.exit(1);
  }

  console.log(`Starting migration for dummy user ${userId}...`);

  await prisma.$transaction(async (tx) => {
    // 1. Resumes
    if (localData.resumes) {
      for (const res of localData.resumes) {
        await tx.resume.create({
          data: {
            id: res.id,
            userId,
            label: res.label || 'My Resume',
            isDefault: res.isDefault || false,
            data: res as any,
            createdAt: res.createdAt ? new Date(res.createdAt) : new Date(),
            updatedAt: res.updatedAt ? new Date(res.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${localData.resumes.length} resumes.`);
    }

    // 2. Resume Versions
    if (localData.resumeVersions) {
      for (const ver of localData.resumeVersions) {
        await tx.resumeVersion.create({
          data: {
            id: ver.id,
            userId,
            resumeId: ver.resumeId,
            jobId: ver.jobId || null,
            name: ver.name || 'Version',
            kind: ver.kind || 'manual',
            data: ver as any,
            createdAt: ver.createdAt ? new Date(ver.createdAt) : new Date(),
            updatedAt: ver.updatedAt ? new Date(ver.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${localData.resumeVersions.length} resume versions.`);
    }

    // 3. Jobs
    if (localData.jobs) {
      for (const job of localData.jobs) {
        await tx.job.create({
          data: {
            id: job.id,
            userId,
            fingerprint: job.fingerprint || job.id,
            title: job.title || '',
            company: job.company || '',
            url: job.url || '',
            data: job as any,
            capturedAt: job.capturedAt ? new Date(job.capturedAt) : new Date(),
            createdAt: job.createdAt ? new Date(job.createdAt) : new Date(),
            updatedAt: job.updatedAt ? new Date(job.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${localData.jobs.length} jobs.`);
    }

    // 4. Analyses
    if (localData.analyses) {
      for (const analysis of localData.analyses) {
        await tx.analysis.create({
          data: {
            id: analysis.id,
            userId,
            jobId: analysis.jobId,
            resumeId: analysis.resumeId,
            overallScore: analysis.overallScore || 0,
            mode: analysis.mode || 'local',
            data: analysis as any,
            createdAt: analysis.createdAt ? new Date(analysis.createdAt) : new Date(),
            updatedAt: analysis.updatedAt ? new Date(analysis.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${localData.analyses.length} analyses.`);
    }

    // 5. Applications
    if (localData.applications) {
      for (const app of localData.applications) {
        await tx.application.create({
          data: {
            id: app.id,
            userId,
            jobId: app.jobId,
            status: app.status || 'saved',
            company: app.company || '',
            title: app.title || '',
            matchScore: app.matchScore || null,
            discoveredAt: app.discoveredAt ? new Date(app.discoveredAt) : new Date(),
            appliedAt: app.appliedAt ? new Date(app.appliedAt) : null,
            data: app as any,
            createdAt: app.createdAt ? new Date(app.createdAt) : new Date(),
            updatedAt: app.updatedAt ? new Date(app.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${localData.applications.length} applications.`);
    }

    // 6. Cover Letters
    if (localData.coverLetters) {
      for (const cl of localData.coverLetters) {
        await tx.coverLetter.create({
          data: {
            id: cl.id,
            userId,
            jobId: cl.jobId,
            data: cl as any,
            createdAt: cl.createdAt ? new Date(cl.createdAt) : new Date(),
            updatedAt: cl.updatedAt ? new Date(cl.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${localData.coverLetters.length} cover letters.`);
    }

    // 7. Interview Preps
    if (localData.interviewPreps) {
      for (const prep of localData.interviewPreps) {
        await tx.interviewPrep.create({
          data: {
            id: prep.id,
            userId,
            jobId: prep.jobId,
            applicationId: prep.applicationId || null,
            data: prep as any,
            createdAt: prep.createdAt ? new Date(prep.createdAt) : new Date(),
            updatedAt: prep.updatedAt ? new Date(prep.updatedAt) : new Date(),
          },
        });
      }
      console.log(`Migrated ${localData.interviewPreps.length} interview preps.`);
    }

    // 8. User Settings
    if (localData.settings) {
      await tx.userSettings.create({
        data: {
          userId,
          data: localData.settings as any,
          updatedAt: new Date(),
        },
      });
      console.log(`Migrated user settings.`);
    }
  });

  console.log('Migration completed successfully!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
