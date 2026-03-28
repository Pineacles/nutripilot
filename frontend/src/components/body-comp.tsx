"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { BodyCompEntry } from "@/lib/types";
import { DashboardCard } from "./dashboard-card";

interface Props {
  data: BodyCompEntry[];
}

export function BodyFatCard({ data }: Props) {
  const points = data.filter((d) => d.body_fat_pct != null);

  if (points.length === 0) {
    return (
      <DashboardCard title="Body Fat %" className="col-span-1">
        <p className="text-sm text-white/30">No body fat data yet</p>
      </DashboardCard>
    );
  }

  const latest = points[points.length - 1];
  const values = points.map((p) => p.body_fat_pct!);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);

  return (
    <DashboardCard title="Body Fat %" className="col-span-1">
      <div className="flex items-baseline gap-2 -mt-1">
        <span className="text-2xl font-bold tabular-nums text-white">{latest.body_fat_pct}%</span>
        {points.length > 1 && (
          <span className={`text-sm font-semibold tabular-nums ${
            latest.body_fat_pct! <= points[0].body_fat_pct! ? "text-[#22c55e]" : "text-[#ef4444]"
          }`}>
            {latest.body_fat_pct! <= points[0].body_fat_pct! ? "" : "+"}
            {(latest.body_fat_pct! - points[0].body_fat_pct!).toFixed(1)}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })}
          />
          <YAxis domain={[min, max]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8e8e8", fontSize: 12 }} />
          <Line type="monotone" dataKey="body_fat_pct" stroke="#f59e0b" strokeWidth={2} dot={{ fill: "#f59e0b", r: 3, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}

export function MuscleCard({ data }: Props) {
  const points = data.filter((d) => d.muscle_mass_pct != null);

  if (points.length === 0) {
    return (
      <DashboardCard title="Muscle Mass %" className="col-span-1">
        <p className="text-sm text-white/30">No muscle data yet</p>
      </DashboardCard>
    );
  }

  const latest = points[points.length - 1];
  const values = points.map((p) => p.muscle_mass_pct!);
  const min = Math.floor(Math.min(...values) - 2);
  const max = Math.ceil(Math.max(...values) + 2);

  return (
    <DashboardCard title="Muscle Mass %" className="col-span-1">
      <div className="flex items-baseline gap-2 -mt-1">
        <span className="text-2xl font-bold tabular-nums text-white">{latest.muscle_mass_pct}%</span>
        {points.length > 1 && (
          <span className={`text-sm font-semibold tabular-nums ${
            latest.muscle_mass_pct! >= points[0].muscle_mass_pct! ? "text-[#22c55e]" : "text-[#ef4444]"
          }`}>
            {latest.muscle_mass_pct! >= points[0].muscle_mass_pct! ? "+" : ""}
            {(latest.muscle_mass_pct! - points[0].muscle_mass_pct!).toFixed(1)}%
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={points}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }}
            axisLine={false} tickLine={false}
            tickFormatter={(v) => new Date(v).toLocaleDateString("en", { weekday: "short" })}
          />
          <YAxis domain={[min, max]} tick={{ fill: "rgba(255,255,255,0.3)", fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
          <Tooltip contentStyle={{ backgroundColor: "#1a1a1a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, color: "#e8e8e8", fontSize: 12 }} />
          <Line type="monotone" dataKey="muscle_mass_pct" stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }} />
        </LineChart>
      </ResponsiveContainer>
    </DashboardCard>
  );
}
