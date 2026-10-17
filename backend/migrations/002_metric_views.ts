import type { Knex } from "knex";

export async function up(knex: Knex) {
  await knex.raw(`
    CREATE VIEW check_oversold AS
    SELECT a.id, a.title, a.capacity, a.spots_taken, count(b.id) AS bookings
    FROM activities a
    LEFT JOIN bookings b ON b.activity_id = a.id
    GROUP BY a.id
    HAVING count(b.id) > a.capacity OR count(b.id) <> a.spots_taken;

    CREATE VIEW metric_funnel AS
    SELECT name AS step,
           CASE WHEN grouping(rail) = 1 THEN 'all' ELSE rail END AS rail,
           count(*) AS events,
           count(DISTINCT actor_id) AS actors
    FROM events
    GROUP BY GROUPING SETS ((name), (name, rail))
    HAVING grouping(rail) = 1 OR rail IS NOT NULL;

    CREATE VIEW goal_bookers_who_invite AS
    SELECT count(DISTINCT b.user_id) AS bookers,
           count(DISTINCT i.inviter_id) AS inviters,
           round(100.0 * count(DISTINCT i.inviter_id) / nullif(count(DISTINCT b.user_id), 0), 1) AS pct,
           30 AS target_pct
    FROM bookings b
    JOIN users u ON u.id = b.user_id
    LEFT JOIN invites i ON i.inviter_id = b.user_id AND i.activity_id = b.activity_id
    WHERE u.invite_group = 'treatment';

    CREATE VIEW goal_invite_conversion AS
    WITH opens AS (
      SELECT DISTINCT ON (invite_id, actor_id)
             invite_id, actor_id, rail, (props ->> 'spotsLeft')::int AS spots_left
      FROM events
      WHERE name = 'invite_opened'
      ORDER BY invite_id, actor_id, created_at
    )
    SELECT coalesce(o.rail, 'all') AS rail,
           count(*) AS opens,
           count(a.id) AS claimed,
           round(100.0 * count(a.id) / nullif(count(*), 0), 1) AS pct,
           count(*) FILTER (WHERE o.spots_left > 0) AS opens_with_spots,
           round(100.0 * count(a.id) FILTER (WHERE o.spots_left > 0)
                 / nullif(count(*) FILTER (WHERE o.spots_left > 0), 0), 1) AS pct_with_spots,
           25 AS target_pct
    FROM opens o
    LEFT JOIN attributions a ON a.invite_id = o.invite_id AND a.invitee_id = o.actor_id
    GROUP BY ROLLUP (o.rail);

    CREATE VIEW goal_k_factor AS
    WITH existing AS (
      SELECT count(*) AS users
      FROM users u
      WHERE u.invite_group = 'treatment'
        AND (EXISTS (SELECT 1 FROM bookings b WHERE b.user_id = u.id)
          OR EXISTS (SELECT 1 FROM activities a WHERE a.host_id = u.id))
    )
    SELECT coalesce(r.rail, 'all') AS rail,
           count(a.id) FILTER (WHERE a.is_new_user) AS new_users,
           max(existing.users) AS existing_users,
           round(count(a.id) FILTER (WHERE a.is_new_user)::numeric / nullif(max(existing.users), 0), 3) AS k_factor
    FROM (VALUES ('vouch'), ('public')) r(rail)
    LEFT JOIN attributions a ON a.rail = r.rail
    CROSS JOIN existing
    GROUP BY ROLLUP (r.rail);

    CREATE VIEW holdout_plans_that_happen AS
    WITH memberships AS (
      SELECT host_id AS user_id, id AS activity_id FROM activities
      UNION
      SELECT user_id, activity_id FROM bookings
    ),
    per_user AS (
      SELECT u.id, u.invite_group, count(a.id) AS plans_happened
      FROM users u
      LEFT JOIN memberships m ON m.user_id = u.id
      LEFT JOIN activities a ON a.id = m.activity_id AND a.starts_at < now() AND a.spots_taken >= 2
      WHERE u.generation = 0
      GROUP BY u.id, u.invite_group
    )
    SELECT invite_group,
           count(*) AS users,
           sum(plans_happened) AS plans_happened,
           round(avg(plans_happened), 3) AS plans_happened_per_user
    FROM per_user
    GROUP BY invite_group;
  `);
}

export async function down(knex: Knex) {
  await knex.raw(`
    DROP VIEW holdout_plans_that_happen, goal_k_factor, goal_invite_conversion,
      goal_bookers_who_invite, metric_funnel, check_oversold;
  `);
}
