"use client";

import { useEffect, useRef, useState } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useBarcodeLookup } from "@/hooks/queries";
import { ApiError } from "@/lib/api";
import { todayStr } from "@/lib/dates";
import { startScanner, type Scanner } from "@/lib/camera";
import type { FoodDetail } from "@/lib/types";
import { AddFoodDialog } from "@/components/food-log/add-food-dialog";
import { CameraViewfinder } from "@/components/scanner/camera-viewfinder";
import { ResultPanel } from "@/components/scanner/result-panel";
import { Button } from "@/components/ui/button";

type ErrorType = "not-found" | "network" | "camera" | null;

export default function ScannerPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [result, setResult] = useState<FoodDetail | null>(null);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState<ErrorType>(null);
  const [scannedCode, setScannedCode] = useState("");
  const [flashGreen, setFlashGreen] = useState(false);
  const scannerRef = useRef<Scanner | null>(null);
  const [torchOn, setTorchOn] = useState<boolean | null>(null); // null: no flashlight

  // Leaving the page turns the camera off.
  useEffect(() => () => scannerRef.current?.stop(), []);

  // /scanner?code=... (from Log food, for a product without values) opens that product straight away.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      setManualCode(code);
      lookupBarcodeByCode(code);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const barcodeLookup = useBarcodeLookup();
  const loading = barcodeLookup.isPending;

  // Logging opens the same amount step as Log food on the Today page.
  const [logOpen, setLogOpen] = useState(false);
  const [loggedOn, setLoggedOn] = useState<string | null>(null);
  const queryClient = useQueryClient();

  function clearState() {
    setResult(null);
    setError("");
    setErrorType(null);
    setScannedCode("");
    setLoggedOn(null);
  }

  async function lookupBarcodeByCode(code: string) {
    setError("");
    setErrorType(null);
    setResult(null);
    setScannedCode(code);
    try {
      const data = await barcodeLookup.mutateAsync(code);
      // The Log food step reads the food (with the user's units) from this cache entry.
      queryClient.setQueryData(queryKeys.foodDetail(data.id), data);
      setResult(data);
      setLoggedOn(null);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`Barcode ${code} not found in our database`);
        setErrorType("not-found");
      } else {
        setError("Connection error, check your network and try again");
        setErrorType("network");
      }
    }
  }

  async function startScanning() {
    scannerRef.current?.stop();
    setScanning(true);
    setTorchOn(null);
    clearState();
    try {
      if (!videoRef.current) return;
      const scanner = await startScanner(videoRef.current, (code) => {
        scannerRef.current = null;
        setTorchOn(null);
        setFlashGreen(true);
        navigator.vibrate?.(60);
        setTimeout(() => {
          setFlashGreen(false);
          setScanning(false);
          setManualCode(code);
          lookupBarcodeByCode(code);
        }, 400);
      });
      scannerRef.current = scanner;
      if (scanner.setTorch) setTorchOn(false);
    } catch (e: unknown) {
      const name = e instanceof Error ? e.name : "";
      const msg = e instanceof Error ? e.message : "";
      if (name === "NotAllowedError" || msg.includes("Permission")) {
        setError("Camera permission denied. Please allow camera access in your browser settings, then try again.");
      } else if (name === "NotFoundError" || msg.includes("Requested device not found")) {
        setError("No camera found on this device. Use the manual barcode input below.");
      } else {
        setError("Could not start camera. Make sure no other app is using it, then try again.");
      }
      setErrorType("camera");
      setScanning(false);
    }
  }

  async function toggleTorch() {
    const scanner = scannerRef.current;
    if (!scanner?.setTorch || torchOn === null) return;
    try {
      await scanner.setTorch(!torchOn);
      setTorchOn(!torchOn);
    } catch {
      setTorchOn(null);
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

  const isCollapsed = result !== null;

  return (
    <DashboardLayout title="Barcode scanner">
      <div className="grid grid-cols-1 items-start gap-y-0 pb-24 md:grid-cols-2 md:gap-4">
        <div className="clay-card p-5 self-start">
          <h3 className="mb-3 text-[15px] leading-6 font-medium text-ink">Scan</h3>
          <div className="space-y-4">
            {isCollapsed ? (
              <div className="flex min-h-[60px] items-center justify-between gap-3 border-t border-g2">
                <div className="min-w-0">
                  <p className="text-xs text-g4">Scanned</p>
                  <span className="block truncate font-mono text-[15px] text-ink">{scannedCode}</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleScanAnother}>
                  Scan another
                </Button>
              </div>
            ) : (
              <div>
                <CameraViewfinder
                  videoRef={videoRef}
                  scanning={scanning}
                  flashGreen={flashGreen}
                  onStartScanning={startScanning}
                  manualCode={manualCode}
                  onManualCodeChange={setManualCode}
                  onManualSubmit={handleManualSubmit}
                  loading={loading}
                  cameraError={error}
                  showCameraError={!!error && errorType === "camera"}
                  torchOn={torchOn}
                  onToggleTorch={toggleTorch}
                />
              </div>
            )}
          </div>
        </div>

        <ResultPanel
          loading={loading}
          result={result}
          error={error}
          errorType={errorType}
          scannedCode={scannedCode}
          onRetryLookup={() => scannedCode && lookupBarcodeByCode(scannedCode)}
          onScanAnother={handleScanAnother}
          onCorrected={(f) => setResult(f)}
          loggedOn={loggedOn}
          onLog={() => setLogOpen(true)}
        />
      </div>
      {result && (
        <AddFoodDialog
          open={logOpen}
          onOpenChange={setLogOpen}
          defaultDate={todayStr()}
          initialFoodId={result.id}
          onLogged={setLoggedOn}
        />
      )}
    </DashboardLayout>
  );
}
