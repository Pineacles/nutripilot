"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/api";
import type {
  UserSettings,
  NutritionTargets,
  MicronutrientTargetItem,
  SupplementDefinition,
  Integration,
} from "@/lib/types";

const DEFAULT_MICRO_TARGETS: MicronutrientTargetItem[] = [
  { nutrient: "vitamin_d", target_value: 20, unit: "µg" },
  { nutrient: "zinc", target_value: 10, unit: "mg" },
  { nutrient: "omega3", target_value: 1000, unit: "mg" },
  { nutrient: "creatine", target_value: 5, unit: "g" },
  { nutrient: "fiber", target_value: 30, unit: "g" },
  { nutrient: "iron", target_value: 8, unit: "mg" },
];

const MICRO_LABELS: Record<string, string> = {
  vitamin_d: "Vitamin D",
  zinc: "Zinc",
  omega3: "Omega-3",
  creatine: "Creatine",
  fiber: "Fiber",
  iron: "Iron",
  calcium: "Calcium",
  magnesium: "Magnesium",
  b12: "B12",
  vit_c: "Vitamin C",
  potassium: "Potassium",
};

const DOSE_UNITS = ["mg", "µg", "g", "IU", "ml"];
const TIMINGS = ["morning", "afternoon", "evening", "with meal"];

