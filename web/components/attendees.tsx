import type { Attendee } from "@/lib/api";

const railLabel = { vouch: "vouched", public: "via link" };

export function Attendees({ attendees, highlightPlanId }: { attendees: Attendee[]; highlightPlanId?: string }) {
  const plans = Map.groupBy(attendees, (attendee) => attendee.planId);

  if (attendees.length === 0) return <p className="text-sm text-muted">No one has booked yet. They’ll appear here live.</p>;

  return (
    <ul className="space-y-2">
      {[...plans].map(([planId, members]) => (
        <li
          key={planId}
          className={`rounded-2xl border p-3 ${planId === highlightPlanId ? "border-lagoon bg-lagoon-soft" : "border-line"}`}
        >
          <p className="text-xs font-medium text-muted">
            {planId === highlightPlanId ? "Your plan" : "Plan"} · {members.length} {members.length === 1 ? "person" : "people"}
          </p>
          <p className="mt-1 text-sm">
            {members.map((member, i) => (
              <span key={member.userId}>
                {i > 0 && ", "}
                {member.name}
                {member.rail && <span className="text-muted"> ({railLabel[member.rail]})</span>}
              </span>
            ))}
          </p>
        </li>
      ))}
    </ul>
  );
}
