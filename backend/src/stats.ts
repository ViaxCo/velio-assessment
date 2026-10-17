import type { Db } from "./db.ts";
import { availabilityLatency, bookingAttempts } from "./metrics.ts";

const SUCCESS_TARGET_PCT = 99.5;
const LATENCY_TARGET_SECONDS = 2;

async function bookingSuccessPct() {
  const { values } = await bookingAttempts.get();
  const count = (outcome: string) =>
    values.filter((value) => value.labels.outcome === outcome).reduce((sum, value) => sum + value.value, 0);
  const successes = count("success");
  const errors = count("error");
  return successes + errors === 0 ? null : (100 * successes) / (successes + errors);
}

async function latencyP95Seconds() {
  const { values } = await availabilityLatency.get();
  const samples = values.find((value) => value.metricName?.endsWith("_count"))?.value;
  return samples ? values.find((value) => value.labels.quantile === 0.95)!.value : null;
}

export async function readStats(db: Db) {
  const [oversold, successPct, p95, bookersWhoInvite, inviteConversion, kFactor, funnel, holdout] = await Promise.all([
    db("check_oversold"),
    bookingSuccessPct(),
    latencyP95Seconds(),
    db("goal_bookers_who_invite").first(),
    db("goal_invite_conversion").orderBy("rail"),
    db("goal_k_factor").orderBy("rail"),
    db("metric_funnel"),
    db("holdout_plans_that_happen").orderBy("invite_group"),
  ]);

  return {
    slos: [
      { goal: "Never oversell", target: "0 oversold activities", actual: oversold.length, met: oversold.length === 0 },
      {
        goal: "Bookings succeed when spots exist",
        target: `${SUCCESS_TARGET_PCT}% of attempts`,
        actual: successPct,
        met: successPct === null ? null : successPct >= SUCCESS_TARGET_PCT,
      },
      {
        goal: "Availability feels live",
        target: `p95 under ${LATENCY_TARGET_SECONDS}s`,
        actual: p95,
        met: p95 === null ? null : p95 <= LATENCY_TARGET_SECONDS,
      },
    ],
    oversold,
    goals: { bookersWhoInvite, inviteConversion, kFactor },
    funnel,
    holdout,
  };
}
