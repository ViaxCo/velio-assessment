"use client";

import { useQuery } from "@tanstack/react-query";
import { ActivityCard } from "@/components/activity-card";
import { CreateActivityForm } from "@/components/create-activity-form";
import { NameGate } from "@/components/name-gate";
import { Button, Notice, Skeleton } from "@/components/ui";
import { api } from "@/lib/api";
import { useIdentity } from "@/lib/identity";
import { useLiveAvailability } from "@/lib/live";

export default function Home() {
  return (
    <NameGate>
      <Activities />
    </NameGate>
  );
}

function Activities() {
  const { role, userId } = useIdentity();
  const activities = useQuery({ queryKey: ["activities"], queryFn: api.listActivities });
  useLiveAvailability();

  const isHost = role === "host";
  const shown = isHost ? activities.data?.filter((activity) => activity.hostId === userId) : activities.data;

  return (
    <div className="space-y-4">
      <h1 className="pb-2 pt-4 text-[40px] sm:text-5xl">{isHost ? "Your activities" : "Happening soon"}</h1>
      {isHost && <CreateActivityForm />}
      {activities.isPending && [1, 2, 3].map((key) => <Skeleton key={key} className="h-24" />)}
      {activities.isError && (
        <Notice tone="error" title="We couldn't load activities">
          <p>{activities.error.message}</p>
          <Button onClick={() => activities.refetch()} className="mt-3 min-h-10 px-4 text-sm">
            Try again
          </Button>
        </Notice>
      )}
      {shown?.length === 0 && (
        <Notice tone="info" title={isHost ? "You haven't created an activity yet" : "Nothing on yet"}>
          {isHost ? "Create one above. You'll see people join live." : "Switch to Host to create the first activity."}
        </Notice>
      )}
      {shown?.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} showAttendance={isHost} />
      ))}
    </div>
  );
}
