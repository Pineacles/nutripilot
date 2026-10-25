"use client";

import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth";
import { InstallCard } from "@/components/install-card";

/** The install card, then Sign out last and set apart. */
export function AppContent() {
  return (
    <div>
      <InstallCard />
      <button
        type="button"
        onClick={signOut}
        className="mt-16 flex min-h-[60px] w-full items-center gap-3 border-t border-g2 text-[15px] text-g5 transition-colors duration-[var(--dur-fast)] hover:text-ink"
      >
        <LogOut className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}
