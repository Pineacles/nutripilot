"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useBarcodeLookup } from "@/hooks/queries";
import { useLogFoodByBarcode } from "@/hooks/mutations/food-log";
import { ApiError, getErrorMessage } from "@/lib/api";
import { FOOD_LOG_BOUNDS, validateBounds } from "@/lib/validation";
import { todayStr } from "@/lib/dates";
import type { FoodDetail, MealType } from "@/lib/types";
import { CameraViewfinder } from "@/components/scanner/camera-viewfinder";
import { ResultPanel } from "@/components/scanner/result-panel";

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
  const logByBarcode = useLogFoodByBarcode();
  const loading = barcodeLookup.isPending;

  // "Log this" quantity step, shown once a result comes back.
  const [logMode, setLogMode] = useState<"grams" | "servings">("grams");
  const [logQuantity, setLogQuantity] = useState("100");
  const [logMealType, setLogMealType] = useState<MealType>("snack");
  const [logDate, setLogDate] = useState(todayStr());
  const [justLogged, setJustLogged] = useState(false);

  function clearState() {
    setResult(null);
    setError("");
    setErrorType(null);
    setScannedCode("");
    setJustLogged(false);
    setLogQuantity("100");
    setLogMode("grams");
    setLogMealType("snack");
    setLogDate(todayStr());
  }

  async function lookupBarcodeByCode(code: string) {
    setError("");
    setErrorType(null);
    setResult(null);
    setScannedCode(code);
    try {
      const data = await barcodeLookup.mutateAsync(code);
      setResult(data);
      setJustLogged(false);
      setLogMode(data.serving_size_g ? "servings" : "grams");
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 404) {
        setError(`Barcode ${code} not found in our database`);
        setErrorType("not-found");
      } else {
        setError("Connection error -- check your network and try again");
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

  function submitLog() {
    if (!result) return;
    const bounds = logMode === "grams" ? FOOD_LOG_BOUNDS.quantity_g : FOOD_LOG_BOUNDS.servings;
    const err = validateBounds(Number(logQuantity), bounds);
    if (err) { toast.error(err); return; }
    logByBarcode.mutate(
      {
        barcode: result.barcode || scannedCode,
        ...(logMode === "grams" ? { quantity_g: Number(logQuantity) } : { servings: Number(logQuantity) }),
        meal_type: logMealType,
        date: logDate,
      },
      {
        onSuccess: () => { toast.success(`Logged ${result.name}`); setJustLogged(true); },
        onError: (err2) => toast.error(getErrorMessage(err2, "Couldn't log this food.")),
      }
    );
  }

  return (
    <DashboardLayout title="Barcode Scanner">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

        <ResultPanel
          loading={loading}
          result={result}
          error={error}
          errorType={errorType}
          scannedCode={scannedCode}
          onRetryLookup={() => scannedCode && lookupBarcodeByCode(scannedCode)}
          onScanAnother={handleScanAnother}
          justLogged={justLogged}
          logDate={logDate}
          logMode={logMode}
          onLogModeChange={setLogMode}
          logQuantity={logQuantity}
          onLogQuantityChange={setLogQuantity}
          logMealType={logMealType}
          onLogMealTypeChange={setLogMealType}
          onLogDateChange={setLogDate}
          onSubmitLog={submitLog}
          logPending={logByBarcode.isPending}
        />
      </div>
    </DashboardLayout>
  );
}
