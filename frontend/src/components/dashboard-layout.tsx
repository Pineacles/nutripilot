"use client";

import { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { isLoggedIn } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { NavBar } from "@/components/nav-bar";
import { SettingsLink } from "@/components/settings-link";

interface Props {
  title: string;
  /** The page draws its own heading row (Today): keep the title for screen readers only. */
  hideTitle?: boolean;
  /** A back chevron before the title, for pages that are no longer a tab. */
  backHref?: string;
  backLabel?: string;
  /** A page action at the right of the default title row; the settings gear sits after it. */
  headerAction?: React.ReactNode;
  children: React.ReactNode;
}

const subscribeNever = () => () => {};

export function DashboardLayout({ title, hideTitle = false, headerAction, backHref, backLabel, children }: Props) {
  const router = useRouter();
  // localStorage only exists on the client: read it through useSyncExternalStore so the
  // server and first client render agree (spinner), avoiding a hydration mismatch.
  const authed = useSyncExternalStore(subscribeNever, isLoggedIn, () => null);

  useEffect(() => {
    if (authed === false) {
      router.replace("/login");
    }
  }, [authed, router]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-g3 border-t-ink motion-reduce:animate-none" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-medium focus:text-g0"
      >
        Skip to content
      </a>
      <Sidebar />
      <NavBar />
      <main id="main-content" tabIndex={-1} className="lg:ml-56 pb-20 lg:pb-0 outline-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {hideTitle ? (
            <h1 className="sr-only">{title}</h1>
          ) : (
            <div className="mb-6 flex items-center justify-between gap-3">
              <div className="flex min-w-0 flex-1 items-center gap-1">
                {backHref && (
                  <Link
                    href={backHref}
                    aria-label={backLabel ?? "Back"}
                    className="-ml-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-g5 transition-colors hover:bg-g2 hover:text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink"
                  >
                    <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                  </Link>
                )}
                <h1 className="text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink">{title}</h1>
              </div>
              {headerAction}
              <SettingsLink className="-mr-2" />
            </div>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}
