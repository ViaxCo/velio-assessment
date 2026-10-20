"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { NameForm } from "@/components/name-gate";
import { BackLink, Button, Card, Detail, Notice, Skeleton, SpotsBadge } from "@/components/ui";
import { api, ApiError, type InviteDetail } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { useIdentity } from "@/lib/identity";
import { useLiveAvailability } from "@/lib/live";

export function InviteView({ code }: { code: string }) {
  const { userId } = useIdentity();
  const invite = useQuery({
    queryKey: ["invite", code, userId],
    queryFn: () => api.getInvite(code, userId!),
    enabled: Boolean(userId),
    retry: false,
  });

  if (invite.isPending) return <Skeleton className="h-64" />;
  if (invite.isError) {
    const notFound = invite.error instanceof ApiError && invite.error.status === 404;
    return (
      <Notice tone="error" title={notFound ? "We couldn't find that invite" : "We couldn't load this invite"}>
        <p>{notFound ? "Check the code with the friend who sent it." : invite.error.message}</p>
        {!notFound && (
          <Button small onClick={() => invite.refetch()} className="mt-3">
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

  const vouch = invite.rail === "vouch";

  return (
    <div className="stagger mx-auto max-w-md space-y-4">
      <BackLink />
      <Card className="space-y-4">
        <h1 className="text-[28px] md:text-[34px]">{activity.title}</h1>
        <div className="space-y-2">
          <Detail icon="calendar">{formatDate(activity.startsAt)}</Detail>
          <Detail icon="ticket">{formatPrice(activity.priceMinor, activity.currency)}</Detail>
        </div>
        <SpotsBadge activity={activity} />
        {activity.description && <p className="leading-relaxed text-ink/80">{activity.description}</p>}
        <div className="flex items-center gap-3 rounded-2xl bg-canvas p-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink font-display font-bold text-lime">
            {invite.inviterName.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="font-bold">{vouch ? `${invite.inviterName} vouched for you` : `${invite.inviterName} invited you`}</p>
            <p className="text-sm text-muted">
              {vouch ? `Personal invite${invite.recipient ? ` for ${invite.recipient}` : ""}` : "Shared link"}
            </p>
          </div>
        </div>
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

  if (claim.isSuccess || invite.joined) {
    return (
      <>
        <Notice tone="success" title="You're in the plan!">
          {invite.inviterName} will see you’ve joined.
        </Notice>
        <Link href={`/activities/${activity.id}`} className="block font-medium underline transition-opacity duration-300 hover:opacity-60">
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
        <Button arrow onClick={() => claim.mutate(user.name)} pending={claim.isPending}>
          Claim my spot as {user.name}
        </Button>
      ) : (
        <NameForm cta="Claim my spot" onSubmit={claim.mutateAsync} />
      )}
    </>
  );
}
