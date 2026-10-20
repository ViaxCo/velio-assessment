# Plans: group bookings with live availability and viral invites

## 1a. Challenge the scope

### 1. Invites and capacity pull against each other

The scope says "bookers invite friends right after booking" and "never oversell". For a real group, these conflict. Ada books, then sends invites to three friends. Before her friends open the link, strangers take the last spots. Ada's group does not happen, but our numbers still show a booking and three invites. "Plans that actually happen" is the core metric, and this is the most direct way to miss it.

**Question for the product owner:** should a booker be able to hold spots for the friends they invite, and for how long?

**Assumption:** no holds in the prototype. The invite page shows live spots and says clearly when the activity filled up. I record how many spots were left when each invite was opened, so that we can see how often a guest arrives too late. Holds and a waitlist are the first things I would ship next.

### 2. "25% of opened invites end in a claimed spot" is not well defined, and one target for both rails is wrong

- "Opened" is not defined. One person may open a link five times. A public link in a group chat may get 50 opens for 2 spots.
- A guest who opens an invite for a full activity cannot convert, whatever we do on the invite page.
- A vouch goes to one person who someone stands behind. A public link goes to anyone. These rails have different intent, so they should have different targets. One blended number moves when the mix of rails moves, even if nothing got better or worse.

**Assumption:** I count unique (invite, person) opens. I report the rate per rail, and again for only the opens where spots were left. I apply the 25% target to each rail, and I ask the product owner for separate targets.

### 3. "30% of bookers generate an invite" rewards invites, not guests

It is easy to reach this target with invites that nobody sends or opens, for example by making a link for every booker by default. A booker on an activity with no spots left has no reason to invite. And holdout users cannot invite at all.

**Assumption:** a booker counts once per activity if they created at least one invite. Only the treatment group is in the denominator. I treat this as a leading signal and always read it next to invite conversion and the K-factor.

### 4. The core metrics have no definition and no target

"K-factor" and "plans that actually happen" are the core Velio metrics, but the scope gives no definition, time window or target for them. There is also no attendance data, so we cannot know if a plan really happened.

**Assumption:**
- **K-factor:** new users who joined through a claimed invite, divided by existing users who booked or hosted. Reported by rail.
- **A plan that happens:** an activity that started with 2 or more bookings. This is a proxy until we have a check-in.
- **Target:** I would collect a baseline for 30 days before I set one.

### 5. What does a vouch do, other than its label?

The scope says a vouch carries trust, but gives it no behaviour. Can the invited person skip anything? Is the voucher responsible if the guest does not show up? Without authentication, we also cannot prove that the vouched person is the one who claims.

**Assumption:** a vouch names its recipient, works once, and shows as "vouched" to the host and the group. A public link works for anyone until the activity fills. The recipient is not verified in the prototype. Trust scores are out of scope, but the attribution data is ready for them.

## 1b. Technical implementation plan

### Architecture

```
 web / mobile ──HTTP──▶ API instance ──SQL──▶ Postgres (source of truth)
      ▲                     │
      └──────── SSE ────────┤ publish after commit
                            ▼
                     Redis pub/sub ──▶ every API instance ──▶ its open SSE streams
```

- **Backend:** Node, TypeScript, Express and Knex. The API is stateless, so it can run as many instances.
- **Web:** Next.js with TanStack Query, for hosts and bookers, plus the invite page for guests who open a link.
- **Mobile:** Flutter, for the invited guest only.
- **Identity:** a UUID made on the device, sent as `X-User-Id`. Full authentication is out of scope.

### Data model

| Table | Purpose |
| --- | --- |
| `users` | Name, `generation` (hops from an original user, stamped once at signup) and `invite_group` (treatment or holdout). |
| `activities` | Capacity, `spots_taken` and `version`. `CHECK (spots_taken BETWEEN 0 AND capacity)`. |
| `plans` | A group going together. A direct booking starts a plan. A claim joins the inviter's plan. |
| `bookings` | `UNIQUE (activity_id, user_id)`: one spot per person per activity. |
| `invites` | Code, rail, inviter, activity, plan, and the recipient for a vouch. |
| `attributions` | Who invited whom, the rail, the code, the generation and whether the guest was new. Append-only. |
| `events` | The product funnel. Append-only. |

### Concurrency: the last spot

One conditional update in a transaction takes the spot:

```sql
UPDATE activities
SET spots_taken = spots_taken + 1, version = version + 1
WHERE id = $1 AND spots_taken < capacity AND starts_at > now()
RETURNING spots_taken, capacity, version;
```

Postgres locks the row. Requests that wait for the lock check the `WHERE` again after the first one commits. If no row comes back, the activity is full or has started, and the API returns `409 sold_out` or `410 activity_started`.

**Why this and not the alternatives:**

| Option | Why not |
| --- | --- |
| `SELECT ... FOR UPDATE`, then update | The same lock, with one more round trip and more code. |
| Optimistic locking on `version`, with retries | On a hot activity, most requests fail and retry. This adds load at the worst moment. |
| A Redis counter (`DECR`) | Fast, but then there are two sources of truth, and they need to be kept in agreement after a crash. |
| `SERIALIZABLE` isolation | Correct, but it fails transactions that the client must retry. |

