import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const CHOICES = ['liked', 'disliked', 'want', 'skip'];

export function openDb(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS posts (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      anilist_id  INTEGER NOT NULL,
      title       TEXT    NOT NULL,
      color       TEXT,
      site_url    TEXT,
      channel_id  TEXT,
      message_id  TEXT,
      thread_id   TEXT,
      posted_at   INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS votes (
      post_id    INTEGER NOT NULL REFERENCES posts(id),
      user_id    TEXT    NOT NULL,
      choice     TEXT    NOT NULL CHECK (choice IN ('liked','disliked','want','skip')),
      voted_at   INTEGER NOT NULL,
      PRIMARY KEY (post_id, user_id)
    );
  `);

  const stmts = {
    insertPost: db.prepare(
      'INSERT INTO posts (anilist_id, title, color, site_url, posted_at) VALUES (?, ?, ?, ?, ?)',
    ),
    attachMessage: db.prepare('UPDATE posts SET channel_id = ?, message_id = ?, thread_id = ? WHERE id = ?'),
    deletePost: db.prepare('DELETE FROM posts WHERE id = ?'),
    getPost: db.prepare('SELECT * FROM posts WHERE id = ?'),
    postedIds: db.prepare('SELECT anilist_id FROM posts'),
    postsSince: db.prepare('SELECT * FROM posts WHERE posted_at >= ? AND message_id IS NOT NULL ORDER BY posted_at'),
    lastPostSince: db.prepare('SELECT * FROM posts WHERE posted_at >= ? AND message_id IS NOT NULL ORDER BY posted_at DESC LIMIT 1'),
    upsertVote: db.prepare(`
      INSERT INTO votes (post_id, user_id, choice, voted_at) VALUES (?, ?, ?, ?)
      ON CONFLICT (post_id, user_id) DO UPDATE SET choice = excluded.choice, voted_at = excluded.voted_at`),
    deleteVote: db.prepare('DELETE FROM votes WHERE post_id = ? AND user_id = ?'),
    getVote: db.prepare('SELECT choice FROM votes WHERE post_id = ? AND user_id = ?'),
    counts: db.prepare('SELECT choice, COUNT(*) AS n FROM votes WHERE post_id = ? GROUP BY choice'),
    votersSince: db.prepare(`
      SELECT COUNT(DISTINCT v.user_id) AS n FROM votes v JOIN posts p ON p.id = v.post_id WHERE p.posted_at >= ?`),
    watchlist: db.prepare(`
      SELECT p.* FROM votes v JOIN posts p ON p.id = v.post_id
      WHERE v.user_id = ? AND v.choice = 'want' ORDER BY p.posted_at DESC LIMIT 25`),
  };

  return {
    raw: db,
    createPost({ anilistId, title, color, siteUrl, postedAt = Date.now() }) {
      return Number(stmts.insertPost.run(anilistId, title, color ?? null, siteUrl ?? null, postedAt).lastInsertRowid);
    },
    attachMessage(postId, { channelId, messageId, threadId }) {
      stmts.attachMessage.run(channelId, messageId, threadId ?? null, postId);
    },
    deletePost(postId) {
      stmts.deletePost.run(postId);
    },
    getPost(postId) {
      return stmts.getPost.get(postId);
    },
    postedAnilistIds() {
      return new Set(stmts.postedIds.all().map((r) => r.anilist_id));
    },
    postsSince(ts) {
      return stmts.postsSince.all(ts);
    },
    lastPostSince(ts) {
      return stmts.lastPostSince.get(ts);
    },
    setVote(postId, userId, choice) {
      if (!CHOICES.includes(choice)) throw new Error(`Choix inconnu : ${choice}`);
      stmts.upsertVote.run(postId, userId, choice, Date.now());
    },
    removeVote(postId, userId) {
      return stmts.deleteVote.run(postId, userId).changes > 0;
    },
    getVote(postId, userId) {
      return stmts.getVote.get(postId, userId)?.choice ?? null;
    },
    counts(postId) {
      const out = Object.fromEntries(CHOICES.map((c) => [c, 0]));
      for (const row of stmts.counts.all(postId)) out[row.choice] = Number(row.n);
      return out;
    },
    votersSince(ts) {
      return Number(stmts.votersSince.get(ts).n);
    },
    watchlist(userId) {
      return stmts.watchlist.all(userId);
    },
  };
}
