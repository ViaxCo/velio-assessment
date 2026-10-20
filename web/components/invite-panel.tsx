"use client";

import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Invite, type Rail } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { Button, inputClass, Notice } from "./ui";

export function InvitePanel({ activityId, title }: { activityId: string; title: string }) {
  const { user } = useIdentity();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [recipient, setRecipient] = useState("");

  const create = useMutation({
    mutationFn: (body: { rail: Rail; recipient?: string }) => api.createInvite(user!.id, activityId, body),
    onSuccess: (invite) => {
      setInvites((current) => [invite, ...current]);
      setRecipient("");
    },
  });

  if (!user?.invitesEnabled) return null;

  return (
    <section className="space-y-4 rounded-[32px] bg-forest p-6 text-white md:p-8">
      <div>
        <h2 className="text-2xl">Bring your people</h2>
        <p className="mt-1 text-white/75">Plans happen when friends come too.</p>
      </div>

      <form
        className="space-y-2"
        onSubmit={(event) => {
          event.preventDefault();
          create.mutate({ rail: "vouch", recipient: recipient.trim() });
        }}
      >
        <label htmlFor="recipient" className="block font-bold">
          Vouch for a friend
        </label>
        <p className="text-sm text-white/75">A vouch says you stand behind them. Each vouch link works once.</p>
        <div className="flex gap-2">
          <input
            id="recipient"
            className={inputClass}
            placeholder="Their name or number"
            value={recipient}
            onChange={(event) => setRecipient(event.target.value)}
            maxLength={80}
            required
          />
          <Button type="submit" disabled={create.isPending || !recipient.trim()} className="shrink-0">
            Vouch
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-3 border-t border-white/15 pt-4">
        <div>
          <p className="font-bold">Share a public link</p>
          <p className="text-sm text-white/75">Anyone with the link can join. Good for group chats.</p>
        </div>
        <Button
          onClick={() => create.mutate({ rail: "public" })}
          disabled={create.isPending}
          className="shrink-0 !bg-white px-5 enabled:hover:!bg-lime"
        >
          Get link
        </Button>
      </div>

      {create.error && <Notice tone="error" title="We couldn't create that invite">{create.error.message}</Notice>}

      {invites.map((invite) => (
        <InviteLink key={invite.code} invite={invite} title={title} />
      ))}
    </section>
  );
}

function InviteLink({ invite, title }: { invite: Invite; title: string }) {
  const [copied, setCopied] = useState(false);
  const label = invite.rail === "vouch" ? `Vouch for ${invite.recipient}` : "Public link";
  const text = `Join me at ${title} on Velio`;

  return (
    <div className="animate-rise rounded-2xl bg-white/10 p-3">
      <div className="flex items-center justify-between text-sm">
        <span className="font-bold">{label}</span>
        <span className="font-mono text-xs tracking-widest text-lime">{invite.code}</span>
      </div>
      <div className="mt-2 flex gap-2">
        <input readOnly value={invite.url} className={`${inputClass} py-2 text-sm`} onFocus={(event) => event.target.select()} />
        <Button
          small
          className="shrink-0"
          onClick={async () => {
            if (navigator.share) {
              await navigator.share({ title, text, url: invite.url }).catch(() => undefined);
              return;
            }
            await navigator.clipboard?.writeText(invite.url);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Share"}
        </Button>
      </div>
    </div>
  );
}
