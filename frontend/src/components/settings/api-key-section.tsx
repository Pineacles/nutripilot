"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SettingsSection } from "./section";
import { useRegenerateApiKey } from "@/hooks/queries";

interface Props {
  apiKeyMasked: string;
}

export function ApiKeySection({ apiKeyMasked }: Props) {
  const [fullApiKey, setFullApiKey] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const regenerateApiKey = useRegenerateApiKey();

  function regenerateKey() {
    regenerateApiKey.mutate(undefined, {
      onSuccess: (res) => {
        setFullApiKey(res.api_key);
        setShowRegenConfirm(false);
        toast.success("API key regenerated");
      },
    });
  }

  return (
    <SettingsSection title="API access" description="For an agent or script that logs on your behalf." className="md:col-span-2">
      <div className="space-y-5 border-t border-g2 pt-4">
        <div className="space-y-1.5">
          <Label>API key</Label>
          <div className="flex items-center gap-2 rounded-[14px] border border-g3 py-1 pr-1 pl-3.5">
            <code className="min-h-9 flex-1 py-2 font-mono text-[13px] break-all text-g5">
              {fullApiKey || apiKeyMasked}
            </code>
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
          {fullApiKey && (
            <p className="text-xs text-ink">Save this key now, it will not be shown again.</p>
          )}
        </div>
        {!showRegenConfirm ? (
          <Button
            onClick={() => setShowRegenConfirm(true)}
            variant="destructive"
            className="w-full md:w-auto"
            size="lg"
          >
            Regenerate API key
          </Button>
        ) : (
          <div className="space-y-3 border-t border-g2 pt-4">
            <p className="text-[15px] text-ink">
              This invalidates the current key. Your agent will need the new key.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={regenerateKey}
                disabled={regenerateApiKey.isPending}
                size="lg"
                className="flex-1 md:flex-none"
              >
                {regenerateApiKey.isPending ? "Regenerating..." : "Regenerate key"}
              </Button>
              <Button
                onClick={() => setShowRegenConfirm(false)}
                variant="outline"
                size="lg"
                className="flex-1 md:flex-none"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingsSection>
  );
}
