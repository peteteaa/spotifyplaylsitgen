// Per-invocation limits. Workers Free allows 50 outbound subrequests and 50 D1 queries
// per invocation (a db.batch() counts as one query). We stay under both with headroom.
export const FETCH_BUDGET = 40;
export const QUERY_BUDGET = 45;
const QUERY_HARD_LIMIT = 50; // the real cap; only final "save progress" batches may dip into the headroom

export class OutOfBudget extends Error {
  constructor(what: string) {
    super(`out of ${what} budget`);
  }
}

/** Counts outbound fetches. sub(cap) makes a per-user allowance that also charges the parent. */
export class Budget {
  used = 0;
  readonly limit: number;
  readonly parent?: Budget;

  constructor(limit: number, parent?: Budget) {
    this.limit = limit;
    this.parent = parent;
  }

  get left(): number {
    const own = this.limit - this.used;
    return this.parent ? Math.min(own, this.parent.left) : own;
  }

  take(): void {
    if (this.left <= 0) throw new OutOfBudget('subrequest');
    this.used++;
    this.parent?.take();
  }

  sub(cap: number): Budget {
    return new Budget(cap, this);
  }
}

/** Thin D1 wrapper that counts queries so a run never trips the per-invocation cap. */
export class Db {
  queries = 0;
  readonly d1: D1Database;
  readonly limit: number;

  constructor(d1: D1Database, limit = QUERY_BUDGET) {
    this.d1 = d1;
    this.limit = limit;
  }

  get left(): number {
    return this.limit - this.queries;
  }

  stmt(sql: string, ...binds: unknown[]): D1PreparedStatement {
    return this.d1.prepare(sql).bind(...binds);
  }

  private count(final = false): void {
    if (this.queries >= (final ? QUERY_HARD_LIMIT : this.limit)) throw new OutOfBudget('D1 query');
    this.queries++;
  }

  async all<T>(sql: string, ...binds: unknown[]): Promise<T[]> {
    this.count();
    return (await this.stmt(sql, ...binds).all<T>()).results;
  }

  async first<T>(sql: string, ...binds: unknown[]): Promise<T | null> {
    this.count();
    return this.stmt(sql, ...binds).first<T>();
  }

  async run(sql: string, ...binds: unknown[]): Promise<D1Result> {
    this.count();
    return this.stmt(sql, ...binds).run();
  }

  async batch(stmts: D1PreparedStatement[]): Promise<D1Result[]> {
    if (!stmts.length) return [];
    this.count();
    return this.d1.batch(stmts);
  }

  /** Like batch(), for the end-of-run save: allowed to use the headroom so progress is never dropped. */
  async save(stmts: D1PreparedStatement[]): Promise<D1Result[]> {
    if (!stmts.length) return [];
    this.count(true);
    return this.d1.batch(stmts);
  }
}

export async function getMeta(db: Db): Promise<Record<string, string>> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM meta');
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function setMeta(db: Db, key: string, value: string): D1PreparedStatement {
  return db.stmt(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    key,
    value,
  );
}
