# Autolist (skyesthingy)

Autolist watches what up to 5 Spotify users listen to and sorts each song into 7 playlists per person: 6 genre playlists plus one "Misc" playlist. It runs on Cloudflare Workers (Free plan) and stores data in D1.

- Deployed URL: https://skyesthingy.pthambundit.workers.dev
- Worker name: `skyesthingy`
- D1 database: `autolist` (binding `DB`, migrations in `migrations/`)
- Cron: `*/15 * * * *`. One cron syncs everyone. It uses 1 of the 5 cron triggers the Free plan allows.
- `legacy/spotify_autolist.py` is the original single-user version. It is kept for reference only.

## Setup

### 1. Cloudflare and Node

1. Make a free Cloudflare account.
2. Install Node 22 or newer.
3. In this folder run:

```
npm install
npx wrangler login
```

Wrangler is a dev dependency, so always use `npx wrangler`.

### 2. Spotify app

1. Go to https://developer.spotify.com/dashboard and create an app.
2. The app owner needs Spotify Premium (Feb 2026 dev-mode rule).
3. Choose the Web API.
4. Add these redirect URIs:
   - `https://skyesthingy.pthambundit.workers.dev/callback`
   - `http://127.0.0.1:8787/callback`
5. Spotify does not accept `localhost`. It must be `127.0.0.1`. Open the local app at `http://127.0.0.1:8787`, not `localhost`.
6. Open User Management. Add every person (name + their Spotify email). Max 5 including you.
7. Copy the client ID and client secret.

### 3. Last.fm key

Get a free API key at https://www.last.fm/api/account/create.

### 4. Database and secrets

```
npx wrangler d1 create autolist
```

Paste the printed `database_id` into `wrangler.toml`. Then:

```
npm run db:migrate:remote
npx wrangler secret put SPOTIFY_CLIENT_ID
npx wrangler secret put SPOTIFY_CLIENT_SECRET
npx wrangler secret put SESSION_SECRET
npx wrangler secret put LASTFM_API_KEY
```

Make the session secret with:

```
openssl rand -hex 32
```

Settings in `wrangler.toml` under `[vars]`:

| Name | Meaning |
|---|---|
| `PLAYLIST_PREFIX` | Start of playlist names. Default `Autolist`. |
| `ADMIN_SPOTIFY_ID` | Optional. Your Spotify user id or account_id. If empty, the first account to connect becomes admin (stored in D1). |

### 5. Deploy

```
npm run deploy
```

### 6. Connect yourself

1. Open https://skyesthingy.pthambundit.workers.dev.
2. Click Connect Spotify as the admin.
3. 7 private playlists are created: "Autolist · <Genre>" x6 and "Autolist · Misc".

### 7. Invite friends

1. Open `/admin`.
2. Type their name and click Create invite link. The link works once and expires in 7 days.
3. Send it to them.
4. Also add them in the Spotify dashboard under User Management. Both steps are needed.

## Local testing

```
cp .dev.vars.example .dev.vars
```

Fill in the 4 secrets in `.dev.vars` (`KEY=value` lines; the file is gitignored). Then:

```
npm run db:migrate:local
npm run dev
```

Open http://127.0.0.1:8787 (not localhost).

Heads up: connecting locally creates 7 real playlists in your Spotify account, stored in the *local* database. The deployed app has its own database, so connecting there creates a second set. Delete the local test playlists in Spotify afterwards.

Trigger the cron by hand:

```
curl "http://127.0.0.1:8787/__scheduled?cron=*%2F15+*+*+*+*"
```

`npm test` runs the unit tests (genre mapping, pages). `npm run typecheck` checks types.

