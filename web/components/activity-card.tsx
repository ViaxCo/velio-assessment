"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { activityQuery, type Activity } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { SpotsBadge } from "./ui";

export function ActivityCard({ activity, showAttendance, booked }: { activity: Activity; showAttendance?: boolean; booked?: boolean }) {
  const queryClient = useQueryClient();
  const filled = (activity.spotsTaken / activity.capacity) * 100;

  return (
    <Link
      href={`/activities/${activity.id}`}
      onPointerEnter={() => queryClient.prefetchQuery(activityQuery(activity.id))}
      className="block rounded-[32px] bg-card p-6 ring-1 ring-transparent transition-all duration-300 ease-soft hover:scale-[1.02] hover:shadow-xs hover:ring-ink/10 active:scale-[0.98] md:p-8"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl">{activity.title}</h2>
          <p className="mt-1.5 text-sm font-medium text-ink/80">
            {formatDate(activity.startsAt)} · {formatPrice(activity.priceMinor, activity.currency)}
          </p>
          {booked && (
            <p className="mt-2 flex items-center gap-1.5 text-sm font-bold">
              <svg viewBox="0 0 24 24" aria-hidden className="size-4 fill-none stroke-current stroke-[2.5]">
                <path d="M20 6 9 17l-5-5" />
              </svg>
              You&apos;re in
            </p>
          )}
        </div>
        <SpotsBadge activity={activity} />
      </div>
      {showAttendance && (
        <div className="mt-4">
          <div className="h-2 overflow-hidden rounded-full bg-ink/10">
            <div className="h-full rounded-full bg-lime transition-[width] duration-500" style={{ width: `${filled}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            {activity.spotsTaken} of {activity.capacity} booked
          </p>
        </div>
      )}
    </Link>
  );
}
