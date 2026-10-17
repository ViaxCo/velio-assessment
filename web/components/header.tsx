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
    <header className="sticky top-0 z-10 border-b border-line bg-canvas/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight text-sunset">
          velio
        </Link>
        {user && (
          <div className="flex items-center gap-2 text-sm">
            <div role="radiogroup" aria-label="View as" className="flex rounded-full bg-line/60 p-0.5">
              {roles.map(({ value, label }) => (
                <button
                  key={value}
                  role="radio"
                  aria-checked={role === value}
                  onClick={() => setRole(value)}
                  className={`rounded-full px-3 py-1.5 font-medium transition ${
                    role === value ? "bg-card text-ink shadow-sm" : "text-muted"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <details className="relative">
              <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full bg-ink text-sm font-semibold text-canvas">
                {user.name.slice(0, 1).toUpperCase()}
              </summary>
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-card p-3 text-sm shadow-lg">
                <p className="font-medium">{user.name}</p>
                <p className="text-muted">
                  Generation {user.generation} · {user.inviteGroup}
                </p>
                <Link href="/stats" className="mt-3 block rounded-lg px-2 py-1.5 hover:bg-canvas">
                  Tracking
                </Link>
                <button onClick={switchPerson} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-canvas">
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
