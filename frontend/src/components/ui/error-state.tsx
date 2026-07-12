"use client";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Compact inline error state for failed queries: replaces silent empty
 * catches with a visible message and a retry action.
 */
export function ErrorState({ message = "Something went wrong.", onRetry, className = "" }: ErrorStateProps) {
  return (
    <div className={`clay-card p-8 flex flex-col items-center justify-center gap-3 text-center ${className}`}>
      <svg className="h-8 w-8 text-destructive/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="secondary" size="sm">
          Retry
        </Button>
      )}
    </div>
  );
}
