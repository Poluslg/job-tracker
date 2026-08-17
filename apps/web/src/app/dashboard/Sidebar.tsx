"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bookmark,
  Briefcase,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Layers,
  X,
} from "lucide-react";
import { cn } from "@job-ai/ui";
import { post } from "@/lib/api";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/resume", label: "Resume", icon: FileText },
  { href: "/dashboard/analyzer", label: "Job Analyzer", icon: Search },
  { href: "/dashboard/applications", label: "Applications", icon: Briefcase },
  { href: "/dashboard/saved-jobs", label: "Saved Jobs", icon: Bookmark },
  { href: "/dashboard/versions", label: "Resume Versions", icon: Layers },
  { href: "/dashboard/cover-letters", label: "Cover Letters", icon: Mail },
  {
    href: "/dashboard/interview-prep",
    label: "Interview Prep",
    icon: MessageSquare,
  },
  { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ email, name }: { email: string; name: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await post("/api/auth/logout", {});
    router.push("/login");
    router.refresh();
  };

  const nav = (
    <nav className="flex-1 space-y-0.5 px-3">
      {NAV.map((item) => {
        const Icon = item.icon;

        const active =
          item.href === "/dashboard"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setOpen(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
              active
                ? "bg-brand-subtle font-medium text-brand"
                : "text-fg-muted hover:bg-surface-muted hover:text-fg",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {}
      <div className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand text-[11px] font-bold text-brand-fg">
            AI
          </span>
          <span className="text-sm font-semibold">Career Copilot</span>
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close navigation" : "Open navigation"}
          aria-expanded={open}
          className="rounded-md p-1.5 text-fg-muted hover:bg-surface-muted"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-border bg-surface pt-14 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:pt-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="hidden items-center gap-2 px-5 py-5 lg:flex">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs font-bold text-brand-fg">
            AI
          </span>
          <span className="text-sm font-semibold">Career Copilot</span>
        </div>

        {nav}

        <div className="border-t border-border p-3">
          <p className="truncate px-2 text-xs font-medium text-fg">
            {name || "Signed in"}
          </p>
          <p className="truncate px-2 text-[11px] text-fg-subtle">{email}</p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-fg-muted hover:bg-surface-muted hover:text-fg"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {}
      <div className="h-14 lg:hidden" aria-hidden="true" />
    </>
  );
}
