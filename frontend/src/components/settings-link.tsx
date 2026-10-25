"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings } from "lucide-react";

/** Settings on phones and tablets: a gear at the right of a page's header row. The sidebar carries it on desktop. */
export function SettingsLink({ className = "" }: { className?: string }) {
  const pathname = usePathname();
  const active = pathname === "/settings" || pathname.startsWith("/settings/");
  if (active) return null;
  return (
    <Link
      href="/settings"
      aria-label="Settings"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-g5 transition-colors hover:bg-g2 hover:text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink lg:hidden ${className}`}
    >
      <Settings className="h-5 w-5" aria-hidden="true" />
    </Link>
  );
}
