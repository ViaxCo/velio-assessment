"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, type ReactNode } from "react";
import { api, ApiError } from "./api";
import { newId, useLocalStorage } from "./local-storage";

export type Role = "booker" | "host";

function useIdentityState() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useLocalStorage("velio.userId", newId);
  const [role, setRole] = useLocalStorage("velio.role", () => "booker");

  const user = useQuery({
    queryKey: ["user", userId],
    queryFn: () => api.getUser(userId!).catch((error) => (error instanceof ApiError && error.status === 404 ? null : Promise.reject(error))),
    enabled: Boolean(userId),
  });

  return {
    userId,
    user: user.data,
    isLoading: !userId || user.isPending,
    role: (role ?? "booker") as Role,
    setRole: (next: Role) => setRole(next),
    async saveName(name: string) {
      queryClient.setQueryData(["user", userId], await api.saveUser(userId!, name));
    },
    switchPerson: () => setUserId(newId()),
  };
}

const IdentityContext = createContext<ReturnType<typeof useIdentityState> | null>(null);

export function IdentityProvider({ children }: { children: ReactNode }) {
  return <IdentityContext value={useIdentityState()}>{children}</IdentityContext>;
}

export function useIdentity() {
  const identity = use(IdentityContext);
  if (!identity) throw new Error("useIdentity must be used inside IdentityProvider");
  return identity;
}
