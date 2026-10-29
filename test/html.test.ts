import { describe, expect, it } from 'vitest';
import {
  adminPage,
  esc,
  genresEditPage,
  homePage,
  inviteCreatedPage,
  landingPage,
  messagePage,
} from '../src/html';
import type { AdminView, PlaylistView, SyncInfo } from '../src/types';

const sync: SyncInfo = {
  status: 'active',
  lastSyncAt: 1700000000000,
  lastSyncOk: true,
  lastSyncMsg: 'fine',
  lastSyncAdded: 3,
  totalAdded: 42,
  pending: 1,
};
const nasty = '<script>x</script>';
const playlists: PlaylistView[] = Array.from({ length: 7 }, (_, i) => ({
  slot: i,
  bucket: i === 6 ? 'Misc' : `G${i}`,
  name: `Autolist · G${i}`,
  url: i === 0 ? null : `https://open.spotify.com/playlist/${i}`,
  count: i,
  full: i === 1,
}));

const user = (over = {}) => ({
  id: 'u1',
  name: nasty,
  isSelf: false,
  sync,
  genres: ['A', 'B', 'C', 'D', 'E', 'F'],
  playlists,
  ...over,
});
const admin = (over: Partial<AdminView> = {}): AdminView => ({
  users: [user(), user({ id: 'me', name: "O'Brien", isSelf: true })],
  invites: [{ codeHash: 'h"1', label: nasty, createdAt: 1, expiresAt: 1700000000000 }],
  seatsUsed: 3,
  maxUsers: 5,
  canInvite: true,
  ...over,
});

describe('html', () => {
  it('esc', () => {
    expect(esc(`<>&"'`)).toBe('&lt;&gt;&amp;&quot;&#39;');
  });

  it('home escapes, has sync form, handles paused', () => {
    const v = { userId: 'a&b', userName: nasty, isAdmin: true, sync, playlists, recent: [], flash: "O'Brien" };
    const h = homePage(v);
    expect(h).not.toContain(nasty);
    expect(h).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(h).toContain('action="/sync"');
    expect(h).toContain('href="/admin"');
    expect(h).toContain('/genres?user=a%26b');
    expect(h).toContain('not created yet');
    expect(h).toContain('Full (9,900+)');
    expect(h).toContain('O&#39;Brien');
    const p = homePage({ ...v, sync: { ...sync, status: 'paused' } });
    expect(p).not.toContain('action="/sync"');
    expect(p).toContain('paused by the admin');
    expect(homePage({ ...v, sync: { ...sync, status: 'needs_reconnect' } })).toContain('Reconnect');
  });

  it('admin hides Remove for self, escapes confirm text', () => {
    const h = adminPage(admin());
    expect(h).not.toContain(nasty);
    expect(h.match(/action="\/admin\/user\/remove"/g)).toHaveLength(1);
    expect(h).toContain('data-confirm=');
    expect(h).toContain('User Management');
    expect(h).toContain('3 / 5 users');
  });

  it('admin disables invite when !canInvite', () => {
    const h = adminPage(admin({ canInvite: false }));
    expect(h).toContain('type="submit" disabled');
    expect(h).toContain('User Management');
  });

  it('other pages', () => {
    expect(landingPage({ error: nasty, invitedAs: "O'Brien" })).not.toContain(nasty);
    expect(landingPage({})).toContain('href="/login"');
    expect(inviteCreatedPage({ link: 'https://x/?a="b"', label: nasty, expiresAt: 1 })).not.toContain(nasty);
    const g = genresEditPage({
      userId: 'u', userName: nasty, slots: ['A', 'B', 'C', 'D', 'E', 'F'],
      options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'], backUrl: '/', error: 'bad',
    });
    expect(g).toContain('name="slot5"');
    expect(g).toContain('<option value="A" selected>');
    expect(messagePage('Invite expired', nasty, { href: '/', text: 'Home' })).not.toContain(nasty);
  });
});
