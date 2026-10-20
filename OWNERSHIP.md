# Ownership: only 11% of opened invites convert

Day 30. The booking side is healthy, and 34% of bookers invite, so people want to bring friends. The problem is after the friend opens the invite: 11% claim a spot against a 25% target. Most opens are on mobile, and vouches convert better than public links.

## 1. Diagnose

First, I check that the number is real. Then I find where the guests drop off.

| Look at | Why |
| --- | --- |
| Conversion for opens with spots left (`pct_with_spots`) against all opens | Shows how many guests arrive after the activity is full. |
| Conversion by rail, and the mix of rails over time | If public links grew as a share of invites, the blended rate falls even when each rail stays the same. |
| Conversion by platform (iOS, Android, web) | Most opens are on mobile. A bad mobile step shows up here. |
| Claim attempts by outcome (`sold_out`, `invite_used`, `error`) | Shows whether guests tried and failed, or never tried. |
| Time from invite created to opened, and from opened to claimed | Shows if invites go out too late, or if guests wait and then lose the spot. |
| Opens by the inviter or by people already booked | These cannot convert, so they make the denominator too big. |

**Top hypotheses, most likely first:**
1. **The activity is full before the friend arrives.** Invites go out right after booking, but the friend opens the link hours later, on a phone. The spots were sold to strangers in the meantime.
2. **Mobile friction.** The guest lands on a web page from a chat app, must type a name, and may be sent to an app store. Every step loses people.
3. **Public links reach people with low intent.** A link in a big group chat gets many opens from people who were never going to come. Vouches convert better, which supports this.
4. **The guest needs to check with someone first.** The price or date does not work yet, and there is no way to say "maybe".

## 2. Improve

Ranked by expected impact against effort. I start with measurement, because it is cheap and it tells me which of the other changes to make first.

| # | Change | Type | Impact | Effort |
| --- | --- | --- | --- | --- |
| 1 | Add `claim_started` and `claim_failed {reason}` events. Leave the inviter's opens and already-booked people out of the denominator. | Tracking | Shows the real rate and the real cause | Low |
| 2 | Hold spots for vouched friends for a short time, for example 2 hours. A held spot counts against capacity and comes back when it expires. | Product and technical | High, if hypothesis 1 is true | Medium |
| 3 | One-tap claim on mobile: the guest sees the activity before any form, the name is filled in if we know it, and universal links open the app only if it is installed. Never force an install. | Product and technical | High, if hypothesis 2 is true | Medium |
| 4 | Make vouch the default in the invite panel, with a contact picker in the app. Public link becomes the second choice. | Product | Medium | Low |
| 5 | A waitlist when the activity is full, so a late friend can still get in if someone cancels. | Product and technical | Medium | High |

## 3. Prove it

- Each change ships behind its own flag, as an A/B test on the invite page. I randomise by invite, so both people in one invite see the same version.
- **Primary metric:** claims per unique open with spots left, by rail.
- **Guardrails:** zero oversold bookings, the booking SLOs, and how often held spots expire unused, because spots that are held and not used cost the host money.
- **Sample size:** to detect a move from 11% to 15%, I need about 1,100 opens in each arm. I decide the length of the test before I start, and I do not stop early when the result looks good.
- The 10% invite holdout keeps running the whole time. It answers the bigger question: do invites cause more plans that happen, compared with no invites at all?

## 4. Decide

If the rate is still under 25% after these changes, I would **change the goal, not remove the feature**, as long as two things are true:

1. Vouches reach 25% or close to it.
2. The treatment group has more plans that happen than the holdout.

The reason: a public link is a reach tool. Its job is to get many people to look, so a low conversion rate per open is normal for it. One 25% target for both rails punishes the rail that does its job. I would propose 25% for vouches, a separate and lower target for public links, and make plans that happen the main measure of success.

I would **remove the feature**, or cut it back to vouches only, if the treatment group has no more plans that happen than the holdout after 30 days. That would mean invites add noise for hosts and friends without bringing more people out. I would keep iterating only while each change moves the number. I would not keep going because of effort already spent.
