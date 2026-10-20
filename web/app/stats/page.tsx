"use client";

import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Card, Notice, Skeleton } from "@/components/ui";
import { API_URL, api, type Stats } from "@/lib/api";

const FUNNEL = ["activity_viewed", "booked", "invite_created", "invite_opened", "spot_claimed"];
const RAIL_STEPS = new Set(["invite_created", "invite_opened", "spot_claimed"]);

const pct = (value: number | null) => (value === null ? "—" : `${value}%`);

export default function StatsPage() {
  const stats = useQuery({ queryKey: ["stats"], queryFn: api.stats, refetchInterval: 5_000 });

  if (stats.isPending) return <Skeleton className="h-96" />;
  if (stats.isError) return <Notice tone="error" title="We couldn't load the tracking data">{stats.error.message}</Notice>;

  const { slos, goals, funnel, holdout } = stats.data;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="pb-2 pt-4 text-[40px] sm:text-5xl">Tracking</h1>
        <p className="text-sm text-muted">
          Updates every 5 seconds. Raw counters at{" "}
          <a className="underline" href={`${API_URL}/metrics`}>
            /metrics
          </a>
          .
        </p>
      </div>

      <Section title="Technical SLOs">
        {slos.map((slo) => (
          <Row key={slo.goal} label={slo.goal} hint={slo.target} status={slo.met}>
            {slo.actual === null ? "No data" : slo.goal.includes("live") ? `${(slo.actual * 1000).toFixed(0)} ms` : slo.goal.includes("succeed") ? `${slo.actual.toFixed(2)}%` : slo.actual}
          </Row>
        ))}
      </Section>

      <Section title="Product goals">
        <Row
          label="Bookers who invite"
          hint={`${goals.bookersWhoInvite.inviters} of ${goals.bookersWhoInvite.bookers} bookers · target ${goals.bookersWhoInvite.targetPct}%`}
          status={goals.bookersWhoInvite.pct === null ? null : goals.bookersWhoInvite.pct >= goals.bookersWhoInvite.targetPct}
        >
          {pct(goals.bookersWhoInvite.pct)}
        </Row>
        {goals.inviteConversion.map((row) => (
          <Row
            key={row.rail}
            label={`Opened invites that claim · ${row.rail}`}
            hint={`${row.claimed} of ${row.opens} opens · ${pct(row.pctWithSpots)} when spots were left · target ${row.targetPct}%`}
            status={row.pct === null ? null : row.pct >= row.targetPct}
          >
            {pct(row.pct)}
          </Row>
        ))}
        {goals.kFactor.map((row) => (
          <Row key={row.rail} label={`K-factor · ${row.rail}`} hint={`${row.newUsers} new users from ${row.existingUsers} existing`}>
            {row.kFactor ?? "—"}
          </Row>
        ))}
      </Section>

      <Section title="Funnel">
        <FunnelTable funnel={funnel} />
      </Section>

      <Section title="Holdout: plans that happen per user">
        {holdout.map((row) => (
          <Row key={row.inviteGroup} label={row.inviteGroup} hint={`${row.users} original users · ${row.plansHappened} activities that ran with 2+ bookings`}>
            {row.plansHappenedPerUser ?? "—"}
          </Row>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <h2 className="mb-2 text-xl">{title}</h2>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

function Row({ label, hint, status, children }: { label: string; hint: string; status?: boolean | null; children: ReactNode }) {
  const dot = status === undefined ? null : status === null ? "bg-ink/20" : status ? "bg-lime" : "bg-alert";
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-sm font-medium">
          {dot && <span className={`size-2 shrink-0 rounded-full ${dot}`} />}
          {label}
        </p>
        <p className="text-xs text-muted">{hint}</p>
      </div>
      <p className="shrink-0 font-display text-xl font-semibold tabular-nums">{children}</p>
    </div>
  );
}

function FunnelTable({ funnel }: { funnel: Stats["funnel"] }) {
  const count = (step: string, rail = "all") => funnel.find((row) => row.step === step && row.rail === rail)?.actors ?? 0;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead className="text-left text-xs text-muted">
          <tr>
            <th className="py-2 font-medium">Step (people)</th>
            <th className="py-2 text-right font-medium">All</th>
            <th className="py-2 text-right font-medium">Vouch</th>
            <th className="py-2 text-right font-medium">Public</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {FUNNEL.map((step) => {
            const byRail = RAIL_STEPS.has(step);
            return (
              <tr key={step}>
                <td className="py-2">{step.replace("_", " ")}</td>
                <td className="py-2 text-right">{count(step)}</td>
                <td className="py-2 text-right">{byRail && count(step, "vouch")}</td>
                <td className="py-2 text-right">{byRail && count(step, "public")}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
