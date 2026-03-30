"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

interface FoodResult {
  id: string;
  name: string;
  barcode: string | null;
  source: string;
  nutrients: Record<string, number | null> | null;
}

type ErrorType = "not-found" | "network" | "camera" | null;

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<FoodResult | null>(null);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [loading, setLoading] = useState(false);
  const [scannedCode, setScannedCode] = useState("");
  const [flashGreen, setFlashGreen] = useState(false);

  function clearState() {
    setResult(null);
    setError("");
    setErrorType(null);
    setScannedCode("");
  }

  async function lookupBarcodeByCode(code: string) {
    setError("");
    setErrorType(null);
    setLoading(true);
    setResult(null);
    setScannedCode(code);
    try {
      const data = await apiFetch<FoodResult>(`/api/foods/barcode/${code}`);
      setResult(data);
    } catch (err: any) {
      if (err?.message?.includes("404")) {
        setError(`Barcode ${code} not found in our database`);
        setErrorType("not-found");
      } else {
        setError("Connection error -- check your network and try again");
        setErrorType("network");
      }
    }
    setLoading(false);
  }

  async function startScanning() {
    setScanning(true);
    clearState();
    try {
      // Explicitly request camera permission first — some browsers won't
      // prompt unless getUserMedia is called directly before the library uses it.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      // Attach the stream to the video element so the browser associates the permission
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      if (!videoRef.current) return;

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (res) => {
          if (res) {
            const code = res.getText();
            controls.stop();
            // Stop the manual stream tracks too
            stream.getTracks().forEach((t) => t.stop());
            setFlashGreen(true);
            setTimeout(() => {
              setFlashGreen(false);
              setScanning(false);
              setManualCode(code);
              lookupBarcodeByCode(code);
            }, 400);
          }
        }
      );
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("NotAllowedError") || msg.includes("Permission")) {
        setError("Camera permission denied. Please allow camera access in your browser settings, then try again.");
      } else if (msg.includes("NotFoundError") || msg.includes("Requested device not found")) {
        setError("No camera found on this device. Use the manual barcode input below.");
      } else {
        setError("Could not start camera. Make sure no other app is using it, then try again.");
      }
      setErrorType("camera");
      setScanning(false);
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (manualCode.trim()) {
      lookupBarcodeByCode(manualCode.trim());
    }
  }

  function handleScanAnother() {
    clearState();
    setManualCode("");
    startScanning();
  }

  const NUTRIENT_CONFIG: Record<string, { label: string; unit: string; pill: string; primary: boolean }> = {
    kcal:    { label: "Calories", unit: "kcal", pill: "pill-green",  primary: true },
    protein: { label: "Protein",  unit: "g",    pill: "pill-blue",   primary: true },
    carbs:   { label: "Carbs",    unit: "g",    pill: "pill-amber",  primary: true },
    fat:     { label: "Fat",      unit: "g",    pill: "pill-red",    primary: true },
    fiber:   { label: "Fiber",    unit: "g",    pill: "pill-purple", primary: false },
    sugar:   { label: "Sugar",    unit: "g",    pill: "pill-amber",  primary: false },
    salt:    { label: "Salt",     unit: "g",    pill: "pill-red",    primary: false },
  };

  const SOURCE_LABELS: Record<string, string> = {
    openfoodfacts: "OpenFoodFacts",
    swiss_food_composition: "Swiss DB",
    usda: "USDA",
  };

  return (
    <DashboardLayout title="Barcode Scanner">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Scanner / Input */}
        <div className="clay-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Scan</h3>
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
                  <div
                    className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-32 border-2 rounded-lg transition-colors duration-200 ${
                      flashGreen
                        ? "border-green-400 shadow-[0_0_25px_rgba(34,197,94,0.5)]"
                        : "border-primary opacity-50 shadow-[0_0_15px_rgba(34,197,94,0.2)] animate-pulse"
                    }`}
                  />
                  {!flashGreen && (
                    <p className="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs text-white/60 bg-black/40 px-3 py-1 rounded-full">
                      Point at a barcode
                    </p>
                  )}
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
                className="min-w-[90px]"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    ...
                  </span>
                ) : (
                  "Look up"
                )}
              </Button>
            </form>

            {/* Error states */}
            {error && errorType === "camera" && (
              <div className="pill pill-amber p-3 flex items-start gap-2">
                <svg className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l-3 3m0 0l-3-3m3 3V3m0 0a9 9 0 110 18 9 9 0 010-18z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-300">Camera unavailable</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{error}</p>
                  <Button onClick={startScanning} variant="ghost" size="sm" className="mt-2 h-7 text-xs">
                    Try again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Result */}
        <div className="clay-card p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Result</h3>

          {/* Loading skeleton */}
          {loading && (
            <div className="space-y-3 py-4">
              <div className="h-6 w-3/4 rounded bg-muted animate-pulse" />
              <div className="h-4 w-1/2 rounded bg-muted/50 animate-pulse" />
              <div className="space-y-2 mt-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-5 rounded bg-muted/30 animate-pulse" />
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {!loading && !result && !error && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              <svg className="h-10 w-10 text-muted-foreground/30 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-muted-foreground">Scan a barcode or enter one manually</p>
            </div>
          )}

          {/* Not found error */}
          {!loading && errorType === "not-found" && (
            <div className="pill pill-amber p-4 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-amber-300">Barcode not found</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    <span className="font-mono text-foreground/70">{scannedCode}</span> is not in our database.
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Try searching by name instead.
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/foods">
                  <Button variant="secondary" size="sm" className="h-7 text-xs">
                    Browse foods
                  </Button>
                </Link>
                <Button onClick={handleScanAnother} variant="ghost" size="sm" className="h-7 text-xs">
                  Scan another
                </Button>
              </div>
            </div>
          )}

          {/* Network error */}
          {!loading && errorType === "network" && (
            <div className="pill pill-red p-4 space-y-3">
              <div className="flex items-start gap-3">
                <svg className="h-6 w-6 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m0-10.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-red-300">Connection error</p>
                  <p className="text-xs text-muted-foreground mt-1">{error}</p>
                </div>
              </div>
              <Button
                onClick={() => scannedCode && lookupBarcodeByCode(scannedCode)}
                variant="secondary"
                size="sm"
                className="h-7 text-xs"
              >
                Retry
              </Button>
            </div>
          )}

          {/* Success result */}
          {!loading && result && (
            <div className="space-y-4">
              {/* Success banner */}
              <div className="pill pill-green p-3 flex items-center gap-3">
                <svg className="h-6 w-6 text-green-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="min-w-0 flex-1">
                  <h4 className="text-base font-semibold text-foreground truncate">{result.name}</h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    {result.barcode && (
                      <span className="font-mono text-[10px] text-muted-foreground">{result.barcode}</span>
                    )}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {SOURCE_LABELS[result.source] || result.source}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Nutrient grid */}
              {result.nutrients ? (
                <div>
                  {/* Primary macros -- 2-column grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(NUTRIENT_CONFIG)
                      .filter(([, cfg]) => cfg.primary)
                      .map(([key, cfg]) => {
                        const val = result.nutrients?.[key];
                        if (val == null) return null;
                        return (
                          <div key={key} className={`pill ${cfg.pill} p-3 flex flex-col`}>
                            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
                            <span className="text-lg font-bold tabular-nums text-foreground mt-0.5">
                              {Math.round(val * 10) / 10}
                              <span className="text-xs font-normal text-muted-foreground ml-1">{cfg.unit}</span>
                            </span>
                          </div>
                        );
                      })}
                  </div>

                  {/* Secondary nutrients */}
                  {Object.entries(NUTRIENT_CONFIG)
                    .filter(([, cfg]) => !cfg.primary)
                    .some(([key]) => result.nutrients?.[key] != null) && (
                    <>
                      <Separator className="my-3" />
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(NUTRIENT_CONFIG)
                          .filter(([, cfg]) => !cfg.primary)
                          .map(([key, cfg]) => {
                            const val = result.nutrients?.[key];
                            if (val == null) return null;
                            return (
                              <div key={key} className={`pill ${cfg.pill} p-2.5 flex items-center justify-between`}>
                                <span className="text-xs text-muted-foreground">{cfg.label}</span>
                                <span className="text-sm font-semibold tabular-nums text-foreground">
                                  {Math.round(val * 10) / 10}
                                  <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{cfg.unit}</span>
                                </span>
                              </div>
                            );
                          })}
                      </div>
                    </>
                  )}

                  <p className="text-[9px] text-muted-foreground/50 mt-3">Per 100 g</p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No nutrient data available</p>
              )}

              {/* Action buttons */}
              <Separator className="my-1" />
              <div className="flex gap-2">
                <Button onClick={handleScanAnother} variant="secondary" size="sm" className="text-xs">
                  Scan another
                </Button>
                <Link href="/foods">
                  <Button variant="ghost" size="sm" className="text-xs">
                    Browse foods
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
