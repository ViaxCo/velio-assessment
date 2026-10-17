# Velio: group bookings with live availability and viral invites

A host creates an activity with limited spots. People book spots and join a plan together. Bookers invite friends on one of two rails: a **vouch** for a specific person, or a **public** link. Guests claim their spot from the web or the Flutter app. Everyone sees the spot count change live.

```
backend/   Node + TypeScript API (Express, Knex, Postgres, Redis)
web/       Next.js app for hosts and bookers, plus the guest invite page
mobile/    Flutter app for the invited guest
```

## Quick start

You need Docker, Node 24 and Flutter 3.41.

```sh
docker compose up -d                 # Postgres on 5433, Redis on 6380

cd backend
npm install
npm run dev                          # API on http://localhost:4000, runs migrations on start
npm run seed                         # optional: 3 Lagos activities, one with a single spot left
npm test                             # concurrency, attribution and live update tests
npm run load-test                    # SLO check against the running API

cd ../web
npm install
npm run dev                          # http://localhost:3000

cd ../mobile
flutter pub get
flutter run                          # iOS simulator or Android emulator
```

The defaults match `docker-compose.yml`, so you do not need a `.env` file. The tests use a separate `velio_test` database that Docker creates on first start.

The Flutter app finds the API at `localhost:4000` on iOS and `10.0.2.2:4000` on the Android emulator. On a real phone, pass your computer's address:

```sh
flutter run --dart-define=API_URL=http://192.168.1.20:4000
```

### Try the full journey

1. Open http://localhost:3000. Enter a name and switch the role toggle to **Host**. Create an activity.
2. Open a private window. Enter another name, open the activity and book a spot. The host's window updates live.
3. As the booker, create a vouch invite or a public link.
4. Open the link in a third window, or enter the code in the Flutter app, and claim the spot.
5. Open http://localhost:3000/stats to see the funnel, the goals and the SLOs.

Identity is a UUID made on the device and kept in local storage. "Switch person" in the avatar menu gives you a new identity.

## Architecture and decisions

```
 web / mobile ──HTTP──▶ API instance ──SQL──▶ Postgres (source of truth)
      ▲                     │
      └──────── SSE ────────┤ publish after commit
                            ▼
                     Redis pub/sub ──▶ every API instance ──▶ its open SSE streams
```

### Data model

| Table | Purpose |
| --- | --- |
| `users` | Name, `generation` (hops from an original user, stamped at signup) and `invite_group` (treatment or holdout). |
| `activities` | Capacity, `spots_taken` and `version`. `CHECK (spots_taken BETWEEN 0 AND capacity)`. |
| `plans` | A group of people going together. A direct booking starts a new plan. A claim joins the inviter's plan. |
| `bookings` | `UNIQUE (activity_id, user_id)`, so one person has at most one spot. |
| `invites` | `code`, `rail` (vouch or public), inviter, activity, plan, and the recipient for a vouch. |
| `attributions` | Who invited whom, the rail, the code and the generation. One row per claimed spot. Append-only. |
| `events` | The product funnel. Append-only. |

### Concurrency: the last spot

A booking takes a spot with one atomic statement inside a transaction:

```sql
UPDATE activities
SET spots_taken = spots_taken + 1, version = version + 1
WHERE id = $1 AND spots_taken < capacity AND starts_at > now()
RETURNING spots_taken, capacity, version;
```

Postgres takes a row lock for the update. Requests that wait for the lock check the condition again after the first one commits. When no row comes back, the activity is full, has started, or does not exist, and the API returns `409 sold_out`, `410 activity_started` or `404`. Three more guards stop bad data even if the code has a bug:

- The `CHECK` constraint makes overselling impossible at the database level.
- `UNIQUE (activity_id, user_id)` makes a retry or a double tap safe. The API returns the existing booking with `200`.
- A partial unique index on `attributions (invite_id)` for vouch invites makes each vouch single use, even when two people claim it at the same moment.

`backend/test/booking.test.ts` sends 60 concurrent requests for 5 spots across two API instances. Exactly 5 succeed and 55 get `409 sold_out`. The test then checks that `spots_taken`, the bookings count and the capacity agree. Another test sends 10 concurrent taps from one person and checks that only one booking exists.

### Real-time availability

1. After the booking transaction commits, the API publishes `{activityId, spotsTaken, capacity, version, committedAt}` to the Redis channel `availability`.
2. Every API instance subscribes to the channel and writes the event to its open SSE streams (`GET /stream?activityId=`).
3. Clients apply an event only if its `version` is newer than the one they have. This makes late or repeated events harmless.
4. When a client reconnects, it fetches fresh data, so it cannot miss a change while it was offline.

I chose SSE over WebSockets because the data goes one way, it works through most proxies, and the browser reconnects on its own. The publish happens after commit, so clients never see a spot that was rolled back. `backend/test/live.test.ts` books on instance A and checks that a client on instance B gets the event.

### Invites and attribution

