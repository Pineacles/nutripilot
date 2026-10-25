"use client";

import { useState } from "react";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { getErrorMessage } from "@/lib/api";
import { ServiceWorker } from "@/components/service-worker";
import { useMediaQuery } from "@/hooks/use-media-query";
// Catches Chrome's one-time install event on whichever page the visit starts.
import "@/lib/install";

declare module "@tanstack/react-query" {
  interface Register {
    mutationMeta: {
      /** Skip the global error toast: the mutation's own onError already surfaces it. */
      suppressErrorToast?: boolean;
    };
  }
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      // Offline, a log must fail with a message now, not wait and quietly land later (and invite
      // a second tap that logs it twice).
      mutations: { networkMode: "always" },
    },
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (mutation.meta?.suppressErrorToast) return;
        toast.error(getErrorMessage(error));
      },
    }),
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  // Phones: toasts (Logged, Undo) sit above the bottom nav and sheet footer, in thumb reach.
  const isPhone = useMediaQuery("(max-width: 767px)");
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors theme="dark" position={isPhone ? "bottom-center" : "top-right"} mobileOffset={{ bottom: "calc(7rem + env(safe-area-inset-bottom))" }} />
      <ServiceWorker />
    </QueryClientProvider>
  );
}
