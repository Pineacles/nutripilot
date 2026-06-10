"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { NavBar } from "@/components/nav-bar";

interface Props {
  title: string;
  children: React.ReactNode;
}

export function DashboardLayout({ title, children }: Props) {
  const router = useRouter();
  // Derive auth status during render — avoids calling setState synchronously
  // inside an effect (react-hooks/set-state-in-effect).
  const authed = isLoggedIn();

  useEffect(() => {
    if (!authed) {
      router.replace("/login");
    }
  }, [authed, router]);

  if (!authed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <NavBar />
      <main className="lg:ml-56 pb-20 lg:pb-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-xl font-semibold text-foreground mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
