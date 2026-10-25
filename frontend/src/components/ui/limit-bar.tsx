/**
 * A 3px scale bar with its target marked, for goals (fiber, protein) and limits (sugar, salt,
 * caffeine). The target is a tick on the bar; the fill up to it wears the plate ink passed in (g5
 * for nutrients without a plate). Past a limit the overflow and the tick turn --alert, which the
 * caller pairs with the word "over". Below a goal nothing alarms on the bar; past a goal the extra
 * is quiet g4: reaching it is what counts.
 */
export function LimitBar({
  value,
  target,
  kind = "limit",
  ink = "var(--g5)",
  scale,
  className = "",
}: {
  value: number;
  target: number;
  /** "limit": stay under (sugar, salt). "goal": reach it (fiber, water). */
  kind?: "limit" | "goal";
  /** Fill colour up to the target; a nutrient with a plate passes its ink (see plateOf). */
  ink?: string;
  /** Full width of the bar in the value's unit; defaults to leaving room for 50% over. */
  scale?: number;
  className?: string;
}) {
  const full = Math.max(1, scale ?? Math.max(target * 1.5, value));
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / full) * 100))}%`;
  const within = Math.min(value, target > 0 ? target : value);
  const over = kind === "limit" && target > 0 && value > target;
  const reached = kind === "goal" && target > 0 && value >= target;
  return (
    <div className={`relative h-[3px] bg-g2 ${className}`} role="presentation">
      <div className="animate-bar absolute inset-y-0 left-0 transition-[width] duration-500 ease-(--ease-out) motion-reduce:transition-none" style={{ width: pct(within), background: reached && ink === "var(--g5)" ? "var(--ink)" : ink }} />
      {over && (
        <div
          className="animate-bar absolute -inset-y-px bg-alert transition-[left,width] duration-500 ease-(--ease-out) motion-reduce:transition-none"
          style={{ left: pct(target), width: `calc(${pct(value)} - ${pct(target)})`, animationDelay: "250ms" }}
        />
      )}
      {kind === "goal" && value > target && target > 0 && (
        <div className="animate-bar absolute inset-y-0 bg-g4 transition-[left,width] duration-500 ease-(--ease-out) motion-reduce:transition-none" style={{ left: pct(target), width: `calc(${pct(value)} - ${pct(target)})` }} />
      )}
      {/* The limit: a g5 tick like every scale bar, ink once passed so the break is seen */}
      {target > 0 && (
        <div
          className={`absolute -top-1 h-[11px] w-px transition-[left] duration-500 ease-(--ease-out) motion-reduce:transition-none ${over ? "bg-alert" : "bg-g5"}`}
          style={{ left: pct(target) }}
        />
      )}
    </div>
  );
}
