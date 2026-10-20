"use client";

import { useState, type ReactNode } from "react";
import { useIdentity } from "@/lib/identity";
import { Button, Card, inputClass, Notice, Skeleton } from "./ui";

export function NameForm({ cta, onSubmit }: { cta: string; onSubmit: (name: string) => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="space-y-3"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        setError(null);
        try {
          await onSubmit(name.trim());
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : "Something went wrong.");
        } finally {
          setSaving(false);
        }
      }}
    >
      <label className="block text-sm font-medium" htmlFor="name">
        Your first name
      </label>
      <input
        id="name"
        className={inputClass}
        value={name}
        onChange={(event) => setName(event.target.value)}
        autoComplete="given-name"
        maxLength={60}
        required
      />
      {error && <Notice tone="error" title={error} />}
      <Button arrow type="submit" disabled={!name.trim()} pending={saving}>
        {cta}
      </Button>
    </form>
  );
}

export function NameGate({ children }: { children: ReactNode }) {
  const { userId, user, saveName } = useIdentity();

  if (user) return children;

  return (
    <>
      {!userId && <Skeleton className="hidden h-48 named:block" />}
      <div className={`stagger mx-auto max-w-md space-y-8 ${userId ? "" : "named:hidden"}`}>
        <div>
          <h1 className="text-[40px] md:text-5xl">Do more things, with more people.</h1>
          <p className="mt-4 text-xl/[30px] font-medium text-ink/80">Tell us your name so your friends know who’s coming.</p>
        </div>
        <Card>
          <NameForm cta="Continue" onSubmit={saveName} />
        </Card>
      </div>
    </>
  );
}
