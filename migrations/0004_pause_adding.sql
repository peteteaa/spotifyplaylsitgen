-- Pausing, set by the user from the home page. NULL = not paused, otherwise when the pause started.
-- Songs played at or after that time are stored as status 'skipped' and never added (a later replay, after
-- resuming, is added as usual). Songs already waiting from before the pause are added after resuming.
ALTER TABLE users ADD COLUMN adding_paused_at INTEGER;     -- every playlist
ALTER TABLE playlists ADD COLUMN paused_at INTEGER;        -- this playlist only
