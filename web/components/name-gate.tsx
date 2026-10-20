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
        <h1 className="mb-4 text-[40px] md:text-5xl">Do more things, with more people.</h1>
        <p className="text-xl/[30px] font-medium text-ink/80">Tell us your name so your friends know who’s coming.</p>
        <Card>
          <NameForm cta="Continue" onSubmit={saveName} />
          <RememberedPeople />
        </Card>
      </div>
    </>
  );
}

function RememberedPeople() {
  const { people, switchPerson } = useIdentity();
  const [switchFailed, setSwitchFailed] = useState(false);

  if (people.length === 0) return null;

  return (
    <div className="mt-6 space-y-3 border-t border-line pt-5">
      <p className="text-sm font-medium">Or continue as</p>
      <div className="flex flex-wrap gap-2">
        {people.map((person) => (
          <button
            key={person.id}
            onClick={async () => {
              setSwitchFailed(false);
              try {
                await switchPerson(person.id);
              } catch {
                setSwitchFailed(true);
              }
            }}
            className="min-h-10 rounded-full bg-canvas px-4 text-sm font-medium transition-all duration-300 hover:bg-ink/10 active:scale-95"
          >
            {person.name}
          </button>
        ))}
      </div>
      {switchFailed && <Notice tone="error" title="We couldn't switch. Try again." />}
    </div>
  );
}
