import type { RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface Props {
  videoRef: RefObject<HTMLVideoElement | null>;
  scanning: boolean;
  flashGreen: boolean;
  onStartScanning: () => void;
  manualCode: string;
  onManualCodeChange: (v: string) => void;
  onManualSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  cameraError: string;
  showCameraError: boolean;
}

/** Left "Scan" card: camera feed + viewfinder overlay + manual barcode entry. */
export function CameraViewfinder({
  videoRef, scanning, flashGreen, onStartScanning,
  manualCode, onManualCodeChange, onManualSubmit, loading,
  cameraError, showCameraError,
}: Props) {
  return (
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
              <Button onClick={onStartScanning} size="lg">
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
        <form onSubmit={onManualSubmit} className="flex gap-2">
          <Input
            type="text"
            value={manualCode}
            onChange={(e) => onManualCodeChange(e.target.value)}
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
        {showCameraError && (
          <div className="pill pill-amber p-3 flex items-start gap-2">
            <svg className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l-3 3m0 0l-3-3m3 3V3m0 0a9 9 0 110 18 9 9 0 010-18z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-300">Camera unavailable</p>
              <p className="text-xs text-muted-foreground mt-0.5">{cameraError}</p>
              <Button onClick={onStartScanning} variant="ghost" size="sm" className="mt-2 h-7 text-xs">
                Try again
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
