"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, useToast } from "@job-ai/ui";
import { errorMessage, post } from "@/lib/api";

export function SeedDemoButton() {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <Button
      variant="outline"
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await post("/api/demo/seed", {});
          toast("Sample data loaded.", "success");
          router.refresh();
        } catch (err) {
          toast(errorMessage(err, "Could not load sample data."), "error");
        } finally {
          setBusy(false);
        }
      }}
    >
      Load sample data
    </Button>
  );
}
