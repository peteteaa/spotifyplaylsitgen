export interface Env {
  DB: D1Database;
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  LASTFM_API_KEY: string;
  ADMIN_SPOTIFY_ID?: string;
  PLAYLIST_PREFIX?: string;
}

export const MAX_USERS = 5; // Spotify dev-mode cap, admin included
export const PLAYLIST_CAP = 9900; // stop adding before Spotify's ~10,000-item limit
export const GENRE_SLOTS = 6;
export const MISC_SLOT = 6;

export type UserStatus = 'active' | 'paused' | 'needs_reconnect';
export type TrackStatus = 'pending' | 'queued' | 'added' | 'full';

// ---- D1 rows ----

export interface UserRow {
  id: string;
  account_id: string | null;
  display_name: string;
  status: UserStatus;
  created_at: number;
  cursor_after: number | null;
  lock_until: number | null;
  last_sync_at: number | null;
  last_sync_ok: number | null;
  last_sync_msg: string | null;
  last_sync_added: number;
  total_added: number;
}

export interface TokenRow {
  user_id: string;
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

export interface PlaylistRow {
  user_id: string;
  slot: number;
  bucket: string;
  spotify_id: string | null;
  name_synced: number;
  item_count: number;
}

export interface TrackRow {
  user_id: string;
  track_id: string;
  name: string;
  artist_ids: string;
  artist_names: string;
  played_at: number;
  status: TrackStatus;
  slot: number | null;
  added_at: number | null;
  tries: number;
}

export interface ArtistRow {
  id: string;
  name: string;
  genres: string;
  source: 'spotify' | 'lastfm' | 'none';
  fetched_at: number;
}

export interface InviteRow {
  code_hash: string;
  label: string;
  created_at: number;
  expires_at: number;
  used_at: number | null;
  used_by: string | null;
}

// ---- View models rendered by src/html.ts ----

export interface PlaylistView {
  slot: number; // 0-5 genre, 6 Misc
  bucket: string; // e.g. "Hip-Hop" or "Misc"
  name: string; // full Spotify name, e.g. "Autolist · Hip-Hop"
  url: string | null; // https://open.spotify.com/playlist/<id>, null if not created yet
  count: number;
  full: boolean; // count >= PLAYLIST_CAP: no longer receiving songs
}

export interface SyncInfo {
  status: UserStatus;
  lastSyncAt: number | null;
  lastSyncOk: boolean | null;
  lastSyncMsg: string | null;
  lastSyncAdded: number;
  totalAdded: number;
  pending: number; // songs waiting for a genre lookup or to be added
}

export interface RecentAdd {
  name: string;
  artists: string; // "Artist A, Artist B"
  playlistName: string;
  addedAt: number;
}

export interface HomeView {
  userId: string;
  userName: string;
  isAdmin: boolean;
  sync: SyncInfo;
  playlists: PlaylistView[]; // always 7, slot order
  recent: RecentAdd[]; // newest first, up to 10
  flash?: string;
}

export interface AdminUserView {
  id: string;
  name: string;
  isSelf: boolean; // the admin's own row: no remove button
  sync: SyncInfo;
  genres: string[]; // the 6 buckets, rank order
  playlists: PlaylistView[];
}

export interface InviteView {
  codeHash: string;
  label: string;
  createdAt: number;
  expiresAt: number;
}

export interface AdminView {
  users: AdminUserView[];
  invites: InviteView[]; // unused, unexpired
  seatsUsed: number; // users + pending invites
  maxUsers: number;
  canInvite: boolean;
  flash?: string;
}

export interface GenresEditView {
  userId: string;
  userName: string;
  slots: string[]; // current 6 buckets, rank order
  options: readonly string[]; // every bucket name
  backUrl: string; // "/" or "/admin"
  error?: string;
}
