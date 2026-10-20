"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, type ReactNode } from "react";
import { api, ApiError, type User } from "./api";
import { newId, useLocalStorage } from "./local-storage";

export type Role = "booker" | "host";

function useIdentityState() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useLocalStorage("velio.userId", newId);
  const [role, setRole] = useLocalStorage("velio.role", () => "booker");
  const [savedUser, setSavedUser] = useLocalStorage("velio.user");
  const remember = (next: User | null) => setSavedUser(next && JSON.stringify(next));

  const user = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const found = await api.getUser(userId!).catch((error) => {
        if (error instanceof ApiError && error.status === 404) return null;
        throw error;
      });
      remember(found);
      return found;
    },
    enabled: Boolean(userId && savedUser),
    placeholderData: () => {
      const saved: User | null = savedUser && JSON.parse(savedUser);
      return saved?.id === userId ? saved : undefined;
    },
  });

  return {
    userId,
    user: user.data,
    refreshUser: () => user.refetch(),
    role: (role ?? "booker") as Role,
    setRole: (next: Role) => setRole(next),
    async saveName(name: string) {
      const saved = await api.saveUser(userId!, name);
      queryClient.setQueryData(["user", userId], saved);
      remember(saved);
    },
    switchPerson: () => {
      remember(null);
      setRole("booker");
      setUserId(newId());
    },
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
