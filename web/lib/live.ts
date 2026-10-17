"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_URL, type Activity, type ActivityDetail, type InviteDetail } from "./api";

type AvailabilityEvent = { activityId: string; spotsTaken: number; capacity: number; version: number };

const applyEvent = <T extends Activity>(activity: T, event: AvailabilityEvent): T =>
  event.version > activity.version
    ? { ...activity, spotsTaken: event.spotsTaken, spotsLeft: event.capacity - event.spotsTaken, version: event.version }
    : activity;

export function useLiveAvailability(activityId?: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(`${API_URL}/stream${activityId ? `?activityId=${activityId}` : ""}`);

    source.onopen = () => {
      queryClient.invalidateQueries({ queryKey: activityId ? ["activity", activityId] : ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["invite"] });
    };

    source.onmessage = (message) => {
      const event: AvailabilityEvent = JSON.parse(message.data);
      queryClient.setQueryData<Activity[]>(["activities"], (activities) =>
        activities?.map((activity) => (activity.id === event.activityId ? applyEvent(activity, event) : activity)),
      );
      queryClient.setQueryData<ActivityDetail>(["activity", event.activityId], (activity) => activity && applyEvent(activity, event));
      queryClient.setQueriesData<InviteDetail>({ queryKey: ["invite"] }, (invite) =>
        invite?.activity.id === event.activityId ? { ...invite, activity: applyEvent(invite.activity, event) } : invite,
      );
      queryClient.invalidateQueries({ queryKey: ["activity", event.activityId] });
      queryClient.invalidateQueries({ queryKey: ["invite"] });
    };

    return () => source.close();
  }, [activityId, queryClient]);
}
