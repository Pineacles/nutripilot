"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { NavBar } from "@/components/nav-bar";

interface Props {
  title: string;
  /** The page draws its own heading row (Today): keep the title for screen readers only. */
  hideTitle?: boolean;
  children: React.ReactNode;
}

const subscribeNever = () => () => {};

export function DashboardLayout({ title, hideTitle = false, children }: Props) {
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
          <h1 className={hideTitle ? "sr-only" : "mb-6 text-[22px] leading-tight font-semibold tracking-[-0.01em] text-ink"}>{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
