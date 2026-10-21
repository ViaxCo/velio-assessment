"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, invitesQuery, type Invite, type Rail } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { Button, inputClass, Notice } from "./ui";

export function InvitePanel({ activityId, title }: { activityId: string; title: string }) {
  const { user } = useIdentity();
  const queryClient = useQueryClient();
  const query = invitesQuery(activityId, user!.id);
  const invites = useQuery({ ...query, enabled: user!.invitesEnabled });
  const vouches = invites.data?.filter((invite) => invite.rail === "vouch") ?? [];
  const publicInvite = invites.data?.find((invite) => invite.rail === "public");
  const [recipient, setRecipient] = useState("");

  const create = useMutation({
    mutationFn: (body: { rail: Rail; recipient?: string }) => api.createInvite(user!.id, activityId, body),
    onSuccess: (invite) => {
      if (invite.rail === "vouch") setRecipient("");
      return queryClient.invalidateQueries({ queryKey: query.queryKey });
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
            placeholder="Their name"
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

      {vouches.map((invite) => (
        <div key={invite.code} className="animate-rise space-y-2 rounded-2xl bg-white/10 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold">Vouch for {invite.recipient}</span>
            {invite.used ? (
              <span className="font-bold text-lime">Claimed</span>
            ) : (
              <span className="font-mono text-xs tracking-widest text-lime">{invite.code}</span>
            )}
          </div>
          {!invite.used && <InviteLink invite={invite} title={title} />}
        </div>
      ))}

      <div className="space-y-3 border-t border-white/15 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-bold">Share a public link</p>
            <p className="text-sm text-white/75">Anyone with the link can join. Good for group chats.</p>
          </div>
          {!publicInvite && (
            <Button
              onClick={() => create.mutate({ rail: "public" })}
              disabled={create.isPending}
              className="shrink-0 !bg-white px-5 enabled:hover:!bg-lime"
            >
              Get link
            </Button>
          )}
        </div>
        {publicInvite && (
          <div className="animate-rise">
            <InviteLink invite={publicInvite} title={title} />
          </div>
        )}
      </div>

      {create.error && <Notice tone="error" title="We couldn't create that invite">{create.error.message}</Notice>}
    </section>
  );
}

function InviteLink({ invite, title }: { invite: Invite; title: string }) {
  const [copied, setCopied] = useState(false);
  const canShare = "share" in navigator && matchMedia("(pointer: coarse)").matches;

  return (
    <div className="flex gap-2">
      <input readOnly value={invite.url} className={`${inputClass} py-2 text-sm`} onFocus={(event) => event.target.select()} />
      <Button
        small
        className="w-20 shrink-0"
        onClick={async () => {
          if (canShare) {
            await navigator.share({ title, text: `Join me at ${title} on Velio`, url: invite.url }).catch(() => undefined);
            return;
          }
          await navigator.clipboard.writeText(invite.url);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {canShare ? "Share" : copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
