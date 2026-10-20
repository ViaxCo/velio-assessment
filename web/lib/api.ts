export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type User = {
  id: string;
  name: string;
  generation: number;
  inviteGroup: "treatment" | "holdout";
  invitesEnabled: boolean;
};

export type Activity = {
  id: string;
  hostId: string;
  hostName: string;
  title: string;
  description: string;
  startsAt: string;
  priceMinor: number;
  currency: string;
  capacity: number;
  spotsTaken: number;
  spotsLeft: number;
  version: number;
};

export type Attendee = {
  userId: string;
  name: string;
  planId: string;
  rail: Rail | null;
  createdAt: string;
};

export type ActivityDetail = Activity & { attendees: Attendee[] };

export type ActivitySummary = Activity & { booked: boolean };

export type Rail = "vouch" | "public";

export type Invite = {
  code: string;
  rail: Rail;
  recipient: string | null;
  url: string;
};

export type InviteDetail = Invite & {
  inviterId: string;
  inviterName: string;
  used: boolean;
  joined: boolean;
  activity: Activity;
};

export type Booking = { id: string; activityId: string; planId: string; userId: string };

export const activitiesQuery = (userId: string) => ({
  queryKey: ["activities", userId],
  queryFn: () => api.listActivities(userId),
});

export const activityQuery = (id: string) => ({
  queryKey: ["activity", id],
  queryFn: () => api.getActivity(id),
});

export const statsQuery = { queryKey: ["stats"], queryFn: () => api.stats() };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: { method?: string; userId?: string; body?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: init.method ?? "GET",
      headers: { "content-type": "application/json", ...(init.userId && { "x-user-id": init.userId }) },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch {
    throw new ApiError(0, "offline", "We couldn't reach Velio. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json();
  if (!res.ok) throw new ApiError(res.status, body.error, body.message);
  return body;
}

export const api = {
  getUser: (id: string) => request<User>(`/users/${id}`),
  saveUser: (id: string, name: string) => request<User>(`/users/${id}`, { method: "PUT", body: { name } }),
  listActivities: (userId: string) => request<ActivitySummary[]>("/activities", { userId }),
  getActivity: (id: string) => request<ActivityDetail>(`/activities/${id}`),
  createActivity: (userId: string, body: Pick<Activity, "title" | "description" | "startsAt" | "priceMinor" | "capacity">) =>
    request<Activity>("/activities", { method: "POST", userId, body }),
  book: (userId: string, activityId: string) =>
    request<Booking>(`/activities/${activityId}/bookings`, { method: "POST", userId }),
  createInvite: (userId: string, activityId: string, body: { rail: Rail; recipient?: string }) =>
    request<Invite>(`/activities/${activityId}/invites`, { method: "POST", userId, body }),
  getInvite: (code: string, userId: string) => request<InviteDetail>(`/invites/${code}`, { userId }),
  claim: (code: string, userId: string, name: string) =>
    request<Booking>(`/invites/${code}/claim`, { method: "POST", body: { userId, name } }),
  track: (body: { name: "activity_viewed"; activityId: string; actorId: string } | { name: "invite_opened"; code: string; actorId: string }) =>
    request<void>("/events", { method: "POST", body: { ...body, platform: "web" } }).catch(() => undefined),
  stats: () => request<Stats>("/stats"),
};

export type Stats = {
  slos: { goal: string; target: string; actual: number | null; met: boolean | null }[];
  goals: {
    bookersWhoInvite: { bookers: number; inviters: number; pct: number | null; targetPct: number };
    inviteConversion: {
      rail: string;
      opens: number;
      claimed: number;
      pct: number | null;
      opensWithSpots: number;
      pctWithSpots: number | null;
      targetPct: number;
    }[];
    kFactor: { rail: string; newUsers: number; existingUsers: number; kFactor: number | null }[];
  };
  funnel: { step: string; rail: Rail | "all"; events: number; actors: number }[];
  holdout: { inviteGroup: string; users: number; plansHappened: number; plansHappenedPerUser: number | null }[];
};
