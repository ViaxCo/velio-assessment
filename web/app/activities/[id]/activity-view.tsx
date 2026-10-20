"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { Attendees } from "@/components/attendees";
import { InvitePanel } from "@/components/invite-panel";
import { NameGate } from "@/components/name-gate";
import { BackLink, Button, Card, Detail, Notice, Skeleton, SpotsBadge } from "@/components/ui";
import { activityQuery, api, ApiError, type Activity as ActivitySummary, type ActivityDetail } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { useIdentity } from "@/lib/identity";
import { useLiveAvailability } from "@/lib/live";

export function ActivityView({ id }: { id: string }) {
  return (
    <NameGate>
      <Activity id={id} />
    </NameGate>
  );
}

function Activity({ id }: { id: string }) {
  const { user } = useIdentity();
  const queryClient = useQueryClient();
  const { queryKey } = activityQuery(id);
  const activity = useQuery({
    ...activityQuery(id),
    placeholderData: () => {
      const summary = queryClient.getQueryData<ActivitySummary[]>(["activities"])?.find((item) => item.id === id);
      return summary && { ...summary, attendees: [] };
    },
  });
  useLiveAvailability(id);

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current || !user) return;
    tracked.current = true;
    api.track({ name: "activity_viewed", activityId: id, actorId: user.id });
  }, [id, user]);

  const book = useMutation({
    mutationFn: () => api.book(user!.id, id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ActivityDetail>(queryKey);
      queryClient.setQueryData<ActivityDetail>(queryKey, (current) =>
        current && {
          ...current,
          spotsLeft: current.spotsLeft - 1,
          spotsTaken: current.spotsTaken + 1,
          attendees: [
            ...current.attendees,
            { userId: user!.id, name: user!.name, planId: "pending", rail: null, createdAt: new Date().toISOString() },
          ],
        },
      );
      return { previous };
    },
    onError: (error, _variables, context) => {
      const soldOut = error instanceof ApiError && error.code === "sold_out";
      queryClient.setQueryData<ActivityDetail>(queryKey, (current) =>
        soldOut && context?.previous
          ? { ...context.previous, spotsLeft: 0, spotsTaken: context.previous.capacity }
          : context?.previous ?? current,
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (activity.isPending) return <Skeleton className="h-64" />;
  if (activity.isError) {
    return (
      <Notice tone="error" title="We couldn't load this activity">
        <p>{activity.error.message}</p>
        <Link href="/" className="mt-2 inline-block font-medium text-ink underline">
          See what else is on
        </Link>
      </Notice>
    );
  }

  const data = activity.data;
  const isHost = data.hostId === user?.id;
  const myBooking = data.attendees.find((attendee) => attendee.userId === user?.id);
  const started = new Date(data.startsAt) <= new Date();

  return (
    <div className="stagger space-y-4">
      <BackLink />
      <Card className="space-y-3">
        <h1 className="text-[28px] md:text-[34px]">{data.title}</h1>
        <div className="space-y-2">
          <Detail icon="calendar">{formatDate(data.startsAt)}</Detail>
          <Detail icon="ticket">{formatPrice(data.priceMinor, data.currency)}</Detail>
          <Detail icon="host">Hosted by {isHost ? "you" : data.hostName}</Detail>
        </div>
        <SpotsBadge activity={data} />
        {data.description && <p className="leading-relaxed text-ink/80">{data.description}</p>}
      </Card>

      {activity.isPlaceholderData ? (
        <Skeleton className="h-36" />
      ) : (
        <>
          {!isHost && !myBooking && (
            <Card className="space-y-3">
              {book.isError && <BookingError error={book.error} />}
              {started ? (
                <Notice tone="info" title="This activity has already started" />
              ) : data.spotsLeft === 0 ? (
                !book.isError && (
                  <Notice tone="info" title="This one is full">
                    <Link href="/" className="font-medium text-ink underline transition-opacity duration-300 hover:opacity-60">
                      See what else is on
                    </Link>
                  </Notice>
                )
              ) : (
                <Button arrow onClick={() => book.mutate()} pending={book.isPending}>
                  Book a spot · {formatPrice(data.priceMinor, data.currency)}
                </Button>
              )}
              <p className="text-xs text-muted">You won’t be charged in this prototype.</p>
            </Card>
          )}

          {myBooking && (
            <Notice tone="success" title={myBooking.planId === "pending" ? "Booking your spot…" : "You're in!"}>
              {myBooking.planId === "pending" ? "Hold tight." : "Invite friends below. They'll join your plan."}
            </Notice>
          )}

          {(isHost || (myBooking && myBooking.planId !== "pending")) && !started && (
            <InvitePanel activityId={data.id} title={data.title} />
          )}

          {(isHost || myBooking) && (
            <Card className="space-y-3">
              <div className="flex items-baseline justify-between">
                <h2 className="text-xl">Who’s going</h2>
                <span className="text-sm text-muted">
                  {data.spotsTaken} of {data.capacity}
                </span>
              </div>
              <Attendees attendees={data.attendees} highlightPlanId={myBooking?.planId} />
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function BookingError({ error }: { error: Error }) {
  if (error instanceof ApiError && error.code === "sold_out") {
    return (
      <Notice tone="error" title="So close. Someone just took the last spot.">
        <p>We didn’t book you. </p>
        <Link href="/" className="font-medium text-ink underline transition-opacity duration-300 hover:opacity-60">
          See what else is on
        </Link>
      </Notice>
    );
  }
  return <Notice tone="error" title="We couldn't book your spot">{error.message}</Notice>;
}
