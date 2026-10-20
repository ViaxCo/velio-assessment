import Link from "next/link";
import type { Activity } from "@/lib/api";
import { formatDate, formatPrice } from "@/lib/format";
import { SpotsBadge } from "./ui";

export function ActivityCard({ activity, showAttendance }: { activity: Activity; showAttendance?: boolean }) {
  const filled = (activity.spotsTaken / activity.capacity) * 100;

  return (
    <Link
      href={`/activities/${activity.id}`}
      className="block rounded-[28px] bg-card p-5 ring-1 ring-transparent transition hover:ring-ink/15 active:scale-[0.99] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl">{activity.title}</h2>
          <p className="mt-1.5 text-sm font-medium text-muted">
            {formatDate(activity.startsAt)} · {formatPrice(activity.priceMinor, activity.currency)}
          </p>
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
