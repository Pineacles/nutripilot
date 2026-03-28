"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardCard } from "@/components/dashboard-card";
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
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001"}/api/foods/barcode/${code}`,
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
      <div className="grid grid-cols-2 gap-4">
        {/* Scanner / Input */}
        <DashboardCard title="Scan">
          <div className="space-y-4">
            {/* Camera viewfinder */}
            <div className="relative rounded-xl overflow-hidden bg-black aspect-video">
              <video
                ref={videoRef}
                className={`w-full h-full object-cover ${scanning ? "" : "hidden"}`}
                autoPlay
                muted
                playsInline
              />
              {!scanning && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                  <svg className="h-12 w-12 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5zM13.5 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5z" />
                  </svg>
                  <button
                    onClick={startScanning}
                    className="rounded-xl bg-[#22c55e] px-6 py-2.5 text-sm font-semibold text-[#0f0f0f] transition-opacity hover:opacity-90"
                  >
                    Start Camera
                  </button>
                </div>
              )}
              {scanning && (
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 border-2 border-[#22c55e] rounded-lg opacity-50" />
                </div>
              )}
            </div>

            {/* Manual entry */}
            <form onSubmit={handleManualSubmit} className="flex gap-2">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Or enter barcode manually..."
                className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#22c55e]/50 font-mono"
              />
              <button
                type="submit"
                disabled={!manualCode.trim() || loading}
                className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/15 disabled:opacity-30"
              >
                Look up
              </button>
            </form>

            {error && <p className="text-sm text-[#ef4444]">{error}</p>}
          </div>
        </DashboardCard>

        {/* Result */}
        <DashboardCard title="Result">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />
            </div>
          ) : !result ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-sm text-white/30">Scan a barcode or enter one manually</p>
            </div>
          ) : (
            <div>
              <h4 className="text-lg font-semibold text-white mb-1">{result.name}</h4>
              <div className="flex items-center gap-2 mb-4">
                {result.barcode && (
                  <span className="text-xs text-white/30 font-mono bg-white/5 px-2 py-0.5 rounded">{result.barcode}</span>
                )}
                <span className="text-xs text-white/30">{result.source}</span>
              </div>

              {result.nutrients ? (
                <div className="space-y-2">
                  {Object.entries(NUTRIENT_LABELS).map(([key, meta]) => {
                    const val = result.nutrients?.[key];
                    if (val == null) return null;
                    const isMain = ["kcal", "protein", "carbs", "fat"].includes(key);
                    return (
                      <div key={key} className={`flex items-center justify-between ${isMain ? "" : "opacity-60"}`}>
                        <span className={`text-white/70 ${isMain ? "text-sm font-medium" : "text-xs"}`}>{meta.label}</span>
                        <span className={`tabular-nums text-white ${isMain ? "text-sm font-bold" : "text-xs"}`}>
                          {Math.round(val * 10) / 10} {meta.unit}
                        </span>
                      </div>
                    );
                  })}
                  <p className="text-[9px] text-white/20 mt-3 pt-2 border-t border-white/5">
                    Per 100g
                  </p>
                </div>
              ) : (
                <p className="text-sm text-white/30">No nutrient data</p>
              )}
            </div>
          )}
        </DashboardCard>
      </div>
    </DashboardLayout>
  );
}
