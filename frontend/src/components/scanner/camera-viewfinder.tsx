import type { RefObject } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Flashlight, FlashlightOff } from "lucide-react";

/** The aiming frame: four ink corner ticks, or a full hairline once a code was read. No glow, no pulse. */
export function ViewfinderFrame({ locked = false, className = "" }: { locked?: boolean; className?: string }) {
  const tick = "absolute h-5 w-5 border-ink";
  return (
    <div
      aria-hidden="true"
      className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 ${locked ? "border border-ink" : ""} ${className}`}
    >
      {!locked && (
        <>
          <span className={`${tick} top-0 left-0 border-t-2 border-l-2`} />
          <span className={`${tick} top-0 right-0 border-t-2 border-r-2`} />
          <span className={`${tick} bottom-0 left-0 border-b-2 border-l-2`} />
          <span className={`${tick} right-0 bottom-0 border-r-2 border-b-2`} />
        </>
      )}
    </div>
  );
}

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
  /** null when the lens has no flashlight the browser can switch. */
  torchOn: boolean | null;
  onToggleTorch: () => void;
}

/** The Scan block: camera feed + viewfinder overlay + manual barcode entry. */
export function CameraViewfinder({
  videoRef, scanning, flashGreen, onStartScanning,
  manualCode, onManualCodeChange, onManualSubmit, loading,
  cameraError, showCameraError, torchOn, onToggleTorch,
}: Props) {
  return (
    <div>
      <div className="space-y-4">
        {/* Camera viewfinder */}
        <div className="relative aspect-[4/3] overflow-hidden border border-g2 bg-g0 sm:aspect-video">
          <video
            ref={videoRef}
            className={`w-full h-full object-cover ${scanning ? "" : "hidden"}`}
            autoPlay
            muted
            playsInline
          />
          {!scanning && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <Button onClick={onStartScanning} size="lg">
                Start camera
              </Button>
            </div>
          )}
          {scanning && (
            <div className="absolute inset-0 pointer-events-none">
              <ViewfinderFrame locked={flashGreen} className="h-28 w-[78%] max-w-80" />
              {!flashGreen && (
                <p className="absolute bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-g2 bg-g0 px-3 py-1 text-xs text-g5">
                  Hold the barcode inside the frame, a hand width away
                </p>
              )}
            </div>
          )}
          {scanning && torchOn !== null && (
            <button
              type="button"
              onClick={onToggleTorch}
              aria-pressed={torchOn}
              aria-label={torchOn ? "Turn flashlight off" : "Turn flashlight on"}
              className={`absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full border transition-colors duration-[var(--dur-fast)] ${
                torchOn ? "border-ink bg-ink text-g0" : "border-g3 bg-g0 text-ink"
              }`}
            >
              {torchOn ? <Flashlight className="h-5 w-5" /> : <FlashlightOff className="h-5 w-5" />}
            </button>
          )}
        </div>

        {/* Manual entry */}
        <form onSubmit={onManualSubmit} className="flex gap-2">
          <Input
            type="text"
            value={manualCode}
            onChange={(e) => onManualCodeChange(e.target.value)}
            placeholder="Or enter the barcode"
            aria-label="Barcode"
            inputMode="numeric"
            className="flex-1 tabular-nums"
          />
          <Button
            type="submit"
            disabled={!manualCode.trim() || loading}
            size="lg"
            className="min-w-[96px]"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Looking up
              </span>
            ) : (
              "Look up"
            )}
          </Button>
        </form>

        {/* Error states */}
        {showCameraError && (
          <div role="alert" className="border-t border-g2 pt-3">
            <p className="text-[15px] font-medium text-ink">Camera unavailable</p>
            <p className="mt-1 text-[13px] text-g4">{cameraError}</p>
            <Button onClick={onStartScanning} variant="outline" size="sm" className="mt-3">
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
