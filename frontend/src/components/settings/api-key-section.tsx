"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
    <div className="clay-card p-5 md:col-span-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">API Access</h3>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">API Key</Label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
            <code className="flex-1 text-sm text-foreground/60 font-mono">
              {fullApiKey || apiKeyMasked}
            </code>
            {fullApiKey && (
              <Button
                onClick={() => {
                  navigator.clipboard.writeText(fullApiKey);
                }}
                variant="ghost"
                size="xs"
                className="text-primary hover:text-primary/80"
              >
                Copy
              </Button>
            )}
          </div>
          {fullApiKey && (
            <p className="text-[10px] text-yellow-500 mt-1">
              Save this key now -- it will not be shown again.
            </p>
          )}
        </div>
        <Separator />
        {!showRegenConfirm ? (
          <Button
            onClick={() => setShowRegenConfirm(true)}
            variant="destructive"
            className="w-full"
            size="lg"
          >
            Regenerate API Key
          </Button>
        ) : (
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 space-y-2">
            <p className="text-xs text-destructive/80">
              This will invalidate the current key. Your agent will need the new key.
            </p>
            <div className="flex gap-2">
              <Button
                onClick={regenerateKey}
                disabled={regenerateApiKey.isPending}
                variant="destructive"
                className="flex-1"
              >
                {regenerateApiKey.isPending ? "Regenerating..." : "Confirm"}
              </Button>
              <Button
                onClick={() => setShowRegenConfirm(false)}
                variant="outline"
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