function cronToHuman(cron: string): string {
  const parts = cron.split(" ");
  if (parts.length < 5) return cron;
  const [min, hour, dom, mon, dow] = parts;
  if (dom === "*" && mon === "*" && dow === "*") {
    return `Daily at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  if (dom === "*" && mon === "*") {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${days[Number(dow)] || dow} at ${hour.padStart(2, "0")}:${min.padStart(2, "0")}`;
  }
  return cron;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  // Nutrition targets form state
  const [nutrition, setNutrition] = useState<NutritionTargets>({
    target_kcal: 2000,
    target_protein_g: 150,
    target_carbs_g: 250,
    target_fat_g: 70,
    target_fiber_g: 30,
    target_sugar_g: 50,
    target_sodium_mg: 2300,
  });
  const [nutritionSaved, setNutritionSaved] = useState(false);

  // Micronutrient targets
  const [microTargets, setMicroTargets] = useState<MicronutrientTargetItem[]>(DEFAULT_MICRO_TARGETS);
  const [microSaved, setMicroSaved] = useState(false);

  // Supplement definitions
  const [supplements, setSupplements] = useState<SupplementDefinition[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Add supplement form
  const [newSupp, setNewSupp] = useState({
    name: "",
    dose_amount: 0,
    dose_unit: "mg",
    time_of_day: "morning",
    micronutrients: "" as string,
  });

  // Integrations
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  // API key
  const [apiKeyMasked, setApiKeyMasked] = useState("");
  const [fullApiKey, setFullApiKey] = useState<string | null>(null);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      const data = await apiFetch<UserSettings>("/api/v1/settings");
      setSettings(data);
      setNutrition(data.nutrition_targets);
      setMicroTargets(
        data.micronutrient_targets.length > 0
          ? data.micronutrient_targets
          : DEFAULT_MICRO_TARGETS
      );
      setSupplements(data.supplement_definitions);
      setApiKeyMasked(data.api_key_masked);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    apiFetch<Integration[]>("/api/v1/integrations").then(setIntegrations).catch(() => {});
  }, []);

  // --- Handlers ---

  async function saveNutritionTargets() {
    await apiFetch("/api/v1/settings/nutrition-targets", {
      method: "PUT",
      body: JSON.stringify(nutrition),
    });
    setNutritionSaved(true);
    setTimeout(() => setNutritionSaved(false), 2000);
  }

  async function saveMicroTargets() {
    await apiFetch("/api/v1/settings/micronutrient-targets", {
      method: "PUT",
      body: JSON.stringify({ targets: microTargets }),
    });
    setMicroSaved(true);
    setTimeout(() => setMicroSaved(false), 2000);
  }

  async function addSupplement() {
    let microObj: Record<string, number> | null = null;
    if (newSupp.micronutrients.trim()) {
      try {
        microObj = JSON.parse(newSupp.micronutrients);
      } catch {
        return;
      }
    }
    const created = await apiFetch<SupplementDefinition>("/api/v1/supplements", {
      method: "POST",
      body: JSON.stringify({
        name: newSupp.name,
        dose_amount: newSupp.dose_amount,
        dose_unit: newSupp.dose_unit,
        time_of_day: newSupp.time_of_day,
        micronutrients: microObj,
      }),
    });
    setSupplements((prev) => [...prev, created]);
    setShowAddModal(false);
    setNewSupp({ name: "", dose_amount: 0, dose_unit: "mg", time_of_day: "morning", micronutrients: "" });
  }

  async function toggleSuppActive(id: string, active: boolean) {
    const updated = await apiFetch<SupplementDefinition>(`/api/v1/supplements/${id}`, {
      method: "PUT",
      body: JSON.stringify({ active }),
    });
    setSupplements((prev) => prev.map((s) => (s.id === id ? updated : s)));
  }

  async function deleteSupplement(id: string) {
    await apiFetch(`/api/v1/supplements/${id}`, { method: "DELETE" });
    setSupplements((prev) => prev.filter((s) => s.id !== id));
  }

  async function regenerateApiKey() {
    const res = await apiFetch<{ api_key_masked: string; api_key: string }>(
      "/api/v1/settings/regenerate-api-key",
      { method: "POST" }
    );
    setApiKeyMasked(res.api_key_masked);
    setFullApiKey(res.api_key);
    setShowRegenConfirm(false);
  }

  if (loading) {
    return (
      <DashboardLayout title="Settings">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="clay-card p-5 space-y-3">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="h-10 rounded-lg bg-muted/50 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Section 1: Nutrition Targets */}
        <div className="clay-card p-5 md:col-span-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Nutrition Targets</h3>
          <div className="space-y-3">
            {[
              { label: "Daily Calorie Target", key: "target_kcal" as const, unit: "kcal" },
              { label: "Protein Target", key: "target_protein_g" as const, unit: "g" },
              { label: "Carbs Target", key: "target_carbs_g" as const, unit: "g" },
              { label: "Fat Target", key: "target_fat_g" as const, unit: "g" },
              { label: "Fiber Target", key: "target_fiber_g" as const, unit: "g" },
              { label: "Sugar Limit", key: "target_sugar_g" as const, unit: "g" },
              { label: "Sodium Limit", key: "target_sodium_mg" as const, unit: "mg" },
            ].map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={nutrition[field.key]}
                    onChange={(e) =>
                      setNutrition((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                    }
                    className="flex-1 tabular-nums"
                  />
                  <span className="text-xs text-muted-foreground w-8">{field.unit}</span>
                </div>
              </div>
            ))}
            <Button
              onClick={saveNutritionTargets}
              className="mt-2 w-full"
              size="lg"
            >
              {nutritionSaved ? "Saved!" : "Save Targets"}
            </Button>
          </div>
        </div>

        {/* Section 2: Supplement Management */}
        <div className="clay-card p-5 md:col-span-1">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Supplement Management</h3>
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {supplements.length === 0 && (
              <p className="text-sm text-muted-foreground">No supplements defined</p>
            )}
            {supplements.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl bg-muted/30 border border-border px-3 py-2.5 transition-colors hover:bg-muted/50"
              >
                <button
                  onClick={() => toggleSuppActive(s.id, !s.active)}
                  className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    s.active
                      ? "border-primary/40 bg-primary/10"
                      : "border-border bg-muted/50"
                  }`}
                >
                  {s.active && (
                    <svg className="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${s.active ? "text-foreground/80" : "text-muted-foreground line-through"}`}>
                    {s.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {s.dose_amount} {s.dose_unit}
                    </Badge>
                    {s.time_of_day && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                        {s.time_of_day}
                      </Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteSupplement(s.id)}
                  className="text-muted-foreground/40 hover:text-destructive transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogTrigger
              render={
                <Button variant="outline" className="w-full" />
              }
            >
              + Add Supplement
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Add Supplement</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Name</Label>
                  <Input
                    type="text"
                    value={newSupp.name}
                    onChange={(e) => setNewSupp((p) => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Vitamin D3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Dose</Label>
                    <Input
                      type="number"
                      value={newSupp.dose_amount}
                      onChange={(e) => setNewSupp((p) => ({ ...p, dose_amount: Number(e.target.value) }))}
                      className="tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Unit</Label>
                    <select
                      value={newSupp.dose_unit}
                      onChange={(e) => setNewSupp((p) => ({ ...p, dose_unit: e.target.value }))}
                      className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                    >
                      {DOSE_UNITS.map((u) => (
                        <option key={u} value={u} className="bg-card">{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Timing</Label>
                  <select
                    value={newSupp.time_of_day}
                    onChange={(e) => setNewSupp((p) => ({ ...p, time_of_day: e.target.value }))}
                    className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                  >
                    {TIMINGS.map((t) => (
                      <option key={t} value={t} className="bg-card">{t}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    Micronutrients contributed (JSON, optional)
                  </Label>
                  <Input
                    type="text"
                    value={newSupp.micronutrients}
                    onChange={(e) => setNewSupp((p) => ({ ...p, micronutrients: e.target.value }))}
                    placeholder='{"vitamin_d": 50, "zinc": 10}'
                    className="text-xs font-mono"
                  />
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                <Button
                  onClick={addSupplement}
                  disabled={!newSupp.name}
                  className="flex-1"
                  size="lg"
                >
                  Add
                </Button>
                <Button
                  onClick={() => setShowAddModal(false)}
                  variant="outline"
                  className="flex-1"
                  size="lg"
                >
                  Cancel
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Section 3: Micronutrient Targets */}
        <div className="clay-card p-5 md:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Micronutrient Daily Targets</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-[10px] text-muted-foreground uppercase tracking-wide px-1">
              <span>Micronutrient</span>
              <span>Daily Target</span>
              <span>Unit</span>
            </div>
            {microTargets.map((t, i) => (
              <div key={t.nutrient} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-foreground/70">{MICRO_LABELS[t.nutrient] || t.nutrient}</span>
                <Input
                  type="number"
                  value={t.target_value}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMicroTargets((prev) =>
                      prev.map((mt, j) => (j === i ? { ...mt, target_value: val } : mt))
                    );
                  }}
                  className="tabular-nums"
                />
                <span className="text-xs text-muted-foreground">{t.unit}</span>
              </div>
            ))}
          </div>
          <Button
            onClick={saveMicroTargets}
            className="mt-3 w-full"
            size="lg"
          >
            {microSaved ? "Saved!" : "Save Targets"}
          </Button>
        </div>

        {/* Section 4: API Access */}
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
                    onClick={regenerateApiKey}
                    variant="destructive"
                    className="flex-1"
                  >
                    Confirm
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

        {/* Section 5: Connected Integrations */}
        <div className="clay-card p-5 md:col-span-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Connected Integrations</h3>
          {integrations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No integrations connected. An AI agent can set these up for you.</p>
          ) : (
            <div className="space-y-2">
              {integrations.map((integration) => (
                <div key={integration.id} className="pill rounded-xl p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{integration.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{integration.source_url}</p>
                  </div>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="flex items-center gap-2 justify-end">
                      <span className="text-[10px] text-muted-foreground">{cronToHuman(integration.schedule)}</span>
                      <Badge variant={integration.status === "active" ? "default" : integration.status === "paused" ? "secondary" : "destructive"}
                        className="text-[10px]">
                        {integration.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Synced: {timeAgo(integration.last_synced_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
