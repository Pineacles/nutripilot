"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys, useBarcodeLookup } from "@/hooks/queries";
import { ApiError } from "@/lib/api";
import { todayStr } from "@/lib/dates";
import type { FoodDetail } from "@/lib/types";
import { AddFoodDialog } from "@/components/food-log/add-food-dialog";
import { CameraViewfinder } from "@/components/scanner/camera-viewfinder";
import { ResultPanel } from "@/components/scanner/result-panel";
import { Button } from "@/components/ui/button";
import { Scan } from "lucide-react";

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
    setScanning(true);
    clearState();
    try {
      // Explicitly request camera permission first: some browsers won't
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

  const isCollapsed = result !== null;

  return (
    <DashboardLayout title="Barcode Scanner">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start pb-24">
        <div className="clay-card p-5 self-start">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Scan</h3>
          <div className="space-y-4">
            {isCollapsed ? (
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Scan className="h-5 w-5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm truncate">{scannedCode}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={handleScanAnother}>
                  Scan another
                </Button>
              </div>
            ) : (
              <div className="overflow-hidden transition-all duration-300">
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