**Extra guards, in case the code has a bug:**
- The `CHECK` constraint makes overselling impossible in the database.
- `UNIQUE (activity_id, user_id)` makes a retry or a double tap safe. The API returns the existing booking with `200`.
- A partial unique index on `attributions (invite_id) WHERE rail = 'vouch'` makes each vouch single use, even when two people claim at the same moment.

**Limit:** all bookings for one activity wait on one row. That is fine for activities with tens or hundreds of spots. For thousands of spots per activity, I would split the capacity into buckets.

**Test:** fire 60 truly concurrent requests at 5 spots across two API instances. Exactly 5 must succeed, the rest must get `409 sold_out`, and `spots_taken`, the bookings count and the capacity must agree.

### Real-time availability

1. The booking commits.
2. The API publishes `{activityId, spotsTaken, capacity, version, committedAt}` to the Redis channel `availability`. The API replies to the booker first and does not wait for Redis.
3. Every API instance subscribes to the channel and writes the event to its open SSE streams.
4. Clients apply an event only if its `version` is newer than the one they have. Late or repeated events do no harm.
5. On connect and on every reconnect, the client fetches fresh data, so it cannot miss a change made while it was offline.

**Why SSE:** the data only goes from the server to the client. SSE works through most proxies, and the browser reconnects on its own. WebSockets would add a two-way protocol that we do not need.

**Why publish after commit:** a client must never see a spot that was rolled back.

### Attribution that cannot change

- A claim is one transaction. It creates the user with `generation = inviter.generation + 1`, takes the spot, writes the `attributions` row and writes the `spot_claimed` event. Either all of it happens or none of it does.
- The `attributions` row copies the rail, the code and the generation at the moment of the claim. It does not depend on joins to rows that could change later.
- A database trigger rejects `UPDATE`, `DELETE` and `TRUNCATE` on `attributions` and `events`. A correction must be a new row, so the history stays auditable.
- A user's generation is set once, when the user is created, from the first invite they claim.

### Rollout: feature flag and holdout

- `INVITES_ENABLED` is a kill switch. When it is off, nobody can create new invites, but links that people already have keep working. No guest sees a broken link.
- `INVITE_HOLDOUT_PERCENT` (default 10) puts that share of users in a holdout group. The group comes from a hash of the user ID, so it never changes for a person. Holdout users can book, but they cannot create invites.
- **Phases:** the team only, then 50% of users with a 10% holdout, then everyone except the holdout. I keep the holdout for at least 30 days after full rollout.

### Risks

| Risk | Mitigation |
| --- | --- |
| No authentication, so anyone can send any user ID | Accepted for the prototype. In production: signed sessions, and rate limits on claims and invite creation. |
| A public link is shared widely and strangers take the group's spots | Track claims per public link. Next step: a cap per link, and holds for vouched friends. |
| Redis is down | Bookings still work, because Postgres is the source of truth. Clients see changes when they reconnect and fetch. |
| The process crashes after the commit but before the publish | Clients fetch on reconnect. In production: a transactional outbox, so every committed booking is published. |
| One hot activity makes the row lock a bottleneck | Measure lock wait time in the load test. Split capacity into buckets if needed. |
| Client events (views, opens) get lost or repeated | Count distinct people, not rows. Write server events in the same transaction as the business data. |

## 1c. Product implementation plan

### Host

1. Enter a name and switch to the Host role.
2. Create an activity: title, description, date and time, price and number of spots.
3. Watch attendance fill live: a spots bar, and a "Who's going" list that shows each person's plan and whether they came through a vouch or a public link.
4. Share an invite to fill the activity.

### Booker

1. Enter a name and browse what is on. Each card shows live spots: "3 spots left", "Last spot" or "Full".
2. Open an activity and tap "Book a spot". The count changes at once (an optimistic update).
3. Right after booking, the page says "You're in! Invite friends below." The invite panel is right there, because this is the moment the booker is most excited.
4. Choose a rail: "Vouch for a friend" (type their name), or "Public link". Share with the phone's share sheet, or copy the link.
5. See friends join the plan live in "Who's going".
6. Come back later and find the activity under "Your plans" at the top of the home page.

### Invited guest

1. Open the link on any phone (web), or enter or paste the code in the Velio app (Flutter).
2. See who invited them ("Ada vouched for you, Tunde"), the activity, the price and the live spots.
3. Enter a name, tap "Claim my spot", and they are in the inviter's plan.
4. Later, open the invite again, even offline, and see "You're in the plan!".

The brief puts the guest journey in Flutter. I also built a web invite page, because a first-time guest who taps a link in a chat app usually does not have the app yet. A forced install would lose them before they even see the invite. The Flutter app is for guests who have the app or a code.

In the real product, the web is for first contact and the app is for people who come back, in any role. A guest claims on the web, goes to the activity, and installs the app later to see their plans, get alerts when a plan changes and invite their own friends. I built only the guest flow in Flutter, because the brief asks for it there and it is where mobile quality matters most: a phone, a chat app and often a bad network.

