"use client";

import { useEffect, useState, useCallback } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardCard } from "@/components/dashboard-card";
import { apiFetch } from "@/lib/api";
import type {
  UserSettings,
  NutritionTargets,
  MicronutrientTargetItem,
  SupplementDefinition,
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
        <div className="flex h-64 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#22c55e] border-t-transparent" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Settings">
      <div className="grid grid-cols-2 gap-4">
        {/* Section 1: Nutrition Targets */}
        <DashboardCard title="Nutrition Targets">
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
              <div key={field.key}>
                <label className="text-xs text-white/40 mb-1 block">{field.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={nutrition[field.key]}
                    onChange={(e) =>
                      setNutrition((prev) => ({ ...prev, [field.key]: Number(e.target.value) }))
                    }
                    className="flex-1 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2 text-sm text-white outline-none focus:border-[#22c55e]/50 tabular-nums"
                  />
                  <span className="text-xs text-white/30 w-8">{field.unit}</span>
                </div>
              </div>
            ))}
            <button
              onClick={saveNutritionTargets}
              className="mt-2 w-full rounded-xl bg-[#22c55e] py-2.5 text-sm font-semibold text-[#0f0f0f] transition-opacity hover:opacity-90"
            >
              {nutritionSaved ? "Saved!" : "Save Targets"}
            </button>
          </div>
        </DashboardCard>

        {/* Section 2: Supplement Management */}
        <DashboardCard title="Supplement Management">
          <div className="space-y-2 max-h-[320px] overflow-y-auto">
            {supplements.length === 0 && (
              <p className="text-sm text-white/30">No supplements defined</p>
            )}
            {supplements.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2.5"
              >
                <button
                  onClick={() => toggleSuppActive(s.id, !s.active)}
                  className={`h-5 w-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                    s.active
                      ? "border-[#22c55e]/40 bg-[#22c55e]/10"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  {s.active && (
                    <svg className="h-3 w-3 text-[#22c55e]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm truncate ${s.active ? "text-white/80" : "text-white/30 line-through"}`}>
                    {s.name}
                  </p>
                  <p className="text-xs text-white/30">
                    {s.dose_amount} {s.dose_unit}
                    {s.time_of_day && ` · ${s.time_of_day}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteSupplement(s.id)}
                  className="text-white/20 hover:text-[#ef4444] transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="mt-2 w-full rounded-xl border border-white/10 py-2.5 text-sm font-medium text-white/50 transition-colors hover:bg-white/5 hover:text-white/80"
          >
            + Add Supplement
          </button>
        </DashboardCard>

        {/* Section 3: Micronutrient Targets */}
        <DashboardCard title="Micronutrient Daily Targets">
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2 text-[10px] text-white/30 uppercase tracking-wide px-1">
              <span>Micronutrient</span>
              <span>Daily Target</span>
              <span>Unit</span>
            </div>
            {microTargets.map((t, i) => (
              <div key={t.nutrient} className="grid grid-cols-3 gap-2 items-center">
                <span className="text-sm text-white/70">{MICRO_LABELS[t.nutrient] || t.nutrient}</span>
                <input
                  type="number"
                  value={t.target_value}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setMicroTargets((prev) =>
                      prev.map((mt, j) => (j === i ? { ...mt, target_value: val } : mt))
                    );
                  }}
                  className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5 text-sm text-white outline-none focus:border-[#22c55e]/50 tabular-nums"
                />
                <span className="text-xs text-white/40">{t.unit}</span>
              </div>
            ))}
          </div>
          <button
            onClick={saveMicroTargets}
            className="mt-3 w-full rounded-xl bg-[#22c55e] py-2.5 text-sm font-semibold text-[#0f0f0f] transition-opacity hover:opacity-90"
          >
            {microSaved ? "Saved!" : "Save Targets"}
          </button>
        </DashboardCard>

        {/* Section 4: API Access */}
        <DashboardCard title="API Access">
          <div className="space-y-4">
            <div>
              <label className="text-xs text-white/40 mb-1 block">API Key</label>
              <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
                <code className="flex-1 text-sm text-white/60 font-mono">
                  {fullApiKey || apiKeyMasked}
                </code>
                {fullApiKey && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(fullApiKey);
                    }}
                    className="text-xs text-[#22c55e] hover:text-[#22c55e]/80 transition-colors"
                  >
                    Copy
                  </button>
                )}
              </div>
              {fullApiKey && (
                <p className="text-[10px] text-[#f59e0b] mt-1">
                  Save this key now — it won't be shown again.
                </p>
              )}
            </div>
            {!showRegenConfirm ? (
              <button
                onClick={() => setShowRegenConfirm(true)}
                className="w-full rounded-xl border border-[#ef4444]/30 py-2.5 text-sm font-medium text-[#ef4444]/70 transition-colors hover:bg-[#ef4444]/10 hover:text-[#ef4444]"
              >
                Regenerate API Key
              </button>
            ) : (
              <div className="rounded-xl border border-[#ef4444]/20 bg-[#ef4444]/5 p-3 space-y-2">
                <p className="text-xs text-[#ef4444]/80">
                  This will invalidate the current key. Your agent will need the new key.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={regenerateApiKey}
                    className="flex-1 rounded-lg bg-[#ef4444] py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => setShowRegenConfirm(false)}
                    className="flex-1 rounded-lg border border-white/10 py-2 text-sm text-white/50 transition-colors hover:bg-white/5"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </DashboardCard>
      </div>

      {/* Add Supplement Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/5 bg-[#1a1a1a] p-6 shadow-2xl">
            <h2 className="text-lg font-semibold text-white mb-4">Add Supplement</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-white/40 mb-1 block">Name</label>
                <input
                  type="text"
                  value={newSupp.name}
                  onChange={(e) => setNewSupp((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Vitamin D3"
                  className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm text-white placeholder-white/20 outline-none focus:border-[#22c55e]/50"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Dose</label>
                  <input
                    type="number"
                    value={newSupp.dose_amount}
                    onChange={(e) => setNewSupp((p) => ({ ...p, dose_amount: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#22c55e]/50 tabular-nums"
                  />
                </div>
                <div>
                  <label className="text-xs text-white/40 mb-1 block">Unit</label>
                  <select
                    value={newSupp.dose_unit}
                    onChange={(e) => setNewSupp((p) => ({ ...p, dose_unit: e.target.value }))}
                    className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#22c55e]/50"
                  >
                    {DOSE_UNITS.map((u) => (
                      <option key={u} value={u} className="bg-[#1a1a1a]">{u}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">Timing</label>
                <select
                  value={newSupp.time_of_day}
                  onChange={(e) => setNewSupp((p) => ({ ...p, time_of_day: e.target.value }))}
                  className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none focus:border-[#22c55e]/50"
                >
                  {TIMINGS.map((t) => (
                    <option key={t} value={t} className="bg-[#1a1a1a]">{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-white/40 mb-1 block">
                  Micronutrients contributed (JSON, optional)
                </label>
                <input
                  type="text"
                  value={newSupp.micronutrients}
                  onChange={(e) => setNewSupp((p) => ({ ...p, micronutrients: e.target.value }))}
                  placeholder='{"vitamin_d": 50, "zinc": 10}'
                  className="w-full rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5 text-xs text-white/70 font-mono placeholder-white/15 outline-none focus:border-[#22c55e]/50"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={addSupplement}
                disabled={!newSupp.name}
                className="flex-1 rounded-xl bg-[#22c55e] py-2.5 text-sm font-semibold text-[#0f0f0f] transition-opacity hover:opacity-90 disabled:opacity-30"
              >
                Add
              </button>
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 rounded-xl border border-white/10 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/5"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
