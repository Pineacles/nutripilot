"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardCard } from "@/components/dashboard-card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";

interface FoodResult {
  id: string;
  name: string;
  barcode: string | null;
  source: string;
  nutrients: Record<string, number | null> | null;
}

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<FoodResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function lookupBarcode(code: string) {
    setError("");
    setLoading(true);
    setResult(null);
    try {
      // Use the API key foods endpoint (no JWT needed for barcode lookup via agent)
      const data = await apiFetch<FoodResult>(`/api/dashboard/foods/${code}`);
      setResult(data);
    } catch {
      // Try the agent barcode endpoint as a fallback search
      try {
        // Dashboard doesn't have barcode lookup, so we'll search by the code
        setError("Food not found for this barcode");
      } catch {
        setError("Food not found for this barcode");
      }
    }
    setLoading(false);
  }

  async function lookupBarcodeByCode(code: string) {
    setError("");
    setLoading(true);
    setResult(null);
    try {
      // We need to hit the foods barcode endpoint — use a special dashboard route
      const res = await fetch(
        `/api/foods/barcode/${code}`,
        {
          headers: {
            "X-API-Key": "dev-api-key-change-in-production", // For demo; in prod this would be handled differently
          },
        }
      );
      if (!res.ok) {
        setError("Food not found for this barcode");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setResult(data);
    } catch {
      setError("Failed to lookup barcode");
    }
    setLoading(false);
  }

  async function startScanning() {
    setScanning(true);
    setError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      if (!videoRef.current) return;

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (res, err) => {
          if (res) {
            const code = res.getText();
            controls.stop();
            setScanning(false);
            setManualCode(code);
            lookupBarcodeByCode(code);
          }
        }
      );
    } catch (e) {
      setError("Camera access denied or not available");
      setScanning(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      lookupBarcodeByCode(manualCode.trim());
    }
  }

  const NUTRIENT_LABELS: Record<string, { label: string; unit: string }> = {
    kcal: { label: "Calories", unit: "kcal" },
    protein: { label: "Protein", unit: "g" },
    carbs: { label: "Carbs", unit: "g" },
    fat: { label: "Fat", unit: "g" },
    fiber: { label: "Fiber", unit: "g" },
    sugar: { label: "Sugar", unit: "g" },
    salt: { label: "Salt", unit: "g" },
  };

  return (
    <DashboardLayout title="Barcode Scanner">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scanner / Input */}
        <DashboardCard title="Scan">
          <div className="space-y-4">
            {/* Camera viewfinder */}
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-border">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${scanning ? "" : "hidden"}`}
                autoPlay
                muted
                playsInline
              />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <svg className="h-12 w-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                  </svg>
                  <Button onClick={startScanning} size="lg">
                    Start Camera
                  </Button>
                </div>
              )}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 border-2 border-primary rounded-lg opacity-50 shadow-[0_0_15px_rgba(34,197,94,0.2)]" />
                </div>
              )}
            </div>

            {/* Manual entry */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <Input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or enter barcode manually..."
                className="flex-1 h-10 font-mono"
              />
              <Button
                type="submit"
                disabled={!manualCode.trim() || loading}
                variant="secondary"
                size="lg"
              >
                Look up
              </Button>
            </form>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        </DashboardCard>

        {/* Result */}
        <DashboardCard title="Result">
          {loading ? (
            <div className="space-y-3 py-4">
              <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-muted/50 animate-pulse" />
              <div className="space-y-2 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-5 rounded bg-muted/30 animate-pulse" />
                ))}
              </div>
            </div>
          ) : !result ? (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <svg className="h-10 w-10 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-muted-foreground">Scan a barcode or enter one manually</p>
            </div>
          ) : (
            <div>
              <h4 className="text-lg font-semibold text-foreground mb-1">{result.name}</h4>
              <div className="flex items-center gap-2 mb-4">
                {result.barcode && (
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {result.barcode}
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">{result.source}</span>
              </div>

              {result.nutrients ? (
                <div className="space-y-2">
                  {Object.entries(NUTRIENT_LABELS).map(([key, meta]) => {
                    const val = result.nutrients?.[key];
                    if (val == null) return null;
                    const isMain = ["kcal", "protein", "carbs", "fat"].includes(key);
                    return (
                      <div key={key} className={`flex items-center justify-between py-0.5 ${isMain ? "" : "opacity-60"}`}>
                        <span className={`text-muted-foreground ${isMain ? "text-sm font-medium" : "text-xs"}`}>{meta.label}</span>
                        <span className={`tabular-nums text-foreground ${isMain ? "text-sm font-bold" : "text-xs"}`}>
                          {Math.round(val * 10) / 10} {meta.unit}
                        </span>
                      </div>
                    );
                  })}
                  <Separator className="my-2" />
                  <p className="text-[9px] text-muted-foreground/50">
                    Per 100g
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No nutrient data</p>
              )}
            </div>
          )}
        </DashboardCard>
      </div>
    </DashboardLayout>
  );
}
