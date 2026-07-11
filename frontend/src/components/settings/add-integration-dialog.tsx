"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCreateIntegration } from "@/hooks/mutations/integrations";
import { INTEGRATION_TYPES, MEASURE_TARGET_LABELS } from "@/lib/integration-types";
import { getErrorMessage } from "@/lib/api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MeasureMapRow {
  vendorKey: string;
  target: string;
}

/**
 * Advanced form to connect a smart scale / external API. Function over beauty: this
 * mirrors the real shape backend/app/schemas/integration.py validates (field_mapping.type,
 * per-type credential keys, measure_map, source_label, data_type).
 */
export function AddIntegrationDialog({ open, onOpenChange }: Props) {
  const [type, setType] = useState<keyof typeof INTEGRATION_TYPES>("generic_json");
  const [name, setName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [schedule, setSchedule] = useState("0 6 * * *");
  const [sourceLabel, setSourceLabel] = useState("");
  const [authHeader, setAuthHeader] = useState("");
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [measureMap, setMeasureMap] = useState<MeasureMapRow[]>([{ vendorKey: "", target: "weight_kg" }]);

  const spec = INTEGRATION_TYPES[type];
  const createIntegration = useCreateIntegration();

  const missingRequired = useMemo(() => {
    if (!name.trim() || !sourceUrl.trim() || !sourceLabel.trim()) return true;
    if (spec.requiresAuthHeader && !authHeader.trim()) return true;
    for (const f of spec.credentialFields) {
      if (!credentials[f.key]?.trim()) return true;
    }
    const validRows = measureMap.filter((r) => r.vendorKey.trim() && r.target);
    return validRows.length === 0;
  }, [name, sourceUrl, sourceLabel, authHeader, credentials, measureMap, spec]);

  function resetForm() {
    setType("generic_json");
    setName("");
    setSourceUrl("");
    setSchedule("0 6 * * *");
    setSourceLabel("");
    setAuthHeader("");
    setCredentials({});
    setMeasureMap([{ vendorKey: "", target: "weight_kg" }]);
  }

  function handleTypeChange(next: keyof typeof INTEGRATION_TYPES) {
    setType(next);
    setCredentials({});
    setMeasureMap([{ vendorKey: "", target: INTEGRATION_TYPES[next].validMeasureTargets[0] }]);
  }

  function updateMeasureRow(i: number, patch: Partial<MeasureMapRow>) {
    setMeasureMap((prev) => prev.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }

  function handleSubmit() {
    if (missingRequired) {
      toast.error("Fill in all required fields.");
      return;
    }
    const measure_map: Record<string, string> = {};
    for (const row of measureMap) {
      if (row.vendorKey.trim() && row.target) measure_map[row.vendorKey.trim()] = row.target;
    }
    const field_mapping: Record<string, unknown> = {
      type,
      source_label: sourceLabel.trim(),
      data_type: "weight",
      measure_map,
      ...credentials,
    };
    createIntegration.mutate(
      {
        name: name.trim(),
        source_url: sourceUrl.trim(),
        auth_header: authHeader.trim() || undefined,
        schedule,
        field_mapping,
      },
      {
        onSuccess: () => {
          toast.success("Integration connected");
          resetForm();
          onOpenChange(false);
        },
        onError: (err) => toast.error(getErrorMessage(err, "Couldn't connect integration.")),
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) resetForm(); onOpenChange(next); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add integration</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 max-h-[70vh] overflow-y-auto thin-scrollbar pr-1">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Type</Label>
            <select
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as keyof typeof INTEGRATION_TYPES)}
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            >
              {Object.entries(INTEGRATION_TYPES).map(([key, s]) => (
                <option key={key} value={key} className="bg-card">{s.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Withings Body+" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Source label</Label>
              <Input value={sourceLabel} onChange={(e) => setSourceLabel(e.target.value)} placeholder="e.g. withings" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Source URL</Label>
            <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://..." className="font-mono text-xs" />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sync schedule (cron)</Label>
            <Input value={schedule} onChange={(e) => setSchedule(e.target.value)} className="font-mono text-xs" />
          </div>

          <Separator />

          {spec.requiresAuthHeader && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Auth header (OAuth2 access token)</Label>
              <Input value={authHeader} onChange={(e) => setAuthHeader(e.target.value)} className="font-mono text-xs" type="password" />
            </div>
          )}
          {spec.credentialFields.map((f) => (
            <div key={f.key} className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                value={credentials[f.key] ?? ""}
                onChange={(e) => setCredentials((prev) => ({ ...prev, [f.key]: e.target.value }))}
                type={f.secret ? "password" : "text"}
                className="font-mono text-xs"
              />
            </div>
          ))}

          <Separator />

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Field mapping (vendor field → NutriPilot field)</Label>
            {measureMap.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  value={row.vendorKey}
                  onChange={(e) => updateMeasureRow(i, { vendorKey: e.target.value })}
                  placeholder="vendor field key"
                  className="flex-1 font-mono text-xs"
                />
                <select
                  value={row.target}
                  onChange={(e) => updateMeasureRow(i, { target: e.target.value })}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 py-1 text-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {spec.validMeasureTargets.map((t) => (
                    <option key={t} value={t} className="bg-card">{MEASURE_TARGET_LABELS[t] ?? t}</option>
                  ))}
                </select>
                <button
                  onClick={() => setMeasureMap((prev) => prev.filter((_, idx) => idx !== i))}
                  disabled={measureMap.length === 1}
                  className="text-muted-foreground/40 hover:text-destructive disabled:opacity-30 px-1"
                >
                  ✕
                </button>
              </div>
            ))}
            <Button
              onClick={() => setMeasureMap((prev) => [...prev, { vendorKey: "", target: spec.validMeasureTargets[0] }])}
              variant="ghost"
              size="xs"
            >
              + Add field
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button onClick={handleSubmit} disabled={missingRequired || createIntegration.isPending} size="lg" className="flex-1">
              {createIntegration.isPending ? "Connecting..." : "Connect"}
            </Button>
            <Button onClick={() => onOpenChange(false)} variant="outline" size="lg">Cancel</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
