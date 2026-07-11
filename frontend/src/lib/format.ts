/** Human-readable rendering of a 5-field cron schedule (integration sync schedules). */
export function cronToHuman(cron: string): string {
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

/** Compact relative-time rendering (integration last-synced-at, etc). */
export function timeAgo(dateStr: string | null): string {
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
