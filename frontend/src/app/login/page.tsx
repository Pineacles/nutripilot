"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary">
            NutriPilot
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track your nutrition, hit your goals
          </p>
        </div>

        <Card>
          <CardContent className="pt-2">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  className="h-10 transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive transition-opacity">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading || demoLoading}
                className="w-full h-10 text-sm font-semibold transition-all"
                size="lg"
              >
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              or
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          onClick={handleDemo}
          disabled={loading || demoLoading}
          className="w-full h-10 text-sm font-medium transition-all"
        >
          {demoLoading ? "Loading demo..." : "Try Demo Account"}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          Explore with 90 days of sample data
        </p>
      </div>
    </div>
  );
}