Live checks against the real Spotify and Last.fm APIs (skipped when the keys aren't set):

```
env $(grep -v '^#' .dev.vars | xargs) npx vitest run test/live.test.ts
```

## npm scripts

| Script | What it does |
|---|---|
| `npm run dev` | Local server on 127.0.0.1:8787 with scheduled testing on |
| `npm run deploy` | Deploy to Cloudflare |
| `npm run typecheck` | TypeScript check |
| `npm test` | Unit tests |
| `npm run db:migrate:local` | Apply migrations to the local D1 |
| `npm run db:migrate:remote` | Apply migrations to the real D1 |

## How it works

Every 15 minutes, for each active user in round-robin order:

1. Refresh the token if it is expiring (rotated refresh tokens are saved).
2. Call `GET /me/player/recently-played?after=cursor`.
3. Skip songs already seen (tracked per user).
4. Look up the primary artist's genres:
   - D1 cache first.
   - Then Spotify `GET /artists/{id}`. (See the note below: Spotify currently sends no genres to dev-mode apps.)
   - If Spotify has none, Last.fm `artist.getTopTags`. Tags with weight >= 25 count. Junk like "seen live" is ignored.
   - If nothing anywhere, the artist is "unknown" and goes to Misc.
   - If the primary artist matches none of your 6 genres, the other credited artists are tried.
5. Map raw genres to broad buckets with `src/genres.ts`.
6. Put the song in exactly one playlist: your highest-ranked matching genre, else Misc.
7. Add songs oldest-first, up to 100 per request.

Other details:

- **Spotify genres are gone for dev-mode apps.** Checked on 2026-10-28: `GET /artists/{id}` returns no `genres` field at all, even for Drake or Taylor Swift. When the app sees that, it skips the Spotify step and goes straight to Last.fm for 7 days, then checks Spotify again (stored as `spotify_no_genres_until` in the `meta` table). That keeps a new artist at 1 subrequest instead of 2.
- Songs whose artist could not be looked up yet wait as "pending" and are placed on the next run. After 5 failed lookups (not counting runs that simply ran out of budget) a song stops waiting and goes to Misc.
- If one playlist starts failing (say it was deleted or hit Spotify's size limit), the others keep getting songs. A playlist Spotify confirms is deleted is recreated on the next run.
- Artist results (including "unknown") are cached forever and refreshed after about 90 days, a few per run.
- Your 6 genres are picked once from `GET /me/top/artists` (medium_term, plus long_term if needed), weighted by rank. If you have fewer than 6, the most popular buckets fill in.
- After that they are locked. Edit them from the home page or the admin page. The matching playlist is renamed. Songs already added stay put; songs waiting to be added are re-sorted under the new genres.
- A playlist at 9,900 songs stops receiving songs and shows a warning. Nothing is ever deleted.

## Free-plan limits and budget

| Limit | Free plan | Our budget per run |
|---|---|---|
| CPU time | 10 ms per invocation (network wait does not count) | Light work only |
| External subrequests | 50 per invocation | 40 fetches (10 headroom) |
| D1 queries | 50 per invocation (a batch counts as one) | Max 45 |
| D1 rows written | 100,000 per day | A few thousand per day |
| D1 rows read | 5M per day | Far below |
| D1 storage | 5 GB | Tiny |
| Requests | 100k per day | Far below |

How the budget is shared:

- Each user's share is the remaining budget divided by users still waiting.
- If work remains when the budget runs out, the run stops cleanly. The next run starts with the user who got skipped.

Typical cost per user per run:

- 1 recently-played call.
- +1 token refresh about every 4th run.
- +1 call per never-seen artist (Last.fm only while Spotify sends no genres; Spotify + Last.fm otherwise).
- +1 add call per playlist that got songs.
- About 3 D1 queries (batched), plus 1 per add call (each add is saved right away so a killed run can never add a song twice), plus 1 when a token is refreshed (so a rotated refresh token is never lost).

A typical cron run for 5 users with a warm cache: about 5-10 fetches and 16-25 D1 queries. If a run would go past 45 queries, it stops cleanly and the rest waits for the next run. Each run's actual counts are saved in the `meta` table under `last_cron`:

```
npx wrangler d1 execute autolist --remote --command "SELECT value FROM meta WHERE key = 'last_cron'"
```

Writes: about 1-2 rows per new song (plus index entries) and 1 status row per user per run. For 5 users x 96 runs/day that is about 500 status writes, plus songs (a heavy listener adds about 300/day). That is a few thousand rows a day, far under 100,000.

Connecting a new user costs about 11 fetches, plus up to 25 Last.fm lookups for top artists Spotify has no genres for.

## Data (D1 tables)

- `users`: one row per person, plus their last-sync status and recently-played cursor.
- `tokens`: access + refresh token per user (never shown in pages or logs).
- `playlists`: 7 rows per user (slots 0-5 = genres in rank order, 6 = Misc).
- `tracks`: every song seen per user. This is both the dedupe table and the pending queue (`status` = pending / queued / added / full).
- `artists`: shared genre cache, raw genres/tags plus where they came from (spotify / lastfm / none).
- `invites`: only a SHA-256 hash of each code is stored.
- `meta`: admin id, round-robin pointer, rate-limit back-offs, and a summary of the last cron run (`last_cron`: fetches and queries used).

## Spotify API notes (2026 changes)

- Dev mode needs a Premium app owner, allows 5 users, and User Management is manual.
- Playlists are created with `POST /me/playlists`.
- Songs are added with `POST /playlists/{id}/items` (renamed from `/tracks`).
- Batch `GET /artists` was removed, so it is one call per artist. That is why artists are cached.
- `GET /me/top/artists` and recently-played are still available in dev mode per Spotify's Feb 2026 changelog. If top artists fails, the starting 6 come from recently-played artists instead.
- Artist objects no longer include `genres`, `popularity` or `followers` for dev-mode apps (see "How it works").
- May 2026 added a stable `account_id` to `GET /me`. It's stored, and `ADMIN_SPOTIFY_ID` may be either the user id or the account_id.
- Recently-played only counts plays of about 30 seconds or more.
- On a 429, the `Retry-After` value is recorded and the run resumes later. The cron never sleeps.
- On a 401, the token is force-refreshed once and the call is retried.

## Admin page

Open `/admin` (admin only). It shows:

- User list: status, last sync, songs added, the 6 genres, playlist links.
- Invites with "N / 5 users". Pending invites count as seats.
- Remove: playlists stay in that person's Spotify account but stop updating. Their tokens and data are deleted. You cannot remove yourself.
- Pause / resume for each user.
- Edit genres for each user.

## Troubleshooting

**"Needs reconnect".** Spotify rejected the refresh token. The person opens the site and clicks Connect Spotify again. This also happens if they removed the app at spotify.com/account/apps.

**A friend's login fails, shows "403", or says "user not registered".** Almost always they are not in User Management, or the email there does not match their Spotify account email. Fix it and retry. Also check the 5-user limit.

**Too many songs land in Misc.** Open `src/genres.ts` and add the raw genre keywords you see. The raw genres are stored in the D1 table `artists`:

```
npx wrangler d1 execute autolist --remote --command "SELECT name, genres, source FROM artists ORDER BY fetched_at DESC LIMIT 30"
```

Editing `genres.ts` reclassifies cached artists automatically on redeploy, with no refetch. Songs already added do not move.

**A playlist shows Full.** It reached 9,900 songs and stops receiving songs. Nothing is deleted. See the idea below.

**Spotify 429 / rate limit.** Wait. The wait time is recorded and syncing resumes by itself.

**Everything stopped working.** If the app owner's Premium lapsed, the app stops working. Renew Premium.

## Possible later: rolling playlists

This is a proposal. It is NOT built. Ask before enabling.

Idea: when a playlist is full, remove its oldest songs to make room. It would need `DELETE /playlists/{id}/items` calls and a way to track song order.
