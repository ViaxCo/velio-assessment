"use client";

import Link from "next/link";
import { useIdentity, type Role } from "@/lib/identity";
import { Logo } from "./logo";

const roles: { value: Role; label: string }[] = [
  { value: "booker", label: "Booker" },
  { value: "host", label: "Host" },
];

export function Header() {
  const { user, role, setRole, switchPerson } = useIdentity();

  return (
    <nav className="fixed left-1/2 top-4 z-50 w-[90%] max-w-[460px] -translate-x-1/2 md:top-6 md:max-w-[480px]">
      <div className="flex min-h-[58px] items-center justify-between rounded-full border border-black/5 bg-white/85 py-1.5 pl-6 pr-1.5 shadow-xs backdrop-blur-xl">
        <Link href="/" aria-label="Velio home" className="flex items-center text-ink">
          <Logo className="h-6 w-[71px]" />
        </Link>
        {user && (
          <div className="flex items-center gap-2">
            <div role="radiogroup" aria-label="View as" className="flex rounded-full bg-canvas p-1">
              {roles.map(({ value, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={role === value}
                  onClick={() => setRole(value)}
                  className={`h-9 rounded-full px-3 text-sm font-medium tracking-tight transition-colors duration-300 ${
                    role === value ? "bg-lime text-ink" : "text-muted hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <details className="relative">
              <summary
                aria-label="Account"
                className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full bg-lime transition-all duration-300 hover:bg-lime-hover active:scale-95"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-white text-sm font-medium text-ink">
                  {user.name.slice(0, 1).toUpperCase()}
                </span>
              </summary>
              <div className="absolute right-0 mt-3 w-56 rounded-3xl border border-black/5 bg-white p-2 text-sm shadow-xs">
                <div className="px-3 py-2">
                  <p className="font-bold">{user.name}</p>
                  <p className="text-muted">
                    Generation {user.generation} · {user.inviteGroup}
                  </p>
                </div>
                <Link href="/stats" className="block rounded-2xl px-3 py-2 hover:bg-canvas">
                  Tracking
                </Link>
                <button onClick={switchPerson} className="w-full rounded-2xl px-3 py-2 text-left hover:bg-canvas">
                  Switch person
                </button>
              </div>
            </details>
          </div>
        )}
      </div>
    </nav>
  );
}
