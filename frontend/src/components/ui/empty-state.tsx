"use client";

import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
  /** Defaults to a generic "inbox" icon; pass a different one for domain-specific empty states. */
  icon?: React.ReactNode;
}

const DEFAULT_ICON = (
  <svg className="h-8 w-8 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

/**
 * Small, consistent "nothing here yet" state — icon + one line + optional
 * action button. Reuses the same visual language as error-state.tsx.
 */
export function EmptyState({ message, actionLabel, onAction, className = "", icon }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center gap-2 py-8 text-center ${className}`}>
      {icon ?? DEFAULT_ICON}
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="secondary" size="sm" className="mt-1">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
