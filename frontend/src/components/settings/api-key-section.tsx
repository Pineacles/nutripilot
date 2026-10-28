"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "./section";
import { useRegenerateApiKey } from "@/hooks/queries";

/** The start of the API key (the server stores only a hash), the full key once after it is regenerated (the full key is shown once, with Copy). */
export function ApiKeySection({ apiKeyMasked, fullApiKey }: { apiKeyMasked: string; fullApiKey: string | null }) {
  return (
    <SettingsSection title="API key" description="For an agent or script that logs on your behalf.">
      <div className="space-y-1.5 border-t border-g2 pt-4">
        <Label>Key</Label>
        <div className="flex items-center gap-2 rounded-[14px] border border-g3 py-1 pr-1 pl-3.5">
          <code className="min-h-9 flex-1 py-2 font-mono text-[13px] break-all text-g5">{fullApiKey || apiKeyMasked}</code>
          {fullApiKey && (
            <Button
              onClick={() => {
                navigator.clipboard.writeText(fullApiKey);
                toast.success("Copied");
              }}
              variant="outline"
              size="sm"
            >
              Copy
            </Button>
          )}
        </div>
        {fullApiKey ? (
          <p className="text-xs text-ink">Save this key now, it will not be shown again.</p>
        ) : (
          <p className="text-xs text-ink">Only the start of the key is kept. Regenerate to get a new one.</p>
        )}
      </div>
    </SettingsSection>
  );
}

/** Regenerate the key: last on the page, set apart, and behind a confirm. */
export function RegenerateKeySection({ onRegenerated }: { onRegenerated: (key: string) => void }) {
  const [confirming, setConfirming] = useState(false);
  const regenerateApiKey = useRegenerateApiKey();

  function regenerate() {
    regenerateApiKey.mutate(undefined, {
      onSuccess: (res) => {
        onRegenerated(res.api_key);
        setConfirming(false);
        toast.success("API key regenerated");
      },
    });
  }

  return (
    <section className="mt-16 border-t border-g2 pt-6">
      {!confirming ? (
        <Button onClick={() => setConfirming(true)} variant="destructive" className="w-full md:w-auto" size="lg">
          Regenerate API key
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-[15px] text-ink">This invalidates the current key. Your agent will need the new key.</p>
          <div className="flex gap-2">
            <Button onClick={regenerate} disabled={regenerateApiKey.isPending} size="lg" className="flex-1 md:flex-none">
              {regenerateApiKey.isPending ? "Regenerating..." : "Regenerate key"}
            </Button>
            <Button onClick={() => setConfirming(false)} variant="outline" size="lg" className="flex-1 md:flex-none">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
