import type { Knex } from "knex";

export async function up(knex: Knex) {
  await knex.raw(`
    CREATE TABLE users (
      id uuid PRIMARY KEY,
      name text NOT NULL,
      generation int NOT NULL DEFAULT 0 CHECK (generation >= 0),
      invite_group text NOT NULL CHECK (invite_group IN ('treatment', 'holdout')),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE activities (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      host_id uuid NOT NULL REFERENCES users(id),
      title text NOT NULL,
      description text NOT NULL DEFAULT '',
      starts_at timestamptz NOT NULL,
      price_minor int NOT NULL CHECK (price_minor >= 0),
      currency text NOT NULL DEFAULT 'NGN',
      capacity int NOT NULL CHECK (capacity > 0),
      spots_taken int NOT NULL DEFAULT 0,
      version int NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (spots_taken BETWEEN 0 AND capacity)
    );

    CREATE TABLE plans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      activity_id uuid NOT NULL REFERENCES activities(id),
      created_by uuid NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE bookings (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      activity_id uuid NOT NULL REFERENCES activities(id),
      plan_id uuid NOT NULL REFERENCES plans(id),
      user_id uuid NOT NULL REFERENCES users(id),
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (activity_id, user_id)
    );
    CREATE INDEX bookings_plan_id_idx ON bookings(plan_id);

    CREATE TABLE invites (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      code text NOT NULL UNIQUE,
      rail text NOT NULL CHECK (rail IN ('vouch', 'public')),
      inviter_id uuid NOT NULL REFERENCES users(id),
      activity_id uuid NOT NULL REFERENCES activities(id),
      plan_id uuid REFERENCES plans(id),
      recipient text,
      created_at timestamptz NOT NULL DEFAULT now(),
      CHECK (rail = 'public' OR recipient IS NOT NULL)
    );

    CREATE TABLE attributions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      invite_id uuid NOT NULL REFERENCES invites(id),
      inviter_id uuid NOT NULL REFERENCES users(id),
      invitee_id uuid NOT NULL REFERENCES users(id),
      rail text NOT NULL,
      code text NOT NULL,
      generation int NOT NULL,
      is_new_user boolean NOT NULL,
      booking_id uuid NOT NULL UNIQUE REFERENCES bookings(id),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX attributions_invite_id_idx ON attributions(invite_id);
    CREATE UNIQUE INDEX attributions_vouch_once ON attributions(invite_id) WHERE rail = 'vouch';

    CREATE TABLE events (
      id bigserial PRIMARY KEY,
      name text NOT NULL CHECK (name IN ('activity_viewed', 'booked', 'invite_created', 'invite_opened', 'spot_claimed')),
      actor_id uuid NOT NULL,
      activity_id uuid REFERENCES activities(id),
      invite_id uuid REFERENCES invites(id),
      rail text,
      props jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX events_name_idx ON events(name, created_at);

    CREATE FUNCTION reject_change() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
    END $$;

    CREATE TRIGGER attributions_append_only
      BEFORE UPDATE OR DELETE OR TRUNCATE ON attributions
      FOR EACH STATEMENT EXECUTE FUNCTION reject_change();
    CREATE TRIGGER events_append_only
      BEFORE UPDATE OR DELETE OR TRUNCATE ON events
      FOR EACH STATEMENT EXECUTE FUNCTION reject_change();
  `);
}

export async function down(knex: Knex) {
  await knex.raw(`
    DROP TABLE events, attributions, invites, bookings, plans, activities, users;
    DROP FUNCTION reject_change;
  `);
}
