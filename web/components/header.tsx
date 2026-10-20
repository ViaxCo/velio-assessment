"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useIdentity, type Role } from "@/lib/identity";
import { Logo } from "./logo";

const roles: { value: Role; label: string }[] = [
  { value: "booker", label: "Booker" },
  { value: "host", label: "Host" },
];

export function Header() {
  const { user, role, setRole, switchPerson } = useIdentity();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const chooseRole = (next: Role) => {
    setRole(next);
    if (window.location.pathname !== "/") router.push("/");
  };

  return (
    <nav className="fixed left-1/2 top-4 z-50 w-[90%] max-w-[460px] -translate-x-1/2 animate-drop md:top-6 md:max-w-[480px]">
      <div className="flex min-h-[58px] items-center justify-between rounded-full border border-black/5 bg-white/85 py-1.5 pl-6 pr-1.5 shadow-xs backdrop-blur-xl">
        <Link href="/" aria-label="Velio home" className="flex items-center text-ink">
          <Logo className="h-6 w-[71px]" />
        </Link>
        {user && (
          <div className="flex items-center gap-2">
            <div role="radiogroup" aria-label="View as" className="relative grid grid-cols-2 rounded-full bg-canvas p-1">
              <span
                aria-hidden
                className={`absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-lime transition-transform duration-300 ease-soft ${
                  role === "host" ? "translate-x-full" : ""
                }`}
              />
              {roles.map(({ value, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={role === value}
                  onClick={() => chooseRole(value)}
                  className={`relative h-9 rounded-full px-3 text-sm font-medium tracking-tight transition-colors duration-300 ${
                    role === value ? "text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div ref={menuRef} className="relative">
              <button
                aria-label="Account"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((open) => !open)}
                className="flex size-11 items-center justify-center rounded-full bg-lime transition-all duration-300 hover:bg-lime-hover active:scale-95"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-medium text-ink">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              </button>
              <div
                role="menu"
                className={`absolute right-0 mt-3 w-56 origin-top-right rounded-3xl border border-black/5 bg-white p-2 text-sm shadow-xs transition-all duration-200 ease-soft ${
                  menuOpen ? "scale-100 opacity-100" : "invisible -translate-y-1 scale-95 opacity-0"
                }`}
              >
                <div className="px-3 py-2">
                  <p className="font-bold">{user.name}</p>
                  <p className="text-muted">
                    Generation {user.generation} · {user.inviteGroup}
                  </p>
                </div>
                <Link
                  role="menuitem"
                  href="/stats"
                  onClick={() => setMenuOpen(false)}
                  className="block rounded-2xl px-3 py-2 transition-colors duration-200 hover:bg-canvas"
                >
                  Tracking
                </Link>
                <button
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    switchPerson();
                  }}
                  className="w-full rounded-2xl px-3 py-2 text-left transition-colors duration-200 hover:bg-canvas"
                >
                  Switch person
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
