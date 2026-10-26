"use client";

import { toast } from "sonner";
import { SettingsSection } from "@/components/settings/section";
import { Switch } from "@/components/settings/nutrients-content";
import { useGame, useUpdateGameSettings } from "@/hooks/game";
import { getErrorMessage } from "@/lib/api";
import type { Celebrations, GameSettingsInput } from "@/lib/game-types";

const CELEBRATIONS: { value: Celebrations; label: string; hint: string }[] = [
  { value: "full", label: "Full", hint: "A new print is pulled across the screen; big ones throw paper." },
  { value: "quiet", label: "Quiet", hint: "A short note, no sheet and no paper." },
  { value: "off", label: "Off", hint: "Prints still collect in Progress, silently." },
];

const MAX_GOALS = 3;

/** Streaks, prints, quests: on or off, how loud, and which day goals close the day. */
export function MotivationSection() {
  const { data: game } = useGame();
  const update = useUpdateGameSettings();
  if (!game) return null;

  function save(body: GameSettingsInput) {
    update.mutate(body, { onError: (e) => toast.error(getErrorMessage(e)) });
  }

  const chosen = game.day_goals.map((g) => ({ key: g.key, target: g.unit === "meals" ? g.target : null }));
  const isOn = (key: string) => chosen.some((g) => g.key === key);
  const meals = chosen.find((g) => g.key === "meals");

  function toggleGoal(key: string, defaultTarget: number | null) {
    const next = isOn(key) ? chosen.filter((g) => g.key !== key) : [...chosen, { key, target: key === "meals" ? defaultTarget ?? 3 : null }];
    save({ day_goals: next });
  }

  return (
    <SettingsSection title="Motivation" description="Streaks, prints and weekly quests reward logging and consistency, never eating less." className="mb-4">
      <div className="border-t border-g2">
        <div className="flex min-h-[60px] items-center gap-3">
          <span className="flex-1 text-[15px] text-ink">Streaks, prints and quests</span>
          <Switch on={game.enabled} label="Streaks, prints and quests" onToggle={() => save({ enabled: !game.enabled })} />
        </div>
      </div>
      {game.enabled && (
        <>
          <div className="border-t border-g2">
            <div className="flex min-h-[60px] items-center gap-3">
              <span className="flex-1 text-[15px] text-ink">Show the streak on Today</span>
              <Switch on={game.show_streak} label="Show the streak on Today" onToggle={() => save({ show_streak: !game.show_streak })} />
            </div>
          </div>
          <div className="border-t border-g2 py-3">
            <p className="text-[15px] text-ink">Celebrations</p>
            <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Celebrations">
              {CELEBRATIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  role="radio"
                  aria-checked={game.celebrations === c.value}
                  onClick={() => save({ celebrations: c.value })}
                  className={`h-10 rounded-full border px-4 text-[13px] transition-colors ${
                    game.celebrations === c.value ? "border-ink bg-ink text-g0" : "border-g3 text-ink hover:border-g5"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[12px] text-g4">{CELEBRATIONS.find((c) => c.value === game.celebrations)?.hint}</p>
          </div>
          <div className="border-t border-g2 pt-3">
            <p className="text-[15px] text-ink">Day goals</p>
            <p className="text-[12px] text-g4">Up to three. Closing all of them closes the day. There is no calorie goal on purpose.</p>
            <ul className="mt-1">
              {game.available_goals.map((g) => {
                const on = isOn(g.key);
                const full = !on && chosen.length >= MAX_GOALS;
                return (
                  <li key={g.key} className="flex min-h-[60px] items-center gap-3 border-t border-g2 first:border-t-0">
                    <span className={`flex-1 text-[15px] ${full ? "text-g4" : "text-ink"}`}>{g.label}</span>
                    {g.key === "meals" && on && meals && (
                      <span className="flex items-center gap-1">
                        {[2, 3, 4, 5].map((n) => (
                          <button
                            key={n}
                            type="button"
                            aria-pressed={meals.target === n}
                            aria-label={`${n} meals`}
                            onClick={() => save({ day_goals: chosen.map((c) => (c.key === "meals" ? { key: "meals", target: n } : c)) })}
                            className={`size-10 rounded-full border text-[13px] tabular-nums ${meals.target === n ? "border-ink bg-ink text-g0" : "border-g3 text-ink"}`}
                          >
                            {n}
                          </button>
                        ))}
                      </span>
                    )}
                    <Switch on={on} label={`Day goal ${g.label}`} onToggle={() => !full && toggleGoal(g.key, g.default_target)} />
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </SettingsSection>
  );
}