- Only a booker or the host of an activity can create an invite.
- When a guest claims, one transaction creates the user with `generation = inviter.generation + 1`, takes a spot, writes the `attributions` row and writes a `spot_claimed` event.
- A database trigger rejects every `UPDATE`, `DELETE` and `TRUNCATE` on `attributions` and `events`. History cannot change, even by mistake. A correction must be a new row.

### Feature flag and holdout

- `INVITES_ENABLED=false` turns invites off for everyone.
- `INVITE_HOLDOUT_PERCENT` (default 10) puts that share of users in a holdout group. The group comes from a hash of the user id, so it never changes for a person. Holdout users can book but cannot create invites. The web app hides the invite panel for them.
- The view `holdout_plans_that_happen` compares the two groups for original users only (generation 0). For each user, it counts the plans they booked into that had 2 or more people and whose start time has passed. If treatment users have more plans that happen than holdout users, invites cause more plans, not only correlate with engaged users.

### Web app

Next.js with TanStack Query and Tailwind, built mobile first. Booking is optimistic: the spot count changes at once. If the API says the activity sold out, the app does not roll back to the old count. It marks the activity as full and shows a kind message, because the old count is now wrong. Live events update the query cache directly.

### Flutter app

Enter a code or paste a link, see the activity, and claim a spot.

- **Offline:** each invite is saved on the phone. With no network, the app shows the saved copy with an offline banner and tries again every few seconds.
- **Live spots:** the app listens to the same SSE stream, and the spots pill animates when it changes.
- **Haptics:** a selection click when you tap, a medium impact when a claim succeeds, and a heavy impact when it fails.
- **Retries:** a claim is safe to retry, because the API returns the existing booking.
- **Recent invites:** the first screen lists recent invites, so a guest can come back to one.

## Plan vs. reality

<!-- Write this after PLANS.md: where the build differs from the plans, and why. -->

## Trade-offs

**What I put first:** correctness of the last spot, attribution that cannot change, and tracking that answers each goal with one query. The tests cover the parts that would cost money or trust if they broke.

**Shortcuts:**
- No real authentication. Any client can send any `X-User-Id`. In production, this would be a session or a signed token.
- Each guest identity belongs to a device. If the same person claims on a second phone, the system sees a new user and counts them as new.
- Product goals are SQL views over the `events` table. This is fine for a prototype, but it would not scale to large traffic.
- Latency is measured from commit to the moment the server writes to each stream. It does not include the network hop to the client. The load test checks this end to end on one machine.
- Redis pub/sub does not store messages. If Redis is down, bookings still work, but clients only see changes after they reconnect and fetch.
- No payments, as the scope says. Prices are shown and not charged.

**To take this to production:**
- Add real authentication, and rate limits on claims and invite creation.
- Send events to a warehouse through an outbox table, and build the funnel there.
- Use a transactional outbox for availability events so that every committed booking is published, even if the process crashes after commit.
- Add a waitlist and cancellations. The `version` column and the atomic update already support a spot being given back.
- Run the load test in CI against a production-like setup and alert on the SLOs.
- Add deep links (universal links and app links), so an invite link opens the Flutter app directly.

## Where to see the tracking

**Admin page:** http://localhost:3000/stats shows the SLOs, the three goals by rail, the funnel and the holdout comparison. It refreshes every 5 seconds. The same data is JSON at http://localhost:4000/stats.

**Prometheus metrics:** http://localhost:4000/metrics

| Metric | What it measures |
| --- | --- |
| `velio_booking_attempts_total{source, outcome}` | Booking and claim attempts. `outcome` is `success`, `already_booked`, `sold_out`, `activity_started`, `invite_used`, `error` and others. |
| `velio_availability_update_seconds` | Time from commit to each open stream getting the update (p50, p95, p99). |
| `velio_open_streams` | Open SSE connections on this instance. |

**Load test and SLOs:** `npm run load-test` in `backend/` sends 300 bookers at 200 spots, 50 at a time, with 50 open SSE clients. Last result on a MacBook:

| SLO | Target | Actual | Met |
| --- | --- | --- | --- |
| Zero oversold bookings | 0 | 0 | Yes |
| Bookings succeed when spots exist | ≥ 99.5% | 100% | Yes |
| Availability update p95 | ≤ 2 s | 2 ms (p50 1 ms) | Yes |

**SQL views:** connect with `psql postgresql://velio:velio@localhost:5433/velio`.

```sql
SELECT * FROM goal_bookers_who_invite;     -- share of bookers who create an invite (target 30%)
SELECT * FROM goal_invite_conversion;      -- share of opened invites that end in a claimed spot, by rail (target 25%)
SELECT * FROM goal_k_factor;               -- new users brought in per existing user, by rail
SELECT * FROM metric_funnel;               -- viewed → booked → invite created → opened → claimed, by rail
SELECT * FROM holdout_plans_that_happen;   -- treatment vs. holdout: plans with 2+ people that happened
SELECT * FROM check_oversold;              -- should always be empty
```

`goal_invite_conversion` also shows conversion for invites opened while spots were still left. This separates "the guest did not want to come" from "the activity was already full".
