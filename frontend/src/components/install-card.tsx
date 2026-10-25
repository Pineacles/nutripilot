"use client";

import { EllipsisVertical, Menu, Share, SquarePlus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { chromeIntentUrl, iosBrowser, isSamsungInternet, promptInstall, useInstallWay } from "@/lib/install";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "nutripilot.installDismissed";
const SNOOZE_DAYS = 30;

const noSubscribe = () => () => {};
const dismissListeners = new Set<() => void>();

function readDismissed(): number {
  try {
    return Number(localStorage.getItem(DISMISS_KEY) || 0);
  } catch {
    return 0;
  }
}

function useDismissed(): [number, () => void] {
  const value = useSyncExternalStore(
    (f) => {
      dismissListeners.add(f);
      return () => dismissListeners.delete(f);
    },
    readDismissed,
    () => 0,
  );
  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // storage blocked, hidden until the next reload
    }
    dismissListeners.forEach((f) => f());
  };
  return [value, dismiss];
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-g3 text-[11px] font-medium text-ink">{n}</span>
      <span className="leading-6">{children}</span>
    </li>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="mx-0.5 inline-flex items-center gap-1 rounded-full border border-g3 px-2 py-px align-middle font-medium text-ink">{children}</span>
);

/**
 * Shows how to put NutriPilot on the phone as an app. Chrome gets a one tap install; browsers that can
 * only make shortcuts (Brave and friends) get a hand off to Chrome; iPhone gets the Share steps.
 * `dismissible` is the Today page version: phones only, can be snoozed, hidden where we can't help.
 */
export function InstallCard({ dismissible = false, className }: { dismissible?: boolean; className?: string }) {
  const way = useInstallWay();
  const [dismissed, dismiss] = useDismissed();
  const [now] = useState(() => Date.now());
  const host = useSyncExternalStore(noSubscribe, () => window.location.host, () => "");
  if (dismissible && (way === "none" || now - dismissed < SNOOZE_DAYS * 86_400_000)) return null;

  if (way === "installed") {
    if (dismissible) return null;
    return (
      <div className={cn("clay-card flex items-center gap-3.5 py-5 md:p-5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon.svg?v=2" alt="" className="h-11 w-11 shrink-0 rounded-[14px]" />
        <div className="text-sm">
          <div className="font-medium text-ink">NutriPilot is installed</div>
          <p className="text-g4">You&apos;re using the app version.</p>
        </div>
      </div>
    );
  }

  const intro =
    way === "prompt"
      ? "Install it to open NutriPilot from your home screen, full screen, like any other app."
      : way === "use-chrome"
        ? "This browser can only add a shortcut. Open NutriPilot in Chrome to install the real app."
        : way === "none"
          ? "Open this page on your phone to add NutriPilot to your home screen."
          : "Add it to your home screen to open it full screen, like any other app.";

  return (
    <div className={cn("clay-card relative py-5 md:p-5", className)}>
      <div className="flex items-start gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon.svg?v=2" alt="" className="h-11 w-11 shrink-0 rounded-[14px]" />
        <div className={cn("min-w-0 flex-1", dismissible && "pr-8")}>
          <h2 className="font-medium text-ink">Get NutriPilot on your phone</h2>
          <p className="mt-0.5 text-sm leading-snug text-g4">{intro}</p>
        </div>
      </div>

      {way === "prompt" && (
        <button
          type="button"
          className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 text-[15px] font-medium text-g0 transition-transform active:scale-[0.98] sm:w-auto"
          onClick={async () => {
            if (await promptInstall()) toast.success("NutriPilot is being added to your apps");
            else dismiss();
          }}
        >
          Install app
        </button>
      )}
      {way === "use-chrome" && (
        <a href={chromeIntentUrl()} className="mt-4 inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 text-[15px] font-medium text-g0 transition-transform active:scale-[0.98] sm:w-auto">
          Open in Chrome
        </a>
      )}
      {way === "ios" && iosBrowser() === "other" && (
        <p className="mt-3 text-sm text-g4">Open this page in Safari, then tap Share and Add to Home Screen.</p>
      )}
      {way === "ios" && iosBrowser() !== "other" && (
        <ol className="mt-4 space-y-2.5 text-sm text-g4">
          <Step n={1}>
            Tap <Key><Share className="h-3.5 w-3.5" />Share</Key>{" "}
            {iosBrowser() === "chrome" ? "in the address bar" : iosBrowser() === "firefox" ? "in the menu" : "in Safari"}
          </Step>
          <Step n={2}>
            Choose <Key><SquarePlus className="h-3.5 w-3.5" />Add to Home Screen</Key>
          </Step>
          <Step n={3}>
            Tap <Key>Add</Key>
          </Step>
          {iosBrowser() === "safari" && <li className="pl-7.5 text-xs">No Share button? Tap ••• first, it&apos;s in there.</li>}
        </ol>
      )}
      {way === "android-menu" && (
        <ol className="mt-4 space-y-2.5 text-sm text-g4">
          <Step n={1}>
            {isSamsungInternet() ? (
              <>Tap <Key><Menu className="h-3.5 w-3.5" />menu</Key> at the bottom right</>
            ) : (
              <>Tap <Key><EllipsisVertical className="h-3.5 w-3.5" />menu</Key> at the top right in Chrome</>
            )}
          </Step>
          <Step n={2}>
            Choose <Key>{isSamsungInternet() ? "Add page to" : "Add to Home screen"}</Key>
          </Step>
          <Step n={3}>
            Tap <Key>{isSamsungInternet() ? "Home screen" : "Install"}</Key>
          </Step>
        </ol>
      )}
      {way === "none" && host && (
        <p className="mt-3 text-sm">
          <span className="text-g4">Address: </span>
          <span className="font-medium text-ink">{host}</span>
        </p>
      )}

      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-g4 transition-colors hover:bg-g2 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
