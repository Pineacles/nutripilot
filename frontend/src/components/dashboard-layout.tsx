"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

interface Props {
  title: string;
  children: React.ReactNode;
}

export function DashboardLayout({ title, children }: Props) {
  const router = useRouter();

  useEffect(() => {
    if (!isLoggedIn()) router.replace("/login");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      <Sidebar />
      <main className="ml-56">
        <div className="max-w-7xl mx-auto px-8 py-6">
          <h1 className="text-xl font-semibold text-white mb-6">{title}</h1>
          {children}
        </div>
      </main>
    </div>
  );
}