### Edge cases

| Situation | What the user sees |
| --- | --- |
| The last spot sells out while they book | "So close. Someone just took the last spot. We didn't book you." The count changes to Full. It does not go back to the old number, because that number is wrong now. |
| An invite for an activity that is already full | "This one filled up before you got here. Ask Ada about the next one." No claim button, so there is no dead end. |
| A vouch that someone already used | "This personal invite has already been used. Ask Ada to send you a new one." |
| The person who used a vouch opens it again | "You're in the plan!", not "already used". |
| An activity that has started | "This activity has already started." No claim button. |
| A wrong code | "We couldn't find that invite code." |
| A double tap, or a retry after a timeout | The API returns the existing booking. The person gets one spot. |
| The guest is offline | The phone shows the saved copy of the invite with an offline banner, and tries again on its own. |
| Someone opens their own invite | "This is your own invite. Share it with a friend." |

### What I build in 48 hours

- The host and booker flows on web, and the guest flow on web and Flutter.
- The concurrency guarantees and the concurrent test.
- Live availability across many API instances.
- Immutable attribution with generation.
- The flag, the holdout, the funnel events, the goal views, `/metrics`, a `/stats` page and a load test.

### What I would ship next

1. **Holds for vouched friends:** a booker can hold spots for a short time for the friends they vouch for. This targets challenge 1 directly.
2. **A waitlist** that fills cancelled spots in order. This needs cancellations first.
3. **Deep links** (universal links and app links), so an invite opens the app if it is installed and the web page if it is not.
4. **Real authentication and rate limits.** This also joins a person's web and app identities into one user.
5. **A check-in at the activity,** so "plans that happen" is measured, not guessed.
6. **Booker and host screens in the app,** for the people who come back, with push alerts when a plan changes.

## 1d. Tracking plan

### Goals

| Goal | Metric and how it is measured | Target | Trigger for an improvement plan |
| --- | --- | --- | --- |
| Never oversell | Activities where bookings exceed capacity, or where bookings and `spots_taken` disagree (`check_oversold`). The `CHECK` constraint blocks it in the database. | 0, ever | Any row. Treat it as an incident and stop bookings on that activity. |
| Bookings succeed when spots exist | From `velio_booking_attempts_total`: successes divided by successes plus unexpected errors. Correct rejections (sold out, started, vouch used) and retries that return an existing booking are not failures, so they are left out. | ≥ 99.5% | Below 99.5% over 1 day, or above 0.5% errors over 15 minutes. |
| Availability feels live | `velio_availability_update_seconds`: from the commit to the write to each open stream, p95. The load test also measures it at the client, and checks that every update arrives. | p95 ≤ 2 s | p95 above 2 s for 15 minutes, or any update missing in the load test. |
| Bookers become inviters | `goal_bookers_who_invite`: treatment-group bookers who created at least one invite for that activity, divided by all treatment-group bookers. | ≥ 30% | Below 30% for 2 weeks in a row, with at least 200 bookers. |
| Invites turn into guests | `goal_invite_conversion`: unique (invite, person) opens that end in a claim. By rail, and also for opens with spots left. | ≥ 25% per rail | Below 25% for 2 weeks in a row, with at least 300 opens. |
| K-factor (core) | `goal_k_factor`: new users from claimed invites divided by existing users who booked or hosted. By rail. | Baseline for 30 days, then set | Falls for 2 weeks in a row. |
| Plans that happen (core) | `holdout_plans_that_happen`: activities that started with 2 or more bookings, per original user, treatment against holdout. | Treatment higher than holdout | No difference after 30 days. |

### Events

| Event | Sent by | Properties |
| --- | --- | --- |
| `activity_viewed` | Client | activity, person, platform |
| `booked` | Server, in the booking transaction | activity, person, plan |
| `invite_created` | Server, in the invite transaction | activity, person, invite, **rail** |
| `invite_opened` | Client | invite, person, **rail**, platform, **spots left at the moment of opening** |
| `spot_claimed` | Server, in the claim transaction | invite, person, **rail**, **generation**, new or existing user |

Server events are written in the same transaction as the booking, invite or claim, so they cannot disagree with the data. Client events can be lost or repeated, so the views count distinct people.

**Technical metrics** (Prometheus, at `/metrics`):
- `velio_booking_attempts_total{source, outcome}`
- `velio_availability_update_seconds`
- `velio_open_streams`

### Holdout design

A random 10% of users go into a holdout group, from a hash of their user ID, so the group never changes for a person. Holdout users can host and book like anyone else, but they cannot create invites. After 30 days, I compare the two groups on an outcome that both groups can reach without invites: activities they hosted or booked that started with 2 or more people. I only compare original users (generation 0), because invited users exist only in the treatment group. Because the groups are random, a higher rate in the treatment group shows that invites cause more plans to happen. It does not only show that engaged users like to invite. The holdout also gives a fair baseline for the K-factor target.

## Changes during the build

See "Plan vs. reality" in the README.
