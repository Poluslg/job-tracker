import { Badge, Card, CardBody, EmptyState } from "@job-ai/ui";
import { Layers } from "lucide-react";
import { loadUserData } from "@/server/data";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Resume Versions" };
export const dynamic = "force-dynamic";

const KIND_LABEL = {
  base: "Base",
  tailored: "Tailored",
  manual: "Manual",
} as const;

export default async function VersionsPage() {
  const { data } = await loadUserData();
  const versions = [...data.resumeVersions].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
  const usage = new Map<string, number>();
  for (const app of data.applications) {
    if (app.resumeVersionId)
      usage.set(app.resumeVersionId, (usage.get(app.resumeVersionId) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader
        title="Resume Versions"
        description="Keep a named variant per role type, and record which one you used for each application."
        actions={
          <LinkButton href="/dashboard/analyzer" variant="outline">
            Tailor for a job
          </LinkButton>
        }
      />

      {versions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Layers className="h-8 w-8" strokeWidth={1.5} />}
            title="No resume versions yet"
            description="Tailor your resume for a specific job from the extension, and the version is saved here automatically."
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {versions.map((version) => (
            <Card key={version.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      {version.name}
                    </p>
                    {version.notes && (
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {version.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge
                      tone={version.kind === "tailored" ? "brand" : "neutral"}
                      size="sm"
                    >
                      {KIND_LABEL[version.kind]}
                    </Badge>
                    <Badge size="sm">
                      Used in {usage.get(version.id) ?? 0}{" "}
                      {(usage.get(version.id) ?? 0) === 1
                        ? "application"
                        : "applications"}
                    </Badge>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-fg-subtle">
                  Created {new Date(version.createdAt).toLocaleDateString()} ·{" "}
                  {version.profile.skills.length} skills ·{" "}
                  {version.profile.experience.length} roles
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
