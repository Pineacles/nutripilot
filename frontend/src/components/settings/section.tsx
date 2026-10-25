import { cn } from "@/lib/utils";

interface SectionProps {
  title?: string;
  description?: React.ReactNode;
  /** A pill at the right of the heading ("Add supplement"). */
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/**
 * One block of the settings list. On phones it is a band under a top rule (clay-card drops its box
 * there), from 768px a flat g1 panel. Heading is 15px medium ink, the hint under it 13px g4.
 */
export function SettingsSection({ title, description, action, className, children }: SectionProps) {
  return (
    <section className={cn("clay-card p-5", className)}>
      {(title || description || action) && (
        <div className="mb-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] leading-6 font-medium text-ink">{title}</h3>}
            {description && <p className="text-[13px] text-g4">{description}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

interface FieldRowProps {
  label: React.ReactNode;
  htmlFor: string;
  /** Right of the field, in g4 ("kcal", "g"). */
  unit?: string;
  error?: string | null;
  /** Flash the row once (a save just landed). */
  lit?: boolean;
  children: React.ReactNode;
}

/** A hairline row of at least 60px: label left, a right-aligned number field and its unit right. */
export function FieldRow({ label, htmlFor, unit, error, lit, children }: FieldRowProps) {
  return (
    <div className={cn("border-t border-g2", lit && "animate-lit")}>
      <div className="flex min-h-[60px] items-center gap-3">
        <label htmlFor={htmlFor} className="min-w-0 flex-1 text-[15px] text-ink">
          {label}
        </label>
        <div className="flex shrink-0 items-center gap-2">
          {children}
          {unit !== undefined && <span className="w-9 text-xs text-g4">{unit}</span>}
        </div>
      </div>
      {error && <p className="-mt-1.5 pb-3 text-xs text-ink">{error}</p>}
    </div>
  );
}
