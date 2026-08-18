import type { ExtensionState } from "@job-ai/types";
import { Badge, Tabs } from "@job-ai/ui";
import { Settings } from "lucide-react";
import type { PopupTab } from "../App.tsx";

export function Header({
  tab,
  onTabChange,
  state,
  onOpenSettings,
  applicationCount,
}: {
  tab: PopupTab;
  onTabChange: (tab: PopupTab) => void;
  state: ExtensionState | null;
  onOpenSettings: () => void;
  applicationCount: number;
}) {
  return (
    <header className="border-b border-border bg-surface">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand text-[11px] font-bold text-brand-fg">
            AI
          </span>
          <span className="truncate text-sm font-semibold">Career Copilot</span>
          {state && !state.aiConfigured && (
            <Badge tone="warn" size="sm">
              No AI key
            </Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Open settings"
          className="rounded-md p-1.5 text-fg-muted hover:bg-surface-muted hover:text-fg"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>

      <Tabs
        size="sm"
        className="border-b-0 px-3"
        active={tab}
        onChange={(id) => onTabChange(id as PopupTab)}
        items={[
          { id: "analyze", label: "Analyze" },
          { id: "tracker", label: "Tracker", badge: applicationCount },
        ]}
      />
    </header>
  );
}
