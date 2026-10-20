"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, use, type ReactNode } from "react";
import { api, ApiError, type User } from "./api";
import { newId, useLocalStorage } from "./local-storage";

export type Role = "booker" | "host";

const fetchUser = (id: string) =>
  api.getUser(id).catch((error) => {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  });

function useIdentityState() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useLocalStorage("velio.userId", newId);
  const [role, setRole] = useLocalStorage("velio.role", () => "booker");
  const [savedUser, setSavedUser] = useLocalStorage("velio.user");
  const [savedPeople, setSavedPeople] = useLocalStorage("velio.people");
  const people: User[] = savedPeople ? JSON.parse(savedPeople) : [];

  const remember = (next: User | null) => {
    setSavedUser(next && JSON.stringify(next));
    if (!next) return;
    const known = people.some(({ id }) => id === next.id);
    setSavedPeople(JSON.stringify(known ? people.map((other) => (other.id === next.id ? next : other)) : [...people, next]));
  };

  const user = useQuery({
    queryKey: ["user", userId],
    queryFn: async () => {
      const found = await fetchUser(userId!);
      remember(found);
      return found;
    },
    enabled: Boolean(userId && savedUser),
    initialData: () => {
      const saved: User | null = savedUser && JSON.parse(savedUser);
      return saved?.id === userId ? saved : undefined;
    },
    initialDataUpdatedAt: 0,
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
    people,
    switchPerson(person: User) {
      setSavedUser(JSON.stringify(person));
      setUserId(person.id);
    },
    newPerson: () => {
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
