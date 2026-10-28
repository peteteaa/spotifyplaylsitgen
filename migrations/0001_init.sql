-- Autolist schema. All times are Unix milliseconds.

-- One row per connected person. Also holds their last-run status.
CREATE TABLE users (
  id               TEXT PRIMARY KEY,          -- Spotify user id
  account_id       TEXT,                      -- Spotify account_id (stable, added May 2026)
  display_name     TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active', -- active | paused | needs_reconnect
  created_at       INTEGER NOT NULL,
  cursor_after     INTEGER,                   -- recently-played cursor (played_at of newest seen play)
  lock_until       INTEGER,                   -- stops a cron run and "Sync now" from overlapping
  last_sync_at     INTEGER,
  last_sync_ok     INTEGER,                   -- 1 ok, 0 error
  last_sync_msg    TEXT,
  last_sync_added  INTEGER NOT NULL DEFAULT 0,
  total_added      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tokens (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    INTEGER NOT NULL
);

-- Exactly 7 rows per user: slots 0-5 are genre buckets in rank order, slot 6 is Misc.
CREATE TABLE playlists (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot        INTEGER NOT NULL,
  bucket      TEXT NOT NULL,                  -- bucket name, or 'Misc' for slot 6
  spotify_id  TEXT,                           -- NULL until the playlist is created
  name_synced INTEGER NOT NULL DEFAULT 1,     -- 0 after a genre edit until Spotify is renamed
  item_count  INTEGER NOT NULL DEFAULT 0,     -- songs we added (we never remove any)
  PRIMARY KEY (user_id, slot)
);

-- Every song we've seen per user. Doubles as the dedupe table and the pending queue:
--   pending = waiting for an artist lookup, queued = placed but not yet added to Spotify,
--   added = in the playlist, full = skipped because the playlist hit its cap.
CREATE TABLE tracks (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  track_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  artist_ids  TEXT NOT NULL,                  -- JSON array, primary artist first
  artist_names TEXT NOT NULL,                 -- JSON array, same order
  played_at   INTEGER NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending',
  slot        INTEGER,
  added_at    INTEGER,
  PRIMARY KEY (user_id, track_id)
);
CREATE INDEX tracks_work ON tracks (user_id, status, played_at);
CREATE INDEX tracks_recent ON tracks (user_id, added_at);

-- Shared across users. Raw genres are kept so editing src/genres.ts reclassifies without refetching.
CREATE TABLE artists (
  id         TEXT PRIMARY KEY,                -- Spotify artist id
  name       TEXT NOT NULL,
  genres     TEXT NOT NULL,                   -- JSON array of raw genres / tags
  source     TEXT NOT NULL,                   -- spotify | lastfm | none
  fetched_at INTEGER NOT NULL
);
CREATE INDEX artists_age ON artists (fetched_at);

CREATE TABLE invites (
  code_hash  TEXT PRIMARY KEY,                -- SHA-256 of the code; the code itself is never stored
  label      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at    INTEGER,
  used_by    TEXT
);

-- Small key/value store: admin_id, rr_next, spotify_blocked_until, lastfm_blocked_until, last_cron.
CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
