import { describe, expect, it } from 'vitest';
// @ts-expect-error -- Node built-ins: tests run in Node, but tsconfig only loads the Workers types.
import { readdirSync, readFileSync } from 'node:fs';
// @ts-expect-error -- see above
import { DatabaseSync } from 'node:sqlite';
import { INSERT_PLAY, skippedByPause } from '../src/sync';

// The real schema: every migration, in order, on an in-memory SQLite (D1 is SQLite), with one user.
function schema() {
  const db = new DatabaseSync(':memory:');
  for (const f of readdirSync('migrations').filter((f: string) => f.endsWith('.sql')).sort()) db.exec(readFileSync(`migrations/${f}`, 'utf8'));
  db.prepare("INSERT INTO users (id, display_name, created_at) VALUES ('u', 'U', 0)").run();
  return db;
}

const play = (db: any, track: string, playedAt: number, status: 'pending' | 'skipped') =>
  db.prepare(INSERT_PLAY).run('u', track, 'Song', '["a"]', '["A"]', playedAt, status);
const row = (db: any, track: string) => db.prepare('SELECT status, played_at, slot, tries FROM tracks WHERE track_id = ?').get(track);

describe('pausing', () => {
  it('skips plays from the pause start on, not before', () => {
    expect(skippedByPause(null, 5)).toBe(false);
    expect(skippedByPause(10, 9)).toBe(false);
    expect(skippedByPause(10, 10)).toBe(true);
    expect(skippedByPause(10, 11)).toBe(true);
  });

  it('a skipped song gets another chance only when played again later', () => {
    const db = schema();
    play(db, 't1', 100, 'skipped');
    play(db, 't1', 100, 'pending'); // the lookback re-reads the same play after resuming
    expect(row(db, 't1').status).toBe('skipped');
    play(db, 't1', 200, 'skipped'); // played again, still paused
    expect(row(db, 't1')).toMatchObject({ status: 'skipped', played_at: 200 });
    db.prepare("UPDATE tracks SET slot = 3, tries = 2 WHERE track_id = 't1'").run();
    play(db, 't1', 300, 'pending'); // played again after resuming
    expect(row(db, 't1')).toMatchObject({ status: 'pending', played_at: 300, slot: null, tries: 0 });
  });

  it('other songs are still deduped as before', () => {
    const db = schema();
    play(db, 't2', 100, 'pending');
    db.prepare("UPDATE tracks SET status = 'added', slot = 1 WHERE track_id = 't2'").run();
    play(db, 't2', 500, 'pending');
    play(db, 't2', 600, 'skipped');
    expect(row(db, 't2')).toMatchObject({ status: 'added', played_at: 100, slot: 1 });
  });

  it('migration 0004 adds both pause columns, unpaused by default', () => {
    const db = schema();
    db.prepare("INSERT INTO playlists (user_id, slot, bucket) VALUES ('u', 0, 'Pop')").run();
    expect(db.prepare('SELECT adding_paused_at FROM users').get()).toEqual({ adding_paused_at: null });
    expect(db.prepare('SELECT paused_at FROM playlists').get()).toEqual({ paused_at: null });
  });
});
