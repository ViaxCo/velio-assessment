"use client";

import { useQuery } from "@tanstack/react-query";
import { ActivityCard } from "@/components/activity-card";
import { CreateActivityForm } from "@/components/create-activity-form";
import { NameGate } from "@/components/name-gate";
import { Button, Notice, Skeleton } from "@/components/ui";
import { activitiesQuery } from "@/lib/api";
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
  const activities = useQuery(activitiesQuery(userId!));
  useLiveAvailability();

  const isHost = role === "host";
  const plans = isHost ? [] : activities.data?.filter((activity) => activity.booked) ?? [];
  const shown = activities.data?.filter((activity) => (isHost ? activity.hostId === userId : !activity.booked));

  return (
    <div key={`${role}-${userId}`} className="stagger space-y-4">
      {plans.length > 0 && (
        <>
          <h1 className="pb-2 text-4xl md:text-[44px]">Your plans</h1>
          {plans.map((activity) => (
            <ActivityCard key={activity.id} activity={activity} booked />
          ))}
        </>
      )}
      {(isHost || !activities.isPending) && (
        <h1 className={`pb-2 text-4xl md:text-[44px] ${plans.length > 0 ? "pt-6" : ""}`}>{isHost ? "Your activities" : "Happening soon"}</h1>
      )}
      {isHost && <CreateActivityForm />}
      {activities.isPending && [1, 2, 3].map((key) => <Skeleton key={key} className="h-24" />)}
      {activities.isError && (
        <Notice tone="error" title="We couldn't load activities">
          <p>{activities.error.message}</p>
          <Button small onClick={() => activities.refetch()} className="mt-3">
            Try again
          </Button>
        </Notice>
      )}
      {shown?.length === 0 && (
        <Notice tone="info" title={isHost ? "You haven't created an activity yet" : plans.length > 0 ? "Nothing else on yet" : "Nothing on yet"}>
          {isHost ? "Create one above. You'll see people join live." : "Switch to Host to create an activity."}
        </Notice>
      )}
      {shown?.map((activity) => (
        <ActivityCard key={activity.id} activity={activity} showAttendance={isHost} />
      ))}
    </div>
  );
}
