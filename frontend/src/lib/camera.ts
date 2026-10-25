// Barcode camera: picks the phone's main back lens, asks for a sharp picture, keeps it focused and
// reads retail codes with the phone's own detector when it has one (Android Chrome), else ZXing.

import type { DecodeHintType as HintKey } from "@zxing/library";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"];

/** Camera settings the browser may not have in its type definitions yet. */
type ExtraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  zoom?: { min: number; max: number };
  torch?: boolean;
};

export interface Scanner {
  stop: () => void;
  /** Present only when the lens has a flashlight the browser can switch. */
  setTorch?: (on: boolean) => Promise<void>;
}

/**
 * How much a lens label looks like the main back camera. Phones with several lenses list the
 * ultra wide, tele, macro and depth ones as separate cameras; those can't focus at scanning distance
 * or see the whole code. Android names them "camera2 N, facing back" (the main one has the lowest
 * N), iPhones "Back Camera", "Back Ultra Wide Camera" and so on.
 */
export function lensScore(label: string): number {
  const l = label.toLowerCase();
  let score = 0;
  if (/back|rear|environment|facing back|rück/.test(l)) score += 100;
  if (/front|user|selfie|facetime/.test(l)) score -= 200;
  if (/ultra|tele|macro|depth|infrared|\bir\b|zoom|0[.,]5/.test(l)) score -= 80;
  // Virtual multi lens cameras on iPhones switch lenses on their own, which makes the picture jump.
  if (/dual|triple/.test(l)) score -= 30;
  const index = l.match(/camera2? ?(\d+)/);
  if (index) score -= Number(index[1]);
  return score;
}

async function openStream(deviceId?: string): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });
}

/** Opens the main back camera. The first call also asks for permission, which is what makes the
 * lens labels readable. */
export async function openBackCamera(): Promise<MediaStream> {
  let stream = await openStream();
  try {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.label);
    if (cams.length > 1) {
      const best = [...cams].sort((a, b) => lensScore(b.label) - lensScore(a.label))[0];
      const current = stream.getVideoTracks()[0]?.getSettings().deviceId;
      if (best.deviceId && best.deviceId !== current && lensScore(best.label) > 0) {
        stream.getTracks().forEach((t) => t.stop());
        stream = await openStream(best.deviceId);
      }
    }
  } catch {
    // Keep the camera the browser picked.
  }
  await tune(stream.getVideoTracks()[0]);
  return stream;
}

/** Continuous focus, and a little zoom so the phone is held far enough away to focus. */
async function tune(track: MediaStreamTrack | undefined) {
  if (!track?.getCapabilities) return;
  const caps = track.getCapabilities() as ExtraCapabilities;
  const advanced: Record<string, unknown>[] = [];
  if (caps.focusMode?.includes("continuous")) advanced.push({ focusMode: "continuous" });
  if (caps.zoom && caps.zoom.max >= 1.5 && caps.zoom.min <= 1.5) advanced.push({ zoom: 1.5 });
  for (const c of advanced) {
    try {
      await track.applyConstraints({ advanced: [c as MediaTrackConstraintSet] });
    } catch {
      // Not every camera takes every setting.
    }
  }
}

interface NativeDetector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
type DetectorClass = {
  new (opts: { formats: string[] }): NativeDetector;
  getSupportedFormats: () => Promise<string[]>;
};

async function nativeDetector(): Promise<NativeDetector | null> {
  const Detector = (globalThis as unknown as { BarcodeDetector?: DetectorClass }).BarcodeDetector;
  if (!Detector) return null;
  try {
    const formats = (await Detector.getSupportedFormats()).filter((f) => FORMATS.includes(f));
    return formats.includes("ean_13") ? new Detector({ formats }) : null;
  } catch {
    return null;
  }
}

/** Shows the camera in `video` and calls `onCode` once with the first code read. */
export async function startScanner(video: HTMLVideoElement, onCode: (code: string) => void): Promise<Scanner> {
  const stream = await openBackCamera();
  const track = stream.getVideoTracks()[0];
  let stopped = false;
  let stopDecoder = () => {};

  const stop = () => {
    stopped = true;
    stopDecoder();
    stream.getTracks().forEach((t) => t.stop());
    if (video.srcObject === stream) video.srcObject = null;
  };
  const found = (code: string) => {
    if (stopped) return;
    stop();
    onCode(code);
  };

  const detector = await nativeDetector();
  if (detector) {
    video.srcObject = stream;
    await video.play().catch(() => {});
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      if (stopped) return;
      if (video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          if (codes[0]?.rawValue) return found(codes[0].rawValue);
        } catch {
          // A frame that can't be read; try the next one.
        }
      }
      timer = setTimeout(tick, 120);
    };
    stopDecoder = () => clearTimeout(timer);
    tick();
  } else {
    const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([
      import("@zxing/browser"),
      import("@zxing/library"),
    ]);
    const hints = new Map<HintKey, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128,
      ]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 100 });
    const controls = await reader.decodeFromStream(stream, video, (res) => {
      if (res) found(res.getText());
    });
    stopDecoder = () => controls.stop();
  }

  const caps = track?.getCapabilities?.() as ExtraCapabilities | undefined;
  return {
    stop,
    setTorch: caps?.torch
      ? (on) => track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      : undefined,
  };
}
