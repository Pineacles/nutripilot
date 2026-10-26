import { prefersReducedMotion } from "@/lib/game";

/** Resolve "var(--protein)" to the hex canvas-confetti needs. */
function resolve(color: string): string {
  const m = color.match(/^var\((--[\w-]+)\)$/);
  if (!m) return color;
  return getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim() || "#ffffff";
}

/**
 * Square paper in the print's own inks, thrown from the bottom corners like sheets off a press.
 * Loaded on first use only, and skipped under reduced motion.
 */
export async function throwPaper(inks: string[], big = false) {
  if (typeof window === "undefined" || prefersReducedMotion()) return;
  const { default: confetti } = await import("canvas-confetti");
  const colors = inks.map(resolve);
  const base = {
    shapes: ["square" as const],
    colors,
    ticks: 220,
    gravity: 1.15,
    scalar: 0.9,
    drift: 0,
    disableForReducedMotion: true,
    zIndex: 60,
  };
  const count = big ? 70 : 40;
  confetti({ ...base, particleCount: count, angle: 60, spread: 55, startVelocity: 55, origin: { x: 0, y: 0.95 } });
  confetti({ ...base, particleCount: count, angle: 120, spread: 55, startVelocity: 55, origin: { x: 1, y: 0.95 } });
  if (big) {
    setTimeout(() => confetti({ ...base, particleCount: 50, spread: 100, startVelocity: 35, origin: { x: 0.5, y: 0.35 } }), 260);
  }
}
