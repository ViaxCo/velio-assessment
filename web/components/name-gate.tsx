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
      <Button type="submit" disabled={saving || !name.trim()} className="w-full">
        {saving ? "One moment…" : cta}
      </Button>
    </form>
  );
}

export function NameGate({ children }: { children: ReactNode }) {
  const { user, isLoading, saveName } = useIdentity();

  if (isLoading) return <Skeleton className="h-48" />;
  if (user) return children;

  return (
    <Card className="mx-auto mt-8 max-w-md space-y-4">
      <div>
        <h1 className="text-[32px]">Do more things, with more people.</h1>
        <p className="mt-3 font-medium text-ink/80">Tell us your name so your friends know who’s coming.</p>
      </div>
      <NameForm cta="Continue" onSubmit={saveName} />
    </Card>
  );
}
