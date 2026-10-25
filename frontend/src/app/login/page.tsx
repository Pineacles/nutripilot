"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InstallCard } from "@/components/install-card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const ok = await login(email, password);
    setLoading(false);
    if (ok) {
      router.push("/today");
    } else {
      setError("Invalid credentials");
    }
  }

  async function handleDemo() {
    setError("");
    setDemoLoading(true);
    const ok = await login("demo@nutripilot.dev", "demo");
    setDemoLoading(false);
    if (ok) {
      router.push("/today");
    } else {
      setError("Demo account not available");
    }
  }

  const field =
    "h-12 rounded-[14px] border-g3 px-3.5 text-base focus-visible:border-ink focus-visible:ring-0 aria-invalid:border-ink aria-invalid:ring-0";
  return (
    <div className="min-h-screen bg-background px-4 py-10 sm:px-6">
      <main className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <h1 className="text-[3.25rem] font-bold leading-[0.9] tracking-[-0.045em] text-ink sm:text-[4.5rem]">
          NutriPilot
        </h1>
        <p className="mt-4 text-[15px] text-g4">Track your nutrition, hit your goals.</p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-4" aria-describedby={error ? "login-error" : undefined}>
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-[12px] font-normal text-g4">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              aria-invalid={!!error}
              className={field}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" className="text-[12px] font-normal text-g4">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              aria-invalid={!!error}
              className={field}
            />
          </div>

          {error && (
            <p id="login-error" role="alert" className="text-[13px] text-ink">
              {error === "Invalid credentials" ? "That email and password don't match. Check both and try again." : error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || demoLoading}
            className="h-[52px] w-full rounded-full bg-ink text-[17px] font-medium text-g0 transition-transform active:scale-[0.98] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:bg-g3 disabled:text-g5"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <div className="mt-8 border-t border-g2 pt-6">
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading || demoLoading}
            className="h-11 w-full rounded-full border border-g3 text-[13px] font-medium text-ink transition-colors hover:border-g5 outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:text-g3"
          >
            {demoLoading ? "Loading demo..." : "Try the demo account"}
          </button>
          <p className="mt-2 text-[12px] text-g4">Explore with 90 days of sample data.</p>
        </div>

        <InstallCard dismissible className="mt-8 lg:hidden" />
      </main>
    </div>
  );
}
