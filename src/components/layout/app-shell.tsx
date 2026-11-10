"use client";

import { useState, type ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  flush?: boolean;
}

export function AppShell({
  title,
  subtitle,
  actions,
  children,
  flush = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div
      className={cn(
        "flex h-dvh overflow-hidden bg-ink-50 dark:bg-ink-900",
        !flush && "min-h-screen",
      )}
    >
      {/* Fixed Sidebar */}
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <div className="flex min-w-0 min-h-0 flex-1 flex-col">
        {/* Fixed Topbar */}
        <div className="shrink-0">
          <Topbar
            title={title}
            subtitle={subtitle}
            actions={actions}
            onMenu={() => setMenuOpen(true)}
          />
        </div>

        <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
