import { useState } from "react";
import type { Resume, ResumeProfile } from "@job-ai/types";
import {
  Button,
  Card,
  CardBody,
  Input,
  Label,
  Textarea,
  Tabs,
  TabPanel,
} from "@job-ai/ui";
import { Plus, Trash2 } from "lucide-react";
import { MessageError, send } from "../lib/messaging.ts";

export function ProfileEditor({
  resume,
  onSaved,
  onError,
}: {
  resume: Resume;
  onSaved: (resume: Resume) => void;
  onError: (message: string) => void;
}) {
  const [profile, setProfile] = useState<ResumeProfile>(resume.profile);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const result = await send({
        type: "UPDATE_RESUME_PROFILE",
        payload: { id: resume.id, profile },
      });
      onSaved(result.resume);
    } catch (err) {
      onError(
        err instanceof MessageError
          ? err.message
          : "Could not save your changes.",
      );
    } finally {
      setBusy(false);
    }
  };

  const update = <K extends keyof ResumeProfile>(
    key: K,
    value: ResumeProfile[K],
  ) => setProfile((prev) => ({ ...prev, [key]: value }));

  const [activeTab, setActiveTab] = useState("basics");

  const tabItems = [
    { id: "basics", label: "Basics" },
    { id: "experience", label: "Experience", badge: profile.experience.length },
    {
      id: "education",
      label: "Education",
      badge: profile.education.length + profile.certifications.length,
    },
    { id: "projects", label: "Projects", badge: profile.projects.length },
    { id: "skills", label: "Skills & Languages" },
  ];

  return (
    <div className="space-y-4">
      <Tabs items={tabItems} active={activeTab} onChange={setActiveTab} />
      <TabPanel id="basics" active={activeTab}>
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-semibold">Contact</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {(
                  [
                    ["name", "Name"],
                    ["email", "Email"],
                    ["phone", "Phone"],
                    ["location", "Location"],
                    ["linkedin", "LinkedIn"],
                    ["github", "GitHub"],
                    ["portfolio", "Portfolio"],
                  ] as const
                ).map(([key, label]) => (
                  <div key={key}>
                    <Label htmlFor={`contact-${key}`}>{label}</Label>
                    <Input
                      id={`contact-${key}`}
                      value={profile.contact[key]}
                      onChange={(e) =>
                        update("contact", {
                          ...profile.contact,
                          [key]: e.target.value,
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Label htmlFor="summary">Professional summary</Label>
              <Textarea
                id="summary"
                rows={4}
                value={profile.summary}
                onChange={(e) => update("summary", e.target.value)}
                className="text-xs"
              />
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="experience" active={activeTab}>
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-sm font-semibold">
                Experience ({profile.experience.length})
              </h2>
              {profile.experience.map((exp, index) => (
                <div
                  key={exp.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                    {(
                      [
                        ["title", "Title"],
                        ["company", "Company"],
                        ["location", "Location"],
                        ["startDate", "Start"],
                        ["endDate", "End"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <Label htmlFor={`exp-${index}-${key}`}>{label}</Label>
                        <Input
                          id={`exp-${index}-${key}`}
                          value={exp[key] as string}
                          placeholder={
                            key === "endDate" && exp.current ? "Present" : ""
                          }
                          onChange={(e) => {
                            const next = [...profile.experience];
                            next[index] = { ...exp, [key]: e.target.value };
                            update("experience", next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`exp-${index}-tech`}>Technologies</Label>
                    <Input
                      id={`exp-${index}-tech`}
                      value={exp.technologies.join(", ")}
                      placeholder="React, Node.js, TypeScript..."
                      onChange={(e) => {
                        const next = [...profile.experience];
                        next[index] = {
                          ...exp,
                          technologies: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        };
                        update("experience", next);
                      }}
                    />
                  </div>
                  <Textarea
                    rows={3}
                    className="mt-2 text-xs"
                    aria-label={`Bullet points for ${exp.title || "this role"}`}
                    value={[...exp.achievements, ...exp.responsibilities].join(
                      "\n",
                    )}
                    onChange={(e) => {
                      const lines = e.target.value
                        .split("\n")
                        .filter((l) => l.trim());
                      const next = [...profile.experience];
                      next[index] = {
                        ...exp,
                        achievements: [],
                        responsibilities: lines,
                      };
                      update("experience", next);
                    }}
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() =>
                      update(
                        "experience",
                        profile.experience.filter((e2) => e2.id !== exp.id),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove role
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() =>
                  update("experience", [
                    ...profile.experience,
                    {
                      id: crypto.randomUUID(),
                      title: "",
                      company: "",
                      location: "",
                      startDate: "",
                      endDate: "",
                      current: false,
                      responsibilities: [],
                      achievements: [],
                      technologies: [],
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add Experience
              </Button>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="education" active={activeTab}>
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-sm font-semibold">
                Education ({profile.education.length})
              </h2>
              {profile.education.map((edu, index) => (
                <div
                  key={edu.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(
                      [
                        ["degree", "Degree"],
                        ["field", "Field"],
                        ["institution", "Institution"],
                        ["location", "Location"],
                        ["startDate", "Start Date"],
                        ["endDate", "End Date"],
                        ["gpa", "GPA"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <Label htmlFor={`edu-${index}-${key}`}>{label}</Label>
                        <Input
                          id={`edu-${index}-${key}`}
                          value={edu[key] as string}
                          onChange={(e) => {
                            const next = [...profile.education];
                            next[index] = { ...edu, [key]: e.target.value };
                            update("education", next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`edu-${index}-highlights`}>
                      Highlights
                    </Label>
                    <Textarea
                      id={`edu-${index}-highlights`}
                      rows={2}
                      className="text-xs"
                      value={edu.highlights.join("\n")}
                      placeholder="Dean's List, Cum Laude..."
                      onChange={(e) => {
                        const lines = e.target.value
                          .split("\n")
                          .filter((l) => l.trim());
                        const next = [...profile.education];
                        next[index] = { ...edu, highlights: lines };
                        update("education", next);
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() =>
                      update(
                        "education",
                        profile.education.filter((e2) => e2.id !== edu.id),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove education
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() =>
                  update("education", [
                    ...profile.education,
                    {
                      id: crypto.randomUUID(),
                      degree: "",
                      field: "",
                      institution: "",
                      location: "",
                      startDate: "",
                      endDate: "",
                      gpa: "",
                      highlights: [],
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add Education
              </Button>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-sm font-semibold">
                Certifications ({profile.certifications.length})
              </h2>
              {profile.certifications.map((cert, index) => (
                <div
                  key={cert.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    {(
                      [
                        ["name", "Name"],
                        ["issuer", "Issuer"],
                        ["issued", "Date Issued"],
                        ["credentialId", "Credential ID / URL"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <Label htmlFor={`cert-${index}-${key}`}>{label}</Label>
                        <Input
                          id={`cert-${index}-${key}`}
                          value={cert[key] as string}
                          onChange={(e) => {
                            const next = [...profile.certifications];
                            next[index] = { ...cert, [key]: e.target.value };
                            update("certifications", next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() =>
                      update(
                        "certifications",
                        profile.certifications.filter(
                          (c2) => c2.id !== cert.id,
                        ),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove certification
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() =>
                  update("certifications", [
                    ...profile.certifications,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      issuer: "",
                      issued: "",
                      expires: "",
                      credentialId: "",
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add Certification
              </Button>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="projects" active={activeTab}>
        <div className="space-y-4">
          <Card>
            <CardBody className="space-y-4">
              <h2 className="text-sm font-semibold">
                Projects ({profile.projects.length})
              </h2>
              {profile.projects.map((proj, index) => (
                <div
                  key={proj.id}
                  className="rounded-lg border border-border p-3"
                >
                  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {(
                      [
                        ["name", "Project Name"],
                        ["description", "Description"],
                        ["url", "URL"],
                      ] as const
                    ).map(([key, label]) => (
                      <div key={key}>
                        <Label htmlFor={`proj-${index}-${key}`}>{label}</Label>
                        <Input
                          id={`proj-${index}-${key}`}
                          value={proj[key] as string}
                          onChange={(e) => {
                            const next = [...profile.projects];
                            next[index] = { ...proj, [key]: e.target.value };
                            update("projects", next);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`proj-${index}-tech`}>Technologies</Label>
                    <Input
                      id={`proj-${index}-tech`}
                      value={proj.technologies.join(", ")}
                      onChange={(e) => {
                        const next = [...profile.projects];
                        next[index] = {
                          ...proj,
                          technologies: e.target.value
                            .split(",")
                            .map((t) => t.trim())
                            .filter(Boolean),
                        };
                        update("projects", next);
                      }}
                    />
                  </div>
                  <div className="mt-2">
                    <Label htmlFor={`proj-${index}-highlights`}>
                      Highlights
                    </Label>
                    <Textarea
                      id={`proj-${index}-highlights`}
                      rows={2}
                      className="text-xs"
                      value={proj.highlights.join("\n")}
                      onChange={(e) => {
                        const lines = e.target.value
                          .split("\n")
                          .filter((l) => l.trim());
                        const next = [...profile.projects];
                        next[index] = { ...proj, highlights: lines };
                        update("projects", next);
                      }}
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() =>
                      update(
                        "projects",
                        profile.projects.filter((p2) => p2.id !== proj.id),
                      )
                    }
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remove project
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                onClick={() =>
                  update("projects", [
                    ...profile.projects,
                    {
                      id: crypto.randomUUID(),
                      name: "",
                      description: "",
                      url: "",
                      technologies: [],
                      highlights: [],
                    },
                  ])
                }
              >
                <Plus className="mr-2 h-4 w-4" /> Add Project
              </Button>
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <TabPanel id="skills" active={activeTab}>
        <div className="space-y-4">
          <Card>
            <CardBody>
              <Label htmlFor="skills">Skills</Label>
              <Textarea
                id="skills"
                rows={4}
                value={profile.skills.map((s) => s.name).join(", ")}
                onChange={(e) =>
                  update(
                    "skills",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((name) => ({
                        name,
                        category: "technical" as const,
                        years: null,
                      })),
                  )
                }
                className="text-xs"
              />
              <p className="mt-1 text-[11px] text-fg-subtle">
                Comma separated. Only list skills you have actually used — the
                match analysis is only as honest as this list.
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <Label htmlFor="languages">Languages</Label>
              <Textarea
                id="languages"
                rows={2}
                value={profile.languages.join(", ")}
                onChange={(e) =>
                  update(
                    "languages",
                    e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  )
                }
                className="text-xs"
                placeholder="English, Spanish..."
              />
            </CardBody>
          </Card>
        </div>
      </TabPanel>

      <div className="sticky bottom-4 flex justify-end">
        <Button loading={busy} onClick={() => void save()}>
          Save resume
        </Button>
      </div>
    </div>
  );
}
