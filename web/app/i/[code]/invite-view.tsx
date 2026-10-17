"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { NameForm } from "@/components/name-gate";
import { Button, Card, Notice, Skeleton, SpotsBadge } from "@/components/ui";
import { api, ApiError, type InviteDetail } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { useIdentity } from "@/lib/identity";
import { useLiveAvailability } from "@/lib/live";

export function InviteView({ code }: { code: string }) {
  const invite = useQuery({ queryKey: ["invite", code], queryFn: () => api.getInvite(code), retry: false });

  if (invite.isPending) return <Skeleton className="h-64" />;
  if (invite.isError) {
    const notFound = invite.error instanceof ApiError && invite.error.status === 404;
    return (
      <Notice tone="error" title={notFound ? "We couldn't find that invite" : "We couldn't load this invite"}>
        <p>{notFound ? "Check the code with the friend who sent it." : invite.error.message}</p>
        {!notFound && (
          <Button onClick={() => invite.refetch()} className="mt-3 min-h-10 px-4 text-sm">
            Try again
          </Button>
        )}
      </Notice>
    );
  }
  return <Invite invite={invite.data} />;
}

function Invite({ invite }: { invite: InviteDetail }) {
  const { userId } = useIdentity();
  const { activity } = invite;
  useLiveAvailability(activity.id);

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current || !userId) return;
    tracked.current = true;
    api.track({ name: "invite_opened", code: invite.code, actorId: userId });
  }, [invite.code, userId]);

  const headline =
    invite.rail === "vouch"
      ? `${invite.inviterName} vouched for you${invite.recipient ? `, ${invite.recipient}` : ""}`
      : `${invite.inviterName} invited you`;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <p className="pt-2 text-center text-sm font-medium text-sunset">{headline}</p>
      <Card className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{activity.title}</h1>
          <SpotsBadge activity={activity} />
        </div>
        <p className="text-sm text-muted">
          {formatDate(activity.startsAt)} · {formatPrice(activity.priceMinor, activity.currency)}
        </p>
        {activity.description && <p className="leading-relaxed">{activity.description}</p>}
      </Card>

      <Card className="space-y-3">
        <ClaimState invite={invite} />
      </Card>
    </div>
  );
}

function ClaimState({ invite }: { invite: InviteDetail }) {
  const { userId, user } = useIdentity();
  const queryClient = useQueryClient();
  const { activity } = invite;
  const claim = useMutation({
    mutationFn: (name: string) => api.claim(invite.code, userId!, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", userId] }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["invite", invite.code] }),
  });

  if (claim.isSuccess) {
    return (
      <>
        <Notice tone="success" title="You're in the plan!">
          {invite.inviterName} will see you’ve joined.
        </Notice>
        <Link href={`/activities/${activity.id}`} className="block text-center font-medium underline">
          See who’s going
        </Link>
      </>
    );
  }
  if (claim.error instanceof ApiError && claim.error.code === "sold_out") {
    return <Notice tone="error" title="So close. The last spot just went.">We didn’t book you. Ask {invite.inviterName} what’s next.</Notice>;
  }
  if (invite.used) {
    return <Notice tone="info" title="This personal invite has already been used">Ask {invite.inviterName} to send you a new one.</Notice>;
  }
  if (new Date(activity.startsAt) <= new Date()) {
    return <Notice tone="info" title="This activity has already started" />;
  }
  if (activity.spotsLeft === 0) {
    return <Notice tone="info" title="This one filled up before you got here">Ask {invite.inviterName} about the next one.</Notice>;
  }

  return (
    <>
      {claim.error && <Notice tone="error" title="We couldn't claim your spot">{claim.error.message}</Notice>}
      {user ? (
        <Button onClick={() => claim.mutate(user.name)} disabled={claim.isPending} className="w-full">
          {claim.isPending ? "Claiming…" : `Claim my spot as ${user.name}`}
        </Button>
      ) : (
        <NameForm cta={claim.isPending ? "Claiming…" : "Claim my spot"} onSubmit={claim.mutateAsync} />
      )}
    </>
  );
}
