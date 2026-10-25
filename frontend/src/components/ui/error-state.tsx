"use client";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Compact inline error state for failed queries: a visible message in ink (an error is said in
 * words, never in a plate colour) and a retry action.
 */
export function ErrorState({ message = "Something went wrong.", onRetry, className = "" }: ErrorStateProps) {
  return (
    <div role="alert" className={`flex flex-col items-center justify-center gap-3 border-t border-g2 py-10 text-center ${className}`}>
      <svg className="h-7 w-7 text-g4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.25} aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
      <p className="text-[15px] text-ink">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} variant="outline" size="sm">
          Retry
        </Button>
      )}
    </div>
  );
}
