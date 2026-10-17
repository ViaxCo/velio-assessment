import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "velio-storage";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

export function useLocalStorage(key: string, createDefault: () => string) {
  const value = useSyncExternalStore(
    subscribe,
    () => {
      const stored = localStorage.getItem(key);
      if (stored) return stored;
      const fresh = createDefault();
      localStorage.setItem(key, fresh);
      return fresh;
    },
    () => null,
  );

  const setValue = useCallback(
    (next: string | null) => {
      if (next === null) localStorage.removeItem(key);
      else localStorage.setItem(key, next);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    },
    [key],
  );

  return [value, setValue] as const;
}

export const newId = () =>
  "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (Number(c) / 4)))).toString(16),
  );
