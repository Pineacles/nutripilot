"use client";

import { EllipsisVertical, Menu, Share, SquarePlus, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
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
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{n}</span>
      <span className="leading-6">{children}</span>
    </li>
  );
}

const Key = ({ children }: { children: React.ReactNode }) => (
  <span className="pill mx-0.5 inline-flex items-center gap-1 rounded-lg px-1.5 py-px align-middle font-medium text-foreground">{children}</span>
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
      <div className={cn("clay-card flex items-center gap-3.5 p-5", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon.svg" alt="" className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-white/5" />
        <div className="text-sm">
          <div className="font-semibold text-foreground">NutriPilot is installed</div>
          <p className="text-muted-foreground">You&apos;re using the app version.</p>
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
    <div className={cn("clay-card relative p-5", className)}>
      <div className="flex items-start gap-3.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icons/icon.svg" alt="" className="h-11 w-11 shrink-0 rounded-xl ring-1 ring-white/5" />
        <div className={cn("min-w-0 flex-1", dismissible && "pr-8")}>
          <h2 className="font-semibold text-foreground">Get NutriPilot on your phone</h2>
          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{intro}</p>
        </div>
      </div>

      {way === "prompt" && (
        <Button
          size="lg"
          className="mt-4 h-11 w-full sm:h-9 sm:w-auto sm:px-5"
          onClick={async () => {
            if (await promptInstall()) toast.success("NutriPilot is being added to your apps");
            else dismiss();
          }}
        >
          Install app
        </Button>
      )}
      {way === "use-chrome" && (
        <a href={chromeIntentUrl()} className={cn(buttonVariants({ size: "lg" }), "mt-4 h-11 w-full sm:h-9 sm:w-auto sm:px-5")}>
          Open in Chrome
        </a>
      )}
      {way === "ios" && iosBrowser() === "other" && (
        <p className="mt-3 text-sm text-muted-foreground">Open this page in Safari, then tap Share and Add to Home Screen.</p>
      )}
      {way === "ios" && iosBrowser() !== "other" && (
        <ol className="mt-4 space-y-2.5 text-sm text-muted-foreground">
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
        <ol className="mt-4 space-y-2.5 text-sm text-muted-foreground">
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
          <span className="text-muted-foreground">Address: </span>
          <span className="font-medium text-foreground">{host}</span>
        </p>
      )}

      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Not now"
          className="absolute right-1.5 top-1.5 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
