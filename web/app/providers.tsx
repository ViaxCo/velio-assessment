"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { IdentityProvider } from "@/lib/identity";

let browserQueryClient: QueryClient | undefined;

function getQueryClient() {
  const create = () => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } });
  if (typeof window === "undefined") return create();
  browserQueryClient ??= create();
  return browserQueryClient;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={getQueryClient()}>
      <IdentityProvider>{children}</IdentityProvider>
    </QueryClientProvider>
  );
}
