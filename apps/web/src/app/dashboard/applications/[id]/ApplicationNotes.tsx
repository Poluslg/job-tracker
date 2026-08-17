"use client";

import { useState } from "react";
import { Button, Card, CardBody, Textarea, useToast } from "@job-ai/ui";
import { errorMessage, patch } from "@/lib/api";

export function ApplicationNotes({
  id,
  initialNotes,
}: {
  id: string;
  initialNotes: string;
}) {
  const [notes, setNotes] = useState(initialNotes);
  const [saved, setSaved] = useState(initialNotes);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  const save = async () => {
    setBusy(true);
    try {
      await patch(`/api/applications/${id}`, { notes });
      setSaved(notes);
      toast("Notes saved.", "success");
    } catch (err) {
      toast(errorMessage(err, "Could not save your notes."), "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <CardBody>
        <label htmlFor="notes" className="mb-2 block text-sm font-semibold">
          Notes
        </label>
        <Textarea
          id="notes"
          rows={6}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Recruiter conversations, salary discussions, follow-up dates…"
          className="text-xs"
        />
        {notes !== saved && (
          <div className="mt-2 flex gap-2">
            <Button size="sm" loading={busy} onClick={() => void save()}>
              Save notes
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNotes(saved)}>
              Discard
            </Button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
