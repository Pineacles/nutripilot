"use client";

import { useSyncExternalStore } from "react";

/** Chrome's install event, which lets the app show its own install button. */
type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: InstallEvent | null = null;
let installed = false;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as InstallEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    deferred = null;
    emit();
  });
}

export type InstallWay =
  /** Already running as an installed app. */
  | "installed"
  /** The browser offers a real install, triggered by our button. */
  | "prompt"
  /** Chrome on Android without a ready install event (dismissed before, or still warming up): use the menu. */
  | "android-menu"
  /** Android browser that can only make home screen shortcuts (Brave, Firefox, Opera...). Chrome makes a real app. */
  | "use-chrome"
  /** iPhone or iPad: Share, then Add to Home Screen. */
  | "ios"
  /** Desktop or a browser with no install path we can help with. */
  | "none";

/** Brave hides itself in the user agent but always exposes navigator.brave. */
function isBrave(): boolean {
  return typeof navigator !== "undefined" && "brave" in navigator;
}

function detect(): InstallWay {
  if (installed || window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone) return "installed";
  const ua = navigator.userAgent;
  const android = /Android/.test(ua);
  // Only Chrome (and Samsung Internet) turn an install into a real Android app. Brave and the
  // other Chromium browsers may still fire the install event, but the result is a shortcut.
  const realApp = !isBrave() && /Chrome\//.test(ua) && !/EdgA|OPR|Firefox|FxiOS|DuckDuckGo|YaBrowser|Vivaldi/.test(ua);
  // In-app browsers (Gmail, Instagram...) are WebViews that can't install anything.
  if (android && (!realApp || /; wv\)/.test(ua))) return "use-chrome";
  if (deferred) return "prompt";
  if (android) return "android-menu";
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return "none";
}

export function useInstallWay(): InstallWay {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    detect,
    () => "none",
  );
}

/** Which iPhone browser, for the right Share button directions. */
export function iosBrowser(): "safari" | "chrome" | "firefox" | "other" {
  const ua = navigator.userAgent;
  if (/CriOS/.test(ua)) return "chrome";
  if (/FxiOS/.test(ua)) return "firefox";
  if (/EdgiOS|OPiOS|DuckDuckGo|GSA\/|FBAN|FBAV|Instagram/.test(ua)) return "other";
  return "safari";
}

export function isSamsungInternet(): boolean {
  return /SamsungBrowser/.test(navigator.userAgent);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  await e.prompt();
  const { outcome } = await e.userChoice;
  emit();
  return outcome === "accepted";
}

/** Opens the current page in Chrome on Android, where installing gives a real app in the app drawer. */
export function chromeIntentUrl(path = "/today"): string {
  const { host } = window.location;
  const scheme = window.location.protocol.replace(":", "");
  const fallback = encodeURIComponent(window.location.href);
  return `intent://${host}${path}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}
