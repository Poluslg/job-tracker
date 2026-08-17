import { Badge, Card, CardBody, EmptyState } from "@job-ai/ui";
import { Mail } from "lucide-react";
import { loadUserData } from "@/server/data";
import { LinkButton } from "@/components/LinkButton";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Cover Letters" };
export const dynamic = "force-dynamic";

export default async function CoverLettersPage() {
  const { data } = await loadUserData();
  const letters = [...data.coverLetters].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <>
      <PageHeader
        title="Cover Letters"
        description="Drafts generated from your resume and a specific posting. Always read one before sending it."
      />

      {letters.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Mail className="h-8 w-8" strokeWidth={1.5} />}
            title="No cover letters yet"
            description="Analyze a job, then choose “Generate cover letter” in the extension or from an application."
            action={
              <LinkButton href="/dashboard/analyzer">Analyze a job</LinkButton>
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {letters.map((letter) => (
            <Card key={letter.id}>
              <CardBody>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-fg">
                      {letter.title || "Untitled role"}
                    </p>
                    <p className="text-xs text-fg-muted">{letter.company}</p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <Badge size="sm">{letter.tone}</Badge>
                    {letter.edited && (
                      <Badge size="sm" tone="brand">
                        Edited
                      </Badge>
                    )}
                  </div>
                </div>

                <p className="mt-3 line-clamp-4 text-xs leading-relaxed whitespace-pre-wrap text-fg-muted">
                  {letter.body}
                </p>

                {letter.needsConfirmation.length > 0 && (
                  <div className="mt-3 rounded-lg border border-warn/30 bg-warn-subtle px-3 py-2">
                    <p className="text-[11px] font-medium text-warn">
                      Check before sending
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {letter.needsConfirmation.map((item, i) => (
                        <li key={i} className="text-[11px] text-warn">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <p className="mt-2 text-[11px] text-fg-subtle">
                  Created {new Date(letter.createdAt).toLocaleDateString()}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
