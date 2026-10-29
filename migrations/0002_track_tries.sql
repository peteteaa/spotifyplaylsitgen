-- Failed genre lookups per pending song. After a few, the song stops waiting and goes to Misc.
ALTER TABLE tracks ADD COLUMN tries INTEGER NOT NULL DEFAULT 0;
