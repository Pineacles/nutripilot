import { useSyncExternalStore } from "react";

// One celebration at a time: print sheets go first, the weekly recap waits until they are closed.
let busy = false;
const listeners = new Set<() => void>();

export function setCelebrating(value: boolean) {
  if (busy === value) return;
  busy = value;
  listeners.forEach((l) => l());
}

export function useCelebrating(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => busy,
    () => false,
  );
}
