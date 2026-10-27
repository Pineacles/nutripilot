"use client";

import { ViewfinderFrame } from "@/components/scanner/camera-viewfinder";
import { useEffect, useRef, useState } from "react";
import { Camera, Flashlight, FlashlightOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startScanner, type ScanInfo, type Scanner } from "@/lib/camera";

interface Props {
  /** Called once with the code read (and a counter label's pack weight); the camera is off by then. */
  onCode: (code: string, info: ScanInfo) => void;
  /** Start the camera as soon as this shows (the person picked scanning). */
  autoStart?: boolean;
}

/** A compact camera view that reads one barcode, for places like the Log food dialog. */
export function BarcodeCamera({ onCode, autoStart = false }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<Scanner | null>(null);
  const onCodeRef = useRef(onCode);
  const [state, setState] = useState<"idle" | "starting" | "live" | "error">("idle");
  const [error, setError] = useState("");
  const [torchOn, setTorchOn] = useState<boolean | null>(null);

  useEffect(() => {
    onCodeRef.current = onCode;
  }, [onCode]);

  async function start() {
    if (!videoRef.current) return;
    scannerRef.current?.stop();
    setState("starting");
    setError("");
    try {
      const scanner = await startScanner(videoRef.current, (code, info) => {
        scannerRef.current = null;
        setState("idle");
        setTorchOn(null);
        navigator.vibrate?.(60);
        onCodeRef.current(code, info);
      });
      scannerRef.current = scanner;
      setTorchOn(scanner.setTorch ? false : null);
      setState("live");
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "Camera access is blocked. Allow it in the browser settings, or type the number below."
          : name === "NotFoundError"
            ? "No camera found. Type the number below."
            : "The camera could not start. Close other apps using it, or type the number below.",
      );
      setState("error");
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

  useEffect(() => {
    if (autoStart) start();
    return () => scannerRef.current?.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = state === "live";
  return (
    <div className="relative aspect-[4/3] overflow-hidden border border-g2 bg-g0">
      <video ref={videoRef} className={`h-full w-full object-cover ${live ? "" : "invisible"}`} autoPlay muted playsInline />
      {live ? (
        <div className="pointer-events-none absolute inset-0">
          <ViewfinderFrame className="h-24 w-[80%]" />
          <p className="absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-g2 bg-g0 px-3 py-1 text-xs text-g5">
            Barcode inside the frame, a hand width away
          </p>
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center">
          {state === "error" && <p className="text-[13px] text-ink">{error}</p>}
          <Button onClick={start} disabled={state === "starting"} size="lg">
            <Camera className="h-4 w-4" aria-hidden="true" />
            {state === "starting" ? "Starting camera..." : state === "error" ? "Try again" : "Scan with camera"}
          </Button>
        </div>
      )}
      {live && torchOn !== null && (
        <button
          type="button"
          onClick={toggleTorch}
          aria-pressed={torchOn}
          aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
          className={`absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-[var(--dur-fast)] ${
            torchOn ? "border-ink bg-ink text-g0" : "border-g3 bg-g0 text-ink"
          }`}
        >
          {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
        </button>
      )}
    </div>
  );
}
