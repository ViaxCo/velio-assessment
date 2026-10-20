"use client";

import Link from "next/link";
import { useIdentity, type Role } from "@/lib/identity";

const roles: { value: Role; label: string }[] = [
  { value: "booker", label: "Booker" },
  { value: "host", label: "Host" },
];

export function Header() {
  const { user, role, setRole, switchPerson } = useIdentity();

  return (
    <header className="sticky top-0 z-10 px-3 pt-3">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 rounded-full bg-card/85 py-2 pl-5 pr-2 shadow-[0_4px_24px_rgba(23,54,0,0.06)] ring-1 ring-ink/5 backdrop-blur-md">
        <Link href="/" aria-label="Velio home" className="font-display text-[28px] font-bold leading-none tracking-[-0.02em] text-ink">
          velio<span className="text-lime">.</span>
        </Link>
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <div role="radiogroup" aria-label="View as" className="flex rounded-full bg-canvas p-1">
              {roles.map(({ value, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={role === value}
                  onClick={() => setRole(value)}
                  className={`rounded-full px-3 py-1.5 font-medium transition ${
                    role === value ? "bg-lime text-ink" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <details className="relative">
              <summary className="flex size-10 cursor-pointer list-none items-center justify-center rounded-full bg-ink font-display text-sm font-bold text-lime">
                {user.name.slice(0, 1).toUpperCase()}
              </summary>
              <div className="absolute right-0 mt-3 w-56 rounded-3xl bg-card p-3 text-sm shadow-[0_12px_40px_rgba(23,54,0,0.12)] ring-1 ring-ink/5">
                <p className="px-2 font-bold">{user.name}</p>
                <p className="px-2 text-muted">
                  Generation {user.generation} · {user.inviteGroup}
                </p>
                <Link href="/stats" className="mt-3 block rounded-xl px-2 py-2 hover:bg-canvas">
                  Tracking
                </Link>
                <button onClick={switchPerson} className="w-full rounded-xl px-2 py-2 text-left hover:bg-canvas">
                  Switch person
                </button>
              </div>
            </details>
          </div>
        )}
      </div>
    </header>
  );
}
